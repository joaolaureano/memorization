import { removerMetadados } from "./metadados.ts";
import { LIMITE_DE_BYTES_DA_IMAGEM, type FormatoDeImagem } from "../armazem.ts";

/**
 * Reconhece o formato pela assinatura dos primeiros bytes, nunca pelo nome ou
 * pela declaração do navegador (FR-411, research R5).
 */
export function detectarFormato(bytes: Uint8Array): FormatoDeImagem | null {
  const comeca = (assinatura: readonly number[], desde = 0): boolean =>
    assinatura.every((byte, i) => bytes[desde + i] === byte);
  const ascii = (texto: string, desde = 0): boolean =>
    comeca([...texto].map((c) => c.charCodeAt(0)), desde);

  if (comeca([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (comeca([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii("GIF87a") || ascii("GIF89a")) return "image/gif";
  if (ascii("RIFF") && ascii("WEBP", 8)) return "image/webp";
  return null;
}

/**
 * A regra comum de `confirmar`: confere tamanho e formato reais e devolve o
 * arquivo já sem metadados, pronto para ser gravado como ativo.
 */
export function prepararImagemConfirmada(
  bytes: Uint8Array,
):
  | { ok: true; formato: FormatoDeImagem; bytes: Uint8Array }
  | { ok: false; motivo: "formato" | "tamanho" } {
  if (bytes.length === 0 || bytes.length > LIMITE_DE_BYTES_DA_IMAGEM) {
    return { ok: false, motivo: "tamanho" };
  }

  const formato = detectarFormato(bytes);

  if (formato === null) {
    return { ok: false, motivo: "formato" };
  }

  const limpo = removerMetadados(bytes, formato);

  return limpo === null
    ? { ok: false, motivo: "formato" }
    : { ok: true, formato, bytes: limpo };
}
