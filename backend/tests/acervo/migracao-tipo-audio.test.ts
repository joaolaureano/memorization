import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { aplicarMigracoes } from "../../src/armazenamento/sqlite/esquema.ts";
import { MIGRACOES } from "../../src/armazenamento/sqlite/migracoes.ts";
import { gravarBaralho, gravarDono } from "./banco-de-teste.ts";

/**
 * T005 — migrações 20 e 21 do Adapter local (`028`, FR-434, FR-435, FR-449,
 * SC-182).
 *
 * Como as demais provas de migração, as asserções inspecionam as tabelas do
 * SQLite: é o comportamento do esquema que está sob verificação.
 */

/** Diz se a tabela existe, consultando o catálogo do SQLite. */
function existeTabela(banco: DatabaseSync, nome: string): boolean {
  return (
    banco
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(nome) !== undefined
  );
}

function versao(banco: DatabaseSync): number {
  return Number(
    banco.prepare("SELECT versao FROM versao_do_esquema").get()?.versao,
  );
}

/** Base na versão 19, com chaves estrangeiras ligadas e um dono. */
function baseNaVersao19(): DatabaseSync {
  const banco = new DatabaseSync(":memory:");
  banco.exec("PRAGMA foreign_keys = ON;");
  aplicarMigracoes(
    banco,
    MIGRACOES.filter((migracao) => migracao.versao <= 19),
  );
  gravarDono(banco);
  return banco;
}

/** Base já com todas as migrações (20 e 21), pronta para gravar linhas. */
function baseAtual(): DatabaseSync {
  const banco = baseNaVersao19();
  aplicarMigracoes(banco, MIGRACOES);
  return banco;
}

/** Grava um Cartão de Áudio sem Pertencimento, para os cenários de CHECK. */
function inserirAudio(
  banco: DatabaseSync,
  id: string,
  frente: string,
  tipo: string,
  audioChave: string | null,
  audioDuracaoMs: number | null,
): void {
  banco
    .prepare(
      `INSERT INTO cartao (id, frente, verso, usuario_id, tipo, audio_chave, audio_duracao_ms)
       VALUES (?, ?, 'Verso', 'dono-um', ?, ?, ?)`,
    )
    .run(id, frente, tipo, audioChave, audioDuracaoMs);
}

