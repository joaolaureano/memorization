import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  abrirBanco,
  aplicarMigracoes,
} from "../../src/armazenamento/sqlite/esquema.ts";
import { MIGRACOES } from "../../src/armazenamento/sqlite/migracoes.ts";

/**
 * T601 — a migração 4 cria a tabela `usuario` preservando a base instalada da
 * feature `006`.
 *
 * O cenário central reconstrói uma base **já instalada**: `cartao`, `baralho` e
 * `vinculo` na versão 3, com Cartões, Baralhos e Vínculos reais gravados. A
 * reabertura pelo Adapter do armazenamento local aplica a migração 4, e nada do
 * que existia é perdido (FR-040). Reabrir de novo não reaplica nada: a
 * comparação é pela versão registrada, e reaplicar o `CREATE TABLE` falharia.
 *
 * As restrições são verificadas direto no SQLite em memória, porque é a rede de
 * segurança do banco que está sob verificação: a `CHECK` recusa Nome de usuário
 * com 2 e com 51 caracteres, com acento e com espaço (FR-073); o
 * `UNIQUE COLLATE NOCASE` recusa `ana.silva` depois de `Ana.Silva` (FR-074,
 * SC-025); e a `CHECK` recusa `sal` com 15 bytes, exigindo exatamente 16
 * (FR-076). A tabela não tem coluna além das cinco do data model — nenhuma
 * delas consegue guardar a Senha.
 */

/** A versão corrente do esquema, derivada da lista de migrações. */
const VERSAO_CORRENTE =
  MIGRACOES[MIGRACOES.length - 1]?.versao ?? 0;

/** Versão registrada na tabela de controle; 0 quando a base não tem linha. */
function versaoAtual(banco: DatabaseSync): number {
  const linha = banco.prepare("SELECT versao FROM versao_do_esquema").get();

  return linha === undefined ? 0 : Number(linha.versao);
}

/** Diz se a tabela existe, consultando o catálogo do SQLite. */
function existeTabela(banco: DatabaseSync, nome: string): boolean {
  return (
    banco
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(nome) !== undefined
  );
}

/** Cria a mensagem de recusa esperada do SQLite para a CHECK de tamanho. */
function recusaPorTamanhoDoNome(): RegExp {
  return /CHECK constraint failed: length\(nome_de_usuario\) BETWEEN 3 AND 50/;
}

/** Cria a mensagem de recusa esperada do SQLite para a CHECK de alfabeto. */
function recusaPorAlfabeto(): RegExp {
  return /CHECK constraint failed: nome_de_usuario NOT GLOB/;
}

describe("migração 4 — base instalada da feature 006 com dados reais", () => {
  it("cria usuario preservando Cartões, Baralhos e Vínculos, sem reaplicar a migração", () => {
    const diretorio = mkdtempSync(join(tmpdir(), "identidade-usuario-"));

    try {
      const caminho = join(diretorio, "banco.sqlite");

      /** O que a feature 006 deixou instalado: versão 3, com os três dados. */
      let banco = new DatabaseSync(caminho);

      try {
        aplicarMigracoes(banco, MIGRACOES.slice(0, 3));
        banco
          .prepare("INSERT INTO cartao (id, frente, verso) VALUES (?, ?, ?)")
          .run("c1", "To walk", "Caminhar");
        banco
          .prepare("INSERT INTO cartao (id, frente, verso) VALUES (?, ?, ?)")
          .run("c2", "To read", "Ler");
        banco
          .prepare("INSERT INTO baralho (id, nome) VALUES (?, ?)")
          .run("b1", "Inglês");
        banco
          .prepare("INSERT INTO vinculo (cartao_id, baralho_id) VALUES (?, ?)")
          .run("c1", "b1");
      } finally {
        banco.close();
      }

      /** A reabertura migra até a versão corrente, criando só a tabela nova. */
      banco = abrirBanco(caminho);

      try {
        expect(versaoAtual(banco)).toBe(VERSAO_CORRENTE);
        expect(existeTabela(banco, "usuario")).toBe(true);

        expect(banco.prepare("SELECT count(*) AS total FROM cartao").get()?.total)
          .toBe(2);
        expect(
          banco.prepare("SELECT id, nome FROM baralho ORDER BY id").all(),
        ).toEqual([{ id: "b1", nome: "Inglês" }]);
        expect(
          banco
            .prepare("SELECT cartao_id, baralho_id FROM vinculo")
            .all(),
        ).toEqual([{ cartao_id: "c1", baralho_id: "b1" }]);
      } finally {
        banco.close();
      }

      /** Reabrir de novo não reaplica a migração 4 nem perde nada. */
      banco = abrirBanco(caminho);

      try {
        expect(versaoAtual(banco)).toBe(VERSAO_CORRENTE);
        expect(existeTabela(banco, "usuario")).toBe(true);
        expect(banco.prepare("SELECT count(*) AS total FROM cartao").get()?.total)
          .toBe(2);
        expect(
          banco.prepare("SELECT count(*) AS total FROM baralho").get()?.total,
        ).toBe(1);
        expect(
          banco.prepare("SELECT count(*) AS total FROM vinculo").get()?.total,
        ).toBe(1);
      } finally {
        banco.close();
      }
    } finally {
      rmSync(diretorio, { recursive: true, force: true });
    }
  });
});

