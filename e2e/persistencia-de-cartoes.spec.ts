import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  aguardarProntidao,
  criarPastaTemporaria,
  criarBaralhoPelaApi,
  criarUsuarioDeProva,
  descarregarPagina,
  encerrarProcesso,
  entrarSeNecessario,
  iniciarApi,
  iniciarFrontend,
  listarCartoesPelaApi,
  portaLivre,
  removerPastaTemporaria,
} from "./servidores-locais";
import type { ProcessoIniciado } from "./servidores-locais";

// T014 — prova E2E real de persistência (FR-040, SC-003;
// specs/001-criar-cartao/tasks.md).
//
// Diferente de T003/T013, nenhuma rede é interceptada e nenhum dado é
// fabricado: a API real (node + SQLite em arquivo) e o frontend real (Vite
// dev) são iniciados como processos filhos do próprio teste, em portas
// livres e com um arquivo SQLite temporário exclusivo. No Chromium, dois
// Cartões são criados pela tela real de Cartões; API e frontend são então
// encerrados e reiniciados apontando para o mesmo arquivo; a UI é reaberta
// e os dois Cartões precisam reaparecer com exatamente as mesmas Frentes e
// Versos — e os mesmos ids, conferidos também direto na API.
//
// O teste aguarda a prontidão de cada processo antes de usá-lo e encerra
// ambos no `finally`, inclusive quando a prova falha no meio. O arquivo e a
// pasta temporários vivem em os.tmpdir() e são removidos ao final: nada é
// versionado.

const PRIMEIRO_CARTAO = {
  frente: "A capital da França",
  verso: "Paris",
} as const;

const SEGUNDO_CARTAO = {
  frente: "2 + 2",
  verso: "4",
} as const;

test.setTimeout(120_000);

