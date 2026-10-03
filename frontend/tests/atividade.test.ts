import { describe, expect, it } from "vitest";

import {
  INTERVALO_DE_RENOVACAO_EM_MS,
  decidirRenovacao,
} from "../src/acesso/atividade";

/**
 * T1803 — o throttle puro de `atividade.ts` (018; D3, FR-291, SC-124): a
 * primeira interação sem renovação conhecida renova; depois, no máximo uma
 * renovação a cada 60 s; sem interação, nunca.
 */

const T0 = 1_700_000_000_000;

describe("decidirRenovacao", () => {
  it("o intervalo é de 60 segundos (D3)", () => {
    expect(INTERVALO_DE_RENOVACAO_EM_MS).toBe(60_000);
  });

  it("renova na primeira interação, quando nenhuma renovação é conhecida", () => {
    expect(decidirRenovacao(T0, null)).toBe("renovar");
  });

  it("nunca renova sem interação, por mais antiga que seja a última renovação (FR-294)", () => {
    expect(decidirRenovacao(null, null)).toBe("aguardar");
    expect(decidirRenovacao(null, T0 - 10 * 60_000)).toBe("aguardar");
  });

  it("aguarda enquanto a última renovação tem menos de 60 s", () => {
    expect(decidirRenovacao(T0, T0)).toBe("aguardar");
    expect(decidirRenovacao(T0 + 1, T0)).toBe("aguardar");
    expect(decidirRenovacao(T0 + 59_999, T0)).toBe("aguardar");
  });

  it("renova a partir de 60 s, no instante exato inclusive", () => {
    expect(decidirRenovacao(T0 + 60_000, T0)).toBe("renovar");
    expect(decidirRenovacao(T0 + 61_000, T0)).toBe("renovar");
    expect(decidirRenovacao(T0 + 10 * 60_000, T0)).toBe("renovar");
  });

  it("uma rajada de interações gera no máximo uma renovação por intervalo (SC-124)", () => {
    let ultima: number | null = null;
    let renovacoes = 0;

    // Uma interação a cada 5 s durante 10 minutos.
    for (let instante = T0; instante <= T0 + 10 * 60_000; instante += 5_000) {
      if (decidirRenovacao(instante, ultima) === "renovar") {
        ultima = instante;
        renovacoes += 1;
      }
    }

    // 10 minutos em intervalos de 60 s: a primeira e mais dez.
    expect(renovacoes).toBe(11);
  });

  it("um relógio que anda para trás não dispara renovações", () => {
    expect(decidirRenovacao(T0 - 5_000, T0)).toBe("aguardar");
  });
});