let banco: DatabaseSync;

function inserirUsuario(
  id: string,
  nomeDeUsuario: string,
  sal: Uint8Array = new Uint8Array(16),
): void {
  banco
    .prepare(
      `INSERT INTO usuario (id, nome_de_usuario, sal, hash, parametros)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, nomeDeUsuario, sal, new Uint8Array(64), '{"algoritmo":"scrypt"}');
}

beforeEach(() => {
  banco = abrirBanco(":memory:");
});

afterEach(() => {
  banco.close();
});

describe("tabela usuario — forma do esquema", () => {
  it("tem exatamente id, nome_de_usuario, sal, hash e parametros", () => {
    const colunas = banco.prepare("PRAGMA table_info(usuario)").all();

    expect(colunas.map((coluna) => coluna.name)).toEqual([
      "id",
      "nome_de_usuario",
      "sal",
      "hash",
      "parametros",
    ]);
    expect(colunas[0]).toMatchObject({ name: "id", type: "TEXT", pk: 1 });
    expect(colunas[1]).toMatchObject({
      name: "nome_de_usuario",
      type: "TEXT",
      notnull: 1,
    });
    expect(colunas[2]).toMatchObject({
      name: "sal",
      type: "BLOB",
      notnull: 1,
    });
    expect(colunas[3]).toMatchObject({ name: "hash", type: "BLOB", notnull: 1 });
    expect(colunas[4]).toMatchObject({
      name: "parametros",
      type: "TEXT",
      notnull: 1,
    });
  });

  it("não tem coluna capaz de guardar a Senha, nem derivada dela", () => {
    const sql = banco
      .prepare("SELECT sql FROM sqlite_master WHERE name = ?")
      .get("usuario")?.sql as string;

    expect(sql).not.toMatch(/senha|password/i);
    expect(sql).not.toMatch(/forca|comprimento_da_senha/i);
  });
});

describe("tabela usuario — restrições de Nome de usuário", () => {
  it("recusa Nome de usuário com 2 caracteres", () => {
    expect(() => inserirUsuario("u1", "ab")).toThrow(recusaPorTamanhoDoNome());
  });

  it("recusa Nome de usuário com 51 caracteres", () => {
    expect(() => inserirUsuario("u1", "a".repeat(51))).toThrow(
      recusaPorTamanhoDoNome(),
    );
  });

  it("recusa Nome de usuário com acento", () => {
    expect(() => inserirUsuario("u1", "josé")).toThrow(recusaPorAlfabeto());
  });

  it("recusa Nome de usuário com espaço", () => {
    expect(() => inserirUsuario("u1", "ana silva")).toThrow(recusaPorAlfabeto());
  });

  it("aceita Nome de usuário com exatamente 3 e 50 caracteres", () => {
    inserirUsuario("u1", "abc");
    inserirUsuario("u2", "a".repeat(50));

    expect(banco.prepare("SELECT count(*) AS total FROM usuario").get()?.total)
      .toBe(2);
  });

  it("recusa ana.silva depois de Ana.Silva: a unicidade não distingue maiúsculas", () => {
    inserirUsuario("u1", "Ana.Silva");

    expect(() => inserirUsuario("u2", "ana.silva")).toThrow(
      /UNIQUE constraint failed: usuario\.nome_de_usuario/,
    );
    expect(() => inserirUsuario("u3", "ANA.SILVA")).toThrow(
      /UNIQUE constraint failed: usuario\.nome_de_usuario/,
    );

    /** A coluna é `COLLATE NOCASE`: a leitura também ignora a caixa. */
    const lido = banco
      .prepare("SELECT id FROM usuario WHERE nome_de_usuario = ?")
      .get("ANA.silva");

    expect(lido?.id).toBe("u1");
    expect(banco.prepare("SELECT count(*) AS total FROM usuario").get()?.total)
      .toBe(1);
  });
});

describe("tabela usuario — restrição de sal", () => {
  it("recusa sal com 15 bytes", () => {
    expect(() => inserirUsuario("u1", "ana.silva", new Uint8Array(15))).toThrow(
      /CHECK constraint failed: length\(sal\) = 16/,
    );
  });

  it("recusa sal com 17 bytes", () => {
    expect(() => inserirUsuario("u1", "ana.silva", new Uint8Array(17))).toThrow(
      /CHECK constraint failed: length\(sal\) = 16/,
    );
  });

  it("aceita sal com exatamente 16 bytes", () => {
    inserirUsuario("u1", "ana.silva", new Uint8Array(16));

    const lido = banco.prepare("SELECT sal FROM usuario WHERE id = ?").get("u1");

    expect(lido?.sal).toHaveLength(16);
  });
});
