import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import {
  aplicarEsquema,
  aplicarMigracoes,
} from "../../src/armazenamento/sqlite/esquema.ts";
import { MIGRACOES } from "../../src/armazenamento/sqlite/migracoes.ts";
import { gravarBaralho, gravarCartao, gravarDono } from "./banco-de-teste.ts";

/**
 * T005 — migração 17 do Adapter local (`026`, FR-403, FR-407, SC-173).
 *
 * Como as demais provas de migração, as asserções inspecionam as tabelas do
 * SQLite: é o comportamento do esquema que está sob verificação.
 */

/** Base na versão 16 com um Cartão, seu Pertencimento, Agendamento e Histórico. */
function baseNaVersao16(): DatabaseSync {
  const banco = new DatabaseSync(":memory:");
  banco.exec("PRAGMA foreign_keys = ON;");
  aplicarMigracoes(
    banco,
    MIGRACOES.filter((migracao) => migracao.versao <= 16),
  );

  const dono = gravarDono(banco);
  gravarBaralho(banco, dono, "b1");
  gravarCartao(banco, dono, "c1", "To walk", "Caminhar");
  banco
    .prepare(
      "INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave) VALUES ('c1', 'b1', 'to walk')",
    )
    .run();
  banco
    .prepare(
      `INSERT INTO agendamento (usuario_id, cartao_id, algoritmo, versao_do_algoritmo, estado,
         proxima_revisao_em, ultima_avaliacao, revisado_em, criado_em)
       VALUES (?, 'c1', 'sm2', 1, '{}', '2026-10-20T00:00:00.000Z', 'bom',
         '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z')`,
    )
    .run(dono);
  banco
    .prepare(
      `INSERT INTO registro_de_sessao (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
         estudados, acertos, erros)
       VALUES ('r1', ?, 'b1', 'Inglês', '2026-10-13T00:00:00.000Z', 1, 1, 0)`,
    )
    .run(dono);
  banco
    .prepare(
      `INSERT INTO item_de_registro (registro_id, posicao, frente, verso, resultado)
       VALUES ('r1', 0, 'To walk', 'Caminhar', 'acertou')`,
    )
    .run();

  return banco;
}

function versao(banco: DatabaseSync): number {
  return Number(
    banco.prepare("SELECT versao FROM versao_do_esquema").get()?.versao,
  );
}

describe("migração 17 — Tipo de cartão", () => {
  it("converte o acervo existente em Frente-Verso sem perder nada (FR-407, SC-173)", () => {
    const banco = baseNaVersao16();

    aplicarEsquema(banco);

    expect(versao(banco)).toBe(21);
    expect(
      banco
        .prepare(
          "SELECT id, frente, verso, tipo, imagem_chave, texto_alternativo FROM cartao",
        )
        .all(),
    ).toEqual([
      {
        id: "c1",
        frente: "To walk",
        verso: "Caminhar",
        tipo: "frente-verso",
        imagem_chave: null,
        texto_alternativo: null,
      },
    ]);
    expect(
      banco.prepare("SELECT cartao_id, baralho_id, frente_chave FROM pertencimento").all(),
    ).toEqual([{ cartao_id: "c1", baralho_id: "b1", frente_chave: "to walk" }]);
    expect(
      banco.prepare("SELECT count(*) AS total FROM agendamento").get()?.total,
    ).toBe(1);
    expect(
      banco.prepare("SELECT tipo FROM item_de_registro").get()?.tipo,
    ).toBe("frente-verso");
    expect(banco.prepare("PRAGMA foreign_keys").get()?.foreign_keys).toBe(1);
    expect(banco.prepare("PRAGMA foreign_key_check").all()).toEqual([]);

    banco.close();
  });

  it("mantém as cascatas: excluir o Cartão remove Pertencimento e Agendamento", () => {
    const banco = baseNaVersao16();
    aplicarEsquema(banco);

    banco.prepare("DELETE FROM cartao WHERE id = 'c1'").run();

    expect(banco.prepare("SELECT count(*) AS total FROM pertencimento").get()?.total).toBe(0);
    expect(banco.prepare("SELECT count(*) AS total FROM agendamento").get()?.total).toBe(0);

    banco.close();
  });

  it("amarra Imagem, tipo e Descrição alternativa por CHECK", () => {
    const banco = baseNaVersao16();
    aplicarEsquema(banco);
    const inserir = banco.prepare(
      `INSERT INTO cartao (id, frente, verso, usuario_id, tipo, imagem_chave, texto_alternativo)
       VALUES (?, ?, 'Verso', 'dono-um', ?, ?, ?)`,
    );

    expect(() => inserir.run("x1", "", "imagem", "imagens/k1", null)).not.toThrow();
    expect(() => inserir.run("x2", "", "frente-verso", null, null)).toThrow(/CHECK/);
    expect(() => inserir.run("x3", "F", "imagem", null, null)).toThrow(/CHECK/);
    expect(() => inserir.run("x4", "F", "frente-verso", "imagens/k4", null)).toThrow(/CHECK/);
    expect(() => inserir.run("x5", "F", "frente-verso", null, "texto")).toThrow(/CHECK/);
    expect(() => inserir.run("x6", "F", "outro", null, null)).toThrow(/CHECK/);
    expect(() =>
      inserir.run("x7", "F", "imagem", "imagens/k7", "a".repeat(251)),
    ).toThrow(/CHECK/);
    expect(() =>
      inserir.run("x8", "F", "imagem", "imagens/k8", "a".repeat(250)),
    ).not.toThrow();

    banco.close();
  });

  it("aceita vários `frente_chave` nulos no mesmo Baralho (FR-414)", () => {
    const banco = baseNaVersao16();
    aplicarEsquema(banco);
    const cartao = banco.prepare(
      `INSERT INTO cartao (id, frente, verso, usuario_id, tipo, imagem_chave)
       VALUES (?, '', 'Verso', 'dono-um', 'imagem', ?)`,
    );
    const pertencimento = banco.prepare(
      "INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave) VALUES (?, 'b1', NULL)",
    );

    cartao.run("i1", "imagens/a");
    cartao.run("i2", "imagens/b");
    pertencimento.run("i1");

    expect(() => pertencimento.run("i2")).not.toThrow();

    banco.close();
  });

  it("cria a fila `midia_a_remover` sem chave estrangeira", () => {
    const banco = baseNaVersao16();
    aplicarEsquema(banco);

    expect(
      banco.prepare("PRAGMA table_info(midia_a_remover)").all().map((c) => c.name),
    ).toEqual(["chave", "registrada_em"]);
    expect(
      banco.prepare("PRAGMA foreign_key_list(midia_a_remover)").all(),
    ).toEqual([]);

    banco.close();
  });
});
