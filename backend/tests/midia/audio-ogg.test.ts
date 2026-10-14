import { describe, expect, it } from "vitest";

import { reconhecerAudio } from "../../src/midia/audio/reconhecer.ts";
import {
  AUDIO_DE_AMOSTRA,
  amostraOgg,
  reassinarPagina,
} from "./amostras-de-audio/ogg.ts";

const TITULO = "Titulo Secreto";
const ARTISTA = "Artista Secreto";
const GPS = "GPS -23.5";

function contem(bytes: Uint8Array, texto: string): boolean {
  return Buffer.from(bytes).includes(Buffer.from(texto, "utf8"));
}

function capaDeTeste(): Uint8Array {
  return Uint8Array.from({ length: 3000 }, (_, i) => (i * 131 + 17) & 0xff);
}

/** Posição da última página `OggS` do arquivo. */
function inicioDaUltimaPagina(bytes: Uint8Array): number {
  return Buffer.from(bytes).lastIndexOf(Buffer.from("OggS", "ascii"));
}

describe("reconhecerAudio: OGG (audio/ogg)", () => {
  describe("aceitos, com duração exata", () => {
    it("Vorbis: formato e duração pela granule ÷ taxa", () => {
      const granulo = 44100 * 7 + 123;
      const resultado = reconhecerAudio(amostraOgg({ codec: "vorbis", granulo }));
      expect(resultado).toMatchObject({
        ok: true,
        formato: "audio/ogg",
        duracaoMs: Math.round((granulo * 1000) / 44100),
      });
    });

    it("Opus: formato e duração pela (granule − pre-skip) ÷ 48 000", () => {
      const granulo = 48000 * 5 + 312 + 100;
      const resultado = reconhecerAudio(amostraOgg({ codec: "opus", granulo }));
      expect(resultado).toMatchObject({
        ok: true,
        formato: "audio/ogg",
        duracaoMs: Math.round(((granulo - 312) * 1000) / 48000),
      });
    });

    it("Opus: exatamente 300 s é aceito", () => {
      const granulo = 300 * 48000 + 312;
      const resultado = reconhecerAudio(amostraOgg({ codec: "opus", granulo }));
      expect(resultado).toMatchObject({ ok: true, duracaoMs: 300_000 });
    });

    it("Vorbis com taxa 1 000: exatamente 300 s é aceito", () => {
      const resultado = reconhecerAudio(amostraOgg({ codec: "vorbis", granulo: 300_000, taxa: 1000 }));
      expect(resultado).toMatchObject({ ok: true, duracaoMs: 300_000 });
    });
  });

  describe("limite de 300 s", () => {
    it("Opus: 300 s + 1 ms (48 amostras a mais) → duracao", () => {
      const granulo = 300 * 48000 + 312 + 48;
      expect(reconhecerAudio(amostraOgg({ codec: "opus", granulo }))).toEqual({
        ok: false,
        motivo: "duracao",
      });
    });

    it("Vorbis com taxa 1 000: 300 s + 1 ms (1 amostra a mais) → duracao", () => {
      const resultado = reconhecerAudio(amostraOgg({ codec: "vorbis", granulo: 300_001, taxa: 1000 }));
      expect(resultado).toEqual({ ok: false, motivo: "duracao" });
    });
  });

  describe("limpeza de metadados", () => {
    const casos = [
      { nome: "Vorbis", codec: "vorbis" as const, granulo: 44100 * 4 + 9 },
      { nome: "Opus", codec: "opus" as const, granulo: 48000 * 4 + 312 + 9 },
    ];

    for (const caso of casos) {
      it(`${caso.nome}: remove título, artista, GPS e a capa, com o mesmo tamanho`, () => {
        const entrada = amostraOgg({ codec: caso.codec, granulo: caso.granulo, capa: capaDeTeste() });
        const antes = reconhecerAudio(entrada);
        expect(antes.ok).toBe(true);
        if (!antes.ok) return;

        const limpo = antes.bytes;
        expect(limpo.length).toBe(entrada.length);
        expect(contem(limpo, TITULO)).toBe(false);
        expect(contem(limpo, ARTISTA)).toBe(false);
        expect(contem(limpo, GPS)).toBe(false);
        expect(contem(limpo, "METADATA_BLOCK_PICTURE")).toBe(false);
        expect(contem(limpo, Buffer.from(capaDeTeste()).toString("base64"))).toBe(false);

        // O fornecedor (vendor) fica, e o som também.
        expect(contem(limpo, "memorization-test")).toBe(true);
        expect(Buffer.from(limpo).includes(Buffer.from(AUDIO_DE_AMOSTRA))).toBe(true);

        // Reconhecer de novo os bytes limpos dá o mesmo resultado.
        const depois = reconhecerAudio(limpo);
        expect(depois).toMatchObject({ ok: true, formato: antes.formato, duracaoMs: antes.duracaoMs });
      });
    }

    it("não altera o arquivo de entrada", () => {
      const entrada = amostraOgg({ codec: "vorbis", granulo: 44100 * 2, capa: capaDeTeste() });
      const copia = Uint8Array.from(entrada);
      const resultado = reconhecerAudio(entrada);
      expect(resultado.ok).toBe(true);
      expect(entrada).toEqual(copia);
    });
  });

  describe("recusas por formato", () => {
    it("truncado em 60% do tamanho → formato", () => {
      const completo = amostraOgg({ codec: "vorbis", granulo: 44100 * 3, capa: capaDeTeste() });
      const cortado = completo.slice(0, Math.floor(completo.length * 0.6));
      expect(reconhecerAudio(cortado)).toEqual({ ok: false, motivo: "formato" });
    });

    it("truncado no início da última página (sem EOS) → formato", () => {
      const completo = amostraOgg({ codec: "opus", granulo: 48000 * 3 + 312 });
      const cortado = completo.slice(0, inicioDaUltimaPagina(completo));
      expect(reconhecerAudio(cortado)).toEqual({ ok: false, motivo: "formato" });
    });

    it("FLAC (0x7F FLAC) → formato", () => {
      expect(reconhecerAudio(amostraOgg({ codec: "flac", granulo: 1 }))).toEqual({
        ok: false,
        motivo: "formato",
      });
    });

    it("Vorbis com taxa 0 → formato", () => {
      expect(reconhecerAudio(amostraOgg({ codec: "vorbis", granulo: 44100, taxa: 0 }))).toEqual({
        ok: false,
        motivo: "formato",
      });
    });

    it("um byte do CRC alterado em uma página → formato", () => {
      const bytes = amostraOgg({ codec: "vorbis", granulo: 44100 * 2 });
      bytes[22] = bytes[22]! ^ 0x01;
      expect(reconhecerAudio(bytes)).toEqual({ ok: false, motivo: "formato" });
    });
  });

  describe("robustez: estrutura hostil, em menos de 100 ms", () => {
    function cronometrar(bytes: Uint8Array) {
      const inicio = performance.now();
      const resultado = reconhecerAudio(bytes);
      return { resultado, decorrido: performance.now() - inicio };
    }

    it("tamanho declarado maior que o arquivo → formato", () => {
      const bytes = amostraOgg({ codec: "opus", granulo: 48000 * 2 + 312 });
      const ultima = inicioDaUltimaPagina(bytes);
      bytes[ultima + 27] = 255; // único segmento da última página declara 255 bytes
      reassinarPagina(bytes, ultima);
      const { resultado, decorrido } = cronometrar(bytes);
      expect(resultado).toEqual({ ok: false, motivo: "formato" });
      expect(decorrido).toBeLessThan(100);
    });

    it("página de tamanho zero antes da identificação → formato", () => {
      const pagina = new Uint8Array(27);
      pagina.set([0x4f, 0x67, 0x67, 0x53, 0, 2], 0);
      pagina[26] = 0; // zero segmentos: página vazia
      reassinarPagina(pagina, 0);
      const restante = amostraOgg({ codec: "vorbis", granulo: 44100 });
      const bytes = new Uint8Array(pagina.length + restante.length);
      bytes.set(pagina, 0);
      bytes.set(restante, pagina.length);
      const { resultado, decorrido } = cronometrar(bytes);
      expect(resultado).toEqual({ ok: false, motivo: "formato" });
      expect(decorrido).toBeLessThan(100);
    });

    it("página que se declara sem fim (lacing 255 no último segmento, sem o pacote terminar) → formato", () => {
      const bytes = amostraOgg({ codec: "vorbis", granulo: 44100 * 2, paginasDeAudio: 1 });
      const ultima = inicioDaUltimaPagina(bytes);
      bytes[ultima + 27] = 255;
      reassinarPagina(bytes, ultima);
      const { resultado, decorrido } = cronometrar(bytes);
      expect(resultado).toEqual({ ok: false, motivo: "formato" });
      expect(decorrido).toBeLessThan(100);
    });
  });
});
