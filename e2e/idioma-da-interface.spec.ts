import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  aguardarApiPronta,
  aguardarProntidao,
  criarBaralhoPelaApi,
  criarCartaoNoBaralhoPelaApi,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  entrarPelaUi,
  iniciarApi,
  iniciarFrontend,
  portaLivre,
  removerPastaTemporaria,
} from "./servidores-locais";
import type { CredencialDeProva, ProcessoIniciado } from "./servidores-locais";

// 027 — Idioma da interface (T012, T035, T048; FR-002, FR-004, FR-006,
// FR-008, FR-009, FR-010, FR-011, FR-012, FR-017, FR-018, FR-019; SC-004,
// SC-005, SC-006, SC-007). API e frontend reais, sem rede interceptada.

test.setTimeout(240_000);

interface Ambiente {
  enderecoDaApi: string;
  enderecoDoFrontend: string;
  encerrar: () => Promise<void>;
}

async function subirAmbiente(prefixo: string): Promise<Ambiente> {
  const pasta = await criarPastaTemporaria(prefixo);
  const portaDaApi = await portaLivre();
  const api: ProcessoIniciado = iniciarApi(join(pasta, "idioma.sqlite"), portaDaApi);
  let frontend: ProcessoIniciado | null = null;

  try {
    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;

    await aguardarApiPronta(api, enderecoDaApi);

    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;

    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);
    await aguardarProntidao(frontend, enderecoDoFrontend, (resposta) => resposta.ok);

    const frontendIniciado = frontend;

    return {
      enderecoDaApi,
      enderecoDoFrontend,
      encerrar: async () => {
        await encerrarProcesso(frontendIniciado);
        await encerrarProcesso(api);
        await removerPastaTemporaria(pasta);
      },
    };
  } catch (erro) {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
    throw erro;
  }
}

async function escolherIdioma(page: Page, atual: string, opcao: string): Promise<void> {
  await page.getByRole("button", { name: atual }).click();
  await page.getByRole("menuitemradio", { name: opcao }).click();
}

/** Nenhuma rolagem horizontal no documento nem no cabeçalho (FR-017, SC-007). */
async function semRolagemHorizontal(page: Page, rotulo: string): Promise<void> {
  const medidas = await page.evaluate(() => {
    const documento = document.documentElement;
    const moldura = document.querySelector<HTMLElement>(".moldura");

    return {
      documento: documento.scrollWidth - documento.clientWidth,
      moldura: moldura === null ? 0 : moldura.scrollWidth - moldura.clientWidth,
    };
  });

  expect(medidas, rotulo).toEqual({ documento: 0, moldura: 0 });
}

