import {
  spawn,
  spawnSync,
  type ChildProcess,
  type SpawnSyncReturns,
} from "node:child_process";
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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  criarBaseMigrada,
  descartarBasesDeTeste,
  gravarCertificadoDaAutoridade,
  type CertificadoDaAutoridade,
} from "./postgresql/base-de-teste.ts";
import {
  servidorDeTeste,
  type ServidorAutonomo,
} from "./postgresql/servidor-de-teste.ts";

/**
 * T811 e T912 — as recusas da construção, o conteúdo de cada pacote e as linhas
 * de início são comprovados **executando** `scripts/construir.mjs` e lendo o
 * código de saída, a saída capturada e o conteúdo de `dist/`, e não
 * inspecionando o script (FR-102, FR-108, FR-117, FR-120, SC-040, SC-042,
 * SC-050).
 *
 * A prova é do processo real: a recusa não produz artefato algum, cada pacote
 * carrega **um** armazenamento — o local não contém `pg` nem o Adapter da
 * nuvem, os da nuvem não contêm `node:sqlite` nem o Adapter local —, e a
 * primeira linha de cada início nomeia o tipo de armazenamento sem caminho de
 * arquivo, URL, senha ou cadeia de conexão. O pacote local é ainda iniciado pelo
 * script `start:local`, por um único comando (FR-101, FR-109, SC-041).
 */

const RAIZ_DO_BACKEND = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const SCRIPT = join(RAIZ_DO_BACKEND, "scripts", "construir.mjs");
const DIRETORIO_DE_SAIDA = join(RAIZ_DO_BACKEND, "dist");
const PACOTE_LOCAL = join(DIRETORIO_DE_SAIDA, "sqlite", "servidor.mjs");
const PACOTE_DA_NUVEM = join(DIRETORIO_DE_SAIDA, "postgresql", "servidor.mjs");
const COMANDO_DE_MIGRACAO = join(
  DIRETORIO_DE_SAIDA,
  "postgresql",
  "migrar.mjs",
);

/** O pacote e o zip da função, cujo alvo é o terceiro valor aceito (FR-130). */
const DIRETORIO_DA_FUNCAO = join(DIRETORIO_DE_SAIDA, "lambda");
const PACOTE_DA_FUNCAO = join(DIRETORIO_DA_FUNCAO, "lambda.mjs");
const ZIP_DA_FUNCAO = join(RAIZ_DO_BACKEND, "dist-lambda.zip");

/** A forma da mensagem de recusa, com os valores aceitos derivados da tabela. */
const CONSTRUCAO_RECUSADA =
  "Construção recusada. Informe --banco=<valor>, com um dos valores aceitos: " +
  "sqlite, postgresql, lambda.";

/** A forma da mensagem de falha do empacotamento e do zip. */
const FALHA_AO_EMPACOTAR =
  "Falha ao empacotar o armazenamento escolhido. Nenhum artefato foi produzido.";

/** A única linha de início do pacote local. */
const LINHA_DE_INICIO = "Armazenamento: SQLite (arquivo local)";

/** A única linha de início do pacote da nuvem. */
const LINHA_DE_INICIO_DA_NUVEM = "Armazenamento: PostgreSQL (nuvem)";

/** Valor fictício, com aparência de credencial: nunca real, nunca repetido. */
const VALOR_COM_APARENCIA_DE_CREDENCIAL =
  "--banco=postgres://usuario:senha@exemplo.invalid/base";

interface CasoDeRecusa {
  rotulo: string;
  argumentos: string[];
  /** Trecho que a recusa não pode repetir — ausente quando nada foi informado. */
  valorInformado?: string;
}

const CASOS_DE_RECUSA: CasoDeRecusa[] = [
  { rotulo: "parâmetro ausente", argumentos: [] },
  { rotulo: "forma sem valor", argumentos: ["--banco"] },
  { rotulo: "forma separada por espaço", argumentos: ["--banco", "sqlite"] },
  { rotulo: "valor vazio", argumentos: ["--banco="] },
  {
    rotulo: "valor não aceito",
    argumentos: ["--banco=mysql"],
    valorInformado: "mysql",
  },
  {
    rotulo: "valor parecido com um aceito, mas não aceito",
    argumentos: ["--banco=postgres"],
  },
  {
    rotulo: "valor de armazenamento em outra caixa",
    argumentos: ["--banco=SQLITE"],
    valorInformado: "SQLITE",
  },
  {
    rotulo: "valor com aparência de credencial",
    argumentos: [VALOR_COM_APARENCIA_DE_CREDENCIAL],
    valorInformado: "senha",
  },
];

