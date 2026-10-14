import { describe, expect, it } from "vitest";

import type { EstadoDoAgendamento } from "../../src/repeticao/algoritmo.ts";
import { algoritmoPorId } from "../../src/repeticao/algoritmo.ts";

describe("descreverProgresso", () => {
  const sm2 = algoritmoPorId("sm2");

  it("descreve Cartão novo e estado compatível sem expor dados", () => {
    expect(sm2.descreverProgresso(null)).toEqual({
      repeticoes: 0,
      intervaloEmDias: 0,
      facilidade: 2.5,
    });
    const estado = sm2.avaliar(null, "bom", new Date("2026-01-01T00:00:00Z")).estado;
    expect(sm2.descreverProgresso(estado)).toEqual({
      repeticoes: 1,
      intervaloEmDias: 1,
      facilidade: 2.5,
    });
  });

  it("trata outro algoritmo ou versão como estado novo", () => {
    const estado: EstadoDoAgendamento = {
      algoritmo: "outro",
      versao: 9,
      dados: { repeticoes: 7, intervaloEmDias: 80, facilidade: 3 },
    };
    expect(sm2.descreverProgresso(estado)).toEqual(sm2.descreverProgresso(null));
  });
});
