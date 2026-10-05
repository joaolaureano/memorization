/**
 * SM-2 clássico, versão 1 (FR-190, D2).
 *
 * `dados = { repeticoes, facilidade, intervaloEmDias }`. A qualidade da
 * Avaliação é `errei = 2`, `dificil = 3`, `bom = 4`, `facil = 5`; num Cartão
 * novo os quatro níveis caem em "amanhã", porque `q < 3` também produz
 * intervalo 1 (R9). A tabela de referência está em R12 (SC-082).
 */
import type {
  AlgoritmoDeRepeticao,
  Avaliacao,
  EstadoDoAgendamento,
} from "./algoritmo.ts";

/** Dados internos do SM-2, opacos para o restante do produto. */
interface DadosDoSm2 {
  readonly repeticoes: number;
  readonly facilidade: number;
  readonly intervaloEmDias: number;
}

const ID = "sm2";
const VERSAO = 1;
const ROTULO = "SM-2";
const FACILIDADE_PADRAO = 2.5;
const FACILIDADE_MINIMA = 1.3;
const MILISSEGUNDOS_POR_DIA = 86_400_000;

/** Qualidade da Avaliação no SM-2 clássico (D2). */
const QUALIDADE: Record<Avaliacao, number> = {
  errei: 2,
  dificil: 3,
  bom: 4,
  facil: 5,
};

/** Arredonda para 2 casas, como exige o cálculo da facilidade (D2). */
function arred2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Ausente, de outro algoritmo ou de outra versão = Cartão novo (D1, D2). */
function lerDados(estado: EstadoDoAgendamento | null): DadosDoSm2 {
  if (estado === null || estado.algoritmo !== ID || estado.versao !== VERSAO) {
    return { repeticoes: 0, facilidade: FACILIDADE_PADRAO, intervaloEmDias: 0 };
  }
  return estado.dados as DadosDoSm2;
}

/** O SM-2 registrado em `ALGORITMOS` (FR-190). */
export const sm2: AlgoritmoDeRepeticao = {
  id: ID,
  versao: VERSAO,
  rotulo: ROTULO,
  opcoesDeAvaliacao: [
    { chave: "errei", rotulo: "Errei", resultado: "errou" },
    { chave: "dificil", rotulo: "Difícil", resultado: "acertou" },
    { chave: "bom", rotulo: "Bom", resultado: "acertou" },
    { chave: "facil", rotulo: "Fácil", resultado: "acertou" },
  ],
  avaliar(estado, avaliacao, agora) {
    const anterior = lerDados(estado);
    const q = QUALIDADE[avaliacao];

    // EF' é atualizado em toda Avaliação, inclusive no erro (D2).
    const delta = 5 - q;
    const facilidade = Math.max(
      FACILIDADE_MINIMA,
      arred2(anterior.facilidade + (0.1 - delta * (0.08 + delta * 0.02))),
    );

    let repeticoes: number;
    let intervaloEmDias: number;
    if (q < 3) {
      repeticoes = 0;
      intervaloEmDias = 1;
    } else if (anterior.repeticoes === 0) {
      repeticoes = 1;
      intervaloEmDias = 1;
    } else if (anterior.repeticoes === 1) {
      repeticoes = 2;
      intervaloEmDias = 6;
    } else {
      repeticoes = anterior.repeticoes + 1;
      intervaloEmDias = Math.round(anterior.intervaloEmDias * facilidade);
    }

    return {
      estado: {
        algoritmo: ID,
        versao: VERSAO,
        dados: { repeticoes, facilidade, intervaloEmDias },
      },
      proximaRevisaoEm: new Date(
        agora.getTime() + intervaloEmDias * MILISSEGUNDOS_POR_DIA,
      ),
    };
  },
};
