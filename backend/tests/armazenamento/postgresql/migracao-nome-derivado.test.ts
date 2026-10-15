import type { Pool } from "pg";

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  aplicarMigracoes,
  lerVersaoDoEsquema,
  versaoAceitaNoInicio,
} from "../../../src/armazenamento/postgresql/esquema.ts";
import { MIGRACOES } from "../../../src/armazenamento/postgresql/migracoes.ts";
import {
  abrirArmazenamentoDaBase,
  abrirPiscinaDaBase,
  descartarBasesDeTeste,
} from "./base-de-teste.ts";
import {
  servidorDeTeste,
  type FerramentasDoServidor,
} from "./servidor-de-teste.ts";

/**
 * T028 — A migração 19 limpa `nome_do_baralho` para registros com origem
 * 'revisao' ou 'temporario', deixando-os vazio para que o rótulo seja derivado
 * pela origem na interface (FR-020, FR-021). Dados apenas, sem mudança de
 * esquema. A migração é idempotente.
 */

let servidor: FerramentasDoServidor;

beforeAll(async () => {
  servidor = await servidorDeTeste();
}, 120_000);

afterAll(async () => {
  await descartarBasesDeTeste();
  await (await servidorDeTeste()).encerrar();
});

/**
 * Cria uma base nova e vazia, migra até `ateAVersao` e executa o corpo sobre um
 * conjunto de conexões próprio; ao fim, fecha a piscina e descarta a base.
 */
async function comBase(
  titulo: string,
  ateAVersao: number,
  corpo: (piscina: Pool) => Promise<void>,
): Promise<void> {
  const nomeDaBase = await servidor.criarBase(`nome-derivado-${titulo}`);
  const piscina = await abrirPiscinaDaBase(nomeDaBase);

  try {
    await aplicarMigracoes(
      piscina,
      MIGRACOES.filter((migracao) => migracao.versao <= ateAVersao),
    );

    await corpo(piscina);
  } finally {
    await piscina.end();
  }
}

