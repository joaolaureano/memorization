import { describe, expect, it } from "vitest";

import { relogioDeTeste } from "../../src/entradas/relogio-de-teste.ts";

describe("relógio de teste da execução local", () => {
  it("sem a variável, não há relógio injetado e vale o real", () => {
    expect(relogioDeTeste({})).toBeUndefined();
    expect(relogioDeTeste({ AGORA_DE_TESTE: "" })).toBeUndefined();
  });

  it("parte do instante informado e anda junto com o relógio real", () => {
    let real = 1_000_000;
    const relogio = relogioDeTeste(
      { AGORA_DE_TESTE: "2026-03-11T15:00:00.000Z" },
      () => real,
    );

    expect(relogio?.().toISOString()).toBe("2026-03-11T15:00:00.000Z");

    real += 90_000;

    expect(relogio?.().toISOString()).toBe("2026-03-11T15:01:30.000Z");
  });

  it("recusa um valor que não é um instante, em vez de rodar com o dia errado", () => {
    expect(() => relogioDeTeste({ AGORA_DE_TESTE: "ontem" })).toThrow(
      /AGORA_DE_TESTE/,
    );
  });
});
