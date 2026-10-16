import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";
import { aguardarApiPronta, aguardarProntidao, aplicarZoomDeProva, criarPastaTemporaria, encerrarProcesso, iniciarApi, iniciarFrontend, portaLivre, removerPastaTemporaria } from "./servidores-locais";
import type { ProcessoIniciado } from "./servidores-locais";

// T040 (030): percurso do browser real para Entrar como Teste, isolamento
// descartável e layouts estreitos/ampliados. API e Vite são processos locais.
test.setTimeout(90_000);

test("Conta de teste: isolamento, mídias, sair apagando e começar de novo", async ({ page, browser, browserName }) => {
  expect(browserName).toBe("chromium");
  const pasta = await criarPastaTemporaria("conta-de-teste-030-");
  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;
  let segundaContexto: BrowserContext | null = null;

  try {
    const portaDaApi = await portaLivre();
    api = iniciarApi(join(pasta, "conta.sqlite"), portaDaApi);
    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;
    await aguardarApiPronta(api, enderecoDaApi);
    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;
    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);
    await aguardarProntidao(frontend, enderecoDoFrontend, (resposta) => resposta.ok);

    for (const largura of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto(`${enderecoDoFrontend}/#/entrar`);
      await aplicarZoomDeProva(page, 1);
      await expect(page.getByRole("heading", { name: "Entrar", level: 1 })).toBeVisible();
      const semRolagem = await page.evaluate(() =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= document.documentElement.clientWidth,
      );
      expect(semRolagem).toBe(true);
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toBeVisible();
    }

    await aplicarZoomDeProva(page, 2);
    await page.getByRole("button", { name: "Entrar como Teste" }).click();
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();
    await expect(page.getByText("Conta de teste", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Baralhos" }).click();
    for (const nome of ["Inglês", "Bandeiras", "Cantos de pássaros"]) {
      await expect(page.getByText(nome, { exact: true })).toBeVisible();
    }

    segundaContexto = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
    const segundaPagina = await segundaContexto.newPage();
    await segundaPagina.goto(`${enderecoDoFrontend}/#/entrar`);
    await segundaPagina.getByRole("button", { name: "Entrar como Teste" }).click();
    await expect(segundaPagina.getByRole("navigation", { name: "Principal" })).toBeVisible();
    await segundaPagina.getByRole("link", { name: "Baralhos" }).click();
    await expect(segundaPagina.getByText("3 resultados", { exact: true })).toBeVisible();

    const criacaoIsolada = await page.evaluate(async (api) => {
      const resposta = await fetch(`${api}/baralhos`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome: "Meu baralho descartável" }),
      });
      return resposta.status;
    }, enderecoDaApi);
    expect(criacaoIsolada).toBe(201);
    await page.reload();
    await expect(page.getByText("4 resultados", { exact: true })).toBeVisible();
    await segundaPagina.reload();
    await expect(segundaPagina.getByText("3 resultados", { exact: true })).toBeVisible();

    const urlDeBandeiras = await page.getByRole("link", { name: "Revisar Bandeiras", exact: true }).getAttribute("href");
    expect(urlDeBandeiras).not.toBeNull();
    const urlDePassaros = await page.getByRole("link", { name: "Revisar Cantos de pássaros", exact: true }).getAttribute("href");
    expect(urlDePassaros).not.toBeNull();
    await page.goto(`${enderecoDoFrontend}/${urlDeBandeiras!.replace(/^\//, "")}`);
    await page.getByRole("button", { name: "Todos os cartões", exact: true }).click();
    await expect(page.locator("article img").first()).toBeVisible();

    await page.getByRole("button", { name: "Interromper" }).first().click();
    let dialogoDeInterrupcao = page.getByRole("dialog").filter({ hasText: "Interromper a Sessão?" });
    await dialogoDeInterrupcao.getByRole("button", { name: "Interromper", exact: true }).click();
    await page.goto(`${enderecoDoFrontend}/#/baralhos`);

    await page.goto(`${enderecoDoFrontend}/${urlDePassaros!.replace(/^\//, "")}`);
    await page.getByRole("button", { name: "Todos os cartões", exact: true }).click();
    const tocarAudio = page.getByRole("button", { name: "Tocar áudio", exact: true });
    await expect(tocarAudio).toBeVisible();
    await tocarAudio.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Pausar áudio", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Interromper" }).first().click();
    dialogoDeInterrupcao = page.getByRole("dialog").filter({ hasText: "Interromper a Sessão?" });
    await dialogoDeInterrupcao.getByRole("button", { name: "Interromper", exact: true }).click();
    await page.goto(`${enderecoDoFrontend}/#/baralhos`);
    await page.getByRole("button", { name: "Sair" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toContainText("Sair apaga a Conta de teste");
    await dialogo.getByRole("button", { name: "Sair e apagar" }).click();
    await expect(page.getByRole("heading", { name: "Entrar", level: 1 })).toBeVisible();
    await expect(page.getByText(/Sua Conta de teste terminou/)).toBeVisible();

    await page.getByRole("button", { name: "Entrar como Teste" }).click();
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();
    await page.getByRole("link", { name: "Baralhos" }).click();
    await expect(page.getByText("Inglês", { exact: true })).toBeVisible();
    await expect(page.getByText("Cantos de pássaros", { exact: true })).toBeVisible();
  } finally {
    await segundaContexto?.close();
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});

