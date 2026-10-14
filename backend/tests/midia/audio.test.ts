import { describe, expect, it } from "vitest";

import { reconhecerAudio } from "../../src/midia/audio/reconhecer.ts";

/**
 * Casos independentes de contêiner do reconhecimento de Áudio (FR-436, FR-437,
 * research R3, R11). Os casos de cada formato ficam nos arquivos próprios.
 */
describe("reconhecerAudio: casos independentes de contêiner", () => {
  it("recusa 0 byte como tamanho", () => {
    expect(reconhecerAudio(new Uint8Array(0))).toEqual({ ok: false, motivo: "tamanho" });
  });

  it("recusa 10 MB + 1 byte como tamanho", () => {
    const grande = new Uint8Array(10_485_761);
    expect(reconhecerAudio(grande)).toEqual({ ok: false, motivo: "tamanho" });
  });

  it("recusa texto qualquer como formato", () => {
    const texto = new TextEncoder().encode("isto não é áudio");
    expect(reconhecerAudio(texto)).toEqual({ ok: false, motivo: "formato" });
  });

  it("recusa cabeçalho de PNG como formato", () => {
    const png = new Uint8Array(64);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    expect(reconhecerAudio(png)).toEqual({ ok: false, motivo: "formato" });
  });

  it("recusa 4 KB pseudoaleatórios como formato, em menos de 100 ms", () => {
    // LCG determinística (semente 42): mesmos bytes em toda execução.
    const bytes = new Uint8Array(4096);
    let estado = 42;
    for (let i = 0; i < bytes.length; i++) {
      estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
      bytes[i] = estado >>> 24;
    }

    const inicio = performance.now();
    const resultado = reconhecerAudio(bytes);
    const decorrido = performance.now() - inicio;

    expect(resultado).toEqual({ ok: false, motivo: "formato" });
    expect(decorrido).toBeLessThan(100);
  });
});
