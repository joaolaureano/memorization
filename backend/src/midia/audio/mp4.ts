import type { LeitorDeContainer } from "./tipos.ts";

/**
 * Leitor de M4A (`audio/mp4`).
 *
 * - reconhecimento: caixa `ftyp` com marca `M4A `, `mp42`, `isom`, `mp41` ou `M4B `;
 *   `moov` com uma trilha `soun` cuja entrada de amostra é `mp4a`; nenhuma
 *   trilha `vide`;
 * - codec aceito: AAC (`mp4a`);
 * - duração: `mdhd` da trilha de som (`duration / timescale`). MP4 fragmentado
 *   sem duração é recusado;
 * - limpeza: as caixas `udta`, `meta` (em `moov` e nas trilhas) e `uuid` de
 *   nível superior viram `free` com o conteúdo zerado, mantendo o tamanho. Assim
 *   `stco`/`co64` continuam válidos e o `mdat` nunca muda.
 *
 * Todas as leituras são limitadas ao buffer e a profundidade e quantidade de
 * caixas são limitadas. Entrada malformada resulta em `null`, nunca em exceção.
 */

const MARCAS_ACEITAS: ReadonlySet<string> = new Set(["M4A ", "mp42", "isom", "mp41", "M4B "]);
const PROFUNDIDADE_MAXIMA = 16;
const CAIXAS_POR_NIVEL = 4096;
const MARCAS_MAXIMAS = 256;
const CONTEINERES_DA_TRILHA: ReadonlySet<string> = new Set([
  "trak",
  "mdia",
  "minf",
  "stbl",
  "edts",
  "dinf",
]);
const DOIS_A_32 = 4294967296;

interface Caixa {
  tipo: string;
  inicio: number;
  fim: number;
  conteudo: number;
}

interface TrilhaLida {
  handler: string | null;
  codec: string | null;
  escala: number;
  duracao: number;
}

export const lerMp4: LeitorDeContainer = (bytes) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const topo = lerCaixas(view, 0, bytes.byteLength, 0, true);
  if (topo === null || topo.length === 0) return null;

  const ftyp = topo[0];
  if (ftyp.tipo !== "ftyp" || !marcaAceita(view, ftyp)) return null;

  const moov = topo.find((caixa) => caixa.tipo === "moov");
  if (moov === undefined) return null;
  const filhosDoMoov = lerCaixas(view, moov.conteudo, moov.fim, 1, false);
  if (filhosDoMoov === null) return null;

  let som: TrilhaLida | null = null;
  for (const trak of filhosDoMoov) {
    if (trak.tipo !== "trak") continue;
    const trilha = lerTrilha(view, trak);
    if (trilha === null) return null;
    if (trilha.handler === "vide") return null;
    if (trilha.handler === "soun" && som === null) som = trilha;
  }
  if (som === null || som.codec !== "mp4a") return null;
  if (som.escala === 0 || som.duracao === 0) return null;

  return {
    formato: "audio/mp4",
    duracaoMs: Math.round((som.duracao * 1000) / som.escala),
    limpar: () => limparMp4(bytes),
  };
};

/**
 * Copia os bytes e neutraliza `udta`, `meta` e `uuid` de nível superior, sem
 * mudar nenhum tamanho. Nunca altera o `mdat` nem as trilhas de som.
 */
function limparMp4(bytes: Uint8Array): Uint8Array {
  const saida = bytes.slice();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const topo = lerCaixas(view, 0, bytes.byteLength, 0, true) ?? [];
  for (const caixa of topo) {
    if (caixa.tipo === "uuid") neutralizar(saida, caixa);
    if (caixa.tipo === "moov") limparContainer(view, saida, caixa, 1);
  }
  return saida;
}

function limparContainer(view: DataView, saida: Uint8Array, pai: Caixa, profundidade: number): void {
  const filhos = lerCaixas(view, pai.conteudo, pai.fim, profundidade, false);
  if (filhos === null) return;
  for (const filho of filhos) {
    if (filho.tipo === "udta" || filho.tipo === "meta") {
      neutralizar(saida, filho);
    } else if (CONTEINERES_DA_TRILHA.has(filho.tipo)) {
      limparContainer(view, saida, filho, profundidade + 1);
    }
  }
}

/** Troca o tipo por `free` e zera o conteúdo; o tamanho da caixa fica igual. */
function neutralizar(saida: Uint8Array, caixa: Caixa): void {
  const letras = [0x66, 0x72, 0x65, 0x65]; // "free"
  saida.set(letras, caixa.inicio + 4);
  saida.fill(0, caixa.conteudo, caixa.fim);
}

/**
 * Lê as caixas consecutivas do intervalo `[inicio, fim)`. Devolve `null` se
 * alguma caixa não cabe no intervalo, se o tamanho for menor que o cabeçalho
 * ou se houver bytes sobrando que não formam uma caixa.
 */
