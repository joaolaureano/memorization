// Migração 22 no PostgreSQL: Conta de teste (030, data-model).
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  aplicarMigracoes,
  lerVersaoDoEsquema,
} from "../../../src/armazenamento/postgresql/esquema.ts";
import { MIGRACOES } from "../../../src/armazenamento/postgresql/migracoes.ts";
import { abrirPiscinaDaBase, descartarBasesDeTeste } from "./base-de-teste.ts";
import {
  servidorDeTeste,
  type FerramentasDoServidor,
} from "./servidor-de-teste.ts";

/**
 * T006 — migração 22 do Adapter da nuvem (030, data-model "Migração 22"), em
 * paridade com a do SQLite (`tests/acervo/migracao-conta-de-teste.test.ts`).
 *
 * Como as demais provas de migração, as asserções inspecionam as tabelas do
 * PostgreSQL: é o comportamento do esquema que está sob verificação.
 */

let servidor: FerramentasDoServidor;

beforeAll(async () => {
  servidor = await servidorDeTeste();
}, 120_000);

afterAll(async () => {
  await descartarBasesDeTeste();
  await (await servidorDeTeste()).encerrar();
});

/** Cria uma base com o dono `dono-um` já gravado, migrada até `versao`. */
async function baseMigradaAte(titulo: string, versao: number): Promise<Pool> {
  const nomeDaBase = await servidor.criarBase(`conta-de-teste-${titulo}`);
  const piscina = await abrirPiscinaDaBase(nomeDaBase);

  await aplicarMigracoes(
    piscina,
    MIGRACOES.filter((migracao) => migracao.versao <= versao),
  );
  await piscina.query(
    `INSERT INTO usuario (id, nome_de_usuario, sal, hash, parametros)
     VALUES ('dono-um', 'ana.silva', $1, $2, '{}')`,
    [Buffer.alloc(16), Buffer.from("hash-sintetico")],
  );

  return piscina;
}

/** Fotografa as linhas que a migração precisa preservar. */
async function fotografar(piscina: Pool) {
  const consulta = async (sql: string) => (await piscina.query(sql)).rows;
  return {
    usuarios: await consulta("SELECT id, nome_de_usuario FROM usuario ORDER BY id"),
    baralhos: await consulta("SELECT id, nome, usuario_id FROM baralho ORDER BY id"),
    cartoes: await consulta("SELECT id, frente, verso, usuario_id, tipo FROM cartao ORDER BY id"),
    pertencimentos: await consulta(
      "SELECT cartao_id, baralho_id, frente_chave FROM pertencimento ORDER BY cartao_id",
    ),
  };
}

