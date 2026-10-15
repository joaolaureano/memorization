// Module demonstracao — creditos (030, research R2/R3/R7/R8).

import { readFileSync } from "node:fs";

import { pastaDaDemonstracao } from "./midia.ts";

/** Crédito de uma Mídia de demonstração (`creditos.json`, FR-494). */
export interface CreditoDeMidia {
  chave: string;
  baralho: string;
  cartao: string;
  cientifico?: string;
  titulo: string;
  autor: string;
  /** Identificador SPDX, ou `LicenseRef-Public-Domain`. */
  licenca: string;
  fonte: string;
  /** Duração do Áudio, em milissegundos (só os pássaros). */
  duracaoMs?: number;
  observacao?: string;
}

/**
 * Os créditos do Acervo de demonstração, lidos do arquivo versionado ao lado
 * da pasta de mídia. Lidos uma vez, na carga do Module.
 */
export const CREDITOS: readonly CreditoDeMidia[] = Object.freeze(
  JSON.parse(
    readFileSync(new URL("creditos.json", pastaDaDemonstracao()), "utf8"),
  ) as CreditoDeMidia[],
);
