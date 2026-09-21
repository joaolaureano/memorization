import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * T807 — a verificação negativa da feature: nenhum Module conhece, nomeia ou
 * importa armazenamento concreto (FR-100, SC-043).
 *
 * A prova é a leitura dos imports dos fontes dos Modules, e não uma afirmação
 * na documentação: `src/acervo/`, `src/http/` e — quando existir —
 * `src/identidade/` não podem importar `node:sqlite`, um driver de banco nem um
 * diretório de Adapter. O único import permitido de `src/armazenamento/` é
 * `porta.ts`, que é a Interface que os Modules conhecem.
 *
 * Quem importa um Adapter é a raiz de composição (`src/index.ts` hoje,
 * `src/entradas/local.ts` com a `009`), que não é Module e por isso não é
 * varrida aqui. Os testes também não são Modules: é justamente por isso que a
 * bateria da Porta pode importar o Adapter local livremente.
 */

const RAIZ_DO_BACKEND = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/** Diretórios dos Modules, relativos à raiz do backend. */
const DIRETORIOS_DOS_MODULES = ["src/acervo", "src/http", "src/identidade"];

/** O único import de armazenamento permitido dentro de um Module. */
const PORTA = "src/armazenamento/porta.ts";

/** Prefixo dos Adapters de armazenamento, que nenhum Module pode importar. */
const DIRETORIO_DOS_ADAPTERS = "src/armazenamento/";

/**
 * Pacotes de driver de banco que nenhum Module pode importar. O módulo embutido
 * `node:sqlite` é do Node, e a regra o alcança pelo mesmo caminho.
 */
const PACOTE_DE_DRIVER =
  /(^|\/)(node:sqlite|sqlite|sqlite3|better-sqlite3|pg|pg-native|postgres|postgresql)(\/|$)/;

/** Todos os fontes TypeScript de um diretório, recursivamente. */
function fontesTypeScript(diretorio: string): string[] {
  return readdirSync(diretorio, { withFileTypes: true })
    .flatMap((entrada) => {
      const caminho = join(diretorio, entrada.name);

      return entrada.isDirectory()
        ? fontesTypeScript(caminho)
        : [caminho];
    })
    .filter((caminho) => caminho.endsWith(".ts"));
}

/** Os módulos que o fonte importa, na forma como estão escritos nele. */
function modulosImportados(fonte: string): string[] {
  const padroes = [
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /^\s*import\s+["']([^"']+)["']/gm,
  ];

  return padroes.flatMap((padrao) =>
    [...fonte.matchAll(padrao)].map((casamento) => casamento[1]),
  );
}

/**
 * Diz se o import é dependência de armazenamento concreto. Import relativo só é
 * recusado quando aponta para um Adapter; import de pacote, quando é driver de
 * banco — o que inclui o módulo embutido do Node.
 */
function ehDependenciaDeArmazenamento(
  caminhoDoFonte: string,
  modulo: string,
): boolean {
  if (!modulo.startsWith(".")) {
    return PACOTE_DE_DRIVER.test(modulo);
  }

  const destino = relative(
    RAIZ_DO_BACKEND,
    resolve(dirname(caminhoDoFonte), modulo),
  );

  return destino.startsWith(DIRETORIO_DOS_ADAPTERS) && destino !== PORTA;
}

/** Os imports de armazenamento concreto encontrados num fonte. */
function dependenciasDeArmazenamento(
  caminhoDoFonte: string,
  fonte: string,
): string[] {
  return modulosImportados(fonte).filter((modulo) =>
    ehDependenciaDeArmazenamento(caminhoDoFonte, modulo),
  );
}

const FONTES_DOS_MODULES = DIRETORIOS_DOS_MODULES.filter((diretorio) =>
  existsSync(join(RAIZ_DO_BACKEND, diretorio)),
).flatMap((diretorio) => fontesTypeScript(join(RAIZ_DO_BACKEND, diretorio)));

describe("dependências dos Modules", () => {
  it("varre os Modules do acervo e do HTTP, e do identidade quando existir", () => {
    const varridos = FONTES_DOS_MODULES.map((caminho) =>
      relative(RAIZ_DO_BACKEND, caminho),
    );

    expect(varridos).toContain("src/acervo/acervo.ts");
    expect(varridos).toContain("src/http/rotas.ts");
    expect(varridos.length).toBeGreaterThan(0);
  });

  it.each(
    FONTES_DOS_MODULES.map(
      (caminho) => [relative(RAIZ_DO_BACKEND, caminho), caminho] as const,
    ),
  )("não importa armazenamento concreto: %s", (rotulo, caminho) => {
    const fonte = readFileSync(caminho, "utf8");
    const encontrados = dependenciasDeArmazenamento(caminho, fonte);

    expect(
      encontrados,
      `Module ${rotulo} importa armazenamento concreto`,
    ).toEqual([]);
  });
});

describe("a varredura não é vácuo", () => {
  const fonteFalsa = join(RAIZ_DO_BACKEND, "src", "acervo", "fonte-falsa.ts");

  it("recusa um Module que importe o módulo embutido do Node", () => {
    expect(
      dependenciasDeArmazenamento(
        fonteFalsa,
        'import { DatabaseSync } from "node:sqlite";',
      ),
    ).toEqual(["node:sqlite"]);
  });

  it("recusa um Module que importe um pacote de driver de banco", () => {
    expect(
      dependenciasDeArmazenamento(fonteFalsa, 'import pg from "pg";'),
    ).toEqual(["pg"]);
    expect(
      dependenciasDeArmazenamento(
        fonteFalsa,
        'import { Pool } from "postgresql";',
      ),
    ).toEqual(["postgresql"]);
  });

  it("recusa um Module que importe um diretório de Adapter", () => {
    expect(
      dependenciasDeArmazenamento(
        fonteFalsa,
        'import { abrirArmazenamentoSqlite } from "../armazenamento/sqlite/armazenamento.ts";',
      ),
    ).toEqual(["../armazenamento/sqlite/armazenamento.ts"]);
  });

  it("recusa um Module que importe o Adapter por require ou import dinâmico", () => {
    expect(
      dependenciasDeArmazenamento(
        fonteFalsa,
        'const driver = require("node:sqlite");',
      ),
    ).toEqual(["node:sqlite"]);
    expect(
      dependenciasDeArmazenamento(
        fonteFalsa,
        'const adapter = await import("../armazenamento/postgresql/armazenamento.ts");',
      ),
    ).toEqual(["../armazenamento/postgresql/armazenamento.ts"]);
  });

  it("aceita o import da Porta e os imports do próprio Module", () => {
    expect(
      dependenciasDeArmazenamento(
        fonteFalsa,
        'import type { ArmazenamentoDoAcervo } from "../armazenamento/porta.ts";',
      ),
    ).toEqual([]);
    expect(
      dependenciasDeArmazenamento(
        fonteFalsa,
        'import { validarFrente } from "./invariantes.ts";\nimport { randomUUID } from "node:crypto";',
      ),
    ).toEqual([]);
  });
});
