import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
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
  gravarCertificadoDaAutoridade,
  type CertificadoDaAutoridade,
} from "./base-de-teste.ts";
import {
  servidorDeTeste,
  type FerramentasDoServidor,
} from "./servidor-de-teste.ts";

/**
 * T903 — o Adapter traz o DDL de PostgreSQL das migrações 1 a 4 e o aplicador
 * com trava consultiva (FR-112, FR-116, SC-048).
 *
 * A verificação é da Seam interna do Adapter: base nova e vazia chega à versão
 * corrente com as **mesmas versões** do SQLite, as tabelas existem com as
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
  it("começa na versão 0 e chega à versão corrente com as tabelas do esquema", async () => {
    await comBaseVazia("nova", async (piscina, consultar) => {
      /** Antes de migrar, a base não tem nem a tabela de controle. */
      expect(await lerVersaoDoEsquema(piscina)).toBe(0);

      expect(await aplicarMigracoes(piscina)).toBe(versaoCorrenteConhecida());
      expect(versaoCorrenteConhecida()).toBe(4);

      const tabelas = await consultar<{ nome: string }>(
        "SELECT tablename AS nome FROM pg_tables WHERE schemaname = 'public';",
      );

      expect(tabelas.map((tabela) => tabela.nome).sort()).toEqual([
        "baralho",
        "cartao",
        "usuario",
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
      expect(await versaoRegistrada(consultar)).toEqual([4]);
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
      expect(linhas.rows).toEqual([{ versao: 4 }]);
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

      expect(linhas.rows).toEqual([{ versao: 4 }]);
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
      versao: 5,
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
      expect(await versaoRegistrada(consultar)).toEqual([4]);

      const tabelas = await consultar<{ nome: string }>(
        `SELECT tablename AS nome FROM pg_tables
          WHERE schemaname = 'public' ORDER BY tablename;`,
      );

      expect(tabelas.map((tabela) => tabela.nome)).toEqual([
        "baralho",
        "cartao",
        "usuario",
        "versao_do_esquema",
        "vinculo",
      ]);
    });
  });

  it("depois do rollback a conexão continua utilizável para a próxima migração", async () => {
    await comBaseVazia("falha-e-segue", async (piscina, consultar) => {
      await expect(aplicarMigracoes(piscina, migracaoQueFalha)).rejects.toThrow();

      await aplicarMigracoes(piscina, [
        { versao: 5, sql: "CREATE TABLE tabela_cinco (id TEXT PRIMARY KEY);" },
      ]);

      const tabelas = await consultar<{ nome: string }>(
        "SELECT tablename AS nome FROM pg_tables WHERE tablename = 'tabela_cinco';",
      );

      expect(tabelas).toEqual([{ nome: "tabela_cinco" }]);
      expect(await versaoRegistrada(consultar)).toEqual([5]);
    });
  });
});

/**
 * T601, no dialeto da nuvem — a migração 4 cria a tabela `usuario` com as
 * mesmas regras do Adapter local, preservando a base instalada.
 *
 * A verificação é do esquema: o índice único é sobre `lower(nome_de_usuario)`,
 * equivalente ao `COLLATE NOCASE` do SQLite; as `CHECK` repetem FR-073 e
 * FR-076 — tamanho de 3 a 50, alfabeto ASCII, `sal` com exatamente 16 bytes —; e
 * uma base já na versão 3 (a da feature `006`), com Cartões, Baralhos e
 * Vínculos dentro, chega à versão corrente sem perder nada.
 */
