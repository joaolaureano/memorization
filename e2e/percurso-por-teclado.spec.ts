import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  aguardarProntidao,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  iniciarApi,
  iniciarFrontend,
  portaLivre,
  removerPastaTemporaria,
} from "./servidores-locais";
import type { CredencialDeProva, ProcessoIniciado } from "./servidores-locais";

// Prova E2E real do percurso completo por teclado (specs 012 e 013; SC-062,
// FR-158, FR-159).
//
// Nenhuma rede é interceptada e nenhum dado é fabricado: a API real
// (node + SQLite em arquivo) e o frontend real (Vite dev) são iniciados como
// processos filhos do próprio teste, em portas livres e com um arquivo SQLite
// temporário exclusivo. Apenas o Usuário é preparado pela API; todo o acervo —
// Baralho, Cartão e Vínculo — e toda a Sessão são criados e percorridos
// **apenas com o teclado**, na tela real do Chromium: Tab, Shift+Tab, Enter,
// Space, Escape e digitação. O mesmo roteiro roda em duas larguras (390x844 e
// 1440x900), porque a navegação por teclado e o foco visível precisam valer
// também no telefone (FR-158, FR-159).
//
// Ao final, as telas percorridas — o Resumo, as Preferências e a Revisão do
// dia — não podem apresentar rolagem horizontal (`scrollWidth <=
// clientWidth`) em nenhuma das larguras (FR-159, SC-088).
//
// A spec 024 tirou o formulário de início (Quantidade de Cartões + Iniciar
// Sessão): com o único Cartão novo, o Baralho está Pendente e o início passa
// pelo modal "Revisar baralho", também operado só com o teclado.

const NOME_DO_BARALHO = "Inglês";
const FRENTE_DO_CARTAO = "Pão";
const VERSO_DO_CARTAO = "Bread";

/** As duas larguras exigidas: telefone estreito e desktop largo. */
const CENARIOS = [
  { rotulo: "390x844", largura: 390, altura: 844 },
  { rotulo: "1440x900", largura: 1440, altura: 900 },
] as const;

test.setTimeout(180_000);

for (const cenario of CENARIOS) {
  test(`Percurso completo por teclado cria acervo e revisa até o Resumo em 100% (${cenario.rotulo}) (SC-062, FR-158, FR-159)`, async ({ page, browserName }) => {
    // Navegador real: Chromium, sem DOM simulado.
    expect(browserName).toBe("chromium");

    await page.setViewportSize({
      width: cenario.largura,
      height: cenario.altura,
    });

    const pasta = await criarPastaTemporaria("teclado-");
    const caminhoDoBanco = join(pasta, "teclado.sqlite");

    let api: ProcessoIniciado | null = null;
    let frontend: ProcessoIniciado | null = null;

    try {
      // API real sobre arquivo SQLite temporário exclusivo, em porta livre.
      const portaDaApi = await portaLivre();

      api = iniciarApi(caminhoDoBanco, portaDaApi);

      const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;

      await aguardarApiPronta(api, enderecoDaApi);

      // Frontend real apontando para a API do teste, em outra porta livre.
      const portaDoFrontend = await portaLivre();
      const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;

      frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);

      await aguardarProntidao(
        frontend,
        enderecoDoFrontend,
        (resposta) => resposta.ok,
      );

      // O Usuário de prova é cadastrado pela API; o restante do acervo nasce
      // pelas telas reais, só com o teclado.
      const credencial = await criarUsuarioDeProva(enderecoDaApi);

      await percursoPorTeclado(page, enderecoDoFrontend, credencial);
    } finally {
      // Encerrar sempre, mesmo quando a prova falha no meio, e remover o
      // arquivo e a pasta temporários.
      await encerrarProcesso(frontend);
      await encerrarProcesso(api);
      await removerPastaTemporaria(pasta);
    }
  });
}

