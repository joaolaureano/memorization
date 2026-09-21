import { join } from "node:path";

import { expect, test } from "@playwright/test";

import {
  aguardarApiPronta,
  aguardarProntidao,
  criarBaralhoPelaApi,
  criarCartaoPelaApi,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  entrarSeNecessario,
  iniciarApi,
  iniciarFrontend,
  listarCartoesComBaralhosPelaApi,
  obterBaralhoPelaApi,
  portaLivre,
  removerPastaTemporaria,
  vincularCartaoPelaApi,
} from "./servidores-locais";
import type { ProcessoIniciado } from "./servidores-locais";

// T407 — edição de Cartão e Baralho em navegador e API reais
// (specs/005-editar-cartao-e-baralho/tasks.md, SC-014).
//
// Nenhuma rede é interceptada para o fluxo feliz: a API real
// (node + SQLite em arquivo) e o frontend real (Vite dev) são iniciados como
// processos filhos do próprio teste, em portas livres e com um arquivo SQLite
// temporário exclusivo. A prova cobre a persistência da edição de Cartão, a
// propagação do novo nome do Baralho para a lista de Cartões (também
// conferida na API) e a confirmação de descarte de edição suja. Apenas a
// falha de transporte usa `page.route` para abortar o PUT — sobre os
// servidores reais, sem substituir o acervo.

const CARTAO = {
  frente: "To walk",
  verso: "Caminhar",
} as const;

const NOME_ORIGINAL_DO_BARALHO = "Inglês";
const NOME_RENOMEADO_DO_BARALHO = "Idiomas";

test.setTimeout(120_000);

