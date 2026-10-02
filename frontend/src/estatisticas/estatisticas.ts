import type { RegistroResumido } from "../acervo-cliente/cliente";

/**
 * Módulo puro das Estatísticas (FR-161, FR-162).
 *
 * Reúne as contas da tela de Início sobre os Registros de Sessão: a janela de
 * sete dias, os Itens estudados em cada dia e a taxa de acerto do período. Não
 * toca no DOM nem no acervo — recebe os registros e o instante `agora` —, o que
 * mantém a regra testável sem relógio falso e sem depender do fuso da máquina
 * de quem corre a prova.
 *
 * As fronteiras de dia são as do fuso local do navegador, obtidas com os
 * getters locais de `Date` (FR-162): é o dia que a pessoa vive, e não o dia
 * UTC, que decide em que coluna do gráfico a Sessão aparece.
 */

/** Quantidade de dias da janela, contando hoje (FR-162). */
const DIAS_DA_JANELA = 7;

/** Abreviações dos dias da semana, indexadas por `Date.getDay()` (0 = domingo). */
const ROTULOS_DA_SEMANA = [
  "dom",
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sáb",
] as const;

/** O rótulo do dia corrente, no lugar da abreviação do dia da semana (FR-162). */
const ROTULO_DE_HOJE = "Hoje";

/** Um dia da janela, já agregado para o gráfico (FR-162). */
export interface DiaDeEstudo {
  /** A data local em AAAA-MM-DD; é a chave do dia. */
  data: string;
  /** A abreviação do dia da semana, ou "Hoje" para o dia corrente. */
  rotulo: string;
  /** O total de Itens estudados naquele dia. */
  itens: number;
}

/**
 * O início da janela: 00:00 local de seis dias atrás, de modo que a janela
 * cubra hoje e os seis dias anteriores (FR-162).
 *
 * O `Date` é montado com os componentes locais de `agora` — ano, mês e dia —,
 * e não subtraindo milissegundos: assim a fronteira é a meia-noite do fuso do
 * navegador, inclusive nos dias em que o horário de verão muda a duração do
 * dia.
 */
export function inicioDaJanela(agora: Date): Date {
  return new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate() - DIAS_DA_JANELA + 1,
  );
}

/**
 * Os sete dias da janela, do mais antigo ao mais recente, com o total de Itens
 * estudados em cada um (FR-162).
 *
 * Os registros fora da janela — anteriores a ela ou posteriores a hoje — não
 * têm dia no gráfico e são ignorados; um `concluidaEm` ilegível também é
 * descartado, em vez de derrubar a tela.
 */
export function itensPorDia(
  registros: RegistroResumido[],
  agora: Date,
): DiaDeEstudo[] {
  const inicio = inicioDaJanela(agora);
  const chaveDeHoje = chaveDoDia(agora);
  const contagens = new Map<string, number>();
  const dias: DiaDeEstudo[] = [];

  for (let deslocamento = 0; deslocamento < DIAS_DA_JANELA; deslocamento += 1) {
    const data = new Date(
      inicio.getFullYear(),
      inicio.getMonth(),
      inicio.getDate() + deslocamento,
    );
    const chave = chaveDoDia(data);

    contagens.set(chave, 0);
    dias.push({
      data: chave,
      rotulo: chave === chaveDeHoje ? ROTULO_DE_HOJE : rotuloDaSemana(data),
      itens: 0,
    });
  }

  for (const registro of registros) {
    const quando = new Date(registro.concluidaEm);

    if (Number.isNaN(quando.getTime())) {
      continue;
    }

    const contagem = contagens.get(chaveDoDia(quando));

    // Registrar um dia que não está no gráfico é o mesmo que não ter estudado:
    // o acumulado só cresce nos sete dias da janela (FR-162).
    if (contagem === undefined) {
      continue;
    }

    contagens.set(chaveDoDia(quando), contagem + registro.estudados);
  }

  return dias.map((dia) => ({ ...dia, itens: contagens.get(dia.data) ?? 0 }));
}

/**
 * O percentual de acertos sobre tudo o que foi estudado, arredondado ao inteiro
 * (FR-161). Sem Itens estudados não há taxa a mostrar: devolve `null`, e a tela
 * decide o que dizer no lugar do número.
 */
export function taxaDeAcerto(registros: RegistroResumido[]): number | null {
  let acertos = 0;
  let estudados = 0;

  for (const registro of registros) {
    acertos += registro.acertos;
    estudados += registro.estudados;
  }

  if (estudados === 0) {
    return null;
  }

  return Math.round((acertos / estudados) * 100);
}

/** A chave do dia local de um instante, em AAAA-MM-DD (FR-162). */
function chaveDoDia(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** A abreviação do dia da semana de um dia local. */
function rotuloDaSemana(data: Date): string {
  return ROTULOS_DA_SEMANA[data.getDay()] ?? "";
}
