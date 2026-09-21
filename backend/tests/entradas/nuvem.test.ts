import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import type { AddressInfo } from "node:net";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  criarBaseMigrada,
  descartarBasesDeTeste,
  gravarCertificadoDaAutoridade,
  type CertificadoDaAutoridade,
} from "../armazenamento/postgresql/base-de-teste.ts";
import {
  servidorDeTeste,
  type ServidorAutonomo,
} from "../armazenamento/postgresql/servidor-de-teste.ts";
import { versaoCorrenteConhecida } from "../../src/armazenamento/postgresql/esquema.ts";

/**
 * T906, T907, T908 e T909 — o início da nuvem: a URL de conexão validada sem
 * repetir o valor, a cifra obrigatória e não rebaixável, a saída com apenas o
 * tipo do armazenamento e a recusa por esquema atrasado (FR-113 a FR-115,
 * FR-118, FR-121; SC-045 a SC-048).
 *
 * A entrada real é executada como processo filho, com o ambiente montado pelo
 * cenário: é a prova de ponta a ponta de que a recusa acontece **antes** de
 * qualquer conexão, de que nada do valor informado alcança a saída e de que o
 * servidor só começa a escutar quando a base está na versão corrente.
 *
 * O PostgreSQL e o CA privado são os do apoio de teste: um servidor real, com
 * TLS ligado e certificado que se confirma contra um CA gerado a cada execução,
 * apontado por `DB_CA_CERT` através de um arquivo PEM temporário. Nenhuma senha
 * é literal: todas são **geradas por execução**.
 */

const RAIZ_DO_BACKEND = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const ENTRADA_DA_NUVEM = join(RAIZ_DO_BACKEND, "src", "entradas", "nuvem.ts");

/** A única linha de início da nuvem. */
const LINHA_DE_INICIO = "Armazenamento: PostgreSQL (nuvem)";

/** A recusa por falta de URL: nomeia a variável e não repete o valor. */
const URL_NAO_INFORMADA =
  "Nuvem recusada: a variável de ambiente DB_URL não foi informada.";

/** A recusa por valor inutilizável: nomeia a variável e o motivo genérico. */
const URL_INVALIDA =
  "Nuvem recusada: a variável de ambiente DB_URL não é uma URL de conexão válida.";

/** A recusa por URL que pede conexão sem verificação do certificado. */
const CIFRA_REBAIXADA =
  "Nuvem recusada: a URL de DB_URL pede conexão sem verificação de certificado; " +
  "a conexão cifrada com certificado verificado é obrigatória.";

/** A falha de acesso à base: genérica, em português, sem nada do driver. */
const FALHA_NO_ACESSO =
  "Falha no armazenamento da nuvem: não foi possível acessar a base. " +
  "A aplicação não foi iniciada.";

/**
 * A senha de teste desta execução: gerada agora, nunca versionada e sempre
 * reconhecível no que **não** pode aparecer na saída (Princípio VIII).
 */
const SENHA_GERADA = randomBytes(24).toString("base64url");

/** Uma segunda senha gerada, para o cenário de credencial recusada. */
const OUTRA_SENHA_GERADA = randomBytes(24).toString("base64url");

/**
 * O segredo das Senhas desta execução, gerado agora e nunca versionado: a
 * entrada da nuvem recusa iniciar sem ele (FR-077).
 */
const SEGREDO_DA_EXECUCAO = randomBytes(48).toString("base64url");

/** O tempo de espera de um processo da entrada, folgado para o TLS de verdade. */
const PRAZO_DA_ENTRADA = 60_000;

let servidor: ServidorAutonomo;
let certificado: CertificadoDaAutoridade;
let pastaTemporaria: string;

/** Subir o PostgreSQL real leva segundos: o prazo do gancho é folgado. */
beforeAll(async () => {
  servidor = await servidorDeTeste();
  certificado = gravarCertificadoDaAutoridade(servidor);
  pastaTemporaria = mkdtempSync(join(tmpdir(), "inicio-da-nuvem-"));
}, 120_000);

afterAll(async () => {
  certificado.remover();
  rmSync(pastaTemporaria, { recursive: true, force: true });
  await descartarBasesDeTeste();
  await servidor.encerrar();
});

/**
 * O ambiente da entrada sem `DB_URL` nem `DB_CA_CERT` herdados do processo —
 * e com o segredo das Senhas **gerado nesta execução**, porque o início da
 * nuvem recusa subir sem ele (FR-077). O segredo é o mesmo em todos os
 * cenários deste arquivo, como é o mesmo numa mesma base.
 */
