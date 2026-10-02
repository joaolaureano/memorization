import type { ReactNode } from "react";

/**
 * Os três estados de uma carga de dados: carregando, falha e vazio
 * (FR-144, FR-153).
 *
 * A união discriminada por `estado` deixa cada variante trazer só o que faz
 * sentido — `aoTentarNovamente` na falha, `acao` no vazio —, e é isso que
 * impede o chamador de oferecer uma repetição onde não houve falha, ou uma
 * ação onde não há acervo vazio.
 *
 * Os papéis são de propósito: `role="status"` para o carregamento e
 * `role="alert"` para a falha, de modo que leitores de tela anunciem a mudança
 * sem que a tela precise mexer no foco.
 */
export function EstadoDaCarga(
  props:
    | { estado: "carregando"; mensagem: string }
    | { estado: "falha"; mensagem: string; aoTentarNovamente: () => void }
    | { estado: "vazio"; mensagem: string; acao?: ReactNode },
) {
  if (props.estado === "carregando") {
    return (
      <p role="status" className="carregando">
        {props.mensagem}
      </p>
    );
  }

  if (props.estado === "falha") {
    return (
      <div role="alert" className="aviso aviso--erro">
        <p>{props.mensagem}</p>
        <button
          type="button"
          className="botao botao--secundario"
          onClick={props.aoTentarNovamente}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="estado-vazio">
      <p>{props.mensagem}</p>
      {props.acao}
    </div>
  );
}
