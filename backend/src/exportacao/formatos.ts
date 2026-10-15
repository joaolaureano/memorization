// Registro dos Formatos de exportação (029, research R2).

import { exportar as gerarPacoteAnki, type ConteudoExportado, type ContextoDaExportacao, type ResultadoDoPacote } from "./apkg/pacote.ts";

/** Identificador de um Formato de exportação (FR-462). */
export type IdDoFormato = "apkg";

/**
 * Formato de exportação (FR-461, FR-462): identidade, extensão, tipo de
 * conteúdo e a geração do arquivo. Uma entrada por arquivo, como em `ALGORITMOS`.
 */
export interface FormatoDeExportacao {
  readonly id: IdDoFormato;
  readonly extensao: string;
  readonly tipoDeConteudo: string;
  gerar(conteudo: ConteudoExportado, contexto: ContextoDaExportacao): Promise<ResultadoDoPacote>;
}

const apkg: FormatoDeExportacao = {
  id: "apkg",
  extensao: "apkg",
  tipoDeConteudo: "application/octet-stream",
  gerar: (conteudo, contexto) => gerarPacoteAnki(conteudo, "apkg", contexto),
};

/** Registro dos formatos disponíveis; hoje só o pacote Anki (FR-462). */
export const FORMATOS_DE_EXPORTACAO: ReadonlyMap<"apkg", FormatoDeExportacao> =
  new Map<"apkg", FormatoDeExportacao>([[apkg.id, apkg]]);

/** Diz se um valor (vindo de fora) é um formato conhecido. */
export function ehFormatoDeExportacao(valor: unknown): valor is IdDoFormato {
  return typeof valor === "string" && FORMATOS_DE_EXPORTACAO.has(valor as IdDoFormato);
}
