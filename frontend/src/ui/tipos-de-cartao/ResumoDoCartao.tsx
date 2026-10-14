import { LOCALE, duracaoFalada, formatarDuracao, useIdioma, type Catalogo } from "../../idioma";
import type { ReactNode } from "react";

import type { Cartao } from "../../acervo-cliente/cliente";
import { textoAlternativoDa, tipoDo } from "../../acervo-cliente/tipos-de-cartao";
import { AudioDoCartao } from "./AudioDoCartao";
import { ImagemDoCartao } from "./ImagemDoCartao";

/**
 * Como um Cartão aparece na lista do Baralho, por tipo (026, FR-415; 028,
 * FR-441): o rótulo textual do tipo e, no tipo Imagem, a miniatura direto no
 * item; no tipo Áudio, o tocador compacto e a duração, com a Mensagem só
 * quando ela existe.
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
  const { textos, idioma } = useIdioma();
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
        {(tipo === "frente-verso" || cartao.frente.trim() !== "") && (
          <p className="linha-da-lista__titulo">{cartao.frente}</p>
        )}
        {tipo === "audio" && (
          <div className="linha-da-lista__audio">
            <AudioDoCartao
              url={cartao.audio?.url ?? null}
              duracaoMs={cartao.duracaoMs}
              variante="compacto"
            />
            {cartao.duracaoMs !== undefined && (
              <span
                className="linha-da-lista__duracao"
                role="img"
                aria-label={textos.tocador.duracao(duracaoFalada(cartao.duracaoMs, LOCALE[idioma]))}
              >
                {formatarDuracao(cartao.duracaoMs, LOCALE[idioma])}
              </span>
            )}
          </div>
        )}
        <p className="linha-da-lista__verso">{cartao.verso}</p>
        {children}
      </div>
    </div>
  );
}

/** Como o Cartão é nomeado em ações e anúncios (FR-426; 028, FR-441). */
export function rotuloDoCartao(cartao: Cartao, textos: Catalogo): string {
  if (tipoDo(cartao) === "imagem") {
    return textoAlternativoDa(cartao, textos.cartao.imagemSemDescricao);
  }

  if (tipoDo(cartao) === "audio") {
    return cartao.frente.trim() !== "" ? cartao.frente : textos.cartao.audioSemMensagem;
  }

  return cartao.frente;
}
