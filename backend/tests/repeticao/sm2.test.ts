import { describe, expect, it } from "vitest";

import type {
  Avaliacao,
  EstadoDoAgendamento,
} from "../../src/repeticao/algoritmo.ts";
import { sm2 } from "../../src/repeticao/sm2.ts";

const AGORA = new Date("2026-01-01T12:00:00.000Z");
const DIA_EM_MS = 86_400_000;

interface DadosDoPasso {
  readonly repeticoes: number;
  readonly facilidade: number;
  readonly intervaloEmDias: number;
}

interface Passo {
  readonly dados: DadosDoPasso;
  readonly proximaRevisaoEm: Date;
}

/** Roda a sequência a partir de um Cartão novo (null), encadeando `agora`. */
function sequencia(
  avaliacoes: readonly Avaliacao[],
  inicio: Date = AGORA,
): Passo[] {
  const passos: Passo[] = [];
  let estado: EstadoDoAgendamento | null = null;
  let agora = inicio;
  for (const avaliacao of avaliacoes) {
    const resultado = sm2.avaliar(estado, avaliacao, agora);
    estado = resultado.estado;
    agora = resultado.proximaRevisaoEm;
    passos.push({
      dados: resultado.estado.dados as DadosDoPasso,
      proximaRevisaoEm: resultado.proximaRevisaoEm,
    });
  }
  return passos;
}

/** Confere intervalo, facilidade e data de cada passo (SC-082, R12). */
function confereTabela(
  avaliacoes: readonly Avaliacao[],
  intervalosEsperados: readonly number[],
  facilidadesEsperadas: readonly number[],
): void {
  const passos = sequencia(avaliacoes);
  expect(passos).toHaveLength(avaliacoes.length);
  let diasAcumulados = 0;
  for (let indice = 0; indice < passos.length; indice += 1) {
    const passo = passos[indice]!;
    expect(passo.dados.intervaloEmDias).toBe(intervalosEsperados[indice]);
    expect(passo.dados.facilidade).toBeCloseTo(facilidadesEsperadas[indice]!, 2);
    diasAcumulados += passo.dados.intervaloEmDias;
    expect(passo.proximaRevisaoEm.getTime()).toBe(
      AGORA.getTime() + diasAcumulados * DIA_EM_MS,
    );
  }
}

describe("SM-2 (SC-082, D2, R12)", () => {
  it("bom, bom, bom, bom → intervalos 1, 6, 15, 38 e facilidade 2.5", () => {
    confereTabela(
      ["bom", "bom", "bom", "bom"],
      [1, 6, 15, 38],
      [2.5, 2.5, 2.5, 2.5],
    );
  });

  it("facil, facil, facil → intervalos 1, 6, 17 e facilidade 2.6, 2.7, 2.8", () => {
    confereTabela(["facil", "facil", "facil"], [1, 6, 17], [2.6, 2.7, 2.8]);
  });

  it("bom, bom, errei, bom, bom → intervalos 1, 6, 1, 1, 6 e facilidade 2.5, 2.5, 2.18, 2.18, 2.18", () => {
    confereTabela(
      ["bom", "bom", "errei", "bom", "bom"],
      [1, 6, 1, 1, 6],
      [2.5, 2.5, 2.18, 2.18, 2.18],
    );
  });

  it("dificil, dificil, dificil, dificil → intervalos 1, 6, 12, 23 e facilidade 2.36, 2.22, 2.08, 1.94", () => {
    confereTabela(
      ["dificil", "dificil", "dificil", "dificil"],
      [1, 6, 12, 23],
      [2.36, 2.22, 2.08, 1.94],
    );
  });

  it("errei repetido → intervalo sempre 1 e facilidade até o piso 1.3", () => {
    confereTabela(
      ["errei", "errei", "errei", "errei", "errei"],
      [1, 1, 1, 1, 1],
      [2.18, 1.86, 1.54, 1.3, 1.3],
    );
  });

  it("estado de outro algoritmo é tratado como Cartão novo (FR-187)", () => {
    const deOutroAlgoritmo: EstadoDoAgendamento = {
      algoritmo: "fsrs",
      versao: 1,
      dados: { repeticoes: 9, facilidade: 3.1, intervaloEmDias: 90 },
    };
    const resultado = sm2.avaliar(deOutroAlgoritmo, "bom", AGORA);
    expect(resultado.estado.dados).toEqual({
      repeticoes: 1,
      facilidade: 2.5,
      intervaloEmDias: 1,
    });
    expect(resultado.proximaRevisaoEm.getTime()).toBe(
      AGORA.getTime() + DIA_EM_MS,
    );
  });

  it("estado de outra versão é tratado como Cartão novo (FR-187)", () => {
    const deOutraVersao: EstadoDoAgendamento = {
      algoritmo: "sm2",
      versao: 2,
      dados: { repeticoes: 4, facilidade: 2.4, intervaloEmDias: 40 },
    };
    const resultado = sm2.avaliar(deOutraVersao, "bom", AGORA);
    expect(resultado.estado.dados).toEqual({
      repeticoes: 1,
      facilidade: 2.5,
      intervaloEmDias: 1,
    });
  });

  it("é pura: mesma entrada produz a mesma saída e não muta o estado (FR-187)", () => {
    const estado: EstadoDoAgendamento = {
      algoritmo: "sm2",
      versao: 1,
      dados: { repeticoes: 2, facilidade: 2.5, intervaloEmDias: 6 },
    };
    const antes = JSON.parse(JSON.stringify(estado));
    const primeira = sm2.avaliar(estado, "bom", AGORA);
    const segunda = sm2.avaliar(estado, "bom", AGORA);
    expect(segunda.proximaRevisaoEm.getTime()).toBe(
      primeira.proximaRevisaoEm.getTime(),
    );
    expect(segunda.estado.dados).toEqual(primeira.estado.dados);
    expect(JSON.parse(JSON.stringify(estado))).toEqual(antes);
  });

  it("respeita o piso de facilidade 1.3 (R12)", () => {
    const passos = sequencia([
      "errei",
      "errei",
      "errei",
      "errei",
      "errei",
      "errei",
      "errei",
    ]);
    for (const passo of passos) {
      expect(passo.dados.facilidade).toBeGreaterThanOrEqual(1.3);
    }
    expect(passos[passos.length - 1]!.dados.facilidade).toBe(1.3);
  });
});
