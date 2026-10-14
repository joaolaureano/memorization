import { describe, expect, it } from "vitest";

import { reconhecerAudio } from "../../src/midia/audio/reconhecer.ts";
import { amostraWav } from "./amostras-de-audio/wav.ts";

interface BlocoWav {
  id: string;
  inicio: number;
  tamanho: number;
  corpo: number;
}

/** Percorre os blocos de um WAV válido montado pelo construtor de amostras. */
function blocosDe(bytes: Uint8Array): BlocoWav[] {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lista: BlocoWav[] = [];
  let posicao = 12;
  while (posicao + 8 <= bytes.byteLength) {
    const id = String.fromCharCode(...bytes.subarray(posicao, posicao + 4));
    const tamanho = vista.getUint32(posicao + 4, true);
    lista.push({ id, inicio: posicao, tamanho, corpo: posicao + 8 });
    posicao += 8 + tamanho + (tamanho % 2);
  }
  return lista;
}

function blocoDe(bytes: Uint8Array, id: string): BlocoWav {
  const achado = blocosDe(bytes).find((bloco) => bloco.id === id);
  if (achado === undefined) throw new Error(`amostra sem bloco ${id}`);
  return achado;
}

function escreverU16(bytes: Uint8Array, posicao: number, valor: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint16(posicao, valor, true);
}

function escreverU32(bytes: Uint8Array, posicao: number, valor: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(posicao, valor, true);
}

function medir<T>(funcao: () => T): { resultado: T; decorrido: number } {
  const inicio = performance.now();
  const resultado = funcao();
  return { resultado, decorrido: performance.now() - inicio };
}

describe("reconhecerAudio: WAV aceito", () => {
  it("PCM 16 bits mono 8 kHz: formato audio/wav e duração exata", () => {
    const resultado = reconhecerAudio(amostraWav({ segundos: 1 }));
    expect(resultado).toMatchObject({ ok: true, formato: "audio/wav", duracaoMs: 1000 });
  });

  it("duração exata em amostras inteiras fracionárias (1,234 s a 1 kHz = 1234 ms)", () => {
    const resultado = reconhecerAudio(amostraWav({ segundos: 1.234, taxa: 1000 }));
    expect(resultado).toMatchObject({ ok: true, duracaoMs: 1234 });
  });

  it("PCM 16 bits estéreo 44,1 kHz: 2,5 s = 2500 ms", () => {
    const resultado = reconhecerAudio(amostraWav({ segundos: 2.5, taxa: 44100, canais: 2 }));
    expect(resultado).toMatchObject({ ok: true, duracaoMs: 2500 });
  });

  it("IEEE float 32 bits (formatTag 3) é aceito", () => {
    const resultado = reconhecerAudio(amostraWav({ segundos: 1, formato: 3, bits: 32 }));
    expect(resultado).toMatchObject({ ok: true, formato: "audio/wav", duracaoMs: 1000 });
  });

  it("WAVE_FORMAT_EXTENSIBLE com subformato PCM é aceito", () => {
    const resultado = reconhecerAudio(amostraWav({ segundos: 1, extensivel: { subformato: 1 } }));
    expect(resultado).toMatchObject({ ok: true, formato: "audio/wav", duracaoMs: 1000 });
  });

  it("WAVE_FORMAT_EXTENSIBLE com subformato float é aceito", () => {
    const resultado = reconhecerAudio(
      amostraWav({ segundos: 1, bits: 32, extensivel: { subformato: 3 } }),
    );
    expect(resultado).toMatchObject({ ok: true, formato: "audio/wav", duracaoMs: 1000 });
  });

  it("exatamente 300 s é aceito", () => {
    const resultado = reconhecerAudio(amostraWav({ segundos: 300, taxa: 8000 }));
    expect(resultado).toMatchObject({ ok: true, formato: "audio/wav", duracaoMs: 300_000 });
  });

  it("300,001 s (2 400 008 amostras a 8 kHz) → duracao", () => {
    const resultado = reconhecerAudio(amostraWav({ segundos: 300.001, taxa: 8000 }));
    expect(resultado).toEqual({ ok: false, motivo: "duracao" });
  });
});

