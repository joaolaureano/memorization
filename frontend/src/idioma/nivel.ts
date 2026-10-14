import { pt, type Catalogo } from "./pt";

/**
 * O rótulo de um nível de Avaliação no Idioma da interface (027, caso-limite
 * da spec): os rótulos padrão do SM-2 (Errei, Difícil, Bom, Fácil) são Texto
 * do produto e vêm do catálogo pela chave. Um rótulo próprio de outro
 * algoritmo aparece como veio (015).
 */
export function rotuloDoNivel(
  chave: string,
  rotulo: string | null | undefined,
  textos: Catalogo,
): string {
  const padrao: Record<string, string> = pt.sessao.nivel;
  const traduzidos: Record<string, string> = textos.sessao.nivel;

  if (rotulo === null || rotulo === undefined || rotulo === padrao[chave]) {
    return traduzidos[chave] ?? rotulo ?? chave;
  }

  return rotulo;
}
