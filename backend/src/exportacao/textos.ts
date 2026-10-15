// Textos do produto colocados no arquivo exportado (029, research R9).

export type IdiomaDoTexto = "pt" | "en" | "es";

const ROTULOS_SEM_MIDIA = {
  imagem: { pt: "[Imagem]", en: "[Image]", es: "[Imagen]" },
  audio: { pt: "[Áudio]", en: "[Audio]", es: "[Audio]" },
} as const;

/** Rótulo do Cartão de Mídia ilegível, usado quando a Frente ficaria vazia. */
export function rotuloSemMidia(tipo: "imagem" | "audio", idioma: IdiomaDoTexto): string {
  return ROTULOS_SEM_MIDIA[tipo][idioma];
}
