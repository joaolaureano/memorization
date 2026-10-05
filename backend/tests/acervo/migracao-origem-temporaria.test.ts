import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { aplicarMigracoes } from "../../src/armazenamento/sqlite/esquema.ts";
import { MIGRACOES } from "../../src/armazenamento/sqlite/migracoes.ts";
import { gravarDono } from "./banco-de-teste.ts";

/**
 * A migração 11 amplia `registro_de_sessao.origem` para aceitar `'temporario'`,
 * usado pelo Baralho temporário. O SQLite não altera o `CHECK` de uma coluna
 * existente, então a migração reconstrói as duas tabelas numa transação,
 * copiando as linhas e recriando a chave estrangeira e o índice. As provas
 * abaixo garantem que nada se perdeu no caminho.
 */

function abrirBanco(ateAVersao: number): DatabaseSync {
  const banco = new DatabaseSync(":memory:");

  aplicarMigracoes(
    banco,
    MIGRACOES.filter((migracao) => migracao.versao <= ateAVersao),
  );
  banco.exec("PRAGMA foreign_keys = ON;");

  return banco;
}

function contarLinhas(banco: DatabaseSync, tabela: string): number {
  const linha = banco
    .prepare(`SELECT count(*) AS total FROM ${tabela}`)
    .get() as { total: number };

  return Number(linha.total);
}

function gravarRegistro(
  banco: DatabaseSync,
  id: string,
  usuarioId: string,
  origem: string,
): void {
  banco
    .prepare(
      `INSERT INTO registro_de_sessao
         (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
          estudados, acertos, erros, origem)
       VALUES (?, ?, ?, ?, ?, 1, 1, 0, ?)`,
    )
    .run(id, usuarioId, "b1", "Inglês", "2025-01-01T00:00:00.000Z", origem);
}

function gravarItem(
  banco: DatabaseSync,
  registroId: string,
  posicao: number,
  resultado: string,
  cartaoId: string | null,
  avaliacao: string | null,
): void {
  banco
    .prepare(
      `INSERT INTO item_de_registro
         (registro_id, posicao, frente, verso, resultado, cartao_id, avaliacao)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      registroId,
      posicao,
      `Frente ${posicao}`,
      `Verso ${posicao}`,
      resultado,
      cartaoId,
      avaliacao,
    );
}

function registros(banco: DatabaseSync): unknown[] {
  return banco.prepare("SELECT * FROM registro_de_sessao ORDER BY id").all();
}

function itens(banco: DatabaseSync): unknown[] {
  return banco
    .prepare("SELECT * FROM item_de_registro ORDER BY registro_id, posicao")
    .all();
}

describe("migração 11 — origem 'temporario'", () => {
  it("leva uma base da versão 10 à 11 preservando Registros e Itens", () => {
    const banco = abrirBanco(10);
    const dono = gravarDono(banco, "u1");

    gravarRegistro(banco, "r1", dono, "baralho");
    gravarRegistro(banco, "r2", dono, "revisao");
    gravarItem(banco, "r1", 0, "acertou", null, null);
    gravarItem(banco, "r1", 1, "errou", "c1", "errei");
    gravarItem(banco, "r2", 0, "acertou", null, "bom");

    const registrosAntes = registros(banco);
    const itensAntes = itens(banco);

    aplicarMigracoes(
      banco,
      MIGRACOES.filter((migracao) => migracao.versao <= 11),
    );

    expect(contarLinhas(banco, "registro_de_sessao")).toBe(2);
    expect(contarLinhas(banco, "item_de_registro")).toBe(3);
    expect(registros(banco)).toEqual(registrosAntes);
    expect(itens(banco)).toEqual(itensAntes);
  });

  it("mantém a chave estrangeira de item_de_registro apontando para registro_de_sessao", () => {
    const banco = abrirBanco(10);

    aplicarMigracoes(
      banco,
      MIGRACOES.filter((migracao) => migracao.versao <= 11),
    );

    const tabelas = banco
      .prepare(`SELECT "table" FROM pragma_foreign_key_list('item_de_registro')`)
      .all()
      .map((linha) => String((linha as { table: string }).table));

    expect(tabelas).toContain("registro_de_sessao");
    expect(tabelas).not.toContain("registro_de_sessao_v11");
  });

  it("recria o índice registro_de_sessao_usuario_concluida", () => {
    const banco = abrirBanco(10);

    aplicarMigracoes(
      banco,
      MIGRACOES.filter((migracao) => migracao.versao <= 11),
    );

    const indices = banco
      .prepare("SELECT name FROM pragma_index_list('registro_de_sessao')")
      .all()
      .map((linha) => String((linha as { name: string }).name));

    expect(indices).toContain("registro_de_sessao_usuario_concluida");
  });

  it("excluir o Usuário ainda remove os Registros e os Itens", () => {
    const banco = abrirBanco(10);
    const dono = gravarDono(banco, "u1");

    gravarRegistro(banco, "r1", dono, "baralho");
    gravarItem(banco, "r1", 0, "acertou", null, null);

    aplicarMigracoes(
      banco,
      MIGRACOES.filter((migracao) => migracao.versao <= 11),
    );

    banco.prepare("DELETE FROM usuario WHERE id = ?").run(dono);

    expect(contarLinhas(banco, "registro_de_sessao")).toBe(0);
    expect(contarLinhas(banco, "item_de_registro")).toBe(0);
  });

  it("aceita origem 'temporario' e recusa 'outra'", () => {
    const banco = abrirBanco(10);
    const dono = gravarDono(banco, "u1");

    aplicarMigracoes(
      banco,
      MIGRACOES.filter((migracao) => migracao.versao <= 11),
    );

    expect(() => gravarRegistro(banco, "r1", dono, "temporario")).not.toThrow();
    expect(() => gravarRegistro(banco, "r2", dono, "outra")).toThrow();
    expect(contarLinhas(banco, "registro_de_sessao")).toBe(1);
  });
});
