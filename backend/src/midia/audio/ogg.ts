import type { AudioReconhecido, LeitorDeContainer } from "./tipos.ts";

/**
 * Leitor de OGG (`audio/ogg`). Aceita um único fluxo lógico, Vorbis ou Opus.
 *
 * Regras (research R3, R4):
 * - reconhecimento: páginas `OggS` com CRC válido, em sequência até o fim do
 *   arquivo; a primeira página é BOS e a última é EOS (sem EOS o arquivo está
 *   truncado); o primeiro pacote é `\x01vorbis` ou `OpusHead`;
 * - codec aceito: Vorbis ou Opus;
 * - duração: última `granule_position` (Vorbis ÷ taxa; Opus, menos o pre-skip,
 *   ÷ 48 000);
 * - limpeza: no pacote de comentários (`\x03vorbis` ou `OpusTags`), cada
 *   comentário vira `X=` seguido de espaços, com o mesmo comprimento (inclui
 *   `METADATA_BLOCK_PICTURE`); o vendor fica; o CRC das páginas alteradas é
 *   recalculado.
 *
 * Nenhum byte do arquivo é confiado: cada leitura confere os limites, e
 * qualquer inconsistência devolve `null`.
 */

const CAMPO_CRC = 22;
const TAMANHO_DO_CABECALHO = 27;
const FLAG_BOS = 0x02;
const FLAG_EOS = 0x04;
const TAMANHO_MINIMO_VORBIS_ID = 30;
const TAMANHO_MINIMO_OPUS_HEAD = 19;
const TAMANHO_MINIMO_OPUS_TAGS_HEAD = 8;
const TAXA_DO_OPUS = 48_000;

const CRC_TABELA = (() => {
  const tabela = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    tabela[i] = r >>> 0;
  }
  return tabela;
})();

interface Pagina {
  inicio: number;
  fim: number;
  tipo: number;
  granule: bigint;
}

interface Fragmento {
  /** Índice da página que contém este pedaço do pacote. */
  pagina: number;
  /** Posição do pedaço no arquivo. */
  arquivo: number;
  /** Posição do pedaço dentro do pacote. */
  deslocamento: number;
  tamanho: number;
}

interface Pacote {
  tamanho: number;
  fragmentos: Fragmento[];
}

/** CRC do OGG sobre `[inicio, fim)` com o campo do CRC tratado como zero. */
function crcSobre(bytes: Uint8Array, inicio: number, fim: number): number {
  let crc = 0;
  for (let i = inicio; i < fim; i++) {
    const zerado = i >= inicio + CAMPO_CRC && i < inicio + CAMPO_CRC + 4;
    const b = zerado ? 0 : bytes[i]!;
    crc = ((crc << 8) ^ CRC_TABELA[((crc >>> 24) ^ b) & 0xff]!) >>> 0;
  }
  return crc;
}

function lerPaginas(bytes: Uint8Array): { paginas: Pagina[]; pacotes: Pacote[] } | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const paginas: Pagina[] = [];
  const pacotes: Pacote[] = [];
  let serie = -1;
  let pendente: Pacote | null = null;
  let inicio = 0;

  while (inicio < bytes.length) {
    if (inicio + TAMANHO_DO_CABECALHO > bytes.length) return null;
    if (bytes[inicio] !== 0x4f || bytes[inicio + 1] !== 0x67 || bytes[inicio + 2] !== 0x67 || bytes[inicio + 3] !== 0x53) {
      return null;
    }
    if (bytes[inicio + 4] !== 0) return null;

    const tipo = bytes[inicio + 5]!;
    const quantidade = bytes[inicio + 26]!;
    if (quantidade === 0) return null;

    const tabela = inicio + TAMANHO_DO_CABECALHO;
    const corpoInicio = tabela + quantidade;
    if (corpoInicio > bytes.length) return null;

    let corpo = 0;
    for (let j = 0; j < quantidade; j++) corpo += bytes[tabela + j]!;
    const fim = corpoInicio + corpo;
    if (fim > bytes.length) return null;

    if (crcSobre(bytes, inicio, fim) !== dv.getUint32(inicio + CAMPO_CRC, true)) return null;

    const serieDaPagina = dv.getUint32(inicio + 14, true);
    if (paginas.length === 0) {
      if ((tipo & FLAG_BOS) === 0) return null;
      serie = serieDaPagina;
    } else if (serieDaPagina !== serie) {
      return null;
    }

    const indice = paginas.length;
    paginas.push({ inicio, fim, tipo, granule: dv.getBigInt64(inicio + 6, true) });

    let cursor = corpoInicio;
    for (let j = 0; j < quantidade; j++) {
      const valor = bytes[tabela + j]!;
      pendente ??= { tamanho: 0, fragmentos: [] };
      if (valor > 0) {
        pendente.fragmentos.push({ pagina: indice, arquivo: cursor, deslocamento: pendente.tamanho, tamanho: valor });
        pendente.tamanho += valor;
      }
      cursor += valor;
      if (valor < 255) {
        if (pacotes.length < 2) pacotes.push(pendente);
        pendente = null;
      }
    }

    inicio = fim;
  }

  const ultima = paginas[paginas.length - 1];
  if (!ultima || (ultima.tipo & FLAG_EOS) === 0) return null;
  if (pendente !== null) return null;
  if (pacotes.length < 2) return null;
  return { paginas, pacotes };
}