describe("migração 19 — nome_do_baralho derivado da origem (PostgreSQL)", () => {
  it("tem a mesma sequência de versões que o SQLite para a v19", async () => {
    const versoesSQLite = (
      await import("../../../src/armazenamento/sqlite/migracoes.ts")
    ).MIGRACOES.map((m) => m.versao);
    const versõesPostgreSQL = MIGRACOES.map((m) => m.versao);
    expect(versõesPostgreSQL.slice(0, 19)).toEqual(versoesSQLite.slice(0, 19));
  });

  it("leva uma base da versão 18 à 19 e limpa nome para revisao e temporario", async () => {
    await comBase("limpeza", 18, async (piscina) => {
      await piscina.query(
        `INSERT INTO usuario (id, nome_de_usuario, sal, hash, parametros)
         VALUES ('u1', 'ana.silva', $1, $2, '{}')`,
        [Buffer.alloc(16), Buffer.from("hash-sintetico")],
      );

      const INSTANTE = "2025-01-01T00:00:00.000Z";

      // Inserir registro com origem revisao e nome "Revisão do dia"
      await piscina.query(
        `INSERT INTO registro_de_sessao
           (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
            estudados, acertos, erros, origem)
         VALUES ($1, $2, '', 'Revisão do dia', $3, 1, 1, 0, 'revisao')`,
        ["r1", "u1", INSTANTE],
      );

      // Inserir registro com origem temporario e nome "Baralho temporário"
      await piscina.query(
        `INSERT INTO registro_de_sessao
           (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
            estudados, acertos, erros, origem)
         VALUES ($1, $2, '', 'Baralho temporário', $3, 1, 1, 0, 'temporario')`,
        ["r2", "u1", INSTANTE],
      );

      // Inserir registro com origem baralho e nome "Revisão do dia"
      await piscina.query(
        `INSERT INTO registro_de_sessao
           (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
            estudados, acertos, erros, origem)
         VALUES ($1, $2, 'b1', 'Revisão do dia', $3, 1, 1, 0, 'baralho')`,
        ["r3", "u1", INSTANTE],
      );

      // Nome digitado pela pessoa: Conteúdo do Usuário, nunca apagado (FR-006).
      await piscina.query(
        `INSERT INTO registro_de_sessao
           (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
            estudados, acertos, erros, origem)
         VALUES ($1, $2, '', 'Aula de Inglês', $3, 1, 1, 0, 'temporario')`,
        ["r4", "u1", INSTANTE],
      );

      // Aplicar migração 19
      await aplicarMigracoes(
        piscina,
        MIGRACOES.filter((migracao) => migracao.versao <= 19),
      );

      expect(await lerVersaoDoEsquema(piscina)).toBe(19);

      const regDigitado = await piscina.query(
        "SELECT nome_do_baralho FROM registro_de_sessao WHERE id = 'r4'",
      );
      expect(regDigitado.rows).toEqual([{ nome_do_baralho: "Aula de Inglês" }]);

      // Verificar que revisao agora tem nome_do_baralho vazio
      const regRevisao = await piscina.query(
        "SELECT nome_do_baralho FROM registro_de_sessao WHERE id = 'r1'",
      );
      expect(regRevisao.rows).toEqual([{ nome_do_baralho: "" }]);

      // Verificar que temporario agora tem nome_do_baralho vazio
      const regTemporario = await piscina.query(
        "SELECT nome_do_baralho FROM registro_de_sessao WHERE id = 'r2'",
      );
      expect(regTemporario.rows).toEqual([{ nome_do_baralho: "" }]);

      // Verificar que baralho mantém seu nome
      const regBaralho = await piscina.query(
        "SELECT nome_do_baralho FROM registro_de_sessao WHERE id = 'r3'",
      );
      expect(regBaralho.rows).toEqual([{ nome_do_baralho: "Revisão do dia" }]);
    });
  });

  it("é idempotente quando rodada duas vezes", async () => {
    await comBase("idempotencia", 18, async (piscina) => {
      await piscina.query(
        `INSERT INTO usuario (id, nome_de_usuario, sal, hash, parametros)
         VALUES ('u1', 'ana.silva', $1, $2, '{}')`,
        [Buffer.alloc(16), Buffer.from("hash-sintetico")],
      );

      const INSTANTE = "2025-01-01T00:00:00.000Z";

      // Inserir registro com origem revisao
      await piscina.query(
        `INSERT INTO registro_de_sessao
           (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
            estudados, acertos, erros, origem)
         VALUES ($1, $2, '', 'Revisão do dia', $3, 1, 1, 0, 'revisao')`,
        ["r1", "u1", INSTANTE],
      );

      // Aplicar migração 19
      await aplicarMigracoes(
        piscina,
        MIGRACOES.filter((migracao) => migracao.versao <= 19),
      );

      const aosPrimeiros = await piscina.query(
        "SELECT * FROM registro_de_sessao ORDER BY id",
      );

      // Aplicar novamente (idempotência)
      await aplicarMigracoes(
        piscina,
        MIGRACOES.filter((migracao) => migracao.versao <= 19),
      );

      const aposSegundos = await piscina.query(
        "SELECT * FROM registro_de_sessao ORDER BY id",
      );

      expect(aosPrimeiros.rows).toEqual(aposSegundos.rows);
    });
  });
});

/**
 * A 19 tem a mesma precondição da 18 (research R11): enquanto a transição de
 * Pertencimento está pendente, a 19 fica para a próxima aplicação. A 20 já
 * aceita o nome vazio (research R6), e por isso o Adapter grava `""` nas
 * origens derivadas; a leitura devolve o rótulo legado (FR-020).
 */
