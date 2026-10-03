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
// API; as Sessões — livre e Revisão do dia — são percorridas no Chromium pela
// tela real, e os Agendamentos resultantes são observados no bloco de revisão
// de Início, que é a face visível do estado de Agendamento (FR-198, FR-199).
//
// Os cenários cobrem: (1) a Revisão do dia reúne os Cartões novos na ordem de
// criação e o Resumo conta por nível; (2) o estudo livre por Baralho também
// alimenta o Agendamento; (3) os números são isolados por Usuário; (4) o
// atalho de teclado avalia o nível; (5) o bloco de revisão de Início aparece
// em até 1 s com uma base grande (SC-087).

test.setTimeout(240_000);

const NOME_DO_BARALHO = "Inglês";
/** Um Baralho canônico: três Cartões, para uma Revisão do dia de três Itens. */
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

    api = iniciarApi(join(pasta, "repeticao.sqlite"), portaDaApi);

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

/** Os limites do dia local do próprio processo do teste (FR-204). */
function limitesDoDiaLocal(agora: Date): {
  inicioDoDia: string;
  fimDoDia: string;
} {
  const inicio = new Date(agora);

  inicio.setHours(0, 0, 0, 0);

  const fim = new Date(inicio);

  fim.setDate(fim.getDate() + 1);

  return { inicioDoDia: inicio.toISOString(), fimDoDia: fim.toISOString() };
}

interface ResumoDaRevisao {
  vencidos: number;
  novosHoje: number;
  total: number;
}

/** Lê o resumo da Revisão do dia direto da API real (FR-198, FR-199). */
async function obterResumoDaRevisaoPelaApi(
  enderecoDaApi: string,
  credencial: CredencialDeProva,
): Promise<ResumoDaRevisao> {
  const { inicioDoDia, fimDoDia } = limitesDoDiaLocal(new Date());

  const resposta = await fetch(
    `${enderecoDaApi}/revisao?inicioDoDia=${encodeURIComponent(inicioDoDia)}&fimDoDia=${encodeURIComponent(fimDoDia)}`,
    { headers: cabecalhoDeCredencial(credencial) },
  );

  if (!resposta.ok) {
    throw new Error(`GET /revisao respondeu ${resposta.status}`);
  }

  return (await resposta.json()) as ResumoDaRevisao;
}

