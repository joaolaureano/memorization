import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { once } from "node:events";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

/**
 * T810 — os scripts de inicialização do backend (FR-109, SC-041).
 *
 * A prova é a de quem segue o quickstart a partir de uma cópia limpa do
 * repositório: **um único comando**, `npm run dev`, sem nada construído antes,
 * sem parâmetro e sem configuração prévia, sobe a aplicação com o Adapter do
 * armazenamento local. O script é lido do manifesto — ele é a raiz de composição
 * local e não depende de `dist/` — e depois **executado** de verdade, com o
 * arquivo local num caminho temporário: a aplicação escuta, responde no
 * `/health` e grava no arquivo informado por `CAMINHO_DO_BANCO` (FR-103).
 *
 * O `npm` intermediário não repassa sinais ao `node --watch`: o processo sobe num
 * grupo próprio e o encerramento é do grupo inteiro.
 */

const RAIZ_DO_BACKEND = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const RAIZ_DE_COMPOSICAO_LOCAL = join(
  RAIZ_DO_BACKEND,
  "src",
  "entradas",
  "local.ts",
);

/** O manifesto de scripts do backend, como ele está versionado. */
const SCRIPTS: Record<string, string> = (
  JSON.parse(
    readFileSync(join(RAIZ_DO_BACKEND, "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> }
).scripts ?? {};

/** A única linha de início do processo local. */
const LINHA_DE_INICIO = "Armazenamento: SQLite (arquivo local)";

/** O segredo das Senhas gerado nesta execução: sem ele a API recusa iniciar. */
const SEGREDO_DA_EXECUCAO = randomBytes(48).toString("base64url");

const DIRETORIO_TEMPORARIO = mkdtempSync(join(tmpdir(), "scripts-locais-"));

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

  throw new Error("a aplicação não respondeu no /health em 30000ms");
}

interface AplicacaoPeloScript {
  saida: () => string;
  aguardarSaude: (porta: number) => Promise<void>;
  encerrar: () => Promise<void>;
}

/** O ambiente de uma execução: porta e arquivo temporários, e o segredo. */
function ambienteDaExecucao(
  caminhoDoBanco: string,
  porta: number,
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PORTA: String(porta),
    CAMINHO_DO_BANCO: caminhoDoBanco,
    SEGREDO_DAS_SENHAS: SEGREDO_DA_EXECUCAO,
  };
}

/** Encerra o grupo de processos do script, `node --watch` incluído. */
async function encerrarGrupo(processo: ChildProcess): Promise<void> {
  const grupo = processo.pid;

  if (grupo === undefined) {
    return;
  }

  const saiu = once(processo, "exit").then(() => undefined);

  try {
    process.kill(-grupo, "SIGTERM");
  } catch {
    // Já encerrado: nada a fazer.
  }

  await Promise.race([saiu, new Promise<void>((r) => setTimeout(r, 3_000))]);

  try {
    process.kill(-grupo, "SIGKILL");
  } catch {
    // Já encerrado: nada a fazer.
  }

  await Promise.race([saiu, new Promise<void>((r) => setTimeout(r, 3_000))]);
  processo.stdout?.destroy();
  processo.stderr?.destroy();
}

/** Sobe a aplicação pelo script informado, como quem o digita no terminal. */
function subirPeloScript(
  script: string,
  ambiente: NodeJS.ProcessEnv,
): AplicacaoPeloScript {
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
    aguardarSaude: (porta: number) => aguardarSaude(porta),
    encerrar: () => encerrarGrupo(processo),
  };
}

describe("scripts de inicialização do backend", () => {
  it("dev sobe a raiz de composição local sem nada construído: um único comando (FR-109, SC-041)", () => {
    expect(SCRIPTS.dev).toBe("node --watch src/entradas/local.ts");

    /** Nada construído antes: o comando do `dev` não passa por `dist/`. */
    expect(SCRIPTS.dev).not.toMatch(/dist/);
    expect(existsSync(RAIZ_DE_COMPOSICAO_LOCAL)).toBe(true);
  });

  it("o caminho empacotado tem um comando para cada passo: build:local e start:local (FR-109, SC-041)", () => {
    expect(SCRIPTS["build:local"]).toBe(
      "node scripts/construir.mjs --banco=sqlite",
    );
    expect(SCRIPTS["start:local"]).toBe("node dist/sqlite/servidor.mjs");

    /** O pacote da função e o zip têm o seu próprio comando (FR-130). */
    expect(SCRIPTS["build:lambda"]).toBe(
      "node scripts/construir.mjs --banco=lambda",
    );

    /** Os scripts que existiam antes continuam, com o papel de cada um. */
    expect(SCRIPTS.typecheck).toBe("tsc --noEmit");
    expect(SCRIPTS.build).toBe("node scripts/construir.mjs");
    expect(SCRIPTS.lint).toBe("eslint .");
    expect(SCRIPTS.test).toBe("vitest run");
  });
});

describe("npm run dev — a execução local por um único comando", () => {
  it("sobe com o Adapter do armazenamento local, escuta e grava no arquivo informado (FR-109, SC-041)", async () => {
    const porta = await portaLivre();
    const caminhoDoBanco = join(DIRETORIO_TEMPORARIO, "pelo-dev.sqlite");
    const aplicacao = subirPeloScript(
      "dev",
      ambienteDaExecucao(caminhoDoBanco, porta),
    );

    try {
      await aplicacao.aguardarSaude(porta);

      /** A linha de início é a do armazenamento local, e só ela (FR-108). */
      expect(aplicacao.saida()).toContain(LINHA_DE_INICIO);
      expect(aplicacao.saida()).not.toMatch(/postgres|SQLSTATE/i);

      /** O caminho informado por `CAMINHO_DO_BANCO` é o arquivo usado. */
      expect(existsSync(caminhoDoBanco)).toBe(true);
    } finally {
      await aplicacao.encerrar();
    }
  }, 60_000);
});
