import { describe, expect, it } from "vitest";

import { reconhecerAudio } from "../../src/midia/audio/reconhecer.ts";
import { amostraMp3 } from "./amostras-de-audio/mp3.ts";
import { amostraWav } from "./amostras-de-audio/wav.ts";

/** Duração exata de N quadros MPEG-1 Layer III a 44 100 Hz (1152 amostras por quadro). */
const duracaoDeQuadros = (quadros: number): number => Math.round((quadros * 1152 * 1000) / 44100);

const TAMANHO_DO_QUADRO = 417;

const latin1 = (texto: string): Uint8Array => Uint8Array.from(texto, (c) => c.charCodeAt(0) & 0xff);

/** Repete um cabeçalho de quadro `n` vezes, com corpo zerado de `tamanho` bytes por quadro. */
function fluxo(cabecalho: number[], tamanho: number, n: number): Uint8Array {
  const out = new Uint8Array(tamanho * n);
  for (let i = 0; i < n; i++) out.set(cabecalho, i * tamanho);
  return out;
}

function concatenar(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((soma, parte) => soma + parte.length, 0);
  const out = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) {
    out.set(parte, posicao);
    posicao += parte.length;
  }
  return out;
}

const METADADOS = ["Titulo Secreto", "Artista Secreto", "GPS -23.5"];
const CAPA = latin1("CAPA-SECRETA-JPEG-0123456789");

