import { join } from "node:path";

import { expect, test } from "@playwright/test";

import {
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

// T1122 — prova E2E real da lista de Baralhos em linha fina (spec 012;
// FR-144 revisado, SC-079).
//
// Nenhuma rede é interceptada e nenhum dado é fabricado: a API real
// (node + SQLite em arquivo) e o frontend real (Vite dev) são iniciados como
// processos filhos do próprio teste, em portas livres e com um arquivo SQLite
// temporário exclusivo. Os dez Baralhos do acervo — um com nome de quarenta
// caracteres, um sem Cartões e os demais com um a três Cartões — são criados
// direto pela API; a lista inteira é medida na tela real do Chromium, em
// quatro larguras (360, 390, 768 e 1440), porque a linha fina e os alvos de
// toque precisam valer tanto no telefone estreito quanto no desktop largo
// (FR-144, SC-079).
//
// Depois de Entrar a navegação é pelo fragmento (`window.location.hash`),
// nunca por `page.goto`: um `goto` recarregaria o documento e descartaria a
// Credencial mantida apenas na memória (FR-089, SC-031).

/** O nome no limite do comprimento aceito: exatamente quarenta caracteres. */
const NOME_LONGO = "Baralho com o nome bem comprido possível";

/** O Baralho sem Cartões: é ele que prova o "Estudar" desabilitado. */
const NOME_SEM_CARTOES = "Alemão";

// Os dez Baralhos do acervo e a quantidade de Cartões de cada um. Um deles
// (NOME_SEM_CARTOES) fica sem nenhum Cartão, de propósito; os demais recebem
// de um a três, para que as duas formas do controle "Estudar" apareçam.
const BARALHOS = [
  { nome: "Inglês", cartoes: 3 },
  { nome: "Espanhol", cartoes: 2 },
  { nome: "Francês", cartoes: 1 },
  { nome: "Italiano", cartoes: 2 },
  { nome: NOME_SEM_CARTOES, cartoes: 0 },
  { nome: "Japonês", cartoes: 1 },
  { nome: "Mandarim", cartoes: 3 },
  { nome: "Russo", cartoes: 2 },
  { nome: NOME_LONGO, cartoes: 1 },
  { nome: "Coreano", cartoes: 3 },
] as const;

const QUANTIDADE_DE_BARALHOS = BARALHOS.length;

/** As quatro larguras exigidas, todas com a mesma altura de telefone. */
const LARGURAS = [360, 390, 768, 1440] as const;

const ALTURA_DA_VIEWPORT = 844;

/** Cada linha da lista é fina: no máximo 72px de altura (FR-144). */
const ALTURA_MAXIMA_DA_LINHA = 72;

/** Cada controle da linha é um alvo de toque: no mínimo 44px (FR-144). */
const ALTURA_MINIMA_DO_ALVO = 44;

/** Cada linha traz exatamente dois controles: "Estudar" e "Editar" (spec 021, FR-340). */
const CONTROLES_POR_LINHA = 2;

/** O bloco do nome fica a no máximo 4px do centro vertical da linha (FR-144). */
const TOLERANCIA_DE_CENTRALIZACAO = 4;

/**
 * Na primeira tela do telefone, ao menos cinco linhas inteiras (SC-079);
 * o cabeçalho ganhou «Criar baralho temporário» (023, FR-360), cuja ação
 * pode quebrar linha em telas estreitas mantendo o texto completo.
 */
const LINHAS_NA_PRIMEIRA_TELA = 5;

test.setTimeout(180_000);

for (const largura of LARGURAS) {
  test(`Lista de Baralhos em ${largura}×${ALTURA_DA_VIEWPORT} tem uma linha fina por Baralho, alvos de 44px e nenhuma rolagem horizontal (FR-144, SC-079)`, async ({ page, browserName }) => {
    // Navegador real: Chromium, sem DOM simulado.
    expect(browserName).toBe("chromium");

    // O nome mais longo do acervo está no limite de quarenta caracteres.
    expect(NOME_LONGO).toHaveLength(40);

    await page.setViewportSize({ width: largura, height: ALTURA_DA_VIEWPORT });

    const pasta = await criarPastaTemporaria("lista-de-baralhos-");
    const caminhoDoBanco = join(pasta, "lista-de-baralhos.sqlite");

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

      // O Usuário de prova é cadastrado antes do acervo: os Baralhos e os
      // Cartões desta prova são dele (FR-090, FR-092).
      await criarUsuarioDeProva(enderecoDaApi);
      await semearBaralhos(enderecoDaApi);

      await page.goto(enderecoDoFrontend);
      await entrarSeNecessario(page);

      // Depois de Entrar, a navegação é pelo fragmento (spec 013): `page.goto`
      // recarregaria o documento e perderia a Credencial.
      await page.evaluate(() => {
        window.location.hash = "#/baralhos";
      });

      await expect(
        page.getByRole("heading", { level: 1, name: "Baralhos", exact: true }),
      ).toBeVisible();

      // A lista dos Baralhos é a única que contém o nome mais longo: é ela que
      // a prova mede, e não outra lista qualquer do documento.
      const linhas = page
        .getByRole("list")
        .filter({
          has: page.getByText(NOME_LONGO, { exact: true }),
        })
        .getByRole("listitem");

      await expect(linhas).toHaveCount(QUANTIDADE_DE_BARALHOS);

      // Cada linha é fina: as de nome em uma única linha medem no máximo
      // 72px. A exceção é a do nome de quarenta caracteres, que pode quebrar
      // em quantas linhas a fonte do sistema exigir e, por isso, não tem teto
      // de altura — ela é avaliada adiante por não truncar o nome e por não
      // provocar rolagem horizontal (FR-144, SC-079).
      const alturasDasLinhas = await linhas.evaluateAll((elementos) =>
        elementos.map((elemento) => elemento.getBoundingClientRect().height),
      );

      expect(alturasDasLinhas).toHaveLength(QUANTIDADE_DE_BARALHOS);

      // A linha do nome longo é localizada pelo próprio nome, e não pela
      // posição na lista, para que a exceção valha em qualquer ordem.
      const indiceDoNomeLongo = await linhas.evaluateAll(
        (elementos, nomeLongo) =>
          elementos.findIndex(
            (elemento) =>
              elemento
                .querySelector(".linha-da-lista__titulo")
                ?.textContent?.trim() === nomeLongo,
          ),
        NOME_LONGO,
      );

      expect(indiceDoNomeLongo).toBeGreaterThanOrEqual(0);

      // Todas as linhas são finas: no máximo 72px (FR-144). A do nome longo é
      // a única exceção: o número de linhas em que o nome quebra depende da
      // fonte de cada sistema (duas no macOS, três no runner Linux do CI), por
      // isso a spec 012 corrigida (SC-079) não limita a altura dessa linha.
      // Em vez de um teto de altura, ela é avaliada adiante por não truncar o
      // nome e por não provocar rolagem horizontal.
      for (let indice = 0; indice < alturasDasLinhas.length; indice += 1) {
        if (indice === indiceDoNomeLongo) {
          continue;
        }

        expect(alturasDasLinhas[indice]).toBeLessThanOrEqual(
          ALTURA_MAXIMA_DA_LINHA,
        );
      }

      // O nome de quarenta caracteres aparece inteiro, sem truncamento por
      // reticências (FR-144, SC-079).
      const tituloDoNomeLongo = page.locator(".linha-da-lista__titulo", {
        hasText: NOME_LONGO,
      });

      // Spec 021, FR-341: o nome é texto somente leitura, nunca link.
      await expect(tituloDoNomeLongo).toHaveText(NOME_LONGO);
      await expect(
        page.getByRole("link", { name: NOME_LONGO, exact: true }),
      ).toHaveCount(0);

      const textOverflowDoNomeLongo = await tituloDoNomeLongo.evaluate(
        (elemento) => getComputedStyle(elemento).textOverflow,
      );

      expect(textOverflowDoNomeLongo).not.toBe("ellipsis");

      // O nome de quarenta caracteres cabe inteiro no próprio título: a largura
      // do conteúdo não ultrapassa a largura visível, sem corte (SC-079).
      const medidaDoNomeLongo = await tituloDoNomeLongo.evaluate((elemento) => ({
        conteudo: elemento.scrollWidth,
        visivel: elemento.clientWidth,
      }));

      expect(medidaDoNomeLongo.conteudo).toBeLessThanOrEqual(
        medidaDoNomeLongo.visivel,
      );

      // Mesmo quebrando em quantas linhas a fonte do sistema exigir, a linha
      // do nome longo não cria rolagem horizontal (FR-144, SC-079).
      const medidaDaLinhaDoNomeLongo = await linhas
        .nth(indiceDoNomeLongo)
        .evaluate((elemento) => ({
          conteudo: elemento.scrollWidth,
          visivel: elemento.clientWidth,
        }));

      expect(medidaDaLinhaDoNomeLongo.conteudo).toBeLessThanOrEqual(
        medidaDaLinhaDoNomeLongo.visivel,
      );

      // Cada linha traz exatamente dois controles — "Estudar" e "Editar" —, e
      // ambos são alvos de toque de no mínimo 44px (spec 021: FR-340, FR-346).
      for (let indice = 0; indice < QUANTIDADE_DE_BARALHOS; indice += 1) {
        const linha = linhas.nth(indice);
        const controles = linha.locator("a, button");

        await expect(controles).toHaveCount(CONTROLES_POR_LINHA);

        const alturasDosControles = await controles.evaluateAll((elementos) =>
          elementos.map((elemento) => elemento.getBoundingClientRect().height),
        );

        for (const altura of alturasDosControles) {
          expect(altura).toBeGreaterThanOrEqual(ALTURA_MINIMA_DO_ALVO);
        }

        // O bloco do texto — o nome e a contagem, juntos — fica verticalmente
        // centrado na linha: o centro do bloco está a no máximo 4px do centro
        // da linha (FR-144, FR-339). Se o bloco não existir, o desvio infinito
        // reprova a asserção.
        const desvioDoNome = await linha.evaluate((elemento) => {
          const nome = elemento.querySelector(".linha-da-lista__texto");

          if (nome === null) {
            return Number.POSITIVE_INFINITY;
          }

          const caixaDaLinha = elemento.getBoundingClientRect();
          const caixaDoNome = nome.getBoundingClientRect();

          const centroDaLinha = caixaDaLinha.top + caixaDaLinha.height / 2;
          const centroDoNome = caixaDoNome.top + caixaDoNome.height / 2;

          return Math.abs(centroDoNome - centroDaLinha);
        });

        expect(desvioDoNome).toBeLessThanOrEqual(TOLERANCIA_DE_CENTRALIZACAO);
      }

      // Nenhuma rolagem horizontal na largura testada (FR-144, SC-079).
      const medidas = await page.evaluate(() => ({
        conteudo: document.documentElement.scrollWidth,
        visivel: document.documentElement.clientWidth,
      }));

      expect(medidas.conteudo).toBeLessThanOrEqual(medidas.visivel);

      // No telefone estreito, ao menos seis linhas cabem inteiras na primeira
      // tela — é o que a linha fina compra (SC-079).
      if (largura === 390) {
        await page.evaluate(() => window.scrollTo(0, 0));

        const faixas = await linhas.evaluateAll((elementos) =>
          elementos.map((elemento) => {
            const caixa = elemento.getBoundingClientRect();

            return { topo: caixa.top, base: caixa.bottom };
          }),
        );

        const inteiras = faixas.filter(
          (faixa) => faixa.topo >= 0 && faixa.base <= ALTURA_DA_VIEWPORT,
        );

        expect(inteiras.length).toBeGreaterThanOrEqual(LINHAS_NA_PRIMEIRA_TELA);
      }

      // O Baralho sem Cartões continua na lista, com o nome em texto e Editar
      // disponível, mas o "Estudar" é um botão desabilitado, e o motivo é a
      // descrição acessível (spec 021: FR-341, FR-343).
      await expect(
        page.getByText(NOME_SEM_CARTOES, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", {
          name: `Editar ${NOME_SEM_CARTOES}`,
          exact: true,
        }),
      ).toBeVisible();

      const estudarSemCartoes = page.getByRole("button", {
        name: `Estudar ${NOME_SEM_CARTOES}`,
        exact: true,
      });

      await expect(estudarSemCartoes).toBeDisabled();
      await expect(estudarSemCartoes).toHaveAccessibleDescription(
        /Sem Cartões para estudar\./,
      );

      // Um Baralho com Cartões, ao contrário, oferece "Estudar" como link.
      await expect(
        page.getByRole("link", { name: `Estudar ${NOME_LONGO}`, exact: true }),
      ).toBeVisible();

      // "Editar" é o caminho para o detalhe — o mesmo destino que o antigo
      // link do nome alcançava —, cujo título é o próprio nome (spec 021,
      // FR-342).
      await page
        .getByRole("link", { name: `Editar ${NOME_LONGO}`, exact: true })
        .click();

      await expect(
        page.getByRole("heading", { level: 1, name: NOME_LONGO, exact: true }),
      ).toBeVisible();
    } finally {
      // Encerrar sempre, mesmo quando a prova falha no meio, e remover o
      // arquivo e a pasta temporários.
      await encerrarProcesso(frontend);
      await encerrarProcesso(api);
      await removerPastaTemporaria(pasta);
    }
  });
}

/**
 * Cria os dez Baralhos do acervo direto pela API, cada um com a quantidade de
 * Cartões definida em `BARALHOS`. O Baralho sem Cartões fica sem nenhum, de
 * propósito: é ele que prova o "Estudar" desabilitado (FR-144).
 */
async function semearBaralhos(enderecoDaApi: string): Promise<void> {
  let numeroDoCartao = 0;

  for (const definicao of BARALHOS) {
    const baralho = await criarBaralhoPelaApi(enderecoDaApi, {
      nome: definicao.nome,
    });

    for (let indice = 0; indice < definicao.cartoes; indice += 1) {
      numeroDoCartao += 1;

      const cartao = await criarCartaoPelaApi(enderecoDaApi, {
        frente: `Frente ${numeroDoCartao}`,
        verso: `Verso ${numeroDoCartao}`,
      });

      await vincularCartaoPelaApi(enderecoDaApi, cartao.id, baralho.id);
    }
  }
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
