import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  aplicarMigracoes,
  lerVersaoDoEsquema,
  versaoCorrenteConhecida,
} from "../../../src/armazenamento/postgresql/esquema.ts";
import {
  MIGRACOES,
  type Migracao,
} from "../../../src/armazenamento/postgresql/migracoes.ts";
import {
  abrirPiscinaDaBase,
  criarBaseMigrada,
  descartarBasesDeTeste,
} from "./base-de-teste.ts";
import { servidorDeTeste } from "./servidor-de-teste.ts";

/**
 * T903 — o Adapter traz o DDL de PostgreSQL das migrações 1 a 3 e o aplicador
 * com trava consultiva (FR-112, FR-116, SC-048).
 *
 * A verificação é da Seam interna do Adapter: base nova e vazia chega à versão
 * corrente com as **mesmas versões** do SQLite, as três tabelas existem com as
 * `CHECK` de Frente, Verso e nome (`btrim` e `char_length`), a chave primária
 * composta de `vinculo` e as duas `ON DELETE CASCADE`; base já migrada não
 * reaplica nada; dois aplicadores disparados ao mesmo tempo não aplicam a mesma
 * migração duas vezes; e uma migração que falha não eleva a versão nem deixa
 * tabela pela metade. O comportamento da Interface continua sendo provado pela
 * bateria compartilhada, em `bateria.test.ts`.
 */

const RAIZ_DO_BACKEND = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

/** Subir o PostgreSQL real leva segundos: o prazo do gancho é folgado. */
beforeAll(async () => {
  await servidorDeTeste();
}, 120_000);

afterAll(async () => {
  await descartarBasesDeTeste();
  await (await servidorDeTeste()).encerrar();
});

/**
 * Cria uma base **vazia** — sem migração alguma — e executa o corpo com uma
 * piscina sobre ela e o acesso administrativo ao servidor.
 */
async function comBaseVazia<T>(
  titulo: string,
  corpo: (
    piscina: Pool,
    consultar: <Linha>(sql: string, valores?: unknown[]) => Promise<Linha[]>,
  ) => Promise<T>,
): Promise<T> {
  const servidor = await servidorDeTeste();
  const nomeDaBase = await servidor.criarBase(titulo);
  const piscina = await abrirPiscinaDaBase(nomeDaBase);

  try {
    return await corpo(piscina, async (sql, valores) =>
      await servidor.consultar(nomeDaBase, sql, valores),
    );
  } finally {
    await piscina.end();
  }
}

/** A versão registrada na tabela de controle, lida direto do catálogo da base. */
async function versaoRegistrada(
  consultar: <Linha>(sql: string, valores?: unknown[]) => Promise<Linha[]>,
): Promise<number[]> {
  const linhas = await consultar<{ versao: number }>(
    "SELECT versao FROM versao_do_esquema;",
  );

  return linhas.map((linha) => Number(linha.versao));
}

describe("base nova e vazia", () => {
  it("começa na versão 0 e chega à versão corrente com as três tabelas", async () => {
    await comBaseVazia("nova", async (piscina, consultar) => {
      /** Antes de migrar, a base não tem nem a tabela de controle. */
      expect(await lerVersaoDoEsquema(piscina)).toBe(0);

      expect(await aplicarMigracoes(piscina)).toBe(versaoCorrenteConhecida());
      expect(versaoCorrenteConhecida()).toBe(3);

      const tabelas = await consultar<{ nome: string }>(
        "SELECT tablename AS nome FROM pg_tables WHERE schemaname = 'public';",
      );

      expect(tabelas.map((tabela) => tabela.nome).sort()).toEqual([
        "baralho",
        "cartao",
        "versao_do_esquema",
        "vinculo",
      ]);

      /** Um único inteiro, e uma única linha: a versão da base. */
      const colunas = await consultar<{ nome: string; tipo: string }>(
        `SELECT column_name AS nome, data_type AS tipo
           FROM information_schema.columns
          WHERE table_name = 'versao_do_esquema';`,
      );

      expect(colunas).toEqual([{ nome: "versao", tipo: "integer" }]);
      expect(await versaoRegistrada(consultar)).toEqual([3]);
    });
  });

  it("aplica a lista inteira, na ordem, elevando a versão a cada migração", async () => {
    await comBaseVazia("ordem", async (piscina, consultar) => {
      const migracoes: readonly Migracao[] = [
        { versao: 1, sql: "CREATE TABLE tabela_um (id TEXT PRIMARY KEY);" },
        {
          versao: 2,
          sql:
            "INSERT INTO tabela_um (id) VALUES ('um'); " +
            "CREATE TABLE tabela_dois (id TEXT PRIMARY KEY);",
        },
      ];

      await aplicarMigracoes(piscina, migracoes);

      /** A migração 2 dependeu da 1: fora de ordem, o INSERT teria falhado. */
      const inserido = await consultar<{ id: string }>(
        "SELECT id FROM tabela_um;",
      );

      expect(inserido).toEqual([{ id: "um" }]);
      expect(await versaoRegistrada(consultar)).toEqual([2]);
    });
  });
});

