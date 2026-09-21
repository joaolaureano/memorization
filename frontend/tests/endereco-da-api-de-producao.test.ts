import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
const DIRETORIO_DO_PACOTE = join(RAIZ_DO_FRONTEND, "dist");
const DIRETORIO_DOS_ASSETS = join(DIRETORIO_DO_PACOTE, "assets");

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

/** Executa um script de `npm` e devolve o código de saída e a saída capturada. */
function construirPeloScript(
  script: string,
  ambiente: Record<string, string | undefined>,
): { status: number | null; saida: string } {
  const resultado = spawnSync("npm", ["run", script], {
    cwd: RAIZ_DO_FRONTEND,
    env: ambiente,
    encoding: "utf8",
    timeout: 300_000,
  });

  return {
    status: resultado.status,
    saida: `${resultado.stdout}${resultado.stderr}`,
  };
}

/** Todo o JavaScript publicado pelo Vite, concatenado: o pacote é o artefato. */
function javascriptDoPacote(): string {
  expect(existsSync(DIRETORIO_DOS_ASSETS)).toBe(true);

  const arquivos = readdirSync(DIRETORIO_DOS_ASSETS).filter((nome) =>
    nome.endsWith(".js"),
  );

  expect(arquivos.length).toBeGreaterThan(0);

  return arquivos
    .map((nome) => readFileSync(join(DIRETORIO_DOS_ASSETS, nome), "utf8"))
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

    expect(resultado.status).toBe(0);

    const javascript = javascriptDoPacote();

    expect(javascript).toContain("/api");

    /** Nenhum resto do endereço local: o navegador publicado chama o CloudFront. */
    expect(javascript).not.toContain("127.0.0.1");
  }, 300_000);

  it("sem a variável, a construção continua apontando o endereço local padrão (FR-129)", () => {
    const resultado = construirPeloScript(
      "build",
      ambienteSemEnderecoInformado(),
    );

    expect(resultado.status).toBe(0);
    expect(javascriptDoPacote()).toContain(ENDERECO_LOCAL_PADRAO);
  }, 300_000);
});
