import type { FormatoDeAudio, LeitorDeContainer } from "./tipos.ts";
import { lerMp3 } from "./mp3.ts";
import { lerMp4 } from "./mp4.ts";
import { lerOgg } from "./ogg.ts";
import { lerWav } from "./wav.ts";
import { lerWebm } from "./webm.ts";

export const LIMITE_DE_BYTES_DO_AUDIO = 10_485_760;
export const LIMITE_DE_DURACAO_DO_AUDIO_EM_MS = 300_000;

export type ResultadoDoReconhecimento =
  | { ok: true; formato: FormatoDeAudio; duracaoMs: number; bytes: Uint8Array }
  | { ok: false; motivo: "formato" | "tamanho" | "duracao" };

/** Ordem fixa de tentativa: o primeiro leitor que reconhece o arquivo vence. */
const LEITORES: readonly LeitorDeContainer[] = [lerMp3, lerMp4, lerOgg, lerWebm, lerWav];

/**
 * Interface única do reconhecimento de Áudio (FR-436, FR-437, FR-454).
 *
 * Confere o tamanho antes de ler qualquer estrutura, pelo conteúdo real e
 * nunca pelo nome ou pelo tipo declarado. Devolve o formato, a duração
 * medida e os bytes já sem metadados. Os contêineres são internos a este
 * módulo: quem chama só vê este resultado.
 */
export function reconhecerAudio(bytes: Uint8Array): ResultadoDoReconhecimento {
  if (bytes.byteLength === 0 || bytes.byteLength > LIMITE_DE_BYTES_DO_AUDIO) {
    return { ok: false, motivo: "tamanho" };
  }

  let reconhecido: ReturnType<LeitorDeContainer> = null;
  for (const leitor of LEITORES) {
    try {
      reconhecido = leitor(bytes);
    } catch {
      reconhecido = null;
    }
    if (reconhecido !== null) break;
  }
  if (reconhecido === null) return { ok: false, motivo: "formato" };

  const { formato, duracaoMs } = reconhecido;
  if (!Number.isFinite(duracaoMs) || duracaoMs <= 0) return { ok: false, motivo: "formato" };
  if (duracaoMs > LIMITE_DE_DURACAO_DO_AUDIO_EM_MS) return { ok: false, motivo: "duracao" };

  return { ok: true, formato, duracaoMs, bytes: reconhecido.limpar() };
}
