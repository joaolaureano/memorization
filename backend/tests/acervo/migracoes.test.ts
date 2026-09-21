import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import {
  abrirBanco,
  aplicarEsquema,
  aplicarMigracoes,
} from "../../src/armazenamento/sqlite/esquema.ts";
import {
  MIGRACOES,
  type Migracao,
} from "../../src/armazenamento/sqlite/migracoes.ts";
import { abrirArmazenamentoSqlite } from "../../src/armazenamento/sqlite/armazenamento.ts";

/**
 * T101 — infraestrutura de migração versionada, agora do Adapter do
 * armazenamento local.
 *
 * Os três grupos de verificação exigidos: base nova recebe todas as migrações
 * em ordem; base já migrada não reaplica; falha no meio de uma migração não
 * deixa estado parcial. Um quarto grupo prova a adoção de arquivos legados da
 * feature `001`, que têm `cartao` sem a tabela de versão.
 *
 * A infraestrutura é a Seam interna do Adapter: as asserções inspecionam as
 * tabelas do SQLite em memória, porque é o comportamento do aplicador de
 * migrações que está sob verificação — nenhuma operação da Interface do
 * `Acervo` é exercitada aqui.
 */

/** Versão registrada na tabela de controle; 0 quando a base não tem linha. */
function versaoAtual(banco: DatabaseSync): number {
  const linha = banco.prepare("SELECT versao FROM versao_do_esquema").get();

  return linha === undefined ? 0 : Number(linha.versao);
}

/**
 * A versão mais recente da lista de migrações — o que uma base nova registra
 * depois que todas rodam. Derivada, e não escrita à mão: acrescentar uma
 * migração não quebra estas asserções.
 */
const ULTIMA_VERSAO_DO_ESQUEMA = MIGRACOES.reduce(
  (maisRecente, migracao) => Math.max(maisRecente, migracao.versao),
  0,
);

/** Diz se a tabela existe, consultando o catálogo do SQLite. */
function existeTabela(banco: DatabaseSync, nome: string): boolean {
  return (
    banco
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(nome) !== undefined
  );
}

/** Executa o corpo com uma base em memória, fechando-a em qualquer desfecho. */
function comBanco(corpo: (banco: DatabaseSync) => void): void {
  const banco = new DatabaseSync(":memory:");

  try {
    corpo(banco);
  } finally {
    banco.close();
  }
}

describe("base nova — todas as migrações, em ordem", () => {
  it("cria cartao, baralho, vinculo e usuario e registra a última versão da lista, com controle de versão de um único inteiro", () => {
    const banco = abrirBanco(":memory:");

    try {
      expect(existeTabela(banco, "cartao")).toBe(true);
      expect(existeTabela(banco, "baralho")).toBe(true);
      expect(existeTabela(banco, "vinculo")).toBe(true);
      expect(existeTabela(banco, "usuario")).toBe(true);
      expect(versaoAtual(banco)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);

      const colunas = banco
        .prepare("PRAGMA table_info(versao_do_esquema)")
        .all();

      expect(colunas).toHaveLength(1);
      expect(colunas[0]).toMatchObject({
        name: "versao",
        type: "INTEGER",
        notnull: 1,
      });
    } finally {
      banco.close();
    }
  });

  it("aplica a lista inteira, na ordem, elevando a versão a cada migração", () => {
    comBanco((banco) => {
      const migracoes: readonly Migracao[] = [
        { versao: 1, sql: "CREATE TABLE tabela_um (id TEXT PRIMARY KEY);" },
        {
          versao: 2,
          sql:
            "INSERT INTO tabela_um (id) VALUES ('um'); " +
            "CREATE TABLE tabela_dois (id TEXT PRIMARY KEY);",
        },
      ];

      aplicarMigracoes(banco, migracoes);

      expect(existeTabela(banco, "tabela_um")).toBe(true);
      expect(existeTabela(banco, "tabela_dois")).toBe(true);

      // A migração 2 dependeu da 1: fora de ordem, o INSERT teria falhado.
      const inserido = banco.prepare("SELECT id FROM tabela_um").get();

      expect(inserido?.id).toBe("um");

      // Um único inteiro: a linha é uma só, elevada a cada migração.
      const linhas = banco
        .prepare("SELECT versao FROM versao_do_esquema")
        .all();

      expect(linhas).toHaveLength(1);
      expect(linhas[0]?.versao).toBe(2);
    });
  });
});

