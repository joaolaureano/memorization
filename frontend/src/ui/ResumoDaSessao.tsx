import { useId, useState } from "react";
import type { ReactNode } from "react";

import type { Avaliacao, OpcaoDeAvaliacao } from "../acervo-cliente/cliente";
import { OPCOES_DE_AVALIACAO_SM2 } from "../acervo-cliente/cliente-em-memoria";

/**
 * Placar da Sessão (T1208; specs/013-estatisticas-e-historico/contracts/contratos.md §7;
 * T2316; specs/023-baralho-temporario/spec.md FR-370;
 * FR-152, FR-174, FR-175, FR-176, FR-197, FR-216).
 *
 * Componente de apresentação puro: recebe os Itens **na ordem em que foram
 * apresentados** (FR-176) e deriva daí tudo o que mostra — percentual, total e
 * grupos. A fonte é única, então o total exibido nunca divergirá da soma dos
 * grupos, e o componente não precisa conhecer a Sessão, o histórico nem o
 * transporte (FR-152).
 *
 * O placar abre com o percentual de acertos — arredondado como sempre — e o
 * total de Cartões estudados. Quando **todos** os Itens trazem Avaliação, ele
 * acrescenta a barra segmentada e a legenda com a contagem por opção de Avaliação
 * (T2316, FR-216). Registros anteriores à 015, sem Avaliação, aparecem exatamente
 * como antes (FR-197).
 *
 * Depois do placar vêm os grupos, **um por opção de Avaliação oferecida pelo
 * algoritmo** (T2316, FR-174): cada um é um botão que expande e recolhe a sua
 * lista, com `aria-expanded`/`aria-controls` — os grupos são independentes e
 * nascem recolhidos. Um grupo vazio é apenas um botão desabilitado, descrito
 * pelo texto "Nenhum Cartão avaliado como <rótulo>" (T2316, FR-175). Itens sem
 * Avaliação aparecem juntos em "Sem avaliação" (T2316), nunca inferidos de
 * acertou/errou (FR-197). Dentro do grupo, cada Cartão mostra só a Frente até
 * ser expandido, e então revela o Verso e, quando houver, a Avaliação do Item
 * (FR-176, FR-216).
 *
 * A prop `origem` identifica a Sessão (FR-196); `opcoes` fornece as opções de
 * Avaliação do algoritmo da Sessão (T2316); o nome do Baralho no cabeçalho e as
 * ações cabem à página que usa o componente — recebidas em `children` e
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
  /**
   * Rótulo da opção de Avaliação; ausente ou nulo em Itens anteriores à 015
   * (FR-196).
   */
  avaliacaoRotulo?: string | null;
}

