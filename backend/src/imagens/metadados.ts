import type { FormatoDeImagem } from "./armazem.ts";

/**
 * Remoção de metadados embutidos na Imagem (`026`, FR-427, research R13).
 *
 * Trabalha sobre os bytes, por formato, sem decodificar nem reencodar a
 * imagem: a qualidade fica intacta e não há dependência nativa. Remove
 * localização, aparelho, data, comentários e similares; preserva o que a
 * exibição precisa — a orientação do JPEG, o perfil de cor e a animação do
 * GIF. Arquivo malformado devolve `null`, e quem chama recusa como `formato`.
 */
export function removerMetadados(
  bytes: Uint8Array,
  formato: FormatoDeImagem,
): Uint8Array | null {
  try {
    switch (formato) {
      case "image/jpeg":
        return limparJpeg(bytes);
      case "image/png":
        return limparPng(bytes);
      case "image/webp":
        return limparWebp(bytes);
      case "image/gif":
        return limparGif(bytes);
    }
  } catch {
    return null;
  }
}

function juntar(partes: readonly Uint8Array[]): Uint8Array {
  const total = partes.reduce((soma, parte) => soma + parte.length, 0);
  const saida = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) {
    saida.set(parte, posicao);
    posicao += parte.length;
  }
  return saida;
}

function exigir(condicao: boolean): void {
  if (!condicao) {
    throw new Error("arquivo malformado");
  }
}

function texto(bytes: Uint8Array, desde: number, tamanho: number): string {
  return String.fromCharCode(...bytes.subarray(desde, desde + tamanho));
}

/* ------------------------------------------------------------------ JPEG */

/**
 * Segmentos `APPn` mantidos: APP0 (JFIF), APP2 (perfil ICC) e APP14 (Adobe,
 * necessário para decodificar CMYK). Os demais `APPn` (EXIF, XMP, IPTC...) e
 * os comentários (`COM`) saem.
 */
const APP_MANTIDOS = new Set([0xe0, 0xe2, 0xee]);

function limparJpeg(bytes: Uint8Array): Uint8Array {
  exigir(bytes[0] === 0xff && bytes[1] === 0xd8);
  const partes: Uint8Array[] = [bytes.subarray(0, 2)];
  let orientacao = 1;
  let posicao = 2;

  while (posicao < bytes.length) {
    exigir(bytes[posicao] === 0xff);
    const marcador = bytes[posicao + 1]!;

    if (marcador === 0xff) {
      posicao += 1; // preenchimento entre marcadores
      continue;
    }

    if (marcador === 0xd9) {
      partes.push(bytes.subarray(posicao, posicao + 2));
      break;
    }

    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) {
      partes.push(bytes.subarray(posicao, posicao + 2));
      posicao += 2;
      continue;
    }

    const tamanho = (bytes[posicao + 2]! << 8) | bytes[posicao + 3]!;
    exigir(tamanho >= 2 && posicao + 2 + tamanho <= bytes.length);
    const fim = posicao + 2 + tamanho;

    if (marcador === 0xda) {
      // Início dos dados da imagem: o resto do arquivo segue como está.
      partes.push(bytes.subarray(posicao));
      break;
    }

    const ehApp = marcador >= 0xe0 && marcador <= 0xef;

    if (marcador === 0xe1) {
      orientacao = lerOrientacaoExif(bytes.subarray(posicao + 4, fim)) ?? orientacao;
    }

    if ((ehApp && !APP_MANTIDOS.has(marcador)) || marcador === 0xfe) {
      posicao = fim;
      continue;
    }

    partes.push(bytes.subarray(posicao, fim));
    posicao = fim;
  }

  if (orientacao !== 1) {
    // Logo depois do SOI (e do APP0, se houver), um EXIF só com a orientação.
    const depoisDoApp0 =
      partes[1] !== undefined && partes[1][1] === 0xe0 ? 2 : 1;
    partes.splice(depoisDoApp0, 0, exifSoComOrientacao(orientacao));
  }

  return juntar(partes);
}

/** Lê a tag `Orientation` (0x0112) do IFD0 de um segmento APP1 EXIF. */
function lerOrientacaoExif(dados: Uint8Array): number | null {
  if (texto(dados, 0, 6) !== "Exif\0\0") {
    return null;
  }

  const tiff = dados.subarray(6);
  const bigEndian = texto(tiff, 0, 2) === "MM";
  const ler16 = (i: number): number =>
    bigEndian ? (tiff[i]! << 8) | tiff[i + 1]! : tiff[i]! | (tiff[i + 1]! << 8);
  const ler32 = (i: number): number =>
    bigEndian
      ? ((tiff[i]! << 24) | (tiff[i + 1]! << 16) | (tiff[i + 2]! << 8) | tiff[i + 3]!) >>> 0
      : (tiff[i]! | (tiff[i + 1]! << 8) | (tiff[i + 2]! << 16) | (tiff[i + 3]! << 24)) >>> 0;

  const ifd0 = ler32(4);
  if (ifd0 + 2 > tiff.length) {
    return null;
  }

  const entradas = ler16(ifd0);
  for (let i = 0; i < entradas; i++) {
    const entrada = ifd0 + 2 + i * 12;
    if (entrada + 12 > tiff.length) {
      return null;
    }
    if (ler16(entrada) === 0x0112) {
      const valor = ler16(entrada + 8);
      return valor >= 1 && valor <= 8 ? valor : null;
    }
  }

  return null;
}

