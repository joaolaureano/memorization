// Migração 22: Conta de teste (030, data-model).
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { aplicarMigracoes } from "../../src/armazenamento/sqlite/esquema.ts";
import { MIGRACOES } from "../../src/armazenamento/sqlite/migracoes.ts";
import {
  contarLinhas,
  gravarBaralho,
  gravarCartao,
  gravarDono,
  gravarVinculo,
} from "./banco-de-teste.ts";

/**
 * T005 — migração 22 do Adapter local (030, data-model "Migração 22"): colunas
 * de Conta de teste, índice parcial e tabela `criacao_de_conta_de_teste`.
 *
 * Como as demais provas de migração, as asserções inspecionam as tabelas do
 * SQLite: é o comportamento do esquema que está sob verificação.
 */

function versao(banco: DatabaseSync): number {
  return Number(
    banco.prepare("SELECT versao FROM versao_do_esquema").get()?.versao,
  );
}

/** Base na versão 21, com chaves estrangeiras ligadas e um dono com dados. */
function baseNaVersao21(): DatabaseSync {
  const banco = new DatabaseSync(":memory:");
  banco.exec("PRAGMA foreign_keys = ON;");
  aplicarMigracoes(
    banco,
    MIGRACOES.filter((migracao) => migracao.versao <= 21),
  );
  const dono = gravarDono(banco);
  gravarBaralho(banco, dono, "b1");
  gravarCartao(banco, dono, "c1");
  banco
    .prepare(
      "INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave) VALUES ('c1', 'b1', 'to walk')",
    )
    .run();
  return banco;
}

/** Fotografa as linhas que a migração precisa preservar. */
function fotografar(banco: DatabaseSync) {
  return {
    usuarios: banco.prepare("SELECT id, nome_de_usuario FROM usuario ORDER BY id").all(),
    baralhos: banco.prepare("SELECT id, nome, usuario_id FROM baralho ORDER BY id").all(),
    cartoes: banco
      .prepare("SELECT id, frente, verso, usuario_id, tipo FROM cartao ORDER BY id")
      .all(),
    pertencimentos: banco
      .prepare("SELECT cartao_id, baralho_id, frente_chave FROM pertencimento ORDER BY cartao_id")
      .all(),
  };
}

/** Lista as colunas de um índice, na ordem em que o índice as usa. */
function colunasDoIndice(banco: DatabaseSync, nome: string): string[] {
  return (banco.prepare(`PRAGMA index_info(${nome})`).all() as { name: string }[]).map(
    (coluna) => coluna.name,
  );
}

/** Lista os índices de uma tabela, com a marca de índice parcial. */
function indicesDaTabela(banco: DatabaseSync, tabela: string) {
  return banco.prepare(`PRAGMA index_list(${tabela})`).all() as {
    name: string;
    partial: number;
  }[];
}

