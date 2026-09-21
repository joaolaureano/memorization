import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { aplicarMigracoes } from "../../../src/armazenamento/postgresql/esquema.ts";
import { MIGRACOES } from "../../../src/armazenamento/postgresql/migracoes.ts";
import {
  abrirArmazenamentoDaBase,
  abrirPiscinaDaBase,
  descartarBasesDeTeste,
} from "./base-de-teste.ts";
import {
  servidorDeTeste,
  type ServidorAutonomo,
} from "./servidor-de-teste.ts";

/**
 * T701, no dialeto da nuvem — a migração 5 dá **dono** ao acervo, com o mesmo
 * número de versão da migração do Adapter local (FR-099, SC-037).
 *
 * O cenário é o de uma base **já instalada**: a versão 4 registrada, os
 * Usuários da `007` dentro e o acervo das features `001` a `006` — Cartões,
 * Baralhos e Vínculos sem dono, porque nasceram antes de haver Usuário a quem
 * pertencer. O que a migração precisa entregar: os Usuários **sobrevivem**
 * intactos, e não sobra um Cartão, um Baralho ou um Vínculo sem dono.
 *
 * As asserções são do esquema e do conteúdo, lidas no catálogo da base: o
 * índice por dono em `cartao` e `baralho`, `usuario_id` obrigatório, a chave
 * primária composta de `vinculo` preservada com as duas cascatas, e nenhuma
 * coluna capaz de guardar a Credencial (FR-079). A última versão é sempre
 * **derivada** da lista de migrações: nenhum número é escrito à mão.
 */

/** A última versão da lista de migrações — nunca um número escrito à mão. */
const ULTIMA_VERSAO_DO_ESQUEMA = MIGRACOES.reduce(
  (maisRecente, migracao) => Math.max(maisRecente, migracao.versao),
  0,
);

/** A versão da base instalada que este cenário prepara: a da feature `007`. */
const VERSAO_INSTALADA = 4;

let servidor: ServidorAutonomo;

/** Subir o PostgreSQL real leva segundos: o prazo do gancho é folgado. */
beforeAll(async () => {
  servidor = await servidorDeTeste();
}, 120_000);

afterAll(async () => {
  await descartarBasesDeTeste();
  await servidor.encerrar();
});

/**
 * Prepara o que a versão 4 deixava em disco: as migrações até a 4, dois
 * Usuários de verdade e o acervo sem dono das features `001` a `006`, com
 * Cartões e Baralhos de dois assuntos e Vínculos entre eles.
 */
async function prepararBaseInstalada(nomeDaBase: string): Promise<void> {
  const piscina = await abrirPiscinaDaBase(nomeDaBase);

  try {
    await aplicarMigracoes(piscina, MIGRACOES.slice(0, VERSAO_INSTALADA));

    const inserirUsuario = `
      INSERT INTO usuario (id, nome_de_usuario, sal, hash, parametros)
      VALUES ($1, $2, $3, $4, '{}');`;

    await piscina.query(inserirUsuario, [
      "usuario-um",
      "ana.silva",
      Buffer.alloc(16),
      Buffer.from("hash-sintetico"),
    ]);
    await piscina.query(inserirUsuario, [
      "usuario-dois",
      "bruno.souza",
      Buffer.alloc(16),
      Buffer.from("hash-sintetico"),
    ]);

    await piscina.query(
      "INSERT INTO cartao (id, frente, verso) VALUES ('c1', 'To walk', 'Caminhar');",
    );
    await piscina.query(
      "INSERT INTO cartao (id, frente, verso) VALUES ('c2', 'To read', 'Ler');",
    );
    await piscina.query("INSERT INTO baralho (id, nome) VALUES ('b1', 'Inglês');");
    await piscina.query("INSERT INTO vinculo (cartao_id, baralho_id) VALUES ('c1', 'b1');");
    await piscina.query("INSERT INTO vinculo (cartao_id, baralho_id) VALUES ('c2', 'b1');");
  } finally {
    await piscina.end();
  }
}

/** Cria a base na versão 4 e responde com o seu nome. */
async function baseNaVersao4(titulo: string): Promise<string> {
  const nomeDaBase = await servidor.criarBase(`dono-${titulo}`);

  await prepararBaseInstalada(nomeDaBase);

  return nomeDaBase;
}

