import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  aguardarProntidao,
  criarPastaTemporaria,
  encerrarProcesso,
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

test("Cartões criados pela UI persistem após reiniciar API e frontend (FR-040, SC-003)", async ({ page, browserName }) => {
  // Navegador real: Chromium, sem DOM simulado.
  expect(browserName).toBe("chromium");

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

    // A UI real abre sobre um acervo vazio — o arquivo é novo, sem Cartões.
    await page.goto(enderecoDoFrontend);

    await expect(
      page.getByRole("heading", { level: 1, name: "Cartões" }),
    ).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(0);
    await expect(
      page.getByText(
        "Ainda não há Cartões. Crie o primeiro Cartão para começar a memorizar.",
      ),
    ).toBeVisible();

    // Exatamente dois Cartões criados pela UI, sem nenhuma interceptação de
    // rede: cada POST chega ao banco SQLite em arquivo.
    await criarCartaoPelaUi(page, PRIMEIRO_CARTAO);
    await expect(page.getByRole("listitem")).toHaveCount(1);

    await criarCartaoPelaUi(page, SEGUNDO_CARTAO);
    await expect(page.getByRole("listitem")).toHaveCount(2);

    const criados = await listarCartoesPelaApi(enderecoDaApi);

    expect(criados).toHaveLength(2);

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

    // Reabrir a UI: os dois Cartões persistem, cada um com a sua Frente e o
    // seu Verso, e nada além deles.
    await page.goto(enderecoDoFrontend);

    await expect(
      page.getByRole("heading", { level: 1, name: "Cartões" }),
    ).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(2);

    await conferirCartaoNaLista(page, PRIMEIRO_CARTAO);
    await conferirCartaoNaLista(page, SEGUNDO_CARTAO);

    // Persistência exata conferida também direto na API: os mesmos ids, as
    // mesmas Frentes e os mesmos Versos — os Cartões foram relidos do
    // arquivo, não recriados.
    const persistidos = await listarCartoesPelaApi(enderecoDaApi);

    expect(persistidos).toHaveLength(2);
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
 * Confere que o Cartão está na lista com exatamente a sua Frente e o seu
 * Verso, e aparece uma única vez.
 */
async function conferirCartaoNaLista(
  page: Page,
  cartao: { frente: string; verso: string },
): Promise<void> {
  const item = page
    .getByRole("listitem")
    .filter({ hasText: cartao.frente });

  await expect(item).toHaveCount(1);
  await expect(item).toContainText(cartao.verso);
}