function ambienteSemUrl(): NodeJS.ProcessEnv {
  const ambiente = { ...process.env };

  delete ambiente.DB_URL;
  delete ambiente.DB_CA_CERT;

  return { ...ambiente, SEGREDO_DAS_SENHAS: SEGREDO_DA_EXECUCAO };
}

/** Devolve uma porta livre do loopback, escolhida pelo sistema operacional. */
async function portaLivre(): Promise<number> {
  return await new Promise((resolver, recusar) => {
    const sondagem = createServer();

    sondagem.once("error", recusar);
    sondagem.listen(0, "127.0.0.1", () => {
      const endereco = sondagem.address();

      if (endereco === null || typeof endereco === "string") {
        recusar(new Error("não foi possível determinar a porta livre"));
        return;
      }

      sondagem.close(() => resolver((endereco as AddressInfo).port));
    });
  });
}

interface ExecucaoDaEntrada {
  codigo: number | null;
  saida: string;
}

/** Executa a entrada da nuvem com o ambiente informado e espera o processo sair. */
async function executarEntrada(
  ambiente: NodeJS.ProcessEnv,
  diretorio = RAIZ_DO_BACKEND,
): Promise<ExecucaoDaEntrada> {
  const processo = spawn(process.execPath, [ENTRADA_DA_NUVEM], {
    cwd: diretorio,
    env: ambiente,
    stdio: ["ignore", "pipe", "pipe"],
  });

  return await acompanhar(processo);
}

/** Coleta a saída do processo e espera o seu encerramento. */
async function acompanhar(processo: ChildProcess): Promise<ExecucaoDaEntrada> {
  const capturado: string[] = [];

  processo.stdout?.setEncoding("utf8");
  processo.stdout?.on("data", (pedaco: string) => capturado.push(pedaco));
  processo.stderr?.setEncoding("utf8");
  processo.stderr?.on("data", (pedaco: string) => capturado.push(pedaco));

  const codigo = await new Promise<number | null>((resolver, recusar) => {
    const tempoLimite = setTimeout(() => {
      processo.kill("SIGKILL");
      recusar(new Error("a entrada da nuvem não encerrou dentro do prazo"));
    }, PRAZO_DA_ENTRADA);

    processo.once("exit", (saiu) => {
      clearTimeout(tempoLimite);
      resolver(saiu);
    });
  });

  return { codigo, saida: capturado.join("") };
}

interface NuvemEmExecucao {
  primeiraLinha: Promise<string>;
  saida: () => string;
  encerrar: () => Promise<void>;
}

/**
 * Inicia a entrada da nuvem e devolve a **primeira** linha impressa, a saída
 * capturada até então e o encerramento — a forma com que o início bem sucedido é
 * observado sem deixar o processo de pé.
 */