/** O ambiente sem `DB_URL` nem `DB_CA_CERT`: a construção não exige segredo. */
function ambienteSemSegredo(): NodeJS.ProcessEnv {
  const ambiente = { ...process.env };

  delete ambiente.DB_URL;
  delete ambiente.DB_CA_CERT;

  return ambiente;
}

/** O segredo gerado nesta execução: a API recusa iniciar sem ele (FR-077). */
const SEGREDO_DA_EXECUCAO = randomBytes(48).toString("base64url");

/**
 * O ambiente de execução dos pacotes: o mesmo da construção, acrescido do
 * segredo das Senhas gerado nesta execução. O que executa precisa dele; o que
 * só constrói, e o comando de migração, não.
 */
function ambienteDeExecucao(): NodeJS.ProcessEnv {
  return { ...ambienteSemSegredo(), SEGREDO_DAS_SENHAS: SEGREDO_DA_EXECUCAO };
}

/** Executa o script de construção com os argumentos e o ambiente informados. */
function construir(
  argumentos: string[],
  ambiente: NodeJS.ProcessEnv = process.env,
): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [SCRIPT, ...argumentos], {
    cwd: RAIZ_DO_BACKEND,
    env: ambiente,
    encoding: "utf8",
    timeout: 120_000,
  });
}

function saidaDe(resultado: SpawnSyncReturns<string>): string {
  return `${resultado.stdout}${resultado.stderr}`;
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

  throw new Error("a API do pacote local não respondeu em 30000ms");
}

/** Encerra o processo do pacote e aguarda a saída efetiva. */
async function encerrar(processo: ChildProcess): Promise<void> {
  if (processo.exitCode !== null || processo.signalCode !== null) {
    return;
  }

  const saiu = new Promise<void>((resolver) => {
    processo.once("exit", () => resolver());
  });

  processo.kill("SIGTERM");

  await Promise.race([saiu, new Promise<void>((r) => setTimeout(r, 5_000))]);
}

interface ScriptEmExecucao {
  saida: () => string;
  encerrar: () => Promise<void>;
}

/**
 * Encerra o grupo de processos do `npm`: o `npm` intermediário não repassa
 * sinais ao filho, e é o grupo inteiro que é encerrado.
 */
async function encerrarGrupo(processo: ChildProcess): Promise<void> {
  const grupo = processo.pid;

  if (grupo === undefined) {
    return;
  }

  const saiu = new Promise<void>((resolver) => {
    if (processo.exitCode !== null || processo.signalCode !== null) {
      resolver();
      return;
    }

    processo.once("exit", () => resolver());
  });

  for (const sinal of ["SIGTERM", "SIGKILL"] as const) {
    try {
      process.kill(-grupo, sinal);
    } catch {
      // Já encerrado: nada a encerrar.
    }

    await Promise.race([saiu, new Promise<void>((r) => setTimeout(r, 3_000))]);
  }

  processo.stdout?.destroy();
  processo.stderr?.destroy();
}

