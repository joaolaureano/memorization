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
 * Placar da Sessão (T1208; specs/013-estatisticas-e-historico/contracts/contratos.md §7;
 * FR-152, FR-174, FR-175, FR-176, FR-197, FR-216).
 *
 * Componente de apresentação puro: recebe os Itens **na ordem em que foram
 * apresentados** (FR-176) e deriva daí tudo o que mostra — percentual, total e
 * grupos. A fonte é única, então o total exibido nunca divergirá da soma dos
 * dois grupos, e o componente não precisa conhecer a Sessão, o histórico nem o
 * transporte (FR-152).
 *
 * O placar abre com o percentual de acertos — arredondado como sempre — e o
 * total de Cartões estudados. Quando **todos** os Itens trazem Avaliação, ele
 * acrescenta a barra segmentada e a legenda com a contagem por nível (Errei,
 * Difícil, Bom, Fácil), sempre em texto, nunca só em cor (FR-216). Registros
 * anteriores à 015, sem Avaliação, aparecem exatamente como antes (FR-197).
 *
 * Depois do placar vêm os grupos, **Erros primeiro** e Acertos em seguida
 * (FR-174): cada um é um botão que expande e recolhe a sua lista, com
 * `aria-expanded`/`aria-controls` — os grupos são independentes e nascem
 * recolhidos. Um grupo vazio é apenas um botão desabilitado, descrito pelo
 * texto "Nenhum erro nesta Sessão" / "Nenhum acerto nesta Sessão" (FR-175).
 * Dentro do grupo, cada Cartão mostra só a Frente até ser expandido, e então
 * revela o Verso e, quando houver, a Avaliação do Item (FR-176, FR-216).
 *
 * A prop `origem` identifica a Sessão (FR-196); o nome do Baralho no cabeçalho
 * e as ações cabem à página que usa o componente — recebidas em `children` e
 * renderizadas ao fim (FR-174).
 */

/** Um Item já respondido, como o Placar precisa exibir (FR-176). */
export interface ItemDoResumo {
  frente: string;
  verso: string;
  resultado: "acertou" | "errou";
  /**
   * Avaliação em 4 níveis escolhida na Sessão (FR-193); ausente ou nula nos
   * Registros anteriores à 015, que o Placar exibe exatamente como sempre os
   * exibiu (FR-196, FR-197).
   */
  avaliacao?: Avaliacao | null;
}