describe("base já migrada — migração não reaplica", () => {
  it("reabrir um arquivo migrado não roda a migração de novo e preserva os Cartões", () => {
    const diretorio = mkdtempSync(join(tmpdir(), "acervo-migracoes-"));

    try {
      const caminho = join(diretorio, "banco.sqlite");

      let banco = abrirBanco(caminho);

      banco
        .prepare("INSERT INTO cartao (id, frente, verso) VALUES (?, ?, ?)")
        .run("c1", "To walk", "Caminhar");
      banco.close();

      banco = abrirBanco(caminho);

      try {
        expect(versaoAtual(banco)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);
        expect(existeTabela(banco, "baralho")).toBe(true);
        expect(existeTabela(banco, "vinculo")).toBe(true);

        const lido = banco
          .prepare("SELECT id, frente, verso FROM cartao WHERE id = ?")
          .get("c1");

        expect(lido).toEqual({
          id: "c1",
          frente: "To walk",
          verso: "Caminhar",
        });
      } finally {
        banco.close();
      }
    } finally {
      rmSync(diretorio, { recursive: true, force: true });
    }
  });

  it("não reexecuta migração já registrada, mesmo que ela não seja idempotente", () => {
    comBanco((banco) => {
      const migracoes: readonly Migracao[] = [
        { versao: 1, sql: "CREATE TABLE tabela_um (id TEXT PRIMARY KEY);" },
      ];

      aplicarMigracoes(banco, migracoes);

      // Reaplicar criaria a tabela de novo e falharia: não pode acontecer.
      expect(() => aplicarMigracoes(banco, migracoes)).not.toThrow();
      expect(versaoAtual(banco)).toBe(1);
    });
  });
});

describe("falha no meio da migração — sem estado parcial", () => {
  /** Cria uma tabela e só então falha: o DDL parcial é o que o ROLLBACK desfaz. */
  const migracaoQueFalha: readonly Migracao[] = [
    {
      versao: 5,
      sql:
        "CREATE TABLE parcial (id TEXT PRIMARY KEY); " +
        "INSERT INTO nao_existe (id) VALUES ('x');",
    },
  ];

  it("desfaz a migração inteira e conserva a versão anterior", () => {
    const banco = abrirBanco(":memory:");

    try {
      expect(versaoAtual(banco)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);

      expect(() => aplicarMigracoes(banco, migracaoQueFalha)).toThrow();

      expect(existeTabela(banco, "parcial")).toBe(false);
      expect(existeTabela(banco, "cartao")).toBe(true);
      expect(existeTabela(banco, "baralho")).toBe(true);
      expect(existeTabela(banco, "vinculo")).toBe(true);
      expect(versaoAtual(banco)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);
    } finally {
      banco.close();
    }
  });

  it("depois do rollback a conexão continua utilizável para a próxima migração", () => {
    const banco = abrirBanco(":memory:");

    try {
      expect(() => aplicarMigracoes(banco, migracaoQueFalha)).toThrow();

      aplicarMigracoes(banco, [
        { versao: 5, sql: "CREATE TABLE tabela_cinco (id TEXT PRIMARY KEY);" },
      ]);

      expect(existeTabela(banco, "tabela_cinco")).toBe(true);
      expect(versaoAtual(banco)).toBe(5);
    } finally {
      banco.close();
    }
  });
});

