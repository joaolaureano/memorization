// Interface do Module exportacao (029, research R2).

import type { ConteudoExportado } from "./apkg/pacote.ts";
import { FORMATOS_DE_EXPORTACAO, type IdDoFormato } from "./formatos.ts";
import { nomeDoArquivoDaExportacao } from "./nome-do-arquivo.ts";

/** Contexto do pedido de Exportação; `agora` é obrigatório (sem relógio oculto). */
export interface ContextoDeExportacao {
  readonly agora: Date;
  readonly fuso: string;
  readonly idioma: "pt" | "en" | "es";
  readonly lerMidia: (chave: string) => Promise<Uint8Array | null>;
  /** true quando o pedido foi "todos" (nome genérico mesmo com um só Baralho). */
  readonly pedidoDeTodos?: boolean;
}

export interface ResultadoDeExportacao {
  readonly bytes: Uint8Array;
  readonly nomeDoArquivo: string;
  readonly tipoDeConteudo: string;
  readonly cartoesSemMidia: number;
}

/**
 * Gera o arquivo de um pedido de Exportação no formato indicado. O nome vem de
 * `nomeDoArquivoDaExportacao` (FR-474): Baralho único por id → nome do Baralho;
 * vários ou "todos" → `memorization-AAAA-MM-DD.apkg`.
 */
export async function exportar(
  conteudo: ConteudoExportado,
  formato: IdDoFormato,
  contexto: ContextoDeExportacao,
): Promise<ResultadoDeExportacao> {
  const formatoEscolhido = FORMATOS_DE_EXPORTACAO.get(formato);
  if (!formatoEscolhido) throw new Error("Unsupported export format");
  const resultado = await formatoEscolhido.gerar(conteudo, contexto);
  return {
    bytes: resultado.bytes,
    nomeDoArquivo: nomeDoArquivoDaExportacao({
      nomesDosBaralhos: conteudo.baralhos.map((b) => b.nome),
      pedidoDeTodos: contexto.pedidoDeTodos ?? false,
      agora: contexto.agora,
      fuso: contexto.fuso,
    }),
    tipoDeConteudo: formatoEscolhido.tipoDeConteudo,
    cartoesSemMidia: resultado.cartoesSemMidia,
  };
}
