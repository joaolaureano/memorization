import { describe, expect, it } from "vitest";

import {
  ALGORITMO_PADRAO,
  ALGORITMOS,
  algoritmoPorId,
  previa,
} from "../../src/repeticao/algoritmo.ts";
import type { Avaliacao } from "../../src/repeticao/algoritmo.ts";
import { sm2 } from "../../src/repeticao/sm2.ts";

const AGORA = new Date("2026-03-10T08:30:00.000Z");
const DIA_EM_MS = 86_400_000;
const NIVEIS: readonly Avaliacao[] = ["errei", "dificil", "bom", "facil"];

describe("prévia de agendamento (FR-221, SC-090)", () => {
  it("devolve exatamente as quatro chaves de Avaliação (FR-221, SC-090)", () => {
    const resultado = previa(sm2, null, AGORA);
    expect(Object.keys(resultado).sort()).toEqual([...NIVEIS].sort());
  });

  it("cada valor é igual ao resultado de avaliar para o respectivo nível, em ISO (FR-221, SC-090)", () => {
    const estado = sm2.avaliar(null, "bom", AGORA).estado;
    const resultado = previa(sm2, estado, AGORA);
    for (const nivel of NIVEIS) {
      expect(resultado[nivel]).toBe(
        sm2.avaliar(estado, nivel, AGORA).proximaRevisaoEm.toISOString(),
      );
    }
  });

  it("num Cartão novo os quatro níveis caem em hoje + 1 dia (R9, SC-090)", () => {
    const amanha = new Date(AGORA.getTime() + DIA_EM_MS).toISOString();
    expect(previa(sm2, null, AGORA)).toEqual({
      errei: amanha,
      dificil: amanha,
      bom: amanha,
      facil: amanha,
    });
  });
});

describe("registro de algoritmos (FR-187 a FR-191)", () => {
  it("o registro tem apenas o SM-2 (FR-190, FR-191)", () => {
    expect([...ALGORITMOS.keys()]).toEqual(["sm2"]);
    expect(ALGORITMOS.get("sm2")).toBe(sm2);
  });

  it("o algoritmo padrão é sm2 (FR-190)", () => {
    expect(ALGORITMO_PADRAO).toBe("sm2");
    expect(sm2.id).toBe(ALGORITMO_PADRAO);
    expect(sm2.versao).toBe(1);
    expect(sm2.rotulo).toBe("SM-2");
  });

  it("algoritmoPorId desconhecido cai no SM-2 (FR-191)", () => {
    expect(algoritmoPorId("inexistente")).toBe(sm2);
    expect(algoritmoPorId("fsrs")).toBe(sm2);
  });
});
