import type { CompromissoDeEstudo } from "../acervo-cliente/cliente";

/**
 * O estado do dia no calendário (FR-229) e as contagens de concluídos e
 * previstos. Regras aplicadas **nesta ordem**, depois de excluir os cancelados
 * dos totais; indisponibilidade de Baralho não reduz o total.
 */
export type EstadoDoDia =
  | "sem_estudos"
  | "concluido"
  | "nao_realizado"
  | "programado"
  | "pendente"
  | "parcial";

export interface ResumoDoDia {
  data: string;
  estado: EstadoDoDia;
  /** Compromissos distintos, sem os cancelados. */
  total: number;
  concluidos: number;
  /** Só passados: os que não foram concluídos. */
  naoRealizados: number;
  /** Os Compromissos do dia, inclusive os cancelados (para os detalhes). */
  compromissos: CompromissoDeEstudo[];
}

/** Resume um dia a partir dos seus Compromissos e de `hoje` (FR-229). */
export function resumirDia(
  data: string,
  hoje: string,
  compromissos: readonly CompromissoDeEstudo[],
): ResumoDoDia {
  const doDia = compromissos.filter((compromisso) => compromisso.data === data);
  const ativos = doDia.filter((compromisso) => compromisso.estado !== "cancelado");
  const concluidos = ativos.filter(
    (compromisso) => compromisso.estado === "concluido",
  ).length;
  const total = ativos.length;
  const pendentes = total - concluidos;
  let estado: EstadoDoDia;

  if (total === 0) {
    estado = "sem_estudos";
  } else if (pendentes === 0) {
    estado = "concluido";
  } else if (data < hoje) {
    estado = "nao_realizado";
  } else if (data > hoje) {
    estado = "programado";
  } else {
    estado = concluidos === 0 ? "pendente" : "parcial";
  }

  return {
    data,
    estado,
    total,
    concluidos,
    naoRealizados: data < hoje ? pendentes : 0,
    compromissos: doDia,
  };
}

/**
 * O primeiro Compromisso pendente e elegível de hoje, na ordem de criação das
 * Rotinas (FR-227, FR-230): pendente e com Baralho disponível.
 */
export function proximoCompromissoElegivel(
  deHoje: readonly CompromissoDeEstudo[],
): CompromissoDeEstudo | null {
  return (
    deHoje.find(
      (compromisso) =>
        compromisso.estado === "pendente" && !compromisso.indisponivel,
    ) ?? null
  );
}
