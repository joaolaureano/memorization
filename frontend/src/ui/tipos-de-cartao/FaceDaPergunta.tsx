import { useIdioma } from "../../idioma";
import { useState } from "react";

import { textoAlternativoDa, tipoDo } from "../../acervo-cliente/tipos-de-cartao";
import type { ItemDeEstudo } from "../../sessao-de-estudo/sessao-de-estudo";
import { AudioDoCartao } from "./AudioDoCartao";
import { ImagemDoCartao } from "./ImagemDoCartao";

/**
 * A Frente de um item da Sessão, por tipo (026, FR-416; 028, FR-442): Frente-Verso
 * mostra a Frente; Imagem mostra a Imagem direto e, se houver, o Texto da
 * frente; Áudio mostra a Mensagem, se houver, e o tocador. O Verso continua
 * escondido até a revelação, como em qualquer Cartão, e o tocador segue
 * disponível depois dela.
 *
 * O endereço de exibição vale 15 minutos (FR-424): numa Sessão longa ele pode
 * vencer, e a primeira falha de carga pede um endereço novo (`renovar`) antes
 * de mostrar a Imagem ou o Áudio como indisponível (FR-418, FR-444).
 *
 * `posicao` é a posição do item na Sessão. O tocador do Áudio é chaveado por
 * ela, e não só pelo `cartaoId`: cada item seguinte remonta o tocador e o
 * Áudio anterior pausa, mesmo quando o Cartão se repete (FR-442).
 */
export function FaceDaPergunta({
  item,
  renovar,
  posicao,
}: {
  item: ItemDeEstudo;
  renovar?: (cartaoId: string) => Promise<string | null>;
  posicao?: number;
}) {
  if (tipoDo(item) === "audio") {
    return (
      <div className="conteudo-do-cartao conteudo-do-cartao--audio">
        {item.frente.trim() !== "" && <p>{item.frente}</p>}
        <AudioDoCartao
          key={posicao ?? item.cartaoId}
          url={item.audio?.url ?? null}
          duracaoMs={item.duracaoMs}
          variante="face"
          renovar={renovar === undefined ? undefined : () => renovar(item.cartaoId)}
        />
      </div>
    );
  }

  if (tipoDo(item) !== "imagem") {
    return <p className="conteudo-do-cartao" tabIndex={0}>{item.frente}</p>;
  }

  return (
    <div className="conteudo-do-cartao conteudo-do-cartao--imagem" tabIndex={0}>
      {/* Um componente por item: a falha de um não contamina o seguinte. */}
      <ImagemDaFace key={item.cartaoId} item={item} renovar={renovar} />
      {item.frente.trim() !== "" && <p>{item.frente}</p>}
    </div>
  );
}

function ImagemDaFace({
  item,
  renovar,
}: {
  item: ItemDeEstudo;
  renovar?: (cartaoId: string) => Promise<string | null>;
}) {
  const { textos } = useIdioma();
  const [url, setUrl] = useState(item.imagem?.url ?? null);

  return (
    <ImagemDoCartao
      url={url}
      textoAlternativo={textoAlternativoDa(item, textos.cartao.imagemSemDescricao)}
      descricao={item.textoAlternativo}
      variante="face"
      aoFalhar={
        renovar === undefined
          ? undefined
          : () => void renovar(item.cartaoId).then((nova) => setUrl(nova))
      }
    />
  );
}