export function ResumoDaSessao({
  itens,
  children,
}: {
  itens: readonly ItemDoResumo[];
  origem?: "baralho" | "revisao" | "temporario";
  children?: ReactNode;
}) {
  const acertos = itens.filter((item) => item.resultado === "acertou");
  const erros = itens.filter((item) => item.resultado === "errou");
  const estudados = itens.length;
  const percentual =
    estudados === 0 ? 0 : Math.round((acertos.length / estudados) * 100);

  // A contagem por nível só existe quando **todos** os Itens trazem Avaliação;
  // sem Avaliação — Registros anteriores à 015 —, o Placar aparece exatamente
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

  const listaDeErros = useId();
  const listaDeAcertos = useId();
  const descricaoDosErros = useId();
  const descricaoDosAcertos = useId();

  const [errosExpandidos, setErrosExpandidos] = useState(false);
  const [acertosExpandidos, setAcertosExpandidos] = useState(false);
  // O estado de cada Cartão é independente e chaveado por grupo + índice: dois
  // Cartões de grupos diferentes nunca compartilham a mesma chave.
  const [cartoesExpandidos, setCartoesExpandidos] = useState<
    Record<string, boolean>
  >({});

  function alternarCartao(chave: string): void {
    setCartoesExpandidos((atual) => ({
      ...atual,
      [chave]: !(atual[chave] === true),
    }));
  }

  /**
   * Os Cartões de um grupo: só a Frente até a expansão do próprio Cartão; o
   * painel revela o Verso e, quando houver, a Avaliação do Item (FR-176,
   * FR-216).
   */
  function cartoesDoGrupo(
    grupo: "erros" | "acertos",
    itensDoGrupo: readonly ItemDoResumo[],
    idDaLista: string,
  ): ReactNode {
    return itensDoGrupo.map((item, indice) => {
      const chave = `${grupo}-${indice}`;
      const idDoVerso = `${idDaLista}-cartao-${indice}-verso`;
      const expandido = cartoesExpandidos[chave] === true;

      return (
        <li key={indice}>
          <button
            type="button"
            className="resumo__cartao"
            aria-expanded={expandido}
            aria-controls={idDoVerso}
            onClick={() => alternarCartao(chave)}
          >
            {item.frente}
          </button>
          <div className="resumo__verso" id={idDoVerso} hidden={!expandido}>
            <p className="lado-do-cartao">Verso</p>
            <p className="conteudo-do-cartao">{item.verso}</p>
            {item.avaliacao != null && (
              <p className="resumo__nivel">
                Avaliação: {rotuloDaAvaliacao(item.avaliacao)}
              </p>
            )}
          </div>
        </li>
      );
    });
  }

  return (
    <div className="pilha">
      <section className="placar" aria-label="Placar da Sessão">
        <p className="placar__percentual">
          {percentual}%<span className="visualmente-oculto"> de acertos</span>
        </p>
        <p className="placar__total">
          {acertos.length} de {estudados}{" "}
          {estudados === 1 ? "Cartão" : "Cartões"}
        </p>

        {mostrarContagemPorNivel && (
          <>
            <div className="placar__barra" aria-hidden="true">
              {NIVEIS_DE_AVALIACAO.map(({ avaliacao }) =>
                contagemPorNivel[avaliacao] > 0 ? (
                  <span
                    key={avaliacao}
                    className={`placar__segmento placar__segmento--${avaliacao}`}
                    style={{ flexGrow: contagemPorNivel[avaliacao] }}
                  />
                ) : null,
              )}
            </div>
            <ul
              className="placar__legenda"
              aria-label="Contagem por nível de Avaliação"
            >
              {NIVEIS_DE_AVALIACAO.map(({ avaliacao, rotulo }) => (
                <li key={avaliacao}>
                  <span
                    className={`placar__marca placar__marca--${avaliacao}`}
                    aria-hidden="true"
                  />{" "}
                  {rotulo} {contagemPorNivel[avaliacao]}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <button
        type="button"
        className="botao botao--secundario resumo__grupo"
        aria-expanded={errosExpandidos}
        aria-controls={listaDeErros}
        aria-describedby={erros.length === 0 ? descricaoDosErros : undefined}
        disabled={erros.length === 0}
        onClick={() => setErrosExpandidos((expandidos) => !expandidos)}
      >
        Erros ({erros.length})
      </button>

      {erros.length === 0 && (
        <p id={descricaoDosErros} className="ajuda">
          Nenhum erro nesta Sessão
        </p>
      )}

      <ul
        id={listaDeErros}
        className="resumo__cartoes"
        hidden={!errosExpandidos}
      >
        {cartoesDoGrupo("erros", erros, listaDeErros)}
      </ul>

      <button
        type="button"
        className="botao botao--secundario resumo__grupo"
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

      {acertos.length === 0 && (
        <p id={descricaoDosAcertos} className="ajuda">
          Nenhum acerto nesta Sessão
        </p>
      )}

      <ul
        id={listaDeAcertos}
        className="resumo__cartoes"
        hidden={!acertosExpandidos}
      >
        {cartoesDoGrupo("acertos", acertos, listaDeAcertos)}
      </ul>

      {children}
    </div>
  );
}

/** O rótulo em português de uma Avaliação, para o Cartão do Resumo (FR-216). */
function rotuloDaAvaliacao(avaliacao: Avaliacao): string {
  const nivel = NIVEIS_DE_AVALIACAO.find(
    (candidato) => candidato.avaliacao === avaliacao,
  );

  return nivel?.rotulo ?? avaliacao;
}
