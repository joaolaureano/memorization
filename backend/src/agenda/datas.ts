/**
 * Funções puras de data civil e fuso horário do Module `Agenda` (FR-248,
 * FR-250).
 *
 * O arquivo não depende de nada além da plataforma: trabalha com datas civis
 * (YYYY-MM-DD) e fusos IANA. É a base comum da projeção da semana da Rotina e
 * da eleição do dia do Início de Compromisso. Nenhuma função usa o horário
 * local da máquina — a aritmética de dias é feita em UTC, de modo que o horário
 * de verão não encurte nem alongue um dia.
 */

/** Formato estrito de data civil: `YYYY-MM-DD`, com quatro dígitos por campo. */
const FORMATO_DE_DATA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Forma de um nome de fuso IANA (FR-250): uma ou mais partes separadas por
 * `/`, cada uma começando por letra e contendo letras, dígitos, `_`, `+` ou
 * `-`.
 *
 * A forma sozinha não basta — `UTC` e `America/Sao_Paulo` casam, mas `lixo`
 * também —, e por isso `ehFusoValido` confirma o nome com `Intl`.
 */
const FORMATO_DE_FUSO = /^[A-Za-z][A-Za-z0-9_+\-]*(\/[A-Za-z0-9_+\-]+)*$/;

/**
 * `true` quando `texto` é uma data civil no formato estrito `YYYY-MM-DD` **e**
 * a data existe de verdade (FR-248).
 *
 * A existência é conferida por ida-e-volta com `Date.UTC`/`toISOString`: uma
 * data inexistente como `2026-02-31` ou `2025-02-29` transborda para o mês
 * seguinte e não reconstrói o texto original, e por isso é recusada. O ano
 * `0000` é recusado explicitamente.
 */
export function ehDataCivilValida(texto: string): boolean {
  if (!FORMATO_DE_DATA_CIVIL.test(texto)) {
    return false;
  }

  const ano = Number(texto.slice(0, 4));

  if (ano === 0) {
    return false;
  }

  const mes = Number(texto.slice(5, 7));
  const dia = Number(texto.slice(8, 10));
  const data = new Date(Date.UTC(ano, mes - 1, dia));

  return data.toISOString().slice(0, 10) === texto;
}

/**
 * `true` quando `fuso` é um nome IANA utilizável (FR-250).
 *
 * Precisa casar com `FORMATO_DE_FUSO` **e** ser aceito por
 * `Intl.DateTimeFormat`: assim o vazio, offsets como `+03:00` e texto solto são
 * recusados, enquanto `UTC` e `America/Sao_Paulo` são aceitos.
 */
export function ehFusoValido(fuso: string): boolean {
  if (!FORMATO_DE_FUSO.test(fuso)) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}

/**
 * A data civil (`YYYY-MM-DD`) do instante `agora` no fuso `fuso` (FR-250).
 *
 * O relógio entra por parâmetro para que a composição seja testável; lança
 * `Error` quando o fuso é inválido.
 */
export function hojeNoFuso(fuso: string, agora: Date): string {
  if (!ehFusoValido(fuso)) {
    throw new Error(`Fuso horário inválido: ${fuso}`);
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/**
 * A data civil `dias` dias depois de `data` (FR-248); `dias` pode ser
 * negativo.
 *
 * A aritmética é feita em UTC sobre a data civil, sem depender de 24 h nem do
 * horário de verão do fuso local.
 */
export function somarDias(data: string, dias: number): string {
  const ano = Number(data.slice(0, 4));
  const mes = Number(data.slice(5, 7));
  const dia = Number(data.slice(8, 10));
  const instante = Date.UTC(ano, mes - 1, dia + dias);

  return new Date(instante).toISOString().slice(0, 10);
}

/**
 * O dia da semana de `data`, com 1 = segunda e 7 = domingo (FR-248).
 *
 * A conversão parte de `getUTCDay`, cujo domingo é 0: o domingo vira 7 e os
 * demais dias já coincidem com a numeração da Rotina.
 */
export function diaDaSemana(data: string): number {
  const ano = Number(data.slice(0, 4));
  const mes = Number(data.slice(5, 7));
  const dia = Number(data.slice(8, 10));
  const diaDaSemanaJS = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();

  return diaDaSemanaJS === 0 ? 7 : diaDaSemanaJS;
}

/**
 * A segunda-feira da semana ISO de `data` (FR-248): a própria data quando já é
 * segunda, ou a segunda anterior quando não é.
 *
 * Na semana ISO, o domingo pertence à semana que começou na segunda anterior.
 */
export function segundaFeiraDe(data: string): string {
  return somarDias(data, -(diaDaSemana(data) - 1));
}

/** `true` quando `data` cai numa segunda-feira (FR-248). */
export function ehSegundaFeira(data: string): boolean {
  return diaDaSemana(data) === 1;
}

/**
 * As sete datas civis da semana que começa em `inicio`, de `inicio` a
 * `inicio + 6` (FR-248).
 */
export function diasDaSemana(inicio: string): string[] {
  return Array.from({ length: 7 }, (_, indice) => somarDias(inicio, indice));
}
