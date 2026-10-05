// T2207 — prova E2E real da busca e dos filtros do acervo (spec 022; SC-138, SC-139, SC-140; FR-359)

import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

import {
  aguardarApiPronta,
  aguardarProntidao,
  cabecalhoDeCredencial,
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
  AMBIENTE_COM_RELOGIO_FIXO,
  fixarRelogioDoContexto,
} from "./servidores-locais";
import type { CredencialDeProva, ProcessoIniciado } from "./servidores-locais";

test.setTimeout(240_000);

// O dia de «hoje» é o mesmo na API e no navegador, e não o da máquina que roda.
test.beforeEach(async ({ context }) => {
  await fixarRelogioDoContexto(context);
});

// --- Infraestrutura de execução real ---------------------------------------

interface Ambiente {
  pasta: string;
  api: ProcessoIniciado;
  frontend: ProcessoIniciado;
  enderecoDaApi: string;
  enderecoDoFrontend: string;
}

async function subirAmbiente(): Promise<Ambiente> {
  const pasta = await criarPastaTemporaria("busca-filtros-");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    const portaDaApi = await portaLivre();

    api = iniciarApi(
      join(pasta, "busca-filtros.sqlite"),
      portaDaApi,
      AMBIENTE_COM_RELOGIO_FIXO,
    );

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

    return { pasta, api, frontend, enderecoDaApi, enderecoDoFrontend };
  } catch (erro) {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
    throw erro;
  }
}

/** Encerra os dois processos e remove o arquivo e a pasta temporários. */
async function derrubarAmbiente(ambiente: Ambiente): Promise<void> {
  await encerrarProcesso(ambiente.frontend);
  await encerrarProcesso(ambiente.api);
  await removerPastaTemporaria(ambiente.pasta);
}

// --- Auxiliares de preparação ----------------------------------------------

interface BaralhoPreparado {
  id: string;
  nome: string;
  cartoes: { id: string; frente: string; verso: string }[];
}

/** Cria um Baralho com os Cartões vinculados direto pela API real. */
async function prepararBaralho(
  ambiente: Ambiente,
  credencial: CredencialDeProva,
  nome: string,
  cartoes: { frente: string; verso: string }[],
): Promise<BaralhoPreparado> {
  const baralho = await criarBaralhoPelaApi(
    ambiente.enderecoDaApi,
    { nome },
    credencial,
  );

  const criados: { id: string; frente: string; verso: string }[] = [];

  for (const cartao of cartoes) {
    const criado = await criarCartaoPelaApi(
      ambiente.enderecoDaApi,
      cartao,
      credencial,
    );

    await vincularCartaoPelaApi(
      ambiente.enderecoDaApi,
      criado.id,
      baralho.id,
      credencial,
    );

    criados.push({ id: criado.id, frente: criado.frente, verso: criado.verso });
  }

  return { id: baralho.id, nome: baralho.nome, cartoes: criados };
}

// --- Auxiliares da API ------------------------------------------------------

type Avaliacao = "errei" | "dificil" | "bom" | "facil";

interface DadosDeRegistroDeProva {
  id: string;
  origem: "baralho";
  baralhoId: string;
  nomeDoBaralho: string;
  itens: {
    frente: string;
    verso: string;
    cartaoId: string;
    avaliacao: Avaliacao;
  }[];
}

/** Conclui uma Sessão direto pela API real (FR-196, FR-210). */
async function registrarSessaoPelaApi(
  enderecoDaApi: string,
  dados: DadosDeRegistroDeProva,
  credencial: CredencialDeProva,
): Promise<number> {
  const resposta = await fetch(`${enderecoDaApi}/sessoes`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...cabecalhoDeCredencial(credencial),
    },
    body: JSON.stringify(dados),
  });

  return resposta.status;
}

// --- Auxiliares de tela -----------------------------------------------------

/** Abre uma rota do frontend e Entra se necessário. */
async function abrirTela(
  page: Page,
  ambiente: Ambiente,
  rota: string,
  credencial: CredencialDeProva,
): Promise<void> {
  await page.goto(`${ambiente.enderecoDoFrontend}/#/${rota}`);
  await entrarSeNecessario(page, credencial);
}

// --- T2207/1: busca e limpeza em Baralhos (SC-138) --------------------------