describe("migração 22 — Conta de teste (SQLite)", () => {
  it("preserva as linhas da v21 e acrescenta as colunas com NULL e 0 aos usuários existentes", () => {
    const banco = baseNaVersao21();
    const antes = fotografar(banco);

    aplicarMigracoes(banco, MIGRACOES);

    expect(versao(banco)).toBe(23);
    expect(fotografar(banco)).toEqual(antes);
    expect(
      banco
        .prepare("SELECT conta_de_teste_em, envios_de_teste FROM usuario WHERE id = 'dono-um'")
        .get(),
    ).toEqual({ conta_de_teste_em: null, envios_de_teste: 0 });
    expect(
      (banco.prepare("PRAGMA table_info(usuario)").all() as { name: string; type: string; notnull: number; dflt_value: string | null }[])
        .filter((coluna) => ["conta_de_teste_em", "envios_de_teste"].includes(coluna.name))
        .map(({ name, type, notnull, dflt_value }) => ({ name, type, notnull, dflt_value })),
    ).toEqual([
      { name: "conta_de_teste_em", type: "TEXT", notnull: 0, dflt_value: null },
      { name: "envios_de_teste", type: "INTEGER", notnull: 1, dflt_value: "0" },
    ]);
    expect(banco.prepare("PRAGMA foreign_key_check").all()).toEqual([]);

    banco.close();
  });

  it("cria um único índice parcial sobre conta_de_teste_em (data-model, Migração 22)", () => {
    const banco = baseNaVersao21();

    aplicarMigracoes(banco, MIGRACOES);

    const parciais = indicesDaTabela(banco, "usuario").filter((indice) => indice.partial === 1);
    expect(parciais.map((indice) => colunasDoIndice(banco, indice.name))).toEqual([
      ["conta_de_teste_em"],
    ]);
    const sql = banco
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?")
      .get(parciais[0]?.name ?? "");
    expect(String(sql?.sql)).toMatch(/WHERE conta_de_teste_em IS NOT NULL/);

    banco.close();
  });

  it("cria a tabela criacao_de_conta_de_teste com o índice (origem_hmac, criado_em)", () => {
    const banco = baseNaVersao21();

    aplicarMigracoes(banco, MIGRACOES);

    expect(
      (banco.prepare("PRAGMA table_info(criacao_de_conta_de_teste)").all() as { name: string; type: string; notnull: number }[])
        .map(({ name, type, notnull }) => ({ name, type, notnull })),
    ).toEqual([
      { name: "origem_hmac", type: "TEXT", notnull: 1 },
      { name: "criado_em", type: "TEXT", notnull: 1 },
    ]);
    expect(
      indicesDaTabela(banco, "criacao_de_conta_de_teste").map((indice) =>
        colunasDoIndice(banco, indice.name),
      ),
    ).toContainEqual(["origem_hmac", "criado_em"]);

    banco.close();
  });

  it("com a transição de Pertencimento pendente, a 22 roda e a 23 espera; vinculo fica", () => {
    const banco = baseNaVersao20ComTransicaoPendente();
    const antes = fotografar(banco);

    aplicarMigracoes(banco, MIGRACOES);

    expect(versao(banco)).toBe(22);
    expect(versao(banco)).toBeLessThan(23);
    expect(tabelaExiste(banco, "criacao_de_conta_de_teste")).toBe(true);
    expect(colunasDaTabela(banco, "usuario")).toEqual(
      expect.arrayContaining(["conta_de_teste_em", "envios_de_teste"]),
    );
    expect(tabelaExiste(banco, "vinculo")).toBe(true);
    expect(contarLinhas(banco, "vinculo")).toBe(1);
    expect(fotografar(banco)).toEqual(antes);

    banco.close();
  });

  it("concluída a transição, a nova aplicação chega à 23, remove vinculo e preserva os dados", () => {
    const banco = baseNaVersao20ComTransicaoPendente();
    aplicarMigracoes(banco, MIGRACOES);
    concluirTransicao(banco);
    const antes = fotografar(banco);

    aplicarMigracoes(banco, MIGRACOES);

    expect(versao(banco)).toBe(23);
    expect(tabelaExiste(banco, "vinculo")).toBe(false);
    expect(tabelaExiste(banco, "pertencimento")).toBe(true);
    expect(fotografar(banco)).toEqual(antes);
    expect(banco.prepare("PRAGMA foreign_key_check").all()).toEqual([]);

    banco.close();
  });

  it("base na 22 com a transição concluída chega à 23 sem alterar nenhuma linha", () => {
    const banco = baseNaVersao20ComTransicaoPendente();
    concluirTransicao(banco);
    aplicarMigracoes(
      banco,
      MIGRACOES.filter((migracao) => migracao.versao <= 22),
    );
    expect(versao(banco)).toBe(22);
    expect(tabelaExiste(banco, "vinculo")).toBe(false);
    const antes = fotografar(banco);
    const contasAntes = banco
      .prepare("SELECT id, conta_de_teste_em, envios_de_teste FROM usuario ORDER BY id")
      .all();

    aplicarMigracoes(banco, MIGRACOES);

    expect(versao(banco)).toBe(23);
    expect(fotografar(banco)).toEqual(antes);
    expect(
      banco
        .prepare("SELECT id, conta_de_teste_em, envios_de_teste FROM usuario ORDER BY id")
        .all(),
    ).toEqual(contasAntes);

    banco.close();
  });
});

/**
 * Base na versão 20 com um Cartão sem Pertencimento: a transição está pendente.
 * O Cartão e o Vínculo entram antes da 14, senão a finalização da transição
 * (que não tem Cartões pendentes numa base vazia) já teria removido `vinculo`.
 */
function baseNaVersao20ComTransicaoPendente(): DatabaseSync {
  const banco = new DatabaseSync(":memory:");
  banco.exec("PRAGMA foreign_keys = ON;");
  aplicarMigracoes(
    banco,
    MIGRACOES.filter((migracao) => migracao.versao <= 13),
  );
  const dono = gravarDono(banco);
  gravarBaralho(banco, dono, "b1");
  gravarCartao(banco, dono, "c1");
  gravarVinculo(banco, "c1", "b1");
  aplicarMigracoes(
    banco,
    MIGRACOES.filter((migracao) => migracao.versao <= 20),
  );
  return banco;
}

/** Dá Pertencimento a todos os Cartões que ainda não têm, concluindo a transição. */
function concluirTransicao(banco: DatabaseSync): void {
  banco.exec(`
    INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave)
    SELECT id, 'b1', id FROM cartao
     WHERE id NOT IN (SELECT cartao_id FROM pertencimento);
  `);
}

function tabelaExiste(banco: DatabaseSync, nome: string): boolean {
  return (
    banco
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(nome) !== undefined
  );
}

function colunasDaTabela(banco: DatabaseSync, tabela: string): string[] {
  return (banco.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[]).map(
    (coluna) => coluna.name,
  );
}
