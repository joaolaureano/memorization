import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

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

// T1523 — prova E2E real da Repetição espaçada
// (FR-187 a FR-221, SC-080, SC-081, SC-084, SC-086, SC-087, SC-089;
// specs/015-repeticao-espacada/tasks.md).
//
// Nenhuma rede é interceptada e nenhum dado é fabricado: a API real
// (node + SQLite em arquivo) e o frontend real (Vite dev) são iniciados como
// processos filhos do próprio teste, em portas livres e com um arquivo SQLite
// temporário exclusivo. Cartões, Baralhos e Vínculos são criados direto pela
// API; a Sessão de estudo por Baralho é percorrida no Chromium pela tela real,
// e o Agendamento resultante é observado pela prévia que a API devolve
// (`POST /previas`, FR-221).
//
// Os cenários cobrem: (2) o estudo livre por Baralho alimenta o Agendamento;
// (4) o atalho de teclado avalia o nível; (5) Início monta com leituras
// agregadas e em número fixo numa base grande (SC-087). A Revisão do dia saiu
// da aplicação, e com ela os cenários (1) e (3), que a percorriam.
//
// A spec 024 tirou o formulário de início (Quantidade de Cartões + Iniciar
// Sessão): os Baralhos destes cenários só têm Cartões novos, então estão
// Pendentes e a Sessão começa pelo modal "Revisar baralho" com "Só pendentes".

test.setTimeout(240_000);

// O dia de «hoje» é o mesmo na API e no navegador, e não o da máquina que roda.
test.beforeEach(async ({ context }) => {
  await fixarRelogioDoContexto(context);
});

const NOME_DO_BARALHO = "Inglês";
/** Um Baralho canônico de três Cartões. */
const CARTOES = [
  { frente: "Frente 1", verso: "Verso 1" },
  { frente: "Frente 2", verso: "Verso 2" },
  { frente: "Frente 3", verso: "Verso 3" },
];

/** As quatro Avaliações da Sessão (FR-194). */
type Avaliacao = "errei" | "dificil" | "bom" | "facil";

/** O rótulo de cada nível, como a tela o apresenta (FR-191, FR-221). */
const ROTULO_DA_AVALIACAO: Record<Avaliacao, string> = {
  errei: "Errei",
  dificil: "Difícil",
  bom: "Bom",
  facil: "Fácil",
};

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
  const pasta = await criarPastaTemporaria("repeticao-");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    const portaDaApi = await portaLivre();

    api = iniciarApi(
      join(pasta, "repeticao.sqlite"),
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

/** A prévia de cada Avaliação de um Cartão, lida direto da API real (FR-221). */
async function obterPreviaPelaApi(
  enderecoDaApi: string,
  credencial: CredencialDeProva,
  cartaoId: string,
): Promise<Record<Avaliacao, string>> {
  const resposta = await fetch(`${enderecoDaApi}/previas`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...cabecalhoDeCredencial(credencial),
    },
    body: JSON.stringify({ cartaoIds: [cartaoId] }),
  });

  if (!resposta.ok) {
    throw new Error(`POST /previas respondeu ${resposta.status}`);
  }

  const corpo = (await resposta.json()) as {
    previas: Record<string, Record<Avaliacao, string>>;
  };

  return corpo.previas[cartaoId];
}

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

/**
 * Conclui uma Sessão direto pela API real, com o mesmo corpo estendido do
 * contrato `POST /sessoes` (FR-196, FR-210).
 */
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

/** Abre a tela de estudo de um Baralho e Entra se necessário. */
async function abrirEstudoDoBaralho(
  page: Page,
  ambiente: Ambiente,
  baralhoId: string,
  credencial: CredencialDeProva,
): Promise<void> {
  await page.goto(
    `${ambiente.enderecoDoFrontend}/#/baralhos/${baralhoId}/estudo`,
  );
  await entrarSeNecessario(page, credencial);
}

/**
 * Inicia a Sessão de revisão do Baralho pelo modal "Revisar baralho"
 * (spec 024): os Baralhos destes cenários têm só Cartões novos, então "Só
 * pendentes" começa exatamente o conjunto preparado.
 */
async function iniciarSessaoDeRevisao(page: Page): Promise<void> {
  const modalDeRevisao = page.getByRole("dialog");

  await expect(modalDeRevisao).toBeVisible({ timeout: 15_000 });
  await modalDeRevisao
    .getByRole("button", { name: "Só pendentes", exact: true })
    .click();
}

/** Revela o Verso do Item em estudo (FR-192, FR-193). */
async function revelarVerso(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Revelar verso" }).click();
  await expect(page.getByRole("heading", { name: "Verso" })).toBeVisible();
}

/**
 * Avalia o Item em estudo no nível pedido, pelo botão correspondente. O nome
 * acessível do botão começa pelo rótulo do nível — "Bom, próxima revisão em
 * 1 dia" na Sessão livre —, de modo que o casamento é pelo prefixo do nível.
 */
async function avaliar(page: Page, avaliacao: Avaliacao): Promise<void> {
  await page
    .getByRole("button", {
      name: new RegExp(`^${ROTULO_DA_AVALIACAO[avaliacao]}\\b`),
    })
    .click();
}