/** Junta os pedaços de um pacote em uma cópia contígua. */
function juntarPacote(bytes: Uint8Array, pacote: Pacote): Uint8Array {
  const saida = new Uint8Array(pacote.tamanho);
  for (const f of pacote.fragmentos) {
    saida.set(bytes.subarray(f.arquivo, f.arquivo + f.tamanho), f.deslocamento);
  }
  return saida;
}

/** Intervalos `[inicio, fim)` de cada comentário dentro do pacote; `null` se inconsistente. */
function intervalosDeComentarios(pacote: Uint8Array, inicio: number): Array<[number, number]> | null {
  const dv = new DataView(pacote.buffer, pacote.byteOffset, pacote.byteLength);
  let p = inicio;
  if (p + 4 > pacote.length) return null;
  const tamanhoDoVendor = dv.getUint32(p, true);
  p += 4;
  if (p + tamanhoDoVendor > pacote.length) return null;
  p += tamanhoDoVendor;

  if (p + 4 > pacote.length) return null;
  const quantidade = dv.getUint32(p, true);
  p += 4;

  const intervalos: Array<[number, number]> = [];
  for (let i = 0; i < quantidade; i++) {
    // Cada comentário ocupa pelo menos 4 bytes, então o laço sempre avança.
    if (p + 4 > pacote.length) return null;
    const tamanho = dv.getUint32(p, true);
    p += 4;
    if (p + tamanho > pacote.length) return null;
    intervalos.push([p, p + tamanho]);
    p += tamanho;
  }
  return intervalos;
}

/** `X=` seguido de espaços, com exatamente `tamanho` bytes. */
function substituto(tamanho: number): Uint8Array {
  const saida = new Uint8Array(tamanho).fill(0x20);
  if (tamanho >= 1) saida[0] = 0x58; // X
  if (tamanho >= 2) saida[1] = 0x3d; // =
  return saida;
}

function limparCopia(
  bytes: Uint8Array,
  paginas: Pagina[],
  pacote: Pacote,
  intervalos: Array<[number, number]>,
): Uint8Array {
  const saida = new Uint8Array(bytes);
  const dv = new DataView(saida.buffer);
  const tocadas = new Set<number>();

  for (const [a, b] of intervalos) {
    const troca = substituto(b - a);
    for (const f of pacote.fragmentos) {
      const ini = Math.max(a, f.deslocamento);
      const fimDoTrecho = Math.min(b, f.deslocamento + f.tamanho);
      if (ini >= fimDoTrecho) continue;
      saida.set(troca.subarray(ini - a, fimDoTrecho - a), f.arquivo + (ini - f.deslocamento));
      tocadas.add(f.pagina);
    }
  }

  for (const indice of tocadas) {
    const pagina = paginas[indice]!;
    dv.setUint32(pagina.inicio + CAMPO_CRC, crcSobre(saida, pagina.inicio, pagina.fim), true);
  }
  return saida;
}

export const lerOgg: LeitorDeContainer = (bytes) => {
  const lido = lerPaginas(bytes);
  if (lido === null) return null;
  const { paginas, pacotes } = lido;

  let granule = -1n;
  for (let k = paginas.length - 1; k >= 0; k--) {
    if (paginas[k]!.granule >= 0n) {
      granule = paginas[k]!.granule;
      break;
    }
  }
  if (granule < 0n) return null;

  const cabecalho = juntarPacote(bytes, pacotes[0]!);
  const dv = new DataView(cabecalho.buffer, cabecalho.byteOffset, cabecalho.byteLength);
  const comentarios = juntarPacote(bytes, pacotes[1]!);

  let duracaoMs: number;
  let inicioDosComentarios: number;
  const ehVorbis =
    cabecalho.length >= TAMANHO_MINIMO_VORBIS_ID &&
    cabecalho[0] === 0x01 &&
    String.fromCharCode(...cabecalho.subarray(1, 7)) === "vorbis";
  const ehOpus =
    cabecalho.length >= TAMANHO_MINIMO_OPUS_HEAD &&
    String.fromCharCode(...cabecalho.subarray(0, 8)) === "OpusHead";

  if (ehVorbis) {
    const taxa = dv.getUint32(12, true);
    if (taxa === 0) return null;
    if (!isComentarioVorbis(comentarios)) return null;
    duracaoMs = Math.round((Number(granule) * 1000) / taxa);
    inicioDosComentarios = 7;
  } else if (ehOpus) {
    const preSkip = dv.getUint16(10, true);
    if (!isComentarioOpus(comentarios)) return null;
    if (Number(granule) < preSkip) return null;
    duracaoMs = Math.round(((Number(granule) - preSkip) * 1000) / TAXA_DO_OPUS);
    inicioDosComentarios = TAMANHO_MINIMO_OPUS_TAGS_HEAD;
  } else {
    return null;
  }

  const intervalos = intervalosDeComentarios(comentarios, inicioDosComentarios);
  if (intervalos === null) return null;

  const reconhecido: AudioReconhecido = {
    formato: "audio/ogg",
    duracaoMs,
    limpar: () => limparCopia(bytes, paginas, pacotes[1]!, intervalos),
  };
  return reconhecido;
};

function isComentarioVorbis(pacote: Uint8Array): boolean {
  return pacote.length >= 7 && pacote[0] === 0x03 && String.fromCharCode(...pacote.subarray(1, 7)) === "vorbis";
}

function isComentarioOpus(pacote: Uint8Array): boolean {
  return pacote.length >= TAMANHO_MINIMO_OPUS_TAGS_HEAD && String.fromCharCode(...pacote.subarray(0, 8)) === "OpusTags";
}
