import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { abrirArmazenamentoSqlite } from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarIdentidade } from "../../src/identidade/identidade.ts";
import {
  abrirArmazenamentoDaBase,
  criarBaseMigrada,
  descartarBasesDeTeste,
} from "../armazenamento/postgresql/base-de-teste.ts";
import {
  servidorDeTeste,
  type FerramentasDoServidor,
} from "../armazenamento/postgresql/servidor-de-teste.ts";

/**
 * T604 — a verificação negativa da feature: ler os dados armazenados não revela
 * a Senha, e não revela que duas Senhas coincidem (FR-076, FR-078; SC-021,
 * SC-022).
 *
 * A leitura **direta da tabela `usuario`** é o que constitui esta verificação, e
 * não inspeção de estado interno: nenhuma operação da Interface devolveria a
 * Senha, e é justamente isso que se prova aqui. Os dois Adapters são
 * inspecionados, cada um no seu banco: o arquivo SQLite é aberto direto pelo
 * driver, e o PostgreSQL é consultado pelo apoio de teste.
 *
 * O segredo e a Senha são **gerados a cada execução**: nenhum valor entra em
 * arquivo versionado (Princípio VIII). A Senha usada nos dois Usuários é a
 * mesma — dois Usuários podem ter a mesma Senha, e o armazenamento precisa não
 * dizer isso.
 */

/** O segredo descartável desta execução, e a Senha compartilhada pelos dois. */
const SEGREDO = randomBytes(48).toString("base64url");
const SENHA = randomBytes(18).toString("base64url");

/** Diz se os bytes contêm a Senha, em texto, em qualquer codificação. */
function contemABytes(bytes: Uint8Array): boolean {
  return Buffer.from(bytes).includes(Buffer.from(SENHA, "utf8"));
}

/** Os cinco bytes/textos da linha, na forma em que o esquema os guarda. */
interface LinhaArmazenada {
  nomeDeUsuario: string;
  sal: Uint8Array;
  hash: Uint8Array;
  parametros: string;
}

/**
 * Confere que a linha guardada não revela a Senha em nenhuma coluna — nem por
 * texto, nem por bytes — e devolve a forma tipada para as comparações.
 */
function conferirLinha(linha: Record<string, unknown>): LinhaArmazenada {
  expect(JSON.stringify(linha, (_chave, valor) =>
    valor instanceof Uint8Array ? Array.from(valor) : valor,
  )).not.toContain(SENHA);

  for (const valor of Object.values(linha)) {
    expect(String(valor)).not.toContain(SENHA);

    if (valor instanceof Uint8Array) {
      expect(contemABytes(valor)).toBe(false);
    }
  }

  return {
    nomeDeUsuario: String(linha.nome_de_usuario),
    sal: linha.sal as Uint8Array,
    hash: linha.hash as Uint8Array,
    parametros: String(linha.parametros),
  };
}

