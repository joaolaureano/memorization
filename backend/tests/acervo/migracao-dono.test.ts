import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { abrirArmazenamentoSqlite } from "../../src/armazenamento/sqlite/armazenamento.ts";
import { abrirBanco, aplicarMigracoes } from "../../src/armazenamento/sqlite/esquema.ts";
import { MIGRACOES } from "../../src/armazenamento/sqlite/migracoes.ts";
import { contarLinhas, gravarCartaoSemDono, gravarDono } from "./banco-de-teste.ts";

/**
 * T701 — a migração 5 dá **dono** ao acervo (FR-099, SC-037).
 *
 * O cenário é o de uma base **já instalada**: a versão 4 registrada, os
 * Usuários da `007` dentro e o acervo das features `001` a `006` — Cartões,
 * Baralhos e Vínculos que não têm dono, porque nasceram antes de haver Usuário
 * a quem pertencer. O que a migração precisa entregar: os Usuários
 * **sobrevivem** intactos, e não sobra um Cartão, um Baralho ou um Vínculo sem
 * dono — o acervo antigo é descartado, e é perda de dados assumida pelo Product
 * Owner no clarify.
 *
 * As asserções são do esquema e do conteúdo, lidas direto no SQLite porque é a
 * base instalada que está sob verificação: `usuario_id` obrigatório e indexado
 * em `cartao` e `baralho`, chave primária composta de `vinculo` preservada, e
 * nenhuma coluna capaz de guardar a Credencial, em nenhuma das cinco tabelas
 * (FR-079). A última versão é sempre **derivada** da lista de migrações: nenhum
 * número é escrito à mão.
 */

/** A última versão da lista de migrações — nunca um número escrito à mão. */
const ULTIMA_VERSAO_DO_ESQUEMA = MIGRACOES.reduce(
  (maisRecente, migracao) => Math.max(maisRecente, migracao.versao),
  0,
);

/** A versão da base instalada que este cenário prepara: a da feature `007`. */
const VERSAO_INSTALADA = 4;

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

/** O DDL da tabela informada, como ele ficou gravado no arquivo. */
function ddlDaTabela(banco: DatabaseSync, tabela: string): string {
  return (
    (banco
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tabela)?.sql as string | undefined) ?? ""
  );
}

/** Os nomes dos índices da tabela informada. */
function indicesDaTabela(banco: DatabaseSync, tabela: string): string[] {
  return banco
    .prepare(`PRAGMA index_list(${tabela})`)
    .all()
    .map((indice) => indice.name as string);
}

/**
 * Prepara o que a versão 4 deixava em disco: as migrações até a 4, um Usuário
 * de verdade e o acervo sem dono das features `001` a `006`, com Cartões e
 * Baralhos de dois assuntos e Vínculos entre eles.
 */
function prepararBaseInstalada(banco: DatabaseSync): void {
  aplicarMigracoes(banco, MIGRACOES.slice(0, VERSAO_INSTALADA));
  gravarDono(banco, "usuario-um", "ana.silva");
  gravarDono(banco, "usuario-dois", "bruno.souza");

  gravarCartaoSemDono(banco, "c1");
  gravarCartaoSemDono(banco, "c2", "To read", "Ler");
  gravarCartaoSemDono(banco, "c3", "To sleep", "Dormir");

  banco.prepare("INSERT INTO baralho (id, nome) VALUES (?, ?)").run("b1", "Inglês");
  banco.prepare("INSERT INTO baralho (id, nome) VALUES (?, ?)").run("b2", "Alemão");

  banco.prepare("INSERT INTO vinculo (cartao_id, baralho_id) VALUES (?, ?)").run("c1", "b1");
  banco.prepare("INSERT INTO vinculo (cartao_id, baralho_id) VALUES (?, ?)").run("c2", "b1");
  banco.prepare("INSERT INTO vinculo (cartao_id, baralho_id) VALUES (?, ?)").run("c3", "b2");
}

