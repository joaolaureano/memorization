import type { LeitorDeContainer } from "./tipos.ts";

/**
 * Leitor de MP3 (`audio/mpeg`).
 *
 * Regras (research R3, R4):
 * - reconhecimento: ID3v2 opcional, depois pelo menos 3 quadros MPEG Layer III
 *   consecutivos com cabeçalho válido, cada um inteiro dentro do arquivo;
 * - codec aceito: MPEG-1/2/2.5 Layer III;
 * - duração: soma dos quadros percorrendo o arquivo inteiro, exata em CBR e VBR,
 *   sem depender do cabeçalho Xing;
 * - limpeza: remove ID3v2 (início), e para no fim do som, antes de ID3v1
 *   (`TAG`), APEv2 e Lyrics3; o quadro Xing/LAME é mantido.
 */

/** Taxas de bits em kbps, por índice (0 = livre e 15 = inválido, ambos recusados). */
const TAXAS_MPEG1_LAYER3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const TAXAS_MPEG2_LAYER3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

/** Frequências de amostragem em Hz, por versão (0 = MPEG-2.5, 2 = MPEG-2, 3 = MPEG-1). */
const FREQUENCIAS_POR_VERSAO: Readonly<Record<number, readonly number[]>> = {
  0: [11025, 12000, 8000],
  2: [22050, 24000, 16000],
  3: [44100, 48000, 32000],
};

interface Quadro {
  tamanho: number;
  amostras: number;
  frequencia: number;
}

/** Lê o cabeçalho de quadro em `off`. `null` quando não há cabeçalho MPEG Layer III válido. */
function lerCabecalhoDeQuadro(dv: DataView, off: number): Quadro | null {
  if (off + 4 > dv.byteLength) return null;
  if (dv.getUint8(off) !== 0xff) return null;

  const b1 = dv.getUint8(off + 1);
  const b2 = dv.getUint8(off + 2);
  if ((b1 & 0xe0) !== 0xe0) return null; // sincronismo de 11 bits

  const versao = (b1 >> 3) & 0x03;
  const layer = (b1 >> 1) & 0x03;
  if (layer !== 0x01) return null; // só Layer III (01)
  if (versao === 0x01) return null; // versão reservada

  const mpeg1 = versao === 0x03;
  const taxa = (mpeg1 ? TAXAS_MPEG1_LAYER3 : TAXAS_MPEG2_LAYER3)[b2 >> 4] ?? 0;
  if (taxa === 0) return null; // taxa livre ou inválida

  const frequencia = FREQUENCIAS_POR_VERSAO[versao]?.[(b2 >> 2) & 0x03];
  if (frequencia === undefined) return null; // índice 3 é reservado

  const padding = (b2 >> 1) & 0x01;
  const tamanho = Math.floor(((mpeg1 ? 144 : 72) * taxa * 1000) / frequencia) + padding;
  return { tamanho, amostras: mpeg1 ? 1152 : 576, frequencia };
}

/**
 * Onde o som começa: 0 sem ID3v2, ou depois da etiqueta ID3v2 do início.
 * `null` quando o tamanho declarado da etiqueta passa do fim do arquivo ou não é válido.
 */
function inicioDoSom(dv: DataView): number | null {
  if (dv.byteLength < 3) return 0;
  const assinatura = dv.getUint8(0) === 0x49 && dv.getUint8(1) === 0x44 && dv.getUint8(2) === 0x33;
  if (!assinatura) return 0;
  if (dv.byteLength < 10) return null;

  const versao = dv.getUint8(3);
  if (versao < 2 || versao > 4) return null;
  const sinalizadores = dv.getUint8(5);

  let tamanho = 0;
  for (let i = 6; i < 10; i++) {
    const byte = dv.getUint8(i);
    if ((byte & 0x80) !== 0) return null; // tamanho sincronizado usa só 7 bits por byte
    tamanho = tamanho * 128 + byte;
  }

  const rodape = versao === 4 && (sinalizadores & 0x10) !== 0 ? 10 : 0;
  const fim = 10 + tamanho + rodape;
  return fim <= dv.byteLength ? fim : null;
}

export const lerMp3: LeitorDeContainer = (bytes) => {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const inicio = inicioDoSom(dv);
  if (inicio === null) return null;

  let off = inicio;
  let quadros = 0;
  let amostras = 0;
  let frequenciaInicial = 0;

  // Cada passo avança pelo menos 72 bytes, então o laço termina dentro do arquivo.
  for (;;) {
    const quadro = lerCabecalhoDeQuadro(dv, off);
    if (quadro === null) {
      // Um cabeçalho cortado no fim do arquivo é estrutura truncada.
      if (off < dv.byteLength && off + 4 > dv.byteLength && dv.getUint8(off) === 0xff) return null;
      break; // fim do som: etiqueta (TAG, APETAGEX, LYRICS...) ou bytes sem quadro
    }
    if (off + quadro.tamanho > dv.byteLength) return null; // quadro declarado passa do fim

    if (quadros === 0) frequenciaInicial = quadro.frequencia;
    quadros++;
    amostras += quadro.amostras;
    off += quadro.tamanho;
  }

  if (quadros < 3) return null;

  const fim = off;
  return {
    formato: "audio/mpeg",
    duracaoMs: Math.round((amostras * 1000) / frequenciaInicial),
    limpar: () => bytes.slice(inicio, fim),
  };
};
