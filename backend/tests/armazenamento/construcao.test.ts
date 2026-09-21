import {
  spawn,
  spawnSync,
  type ChildProcess,
  type SpawnSyncReturns,
} from "node:child_process";
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

/**
 * T811 — as recusas da construção, o conteúdo do pacote e a linha de início são
 * comprovados **executando** `scripts/construir.mjs` e lendo o código de saída,
 * a saída capturada e o conteúdo de `dist/`, e não inspecionando o script
 * (FR-102, FR-108, FR-120, SC-040, SC-042).
 *
 * A prova é do processo real: a recusa não produz artefato algum, o pacote do
 * armazenamento local não carrega o Adapter do outro armazenamento nem o driver
 * dele, e a primeira linha do início nomeia o tipo de armazenamento sem
 * caminho de arquivo, URL, senha ou cadeia de conexão.
 */

const RAIZ_DO_BACKEND = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const SCRIPT = join(RAIZ_DO_BACKEND, "scripts", "construir.mjs");
const DIRETORIO_DE_SAIDA = join(RAIZ_DO_BACKEND, "dist");
const PACOTE_LOCAL = join(DIRETORIO_DE_SAIDA, "sqlite", "servidor.mjs");

/** A forma da mensagem de recusa, com os valores aceitos derivados da tabela. */
const CONSTRUCAO_RECUSADA =
  "Construção recusada. Informe --banco=<valor>, com um dos valores aceitos: sqlite.";

/** A única linha de início do pacote local. */
const LINHA_DE_INICIO = "Armazenamento: SQLite (arquivo local)";

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
    rotulo: "valor de armazenamento ainda não entregue",
    argumentos: ["--banco=postgresql"],
    valorInformado: "postgresql",
  },
  {
    rotulo: "valor com aparência de credencial",
    argumentos: [VALOR_COM_APARENCIA_DE_CREDENCIAL],
    valorInformado: "senha",
  },
];

/** Executa o script de construção com os argumentos informados. */
function construir(argumentos: string[]): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [SCRIPT, ...argumentos], {
    cwd: RAIZ_DO_BACKEND,
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

      expect(saida).not.toContain("postgresql");
      expect(existsSync(DIRETORIO_DE_SAIDA)).toBe(false);
    },
  );

  it("não repete o valor informado nem nada dele na recusa", () => {
    const resultado = construir([VALOR_COM_APARENCIA_DE_CREDENCIAL]);
    const saida = saidaDe(resultado);

    expect(resultado.status).toBe(1);
    expect(saida).toContain("sqlite");
    expect(saida).not.toContain("postgres");
    expect(saida).not.toContain("senha");
    expect(saida).not.toContain("exemplo.invalid");
    expect(saida).not.toContain("://");
    expect(existsSync(DIRETORIO_DE_SAIDA)).toBe(false);
  });

  it("recusa também quando o valor nomeia um armazenamento que esta feature não entrega", () => {
    const resultado = construir(["--banco=postgresql"]);

    expect(resultado.status).toBe(1);
    expect(saidaDe(resultado)).toContain(CONSTRUCAO_RECUSADA);
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

  it("conclui nomeando o armazenamento e produz um único arquivo", () => {
    expect(resultado.status).toBe(0);
    expect(saidaDe(resultado)).toContain("sqlite");
    expect(readdirSync(DIRETORIO_DE_SAIDA)).toEqual(["sqlite"]);
    expect(readdirSync(join(DIRETORIO_DE_SAIDA, "sqlite"))).toEqual([
      "servidor.mjs",
    ]);
  });

  it("carrega a entrada local do armazenamento escolhido", () => {
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
});

interface PacoteEmExecucao {
  primeiraLinha: Promise<string>;
  saida: () => string;
  encerrar: () => Promise<void>;
}

/**
 * Inicia o pacote construído como processo filho, no diretório de trabalho
 * informado — é de lá que sai o caminho padrão do arquivo local — e devolve a
 * primeira linha impressa, a saída capturada e o encerramento.
 */
function iniciarPacoteLocal(
  diretorio: string,
  ambiente: NodeJS.ProcessEnv,
): PacoteEmExecucao {
  const processo = spawn(process.execPath, [PACOTE_LOCAL], {
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

  it("usa o caminho padrão memorizacao.sqlite quando nada é informado", async () => {
    const pasta = mkdtempSync(join(PASTA_TEMPORARIA, "padrao-"));
    const porta = await portaLivre();
    const ambiente: NodeJS.ProcessEnv = { ...process.env, PORTA: String(porta) };

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
