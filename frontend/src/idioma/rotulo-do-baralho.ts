import type { Catalogo } from "./pt";

export interface RegistroComOrigemDeBaralho {
  origem: "baralho" | "revisao" | "temporario";
  nomeDoBaralho: string;
}

/** Apresenta nomes derivados pela origem e conserva nomes escritos pela pessoa. */
export function rotuloDoBaralhoDoRegistro(
  registro: RegistroComOrigemDeBaralho,
  textos: Catalogo,
): string {
  if (registro.origem === "revisao") return textos.sessao.revisaoDoDia;
  // O nome digitado é Conteúdo do Usuário; sem nome, vale o rótulo (FR-020).
  if (registro.origem === "temporario") {
    return registro.nomeDoBaralho.trim() || textos.sessao.baralhoTemporario;
  }
  return registro.nomeDoBaralho;
}