interface DadosDeRegistroDeProva {
  id: string;
  origem: "baralho" | "revisao";
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

/** Inicia uma Sessão de estudo livre com a quantidade de Cartões pedida. */
async function iniciarSessaoLivre(page: Page, quantidade: number): Promise<void> {
  await page.getByLabel("Quantidade de Cartões").fill(String(quantidade));
  await page.getByRole("button", { name: "Iniciar Sessão" }).click();
}

/**
 * A Revisão do dia pode apresentar o lote já em andamento ou precedido do
 * botão de início; quando o botão aparece, é ele que começa a Sessão (FR-202).
 */
async function iniciarRevisaoSeHouverBotao(page: Page): Promise<void> {
  const botao = page.getByRole("button", { name: "Iniciar Sessão" });

  const apareceu = await botao
    .waitFor({ state: "visible", timeout: 1_500 })
    .then(() => true)
    .catch(() => false);

  if (apareceu) {
    await botao.click();
  }
}

/** Revela o Verso do Item em estudo (FR-192, FR-193). */
async function revelarVerso(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Revelar verso" }).click();
  await expect(page.getByRole("heading", { name: "Verso" })).toBeVisible();
}

/**
 * Avalia o Item em estudo no nível pedido, pelo botão correspondente. O nome
 * acessível do botão começa pelo rótulo do nível — "Bom, próxima revisão
 * amanhã" na Sessão livre —, de modo que o casamento é pelo prefixo do nível.
 */
async function avaliar(page: Page, avaliacao: Avaliacao): Promise<void> {
  await page
    .getByRole("button", {
      name: new RegExp(`^${ROTULO_DA_AVALIACAO[avaliacao]}\\b`),
    })
    .click();
}

/**
 * Num Cartão novo, as quatro Avaliações caem em amanhã (FR-221, SC-090). A
 * prévia é conferida pelo **texto visível** do botão ("Errei · amanhã"), que é
 * o mesmo nas duas telas de estudo; o nome acessível completo ("Errei, próxima
 * revisão amanhã") varia com a tela que o monta.
 */
async function conferirPreviasDeAmanha(page: Page): Promise<void> {
  for (const rotulo of Object.values(ROTULO_DA_AVALIACAO)) {
    await expect(
      page.getByText(`${rotulo} · amanhã`, { exact: true }),
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

/**
 * O bloco de vencidos de Início (FR-198, FR-202), com os três textos que a
 * tela usa: "Nada para revisar hoje" sem nada, "Nenhum Cartão vencido hoje"
 * quando só há novos e "N Cartões para revisar hoje" quando há vencidos.
 */
function blocoDeVencidos(page: Page) {
  return page.getByText(
    /Nada para revisar hoje|Nenhum Cartão vencido hoje|\d+ Cart(?:ão|ões) para revisar hoje/,
  );
}

/**
 * O aviso de Cartões novos de Início (FR-199), com o texto exato que a tela
 * usa: "Nenhum Cartão novo entra hoje", "1 Cartão novo entra hoje" ou
 * "N Cartões novos entram hoje".
 */
function avisoDeNovos(page: Page, quantidade: number) {
  if (quantidade === 0) {
    return page.getByText("Nenhum Cartão novo entra hoje", { exact: true });
  }

  if (quantidade === 1) {
    return page.getByText("1 Cartão novo entra hoje", { exact: true });
  }

  return page.getByText(`${quantidade} Cartões novos entram hoje`, {
    exact: true,
  });
}

/**
 * O controle "Revisar" de Início (FR-202): com algo a revisar é um link para
 * #/revisao; sem nada, um botão desabilitado, que não leva a lugar algum.
 */
function controleDeRevisar(page: Page) {
  return page
    .getByRole("link", { name: "Revisar", exact: true })
    .or(page.getByRole("button", { name: "Revisar", exact: true }));
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

// --- Cenário 1: a Revisão do dia reúne os Cartões novos ---------------------

test("Revisão do dia reúne os Cartões novos na ordem de criação e o Resumo conta por nível (FR-198, FR-199, FR-201, FR-202, FR-210, FR-215, FR-221, SC-080, SC-089)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.revisao",
    );
    await prepararBaralho(ambiente, credencial, NOME_DO_BARALHO, CARTOES);

    await page.goto(`${ambiente.enderecoDoFrontend}/#/inicio`);
    await entrarSeNecessario(page, credencial);

    // Três Cartões novos e nenhum vencido (FR-198, FR-199).
    await expect(blocoDeVencidos(page)).toBeVisible();
    await expect(avisoDeNovos(page, 3)).toBeVisible();

    expect(
      await obterResumoDaRevisaoPelaApi(ambiente.enderecoDaApi, credencial),
    ).toEqual({ vencidos: 0, novosHoje: 3, total: 3 });

    // "Revisar" lança a Revisão do dia com os novos na ordem de criação
    // (FR-201, FR-202, SC-089): com algo a revisar, é um link para #/revisao.
    await controleDeRevisar(page).click();
    // O texto vive no conteúdo principal; restringir ao `main` evita casar
    // também com a linha do Resumo que repete o nome da Sessão.
    await expect(
      page
        .getByRole("main")
        .getByText("Revisão do dia", { exact: false })
        .first(),
    ).toBeVisible();
    await iniciarRevisaoSeHouverBotao(page);
    await expect(page.getByText("Item 1 de 3")).toBeVisible();

    const conteudos = page.locator(".cartao-de-estudo .conteudo-do-cartao");
    const avaliacoesDaSessao: Avaliacao[] = ["errei", "bom", "facil"];

    for (let indice = 0; indice < CARTOES.length; indice += 1) {
      await expect(page.getByText(`Item ${indice + 1} de 3`)).toBeVisible();

      const frente = (await conteudos.first().textContent())?.trim();

      expect(frente, "a Revisão do dia segue a ordem de criação").toBe(
        CARTOES[indice].frente,
      );

      await revelarVerso(page);
      await conferirPreviasDeAmanha(page);
      await avaliar(page, avaliacoesDaSessao[indice]);
    }

    // O Resumo nomeia "Revisão do dia" e conta por nível (FR-215, FR-216).
    await expect(
      page.getByRole("heading", { level: 1, name: "Resumo da Sessão" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("main")
        .getByText("Revisão do dia", { exact: false })
        .first(),
    ).toBeVisible();
    await expect(page.getByText("67%", { exact: true })).toBeVisible();
    await expect(page.getByText("2 de 3 Itens")).toBeVisible();
    await conferirContagensPorNivel(page, { Errei: 1, Bom: 1, Fácil: 1 });
    await expect(
      page.getByText("Sessão registrada no seu histórico."),
    ).toBeVisible();

    // De volta a Início, os Cartões estudados deixaram de ser novos
    // (FR-205, FR-206, SC-080).
    await page
      .getByRole("link", { name: "Voltar a Início", exact: true })
      .or(page.getByRole("button", { name: "Voltar a Início", exact: true }))
      .click();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: `Olá, ${credencial.nomeDeUsuario}`,
      }),
    ).toBeVisible();
    await expect(blocoDeVencidos(page)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Nada para revisar hoje" }),
    ).toBeVisible();
    await expect(controleDeRevisar(page)).toBeDisabled();

    expect(
      await obterResumoDaRevisaoPelaApi(ambiente.enderecoDaApi, credencial),
    ).toEqual({ vencidos: 0, novosHoje: 0, total: 0 });
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

// --- Cenário 2: o estudo livre também alimenta o Agendamento ----------------

test("Estudo livre por Baralho avalia com os quatro níveis e consome os novos do dia (FR-192, FR-193, FR-194, FR-205, FR-206, SC-080)", async ({ page, browserName }) => {
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

    await page.goto(`${ambiente.enderecoDoFrontend}/#/inicio`);
    await entrarSeNecessario(page, credencial);

    // O único Cartão do Usuário é novo (FR-199).
    await expect(avisoDeNovos(page, 1)).toBeVisible();

    await abrirEstudoDoBaralho(page, ambiente, baralho.id, credencial);
    await iniciarSessaoLivre(page, 1);

    await expect(page.getByText("Item 1 de 1")).toBeVisible();

    // Nenhum botão de Avaliação antes da Revelação (FR-193).
    await expect(
      page.getByRole("button", { name: /^(Errei|Difícil|Bom|Fácil)/ }),
    ).toHaveCount(0);

    // Após a Revelação, os quatro níveis aparecem com a prévia (FR-192, FR-221).
    await revelarVerso(page);
    await conferirPreviasDeAmanha(page);

    await avaliar(page, "bom");

    await expect(
      page.getByRole("heading", { level: 1, name: "Resumo da Sessão" }),
    ).toBeVisible();
    await conferirContagensPorNivel(page, { Bom: 1 });

    // O Registro precisa estar confirmado antes de sair da tela: com o envio
    // ainda pendente, a navegação abriria a confirmação "Sair sem registrar a
    // Sessão?" (FR-163, FR-164).
    await expect(
      page.getByText("Sessão registrada no seu histórico."),
    ).toBeVisible();

    // A Avaliação do estudo livre alimentou o Agendamento do Cartão, que deixou
    // de ser novo hoje (FR-205, FR-206, SC-080).
    await irParaInicio(page, credencial.nomeDeUsuario);
    await expect(
      page.getByRole("heading", { name: "Nada para revisar hoje" }),
    ).toBeVisible();
    await expect(controleDeRevisar(page)).toBeDisabled();

    expect(
      await obterResumoDaRevisaoPelaApi(ambiente.enderecoDaApi, credencial),
    ).toEqual({ vencidos: 0, novosHoje: 0, total: 0 });
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

// --- Cenário 3: os números são isolados por Usuário -------------------------

test("Agendamentos, vencidos e novos são isolados por Usuário (FR-219, SC-086)", async ({ browser, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();
  const contextoA = await browser.newContext();
  const contextoB = await browser.newContext();

  try {
    const paginaA = await contextoA.newPage();
    const paginaB = await contextoB.newPage();

    // Usuário A tem três Cartões novos.
    const credencialA = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.a",
    );
    await prepararBaralho(ambiente, credencialA, NOME_DO_BARALHO, CARTOES);

    await paginaA.goto(`${ambiente.enderecoDoFrontend}/#/inicio`);
    await entrarSeNecessario(paginaA, credencialA);
    await expect(avisoDeNovos(paginaA, 3)).toBeVisible();

    // Usuário B, noutro contexto, não vê nada de A (FR-219, SC-086).
    const credencialB = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.b",
    );

    await paginaB.goto(`${ambiente.enderecoDoFrontend}/#/inicio`);
    await entrarSeNecessario(paginaB, credencialB);
    await expect(
      paginaB.getByRole("heading", {
        level: 1,
        name: `Olá, ${credencialB.nomeDeUsuario}`,
      }),
    ).toBeVisible();
    await expect(
      paginaB.getByText("Nada para revisar hoje"),
    ).toBeVisible();

    expect(
      await obterResumoDaRevisaoPelaApi(ambiente.enderecoDaApi, credencialB),
    ).toEqual({ vencidos: 0, novosHoje: 0, total: 0 });

    // A conclui a Revisão do dia inteira. Com três Cartões novos, "Revisar" é
    // um link para a Revisão (FR-202).
    await controleDeRevisar(paginaA).click();
    await iniciarRevisaoSeHouverBotao(paginaA);

    for (let indice = 0; indice < CARTOES.length; indice += 1) {
      await revelarVerso(paginaA);
      await avaliar(paginaA, "bom");
    }

    // Espera o Registro ser confirmado antes de sair da tela do Resumo; com o
    // envio pendente, "Voltar a Início" abriria "Sair sem registrar a Sessão?"
    // (FR-163, FR-164).
    await expect(
      paginaA.getByText("Sessão registrada no seu histórico."),
    ).toBeVisible();

    await irParaInicio(paginaA, credencialA.nomeDeUsuario);
    await expect(
      paginaA.getByRole("heading", { name: "Nada para revisar hoje" }),
    ).toBeVisible();
    await expect(controleDeRevisar(paginaA)).toBeDisabled();

    // B continua exatamente como estava.
    await irParaInicio(paginaB, credencialB.nomeDeUsuario);
    await expect(paginaB.getByText("Nada para revisar hoje")).toBeVisible();

    expect(
      await obterResumoDaRevisaoPelaApi(ambiente.enderecoDaApi, credencialB),
    ).toEqual({ vencidos: 0, novosHoje: 0, total: 0 });
  } finally {
    await contextoA.close();
    await contextoB.close();
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
    await iniciarSessaoLivre(page, 1);
    await expect(page.getByText("Item 1 de 1")).toBeVisible();

    // Antes da Revelação, o atalho não avalia nada (FR-193, FR-218).
    await page.keyboard.press("3");
    await expect(page.getByText("Item 1 de 1")).toBeVisible();

    await revelarVerso(page);
    await page.keyboard.press("3");

    // A Sessão conclui e o Resumo registra um "Bom" (FR-218).
    await expect(
      page.getByRole("heading", { level: 1, name: "Resumo da Sessão" }),
    ).toBeVisible();
    await conferirContagensPorNivel(page, { Bom: 1 });
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

// --- Cenário 5: desempenho do bloco de revisão de Início (SC-087) -----------

test("SC-087: Início mostra o bloco de revisão em até 1 s com 2.000 Cartões e 500 Sessões", async ({ page, browserName }) => {
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
    await expect(page.getByText(/para revisar hoje/i)).toBeVisible();

    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Cartões" })
      .click();
    await expect(page).toHaveURL(/#\/cartoes/);

    // A medida é de "abrir Início": do clique no link até o bloco de revisão
    // ficar visível na tela real (SC-087).
    const inicio = Date.now();

    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Início" })
      .click();
    await expect(page.getByText(/para revisar hoje/i)).toBeVisible();

    const decorrido = Date.now() - inicio;

    expect(
      decorrido,
      "SC-087: o bloco de revisão de Início deve ficar visível em até 1 s",
    ).toBeLessThanOrEqual(1_000);
  } finally {
    await derrubarAmbiente(ambiente);
  }
});
