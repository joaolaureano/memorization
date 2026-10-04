import { afterEach, beforeEach, vi } from "vitest";

/**
 * O «hoje» de toda prova da suíte geral: uma quarta-feira, ao meio-dia no fuso
 * de teste (o fuso vem de `vitest.config.ts`). Só `Date` é falseado e o tempo
 * segue andando a partir desse instante; timers e I/O continuam reais. Assim
 * nenhuma prova depende do dia da semana em que roda, de virar a meia-noite ou
 * do fuso da máquina.
 */
beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["Date"],
    now: new Date("2026-03-11T15:00:00.000Z"),
    shouldAdvanceTime: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});
