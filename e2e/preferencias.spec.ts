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
import type { CredencialDeProva, ProcessoIniciado } from "./servidores-locais";

// T1524 — prova E2E real das Preferências do estudo (FR-200, FR-212 e FR-148;
// SC-081; specs/015-repeticao-espacada/tasks.md).
//
// Nenhuma rede é interceptada e nenhum dado é fabricado: a API real
// (node + SQLite em arquivo) e o frontend real (Vite dev) são iniciados como
// processos filhos do próprio teste, em portas livres e com um arquivo SQLite
// temporário exclusivo. Cartões e Baralhos são criados direto pela API; a
// navegação, a tela de Preferências, Início e a Revisão do dia são percorridas
// no Chromium pela tela real.
//
// Os cenários cobrem: (1) os padrões exibidos na tela — SM-2 selecionado e o
// limite de 20 (FR-212); (2) o limite de novos por dia restringindo Início e a
// Revisão do dia (FR-200); (3) o limite 0 esvaziando a Revisão do dia; (4) um
// valor fora da faixa 0..999 recusado com mensagem (FR-200); (5) alterações não
// salvas exigindo confirmação de descarte ao sair (FR-148).

const NOME_DO_BARALHO = "Inglês";
/** Um Baralho canônico: três Cartões novos, todos elegíveis à revisão. */
const CARTOES_DO_BARALHO = [
  { frente: "Frente 1", verso: "Verso 1" },
  { frente: "Frente 2", verso: "Verso 2" },
  { frente: "Frente 3", verso: "Verso 3" },
];

test.setTimeout(180_000);

// --- Infraestrutura de execução real ---------------------------------------

interface Ambiente {
  pasta: string;
  api: ProcessoIniciado;
  frontend: ProcessoIniciado;
  enderecoDaApi: string;
  enderecoDoFrontend: string;
}

/**
 * Sobe a API real (SQLite em arquivo temporário exclusivo) e o frontend real
 * (Vite dev) em portas livres, aguardando a prontidão de cada um. Se algo
 * falhar no meio, limpa o que já subiu antes de propagar o erro — o `try`
 * externo do teste só cobre o caso de sucesso.
 */
async function subirAmbiente(): Promise<Ambiente> {
  const pasta = await criarPastaTemporaria("preferencias-");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    const portaDaApi = await portaLivre();

    api = iniciarApi(join(pasta, "preferencias.sqlite"), portaDaApi);

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

// --- Auxiliares de preparação e de tela ------------------------------------

/**
 * Cria um Baralho com os Cartões vinculados direto pela API real. Os Cartões
 * criados agora não têm Agendamento algum: são Cartões novos, e é exatamente
 * esse acervo que o limite de novos por dia conta (FR-199).
 */
async function prepararBaralho(
  ambiente: Ambiente,
  credencial: CredencialDeProva,
  nome: string,
  cartoes: { frente: string; verso: string }[],
): Promise<{ id: string; nome: string }> {
  const baralho = await criarBaralhoPelaApi(
    ambiente.enderecoDaApi,
    { nome },
    credencial,
  );

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
  }

  return { id: baralho.id, nome: baralho.nome };
}

/** Abre a tela de Preferências pela rota direta, Entrando se preciso. */
async function abrirPreferencias(
  page: Page,
  ambiente: Ambiente,
  credencial: CredencialDeProva,
): Promise<void> {
  await page.goto(`${ambiente.enderecoDoFrontend}/#/preferencias`);
  await entrarSeNecessario(page, credencial);

  await expect(
    page.getByRole("heading", { level: 1, name: "Preferências" }),
  ).toBeVisible();
}

/** Navega para Preferências pela navegação principal (FR-212). */
async function irParaPreferenciasPelaNavegacao(page: Page): Promise<void> {
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Preferências" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Preferências" }),
  ).toBeVisible();
}

/**
 * Preenche o limite de novos por dia e salva pela tela. A espera é pela
 * resposta do próprio `PUT /preferencias`, e não por um tempo fixo: sem o 200
 * do servidor, o limite não vale para Início nem para a Revisão (FR-200).
 */
async function salvarLimite(page: Page, limite: number): Promise<void> {
  await campoDoLimite(page).fill(String(limite));

  const [resposta] = await Promise.all([
    page.waitForResponse(
      (candidata) =>
        candidata.url().endsWith("/preferencias") &&
        candidata.request().method() === "PUT",
    ),
    page.getByRole("button", { name: "Salvar" }).click(),
  ]);

  expect(resposta.status()).toBe(200);
}

/** Navega para Início pela navegação principal e espera a saudação. */
async function irParaInicio(page: Page, nomeDeUsuario: string): Promise<void> {
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Início" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: `Olá, ${nomeDeUsuario}` }),
  ).toBeVisible();
}

/**
 * Abre a Revisão do dia pela rota e, se ela oferecer um botão para começar,
 * começa: a Sessão da Revisão não pergunta quantidade nem embaralha — o lote já
 * vem pronto e ordenado (FR-201). É aqui que se contam os Itens do dia.
 */
