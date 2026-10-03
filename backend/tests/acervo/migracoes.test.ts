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
import {
  contarLinhas,
  gravarBaralho,
  gravarCartao,
  gravarCartaoSemDono,
  gravarDono,
  gravarVinculo,
} from "./banco-de-teste.ts";

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
      const dono = gravarDono(banco);

      gravarCartao(banco, dono, "c1");
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
  /**
   * A versão seguinte à última da lista: derivada, e não escrita à mão, porque
   * uma migração de uma versão já aplicada seria ignorada e nada falharia.
   */
  const PROXIMA_VERSAO = ULTIMA_VERSAO_DO_ESQUEMA + 1;

  /** Cria uma tabela e só então falha: o DDL parcial é o que o ROLLBACK desfaz. */
  const migracaoQueFalha: readonly Migracao[] = [
    {
      versao: PROXIMA_VERSAO,
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
        {
          versao: PROXIMA_VERSAO,
          sql: "CREATE TABLE tabela_cinco (id TEXT PRIMARY KEY);",
        },
      ]);

      expect(existeTabela(banco, "tabela_cinco")).toBe(true);
      expect(versaoAtual(banco)).toBe(PROXIMA_VERSAO);
    } finally {
      banco.close();
    }
  });
});

describe("arquivo legado da feature 001 — cartao sem tabela de versão", () => {
  it("adota o cartao existente como migração 1, sobe até a versão corrente e descarta o acervo sem dono", () => {
    comBanco((banco) => {
      // O que a feature 001 deixou em disco: cartao, sem versao_do_esquema.
      banco.exec(`
        CREATE TABLE IF NOT EXISTS cartao (
          id     TEXT PRIMARY KEY,
          frente TEXT NOT NULL CHECK (length(trim(frente)) > 0 AND length(frente) <= 1000),
          verso  TEXT NOT NULL CHECK (length(trim(verso))  > 0 AND length(verso)  <= 1000)
        );
      `);
      gravarCartaoSemDono(banco, "legado");

      aplicarEsquema(banco);

      expect(existeTabela(banco, "versao_do_esquema")).toBe(true);
      expect(existeTabela(banco, "baralho")).toBe(true);
      expect(existeTabela(banco, "vinculo")).toBe(true);
      expect(existeTabela(banco, "usuario")).toBe(true);
      expect(versaoAtual(banco)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);

      /**
       * O Cartão legado não tem dono, e não há como dar dono a ele: a migração
       * 5 recria as tabelas do acervo e o descarta (FR-099, SC-037).
       */
      expect(contarLinhas(banco, "cartao")).toBe(0);

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

describe("arquivo já na versão corrente — mesma versão, mesmos dados", () => {
  it("abre na versão registrada, sem reaplicar migração, e serve o mesmo conteúdo pela Porta", async () => {
    const diretorio = mkdtempSync(join(tmpdir(), "acervo-antes-da-porta-"));

    try {
      const caminho = join(diretorio, "memorizacao.sqlite");

      // O que uma execução anterior deixava em disco: as migrações aplicadas
      // até a corrente, a versão registrada e conteúdo real de um Usuário.
      const anterior = new DatabaseSync(caminho);

      try {
        aplicarEsquema(anterior);
        const dono = gravarDono(anterior);

        gravarCartao(anterior, dono, "c1");
        gravarBaralho(anterior, dono, "b1", "Inglês");
        gravarVinculo(anterior, "c1", "b1");
      } finally {
        anterior.close();
      }

      // A abertura pelo Adapter aplica apenas o que estivesse pendente — nada,
      // neste caso — e o conteúdo anterior continua servindo à Interface.
      const aberto = await abrirArmazenamentoSqlite(caminho);

      try {
        expect(await aberto.armazenamento.listarCartoes("dono-um")).toEqual([
          { id: "c1", frente: "To walk", verso: "Caminhar" },
        ]);
        expect(
          await aberto.armazenamento.listarBaralhosDoCartao("dono-um", "c1"),
        ).toEqual([{ id: "b1", nome: "Inglês" }]);
        expect(
          await aberto.armazenamento.contarCartoesPorBaralho("dono-um"),
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

describe("migração 6 — tabelas do Histórico de Sessão", () => {
  /** Sobe a base até a versão 5, a última antes das tabelas do Histórico. */
  function ateAVersaoCinco(banco: DatabaseSync): void {
    aplicarMigracoes(
      banco,
      MIGRACOES.filter((migracao) => migracao.versao <= 5),
    );
  }

  /** O DDL de uma tabela, lido do catálogo do SQLite. */
  function ddlDaTabela(banco: DatabaseSync, nome: string): string {
    const linha = banco
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(nome);

    return linha === undefined ? "" : String(linha.sql);
  }

  it("cria registro_de_sessao e item_de_registro com o índice por dono e instante e as CHECK", () => {
    comBanco((banco) => {
      ateAVersaoCinco(banco);

      expect(existeTabela(banco, "registro_de_sessao")).toBe(false);
      expect(existeTabela(banco, "item_de_registro")).toBe(false);

      aplicarEsquema(banco);

      expect(existeTabela(banco, "registro_de_sessao")).toBe(true);
      expect(existeTabela(banco, "item_de_registro")).toBe(true);
      expect(versaoAtual(banco)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);

      /** O índice é o que faz a listagem do dono por janela de instante (FR-169). */
      const indice = banco
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
        .get("registro_de_sessao_usuario_concluida");

      expect(indice?.name).toBe("registro_de_sessao_usuario_concluida");

      /** Os totais são derivados e o Resultado é restrito no esquema (FR-161). */
      const registro = ddlDaTabela(banco, "registro_de_sessao");
      const item = ddlDaTabela(banco, "item_de_registro");

      expect(registro).toMatch(/estudados >= 1/);
      expect(registro).toMatch(/acertos \+ erros\)? = estudados/);

      expect(item).toMatch(/resultado IN/);
      expect(item).toMatch(/'acertou'/);
      expect(item).toMatch(/'errou'/);
      expect(item).toMatch(/PRIMARY KEY\s*\(registro_id, posicao\)/);

      /** As cascatas deixam o Histórico sem linhas órfãs (FR-167). */
      const chavesDoRegistro = banco
        .prepare("PRAGMA foreign_key_list(registro_de_sessao)")
        .all();
      const chavesDoItem = banco
        .prepare("PRAGMA foreign_key_list(item_de_registro)")
        .all();

      expect(
        chavesDoRegistro.some(
          (chave) => chave.table === "usuario" && chave.on_delete === "CASCADE",
        ),
      ).toBe(true);
      expect(
        chavesDoItem.some(
          (chave) =>
            chave.table === "registro_de_sessao" &&
            chave.on_delete === "CASCADE",
        ),
      ).toBe(true);
    });
  });

  it("preserva Cartões, Baralhos, Vínculos e Usuários das versões 1 a 5", () => {
    comBanco((banco) => {
      ateAVersaoCinco(banco);

      const dono = gravarDono(banco);

      gravarCartao(banco, dono, "c1");
      gravarBaralho(banco, dono, "b1", "Inglês");
      gravarVinculo(banco, "c1", "b1");

      aplicarEsquema(banco);

      expect(versaoAtual(banco)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);
      expect(contarLinhas(banco, "cartao")).toBe(1);
      expect(contarLinhas(banco, "baralho")).toBe(1);
      expect(contarLinhas(banco, "vinculo")).toBe(1);
      expect(contarLinhas(banco, "usuario")).toBe(1);

      /** O Vínculo continua apontando para as duas linhas do dono. */
      const vinculo = banco
        .prepare("SELECT cartao_id, baralho_id FROM vinculo")
        .get();

      expect(vinculo).toEqual({ cartao_id: "c1", baralho_id: "b1" });
    });
  });
});

describe("migração 7 — repetição espaçada", () => {
  /** Sobe a base até a versão 6, a última antes das tabelas da repetição espaçada. */
  function ateAVersaoSeis(banco: DatabaseSync): void {
    aplicarMigracoes(
      banco,
      MIGRACOES.filter((migracao) => migracao.versao <= 6),
    );
  }

  /** O DDL de uma tabela, lido do catálogo do SQLite. */
  function ddlDaTabela(banco: DatabaseSync, nome: string): string {
    const linha = banco
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(nome);

    return linha === undefined ? "" : String(linha.sql);
  }

  it("preserva Cartões, Baralhos, Vínculos e Registros anteriores e não cria Agendamento (FR-214, FR-220)", () => {
    comBanco((banco) => {
      ateAVersaoSeis(banco);

      const dono = gravarDono(banco);

      gravarCartao(banco, dono, "c1");
      gravarBaralho(banco, dono, "b1", "Inglês");
      gravarVinculo(banco, "c1", "b1");

      /** Um Registro da 013, gravado como a migração 6 o deixava em disco. */
      banco
        .prepare(
          `INSERT INTO registro_de_sessao
             (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
              estudados, acertos, erros)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("r1", dono, "b1", "Inglês", "2026-01-01T00:00:00.000Z", 1, 1, 0);
      banco
        .prepare(
          `INSERT INTO item_de_registro
             (registro_id, posicao, frente, verso, resultado)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run("r1", 0, "To walk", "Caminhar", "acertou");

      expect(existeTabela(banco, "agendamento")).toBe(false);
      expect(existeTabela(banco, "preferencias")).toBe(false);

      aplicarEsquema(banco);

      expect(versaoAtual(banco)).toBe(ULTIMA_VERSAO_DO_ESQUEMA);
      expect(ULTIMA_VERSAO_DO_ESQUEMA).toBe(7);

      expect(existeTabela(banco, "agendamento")).toBe(true);
      expect(existeTabela(banco, "preferencias")).toBe(true);

      /** Nenhum dado existente é alterado nem perdido (FR-220). */
      expect(contarLinhas(banco, "cartao")).toBe(1);
      expect(contarLinhas(banco, "baralho")).toBe(1);
      expect(contarLinhas(banco, "vinculo")).toBe(1);
      expect(contarLinhas(banco, "registro_de_sessao")).toBe(1);
      expect(contarLinhas(banco, "item_de_registro")).toBe(1);

      /**
       * Nenhum Agendamento nasce na migração: o acervo pré-015 vira Cartões
       * novos, e os Agendamentos surgem na primeira Avaliação (FR-214).
       */
      expect(contarLinhas(banco, "agendamento")).toBe(0);

      /** Registros anteriores ganham origem 'baralho' (FR-197). */
      const registro = banco
        .prepare("SELECT origem FROM registro_de_sessao WHERE id = ?")
        .get("r1");

      expect(registro?.origem).toBe("baralho");

      /** Itens anteriores ficam com cartao_id e avaliacao NULL (FR-197). */
      const item = banco
        .prepare(
          "SELECT cartao_id, avaliacao FROM item_de_registro WHERE registro_id = ?",
        )
        .get("r1");

      expect(item?.cartao_id).toBeNull();
      expect(item?.avaliacao).toBeNull();

      /** As linhas antigas ficam sem instante de criação (FR-201). */
      const cartao = banco
        .prepare("SELECT criado_em FROM cartao WHERE id = ?")
        .get("c1");

      expect(cartao?.criado_em).toBeNull();
    });
  });

  it("cria o índice de vencimento e recusa Avaliação inválida e limite fora de 0..999 (FR-187, FR-192, FR-200)", () => {
    comBanco((banco) => {
      aplicarEsquema(banco);

      const indice = banco
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
        )
        .get("indice_agendamento_por_usuario_vencimento");

      expect(indice?.name).toBe("indice_agendamento_por_usuario_vencimento");

      expect(ddlDaTabela(banco, "agendamento")).toMatch(
        /ultima_avaliacao IN/,
      );
      expect(ddlDaTabela(banco, "preferencias")).toMatch(
        /limite_de_novos_por_dia BETWEEN 0 AND 999/,
      );

      const dono = gravarDono(banco);

      gravarCartao(banco, dono, "c1");

      /** Avaliação fora dos 4 níveis é recusada pelo esquema (FR-192). */
      expect(() =>
        banco
          .prepare(
            `INSERT INTO agendamento
               (usuario_id, cartao_id, algoritmo, versao_do_algoritmo, estado,
                proxima_revisao_em, ultima_avaliacao, revisado_em, criado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            dono,
            "c1",
            "sm2",
            1,
            "{}",
            "2026-01-02T00:00:00.000Z",
            "otima",
            "2026-01-01T00:00:00.000Z",
            "2026-01-01T00:00:00.000Z",
          ),
      ).toThrow();

      /** O limite de Cartões novos é inteiro de 0 a 999 (FR-200). */
      const gravarPreferencias = banco.prepare(
        `INSERT INTO preferencias (usuario_id, algoritmo, limite_de_novos_por_dia)
         VALUES (?, ?, ?)`,
      );

      expect(() => gravarPreferencias.run(dono, "sm2", 1000)).toThrow();
      expect(() => gravarPreferencias.run(dono, "sm2", -1)).toThrow();
    });
  });
});