describe("arquivo legado da feature 001 — cartao sem tabela de versão", () => {
  it("adota o cartao existente como migração 1 e aplica as seguintes, preservando os Cartões guardados", () => {
    comBanco((banco) => {
      // O que a feature 001 deixou em disco: cartao, sem versao_do_esquema.
      banco.exec(`
        CREATE TABLE IF NOT EXISTS cartao (
          id     TEXT PRIMARY KEY,
          frente TEXT NOT NULL CHECK (length(trim(frente)) > 0 AND length(frente) <= 1000),
          verso  TEXT NOT NULL CHECK (length(trim(verso))  > 0 AND length(verso)  <= 1000)
        );
      `);
      banco
        .prepare("INSERT INTO cartao (id, frente, verso) VALUES (?, ?, ?)")
        .run("legado", "To walk", "Caminhar");

      aplicarEsquema(banco);

      expect(existeTabela(banco, "versao_do_esquema")).toBe(true);
      expect(existeTabela(banco, "baralho")).toBe(true);
      expect(existeTabela(banco, "vinculo")).toBe(true);
      expect(existeTabela(banco, "usuario")).toBe(true);
      expect(versaoAtual(banco)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);

      const lido = banco
        .prepare("SELECT id, frente, verso FROM cartao WHERE id = ?")
        .get("legado");

      expect(lido).toEqual({
        id: "legado",
        frente: "To walk",
        verso: "Caminhar",
      });

      // O PRAGMA é por conexão: aplicarEsquema o liga também na base adotada.
      const pragma = banco.prepare("PRAGMA foreign_keys").get();

      expect(pragma?.foreign_keys).toBe(1);
    });
  });

  it("mantém IF NOT EXISTS na migração 1 para adotar a tabela pré-existente", () => {
    expect(MIGRACOES[0]?.versao).toBe(1);
    expect(MIGRACOES[0]?.sql).toContain("CREATE TABLE IF NOT EXISTS cartao");
  });
});

describe("arquivo criado antes desta feature — mesma versão, mesmos dados", () => {
  it("abre na versão registrada, sem reaplicar migração, e serve o mesmo conteúdo pela Porta", async () => {
    const diretorio = mkdtempSync(join(tmpdir(), "acervo-antes-da-porta-"));

    try {
      const caminho = join(diretorio, "memorizacao.sqlite");

      // O que uma execução anterior a esta feature deixava em disco: as
      // migrações aplicadas até a 3, a versão 3 registrada e conteúdo real.
      const anterior = new DatabaseSync(caminho);

      try {
        aplicarEsquema(anterior);
        anterior
          .prepare("INSERT INTO cartao (id, frente, verso) VALUES (?, ?, ?)")
          .run("c1", "To walk", "Caminhar");
        anterior
          .prepare("INSERT INTO baralho (id, nome) VALUES (?, ?)")
          .run("b1", "Inglês");
        anterior
          .prepare("INSERT INTO vinculo (cartao_id, baralho_id) VALUES (?, ?)")
          .run("c1", "b1");
      } finally {
        anterior.close();
      }

      // A abertura pelo Adapter aplica apenas o que estivesse pendente — nada,
      // neste caso — e o conteúdo anterior continua servindo à Interface.
      const aberto = await abrirArmazenamentoSqlite(caminho);

      try {
        expect(await aberto.armazenamento.listarCartoes()).toEqual([
          { id: "c1", frente: "To walk", verso: "Caminhar" },
        ]);
        expect(await aberto.armazenamento.listarBaralhosDoCartao("c1")).toEqual([
          { id: "b1", nome: "Inglês" },
        ]);
        expect(
          await aberto.armazenamento.contarCartoesPorBaralho(),
        ).toContainEqual({ baralhoId: "b1", quantidadeDeCartoes: 1 });
      } finally {
        await aberto.encerrar();
      }

      // A versão registrada é a mesma de antes, e migração já aplicada nunca
      // rodou de novo: reaplicar a 2 ou a 3 falharia, pois as tabelas existem.
      const reaberto = new DatabaseSync(caminho);

      try {
        expect(versaoAtual(reaberto)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);
        expect(existeTabela(reaberto, "cartao")).toBe(true);
        expect(existeTabela(reaberto, "baralho")).toBe(true);
        expect(existeTabela(reaberto, "vinculo")).toBe(true);
        expect(
          reaberto.prepare("SELECT frente FROM cartao WHERE id = ?").get("c1")
            ?.frente,
        ).toBe("To walk");
      } finally {
        reaberto.close();
      }
    } finally {
      rmSync(diretorio, { recursive: true, force: true });
    }
  });
});
