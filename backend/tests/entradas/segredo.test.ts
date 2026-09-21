import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { VARIAVEL_DO_SEGREDO } from "../../src/identidade/segredo.ts";

/**
 * T602 — sem o segredo do servidor, a aplicação **recusa iniciar**, nomeando a
 * variável e a regra e sem nunca exibir o valor (FR-077, SC-024).
 *
 * As duas entradas que sobem a API são executadas como processos filhos reais,
 * sem a variável no ambiente: é a prova de que a recusa acontece **antes** de
 * qualquer conexão — nenhuma porta é escutada, nenhum arquivo local é aberto —,
 * e de que a mensagem não repete valor algum. O comando de migração da nuvem
 * não entra aqui: ele não sobe a API e não precisa do segredo.
 */

const RAIZ_DO_BACKEND = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const ENTRADA_LOCAL = join(RAIZ_DO_BACKEND, "src", "entradas", "local.ts");
const ENTRADA_DA_NUVEM = join(RAIZ_DO_BACKEND, "src", "entradas", "nuvem.ts");

/** A recusa por falta de segredo nomeia a variável e o comprimento exigido. */
const SEGREDO_AUSENTE = new RegExp(`${VARIAVEL_DO_SEGREDO}.*32|32.*${VARIAVEL_DO_SEGREDO}`);

const DIRETORIO_TEMPORARIO = mkdtempSync(join(tmpdir(), "inicio-segredo-"));

afterAll(() => {
  rmSync(DIRETORIO_TEMPORARIO, { recursive: true, force: true });
});

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

/** O ambiente informado, sem a variável do segredo herdada do processo. */
function ambienteSemSegredo(ambiente: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const semSegredo = { ...ambiente };

  delete semSegredo[VARIAVEL_DO_SEGREDO];

  return semSegredo;
}

/** Executa a entrada informada e espera o processo sair. */
async function executarEntrada(
  entrada: string,
  ambiente: NodeJS.ProcessEnv,
): Promise<ExecucaoDaEntrada> {
  const processo: ChildProcess = spawn(process.execPath, [entrada], {
    cwd: RAIZ_DO_BACKEND,
    env: ambienteSemSegredo(ambiente),
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
      recusar(new Error("a entrada não encerrou em 30000ms"));
    }, 30_000);

    processo.once("exit", (saiu) => {
      clearTimeout(tempoLimite);
      resolver(saiu);
    });
  });

  return { codigo, saida: capturado.join("") };
}

/** Confere que a porta não está sendo escutada por ninguém. */
async function conferirQueNaoEscuta(porta: number): Promise<void> {
  await expect(
    fetch(`http://127.0.0.1:${porta}/health`, {
      signal: AbortSignal.timeout(1_000),
    }),
  ).rejects.toThrow();
}

describe("entrada local sem o segredo do servidor", () => {
  it("recusa iniciar nomeando a variável, sem escutar e sem abrir o arquivo local", async () => {
    const porta = await portaLivre();
    const pasta = join(DIRETORIO_TEMPORARIO, "local-sem-segredo");
    const caminhoDoBanco = join(pasta, "memorizacao.sqlite");

    const { codigo, saida } = await executarEntrada(ENTRADA_LOCAL, {
      PORTA: String(porta),
      CAMINHO_DO_BANCO: caminhoDoBanco,
    });

    expect(codigo).toBe(1);
    expect(saida).toContain(VARIAVEL_DO_SEGREDO);
    expect(saida).toMatch(SEGREDO_AUSENTE);

    /** A recusa é anterior ao armazenamento: nada de linha de início, nada aberto. */
    expect(saida).not.toContain("Armazenamento: SQLite");
    expect(existsSync(pasta)).toBe(false);

    await conferirQueNaoEscuta(porta);
  });
});

describe("entrada da nuvem sem o segredo do servidor", () => {
  it("recusa iniciar nomeando a variável, antes de exigir DB_URL e sem escutar", async () => {
    const porta = await portaLivre();
    const ambiente: NodeJS.ProcessEnv = { ...process.env, PORTA: String(porta) };

    delete ambiente.DB_URL;
    delete ambiente.DB_CA_CERT;

    const { codigo, saida } = await executarEntrada(ENTRADA_DA_NUVEM, ambiente);

    expect(codigo).toBe(1);
    expect(saida).toContain(VARIAVEL_DO_SEGREDO);
    expect(saida).toMatch(SEGREDO_AUSENTE);

    /** O segredo vem primeiro: a URL nem chega a ser exigida. */
    expect(saida).not.toContain("DB_URL");
    expect(saida).not.toContain("Armazenamento: PostgreSQL");

    await conferirQueNaoEscuta(porta);
  });
});