export function ResumoDaSessao({
  itens,
  opcoes = OPCOES_DE_AVALIACAO_SM2,
  children,
}: {
  itens: readonly ItemDoResumo[];
  opcoes?: readonly OpcaoDeAvaliacao[];
  origem?: "baralho" | "revisao" | "temporario";
  children?: ReactNode;
}) {
  const estudados = itens.length;
  const acertos = itens.filter((item) => item.resultado === "acertou");
  const percentual =
    estudados === 0 ? 0 : Math.round((acertos.length / estudados) * 100);

  // A barra segmentada e legenda com contagem por opção aparecem SEMPRE,
  // mostrando todas as opções oferecidas, inclusive com contagem 0 (FR-174).
  // Itens sem Avaliação — Registros anteriores à 015 — aparecem no grupo
  // "Sem avaliação" (FR-197, T2316).
  const contagemPorOpcao: Record<Avaliacao, number> = {
    errei: 0,
    dificil: 0,
    bom: 0,
    facil: 0,
  };
  let contagemSemAvaliacao = 0;

  for (const item of itens) {
    if (item.avaliacao != null) {
      contagemPorOpcao[item.avaliacao] += 1;
    } else {
      contagemSemAvaliacao += 1;
    }
  }

  // O estado de cada Cartão é independente e chaveado por grupo + índice: dois
  // Cartões de grupos diferentes nunca compartilham a mesma chave.
  const [gruposExpandidos, setGruposExpandidos] = useState<
    Record<string, boolean>
  >({});
  const [cartoesExpandidos, setCartoesExpandidos] = useState<
    Record<string, boolean>
  >({});

  function alternarGrupo(chaveDoGrupo: string): void {
    setGruposExpandidos((atual) => ({
      ...atual,
      [chaveDoGrupo]: !(atual[chaveDoGrupo] === true),
    }));
  }

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
    idDoGrupo: string,
    itensDoGrupo: readonly ItemDoResumo[],
  ): ReactNode {
    return itensDoGrupo.map((item, indice) => {
      const chave = `${idDoGrupo}-${indice}`;
      const idDoVerso = `${idDoGrupo}-cartao-${indice}-verso`;
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
            {item.avaliacaoRotulo != null && (
              <p className="resumo__nivel">
                Avaliação: {item.avaliacaoRotulo}
              </p>
            )}
          </div>
        </li>
      );
    });
  }

  // Itens sem Avaliação (legados da 013): aparecem juntos em "Sem avaliação"
  // (T2316, FR-197), não são inferidos de acertou/errou.
  const itensSemAvaliacao = itens.filter((item) => item.avaliacao == null);
  const temItensSemAvaliacao = itensSemAvaliacao.length > 0;

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

        <div className="placar__barra" aria-hidden="true">
          {opcoes.map(({ chave }) =>
            contagemPorOpcao[chave] > 0 ? (
              <span
                key={chave}
                className={`placar__segmento placar__segmento--${chave}`}
                style={{ flexGrow: contagemPorOpcao[chave] }}
              />
            ) : null,
          )}
          {contagemSemAvaliacao > 0 && (
            <span
              className="placar__segmento placar__segmento--sem-avaliacao"
              style={{ flexGrow: contagemSemAvaliacao }}
            />
          )}
        </div>
        <ul
          className="placar__legenda"
          aria-label="Contagem por opção de Avaliação"
        >
          {opcoes.map(({ chave, rotulo }) => (
            <li key={chave}>
              <span
                className={`placar__marca placar__marca--${chave}`}
                aria-hidden="true"
              />{" "}
              {rotulo} {contagemPorOpcao[chave]}
            </li>
          ))}
          {contagemSemAvaliacao > 0 && (
            <li>
              <span
                className="placar__marca placar__marca--sem-avaliacao"
                aria-hidden="true"
              />{" "}
              Sem avaliação {contagemSemAvaliacao}
            </li>
          )}
        </ul>
      </section>

      {opcoes.map(({ chave, rotulo }) => {
        const itensDoGrupo = itens.filter((item) => item.avaliacao === chave);
        const idDoGrupo = useId();
        const idDaLista = useId();
        const descricaoDoGrupo = useId();
        const expandido = gruposExpandidos[idDoGrupo] === true;
        const vazio = itensDoGrupo.length === 0;

        return (
          <div key={chave}>
            <button
              type="button"
              className="botao botao--secundario resumo__grupo"
              aria-expanded={expandido}
              aria-controls={idDaLista}
              aria-describedby={vazio ? descricaoDoGrupo : undefined}
              disabled={vazio}
              onClick={() => alternarGrupo(idDoGrupo)}
            >
              {rotulo} ({itensDoGrupo.length})
            </button>

            {vazio && (
              <p id={descricaoDoGrupo} className="ajuda">
                Nenhum Cartão avaliado como {rotulo}
              </p>
            )}

            <ul
              id={idDaLista}
              className="resumo__cartoes"
              hidden={!expandido}
            >
              {cartoesDoGrupo(idDoGrupo, itensDoGrupo)}
            </ul>
          </div>
        );
      })}

      {temItensSemAvaliacao && (
        <>
          {(() => {
            const idDoGrupo = useId();
            const idDaLista = useId();
            const expandido = gruposExpandidos[idDoGrupo] === true;

            return (
              <div>
                <button
                  type="button"
                  className="botao botao--secundario resumo__grupo"
                  aria-expanded={expandido}
                  aria-controls={idDaLista}
                  onClick={() => alternarGrupo(idDoGrupo)}
                >
                  Sem avaliação ({itensSemAvaliacao.length})
                </button>

                <ul
                  id={idDaLista}
                  className="resumo__cartoes"
                  hidden={!expandido}
                >
                  {cartoesDoGrupo(idDoGrupo, itensSemAvaliacao)}
                </ul>
              </div>
            );
          })()}
        </>
      )}

      {children}
    </div>
  );
}
