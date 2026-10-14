import { describe, expect, it } from "vitest";

import { reconhecerAudio } from "../../src/midia/audio/reconhecer.ts";
import { amostraWebm } from "./amostras-de-audio/webm.ts";

const SEGREDOS = ["Titulo Secreto", "Artista Secreto", "GPS -23.5"];
const CAPA = new TextEncoder().encode("CAPA-SECRETA-JPEG-BYTES");
const ID_DO_CLUSTER = [0x1f, 0x43, 0xb6, 0x75];
const ID_DO_SEGMENTO = [0x18, 0x53, 0x80, 0x67];
const ID_DAS_TRACKS = [0x16, 0x54, 0xae, 0x6b];
const ID_DO_INFO = [0x15, 0x49, 0xa9, 0x66];

function contem(bytes: Uint8Array, alvo: string | Uint8Array): boolean {
  const procurado = typeof alvo === "string" ? Buffer.from(alvo, "utf8") : Buffer.from(alvo);
  return Buffer.from(bytes).includes(procurado);
}

function posicaoDe(bytes: Uint8Array, id: number[]): number {
  return Buffer.from(bytes).indexOf(Buffer.from(id));
}

function lerTamanho8(bytes: Uint8Array, posicao: number): number {
  let valor = 0;
  for (let i = 1; i < 8; i++) valor = valor * 256 + bytes[posicao + i]!;
  return valor;
}

function concatena(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((soma, parte) => soma + parte.length, 0);
  const out = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) {
    out.set(parte, posicao);
    posicao += parte.length;
  }
  return out;
}

/** Insere bytes no começo do conteúdo do Info e ajusta os tamanhos do Info e do Segment. */
function inserirNoInicioDoInfo(entrada: Uint8Array, extra: Uint8Array): Uint8Array {
  const info = posicaoDe(entrada, ID_DO_INFO);
  const segmento = posicaoDe(entrada, ID_DO_SEGMENTO);
  const tamanhoDoInfo = lerTamanho8(entrada, info + 4);
  const tamanhoDoSegmento = lerTamanho8(entrada, segmento + 4);
  const ponto = info + 12;

  const saida = concatena([entrada.subarray(0, ponto), extra, entrada.subarray(ponto)]);
  gravarTamanho8(saida, info + 4, tamanhoDoInfo + extra.length);
  gravarTamanho8(saida, segmento + 4, tamanhoDoSegmento + extra.length);
  return saida;
}

function gravarTamanho8(bytes: Uint8Array, posicao: number, valor: number): void {
  bytes[posicao] = 0x01;
  let v = valor;
  for (let i = 7; i >= 1; i--) {
    bytes[posicao + i] = v % 256;
    v = Math.floor(v / 256);
  }
}

