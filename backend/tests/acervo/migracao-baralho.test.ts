import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { criarAcervo, type Cartao } from "../../src/acervo/acervo.ts";
import { abrirArmazenamentoSqlite } from "../../src/armazenamento/sqlite/armazenamento.ts";
import { abrirBanco } from "../../src/armazenamento/sqlite/esquema.ts";
import { MIGRACOES } from "../../src/armazenamento/sqlite/migracoes.ts";

/**
 * T102 — migração 2 cria a tabela `baralho` preservando os Cartões
 * preexistentes.
 *
 * O cenário central reconstrói o que a feature `001` deixou instalado: um
 * arquivo SQLite com a tabela `cartao` criada na primeira execução, sem
 * `versao_do_esquema`, e Cartões reais. A abertura pelo Adapter do
 * armazenamento local adota o `cartao` existente, cria `baralho` e `vinculo` e
 * devolve todos os Cartões intactos pela Interface do `Acervo`.
 *
 * As restrições da tabela são verificadas diretamente no SQLite em memória,
 * porque é a rede de segurança do banco que está sob verificação: a `CHECK`
 * recusa nome vazio, só de espaços e com 101 caracteres (FR-011, FR-061), e a
 * ausência de `UNIQUE` sobre `nome` aceita dois Baralhos homônimos (FR-012).
 * A tabela não tem coluna além de `id` e `nome` (FR-018).
 */

const LIMITE_DO_NOME = 100;

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

/** O DDL que a feature 001 criou na primeira execução, sem versão de esquema. */
function criarBaseLegadaDaFeature001(banco: DatabaseSync): void {
  banco.exec(`
    CREATE TABLE IF NOT EXISTS cartao (
      id     TEXT PRIMARY KEY,
      frente TEXT NOT NULL CHECK (length(trim(frente)) > 0 AND length(frente) <= 1000),
      verso  TEXT NOT NULL CHECK (length(trim(verso))  > 0 AND length(verso)  <= 1000)
    );
  `);
}

/**
 * Grava os Cartões da base legada. A gravação é direta porque o arquivo
 * anterior a esta feature não tem tabela de versão: quem grava é quem migra,
 * e o Adapter do armazenamento local só oferece a Porta depois de migrar — o
 * que é justamente o comportamento que este cenário prova.
 */
function gravarCartoesLegados(banco: DatabaseSync, cartoes: Cartao[]): void {
  const inserir = banco.prepare(
    "INSERT INTO cartao (id, frente, verso) VALUES (?, ?, ?)",
  );

  for (const cartao of cartoes) {
    inserir.run(cartao.id, cartao.frente, cartao.verso);
  }
}

describe("base legada da feature 001 com Cartões — migração até a versão corrente", () => {
  it("cria baralho e vinculo preservando todos os Cartões intactos, e a reabertura não reaplica", async () => {
    const diretorio = mkdtempSync(join(tmpdir(), "acervo-baralho-"));

    try {
      const caminho = join(diretorio, "banco.sqlite");

      // O que a feature 001 deixou em disco: cartao, sem versao_do_esquema,
      // e Cartões reais.
      const criados: Cartao[] = [
        { id: "legado-1", frente: "To walk", verso: "Caminhar" },
        { id: "legado-2", frente: "To read", verso: "Ler" },
        { id: "legado-3", frente: "To sleep", verso: "Dormir" },
      ];

      const anterior = new DatabaseSync(caminho);

      try {
        criarBaseLegadaDaFeature001(anterior);
        gravarCartoesLegados(anterior, criados);
      } finally {
        anterior.close();
      }

      // A abertura pelo Adapter migra: adota o cartao existente (1), cria
      // baralho (2), cria vinculo (3) e cria usuario (4).
      const aberto = await abrirArmazenamentoSqlite(caminho);

      try {
        const sobreviventes = await criarAcervo(
          aberto.armazenamento,
        ).listarCartoes();

        expect(sobreviventes).toHaveLength(criados.length);
        expect(sobreviventes).toEqual(
          expect.arrayContaining(
            criados.map((cartao) => ({ ...cartao, baralhos: [] })),
          ),
        );
      } finally {
        await aberto.encerrar();
      }

      let banco = abrirBanco(caminho);

      try {
        expect(versaoAtual(banco)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);
        expect(existeTabela(banco, "baralho")).toBe(true);
        expect(existeTabela(banco, "vinculo")).toBe(true);
      } finally {
        banco.close();
      }

      // Reabrir de novo não reaplica as migrações: a versão permanece 4 e os
      // Cartões continuam lá. Reaplicar falharia, pois as tabelas já existem.
      banco = abrirBanco(caminho);

      try {
        expect(versaoAtual(banco)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);
        expect(existeTabela(banco, "baralho")).toBe(true);
        expect(existeTabela(banco, "vinculo")).toBe(true);
        expect(
          banco.prepare("SELECT count(*) AS total FROM cartao").get()?.total,
        ).toBe(criados.length);
      } finally {
        banco.close();
      }
    } finally {
      rmSync(diretorio, { recursive: true, force: true });
    }
  });

  it("base já migrada reaberta conserva a versão corrente e o Baralho gravado", () => {
    const diretorio = mkdtempSync(join(tmpdir(), "acervo-baralho-"));

    try {
      const caminho = join(diretorio, "banco.sqlite");

      let banco = abrirBanco(caminho);

      banco
        .prepare("INSERT INTO baralho (id, nome) VALUES (?, ?)")
        .run("b1", "Inglês");
      banco.close();

      banco = abrirBanco(caminho);

      try {
        expect(versaoAtual(banco)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);

        const lido = banco
          .prepare("SELECT id, nome FROM baralho WHERE id = ?")
          .get("b1");

        expect(lido).toEqual({ id: "b1", nome: "Inglês" });
      } finally {
        banco.close();
      }
    } finally {
      rmSync(diretorio, { recursive: true, force: true });
    }
  });
});

