import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

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
import type { ProcessoIniciado } from "./servidores-locais";

// prova E2E real das ações do Baralho
// (FR-145, SC-078; specs/012-interface-visual-navegavel/tasks.md).
//
// Nenhuma rede é interceptada e nenhum dado é fabricado: a API real
// (node + SQLite em arquivo) e o frontend real (Vite dev) são iniciados como
// processos filhos do próprio teste, em portas livres e com um arquivo SQLite
// temporário exclusivo. Três Baralhos — sem Cartões, com um Cartão e com
// quarenta Cartões — são preparados direto pela API, e a tela real de detalhe
// do Baralho é percorrida no Chromium.
//
// SC-078 pede que as quatro ações do Baralho (Estudar, Adicionar, Renomear e
// Excluir) caibam no primeiro viewport, venham antes da lista de Cartões e
// sejam alcançadas por teclado antes de qualquer remoção de Vínculo. É o que
// esta prova confere, nas quatro larguras exigidas e nos três Baralhos.
//
// O teste aguarda a prontidão de cada processo antes de usá-lo e encerra ambos
// no `finally`, inclusive quando a prova falha no meio.

/** As larguras exigidas por SC-078; a altura é a mesma em todas. */
const LARGURAS = [360, 390, 768, 1440];

const ALTURA = 800;

/** As quatro ações do Baralho, na ordem em que a tela precisa apresentá-las. */
const ACOES = [
  "Estudar este Baralho",
  "Adicionar cartões existentes",
  "Renomear",
  "Excluir Baralho",
];

/** Quantidade de Cartões do Baralho cheio (SC-078). */
const CARTOES_NO_BARALHO_CHEIO = 40;

test.setTimeout(120_000);

for (const largura of LARGURAS) {
  test.describe(`ações do Baralho a ${largura}×${ALTURA}`, () => {
    test.use({ viewport: { width: largura, height: ALTURA } });

    test("Ações do Baralho no primeiro viewport e antes dos Cartões (FR-145, SC-078)", async ({
      page,
    }) => {
      await comAmbiente(async ({ enderecoDoFrontend, acervo }) => {
        // A primeira navegação carrega o documento e a tela "Entrar"; depois
        // de Entrar, a Credencial vive na memória da página, e toda troca de
        // tela acontece por mudança de fragmento — nunca por `page.goto`.
        await page.goto(`${enderecoDoFrontend}/#/inicio`);
        await entrarSeNecessario(page);

        const cenarios = [
          { baralho: acervo.vazio, removersEsperados: 0 },
          { baralho: acervo.unitario, removersEsperados: 1 },
          {
            baralho: acervo.cheio,
            removersEsperados: CARTOES_NO_BARALHO_CHEIO,
          },
        ];

        for (const cenario of cenarios) {
          await abrirDetalheDoBaralho(page, cenario.baralho);

          await conferirAcoesNoPrimeiroViewport(page);
          await conferirOrdemNoDocumento(page, cenario.removersEsperados);
        }

        // O Tab só é exercido na largura mais estreita, sobre o Baralho cheio:
        // é o cenário em que a lista de Cartões mais ameaça a ordem das ações.
        if (largura === 360) {
          await abrirDetalheDoBaralho(page, acervo.cheio);

          await conferirOrdemDeFoco(page);
        }
      });
    });
  });
}

interface BaralhoDeProva {
  id: string;
  nome: string;
}

interface Acervo {
  vazio: BaralhoDeProva;
  unitario: BaralhoDeProva;
  cheio: BaralhoDeProva;
}

interface Ambiente {
  enderecoDoFrontend: string;
  acervo: Acervo;
}

/**
 * Sobe a API real e o frontend real, cadastra o Usuário de prova e prepara o
 * acervo, entrega o ambiente à prova e encerra tudo no `finally` — inclusive
 * removendo a pasta e o arquivo SQLite temporários.
 */
async function comAmbiente(
  prova: (ambiente: Ambiente) => Promise<void>,
): Promise<void> {
  const pasta = await criarPastaTemporaria("acoes-do-baralho-");
  const caminhoDoBanco = join(pasta, "acoes.sqlite");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    const portaDaApi = await portaLivre();

    api = iniciarApi(caminhoDoBanco, portaDaApi);

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

    // O Usuário de prova é cadastrado antes do acervo: os três Baralhos e os
    // quarenta e um Cartões são dele (FR-090, FR-092).
    await criarUsuarioDeProva(enderecoDaApi);

    const acervo = await prepararAcervo(enderecoDaApi);

    await prova({ enderecoDoFrontend, acervo });
  } finally {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
}

/**
 * Prepara os três Baralhos de SC-078 — sem Cartões, com um Cartão e com
 * quarenta Cartões — direto pela API, sem passar pela UI.
 */