test("Cartões criados pela UI persistem após reiniciar API e frontend (FR-040, SC-001, SC-003)", async ({ page: paginaInicial, browserName }) => {
  // Navegador real: Chromium, sem DOM simulado.
  expect(browserName).toBe("chromium");

  let page = paginaInicial;
  const pasta = await criarPastaTemporaria("cartoes-t014-");
  const caminhoDoBanco = join(pasta, "cartoes.sqlite");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    // Primeira execução: API com arquivo SQLite temporário exclusivo e
    // frontend real, cada um em porta livre e aguardando prontidão. A porta
    // do frontend é sondada só depois de a API ocupar a sua — a janela de
    // corrida da sondagem nunca devolve a porta já em uso.
    const portaDaApi = await portaLivre();

    api = iniciarApi(caminhoDoBanco, portaDaApi);

    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;

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

    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;

    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);

    await aguardarProntidao(
      frontend,
      enderecoDoFrontend,
      (resposta) => resposta.ok,
    );

    // O Usuário de prova é cadastrado antes de qualquer operação de acervo: a
    // Credencial dele acompanha toda requisição (FR-090).
    await criarUsuarioDeProva(enderecoDaApi);
    const primeiroBaralho = await criarBaralhoPelaApi(enderecoDaApi, { nome: "Geografia" });
    const outroBaralho = await criarBaralhoPelaApi(enderecoDaApi, { nome: "Matemática" });

    // A UI real abre sobre um acervo vazio — o arquivo é novo, sem Cartões — e
    // exige Entrar antes de mostrar qualquer coisa (FR-097); depois de Entrar
    // o destino é Baralhos, e a lista de Cartões é alcançada pela navegação
    // "Principal".
    await page.goto(enderecoDoFrontend);
    await entrarSeNecessario(page);
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${primeiroBaralho.id}`);

    await expect(
      page.getByRole("heading", { level: 1, name: "Geografia" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Cartões do Baralho" }).getByRole("listitem")).toHaveCount(0);
    await expect(
      page.getByText("Este Baralho ainda não tem Cartões."),
    ).toBeVisible();

    // Exatamente dois Cartões criados pela UI, sem nenhuma interceptação de
    // rede: cada POST chega ao banco SQLite em arquivo.
    await criarCartaoPelaUi(page, PRIMEIRO_CARTAO, "Geografia");
    await expect(page.getByRole("region", { name: "Cartões do Baralho" }).getByRole("listitem")).toHaveCount(1);

    await criarCartaoPelaUi(page, SEGUNDO_CARTAO, "Geografia");
    await expect(page.getByRole("region", { name: "Cartões do Baralho" }).getByRole("listitem")).toHaveCount(2);

    await criarCartaoPelaUi(page, PRIMEIRO_CARTAO, "Geografia");
    await expect(page.getByRole("region", { name: "Cartões do Baralho" }).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByRole("status").filter({ hasText: "A capital da França (2)" })).toBeVisible();

    await page.goto(`${enderecoDoFrontend}/#/baralhos/${outroBaralho.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Matemática" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Cartões do Baralho" }).getByRole("listitem")).toHaveCount(0);

    const criados = await listarCartoesPelaApi(enderecoDaApi);

    expect(criados).toHaveLength(3);

    // Sem documento do app aberto, o reinício não provoca recarga automática do cliente do Vite.
    await descarregarPagina(page);

    // Encerrar os dois processos...
    await encerrarProcesso(frontend);
    frontend = null;

    await encerrarProcesso(api);
    api = null;

    // ...e reiniciar ambos apontando para o mesmo arquivo SQLite, nas
    // mesmas portas.
    api = iniciarApi(caminhoDoBanco, portaDaApi);

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

    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);

    await aguardarProntidao(
      frontend,
      enderecoDoFrontend,
      (resposta) => resposta.ok,
    );

    // Reabrir a UI: a Credencial não sobreviveu ao recarregamento, então
    // Entrar é exigido de novo (FR-089, SC-031); os dois Cartões persistem,
    // cada um com a sua Frente e o seu Verso, e nada além deles.
    // A aba anterior ainda tem o cliente de recarga do Vite. Ao servidor
    // voltar, ele restaura por conta própria o hash #/cartoes e disputa com
    // uma navegação para a raiz. Uma aba nova no mesmo contexto é a reabertura
    // que o cenário quer provar: mantém os cookies do navegador sem essa
    // navegação pendente.
    const paginaReaberta = await page.context().newPage();
    await page.close();
    page = paginaReaberta;

    await page.goto(enderecoDoFrontend);
    await entrarSeNecessario(page);
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${primeiroBaralho.id}`);

    await expect(
      page.getByRole("heading", { level: 1, name: "Geografia" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Cartões do Baralho" }).getByRole("listitem")).toHaveCount(3);

    await conferirCartaoNaLista(page, PRIMEIRO_CARTAO);
    await conferirCartaoNaLista(page, SEGUNDO_CARTAO);
    await conferirCartaoNaLista(page, { frente: "A capital da França (2)", verso: "Paris" });

    // Persistência exata conferida também direto na API: os mesmos ids, as
    // mesmas Frentes e os mesmos Versos — os Cartões foram relidos do
    // arquivo, não recriados.
    const persistidos = await listarCartoesPelaApi(enderecoDaApi);

    expect(persistidos).toHaveLength(3);
    expect(persistidos).toEqual(expect.arrayContaining(criados));
  } finally {
    // Encerrar sempre, mesmo quando a prova falha no meio, e remover o
    // arquivo e a pasta temporários.
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});

/**
 * Vai para a lista de Cartões pela navegação principal: depois de Entrar o
 * destino é Baralhos, e a lista de Cartões é uma página própria.
 */
/**
 * Cria um Cartão pela tela real: abre a página "Criar cartão" a partir da
 * lista de Cartões, preenche Frente e Verso e salva; o sucesso volta para a
 * lista de Cartões.
 */
async function criarCartaoPelaUi(
  page: Page,
  cartao: { frente: string; verso: string },
  nomeDoBaralho: string,
): Promise<void> {
  // Com a lista vazia, "Criar cartão" aparece duas vezes: no cabeçalho da
  // página e na ação do estado vazio. O primeiro (o do cabeçalho) é sempre
  // o caminho da criação.
  await page.getByRole("link", { name: "Criar Cartão" }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Criar cartão" }),
  ).toBeVisible();

  await page.getByLabel("Frente").fill(cartao.frente);
  await page.getByLabel("Verso").fill(cartao.verso);
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: nomeDoBaralho }),
  ).toBeVisible();
}

/**
 * Confere que o Cartão está na lista uma única vez, com a Frente como título
 * e sem o Verso (spec 021, FR-344); o Verso persistido é conferido na API.
 */
async function conferirCartaoNaLista(
  page: Page,
  cartao: { frente: string; verso: string },
): Promise<void> {
  const item = page.getByRole("region", { name: "Cartões do Baralho" })
    .getByRole("listitem")
    .filter({ has: page.getByText(cartao.frente, { exact: true }) });

  await expect(item).toHaveCount(1);
  await expect(item).toContainText(cartao.verso);
}
