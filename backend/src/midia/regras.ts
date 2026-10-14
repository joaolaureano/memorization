import { reconhecerAudio, LIMITE_DE_BYTES_DO_AUDIO } from "./audio/reconhecer.ts";
import type { FormatoDeAudio } from "./audio/tipos.ts";
import {
  LIMITE_DE_BYTES_DA_IMAGEM,
  PREFIXO_DA_MIDIA,
  type FormatoDeImagem,
  type Midia,
} from "./armazem.ts";
import { prepararImagemConfirmada } from "./imagem/formato.ts";

/**
 * As regras por Mídia do `ArmazemDeMidia` (research R2): o limite de tamanho,
 * o prefixo da chave ativa e a confirmação pelo conteúdo real. Os dois
 * Adapters usam este registro, para que a Imagem e o Áudio tenham as mesmas
 * regras na nuvem e no modo local.
 */

/** Resultado de conferir o conteúdo de uma Mídia, já sem metadados. */
export type ResultadoDaRegra =
  | {
      ok: true;
      formato: FormatoDeImagem | FormatoDeAudio;
      bytes: Uint8Array;
      duracaoMs?: number;
    }
  | { ok: false; motivo: "formato" | "tamanho" | "duracao" };

export interface RegrasDaMidia {
  /** Maior arquivo aceito para a Mídia, em bytes. */
  limiteEmBytes: number;
  /** Prefixo da chave ativa (`imagens/` ou `audios/`). */
  prefixo: (typeof PREFIXO_DA_MIDIA)[Midia];
  /** Confere o conteúdo real e devolve o arquivo pronto para ser ativo. */
  confirmar(bytes: Uint8Array): ResultadoDaRegra;
}

export const REGRAS_DA_MIDIA: Readonly<Record<Midia, RegrasDaMidia>> = {
  imagem: {
    limiteEmBytes: LIMITE_DE_BYTES_DA_IMAGEM,
    prefixo: PREFIXO_DA_MIDIA.imagem,
    confirmar(bytes) {
      const preparada = prepararImagemConfirmada(bytes);
      return preparada.ok
        ? { ok: true, formato: preparada.formato, bytes: preparada.bytes }
        : preparada;
    },
  },
  audio: {
    limiteEmBytes: LIMITE_DE_BYTES_DO_AUDIO,
    prefixo: PREFIXO_DA_MIDIA.audio,
    confirmar(bytes) {
      const reconhecido = reconhecerAudio(bytes);
      return reconhecido.ok
        ? {
            ok: true,
            formato: reconhecido.formato,
            bytes: reconhecido.bytes,
            duracaoMs: reconhecido.duracaoMs,
          }
        : reconhecido;
    },
  },
};

/** Maior limite entre as Mídias: o tamanho máximo que a rota local recebe. */
export const MAIOR_LIMITE_DE_BYTES = Math.max(
  ...Object.values(REGRAS_DA_MIDIA).map((regras) => regras.limiteEmBytes),
);