describe("reconhecerAudio: WebM (audio/webm)", () => {
  it("aceita Opus com Duration e devolve a duração do Info", () => {
    expect(reconhecerAudio(amostraWebm({ duracaoMs: 12_345 }))).toMatchObject({
      ok: true,
      formato: "audio/webm",
      duracaoMs: 12_345,
    });
  });

  it("sem Duration, mede pelos clusters: último bloco mais um intervalo", () => {
    expect(reconhecerAudio(amostraWebm({}))).toMatchObject({ ok: true, duracaoMs: 3000 });
    expect(reconhecerAudio(amostraWebm({ clustersDesconhecidos: true }))).toMatchObject({
      ok: true,
      duracaoMs: 3000,
    });
    expect(reconhecerAudio(amostraWebm({ tamanhoDesconhecido: true }))).toMatchObject({
      ok: true,
      duracaoMs: 3000,
    });
  });

  it("com Segment de tamanho desconhecido, o Duration continua valendo", () => {
    expect(reconhecerAudio(amostraWebm({ duracaoMs: 4000, tamanhoDesconhecido: true }))).toMatchObject({
      ok: true,
      duracaoMs: 4000,
    });
  });

  it("aceita exatamente 300 s e recusa 300 s + 1 ms como duração", () => {
    expect(reconhecerAudio(amostraWebm({ duracaoMs: 300_000 }))).toMatchObject({
      ok: true,
      duracaoMs: 300_000,
    });
    expect(reconhecerAudio(amostraWebm({ duracaoMs: 300_001 }))).toEqual({ ok: false, motivo: "duracao" });
  });

  it("sem Duration, aceita 300 s medidos pelos clusters e recusa 301 s", () => {
    const exatos = amostraWebm({ clusters: 300, blocosPorCluster: 1000, msPorBloco: 1 });
    expect(reconhecerAudio(exatos)).toMatchObject({ ok: true, duracaoMs: 300_000 });

    const excesso = amostraWebm({ clusters: 301, blocosPorCluster: 1000, msPorBloco: 1 });
    expect(reconhecerAudio(excesso)).toEqual({ ok: false, motivo: "duracao" });
  });

  it("remove título, tags e capa sem mudar o tamanho, a duração nem o áudio", () => {
    const entrada = amostraWebm({ titulo: "Titulo Secreto", tags: ["Artista Secreto", "GPS -23.5"], anexos: CAPA });
    const copiaDaEntrada = entrada.slice();

    // Sanidade: os segredos estão de fato nos bytes de entrada.
    for (const segredo of SEGREDOS) expect(contem(entrada, segredo)).toBe(true);
    expect(contem(entrada, CAPA)).toBe(true);

    const resultado = reconhecerAudio(entrada);
    if (!resultado.ok) throw new Error("a amostra com metadados deveria ser aceita");

    expect(resultado.duracaoMs).toBe(3000);
    expect(resultado.bytes.length).toBe(entrada.length);
    for (const segredo of SEGREDOS) expect(contem(resultado.bytes, segredo)).toBe(false);
    expect(contem(resultado.bytes, CAPA)).toBe(false);

    // Os clusters (o som) ficam byte a byte iguais.
    const inicioDoAudioNaEntrada = posicaoDe(entrada, ID_DO_CLUSTER);
    const inicioDoAudioNaSaida = posicaoDe(resultado.bytes, ID_DO_CLUSTER);
    expect(Buffer.from(resultado.bytes.subarray(inicioDoAudioNaSaida))).toEqual(
      Buffer.from(entrada.subarray(inicioDoAudioNaEntrada)),
    );

    // A entrada não foi tocada, e a saída limpa reconhece igual.
    expect(entrada).toEqual(copiaDaEntrada);
    expect(reconhecerAudio(resultado.bytes)).toMatchObject({
      ok: true,
      formato: "audio/webm",
      duracaoMs: resultado.duracaoMs,
    });
  });

  it("recusa 60% do arquivo como formato", () => {
    const amostra = amostraWebm({ duracaoMs: 1000 });
    const cortada = amostra.subarray(0, Math.floor(amostra.length * 0.6));
    expect(reconhecerAudio(cortada)).toEqual({ ok: false, motivo: "formato" });

    const semDuracao = amostraWebm({ tamanhoDesconhecido: true });
    const cortadaSemDuracao = semDuracao.subarray(0, Math.floor(semDuracao.length * 0.6));
    expect(reconhecerAudio(cortadaSemDuracao)).toEqual({ ok: false, motivo: "formato" });
  });

  it("recusa trilha de vídeo, codec que não é Opus e DocType de Matroska como formato", () => {
    expect(reconhecerAudio(amostraWebm({ video: true }))).toEqual({ ok: false, motivo: "formato" });
    expect(reconhecerAudio(amostraWebm({ codec: "A_VORBIS" }))).toEqual({ ok: false, motivo: "formato" });
    expect(reconhecerAudio(amostraWebm({ docType: "matroska" }))).toEqual({ ok: false, motivo: "formato" });
  });

  it("recusa tamanho declarado maior que o arquivo como formato, em menos de 100 ms", () => {
    const copia = amostraWebm({ duracaoMs: 1000 }).slice();
    gravarTamanho8(copia, posicaoDe(copia, ID_DO_SEGMENTO) + 4, 2 ** 40);

    const inicio = performance.now();
    const resultado = reconhecerAudio(copia);
    const decorrido = performance.now() - inicio;

    expect(resultado).toEqual({ ok: false, motivo: "formato" });
    expect(decorrido).toBeLessThan(100);
  });

  it("recusa Tracks de tamanho zero (sem trilha de áudio) como formato, em menos de 100 ms", () => {
    const copia = amostraWebm({ duracaoMs: 1000 }).slice();
    gravarTamanho8(copia, posicaoDe(copia, ID_DAS_TRACKS) + 4, 0);

    const inicio = performance.now();
    const resultado = reconhecerAudio(copia);
    const decorrido = performance.now() - inicio;

    expect(resultado).toEqual({ ok: false, motivo: "formato" });
    expect(decorrido).toBeLessThan(100);
  });

  it("aceita elementos de tamanho zero dentro do Info (Void e Title) com a duração certa", () => {
    const comVoidETitulo = inserirNoInicioDoInfo(
      amostraWebm({ duracaoMs: 2000 }),
      concatena([
        Uint8Array.from([0xec, 0x01, 0, 0, 0, 0, 0, 0, 0]),
        Uint8Array.from([0x7b, 0xa9, 0x80]),
      ]),
    );
    expect(reconhecerAudio(comVoidETitulo)).toMatchObject({ ok: true, duracaoMs: 2000 });

    const semDuracao = inserirNoInicioDoInfo(
      amostraWebm({}),
      Uint8Array.from([0xec, 0x01, 0, 0, 0, 0, 0, 0, 0]),
    );
    expect(reconhecerAudio(semDuracao)).toMatchObject({ ok: true, duracaoMs: 3000 });
  });

  it("recusa tamanho que aponta para o próprio início do Cluster como formato, em menos de 100 ms", () => {
    const copia = amostraWebm({ clusters: 1, blocosPorCluster: 1 }).slice();
    const inicioDoCluster = posicaoDe(copia, ID_DO_CLUSTER);
    gravarTamanho8(copia, inicioDoCluster + 4, inicioDoCluster);

    const inicio = performance.now();
    const resultado = reconhecerAudio(copia);
    const decorrido = performance.now() - inicio;

    expect(resultado).toEqual({ ok: false, motivo: "formato" });
    expect(decorrido).toBeLessThan(100);
  });
});
