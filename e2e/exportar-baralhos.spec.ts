import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import {
  aguardarApiPronta,
  aguardarProntidao,
  aplicarZoomDeProva,
  criarBaralhoPelaApi,
  criarCartaoNoBaralhoPelaApi,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  entrarSeNecessario,
  iniciarApi,
  iniciarFrontend,
  portaLivre,
} from "./servidores-locais";
import type { ProcessoIniciado } from "./servidores-locais";

test.setTimeout(180_000);

/**
 * Pressiona Tab até o foco chegar ao elemento pedido. Tab é navegação, não
 * interação (SC-183), por isso não entra na contagem de interações.
 */
async function tabAte(page: Page, papel: "link" | "button", nome: string): Promise<void> {
  const alvo = page.getByRole(papel, { name: nome, exact: true });
  for (let tabs = 0; tabs < 80; tabs++) {
    if ((await alvo.count()) === 1 && (await alvo.evaluate((el) => el === document.activeElement))) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`o foco não chegou a ${papel} "${nome}" com Tab`);
}

test("exporta um Baralho e o acervo, com download Anki e layout responsivo", async ({ page }) => {
  const pasta = await criarPastaTemporaria("exportar-baralhos-");
  const caminhoDoBanco = join(pasta, "acervo.sqlite");
  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;
  let pastaDoDownload: string | null = null;

  try {
    const portaDaApi = await portaLivre();
    api = iniciarApi(caminhoDoBanco, portaDaApi);
    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;
    await aguardarApiPronta(api, enderecoDaApi);

    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;
    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);
    await aguardarProntidao(frontend, enderecoDoFrontend, (resposta) => resposta.ok);

    const credencial = await criarUsuarioDeProva(enderecoDaApi, "exportacao.e2e");
    const baralho = await criarBaralhoPelaApi(enderecoDaApi, { nome: "Inglês" }, credencial);
    await criarCartaoNoBaralhoPelaApi(enderecoDaApi, baralho.id, { frente: "hello", verso: "olá" }, credencial);
    const outroBaralho = await criarBaralhoPelaApi(enderecoDaApi, { nome: "Espanhol" }, credencial);
    await criarCartaoNoBaralhoPelaApi(enderecoDaApi, outroBaralho.id, { frente: "hola", verso: "oi" }, credencial);

    await page.goto(enderecoDoFrontend);
    await entrarSeNecessario(page, credencial);
    await page.evaluate((id) => { window.location.hash = `#/baralhos/${id}`; }, baralho.id);
    await expect(page.getByRole("heading", { name: "Inglês" })).toBeVisible();
    // Só teclado: Tab até "Exportar" (link), Enter; Tab até "Exportar arquivo", Enter.
    let interacoes = 0;
    await tabAte(page, "link", "Exportar");
    await page.keyboard.press("Enter");
    interacoes++;
    await expect(page.getByRole("heading", { name: "Exportar" })).toBeVisible();
    await expect(page.getByText(/1 Baralho · 1 Cartão/)).toBeVisible();

    await tabAte(page, "button", "Exportar arquivo");
    const downloadUm = page.waitForEvent("download");
    await page.keyboard.press("Enter");
    interacoes++;
    // SC-183: Exportar → Exportar arquivo, no máximo 3 interações.
    expect(interacoes).toBeLessThanOrEqual(3);
    const arquivoUm = await downloadUm;
    expect(arquivoUm.suggestedFilename()).toBe("Inglês.apkg");
    pastaDoDownload = await mkdtemp(join(tmpdir(), "exportacao-download-"));
    const temporarioUm = join(pastaDoDownload, "arquivo.apkg");
    await arquivoUm.saveAs(temporarioUm);
    expect((await readFile(temporarioUm)).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    // Exportar todos pela lista de Baralhos, com o botão da lista e a caixa "Todos os Baralhos".
    await page.evaluate(() => { window.location.hash = "#/baralhos"; });
    await page.getByRole("link", { name: "Exportar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Exportar" })).toBeVisible();
    await page.getByRole("checkbox", { name: "Todos os Baralhos", exact: true }).check();
    await expect(page.getByRole("checkbox", { name: "Todos os Baralhos" })).toBeChecked();
    const downloadTodos = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar arquivo", exact: true }).click();
    const arquivoTodos = await downloadTodos;
    expect(arquivoTodos.suggestedFilename()).toMatch(/^memorization-\d{4}-\d{2}-\d{2}\.apkg$/);
    await arquivoTodos.saveAs(join(pastaDoDownload, "todos.apkg"));
    expect((await readFile(join(pastaDoDownload, "todos.apkg"))).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    // Layout da tela de exportação: o zoom é aplicado antes de renderizar a página medida.
    for (const [largura, zoom] of [[360, 1], [390, 1], [768, 1], [1440, 1], [1280, 2]] as const) {
      const rotulo = `${largura}px zoom ${zoom}`;
      await page.setViewportSize({ width: largura, height: 844 });
      await page.goto(`${enderecoDoFrontend}/#/baralhos/exportar`);
      await aplicarZoomDeProva(page, zoom);
      await expect(page.getByRole("button", { name: "Exportar arquivo", exact: true }), rotulo).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        rotulo,
      ).toBe(true);
    }
    await aplicarZoomDeProva(page, 1);
  } finally {
    if (frontend) await encerrarProcesso(frontend);
    if (api) await encerrarProcesso(api);
    if (pastaDoDownload) await rm(pastaDoDownload, { recursive: true, force: true });
    await rm(pasta, { recursive: true, force: true });
  }
});
