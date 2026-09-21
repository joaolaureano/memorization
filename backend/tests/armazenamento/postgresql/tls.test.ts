import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { abrirArmazenamentoPostgresql } from "../../../src/armazenamento/postgresql/armazenamento.ts";
import {
  abrirArmazenamentoDaBase,
  abrirPiscinaDaBase,
  criarBaseMigrada,
  descartarBasesDeTeste,
} from "./base-de-teste.ts";
import { servidorDeTeste } from "./servidor-de-teste.ts";

/**
 * T901 — o PostgreSQL de teste é **real e cifrado**: ele aceita conexão cifrada
 * com o CA gerado em tempo de execução e verificado, uma conexão sem esse CA é
 * recusada, e nenhuma operação sobre uma conexão que não se confirma passa por
 * concluída (FR-111, FR-115, FR-044, SC-044, SC-047).
 *
 * A prova é do TLS de verdade, e não de configuração: o servidor sobe com
 * `ssl=on` e um certificado assinado por um CA privado que só existe nesta
 * execução, e as conexões do Adapter verificam esse certificado
 * (`rejectUnauthorized: true`). Sem o CA, o próprio driver recusa a conexão, e a
 * falha chega pela Porta como `indisponivel` — nunca como operação concluída, e
 * nunca com nada gravado.
 *
 * Fecha o grupo a verificação negativa do Princípio VIII: nem a senha gerada,
 * nem chave privada, nem certificado aparecem em arquivo algum do repositório —
 * eles nascem no diretório temporário e morrem com o servidor.
 */

const RAIZ_DO_BACKEND = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

/** A raiz do repositório: é o que é versionado, e nada dela pode ter segredo. */
const RAIZ_DO_REPOSITORIO = resolve(RAIZ_DO_BACKEND, "..");

/** O próprio arquivo desta varredura, que carrega os marcadores como guarda. */
const ARQUIVO_DA_VARREDURA = fileURLToPath(import.meta.url);

/** Pastas que não são código versionado e ficam fora da varredura de segredos. */
const PASTAS_IGNORADAS = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".git",
]);

/** Marcadores de certificado e de chave privada: nada disso pode ser versionado. */
const MARCADORES_DE_SEGREDO = [
  "-----BEGIN CERTIFICATE-----",
  "-----BEGIN PRIVATE KEY-----",
  "-----BEGIN RSA PRIVATE KEY-----",
];

/** Subir o PostgreSQL real leva segundos: o prazo do gancho é folgado. */
beforeAll(async () => {
  await servidorDeTeste();
}, 120_000);

afterAll(async () => {
  await descartarBasesDeTeste();
  await (await servidorDeTeste()).encerrar();
});

/** Todos os arquivos versionados, recursivamente, a partir do diretório dado. */
function arquivosVersionados(diretorio: string): string[] {
  return readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
    if (entrada.isDirectory()) {
      return PASTAS_IGNORADAS.has(entrada.name)
        ? []
        : arquivosVersionados(join(diretorio, entrada.name));
    }

    const caminho = join(diretorio, entrada.name);

    return [caminho];
  });
}

describe("a conexão de teste é cifrada e verificada", () => {
  it("usa TLS com o certificado do servidor confirmado pelo CA gerado", async () => {
    const nomeDaBase = await criarBaseMigrada("cifrada");
    const piscina = await abrirPiscinaDaBase(nomeDaBase);

    try {
      const { rows } = await piscina.query(
        "SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid();",
      );

      /** A sessão do Adapter é cifrada: a conexão em claro não existiria aqui. */
      expect(rows).toEqual([{ ssl: true }]);
    } finally {
      await piscina.end();
    }
  });

  it("recusa a conexão sem o CA gerado, mesmo com a verificação exigida", async () => {
    const nomeDaBase = await criarBaseMigrada("sem-ca");
    const { host, porta, usuario, senha } = (await servidorDeTeste()).configuracao;
    const semAutoridade = new Pool({
      host,
      port: porta,
      user: usuario,
      password: senha,
      database: nomeDaBase,
      /** Verificação exigida, sem o CA que confirma este servidor. */
      ssl: { rejectUnauthorized: true },
    });

    semAutoridade.on("error", () => {
      // Conexão ociosa recusada: descartada em silêncio, como no Adapter.
    });

    try {
      await expect(semAutoridade.query("SELECT 1;")).rejects.toThrow(
        /certificate|self-signed|unable to verify/i,
      );
    } finally {
      await semAutoridade.end();
    }
  });

  it("não apresenta como concluída nenhuma operação sobre a conexão não verificada", async () => {
    const nomeDaBase = await criarBaseMigrada("nao-verificada");
    const servidor = await servidorDeTeste();

    /** A configuração do Adapter sem o CA: a conexão não pode ser confirmada. */
    const semVerificacao = await abrirArmazenamentoPostgresql({
      url: servidor.urlDaBase(nomeDaBase),
    });

    try {
      expect(
        await semVerificacao.armazenamento.inserirCartao("dono-um", {
          id: "c1",
          frente: "To walk",
          verso: "Caminhar",
        }),
      ).toEqual({ ok: false, erro: "indisponivel" });
    } finally {
      await semVerificacao.encerrar();
    }

    /** Nada foi gravado: a operação recusada não passou por concluída. */
    const verificado = await abrirArmazenamentoDaBase(nomeDaBase);

    try {
      expect(await verificado.armazenamento.listarCartoes("dono-um")).toEqual(
        [],
      );
    } finally {
      await verificado.encerrar();
    }
  });
});

describe("nenhum segredo é versionado", () => {
  it("não guarda a senha gerada, chave privada nem certificado em arquivo versionado", async () => {
    const senha = (await servidorDeTeste()).configuracao.senha;
    const arquivos = arquivosVersionados(RAIZ_DO_REPOSITORIO).filter(
      (caminho) => caminho !== ARQUIVO_DA_VARREDURA,
    );

    expect(arquivos.length).toBeGreaterThan(100);

    const comSenha = arquivos.filter((caminho) =>
      readFileSync(caminho, "utf8").includes(senha),
    );

    expect(
      comSenha.map((caminho) => relative(RAIZ_DO_REPOSITORIO, caminho)),
    ).toEqual([]);

    const comMarcador = arquivos.filter((caminho) => {
      const conteudo = readFileSync(caminho, "utf8");

      return MARCADORES_DE_SEGREDO.some((marcador) =>
        conteudo.includes(marcador),
      );
    });

    expect(
      comMarcador.map((caminho) => relative(RAIZ_DO_REPOSITORIO, caminho)),
    ).toEqual([]);
  });

  it("gera a senha a cada execução, em vez de trazer uma literal", async () => {
    const senha = (await servidorDeTeste()).configuracao.senha;

    expect(senha).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });
});
