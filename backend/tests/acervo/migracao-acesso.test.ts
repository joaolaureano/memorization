import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { aplicarMigracoes } from "../../src/armazenamento/sqlite/esquema.ts";
import { MIGRACOES } from "../../src/armazenamento/sqlite/migracoes.ts";
import { contarLinhas, gravarCartao, gravarDono } from "./banco-de-teste.ts";

/**
 * A migração 9 — o Acesso temporário (018). É a **9**, porque a 8 da `016` já
 * está aplicada nas bases instaladas (D1). Só cria tabela nova: os dados
 * existentes sobrevivem, e o cascade remove os Acessos com o Usuário (FR-296).
 */

const INSTANTE = "2026-03-01T12:00:00.000Z";

function abrirBanco(ateAVersao: number): DatabaseSync {
  const banco = new DatabaseSync(":memory:");

  aplicarMigracoes(
    banco,
    MIGRACOES.filter((migracao) => migracao.versao <= ateAVersao),
  );
  banco.exec("PRAGMA foreign_keys = ON;");

  return banco;
}

describe("migração 9 — Acesso temporário no SQLite", () => {
  it("é a versão 9 e preserva os dados ao levar a base da 8 à 9", () => {
    const banco = abrirBanco(8);

    const dono = gravarDono(banco, "u1");
    gravarCartao(banco, dono, "c1");

    expect(
      banco
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='acesso_temporario'",
        )
        .all(),
    ).toHaveLength(0);

    aplicarMigracoes(banco, MIGRACOES);

    expect(MIGRACOES[MIGRACOES.length - 1]?.versao).toBe(9);
    expect(
      Number(
        (banco.prepare("SELECT versao FROM versao_do_esquema").get() as {
          versao: number;
        }).versao,
      ),
    ).toBe(9);
    expect(contarLinhas(banco, "cartao")).toBe(1);
    expect(contarLinhas(banco, "acesso_temporario")).toBe(0);
  });

  it("remove os Acessos por cascata ao excluir o Usuário e tem índice por dono", () => {
    const banco = abrirBanco(9);

    gravarDono(banco, "u1");
    gravarDono(banco, "u2", "bruno.souza");

    const inserir = banco.prepare(
      `INSERT INTO acesso_temporario
         (digest, usuario_id, criado_em, expira_em, ultima_acao_em)
       VALUES (?, ?, ?, ?, ?)`,
    );

    inserir.run("d1", "u1", INSTANTE, INSTANTE, INSTANTE);
    inserir.run("d2", "u2", INSTANTE, INSTANTE, INSTANTE);

    banco.prepare("DELETE FROM usuario WHERE id = ?").run("u1");

    expect(contarLinhas(banco, "acesso_temporario")).toBe(1);
    expect(
      banco
        .prepare("PRAGMA index_list('acesso_temporario')")
        .all()
        .map((indice) => indice.name),
    ).toContain("indice_acesso_temporario_por_usuario");
  });
});
