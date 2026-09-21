import type { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { abrirBanco } from "../../src/armazenamento/sqlite/esquema.ts";
import { gravarCartao, gravarDono } from "./banco-de-teste.ts";

/**
 * T004 — o esquema criado na primeira execução. Os testes abrem o arquivo
 * SQLite em memória pelo Adapter do armazenamento local e exercitam as
 * restrições diretamente, porque é a rede de segurança do banco que está sob
 * verificação; as operações `criarCartao`/`listarCartoes` são de T005 e não são
 * usadas aqui.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";
const LIMITE = 1000;

let banco: DatabaseSync;

/**
 * O dono das linhas gravadas direto no banco: todo Cartão pertence a um
 * Usuário, e o esquema exige a linha de `usuario` (FR-092, FR-099).
 */
let dono: string;

function inserir(id: string, frente: string, verso: string): void {
  gravarCartao(banco, dono, id, frente, verso);
}

/** Cria a mensagem de recusa esperada do SQLite, qualquer que seja a coluna. */
function recusaPorCheck(coluna: string): RegExp {
  return new RegExp(
    `CHECK constraint failed: length\\(trim\\(${coluna}\\)\\)\\s*> 0`,
  );
}

beforeEach(() => {
  banco = abrirBanco(":memory:");
  dono = gravarDono(banco);
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

  it("tem exatamente id, frente, verso e usuario_id, com o dono obrigatório e indexado", () => {
    const colunas = banco.prepare("PRAGMA table_info(cartao)").all();

    expect(colunas.map((coluna) => coluna.name)).toEqual([
      "id",
      "frente",
      "verso",
      "usuario_id",
    ]);
    expect(colunas[3]).toMatchObject({
      name: "usuario_id",
      type: "TEXT",
      notnull: 1,
    });

    /** O dono é indexado: é por ele que toda leitura do acervo é restrita. */
    const indices = banco.prepare("PRAGMA index_list(cartao)").all();

    expect(indices.map((indice) => indice.name)).toContain(
      "indice_cartao_por_usuario",
    );
  });

  it("recusa Cartão sem dono: não existe Cartão de ninguém (FR-099)", () => {
    expect(() =>
      banco
        .prepare("INSERT INTO cartao (id, frente, verso) VALUES (?, ?, ?)")
        .run("c1", FRENTE_VALIDA, VERSO_VALIDO),
    ).toThrow();
    expect(() =>
      banco
        .prepare(
          "INSERT INTO cartao (id, frente, verso, usuario_id) VALUES (?, ?, ?, ?)",
        )
        .run("c1", FRENTE_VALIDA, VERSO_VALIDO, "usuario-inexistente"),
    ).toThrow();
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