describe("reconhecerAudio: WAV recusado como formato", () => {
  it("formatTag 2 (ADPCM) → formato", () => {
    const resultado = reconhecerAudio(amostraWav({ segundos: 1, formato: 2 }));
    expect(resultado).toEqual({ ok: false, motivo: "formato" });
  });

  it("WAVE_FORMAT_EXTENSIBLE com subformato 2 (ADPCM, byte corrigido à mão) → formato", () => {
    const bytes = amostraWav({ segundos: 1, extensivel: { subformato: 1 } });
    escreverU16(bytes, blocoDe(bytes, "fmt ").corpo + 24, 2);
    expect(reconhecerAudio(bytes)).toEqual({ ok: false, motivo: "formato" });
  });

  it("sem bloco data → formato", () => {
    const completo = amostraWav({ segundos: 1 });
    const somenteFmt = completo.slice(0, blocoDe(completo, "data").inicio);
    expect(reconhecerAudio(somenteFmt)).toEqual({ ok: false, motivo: "formato" });
  });

  it("cabeçalho RIFX (big-endian) → formato", () => {
    const bytes = amostraWav({ segundos: 1 });
    bytes.set([0x52, 0x49, 0x46, 0x58], 0);
    expect(reconhecerAudio(bytes)).toEqual({ ok: false, motivo: "formato" });
  });

  it("RIFF sem WAVE → formato", () => {
    const bytes = amostraWav({ segundos: 1 });
    bytes.set([0x57, 0x41, 0x56, 0x58], 8);
    expect(reconhecerAudio(bytes)).toEqual({ ok: false, motivo: "formato" });
  });

  it("canais 0 → formato", () => {
    const bytes = amostraWav({ segundos: 1 });
    escreverU16(bytes, blocoDe(bytes, "fmt ").corpo + 2, 0);
    expect(reconhecerAudio(bytes)).toEqual({ ok: false, motivo: "formato" });
  });

  it("taxa 0 → formato", () => {
    const bytes = amostraWav({ segundos: 1 });
    escreverU32(bytes, blocoDe(bytes, "fmt ").corpo + 4, 0);
    expect(reconhecerAudio(bytes)).toEqual({ ok: false, motivo: "formato" });
  });

  it("byteRate diferente de taxa × blockAlign → formato", () => {
    const bytes = amostraWav({ segundos: 1 });
    const corpo = blocoDe(bytes, "fmt ").corpo;
    escreverU32(bytes, corpo + 8, new DataView(bytes.buffer, bytes.byteOffset).getUint32(corpo + 8, true) + 1);
    expect(reconhecerAudio(bytes)).toEqual({ ok: false, motivo: "formato" });
  });

  it("arquivo cortado em 60% do tamanho → formato", () => {
    const bytes = amostraWav({ segundos: 1 });
    const cortado = bytes.slice(0, Math.floor(bytes.byteLength * 0.6));
    expect(reconhecerAudio(cortado)).toEqual({ ok: false, motivo: "formato" });
  });
});