describe("SQLite — leitura direta do arquivo", () => {
  const DIRETORIO = mkdtempSync(join(tmpdir(), "dados-armazenados-"));

  afterAll(() => {
    rmSync(DIRETORIO, { recursive: true, force: true });
  });

  it("não guarda a Senha em nenhuma coluna e dá valores distintos a Senhas iguais", async () => {
    const caminho = join(DIRETORIO, "identidade.sqlite");
    const aberto = await abrirArmazenamentoSqlite(caminho);
    const identidade = criarIdentidade(aberto.usuarios, SEGREDO);

    const primeiro = await identidade.cadastrar({
      nomeDeUsuario: "Ana.Silva",
      senha: SENHA,
    });
    const segundo = await identidade.cadastrar({
      nomeDeUsuario: "Bruno.Souza",
      senha: SENHA,
    });

    expect([primeiro.ok, segundo.ok]).toEqual([true, true]);

    /** Nenhuma das duas respostas carrega a Senha. */
    expect(JSON.stringify([primeiro, segundo])).not.toContain(SENHA);

    await aberto.encerrar();

    const banco = new DatabaseSync(caminho);

    try {
      const colunas = banco.prepare("PRAGMA table_info(usuario)").all();
      const linhas = banco
        .prepare(
          `SELECT id, nome_de_usuario, sal, hash, parametros
             FROM usuario
            ORDER BY nome_de_usuario`,
        )
        .all();

      expect(linhas).toHaveLength(2);

      /** Nenhuma coluna derivada da Senha, como comprimento ou força. */
      expect(colunas.map((coluna) => coluna.name)).toEqual([
        "id",
        "nome_de_usuario",
        "sal",
        "hash",
        "parametros",
      ]);

      const guardados = linhas.map(conferirLinha);
      const [ana, bruno] = guardados;

      expect(ana?.nomeDeUsuario).toBe("Ana.Silva");
      expect(bruno?.nomeDeUsuario).toBe("Bruno.Souza");

      /** O sal tem exatamente os 16 bytes que a `CHECK` exige (FR-076). */
      expect(ana?.sal).toHaveLength(16);
      expect(bruno?.sal).toHaveLength(16);

      /** Mesma Senha, `sal` e `hash` diferentes: nada revela a coincidência. */
      expect(Buffer.from(ana?.sal ?? []).equals(Buffer.from(bruno?.sal ?? [])))
        .toBe(false);
      expect(
        Buffer.from(ana?.hash ?? []).equals(Buffer.from(bruno?.hash ?? [])),
      ).toBe(false);

      /** Os parâmetros são o JSON da derivação, e não carregam a Senha. */
      expect(JSON.parse(ana?.parametros ?? "")).toMatchObject({
        algoritmo: "scrypt",
      });
    } finally {
      banco.close();
    }

    /** Nem no arquivo, byte a byte, a Senha aparece (SC-021). */
    expect(contemABytes(readFileSync(caminho))).toBe(false);
  });
});

/**
 * A mesma verificação contra o Adapter da nuvem. O PostgreSQL é o real do apoio
 * de teste, com TLS ligado, e a leitura é uma consulta direta à tabela.
 */
describe("PostgreSQL — leitura direta da tabela", () => {
  let servidor: FerramentasDoServidor;

  beforeAll(async () => {
    servidor = await servidorDeTeste();
  }, 120_000);

  afterAll(async () => {
    await descartarBasesDeTeste();
    await (await servidorDeTeste()).encerrar();
  });

  it("não guarda a Senha em nenhuma coluna e dá valores distintos a Senhas iguais", async () => {
    const nomeDaBase = await criarBaseMigrada("dados-armazenados", servidor);
    const aberto = await abrirArmazenamentoDaBase(nomeDaBase, servidor);
    const identidade = criarIdentidade(aberto.usuarios, SEGREDO);

    const primeiro = await identidade.cadastrar({
      nomeDeUsuario: "Ana.Silva",
      senha: SENHA,
    });
    const segundo = await identidade.cadastrar({
      nomeDeUsuario: "Bruno.Souza",
      senha: SENHA,
    });

    expect([primeiro.ok, segundo.ok]).toEqual([true, true]);
    expect(JSON.stringify([primeiro, segundo])).not.toContain(SENHA);

    /** Encerra o conjunto de conexões: a base continua, para ser lida. */
    await aberto.encerrar();

    const colunas = await servidor.consultar<{ nome: string }>(
      nomeDaBase,
      `SELECT column_name AS nome
         FROM information_schema.columns
        WHERE table_name = 'usuario'
        ORDER BY column_name;`,
    );

    expect(colunas.map((coluna) => coluna.nome)).toEqual([
      "hash",
      "id",
      "nome_de_usuario",
      "parametros",
      "sal",
    ]);

    const linhas = await servidor.consultar<Record<string, unknown>>(
      nomeDaBase,
      `SELECT id, nome_de_usuario, sal, hash, parametros
         FROM usuario
        ORDER BY nome_de_usuario;`,
    );

    expect(linhas).toHaveLength(2);

    const guardados = linhas.map(conferirLinha);
    const [ana, bruno] = guardados;

    expect(ana?.nomeDeUsuario).toBe("Ana.Silva");
    expect(bruno?.nomeDeUsuario).toBe("Bruno.Souza");
    expect(ana?.sal).toHaveLength(16);
    expect(bruno?.sal).toHaveLength(16);
    expect(Buffer.from(ana?.sal ?? []).equals(Buffer.from(bruno?.sal ?? [])))
      .toBe(false);
    expect(
      Buffer.from(ana?.hash ?? []).equals(Buffer.from(bruno?.hash ?? [])),
    ).toBe(false);
  });
});
