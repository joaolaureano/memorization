/**
 * Porta de algoritmo de repetição espaçada (FR-187, FR-191).
 *
 * O Agendamento é calculado por um algoritmo identificado e versionado; o
 * restante do produto lê apenas a próxima data de revisão e a que Cartão e
 * Usuário o Agendamento pertence. O estado é opaco (`dados: unknown`, JSON):
 * só o algoritmo que o criou o interpreta. Incluir um segundo algoritmo é um
 * novo arquivo mais uma entrada em `ALGORITMOS` (FR-191).
 */
import { sm2 } from "./sm2.ts";

/** Níveis de Avaliação de um Cartão (FR-193). */
export type Avaliacao = "errei" | "dificil" | "bom" | "facil";

/**
 * Opção de Avaliação oferecida por um algoritmo (FR-191, FR-192): a chave do
 * nível, seu rótulo legível para a tela e o resultado que produz.
 */
export interface OpcaoDeAvaliacao {
  readonly chave: Avaliacao;
  readonly rotulo: string;
  readonly resultado: "acertou" | "errou";
}

/** Estado do Agendamento, opaco para quem não é o algoritmo que o criou. */
export interface EstadoDoAgendamento {
  readonly algoritmo: string; // "sm2"
  readonly versao: number; // 1
  readonly dados: unknown; // opaco, JSON; só o algoritmo o interpreta
}

/**
 * Algoritmo de repetição espaçada (FR-187, FR-188, FR-189).
 *
 * A Interface é pura — sem relógio próprio e sem I/O — mantendo a superfície
 * de teste mínima e o comportamento concentrado (Princípio IV).
 */
export interface AlgoritmoDeRepeticao {
  readonly id: string; // "sm2"
  readonly versao: number; // 1
  readonly rotulo: string; // "SM-2"
  /** Opções de Avaliação oferecidas por este algoritmo (FR-191, FR-192). */
  readonly opcoesDeAvaliacao: readonly OpcaoDeAvaliacao[];
  /** Pura: sem relógio, sem I/O. `estado === null` = Cartão novo. */
  avaliar(
    estado: EstadoDoAgendamento | null,
    avaliacao: Avaliacao,
    agora: Date,
  ): { estado: EstadoDoAgendamento; proximaRevisaoEm: Date };
}

/** Registro dos algoritmos disponíveis; hoje só o SM-2 (FR-190, FR-191). */
export const ALGORITMOS: ReadonlyMap<string, AlgoritmoDeRepeticao> =
  new Map<string, AlgoritmoDeRepeticao>([[sm2.id, sm2]]);

/** Algoritmo padrão das Preferências (FR-190). */
export const ALGORITMO_PADRAO = "sm2" as const;

/** Desconhecido ou removido → SM-2 (FR-191). */
export function algoritmoPorId(id: string): AlgoritmoDeRepeticao {
  return ALGORITMOS.get(id) ?? ALGORITMOS.get(ALGORITMO_PADRAO) ?? sm2;
}

/**
 * Busca o rótulo da Avaliação entre as opções de todos os algoritmos
 * registrados; cai na chave como fallback (FR-191, FR-196, FR-197).
 */
export function rotuloDaAvaliacao(chave: Avaliacao): string {
  for (const algoritmo of ALGORITMOS.values()) {
    const opcao = algoritmo.opcoesDeAvaliacao.find((o) => o.chave === chave);
    if (opcao !== undefined) {
      return opcao.rotulo;
    }
  }
  return chave;
}

/**
 * Chama `avaliar` quatro vezes, uma por nível de Avaliação, e devolve a data
 * ISO resultante de cada uma (FR-221, SC-090).
 */
export function previa(
  alg: AlgoritmoDeRepeticao,
  estado: EstadoDoAgendamento | null,
  agora: Date,
): Record<Avaliacao, string> {
  const emIso = (avaliacao: Avaliacao): string =>
    alg.avaliar(estado, avaliacao, agora).proximaRevisaoEm.toISOString();
  return {
    errei: emIso("errei"),
    dificil: emIso("dificil"),
    bom: emIso("bom"),
    facil: emIso("facil"),
  };
}
