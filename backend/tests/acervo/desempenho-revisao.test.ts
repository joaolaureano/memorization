import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  criarAcervo,
  type Acervo,
  type Avaliacao,
  type Cartao,
} from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/**
 * T1526 — Escala da leitura de Início vista pelo `Acervo` (SC-087): com um
 * acervo de 2.000 Cartões e 500 Sessões concluídas, `obterResumoDaRevisao` e
 * `obterEstatisticas` **juntos** leem o armazenamento um número **fixo** de
 * vezes, que não cresce com o acervo.
 *
 * Esse é o jeito de o orçamento de 1 s valer sem relógio: tempo medido varia
 * com a máquina e a carga, e o número de operações no armazenamento, não. Uma
 * leitura por Cartão ou por Sessão (o N+1 que estouraria o orçamento) mudaria a
 * lista de chamadas abaixo, e o teste falha na hora, em qualquer máquina.
 *
 * O semeio atravessa a Interface do `Acervo` sobre o Adapter do armazenamento
 * local em memória, como os demais testes: os Agendamentos nascem do próprio
 * `registrarSessao`, e nenhum teste inspeciona tabela. O instante de «agora» é
 * injetado e fixo, e as janelas saem dele — nada aqui lê o relógio real.
 */

const QUANTIDADE_DE_CARTOES = 2_000;
const QUANTIDADE_DE_REGISTROS = 500;
const ITENS_POR_REGISTRO = 20;

/** Tempo limite do teste, para acomodar o semeio sem folga apertada. */
const TEMPO_LIMITE_EM_MILISSEGUNDOS = 120_000;

/** As leituras do armazenamento que as duas operações fazem, sempre as mesmas. */
const CHAMADAS_ESPERADAS = [
  "listarAgendamentos",
  "listarBaralhos",
  "listarCartoes", // o resumo da revisão
  "listarCartoes", // o tamanho do acervo nas Estatísticas
  "listarRegistrosDesde",
  "listarRegistrosRecentes",
  "obterPreferencias",
];

/** Os quatro níveis de Avaliação, para variar os Itens dos registros. */
const AVALIACOES: readonly Avaliacao[] = ["errei", "dificil", "bom", "facil"];

/** O «agora» do cenário: fixo, de modo que as janelas abaixo nunca expiram. */
const AGORA = new Date("2026-03-11T15:00:00.000Z");
const agora = () => AGORA;

/** O dia do estudo, como a tela o envia (D3), em torno de `AGORA`. */
const JANELA_DO_DIA = [
  "2026-03-11T03:00:00.000Z",
  "2026-03-12T03:00:00.000Z",
] as const;

/** Instante `desde` das Estatísticas, dentro da janela máxima (FR-169). */
const DESDE_DAS_ESTATISTICAS = "2026-03-10T15:00:00.000Z";

let aberto: ArmazenamentoSqliteAberto;
let usuarioId: string;

beforeAll(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  usuarioId = await criarDonoDeTeste(aberto.usuarios);
});

afterAll(async () => {
  await aberto.encerrar();
});

/** Cria os Cartões do acervo e os devolve na ordem de criação. */
async function semearCartoes(acervo: Acervo): Promise<Cartao[]> {
  const cartoes: Cartao[] = [];

  for (let indice = 0; indice < QUANTIDADE_DE_CARTOES; indice += 1) {
    const resultado = await acervo.criarCartao({
      frente: `Frente ${indice}`,
      verso: `Verso ${indice}`,
    });

    if (!resultado.ok) {
      throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
    }

    cartoes.push(resultado.cartao);
  }

  return cartoes;
}

/**
 * Registra as Sessões concluídas do semeio: 20 Itens cada, girando pelos
 * Cartões existentes e pelas quatro Avaliações, para que os Agendamentos
 * nasçam pelo próprio `registrarSessao` (FR-205, FR-210).
 */
async function semearRegistros(
  acervo: Acervo,
  cartoes: readonly Cartao[],
): Promise<void> {
  for (let registro = 0; registro < QUANTIDADE_DE_REGISTROS; registro += 1) {
    const itens = Array.from({ length: ITENS_POR_REGISTRO }, (_, indice) => {
      const cartao =
        cartoes[(registro * ITENS_POR_REGISTRO + indice) % cartoes.length];

      if (cartao === undefined) {
        throw new Error("semeio sem Cartões suficientes");
      }

      return {
        frente: cartao.frente,
        verso: cartao.verso,
        cartaoId: cartao.id,
        avaliacao: AVALIACOES[(registro + indice) % AVALIACOES.length] ?? "bom",
      };
    });

    const resultado = await acervo.registrarSessao({
      id: randomUUID(),
      origem: "baralho",
      baralhoId: "baralho-1",
      nomeDoBaralho: "Inglês",
      itens,
    });

    if (!resultado.ok) {
      throw new Error(`registro recusado inesperadamente: ${resultado.erro}`);
    }
  }
}

describe("escala da leitura de Início (SC-087)", () => {
  it(
    "resumo da revisão e estatísticas leem o armazenamento um número fixo de vezes, com 2.000 Cartões e 500 Sessões (SC-087)",
    async () => {
      const acervo = criarAcervo(aberto.armazenamento, usuarioId, { agora });

      const cartoes = await semearCartoes(acervo);
      await semearRegistros(acervo, cartoes);

      // Só as duas leituras passam pelo contador, e não o semeio.
      const chamadas: string[] = [];
      const armazenamentoContado = new Proxy(aberto.armazenamento, {
        get(alvo, propriedade, receptor) {
          const valor = Reflect.get(alvo, propriedade, receptor) as unknown;

          if (typeof valor !== "function") {
            return valor;
          }

          return (...argumentos: unknown[]) => {
            chamadas.push(String(propriedade));

            return (valor as (...a: unknown[]) => unknown).apply(
              alvo,
              argumentos,
            );
          };
        },
      });
      const acervoDeLeitura = criarAcervo(armazenamentoContado, usuarioId, {
        agora,
      });

      const [resumo, estatisticas] = await Promise.all([
        acervoDeLeitura.obterResumoDaRevisao(...JANELA_DO_DIA),
        acervoDeLeitura.obterEstatisticas(DESDE_DAS_ESTATISTICAS),
      ]);

      expect(resumo.ok).toBe(true);
      expect(estatisticas.ok).toBe(true);

      if (estatisticas.ok) {
        expect(estatisticas.estatisticas.cartoes).toBe(QUANTIDADE_DE_CARTOES);
      }

      // O conjunto de leituras é o mesmo com 2 ou com 2.000 Cartões: cada uma
      // é uma consulta agregada, e nenhuma é feita por Cartão ou por Sessão.
      expect(chamadas.sort()).toEqual(CHAMADAS_ESPERADAS);
    },
    TEMPO_LIMITE_EM_MILISSEGUNDOS,
  );
});
