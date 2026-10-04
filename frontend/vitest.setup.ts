import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// Início carrega estatísticas após Entrar; sob carga paralela o padrão de 1s causava falhas intermitentes.
configure({ asyncUtilTimeout: 4000 });

/**
 * O «hoje» de toda prova: uma quarta-feira, ao meio-dia no fuso de teste (o
 * fuso vem de `vite.config.ts`). Só `Date` é falseado, e o tempo segue andando
 * a partir desse instante — nenhum timer muda, e a ordem entre duas gravações
 * seguidas continua valendo. Assim nenhuma prova depende do dia da semana em
 * que roda, de virar a meia-noite ou do fuso da máquina.
 */
export const INSTANTE_DE_TESTE = new Date("2026-03-11T15:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["Date"],
    now: INSTANTE_DE_TESTE,
    shouldAdvanceTime: true,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
