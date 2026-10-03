import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { MIGRACOES } from "../backend/src/armazenamento/sqlite/migracoes";

import {
  aguardarProntidao,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  entrarSeNecessario,
  iniciarApi,
  iniciarFrontend,
  lerVersaoDoEsquema,
  listarBaralhosPelaApi,
  obterBaralhoPelaApi,
  portaLivre,
  removerPastaTemporaria,
} from "./servidores-locais";
import type { ProcessoIniciado } from "./servidores-locais";

// T214 — prova E2E real de persistência de Vínculos e de migração única
// (FR-040, SC-003; specs/003-vincular-cartao-baralho/tasks.md).
//
// Nenhuma rede é interceptada e nenhum dado é fabricado: a API real
// (node + SQLite em arquivo) e o frontend real (Vite dev) são iniciados como
// processos filhos do próprio teste, em portas livres e com um arquivo SQLite
// temporário exclusivo. No Chromium, um Cartão e um Baralho são criados pelas
// telas reais; o Vínculo é criado pela tela de Vínculos; API e frontend são
// então encerrados e reiniciados apontando para o mesmo arquivo; a UI é
// reaberta e o Vínculo precisa reaparecer — o Baralho elegível, com o Cartão
// na lista de vinculados e a lista de não vinculados vazia. A versão do
// esquema é lida do arquivo nas duas subidas: permanece a versão mais recente
// exportada pelas migrações do backend, provando que a migração de Vínculos
// rodou uma única vez.
//
// O teste aguarda a prontidão de cada processo antes de usá-lo e encerra
// ambos no `finally`, inclusive quando a prova falha no meio.

const CARTAO = {
  frente: "To walk",
  verso: "Caminhar",
} as const;

const NOME_DO_BARALHO = "Inglês";

/** A versão que uma base nova deve registrar depois que todas as migrações rodam. */
const ULTIMA_VERSAO_DO_ESQUEMA = MIGRACOES.reduce(
  (maisRecente, migracao) => Math.max(maisRecente, migracao.versao),
  0,
);

test.setTimeout(120_000);

