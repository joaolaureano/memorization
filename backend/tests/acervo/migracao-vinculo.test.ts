import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  abrirBanco,
  aplicarMigracoes,
} from "../../src/armazenamento/sqlite/esquema.ts";
import { MIGRACOES } from "../../src/armazenamento/sqlite/migracoes.ts";
import {
  contarLinhas,
  gravarBaralho,
  gravarBaralhoSemDono,
  gravarCartao,
  gravarCartaoSemDono,
  gravarDono,
  gravarVinculo,
} from "./banco-de-teste.ts";

/**
 * A versão mais recente da lista de migrações — o que uma base nova registra
 * depois que todas rodam. Derivada, e não escrita à mão: acrescentar uma
 * migração não quebra estas asserções.
 */
const ULTIMA_VERSAO_DO_ESQUEMA = MIGRACOES.reduce(
  (maisRecente, migracao) => Math.max(maisRecente, migracao.versao),
  0,
);

/**
 * T201 e T202 — a migração 3 cria a tabela `vinculo` com chave primária
 * composta e cascata nas duas chaves estrangeiras, preservando Cartões e
 * Baralhos existentes; e a cascata é comprovada nos dois sentidos, sem
 * destruir a entidade do outro lado.
 *
 * As asserções inspecionam o esquema e usam SQL direto, porque é a rede de
 * segurança do banco que está sob verificação — o mesmo critério dos testes
 * de migração anteriores. O `PRAGMA foreign_keys` precisa estar ligado, sem o
 * qual o SQLite ignora as cascatas em silêncio.
 */

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

/**
 * O dono das linhas destes cenários. Todo Cartão e todo Baralho do acervo tem
 * dono desde a migração 5 (FR-092), e é por isso que as gravações diretas
 * começam pelo Usuário; as gravações da base **anterior** à migração, essas,
 * não têm dono algum.
 */
let dono: string;

function inserirCartao(banco: DatabaseSync, id: string): void {
  gravarCartao(banco, dono, id);
}

function inserirBaralho(banco: DatabaseSync, id: string, nome: string): void {
  gravarBaralho(banco, dono, id, nome);
}

function inserirVinculo(banco: DatabaseSync, cartaoId: string, baralhoId: string): void {
  gravarVinculo(banco, cartaoId, baralhoId);
}

/** As gravações da base anterior à migração 5, quando não há dono a informar. */
function inserirCartaoSemDono(banco: DatabaseSync, id: string): void {
  gravarCartaoSemDono(banco, id);
}

function inserirBaralhoSemDono(banco: DatabaseSync, id: string, nome: string): void {
  gravarBaralhoSemDono(banco, id, nome);
}

describe("migração 3 — base da feature 002 com dados reais", () => {
  it("cria vinculo preservando Cartões e Baralhos, sem reaplicar a migração", () => {
    const diretorio = mkdtempSync(join(tmpdir(), "acervo-vinculo-"));

    try {
      const caminho = join(diretorio, "banco.sqlite");

      // O que a feature 002 deixou instalado: versão 2, com cartao e baralho
      // e dados reais gravados, mas ainda sem a tabela vinculo.
      let banco = new DatabaseSync(caminho);

      try {
        aplicarMigracoes(banco, MIGRACOES.slice(0, 2));
        inserirCartaoSemDono(banco, "c1");
        inserirCartaoSemDono(banco, "c2");
        inserirBaralhoSemDono(banco, "b1", "Inglês");
        inserirBaralhoSemDono(banco, "b2", "Espanhol");
      } finally {
        banco.close();
      }

      // A reabertura migra até a versão corrente: cria vinculo (3) e usuario
      // (4), e a migração 5 recria as três tabelas do acervo com dono — o
      // acervo da feature 002, que não tem dono, é descartado (FR-099).
      banco = abrirBanco(caminho);

      try {
        expect(versaoAtual(banco)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);
        expect(existeTabela(banco, "cartao")).toBe(true);
        expect(existeTabela(banco, "baralho")).toBe(true);
        expect(existeTabela(banco, "vinculo")).toBe(true);
        expect(existeTabela(banco, "usuario")).toBe(true);
        expect(contarLinhas(banco, "cartao")).toBe(0);
        expect(contarLinhas(banco, "baralho")).toBe(0);
        expect(contarLinhas(banco, "vinculo")).toBe(0);

        // A tabela vinculo recriada é a mesma de antes: chave primária
        // composta e cascata nas duas chaves estrangeiras.
        const colunas = banco.prepare("PRAGMA table_info(vinculo)").all();

        expect(colunas.map((coluna) => coluna.name)).toEqual([
          "cartao_id",
          "baralho_id",
        ]);
        expect(colunas.map((coluna) => coluna.pk)).toEqual([1, 2]);
      } finally {
        banco.close();
      }

      // Reabrir de novo não reaplica migração alguma: a versão permanece a
      // corrente, e as tabelas continuam onde estavam.
      banco = abrirBanco(caminho);

      try {
        expect(versaoAtual(banco)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);
        expect(existeTabela(banco, "vinculo")).toBe(true);
      } finally {
        banco.close();
      }
    } finally {
      rmSync(diretorio, { recursive: true, force: true });
    }
  });
});

