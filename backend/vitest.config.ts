import { defineConfig } from "vitest/config";

// O fuso das provas não é o da máquina que roda (o relógio fixo está em
// `vitest.setup.ts`).
process.env.TZ = "America/Sao_Paulo";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
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