test("editar Cartão persiste, renomear Baralho propaga, descarte e falha preservam o conteúdo (T407)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const pasta = await criarPastaTemporaria("editar-t407-");
  const caminhoDoBanco = join(pasta, "editar.sqlite");

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

    // Depois de `008-entrar`, o acervo é por Usuário: o Usuário de prova é
    // cadastrado antes de preparar o Cartão e o Baralho, que são dele
    // (FR-090, FR-092).
    await criarUsuarioDeProva(enderecoDaApi);

    // Prepara um Cartão e um Baralho reais e os vincula pela API real; o que
    // está sob prova são as operações de edição da tela.
    const cartao = await criarCartaoPelaApi(enderecoDaApi, CARTAO);
    const baralho = await criarBaralhoPelaApi(enderecoDaApi, {
      nome: NOME_ORIGINAL_DO_BARALHO,
    });

    await vincularCartaoPelaApi(enderecoDaApi, cartao.id, baralho.id);

    // A lista de Cartões já exibe o nome original do Baralho vinculado — e é
    // alcançada depois de Entrar (FR-097).
    await page.goto(`${enderecoDoFrontend}/#/cartoes`);
    await entrarSeNecessario(page);

    await expect(
      page.getByRole("heading", { level: 1, name: "Cartões" }),
    ).toBeVisible();

    const itemDoCartao = page
      .getByRole("listitem")
      .filter({ hasText: CARTAO.frente });

    await expect(itemDoCartao).toContainText(NOME_ORIGINAL_DO_BARALHO);

    // Renomeia o Baralho pela tela real de detalhe e confere o alcance.
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralho.id}`);
    await entrarSeNecessario(page);

    await expect(
      page.getByRole("heading", { level: 1, name: NOME_ORIGINAL_DO_BARALHO }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Renomear" }).click();
    await expect(
      page.getByText("Este Baralho tem 1 Cartão vinculado."),
    ).toBeVisible();

    await page.getByLabel("Nome").fill(NOME_RENOMEADO_DO_BARALHO);
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: NOME_RENOMEADO_DO_BARALHO }),
    ).toBeVisible();

    // A renomeação chegou ao SQLite real e preservou o Vínculo.
    const baralhoRenomeado = await obterBaralhoPelaApi(
      enderecoDaApi,
      baralho.id,
    );

    expect(baralhoRenomeado.nome).toBe(NOME_RENOMEADO_DO_BARALHO);
    expect(baralhoRenomeado.elegivel).toBe(true);
    expect(baralhoRenomeado.cartoes).toHaveLength(1);
    expect(baralhoRenomeado.cartoes[0].id).toBe(cartao.id);

    // A propagação aparece na lista de Cartões: o Cartão passou a exibir o
    // novo nome do Baralho vinculado.
    await page.goto(`${enderecoDoFrontend}/#/cartoes`);
    await entrarSeNecessario(page);

    await expect(
      page.getByRole("heading", { level: 1, name: "Cartões" }),
    ).toBeVisible();

    const itemAposRenomeacao = page
      .getByRole("listitem")
      .filter({ hasText: CARTAO.frente });

    await expect(itemAposRenomeacao).toContainText(
      NOME_RENOMEADO_DO_BARALHO,
    );

    const cartoesComBaralhosRenomeados =
      await listarCartoesComBaralhosPelaApi(enderecoDaApi);

    expect(cartoesComBaralhosRenomeados).toHaveLength(1);
    expect(cartoesComBaralhosRenomeados[0].baralhos).toEqual([
      { id: baralho.id, nome: NOME_RENOMEADO_DO_BARALHO },
    ]);

    // Edita o Cartão pela tela real e confere a persistência direto na API.
    await itemAposRenomeacao.getByRole("button", { name: "Editar" }).click();
    await expect(
      page.getByText("Este Cartão está vinculado a 1 Baralho."),
    ).toBeVisible();

    await page.getByLabel("Frente do Cartão").fill("To run");
    await page.getByLabel("Verso do Cartão").fill("Correr");
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page.getByText("Cartão editado.")).toBeVisible();

    const itemEditado = page
      .getByRole("listitem")
      .filter({ hasText: "To run" });

    await expect(itemEditado).toHaveCount(1);
    await expect(itemEditado).toContainText("Correr");

    const cartoesEditados = await listarCartoesComBaralhosPelaApi(
      enderecoDaApi,
    );

    expect(cartoesEditados).toHaveLength(1);
    expect(cartoesEditados[0].frente).toBe("To run");
    expect(cartoesEditados[0].verso).toBe("Correr");

    // Descarte de edição suja: recusar mantém a edição aberta com o conteúdo
    // digitado; confirmar descarta as alterações.
    await itemEditado.getByRole("button", { name: "Editar" }).click();
    await page.getByLabel("Frente do Cartão").fill("To sprint");
    await page.getByRole("button", { name: "Cancelar" }).click();

    const dialogoDeDescarte = page.getByRole("dialog");
    await expect(dialogoDeDescarte).toBeVisible();
    await expect(dialogoDeDescarte).toContainText(
      "Você tem alterações não salvas neste Cartão.",
    );

    await page.getByRole("button", { name: "Continuar editando" }).click();
    await expect(page.getByLabel("Frente do Cartão")).toHaveValue("To sprint");

    await page.getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("button", { name: "Descartar alterações" }).click();
    await expect(page.getByLabel("Frente do Cartão")).toHaveCount(0);
    await expect(itemEditado).toContainText("To run");

    // Falha de transporte: apenas o PUT é abortado uma única vez. O conteúdo
    // digitado permanece e a nova tentativa conclui a edição contra a API real.
    await itemEditado.getByRole("button", { name: "Editar" }).click();
    await page.getByLabel("Frente do Cartão").fill("To jog");

    await page.route(
      /\/cartoes\/[^/]+$/,
      async (rota) => {
        if (rota.request().method() === "PUT") {
          await rota.abort("failed");
          return;
        }

        await rota.fallback();
      },
      { times: 1 },
    );

    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(
      page.getByText("Não foi possível acessar os Cartões. Tente novamente."),
    ).toBeVisible();
    await expect(page.getByLabel("Frente do Cartão")).toHaveValue("To jog");

    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Cartão editado.")).toBeVisible();

    const itemReeditado = page
      .getByRole("listitem")
      .filter({ hasText: "To jog" });

    await expect(itemReeditado).toHaveCount(1);

    const cartoesFinais = await listarCartoesComBaralhosPelaApi(enderecoDaApi);

    expect(cartoesFinais).toHaveLength(1);
    expect(cartoesFinais[0].frente).toBe("To jog");
  } finally {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});
