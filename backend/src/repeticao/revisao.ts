/**
 * Module puro de orquestração da Repetição espaçada (D5).
 *
 * Não faz I/O e não lê relógio: recebe os dados já lidos pela Porta e devolve
 * os dados a gravar — quem lê e grava é o Module `Acervo`. O dia é do
 * navegador (D3); aqui só se comparam instantes, nunca fusos.
 *
 * Reúne o resumo de Início (FR-198, FR-199), o lote da Revisão do dia
 * (FR-201, FR-203), a aplicação das Avaliações aos Agendamentos (FR-205,
 * FR-210) e a reconstrução por replay na troca de algoritmo (FR-213, SC-083).
 */
import type {
  Avaliacao,
  AlgoritmoDeRepeticao,
  EstadoDoAgendamento,
} from "./algoritmo.ts";
import type {
  Agendamento,
  Cartao,
  ItemAvaliado,
  Preferencias,
} from "../armazenamento/porta.ts";

/** Teto de Itens de uma Sessão de Revisão do dia (FR-203). */
export const TAMANHO_DO_LOTE = 20;

/** Contagem exibida em Início (FR-198, FR-199). */
export interface ContagemDaRevisao {
  /** Agendamentos do acervo com `proximaRevisaoEm < fimDoDia` (FR-198). */
  vencidos: number;
  /** `min(Cartões sem Agendamento, max(0, limite − introduzidosHoje))` (FR-199, FR-200). */
  novosHoje: number;
}

/**
 * Agendamentos do acervo informado, indexados por Cartão.
 *
 * Agendamento de Cartão fora de `cartoes` é ignorado: ele não tem Cartão para
 * estudar, e é assim que o resumo e o lote ficam consistentes entre si.
 */
function agendamentosPorCartao(
  cartoes: readonly Cartao[],
  agendamentos: readonly Agendamento[],
): Map<string, Agendamento> {
  const ids = new Set(cartoes.map((cartao) => cartao.id));
  const porCartao = new Map<string, Agendamento>();
  for (const agendamento of agendamentos) {
    if (ids.has(agendamento.cartaoId)) {
      porCartao.set(agendamento.cartaoId, agendamento);
    }
  }
  return porCartao;
}

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
 * Quantos Cartões revisar hoje: os vencidos e os novos que ainda cabem no
 * limite diário (FR-198, FR-199).
 *
 * `introduzidosHoje` são os Agendamentos com `criadoEm` em
 * `[inicioDoDia, fimDoDia)` — o instante da primeira Avaliação do Cartão
 * (FR-199, FR-200). Cartão novo é Cartão sem Agendamento (D3).
 */
export function resumoDaRevisao(
  cartoes: readonly Cartao[],
  agendamentos: readonly Agendamento[],
  preferencias: Preferencias,
  inicioDoDia: Date,
  fimDoDia: Date,
): ContagemDaRevisao {
  const porCartao = agendamentosPorCartao(cartoes, agendamentos);
  const inicio = inicioDoDia.getTime();
  const fim = fimDoDia.getTime();

  let vencidos = 0;
  let introduzidosHoje = 0;
  for (const agendamento of porCartao.values()) {
    if (Date.parse(agendamento.proximaRevisaoEm) < fim) {
      vencidos += 1;
    }
    const criadoEm = Date.parse(agendamento.criadoEm);
    if (criadoEm >= inicio && criadoEm < fim) {
      introduzidosHoje += 1;
    }
  }

  const novos = cartoes.filter((cartao) => !porCartao.has(cartao.id)).length;
  const disponiveisHoje = Math.max(
    0,
    preferencias.limiteDeNovosPorDia - introduzidosHoje,
  );
  return { vencidos, novosHoje: Math.min(novos, disponiveisHoje) };
}

/**
 * Lote da Revisão do dia: os vencidos primeiro, por `proximaRevisaoEm`
 * ascendente, depois os novos — cada Cartão no máximo uma vez e no máximo
 * `TAMANHO_DO_LOTE` Itens (FR-201, FR-203).
 *
 * `cartoes` já vem em ordem de criação (§2.3), que é o desempate dos vencidos
 * e a ordem dos novos; Cartões de outro dono ou excluídos não aparecem.
 */
export function loteDeRevisao(
  cartoes: readonly Cartao[],
  agendamentos: readonly Agendamento[],
  preferencias: Preferencias,
  inicioDoDia: Date,
  fimDoDia: Date,
): Cartao[] {
  const porCartao = agendamentosPorCartao(cartoes, agendamentos);
  const fim = fimDoDia.getTime();

  const vencidos: { cartao: Cartao; indice: number; proxima: number }[] = [];
  cartoes.forEach((cartao, indice) => {
    const agendamento = porCartao.get(cartao.id);
    if (agendamento === undefined) return;
    const proxima = Date.parse(agendamento.proximaRevisaoEm);
    if (proxima < fim) {
      vencidos.push({ cartao, indice, proxima });
    }
  });
  vencidos.sort((a, b) => a.proxima - b.proxima || a.indice - b.indice);

  const novos = cartoes.filter((cartao) => !porCartao.has(cartao.id));
  const { novosHoje } = resumoDaRevisao(
    cartoes,
    agendamentos,
    preferencias,
    inicioDoDia,
    fimDoDia,
  );

  const lote: Cartao[] = [];
  for (const vencido of vencidos) {
    if (lote.length === TAMANHO_DO_LOTE) return lote;
    lote.push(vencido.cartao);
  }

  let novosIncluidos = 0;
  for (const cartao of novos) {
    if (lote.length === TAMANHO_DO_LOTE || novosIncluidos === novosHoje) break;
    lote.push(cartao);
    novosIncluidos += 1;
  }
  return lote;
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
