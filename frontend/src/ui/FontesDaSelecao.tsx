import { useMemo, useState } from "react";
import type { BaralhoListado, CartaoListado } from "../acervo-cliente/cliente";
import {
  classificarBaralhos,
  filtrarBaralhos,
  filtrarBaralhosPorSituacao,
  filtrarCartoes,
  type FiltroDeBaralho,
  type FiltroDeSituacaoDoBaralho,
} from "../acervo-cliente/busca-no-acervo";
import {
  cartoesAusentes,
  type SelecaoTemporaria,
} from "../sessao-de-estudo/selecao-temporaria";
import { EstadoDaCarga } from "./EstadoDaCarga";

/**
 * Coluna «Conteúdo disponível» da montagem do baralho temporário.
 *
 * Fontes (FR-361): permite adicionar todos os Cartões atuais de um
 * Baralho ou Cartões individuais, vinculados ou não. Exibe apenas
 * conteúdo do próprio Usuário.
 *
 * Busca e filtros (FR-362, FR-382): busca por nome nos Baralhos e por
 * Frente/Verso nos Cartões. Na fonte Adicionar baralhos há o filtro de
 * Situação da revisão; as etiquetas Pendente/Revisado/Sem cartões saíram
 * (FR-382). A fonte de Cartões individuais conserva apenas a busca e o
 * filtro de Baralho — a Situação saiu de lá (SC-150). Os filtros afetam
 * somente o que é exibido; nunca a seleção, e adicionar um Baralho
 * continua incluindo todos os Cartões dele.
 *
 * Seleção explícita (FR-363): adicionar um Baralho copia a composição
 * daquele momento, sem criar Vínculo vivo.
 *
 * Unicidade (FR-364): cada Cartão entra uma só vez. Por isso o botão
 * «Adicionado» fica desabilitado quando todos já estão presentes, e um
 * Baralho vazio mostra «Sem cartões».
 *
 * Estados e acessibilidade (FR-377): distingue carregamento, falha com
 * nova tentativa (filtros preservados, pois vivem aqui), acervo vazio
 * e ausência de resultados. A contagem fica em região viva. O nome
 * acessível começa pelo rótulo visível (WCAG 2.5.3).
 *
 * Esta coluna não guarda a seleção: recebe-a e devolve as adições por
 * `aoAdicionar`.
 */
