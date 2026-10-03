import { describe, expect, it } from "vitest";

import {
  diaDaSemana,
  diasDaSemana,
  ehDataCivilValida,
  ehFusoValido,
  ehSegundaFeira,
  hojeNoFuso,
  segundaFeiraDe,
  somarDias,
} from "../../src/agenda/datas.ts";

describe("ehDataCivilValida (FR-248)", () => {
  it("aceita datas civis existentes", () => {
    expect(ehDataCivilValida("2026-10-03")).toBe(true);
    expect(ehDataCivilValida("2024-02-29")).toBe(true);
  });

  it("recusa datas civis inexistentes", () => {
    expect(ehDataCivilValida("2026-02-31")).toBe(false);
    expect(ehDataCivilValida("2025-02-29")).toBe(false);
    expect(ehDataCivilValida("2026-13-01")).toBe(false);
    expect(ehDataCivilValida("2026-00-10")).toBe(false);
    expect(ehDataCivilValida("2026-04-31")).toBe(false);
  });

  it("recusa o ano zero", () => {
    expect(ehDataCivilValida("0000-01-01")).toBe(false);
  });

  it("recusa textos fora do formato estrito", () => {
    expect(ehDataCivilValida("2026-1-1")).toBe(false);
    expect(ehDataCivilValida("2026-01-01T00:00")).toBe(false);
    expect(ehDataCivilValida("")).toBe(false);
    expect(ehDataCivilValida("abcd-ef-gh")).toBe(false);
    expect(ehDataCivilValida(" 2026-01-01")).toBe(false);
  });
});

describe("ehFusoValido (FR-250)", () => {
  it("aceita fusos IANA utilizáveis", () => {
    expect(ehFusoValido("America/Sao_Paulo")).toBe(true);
    expect(ehFusoValido("UTC")).toBe(true);
    expect(ehFusoValido("Asia/Tokyo")).toBe(true);
  });

  it("recusa fuso vazio, desconhecido ou fora do formato", () => {
    expect(ehFusoValido("")).toBe(false);
    expect(ehFusoValido("Marte/Fobos")).toBe(false);
    expect(ehFusoValido("+03:00")).toBe(false);
    expect(ehFusoValido("lixo")).toBe(false);
    expect(ehFusoValido("America/")).toBe(false);
  });
});

describe("hojeNoFuso (FR-250)", () => {
  const instante = new Date("2026-03-10T01:30:00Z");

  it("projeta a data civil em São Paulo (UTC-3)", () => {
    expect(hojeNoFuso("America/Sao_Paulo", instante)).toBe("2026-03-09");
  });

  it("projeta a data civil em Tóquio", () => {
    expect(hojeNoFuso("Asia/Tokyo", instante)).toBe("2026-03-10");
  });

  it("projeta a data civil em UTC", () => {
    expect(hojeNoFuso("UTC", instante)).toBe("2026-03-10");
  });

  it("respeita a virada do horário de verão em Nova Iorque", () => {
    expect(
      hojeNoFuso("America/New_York", new Date("2026-03-09T03:30:00Z")),
    ).toBe("2026-03-08");

    expect(
      hojeNoFuso("America/New_York", new Date("2026-03-08T04:59:59Z")),
    ).toBe("2026-03-07");
  });

  it("lança Error quando o fuso é inválido", () => {
    expect(() => hojeNoFuso("Marte/Fobos", instante)).toThrow(Error);
  });
});

describe("somarDias (FR-248)", () => {
  it("atravessa o fim de fevereiro", () => {
    expect(somarDias("2026-02-28", 1)).toBe("2026-03-01");
    expect(somarDias("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("anda para trás", () => {
    expect(somarDias("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("atravessa o fim do ano", () => {
    expect(somarDias("2026-12-28", 7)).toBe("2027-01-04");
  });

  it("devolve a própria data quando a soma é zero", () => {
    expect(somarDias("2026-10-03", 0)).toBe("2026-10-03");
  });

  it("atravessa o horário de verão sem encurtar o dia", () => {
    expect(somarDias("2026-03-07", 2)).toBe("2026-03-09");
  });
});

describe("diaDaSemana (FR-248)", () => {
  it("numera a semana de segunda (1) a domingo (7)", () => {
    expect(diaDaSemana("2026-10-05")).toBe(1);
    expect(diaDaSemana("2026-10-04")).toBe(7);
    expect(diaDaSemana("2026-10-03")).toBe(6);
  });
});

describe("segundaFeiraDe (FR-248)", () => {
  it("devolve a segunda-feira da semana ISO", () => {
    expect(segundaFeiraDe("2026-10-03")).toBe("2026-09-28");
    expect(segundaFeiraDe("2026-09-28")).toBe("2026-09-28");
    expect(segundaFeiraDe("2026-10-04")).toBe("2026-09-28");
    expect(segundaFeiraDe("2026-01-01")).toBe("2025-12-29");
  });
});

describe("ehSegundaFeira (FR-248)", () => {
  it("reconhece a segunda-feira", () => {
    expect(ehSegundaFeira("2026-09-28")).toBe(true);
    expect(ehSegundaFeira("2026-10-03")).toBe(false);
  });
});

describe("diasDaSemana (FR-248)", () => {
  it("devolve as sete datas da semana", () => {
    expect(diasDaSemana("2026-09-28")).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
  });

  it("atravessa o fim de mês e de ano", () => {
    expect(diasDaSemana("2026-12-28")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });
});
