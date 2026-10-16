import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  aplicarMigracoes,
  lerVersaoDoEsquema,
} from "../../../src/armazenamento/postgresql/esquema.ts";
import { MIGRACOES } from "../../../src/armazenamento/postgresql/migracoes.ts";
import { MIGRACOES as MIGRACOES_DO_SQLITE } from "../../../src/armazenamento/sqlite/migracoes.ts";
import { abrirPiscinaDaBase, descartarBasesDeTeste } from "./base-de-teste.ts";
import {
  servidorDeTeste,
  type FerramentasDoServidor,
} from "./servidor-de-teste.ts";

/**
 * T006 — migração 17 do Adapter da nuvem (`026`, FR-403, FR-407, SC-173), em
 * paridade com a do SQLite.
 */

let servidor: FerramentasDoServidor;

beforeAll(async () => {
  servidor = await servidorDeTeste();
}, 120_000);

afterAll(async () => {
  await descartarBasesDeTeste();
  await (await servidorDeTeste()).encerrar();
});

/** Base na versão 16 com um Cartão, seu Pertencimento, Agendamento e Histórico. */
async function baseNaVersao16(titulo: string): Promise<Pool> {
  const nomeDaBase = await servidor.criarBase(`tipo-de-cartao-${titulo}`);
  const piscina = await abrirPiscinaDaBase(nomeDaBase);

  await aplicarMigracoes(
    piscina,
    MIGRACOES.filter((migracao) => migracao.versao <= 16),
  );
  await piscina.query(
    `INSERT INTO usuario (id, nome_de_usuario, sal, hash, parametros)
     VALUES ('dono-um', 'ana.silva', $1, $2, '{}')`,
    [Buffer.alloc(16), Buffer.from("hash-sintetico")],
  );
  await piscina.query(
    "INSERT INTO baralho (id, nome, usuario_id) VALUES ('b1', 'Inglês', 'dono-um')",
  );
  await piscina.query(
    `INSERT INTO cartao (id, frente, verso, usuario_id)
     VALUES ('c1', 'To walk', 'Caminhar', 'dono-um')`,
  );
  await piscina.query(
    "INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave) VALUES ('c1', 'b1', 'to walk')",
  );
  await piscina.query(
    `INSERT INTO registro_de_sessao (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
       estudados, acertos, erros)
     VALUES ('r1', 'dono-um', 'b1', 'Inglês', '2026-10-13T00:00:00Z', 1, 1, 0)`,
  );
  await piscina.query(
    `INSERT INTO item_de_registro (registro_id, posicao, frente, verso, resultado)
     VALUES ('r1', 0, 'To walk', 'Caminhar', 'acertou')`,
  );

  return piscina;
}

async function falha(piscina: Pool, sql: string, parametros: unknown[]): Promise<string> {
  try {
    await piscina.query(sql, parametros);
    return "";
  } catch (erro) {
    return (erro as { code?: string }).code ?? "erro";
  }
}

describe("migração 17 — Tipo de cartão (PostgreSQL)", () => {
  it("tem a mesma sequência de versões que o SQLite", () => {
    expect(MIGRACOES.map((m) => m.versao)).toEqual(
      MIGRACOES_DO_SQLITE.map((m) => m.versao),
    );
  });

  it("converte o acervo existente em Frente-Verso sem perder nada (FR-407, SC-173)", async () => {
    const piscina = await baseNaVersao16("conversao");

    try {
      await aplicarMigracoes(piscina);

      expect(await lerVersaoDoEsquema(piscina)).toBe(23);
      expect(
        (
          await piscina.query(
            "SELECT id, frente, verso, tipo, imagem_chave, texto_alternativo FROM cartao",
          )
        ).rows,
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
        (await piscina.query("SELECT frente_chave FROM pertencimento")).rows,
      ).toEqual([{ frente_chave: "to walk" }]);
      expect(
        (await piscina.query("SELECT tipo FROM item_de_registro")).rows,
      ).toEqual([{ tipo: "frente-verso" }]);
    } finally {
      await piscina.end();
    }
  });

  it("amarra Imagem, tipo e Descrição alternativa por CHECK", async () => {
    const piscina = await baseNaVersao16("checks");

    try {
      await aplicarMigracoes(piscina);
      const inserir = `INSERT INTO cartao (id, frente, verso, usuario_id, tipo, imagem_chave, texto_alternativo)
                       VALUES ($1, $2, 'Verso', 'dono-um', $3, $4, $5)`;
      const VIOLACAO_DE_CHECK = "23514";

      expect(await falha(piscina, inserir, ["x1", "", "imagem", "imagens/k1", null])).toBe("");
      expect(await falha(piscina, inserir, ["x2", "", "frente-verso", null, null])).toBe(VIOLACAO_DE_CHECK);
      expect(await falha(piscina, inserir, ["x3", "F", "imagem", null, null])).toBe(VIOLACAO_DE_CHECK);
      expect(await falha(piscina, inserir, ["x4", "F", "frente-verso", "imagens/k4", null])).toBe(VIOLACAO_DE_CHECK);
      expect(await falha(piscina, inserir, ["x5", "F", "frente-verso", null, "texto"])).toBe(VIOLACAO_DE_CHECK);
      expect(await falha(piscina, inserir, ["x6", "F", "outro", null, null])).toBe(VIOLACAO_DE_CHECK);
      expect(await falha(piscina, inserir, ["x7", "F", "imagem", "imagens/k7", "a".repeat(251)])).toBe(VIOLACAO_DE_CHECK);
      expect(await falha(piscina, inserir, ["x8", "F", "imagem", "imagens/k8", "a".repeat(250)])).toBe("");
    } finally {
      await piscina.end();
    }
  });

  it("aceita vários `frente_chave` nulos no mesmo Baralho e cria a fila (FR-414, FR-421)", async () => {
    const piscina = await baseNaVersao16("nulos");

    try {
      await aplicarMigracoes(piscina);
      for (const id of ["i1", "i2"]) {
        await piscina.query(
          `INSERT INTO cartao (id, frente, verso, usuario_id, tipo, imagem_chave)
           VALUES ($1, '', 'Verso', 'dono-um', 'imagem', $2)`,
          [id, `imagens/${id}`],
        );
        await piscina.query(
          "INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave) VALUES ($1, 'b1', NULL)",
          [id],
        );
      }

      expect(
        (await piscina.query("SELECT count(*)::int AS total FROM pertencimento WHERE frente_chave IS NULL")).rows,
      ).toEqual([{ total: 2 }]);
      expect(
        (
          await piscina.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'midia_a_remover' ORDER BY ordinal_position",
          )
        ).rows.map((linha) => linha.column_name),
      ).toEqual(["chave", "registrada_em"]);
    } finally {
      await piscina.end();
    }
  });
});