describe("migração 22 — Conta de teste (PostgreSQL)", () => {
  it("preserva as linhas da v21 e acrescenta as colunas com NULL e 0 aos usuários existentes", async () => {
    const piscina = await baseMigradaAte("preserva", 21);

    try {
      await piscina.query("INSERT INTO baralho (id, nome, usuario_id) VALUES ('b1', 'Inglês', 'dono-um')");
      await piscina.query(
        `INSERT INTO cartao (id, frente, verso, usuario_id) VALUES ('c1', 'To walk', 'Caminhar', 'dono-um')`,
      );
      await piscina.query(
        "INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave) VALUES ('c1', 'b1', 'to walk')",
      );
      const antes = await fotografar(piscina);

      await aplicarMigracoes(piscina);

      expect(await lerVersaoDoEsquema(piscina)).toBe(23);
      expect(await fotografar(piscina)).toEqual(antes);
      expect(
        (
          await piscina.query(
            "SELECT conta_de_teste_em, envios_de_teste FROM usuario WHERE id = 'dono-um'",
          )
        ).rows,
      ).toEqual([{ conta_de_teste_em: null, envios_de_teste: 0 }]);
      expect(
        (
          await piscina.query<{
            column_name: string;
            data_type: string;
            is_nullable: string;
            column_default: string | null;
          }>(
            `SELECT column_name, data_type, is_nullable, column_default
               FROM information_schema.columns
              WHERE table_name = 'usuario'
                AND column_name IN ('conta_de_teste_em', 'envios_de_teste')
              ORDER BY column_name`,
          )
        ).rows,
      ).toEqual([
        {
          column_name: "conta_de_teste_em",
          data_type: "timestamp with time zone",
          is_nullable: "YES",
          column_default: null,
        },
        {
          column_name: "envios_de_teste",
          data_type: "integer",
          is_nullable: "NO",
          column_default: "0",
        },
      ]);
    } finally {
      await piscina.end();
    }
  });

  it("cria o índice parcial sobre conta_de_teste_em (data-model, Migração 22)", async () => {
    const piscina = await baseMigradaAte("indice", 21);

    try {
      await aplicarMigracoes(piscina);

      const { rows } = await piscina.query<{ indexdef: string }>(
        `SELECT indexdef FROM pg_indexes
          WHERE tablename = 'usuario' AND indexdef LIKE '%conta_de_teste_em%'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.indexdef).toMatch(/\(conta_de_teste_em\) WHERE \(conta_de_teste_em IS NOT NULL\)/);
    } finally {
      await piscina.end();
    }
  });

  it("cria a tabela criacao_de_conta_de_teste com o índice (origem_hmac, criado_em)", async () => {
    const piscina = await baseMigradaAte("tabela", 21);

    try {
      await aplicarMigracoes(piscina);

      expect(
        (
          await piscina.query<{ column_name: string; data_type: string; is_nullable: string }>(
            `SELECT column_name, data_type, is_nullable
               FROM information_schema.columns
              WHERE table_name = 'criacao_de_conta_de_teste'
              ORDER BY ordinal_position`,
          )
        ).rows,
      ).toEqual([
        { column_name: "origem_hmac", data_type: "text", is_nullable: "NO" },
        { column_name: "criado_em", data_type: "timestamp with time zone", is_nullable: "NO" },
      ]);
      const { rows } = await piscina.query<{ indexdef: string }>(
        `SELECT indexdef FROM pg_indexes WHERE tablename = 'criacao_de_conta_de_teste'`,
      );
      expect(rows.map((linha) => linha.indexdef)).toContainEqual(
        expect.stringMatching(/\(origem_hmac, criado_em\)$/),
      );
    } finally {
      await piscina.end();
    }
  });

  it("com a transição de Pertencimento pendente, a 22 roda e a 23 espera; vinculo fica", async () => {
    const piscina = await baseComTransicaoPendente("pendente");

    try {
      const antes = await fotografar(piscina);

      await aplicarMigracoes(piscina);

      expect(await lerVersaoDoEsquema(piscina)).toBe(22);
      expect(await lerVersaoDoEsquema(piscina)).toBeLessThan(23);
      expect(await tabelaExiste(piscina, "criacao_de_conta_de_teste")).toBe(true);
      expect(await tabelaExiste(piscina, "vinculo")).toBe(true);
      expect(
        (await piscina.query("SELECT count(*)::int AS total FROM vinculo")).rows,
      ).toEqual([{ total: 1 }]);
      expect(await fotografar(piscina)).toEqual(antes);
    } finally {
      await piscina.end();
    }
  });

  it("concluída a transição, a nova aplicação chega à 23, remove vinculo e preserva os dados", async () => {
    const piscina = await baseComTransicaoPendente("concluida");

    try {
      await aplicarMigracoes(piscina);
      await concluirTransicao(piscina);
      const antes = await fotografar(piscina);

      expect(await aplicarMigracoes(piscina)).toBe(23);
      expect(await lerVersaoDoEsquema(piscina)).toBe(23);
      expect(await tabelaExiste(piscina, "vinculo")).toBe(false);
      expect(await tabelaExiste(piscina, "pertencimento")).toBe(true);
      expect(await fotografar(piscina)).toEqual(antes);
    } finally {
      await piscina.end();
    }
  });

  it("base na 22 com a transição concluída chega à 23 sem alterar nenhuma linha", async () => {
    const piscina = await baseComTransicaoPendente("v22");

    try {
      await concluirTransicao(piscina);
      await aplicarMigracoes(
        piscina,
        MIGRACOES.filter((migracao) => migracao.versao <= 22),
      );
      expect(await lerVersaoDoEsquema(piscina)).toBe(22);
      expect(await tabelaExiste(piscina, "vinculo")).toBe(false);
      const antes = await fotografar(piscina);
      const contasAntes = (
        await piscina.query("SELECT id, conta_de_teste_em, envios_de_teste FROM usuario ORDER BY id")
      ).rows;

      await aplicarMigracoes(piscina);

      expect(await lerVersaoDoEsquema(piscina)).toBe(23);
      expect(await fotografar(piscina)).toEqual(antes);
      expect(
        (await piscina.query("SELECT id, conta_de_teste_em, envios_de_teste FROM usuario ORDER BY id")).rows,
      ).toEqual(contasAntes);
    } finally {
      await piscina.end();
    }
  });
});

/**
 * Base na versão 20 com um Cartão sem Pertencimento: a transição está pendente.
 * O Cartão e o Vínculo entram antes da 14, senão a finalização da transição
 * (que não tem Cartões pendentes numa base vazia) já teria removido `vinculo`.
 */
async function baseComTransicaoPendente(titulo: string): Promise<Pool> {
  const piscina = await baseMigradaAte(titulo, 13);
  await piscina.query("INSERT INTO baralho (id, nome, usuario_id) VALUES ('b1', 'Inglês', 'dono-um')");
  await piscina.query(
    `INSERT INTO cartao (id, frente, verso, usuario_id) VALUES ('c1', 'To walk', 'Caminhar', 'dono-um')`,
  );
  await piscina.query("INSERT INTO vinculo (cartao_id, baralho_id) VALUES ('c1', 'b1')");
  await aplicarMigracoes(
    piscina,
    MIGRACOES.filter((migracao) => migracao.versao <= 20),
  );
  return piscina;
}

/** Dá Pertencimento a todos os Cartões que ainda não têm, concluindo a transição. */
async function concluirTransicao(piscina: Pool): Promise<void> {
  await piscina.query(`
    INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave)
    SELECT id, 'b1', id FROM cartao
     WHERE id NOT IN (SELECT cartao_id FROM pertencimento);
  `);
}

async function tabelaExiste(piscina: Pool, nome: string): Promise<boolean> {
  const { rows } = await piscina.query<{ existe: boolean }>(
    "SELECT to_regclass($1) IS NOT NULL AS existe",
    [nome],
  );
  return rows[0]?.existe === true;
}
