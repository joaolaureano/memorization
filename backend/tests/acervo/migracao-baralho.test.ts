import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  criarAcervo,
  type Cartao,
  type ResultadoDeCriacaoDeCartao,
} from "../../src/acervo/acervo.ts";
import { abrirBanco } from "../../src/acervo/esquema.ts";

/**
 * T102 — migração 2 cria a tabela `baralho` preservando os Cartões
 * preexistentes.
 *
 * O cenário central reconstrói o que a feature `001` deixou instalado: um
 * arquivo SQLite com a tabela `cartao` criada na primeira execução, sem
 * `versao_do_esquema`, e Cartões reais — criados pela Interface do `Acervo`,
 * como o usuário os criou. Migrar essa base até a versão 2 deve adotar o
 * `cartao` existente, criar `baralho` e devolver todos os Cartões intactos.
 *
 * As restrições da tabela são verificadas diretamente no SQLite em memória,
 * porque é a rede de segurança do banco que está sob verificação: a `CHECK`
 * recusa nome vazio, só de espaços e com 101 caracteres (FR-011, FR-061), e a
 * ausência de `UNIQUE` sobre `nome` aceita dois Baralhos homônimos (FR-012).
 * A tabela não tem coluna além de `id` e `nome` (FR-018).
 */

const LIMITE_DO_NOME = 100;

/** Desembrulha o Cartão de uma criação aceita; falha se foi recusada. */
function cartaoDo(resultado: ResultadoDeCriacaoDeCartao): Cartao {
  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.cartao;
}

/** Versão registrada na tabela de controle; 0 quando a base não tem linha. */
function versaoAtual(banco: DatabaseSync): number {
  const linha = banco.prepare("SELECT versao FROM versao_do_esquema").get();

  return linha === undefined ? 0 : Number(linha.versao);
}

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

describe("base legada da feature 001 com Cartões — migração até a versão 2", () => {
  it("cria baralho preservando todos os Cartões intactos, e a reabertura não reaplica a migração 2", () => {
    const diretorio = mkdtempSync(join(tmpdir(), "acervo-baralho-"));

    try {
      const caminho = join(diretorio, "banco.sqlite");

      // O que a feature 001 deixou em disco: cartao, sem versao_do_esquema,
      // e Cartões reais criados pela Interface do Acervo.
      let banco = new DatabaseSync(caminho);
      let criados: Cartao[];

      try {
        criarBaseLegadaDaFeature001(banco);

        const acervo = criarAcervo(banco);

        criados = [
          cartaoDo(acervo.criarCartao({ frente: "To walk", verso: "Caminhar" })),
          cartaoDo(acervo.criarCartao({ frente: "To read", verso: "Ler" })),
          cartaoDo(acervo.criarCartao({ frente: "To sleep", verso: "Dormir" })),
        ];
      } finally {
        banco.close();
      }

      // A reabertura migra: adota o cartao existente (1) e cria baralho (2).
      banco = abrirBanco(caminho);

      try {
        expect(versaoAtual(banco)).toBe(2);
        expect(existeTabela(banco, "baralho")).toBe(true);

        const sobreviventes = criarAcervo(banco).listarCartoes();

        expect(sobreviventes).toHaveLength(criados.length);
        expect(sobreviventes).toEqual(expect.arrayContaining(criados));
      } finally {
        banco.close();
      }

      // Reabrir de novo não reaplica a migração 2: a versão permanece 2 e os
      // Cartões continuam lá. Reaplicar falharia, pois a tabela já existe.
      banco = abrirBanco(caminho);

      try {
        expect(versaoAtual(banco)).toBe(2);
        expect(existeTabela(banco, "baralho")).toBe(true);
        expect(criarAcervo(banco).listarCartoes()).toHaveLength(criados.length);
      } finally {
        banco.close();
      }
    } finally {
      rmSync(diretorio, { recursive: true, force: true });
    }
  });

  it("base já migrada reaberta conserva a versão 2 e o Baralho gravado", () => {
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
        expect(versaoAtual(banco)).toBe(2);

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
