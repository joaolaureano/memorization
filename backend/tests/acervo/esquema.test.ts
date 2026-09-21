import type { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { abrirBanco } from "../../src/acervo/esquema.ts";

/**
 * T004 — o esquema criado na primeira execução. Os testes abrem SQLite em
 * memória e exercitam as restrições diretamente, porque é a rede de segurança
 * do banco que está sob verificação; as operações `criarCartao`/`listarCartoes`
 * são de T005 e não são usadas aqui.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";
const LIMITE = 1000;

let banco: DatabaseSync;

function inserir(id: string, frente: string, verso: string): void {
  banco
    .prepare("INSERT INTO cartao (id, frente, verso) VALUES (?, ?, ?)")
    .run(id, frente, verso);
}

/** Cria a mensagem de recusa esperada do SQLite, qualquer que seja a coluna. */
function recusaPorCheck(coluna: string): RegExp {
  return new RegExp(
    `CHECK constraint failed: length\\(trim\\(${coluna}\\)\\)\\s*> 0`,
  );
}

beforeEach(() => {
  banco = abrirBanco(":memory:");
});

afterEach(() => {
  banco.close();
});

describe("criação do esquema", () => {
  it("cria a tabela cartao na primeira execução", () => {
    const tabela = banco
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get("cartao");

    expect(tabela).toEqual({ name: "cartao" });
  });

  it("liga PRAGMA foreign_keys na conexão", () => {
    const pragma = banco.prepare("PRAGMA foreign_keys").get();

    expect(pragma?.foreign_keys).toBe(1);
  });

  it("aceita um Cartão válido e o devolve na leitura", () => {
    inserir("c1", FRENTE_VALIDA, VERSO_VALIDO);

    const lido = banco
      .prepare("SELECT id, frente, verso FROM cartao WHERE id = ?")
      .get("c1");

    expect(lido).toEqual({
      id: "c1",
      frente: FRENTE_VALIDA,
      verso: VERSO_VALIDO,
    });
  });

  it("aceita Frente repetida, porque a Frente não é identificador", () => {
    inserir("c1", FRENTE_VALIDA, VERSO_VALIDO);
    inserir("c2", FRENTE_VALIDA, "Andar");

    const total = banco
      .prepare("SELECT count(*) AS total FROM cartao WHERE frente = ?")
      .get(FRENTE_VALIDA);

    expect(total?.total).toBe(2);
  });
});

describe("restrição de Frente", () => {
  it("recusa Frente vazia", () => {
    expect(() => inserir("c1", "", VERSO_VALIDO)).toThrow(
      recusaPorCheck("frente"),
    );
  });

  it("recusa Frente composta só de espaços", () => {
    expect(() => inserir("c1", "   ", VERSO_VALIDO)).toThrow(
      recusaPorCheck("frente"),
    );
  });

  it("recusa Frente acima de 1000 caracteres", () => {
    expect(() => inserir("c1", "a".repeat(LIMITE + 1), VERSO_VALIDO)).toThrow(
      recusaPorCheck("frente"),
    );
  });

  it("aceita Frente exatamente no limite de 1000 caracteres", () => {
    inserir("c1", "a".repeat(LIMITE), VERSO_VALIDO);

    const lido = banco.prepare("SELECT frente FROM cartao WHERE id = ?").get("c1");

    expect(lido?.frente).toHaveLength(LIMITE);
  });
});

describe("restrição de Verso", () => {
  it("recusa Verso vazio", () => {
    expect(() => inserir("c1", FRENTE_VALIDA, "")).toThrow(
      recusaPorCheck("verso"),
    );
  });

  it("recusa Verso composto só de espaços", () => {
    expect(() => inserir("c1", FRENTE_VALIDA, "   ")).toThrow(
      recusaPorCheck("verso"),
    );
  });

  it("recusa Verso acima de 1000 caracteres", () => {
    expect(() => inserir("c1", FRENTE_VALIDA, "a".repeat(LIMITE + 1))).toThrow(
      recusaPorCheck("verso"),
    );
  });

  it("aceita Verso exatamente no limite de 1000 caracteres", () => {
    inserir("c1", FRENTE_VALIDA, "a".repeat(LIMITE));

    const lido = banco.prepare("SELECT verso FROM cartao WHERE id = ?").get("c1");

    expect(lido?.verso).toHaveLength(LIMITE);
  });
});
