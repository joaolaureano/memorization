import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { aplicarMigracoes } from "../../src/armazenamento/sqlite/esquema.ts";
import { MIGRACOES } from "../../src/armazenamento/sqlite/migracoes.ts";
import { gravarDono } from "./banco-de-teste.ts";

/**
 * A migração 10 remove o limite de Cartões novos por dia das Preferências: ele
 * só valia para a Revisão do dia, que saiu da aplicação. O algoritmo escolhido
 * por cada Usuário sobrevive.
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

function colunasDasPreferencias(banco: DatabaseSync): string[] {
  return banco
    .prepare("SELECT name FROM pragma_table_info('preferencias')")
    .all()
    .map((linha) => String((linha as { name: string }).name));
}

describe("migração 10 — Preferências sem limite de Cartões novos", () => {
  it("remove a coluna do limite e preserva o algoritmo de cada Usuário", () => {
    const banco = abrirBanco(9);
    const dono = gravarDono(banco, "u1");

    banco
      .prepare(
        `INSERT INTO preferencias (usuario_id, algoritmo, limite_de_novos_por_dia)
         VALUES (?, ?, ?)`,
      )
      .run(dono, "outro", 5);

    expect(colunasDasPreferencias(banco)).toContain("limite_de_novos_por_dia");

    aplicarMigracoes(
      banco,
      MIGRACOES.filter((migracao) => migracao.versao <= 10),
    );

    expect(MIGRACOES.find((migracao) => migracao.versao === 10)).toBeDefined();
    expect(colunasDasPreferencias(banco)).not.toContain(
      "limite_de_novos_por_dia",
    );
    expect(
      banco
        .prepare("SELECT algoritmo FROM preferencias WHERE usuario_id = ?")
        .get(dono),
    ).toEqual({ algoritmo: "outro" });
  });
});
