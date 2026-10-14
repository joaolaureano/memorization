import { describe, expect, it } from "vitest";

import { duracaoFalada, formatarDuracao } from "../src/idioma/duracao";

/**
 * T027 (028, FR-441, FR-458, research R7): a duração do Áudio aparece como
 * `m:ss` visível e como frase falada no Idioma da interface, com algarismos e
 * unidades do locale.
 */
describe("formatarDuracao", () => {
  it("formata m:ss com segundos de dois dígitos e minutos sem zero à esquerda", () => {
    expect(formatarDuracao(0, "pt-BR")).toBe("0:00");
    expect(formatarDuracao(5000, "pt-BR")).toBe("0:05");
    expect(formatarDuracao(64000, "pt-BR")).toBe("1:04");
    expect(formatarDuracao(300000, "pt-BR")).toBe("5:00");
  });

  it("descarta a fração de segundo", () => {
    expect(formatarDuracao(64999, "pt-BR")).toBe("1:04");
  });
});

describe("duracaoFalada", () => {
  it("fala minutos e segundos no idioma pedido", () => {
    expect(duracaoFalada(64000, "pt-BR")).toBe("1 minuto e 4 segundos");
    expect(duracaoFalada(64000, "en-US")).toBe("1 minute and 4 seconds");
    expect(duracaoFalada(64000, "es-419")).toBe("1 minuto y 4 segundos");
  });

  it("omite os minutos quando são zero", () => {
    expect(duracaoFalada(5000, "pt-BR")).toBe("5 segundos");
  });

  it("omite os segundos quando são zero e há minutos", () => {
    expect(duracaoFalada(300000, "en-US")).toBe("5 minutes");
  });

  it("fala zero segundos para duração zero, com a forma plural do locale", () => {
    // CLDR pt trata o zero como singular: "0 segundo".
    expect(duracaoFalada(0, "pt-BR")).toBe("0 segundo");
  });
});
