import { join } from "node:path";

import { expect, test } from "@playwright/test";

import {
  aguardarApiPronta,
  aguardarProntidao,
  criarBaralhoPelaApi,
  criarCartaoPelaApi,
  criarPastaTemporaria,
  encerrarProcesso,
  iniciarApi,
  iniciarFrontend,
  listarCartoesComBaralhosPelaApi,
  listarCartoesPelaApi,
  obterBaralhoPelaApi,
  portaLivre,
  removerPastaTemporaria,
  vincularCartaoPelaApi,
} from "./servidores-locais";
import type { ProcessoIniciado } from "./servidores-locais";

// T508 — exclusão de Cartão e Baralho em navegador e API reais
// (specs/006-excluir-cartao-e-baralho/tasks.md, SC-005, SC-006).
//
// Nenhuma rede é interceptada: a API real (node + SQLite em arquivo) e o
// frontend real (Vite dev) são iniciados como processos filhos do próprio
// teste, em portas livres e com um arquivo SQLite temporário exclusivo. A
// prova cobre o cancelamento da exclusão de Cartão, a exclusão de Baralho
// preservando Cartões (conferido na API), e a exclusão do único Cartão
// vinculado derrubando a elegibilidade do Baralho (conferida na UI e na API).

const CARTAO = {
  frente: "To walk",
  verso: "Caminhar",
} as const;

const BARALHO_A_REMOVER = "Inglês";
const BARALHO_RESTANTE = "Espanhol";

test.setTimeout(120_000);