/** Executa o corpo sobre uma base instalada na versão 4, em arquivo próprio. */
function comBaseNaVersao4(corpo: (caminho: string) => Promise<void>): Promise<void> {
  const diretorio = mkdtempSync(join(tmpdir(), "acervo-dono-"));
  const caminho = join(diretorio, "banco.sqlite");

  return (async () => {
    const anterior = new DatabaseSync(caminho);

    try {
      prepararBaseInstalada(anterior);
    } finally {
      anterior.close();
    }

    try {
      await corpo(caminho);
    } finally {
      rmSync(diretorio, { recursive: true, force: true });
    }
  })();
}

describe("migração 5 — base instalada na versão 4, com Usuários e acervo sem dono", () => {
  it("migra para a versão corrente descartando o acervo, e os Usuários sobrevivem", async () => {
    await comBaseNaVersao4(async (caminho) => {
      const antes = new DatabaseSync(caminho);

      try {
        expect(versaoAtual(antes)).toBe(VERSAO_INSTALADA);
        expect(contarLinhas(antes, "cartao")).toBe(3);
        expect(contarLinhas(antes, "baralho")).toBe(2);
        expect(contarLinhas(antes, "vinculo")).toBe(3);
        expect(contarLinhas(antes, "usuario")).toBe(2);
      } finally {
        antes.close();
      }

      /** A abertura pelo Adapter aplica a migração 5 e devolve a Porta. */
      const aberto = await abrirArmazenamentoSqlite(caminho);

      await aberto.encerrar();

      const depois = new DatabaseSync(caminho);

      try {
        expect(versaoAtual(depois)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);
        expect(existeTabela(depois, "cartao")).toBe(true);
        expect(existeTabela(depois, "baralho")).toBe(true);
        expect(existeTabela(depois, "vinculo")).toBe(true);

        /** Nenhum Cartão, Baralho ou Vínculo sem dono existe (FR-099). */
        expect(contarLinhas(depois, "cartao")).toBe(0);
        expect(contarLinhas(depois, "baralho")).toBe(0);
        expect(contarLinhas(depois, "vinculo")).toBe(0);

        /** E os Usuários da `007` sobrevivem à recriação das três tabelas. */
        expect(
          depois
            .prepare("SELECT id, nome_de_usuario FROM usuario ORDER BY id")
            .all(),
        ).toEqual([
          { id: "usuario-dois", nome_de_usuario: "bruno.souza" },
          { id: "usuario-um", nome_de_usuario: "ana.silva" },
        ]);
      } finally {
        depois.close();
      }
    });
  });

  it("deixa usuario_id obrigatório e indexado nas duas tabelas, e a chave composta de vinculo intacta", async () => {
    await comBaseNaVersao4(async (caminho) => {
      const aberto = await abrirArmazenamentoSqlite(caminho);

      await aberto.encerrar();

      const banco = new DatabaseSync(caminho);

      try {
        for (const tabela of ["cartao", "baralho"]) {
          const colunas = banco.prepare(`PRAGMA table_info(${tabela})`).all();

          expect(colunas.map((coluna) => coluna.name)).toEqual([
            "id",
            ...(tabela === "cartao" ? ["frente", "verso"] : ["nome"]),
            "usuario_id",
          ]);

          const dono = colunas.find((coluna) => coluna.name === "usuario_id");

          expect(dono).toMatchObject({ notnull: 1, type: "TEXT" });
          expect(indicesDaTabela(banco, tabela)).toContain(
            `indice_${tabela}_por_usuario`,
          );

          /** O dono referencia `usuario` e cai em cascata com ele. */
          const chaves = banco.prepare(`PRAGMA foreign_key_list(${tabela})`).all();

          expect(chaves).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                table: "usuario",
                from: "usuario_id",
                to: "id",
                on_delete: "CASCADE",
              }),
            ]),
          );
        }

        /** A chave primária composta de `vinculo` foi preservada (FR-020). */
        const colunas = banco.prepare("PRAGMA table_info(vinculo)").all();

        expect(colunas.map((coluna) => coluna.name)).toEqual([
          "cartao_id",
          "baralho_id",
        ]);
        expect(colunas.map((coluna) => coluna.pk)).toEqual([1, 2]);

        const chaves = banco.prepare("PRAGMA foreign_key_list(vinculo)").all();

        expect(chaves).toHaveLength(2);

        for (const chave of chaves) {
          expect(chave.on_delete).toBe("CASCADE");
        }
      } finally {
        banco.close();
      }
    });
  });

  it("não acrescenta coluna capaz de guardar a Credencial, em tabela alguma", async () => {
    await comBaseNaVersao4(async (caminho) => {
      const aberto = await abrirArmazenamentoSqlite(caminho);

      await aberto.encerrar();

      const banco = new DatabaseSync(caminho);

      try {
        for (const tabela of [
          "cartao",
          "baralho",
          "vinculo",
          "usuario",
          "versao_do_esquema",
        ]) {
          expect(ddlDaTabela(banco, tabela)).not.toMatch(
            /senha|password|token|sessao|cookie|credencial/i,
          );
        }
      } finally {
        banco.close();
      }
    });
  });

  it("não reaplica a migração ao reabrir, e o acervo novo do Usuário é gravado com dono", async () => {
    await comBaseNaVersao4(async (caminho) => {
      const primeira = await abrirArmazenamentoSqlite(caminho);

      /** A migração 5 já rodou: reabrir não pode tentar derrubar tabela nada. */
      await primeira.encerrar();

      const segunda = await abrirArmazenamentoSqlite(caminho);

      try {
        const gravado = await segunda.armazenamento.inserirCartao("usuario-um", {
          id: "c-novo",
          frente: "To walk",
          verso: "Caminhar",
        });

        expect(gravado).toEqual({
          ok: true,
          valor: { id: "c-novo", frente: "To walk", verso: "Caminhar" },
        });

        /** O Cartão novo é do primeiro Usuário, e invisível para o segundo. */
        expect(await segunda.armazenamento.listarCartoes("usuario-um")).toEqual([
          { id: "c-novo", frente: "To walk", verso: "Caminhar" },
        ]);
        expect(await segunda.armazenamento.listarCartoes("usuario-dois")).toEqual(
          [],
        );
      } finally {
        await segunda.encerrar();
      }

      const banco = abrirBanco(caminho);

      try {
        expect(versaoAtual(banco)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);
        expect(contarLinhas(banco, "cartao")).toBe(1);
      } finally {
        banco.close();
      }
    });
  });

  it("sobe desde a versão 1 e descarta o acervo adotado da feature 001", async () => {
    const diretorio = mkdtempSync(join(tmpdir(), "acervo-dono-legado-"));
    const caminho = join(diretorio, "banco.sqlite");

    try {
      /** O que a feature 001 deixou: `cartao` sem tabela de versão e Cartões. */
      const anterior = new DatabaseSync(caminho);

      try {
        anterior.exec(`
          CREATE TABLE IF NOT EXISTS cartao (
            id     TEXT PRIMARY KEY,
            frente TEXT NOT NULL CHECK (length(trim(frente)) > 0 AND length(frente) <= 1000),
            verso  TEXT NOT NULL CHECK (length(trim(verso))  > 0 AND length(verso)  <= 1000)
          );
        `);
        gravarCartaoSemDono(anterior, "legado-1");
        gravarCartaoSemDono(anterior, "legado-2", "To read", "Ler");
      } finally {
        anterior.close();
      }

      const aberto = await abrirArmazenamentoSqlite(caminho);

      await aberto.encerrar();

      const banco = abrirBanco(caminho);

      try {
        expect(versaoAtual(banco)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);
        expect(contarLinhas(banco, "cartao")).toBe(0);
        expect(contarLinhas(banco, "baralho")).toBe(0);
        expect(contarLinhas(banco, "vinculo")).toBe(0);

        /** E toda linha nova do acervo exige dono, que agora é obrigatório. */
        expect(() =>
          banco
            .prepare("INSERT INTO cartao (id, frente, verso) VALUES (?, ?, ?)")
            .run("c1", "To walk", "Caminhar"),
        ).toThrow();
      } finally {
        banco.close();
      }
    } finally {
      rmSync(diretorio, { recursive: true, force: true });
    }
  });
});
