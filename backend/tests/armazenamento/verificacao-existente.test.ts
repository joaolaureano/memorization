import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

/**
 * T806 e T812 — cem por cento da bateria de verificação já existente de `001` a
 * `006` passa com o Adapter do armazenamento local, sem alteração de
 * significado, e nenhuma tela, campo ou ação nova é oferecida (SC-038).
 *
 * A prova é a execução da bateria de verdade, e não uma afirmação sobre ela: as
 * suítes de domínio (`tests/acervo/`), de contrato HTTP (`tests/http/`) e as do
 * servidor e da escuta rodam **por dentro** desta, cada uma sobre o Adapter
 * local. O relatório de cada execução precisa dizer que todos os casos passaram,
 * sem nenhum ignorado ou pendente, e os fontes da bateria não podem conter
 * `.skip`, `.todo` nem `.only`: o que esta feature mudou foi o **mecanismo** — o
 * armazenamento entra pela Porta —, nunca o significado dos casos.
 *
 * O lado da tela de `001` a `006` desta prova (T812) é do frontend, e é
 * evidenciado pela porta de qualidade do próprio frontend — nem esta bateria nem
 * o `npm test` do backend dependem dela —, com a navegação de ponta a ponta
 * coberta pela suíte e2e, que sobe a API real pela raiz de composição local.
 */

const RAIZ_DO_BACKEND = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/**
 * As suítes da bateria existente no backend: o domínio e as migrações de `001` a
 * `006`, o contrato HTTP (que desde a `008-entrar` traz a Credencial em cada
 * chamada), o servidor e a escuta.
 */
const FILTROS_DA_BATERIA_DO_BACKEND = [
  "tests/acervo",
  "tests/http",
  "tests/servidor.test.ts",
  "tests/escuta.test.ts",
];

const DIRETORIO_TEMPORARIO = mkdtempSync(
  join(tmpdir(), "verificacao-existente-"),
);

afterAll(() => {
  rmSync(DIRETORIO_TEMPORARIO, { recursive: true, force: true });
});

interface RelatorioDaBateria {
  success: boolean;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  numTodoTests: number;
  testResults: Array<{ name: string; status: string }>;
}

interface ExecucaoDaBateria {
  codigo: number | null;
  saida: string;
  relatorio: RelatorioDaBateria;
}

/** Os arquivos de caso de um diretório, recursivamente — `.ts` e `.tsx`. */
function arquivosDeTeste(diretorio: string): string[] {
  return readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(diretorio, entrada.name);

    if (entrada.isDirectory()) {
      return arquivosDeTeste(caminho);
    }

    return /\.test\.tsx?$/.test(caminho) ? [caminho] : [];
  });
}

/**
 * Executa a bateria de um projeto como o `npm test` a executa — o mesmo
 * `vitest`, no mesmo diretório de trabalho, sem nenhuma variável da suíte de
 * fora — e devolve o código de saída e o relatório de casos.
 */
function executarBateria(
  projeto: string,
  filtros: string[],
  rotulo: string,
): ExecucaoDaBateria {
  const arquivoDoRelatorio = join(DIRETORIO_TEMPORARIO, `${rotulo}.json`);
  const ambiente = { ...process.env };

  for (const chave of Object.keys(ambiente)) {
    if (chave.startsWith("VITEST")) {
      delete ambiente[chave];
    }
  }

  const resultado = spawnSync(
    process.execPath,
    [
      join(projeto, "node_modules", "vitest", "vitest.mjs"),
      "run",
      ...filtros,
      "--reporter=json",
      `--outputFile=${arquivoDoRelatorio}`,
    ],
    { cwd: projeto, env: ambiente, encoding: "utf8", timeout: 240_000 },
  );

  return {
    codigo: resultado.status,
    saida: `${resultado.stdout}${resultado.stderr}`,
    relatorio: JSON.parse(
      readFileSync(arquivoDoRelatorio, "utf8"),
    ) as RelatorioDaBateria,
  };
}