function lerCaixas(
  view: DataView,
  inicio: number,
  fim: number,
  profundidade: number,
  topo: boolean,
): Caixa[] | null {
  if (profundidade > PROFUNDIDADE_MAXIMA) return null;
  const caixas: Caixa[] = [];
  let pos = inicio;
  while (pos < fim) {
    if (caixas.length >= CAIXAS_POR_NIVEL) return null;
    if (fim - pos < 8) return null;

    const tamanho32 = view.getUint32(pos);
    const tipo = lerTipo(view, pos + 4);
    let total: number;
    let cabecalho = 8;

    if (tamanho32 === 1) {
      if (fim - pos < 16) return null;
      const grande = lerU64(view, pos + 8);
      if (grande === null) return null;
      total = grande;
      cabecalho = 16;
    } else if (tamanho32 === 0) {
      // Tamanho zero só vale para o mdat que vai até o fim do arquivo.
      if (!(topo && tipo === "mdat")) return null;
      total = fim - pos;
    } else {
      total = tamanho32;
    }

    if (total < cabecalho) return null;
    if (total > fim - pos) return null;

    caixas.push({ tipo, inicio: pos, fim: pos + total, conteudo: pos + cabecalho });
    pos += total;
  }
  return caixas;
}

function marcaAceita(view: DataView, ftyp: Caixa): boolean {
  if (ftyp.fim - ftyp.conteudo < 8) return false;
  // Bytes 0..3 do conteúdo: marca principal. Bytes 4..7: versão menor, ignorada.
  if (MARCAS_ACEITAS.has(lerTipo(view, ftyp.conteudo))) return true;
  let contadas = 0;
  for (let p = ftyp.conteudo + 8; p + 4 <= ftyp.fim && contadas < MARCAS_MAXIMAS; p += 4) {
    if (MARCAS_ACEITAS.has(lerTipo(view, p))) return true;
    contadas++;
  }
  return false;
}

function lerTrilha(view: DataView, trak: Caixa): TrilhaLida | null {
  const filhos = lerCaixas(view, trak.conteudo, trak.fim, 2, false);
  if (filhos === null) return null;
  const mdia = unica(filhos, "mdia");
  if (mdia === null) return null;

  const filhosDaMdia = lerCaixas(view, mdia.conteudo, mdia.fim, 3, false);
  if (filhosDaMdia === null) return null;

  const hdlr = unica(filhosDaMdia, "hdlr");
  const handler = hdlr !== null && hdlr.fim - hdlr.conteudo >= 12 ? lerTipo(view, hdlr.conteudo + 8) : null;

  const mdhdCaixa = unica(filhosDaMdia, "mdhd");
  const mdhd = mdhdCaixa === null ? null : lerMdhd(view, mdhdCaixa);

  let codec: string | null = null;
  const minf = unica(filhosDaMdia, "minf");
  if (minf !== null) {
    const filhosDaMinf = lerCaixas(view, minf.conteudo, minf.fim, 4, false);
    if (filhosDaMinf === null) return null;
    const stbl = unica(filhosDaMinf, "stbl");
    if (stbl !== null) {
      const filhosDaStbl = lerCaixas(view, stbl.conteudo, stbl.fim, 5, false);
      if (filhosDaStbl === null) return null;
      const stsd = unica(filhosDaStbl, "stsd");
      if (stsd !== null) codec = lerPrimeiroCodec(view, stsd);
    }
  }

  return {
    handler,
    codec,
    escala: mdhd?.escala ?? 0,
    duracao: mdhd?.duracao ?? 0,
  };
}

function lerMdhd(view: DataView, caixa: Caixa): { escala: number; duracao: number } | null {
  const p = caixa.conteudo;
  if (caixa.fim - p < 1) return null;
  const versao = view.getUint8(p);
  if (versao === 0) {
    if (caixa.fim - p < 20) return null;
    return { escala: view.getUint32(p + 12), duracao: view.getUint32(p + 16) };
  }
  if (versao === 1) {
    if (caixa.fim - p < 32) return null;
    const duracao = lerU64(view, p + 24);
    if (duracao === null) return null;
    return { escala: view.getUint32(p + 20), duracao };
  }
  return null;
}

/** Tipo da primeira entrada de amostra do `stsd` (ver/flags, contagem, depois a entrada). */
function lerPrimeiroCodec(view: DataView, stsd: Caixa): string | null {
  const entrada = stsd.conteudo + 8;
  if (stsd.fim - entrada < 8) return null;
  const tamanho = view.getUint32(entrada);
  if (tamanho < 8 || tamanho > stsd.fim - entrada) return null;
  return lerTipo(view, entrada + 4);
}

function unica(caixas: Caixa[], tipo: string): Caixa | null {
  return caixas.find((caixa) => caixa.tipo === tipo) ?? null;
}

function lerTipo(view: DataView, pos: number): string {
  return String.fromCharCode(
    view.getUint8(pos),
    view.getUint8(pos + 1),
    view.getUint8(pos + 2),
    view.getUint8(pos + 3),
  );
}

function lerU64(view: DataView, pos: number): number | null {
  if (pos + 8 > view.byteLength) return null;
  const valor = view.getUint32(pos) * DOIS_A_32 + view.getUint32(pos + 4);
  return Number.isSafeInteger(valor) ? valor : null;
}