/**
 * Num Cartão novo, as quatro Avaliações caem em 1 dia (FR-221, SC-090). A
 * prévia é conferida pelo **texto visível** do botão ("Errei · 1 dia"), que é
 * o mesmo nas duas telas de estudo; o nome acessível completo ("Errei, próxima
 * revisão em 1 dia") varia com a tela que o monta.
 */
async function conferirPreviasDeUmDia(page: Page): Promise<void> {
  for (const rotulo of Object.values(ROTULO_DA_AVALIACAO)) {
    await expect(
      page.getByText(`${rotulo} · 1 dia`, { exact: true }),
    ).toBeVisible();
  }
}

/**
 * Confere que o Resumo mostra a contagem de cada nível de Avaliação pedido
 * (FR-215, FR-216): o texto do Resumo precisa trazer o rótulo do nível seguido
 * da quantidade, separados por rótulo, contagem ou pontuação.
 */
async function conferirContagensPorNivel(
  page: Page,
  esperado: Partial<Record<"Errei" | "Difícil" | "Bom" | "Fácil", number>>,
): Promise<void> {
  const texto = await page.evaluate(() => document.body.innerText);

  for (const [nivel, quantidade] of Object.entries(esperado)) {
    expect(texto, `o Resumo mostra ${nivel} contando ${quantidade}`).toMatch(
      new RegExp(`${nivel}\\D{0,12}${quantidade}(?!\\d)`),
    );
  }
}

// --- Semeio da base de desempenho (SC-087) ----------------------------------

/** Quantidade de Cartões e de Sessões da base grande de SC-087. */
const CARTOES_DO_DESEMPENHO = 2_000;
const SESSOES_DO_DESEMPENHO = 500;
/** Quantas operações de semeio ficam em voo ao mesmo tempo. */
const LARGURA_DO_SEMEIO = 16;

/** Executa `tarefa` para cada item, com no máximo `largura` em voo, na ordem. */
async function emParalelo<T, R>(
  itens: readonly T[],
  largura: number,
  tarefa: (item: T) => Promise<R>,
): Promise<R[]> {
  const resultados: R[] = new Array(itens.length);
  let proximo = 0;

  const operarios = Array.from(
    { length: Math.min(largura, itens.length) },
    async () => {
      while (proximo < itens.length) {
        const indice = proximo;

        proximo += 1;

        resultados[indice] = await tarefa(itens[indice]);
      }
    },
  );

  await Promise.all(operarios);

  return resultados;
}

/**
 * Semeia pela API real a base de desempenho de SC-087: 2.000 Cartões, todos
 * novos, e 500 Sessões concluídas, cada uma avaliando um Cartão novo. Depois
 * dela, os Cartões das Sessões deixam de ser novos (FR-205, FR-206), e Início
 * tem números reais para somar além do bloco de revisão.
 */
async function semearAcervo(
  ambiente: Ambiente,
  credencial: CredencialDeProva,
): Promise<void> {
  const baralho = await criarBaralhoPelaApi(
    ambiente.enderecoDaApi,
    { nome: "Acervo semeado" },
    credencial,
  );

  const cartoes = await emParalelo(
    Array.from({ length: CARTOES_DO_DESEMPENHO }, (_, indice) => indice),
    LARGURA_DO_SEMEIO,
    async (indice) =>
      await criarCartaoPelaApi(
        ambiente.enderecoDaApi,
        {
          frente: `Frente semeada ${indice}`,
          verso: `Verso semeado ${indice}`,
        },
        credencial,
      ),
  );

  await emParalelo(
    Array.from({ length: SESSOES_DO_DESEMPENHO }, (_, indice) => indice),
    LARGURA_DO_SEMEIO,
    async (indice) => {
      const cartao = cartoes[indice];

      const status = await registrarSessaoPelaApi(
        ambiente.enderecoDaApi,
        {
          id: randomUUID(),
          origem: "baralho",
          baralhoId: baralho.id,
          nomeDoBaralho: baralho.nome,
          itens: [
            {
              frente: cartao.frente,
              verso: cartao.verso,
              cartaoId: cartao.id,
              avaliacao: "bom",
            },
          ],
        },
        credencial,
      );

      if (status !== 201) {
        throw new Error(`POST /sessoes respondeu ${status}`);
      }
    },
  );
}

// --- Cenário 2: o estudo livre também alimenta o Agendamento ----------------