describe("migração 19 — espera a transição de Pertencimento (PostgreSQL)", () => {
  const INSTANTE = "2025-01-01T00:00:00.000Z";

  it("fica pendente, grava o nome vazio e limpa ao concluir a transição", async () => {
    const nomeDaBase = await servidor.criarBase("nome-derivado-pendente");
    const piscina = await abrirPiscinaDaBase(nomeDaBase);

    try {
      await aplicarMigracoes(
        piscina,
        MIGRACOES.filter((migracao) => migracao.versao <= 17),
      );
      await piscina.query(
        `INSERT INTO usuario (id, nome_de_usuario, sal, hash, parametros)
         VALUES ('u1', 'ana.silva', $1, $2, '{}')`,
        [Buffer.alloc(16), Buffer.from("hash-sintetico")],
      );
      // Cartão sem Pertencimento: a transição ainda não terminou.
      await piscina.query(
        `INSERT INTO cartao (id, frente, verso, usuario_id)
         VALUES ('c-pendente', 'To walk', 'Caminhar', 'u1')`,
      );

      await aplicarMigracoes(piscina, MIGRACOES);
      expect(await lerVersaoDoEsquema(piscina)).toBe(20);

      const aberto = await abrirArmazenamentoDaBase(nomeDaBase);

      try {
        for (const [id, origem, nomeDoBaralho] of [
          ["r-revisao", "revisao", ""],
          ["r-temporario", "temporario", ""],
          ["r-temporario-nomeado", "temporario", "Aula de Inglês"],
        ] as const) {
          const desfecho = await aberto.armazenamento.inserirRegistroDeSessao(
            "u1",
            {
              id,
              baralhoId: "",
              nomeDoBaralho,
              origem,
              concluidaEm: INSTANTE,
              estudados: 1,
              acertos: 1,
              erros: 0,
              itens: [],
            },
          );

          expect(desfecho.ok).toBe(true);
        }
      } finally {
        await aberto.encerrar();
      }

      const legados = await piscina.query(
        "SELECT id, nome_do_baralho FROM registro_de_sessao ORDER BY id",
      );
      expect(legados.rows).toEqual([
        { id: "r-revisao", nome_do_baralho: "" },
        { id: "r-temporario", nome_do_baralho: "" },
        { id: "r-temporario-nomeado", nome_do_baralho: "Aula de Inglês" },
      ]);

      await piscina.query("DELETE FROM cartao WHERE id = 'c-pendente'");
      await aplicarMigracoes(piscina, MIGRACOES);
      expect(await lerVersaoDoEsquema(piscina)).toBe(22);

      const limpos = await piscina.query(
        "SELECT id, nome_do_baralho FROM registro_de_sessao ORDER BY id",
      );
      expect(limpos.rows).toEqual([
        { id: "r-revisao", nome_do_baralho: "" },
        { id: "r-temporario", nome_do_baralho: "" },
        { id: "r-temporario-nomeado", nome_do_baralho: "Aula de Inglês" },
      ]);
    } finally {
      await piscina.end();
    }
  });

  it("depois da 19, só as origens derivadas aceitam nome vazio", async () => {
    await comBase("check-19", 19, async (piscina) => {
      await piscina.query(
        `INSERT INTO usuario (id, nome_de_usuario, sal, hash, parametros)
         VALUES ('u1', 'ana.silva', $1, $2, '{}')`,
        [Buffer.alloc(16), Buffer.from("hash-sintetico")],
      );
      const inserir = (id: string, origem: string, nome: string) =>
        piscina.query(
          `INSERT INTO registro_de_sessao
             (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
              estudados, acertos, erros, origem)
           VALUES ($1, 'u1', '', $2, $3, 1, 1, 0, $4)`,
          [id, nome, INSTANTE, origem],
        );

      await expect(inserir("r1", "revisao", "")).resolves.toBeDefined();
      await expect(inserir("r2", "temporario", "")).resolves.toBeDefined();
      await expect(inserir("r3", "baralho", "")).rejects.toThrow();
      await expect(inserir("r4", "baralho", "Inglês")).resolves.toBeDefined();
    });
  });

  it("recusa na inicialização as versões paradas antes da 20, que não tem precondição (research R6)", () => {
    expect(versaoAceitaNoInicio(19)).toBe(false);
    expect(versaoAceitaNoInicio(18)).toBe(false);
    expect(versaoAceitaNoInicio(17)).toBe(false);
    expect(versaoAceitaNoInicio(16)).toBe(false);
  });
});
