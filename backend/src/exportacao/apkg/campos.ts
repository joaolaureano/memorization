import { rotuloSemMidia } from "../textos.ts";

/** Escapa texto de cartão para o campo HTML do Anki. */
export function escaparCampo(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\r?\n/g, "<br>");
}

/** Texto simples usado para calcular o campo de ordenação e o checksum. */
export function textoSimples(html: string): string {
  return html
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function frenteSemMidia(tipo: "imagem" | "audio", frente: string, idioma: "pt" | "en" | "es"): string {
  if (frente.trim()) return escaparCampo(frente);
  return rotuloSemMidia(tipo, idioma);
}