let banco: DatabaseSync;

function inserirBaralho(id: string, nome: string): void {
  banco.prepare("INSERT INTO baralho (id, nome) VALUES (?, ?)").run(id, nome);
}

/** Cria a mensagem de recusa esperada do SQLite para a CHECK de nome. */
function recusaPorCheckDoNome(): RegExp {
  return new RegExp(
    "CHECK constraint failed: length\\(trim\\(nome\\)\\)\\s*>\\s*0\\s*AND\\s*length\\(nome\\)\\s*<=\\s*100",
  );
}

beforeEach(() => {
  banco = abrirBanco(":memory:");
});

afterEach(() => {
  banco.close();
});

describe("tabela baralho — forma do esquema", () => {
  it("tem exatamente id e nome, sem coluna de elegibilidade, contagem ou vínculo", () => {
    const colunas = banco.prepare("PRAGMA table_info(baralho)").all();

    expect(colunas).toHaveLength(2);
    expect(colunas[0]).toMatchObject({
      name: "id",
      type: "TEXT",
      notnull: 0,
      pk: 1,
    });
    expect(colunas[1]).toMatchObject({
      name: "nome",
      type: "TEXT",
      notnull: 1,
      pk: 0,
    });
    expect(colunas.map((coluna) => coluna.name)).toEqual(["id", "nome"]);
  });

  it("não declara UNIQUE sobre nome: o nome é rótulo, não identificador", () => {
    const sql = banco
      .prepare("SELECT sql FROM sqlite_master WHERE name = ?")
      .get("baralho")?.sql as string;

    expect(sql).not.toContain("UNIQUE");
  });
});

describe("tabela baralho — restrição CHECK de nome", () => {
  it("recusa nome vazio", () => {
    expect(() => inserirBaralho("b1", "")).toThrow(recusaPorCheckDoNome());
  });

  it("recusa nome composto só de espaços", () => {
    expect(() => inserirBaralho("b1", "   ")).toThrow(recusaPorCheckDoNome());
  });

  it("recusa nome com 101 caracteres", () => {
    expect(() => inserirBaralho("b1", "a".repeat(LIMITE_DO_NOME + 1))).toThrow(
      recusaPorCheckDoNome(),
    );
  });

  it("aceita nome exatamente no limite de 100 caracteres", () => {
    const nome = "a".repeat(LIMITE_DO_NOME);

    inserirBaralho("b1", nome);

    const lido = banco.prepare("SELECT nome FROM baralho WHERE id = ?").get("b1");

    expect(lido?.nome).toHaveLength(LIMITE_DO_NOME);
  });

  it("aceita dois Baralhos de nome repetido", () => {
    inserirBaralho("b1", "Inglês");
    inserirBaralho("b2", "Inglês");

    const total = banco
      .prepare("SELECT count(*) AS total FROM baralho WHERE nome = ?")
      .get("Inglês");

    expect(total?.total).toBe(2);
  });
});
