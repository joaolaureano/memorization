import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    maxWorkers: 4,
    exclude: [
      "tests/armazenamento/construcao.test.ts",
      "tests/armazenamento/postgresql/**/*.test.ts",
      "tests/entradas/nuvem.test.ts",
      "tests/funcao/funcao.test.ts",
      "tests/identidade/dados-armazenados.test.ts",
    ],
    include: ["tests/**/*.test.ts"],
  },
});
