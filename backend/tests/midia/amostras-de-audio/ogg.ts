/**
 * Amostra OGG montada em código (T007, research R11). Sem binário.
 *
 * `amostraOgg({ codec, granulo, taxa?, preSkip?, comentarios?, capa?, paginasDeAudio? })`:
 * - `vorbis`: página BOS com o pacote de identificação; comentários e setup
 *   em páginas de cabeçalho (até 4 segmentos cada, para que comentários
 *   grandes atravessem páginas); depois `paginasDeAudio` páginas de áudio, a
 *   última com EOS e `granule_position = granulo`.
 * - `opus`: `OpusHead` (pre-skip `preSkip`), `OpusTags`, páginas de áudio.
 * - `flac`: página com `\x7FFLAC` (usada só para provar a recusa).
 *
 * `comentarios` sem valor usa `TITLE`, `ARTIST` e `LOCATION` com dados
 * sensíveis de teste. Com `capa`, entra `METADATA_BLOCK_PICTURE=<base64>`.
 * Todas as páginas têm CRC válido; `reassinarPagina` recalcula o CRC após um
 * teste alterar bytes de propósito.
 */

export interface OpcoesDeAmostraOgg {
  codec: "vorbis" | "opus" | "flac";
  granulo: number;
  taxa?: number;
  preSkip?: number;
  comentarios?: string[];
  capa?: Uint8Array;
  paginasDeAudio?: number;
}

/** Carga útil de cada página de áudio. Determinística, para o teste achar o som intacto. */
export const AUDIO_DE_AMOSTRA = Uint8Array.from({ length: 64 }, (_, i) => (i * 37 + 11) & 0xff);

const SERIAL = 0x5eed0ca1;
const SEGMENTOS_POR_PAGINA_DE_CABECALHO = 4;
const CAMPO_CRC = 22;

const CRC_TABELA = (() => {
  const tabela = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    tabela[i] = r >>> 0;
  }
  return tabela;
})();

/** Tamanho total da página que começa em `inicio`, pela tabela de segmentos. */
export function fimDaPagina(bytes: Uint8Array, inicio: number): number {
  const quantidade = bytes[inicio + 26] ?? 0;
  let corpo = 0;
  for (let j = 0; j < quantidade; j++) corpo += bytes[inicio + 27 + j] ?? 0;
  return inicio + 27 + quantidade + corpo;
}

function crcDaPagina(bytes: Uint8Array, inicio: number, fim: number): number {
  let crc = 0;
  for (let i = inicio; i < fim; i++) {
    const zerado = i >= inicio + CAMPO_CRC && i < inicio + CAMPO_CRC + 4;
    const b = zerado ? 0 : bytes[i]!;
    crc = (((crc << 8) ^ CRC_TABELA[((crc >>> 24) ^ b) & 0xff]!) >>> 0);
  }
  return crc;
}

/**
 * Recalcula e grava o CRC da página em `inicio`. Não faz nada se a página
 * declara mais bytes do que o arquivo tem (o teste quer esse caso intacto).
 */
export function reassinarPagina(bytes: Uint8Array, inicio: number): void {
  const fim = fimDaPagina(bytes, inicio);
  if (fim > bytes.length) return;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  dv.setUint32(inicio + CAMPO_CRC, crcDaPagina(bytes, inicio, fim), true);
}

interface Segmento {
  valor: number;
  bytes: Uint8Array;
}

function segmentosDo(pacote: Uint8Array): Segmento[] {
  const saida: Segmento[] = [];
  let i = 0;
  while (pacote.length - i >= 255) {
    saida.push({ valor: 255, bytes: pacote.subarray(i, i + 255) });
    i += 255;
  }
  saida.push({ valor: pacote.length - i, bytes: pacote.subarray(i) });
  return saida;
}

function pagina(tipo: number, granule: number, sequencia: number, segmentos: Segmento[]): Uint8Array {
  const corpo = segmentos.reduce((soma, s) => soma + s.bytes.length, 0);
  const saida = new Uint8Array(27 + segmentos.length + corpo);
  const dv = new DataView(saida.buffer);
  saida.set([0x4f, 0x67, 0x67, 0x53], 0); // "OggS"
  saida[4] = 0;
  saida[5] = tipo;
  dv.setBigInt64(6, BigInt(granule), true);
  dv.setUint32(14, SERIAL, true);
  dv.setUint32(18, sequencia, true);
  saida[26] = segmentos.length;
  segmentos.forEach((s, i) => {
    saida[27 + i] = s.valor;
  });
  let pos = 27 + segmentos.length;
  for (const s of segmentos) {
    saida.set(s.bytes, pos);
    pos += s.bytes.length;
  }
  reassinarPagina(saida, 0);
  return saida;
}

function concatenar(...partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((soma, p) => soma + p.length, 0);
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
}

