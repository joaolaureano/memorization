import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

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
  portaLivre,
  removerPastaTemporaria,
  vincularCartaoPelaApi,
} from "./servidores-locais";
import type { ProcessoIniciado } from "./servidores-locais";

// T406 e T507 — edição e exclusão utilizáveis em largura de telefone
// (specs/005-editar-cartao-e-baralho/tasks.md e
// specs/006-excluir-cartao-e-baralho/tasks.md, FR-042, FR-046).
//
// Exercita o frontend React real sobre a API real, em viewport de telefone. A
// prova mede a ausência de rolagem horizontal com o formulário inline de
// edição aberto e com o diálogo de confirmação de exclusão aberto.

const CARTAO = {
  frente: "To walk",
  verso: "Caminhar",
} as const;

const NOME_DO_BARALHO = "Inglês";

test.use({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
});

test.setTimeout(120_000);

async function medirExcessoDeLargura(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raiz = document.documentElement;

    return Math.max(raiz.scrollWidth, document.body.scrollWidth) -
      raiz.clientWidth;
  });
}

test("edição e exclusão de Cartão permanecem utilizáveis e sem rolagem horizontal em telefone (T406)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const pasta = await criarPastaTemporaria("edicao-cartao-t406-");
  const caminhoDoBanco = join(pasta, "edicao-cartao.sqlite");

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

    // Depois de `008-entrar`, o acervo é por Usuário: a prova cadastra o
    // Usuário de prova e entra antes de operar (FR-090, FR-097).
    await criarUsuarioDeProva(enderecoDaApi);
    await criarCartaoPelaApi(enderecoDaApi, CARTAO);

    await page.goto(`${enderecoDoFrontend}/#/cartoes`);
    await entrarSeNecessario(page);
    await expect(page.getByRole("listitem")).toHaveCount(1);

    await page.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByLabel("Frente do Cartão")).toBeVisible();
    expect(await medirExcessoDeLargura(page)).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("button", { name: "Excluir" }).click();

    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText("Excluir Cartão");
    expect(await medirExcessoDeLargura(page)).toBeLessThanOrEqual(0);
  } finally {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});

test("renomeação e exclusão de Baralho permanecem utilizáveis e sem rolagem horizontal em telefone (T507)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const pasta = await criarPastaTemporaria("edicao-baralho-t507-");
  const caminhoDoBanco = join(pasta, "edicao-baralho.sqlite");

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

    await criarUsuarioDeProva(enderecoDaApi);

    const cartao = await criarCartaoPelaApi(enderecoDaApi, CARTAO);
    const baralho = await criarBaralhoPelaApi(enderecoDaApi, {
      nome: NOME_DO_BARALHO,
    });

    await vincularCartaoPelaApi(enderecoDaApi, cartao.id, baralho.id);

    await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralho.id}`);
    await entrarSeNecessario(page);

    await expect(
      page.getByRole("heading", { level: 1, name: NOME_DO_BARALHO }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Renomear" }).click();
    await expect(page.getByLabel("Nome")).toBeVisible();
    expect(await medirExcessoDeLargura(page)).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("button", { name: "Excluir Baralho" }).click();

    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText("Excluir Baralho");
    expect(await medirExcessoDeLargura(page)).toBeLessThanOrEqual(0);
  } finally {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});
