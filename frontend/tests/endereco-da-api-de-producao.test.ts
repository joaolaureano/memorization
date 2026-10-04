import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * T1008 — o endereço da API do SPA publicado (FR-129, SC-057).
 *
 * A prova é do artefato construído, e não do código-fonte: a construção de
 * produção (`npm run build:aws`) é **executada** por um script de `npm`, como
 * quem o digita no terminal, e o JavaScript publicado em `dist/` é lido. O
 * endereço da API é o `/api` da **mesma origem** do CloudFront — sem pré-voo de
 * outra origem —, e nenhuma ocorrência do endereço local padrão sobra no
 * pacote. Sem a variável, a construção continua apontando o endereço local: o
 * padrão de quem desenvolve não mudou, e é o script de produção que o troca.
 *
 * Nenhuma tela, componente ou cliente é tocado por esta feature: ela acrescenta
 * um caminho único e nomeado para a construção de produção.
 */

const RAIZ_DO_FRONTEND = process.cwd();
// O pacote de cada construção vai para um diretório temporário próprio desta
// execução, e não para o `dist/` compartilhado: outra construção (um vitest em
// paralelo, o `npm run build` do `verificar:ci`) sobrescreveria ou apagaria o
// `dist/` no meio da prova. Os scripts reais de `npm` continuam executados.

/** O endereço local padrão da API, o de quem roda a aplicação na máquina. */
const ENDERECO_LOCAL_PADRAO = "http://127.0.0.1:3001";

/** O manifesto de scripts do frontend, como ele está versionado. */
const SCRIPTS: Record<string, string> = (
  JSON.parse(
    readFileSync(join(RAIZ_DO_FRONTEND, "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> }
).scripts ?? {};

/** O ambiente de uma construção: sem a variável, o padrão local vale. */
function ambienteSemEnderecoInformado(): Record<string, string | undefined> {
  const ambiente = { ...process.env };

  delete ambiente.VITE_ENDERECO_DA_API;

  return ambiente;
}

/**
 * Os argumentos que entregam o `--outDir` ao `vite build` pelo `npm`:
 *   - `npm run <script> -- <args>` entrega `<args>` ao script;
 *   - em `build` (`tsc --noEmit && vite build`), os argumentos são acrescentados
 *     ao fim do script e, portanto, ao `vite build`;
 *   - em `build:aws` (`VITE_ENDERECO_DA_API=/api npm run build`), o `--` extra é
 *     repassado ao `npm run build` aninhado, que então acrescenta o `--outDir` ao
 *     seu `vite build`.
 * O `--emptyOutDir` autoriza o vite a publicar — e limpar — fora da raiz do
 * projeto, sem aviso.
 */
function argumentosDoDiretorioTemporario(
  script: string,
  diretorio: string,
): string[] {
  const argumentos = ["--outDir", diretorio, "--emptyOutDir"];

  return script === "build:aws" ? ["--", ...argumentos] : argumentos;
}

/**
 * Executa um script de `npm` publicando o pacote em um diretório temporário
 * **próprio desta execução** — nunca no `dist/` compartilhado — e devolve o
 * código de saída, a saída capturada e o diretório onde o pacote foi publicado.
 */
function construirPeloScript(
  script: string,
  ambiente: Record<string, string | undefined>,
): { status: number | null; saida: string; diretorio: string } {
  const diretorio = mkdtempSync(join(tmpdir(), "memorization-build-"));
  const argumentos = [
    "run",
    script,
    "--",
    ...argumentosDoDiretorioTemporario(script, diretorio),
  ];

  const resultado = spawnSync("npm", argumentos, {
    cwd: RAIZ_DO_FRONTEND,
    env: ambiente,
    encoding: "utf8",
    timeout: 300_000,
  });

  return {
    status: resultado.status,
    saida: `${resultado.stdout}${resultado.stderr}`,
    diretorio,
  };
}

/** Todo o JavaScript publicado pelo Vite, concatenado: o pacote é o artefato. */
function javascriptDoPacote(diretorioDoPacote: string): string {
  const diretorioDosAssets = join(diretorioDoPacote, "assets");

  expect(existsSync(diretorioDosAssets)).toBe(true);

  const arquivos = readdirSync(diretorioDosAssets).filter((nome) =>
    nome.endsWith(".js"),
  );

  expect(arquivos.length).toBeGreaterThan(0);

  return arquivos
    .map((nome) => readFileSync(join(diretorioDosAssets, nome), "utf8"))
    .join("\n");
}

describe("o endereço da API do SPA", () => {
  it("build:aws é a construção de produção, com o endereço da API em /api (FR-129)", () => {
    expect(SCRIPTS["build:aws"]).toBe("VITE_ENDERECO_DA_API=/api npm run build");

    /** A construção padrão continua sendo a de quem desenvolve, sem /api. */
    expect(SCRIPTS.build).toBe("tsc --noEmit && vite build");
  });

  it("a construção de produção publica um pacote que chama a API em /api, na mesma origem (FR-129, SC-057)", () => {
    const resultado = construirPeloScript(
      "build:aws",
      ambienteSemEnderecoInformado(),
    );

    try {
      expect(resultado.status, resultado.saida).toBe(0);

      const javascript = javascriptDoPacote(resultado.diretorio);

      expect(javascript).toContain("/api");

      /** Nenhum resto do endereço local: o navegador publicado chama o CloudFront. */
      expect(javascript).not.toContain("127.0.0.1");
    } finally {
      // O pacote é temporário e desta execução: ninguém mais o lê.
      rmSync(resultado.diretorio, { recursive: true, force: true });
    }
  }, 300_000);

  it("sem a variável, a construção continua apontando o endereço local padrão (FR-129)", () => {
    const resultado = construirPeloScript(
      "build",
      ambienteSemEnderecoInformado(),
    );

    try {
      expect(resultado.status, resultado.saida).toBe(0);
      expect(javascriptDoPacote(resultado.diretorio)).toContain(
        ENDERECO_LOCAL_PADRAO,
      );
    } finally {
      // O pacote é temporário e desta execução: ninguém mais o lê.
      rmSync(resultado.diretorio, { recursive: true, force: true });
    }
  }, 300_000);
});
