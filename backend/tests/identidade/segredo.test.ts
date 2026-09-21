import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  COMPRIMENTO_MINIMO_DO_SEGREDO,
  segredoConfigurado,
  SegredoAusenteError,
  VARIAVEL_DO_SEGREDO,
} from "../../src/identidade/segredo.ts";

/**
 * T602 — a aplicação recusa iniciar sem o segredo do servidor, e o faz sem
 * repetir o valor (FR-077, SC-024).
 *
 * `segredoConfigurado` é a única porta pela qual o ambiente fornece o segredo: o
 * Module `Identidade` o recebe pronto pela Interface, e nenhum Module lê
 * `process.env`. Os casos aqui são da função, com o ambiente passado por
 * parâmetro — inclusive o valor **gerado** desta execução, que serve para
 * provar que um segredo válido é devolvido exatamente como veio, e que uma
 * recusa nunca o repete.
 */

/** O segredo descartável desta execução: nunca literal, nunca versionado. */
const SEGREDO_VALIDO = randomBytes(48).toString("base64url");

describe("segredo configurado", () => {
  it("devolve o segredo informado quando ele alcança o comprimento mínimo", () => {
    expect(
      segredoConfigurado({ [VARIAVEL_DO_SEGREDO]: SEGREDO_VALIDO }),
    ).toBe(SEGREDO_VALIDO);
  });

  it("aceita o segredo com exatamente o comprimento mínimo", () => {
    const segredo = randomBytes(32).toString("hex").slice(
      0,
      COMPRIMENTO_MINIMO_DO_SEGREDO,
    );

    expect(segredo).toHaveLength(COMPRIMENTO_MINIMO_DO_SEGREDO);
    expect(segredoConfigurado({ [VARIAVEL_DO_SEGREDO]: segredo })).toBe(segredo);
  });

  it("recusa nomeando a variável e a regra quando ela não foi informada", () => {
    let recusado: unknown;

    try {
      segredoConfigurado({});
    } catch (erro) {
      recusado = erro;
    }

    expect(recusado).toBeInstanceOf(SegredoAusenteError);

    const mensagem = (recusado as Error).message;

    expect(mensagem).toContain(VARIAVEL_DO_SEGREDO);
    expect(mensagem).toContain(String(COMPRIMENTO_MINIMO_DO_SEGREDO));
  });

  it("recusa a variável vazia como se ela não tivesse sido informada", () => {
    expect(() => segredoConfigurado({ [VARIAVEL_DO_SEGREDO]: "" })).toThrow(
      SegredoAusenteError,
    );
  });

  it("recusa, sem repetir o valor, um segredo curto demais", () => {
    const curto = "curto";

    let recusado: unknown;

    try {
      segredoConfigurado({ [VARIAVEL_DO_SEGREDO]: curto });
    } catch (erro) {
      recusado = erro;
    }

    expect(recusado).toBeInstanceOf(SegredoAusenteError);

    const mensagem = (recusado as Error).message;

    expect(mensagem).toContain(VARIAVEL_DO_SEGREDO);
    expect(mensagem).toContain(String(COMPRIMENTO_MINIMO_DO_SEGREDO));
    expect(mensagem).not.toContain(curto);
  });

  it("recusa um segredo válido por um caractere, sem repetir o valor", () => {
    const quase =
      SEGREDO_VALIDO.slice(0, COMPRIMENTO_MINIMO_DO_SEGREDO - 1) || "x";

    let recusado: unknown;

    try {
      segredoConfigurado({ [VARIAVEL_DO_SEGREDO]: quase });
    } catch (erro) {
      recusado = erro;
    }

    expect(recusado).toBeInstanceOf(SegredoAusenteError);
    expect((recusado as Error).message).not.toContain(quase);
  });
});