test("Vínculos criados pela UI persistem após reiniciar API e frontend, e a migração não reaplica (FR-040, SC-003)", async ({ page: paginaInicial, browserName }) => {
  // Navegador real: Chromium, sem DOM simulado.
  expect(browserName).toBe("chromium");

  let page = paginaInicial;
  const pasta = await criarPastaTemporaria("vinculos-t214-");
  const caminhoDoBanco = join(pasta, "vinculos.sqlite");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    // Primeira execução: API com arquivo SQLite temporário exclusivo e
    // frontend real, cada um em porta livre e aguardando prontidão.
    const portaDaApi = await portaLivre();

    api = iniciarApi(caminhoDoBanco, portaDaApi);

    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;

    await aguardarApiPronta(api, enderecoDaApi);

    // A primeira subida aplica todas as migrações pendentes: a base nova
    // termina na versão mais recente do esquema.
    const versaoNaPrimeiraSubida = lerVersaoDoEsquema(caminhoDoBanco);
    expect(versaoNaPrimeiraSubida).toBe(ULTIMA_VERSAO_DO_ESQUEMA);

    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;

    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);

    await aguardarProntidao(
      frontend,
      enderecoDoFrontend,
      (resposta) => resposta.ok,
    );

    // O Usuário de prova é cadastrado antes de qualquer operação de acervo: o
    // Cartão e o Baralho desta prova são do acervo dele (FR-090, FR-092).
    await criarUsuarioDeProva(enderecoDaApi);

    // Prepara um Cartão e um Baralho reais, pelas telas das features 001 e
    // 002 — o Vínculo será um ato distinto, na tela desta feature. Cada criação
    // é uma página própria (`#/cartoes/novo`, `#/baralhos/novo`), alcançada
    // pelo link da lista (spec 012).
    await abrirRotaAutenticada(page, enderecoDoFrontend, "#/cartoes");
    await criarCartaoPelaUi(page, CARTAO);
    await expect(
      page.getByRole("link", { name: `Editar ${CARTAO.frente}` }),
    ).toBeVisible();

    await abrirRotaAutenticada(page, enderecoDoFrontend, "#/baralhos");
    await criarBaralhoPelaUi(page, NOME_DO_BARALHO);

    // A criação bem-sucedida leva ao detalhe do Baralho novo (spec 012).
    await expect(
      page.getByRole("heading", { level: 1, name: NOME_DO_BARALHO }),
    ).toBeVisible();

    // De volta à lista, o Baralho novo aparece e ainda não é elegível: sem
    // Cartões vinculados, "Estudar" é um botão desabilitado (spec 012).
    await abrirRotaAutenticada(page, enderecoDoFrontend, "#/baralhos");
    await expect(
      page.getByRole("link", { name: NOME_DO_BARALHO, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Estudar ${NOME_DO_BARALHO}` }),
    ).toBeDisabled();

    const baralhosCriados = await listarBaralhosPelaApi(enderecoDaApi);
    expect(baralhosCriados).toHaveLength(1);
    const idDoBaralho = baralhosCriados[0].id;

    // A tela de Vínculos é a página de detalhe do Baralho (spec 012): o
    // Cartão ainda não está vinculado e o ato de vincular vive na página
    // "Adicionar cartões existentes".
    await abrirRotaAutenticada(
      page,
      enderecoDoFrontend,
      `#/baralhos/${idDoBaralho}`,
    );

    await expect(
      page.getByRole("heading", { level: 1, name: NOME_DO_BARALHO }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cartões do Baralho" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Remover ${CARTAO.frente} deste baralho`,
      }),
    ).toHaveCount(0);

    await page
      .getByRole("link", { name: "Adicionar cartões existentes" })
      .click();

    await page
      .getByRole("button", { name: `Vincular ${CARTAO.frente}` })
      .click();

    // A vinculação é assíncrona e protegida: enquanto a operação corre, sair
    // da tela é bloqueado e a lista de disponíveis ainda mostra o Cartão. Só
    // depois que o servidor confirma o Vínculo o Cartão sai da lista. Esperar
    // por isso garante que o Vínculo já existe antes de navegar — sem essa
    // espera, a lista de Baralhos seria relida sem o Vínculo e o Baralho
    // ainda apareceria inelegível.
    await expect(
      page.getByRole("button", { name: `Vincular ${CARTAO.frente}` }),
    ).toHaveCount(0);

    // O Vínculo é o que torna o Baralho elegível para estudo (spec 012): a
    // lista passa a oferecer "Estudar" como link.
    await abrirRotaAutenticada(page, enderecoDoFrontend, "#/baralhos");
    await expect(
      page.getByRole("link", { name: `Estudar ${NOME_DO_BARALHO}` }),
    ).toBeVisible();

    // O Cartão vinculado aparece na seção "Cartões do Baralho" do detalhe.
    await abrirRotaAutenticada(
      page,
      enderecoDoFrontend,
      `#/baralhos/${idDoBaralho}`,
    );
    await expect(
      page.getByRole("button", {
        name: `Remover ${CARTAO.frente} deste baralho`,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("listitem").filter({ hasText: CARTAO.frente }),
    ).toHaveCount(1);

    const baralhoVinculado = await obterBaralhoPelaApi(
      enderecoDaApi,
      idDoBaralho,
    );
    expect(baralhoVinculado.elegivel).toBe(true);
    expect(baralhoVinculado.cartoes).toHaveLength(1);
    expect(baralhoVinculado.cartoes[0].frente).toBe(CARTAO.frente);

    // Encerrar os dois processos...
    await encerrarProcesso(frontend);
    frontend = null;

    await encerrarProcesso(api);
    api = null;

    // ...e reiniciar ambos apontando para o mesmo arquivo SQLite, nas
    // mesmas portas.
    api = iniciarApi(caminhoDoBanco, portaDaApi);

    await aguardarApiPronta(api, enderecoDaApi);

    // A migração já aplicada não roda de novo: o servidor sobe saudável e a
    // versão do esquema não avança além da mais recente.
    const versaoNaSegundaSubida = lerVersaoDoEsquema(caminhoDoBanco);

    expect(versaoNaSegundaSubida).toBe(ULTIMA_VERSAO_DO_ESQUEMA);
    expect(versaoNaSegundaSubida).toBe(versaoNaPrimeiraSubida);

    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);

    await aguardarProntidao(
      frontend,
      enderecoDoFrontend,
      (resposta) => resposta.ok,
    );

    // Reabrir a aplicação: reiniciar o frontend descarta a Credencial, que
    // vivia apenas na memória da página, e Entrar é exigido de novo (FR-089,
    // SC-031). O recarregamento é explícito — um `goto` que só muda o
    // fragmento não recarrega o documento — para que a sessão autenticada seja
    // restabelecida de forma determinística antes das telas do acervo.
    page = await recarregarAutenticado(page, enderecoDoFrontend);

    // A tela desejada é alcançada pela navegação "Principal", e não por um
    // fragmento posto às cegas: depois de Entrar a aplicação abre o Início.
    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Baralhos" })
      .click();

    // O Baralho continua elegível para estudo: o Vínculo persistiu.
    await expect(
      page.getByRole("link", { name: `Estudar ${NOME_DO_BARALHO}` }),
    ).toBeVisible();

    // O detalhe segue com o Cartão vinculado (mesmo id, mesma Frente e Verso).
    await page
      .getByRole("link", { name: NOME_DO_BARALHO, exact: true })
      .click();

    await expect(
      page.getByRole("heading", { level: 1, name: NOME_DO_BARALHO }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Remover ${CARTAO.frente} deste baralho`,
      }),
    ).toBeVisible();

    const itemVinculado = page
      .getByRole("listitem")
      .filter({ hasText: CARTAO.frente });
    await expect(itemVinculado).toHaveCount(1);
    await expect(itemVinculado).toContainText(CARTAO.verso);

    const persistido = await obterBaralhoPelaApi(enderecoDaApi, idDoBaralho);
    expect(persistido).toEqual(baralhoVinculado);
  } finally {
    // Encerrar sempre, mesmo quando a prova falha no meio, e remover o
    // arquivo e a pasta temporários.
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});

/**
 * Abre `rota` já autenticado, reafirmando o destino depois do Entrar.
 *
 * Depois de Entrar a aplicação abre o Início (spec 013), e não a rota pedida:
 * quem depende de uma tela específica precisa reafirmá-la. Quando o documento
 * é recarregado — o frontend reiniciado, ou o Vite reconectando —, a Credencial
 * mantida apenas na memória se vai e Entrar é exigido de novo (FR-089,
 * SC-031). A rota é reafirmada pelo fragmento, sem recarregar: um
 * recarregamento descartaria a Credencial recém-obtida e pediria Entrar outra
 * vez.
 */
async function abrirRotaAutenticada(
  page: Page,
  enderecoDoFrontend: string,
  rota: string,
): Promise<void> {
  await page.goto(`${enderecoDoFrontend}${rota}`);
  await entrarSeNecessario(page);

  await page.evaluate((destino) => {
    window.location.hash = destino;
  }, rota);
}

/**
 * Reabre a aplicação autenticada depois de reiniciar os servidores.
 *
 * A Credencial vive apenas na memória da página (FR-079, SC-033) e reiniciar o
 * frontend a descarta: o documento é recarregado de propósito — um `goto` que
 * só muda o fragmento não recarrega — e Entrar é refeito antes de qualquer
 * tela do acervo (FR-089, SC-031). Depois de Entrar a aplicação mostra a rota
 * do fragmento, por isso o destino seguinte é reafirmado pela navegação, e não
 * pelo fragmento posto às cegas.
 */
async function recarregarAutenticado(
  page: Page,
  enderecoDoFrontend: string,
): Promise<Page> {
  // A página antiga pode manter o cliente de recarga do Vite e restaurar o
  // hash ativo quando o servidor volta, interrompendo `goto`. Uma página nova
  // no mesmo contexto preserva cookies e começa sem navegação pendente.
  const paginaReaberta = await page.context().newPage();
  await page.close();
  await paginaReaberta.goto(`${enderecoDoFrontend}/`);
  await entrarSeNecessario(paginaReaberta);
  return paginaReaberta;
}

/**
 * Cria um Cartão pela tela real (spec 012): a lista de Cartões não tem mais
 * formulário embutido — o link "Criar cartão" leva à página `#/cartoes/novo`,
 * onde Frente e Verso são preenchidos e "Salvar" submete. O sucesso volta à
 * lista de Cartões.
 */
async function criarCartaoPelaUi(
  page: Page,
  cartao: { frente: string; verso: string },
): Promise<void> {
  await page.getByRole("link", { name: "Criar cartão" }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Criar cartão" }),
  ).toBeVisible();

  await page.getByLabel("Frente").fill(cartao.frente);
  await page.getByLabel("Verso").fill(cartao.verso);
  await page.getByRole("button", { name: "Salvar" }).click();
}

/**
 * Cria um Baralho pela tela real (spec 012): a lista de Baralhos não tem mais
 * formulário embutido — o link "Criar baralho" leva à página `#/baralhos/novo`,
 * onde o "Nome" é preenchido e "Salvar" submete. O sucesso vai ao detalhe do
 * Baralho novo.
 */
async function criarBaralhoPelaUi(page: Page, nome: string): Promise<void> {
  await page.getByRole("link", { name: "Criar baralho" }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Criar baralho" }),
  ).toBeVisible();

  await page.getByLabel("Nome").fill(nome);
  await page.getByRole("button", { name: "Salvar" }).click();
}

/** Aguarda a API responder `{ status: "ok" }` no `/health`. */
async function aguardarApiPronta(
  api: ProcessoIniciado,
  enderecoDaApi: string,
): Promise<void> {
  await aguardarProntidao(
    api,
    `${enderecoDaApi}/health`,
    async (resposta) => {
      if (!resposta.ok) {
        return false;
      }

      const corpo = (await resposta.json()) as { status?: unknown };

      return corpo.status === "ok";
    },
  );
}
