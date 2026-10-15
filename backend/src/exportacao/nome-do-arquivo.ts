import { hojeNoFuso } from "../agenda/datas.ts";

export function nomeDoArquivoDeExportacao(nome: string): string {
  const seguro = nome
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "-")
    .slice(0, 100)
    .trim();
  return `${seguro || "exportacao"}.apkg`;
}

/**
 * Nome do arquivo de um pedido de Exportação (FR-474, research R11).
 * Um só Baralho escolhido por id → nome do Baralho; vários, ou "todos" (mesmo
 * com um só Baralho) → `memorization-AAAA-MM-DD.apkg`, com a data civil de
 * `agora` no fuso do usuário.
 */
export function nomeDoArquivoDaExportacao(pedido: {
  readonly nomesDosBaralhos: readonly string[];
  readonly pedidoDeTodos: boolean;
  readonly agora: Date;
  readonly fuso: string;
}): string {
  if (!pedido.pedidoDeTodos && pedido.nomesDosBaralhos.length === 1) {
    return nomeDoArquivoDeExportacao(pedido.nomesDosBaralhos[0]!);
  }
  return `memorization-${hojeNoFuso(pedido.fuso, pedido.agora)}.apkg`;
}