async function prepararAcervo(enderecoDaApi: string): Promise<Acervo> {
  const vazio = await criarBaralhoPelaApi(enderecoDaApi, {
    nome: "Baralho sem Cartões",
  });
  const unitario = await criarBaralhoPelaApi(enderecoDaApi, {
    nome: "Baralho de um Cartão",
  });
  const cheio = await criarBaralhoPelaApi(enderecoDaApi, {
    nome: "Baralho de quarenta Cartões",
  });

  const unico = await criarCartaoPelaApi(enderecoDaApi, {
    frente: "Frente única",
    verso: "Verso único",
  });

  await vincularCartaoPelaApi(enderecoDaApi, unico.id, unitario.id);

  for (let indice = 1; indice <= CARTOES_NO_BARALHO_CHEIO; indice += 1) {
    const cartao = await criarCartaoPelaApi(enderecoDaApi, {
      frente: `Frente ${indice}`,
      verso: `Verso ${indice}`,
    });

    await vincularCartaoPelaApi(enderecoDaApi, cartao.id, cheio.id);
  }

  return { vazio, unitario, cheio };
}

/**
 * Abre a página de detalhe do Baralho sem recarregar o documento: a Credencial
 * vive na memória da página, então a navegação é só a mudança do fragmento.
 *
 * Espera o título com o nome do Baralho: é a prova de que a leitura terminou e
 * de que o que está exibido já é o Baralho novo — durante o carregamento a tela
 * mantém o Baralho anterior.
 */
async function abrirDetalheDoBaralho(
  page: Page,
  baralho: BaralhoDeProva,
): Promise<void> {
  await page.evaluate((identificador) => {
    window.location.hash = `#/baralhos/${identificador}`;
  }, baralho.id);

  await expect(
    page.getByRole("heading", { level: 1, name: baralho.nome }),
  ).toBeVisible();
}

/**
 * A ação do Baralho pelo texto: pode ser um link (Adicionar, Renomear,
 * Estudar), o botão desabilitado de Estudar (Baralho sem Cartões) ou o botão de
 * Excluir. O filtro sobre `main a, main button` cobre os quatro casos.
 */
function localizarAcao(page: Page, nome: string): Locator {
  return page.locator("main a, main button").filter({ hasText: nome });
}

/**
 * FR-145: as quatro ações precisam estar inteiras no primeiro viewport, sem
 * nenhuma rolagem — é o que a página apresenta assim que abre.
 */
async function conferirAcoesNoPrimeiroViewport(page: Page): Promise<void> {
  const alturaDoViewport = page.viewportSize()?.height ?? 0;

  expect(alturaDoViewport, "o viewport precisa ter altura").toBeGreaterThan(0);

  const rolagemVertical = await page.evaluate(() => window.scrollY);

  expect(
    rolagemVertical,
    "as ações precisam estar no primeiro viewport, sem rolagem prévia",
  ).toBe(0);

  for (const nome of ACOES) {
    const acao = localizarAcao(page, nome);

    await expect(
      acao,
      `a ação "${nome}" precisa existir uma única vez`,
    ).toHaveCount(1);
    await expect(acao, `a ação "${nome}" precisa estar visível`).toBeVisible();

    const caixa = await acao.boundingBox();

    expect(caixa, `a ação "${nome}" precisa ter caixa`).not.toBeNull();

    if (caixa === null) {
      continue;
    }

    expect(
      caixa.y,
      `a ação "${nome}" não pode começar acima do primeiro viewport`,
    ).toBeGreaterThanOrEqual(0);

    expect(
      caixa.y + caixa.height,
      `a ação "${nome}" precisa terminar dentro do primeiro viewport (${alturaDoViewport}px)`,
    ).toBeLessThanOrEqual(alturaDoViewport);
  }
}

interface OrdemNoDocumento {
  faltando: string[];
  violacoes: string[];
  cabecalhoEncontrado: boolean;
  quantidadeDeRemover: number;
}

/**
 * FR-145, SC-078: no documento, as quatro ações vêm antes do título "Cartões
 * do Baralho" e antes de todo botão que remove um Vínculo — ou seja, antes da
 * lista de Cartões. A contagem esperada de botões de remover evita que a
 * conferência passe vazia.
 */
