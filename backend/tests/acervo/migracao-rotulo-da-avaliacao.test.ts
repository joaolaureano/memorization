import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { aplicarMigracoes } from "../../src/armazenamento/sqlite/esquema.ts";
import { MIGRACOES } from "../../src/armazenamento/sqlite/migracoes.ts";
import { gravarDono } from "./banco-de-teste.ts";

/**
 * A migração 12 adiciona o campo `avaliacao_rotulo` à tabela
 * `item_de_registro`. O campo armazena o rótulo de exibição da avaliação
 * (e.g. "Bom" para "bom", "Difícil" para "dificil"), fazendo o preenchimento
 * retroativo para itens com avaliação existente. Itens anteriores à 015 sem
 * avaliação continuam com `avaliacao_rotulo` nulo.
 */

interface LinhaDeItem {
  registro_id: string;
  posicao: number;
  frente: string;
  verso: string;
  resultado: "acertou" | "errou";
  cartao_id: string | null;
  avaliacao: string | null;
  avaliacao_rotulo: string | null;
}

function abrirBanco(ateAVersao: number): DatabaseSync {
  const banco = new DatabaseSync(":memory:");

  aplicarMigracoes(
    banco,
    MIGRACOES.filter((migracao) => migracao.versao <= ateAVersao),
  );
  banco.exec("PRAGMA foreign_keys = ON;");

  return banco;
}

function versaoAtual(banco: DatabaseSync): number {
  const linha = banco.prepare("SELECT versao FROM versao_do_esquema").get();

  return linha === undefined ? 0 : Number((linha as { versao: number }).versao);
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
  avaliacao: string | null,
): void {
  banco
    .prepare(
      `INSERT INTO item_de_registro
         (registro_id, posicao, frente, verso, resultado, avaliacao)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      registroId,
      posicao,
      `Frente ${posicao}`,
      `Verso ${posicao}`,
      resultado,
      avaliacao,
    );
}

function itens(banco: DatabaseSync): LinhaDeItem[] {
  return banco
    .prepare("SELECT * FROM item_de_registro ORDER BY registro_id, posicao")
    .all() as unknown as LinhaDeItem[];
}

describe("migração 12 — rótulo da Avaliação", () => {
  it("adiciona a coluna avaliacao_rotulo com preenchimento retroativo", () => {
    const banco = abrirBanco(11);
    const dono = gravarDono(banco, "u1");

    gravarRegistro(banco, "r1", dono, "baralho");
    gravarItem(banco, "r1", 0, "acertou", "errei");
    gravarItem(banco, "r1", 1, "errou", "dificil");
    gravarItem(banco, "r1", 2, "acertou", "bom");
    gravarItem(banco, "r1", 3, "acertou", "facil");
    gravarItem(banco, "r1", 4, "acertou", null);

    aplicarMigracoes(banco, MIGRACOES.slice(0, 12));

    expect(versaoAtual(banco)).toBe(12);

    const itensDepois = itens(banco);

    // Verifica preenchimento dos rótulos de avaliação
    expect(itensDepois[0].avaliacao_rotulo).toBe("Errei");
    expect(itensDepois[1].avaliacao_rotulo).toBe("Difícil");
    expect(itensDepois[2].avaliacao_rotulo).toBe("Bom");
    expect(itensDepois[3].avaliacao_rotulo).toBe("Fácil");
    expect(itensDepois[4].avaliacao_rotulo).toBe(null);

    // Verifica que nenhuma outra coluna foi alterada
    expect(itensDepois[0].registro_id).toBe("r1");
    expect(itensDepois[0].posicao).toBe(0);
    expect(itensDepois[0].resultado).toBe("acertou");
    expect(itensDepois[0].avaliacao).toBe("errei");
    expect(itensDepois[1].resultado).toBe("errou");
    expect(itensDepois[1].avaliacao).toBe("dificil");
  });

  it("é seguida pelas migrações 13 e 14", () => {
    const indice12 = MIGRACOES.findIndex((m) => m.versao === 12);
    const indice13 = MIGRACOES.findIndex((m) => m.versao === 13);
    const indice14 = MIGRACOES.findIndex((m) => m.versao === 14);

    expect(indice12).toBeGreaterThanOrEqual(0);
    expect(indice13).toBe(indice12 + 1);
    expect(indice14).toBe(indice12 + 2);
    expect(MIGRACOES[MIGRACOES.length - 1]?.versao).toBe(14);
  });

  it("mantém a chave estrangeira de item_de_registro apontando para registro_de_sessao", () => {
    const banco = abrirBanco(11);

    aplicarMigracoes(banco, MIGRACOES);

    const tabelas = banco
      .prepare(`SELECT "table" FROM pragma_foreign_key_list('item_de_registro')`)
      .all()
      .map((linha) => String((linha as { table: string }).table));

    expect(tabelas).toContain("registro_de_sessao");
  });
});