/** Cem por cento: todos os casos passaram, e nenhum ficou de fora. */
function exigirBateriaInteira(relatorio: RelatorioDaBateria): void {
  expect(relatorio.success).toBe(true);
  expect(relatorio.numTotalTests).toBeGreaterThan(0);
  expect(relatorio.numFailedTests).toBe(0);
  expect(relatorio.numPassedTests).toBe(relatorio.numTotalTests);
  expect(relatorio.numPendingTests).toBe(0);
  expect(relatorio.numTodoTests).toBe(0);
}

/** Os arquivos da bateria, relativos à raiz do projeto, como o relatório os traz. */
function arquivosDoRelatorio(
  projeto: string,
  relatorio: RelatorioDaBateria,
): Set<string> {
  return new Set(
    relatorio.testResults.map((resultado) =>
      relative(realpathSync(projeto), resultado.name),
    ),
  );
}

/** O nome de um arquivo da bateria, relativo à raiz do projeto, para o relatório. */
function relativoAoProjeto(projeto: string, arquivo: string): string {
  return relative(realpathSync(projeto), arquivo);
}

describe("bateria existente com o Adapter do armazenamento local", () => {
  it("as suítes de domínio, de contrato HTTP, do servidor e da escuta passam por inteiro (SC-038)", () => {
    const esperados = [
      ...arquivosDeTeste(join(RAIZ_DO_BACKEND, "tests", "acervo")),
      ...arquivosDeTeste(join(RAIZ_DO_BACKEND, "tests", "http")),
      join(RAIZ_DO_BACKEND, "tests", "servidor.test.ts"),
      join(RAIZ_DO_BACKEND, "tests", "escuta.test.ts"),
    ].map((arquivo) => relativoAoProjeto(RAIZ_DO_BACKEND, arquivo));

    const { codigo, saida, relatorio } = executarBateria(
      RAIZ_DO_BACKEND,
      FILTROS_DA_BATERIA_DO_BACKEND,
      "backend",
    );

    expect(codigo, `a bateria do backend falhou: ${saida.slice(-1_000)}`).toBe(
      0,
    );
    exigirBateriaInteira(relatorio);

    /** A bateria inteira entra: nenhum arquivo fica de fora da execução. */
    expect(arquivosDoRelatorio(RAIZ_DO_BACKEND, relatorio)).toEqual(
      new Set(esperados),
    );
  }, 300_000);

  it("cada suíte da bateria corre sobre o Adapter do armazenamento local (SC-038)", () => {
    const apoioDoContrato = join(
      RAIZ_DO_BACKEND,
      "tests",
      "http",
      "apoio-de-contrato.ts",
    );

    /** O apoio que monta o servidor do contrato abre o Adapter local. */
    expect(readFileSync(apoioDoContrato, "utf8")).toMatch(
      /armazenamento\/sqlite\/armazenamento\.ts/,
    );

    for (const arquivo of [
      ...arquivosDeTeste(join(RAIZ_DO_BACKEND, "tests", "acervo")),
      ...arquivosDeTeste(join(RAIZ_DO_BACKEND, "tests", "http")),
    ]) {
      const rotulo = relative(RAIZ_DO_BACKEND, arquivo);
      const fonte = readFileSync(arquivo, "utf8");

      /** Nenhum arquivo da bateria conhece o armazenamento da nuvem. */
      expect(fonte, rotulo).not.toMatch(/armazenamento\/(postgresql|nuvem)/);

      /**
       * Cada um abre o Adapter local — pelo próprio arquivo, em memória — ou
       * monta a aplicação pelo apoio do contrato, que o abre.
       */
      expect(fonte, rotulo).toMatch(/sqlite|apoio-de-contrato/);
    }
  });

  it("nenhum caso da bateria existente está ignorado, pendente ou isolado (SC-038)", () => {
    for (const arquivo of [
      ...arquivosDeTeste(join(RAIZ_DO_BACKEND, "tests", "acervo")),
      ...arquivosDeTeste(join(RAIZ_DO_BACKEND, "tests", "http")),
      join(RAIZ_DO_BACKEND, "tests", "servidor.test.ts"),
      join(RAIZ_DO_BACKEND, "tests", "escuta.test.ts"),
    ]) {
      expect(
        readFileSync(arquivo, "utf8"),
        relative(RAIZ_DO_BACKEND, arquivo),
      ).not.toMatch(/\.(skip|todo|only)\b/);
    }
  });
});
