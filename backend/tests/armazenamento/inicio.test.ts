import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

/**
 * T813 — com o arquivo local indisponível, o início falha com a falha
 * reportada, a aplicação **não** segue como se o armazenamento existisse e
 * nenhuma operação aparece como concluída (FR-044, FR-045, FR-108, SC-042).
 *
 * A entrada local real é executada como processo filho, apontando o arquivo
 * para um diretório que não existe — a mesma indisponibilidade de um diretório
 * somente leitura, sem depender de permissão. O que a prova exige: falha
 * reportada em português, código de saída 1, processo que **não** escuta, e
 * nenhum caminho, URL, senha ou cadeia de conexão na saída.
 *
 * A prova de que a falha do armazenamento nunca passa por operação concluída
 * nas camadas de domínio e HTTP — a recusa reportada, a mesma requisição
 * repetível com o mesmo conteúdo e a resposta sem texto do driver — está nas
 * suítes `tests/acervo/indisponibilidade.test.ts` e
 * `tests/http/indisponibilidade.test.ts`, sobre o mesmo Adapter real; aqui a
 * prova é a do **início**.
 */

const RAIZ_DO_BACKEND = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const ENTRADA_LOCAL = join(RAIZ_DO_BACKEND, "src", "entradas", "local.ts");

const DIRETORIO_TEMPORARIO = mkdtempSync(
  join(tmpdir(), "inicio-indisponivel-"),
);

/** A frase da falha do início: em português, sem caminho e sem driver. */
const FALHA_NO_INICIO = /falha no armazenamento local/i;

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

/** Executa a entrada local com o ambiente informado e espera o processo sair. */
async function executarEntrada(
  ambiente: Record<string, string>,
): Promise<ExecucaoDaEntrada> {
  const processo: ChildProcess = spawn(process.execPath, [ENTRADA_LOCAL], {
    cwd: RAIZ_DO_BACKEND,
    env: { ...process.env, ...ambiente },
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
      recusar(new Error("a entrada local não encerrou em 30000ms"));
    }, 30_000);

    processo.once("exit", (saiu) => {
      clearTimeout(tempoLimite);
      resolver(saiu);
    });
  });

  return { codigo, saida: capturado.join("") };
}

describe("início com o arquivo local indisponível", () => {
  it("reporta a falha, não escuta e não deixa nada por concluído", async () => {
    const porta = await portaLivre();
    const pastaAusente = join(DIRETORIO_TEMPORARIO, "diretorio-inexistente");
    const caminhoDoBanco = join(pastaAusente, "memorizacao.sqlite");

    const { codigo, saida } = await executarEntrada({
      PORTA: String(porta),
      CAMINHO_DO_BANCO: caminhoDoBanco,
    });

    expect(codigo).toBe(1);
    expect(saida).toMatch(FALHA_NO_INICIO);

    /**
     * A aplicação não segue como se o armazenamento existisse: nada de
     * sensível — o caminho informado, o texto do driver — aparece na saída, e
     * nenhum artefato é criado onde não havia diretório.
     */
    expect(saida).not.toContain(caminhoDoBanco);
    expect(saida).not.toContain(pastaAusente);
    expect(saida).not.toContain(DIRETORIO_TEMPORARIO);
    expect(saida).not.toMatch(
      /https?:\/\/|senha|password|secret|token|unable to open|SQLITE_ERROR|node:sqlite/i,
    );
    expect(saida).not.toContain("Armazenamento: SQLite");
    expect(existsSync(pastaAusente)).toBe(false);

    /** Não escutou: nenhuma operação pode ser apresentada como concluída. */
    await expect(
      fetch(`http://127.0.0.1:${porta}/health`, {
        signal: AbortSignal.timeout(1_000),
      }),
    ).rejects.toThrow();
  });

  it("não deixa a API de pé nem responde a nenhuma operação", async () => {
    const porta = await portaLivre();

    const { codigo } = await executarEntrada({
      PORTA: String(porta),
      CAMINHO_DO_BANCO: join(DIRETORIO_TEMPORARIO, "ausente", "outro.sqlite"),
    });

    expect(codigo).toBe(1);

    const requisicao = fetch(`http://127.0.0.1:${porta}/cartoes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ frente: "To walk", verso: "Caminhar" }),
      signal: AbortSignal.timeout(1_000),
    });

    await expect(requisicao).rejects.toThrow();
  });
});
