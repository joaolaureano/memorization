import { describe, expect, it } from "vitest";

import { nomeAcessivelDaAvaliacao, rotuloDaPrevia } from "../src/revisao/dia";

/**
 * Módulo puro do dia (FR-204, FR-221).
 *
 * As provas fixam `agora` numa sexta-feira, 2 de outubro de 2026, e afirmam as
 * fronteiras pelos componentes locais de `Date`: o dia é o do fuso de quem
 * corre a prova, e não o de UTC. Os instantes são criados com o construtor
 * local de `Date` e convertidos a ISO, que é a forma que o acervo devolve.
 */

/** Sexta-feira, 2 de outubro de 2026, às 15:00, no fuso local. */
const AGORA = new Date(2026, 9, 2, 15, 0, 0, 0);

describe("rotuloDaPrevia", () => {
  it("conta zero dias para o próprio dia corrente (FR-221)", () => {
    expect(rotuloDaPrevia(AGORA, new Date(2026, 9, 2, 9, 0).toISOString())).toBe(
      "0 dias",
    );
    expect(
      rotuloDaPrevia(AGORA, new Date(2026, 9, 2, 23, 59).toISOString()),
    ).toBe("0 dias");
  });

  it("um ISO no passado também conta zero dias (FR-221)", () => {
    expect(
      rotuloDaPrevia(AGORA, new Date(2026, 8, 30, 10, 0).toISOString()),
    ).toBe("0 dias");
  });

  it("a mesma hora do dia seguinte é '1 dia' (FR-221)", () => {
    expect(
      rotuloDaPrevia(AGORA, new Date(2026, 9, 3, 15, 0).toISOString()),
    ).toBe("1 dia");
  });

  it("23:59 para 00:01 do dia seguinte ainda é '1 dia': a conta é por dias locais (FR-221)", () => {
    const antesDaMeiaNoite = new Date(2026, 9, 2, 23, 59);
    const depoisDaMeiaNoite = new Date(2026, 9, 3, 0, 1);

    expect(rotuloDaPrevia(antesDaMeiaNoite, depoisDaMeiaNoite.toISOString())).toBe(
      "1 dia",
    );
  });

  it("três dias à frente são '3 dias' (FR-221)", () => {
    expect(
      rotuloDaPrevia(AGORA, new Date(2026, 9, 5, 9, 0).toISOString()),
    ).toBe("3 dias");
  });

  it("trinta e oito dias à frente são '38 dias' (FR-221)", () => {
    expect(
      rotuloDaPrevia(AGORA, new Date(2026, 10, 9, 12, 0).toISOString()),
    ).toBe("38 dias");
  });
});

describe("nomeAcessivelDaAvaliacao", () => {
  it("sem prévia, o nome acessível é só o rótulo (FR-221, FR-218)", () => {
    expect(nomeAcessivelDaAvaliacao("Bom", null)).toBe("Bom");
  });

  it("com prévia, o nome acessível anuncia a próxima revisão (FR-221, FR-218)", () => {
    expect(nomeAcessivelDaAvaliacao("Bom", "1 dia")).toBe(
      "Bom, próxima revisão em 1 dia",
    );
    expect(nomeAcessivelDaAvaliacao("Errei", "0 dias")).toBe(
      "Errei, próxima revisão em 0 dias",
    );
  });
});