describe("migrações 20 e 21 — Tipo áudio", () => {
  it("preserva a base v19 e chega à v21 com a fila de Mídia (SC-182, FR-449)", () => {
    const banco = baseNaVersao19();
    gravarBaralho(banco, "dono-um", "b1");
    banco
      .prepare(
        `INSERT INTO cartao (id, frente, verso, usuario_id) VALUES ('c1', 'To walk', 'Caminhar', 'dono-um')`,
      )
      .run();
    banco
      .prepare(
        "INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave) VALUES ('c1', 'b1', 'to walk')",
      )
      .run();
    banco
      .prepare(
        `INSERT INTO agendamento (usuario_id, cartao_id, algoritmo, versao_do_algoritmo, estado,
           proxima_revisao_em, ultima_avaliacao, revisado_em, criado_em)
         VALUES ('dono-um', 'c1', 'sm2', 1, '{}', '2026-10-20T00:00:00.000Z', 'bom',
           '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z')`,
      )
      .run();
    banco
      .prepare(
        `INSERT INTO registro_de_sessao (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
           estudados, acertos, erros)
         VALUES ('r1', 'dono-um', 'b1', 'Inglês', '2026-10-13T00:00:00.000Z', 1, 1, 0)`,
      )
      .run();
    banco
      .prepare(
        `INSERT INTO item_de_registro (registro_id, posicao, frente, verso, resultado)
         VALUES ('r1', 0, 'To walk', 'Caminhar', 'acertou')`,
      )
      .run();
    banco
      .prepare(
        `INSERT INTO cartao (id, frente, verso, usuario_id, tipo, imagem_chave)
         VALUES ('i1', '', 'Pernambuco', 'dono-um', 'imagem', 'imagens/u/x')`,
      )
      .run();
    banco
      .prepare("INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave) VALUES ('i1', 'b1', NULL)")
      .run();
    banco
      .prepare(
        "INSERT INTO imagem_a_remover (chave, registrada_em) VALUES ('imagens/u/velha', '2026-10-13T00:00:00.000Z')",
      )
      .run();

    const cartoesAntes = banco
      .prepare("SELECT id, frente, verso, tipo, imagem_chave FROM cartao ORDER BY id")
      .all();

    aplicarMigracoes(banco, MIGRACOES);

    expect(versao(banco)).toBe(21);
    expect(
      banco
        .prepare("SELECT id, frente, verso, tipo, imagem_chave FROM cartao ORDER BY id")
        .all(),
    ).toEqual(cartoesAntes);
    expect(
      banco.prepare("SELECT chave FROM midia_a_remover").all().map((linha) => linha.chave),
    ).toEqual(["imagens/u/velha"]);
    expect(existeTabela(banco, "imagem_a_remover")).toBe(false);
    expect(banco.prepare("PRAGMA foreign_key_check").all()).toEqual([]);

    banco.prepare("DELETE FROM cartao WHERE id = 'c1'").run();

    expect(
      banco.prepare("SELECT count(*) AS total FROM pertencimento WHERE cartao_id = 'c1'").get()?.total,
    ).toBe(0);
    expect(
      banco.prepare("SELECT count(*) AS total FROM agendamento WHERE cartao_id = 'c1'").get()?.total,
    ).toBe(0);

    banco.close();
  });

  it("aceita o tipo 'audio' com chave e duração (FR-434, FR-435)", () => {
    const banco = baseAtual();

    expect(() =>
      inserirAudio(banco, "a1", "", "audio", "audios/u/a", 4210),
    ).not.toThrow();

    banco.close();
  });

  it("recusa um tipo fora do conjunto (FR-434)", () => {
    const banco = baseAtual();

    expect(() => inserirAudio(banco, "a2", "F", "outro", "audios/u/a", 4210)).toThrow(/CHECK/);

    banco.close();
  });

  it("recusa o tipo 'audio' sem chave de Áudio (FR-435)", () => {
    const banco = baseAtual();

    expect(() => inserirAudio(banco, "a3", "", "audio", null, 4210)).toThrow(/CHECK/);

    banco.close();
  });

  it("recusa chave de Áudio fora do tipo 'audio' (FR-435)", () => {
    const banco = baseAtual();

    expect(() =>
      inserirAudio(banco, "a4", "F", "frente-verso", "audios/u/a", 4210),
    ).toThrow(/CHECK/);

    banco.close();
  });

  it("recusa chave de Áudio sem duração (FR-435)", () => {
    const banco = baseAtual();

    expect(() => inserirAudio(banco, "a5", "", "audio", "audios/u/a", null)).toThrow(/CHECK/);

    banco.close();
  });

  it("recusa duração 0 (FR-441)", () => {
    const banco = baseAtual();

    expect(() => inserirAudio(banco, "a6", "", "audio", "audios/u/a", 0)).toThrow(/CHECK/);

    banco.close();
  });

  it("recusa duração acima de 300 000 ms (FR-441)", () => {
    const banco = baseAtual();

    expect(() => inserirAudio(banco, "a7", "", "audio", "audios/u/a", 300001)).toThrow(/CHECK/);

    banco.close();
  });

  it("aceita duração de exatamente 300 000 ms (FR-441)", () => {
    const banco = baseAtual();

    expect(() => inserirAudio(banco, "a8", "", "audio", "audios/u/a", 300000)).not.toThrow();

    banco.close();
  });

  it("mantém a Frente obrigatória no tipo 'frente-verso' (FR-434)", () => {
    const banco = baseAtual();

    expect(() => inserirAudio(banco, "f1", "", "frente-verso", null, null)).toThrow(/CHECK/);

    banco.close();
  });

  it("aceita o tipo 'audio' no snapshot do Histórico (FR-447)", () => {
    const banco = baseAtual();
    banco
      .prepare(
        `INSERT INTO registro_de_sessao (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
           estudados, acertos, erros)
         VALUES ('r1', 'dono-um', 'b1', 'Inglês', '2026-10-13T00:00:00.000Z', 1, 1, 0)`,
      )
      .run();

    expect(() =>
      banco
        .prepare(
          `INSERT INTO item_de_registro (registro_id, posicao, frente, verso, resultado, tipo)
           VALUES ('r1', 0, '', 'Verso', 'acertou', 'audio')`,
        )
        .run(),
    ).not.toThrow();

    banco.close();
  });

  it("recusa o tipo 'outro' no snapshot do Histórico (FR-447)", () => {
    const banco = baseAtual();
    banco
      .prepare(
        `INSERT INTO registro_de_sessao (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
           estudados, acertos, erros)
         VALUES ('r1', 'dono-um', 'b1', 'Inglês', '2026-10-13T00:00:00.000Z', 1, 1, 0)`,
      )
      .run();

    expect(() =>
      banco
        .prepare(
          `INSERT INTO item_de_registro (registro_id, posicao, frente, verso, resultado, tipo)
           VALUES ('r1', 0, '', 'Verso', 'acertou', 'outro')`,
        )
        .run(),
    ).toThrow(/CHECK/);

    banco.close();
  });
});

describe("migrações 20 e 21 — base com Cartão sem Pertencimento", () => {
  it("chega à v20 com o tipo Áudio utilizável e `vinculo` ainda presente", () => {
    const banco = new DatabaseSync(":memory:");
    banco.exec("PRAGMA foreign_keys = ON;");
    aplicarMigracoes(banco, MIGRACOES.filter((migracao) => migracao.versao <= 12));
    gravarDono(banco);
    gravarBaralho(banco, "dono-um", "b1");
    banco
      .prepare(
        `INSERT INTO cartao (id, frente, verso, usuario_id) VALUES ('c1', 'To walk', 'Caminhar', 'dono-um')`,
      )
      .run();
    aplicarMigracoes(banco, MIGRACOES.filter((migracao) => migracao.versao <= 17));

    aplicarMigracoes(banco, MIGRACOES);

    expect(versao(banco)).toBe(20);
    expect(existeTabela(banco, "vinculo")).toBe(true);
    expect(() => inserirAudio(banco, "a1", "", "audio", "audios/u/a", 4210)).not.toThrow();

    banco
      .prepare(
        "INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave) VALUES ('c1', 'b1', 'to walk')",
      )
      .run();
    banco
      .prepare(
        "INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave) VALUES ('a1', 'b1', NULL)",
      )
      .run();
    banco
      .prepare(
        `INSERT INTO registro_de_sessao (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
           estudados, acertos, erros, origem)
         VALUES ('r1', 'dono-um', 'b1', 'Revisão do dia', '2026-10-13T00:00:00.000Z', 1, 1, 0, 'revisao')`,
      )
      .run();

    aplicarMigracoes(banco, MIGRACOES);

    expect(versao(banco)).toBe(21);
    expect(existeTabela(banco, "vinculo")).toBe(false);
    expect(
      banco.prepare("SELECT nome_do_baralho FROM registro_de_sessao WHERE id = 'r1'").get()?.nome_do_baralho,
    ).toBe("");

    banco.close();
  });
});
