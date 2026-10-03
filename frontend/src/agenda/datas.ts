/**
 * Funções puras de data civil e fuso da Agenda (FR-246, FR-247): trabalham com
 * datas `YYYY-MM-DD` e fusos IANA, sem depender do horário local da máquina —
 * a aritmética de dias é feita em UTC, e o horário de verão não encurta nem
 * alonga um dia.
 *
 * É a contraparte do navegador de `backend/src/agenda/datas.ts`: o servidor
 * decide o que vale (hoje, elegibilidade); o navegador só formata, navega entre
 * semanas e informa o seu fuso. Nenhum código do servidor entra no bundle.
 */

const NOMES_DOS_DIAS = [
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
  "domingo",
] as const;

const NOMES_DOS_MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

const ABREVIACOES_DOS_MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

/** Partes numéricas de uma data civil `YYYY-MM-DD`. */
function partes(data: string): { ano: number; mes: number; dia: number } {
  return {
    ano: Number(data.slice(0, 4)),
    mes: Number(data.slice(5, 7)),
    dia: Number(data.slice(8, 10)),
  };
}

/** `true` quando `texto` é uma data civil `YYYY-MM-DD` que existe de verdade. */
export function ehDataCivilValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return false;
  }

  const { ano, mes, dia } = partes(texto);

  if (ano === 0) {
    return false;
  }

  return new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10) === texto;
}

/** O fuso IANA do navegador, ou `UTC` quando ele não o informa (FR-246). */
export function fusoDoNavegador(): string {
  try {
    const fuso = new Intl.DateTimeFormat().resolvedOptions().timeZone;

    return typeof fuso === "string" && fuso.length > 0 ? fuso : "UTC";
  } catch {
    return "UTC";
  }
}

/** `true` quando `fuso` é aceito por `Intl.DateTimeFormat`. */
export function ehFusoValido(fuso: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: fuso });
    return fuso.length > 0;
  } catch {
    return false;
  }
}

/** A data civil do instante `agora` no fuso `fuso`. */
export function hojeNoFuso(fuso: string, agora: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/** A data civil `dias` dias depois de `data`; `dias` pode ser negativo. */
export function somarDias(data: string, dias: number): string {
  const { ano, mes, dia } = partes(data);

  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** O dia da semana de `data`: 1 = segunda … 7 = domingo. */
export function diaDaSemana(data: string): number {
  const { ano, mes, dia } = partes(data);
  const js = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();

  return js === 0 ? 7 : js;
}

/** A segunda-feira da semana de `data`. */
export function segundaFeiraDe(data: string): string {
  return somarDias(data, -(diaDaSemana(data) - 1));
}

/** As sete datas da semana que começa em `inicio`. */
export function diasDaSemana(inicio: string): string[] {
  return Array.from({ length: 7 }, (_, indice) => somarDias(inicio, indice));
}

/** O nome do dia da semana (1 = segunda): "segunda", "terça"… */
export function nomeDoDia(dia: number): string {
  return NOMES_DOS_DIAS[dia - 1];
}

/** Lista legível de dias: "segunda e quinta", "segunda, quarta e sexta". */
export function descreverDias(dias: readonly number[]): string {
  const nomes = [...dias].sort((a, b) => a - b).map(nomeDoDia);

  if (nomes.length <= 1) {
    return nomes.join("");
  }

  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/** "3 out" — o dia e o mês abreviado, para a linha do calendário. */
export function dataCurta(data: string): string {
  const { mes, dia } = partes(data);

  return `${dia} ${ABREVIACOES_DOS_MESES[mes - 1]}`;
}

/** "segunda, 5 de outubro de 2026" — a data completa do dia selecionado. */
export function dataPorExtenso(data: string): string {
  const { ano, mes, dia } = partes(data);
  const nome = NOMES_DOS_DIAS[diaDaSemana(data) - 1];

  return `${nome}, ${dia} de ${NOMES_DOS_MESES[mes - 1]} de ${ano}`;
}

/**
 * O intervalo da semana, com mês e ano quando necessário (FR-228):
 * "5 a 11 de outubro de 2026", "28 de setembro a 4 de outubro de 2026",
 * "28 de dezembro de 2026 a 3 de janeiro de 2027".
 */
export function descreverSemana(inicio: string): string {
  const fim = somarDias(inicio, 6);
  const a = partes(inicio);
  const b = partes(fim);

  if (a.ano !== b.ano) {
    return `${a.dia} de ${NOMES_DOS_MESES[a.mes - 1]} de ${a.ano} a ${b.dia} de ${NOMES_DOS_MESES[b.mes - 1]} de ${b.ano}`;
  }

  if (a.mes !== b.mes) {
    return `${a.dia} de ${NOMES_DOS_MESES[a.mes - 1]} a ${b.dia} de ${NOMES_DOS_MESES[b.mes - 1]} de ${b.ano}`;
  }

  return `${a.dia} a ${b.dia} de ${NOMES_DOS_MESES[b.mes - 1]} de ${b.ano}`;
}

/** Quantos milissegundos faltam para a próxima meia-noite civil no fuso. */
export function milissegundosAteAMeiaNoite(fuso: string, agora: Date): number {
  const hoje = hojeNoFuso(fuso, agora);
  const amanha = somarDias(hoje, 1);
  // Procura, por bissecção em torno de 24 h, o primeiro instante em que a data
  // civil do fuso passa a ser `amanha` — sem assumir dias de 24 h exatas.
  let baixo = agora.getTime();
  let alto = baixo + 26 * 60 * 60 * 1000;

  while (alto - baixo > 1000) {
    const meio = Math.floor((baixo + alto) / 2);

    if (hojeNoFuso(fuso, new Date(meio)) === amanha) {
      alto = meio;
    } else {
      baixo = meio;
    }
  }

  return Math.max(alto - agora.getTime(), 1000);
}