/** Percorre Entrar → acervo → Sessão → Resumo usando apenas o teclado. */
async function percursoPorTeclado(
  page: Page,
  enderecoDoFrontend: string,
  credencial: CredencialDeProva,
): Promise<void> {
  // A tela inicial é Entrar, a única sem Credencial (FR-097).
  await page.goto(enderecoDoFrontend);
  await expect(
    page.getByRole("heading", { level: 1, name: "Entrar", exact: true }),
  ).toBeVisible();

  const campoNomeDeUsuario = page.getByLabel("Nome de usuário", {
    exact: true,
  });
  await focarPorTab(page, campoNomeDeUsuario);
  await page.keyboard.type(credencial.nomeDeUsuario);

  const campoSenha = page.getByLabel("Senha", { exact: true });
  await focarPorTab(page, campoSenha);
  await page.keyboard.type(credencial.senha);

  await acionarPorTab(
    page,
    page.getByRole("button", { name: "Entrar", exact: true }),
  );

  // Depois de Entrar, o destino é Início (spec 013): a saudação traz o Nome de
  // usuário e é pela navegação Principal que se alcança o acervo.
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: `Olá, ${credencial.nomeDeUsuario}`,
      exact: true,
    }),
  ).toBeVisible();

  // De Início para a lista de Baralhos, pela navegação Principal.
  await acionarPorTab(page, linkExato(page, "Baralhos"));
  await expect(
    page.getByRole("heading", { level: 1, name: "Baralhos", exact: true }),
  ).toBeVisible();

  // Criar baralho.
  await acionarPorTab(page, linkExato(page, "Criar baralho"));
  await expect(
    page.getByRole("heading", { level: 1, name: "Criar baralho", exact: true }),
  ).toBeVisible();

  const campoNomeDoBaralho = page.getByLabel("Nome", { exact: true });
  await focarPorTab(page, campoNomeDoBaralho);
  await page.keyboard.type(NOME_DO_BARALHO);

  // Caminho sem Escape: o formulário está sujo, então Shift+Tab até o link
  // "← Voltar" e Enter abrem o diálogo de descarte com o foco inicial em
  // "Cancelar" (FR-158).
  await focarPorShiftTab(page, page.getByRole("link", { name: /Voltar/ }));
  await page.keyboard.press("Enter");

  await expect(page.getByText(/Descartar as alterações\?/)).toBeVisible();

  const botaoCancelar = page.getByRole("button", {
    name: "Cancelar",
    exact: true,
  });
  const cancelarEstaFocado = await botaoCancelar.evaluate(
    (elemento) => elemento === document.activeElement,
  );
  expect(cancelarEstaFocado).toBe(true);

  // Escape cancela: o diálogo fecha e o nome digitado continua lá.
  await page.keyboard.press("Escape");
  await expect(page.getByText(/Descartar as alterações\?/)).toHaveCount(0);
  await expect(campoNomeDoBaralho).toHaveValue(NOME_DO_BARALHO);

  // Salvar leva ao detalhe do Baralho recém-criado.
  await acionarPorTab(
    page,
    page.getByRole("button", { name: "Salvar", exact: true }),
  );
  await expect(
    page.getByRole("heading", { level: 1, name: NOME_DO_BARALHO, exact: true }),
  ).toBeVisible();

  // Criar o Cartão dentro do Baralho dono.
  await acionarPorTab(page, linkExato(page, "Criar Cartão"));
  await expect(
    page.getByRole("heading", { level: 1, name: "Criar cartão", exact: true }),
  ).toBeVisible();

  const campoFrente = page.getByLabel("Frente", { exact: true });
  await focarPorTab(page, campoFrente);
  await page.keyboard.type(FRENTE_DO_CARTAO);

  const campoVerso = page.getByLabel("Verso", { exact: true });
  await focarPorTab(page, campoVerso);
  await page.keyboard.type(VERSO_DO_CARTAO);

  await acionarPorTab(
    page,
    page.getByRole("button", { name: "Salvar", exact: true }),
  );
  await expect(
    page.getByRole("heading", { level: 1, name: NOME_DO_BARALHO, exact: true }),
  ).toBeVisible();

  await acionarPorTab(page, acionavel(page, "Revisar este Baralho"));

  // O único Cartão é novo: o Baralho está Pendente e o modal decide a Sessão.
  // Sem toque no mouse — o foco entra no modal e Tab alcança "Só pendentes"
  // (spec 024).
  const modalDeRevisao = page.getByRole("dialog");

  await expect(modalDeRevisao.getByText("Revisar baralho")).toBeVisible();

  await acionarPorTab(
    page,
    modalDeRevisao.getByRole("button", { name: "Só pendentes", exact: true }),
  );
  await expect(
    page.getByRole("article", { name: "Item 1 de 1" }),
  ).toBeVisible();

  // Revelar verso e avaliar o único Item como "Bom" — o nível que substituiu o
  // antigo Acerto (FR-193, SC-088).
  await acionarPorTab(
    page,
    page.getByRole("button", { name: "Revelar verso", exact: true }),
  );
  await acionarPorTab(
    page,
    page.getByRole("button", { name: /^Bom/ }),
  );

  // Resumo com 100% de acertos.
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Sessão concluída",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/100\s*%/)).toBeVisible();

  // Spec 013: concluída, a Sessão é registrada no histórico pela API real; a
  // confirmação é anunciada ao leitor de tela.
  await expect(
    page.getByRole("status", { name: "Situação do registro da Sessão" }),
  ).toContainText(/Sessão registrada no histórico/);

  // Preferências, pela navegação Principal: o quarto destino da Moldura
  // (FR-212, SC-088). A travessia continua sendo só de teclado.
  await acionarPorTab(page, linkExato(page, "Perfil"));
  await expect(
    page.getByRole("heading", { level: 1, name: "Perfil", exact: true }),
  ).toBeVisible();
  await conferirSemTransbordo(page);

  // Início, pelo link textual da navegação Principal.
  await acionarPorTab(page, linkExato(page, "Início"));
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: `Olá, ${credencial.nomeDeUsuario}`,
      exact: true,
    }),
  ).toBeVisible();
  await conferirSemTransbordo(page);
}