// 030 (FR-494): o diálogo de créditos lê-se sem quebra de palavra, cabe na
// janela, tem Fechar visível e não cria rolagem horizontal, em telas estreitas,
// amplas e a 200% de zoom.
test("Créditos do acervo de demonstração: layout, Fechar e sem rolagem horizontal", async ({ browser }) => {
  const pasta = await criarPastaTemporaria("creditos-030-");
  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;
  const contextos: BrowserContext[] = [];

  try {
    const portaDaApi = await portaLivre();
    api = iniciarApi(join(pasta, "creditos.sqlite"), portaDaApi);
    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;
    await aguardarApiPronta(api, enderecoDaApi);
    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;
    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);
    await aguardarProntidao(frontend, enderecoDoFrontend, (resposta) => resposta.ok);

    for (const [largura, zoom] of [[360, 1], [390, 1], [768, 1], [1280, 1], [1280, 2]] as const) {
      const rotulo = `${largura}px zoom ${zoom}`;
      const contexto = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo", viewport: { width: largura, height: 844 } });
      contextos.push(contexto);
      const page = await contexto.newPage();

      await page.goto(`${enderecoDoFrontend}/#/entrar`);
      await aplicarZoomDeProva(page, zoom);
      await page.getByRole("button", { name: "Entrar como Teste" }).click();
      await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();

      const link = page.getByRole("link", { name: "Créditos do acervo de demonstração" });
      await link.click();
      const dialogo = page.getByRole("dialog", { name: "Créditos do acervo de demonstração" });
      await expect(dialogo.getByRole("heading", { level: 3, name: "Bandeiras" })).toBeVisible();
      await expect(dialogo.getByRole("heading", { level: 3, name: "Cantos de pássaros" })).toBeVisible();

      const palavrasQuebradas = await dialogo.evaluate((raiz) => {
        const quebradas: string[] = [];
        const caminhante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
        for (let no = caminhante.nextNode(); no !== null; no = caminhante.nextNode()) {
          for (const casamento of (no.textContent ?? "").matchAll(/\S+/g)) {
            const inicio = casamento.index ?? 0;
            const intervalo = document.createRange();
            intervalo.setStart(no, inicio);
            intervalo.setEnd(no, inicio + casamento[0].length);
            if (intervalo.getClientRects().length !== 1) {
              quebradas.push(casamento[0]);
            }
          }
        }
        return quebradas;
      });
      expect(palavrasQuebradas, rotulo).toEqual([]);

      const medidas = await dialogo.evaluate((raiz) => {
        const caixa = raiz.getBoundingClientRect();
        const lista = raiz.querySelector<HTMLElement>(".ca-creditos-lista");
        return {
          larguraDoDialogo: caixa.width,
          alturaDoDialogo: caixa.height,
          larguraDaJanela: window.innerWidth,
          alturaDaJanela: window.innerHeight,
          rolagemHorizontalDaPagina: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > document.documentElement.clientWidth,
          rolagemHorizontalDaLista: lista !== null && lista.scrollWidth > lista.clientWidth,
        };
      });
      expect(medidas.larguraDoDialogo, rotulo).toBeLessThanOrEqual(medidas.larguraDaJanela);
      expect(medidas.alturaDoDialogo, rotulo).toBeLessThanOrEqual(medidas.alturaDaJanela);
      expect(medidas.rolagemHorizontalDaPagina, rotulo).toBe(false);
      expect(medidas.rolagemHorizontalDaLista, rotulo).toBe(false);

      const fechar = dialogo.getByRole("button", { name: "Fechar", exact: true });
      await expect(fechar).toBeInViewport();
      await fechar.click();
      await expect(dialogo).not.toBeVisible();
      await expect(link).toBeFocused();
    }
  } finally {
    for (const contexto of contextos) {
      await contexto.close();
    }
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});