test("Estudo livre por Baralho avalia com os quatro níveis e agenda o Cartão (FR-192, FR-193, FR-194, FR-205, FR-206, SC-080)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.livre",
    );
    const baralho = await prepararBaralho(ambiente, credencial, NOME_DO_BARALHO, [
      CARTOES[0],
    ]);

    const cartaoId = baralho.cartoes[0].id;

    // O Cartão é novo: a prévia de "Bom" é a do primeiro intervalo (FR-221).
    const previaAntes = await obterPreviaPelaApi(
      ambiente.enderecoDaApi,
      credencial,
      cartaoId,
    );

    await abrirEstudoDoBaralho(page, ambiente, baralho.id, credencial);
    await iniciarSessaoDeRevisao(page);

    await expect(
      page.getByRole("article", { name: "Item 1 de 1" }),
    ).toBeVisible();

    // Nenhum botão de Avaliação antes da Revelação (FR-193).
    await expect(
      page.getByRole("button", { name: /^(Errei|Difícil|Bom|Fácil)/ }),
    ).toHaveCount(0);

    // Após a Revelação, os quatro níveis aparecem com a prévia (FR-192, FR-221).
    await revelarVerso(page);
    await conferirPreviasDeUmDia(page);

    await avaliar(page, "bom");

    await expect(
      page.getByRole("heading", { level: 1, name: "Sessão concluída" }),
    ).toBeVisible();
    await conferirContagensPorNivel(page, { Bom: 1 });

    // O Registro precisa estar confirmado antes de sair da tela: com o envio
    // ainda pendente, a navegação abriria a confirmação "Sair sem registrar a
    // Sessão?" (FR-163, FR-164).
    await expect(
      page.getByRole("status", { name: "Situação do registro da Sessão" }),
    ).toContainText(/Sessão registrada no histórico/);

    // A Avaliação do estudo livre alimentou o Agendamento do Cartão: a próxima
    // revisão com "Bom" já parte do intervalo avançado (FR-205, FR-206, SC-080).
    const previaDepois = await obterPreviaPelaApi(
      ambiente.enderecoDaApi,
      credencial,
      cartaoId,
    );

    expect(Date.parse(previaDepois.bom)).toBeGreaterThan(
      Date.parse(previaAntes.bom),
    );
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

// --- Cenário 4: o atalho de teclado avalia o nível --------------------------

test("Atalho de teclado 3 avalia Bom após a Revelação (FR-192, FR-193, FR-218)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.atalho",
    );
    const baralho = await prepararBaralho(ambiente, credencial, NOME_DO_BARALHO, [
      CARTOES[0],
    ]);

    await abrirEstudoDoBaralho(page, ambiente, baralho.id, credencial);
    await iniciarSessaoDeRevisao(page);
    await expect(
      page.getByRole("article", { name: "Item 1 de 1" }),
    ).toBeVisible();

    // Antes da Revelação, o atalho não avalia nada (FR-193, FR-218).
    await page.keyboard.press("3");
    await expect(
      page.getByRole("article", { name: "Item 1 de 1" }),
    ).toBeVisible();

    await revelarVerso(page);
    await page.keyboard.press("3");

    // A Sessão conclui e o Resumo registra um "Bom" (FR-218).
    await expect(
      page.getByRole("heading", { level: 1, name: "Sessão concluída" }),
    ).toBeVisible();
    await conferirContagensPorNivel(page, { Bom: 1 });
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

// --- Cenário 5: desempenho de Início (SC-087) -------------------------------

test("SC-087: Início monta com leituras agregadas e em número fixo, com 2.000 Cartões e 500 Sessões", async ({ page, browserName }) => {
  test.setTimeout(300_000);

  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.desempenho",
    );
    await semearAcervo(ambiente, credencial);

    await page.goto(`${ambiente.enderecoDoFrontend}/#/inicio`);
    await entrarSeNecessario(page, credencial);

    // Aquecimento: o Vite dev compila a tela de Início na primeira abertura.
    await expect(
      page.getByRole("heading", { name: "Agenda de hoje" }),
    ).toBeVisible();

    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Cartões" })
      .click();
    await expect(page).toHaveURL(/#\/cartoes/);
    // Espera a contagem visível: garante que GET /cartoes e /baralhos
    // concluíram e não vazam para a prova do Início.
    await expect(page.getByText(/^\d+ resultados?$/)).toBeVisible();

    // SC-087, sem relógio: o orçamento de 1 s é consequência de o Início montar
    // com leituras pequenas e em número fixo. A prova é
    // estrutural — quais requisições "abrir Início" faz, e quantas — e por isso
    // não varia com a velocidade da máquina.
    const requisicoes: string[] = [];

    page.on("request", (requisicao) => {
      if (requisicao.url().startsWith(ambiente.enderecoDaApi)) {
        const url = new URL(requisicao.url());

        requisicoes.push(`${requisicao.method()} ${url.pathname}`);
      }
    });

    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Início" })
      .click();
    await expect(page.getByText(/Agenda de hoje|Nenhum estudo agendado/).first()).toBeVisible();

    // O Início lê um conjunto fixo de recursos agregados (Cartões para saber se
    // o acervo está vazio e a Agenda), e nenhum Cartão ou Sessão é
    // lido individualmente — a quantidade de leituras não cresce com o acervo.
    // O Vite dev em `StrictMode` repete cada leitura, por isso a prova compara
    // o conjunto de recursos, e não a contagem.
    expect(
      [...new Set(requisicoes)].sort(),
      `requisições do Início: ${requisicoes.join(", ")}`,
    ).toEqual(["GET /agenda", "GET /cartoes"]);
  } finally {
    await derrubarAmbiente(ambiente);
  }
});