/** Sobe a aplicação por um script de `npm`, como quem o digita no terminal. */
function iniciarPeloScriptDeNpm(
  script: string,
  ambiente: NodeJS.ProcessEnv,
): ScriptEmExecucao {
  const processo = spawn("npm", ["run", script], {
    cwd: RAIZ_DO_BACKEND,
    env: ambiente,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const capturado: string[] = [];

  processo.stdout?.setEncoding("utf8");
  processo.stdout?.on("data", (pedaco: string) => capturado.push(pedaco));
  processo.stderr?.setEncoding("utf8");
  processo.stderr?.on("data", (pedaco: string) => capturado.push(pedaco));

  return {
    saida: () => capturado.join(""),
    encerrar: () => encerrarGrupo(processo),
  };
}

describe("recusa da construção", () => {
  beforeEach(() => {
    rmSync(DIRETORIO_DE_SAIDA, { recursive: true, force: true });
  });

  it.each(CASOS_DE_RECUSA)(
    "recusa com código 1, mensagem em português e nenhum artefato: $rotulo",
    (caso) => {
      const resultado = construir(caso.argumentos);
      const saida = saidaDe(resultado);

      expect(resultado.status).toBe(1);
      expect(saida).toContain(CONSTRUCAO_RECUSADA);

      if (caso.valorInformado !== undefined) {
        expect(saida).not.toContain(caso.valorInformado);
      }

      expect(existsSync(DIRETORIO_DE_SAIDA)).toBe(false);
    },
  );

  it("não repete o valor informado nem nada dele na recusa", () => {
    const resultado = construir([VALOR_COM_APARENCIA_DE_CREDENCIAL]);
    const saida = saidaDe(resultado);

    expect(resultado.status).toBe(1);
    expect(saida).toContain("sqlite");
    expect(saida).toContain("postgresql");
    expect(saida).not.toContain("postgres://");
    expect(saida).not.toContain("usuario");
    expect(saida).not.toContain("senha");
    expect(saida).not.toContain("exemplo.invalid");
    expect(saida).not.toContain("://");
    expect(existsSync(DIRETORIO_DE_SAIDA)).toBe(false);
  });
});

describe("pacote do armazenamento local", () => {
  let resultado: SpawnSyncReturns<string>;
  let pacote: string;

  beforeAll(() => {
    rmSync(DIRETORIO_DE_SAIDA, { recursive: true, force: true });
    resultado = construir(["--banco=sqlite"]);
    pacote = existsSync(PACOTE_LOCAL) ? readFileSync(PACOTE_LOCAL, "utf8") : "";
  });

  it("conclui nomeando o armazenamento e produz um único arquivo (FR-101)", () => {
    expect(resultado.status).toBe(0);
    expect(saidaDe(resultado)).toContain("sqlite");
    expect(readdirSync(DIRETORIO_DE_SAIDA)).toEqual(["sqlite"]);
    expect(readdirSync(join(DIRETORIO_DE_SAIDA, "sqlite"))).toEqual([
      "servidor.mjs",
    ]);
  });

  it("carrega a entrada local do armazenamento escolhido (FR-101)", () => {
    expect(pacote).toContain(LINHA_DE_INICIO);
  });

  it("não contém o Adapter do outro armazenamento nem o driver dele", () => {
    expect(pacote).not.toMatch(/postgres/i);
    expect(pacote).not.toMatch(
      /["'](?:better-sqlite3|sqlite3|pg|pg-[a-z-]+)["']/,
    );

    const adapters = [
      ...new Set(
        [...pacote.matchAll(/armazenamento\/([a-z-]+)\//g)].map(
          (casamento) => casamento[1],
        ),
      ),
    ];

    expect(adapters).toEqual(["sqlite"]);
  });

  it("importa apenas módulos embutidos do Node, com node:sqlite como único driver", () => {
    const especificadores = [
      ...new Set(
        [...pacote.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map(
          (casamento) => casamento[1],
        ),
      ),
    ];

    expect(especificadores.length).toBeGreaterThan(0);
    expect(especificadores.filter((modulo) => !modulo.startsWith("node:"))).toEqual(
      [],
    );
    expect(
      especificadores.filter((modulo) => /sqlite/i.test(modulo)),
    ).toEqual(["node:sqlite"]);
  });

  it("npm run start:local sobe esse pacote por um único comando (FR-101, FR-109, SC-041)", async () => {
    const pasta = mkdtempSync(join(tmpdir(), "start-local-"));
    const porta = await portaLivre();
    const caminhoDoBanco = join(pasta, "memorizacao.sqlite");
    const script = iniciarPeloScriptDeNpm("start:local", {
      ...ambienteDeExecucao(),
      PORTA: String(porta),
      CAMINHO_DO_BANCO: caminhoDoBanco,
    });

    try {
      await aguardarSaude(porta);

      /** A linha de início é a do armazenamento local, e só ela (FR-108). */
      expect(script.saida()).toContain(LINHA_DE_INICIO);
      expect(script.saida()).not.toMatch(/postgres|SQLSTATE/i);

      /** O caminho informado por `CAMINHO_DO_BANCO` é o arquivo usado. */
      expect(existsSync(caminhoDoBanco)).toBe(true);
    } finally {
      await script.encerrar();
      rmSync(pasta, { recursive: true, force: true });
    }
  }, 60_000);
});

interface PacoteEmExecucao {
  primeiraLinha: Promise<string>;
  saida: () => string;
  encerrar: () => Promise<void>;
}

/**
 * Inicia um pacote construído como processo filho, no diretório de trabalho e
 * com o ambiente informados — é do diretório de trabalho que sai o caminho
 * padrão do arquivo local — e devolve a primeira linha impressa, a saída
 * capturada e o encerramento.
 */
function iniciarPacote(
  arquivo: string,
  diretorio: string,
  ambiente: NodeJS.ProcessEnv,
): PacoteEmExecucao {
  const processo = spawn(process.execPath, [arquivo], {
    cwd: diretorio,
    env: ambiente,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const capturado: string[] = [];
  const primeiraLinha = new Promise<string>((resolver, recusar) => {
    const tempoLimite = setTimeout(() => {
      recusar(new Error("o pacote não imprimiu a linha de início"));
    }, 30_000);
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
      recusar(new Error(`o pacote encerrou com código ${String(codigo)}`));
    });
  });

  return {
    primeiraLinha,
    saida: () => capturado.join(""),
    encerrar: () => encerrar(processo),
  };
}

/** Inicia o pacote do armazenamento local, o mesmo que `start:local` inicia. */
function iniciarPacoteLocal(
  diretorio: string,
  ambiente: NodeJS.ProcessEnv,
): PacoteEmExecucao {
  return iniciarPacote(PACOTE_LOCAL, diretorio, ambiente);
}

describe("linha de início do pacote local", () => {
  const PASTA_TEMPORARIA = mkdtempSync(join(tmpdir(), "pacote-local-"));

  afterAll(() => {
    rmSync(PASTA_TEMPORARIA, { recursive: true, force: true });
  });

  it("imprime uma única linha com o tipo do armazenamento, sem caminho, URL ou segredo", async () => {
    expect(existsSync(PACOTE_LOCAL)).toBe(true);

    const porta = await portaLivre();
    const caminhoDoBanco = join(PASTA_TEMPORARIA, "memorizacao-informada.sqlite");
    const pacote = iniciarPacoteLocal(RAIZ_DO_BACKEND, {
      ...process.env,
      PORTA: String(porta),
      CAMINHO_DO_BANCO: caminhoDoBanco,
      SEGREDO_DAS_SENHAS: SEGREDO_DA_EXECUCAO,
    });

    try {
      expect(await pacote.primeiraLinha).toBe(LINHA_DE_INICIO);

      await aguardarSaude(porta);

      /** O arquivo informado por `CAMINHO_DO_BANCO` é o que a aplicação usa. */
      expect(existsSync(caminhoDoBanco)).toBe(true);
    } finally {
      await pacote.encerrar();
    }

    const saida = pacote.saida();

    expect(saida).not.toContain(caminhoDoBanco);
    expect(saida).not.toContain(PASTA_TEMPORARIA);
    expect(saida).not.toMatch(/https?:\/\/|senha|password|secret|token/i);
  });

  it("usa o caminho padrão memorizacao.sqlite quando nada é informado (FR-103)", async () => {
    const pasta = mkdtempSync(join(PASTA_TEMPORARIA, "padrao-"));
    const porta = await portaLivre();
    const ambiente: NodeJS.ProcessEnv = {
      ...process.env,
      PORTA: String(porta),
      SEGREDO_DAS_SENHAS: SEGREDO_DA_EXECUCAO,
    };

    delete ambiente.CAMINHO_DO_BANCO;

    const pacote = iniciarPacoteLocal(pasta, ambiente);

    try {
      expect(await pacote.primeiraLinha).toBe(LINHA_DE_INICIO);

      await aguardarSaude(porta);

      expect(existsSync(join(pasta, "memorizacao.sqlite"))).toBe(true);
    } finally {
      await pacote.encerrar();
    }
  });
});

/**
 * T911, T912 e T913 — cada armazenamento tem o **seu** pacote, escolhido na
 * construção, e cada início usa apenas o armazenamento do seu pacote: o pacote
 * local não contém `pg` nem o Adapter da nuvem; os da nuvem não contêm
 * `node:sqlite` nem o Adapter local; o início local nunca abre conexão a
 * PostgreSQL; e o início da nuvem nunca usa o arquivo local (FR-114, FR-117,
 * SC-050).
 *
 * A exclusividade é **medida**, e não afirmada: os artefatos são construídos e
 * inspecionados, e os dois inícios são executados contra o PostgreSQL real do
 * apoio de teste — o da nuvem, para subir de verdade; o local, para subir com o
 * armazenamento local mesmo com `DB_URL` válida no ambiente e sem que uma única
 * conexão à base seja aberta.
 */
describe("pacotes e inícios de cada armazenamento", () => {
  const PASTA_TEMPORARIA = mkdtempSync(join(tmpdir(), "pacotes-"));

  let resultadoLocal: SpawnSyncReturns<string>;
  let resultadoDaNuvem: SpawnSyncReturns<string>;
  let pacoteLocal: string;
  let pacoteDaNuvem: string;
  let comandoDeMigracao: string;
  let servidor: ServidorAutonomo;
  let certificado: CertificadoDaAutoridade;

  beforeAll(async () => {
    rmSync(DIRETORIO_DE_SAIDA, { recursive: true, force: true });
    resultadoLocal = construir(["--banco=sqlite"], ambienteSemSegredo());
    resultadoDaNuvem = construir(["--banco=postgresql"], ambienteSemSegredo());
    pacoteLocal = readFileSync(PACOTE_LOCAL, "utf8");
    pacoteDaNuvem = readFileSync(PACOTE_DA_NUVEM, "utf8");
    comandoDeMigracao = readFileSync(COMANDO_DE_MIGRACAO, "utf8");
    servidor = await servidorDeTeste();
    certificado = gravarCertificadoDaAutoridade(servidor);
  }, 120_000);

  afterAll(async () => {
    certificado?.remover();
    rmSync(PASTA_TEMPORARIA, { recursive: true, force: true });
    await descartarBasesDeTeste();
    await (await servidorDeTeste()).encerrar();
  });

  it("constrói os pacotes de cada armazenamento sem DB_URL no ambiente", () => {
    expect(ambienteSemSegredo()).not.toHaveProperty("DB_URL");
    expect(ambienteSemSegredo()).not.toHaveProperty("DB_CA_CERT");

    expect(resultadoLocal.status).toBe(0);
    expect(resultadoDaNuvem.status).toBe(0);

    /** A mensagem de conclusão nomeia o armazenamento e os arquivos. */
    expect(saidaDe(resultadoDaNuvem)).toContain("postgresql");
    expect(saidaDe(resultadoDaNuvem)).toContain("servidor.mjs");
    expect(saidaDe(resultadoDaNuvem)).toContain("migrar.mjs");

    expect(readdirSync(join(DIRETORIO_DE_SAIDA, "postgresql")).sort()).toEqual([
      "migrar.mjs",
      "servidor.mjs",
    ]);
  });

  it("o pacote local não contém pg nem o Adapter do armazenamento da nuvem", () => {
    expect(pacoteLocal).toContain(LINHA_DE_INICIO);
    expect(pacoteLocal).not.toMatch(/postgres/i);
    expect(pacoteLocal).not.toMatch(
      /["'](?:better-sqlite3|sqlite3|pg|pg-[a-z-]+)["']/,
    );

    const adapters = [
      ...new Set(
        [...pacoteLocal.matchAll(/armazenamento\/([a-z-]+)\//g)].map(
          (casamento) => casamento[1],
        ),
      ),
    ];

    expect(adapters).toEqual(["sqlite"]);
  });

  it.each([
    ["servidor", "servidor.mjs"],
    ["comando de migração", "migrar.mjs"],
  ])(
    "o pacote da nuvem não contém node:sqlite nem o Adapter local: %s",
    (rotulo, arquivo) => {
      const pacote =
        arquivo === "servidor.mjs" ? pacoteDaNuvem : comandoDeMigracao;

      expect(pacote, rotulo).not.toMatch(/node:sqlite|armazenamento\/sqlite/);

      const adapters = [
        ...new Set(
          [...pacote.matchAll(/armazenamento\/([a-z-]+)\//g)].map(
            (casamento) => casamento[1],
          ),
        ),
      ];

      expect(adapters, rotulo).toEqual(["postgresql"]);
    },
  );

  it("empacota pg e deixa pg-native fora do pacote, como externo", () => {
    for (const pacote of [pacoteDaNuvem, comandoDeMigracao]) {
      /** É a configuração de cifra sempre verificada que entra no pacote. */
      expect(pacote).toContain("rejectUnauthorized");

      /** Uma única citação: o carregamento preguiçoso que nunca é executado. */
      expect([...pacote.matchAll(/["']pg-native["']/g)]).toHaveLength(1);
      expect(pacote).not.toMatch(/from\s*["']pg-native["']/);
    }

    expect(existsSync(join(RAIZ_DO_BACKEND, "node_modules", "pg-native"))).toBe(
      false,
    );
  });

  it("o comando de migração empacotado leva a base nova à versão corrente", async () => {
    const nomeDaBase = await servidor.criarBase("comando-empacotado");

    const resultado = spawnSync(process.execPath, [COMANDO_DE_MIGRACAO], {
      cwd: RAIZ_DO_BACKEND,
      env: {
        ...ambienteSemSegredo(),
        DB_URL: servidor.urlDaBase(nomeDaBase),
        DB_CA_CERT: certificado.caminho,
      },
      encoding: "utf8",
      timeout: 60_000,
    });

    expect(resultado.status).toBe(0);
    expect(saidaDe(resultado)).toContain("Migração concluída");

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
  }, 60_000);

  it("o início da nuvem sobe contra PostgreSQL e não cria o arquivo local", async () => {
    const nomeDaBase = await criarBaseMigrada("pacote-da-nuvem", servidor);
    const pasta = mkdtempSync(join(PASTA_TEMPORARIA, "nuvem-"));
    const porta = await portaLivre();

    const pacote = iniciarPacote(PACOTE_DA_NUVEM, pasta, {
      ...ambienteDeExecucao(),
      PORTA: String(porta),
      DB_URL: servidor.urlDaBase(nomeDaBase),
      DB_CA_CERT: certificado.caminho,
    });

    try {
      expect(await pacote.primeiraLinha).toBe(LINHA_DE_INICIO_DA_NUVEM);

      await aguardarSaude(porta);

      /**
       * O conteúdo gravado contra a base é servido pelo pacote da nuvem — e
       * toda operação de acervo exige Credencial desde a `008-entrar`: o
       * Cadastro vem primeiro, e o Cartão é criado com o cabeçalho Basic.
       */
      const nomeDeUsuario = "Ana.Silva";
      const senha = randomBytes(12).toString("base64url");

      const cadastro = await fetch(`http://127.0.0.1:${porta}/usuarios`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nomeDeUsuario, senha }),
      });

      expect(cadastro.status).toBe(201);

      const credencial = Buffer.from(
        `${nomeDeUsuario}:${senha}`,
        "utf8",
      ).toString("base64");

      const resposta = await fetch(`http://127.0.0.1:${porta}/cartoes`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Basic ${credencial}`,
        },
        body: JSON.stringify({ frente: "To walk", verso: "Caminhar" }),
      });

      expect(resposta.status).toBe(201);

      /** E o pacote responde quem entrou, pela rota de Entrar (FR-086). */
      const entrou = await fetch(`http://127.0.0.1:${porta}/entrar`, {
        method: "POST",
        headers: { authorization: `Basic ${credencial}` },
      });

      expect(entrou.status).toBe(200);
      expect(await entrou.json()).toMatchObject({ nomeDeUsuario });
    } finally {
      await pacote.encerrar();
    }

    /** A linha de início é a única saída, e nada dela é segredo. */
    expect(pacote.saida().trim()).toBe(LINHA_DE_INICIO_DA_NUVEM);
    expect(pacote.saida()).not.toContain(servidor.configuracao.senha);
    expect(pacote.saida()).not.toContain("postgresql://");

    /** O armazenamento local não é usado: nenhum arquivo do Adapter local. */
    expect(existsSync(join(pasta, "memorizacao.sqlite"))).toBe(false);
  }, 60_000);

  it("o início local usa o armazenamento local mesmo com DB_URL no ambiente (FR-103)", async () => {
    const nomeDaBase = await criarBaseMigrada("local-nao-usa-pg", servidor);
    const pasta = mkdtempSync(join(PASTA_TEMPORARIA, "local-"));
    const porta = await portaLivre();
    const caminhoDoBanco = join(pasta, "memorizacao.sqlite");

    const pacote = iniciarPacoteLocal(pasta, {
      ...ambienteDeExecucao(),
      PORTA: String(porta),
      CAMINHO_DO_BANCO: caminhoDoBanco,
      /** Uma URL de conexão válida, que o caminho local **não** usa. */
      DB_URL: servidor.urlDaBase(nomeDaBase),
      DB_CA_CERT: certificado.caminho,
    });

    try {
      expect(await pacote.primeiraLinha).toBe(LINHA_DE_INICIO);

      await aguardarSaude(porta);

      expect(existsSync(caminhoDoBanco)).toBe(true);
    } finally {
      await pacote.encerrar();
    }

    expect(pacote.saida().trim()).toBe(LINHA_DE_INICIO);
    expect(pacote.saida()).not.toMatch(/postgres|SQLSTATE/i);

    /** Nenhuma conexão à base foi tentada pelo caminho local. */
    const conexoes = await servidor.consultar<{ quantidade: string }>(
      "postgres",
      `SELECT COUNT(*) AS quantidade FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid();`,
      [nomeDaBase],
    );

    expect(conexoes.map((linha) => Number(linha.quantidade))).toEqual([0]);
  }, 60_000);
});

/**
 * T1006 e T1007 — o alvo da função, o zip no caminho que a infraestrutura
 * espera e o conteúdo de cada pacote (FR-120, FR-130, SC-057).
 *
 * A prova é do processo e do artefato, e não da intenção do empacotador:
 * `--banco=lambda` produz o pacote e o zip **sem** segredo algum no ambiente, o
 * zip tem `lambda.mjs` na **raiz** — o `handler` publicado é `lambda.handler`,
 * que nomeia o arquivo —, o pacote da função não carrega o Adapter do
 * armazenamento local, o `node:sqlite` nem o SDK da AWS — que é **externo**,
 * porque o runtime `nodejs24.x` o fornece —, e o pacote local não carrega a
 * entrada da função. O pacote da função é ainda iniciado por `node` e termina
 * sozinho: ele não escuta porto algum.
 *
 * Uma falha do `zip` remove o diretório do alvo **e** o zip: nenhum artefato
 * parcial fica de pé.
 */
describe("pacote da função", () => {
  let resultadoDaFuncao: SpawnSyncReturns<string>;
  let pacoteDaFuncao: string;
  let pacoteLocal: string;

  beforeAll(() => {
    rmSync(DIRETORIO_DE_SAIDA, { recursive: true, force: true });
    rmSync(ZIP_DA_FUNCAO, { force: true });
    resultadoDaFuncao = construir(["--banco=lambda"], ambienteSemSegredo());
    construir(["--banco=sqlite"], ambienteSemSegredo());
    pacoteDaFuncao = readFileSync(PACOTE_DA_FUNCAO, "utf8");
    pacoteLocal = readFileSync(PACOTE_LOCAL, "utf8");
  }, 120_000);

  it("produz o pacote e o zip sem segredo algum no ambiente, nomeando o alvo (FR-130)", () => {
    const ambiente = ambienteSemSegredo();

    expect(ambiente).not.toHaveProperty("DB_URL");
    expect(ambiente).not.toHaveProperty("DB_CA_CERT");
    expect(ambiente).not.toHaveProperty("SEGREDO_DAS_SENHAS");

    expect(resultadoDaFuncao.status).toBe(0);

    /** A mensagem de conclusão nomeia o alvo e os dois artefatos. */
    const saida = saidaDe(resultadoDaFuncao);

    expect(saida).toContain("lambda");
    expect(saida).toContain("dist/lambda/lambda.mjs");
    expect(saida).toContain("dist-lambda.zip");

    expect(readdirSync(DIRETORIO_DA_FUNCAO)).toEqual(["lambda.mjs"]);
    expect(existsSync(ZIP_DA_FUNCAO)).toBe(true);
  });

  it("o zip tem lambda.mjs na raiz, como o handler lambda.handler exige", () => {
    const listagem = spawnSync("unzip", ["-Z1", ZIP_DA_FUNCAO], {
      encoding: "utf8",
    });

    expect(listagem.status).toBe(0);

    const nomes = listagem.stdout
      .split("\n")
      .map((linha) => linha.trim())
      .filter((linha) => linha !== "");

    expect(nomes).toEqual(["lambda.mjs"]);
  });

  it("não contém o Adapter do armazenamento local nem node:sqlite (FR-130)", () => {
    expect(pacoteDaFuncao).not.toMatch(/node:sqlite|armazenamento\/sqlite/);

    /** O único armazenamento no grafo do pacote é o da nuvem. */
    const adapters = [
      ...new Set(
        [...pacoteDaFuncao.matchAll(/armazenamento\/([a-z-]+)\//g)].map(
          (casamento) => casamento[1],
        ),
      ),
    ];

    expect(adapters).toEqual(["postgresql"]);

    /** E a linha de início da execução local não existe no pacote da função. */
    expect(pacoteDaFuncao).not.toContain(LINHA_DE_INICIO);
  });

  it("deixa o SDK da AWS e o pg-native fora do pacote, como externos (FR-130)", () => {
    /**
     * O SDK vem no runtime: ele aparece **uma** vez, como especificador
     * importado, e nenhuma linha da implementação dele é empacotada.
     */
    expect(
      [...pacoteDaFuncao.matchAll(/["']@aws-sdk\/[^"']+["']/g)].map(
        ([ocorrencia]) => ocorrencia,
      ),
    ).toEqual(['"@aws-sdk/client-ssm"']);
    expect(pacoteDaFuncao).not.toMatch(/@smithy|@aws-crypto/);

    /** O `pg-native` é a opcional do `pg`: nunca é uma dependência a resolver. */
    expect([...pacoteDaFuncao.matchAll(/["']pg-native["']/g)]).toHaveLength(1);
    expect(pacoteDaFuncao).not.toMatch(/from\s*["']pg-native["']/);
  });

  it("roda sob node, sem exigir segredo e sem escutar porto algum (FR-122)", () => {
    const execucao = spawnSync(process.execPath, [PACOTE_DA_FUNCAO], {
      cwd: RAIZ_DO_BACKEND,
      env: ambienteSemSegredo(),
      encoding: "utf8",
      timeout: 60_000,
    });

    /** A função termina sozinha: um processo que escutasse ficaria de pé. */
    expect(execucao.status).toBe(0);
    expect(saidaDe(execucao)).not.toMatch(/listen|escutando|porta/i);
  });

  it("o pacote local não contém a entrada da função (FR-130)", () => {
    expect(pacoteLocal).not.toMatch(/@fastify\/aws-lambda|entradas\/lambda/);
    expect(pacoteLocal).toContain(LINHA_DE_INICIO);
  });

  it("remove o diretório do alvo e o zip quando a zipagem falha", () => {
    rmSync(DIRETORIO_DE_SAIDA, { recursive: true, force: true });
    rmSync(ZIP_DA_FUNCAO, { force: true });

    const semZip = spawnSync(process.execPath, [SCRIPT, "--banco=lambda"], {
      cwd: RAIZ_DO_BACKEND,
      /** Sem o `zip` da máquina no caminho: a construção tem de falhar limpa. */
      env: { ...ambienteSemSegredo(), PATH: "" },
      encoding: "utf8",
      timeout: 120_000,
    });

    expect(semZip.status).toBe(1);
    expect(saidaDe(semZip)).toContain(FALHA_AO_EMPACOTAR);
    expect(saidaDe(semZip)).not.toContain("dist-lambda.zip");

    expect(existsSync(DIRETORIO_DA_FUNCAO)).toBe(false);
    expect(existsSync(ZIP_DA_FUNCAO)).toBe(false);
  }, 120_000);
});