describe("reconhecerAudio: MP3 (audio/mpeg)", () => {
  it("aceita 1000 quadros MPEG-1 Layer III a 128 kbps e 44,1 kHz com duração exata", () => {
    const r = reconhecerAudio(amostraMp3({ quadros: 1000 }));
    expect(r).toMatchObject({ ok: true, formato: "audio/mpeg", duracaoMs: duracaoDeQuadros(1000) });
  });

  it("aceita 11 484 quadros (299 990 ms), logo abaixo de 300 s", () => {
    const r = reconhecerAudio(amostraMp3({ quadros: 11484 }));
    expect(r).toMatchObject({ ok: true, formato: "audio/mpeg", duracaoMs: 299990 });
  });

  it("recusa 11 485 quadros (300 016 ms) como duracao", () => {
    expect(reconhecerAudio(amostraMp3({ quadros: 11485 }))).toEqual({ ok: false, motivo: "duracao" });
  });

  it("aceita com ID3v2, APEv2 e ID3v1 e mede a mesma duração do som puro", () => {
    const comTags = amostraMp3({
      quadros: 1000,
      id3v2: { titulo: "Titulo Secreto", artista: "Artista Secreto", comentario: "GPS -23.5", capa: CAPA },
      ape: true,
      id3v1: { titulo: "Titulo Secreto", artista: "Artista Secreto" },
    });
    expect(reconhecerAudio(comTags)).toMatchObject({
      ok: true,
      formato: "audio/mpeg",
      duracaoMs: duracaoDeQuadros(1000),
    });
  });

  it("tira ID3v2, APEv2 e ID3v1: nenhum texto sensível nem a capa sobrevive", () => {
    const entrada = amostraMp3({
      quadros: 200,
      id3v2: { titulo: "Titulo Secreto", artista: "Artista Secreto", comentario: "GPS -23.5", capa: CAPA },
      ape: true,
      id3v1: { titulo: "Titulo Secreto", artista: "Artista Secreto" },
    });
    const r = reconhecerAudio(entrada);
    if (!r.ok) throw new Error("amostra deveria ser reconhecida");

    const saida = Buffer.from(r.bytes);
    for (const texto of METADADOS) expect(saida.includes(Buffer.from(texto))).toBe(false);
    expect(saida.includes(Buffer.from(CAPA))).toBe(false);
  });

  it("a saída é só o som: igual ao MP3 sem etiquetas e de tamanho quadros × 417", () => {
    const entrada = amostraMp3({
      quadros: 200,
      id3v2: { titulo: "Titulo Secreto", capa: CAPA },
      ape: true,
      id3v1: { artista: "Artista Secreto" },
    });
    const r = reconhecerAudio(entrada);
    if (!r.ok) throw new Error("amostra deveria ser reconhecida");

    expect(r.bytes.byteLength).toBe(200 * TAMANHO_DO_QUADRO);
    expect(r.bytes.byteLength).toBeLessThan(entrada.byteLength);
    expect(Buffer.from(r.bytes).equals(Buffer.from(amostraMp3({ quadros: 200 })))).toBe(true);
  });

  it("reconhecer de novo os bytes limpos dá o mesmo formato e a mesma duração", () => {
    const entrada = amostraMp3({
      quadros: 1000,
      id3v2: { titulo: "Titulo Secreto", artista: "Artista Secreto", comentario: "GPS -23.5", capa: CAPA },
      ape: true,
      id3v1: { titulo: "Titulo Secreto", artista: "Artista Secreto" },
    });
    const primeira = reconhecerAudio(entrada);
    if (!primeira.ok) throw new Error("amostra deveria ser reconhecida");

    const segunda = reconhecerAudio(primeira.bytes);
    expect(segunda).toMatchObject({ ok: true, formato: primeira.formato, duracaoMs: primeira.duracaoMs });
  });

  it("não altera os bytes de entrada ao limpar", () => {
    const entrada = amostraMp3({
      quadros: 200,
      id3v2: { titulo: "Titulo Secreto", capa: CAPA },
      ape: true,
      id3v1: { titulo: "Titulo Secreto" },
    });
    const copia = entrada.slice();
    reconhecerAudio(entrada);
    expect(entrada).toEqual(copia);
  });

  it("trunca a 60% do arquivo como formato", () => {
    const inteiro = amostraMp3({ quadros: 101 });
    const cortado = inteiro.slice(0, Math.floor(inteiro.length * 0.6));
    expect(reconhecerAudio(cortado)).toEqual({ ok: false, motivo: "formato" });
  });

  it("recusa só 2 quadros válidos (são necessários pelo menos 3) como formato", () => {
    expect(reconhecerAudio(amostraMp3({ quadros: 2 }))).toEqual({ ok: false, motivo: "formato" });
  });

  it("recusa fluxo MPEG Layer II (FF FD) como formato", () => {
    const layerII = fluxo([0xff, 0xfd, 0xb0, 0x00], 626, 5);
    expect(reconhecerAudio(layerII)).toEqual({ ok: false, motivo: "formato" });
  });

  it.each([
    ["versão reservada", [0xff, 0xeb, 0x90, 0x00]],
    ["taxa livre (índice 0)", [0xff, 0xfb, 0x00, 0x00]],
    ["taxa inválida (índice 15)", [0xff, 0xfb, 0xf0, 0x00]],
    ["frequência de amostragem inválida (índice 3)", [0xff, 0xfb, 0x9c, 0x00]],
  ])("recusa cabeçalho com %s como formato", (_nome, cabecalho) => {
    expect(reconhecerAudio(fluxo(cabecalho, TAMANHO_DO_QUADRO, 5))).toEqual({ ok: false, motivo: "formato" });
  });

  it("aceita MPEG-2 Layer III (22 050 Hz, 64 kbps) com duração exata", () => {
    // 10 quadros × 576 amostras = 5760 amostras a 22 050 Hz = 261,22 ms.
    const r = reconhecerAudio(fluxo([0xff, 0xf3, 0x80, 0x00], 208, 10));
    expect(r).toMatchObject({ ok: true, formato: "audio/mpeg", duracaoMs: 261 });
  });

  it("aceita MPEG-2.5 Layer III (11 025 Hz, 64 kbps) com duração exata", () => {
    // 10 quadros × 576 amostras = 5760 amostras a 11 025 Hz = 522,45 ms.
    const r = reconhecerAudio(fluxo([0xff, 0xe3, 0x80, 0x00], 417, 10));
    expect(r).toMatchObject({ ok: true, formato: "audio/mpeg", duracaoMs: 522 });
  });

  it("ID3v2 com tamanho declarado maior que o arquivo é recusado como formato, em menos de 100 ms", () => {
    // Tamanho sincronizado 0x0FFFFFFF (256 MB) num arquivo de poucos KB.
    const cabecalho = Uint8Array.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x7f, 0x7f, 0x7f, 0x7f]);
    const arquivo = concatenar([cabecalho, amostraMp3({ quadros: 5 })]);

    const inicio = performance.now();
    const resultado = reconhecerAudio(arquivo);
    const decorrido = performance.now() - inicio;

    expect(resultado).toEqual({ ok: false, motivo: "formato" });
    expect(decorrido).toBeLessThan(100);
  });

  it("ID3v2 de tamanho zero seguido só de zeros é recusado como formato, em menos de 100 ms", () => {
    const cabecalho = Uint8Array.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const arquivo = concatenar([cabecalho, new Uint8Array(4096)]);

    const inicio = performance.now();
    const resultado = reconhecerAudio(arquivo);
    const decorrido = performance.now() - inicio;

    expect(resultado).toEqual({ ok: false, motivo: "formato" });
    expect(decorrido).toBeLessThan(100);
  });

  it("ID3v2 cujo tamanho não é sincronizável (bit alto ligado) é recusado como formato, em menos de 100 ms", () => {
    const cabecalho = Uint8Array.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x80, 0x00, 0x00, 0x10]);
    const arquivo = concatenar([cabecalho, amostraMp3({ quadros: 5 })]);

    const inicio = performance.now();
    const resultado = reconhecerAudio(arquivo);
    const decorrido = performance.now() - inicio;

    expect(resultado).toEqual({ ok: false, motivo: "formato" });
    expect(decorrido).toBeLessThan(100);
  });

  it("um WAV de amostraWav não é reconhecido como audio/mpeg", () => {
    const r = reconhecerAudio(amostraWav({ segundos: 1 }));
    expect(!(r.ok && r.formato === "audio/mpeg")).toBe(true);
  });
});
