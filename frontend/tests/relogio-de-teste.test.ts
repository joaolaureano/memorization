import { describe, expect, it, vi } from "vitest";

import { INSTANTE_DE_TESTE } from "../vitest.setup";

/**
 * Sentinela do ambiente de prova: se o fuso ou o «hoje» fixos deixarem de valer,
 * é aqui que a falha aparece — e não, de forma intermitente, num teste da
 * Agenda que só quebra em certos dias da semana.
 */
describe("relógio e fuso das provas", () => {
  it("o fuso é o de teste, e não o da máquina", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
      "America/Sao_Paulo",
    );
  });

  it("«hoje» parte de uma quarta-feira ao meio-dia e o tempo segue andando", async () => {
    const inicio = Date.now();

    expect(new Date(inicio).getDay()).toBe(3);
    expect(new Date(inicio).getHours()).toBe(12);
    expect(Math.abs(inicio - INSTANTE_DE_TESTE.getTime())).toBeLessThan(5_000);

    // O relógio anda sozinho a partir do instante fixo: espera-se a condição,
    // não um tempo.
    await vi.waitFor(() => expect(Date.now()).toBeGreaterThan(inicio));
  });
});
