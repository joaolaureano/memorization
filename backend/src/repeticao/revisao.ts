/**
 * Module puro de orquestração da Repetição espaçada (D5).
 *
 * Não faz I/O e não lê relógio: recebe os dados já lidos pela Porta e devolve
 * os dados a gravar — quem lê e grava é o Module `Acervo`. O dia é do
 * navegador (D3); aqui só se comparam instantes, nunca fusos.
 *
 * Reúne a aplicação das Avaliações aos Agendamentos (FR-205, FR-210) e a
 * reconstrução por replay na troca de algoritmo (FR-213, SC-083).
 */
import type {
  Avaliacao,
  AlgoritmoDeRepeticao,
  EstadoDoAgendamento,
} from "./algoritmo.ts";
import type {
  Agendamento,
  ItemAvaliado,
} from "../armazenamento/porta.ts";

/** Estado opaco do Agendamento como o algoritmo o lê; `null` = Cartão novo (FR-188). */
function estadoDoAgendamento(
  agendamento: Agendamento | null,
): EstadoDoAgendamento | null {
  if (agendamento === null) return null;
  return {
    algoritmo: agendamento.algoritmo,
    versao: agendamento.versaoDoAlgoritmo,
    dados: agendamento.estado,
  };
}

/** Agendamento resultante de uma Avaliação, com o estado opaco do algoritmo (FR-188). */
function agendamentoDaAvaliacao(
  cartaoId: string,
  avaliacao: Avaliacao,
  resultado: { estado: EstadoDoAgendamento; proximaRevisaoEm: Date },
  criadoEm: string,
  revisadoEm: string,
): Agendamento {
  return {
    cartaoId,
    algoritmo: resultado.estado.algoritmo,
    versaoDoAlgoritmo: resultado.estado.versao,
    estado: resultado.estado.dados,
    proximaRevisaoEm: resultado.proximaRevisaoEm.toISOString(),
    ultimaAvaliacao: avaliacao,
    revisadoEm,
    criadoEm,
  };
}

/**
 * Aplica as Avaliações aos Agendamentos, na ordem dos Itens (FR-205, FR-210).
 *
 * O estado de partida de cada Item é o Agendamento atual do Cartão ou, se um
 * Item anterior do mesmo lote já o alterou, o Agendamento que aquele Item
 * produziu — é o encadeamento que faz duas Avaliações seguidas avançarem as
 * repetições. Devolve só os Agendamentos alterados ou criados, com
 * `criadoEm = agora` no novo e preservado no existente (FR-199).
 */
export function aplicarAvaliacoes(
  agendamentos: readonly Agendamento[],
  itens: readonly { readonly cartaoId: string; readonly avaliacao: Avaliacao }[],
  alg: AlgoritmoDeRepeticao,
  agora: Date,
): Agendamento[] {
  const existentes = new Map(
    agendamentos.map((agendamento) => [agendamento.cartaoId, agendamento]),
  );
  const alterados = new Map<string, Agendamento>();

  for (const item of itens) {
    const atual =
      alterados.get(item.cartaoId) ?? existentes.get(item.cartaoId) ?? null;
    const resultado = alg.avaliar(
      estadoDoAgendamento(atual),
      item.avaliacao,
      agora,
    );
    alterados.set(
      item.cartaoId,
      agendamentoDaAvaliacao(
        item.cartaoId,
        item.avaliacao,
        resultado,
        atual === null ? agora.toISOString() : atual.criadoEm,
        agora.toISOString(),
      ),
    );
  }

  return [...alterados.values()];
}

/**
 * Reconstrói os Agendamentos por replay do Histórico (FR-213, SC-083).
 *
 * `itensAvaliados` já vem em `(concluidaEm, posicao)` (§2.3), então o replay é
 * determinístico: o `agora` de cada Avaliação é a `concluidaEm` do Item e o
 * `criadoEm` do Cartão é a `concluidaEm` do seu primeiro Item. Itens de
 * Cartões excluídos são ignorados (FR-213).
 */
export function reconstruir(
  itensAvaliados: readonly ItemAvaliado[],
  cartoesExistentes: readonly string[],
  alg: AlgoritmoDeRepeticao,
): Agendamento[] {
  const existentes = new Set(cartoesExistentes);
  const porCartao = new Map<string, Agendamento>();

  for (const item of itensAvaliados) {
    if (!existentes.has(item.cartaoId)) continue;
    const atual = porCartao.get(item.cartaoId) ?? null;
    const agora = new Date(item.concluidaEm);
    const resultado = alg.avaliar(
      estadoDoAgendamento(atual),
      item.avaliacao,
      agora,
    );
    porCartao.set(
      item.cartaoId,
      agendamentoDaAvaliacao(
        item.cartaoId,
        item.avaliacao,
        resultado,
        atual === null ? item.concluidaEm : atual.criadoEm,
        item.concluidaEm,
      ),
    );
  }

  return [...porCartao.values()];
}