function iniciarEntrada(
  ambiente: NodeJS.ProcessEnv,
  diretorio: string,
): NuvemEmExecucao {
  const processo = spawn(process.execPath, [ENTRADA_DA_NUVEM], {
    cwd: diretorio,
    env: ambiente,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const capturado: string[] = [];
  const primeiraLinha = new Promise<string>((resolver, recusar) => {
    const tempoLimite = setTimeout(() => {
      recusar(new Error("a entrada da nuvem não imprimiu a linha de início"));
    }, PRAZO_DA_ENTRADA);
    let acumulado = "";

    processo.stdout?.setEncoding("utf8");
    processo.stdout?.on("data", (pedaco: string) => {
      capturado.push(pedaco);
      acumulado += pedaco;

      const quebra = acumulado.indexOf("\n");

      if (quebra >= 0) {
        clearTimeout(tempoLimite);
        resolver(acumulado.slice(0, quebra));
      }
    });
    processo.stderr?.setEncoding("utf8");
    processo.stderr?.on("data", (pedaco: string) => capturado.push(pedaco));
    processo.once("exit", (codigo) => {
      clearTimeout(tempoLimite);
      recusar(new Error(`a entrada da nuvem encerrou com código ${String(codigo)}`));
    });
  });

  return {
    primeiraLinha,
    saida: () => capturado.join(""),
    async encerrar() {
      if (processo.exitCode !== null || processo.signalCode !== null) {
        return;
      }

      const saiu = new Promise<void>((resolver) => {
        processo.once("exit", () => resolver());
      });

      processo.kill("SIGTERM");

      await Promise.race([saiu, new Promise<void>((r) => setTimeout(r, 5_000))]);
    },
  };
}

/** Aguarda a API responder `{"status":"ok"}` no `/health`. */
async function aguardarSaude(porta: number): Promise<void> {
  const inicio = Date.now();

  while (Date.now() - inicio < 30_000) {
    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/health`);

      if (resposta.ok) {
        return;
      }
    } catch {
      // Ainda não escuta; a sondagem continua até o tempo limite.
    }

    await new Promise((resolver) => setTimeout(resolver, 100));
  }

  throw new Error("a API da nuvem não respondeu em 30000ms");
}

/** A URL de conexão da base informada, com a senha gerada pelo apoio de teste. */
function urlDaBase(nomeDaBase: string, sslmode = "verify-full"): string {
  const { host, porta, usuario, senha } = servidor.configuracao;

  return (
    `postgresql://${usuario}:${senha}@${host}:${porta}/${nomeDaBase}` +
    `?sslmode=${sslmode}`
  );
}

describe("recusa da URL de conexão (T906, SC-046)", () => {
  it("recusa com a variável ausente, sem nada escutar e sem repetir valor algum", async () => {
    const porta = await portaLivre();
    const { codigo, saida } = await executarEntrada({
      ...ambienteSemUrl(),
      PORTA: String(porta),
    });

    expect(codigo).toBe(1);
    expect(saida).toContain(URL_NAO_INFORMADA);
    expect(saida).not.toContain("Armazenamento:");
    expect(saida).not.toMatch(/https?:\/\/|senha|password|secret|token/i);

    await expect(
      fetch(`http://127.0.0.1:${porta}/health`, {
        signal: AbortSignal.timeout(1_000),
      }),
    ).rejects.toThrow();
  }, PRAZO_DA_ENTRADA);

  it("recusa com a variável vazia", async () => {
    const { codigo, saida } = await executarEntrada({
      ...ambienteSemUrl(),
      DB_URL: "   ",
    });

    expect(codigo).toBe(1);
    expect(saida).toContain(URL_NAO_INFORMADA);
  }, PRAZO_DA_ENTRADA);

  const CASOS_INVALIDOS: { rotulo: string; url: string }[] = [
    { rotulo: "não analisável", url: "isto-nao-e-uma-url" },
    {
      rotulo: "protocolo não aceito",
      url: `mysql://usuario:${SENHA_GERADA}@exemplo.invalid/base`,
    },
    { rotulo: "sem host", url: `postgresql://usuario:${SENHA_GERADA}@/base` },
    {
      rotulo: "sem base nomeada",
      url: `postgresql://usuario:${SENHA_GERADA}@exemplo.invalid`,
    },
    { rotulo: "sem host nem base", url: "postgresql:" },
  ];

  it.each(CASOS_INVALIDOS)(
    "recusa sem repetir o valor informado: $rotulo",
    async (caso) => {
      const { codigo, saida } = await executarEntrada({
        ...ambienteSemUrl(),
        DB_URL: caso.url,
      });

      expect(codigo).toBe(1);
      expect(saida).toContain(URL_INVALIDA);

      /** Nem o valor, nem um pedaço dele — senha, usuário, host ou caminho. */
      expect(saida).not.toContain(SENHA_GERADA);
      expect(saida).not.toContain("exemplo.invalid");
      expect(saida).not.toMatch(/:\/\//);
      expect(saida).not.toContain("Armazenamento:");
    },
    PRAZO_DA_ENTRADA,
  );
});

describe("a cifra obrigatória não é rebaixável (T907, SC-047)", () => {
  it.each(["disable", "allow", "prefer"])(
    "recusa antes de conectar a URL que pede cifra rebaixada: sslmode=%s",
    async (sslmode) => {
      const { codigo, saida } = await executarEntrada({
        ...ambienteSemUrl(),
        DB_URL: urlDaBase("cifra", sslmode),
      });

      expect(codigo).toBe(1);
      expect(saida).toContain(CIFRA_REBAIXADA);
      expect(saida).not.toContain(servidor.configuracao.senha);
      expect(saida).not.toContain("Armazenamento:");
    },
    PRAZO_DA_ENTRADA,
  );

  it.each(["require", "verify-ca", "verify-full"])(
    "aceita e verifica por inteiro a URL com sslmode=%s",
    async (sslmode) => {
      const baseInexistente = `base_inexistente_${randomBytes(3).toString("hex")}`;
      const { porta } = servidor.configuracao;

      /** Base que não existe: a URL é aceita e a falha é a de acesso. */
      const { codigo, saida } = await executarEntrada({
        ...ambienteSemUrl(),
        DB_CA_CERT: certificado.caminho,
        DB_URL: urlDaBase(baseInexistente, sslmode),
      });

      expect(codigo).toBe(1);
      expect(saida).not.toContain(CIFRA_REBAIXADA);
      expect(saida).toContain(FALHA_NO_ACESSO);
      expect(saida).not.toContain(servidor.configuracao.senha);

      /** Nem o endereço da base, com a credencial embutida, aparece. */
      expect(saida).not.toContain(String(porta));
    },
    PRAZO_DA_ENTRADA,
  );
});

describe("falha do driver reduzida a mensagem genérica (T908, FR-118)", () => {
  it("não reproduz a URL, o usuário, a senha nem o endereço com credencial", async () => {
    const porta = await portaLivre();
    const { host, usuario } = servidor.configuracao;

    const { codigo, saida } = await executarEntrada({
      ...ambienteSemUrl(),
      DB_CA_CERT: certificado.caminho,
      DB_URL:
        `postgresql://${usuario}:${SENHA_GERADA}@${host}:${porta}/` +
        "base_de_teste?sslmode=verify-full",
    });

    expect(codigo).toBe(1);
    expect(saida).toContain(FALHA_NO_ACESSO);
    expect(saida).not.toContain(SENHA_GERADA);
    expect(saida).not.toContain(`${usuario}:`);
    expect(saida).not.toContain("postgresql://");
    expect(saida).not.toContain(host);
    expect(saida).not.toMatch(/econnrefused|message|detail|hint|where/i);
  }, PRAZO_DA_ENTRADA);

  it("traz o SQLSTATE, e nada do valor, quando o servidor recusa a credencial", async () => {
    const nomeDaBase = await criarBaseMigrada("credencial-recusada");
    const { host, porta, usuario } = servidor.configuracao;

    const { codigo, saida } = await executarEntrada({
      ...ambienteSemUrl(),
      DB_CA_CERT: certificado.caminho,
      DB_URL:
        `postgresql://${usuario}:${OUTRA_SENHA_GERADA}@${host}:${porta}/` +
        `${nomeDaBase}?sslmode=verify-full`,
    });

    expect(codigo).toBe(1);
    expect(saida).toContain(FALHA_NO_ACESSO);
    expect(saida).toMatch(/SQLSTATE [0-9A-Z]{5}/);
    expect(saida).not.toContain(OUTRA_SENHA_GERADA);
    expect(saida).not.toContain(servidor.configuracao.senha);
    expect(saida).not.toContain("postgresql://");
  }, PRAZO_DA_ENTRADA);
});

describe("início com a base na versão corrente (T908, T913, SC-045)", () => {
  it("informa apenas o tipo do armazenamento, escuta e não usa o arquivo local", async () => {
    const nomeDaBase = await criarBaseMigrada("inicio");
    const pasta = mkdtempSync(join(pastaTemporaria, "inicio-"));
    const porta = await portaLivre();

    const nuvem = iniciarEntrada(
      {
        ...ambienteSemUrl(),
        PORTA: String(porta),
        DB_CA_CERT: certificado.caminho,
        DB_URL: urlDaBase(nomeDaBase),
      },
      pasta,
    );

    try {
      expect(await nuvem.primeiraLinha).toBe(LINHA_DE_INICIO);

      await aguardarSaude(porta);
    } finally {
      await nuvem.encerrar();
    }

    /** A linha de início é a **única** saída, e nada dela é segredo. */
    expect(nuvem.saida().trim()).toBe(LINHA_DE_INICIO);
    expect(nuvem.saida()).not.toContain(servidor.configuracao.senha);
    expect(nuvem.saida()).not.toContain("postgresql://");
    expect(nuvem.saida()).not.toMatch(/senha|password|secret|token|sslmode/i);

    /** O armazenamento local não é usado: nenhum arquivo do Adapter local. */
    expect(existsSync(join(pasta, "memorizacao.sqlite"))).toBe(false);
  }, PRAZO_DA_ENTRADA);
});

describe("recusa por esquema atrasado (T909, FR-121, SC-048)", () => {
  it("recusa iniciar nomeando as duas versões, sem migrar e sem escutar", async () => {
    const nomeDaBase = await servidor.criarBase("sem-migracao");
    const porta = await portaLivre();
    const corrente = versaoCorrenteConhecida();

    const { codigo, saida } = await executarEntrada({
      ...ambienteSemUrl(),
      PORTA: String(porta),
      DB_CA_CERT: certificado.caminho,
      DB_URL: urlDaBase(nomeDaBase),
    });

    expect(codigo).toBe(1);
    expect(saida).toContain(
      "Início recusado: o esquema da base está na versão 0 e a versão " +
        `corrente é ${corrente}.`,
    );
    expect(saida).toContain("comando de migração");
    expect(saida).not.toContain("Armazenamento:");
    expect(saida).not.toContain(servidor.configuracao.senha);

    await expect(
      fetch(`http://127.0.0.1:${porta}/health`, {
        signal: AbortSignal.timeout(1_000),
      }),
    ).rejects.toThrow();

    /** O início não migra: a base continua exatamente como estava. */
    const tabelas = await servidor.consultar<{ nome: string }>(
      nomeDaBase,
      `SELECT tablename AS nome FROM pg_tables
        WHERE schemaname = 'public' ORDER BY tablename;`,
    );

    expect(tabelas).toEqual([]);
  }, PRAZO_DA_ENTRADA);

  it("sobe quando a base está na versão corrente e não cria tabela alguma", async () => {
    const nomeDaBase = await criarBaseMigrada("corrente");
    const pasta = mkdtempSync(join(pastaTemporaria, "corrente-"));
    const porta = await portaLivre();

    const nuvem = iniciarEntrada(
      {
        ...ambienteSemUrl(),
        PORTA: String(porta),
        DB_CA_CERT: certificado.caminho,
        DB_URL: urlDaBase(nomeDaBase),
      },
      pasta,
    );

    try {
      expect(await nuvem.primeiraLinha).toBe(LINHA_DE_INICIO);

      await aguardarSaude(porta);
    } finally {
      await nuvem.encerrar();
    }

    const tabelas = await servidor.consultar<{ nome: string }>(
      nomeDaBase,
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
  }, PRAZO_DA_ENTRADA);
});

/** Todos os fontes TypeScript de um diretório, recursivamente. */
function fontesTypeScript(diretorio: string): string[] {
  return readdirSync(diretorio, { withFileTypes: true })
    .flatMap((entrada) => {
      const caminho = join(diretorio, entrada.name);

      return entrada.isDirectory() ? fontesTypeScript(caminho) : [caminho];
    })
    .filter((caminho) => caminho.endsWith(".ts"));
}

/** O caminho do fonte, relativo à raiz do backend, sempre com barras normais. */
function relativoAoBackend(caminho: string): string {
  return relative(RAIZ_DO_BACKEND, caminho).split("\\").join("/");
}

/**
 * A verificação negativa de FR-113: a URL de conexão é lida **apenas** pelas
 * duas entradas da nuvem, no início do processo, e o Adapter — como os Modules —
 * recebe configuração pronta e não conhece variável de ambiente alguma.
 *
 * A prova é a leitura dos fontes, e não uma afirmação: nenhum arquivo fora das
 * duas entradas da nuvem nomeia `DB_URL` ou `DB_CA_CERT`, e nada sob
 * `src/armazenamento/` lê `process.env`.
 */
describe("a variável de ambiente da nuvem (T906, FR-113)", () => {
  const FONTES = fontesTypeScript(join(RAIZ_DO_BACKEND, "src"));

  it("varre os fontes do backend", () => {
    const varridos = FONTES.map((caminho) => relativoAoBackend(caminho));

    expect(varridos).toContain("src/entradas/nuvem.ts");
    expect(varridos).toContain("src/entradas/migrar-nuvem.ts");
    expect(varridos).toContain("src/armazenamento/postgresql/conexao.ts");
    expect(varridos.length).toBeGreaterThan(10);
  });

  it("só as entradas da nuvem leem DB_URL e DB_CA_CERT do ambiente", () => {
    const comLeitura = FONTES.filter((caminho) =>
      /process\.env\.(DB_URL|DB_CA_CERT)/.test(readFileSync(caminho, "utf8")),
    )
      .map((caminho) => relativoAoBackend(caminho))
      .sort();

    expect(comLeitura).toEqual([
      "src/entradas/migrar-nuvem.ts",
      "src/entradas/nuvem.ts",
    ]);
  });

  it("nada sob o Adapter lê variável de ambiente", () => {
    const comAmbiente = FONTES.filter(
      (caminho) =>
        relativoAoBackend(caminho).startsWith("src/armazenamento/") &&
        /process\.env/.test(readFileSync(caminho, "utf8")),
    ).map((caminho) => relativoAoBackend(caminho));

    expect(comAmbiente).toEqual([]);
  });
});