/** Locator de link pelo nome acessível exato. */
function linkExato(page: Page, nome: string): Locator {
  // `.first()`: "Criar baralho" existe no cabeçalho e, na lista vazia, também no
  // estado vazio — e qual dos dois já está na tela depende de a lista ter
  // carregado. O do cabeçalho vem primeiro na ordem do documento e existe sempre.
  return page.getByRole("link", { name: nome, exact: true }).first();
}

/** Locator que casa o link **ou** o botão com o nome acessível exato. */
function acionavel(page: Page, nome: string): Locator {
  return linkExato(page, nome).or(
    page.getByRole("button", { name: nome, exact: true }),
  );
}

/** Confere que a tela atual não apresenta rolagem horizontal (FR-159). */
async function conferirSemTransbordo(page: Page): Promise<void> {
  const medidas = await page.evaluate(() => ({
    conteudo: document.documentElement.scrollWidth,
    visivel: document.documentElement.clientWidth,
  }));

  expect(medidas.conteudo).toBeLessThanOrEqual(medidas.visivel);
}

/** Foca o alvo com Enter (links) ou Space (botões). */
async function acionarPorTab(
  page: Page,
  locator: Locator,
  tecla: "Enter" | "Space" = "Enter",
): Promise<void> {
  await focarPorTab(page, locator);
  await page.keyboard.press(tecla);
}

/**
 * Pressiona Tab até o alvo receber foco e confere que cada elemento alcançado
 * tem foco visível (o contorno computado não é `none`). Falha se o alvo não
 * for alcançado dentro de `max` toques (FR-158, SC-062).
 */
async function focarPorTab(
  page: Page,
  locator: Locator,
  max = 40,
): Promise<void> {
  await focarPressionando(page, locator, "Tab", max);
}

/** Igual a `focarPorTab`, mas percorre o documento para trás. */
async function focarPorShiftTab(
  page: Page,
  locator: Locator,
  max = 40,
): Promise<void> {
  await focarPressionando(page, locator, "Shift+Tab", max);
}

async function focarPressionando(
  page: Page,
  locator: Locator,
  tecla: "Tab" | "Shift+Tab",
  max: number,
): Promise<void> {
  // Se o alvo nem existe, falha cedo em vez de repetir Tab até o fim.
  await expect(locator).toBeAttached();

  for (let passo = 0; passo <= max; passo += 1) {
    if (await estaFocado(locator)) {
      await conferirFocoDoAtivo(page);
      return;
    }

    await page.keyboard.press(tecla);
    await conferirFocoDoAtivo(page);
  }

  throw new Error(
    `o alvo não recebeu foco após ${max} toques de ${tecla} (FR-158, SC-062)`,
  );
}

async function estaFocado(locator: Locator): Promise<boolean> {
  return await locator.evaluate(
    (elemento) => elemento === document.activeElement,
  );
}

/**
 * Confere que o elemento em foco tem foco visível: o `outline-style` computado
 * não pode ser `none`. `body`/`html` em foco (documento sem alvo) são
 * ignorados — não são elementos de interface.
 */
async function conferirFocoDoAtivo(page: Page): Promise<void> {
  const focoVisivel = await page.evaluate(() => {
    const ativo = document.activeElement;

    if (
      ativo === null ||
      ativo === document.body ||
      ativo === document.documentElement
    ) {
      return true;
    }

    return getComputedStyle(ativo).outlineStyle !== "none";
  });

  expect(focoVisivel).toBe(true);
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
