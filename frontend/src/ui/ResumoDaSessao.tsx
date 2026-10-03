import { useId, useState } from "react";
import type { ReactNode } from "react";

import type { Avaliacao } from "../acervo-cliente/cliente";

/** Os 4 níveis de Avaliação na ordem exibida, com os rótulos de texto (FR-216). */
const NIVEIS_DE_AVALIACAO: readonly {
  readonly avaliacao: Avaliacao;
  readonly rotulo: string;
}[] = [
  { avaliacao: "errei", rotulo: "Errei" },
  { avaliacao: "dificil", rotulo: "Difícil" },
  { avaliacao: "bom", rotulo: "Bom" },
  { avaliacao: "facil", rotulo: "Fácil" },
];

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
 * Quando **todos** os Itens trazem Avaliação, o Resumo acrescenta, entre o
 * percentual e os grupos, a contagem por nível de Avaliação (Errei, Difícil,
 * Bom, Fácil) numa lista acessível de rótulos de texto, sem depender de cor
 * (FR-216). Registros anteriores à 015, sem Avaliação, aparecem exatamente
 * como antes (FR-197, FR-214). A prop `origem` identifica a Sessão (FR-196);
 * o rótulo "Revisão do dia" e as ações cabem à página que usa o componente.
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
  /**
   * Avaliação em 4 níveis escolhida na Sessão (FR-193); ausente ou nula nos
   * Registros anteriores à 015, que o Resumo exibe exatamente como sempre os
   * exibiu (FR-196, FR-197).
   */
  avaliacao?: Avaliacao | null;
}

export function ResumoDaSessao({
  itens,
  children,
}: {
  itens: readonly ItemDoResumo[];
  origem?: "baralho" | "revisao";
  children?: ReactNode;
}) {
  const acertos = itens.filter((item) => item.resultado === "acertou");
  const erros = itens.filter((item) => item.resultado === "errou");
  const estudados = itens.length;
  const percentual =
    estudados === 0 ? 0 : Math.round((acertos.length / estudados) * 100);

  // A contagem por nível só existe quando **todos** os Itens trazem Avaliação;
  // sem Avaliação — Registros anteriores à 015 —, o Resumo aparece exatamente
  // como antes (FR-197, FR-216).
  const contagemPorNivel: Record<Avaliacao, number> = {
    errei: 0,
    dificil: 0,
    bom: 0,
    facil: 0,
  };
  const mostrarContagemPorNivel = itens.every(
    (item) => item.avaliacao != null,
  );

  if (mostrarContagemPorNivel) {
    for (const item of itens) {
      if (item.avaliacao != null) {
        contagemPorNivel[item.avaliacao] += 1;
      }
    }
  }

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

      {mostrarContagemPorNivel && (
        <ul
          className="contagem-por-nivel"
          aria-label="Contagem por nível de Avaliação"
        >
          {NIVEIS_DE_AVALIACAO.map(({ avaliacao, rotulo }) => (
            <li key={avaliacao}>
              {rotulo} {contagemPorNivel[avaliacao]}
            </li>
          ))}
        </ul>
      )}

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
