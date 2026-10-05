import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  aguardarApiPronta,
  aguardarProntidao,
  cabecalhoDeCredencial,
  criarBaralhoPelaApi,
  criarCartaoPelaApi,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  entrarSeNecessario,
  iniciarApi,
  iniciarFrontend,
  listarCartoesPelaApi,
  portaLivre,
  removerPastaTemporaria,
  vincularCartaoPelaApi,
} from "./servidores-locais";
import type { CredencialDeProva, ProcessoIniciado } from "./servidores-locais";

// T1308 — prova E2E real das Estatísticas e do Histórico de estudo
// (FR-161 a FR-179, SC-071 a SC-075;
// specs/013-estatisticas-e-historico/tasks.md).
//
// A feature 019 (FR-312 a FR-315) levou as Estatísticas do Início para a
// página Estudo (#/estudo): o Início guarda só o resumo de sete dias, e os
// ladrilhos, o gráfico e as últimas Sessões agora vivem em Estudo.
//
// Nenhuma rede é interceptada (exceto no cenário de falha de registro, que a
// intercepta de propósito) e nenhum dado é fabricado: a API real
// (node + SQLite em arquivo) e o frontend real (Vite dev) são iniciados como
// processos filhos do próprio teste, em portas livres e com um arquivo SQLite
// temporário exclusivo. Cartões, Baralho e Vínculos são criados direto pela
// API; a Sessão inteira — início, Revelação, Resultado, Resumo e Registro — é
// percorrida no Chromium pela tela real.
//
// Os cenários cobrem: (1) a Sessão concluída vira Registro e o Resumo lista
// Acertos/Erros; (2) a Sessão interrompida (ou descartada pela recarga) não
// deixa rastro; (3) o Registro preserva os textos e o nome do Baralho mesmo
// depois de editar e excluir; (4) o Histórico é isolado por Usuário; (5) uma
// falha ao registrar oferece nova tentativa e não duplica.
//
// A spec 024 tirou o formulário de início (Quantidade de Cartões + Iniciar
// Sessão): com os Cartões novos, o Baralho está Pendente e a Sessão começa
// pelo modal "Revisar baralho" — os cenários escolhem "Só pendentes" ou
// "Todos os cartões" conforme o conjunto que precisam.

const NOME_DO_BARALHO = "Inglês";
/** Um Baralho canônico: três Cartões, para uma Sessão de três Itens. */
const CARTOES_DO_BARALHO = [
  { frente: "Frente 1", verso: "Verso 1" },
  { frente: "Frente 2", verso: "Verso 2" },
  { frente: "Frente 3", verso: "Verso 3" },
];

test.setTimeout(180_000);

// --- Infraestrutura de execução real ---------------------------------------

interface Ambiente {
  pasta: string;
  api: ProcessoIniciado;
  frontend: ProcessoIniciado;
  enderecoDaApi: string;
  enderecoDoFrontend: string;
}

/**
 * Sobe a API real (SQLite em arquivo temporário exclusivo) e o frontend real
 * (Vite dev) em portas livres, aguardando a prontidão de cada um. Se algo
 * falhar no meio, limpa o que já subiu antes de propagar o erro — o `try`
 * externo do teste só cobre o caso de sucesso.
 */
async function subirAmbiente(): Promise<Ambiente> {
  const pasta = await criarPastaTemporaria("historico-");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    const portaDaApi = await portaLivre();

    api = iniciarApi(join(pasta, "historico.sqlite"), portaDaApi);

    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;

    await aguardarApiPronta(api, enderecoDaApi);

    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;

    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);

    await aguardarProntidao(
      frontend,
      enderecoDoFrontend,
      (resposta) => resposta.ok,
    );

    return { pasta, api, frontend, enderecoDaApi, enderecoDoFrontend };
  } catch (erro) {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
    throw erro;
  }
}

