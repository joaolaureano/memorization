/**
 * Amostras de Imagem montadas byte a byte para as provas do `ArmazemDeMidia`.
 * Cada uma traz metadados que precisam sumir (FR-427) e um marcador de texto
 * (`SEGREDO-GPS`, `SEGREDO-COMENTARIO`...) que permite provar a remoção sem
 * decodificar a imagem.
 */

const ascii = (texto: string): number[] => [...texto].map((c) => c.charCodeAt(0));

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u32be(valor: number): number[] {
  return [(valor >>> 24) & 0xff, (valor >>> 16) & 0xff, (valor >>> 8) & 0xff, valor & 0xff];
}

function u32le(valor: number): number[] {
  return [valor & 0xff, (valor >>> 8) & 0xff, (valor >>> 16) & 0xff, (valor >>> 24) & 0xff];
}

function chunkPng(tipo: string, dados: number[]): number[] {
  const corpo = new Uint8Array([...ascii(tipo), ...dados]);
  return [...u32be(dados.length), ...corpo, ...u32be(crc32(corpo))];
}

/** PNG 1×1 com `tEXt` e `eXIf`; `preenchimento` acrescenta um chunk privado. */
export function pngComMetadados(preenchimento = 0): Uint8Array {
  const ihdr = [...u32be(1), ...u32be(1), 8, 2, 0, 0, 0];
  const idat = [0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x03, 0x01, 0x01, 0x00];
  const partes = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunkPng("IHDR", ihdr),
    ...chunkPng("tEXt", ascii("Comment\0SEGREDO-COMENTARIO")),
    ...chunkPng("eXIf", ascii("MM\0*SEGREDO-GPS")),
    ...chunkPng("IDAT", idat),
  ];
  const fim = chunkPng("IEND", []);
  if (preenchimento > 0) {
    // Chunk privado e auxiliar (`prVt`) para chegar a um tamanho exato.
    const dados = new Array<number>(Math.max(0, preenchimento - partes.length - fim.length - 12)).fill(0);
    return new Uint8Array([...partes, ...chunkPng("prVt", dados), ...fim]);
  }
  return new Uint8Array([...partes, ...fim]);
}

/** Segmento APP1 EXIF com Orientation e um texto de GPS no IFD0. */
function app1Exif(orientacao: number): number[] {
  const textoGps = ascii("SEGREDO-GPS\0");
  const tiff = [
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // "II", IFD0 em 8
    0x02, 0x00, // duas entradas
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientacao, 0x00, 0x00, 0x00,
    0x0e, 0x01, 0x02, 0x00, textoGps.length, 0x00, 0x00, 0x00, 0x26, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, // sem próximo IFD
    ...textoGps,
  ];
  const corpo = [...ascii("Exif\0\0"), ...tiff];
  const tamanho = corpo.length + 2;
  return [0xff, 0xe1, tamanho >> 8, tamanho & 0xff, ...corpo];
}

/** JPEG mínimo com APP0, EXIF (orientação e GPS), comentário e dados. */
export function jpegComMetadados(orientacao = 6): Uint8Array {
  const comentario = ascii("SEGREDO-COMENTARIO");
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, ...ascii("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0,
    ...app1Exif(orientacao),
    0xff, 0xfe, 0x00, comentario.length + 2, ...comentario,
    0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, // DQT curto
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, // SOS
    0x12, 0x34, 0x56, // dados comprimidos
    0xff, 0xd9,
  ]);
}

/** GIF89a 1×1 animado, com comentário e XMP numa extensão de aplicação. */
export function gifComMetadados(versao: "GIF87a" | "GIF89a" = "GIF89a"): Uint8Array {
  const comentario = ascii("SEGREDO-COMENTARIO");
  const xmp = ascii("SEGREDO-GPS");
  return new Uint8Array([
    ...ascii(versao),
    0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, // tela 1×1, tabela global de 2 cores
    0, 0, 0, 255, 255, 255,
    0x21, 0xff, 0x0b, ...ascii("NETSCAPE2.0"), 0x03, 0x01, 0x00, 0x00, 0x00,
    0x21, 0xff, 0x0b, ...ascii("XMP DataXMP"), xmp.length, ...xmp, 0x00,
    0x21, 0xfe, comentario.length, ...comentario, 0x00,
    0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x00, // descritor da imagem
    0x02, 0x02, 0x44, 0x01, 0x00, // LZW
    0x3b,
  ]);
}

function chunkRiff(tipo: string, dados: number[]): number[] {
  return [...ascii(tipo), ...u32le(dados.length), ...dados, ...(dados.length % 2 ? [0] : [])];
}

/** WebP estendido (VP8X) com EXIF e XMP. */
export function webpComMetadados(): Uint8Array {
  const vp8x = [0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // flags EXIF (0x08) e XMP (0x04)
  const corpo = [
    ...ascii("WEBP"),
    ...chunkRiff("VP8X", vp8x),
    ...chunkRiff("VP8 ", [0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00]),
    ...chunkRiff("EXIF", ascii("SEGREDO-GPS")),
    ...chunkRiff("XMP ", ascii("SEGREDO-COMENTARIO")),
  ];
  return new Uint8Array([...ascii("RIFF"), ...u32le(corpo.length), ...corpo]);
}

/** Um texto qualquer com nome de imagem: o servidor precisa recusar. */
export function textoDisfarcado(): Uint8Array {
  return new Uint8Array(ascii("isto não é uma imagem, só parece pelo nome .png"));
}

/** Diz se os bytes ainda contêm o texto marcador. */
export function contem(bytes: Uint8Array, marcador: string): boolean {
  return Buffer.from(bytes).includes(Buffer.from(marcador));
}

/** Lê a orientação (0x0112) do primeiro APP1 EXIF de um JPEG; `null` sem EXIF. */
export function orientacaoDoJpeg(bytes: Uint8Array): number | null {
  const buffer = Buffer.from(bytes);
  const inicio = buffer.indexOf(Buffer.from("Exif\0\0"));
  if (inicio === -1) {
    return null;
  }
  const tiff = buffer.subarray(inicio + 6);
  const be = tiff.toString("latin1", 0, 2) === "MM";
  const r16 = (i: number) => (be ? tiff.readUInt16BE(i) : tiff.readUInt16LE(i));
  const r32 = (i: number) => (be ? tiff.readUInt32BE(i) : tiff.readUInt32LE(i));
  const ifd = r32(4);
  for (let i = 0; i < r16(ifd); i++) {
    const e = ifd + 2 + i * 12;
    if (r16(e) === 0x0112) {
      return r16(e + 8);
    }
  }
  return null;
}
