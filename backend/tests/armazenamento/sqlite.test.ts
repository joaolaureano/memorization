import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { abrirArmazenamentoSqlite } from "../../src/armazenamento/sqlite/armazenamento.ts";
import { bateriaDaPorta } from "./bateria-da-porta.ts";
import { bateriaDaPortaDeUsuarios } from "./bateria-da-porta-de-usuarios.ts";
import { criarDonoDeTeste } from "./usuarios-de-teste.ts";

/**
 * T803 — a bateria compartilhada da Porta contra o Adapter do armazenamento
 * local, exigindo cem por cento de aprovação (FR-106, SC-039), e a persistência
 * entre duas aberturas do mesmo arquivo (FR-104, SC-041).
 *
 * A mesma função de bateria é exercitada em duas configurações do Adapter local
 * — em memória e em arquivo temporário —, e nenhum cenário dela conhece essa
 * diferença: a fábrica é quem sabe onde o armazenamento guarda os dados. É essa
 * função que o Adapter de PostgreSQL da `010-postgresql-na-nuvem` reutiliza,
 * sem editar cenário algum e sem editar nenhum Module.
 */

const DIRETORIO_TEMPORARIO = mkdtempSync(
  join(tmpdir(), "armazenamento-sqlite-"),
);

/** Identifica o arquivo de cada cenário, para um começar limpo como o outro. */
let arquivosCriados = 0;

/** Abre um arquivo temporário ainda inexistente, exclusivo do cenário. */
function abrirEmArquivoTemporario() {
  arquivosCriados += 1;

  return abrirArmazenamentoSqlite(
    join(DIRETORIO_TEMPORARIO, `banco-${arquivosCriados}.sqlite`),
  );
}

afterAll(() => {
  rmSync(DIRETORIO_TEMPORARIO, { recursive: true, force: true });
});

bateriaDaPorta(() => abrirArmazenamentoSqlite(":memory:"), "SQLite em memória");

bateriaDaPorta(
  abrirEmArquivoTemporario,
  "SQLite em arquivo temporário",
);

/**
 * A bateria da segunda Porta, contra o mesmo Adapter: os Usuários são da tabela
 * `usuario`, criada pela migração 4, e nenhum cenário dela conhece o SQLite.
 */
bateriaDaPortaDeUsuarios(
  async () => {
    const aberto = await abrirArmazenamentoSqlite(":memory:");

    return { usuarios: aberto.usuarios, encerrar: () => aberto.encerrar() };
  },
  "SQLite em memória",
);

bateriaDaPortaDeUsuarios(
  async () => {
    const aberto = await abrirEmArquivoTemporario();

    return { usuarios: aberto.usuarios, encerrar: () => aberto.encerrar() };
  },
  "SQLite em arquivo temporário",
);

describe("arquivo local", () => {
  it("cria o arquivo inexistente com o esquema aplicado", async () => {
    const caminho = join(DIRETORIO_TEMPORARIO, "novo.sqlite");

    expect(existsSync(caminho)).toBe(false);

    const aberto = await abrirArmazenamentoSqlite(caminho);

    try {
      const dono = await criarDonoDeTeste(aberto.usuarios);

      expect(existsSync(caminho)).toBe(true);
      expect(await aberto.armazenamento.listarCartoes(dono)).toEqual([]);
      expect(await aberto.armazenamento.listarBaralhos(dono)).toEqual([]);
    } finally {
      await aberto.encerrar();
    }
  });

  it("devolve o mesmo conteúdo depois de encerrar e reabrir o mesmo arquivo", async () => {
    const caminho = join(DIRETORIO_TEMPORARIO, "persistencia.sqlite");

    const primeira = await abrirArmazenamentoSqlite(caminho);

    /** O acervo tem dono: o Usuário nasce com a base e sobrevive à reabertura. */
    const dono = await criarDonoDeTeste(primeira.usuarios);
    const outro = await criarDonoDeTeste(
      primeira.usuarios,
      "dono-dois",
      "bruno.souza",
    );

    await primeira.armazenamento.inserirCartao(dono, {
      id: "c1",
      frente: "To walk",
      verso: "Caminhar",
    });
    await primeira.armazenamento.inserirBaralho(dono, { id: "b1", nome: "Inglês" });
    await primeira.armazenamento.vincular(dono, "c1", "b1");
    await primeira.encerrar();

    const segunda = await abrirArmazenamentoSqlite(caminho);

    try {
      expect(await segunda.armazenamento.listarCartoes(dono)).toEqual([
        { id: "c1", frente: "To walk", verso: "Caminhar" },
      ]);
      expect(await segunda.armazenamento.listarBaralhos(dono)).toEqual([
        { id: "b1", nome: "Inglês" },
      ]);
      expect(await segunda.armazenamento.listarBaralhosDoCartao(dono, "c1")).toEqual([
        { id: "b1", nome: "Inglês" },
      ]);
      expect(await segunda.armazenamento.listarCartoesDoBaralho(dono, "b1")).toEqual([
        { id: "c1", frente: "To walk", verso: "Caminhar" },
      ]);
      expect(
        await segunda.armazenamento.contarCartoesPorBaralho(dono),
      ).toContainEqual({ baralhoId: "b1", quantidadeDeCartoes: 1 });

      /** O outro Usuário, na mesma base, continua com o acervo vazio. */
      expect(await segunda.armazenamento.listarCartoes(outro)).toEqual([]);
      expect(await segunda.armazenamento.obterCartao(outro, "c1")).toEqual({
        ok: false,
        erro: "nao_encontrado",
      });
    } finally {
      await segunda.encerrar();
    }
  });

  it("preserva o conteúdo gravado depois de excluir apenas o Vínculo", async () => {
    const caminho = join(DIRETORIO_TEMPORARIO, "persistencia-sem-vinculo.sqlite");

    const primeira = await abrirArmazenamentoSqlite(caminho);
    const dono = await criarDonoDeTeste(primeira.usuarios);

    await primeira.armazenamento.inserirCartao(dono, {
      id: "c1",
      frente: "To walk",
      verso: "Caminhar",
    });
    await primeira.armazenamento.inserirBaralho(dono, { id: "b1", nome: "Inglês" });
    await primeira.armazenamento.vincular(dono, "c1", "b1");
    await primeira.armazenamento.desvincular(dono, "c1", "b1");
    await primeira.encerrar();

    const segunda = await abrirArmazenamentoSqlite(caminho);

    try {
      expect(await segunda.armazenamento.obterCartao(dono, "c1")).toEqual({
        ok: true,
        valor: { id: "c1", frente: "To walk", verso: "Caminhar" },
      });
      expect(await segunda.armazenamento.obterBaralho(dono, "b1")).toEqual({
        ok: true,
        valor: { id: "b1", nome: "Inglês" },
      });
      expect(
        await segunda.armazenamento.listarBaralhosDoCartao(dono, "c1"),
      ).toEqual([]);
    } finally {
      await segunda.encerrar();
    }
  });
});