/** Segmento APP1 EXIF mínimo, só com a orientação, em big-endian. */
function exifSoComOrientacao(orientacao: number): Uint8Array {
  const corpo = [
    ..."Exif\0\0".split("").map((c) => c.charCodeAt(0)),
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // TIFF "MM", IFD0 no byte 8
    0x00, 0x01, // uma entrada
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, // Orientation, SHORT, 1 valor
    0x00, orientacao, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, // sem próximo IFD
  ];
  const tamanho = corpo.length + 2;
  return new Uint8Array([0xff, 0xe1, tamanho >> 8, tamanho & 0xff, ...corpo]);
}

/* ------------------------------------------------------------------- PNG */

const CHUNKS_PNG_REMOVIDOS = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);

function limparPng(bytes: Uint8Array): Uint8Array {
  const partes: Uint8Array[] = [bytes.subarray(0, 8)];
  let posicao = 8;

  while (posicao < bytes.length) {
    exigir(posicao + 12 <= bytes.length);
    const tamanho =
      ((bytes[posicao]! << 24) |
        (bytes[posicao + 1]! << 16) |
        (bytes[posicao + 2]! << 8) |
        bytes[posicao + 3]!) >>>
      0;
    const tipo = texto(bytes, posicao + 4, 4);
    const fim = posicao + 12 + tamanho;
    exigir(fim <= bytes.length);

    if (!CHUNKS_PNG_REMOVIDOS.has(tipo)) {
      partes.push(bytes.subarray(posicao, fim));
    }

    posicao = fim;
    if (tipo === "IEND") {
      break;
    }
  }

  return juntar(partes);
}

/* ------------------------------------------------------------------ WebP */

function limparWebp(bytes: Uint8Array): Uint8Array {
  const partes: Uint8Array[] = [];
  let posicao = 12;

  while (posicao + 8 <= bytes.length) {
    const tipo = texto(bytes, posicao, 4);
    const tamanho =
      (bytes[posicao + 4]! |
        (bytes[posicao + 5]! << 8) |
        (bytes[posicao + 6]! << 16) |
        (bytes[posicao + 7]! << 24)) >>>
      0;
    const fim = posicao + 8 + tamanho + (tamanho % 2);
    exigir(posicao + 8 + tamanho <= bytes.length);

    if (tipo === "VP8X") {
      const chunk = bytes.slice(posicao, Math.min(fim, bytes.length));
      chunk[8] = chunk[8]! & ~(0x08 | 0x04); // sem EXIF e sem XMP
      partes.push(chunk);
    } else if (tipo !== "EXIF" && tipo !== "XMP ") {
      partes.push(bytes.subarray(posicao, Math.min(fim, bytes.length)));
    }

    posicao = fim;
  }

  const corpo = juntar(partes);
  const tamanhoRiff = corpo.length + 4;
  const cabecalho = new Uint8Array([
    ..."RIFF".split("").map((c) => c.charCodeAt(0)),
    tamanhoRiff & 0xff,
    (tamanhoRiff >> 8) & 0xff,
    (tamanhoRiff >> 16) & 0xff,
    (tamanhoRiff >> 24) & 0xff,
    ..."WEBP".split("").map((c) => c.charCodeAt(0)),
  ]);
  return juntar([cabecalho, corpo]);
}

/* ------------------------------------------------------------------- GIF */

/**
 * Remove as extensões de comentário (0xFE) e as de aplicação (0xFF) que não
 * sejam o laço de animação `NETSCAPE2.0` — é nelas que mora o XMP.
 */
function limparGif(bytes: Uint8Array): Uint8Array {
  exigir(bytes.length >= 13);
  const partes: Uint8Array[] = [];
  const campos = bytes[10]!;
  let posicao = 13;

  if (campos & 0x80) {
    posicao += 3 * (1 << ((campos & 0x07) + 1));
  }
  partes.push(bytes.subarray(0, posicao));

  const pularSubblocos = (desde: number): number => {
    let i = desde;
    while (true) {
      exigir(i < bytes.length);
      const tamanho = bytes[i]!;
      i += 1 + tamanho;
      if (tamanho === 0) {
        return i;
      }
    }
  };

  while (posicao < bytes.length) {
    const introdutor = bytes[posicao]!;

    if (introdutor === 0x3b) {
      partes.push(bytes.subarray(posicao, posicao + 1));
      break;
    }

    if (introdutor === 0x21) {
      const rotulo = bytes[posicao + 1]!;
      const fim = pularSubblocos(posicao + 2);
      const ehLacoDeAnimacao =
        rotulo === 0xff && texto(bytes, posicao + 3, 11) === "NETSCAPE2.0";

      if (rotulo !== 0xfe && (rotulo !== 0xff || ehLacoDeAnimacao)) {
        partes.push(bytes.subarray(posicao, fim));
      }
      posicao = fim;
      continue;
    }

    exigir(introdutor === 0x2c);
    let fim = posicao + 10;
    const camposLocais = bytes[posicao + 9]!;
    if (camposLocais & 0x80) {
      fim += 3 * (1 << ((camposLocais & 0x07) + 1));
    }
    fim = pularSubblocos(fim + 1); // +1: tamanho mínimo do código LZW
    partes.push(bytes.subarray(posicao, fim));
    posicao = fim;
  }

  return juntar(partes);
}
