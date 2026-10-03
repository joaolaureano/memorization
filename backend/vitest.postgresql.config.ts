import { defineConfig } from "vitest/config";

/**
 * Os testes abaixo iniciam PostgreSQL embutido, com binário e TLS próprios.
 * Eles rodam em série para não disputar CPU e o ciclo de vida dos processos.
 */
export default defineConfig({
  test: {
    environment: "node",
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
