export type FormatoDeAudio = "audio/mpeg" | "audio/mp4" | "audio/ogg" | "audio/webm" | "audio/wav";

/** O que cada leitor de contêiner devolve ao reconhecer o arquivo. */
export interface AudioReconhecido {
  formato: FormatoDeAudio;
  duracaoMs: number;
  /** Devolve os bytes sem metadados (FR-454); nunca altera o som. */
  limpar(): Uint8Array;
}

/** Um leitor de contêiner: `null` quando os bytes não são deste contêiner ou estão inválidos. */
export type LeitorDeContainer = (bytes: Uint8Array) => AudioReconhecido | null;
