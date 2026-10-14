import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { aplicarMigracoes } from "../../src/armazenamento/sqlite/esquema.ts";
import { MIGRACOES } from "../../src/armazenamento/sqlite/migracoes.ts";
import { gravarDono } from "./banco-de-teste.ts";

/**
 * T028 — A migração 19 limpa `nome_do_baralho` para registros com origem
 * 'revisao' ou 'temporario', deixando-os vazio para que o rótulo seja derivado
 * pela origem na interface (FR-020, FR-021). Dados apenas, sem mudança de
 * esquema. A migração é idempotente.
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
  nomeDoBaralho: string,
  origem: string,
): void {
  banco
    .prepare(
      `INSERT INTO registro_de_sessao
         (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
          estudados, acertos, erros, origem)
       VALUES (?, ?, ?, ?, ?, 1, 1, 0, ?)`,
    )
    .run(id, usuarioId, "", nomeDoBaralho, "2025-01-01T00:00:00.000Z", origem);
}

function registros(banco: DatabaseSync): unknown[] {
  return banco.prepare("SELECT * FROM registro_de_sessao ORDER BY id").all();
}

describe("migração 19 — nome_do_baralho derivado da origem", () => {
  it("leva uma base da versão 18 à 19 e limpa nome para revisao e temporario", () => {
    const banco = abrirBanco(18);
    const dono = gravarDono(banco, "u1");

    gravarRegistro(banco, "r1", dono, "Revisão do dia", "revisao");
    gravarRegistro(banco, "r2", dono, "Baralho temporário", "temporario");
    gravarRegistro(banco, "r3", dono, "Revisão do dia", "baralho");
    // Nome digitado pela pessoa: Conteúdo do Usuário, nunca apagado (FR-006).
    gravarRegistro(banco, "r4", dono, "Aula de Inglês", "temporario");

    aplicarMigracoes(
      banco,
      MIGRACOES.filter((migracao) => migracao.versao <= 19),
    );

    expect(contarLinhas(banco, "registro_de_sessao")).toBe(4);

    const registrosDepois = registros(banco);

    // Verifica que revisao agora tem nome_do_baralho vazio
    const regRevisao = registrosDepois.find(
      (r) => (r as { id: string }).id === "r1",
    ) as { nome_do_baralho: string } | undefined;
    expect(regRevisao?.nome_do_baralho).toBe("");

    // Verifica que temporario agora tem nome_do_baralho vazio
    const regTemporario = registrosDepois.find(
      (r) => (r as { id: string }).id === "r2",
    ) as { nome_do_baralho: string } | undefined;
    expect(regTemporario?.nome_do_baralho).toBe("");

    // Verifica que baralho mantém seu nome
    const regBaralho = registrosDepois.find(
      (r) => (r as { id: string }).id === "r3",
    ) as { nome_do_baralho: string } | undefined;
    expect(regBaralho?.nome_do_baralho).toBe("Revisão do dia");

    const regDigitado = registrosDepois.find(
      (r) => (r as { id: string }).id === "r4",
    ) as { nome_do_baralho: string } | undefined;
    expect(regDigitado?.nome_do_baralho).toBe("Aula de Inglês");
  });

  it("é idempotente quando rodada duas vezes", () => {
    const banco = abrirBanco(18);
    const dono = gravarDono(banco, "u1");

    gravarRegistro(banco, "r1", dono, "Revisão do dia", "revisao");

    aplicarMigracoes(
      banco,
      MIGRACOES.filter((migracao) => migracao.versao <= 19),
    );

    const registrosAposUma = registros(banco);

    aplicarMigracoes(
      banco,
      MIGRACOES.filter((migracao) => migracao.versao <= 19),
    );

    const registrosAposDuas = registros(banco);

    expect(registrosAposUma).toEqual(registrosAposDuas);
  });
});
