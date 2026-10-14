import { useIdioma, type Catalogo } from "../../idioma";
import type { ReactNode } from "react";

import type { Cartao } from "../../acervo-cliente/cliente";
import { textoAlternativoDa, tipoDo } from "../../acervo-cliente/tipos-de-cartao";
import { ImagemDoCartao } from "./ImagemDoCartao";

/**
 * Como um Cartão aparece na lista do Baralho, por tipo (026, FR-415): o
 * rótulo textual do tipo e, no tipo Imagem, a miniatura direto no item, ao
 * lado do Texto da frente e do Verso.
 */
export function ResumoDoCartao({
  cartao,
  aoFalharImagem,
  children,
}: {
  cartao: Cartao;
  aoFalharImagem?: () => void;
  children?: ReactNode;
}) {
  const { textos } = useIdioma();
  const tipo = tipoDo(cartao);

  return (
    <div className={`linha-da-lista__texto linha-da-lista__texto--${tipo}`}>
      {tipo === "imagem" && (
        <ImagemDoCartao
          url={cartao.imagem?.url ?? null}
          textoAlternativo={textoAlternativoDa(cartao, textos.cartao.imagemSemDescricao)}
          descricao={cartao.textoAlternativo}
          variante="miniatura"
          aoFalhar={aoFalharImagem}
        />
      )}
      <div className="linha-da-lista__conteudo">
        <span className="selo selo--tipo">{textos.cartao.nomeDoTipo[tipo]}</span>
        {(tipo !== "imagem" || cartao.frente.trim() !== "") && (
          <p className="linha-da-lista__titulo">{cartao.frente}</p>
        )}
        <p className="linha-da-lista__verso">{cartao.verso}</p>
        {children}
      </div>
    </div>
  );
}

/** Como o Cartão é nomeado em ações e anúncios (FR-426). */
export function rotuloDoCartao(cartao: Cartao, textos: Catalogo): string {
  return tipoDo(cartao) === "imagem"
    ? textoAlternativoDa(cartao, textos.cartao.imagemSemDescricao)
    : cartao.frente;
}