test.describe("troca de idioma", () => {
  test("troca só por teclado na tela Entrar e devolve o foco ao seletor (FR-002, FR-009, FR-010)", async ({ page }) => {
    const ambiente = await subirAmbiente("idioma-teclado");

    try {
      await page.goto(`${ambiente.enderecoDoFrontend}/#/entrar`);
      await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();

      const seletor = page.getByRole("button", { name: "Idioma: Português" });

      await seletor.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("menuitemradio", { name: "PT Português" })).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");

      await expect(page.locator("html")).toHaveAttribute("lang", "es-419");
      await expect(page.getByRole("heading", { level: 1, name: "Iniciar sesión" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Idioma: Español" })).toBeFocused();
    } finally {
      await ambiente.encerrar();
    }
  });

  test("traduz a navegação e preserva o conteúdo, em menos de 1 s (FR-004, FR-006, SC-003, SC-004)", async ({ page }) => {
    const ambiente = await subirAmbiente("idioma-conteudo");

    try {
      const credencial: CredencialDeProva = await criarUsuarioDeProva(ambiente.enderecoDaApi);
      const baralho = await criarBaralhoPelaApi(ambiente.enderecoDaApi, { nome: "Verbos irregulares" }, credencial);

      await criarCartaoNoBaralhoPelaApi(ambiente.enderecoDaApi, baralho.id, { frente: "Novo", verso: "Sair" }, credencial);
      await page.goto(`${ambiente.enderecoDoFrontend}/#/entrar`);
      await entrarPelaUi(page, credencial);
      await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/${baralho.id}`);
      await expect(page.getByRole("heading", { level: 1, name: "Verbos irregulares" })).toBeVisible();

      await page.getByRole("button", { name: "Idioma: Português" }).click();
      const duracao = await page.evaluate(
        () =>
          new Promise<number>((resolver) => {
            const inicio = performance.now();
            const observador = new MutationObserver(() => {
              if (document.documentElement.lang === "en-US" && document.body.textContent?.includes("Decks")) {
                observador.disconnect();
                resolver(performance.now() - inicio);
              }
            });

            observador.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
            document.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="false"]')?.click();
          }),
      );

      expect(duracao).toBeLessThan(1000);
      await expect(page.getByRole("link", { name: "Decks" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: "Verbos irregulares" })).toBeVisible();
      await expect(page.getByText("Novo", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Sair", { exact: true }).first()).toBeVisible();
    } finally {
      await ambiente.encerrar();
    }
  });

  test("nenhuma tela rola na horizontal em EN e ES, a 360 e 1280 px (FR-017, SC-007)", async ({ page }) => {
    const ambiente = await subirAmbiente("idioma-layout");

    try {
      const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);
      const baralho = await criarBaralhoPelaApi(ambiente.enderecoDaApi, { nome: "Inglês" }, credencial);

      await criarCartaoNoBaralhoPelaApi(ambiente.enderecoDaApi, baralho.id, { frente: "To walk", verso: "Caminhar" }, credencial);

      for (const [idioma, opcao, atual] of [
        ["en", "EN English", "Idioma: Português"],
        ["es", "ES Español", "Language: English"],
      ] as const) {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(`${ambiente.enderecoDoFrontend}/#/entrar`);

        if (idioma === "en") {
          await escolherIdioma(page, atual, opcao);
          await semRolagemHorizontal(page, `${idioma} entrar`);
          await page.goto(`${ambiente.enderecoDoFrontend}/#/criar-conta`);
          await semRolagemHorizontal(page, `${idioma} criar conta`);
          await page.goto(`${ambiente.enderecoDoFrontend}/#/entrar`);
          await page.getByLabel("Username", { exact: true }).fill(credencial.nomeDeUsuario);
          await page.getByLabel("Password", { exact: true }).fill(credencial.senha);
          await page.getByRole("button", { name: "Sign in" }).click();
          await page.getByRole("navigation", { name: "Main" }).waitFor();
        } else {
          await escolherIdioma(page, atual, opcao);
        }

        for (const largura of [360, 1280]) {
          await page.setViewportSize({ width: largura, height: 800 });

          for (const rota of [
            "#/inicio",
            "#/estudo",
            "#/baralhos",
            "#/baralhos/novo",
            `#/baralhos/${baralho.id}`,
            `#/baralhos/${baralho.id}/cartoes/novo`,
            `#/baralhos/${baralho.id}/estudo`,
            "#/baralhos/temporario",
            "#/baralhos/importar",
            "#/agenda",
            "#/agenda/nova",
            "#/preferencias",
          ]) {
            await page.goto(`${ambiente.enderecoDoFrontend}/${rota}`);
            await page.getByRole("heading", { level: 1 }).first().waitFor();
            await semRolagemHorizontal(page, `${idioma} ${largura}px ${rota}`);
          }
        }
      }
    } finally {
      await ambiente.encerrar();
    }
  });
});

test.describe("idioma inicial e persistência (navegador em inglês)", () => {
  test.use({ locale: "en-US" });

  test("abre em inglês e lembra a escolha ao recarregar (FR-011, FR-012, SC-006)", async ({ page }) => {
    const ambiente = await subirAmbiente("idioma-inicial-en");

    try {
      await page.goto(`${ambiente.enderecoDoFrontend}/#/entrar`);
      await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
      await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();

      await escolherIdioma(page, "Language: English", "ES Español");
      await page.reload();

      await expect(page.locator("html")).toHaveAttribute("lang", "es-419");
      await expect(page.getByRole("heading", { level: 1, name: "Iniciar sesión" })).toBeVisible();
    } finally {
      await ambiente.encerrar();
    }
  });
});

test.describe("idioma inicial (navegador em francês)", () => {
  test.use({ locale: "fr-FR" });

  test("abre em Português quando o idioma do navegador não é suportado (FR-012)", async ({ page }) => {
    const ambiente = await subirAmbiente("idioma-inicial-fr");

    try {
      await page.goto(`${ambiente.enderecoDoFrontend}/#/entrar`);
      await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
      await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();
    } finally {
      await ambiente.encerrar();
    }
  });
});

test.describe("recusas no idioma da interface", () => {
  test.use({ locale: "en-US" });

  test("a recusa aparece em inglês e a mensagem técnica do servidor é ASCII (FR-018, FR-019)", async ({ page }) => {
    const ambiente = await subirAmbiente("idioma-recusas");

    try {
      const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);

      await page.goto(`${ambiente.enderecoDoFrontend}/#/entrar`);
      await page.getByLabel("Username", { exact: true }).fill(credencial.nomeDeUsuario);
      await page.getByLabel("Password", { exact: true }).fill("senha-errada-123");

      const [resposta] = await Promise.all([
        page.waitForResponse((candidata) => candidata.url().endsWith("/entrar")),
        page.getByRole("button", { name: "Sign in" }).click(),
      ]);
      const corpo = (await resposta.json()) as { mensagem?: string };

      expect(corpo.mensagem ?? "").toMatch(/^[\x20-\x7E]+$/);
      await expect(page.getByText("Incorrect username or password.")).toBeVisible();

      await escolherIdioma(page, "Language: English", "ES Español");
      await expect(page.getByText("Nombre de usuario o contraseña incorrectos.")).toBeVisible();
    } finally {
      await ambiente.encerrar();
    }
  });
});