describe("migração 4 — tabela usuario", () => {
  it("guarda o índice único sobre lower(nome_de_usuario) e as CHECK de Nome de usuário e de sal", async () => {
    await comBaseVazia("usuario-forma", async (piscina, consultar) => {
      await aplicarMigracoes(piscina);

      const indices = await consultar<{ nome: string; definicao: string }>(
        `SELECT indexname AS nome, indexdef AS definicao
           FROM pg_indexes WHERE tablename = 'usuario';`,
      );

      /** Dois índices, e só um deles é nosso: a chave primária e o único. */
      expect(indices.map((indice) => indice.nome).sort()).toEqual([
        "usuario_nome_de_usuario_unico",
        "usuario_pkey",
      ]);

      const unico = indices.find(
        (indice) => indice.nome === "usuario_nome_de_usuario_unico",
      );

      expect(unico?.definicao).toMatch(/UNIQUE INDEX/);
      expect(unico?.definicao).toMatch(/lower\(nome_de_usuario\)/);

      const restricoes = await consultar<{ definicao: string }>(
        `SELECT pg_get_constraintdef(oid) AS definicao
           FROM pg_constraint
          WHERE conrelid = 'usuario'::regclass AND contype = 'c';`,
      );

      const definicoes = restricoes
        .map((restricao) => restricao.definicao)
        .join(" ");

      expect(definicoes).toMatch(/char_length\(nome_de_usuario\) >= 3/);
      expect(definicoes).toMatch(/char_length\(nome_de_usuario\) <= 50/);
      expect(definicoes).toMatch(/A-Za-z0-9\._-\]/);
      expect(definicoes).toMatch(/octet_length\(sal\) = 16/);

      /** Nenhuma coluna capaz de guardar a Senha, nem derivada dela. */
      const colunas = await consultar<{ nome: string }>(
        `SELECT column_name AS nome
           FROM information_schema.columns
          WHERE table_name = 'usuario' ORDER BY column_name;`,
      );

      expect(colunas.map((coluna) => coluna.nome)).toEqual([
        "hash",
        "id",
        "nome_de_usuario",
        "parametros",
        "sal",
      ]);
    });
  });

  it("recusa Nome de usuário inválido, sal fora de 16 bytes e duplicata sem distinguir maiúsculas", async () => {
    const nomeDaBase = await criarBaseMigrada("usuario-restricoes");
    const piscina = await abrirPiscinaDaBase(nomeDaBase);

    const inserir = (id: string, nomeDeUsuario: string, sal = Buffer.alloc(16)) =>
      piscina.query(
        `INSERT INTO usuario (id, nome_de_usuario, sal, hash, parametros)
         VALUES ($1, $2, $3, $4, '{}');`,
        [id, nomeDeUsuario, sal, Buffer.from("hash-sintetico")],
      );

    try {
      await inserir("u1", "Ana.Silva");

      /** `ana.silva` e `Ana.Silva` são o mesmo Nome de usuário (FR-074). */
      await expect(inserir("u2", "ana.silva")).rejects.toThrow();
      await expect(inserir("u3", "ANA.SILVA")).rejects.toThrow();

      await expect(inserir("u4", "ab")).rejects.toThrow();
      await expect(inserir("u5", "a".repeat(51))).rejects.toThrow();
      await expect(inserir("u6", "josé")).rejects.toThrow();
      await expect(inserir("u7", "ana silva")).rejects.toThrow();
      await expect(inserir("u8", "bruno.souza", Buffer.alloc(15))).rejects.toThrow();

      /** A leitura também não distingue caixa: quem existe é a linha de u1. */
      const lido = await piscina.query(
        "SELECT id FROM usuario WHERE lower(nome_de_usuario) = lower($1);",
        ["ANA.SILVA"],
      );

      expect(lido.rows).toEqual([{ id: "u1" }]);
    } finally {
      await piscina.end();
    }
  });

  it("leva uma base da feature 006 à versão corrente preservando Cartões, Baralhos e Vínculos", async () => {
    const apoio = await servidorDeTeste();
    const nomeDaBase = await apoio.criarBase("usuario-base-instalada");
    const piscina = await abrirPiscinaDaBase(nomeDaBase);

    try {
      /** O que a feature 006 deixou instalado: as migrações 1 a 3, com dados. */
      await aplicarMigracoes(piscina, MIGRACOES.slice(0, 3));

      await piscina.query(
        "INSERT INTO cartao (id, frente, verso) VALUES ('c1', 'To walk', 'Caminhar');",
      );
      await piscina.query(
        "INSERT INTO baralho (id, nome) VALUES ('b1', 'Inglês');",
      );
      await piscina.query(
        "INSERT INTO vinculo (cartao_id, baralho_id) VALUES ('c1', 'b1');",
      );

      expect(await aplicarMigracoes(piscina)).toBe(versaoCorrenteConhecida());

      const tabelas = await piscina.query<{ nome: string }>(
        `SELECT tablename AS nome FROM pg_tables
          WHERE schemaname = 'public' ORDER BY tablename;`,
      );

      expect(tabelas.rows.map((linha) => linha.nome)).toEqual([
        "baralho",
        "cartao",
        "usuario",
        "versao_do_esquema",
        "vinculo",
      ]);

      /** Nada do que existia foi perdido pela migração 4. */
      const cartoes = await piscina.query("SELECT id FROM cartao ORDER BY id;");
      const vinculos = await piscina.query(
        "SELECT cartao_id, baralho_id FROM vinculo;",
      );

      expect(cartoes.rows).toEqual([{ id: "c1" }]);
      expect(vinculos.rows).toEqual([{ cartao_id: "c1", baralho_id: "b1" }]);

      const versoes = await piscina.query<{ versao: number }>(
        "SELECT versao FROM versao_do_esquema;",
      );

      expect(versoes.rows.map((linha) => Number(linha.versao))).toEqual([
        versaoCorrenteConhecida(),
      ]);
    } finally {
      await piscina.end();
    }
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

/**
 * T910 — o comando de migração da nuvem (`migrate:cloud`): lê e valida `DB_URL`,
 * aplica as migrações pendentes pelo aplicador do Adapter e informa a versão
 * resultante (FR-116, FR-113, SC-048).
 *
 * A entrada real é executada como processo filho, como o comando é executado
 * numa implantação, e o PostgreSQL é o do apoio de teste, com TLS ligado e CA
 * privado apontado por `DB_CA_CERT`. O que a prova exige: base nova chega à
 * versão corrente, repetir o comando não reaplica nada, dois comandos
 * simultâneos não aplicam a mesma migração duas vezes, e nem a saída nem a
 * recusa trazem a URL, o host, o usuário ou a senha.
 */
describe("o comando de migração da nuvem (T910, SC-048)", () => {
  const ENTRADA_DE_MIGRACAO = join(
    RAIZ_DO_BACKEND,
    "src",
    "entradas",
    "migrar-nuvem.ts",
  );

  /** Senha gerada por execução: só o que **não** pode sair na saída. */
  const SENHA_GERADA = randomBytes(24).toString("base64url");

  let servidor: FerramentasDoServidor;
  let certificado: CertificadoDaAutoridade;

  beforeAll(async () => {
    servidor = await servidorDeTeste();
    certificado = gravarCertificadoDaAutoridade(servidor);
  });

  afterAll(() => {
    certificado.remover();
  });

  /** O ambiente do comando, com a base informada e o CA temporário. */
  function ambiente(nomeDaBase: string): NodeJS.ProcessEnv {
    const herdado = { ...process.env };

    delete herdado.DB_URL;
    delete herdado.DB_CA_CERT;

    return {
      ...herdado,
      DB_CA_CERT: certificado.caminho,
      DB_URL: servidor.urlDaBase(nomeDaBase),
    };
  }

  interface ExecucaoDoComando {
    codigo: number | null;
    saida: string;
  }

  /** Executa o comando de migração e espera o processo sair. */
  async function executarComando(
    ambienteDoComando: NodeJS.ProcessEnv,
  ): Promise<ExecucaoDoComando> {
    const processo = spawn(process.execPath, [ENTRADA_DE_MIGRACAO], {
      cwd: RAIZ_DO_BACKEND,
      env: ambienteDoComando,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const capturado: string[] = [];

    processo.stdout?.setEncoding("utf8");
    processo.stdout?.on("data", (pedaco: string) => capturado.push(pedaco));
    processo.stderr?.setEncoding("utf8");
    processo.stderr?.on("data", (pedaco: string) => capturado.push(pedaco));

    const codigo = await new Promise<number | null>((resolver, recusar) => {
      const tempoLimite = setTimeout(() => {
        processo.kill("SIGKILL");
        recusar(new Error("o comando de migração não encerrou dentro do prazo"));
      }, 60_000);

      processo.once("exit", (saiu) => {
        clearTimeout(tempoLimite);
        resolver(saiu);
      });
    });

    return { codigo, saida: capturado.join("") };
  }

  /** As tabelas da base, ordenadas, como o esquema as deixou. */
  async function tabelasDaBase(nomeDaBase: string): Promise<string[]> {
    const linhas = await servidor.consultar<{ nome: string }>(
      nomeDaBase,
      `SELECT tablename AS nome FROM pg_tables
        WHERE schemaname = 'public' ORDER BY tablename;`,
    );

    return linhas.map((linha) => linha.nome);
  }

  it("leva a base nova e vazia à versão corrente e informa a versão", async () => {
    const nomeDaBase = await servidor.criarBase("comando-nova");
    const { codigo, saida } = await executarComando(ambiente(nomeDaBase));

    expect(codigo).toBe(0);
    expect(saida).toContain(
      `o esquema da base está na versão ${versaoCorrenteConhecida()}`,
    );

    expect(await tabelasDaBase(nomeDaBase)).toEqual([
      "baralho",
      "cartao",
      "usuario",
      "versao_do_esquema",
      "vinculo",
    ]);

    const versoes = await servidor.consultar<{ versao: number }>(
      nomeDaBase,
      "SELECT versao FROM versao_do_esquema;",
    );

    expect(versoes.map((linha) => Number(linha.versao))).toEqual([
      versaoCorrenteConhecida(),
    ]);
  }, 60_000);

  it("repetir o comando não reaplica nada nem reescreve o conteúdo", async () => {
    const nomeDaBase = await servidor.criarBase("comando-repetido");

    expect((await executarComando(ambiente(nomeDaBase))).codigo).toBe(0);

    await servidor.consultar(
      nomeDaBase,
      "INSERT INTO cartao (id, frente, verso) VALUES ($1, $2, $3);",
      ["c1", "To walk", "Caminhar"],
    );

    const repeticao = await executarComando(ambiente(nomeDaBase));

    /** Reaplicar o DDL de uma migração já aplicada teria falhado. */
    expect(repeticao.codigo).toBe(0);
    expect(repeticao.saida).toContain(
      `o esquema da base está na versão ${versaoCorrenteConhecida()}`,
    );

    const gravado = await servidor.consultar<{ id: string }>(
      nomeDaBase,
      "SELECT id FROM cartao;",
    );

    expect(gravado).toEqual([{ id: "c1" }]);
    expect(await tabelasDaBase(nomeDaBase)).toEqual([
      "baralho",
      "cartao",
      "usuario",
      "versao_do_esquema",
      "vinculo",
    ]);
  }, 60_000);

  it("dois comandos ao mesmo tempo não aplicam a mesma migração duas vezes", async () => {
    const nomeDaBase = await servidor.criarBase("comando-simultaneo");
    const ambienteDoComando = ambiente(nomeDaBase);

    /** Dois deployamentos simultâneos, como a trava consultiva prevê. */
    const [primeiro, segundo] = await Promise.all([
      executarComando(ambienteDoComando),
      executarComando(ambienteDoComando),
    ]);

    expect([primeiro.codigo, segundo.codigo]).toEqual([0, 0]);
    expect(await tabelasDaBase(nomeDaBase)).toEqual([
      "baralho",
      "cartao",
      "usuario",
      "versao_do_esquema",
      "vinculo",
    ]);

    const versoes = await servidor.consultar<{ versao: number }>(
      nomeDaBase,
      "SELECT versao FROM versao_do_esquema;",
    );

    /** Uma única linha de versão: nenhuma migração ficou pela metade. */
    expect(versoes.map((linha) => Number(linha.versao))).toEqual([
      versaoCorrenteConhecida(),
    ]);
  }, 60_000);

  it("nunca imprime a URL, o host, o usuário nem a senha", async () => {
    const nomeDaBase = await servidor.criarBase("comando-sem-segredo");
    const { codigo, saida } = await executarComando(ambiente(nomeDaBase));

    expect(codigo).toBe(0);
    expect(saida).not.toContain(servidor.configuracao.senha);
    expect(saida).not.toContain(servidor.configuracao.host);
    expect(saida).not.toContain(`${servidor.configuracao.usuario}:`);
    expect(saida).not.toContain("postgresql://");
    expect(saida).not.toMatch(/sslmode|senha|password|secret|token/i);
  }, 60_000);

  const CASOS_DE_RECUSA: { rotulo: string; url: string | undefined }[] = [
    { rotulo: "variável ausente", url: undefined },
    { rotulo: "variável vazia", url: "   " },
    { rotulo: "valor não analisável", url: "isto-nao-e-uma-url" },
    {
      rotulo: "protocolo não aceito",
      url: `mysql://usuario:${SENHA_GERADA}@exemplo.invalid/base`,
    },
    {
      rotulo: "URL que pede cifra rebaixada",
      url: `postgresql://usuario:${SENHA_GERADA}@exemplo.invalid/base?sslmode=prefer`,
    },
  ];

  it.each(CASOS_DE_RECUSA)(
    "recusa com o prefixo do comando e sem repetir o valor: $rotulo",
    async (caso) => {
      const herdado = { ...process.env };

      delete herdado.DB_URL;

      const ambienteDoComando: NodeJS.ProcessEnv = {
        ...herdado,
        DB_CA_CERT: certificado.caminho,
      };

      if (caso.url !== undefined) {
        ambienteDoComando.DB_URL = caso.url;
      }

      const { codigo, saida } = await executarComando(ambienteDoComando);

      expect(codigo).toBe(1);
      expect(saida).toContain("Migração recusada:");
      expect(saida).toContain("DB_URL");
      expect(saida).not.toContain(SENHA_GERADA);
      expect(saida).not.toContain("exemplo.invalid");
      expect(saida).not.toMatch(/:\/\//);
      expect(saida).not.toContain("Migração concluída");
    },
    60_000,
  );
});
