import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { MIGRACOES } from "../backend/src/acervo/migracoes";

import {
  aguardarProntidao,
  criarPastaTemporaria,
  encerrarProcesso,
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

test("Vínculos criados pela UI persistem após reiniciar API e frontend, e a migração não reaplica (FR-040, SC-003)", async ({ page, browserName }) => {
  // Navegador real: Chromium, sem DOM simulado.
  expect(browserName).toBe("chromium");

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

    // Prepara um Cartão e um Baralho reais, pelas telas das features 001 e
    // 002 — o Vínculo será um ato distinto, na tela desta feature.
    await page.goto(`${enderecoDoFrontend}/#/cartoes`);
    await criarCartaoPelaUi(page, CARTAO);
    await expect(page.getByRole("listitem")).toHaveCount(1);

    await page.goto(`${enderecoDoFrontend}/#/baralhos`);
    await criarBaralhoPelaUi(page, NOME_DO_BARALHO);
    await expect(page.getByRole("listitem")).toHaveCount(1);

    const baralhosCriados = await listarBaralhosPelaApi(enderecoDaApi);
    expect(baralhosCriados).toHaveLength(1);
    const idDoBaralho = baralhosCriados[0].id;

    // A tela de Vínculos é a página de detalhe do Baralho.
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${idDoBaralho}`);

    await expect(
      page.getByRole("heading", { level: 1, name: NOME_DO_BARALHO }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Não elegível para estudo: nenhum Cartão vinculado.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Este Baralho ainda não tem Cartões vinculados."),
    ).toBeVisible();

    await page
      .getByRole("button", { name: `Vincular ${CARTAO.frente}` })
      .click();

    await expect(page.getByText(/Cartão vinculado ao Baralho\./)).toBeVisible();
    await expect(
      page.getByText(/O Baralho tornou-se elegível para estudo\./),
    ).toBeVisible();
    await expect(
      page.getByText("Elegível para estudo.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Todos os Cartões já estão vinculados a este Baralho."),
    ).toBeVisible();

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

    // Reabrir a tela de Vínculos: o Vínculo persiste, o Baralho continua
    // elegível e o Cartão segue na lista de vinculados.
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${idDoBaralho}`);

    await expect(
      page.getByRole("heading", { level: 1, name: NOME_DO_BARALHO }),
    ).toBeVisible();
    await expect(
      page.getByText("Elegível para estudo.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Todos os Cartões já estão vinculados a este Baralho."),
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
 * Cria um Cartão pela tela real: preenche Frente e Verso nos campos do
 * formulário e submete com o botão.
 */
async function criarCartaoPelaUi(
  page: Page,
  cartao: { frente: string; verso: string },
): Promise<void> {
  await page.getByLabel("Frente").fill(cartao.frente);
  await page.getByLabel("Verso").fill(cartao.verso);
  await page.getByRole("button", { name: "Criar Cartão" }).click();
}

/**
 * Cria um Baralho pela tela real: preenche o nome no campo do formulário e
 * submete com o botão.
 */
async function criarBaralhoPelaUi(page: Page, nome: string): Promise<void> {
  await page.getByLabel("Nome").fill(nome);
  await page.getByRole("button", { name: "Criar Baralho" }).click();
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