describe("as mesmas regras de conteúdo do Adapter local", () => {
  it("guarda as CHECK de Frente, Verso e nome com btrim e char_length", async () => {
    const nomeDaBase = await criarBaseMigrada("regras");

    const definicoes = await (
      await servidorDeTeste()
    ).consultar<{ tabela: string; definicao: string }>(
      nomeDaBase,
      `SELECT conrelid::regclass::text AS tabela,
              pg_get_constraintdef(oid)  AS definicao
         FROM pg_constraint
        WHERE conrelid IN ('cartao'::regclass, 'baralho'::regclass)
          AND contype = 'c'
        ORDER BY tabela;`,
    );

    const cartao = definicoes
      .filter((definicao) => definicao.tabela === "cartao")
      .map((definicao) => definicao.definicao)
      .join(" ");
    const baralho = definicoes
      .filter((definicao) => definicao.tabela === "baralho")
      .map((definicao) => definicao.definicao)
      .join(" ");

    expect(cartao).toMatch(/btrim\(frente\)/);
    expect(cartao).toMatch(/char_length\(frente\) <= 1000/);
    expect(cartao).toMatch(/btrim\(verso\)/);
    expect(cartao).toMatch(/char_length\(verso\) <= 1000/);
    expect(baralho).toMatch(/btrim\(nome\)/);
    expect(baralho).toMatch(/char_length\(nome\) <= 100/);
  });

  it("recusa conteúdo inválido pela CHECK, como a rede de segurança do esquema", async () => {
    const nomeDaBase = await criarBaseMigrada("conteudo-invalido");
    const piscina = await abrirPiscinaDaBase(nomeDaBase);

    try {
      await expect(
        piscina.query("INSERT INTO cartao (id, frente, verso) VALUES ($1, $2, $3);", [
          "c1",
          "   ",
          "Caminhar",
        ]),
      ).rejects.toThrow();

      await expect(
        piscina.query("INSERT INTO baralho (id, nome) VALUES ($1, $2);", [
          "b1",
          "x".repeat(101),
        ]),
      ).rejects.toThrow();
    } finally {
      await piscina.end();
    }
  });

  it("tem chave primária composta em vinculo e as duas cascatas de exclusão", async () => {
    const nomeDaBase = await criarBaseMigrada("restricoes");

    const restricoes = await (
      await servidorDeTeste()
    ).consultar<{ nome: string; definicao: string }>(
      nomeDaBase,
      `SELECT conname AS nome, pg_get_constraintdef(oid) AS definicao
         FROM pg_constraint
        WHERE conrelid = 'vinculo'::regclass
        ORDER BY conname;`,
    );

    const chave = restricoes.find((restricao) => restricao.nome === "vinculo_pkey");
    const estrangeiras = restricoes
      .filter((restricao) => /REFERENCES/.test(restricao.definicao))
      .map((restricao) => restricao.definicao);

    expect(chave?.definicao).toContain(
      "PRIMARY KEY (cartao_id, baralho_id)",
    );
    expect(estrangeiras).toHaveLength(2);

    for (const definicao of estrangeiras) {
      expect(definicao).toMatch(/ON DELETE CASCADE/);
    }

    expect(estrangeiras.join(" ")).toMatch(/REFERENCES cartao\(id\)/);
    expect(estrangeiras.join(" ")).toMatch(/REFERENCES baralho\(id\)/);
  });

  it("leva os Vínculos quando o Cartão ou o Baralho é excluído, sem levar a outra extremidade", async () => {
    const nomeDaBase = await criarBaseMigrada("cascata");
    const piscina = await abrirPiscinaDaBase(nomeDaBase);

    try {
      await piscina.query(
        "INSERT INTO cartao (id, frente, verso) VALUES ('c1', 'To walk', 'Caminhar');",
      );
      await piscina.query(
        "INSERT INTO baralho (id, nome) VALUES ('b1', 'Inglês');",
      );
      await piscina.query(
        "INSERT INTO vinculo (cartao_id, baralho_id) VALUES ('c1', 'b1');",
      );

      await piscina.query("DELETE FROM cartao WHERE id = 'c1';");

      const depoisDoCartao = await piscina.query(
        "SELECT baralho_id FROM vinculo;",
      );

      expect(depoisDoCartao.rows).toEqual([]);
      expect(
        (await piscina.query("SELECT id FROM baralho;")).rows,
      ).toEqual([{ id: "b1" }]);

      await piscina.query(
        "INSERT INTO cartao (id, frente, verso) VALUES ('c2', 'To read', 'Ler');",
      );
      await piscina.query(
        "INSERT INTO vinculo (cartao_id, baralho_id) VALUES ('c2', 'b1');",
      );
      await piscina.query("DELETE FROM baralho WHERE id = 'b1';");

      expect((await piscina.query("SELECT cartao_id FROM vinculo;")).rows).toEqual(
        [],
      );
      expect(
        (await piscina.query("SELECT id FROM cartao ORDER BY id;")).rows,
      ).toEqual([{ id: "c2" }]);
    } finally {
      await piscina.end();
    }
  });
});