test("Baralhos: «algebra» encontra «Álgebra linear», e Limpar filtros restaura a lista (FR-348, FR-350, SC-138)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.busca",
    );

    await prepararBaralho(ambiente, credencial, "Álgebra linear", [
      { frente: "Matriz", verso: "Tabela de números" },
    ]);
    await prepararBaralho(ambiente, credencial, "Biologia", [
      { frente: "Célula", verso: "Unidade da vida" },
    ]);

    await abrirTela(page, ambiente, "baralhos", credencial);

    const busca = page.getByLabel("Buscar baralhos");

    await busca.fill("algebra");

    await expect(page.getByText("1 resultado")).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(
      page.getByRole("listitem").filter({ hasText: "Álgebra linear" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Estudar Álgebra linear" }),
    ).toBeVisible();

    await busca.fill("xyz");

    await expect(
      page.getByRole("heading", { name: "Nenhum resultado encontrado" }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Limpar filtros" })
      .first()
      .click();

    await expect(page.getByRole("listitem")).toHaveCount(2);
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

// --- T2207/2: combinação de busca, Baralho e situação (SC-138–SC-140) -------

test("Cartões: Verso, Baralho, Sem baralho e situação combinados, sem duplicar (FR-349, FR-351–FR-353, SC-138–SC-140)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.filtros",
    );

    const ingles = await prepararBaralho(ambiente, credencial, "Inglês cotidiano", [
      { frente: "How are you?", verso: "Como você está?" },
      { frente: "Where is the station?", verso: "Onde fica a estação?" },
    ]);
    const viagens = await prepararBaralho(ambiente, credencial, "Viagens", []);

    await vincularCartaoPelaApi(
      ambiente.enderecoDaApi,
      ingles.cartoes[0].id,
      viagens.id,
      credencial,
    );

    await criarCartaoPelaApi(
      ambiente.enderecoDaApi,
      { frente: "O que é osmose?", verso: "Passagem de água pela membrana." },
      credencial,
    );

    const status = await registrarSessaoPelaApi(
      ambiente.enderecoDaApi,
      {
        id: randomUUID(),
        origem: "baralho",
        baralhoId: ingles.id,
        nomeDoBaralho: ingles.nome,
        itens: [
          {
            frente: "How are you?",
            verso: "Como você está?",
            cartaoId: ingles.cartoes[0].id,
            avaliacao: "bom",
          },
        ],
      },
      credencial,
    );

    expect([200, 201]).toContain(status);

    await abrirTela(page, ambiente, "cartoes", credencial);

    const busca = page.getByLabel("Buscar cartões");
    const comboBaralho = page.getByLabel("Baralho");
    const comboSituacao = page.getByLabel("Situação da revisão");
    const limpar = page.getByRole("button", { name: "Limpar filtros" }).first();

    // (a) busca pelo Verso.
    await busca.fill("estação");
    await expect(page.getByText("1 resultado")).toBeVisible();
    await expect(page.getByText("Where is the station?")).toBeVisible();
    await expect(page.getByText("How are you?")).toHaveCount(0);

    // (b) filtro por Baralho, sem duplicar o Cartão em dois Baralhos.
    await limpar.click();

    await comboBaralho.selectOption({ label: "Viagens" });
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByText("How are you?")).toBeVisible();

    await comboBaralho.selectOption({ label: "Inglês cotidiano" });
    await expect(page.getByRole("listitem")).toHaveCount(2);
    await expect(page.getByText("How are you?")).toHaveCount(1);

    // (c) Cartões Sem baralho.
    await comboBaralho.selectOption({ label: "Sem baralho" });
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByText("O que é osmose?")).toBeVisible();

    // (d) filtro por situação da revisão.
    await comboBaralho.selectOption({ label: "Todos" });

    await comboSituacao.selectOption({ label: "Em dia" });
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByText("How are you?")).toBeVisible();

    await comboSituacao.selectOption({ label: "Novos" });
    await expect(page.getByRole("listitem")).toHaveCount(2);
    await expect(page.getByText("Where is the station?")).toBeVisible();
    await expect(page.getByText("O que é osmose?")).toBeVisible();

    // (e) combinação dos três critérios.
    await busca.fill("how");
    await comboBaralho.selectOption({ label: "Inglês cotidiano" });
    await comboSituacao.selectOption({ label: "Em dia" });
    await expect(page.getByText("1 resultado")).toBeVisible();
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

// --- T2207/3: isolamento por Usuário (FR-359) -------------------------------

test("Isolamento: resultados e opções de Baralho são só do Usuário (FR-359)", async ({ browser }) => {
  const ambiente = await subirAmbiente();

  let contextoDeB: BrowserContext | null = null;

  try {
    contextoDeB = await browser.newContext();
    await fixarRelogioDoContexto(contextoDeB);

    const pageDeB = await contextoDeB.newPage();

    const credencialA = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.a",
    );
    const credencialB = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.b",
    );

    await prepararBaralho(ambiente, credencialA, "Segredo de A", [
      { frente: "Frente de A", verso: "Verso de A" },
    ]);
    await prepararBaralho(ambiente, credencialB, "Inglês", [
      { frente: "Hello", verso: "Olá" },
    ]);

    await abrirTela(pageDeB, ambiente, "cartoes", credencialB);

    // As opções de Baralho chegam com a carga, então a prova espera a
    // contagem antes de ler as opções do seletor.
    await expect(pageDeB.getByText("1 resultado")).toBeVisible();

    const opcoes = await pageDeB
      .getByLabel("Baralho")
      .locator("option")
      .allTextContents();

    expect(opcoes).not.toContain("Segredo de A");
    expect(opcoes).toContain("Inglês");

    await pageDeB.getByLabel("Buscar cartões").fill("Frente de A");
    await expect(
      pageDeB.getByRole("heading", { name: "Nenhum resultado encontrado" }),
    ).toBeVisible();

    await abrirTela(pageDeB, ambiente, "baralhos", credencialB);

    await pageDeB.getByLabel("Buscar baralhos").fill("segredo");
    await expect(
      pageDeB.getByRole("heading", { name: "Nenhum resultado encontrado" }),
    ).toBeVisible();
  } finally {
    await contextoDeB?.close();
    await derrubarAmbiente(ambiente);
  }
});