/** Encerra os dois processos e remove o arquivo e a pasta temporários. */
async function derrubarAmbiente(ambiente: Ambiente): Promise<void> {
  await encerrarProcesso(ambiente.frontend);
  await encerrarProcesso(ambiente.api);
  await removerPastaTemporaria(ambiente.pasta);
}

// --- Auxiliares de preparação e de tela ------------------------------------

interface BaralhoPreparado {
  id: string;
  nome: string;
  cartoes: { id: string; frente: string; verso: string }[];
}

/** Cria um Baralho com os Cartões vinculados direto pela API real. */
async function prepararBaralho(
  ambiente: Ambiente,
  credencial: CredencialDeProva,
  nome: string,
  cartoes: { frente: string; verso: string }[],
): Promise<BaralhoPreparado> {
  const baralho = await criarBaralhoPelaApi(
    ambiente.enderecoDaApi,
    { nome },
    credencial,
  );

  const criados: { id: string; frente: string; verso: string }[] = [];

  for (const cartao of cartoes) {
    const criado = await criarCartaoPelaApi(
      ambiente.enderecoDaApi,
      cartao,
      credencial,
    );

    await vincularCartaoPelaApi(
      ambiente.enderecoDaApi,
      criado.id,
      baralho.id,
      credencial,
    );

    criados.push({ id: criado.id, frente: criado.frente, verso: criado.verso });
  }

  return { id: baralho.id, nome: baralho.nome, cartoes: criados };
}

/**
 * Abre a tela de revisão do Baralho, Entra se preciso e inicia a Sessão pelo
 * modal "Revisar baralho" (spec 024): "pendentes" usa "Só pendentes" e
 * "todos" usa "Todos os cartões".
 */
async function iniciarSessaoPelaUi(
  page: Page,
  ambiente: Ambiente,
  baralhoId: string,
  escolha: "pendentes" | "todos",
  credencial?: CredencialDeProva,
): Promise<void> {
  await page.goto(
    `${ambiente.enderecoDoFrontend}/#/baralhos/${baralhoId}/estudo`,
  );
  await entrarSeNecessario(page, credencial);

  // Sem formulário de início (spec 024): o Baralho Pendente abre o modal.
  const modalDeRevisao = page.getByRole("dialog");

  await expect(modalDeRevisao).toBeVisible({ timeout: 15_000 });
  await modalDeRevisao
    .getByRole("button", {
      name: escolha === "pendentes" ? "Só pendentes" : "Todos os cartões",
      exact: true,
    })
    .click();
}

interface ItemEstudado {
  frente: string;
  verso: string;
  resultado: "acertou" | "errou";
}

/**
 * Percorre a Sessão Item a Item, com os Resultados pedidos, e devolve o que
 * foi apresentado — na ordem da Sessão — para que a tela do Resumo possa ser
 * conferida com os textos exatos, ainda que a ordem seja embaralhada.
 */
async function responderItens(
  page: Page,
  respostas: ("acertou" | "errou")[],
): Promise<ItemEstudado[]> {
  const itens: ItemEstudado[] = [];

  for (const resultado of respostas) {
    const botaoRevelar = page.getByRole("button", { name: "Revelar verso" });

    // Esperar o botão voltar garante que o Item anterior já foi respondido e
    // que a tela está de novo no estado "Frente oculta".
    await expect(botaoRevelar).toBeVisible();

    const conteudos = page.locator(".cartao-de-estudo .conteudo-do-cartao");
    const frente = (await conteudos.first().textContent())?.trim() ?? "";

    await botaoRevelar.click();
    await expect(page.getByRole("heading", { name: "Verso" })).toBeVisible();

    const verso = (await conteudos.last().textContent())?.trim() ?? "";

    // Os quatro níveis substituíram Acertei/Errei (FR-193, SC-088): "Bom" é o
    // equivalente do antigo Acerto e o nome acessível começa pelo nível.
    await page
      .getByRole("button", {
        name: resultado === "acertou" ? /^Bom/ : /^Errei/,
      })
      .click();

    itens.push({ frente, verso, resultado });
  }

  return itens;
}

