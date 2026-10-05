import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Browser, Locator, Page } from "@playwright/test";

import {
  aguardarApiPronta,
  aguardarProntidao,
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

// T2010 — spec 020: matriz visual e de teclado do refinamento da UI
// (FR-327..FR-338, SC-131..SC-133).
//
// Nenhuma rede é interceptada: a API real (node + SQLite em arquivo) e o
// frontend real (Vite dev) sobem como processos filhos, em portas livres. Cada
// caso da matriz — 360, 390, 768 e 1440 px e o zoom de 200% (720 px a 2x) —
// abre o próprio contexto do navegador e percorre Entrar, Sair, Perfil, Início
// e Estudo, medindo o layout real e chegando aos controles por Tab, para que o
// navegador aplique o `:focus-visible` como numa travessia real (FR-338).

test.setTimeout(240_000);

/** FR-329: Mostrar/Ocultar tem 7 rem, a 16 px de raiz. */
const LARGURA_DO_MOSTRAR = 112;

/** FR-328: a caixa de marcar grande de Entrar mede 37 px. */
const LADO_DA_CAIXA_GRANDE = 37;

/** FR-328: o rótulo clicável preserva o alvo mínimo de 44 x 44 px. */
const ALVO_MINIMO = 44;

/** FR-335: 32 px entre Configuração e Minha conta. */
const SEPARACAO_DO_PERFIL = 32;

/** Arredondamento das medidas de layout. */
const TOLERANCIA = 1;

const CASOS = [
  { nome: "360 px", viewport: { width: 360, height: 900 }, escala: 1 },
  { nome: "390 px", viewport: { width: 390, height: 900 }, escala: 1 },
  { nome: "768 px", viewport: { width: 768, height: 900 }, escala: 1 },
  { nome: "1440 px", viewport: { width: 1440, height: 900 }, escala: 1 },
  { nome: "zoom 200%", viewport: { width: 720, height: 900 }, escala: 2 },
] as const;

type Caso = (typeof CASOS)[number];

interface Ambiente {
  enderecoDaApi: string;
  enderecoDoFrontend: string;
  encerrar: () => Promise<void>;
}

async function subirAmbiente(prefixo: string): Promise<Ambiente> {
  const pasta = await criarPastaTemporaria(prefixo);
  const portaDaApi = await portaLivre();
  const api: ProcessoIniciado = iniciarApi(
    join(pasta, "refinamento.sqlite"),
    portaDaApi,
  );
  let frontend: ProcessoIniciado | null = null;

  try {
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

/** Largura e altura da caixa visível; falha se não houver caixa. */
async function medir(
  elemento: Locator,
): Promise<{ largura: number; altura: number }> {
  const caixa = await elemento.boundingBox();

  if (caixa === null) {
    throw new Error("o elemento não tem caixa visível para medir");
  }

  return { largura: caixa.width, altura: caixa.height };
}

/** Aperta Tab até o alvo receber o foco, como numa travessia real. */
async function tabularAte(
  pagina: Page,
  alvo: Locator,
  limite = 25,
): Promise<void> {
  for (let passo = 0; passo < limite; passo += 1) {
    await pagina.keyboard.press("Tab");

    if (await alvo.evaluate((elemento) => elemento === document.activeElement)) {
      return;
    }
  }

  throw new Error("o alvo não foi alcançado pela travessia de Tab");
}

/** FR-338: o elemento focado mostra contorno, e não só cor. */
async function conferirContornoDoFoco(pagina: Page): Promise<void> {
  const estilo = await pagina.evaluate(() => {
    const emFoco = document.activeElement;

    return emFoco === null ? "none" : getComputedStyle(emFoco).outlineStyle;
  });

  expect(estilo).not.toBe("none");
}

/** FR-338: a página inteira não rola na horizontal. */
async function conferirSemRolagemHorizontal(
  pagina: Page,
  tela: string,
): Promise<void> {
  const medidas = await pagina.evaluate(() => ({
    conteudo: document.documentElement.scrollWidth,
    visivel: document.documentElement.clientWidth,
  }));

  expect(medidas.conteudo, `rolagem horizontal em ${tela}`).toBeLessThanOrEqual(
    medidas.visivel,
  );
}

function navegarPara(pagina: Page, destino: string): Promise<void> {
  return pagina
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: destino })
    .click();
}

async function percorrerCaso(
  browser: Browser,
  ambiente: Ambiente,
  credencial: CredencialDeProva,
  caso: Caso,
): Promise<void> {
  const contexto = await browser.newContext({
    viewport: caso.viewport,
    deviceScaleFactor: caso.escala,
  });

  try {
    const pagina = await contexto.newPage();

    await pagina.goto(ambiente.enderecoDoFrontend);

    // --- Entrar (FR-327, FR-328, FR-329) -----------------------------------
    await expect(pagina.getByText("Bem-vindo", { exact: true })).toBeVisible();
    await expect(
      pagina.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeVisible();

    // FR-329: Mostrar e Ocultar têm a mesma largura fixa de 7 rem.
    const mostrar = pagina.getByRole("button", { name: "Mostrar Senha" });
    const larguraMostrando = (await medir(mostrar)).largura;

    expect(Math.abs(larguraMostrando - LARGURA_DO_MOSTRAR)).toBeLessThanOrEqual(
      TOLERANCIA,
    );

    await mostrar.click();

    const ocultar = pagina.getByRole("button", { name: "Ocultar Senha" });

    expect(
      Math.abs((await medir(ocultar)).largura - larguraMostrando),
    ).toBeLessThanOrEqual(TOLERANCIA);

    await ocultar.click();

    // FR-328: a caixa grande mede 37 px e o rótulo clicável tem 44 x 44 px.
    const continuarConectado = pagina.getByLabel(
      "Continuar conectado neste navegador",
    );
    const caixa = await medir(continuarConectado);

    expect(Math.abs(caixa.largura - LADO_DA_CAIXA_GRANDE)).toBeLessThanOrEqual(
      TOLERANCIA,
    );
    expect(Math.abs(caixa.altura - LADO_DA_CAIXA_GRANDE)).toBeLessThanOrEqual(
      TOLERANCIA,
    );

    const rotulo = await continuarConectado.evaluate((elemento) => {
      const alvo = (elemento as HTMLInputElement).labels?.[0];

      if (alvo === undefined) {
        return null;
      }

      const retangulo = alvo.getBoundingClientRect();

      return { largura: retangulo.width, altura: retangulo.height };
    });

    expect(rotulo).not.toBeNull();
    expect(rotulo?.largura ?? 0).toBeGreaterThanOrEqual(ALVO_MINIMO);
    expect(rotulo?.altura ?? 0).toBeGreaterThanOrEqual(ALVO_MINIMO);

    // A opção é alcançada por Tab, com foco visível.
    await pagina.getByLabel("Senha", { exact: true }).click();
    await tabularAte(pagina, continuarConectado);
    await conferirContornoDoFoco(pagina);
    await conferirSemRolagemHorizontal(pagina, `Entrar em ${caso.nome}`);

    // --- Sair (FR-327) ------------------------------------------------------
    await entrarPelaUi(pagina, credencial);
    await pagina.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(
      pagina.getByRole("status").filter({ hasText: "Você saiu com sucesso." }),
    ).toHaveText("Você saiu com sucesso.");
    await conferirSemRolagemHorizontal(pagina, `Entrar após Sair em ${caso.nome}`);

    // --- Perfil (FR-335, FR-336) ---------------------------------------------
    await entrarPelaUi(pagina, credencial);
    await navegarPara(pagina, "Perfil");
    await expect(
      pagina.getByRole("heading", { level: 1, name: "Perfil" }),
    ).toBeVisible();
    await expect(pagina).toHaveURL(/#\/preferencias$/);

    const tituloDaConta = pagina.getByRole("heading", {
      level: 2,
      name: "Minha conta",
    });

    await expect(
      pagina.getByText(`Nome de usuário: ${credencial.nomeDeUsuario}`),
    ).toBeVisible();

    // FR-335: 32 px entre o bloco da Configuração e o de Minha conta.
    const separacao = await tituloDaConta.evaluate((titulo) => {
      const blocoDaConta = titulo.closest("section, .cartao");
      const anterior = blocoDaConta?.previousElementSibling;

      if (blocoDaConta === null || blocoDaConta === undefined || !anterior) {
        return null;
      }

      return (
        blocoDaConta.getBoundingClientRect().top -
        anterior.getBoundingClientRect().bottom
      );
    });

    expect(separacao, `separação no Perfil em ${caso.nome}`).not.toBeNull();
    expect(Math.abs((separacao ?? 0) - SEPARACAO_DO_PERFIL)).toBeLessThanOrEqual(
      TOLERANCIA,
    );

    // FR-336: o Nome de usuário é somente leitura.
    await expect(
      pagina.getByRole("textbox", { name: /Nome de usuário/ }),
    ).toHaveCount(0);
    await expect(
      pagina.getByRole("button", { name: /Nome de usuário/ }),
    ).toHaveCount(0);

    // FR-335: salvar confirma «Configuração salva.».
    await pagina.getByRole("button", { name: "Salvar" }).click();
    await expect(
      pagina.getByRole("status").filter({ hasText: "Configuração salva." }),
    ).toBeVisible();
    await conferirSemRolagemHorizontal(pagina, `Perfil em ${caso.nome}`);

    // --- Início (FR-330, FR-331, FR-332, FR-334) -----------------------------
    await navegarPara(pagina, "Início");
    await expect(
      pagina.getByRole("heading", {
        level: 1,
        name: `Olá, ${credencial.nomeDeUsuario}`,
      }),
    ).toBeVisible();
    await expect(
      pagina.getByRole("link", { name: "Criar o primeiro Cartão" }),
    ).toBeVisible();
    await expect(
      pagina.getByRole("heading", {
        level: 3,
        name: "Nada para revisar.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(pagina.getByText("Seu estudo")).toHaveCount(0);
    await expect(pagina.locator("p.resumo-de-sete-dias")).toHaveCount(0);
    await expect(pagina.getByText(/fuso/i)).toHaveCount(0);
    await expect(
      pagina.getByRole("link", { name: "Agendar estudo" }),
    ).toHaveCount(0);
    await conferirSemRolagemHorizontal(pagina, `Início em ${caso.nome}`);

    // --- Estudo (FR-332, FR-333, FR-334) -------------------------------------
    await navegarPara(pagina, "Estudo");
    await expect(
      pagina.getByRole("link", { name: "Agendar estudo" }).first(),
    ).toBeVisible();
    await expect(pagina.getByText(/fuso/i)).toHaveCount(0);

    // FR-333: sem Compromissos, o dia mostra uma única mensagem de vazio. O
    // acervo vazio torna qualquer dia da semana determinístico.
    await pagina.locator(".agenda__dias button").first().click();
    await expect(
      pagina.getByText("Nenhum estudo agendado para este dia.", { exact: true }),
    ).toBeVisible();
    await conferirSemRolagemHorizontal(pagina, `Estudo em ${caso.nome}`);
  } finally {
    await contexto.close();
  }
}

test("Entrar, Sair, Perfil, Início e Estudo em 360, 390, 768 e 1440 px e com zoom de 200% (SC-131..SC-133; FR-327..FR-338)", async ({
  browser,
}) => {
  const ambiente = await subirAmbiente("refinamento-ui-");

  try {
    const ana = await criarUsuarioDeProva(ambiente.enderecoDaApi, "ana.silva");

    for (const caso of CASOS) {
      await percorrerCaso(browser, ambiente, ana, caso);
    }
  } finally {
    await ambiente.encerrar();
  }
});