function u32(valor: number): Uint8Array {
  const saida = new Uint8Array(4);
  new DataView(saida.buffer).setUint32(0, valor >>> 0, true);
  return saida;
}

function u16(valor: number): Uint8Array {
  const saida = new Uint8Array(2);
  new DataView(saida.buffer).setUint16(0, valor, true);
  return saida;
}

const ascii = (texto: string): Uint8Array => new TextEncoder().encode(texto);

function identificacaoVorbis(taxa: number): Uint8Array {
  // 0x01 "vorbis" + versão + canais + taxa + 3 taxas de bits + blocksize + framing = 30 bytes.
  return concatenar(
    Uint8Array.of(0x01),
    ascii("vorbis"),
    u32(0),
    Uint8Array.of(2),
    u32(taxa),
    u32(0),
    u32(0),
    u32(0),
    Uint8Array.of(0xb8, 0x01),
  );
}

function cabecalhoOpus(taxa: number, preSkip: number): Uint8Array {
  // "OpusHead" + versão 1 + 2 canais + pre-skip + taxa de entrada + ganho 0 + mapeamento 0 = 19 bytes.
  return concatenar(
    ascii("OpusHead"),
    Uint8Array.of(1, 2),
    u16(preSkip),
    u32(taxa),
    u16(0),
    Uint8Array.of(0),
  );
}

function pacoteDeComentarios(prefixo: Uint8Array, comentarios: string[], sufixo: Uint8Array): Uint8Array {
  const vendor = ascii("memorization-test");
  const partes: Uint8Array[] = [prefixo, u32(vendor.length), vendor, u32(comentarios.length)];
  for (const comentario of comentarios) {
    const bytes = ascii(comentario);
    partes.push(u32(bytes.length), bytes);
  }
  partes.push(sufixo);
  return concatenar(...partes);
}

/** Um `Uint8Array` de bytes de áudio determinísticos, para `paginasDeAudio` páginas. */
function pacoteDeAudio(): Uint8Array {
  return AUDIO_DE_AMOSTRA;
}

export function amostraOgg(opcoes: OpcoesDeAmostraOgg): Uint8Array {
  const { codec, granulo, taxa = 44100, preSkip = 312, capa, paginasDeAudio = 3 } = opcoes;

  if (codec === "flac") {
    const corpo = new Uint8Array(34);
    corpo.set(ascii("\x7fFLAC"), 0);
    return pagina(2, 0, 0, segmentosDo(corpo));
  }

  if (!Number.isInteger(paginasDeAudio) || paginasDeAudio < 1) {
    throw new Error("paginasDeAudio precisa ser um inteiro maior que zero");
  }

  const comentarios = opcoes.comentarios ?? [
    "TITLE=Titulo Secreto",
    "ARTIST=Artista Secreto",
    "LOCATION=GPS -23.5",
  ];
  const todosOsComentarios = capa
    ? [...comentarios, `METADATA_BLOCK_PICTURE=${Buffer.from(capa).toString("base64")}`]
    : comentarios;

  const identificacao = codec === "vorbis" ? identificacaoVorbis(taxa) : cabecalhoOpus(taxa, preSkip);
  const comentariosEmPacote =
    codec === "vorbis"
      ? pacoteDeComentarios(concatenar(Uint8Array.of(0x03), ascii("vorbis")), todosOsComentarios, Uint8Array.of(0x01))
      : pacoteDeComentarios(ascii("OpusTags"), todosOsComentarios, new Uint8Array(0));
  const cabecalhos: Uint8Array[] = [comentariosEmPacote];
  if (codec === "vorbis") {
    cabecalhos.push(concatenar(Uint8Array.of(0x05), ascii("vorbis"), new Uint8Array(16)));
  }

  const paginas: Uint8Array[] = [];
  let sequencia = 0;
  paginas.push(pagina(2, 0, sequencia++, segmentosDo(identificacao)));

  const segmentosDeCabecalho = cabecalhos.flatMap(segmentosDo);
  for (let i = 0; i < segmentosDeCabecalho.length; i += SEGMENTOS_POR_PAGINA_DE_CABECALHO) {
    const trecho = segmentosDeCabecalho.slice(i, i + SEGMENTOS_POR_PAGINA_DE_CABECALHO);
    const continua = i > 0 && segmentosDeCabecalho[i - 1]!.valor === 255;
    paginas.push(pagina(continua ? 1 : 0, 0, sequencia++, trecho));
  }

  for (let i = 0; i < paginasDeAudio; i++) {
    const ultima = i === paginasDeAudio - 1;
    const posicao = ultima ? granulo : Math.floor((granulo * (i + 1)) / paginasDeAudio);
    paginas.push(pagina(ultima ? 4 : 0, posicao, sequencia++, segmentosDo(pacoteDeAudio())));
  }

  return concatenar(...paginas);
}
