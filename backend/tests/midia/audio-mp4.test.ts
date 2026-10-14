import { describe, expect, it } from "vitest";

import { reconhecerAudio } from "../../src/midia/audio/reconhecer.ts";
import { amostraM4a } from "./amostras-de-audio/mp4.ts";

const TITULO = "Titulo Secreto";
const ARTISTA = "Artista Secreto";
const GPS = "GPS -23.5";
const CAPA = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0xde, 0xad, 0xbe, 0xef, 0x42, 0x42, 0x42]);

const contem = (bytes: Uint8Array, trecho: string | Uint8Array): boolean =>
  Buffer.from(bytes).includes(typeof trecho === "string" ? trecho : Buffer.from(trecho));

const comMetadados = (): Uint8Array =>
  amostraM4a({
    duracaoMs: 2500,
    udta: { titulo: TITULO, artista: ARTISTA, local: GPS },
    meta: { titulo: TITULO, capa: CAPA },
    uuid: `${ARTISTA} ${GPS}`,
  });

describe("reconhecerAudio: M4A aceito", () => {
  it("reconhece M4A de 2,5 s com formato e duração exatos", () => {
    const r = reconhecerAudio(amostraM4a({ duracaoMs: 2500 }));
    expect(r).toMatchObject({ ok: true, formato: "audio/mp4", duracaoMs: 2500 });
  });

  it.each([
    [1234, 44100],
    [1001, 48000],
    [3, 22050],
    [59999, 8000],
  ])("duração exata de %i ms com timescale %i", (duracaoMs, timescale) => {
    const r = reconhecerAudio(amostraM4a({ duracaoMs, timescale }));
    expect(r).toMatchObject({ ok: true, formato: "audio/mp4", duracaoMs });
  });

  it("aceita exatamente 300 s", () => {
    const r = reconhecerAudio(amostraM4a({ duracaoMs: 300_000 }));
    expect(r).toMatchObject({ ok: true, formato: "audio/mp4", duracaoMs: 300_000 });
  });

  it("recusa 300 s + 1 ms como duracao", () => {
    const r = reconhecerAudio(amostraM4a({ duracaoMs: 300_001 }));
    expect(r).toEqual({ ok: false, motivo: "duracao" });
  });
});

describe("reconhecerAudio: M4A remove metadados sem alterar o som", () => {
  it("apaga título, artista, GPS e capa, mantém tamanho e mdat, e a duração não muda", () => {
    const original = comMetadados();
    const copiaDoOriginal = original.slice();

    expect(contem(original, TITULO)).toBe(true);
    expect(contem(original, CAPA)).toBe(true);

    const r = reconhecerAudio(original);
    if (!r.ok) throw new Error("amostra deveria ser aceita");

    expect(contem(r.bytes, TITULO)).toBe(false);
    expect(contem(r.bytes, ARTISTA)).toBe(false);
    expect(contem(r.bytes, GPS)).toBe(false);
    expect(contem(r.bytes, CAPA)).toBe(false);

    expect(r.bytes.length).toBe(original.length);
    // O mdat é a última caixa: o payload dele é o final do arquivo.
    expect(r.bytes.slice(-64)).toEqual(original.slice(-64));
    // A entrada não é alterada.
    expect(original).toEqual(copiaDoOriginal);

    const de_novo = reconhecerAudio(r.bytes);
    expect(de_novo).toMatchObject({ ok: true, formato: "audio/mp4", duracaoMs: 2500 });
  });
});

describe("reconhecerAudio: M4A recusado como formato", () => {
  it("recusa arquivo truncado em 60%", () => {
    const completo = amostraM4a({ duracaoMs: 2500 });
    const cortado = completo.slice(0, Math.floor(completo.length * 0.6));
    expect(reconhecerAudio(cortado)).toEqual({ ok: false, motivo: "formato" });
  });

  it("recusa trilha de vídeo", () => {
    expect(reconhecerAudio(amostraM4a({ duracaoMs: 2500, video: true }))).toEqual({
      ok: false,
      motivo: "formato",
    });
  });

  it("recusa entrada de amostra alac", () => {
    expect(reconhecerAudio(amostraM4a({ duracaoMs: 2500, codec: "alac" }))).toEqual({
      ok: false,
      motivo: "formato",
    });
  });

  it("recusa MP4 fragmentado sem duração", () => {
    expect(reconhecerAudio(amostraM4a({ duracaoMs: 2500, fragmentado: true }))).toEqual({
      ok: false,
      motivo: "formato",
    });
  });

  it("recusa ftyp só com a marca qt", () => {
    const qt = amostraM4a({ duracaoMs: 2500, marca: "qt  ", compativeis: ["qt  "] });
    expect(reconhecerAudio(qt)).toEqual({ ok: false, motivo: "formato" });
  });
});

describe("reconhecerAudio: M4A com estrutura hostil termina em formato, rápido", () => {
  const tamanhoDoFtyp = (bytes: Uint8Array): number =>
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);

  const medir = (bytes: Uint8Array) => {
    const inicio = performance.now();
    const r = reconhecerAudio(bytes);
    return { r, decorrido: performance.now() - inicio };
  };

  it("recusa tamanho declarado maior que o arquivo", () => {
    const bytes = amostraM4a({ duracaoMs: 2500 });
    const inicioDoMoov = tamanhoDoFtyp(bytes);
    new DataView(bytes.buffer).setUint32(inicioDoMoov, bytes.length + 1000);

    const { r, decorrido } = medir(bytes);
    expect(r).toEqual({ ok: false, motivo: "formato" });
    expect(decorrido).toBeLessThan(100);
  });

  it("recusa caixa filha com tamanho zero", () => {
    const bytes = amostraM4a({ duracaoMs: 2500 });
    // Primeira filha de moov, mvhd, começa logo depois do cabeçalho de moov.
    const mvhd = tamanhoDoFtyp(bytes) + 8;
    new DataView(bytes.buffer).setUint32(mvhd, 0);

    const { r, decorrido } = medir(bytes);
    expect(r).toEqual({ ok: false, motivo: "formato" });
    expect(decorrido).toBeLessThan(100);
  });

  it("recusa caixa cujo tamanho aponta para si mesma", () => {
    const bytes = amostraM4a({ duracaoMs: 2500 });
    const posicaoDaTrak = Buffer.from(bytes).indexOf("trak") - 4;
    expect(posicaoDaTrak).toBeGreaterThan(0);
    new DataView(bytes.buffer).setUint32(posicaoDaTrak, posicaoDaTrak);

    const { r, decorrido } = medir(bytes);
    expect(r).toEqual({ ok: false, motivo: "formato" });
    expect(decorrido).toBeLessThan(100);
  });
});