/**
 * Confere os botões "Acertos (n)" / "Erros (n)" e as listas que eles abrem:
 * um grupo vazio é um botão indisponível com a explicação; um grupo com Itens
 * expande e mostra Frente e Verso de cada um (FR-174, FR-175, SC-073).
 */
async function verificarGruposDoResumo(
  page: Page,
  itens: readonly ItemEstudado[],
): Promise<void> {
  const acertos = itens.filter((item) => item.resultado === "acertou");
  const erros = itens.filter((item) => item.resultado === "errou");

  const botaoAcertos = page.getByRole("button", {
    name: `Acertos (${acertos.length})`,
  });
  const botaoErros = page.getByRole("button", {
    name: `Erros (${erros.length})`,
  });

  if (acertos.length === 0) {
    await expect(botaoAcertos).toBeDisabled();
    await expect(page.getByText("Nenhum acerto nesta Sessão")).toBeVisible();
  }

  if (erros.length === 0) {
    await expect(botaoErros).toBeDisabled();
    await expect(page.getByText("Nenhum erro nesta Sessão")).toBeVisible();
  }

  if (erros.length > 0) {
    await expect(botaoErros).toHaveAttribute("aria-expanded", "false");
    await botaoErros.click();
    await expect(botaoErros).toHaveAttribute("aria-expanded", "true");

    for (const erro of erros) {
      const botaoDoCartao = page.getByRole("button", {
        name: erro.frente,
        exact: true,
      });

      await expect(botaoDoCartao).toBeVisible();
      await botaoDoCartao.click();
      await expect(page.getByText(erro.verso, { exact: true })).toBeVisible();
    }
  }

  if (acertos.length > 0) {
    await expect(botaoAcertos).toHaveAttribute("aria-expanded", "false");
    await botaoAcertos.click();
    await expect(botaoAcertos).toHaveAttribute("aria-expanded", "true");

    for (const acerto of acertos) {
      const botaoDoCartao = page.getByRole("button", {
        name: acerto.frente,
        exact: true,
      });

      await expect(botaoDoCartao).toBeVisible();
      await botaoDoCartao.click();
      await expect(page.getByText(acerto.verso, { exact: true })).toBeVisible();
    }
  }
}

/** O ladrilho de Estatística de Estudo, pelo rótulo que o descreve (FR-314). */
function tileDoEstudo(page: Page, rotulo: string) {
  return page.locator(".estatistica", { hasText: rotulo });
}

/** A seção «Últimas sessões» de Estudo (FR-315). */
function secaoUltimasSessoes(page: Page) {
  return page.locator("section", {
    has: page.getByRole("heading", { name: "Últimas sessões" }),
  });
}

/** Navega para Estudo pela navegação principal e espera o título (FR-312). */
async function irParaEstudo(page: Page): Promise<void> {
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Estudo" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Estudo" }),
  ).toBeVisible();
}

/** Navega para Início pela navegação principal e espera a saudação. */
async function irParaInicio(page: Page, nomeDeUsuario: string): Promise<void> {
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Início" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: `Olá, ${nomeDeUsuario}` }),
  ).toBeVisible();
}

// --- Cenário 1: concluir, ver o Resumo e revê-lo no Histórico ---------------