export function FontesDaSelecao(props: PropriedadesDasFontes) {
  const {
    carga,
    baralhos,
    cartoes,
    selecao,
    aoAdicionar,
    aoTentarNovamente,
  } = props;

  const [fonte, setFonte] = useState<"baralhos" | "cartoes">("baralhos");
  const [consultaDeBaralhos, setConsultaDeBaralhos] = useState("");
  const [consultaDeCartoes, setConsultaDeCartoes] = useState("");
  const [filtroDeBaralho, setFiltroDeBaralho] =
    useState<FiltroDeBaralho>("todos");
  const [filtroDeSituacao, setFiltroDeSituacao] =
    useState<FiltroDeSituacaoDoBaralho>("todos");

  /**
   * Mapa id do Baralho → ids dos Cartões que pertencem a ele, na ordem do
   * acervo.
   */
  const idsPorBaralho = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const cartao of cartoes) {
      for (const baralho of cartao.baralhos) {
        const ids = mapa.get(baralho.id);
        if (ids) ids.push(cartao.id);
        else mapa.set(baralho.id, [cartao.id]);
      }
    }
    return mapa;
  }, [cartoes]);

  /**
   * A situação da revisão de cada Baralho, derivada dos Agendamentos
   * carregados (FR-379, FR-382). O `agora` é lido uma vez por cálculo;
   * um Baralho ausente do mapa é o caso vazio.
   */
  const situacoesDosBaralhos = useMemo(
    () => classificarBaralhos(baralhos, cartoes, new Date()),
    [baralhos, cartoes],
  );

  const baralhosFiltrados = useMemo(
    () =>
      filtrarBaralhosPorSituacao(
        filtrarBaralhos(baralhos, consultaDeBaralhos),
        situacoesDosBaralhos,
        filtroDeSituacao,
      ),
    [baralhos, consultaDeBaralhos, situacoesDosBaralhos, filtroDeSituacao],
  );

  const cartoesFiltrados = useMemo(
    () =>
      filtrarCartoes(cartoes, {
        consulta: consultaDeCartoes,
        baralho: filtroDeBaralho,
      }),
    [cartoes, consultaDeCartoes, filtroDeBaralho],
  );

  const quantidadeDeResultados =
    fonte === "baralhos" ? baralhosFiltrados.length : cartoesFiltrados.length;

  function trocarFonte(novaFonte: "baralhos" | "cartoes") {
    setFonte(novaFonte);
    setConsultaDeBaralhos("");
    setConsultaDeCartoes("");
  }

  function limparFiltrosDaFonteAtiva() {
    if (fonte === "baralhos") {
      setConsultaDeBaralhos("");
      setFiltroDeSituacao("todos");
      return;
    }
    setConsultaDeCartoes("");
    setFiltroDeBaralho("todos");
  }

  function montarConteudo() {
    if (carga === "carregando") {
      return (
        <EstadoDaCarga
          estado="carregando"
          mensagem="Carregando o acervo…"
        />
      );
    }

    if (carga === "falha") {
      return (
        <EstadoDaCarga
          estado="falha"
          mensagem="Não foi possível carregar o acervo."
          aoTentarNovamente={aoTentarNovamente}
        />
      );
    }

    if (cartoes.length === 0) {
      return (
        <EstadoDaCarga
          estado="vazio"
          mensagem="Seu acervo está vazio. Crie cartões para montar um estudo."
          acao={
            <a className="botao botao--primario" href="#/cartoes/novo">
              Criar cartão
            </a>
          }
        />
      );
    }

    if (quantidadeDeResultados === 0) {
      return (
        <div className="estado-vazio">
          <p>Nenhum resultado encontrado. Altere a busca ou os filtros.</p>
          <button
            type="button"
            className="botao botao--secundario"
            onClick={limparFiltrosDaFonteAtiva}
          >
            Limpar filtros
          </button>
        </div>
      );
    }

    if (fonte === "baralhos") {
      return (
        <ul className="lista lista--compacta">
          {baralhosFiltrados.map((baralho) => {
            const ids = idsPorBaralho.get(baralho.id) ?? [];
            const podeAdicionar =
              ids.length > 0 &&
              cartoesAusentes(selecao, ids).length > 0;
            const rotulo =
              ids.length > 0 && !podeAdicionar ? "Adicionado" : "Adicionar";

            return (
              <li
                className="linha-da-lista"
                key={baralho.id}
              >
                <div className="linha-da-lista__texto">
                  <p className="linha-da-lista__titulo">{baralho.nome}</p>
                  <p className="linha-da-lista__detalhe">
                    {detalheDoBaralho(ids.length)}
                  </p>
                </div>
                <div className="linha-da-lista__acoes">
                  <button
                    type="button"
                    className={
                      podeAdicionar
                        ? "botao botao--primario"
                        : "botao botao--secundario"
                    }
                    disabled={!podeAdicionar}
                    aria-label={`${rotulo} ${baralho.nome}`}
                    onClick={() => aoAdicionar(ids)}
                  >
                    {rotulo}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      );
    }

    return (
      <ul className="lista lista--compacta">
        {cartoesFiltrados.map((cartao) => {
          const jaEstaNaSelecao =
            cartoesAusentes(selecao, [cartao.id]).length === 0;
          const rotulo = jaEstaNaSelecao ? "Adicionado" : "Adicionar";

          return (
            <li className="linha-da-lista" key={cartao.id}>
              <div className="linha-da-lista__texto">
                <p className="linha-da-lista__titulo">{cartao.frente}</p>
              </div>
              <div className="linha-da-lista__acoes">
                <button
                  type="button"
                  className={
                    jaEstaNaSelecao
                      ? "botao botao--secundario"
                      : "botao botao--primario"
                  }
                  disabled={jaEstaNaSelecao}
                  aria-label={`${rotulo} ${cartao.frente}`}
                  onClick={() => aoAdicionar([cartao.id])}
                >
                  {rotulo}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  const conteudo = montarConteudo();

  return (
    <section className="fontes" aria-label="Conteúdo disponível">
      <div className="alternar-fontes">
        <button
          type="button"
          className="botao botao--secundario"
          aria-pressed={fonte === "baralhos"}
          onClick={() => trocarFonte("baralhos")}
        >
          Adicionar baralhos
        </button>
        <button
          type="button"
          className="botao botao--secundario"
          aria-pressed={fonte === "cartoes"}
          onClick={() => trocarFonte("cartoes")}
        >
          Adicionar cartões
        </button>
      </div>

      <div className="filtros-montagem">
        {fonte === "baralhos" ? (
          <>
            <div className="campo">
              <label className="rotulo" htmlFor="busca-de-baralhos-da-montagem">
                Buscar baralhos
              </label>
              <input
                id="busca-de-baralhos-da-montagem"
                type="search"
                autoComplete="off"
                placeholder="Digite o nome do baralho"
                value={consultaDeBaralhos}
                onChange={(evento) => setConsultaDeBaralhos(evento.target.value)}
              />
            </div>
            <div className="campo">
              <label
                className="rotulo"
                htmlFor="filtro-de-situacao-da-montagem"
              >
                Situação da revisão
              </label>
              <select
                id="filtro-de-situacao-da-montagem"
                value={filtroDeSituacao}
                onChange={(evento) =>
                  setFiltroDeSituacao(
                    evento.target.value as FiltroDeSituacaoDoBaralho,
                  )
                }
              >
                <option value="todos">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="revisado">Revisado</option>
              </select>
            </div>
          </>
        ) : (
          <>
            <div className="campo">
              <label className="rotulo" htmlFor="busca-de-cartoes-da-montagem">
                Buscar cartões
              </label>
              <input
                id="busca-de-cartoes-da-montagem"
                type="search"
                autoComplete="off"
                placeholder="Buscar na frente ou no verso"
                value={consultaDeCartoes}
                onChange={(evento) => setConsultaDeCartoes(evento.target.value)}
              />
            </div>
            <div className="campo">
              <label className="rotulo" htmlFor="filtro-de-baralho-da-montagem">
                Baralho
              </label>
              <select
                id="filtro-de-baralho-da-montagem"
                value={filtroDeBaralho}
                onChange={(evento) =>
                  setFiltroDeBaralho(evento.target.value as FiltroDeBaralho)
                }
              >
                <option value="todos">Todos</option>
                <option value="sem-baralho">Sem baralho</option>
                {baralhos.map((baralho) => (
                  <option key={baralho.id} value={baralho.id}>
                    {baralho.nome}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      <div className="resultado-cabecalho">
        <p role="status" aria-live="polite" aria-atomic="true">
          {carga === "pronta" && cartoes.length > 0
            ? contagemDeResultados(quantidadeDeResultados)
            : null}
        </p>
        <button
          type="button"
          className="botao botao--secundario"
          onClick={limparFiltrosDaFonteAtiva}
        >
          Limpar filtros
        </button>
      </div>

      {conteudo}
    </section>
  );
}

/** Texto da contagem de resultados anunciada na região viva. */
function contagemDeResultados(quantidade: number): string {
  return `${quantidade} ${quantidade === 1 ? "resultado" : "resultados"}`;
}

/**
 * Detalhe exibido sob o nome do Baralho: quantidade de Cartões ou aviso de
 * baralho vazio.
 */
function detalheDoBaralho(quantidade: number): string {
  if (quantidade === 0) return "0 Cartões · Baralho vazio";
  return `${quantidade} ${quantidade === 1 ? "Cartão" : "Cartões"}`;
}

interface PropriedadesDasFontes {
  carga: "carregando" | "falha" | "pronta";
  baralhos: readonly BaralhoListado[];
  cartoes: readonly CartaoListado[];
  selecao: SelecaoTemporaria;
  aoAdicionar: (cartaoIds: readonly string[]) => void;
  aoTentarNovamente: () => void;
}