describe("migração 5 — base instalada na versão 4, com Usuários e acervo sem dono", () => {
  it("migra para a versão corrente descartando o acervo, e os Usuários sobrevivem", async () => {
    const nomeDaBase = await baseNaVersao4("descarte");

    /** Antes: o acervo sem dono da base instalada. */
    expect(
      await servidor.consultar<{ total: string }>(
        nomeDaBase,
        "SELECT count(*) AS total FROM cartao;",
      ),
    ).toEqual([{ total: "2" }]);

    /** O comando de migração da nuvem leva a base até a versão corrente. */
    const piscina = await abrirPiscinaDaBase(nomeDaBase);
    let versao = 0;

    try {
      versao = await aplicarMigracoes(piscina);
    } finally {
      await piscina.end();
    }

    expect(versao).toBe(ULTIMA_VERSAO_DO_ESQUEMA);

    const versoes = await servidor.consultar<{ versao: number }>(
      nomeDaBase,
      "SELECT versao FROM versao_do_esquema;",
    );

    expect(versoes.map((linha) => Number(linha.versao))).toEqual([
      ULTIMA_VERSAO_DO_ESQUEMA,
    ]);

    /** Nenhum Cartão, Baralho ou Vínculo sem dono existe (FR-099). */
    for (const tabela of ["cartao", "baralho", "vinculo"]) {
      expect(
        await servidor.consultar<{ total: string }>(
          nomeDaBase,
          `SELECT count(*) AS total FROM ${tabela};`,
        ),
      ).toEqual([{ total: "0" }]);
    }

    /** E os Usuários da `007` sobrevivem à recriação das três tabelas. */
    expect(
      await servidor.consultar<{ id: string; nome_de_usuario: string }>(
        nomeDaBase,
        "SELECT id, nome_de_usuario FROM usuario ORDER BY id;",
      ),
    ).toEqual([
      { id: "usuario-dois", nome_de_usuario: "bruno.souza" },
      { id: "usuario-um", nome_de_usuario: "ana.silva" },
    ]);
  });

  it("deixa usuario_id obrigatório e indexado, com o dono em cascata, e preserva a chave composta de vinculo", async () => {
    const nomeDaBase = await baseNaVersao4("forma");
    const piscina = await abrirPiscinaDaBase(nomeDaBase);

    try {
      await aplicarMigracoes(piscina);
    } finally {
      await piscina.end();
    }

    for (const tabela of ["cartao", "baralho"]) {
      const colunas = await servidor.consultar<{ nome: string; nulo: string }>(
        nomeDaBase,
        `SELECT column_name AS nome, is_nullable AS nulo
           FROM information_schema.columns
          WHERE table_name = $1 ORDER BY column_name;`,
        [tabela],
      );

      expect(colunas.map((coluna) => coluna.nome)).toEqual(
        tabela === "cartao"
          ? ["frente", "id", "usuario_id", "verso"]
          : ["id", "nome", "usuario_id"],
      );
      expect(
        colunas.find((coluna) => coluna.nome === "usuario_id")?.nulo,
      ).toBe("NO");

      /** O índice por dono é o que sustenta toda leitura escopada (FR-092). */
      const indices = await servidor.consultar<{ nome: string }>(
        nomeDaBase,
        "SELECT indexname AS nome FROM pg_indexes WHERE tablename = $1;",
        [tabela],
      );

      expect(indices.map((indice) => indice.nome)).toContain(
        `indice_${tabela}_por_usuario`,
      );

      /** E o dono referencia `usuario`, caindo em cascata com ele. */
      const chaves = await servidor.consultar<{ definicao: string }>(
        nomeDaBase,
        `SELECT pg_get_constraintdef(oid) AS definicao
           FROM pg_constraint
          WHERE conrelid = $1::regclass AND contype = 'f';`,
        [tabela],
      );

      expect(chaves.map((chave) => chave.definicao).join(" ")).toMatch(
        /REFERENCES usuario\(id\) ON DELETE CASCADE/,
      );
    }

    /** A chave primária composta de `vinculo` foi preservada (FR-020). */
    const chave = await servidor.consultar<{ definicao: string }>(
      nomeDaBase,
      `SELECT pg_get_constraintdef(oid) AS definicao
         FROM pg_constraint
        WHERE conrelid = 'vinculo'::regclass AND conname = 'vinculo_pkey';`,
    );

    expect(chave[0]?.definicao).toContain("PRIMARY KEY (cartao_id, baralho_id)");

    const cascatas = await servidor.consultar<{ definicao: string }>(
      nomeDaBase,
      `SELECT pg_get_constraintdef(oid) AS definicao
         FROM pg_constraint
        WHERE conrelid = 'vinculo'::regclass AND contype = 'f';`,
    );

    expect(cascatas).toHaveLength(2);

    for (const definicao of cascatas.map((linha) => linha.definicao)) {
      expect(definicao).toMatch(/ON DELETE CASCADE/);
    }
  });

  it("não acrescenta coluna capaz de guardar a Credencial, em tabela alguma", async () => {
    const nomeDaBase = await baseNaVersao4("sem-credencial");
    const piscina = await abrirPiscinaDaBase(nomeDaBase);

    try {
      await aplicarMigracoes(piscina);
    } finally {
      await piscina.end();
    }

    const colunas = await servidor.consultar<{ tabela: string; nome: string }>(
      nomeDaBase,
      `SELECT table_name AS tabela, column_name AS nome
         FROM information_schema.columns
        WHERE table_schema = 'public';`,
    );

    for (const coluna of colunas) {
      expect(`${coluna.tabela}.${coluna.nome}`).not.toMatch(
        /senha|password|token|sessao|cookie|credencial/i,
      );
    }
  });

  it("recusa a linha do acervo sem dono e serve o acervo novo do Usuário pela Interface", async () => {
    const nomeDaBase = await baseNaVersao4("nova-linha");
    const piscina = await abrirPiscinaDaBase(nomeDaBase);

    try {
      await aplicarMigracoes(piscina);

      /** A `NOT NULL` de `usuario_id` impede o Cartão sem dono (FR-099). */
      await expect(
        piscina.query(
          "INSERT INTO cartao (id, frente, verso) VALUES ('c1', 'To walk', 'Caminhar');",
        ),
      ).rejects.toThrow();
    } finally {
      await piscina.end();
    }

    /** E a Interface da Porta grava e lê o acervo **do** Usuário. */
    const aberto = await abrirArmazenamentoDaBase(nomeDaBase);

    try {
      expect(
        await aberto.armazenamento.inserirCartao("usuario-um", {
          id: "c-novo",
          frente: "To walk",
          verso: "Caminhar",
        }),
      ).toEqual({
        ok: true,
        valor: { id: "c-novo", frente: "To walk", verso: "Caminhar" },
      });

      expect(await aberto.armazenamento.listarCartoes("usuario-um")).toEqual([
        { id: "c-novo", frente: "To walk", verso: "Caminhar" },
      ]);
      expect(await aberto.armazenamento.listarCartoes("usuario-dois")).toEqual(
        [],
      );
    } finally {
      await aberto.encerrar();
    }
  });
});
