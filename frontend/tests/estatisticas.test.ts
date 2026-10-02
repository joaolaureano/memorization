import { describe, expect, it } from "vitest";

import type { RegistroResumido } from "../src/acervo-cliente/cliente";
import {
  inicioDaJanela,
  itensPorDia,
  taxaDeAcerto,
} from "../src/estatisticas/estatisticas";

/**
 * Módulo puro das Estatísticas (FR-161, FR-162).
 *
 * As provas fixam `agora` numa sexta-feira, 2 de outubro de 2026, para que a
 * janela seja sempre de sábado a sexta e os rótulos possam ser afirmados por
 * extenso. As fronteiras são locais: os instantes são criados com o construtor
 * local de `Date` e convertidos a ISO, que é a forma que o acervo devolve.
 */

/** Sexta-feira, 2 de outubro de 2026, às 15:00, no fuso local. */
const AGORA = new Date(2026, 9, 2, 15, 0, 0, 0);

/** Um Registro de Sessão resumido, com os derivados calculados a partir daqui. */
function registro(
  concluidaEm: Date,
  estudados: number,
  acertos: number,
): RegistroResumido {
  return {
    id: "s1",
    baralhoId: "b1",
    nomeDoBaralho: "Inglês",
    concluidaEm: concluidaEm.toISOString(),
    estudados,
    acertos,
    erros: estudados - acertos,
  };
}

describe("inicioDaJanela", () => {
  it("é a meia-noite local de seis dias atrás, cobrindo hoje e os seis anteriores (FR-162)", () => {
    const inicio = inicioDaJanela(AGORA);

    expect([
      inicio.getFullYear(),
      inicio.getMonth(),
      inicio.getDate(),
    ]).toEqual([2026, 8, 26]);
    expect([
      inicio.getHours(),
      inicio.getMinutes(),
      inicio.getSeconds(),
      inicio.getMilliseconds(),
    ]).toEqual([0, 0, 0, 0]);
  });
});

describe("itensPorDia", () => {
  it("sem registros, devolve os sete dias da janela zerados, do mais antigo ao mais recente (FR-162)", () => {
    const dias = itensPorDia([], AGORA);

    expect(dias.map((dia) => dia.data)).toEqual([
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
    expect(dias.map((dia) => dia.rotulo)).toEqual([
      "sáb",
      "dom",
      "seg",
      "ter",
      "qua",
      "qui",
      "Hoje",
    ]);
    expect(dias.map((dia) => dia.itens)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("soma os Itens estudados de todos os registros de um mesmo dia (FR-162)", () => {
    const dias = itensPorDia(
      [
        registro(new Date(2026, 9, 2, 9, 0), 3, 2),
        registro(new Date(2026, 9, 2, 14, 30), 4, 4),
      ],
      AGORA,
    );

    expect(dias.at(-1)).toEqual({
      data: "2026-10-02",
      rotulo: "Hoje",
      itens: 7,
    });
  });

  it("distribui um registro em cada um dos sete dias da janela (FR-162)", () => {
    const dias = itensPorDia(
      Array.from({ length: 7 }, (_, indice) =>
        registro(new Date(2026, 8, 26 + indice, 12, 0), indice + 1, indice),
      ),
      AGORA,
    );

    expect(dias.map((dia) => dia.itens)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("ignora registros fora da janela, anteriores ou posteriores a ela (FR-162)", () => {
    const dias = itensPorDia(
      [
        registro(new Date(2026, 8, 25, 23, 59), 5, 5),
        registro(new Date(2026, 8, 26, 0, 0), 1, 1),
        registro(new Date(2026, 9, 3, 0, 0), 9, 9),
      ],
      AGORA,
    );

    expect(dias.map((dia) => dia.itens)).toEqual([1, 0, 0, 0, 0, 0, 0]);
  });

  it("separa um registro às 23:59 de um às 00:01 do dia seguinte, pelo fuso local (FR-162)", () => {
    const dias = itensPorDia(
      [
        registro(new Date(2026, 9, 1, 23, 59), 2, 1),
        registro(new Date(2026, 9, 2, 0, 1), 3, 3),
      ],
      AGORA,
    );

    expect(dias[5]).toEqual({ data: "2026-10-01", rotulo: "qui", itens: 2 });
    expect(dias[6]).toEqual({ data: "2026-10-02", rotulo: "Hoje", itens: 3 });
  });

  it("ignora um `concluidaEm` que não é um instante válido", () => {
    const invalido: RegistroResumido = {
      ...registro(AGORA, 4, 4),
      concluidaEm: "não é data",
    };

    expect(itensPorDia([invalido], AGORA).map((dia) => dia.itens)).toEqual([
      0, 0, 0, 0, 0, 0, 0,
    ]);
  });
});

describe("taxaDeAcerto", () => {
  it("devolve null quando não há Itens estudados (FR-161)", () => {
    expect(taxaDeAcerto([])).toBeNull();
    expect(taxaDeAcerto([registro(AGORA, 0, 0)])).toBeNull();
  });

  it("arredonda o percentual de acertos sobre o total estudado (FR-161)", () => {
    expect(taxaDeAcerto([registro(AGORA, 3, 2)])).toBe(67);
    expect(
      taxaDeAcerto([registro(AGORA, 2, 1), registro(AGORA, 2, 2)]),
    ).toBe(75);
    expect(taxaDeAcerto([registro(AGORA, 4, 4)])).toBe(100);
  });
});