async function iniciarRevisaoPelaUi(
  page: Page,
  ambiente: Ambiente,
  credencial: CredencialDeProva,
): Promise<void> {
  await page.goto(`${ambiente.enderecoDoFrontend}/#/revisao`);
  await entrarSeNecessario(page, credencial);

  const comecar = page.getByRole("button", {
    name: /começar a revisão|começar|revisar|iniciar/i,
  });

  if ((await comecar.count()) > 0) {
    await comecar.first().click();
  }
}

/** O campo do limite de novos por dia, pela etiqueta que o descreve. */
function campoDoLimite(page: Page) {
  return page.getByLabel("Cartões novos por dia");
}

// --- Cenário 1: os padrões exibidos ----------------------------------------

test("Preferências abre pela navegação com o SM-2 e o limite padrão de 20 (FR-212, SC-081)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);

    await page.goto(`${ambiente.enderecoDoFrontend}/#/inicio`);
    await entrarSeNecessario(page, credencial);

    await irParaPreferenciasPelaNavegacao(page);

    // Sem Preferências salvas, valem os padrões: SM-2 e 20 novos por dia
    // (FR-212, contrato §3.2).
    await expect(page.getByLabel("Algoritmo de repetição espaçada")).toHaveValue(
      "sm2",
    );
    await expect(campoDoLimite(page)).toHaveValue("20");
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

// --- Cenário 2: o limite restringe Início e a Revisão do dia ----------------

test("Limite de 1 novo por dia restringe Início e a Revisão do dia (FR-200, SC-081)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);

    await prepararBaralho(
      ambiente,
      credencial,
      NOME_DO_BARALHO,
      CARTOES_DO_BARALHO,
    );

    await abrirPreferencias(page, ambiente, credencial);
    await salvarLimite(page, 1);

    // Com 3 Cartões novos e o limite 1, Início anuncia exatamente 1 Cartão novo
    // e a Revisão do dia é uma Sessão de 1 Item (FR-199, FR-201).
    await irParaInicio(page, credencial.nomeDeUsuario);
    await expect(page.getByText("1 Cartão novo entra hoje")).toBeVisible();

    await iniciarRevisaoPelaUi(page, ambiente, credencial);
    await expect(
      page.getByRole("article", { name: "Item 1 de 1" }),
    ).toBeVisible();
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

// --- Cenário 3: o limite 0 esvazia a Revisão do dia -------------------------

test("Limite 0 esvazia a Revisão do dia (FR-200, SC-081)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);

    await prepararBaralho(
      ambiente,
      credencial,
      NOME_DO_BARALHO,
      CARTOES_DO_BARALHO,
    );

    await abrirPreferencias(page, ambiente, credencial);
    await salvarLimite(page, 0);

    // Há Cartões novos, mas o limite 0 não introduz nenhum: Início declara que
    // não há o que revisar hoje (FR-199, FR-200).
    await irParaInicio(page, credencial.nomeDeUsuario);
    await expect(page.getByText("Nada para revisar hoje")).toBeVisible();
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

// --- Cenário 4: valor fora da faixa é recusado ------------------------------

test("Limite fora da faixa 0..999 é recusado com mensagem (FR-200, SC-081)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);

    await abrirPreferencias(page, ambiente, credencial);

    await campoDoLimite(page).fill("1000");
    await page.getByRole("button", { name: "Salvar" }).click();

    // O valor não é aceito e a tela explica por quê (FR-200).
    await expect(page.getByRole("alert")).toBeVisible();

    // Nada foi salvo: recarregar a tela devolve o valor anterior, o padrão 20.
    await page.reload();
    await entrarSeNecessario(page, credencial);
    await expect(campoDoLimite(page)).toHaveValue("20");
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

// --- Cenário 5: sair com alterações não salvas ------------------------------

test("Sair com alterações não salvas pede confirmação de descarte (FR-148, FR-212, SC-081)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);

    await abrirPreferencias(page, ambiente, credencial);

    // Altera o limite sem salvar e tenta sair pela navegação principal.
    await campoDoLimite(page).fill("5");
    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Início" })
      .click();

    const dialogo = page.getByRole("dialog");

    await expect(dialogo).toBeVisible();
    // "Descartar" aparece no título e no botão; a asserção por papel estreita a
    // verificação a um único elemento, sem cair na violação de modo estrito.
    await expect(
      dialogo.getByRole("heading", { name: "Descartar as alterações?" }),
    ).toBeVisible();

    // Confirmar o descarte leva a Início sem gravar nada (FR-148).
    await dialogo
      .getByRole("button", { name: "Descartar", exact: true })
      .click();

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: `Olá, ${credencial.nomeDeUsuario}`,
      }),
    ).toBeVisible();

    // Reabrir Preferências mostra o valor anterior: a alteração foi descartada.
    await abrirPreferencias(page, ambiente, credencial);
    await expect(campoDoLimite(page)).toHaveValue("20");
  } finally {
    await derrubarAmbiente(ambiente);
  }
});
