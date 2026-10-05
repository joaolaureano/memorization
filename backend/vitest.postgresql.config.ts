import { defineConfig } from "vitest/config";

// O fuso e o «hoje» das provas são fixos, como na suíte geral (ver
// `vitest.setup.ts`).
process.env.TZ = "America/Sao_Paulo";

/**
 * Os testes abaixo iniciam PostgreSQL embutido, com binário e TLS próprios.
 * Eles rodam em série para não disputar CPU e o ciclo de vida dos processos.
 */
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // Teto contra travamento, e não expectativa de velocidade: o resultado não
    // pode depender da carga da máquina.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    include: [
      "tests/armazenamento/construcao.test.ts",
      "tests/armazenamento/postgresql/**/*.test.ts",
      "tests/entradas/nuvem.test.ts",
      "tests/funcao/funcao.test.ts",
      "tests/identidade/dados-armazenados.test.ts",
    ],
  },
});
