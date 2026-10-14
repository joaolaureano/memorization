import { IDIOMAS, type Idioma } from "./tipos";

/** Escolhe o idioma guardado ou o idioma preferido do navegador. */
export function resolverIdiomaInicial(
  guardado: string | null,
  preferidos: readonly string[],
): Idioma {
  if (guardado !== null && IDIOMAS.includes(guardado as Idioma)) {
    return guardado as Idioma;
  }

  const preferido = preferidos[0]?.split("-")[0]?.toLowerCase();
  return preferido !== undefined && IDIOMAS.includes(preferido as Idioma)
    ? (preferido as Idioma)
    : "pt";
}
