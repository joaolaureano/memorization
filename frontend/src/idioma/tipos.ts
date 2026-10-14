export type Idioma = "pt" | "en" | "es";

export const IDIOMAS: readonly Idioma[] = ["pt", "en", "es"];

export const LOCALE: Record<Idioma, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-419",
};

export const SIGLA: Record<Idioma, string> = {
  pt: "PT",
  en: "EN",
  es: "ES",
};

export const NOME_NATIVO: Record<Idioma, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
};