describe("reconhecerAudio: WAV, robustez contra tamanhos hostis", () => {
  it("tamanho declarado de data maior que o arquivo → formato em menos de 100 ms", () => {
    const bytes = amostraWav({ segundos: 1 });
    escreverU32(bytes, blocoDe(bytes, "data").inicio + 4, bytes.byteLength * 2);
    const { resultado, decorrido } = medir(() => reconhecerAudio(bytes));
    expect(resultado).toEqual({ ok: false, motivo: "formato" });
    expect(decorrido).toBeLessThan(100);
  });

  it("chunk de tamanho zero → formato em menos de 100 ms", () => {
    const bytes = amostraWav({ segundos: 1, extras: [{ id: "junk", conteudo: "" }] });
    const { resultado, decorrido } = medir(() => reconhecerAudio(bytes));
    expect(resultado).toEqual({ ok: false, motivo: "formato" });
    expect(decorrido).toBeLessThan(100);
  });

  it("chunk cujo tamanho aponta de volta para o próprio cabeçalho (0xFFFFFFF8) → formato em menos de 100 ms", () => {
    const bytes = amostraWav({ segundos: 1, extras: [{ id: "junk", conteudo: "abc" }] });
    escreverU32(bytes, blocoDe(bytes, "junk").inicio + 4, 0xfffffff8);
    const { resultado, decorrido } = medir(() => reconhecerAudio(bytes));
    expect(resultado).toEqual({ ok: false, motivo: "formato" });
    expect(decorrido).toBeLessThan(100);
  });
});

describe("reconhecerAudio: WAV, limpeza de metadados", () => {
  const TITULO = "Titulo Secreto";
  const ARTISTA = "Artista Secreto";
  const GPS = "GPS -23.5";

  function amostraComMetadados(): Uint8Array {
    const bytes = amostraWav({
      segundos: 1,
      list: TITULO,
      extras: [
        { id: "id3 ", conteudo: ARTISTA },
        { id: "bext", conteudo: GPS },
      ],
    });
    // Conteúdo de áudio não nulo, para provar que os dados passam intactos.
    const dados = blocoDe(bytes, "data");
    for (let i = 0; i < dados.tamanho; i++) {
      bytes[dados.corpo + i] = (i % 251) + 1;
    }
    return bytes;
  }

  it("os textos de metadados somem da saída e o formato e a duração se mantêm", () => {
    const entrada = amostraComMetadados();
    expect(Buffer.from(entrada).includes(TITULO)).toBe(true);

    const primeiro = reconhecerAudio(entrada);
    expect(primeiro.ok).toBe(true);
    if (!primeiro.ok) return;

    const texto = Buffer.from(primeiro.bytes);
    expect(texto.includes(TITULO)).toBe(false);
    expect(texto.includes(ARTISTA)).toBe(false);
    expect(texto.includes(GPS)).toBe(false);

    const segundo = reconhecerAudio(primeiro.bytes);
    expect(segundo).toMatchObject({
      ok: true,
      formato: primeiro.formato,
      duracaoMs: primeiro.duracaoMs,
    });
  });

  it("a saída tem o mesmo tamanho da entrada e os blocos de metadados viram JUNK", () => {
    const entrada = amostraComMetadados();
    const resultado = reconhecerAudio(entrada);
    if (!resultado.ok) throw new Error("amostra deveria ser aceita");

    expect(resultado.bytes.byteLength).toBe(entrada.byteLength);
    const ids = blocosDe(resultado.bytes).map((bloco) => bloco.id);
    expect(ids).toEqual(["fmt ", "JUNK", "JUNK", "JUNK", "data"]);
  });

  it("os bytes do chunk data ficam idênticos, e a entrada não é alterada", () => {
    const entrada = amostraComMetadados();
    const copiaDaEntrada = entrada.slice();
    const resultado = reconhecerAudio(entrada);
    if (!resultado.ok) throw new Error("amostra deveria ser aceita");

    const dadosEntrada = blocoDe(entrada, "data");
    const dadosSaida = blocoDe(resultado.bytes, "data");
    expect(Buffer.from(resultado.bytes.subarray(dadosSaida.corpo, dadosSaida.corpo + dadosSaida.tamanho)).equals(
      Buffer.from(entrada.subarray(dadosEntrada.corpo, dadosEntrada.corpo + dadosEntrada.tamanho)),
    )).toBe(true);
    expect(entrada).toEqual(copiaDaEntrada);
    expect(resultado.bytes).not.toBe(entrada);
  });
});