describe("base já migrada", () => {
  it("não reexecuta migração já registrada, mesmo que ela não seja idempotente", async () => {
    await comBaseVazia("reexecucao", async (piscina, consultar) => {
      const migracoes: readonly Migracao[] = [
        { versao: 1, sql: "CREATE TABLE tabela_um (id TEXT PRIMARY KEY);" },
      ];

      await aplicarMigracoes(piscina, migracoes);

      /** Reaplicar criaria a tabela de novo e falharia: não pode acontecer. */
      await expect(aplicarMigracoes(piscina, migracoes)).resolves.toBe(1);
      expect(await versaoRegistrada(consultar)).toEqual([1]);
    });
  });

  it("repetir o comando numa base migrada não escreve nada", async () => {
    const nomeDaBase = await criarBaseMigrada("repeticao");
    const piscina = await abrirPiscinaDaBase(nomeDaBase);

    try {
      expect(await aplicarMigracoes(piscina)).toBe(versaoCorrenteConhecida());

      const linhas = await piscina.query(
        "SELECT versao FROM versao_do_esquema;",
      );

      /** A lista inteira percorrida, nada pendente, uma única linha intacta. */
      expect(linhas.rows).toEqual([{ versao: 3 }]);
    } finally {
      await piscina.end();
    }
  });

  it("não reaplica as migrações do Adapter, uma a uma, numa base já migrada", async () => {
    const nomeDaBase = await criarBaseMigrada("uma-a-uma");
    const piscina = await abrirPiscinaDaBase(nomeDaBase);

    try {
      for (const migracao of MIGRACOES) {
        await expect(
          aplicarMigracoes(piscina, [migracao]),
        ).resolves.toBe(versaoCorrenteConhecida());
      }
    } finally {
      await piscina.end();
    }
  });
});