test("Sessão concluída vira Registro e o Resumo lista Acertos e Erros (FR-161, FR-174 a FR-177, SC-071, SC-072, SC-073)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);
    const baralho = await prepararBaralho(
      ambiente,
      credencial,
      NOME_DO_BARALHO,
      CARTOES_DO_BARALHO,
    );

    await iniciarSessaoPelaUi(page, ambiente, baralho.id, "pendentes", credencial);
    await expect(page.getByRole("article", { name: "Item 1 de 3" })).toBeVisible();

    const itens = await responderItens(page, ["acertou", "acertou", "errou"]);

    // O Resumo aparece com o percentual, o total e os grupos (FR-176).
    await expect(
      page.getByRole("heading", { level: 1, name: "Sessão concluída" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Placar da Sessão" }),
    ).toContainText("67%");
    await expect(page.getByText("2 de 3 Cartões")).toBeVisible();

    await verificarGruposDoResumo(page, itens);

    // O Registro é confirmado no histórico (FR-161, FR-163, FR-164).
    await expect(
      page.getByRole("status", { name: "Situação do registro da Sessão" }),
    ).toContainText(/Sessão registrada no histórico/);

    // Início deixou de ter ladrilhos, gráfico e lista: guarda só o resumo de
    // sete dias (FR-312, FR-314, FR-315).
    await irParaInicio(page, credencial.nomeDeUsuario);

    await expect(page.locator("p.resumo-de-sete-dias")).toHaveCount(0);
    await expect(page.locator(".estatistica")).toHaveCount(0);
    await expect(page.locator(".grafico-semanal")).toHaveCount(0);
    await expect(secaoUltimasSessoes(page)).toHaveCount(0);
    // As Estatísticas da feature 019 vivem em Estudo (FR-312 a FR-315).
    await irParaEstudo(page);

    await expect(
      tileDoEstudo(page, "Itens estudados").locator(".estatistica__valor"),
    ).toHaveText("3");
    await expect(
      tileDoEstudo(page, "Sessões concluídas").locator(".estatistica__valor"),
    ).toHaveText("1");
    await expect(
      tileDoEstudo(page, "Taxa de acerto").locator(".estatistica__valor"),
    ).toHaveText("67%");

    // O gráfico de 7 dias tem o valor de Hoje em texto (FR-314).
    await expect(
      page
        .locator('section[aria-label="Itens estudados nos últimos 7 dias"]')
        .locator(".grafico-semanal__dia")
        .last()
        .locator(".grafico-semanal__valor"),
    ).toHaveText("3");

    // A Sessão recente aparece com o nome e o percentual (FR-315).
    const secaoUltimas = secaoUltimasSessoes(page);
    const linkDaSessao = secaoUltimas.getByRole("link", {
      name: NOME_DO_BARALHO,
    });

    await expect(linkDaSessao).toBeVisible();
    await expect(secaoUltimas.getByText("67%")).toBeVisible();

    // Abrir o Registro mostra o mesmo Resumo (FR-177, FR-178).
    const hrefDoRegistro = await linkDaSessao.getAttribute("href");
    expect(hrefDoRegistro).toMatch(/^#\/sessoes\//);

    await linkDaSessao.click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Sessão concluída" }),
    ).toBeVisible();
    await expect(page.getByText(NOME_DO_BARALHO)).toBeVisible();
    await expect(page.getByText("Baralho excluído")).toHaveCount(0);

    await verificarGruposDoResumo(page, itens);
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

// --- Cenário 2: interrupção e recarga não registram -------------------------

test("Sessão interrompida e Sessão recarregada não geram Registro (FR-162, SC-071)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);
    // A Sessão base (com 1 Cartão) usa um Baralho próprio: sem o campo
    // Quantidade (spec 024), o Baralho de três Cartões precisa continuar
    // inteiro — e pendente — para as Sessões interrompida e recarregada.
    const base = await prepararBaralho(ambiente, credencial, "Base", [
      CARTOES_DO_BARALHO[0],
    ]);
    const baralho = await prepararBaralho(
      ambiente,
      credencial,
      NOME_DO_BARALHO,
      CARTOES_DO_BARALHO,
    );

    // Base: uma Sessão concluída e registrada.
    await iniciarSessaoPelaUi(page, ambiente, base.id, "pendentes", credencial);
    await responderItens(page, ["acertou"]);
    await expect(
      page.getByRole("status", { name: "Situação do registro da Sessão" }),
    ).toContainText(/Sessão registrada no histórico/);

    await irParaEstudo(page);
    await expect(
      tileDoEstudo(page, "Sessões concluídas").locator(".estatistica__valor"),
    ).toHaveText("1");

    // Interromper uma Sessão em andamento (com confirmação) não registra.
    // Aqui a escolha é "Todos os cartões", que com os três Cartões novos dá o
    // mesmo conjunto da Sessão interrompida.
    await iniciarSessaoPelaUi(page, ambiente, baralho.id, "todos", credencial);
    await expect(page.getByRole("article", { name: "Item 1 de 3" })).toBeVisible();

    await page.getByRole("button", { name: "Interromper" }).click();

    const dialogoDeInterrupcao = page
      .getByRole("dialog")
      .filter({ hasText: "Interromper a Sessão?" });

    await expect(
      dialogoDeInterrupcao.getByText("Interromper a Sessão?"),
    ).toBeVisible();
    await dialogoDeInterrupcao
      .getByRole("button", { name: "Interromper" })
      .click();

    await expect(
      page.getByRole("heading", { level: 1, name: NOME_DO_BARALHO }),
    ).toBeVisible();

    await irParaEstudo(page);
    await expect(
      tileDoEstudo(page, "Sessões concluídas").locator(".estatistica__valor"),
    ).toHaveText("1");

    // Recarregar no meio de outra Sessão também descarta, sem registrar.
    await iniciarSessaoPelaUi(page, ambiente, baralho.id, "pendentes", credencial);
    await expect(page.getByRole("article", { name: "Item 1 de 3" })).toBeVisible();

    await page.reload();
    await entrarSeNecessario(page, credencial);

    // A recarga descartou a Sessão; os Cartões seguem novos, o Baralho segue
    // Pendente e o modal reaparece — sem retomar o Item que estava na tela
    // (spec 024).
    const modalDeRevisao = page.getByRole("dialog");

    await expect(modalDeRevisao.getByText("Revisar baralho")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("article", { name: "Item 1 de 3" }),
    ).toHaveCount(0);

    // Escape fecha o modal: interromper também *antes* de escolher não
    // registra Sessão alguma.
    await page.keyboard.press("Escape");
    await expect(modalDeRevisao).toHaveCount(0);

    await irParaEstudo(page);
    await expect(
      tileDoEstudo(page, "Sessões concluídas").locator(".estatistica__valor"),
    ).toHaveText("1");
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

// --- Cenário 3: o Registro sobrevive à edição e à exclusão ------------------

test("Registro preserva Frente e nome do Baralho após edição e exclusão (FR-165, FR-178, SC-074)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const frenteOriginal = "Frente original";
  const versoOriginal = "Verso original";
  const frenteEditada = "Frente editada";

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);
    const baralho = await prepararBaralho(ambiente, credencial, NOME_DO_BARALHO, [
      { frente: frenteOriginal, verso: versoOriginal },
    ]);
    const cartaoId = baralho.cartoes[0].id;

    await iniciarSessaoPelaUi(page, ambiente, baralho.id, "pendentes", credencial);
    const itens = await responderItens(page, ["acertou"]);
    await expect(
      page.getByRole("status", { name: "Situação do registro da Sessão" }),
    ).toContainText(/Sessão registrada no histórico/);

    // Guarda o endereço do Registro a partir de Estudo (FR-315).
    await irParaEstudo(page);

    const linkDaSessao = secaoUltimasSessoes(page).getByRole("link", {
      name: NOME_DO_BARALHO,
    });

    await expect(linkDaSessao).toBeVisible();

    const hrefDoRegistro = await linkDaSessao.getAttribute("href");
    expect(hrefDoRegistro).toMatch(/^#\/sessoes\//);

    // Edita a Frente do Cartão estudado, pela tela real (FR-165).
    await page.goto(`${ambiente.enderecoDoFrontend}/#/cartoes`);
    await entrarSeNecessario(page, credencial);
    await page.getByRole("link", { name: `Editar ${frenteOriginal}` }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Editar Cartão" }),
    ).toBeVisible();
    await page.getByLabel("Frente", { exact: true }).fill(frenteEditada);
    await page.getByRole("button", { name: "Salvar" }).click();

    // Confirma a edição pelo fato persistido, sem depender de onde a tela cai.
    await expect
      .poll(async () => {
        const cartoes = await listarCartoesPelaApi(
          ambiente.enderecoDaApi,
          credencial,
        );

        return cartoes.find((cartao) => cartao.id === cartaoId)?.frente;
      })
      .toBe(frenteEditada);

    // Exclui o Baralho, pela tela real.
    await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/${baralho.id}`);
    await entrarSeNecessario(page, credencial);
    await page.getByRole("button", { name: "Excluir Baralho" }).click();

    const dialogoDeExclusao = page.getByRole("dialog");

    await expect(dialogoDeExclusao).toBeVisible();
    // O foco inicial é "Cancelar"; confirmamos no outro botão do diálogo.
    await dialogoDeExclusao
      .getByRole("button")
      .filter({ hasNotText: "Cancelar" })
      .first()
      .click();

    await expect
      .poll(async () => {
        const resposta = await fetch(
          `${ambiente.enderecoDaApi}/baralhos/${baralho.id}`,
          { headers: cabecalhoDeCredencial(credencial) },
        );

        return resposta.status;
      })
      .toBe(404);

    // Abre o Registro antigo: textos originais e o selo do Baralho excluído.
    await page.goto(`${ambiente.enderecoDoFrontend}/${hrefDoRegistro}`);
    await entrarSeNecessario(page, credencial);

    await expect(
      page.getByRole("heading", { level: 1, name: "Sessão concluída" }),
    ).toBeVisible();
    await expect(page.getByText(NOME_DO_BARALHO)).toBeVisible();
    await expect(page.getByText("Baralho excluído")).toBeVisible();

    await verificarGruposDoResumo(page, itens);
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

// --- Cenário 4: o Histórico é isolado por Usuário ---------------------------

test("Histórico e Registros são isolados por Usuário (FR-166, FR-179, SC-075)", async ({ browser, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();
  const contextoA = await browser.newContext();
  const contextoB = await browser.newContext();

  try {
    const paginaA = await contextoA.newPage();
    const paginaB = await contextoB.newPage();

    // Usuário A prepara o acervo, conclui e registra uma Sessão.
    const credencialA = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.a",
    );
    const baralho = await prepararBaralho(
      ambiente,
      credencialA,
      NOME_DO_BARALHO,
      CARTOES_DO_BARALHO,
    );

    await iniciarSessaoPelaUi(paginaA, ambiente, baralho.id, "pendentes", credencialA);
    await responderItens(paginaA, ["acertou", "acertou", "errou"]);
    await expect(
      paginaA.getByRole("status", { name: "Situação do registro da Sessão" }),
    ).toContainText(/Sessão registrada no histórico/);

    // As últimas Sessões vivem em Estudo desde a 019 (FR-315).
    await irParaEstudo(paginaA);

    const linkDaSessao = secaoUltimasSessoes(paginaA).getByRole("link", {
      name: NOME_DO_BARALHO,
    });

    await expect(linkDaSessao).toBeVisible();

    const hrefDoRegistro = await linkDaSessao.getAttribute("href");
    expect(hrefDoRegistro).toMatch(/^#\/sessoes\//);

    // Usuário B, em outro contexto, não vê nada do Histórico de A.
    const credencialB = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.b",
    );

    await paginaB.goto(`${ambiente.enderecoDoFrontend}/#/inicio`);
    await entrarSeNecessario(paginaB, credencialB);

    await expect(
      paginaB.getByRole("heading", {
        level: 1,
        name: `Olá, ${credencialB.nomeDeUsuario}`,
      }),
    ).toBeVisible();
    // Sem acervo, o Início mostra o resumo vazio e o caminho do primeiro
    // Cartão (FR-312, FR-314).
    await expect(paginaB.locator("p.resumo-de-sete-dias")).toHaveCount(0);
    await expect(
      paginaB.getByRole("link", { name: "Criar o primeiro Cartão" }),
    ).toBeVisible();
    // As Estatísticas da feature 019 vivem em Estudo (FR-314, FR-315).
    await irParaEstudo(paginaB);

    await expect(
      tileDoEstudo(paginaB, "Sessões concluídas").locator(".estatistica__valor"),
    ).toHaveText("0");
    await expect(
      tileDoEstudo(paginaB, "Taxa de acerto").locator(".estatistica__valor"),
    ).toHaveText("—");
    await expect(
      paginaB.getByText("Você ainda não concluiu nenhuma Sessão."),
    ).toBeVisible();

    // B tenta abrir o Registro de A: recurso não encontrado (FR-179).
    //
    // A navegação é feita pelo hash, sem recarregar a página: a Credencial de
    // B vive apenas na memória da página, e um `goto` a descartaria,
    // devolvendo B à tela de Entrar em vez do Registro.
    await paginaB.evaluate((hash) => {
      window.location.hash = hash;
    }, hrefDoRegistro);

    await expect(paginaB.getByText("Sessão não encontrada.")).toBeVisible();
    await expect(paginaB.getByText("2 de 3 Cartões")).toHaveCount(0);
  } finally {
    await contextoA.close();
    await contextoB.close();
    await derrubarAmbiente(ambiente);
  }
});

// --- Cenário 5: falha ao registrar, nova tentativa e nenhuma duplicação -----

test("Falha ao registrar oferece nova tentativa e não duplica o Registro (FR-163, FR-164, SC-071)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);
    const baralho = await prepararBaralho(
      ambiente,
      credencial,
      NOME_DO_BARALHO,
      CARTOES_DO_BARALHO,
    );

    // Intercepta o primeiro POST /sessoes com indisponibilidade; as tentativas
    // seguintes passam direto para a API (FR-164).
    let jaInterceptou = false;

    await page.route("**/sessoes", async (rota) => {
      if (rota.request().method() === "POST" && !jaInterceptou) {
        jaInterceptou = true;
        await rota.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ mensagem: "Indisponível no momento." }),
        });
        return;
      }

      await rota.continue();
    });

    await iniciarSessaoPelaUi(page, ambiente, baralho.id, "pendentes", credencial);
    await responderItens(page, ["acertou", "acertou", "errou"]);

    // O Resumo continua visível e explica a falha, oferecendo nova tentativa.
    await expect(
      page.getByRole("heading", { level: 1, name: "Sessão concluída" }),
    ).toBeVisible();
    await expect(page.getByText("2 de 3 Cartões")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tentar registrar novamente" }),
    ).toBeVisible();

    // A nova tentativa reenvia o mesmo Registro e conclui (FR-163).
    await page
      .getByRole("button", { name: "Tentar registrar novamente" })
      .click();
    await expect(
      page.getByRole("status", { name: "Situação do registro da Sessão" }),
    ).toContainText(/Sessão registrada no histórico/);

    // Exatamente uma Sessão no Histórico — nada foi duplicado (SC-071).
    await irParaEstudo(page);
    await expect(
      tileDoEstudo(page, "Sessões concluídas").locator(".estatistica__valor"),
    ).toHaveText("1");
    await expect(
      secaoUltimasSessoes(page).getByRole("link", { name: NOME_DO_BARALHO }),
    ).toHaveCount(1);
  } finally {
    await derrubarAmbiente(ambiente);
  }
});
