import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BACKEND, bloco, ler, TERRAFORM, valorDe } from "./arquivos-da-infra.ts";

/**
 * FR-132 — o p95 das operações simples abaixo do limite, **medido na função**,
 * o que pode exigir elevar a memória dela.
 *
 * O que está sob conferência aqui é a parte que se prova **antes** de publicar:
 * a memória da função é uma variável de infraestrutura com padrão de um vCPU
 * inteiro, aplicada ao `memory_size`, e os parâmetros da derivação da Senha não
 * foram enfraquecidos para compensar latência — o remédio é elevar a memória, e
 * nunca reduzir `N`, `r` ou o tamanho do hash.
 *
 * O p95 em si — SC-059 — **não** se mede aqui: ele foi medido na função
 * publicada, através do CloudFront, e está registrado no `SESSION.md` (EVT-099)
 * e em `research.md` (Decisão 10, nota de pós-publicação). A conferência de que
 * esse registro existe é de `medicao-do-p95.test.ts`.
 *
 * Nada aqui fala com a AWS: são arquivos versionados, lidos como texto.
 */

/** As variáveis da infraestrutura, onde a memória deixou de ser literal. */
const VARIAVEIS = ler(join(TERRAFORM, "variables.tf"));

/** A função, onde a variável da memória vira `memory_size`. */
const LAMBDA = ler(join(TERRAFORM, "lambda.tf"));

/** A derivação da Senha, que FR-132 proíbe de enfraquecer. */
const SENHA = ler(join(BACKEND, "src", "identidade", "senha.ts"));

/** O bloco da variável de memória. */
const MEMORIA = bloco(VARIAVEIS, /variable\s+"lambda_memory_mb"\s*\{/);

/** O bloco da função, onde `memory_size` é definido. */
const FUNCAO = bloco(LAMBDA, /resource\s+"aws_lambda_function"\s+"api"\s*\{/);

/** O bloco dos parâmetros correntes da derivação, gravados junto do hash. */
const PARAMETROS = bloco(SENHA, /const PARAMETROS\s*=\s*\{/);

describe("o dimensionamento da função (FR-132)", () => {
  it("tem a memória como variável, com padrão de um vCPU inteiro (FR-132)", () => {
    expect(valorDe(MEMORIA, "type")).toBe("number");
    expect(Number(valorDe(MEMORIA, "default"))).toBeGreaterThanOrEqual(1769);
  });

  it("aplica a variável da memória ao memory_size da função (FR-132)", () => {
    expect(valorDe(FUNCAO, "memory_size")).toBe("var.lambda_memory_mb");
  });
});

describe("a derivação da Senha (FR-132)", () => {
  it("mantém N, r, p e o tamanho do hash como a 007 os gravou (FR-132)", () => {
    expect(valorDe(PARAMETROS, "algoritmo")).toBe('"scrypt"');
    expect(valorDe(PARAMETROS, "entrada")).toBe('"hmac-sha256"');
    expect(Number(valorDe(PARAMETROS, "N"))).toBe(32768);
    expect(Number(valorDe(PARAMETROS, "r"))).toBe(8);
    expect(Number(valorDe(PARAMETROS, "p"))).toBe(1);
    expect(valorDe(PARAMETROS, "tamanhoDoHash")).toBe("TAMANHO_DO_HASH");
  });

  it("mantém o hash em 64 bytes, como o esquema exige (FR-132)", () => {
    const tamanho = /const TAMANHO_DO_HASH = (\d+);/.exec(SENHA);

    expect(tamanho?.[1]).toBe("64");
  });

  it("mantém a exigência de memória do scrypt, e recusa derivar com maxmem menor (FR-132)", () => {
    expect(SENHA).toMatch(
      /const MEMORIA_MAXIMA = 64 \* 1024 \* 1024;/,
    );
    expect(SENHA).toMatch(
      /maxmem: MEMORIA_MAXIMA/,
    );
  });
});
