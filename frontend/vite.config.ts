import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// O fuso das provas não é o da máquina que roda: o dia de «hoje» é o mesmo em
// qualquer lugar (ver o relógio em `vitest.setup.ts`).
process.env.TZ = "America/Sao_Paulo";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    // Os tetos de tempo só existem para um teste travado não prender a suíte:
    // eles não podem decidir o resultado conforme a velocidade ou a carga da
    // máquina. Uma prova correta termina assim que a condição vale; o teto só
    // é alcançado quando algo de fato não acontece.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
