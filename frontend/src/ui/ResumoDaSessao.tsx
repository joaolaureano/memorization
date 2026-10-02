import { useId, useState } from "react";
import type { ReactNode } from "react";

/**
 * Resumo da Sessão (T1208; specs/013-estatisticas-e-historico/contracts/contratos.md §7).
 *
 * Componente de apresentação puro: recebe os Itens **na ordem em que foram
 * apresentados** e deriva daí tudo o que mostra — totais, percentual e grupos
 * (FR-174, FR-175). A fonte é única, então o total exibido nunca divergirá da
 * soma dos dois grupos, e o componente não precisa conhecer a Sessão, o
 * histórico nem o transporte.
 *
 * Cada grupo é um botão que expande e recolhe a sua lista, com
 * `aria-expanded`/`aria-controls` — os dois grupos são independentes e nascem
 * recolhidos. Um grupo vazio é apenas um botão desabilitado, descrito pelo
 * texto "Nenhum acerto nesta Sessão" / "Nenhum erro nesta Sessão" (FR-175).
 *
 * O componente **não** tem `h1`: o título ("Resumo da Sessão") pertence à
 * página que o usa, que também é dona das ações — recebidas em `children` e
 * renderizadas ao fim (FR-174).
 */

/** Um Item já respondido, como o Resumo precisa exibir (FR-176). */
export interface ItemDoResumo {
  frente: string;
  verso: string;
  resultado: "acertou" | "errou";
}

export function ResumoDaSessao({
  itens,
  children,
}: {
  itens: readonly ItemDoResumo[];
  children?: ReactNode;
}) {
  const acertos = itens.filter((item) => item.resultado === "acertou");
  const erros = itens.filter((item) => item.resultado === "errou");
  const estudados = itens.length;
  const percentual =
    estudados === 0 ? 0 : Math.round((acertos.length / estudados) * 100);

  const listaDeAcertos = useId();
  const listaDeErros = useId();
  const descricaoDosAcertos = useId();
  const descricaoDosErros = useId();

  const [acertosExpandidos, setAcertosExpandidos] = useState(false);
  const [errosExpandidos, setErrosExpandidos] = useState(false);

  return (
    <div className="pilha">
      <p className="percentual">
        <span>{percentual}%</span>{" "}
        <span className="texto-secundario">de acertos</span>
      </p>
      <p className="texto-secundario">
        {acertos.length} de {estudados} Itens
      </p>

      <div className="acoes">
        <button
          type="button"
          className="botao botao--secundario"
          aria-expanded={acertosExpandidos}
          aria-controls={listaDeAcertos}
          aria-describedby={
            acertos.length === 0 ? descricaoDosAcertos : undefined
          }
          disabled={acertos.length === 0}
          onClick={() => setAcertosExpandidos((expandidos) => !expandidos)}
        >
          Acertos ({acertos.length})
        </button>
        <button
          type="button"
          className="botao botao--secundario"
          aria-expanded={errosExpandidos}
          aria-controls={listaDeErros}
          aria-describedby={erros.length === 0 ? descricaoDosErros : undefined}
          disabled={erros.length === 0}
          onClick={() => setErrosExpandidos((expandidos) => !expandidos)}
        >
          Erros ({erros.length})
        </button>
      </div>

      {acertos.length === 0 && (
        <p id={descricaoDosAcertos} className="ajuda">
          Nenhum acerto nesta Sessão
        </p>
      )}
      {erros.length === 0 && (
        <p id={descricaoDosErros} className="ajuda">
          Nenhum erro nesta Sessão
        </p>
      )}

      <ul id={listaDeAcertos} className="lista" hidden={!acertosExpandidos}>
        {acertos.map((item, indice) => (
          <li key={indice} className="cartao">
            <p className="lado-do-cartao">Frente</p>
            <p className="conteudo-do-cartao">{item.frente}</p>
            <p className="lado-do-cartao">Verso</p>
            <p className="conteudo-do-cartao">{item.verso}</p>
          </li>
        ))}
      </ul>

      <ul id={listaDeErros} className="lista" hidden={!errosExpandidos}>
        {erros.map((item, indice) => (
          <li key={indice} className="cartao">
            <p className="lado-do-cartao">Frente</p>
            <p className="conteudo-do-cartao">{item.frente}</p>
            <p className="lado-do-cartao">Verso</p>
            <p className="conteudo-do-cartao">{item.verso}</p>
          </li>
        ))}
      </ul>

      {children}
    </div>
  );
}