describe("dois aplicadores ao mesmo tempo", () => {
  it("não aplicam a mesma migração duas vezes, e o esquema fica correto", async () => {
    const nomeDaBase = await criarBaseMigrada("concorrencia");

    /** Duas piscinas, como dois deployamentos simultâneos. */
    const primeira = await abrirPiscinaDaBase(nomeDaBase);
    const segunda = await abrirPiscinaDaBase(nomeDaBase);

    try {
      const versoes = await Promise.all([
        aplicarMigracoes(primeira),
        aplicarMigracoes(segunda),
      ]);

      expect(versoes).toEqual([
        versaoCorrenteConhecida(),
        versaoCorrenteConhecida(),
      ]);

      const linhas = await primeira.query(
        "SELECT versao FROM versao_do_esquema;",
      );

      expect(linhas.rows).toEqual([{ versao: 3 }]);
    } finally {
      await primeira.end();
      await segunda.end();
    }
  });
});

describe("falha no meio da migração — sem estado parcial", () => {
  /** Cria uma tabela e só então falha: o DDL parcial é o que o ROLLBACK desfaz. */
  const migracaoQueFalha: readonly Migracao[] = [
    {
      versao: 4,
      sql:
        "CREATE TABLE parcial (id TEXT PRIMARY KEY); " +
        "INSERT INTO nao_existe (id) VALUES ('x');",
    },
  ];

  it("desfaz a migração inteira e conserva a versão anterior", async () => {
    await comBaseVazia("falha", async (piscina, consultar) => {
      await aplicarMigracoes(piscina);

      await expect(aplicarMigracoes(piscina, migracaoQueFalha)).rejects.toThrow();

      const parciais = await consultar<{ nome: string }>(
        "SELECT tablename AS nome FROM pg_tables WHERE tablename = 'parcial';",
      );

      expect(parciais).toEqual([]);
      expect(await versaoRegistrada(consultar)).toEqual([3]);

      const tabelas = await consultar<{ nome: string }>(
        `SELECT tablename AS nome FROM pg_tables
          WHERE schemaname = 'public' ORDER BY tablename;`,
      );

      expect(tabelas.map((tabela) => tabela.nome)).toEqual([
        "baralho",
        "cartao",
        "versao_do_esquema",
        "vinculo",
      ]);
    });
  });

  it("depois do rollback a conexão continua utilizável para a próxima migração", async () => {
    await comBaseVazia("falha-e-segue", async (piscina, consultar) => {
      await expect(aplicarMigracoes(piscina, migracaoQueFalha)).rejects.toThrow();

      await aplicarMigracoes(piscina, [
        { versao: 4, sql: "CREATE TABLE tabela_quatro (id TEXT PRIMARY KEY);" },
      ]);

      const tabelas = await consultar<{ nome: string }>(
        "SELECT tablename AS nome FROM pg_tables WHERE tablename = 'tabela_quatro';",
      );

      expect(tabelas).toEqual([{ nome: "tabela_quatro" }]);
      expect(await versaoRegistrada(consultar)).toEqual([4]);
    });
  });
});

describe("dependências do driver da nuvem", () => {
  /** O manifesto de dependências do backend, como ele está versionado. */
  const manifesto = JSON.parse(
    readFileSync(join(RAIZ_DO_BACKEND, "package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  it("declara pg como dependência de execução e os tipos e o binário como desenvolvimento", () => {
    expect(manifesto.dependencies ?? {}).toHaveProperty("pg");
    expect(manifesto.devDependencies ?? {}).toHaveProperty("@types/pg");
    expect(manifesto.devDependencies ?? {}).toHaveProperty("embedded-postgres");
  });

  it("nunca carrega o binding nativo pg-native", () => {
    expect(manifesto.dependencies ?? {}).not.toHaveProperty("pg-native");
    expect(manifesto.devDependencies ?? {}).not.toHaveProperty("pg-native");
    expect(existsSync(join(RAIZ_DO_BACKEND, "node_modules", "pg-native"))).toBe(
      false,
    );
  });
});
