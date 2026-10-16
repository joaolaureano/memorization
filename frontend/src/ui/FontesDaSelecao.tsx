import { useMemo, useState } from "react";
import type { BaralhoListado, CartaoListado } from "../acervo-cliente/cliente";
import { useIdioma } from "../idioma";
import {
  classificarBaralhos,
  filtrarBaralhos,
  filtrarBaralhosPorSituacao,
  filtrarCartoes,
  filtrarPorTags,
  type FiltroDeBaralho,
  type FiltroDeSituacaoDoBaralho,
} from "../acervo-cliente/busca-no-acervo";
import { EtiquetasDeTags, OpcoesDeTags } from "./CampoDeTags";
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
  const { textos } = useIdioma();
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
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([]);
  const [filtroDeSituacao, setFiltroDeSituacao] =
    useState<FiltroDeSituacaoDoBaralho>("todos");

  /**
   * Mapa id do Baralho → ids dos Cartões que pertencem a ele, na ordem do
   * acervo.
   */
  const idsPorBaralho = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const cartao of cartoes) {
      const ids = mapa.get(cartao.baralho.id);
      if (ids) ids.push(cartao.id);
      else mapa.set(cartao.baralho.id, [cartao.id]);
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
        filtrarPorTags(filtrarBaralhos(baralhos, consultaDeBaralhos), tagsSelecionadas),
        situacoesDosBaralhos,
        filtroDeSituacao,
      ),
    [baralhos, consultaDeBaralhos, situacoesDosBaralhos, filtroDeSituacao, tagsSelecionadas],
  );

  const cartoesFiltrados = useMemo(
    () =>
      filtrarPorTags(filtrarCartoes(cartoes, {
        consulta: consultaDeCartoes,
        baralho: filtroDeBaralho,
      }), tagsSelecionadas),
    [cartoes, consultaDeCartoes, filtroDeBaralho, tagsSelecionadas],
  );

  const quantidadeDeResultados =
    fonte === "baralhos" ? baralhosFiltrados.length : cartoesFiltrados.length;

  function trocarFonte(novaFonte: "baralhos" | "cartoes") {
    setFonte(novaFonte);
    setConsultaDeBaralhos("");
    setConsultaDeCartoes("");
    setTagsSelecionadas([]);
  }

  function limparFiltrosDaFonteAtiva() {
    if (fonte === "baralhos") {
      setConsultaDeBaralhos("");
      setFiltroDeSituacao("todos");
      setTagsSelecionadas([]);
      return;
    }
    setConsultaDeCartoes("");
    setFiltroDeBaralho("todos");
    setTagsSelecionadas([]);
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
          mensagem={textos.selecao.naoFoiPossivelCarregar}
          aoTentarNovamente={aoTentarNovamente}
        />
      );
    }

    if (cartoes.length === 0) {
      return (
        <EstadoDaCarga
          estado="vazio"
          mensagem={textos.selecao.acervoVazio}
          acao={
            <a className="botao botao--primario" href="#/baralhos">
              {textos.selecao.verBaralhos}
            </a>
          }
        />
      );
    }

    if (quantidadeDeResultados === 0) {
      return (
        <div className="estado-vazio">
          <p>{textos.selecao.nenhumResultado}</p>
          <button
            type="button"
            className="botao botao--secundario"
            onClick={limparFiltrosDaFonteAtiva}
          >
            {textos.selecao.limparFiltros}
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
            const adicionado = ids.length > 0 && !podeAdicionar;
            const rotulo = adicionado ? textos.selecao.adicionado : textos.selecao.adicionar;
            const nomeDoRotulo = adicionado
              ? textos.selecao.adicionadoNome(baralho.nome)
              : textos.selecao.adicionarNome(baralho.nome);

            return (
              <li
                className="linha-da-lista"
                key={baralho.id}
              >
                <div className="linha-da-lista__texto">
                  <p className="linha-da-lista__titulo">{baralho.nome}</p>
                  <p className="linha-da-lista__detalhe">
                    {detalheDoBaralho(ids.length, textos)}
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
                    aria-label={nomeDoRotulo}
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
          const rotulo = jaEstaNaSelecao ? textos.selecao.adicionado : textos.selecao.adicionar;
          const nomeDoRotulo = jaEstaNaSelecao
            ? textos.selecao.adicionadoNome(cartao.frente)
            : textos.selecao.adicionarNome(cartao.frente);

          return (
            <li className="linha-da-lista" key={cartao.id}>
              <div className="linha-da-lista__texto">
                <p className="linha-da-lista__titulo">{cartao.frente}</p>
                <EtiquetasDeTags tags={cartao.tags} />
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
                  aria-label={nomeDoRotulo}
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
    <section className="fontes" aria-label={textos.selecao.conteudoDisponivel}>
      <div className="alternar-fontes">
        <button
          type="button"
          className="botao botao--secundario"
          aria-pressed={fonte === "baralhos"}
          onClick={() => trocarFonte("baralhos")}
        >
          {textos.selecao.adicionarBaralhos}
        </button>
        <button
          type="button"
          className="botao botao--secundario"
          aria-pressed={fonte === "cartoes"}
          onClick={() => trocarFonte("cartoes")}
        >
          {textos.selecao.adicionarCartoes}
        </button>
      </div>

      <div className="filtros-montagem">
        {fonte === "baralhos" ? (
          <>
            <div className="campo">
              <label className="rotulo" htmlFor="busca-de-baralhos-da-montagem">
                {textos.selecao.buscarBaralhos}
              </label>
              <input
                id="busca-de-baralhos-da-montagem"
                type="search"
                autoComplete="off"
                placeholder={textos.selecao.digiteONome}
                value={consultaDeBaralhos}
                onChange={(evento) => setConsultaDeBaralhos(evento.target.value)}
              />
            </div>
            <OpcoesDeTags opcoes={[...new Set(baralhos.flatMap((item) => item.tags ?? []))].sort()} selecionadas={tagsSelecionadas} aoAlterar={setTagsSelecionadas} />
            <div className="campo">
              <label
                className="rotulo"
                htmlFor="filtro-de-situacao-da-montagem"
              >
                {textos.selecao.situacaoDaRevisao}
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
                <option value="todos">{textos.baralhos.situacaoTodos}</option>
                <option value="pendente">{textos.baralhos.situacaoPendente}</option>
                <option value="revisado">{textos.baralhos.situacaoRevisado}</option>
              </select>
            </div>
          </>
        ) : (
          <>
            <div className="campo">
              <label className="rotulo" htmlFor="busca-de-cartoes-da-montagem">
                {textos.selecao.buscarCartoes}
              </label>
              <input
                id="busca-de-cartoes-da-montagem"
                type="search"
                autoComplete="off"
                placeholder={textos.selecao.buscarNaFrenteOuVerso}
                value={consultaDeCartoes}
                onChange={(evento) => setConsultaDeCartoes(evento.target.value)}
              />
            </div>
            <div className="campo">
              <label className="rotulo" htmlFor="filtro-de-baralho-da-montagem">
                {textos.selecao.baralho}
              </label>
              <select
                id="filtro-de-baralho-da-montagem"
                value={filtroDeBaralho}
                onChange={(evento) =>
                  setFiltroDeBaralho(evento.target.value as FiltroDeBaralho)
                }
              >
                <option value="todos">{textos.baralhos.situacaoTodos}</option>
                {baralhos.map((baralho) => (
                  <option key={baralho.id} value={baralho.id}>
                    {baralho.nome}
                  </option>
                ))}
              </select>
            </div>
            <OpcoesDeTags opcoes={[...new Set(cartoes.flatMap((item) => item.tags ?? []))].sort()} selecionadas={tagsSelecionadas} aoAlterar={setTagsSelecionadas} />
          </>
        )}
      </div>

      <div className="resultado-cabecalho">
        <p role="status" aria-live="polite" aria-atomic="true">
          {carga === "pronta" && cartoes.length > 0
            ? contagemDeResultados(quantidadeDeResultados, textos)
            : null}
        </p>
        <button
          type="button"
          className="botao botao--secundario"
          onClick={limparFiltrosDaFonteAtiva}
        >
          {textos.selecao.limparFiltros}
        </button>
      </div>

      {conteudo}
    </section>
  );
}

/** Texto da contagem de resultados anunciada na região viva. */
function contagemDeResultados(quantidade: number, textos: ReturnType<typeof useIdioma>["textos"]): string {
  return textos.baralhos.contagem(quantidade);
}

/**
 * Detalhe exibido sob o nome do Baralho: quantidade de Cartões ou aviso de
 * baralho vazio.
 */
function detalheDoBaralho(quantidade: number, textos: ReturnType<typeof useIdioma>["textos"]): string {
  if (quantidade === 0) return textos.selecao.naoHaCartoes;
  return textos.selecao.contagem(quantidade);
}

interface PropriedadesDasFontes {
  carga: "carregando" | "falha" | "pronta";
  baralhos: readonly BaralhoListado[];
  cartoes: readonly CartaoListado[];
  selecao: SelecaoTemporaria;
  aoAdicionar: (cartaoIds: readonly string[]) => void;
  aoTentarNovamente: () => void;
}
