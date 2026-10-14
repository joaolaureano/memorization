import type { LeitorDeContainer } from "./tipos.ts";

/**
 * Leitor de WAV (`audio/wav`).
 *
 * Regras (research R3, R4):
 * - reconhecimento: `RIFF….WAVE` com `fmt ` antes de `data`;
 * - codec aceito: PCM (1), IEEE float (3) ou `WAVE_FORMAT_EXTENSIBLE` com esses
 *   subformatos;
 * - duração: tamanho de `data` ÷ byteRate;
 * - limpeza: os blocos `LIST`, `id3 `, `ID3 `, `bext`, `iXML` e `_PMX` viram
 *   `JUNK` com o conteúdo zerado.
 *
 * Os bytes do arquivo são hostis: cada leitura confere os limites antes de
 * acontecer, nenhum tamanho declarado é confiado sem caber no arquivo, e
 * qualquer defeito devolve `null`.
 */
export const lerWav: LeitorDeContainer = (bytes) => {
  const blocos = percorrerBlocos(bytes);
  if (blocos === null) return null;

  const fmt = blocos.find((bloco) => bloco.id === "fmt ");
  const data = blocos.find((bloco) => bloco.id === "data");
  if (fmt === undefined || data === undefined || fmt.inicio > data.inicio) return null;
  if (fmt.tamanho < 16) return null;

  const vista = vistaDe(bytes);
  const formatTag = vista.getUint16(fmt.corpo, true);
  const canais = vista.getUint16(fmt.corpo + 2, true);
  const taxa = vista.getUint32(fmt.corpo + 4, true);
  const byteRate = vista.getUint32(fmt.corpo + 8, true);
  const blockAlign = vista.getUint16(fmt.corpo + 12, true);

  if (!codecAceito(vista, formatTag, fmt)) return null;
  if (canais === 0 || taxa === 0 || byteRate === 0) return null;
  if (byteRate !== taxa * blockAlign) return null;

  const duracaoMs = Math.round((data.tamanho * 1000) / byteRate);

  return {
    formato: "audio/wav",
    duracaoMs,
    limpar() {
      const saida = bytes.slice();
      for (const bloco of blocos) {
        if (!ID_LIMPAVEIS.has(bloco.id)) continue;
        escreverAsciiNoArray(saida, bloco.inicio, "JUNK");
        // Zera o conteúdo e o pad (se houver); o tamanho declarado não muda.
        saida.fill(0, bloco.corpo, bloco.corpo + bloco.tamanho + (bloco.tamanho % 2));
      }
      return saida;
    },
  };
};

interface BlocoWav {
  id: string;
  /** Posição do cabeçalho de 8 bytes do bloco. */
  inicio: number;
  tamanho: number;
  /** Posição do conteúdo do bloco. */
  corpo: number;
}

const ID_LIMPAVEIS = new Set(["LIST", "id3 ", "ID3 ", "bext", "iXML", "_PMX"]);
const LIMITE_DE_BLOCOS = 4096;
const FORMATO_EXTENSIVEL = 0xfffe;
const DESLOCAMENTO_SUBFORMATO = 24;

/**
 * Percorre os blocos do RIFF/WAVE até o fim do arquivo. Um bloco com tamanho
 * zero, ou que passa do fim, encerra a leitura com `null`.
 */
function percorrerBlocos(bytes: Uint8Array): BlocoWav[] | null {
  if (bytes.byteLength < 12) return null;
  if (lerAscii(bytes, 0) !== "RIFF" || lerAscii(bytes, 8) !== "WAVE") return null;

  const vista = vistaDe(bytes);
  const blocos: BlocoWav[] = [];
  let posicao = 12;
  while (posicao < bytes.byteLength) {
    if (blocos.length >= LIMITE_DE_BLOCOS) return null;
    if (bytes.byteLength - posicao < 8) return null;

    const tamanho = vista.getUint32(posicao + 4, true);
    const corpo = posicao + 8;
    if (tamanho === 0 || tamanho > bytes.byteLength - corpo) return null;

    blocos.push({ id: lerAscii(bytes, posicao), inicio: posicao, tamanho, corpo });
    // O pad de um byte pode faltar no último bloco; o laço termina de qualquer forma.
    posicao = corpo + tamanho + (tamanho % 2);
  }
  return blocos;
}

function codecAceito(vista: DataView, formatTag: number, fmt: BlocoWav): boolean {
  if (formatTag === 1 || formatTag === 3) return true;
  if (formatTag !== FORMATO_EXTENSIVEL || fmt.tamanho < 40) return false;
  const subformato = vista.getUint16(fmt.corpo + DESLOCAMENTO_SUBFORMATO, true);
  return subformato === 1 || subformato === 3;
}

function vistaDe(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** Lê 4 caracteres ASCII; quem chama já conferiu que cabem no arquivo. */
function lerAscii(bytes: Uint8Array, posicao: number): string {
  return String.fromCharCode(bytes[posicao]!, bytes[posicao + 1]!, bytes[posicao + 2]!, bytes[posicao + 3]!);
}

function escreverAsciiNoArray(bytes: Uint8Array, posicao: number, texto: string): void {
  for (let i = 0; i < texto.length; i++) {
    bytes[posicao + i] = texto.charCodeAt(i);
  }
}
