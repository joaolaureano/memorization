import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import {
  aguardarApiPronta,
  aguardarProntidao,
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
    await page.getByRole("link", { name: "Exportar" }).click();
    await expect(page.getByRole("heading", { name: "Exportar" })).toBeVisible();
    await expect(page.getByText(/1 Cartões/)).toBeVisible();

    const downloadUm = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar arquivo" }).click();
    const arquivoUm = await downloadUm;
    expect(arquivoUm.suggestedFilename()).toBe("Inglês.apkg");
    pastaDoDownload = await mkdtemp(join(tmpdir(), "exportacao-download-"));
    const temporarioUm = join(pastaDoDownload, "arquivo.apkg");
    await arquivoUm.saveAs(temporarioUm);
    expect((await readFile(temporarioUm)).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    await page.evaluate(() => { window.location.hash = "#/baralhos/exportar?todos=1"; });
    await expect(page.getByRole("checkbox", { name: "Todos os Baralhos" })).toBeChecked();
    const exportarTodos = page.getByRole("button", { name: "Exportar arquivo" });
    await exportarTodos.focus();
    const downloadTodos = page.waitForEvent("download");
    await page.keyboard.press("Enter");
    const arquivoTodos = await downloadTodos;
    expect(arquivoTodos.suggestedFilename()).toMatch(/^Exportacao-\d{4}-\d{2}-\d{2}\.apkg$/);
    await arquivoTodos.saveAs(join(pastaDoDownload, "todos.apkg"));
    expect((await readFile(join(pastaDoDownload, "todos.apkg"))).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    for (const largura of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width: largura, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => { document.documentElement.style.zoom = "200%"; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    if (frontend) await encerrarProcesso(frontend);
    if (api) await encerrarProcesso(api);
    if (pastaDoDownload) await rm(pastaDoDownload, { recursive: true, force: true });
    await rm(pasta, { recursive: true, force: true });
  }
});