test("cancelar exclusão de Cartão não altera o acervo, excluir Baralho preserva Cartões e excluir o único Cartão vinculado derruba a elegibilidade (T508)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const pasta = await criarPastaTemporaria("excluir-t508-");
  const caminhoDoBanco = join(pasta, "excluir.sqlite");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    const portaDaApi = await portaLivre();

    api = iniciarApi(caminhoDoBanco, portaDaApi);

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

    // Prepara um Cartão vinculado a dois Baralhos: um será excluído para
    // provar que o Cartão sobrevive; o outro permanece para provar a
    // elegibilidade derivada quando o único Cartão vinculado é excluído.
    const cartao = await criarCartaoPelaApi(enderecoDaApi, CARTAO);
    const baralhoARemover = await criarBaralhoPelaApi(enderecoDaApi, {
      nome: BARALHO_A_REMOVER,
    });
    const baralhoRestante = await criarBaralhoPelaApi(enderecoDaApi, {
      nome: BARALHO_RESTANTE,
    });

    await vincularCartaoPelaApi(
      enderecoDaApi,
      cartao.id,
      baralhoARemover.id,
    );
    await vincularCartaoPelaApi(enderecoDaApi, cartao.id, baralhoRestante.id);

    const cartoesIniciais = await listarCartoesComBaralhosPelaApi(
      enderecoDaApi,
    );

    expect(cartoesIniciais).toHaveLength(1);
    expect(cartoesIniciais[0].baralhos).toEqual(
      expect.arrayContaining([
        { id: baralhoARemover.id, nome: BARALHO_A_REMOVER },
        { id: baralhoRestante.id, nome: BARALHO_RESTANTE },
      ]),
    );

    // Cancelar a exclusão do Cartão: o diálogo declara a consequência e o
    // cancelamento mantém o Cartão no acervo, sem alterar a API.
    await page.goto(`${enderecoDoFrontend}/#/cartoes`);

    await expect(
      page.getByRole("heading", { level: 1, name: "Cartões" }),
    ).toBeVisible();

    const itemDoCartao = page
      .getByRole("listitem")
      .filter({ hasText: CARTAO.frente });

    await expect(itemDoCartao).toContainText(BARALHO_A_REMOVER);
    await expect(itemDoCartao).toContainText(BARALHO_RESTANTE);

    await itemDoCartao.getByRole("button", { name: "Excluir" }).click();

    const dialogoDeExclusaoDeCartao = page.getByRole("dialog");
    await expect(dialogoDeExclusaoDeCartao).toContainText(
      "Este Cartão está vinculado a 2 Baralhos.",
    );
    await expect(dialogoDeExclusaoDeCartao).toContainText(
      "nenhum Baralho será excluído",
    );

    await dialogoDeExclusaoDeCartao
      .getByRole("button", { name: "Cancelar" })
      .click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("listitem")).toHaveCount(1);

    const cartoesAposCancelamento = await listarCartoesComBaralhosPelaApi(
      enderecoDaApi,
    );

    expect(cartoesAposCancelamento).toHaveLength(1);
    expect(cartoesAposCancelamento[0].id).toBe(cartao.id);

    // Exclui um dos Baralhos: o Cartão continua existindo e permanece
    // vinculado apenas ao Baralho restante.
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralhoARemover.id}`);

    await expect(
      page.getByRole("heading", { level: 1, name: BARALHO_A_REMOVER }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Excluir Baralho" }).click();

    const dialogoDeExclusaoDeBaralho = page.getByRole("dialog");
    await expect(dialogoDeExclusaoDeBaralho).toContainText(
      "Este Baralho tem 1 Cartão vinculado.",
    );
    await expect(dialogoDeExclusaoDeBaralho).toContainText(
      "esse Cartão continuará existindo",
    );
    await expect(dialogoDeExclusaoDeBaralho).toContainText(
      "Nenhum Cartão será excluído.",
    );

    await dialogoDeExclusaoDeBaralho
      .getByRole("button", { name: "Excluir Baralho" })
      .click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Baralhos" }),
    ).toBeVisible();
    await expect(
      page.getByRole("listitem").filter({ hasText: BARALHO_A_REMOVER }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("listitem").filter({ hasText: BARALHO_RESTANTE }),
    ).toHaveCount(1);

    const respostaDoBaralhoRemovido = await fetch(
      `${enderecoDaApi}/baralhos/${encodeURIComponent(baralhoARemover.id)}`,
    );

    expect(respostaDoBaralhoRemovido.status).toBe(404);

    const cartoesAposExcluirBaralho =
      await listarCartoesComBaralhosPelaApi(enderecoDaApi);

    expect(cartoesAposExcluirBaralho).toHaveLength(1);
    expect(cartoesAposExcluirBaralho[0].id).toBe(cartao.id);
    expect(cartoesAposExcluirBaralho[0].baralhos).toEqual([
      { id: baralhoRestante.id, nome: BARALHO_RESTANTE },
    ]);

    const baralhoRestanteAposExcluirBaralho = await obterBaralhoPelaApi(
      enderecoDaApi,
      baralhoRestante.id,
    );

    expect(baralhoRestanteAposExcluirBaralho.elegivel).toBe(true);
    expect(baralhoRestanteAposExcluirBaralho.cartoes).toHaveLength(1);

    // Exclui o único Cartão vinculado restante: o Baralho sobrevive e deixa
    // de ser elegível, derivado da ausência de Vínculos.
    await page.goto(`${enderecoDoFrontend}/#/cartoes`);

    const itemDoCartaoRestante = page
      .getByRole("listitem")
      .filter({ hasText: CARTAO.frente });

    await expect(itemDoCartaoRestante).toContainText(BARALHO_RESTANTE);
    await expect(itemDoCartaoRestante).not.toContainText(BARALHO_A_REMOVER);

    await itemDoCartaoRestante.getByRole("button", { name: "Excluir" }).click();

    const dialogoDeExclusaoFinal = page.getByRole("dialog");
    await expect(dialogoDeExclusaoFinal).toContainText(
      "Este Cartão está vinculado a 1 Baralho.",
    );
    await expect(dialogoDeExclusaoFinal).toContainText(
      "nenhum Baralho será excluído",
    );

    await dialogoDeExclusaoFinal
      .getByRole("button", { name: "Excluir Cartão" })
      .click();

    await expect(
      page.getByText("Cartão excluído. Nenhum Baralho foi excluído."),
    ).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(0);

    const cartoesAposExcluirCartao = await listarCartoesPelaApi(enderecoDaApi);

    expect(cartoesAposExcluirCartao).toHaveLength(0);

    const baralhoRestanteAposExcluirCartao = await obterBaralhoPelaApi(
      enderecoDaApi,
      baralhoRestante.id,
    );

    expect(baralhoRestanteAposExcluirCartao.elegivel).toBe(false);
    expect(baralhoRestanteAposExcluirCartao.cartoes).toHaveLength(0);

    // A lista de Baralhos continua exibindo o Baralho, agora não elegível.
    await page.goto(`${enderecoDoFrontend}/#/baralhos`);

    const itemDoBaralhoRestante = page
      .getByRole("listitem")
      .filter({ hasText: BARALHO_RESTANTE });

    await expect(itemDoBaralhoRestante).toHaveCount(1);
    await expect(itemDoBaralhoRestante).toContainText(
      "Não elegível para estudo: nenhum Cartão vinculado.",
    );
  } finally {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});
