/**
 * Módulo puro do dia (FR-204, FR-221).
 *
 * Reúne as duas contas de calendário de que a Revisão espaçada precisa antes de
 * falar com o servidor: os limites do dia local — a meia-noite que corta o
 * limite de novos Cartões (FR-204, D3) — e o rótulo humano da próxima revisão
 * de um Cartão, para os botões de Avaliação (FR-221).
 *
 * Não toca no DOM nem no acervo: recebe `agora` e um instante ISO e devolve
 * contas. Como nas Estatísticas, as fronteiras são as do fuso local do
 * navegador, obtidas com os getters locais de `Date` (FR-204): é o dia que a
 * pessoa vive, e não o dia UTC, que decide quando a lista de novos zera. Os
 * `Date` são montados com os componentes locais — ano, mês e dia —, e não
 * somando milissegundos: assim a meia-noite continua sendo a meia-noite nos
 * dias em que o horário de verão muda a duração do dia.
 */

/** Milissegundos de um dia, para converter a distância entre meias-noites (FR-221). */
const MILISSEGUNDOS_DE_UM_DIA = 86_400_000;

/**
 * Os limites do dia de `agora`: 00:00 local de hoje e 00:00 local de amanhã,
 * em ISO-8601 (FR-204).
 *
 * O intervalo é aberto no fim — `[inicioDoDia, fimDoDia)` —, de modo que um
 * instante exatamente à meia-noite pertence ao dia que começa, e não ao que
 * acabou de terminar.
 */
export function limitesDoDia(agora: Date): {
  inicioDoDia: string;
  fimDoDia: string;
} {
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  const dia = agora.getDate();

  return {
    inicioDoDia: new Date(ano, mes, dia).toISOString(),
    fimDoDia: new Date(ano, mes, dia + 1).toISOString(),
  };
}

/**
 * O rótulo humano da próxima revisão, para os quatro botões de Avaliação
 * (FR-221): sempre o número de **dias locais** — "0 dias", "1 dia" ou
 * "N dias".
 *
 * A conta é feita em dias locais, e não em 24 h: duas revisões separadas por
 * poucas horas podem estar em dias diferentes, e é o dia do calendário que a
 * pessoa reconhece no rótulo. Um instante no passado conta como zero, e um
 * instante ilegível também — a tela nunca é derrubada por uma data ruim.
 */
export function rotuloDaPrevia(agora: Date, iso: string): string {
  const dias = diasAte(agora, new Date(iso));
  const d = Number.isFinite(dias) ? Math.max(0, dias) : 0;

  return d === 1 ? "1 dia" : `${d} dias`;
}

/**
 * O nome acessível de um botão de Avaliação (FR-221, FR-218). Com prévia, ela
 * entra no nome — "Bom, próxima revisão em 1 dia" —; sem prévia, o nome é só
 * o rótulo do nível.
 */
export function nomeAcessivelDaAvaliacao(
  rotulo: string,
  previa: string | null,
): string {
  if (previa === null) {
    return rotulo;
  }

  return `${rotulo}, próxima revisão em ${previa}`;
}

/** A meia-noite local do dia de um instante (FR-204). */
function meiaNoiteLocal(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

/**
 * A distância em dias locais de `origem` até `destino` (FR-221).
 *
 * As duas pontas são reduzidas à meia-noite local antes da subtração, e o
 * quociente é arredondado: nos dias em que o horário de verão muda, o intervalo
 * entre duas meias-noites não é um múltiplo exato de 24 h, e o arredondamento
 * devolve o número de dias que a pessoa conta no calendário.
 */
function diasAte(origem: Date, destino: Date): number {
  const distancia =
    meiaNoiteLocal(destino).getTime() - meiaNoiteLocal(origem).getTime();

  return Math.round(distancia / MILISSEGUNDOS_DE_UM_DIA);
}