let banco: DatabaseSync;

beforeEach(() => {
  banco = abrirBanco(":memory:");
  dono = gravarDono(banco);
});

afterEach(() => {
  banco.close();
});

describe("tabela vinculo — forma do esquema", () => {
  it("tem chave primária composta (cartao_id, baralho_id)", () => {
    const colunas = banco.prepare("PRAGMA table_info(vinculo)").all();

    expect(colunas).toHaveLength(2);
    expect(colunas[0]).toMatchObject({
      name: "cartao_id",
      type: "TEXT",
      notnull: 1,
      pk: 1,
    });
    expect(colunas[1]).toMatchObject({
      name: "baralho_id",
      type: "TEXT",
      notnull: 1,
      pk: 2,
    });
  });

  it("declara ON DELETE CASCADE nas duas chaves estrangeiras", () => {
    const chaves = banco.prepare("PRAGMA foreign_key_list(vinculo)").all();

    expect(chaves).toHaveLength(2);
    expect(chaves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "cartao",
          from: "cartao_id",
          to: "id",
          on_delete: "CASCADE",
        }),
        expect.objectContaining({
          table: "baralho",
          from: "baralho_id",
          to: "id",
          on_delete: "CASCADE",
        }),
      ]),
    );
  });

  it("recusa inserção duplicada do mesmo par pela chave composta", () => {
    inserirCartao(banco, "c1");
    inserirBaralho(banco, "b1", "Inglês");
    inserirVinculo(banco, "c1", "b1");

    expect(() => inserirVinculo(banco, "c1", "b1")).toThrow(
      /UNIQUE constraint failed: vinculo\.cartao_id, vinculo\.baralho_id/,
    );
  });
});

describe("cascata — exclusão de um lado não destrói o outro", () => {
  it("liga PRAGMA foreign_keys na conexão", () => {
    const pragma = banco.prepare("PRAGMA foreign_keys").get();

    expect(pragma?.foreign_keys).toBe(1);
  });

  it("excluir um Cartão remove seus Vínculos, mas os dois Baralhos sobrevivem", () => {
    inserirCartao(banco, "c1");
    inserirBaralho(banco, "b1", "Inglês");
    inserirBaralho(banco, "b2", "Espanhol");
    inserirVinculo(banco, "c1", "b1");
    inserirVinculo(banco, "c1", "b2");

    banco.prepare("DELETE FROM cartao WHERE id = ?").run("c1");

    expect(
      banco.prepare("SELECT count(*) AS total FROM vinculo WHERE cartao_id = ?").get("c1")
        ?.total,
    ).toBe(0);
    expect(
      banco.prepare("SELECT count(*) AS total FROM baralho").get()?.total,
    ).toBe(2);
    expect(
      banco
        .prepare("SELECT id, nome FROM baralho ORDER BY id")
        .all(),
    ).toEqual([
      { id: "b1", nome: "Inglês" },
      { id: "b2", nome: "Espanhol" },
    ]);
  });

  it("excluir um Baralho remove seus Vínculos, mas os dois Cartões sobrevivem", () => {
    inserirCartao(banco, "c1");
    inserirCartao(banco, "c2");
    inserirBaralho(banco, "b1", "Inglês");
    inserirVinculo(banco, "c1", "b1");
    inserirVinculo(banco, "c2", "b1");

    banco.prepare("DELETE FROM baralho WHERE id = ?").run("b1");

    expect(
      banco.prepare("SELECT count(*) AS total FROM vinculo WHERE baralho_id = ?").get("b1")
        ?.total,
    ).toBe(0);
    expect(
      banco.prepare("SELECT count(*) AS total FROM cartao").get()?.total,
    ).toBe(2);
    expect(
      banco.prepare("SELECT id FROM cartao ORDER BY id").all().map((linha) => linha.id),
    ).toEqual(["c1", "c2"]);
  });
});
