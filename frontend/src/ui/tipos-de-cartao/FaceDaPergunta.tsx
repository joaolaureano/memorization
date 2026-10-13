import { useState } from "react";

import { textoAlternativoDa, tipoDo } from "../../acervo-cliente/tipos-de-cartao";
import type { ItemDeEstudo } from "../../sessao-de-estudo/sessao-de-estudo";
import { ImagemDoCartao } from "./ImagemDoCartao";

/**
 * A Frente de um item da Sessão, por tipo (026, FR-416): Frente-Verso mostra a
 * Frente; Imagem mostra a Imagem direto e, se houver, o Texto da frente.
 * O Verso continua escondido até a revelação, como em qualquer Cartão.
 *
 * O endereço de exibição vale 15 minutos (FR-424): numa Sessão longa ele pode
 * vencer, e a primeira falha de carga pede um endereço novo (`renovar`) antes
 * de mostrar a Imagem como indisponível (FR-418).
 */
export function FaceDaPergunta({
  item,
  renovar,
}: {
  item: ItemDeEstudo;
  renovar?: (cartaoId: string) => Promise<string | null>;
}) {
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
  const [url, setUrl] = useState(item.imagem?.url ?? null);

  return (
    <ImagemDoCartao
      url={url}
      textoAlternativo={textoAlternativoDa(item)}
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