async function conferirOrdemNoDocumento(
  page: Page,
  removersEsperados: number,
): Promise<void> {
  const resultado = await page.evaluate((): OrdemNoDocumento => {
    const nomes = [
      "Estudar este Baralho",
      "Adicionar cartões existentes",
      "Renomear",
      "Excluir Baralho",
    ];

    const clicaveis = Array.from(
      document.querySelectorAll("main a, main button"),
    );

    const texto = (elemento: Element): string =>
      (elemento.textContent ?? "").trim();

    const controles = new Map<string, Element>();

    for (const nome of nomes) {
      const encontrado = clicaveis.find(
        (elemento) => texto(elemento) === nome,
      );

      if (encontrado !== undefined) {
        controles.set(nome, encontrado);
      }
    }

    const cabecalho =
      document.querySelector('main section[aria-label="Cartões do Baralho"]') ??
      undefined;

    const remover = clicaveis.filter((elemento) => {
      const rotulo = elemento.getAttribute("aria-label") ?? "";

      return (
        rotulo.startsWith("Remover ") && rotulo.endsWith(" deste baralho")
      );
    });

    const alvos: { descricao: string; elemento: Element }[] = [];

    if (cabecalho !== undefined) {
      alvos.push({
        descricao: 'a seção "Cartões do Baralho"',
        elemento: cabecalho,
      });
    }

    remover.forEach((elemento, indice) => {
      alvos.push({
        descricao: `o botão de remover #${indice + 1} (“${elemento.getAttribute("aria-label")}”)`,
        elemento,
      });
    });

    const faltando: string[] = [];
    const violacoes: string[] = [];

    for (const nome of nomes) {
      const controle = controles.get(nome);

      if (controle === undefined) {
        faltando.push(nome);
        continue;
      }

      for (const alvo of alvos) {
        const posicao = controle.compareDocumentPosition(alvo.elemento);

        if ((posicao & Node.DOCUMENT_POSITION_FOLLOWING) === 0) {
          violacoes.push(`“${nome}” não precede ${alvo.descricao}`);
        }
      }
    }

    return {
      faltando,
      violacoes,
      cabecalhoEncontrado: cabecalho !== undefined,
      quantidadeDeRemover: remover.length,
    };
  });

  expect(
    resultado.cabecalhoEncontrado,
    'a seção "Cartões do Baralho" precisa existir',
  ).toBe(true);

  expect(resultado.faltando, "as quatro ações precisam existir").toEqual([]);

  expect(
    resultado.quantidadeDeRemover,
    "a quantidade de botões de remover precisa ser a dos Cartões vinculados",
  ).toBe(removersEsperados);

  expect(
    resultado.violacoes,
    "cada ação precisa vir antes do título dos Cartões e de todo remover",
  ).toEqual([]);
}

interface Foco {
  nome: string;
  ehRemover: boolean;
}

/**
 * FR-145, SC-078: a ordem de foco acompanha a ordem visual — partindo do
 * título da página, o Tab alcança Estudar, Adicionar, Renomear e Excluir antes
 * de qualquer botão que remove um Vínculo.
 */
async function conferirOrdemDeFoco(page: Page): Promise<void> {
  await focarTituloDaPagina(page);

  const focoNoTitulo = await page.evaluate(
    () => document.activeElement?.tagName.toLowerCase() === "h1",
  );

  expect(
    focoNoTitulo,
    "o foco precisa partir do título da página",
  ).toBe(true);

  let alcancadas = 0;
  let encontrouRemover = false;

  for (let passo = 0; passo < 100; passo += 1) {
    if (alcancadas === ACOES.length) {
      break;
    }

    await page.keyboard.press("Tab");

    const foco = await descreverFoco(page);

    if (foco.ehRemover) {
      encontrouRemover = true;
      break;
    }

    if (foco.nome === ACOES[alcancadas]) {
      alcancadas += 1;
    }
  }

  expect(
    encontrouRemover,
    'nenhum botão "Remover … deste baralho" pode vir antes das quatro ações',
  ).toBe(false);

  expect(
    alcancadas,
    "o Tab precisa alcançar as quatro ações, nesta ordem",
  ).toBe(ACOES.length);
}

/**
 * Põe o foco no título da página. Se a tela ainda não tornar o `h1` focável
 * por programa, um `tabindex="-1"` local o torna: fora da ordem de Tab, o que
 * não altera o que a prova mede.
 */
async function focarTituloDaPagina(page: Page): Promise<void> {
  await page.locator("main h1").evaluate((elemento) => {
    if (!elemento.hasAttribute("tabindex")) {
      elemento.setAttribute("tabindex", "-1");
    }

    (elemento as HTMLElement).focus();
  });
}

/** Descreve o elemento com foco: o nome acessível e se é um botão de remover. */
async function descreverFoco(page: Page): Promise<Foco> {
  return await page.evaluate((): Foco => {
    const ativo = document.activeElement;

    if (!(ativo instanceof HTMLElement)) {
      return { nome: "", ehRemover: false };
    }

    const nome = (
      ativo.getAttribute("aria-label") ??
      ativo.textContent ??
      ""
    ).trim();

    return {
      nome,
      ehRemover:
        nome.startsWith("Remover ") && nome.endsWith(" deste baralho"),
    };
  });
}
