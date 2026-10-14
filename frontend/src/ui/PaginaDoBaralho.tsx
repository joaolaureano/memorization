import { TextoDoProduto } from "../idioma";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useIdioma } from "../idioma";
import type {
  BaralhoComCartoes,
  Cartao,
  CartaoListado,
  ClienteDoAcervo,
} from "../acervo-cliente/cliente";
import {
  filtrarCartoes,
  filtrarCartoesPorTipo,
  filtrarPorTags,
  situacaoDaRevisao,
  type FiltroDeTipoDeCartao,
} from "../acervo-cliente/busca-no-acervo";
import {
  ORDEM_DOS_TIPOS,
} from "../acervo-cliente/tipos-de-cartao";
import { DialogoDeConfirmacao } from "./DialogoDeConfirmacao";
import { consumirAvisoDeCartao } from "./aviso-de-cartao";
import { EstadoDaCarga } from "./EstadoDaCarga";
import { EtiquetasDeTags, OpcoesDeTags } from "./CampoDeTags";
import { hashDaRota } from "./navegacao";
import { ResumoDoCartao, rotuloDoCartao } from "./tipos-de-cartao/ResumoDoCartao";
import {
  useNavegarSemProtecao,
  useProtecaoDeSaida,
} from "./protecao-de-saida";

/**
 * Tela de detalhe de um Baralho
 * (T1110; specs/012-interface-visual-navegavel/tasks.md, FR-145, FR-392,
 * FR-396, FR-401, FR-402, FR-430, FR-153, FR-156;
 * specs/025-criar-cartoes-baralho).
 *
 * É a página `#/baralhos/<id>`: mostra o Baralho, a contagem de Cartões, o
 * caminho para Revisar (a ação da spec 024, FR-378), ação para Criar Cartão
 * (FR-392) e a lista dos Cartões criados neste Baralho (FR-025). Cada Cartão
 * pode ser Editado ou Excluído.
 *
 * A tela **não reproduz nenhuma regra de domínio** — quem decide se o Baralho
 * existe é o cliente, e a tela apenas exibe as mensagens em português que ele
 * devolve (FR-046). Baralho inexistente e Baralho que não pertence a quem está
 * autenticado resolvem na mesma mensagem, sem distinguir os dois casos
 * (FR-156).
 *
 * FR-044, FR-045: excluir Cartão requer confirmação explícita e nunca altera a
 * lista por otimismo. A operação é submetida e, **somente após o sucesso**, a
 * tela relê `obterBaralho` e passa a exibir o que o servidor confirmou. Se a
 * releitura falhar, a lista permanece exatamente como estava — o estado
 * confirmado anteriormente. Foco retorna ao acionador, ou ao título se a linha
 * sumiu (FR-401, FR-396).
 *
 * A exclusão do Baralho (FR-016, FR-017, FR-068, FR-069) é precedida de diálogo
 * acessível que declara quantos Cartões e Agendamentos serão removidos e que o
 * Histórico permanece (FR-402). Confirmada, a tela navega para `#/baralhos`; em
 * falha de transporte, o Baralho continua exibido (FR-045).
 *
 * FR-153, FR-154: carregamento, falha e vazio têm apresentação própria
 * (`EstadoDaCarga`), e enquanto há operação em andamento a saída da tela é
 * protegida e os botões da operação ficam desabilitados.
 */

interface PropriedadesDaPaginaDoBaralho {
  cliente: ClienteDoAcervo;
  id: string;
}

/**
 * Ação de foco a executar depois que uma exclusão bem-sucedida re-renderiza a
 * lista (FR-063, FR-064, SC-019, FR-401). `proximoCartaoId` é o vizinho que
 * passa a ocupar a posição do Cartão excluído — o seguinte, ou o anterior
 * quando o excluído era o último. Sem vizinho, o foco vai ao título da seção,
 * nunca de volta ao início da página.
 */
interface FocoAposExclusao {
  cartaoId: string;
  proximoCartaoId: string | null;
}


export function PaginaDoBaralho({
  cliente,
  id,
}: PropriedadesDaPaginaDoBaralho) {
  const { textos } = useIdioma();
  const [baralho, setBaralho] = useState<BaralhoComCartoes | null>(null);
  const [cartoesListados, setCartoesListados] = useState<CartaoListado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falhaDeCarregamento, setFalhaDeCarregamento] = useState<string | null>(
    null,
  );
  const [baralhoNaoEncontrado, setBaralhoNaoEncontrado] = useState<
    string | null
  >(null);
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [sequenciaDeAnuncio, setSequenciaDeAnuncio] = useState(0);
  const [excluindoCartao, setExcluindoCartao] = useState<string | null>(null);
  const [focoAposExclusaoDeCartao, setFocoAposExclusaoDeCartao] =
    useState<FocoAposExclusao | null>(null);
  const [cartaoPendingExclusao, setCartaoPendingExclusao] =
    useState<Cartao | null>(null);
  const [falhaDeExclusaoDeCartao, setFalhaDeExclusaoDeCartao] = useState<
    string | null
  >(null);
  const [exclusaoDoBaralhoAberta, setExclusaoDoBaralhoAberta] = useState(false);
  const [excluindoBaralho, setExcluindoBaralho] = useState(false);
  const [falhaDeExclusaoDoBaralho, setFalhaDeExclusaoDoBaralho] = useState<
    string | null
  >(null);
  const [focoAposExclusaoDoBaralho, setFocoAposExclusaoDoBaralho] =
    useState(false);
  const [consulta, setConsulta] = useState("");
  const [filtroDeSituacao, setFiltroDeSituacao] = useState<
    "todos" | "pendente" | "revisado"
  >("todos");
  const [filtroDeTipo, setFiltroDeTipo] =
    useState<FiltroDeTipoDeCartao>("todos");
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([]);
  const campoDeBusca = useRef<HTMLInputElement>(null);

  const botoesDeExcluir = useRef(new Map<string, HTMLButtonElement>());
  const tituloDaPagina = useRef<HTMLHeadingElement>(null);
  const botaoDeExcluirBaralho = useRef<HTMLButtonElement>(null);
  const botaoQueAbriuDialogoDeCartao = useRef<HTMLButtonElement | null>(null);
  const requisicao = useRef(0);

  const navegarSemProtecao = useNavegarSemProtecao();

  // FR-154: enquanto uma operação está em andamento, sair da tela é bloqueado
  // com o motivo anunciado, e não com um diálogo.
  useProtecaoDeSaida(
    excluindoCartao !== null || excluindoBaralho
      ? { tipo: "pendencia", motivo: textos.baralhos.operacaoEmAndamento }
      : null,
  );

  const carregar = useCallback(() => {
    const minha = ++requisicao.current;

    setCarregando(true);
    setFalhaDeCarregamento(null);
    setBaralhoNaoEncontrado(null);
    setAnuncio(null);

    void Promise.all([
      cliente.obterBaralho(id),
      cliente.listarCartoes(),
    ]).then(([resultado, resultadoDosCartoes]) => {
      if (minha !== requisicao.current) {
        return;
      }

      if (resultado.ok) {
        setBaralho(resultado.baralho);
        if (resultadoDosCartoes.ok) {
          setCartoesListados(resultadoDosCartoes.cartoes);
        } else {
          setBaralho(null);
          setFalhaDeCarregamento(resultadoDosCartoes.mensagem);
          setCarregando(false);
          return;
        }
        const aviso = consumirAvisoDeCartao(id);
        if (aviso !== null) {
          setAnuncio(aviso);
          setSequenciaDeAnuncio((atual) => atual + 1);
        }
      } else {
        setBaralho(null);
        setCartoesListados([]);

        if (resultado.erro === "nao_encontrado") {
          setBaralhoNaoEncontrado(resultado.mensagem);
        } else {
          setFalhaDeCarregamento(resultado.mensagem);
        }
      }

      setCarregando(false);
    });
  }, [cliente, id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /**
   * Renova os endereços de exibição das Imagens sem recarregar a tela: é o
   * que a miniatura pede quando a Imagem não carrega (FR-418).
   */
  const renovarEnderecos = useCallback(() => {
    void cliente.obterBaralho(id).then((resultado) => {
      if (resultado.ok) {
        setBaralho(resultado.baralho);
      }
    });
  }, [cliente, id]);

  useLayoutEffect(() => {
    if (focoAposExclusaoDeCartao === null) {
      return;
    }

    const vizinho =
      focoAposExclusaoDeCartao.proximoCartaoId === null
        ? undefined
        : botoesDeExcluir.current.get(
            `excluir:${focoAposExclusaoDeCartao.proximoCartaoId}`,
          );

    if (vizinho !== undefined) {
      vizinho.focus();
    } else {
      tituloDaPagina.current?.focus();
    }

    setFocoAposExclusaoDeCartao(null);
  }, [focoAposExclusaoDeCartao, baralho]);

  // FR-064, WCAG 2.4.3 (ordem de foco): mover o foco é uma reação a uma
  // mudança de estado, então precisa ser um layout effect. `useEffect` roda
  // depois da pintura, e nesse intervalo o foco fica transitoriamente em
  // `<body>` — um leitor de tela, ou um teste que observa o DOM logo após o
  // commit, enxerga o foco perdido. `useLayoutEffect` roda de forma síncrona
  // logo após a mutação do DOM, sem foco transitório em `<body>`, como já
  // acontece no efeito pós-exclusão acima.
  useLayoutEffect(() => {
    if (!focoAposExclusaoDoBaralho) {
      return;
    }

    botaoDeExcluirBaralho.current?.focus();
    setFocoAposExclusaoDoBaralho(false);
  }, [focoAposExclusaoDoBaralho, baralho]);

  // Restaura o foco ao botão que abriu o diálogo quando ele é cancelado
  useLayoutEffect(() => {
    if (cartaoPendingExclusao === null && botaoQueAbriuDialogoDeCartao.current) {
      botaoQueAbriuDialogoDeCartao.current.focus();
      botaoQueAbriuDialogoDeCartao.current = null;
    }
  }, [cartaoPendingExclusao]);

  /**
   * Abre o diálogo de confirmação para exclusão de um Cartão (FR-401).
   */
  function abrirExclusaoDeCartao(
    cartao: Cartao,
    botaoInvocador: HTMLButtonElement,
  ): void {
    setFalhaDeExclusaoDeCartao(null);
    botaoQueAbriuDialogoDeCartao.current = botaoInvocador;
    setCartaoPendingExclusao(cartao);
  }

  /**
   * Cancela a exclusão de um Cartão (FR-401).
   */
  function cancelarExclusaoDeCartao(): void {
    setCartaoPendingExclusao(null);
  }

  /**
   * Exclui o Cartão com confirmação (FR-401, FR-044, FR-396).
   *
   * FR-044: a lista só muda depois que o servidor confirmou a exclusão — o
   * Cartão sai da lista, e o Baralho é relido para que a contagem e o
   * Agendamento reflitam o estado confirmado. Se a exclusão ou a releitura
   * falhar, a lista não é tocada e a mensagem do cliente é exibida.
   */
  async function confirmarExclusaoDeCartao(): Promise<void> {
    if (cartaoPendingExclusao === null || baralho === null) {
      return;
    }

    const cartaoParaExcluir = cartaoPendingExclusao;
    setExcluindoCartao(cartaoParaExcluir.id);
    setFalhaDeExclusaoDeCartao(null);

    const cartoesAtuais = baralho.cartoes;
    const indice = cartoesAtuais.findIndex(
      (item) => item.id === cartaoParaExcluir.id,
    );
    const vizinho =
      indice < 0
        ? null
        : (cartoesAtuais[indice + 1] ?? cartoesAtuais[indice - 1] ?? null);

    const resultado = await cliente.excluirCartao(cartaoParaExcluir.id);

    if (!resultado.ok) {
      setFalhaDeExclusaoDeCartao(resultado.mensagem);
      setExcluindoCartao(null);
      return;
    }

    const releitura = await cliente.obterBaralho(id);

    if (!releitura.ok) {
      setFalhaDeExclusaoDeCartao(releitura.mensagem);
      setExcluindoCartao(null);
      return;
    }

    setBaralho(releitura.baralho);
    setAnuncio(
      textos.baralhos.cartaoExcluidoAnuncio(cartaoParaExcluir.frente),
    );
    setSequenciaDeAnuncio((atual) => atual + 1);
    setFocoAposExclusaoDeCartao({
      cartaoId: cartaoParaExcluir.id,
      proximoCartaoId: vizinho?.id ?? null,
    });
    setExcluindoCartao(null);
    setCartaoPendingExclusao(null);
  }

  /**
   * Abre o diálogo de confirmação para exclusão do Baralho (FR-402).
   */
  function abrirExclusaoDoBaralho(): void {
    if (baralho === null) {
      return;
    }

    setFalhaDeExclusaoDoBaralho(null);
    setExclusaoDoBaralhoAberta(true);
  }

  /**
   * Cancela a exclusão do Baralho (FR-402).
   */
  function cancelarExclusaoDoBaralho(): void {
    setExclusaoDoBaralhoAberta(false);
    setFocoAposExclusaoDoBaralho(true);
  }

  /**
   * Exclui o Baralho com confirmação (FR-402, FR-044, FR-016, FR-017).
   */
  async function confirmarExclusaoDoBaralho(): Promise<void> {
    if (baralho === null) {
      return;
    }

    setExcluindoBaralho(true);
    setFalhaDeExclusaoDoBaralho(null);

    const resultado = await cliente.excluirBaralho(baralho.id);

    setExcluindoBaralho(false);

    if (resultado.ok) {
      // FR-044: só depois de o servidor confirmar a exclusão a tela navega
      // para a lista de Baralhos — onde o Baralho não aparecerá mais. A
      // navegação liberada vence a proteção de pendência desta operação
      // (FR-154).
      setExclusaoDoBaralhoAberta(false);
      navegarSemProtecao("#/baralhos");
      return;
    }

    setFalhaDeExclusaoDoBaralho(resultado.mensagem);
    setExclusaoDoBaralhoAberta(false);
    setFocoAposExclusaoDoBaralho(true);
  }

  function registrarBotaoDeExcluir(chave: string) {
    return (elemento: HTMLButtonElement | null): void => {
      if (elemento === null) {
        botoesDeExcluir.current.delete(chave);
      } else {
        botoesDeExcluir.current.set(chave, elemento);
      }
    };
  }

  const quantidadeDeCartoes = baralho?.cartoes.length ?? 0;
  const tagsDisponiveis = [
    ...new Set(
      (baralho?.cartoes ?? []).flatMap((cartao) => cartao.tags ?? []),
    ),
  ].sort();
  const agora = new Date();
  const cartoesComRevisao = (baralho?.cartoes ?? []).map((cartao) => ({
    ...cartao,
    baralho: { id },
    proximaRevisaoEm:
      cartoesListados.find((listado) => listado.id === cartao.id)
        ?.proximaRevisaoEm ?? null,
  })).map((cartao) => ({
    ...cartao,
    situacaoDaRevisao: situacaoDaRevisao(cartao.proximaRevisaoEm, agora),
  }));
  const cartoesFiltradosPorTextoETags = filtrarPorTags(
    filtrarCartoes(cartoesComRevisao, { consulta, baralho: id }),
    tagsSelecionadas,
  );
  // FR-430: combina Tipo com busca, tags e Situação, sem alterar os dados.
  const cartoesFiltrados = filtrarCartoesPorTipo(
    cartoesFiltradosPorTextoETags.filter((cartao) => {
      if (filtroDeSituacao === "todos") {
        return true;
      }
      return filtroDeSituacao === "pendente"
        ? cartao.situacaoDaRevisao !== "em-dia"
        : cartao.situacaoDaRevisao === "em-dia";
    }),
    filtroDeTipo,
  );

  function limparFiltros(): void {
    setConsulta("");
    setFiltroDeSituacao("todos");
    setFiltroDeTipo("todos");
    setTagsSelecionadas([]);
    campoDeBusca.current?.focus();
  }

  return (
    <div className="pagina">
      <div className="cabecalho-da-pagina">
        <div>
          <h1 ref={tituloDaPagina} tabIndex={-1}>
            {baralhoNaoEncontrado !== null
              ? textos.baralhos.deckNotFound
              : (baralho?.nome ?? "Baralho")}
          </h1>
          {baralho !== null && (
            <p className="texto-secundario">
              {textos.baralhos.contagemCabecalho(quantidadeDeCartoes)}
            </p>
          )}
          {baralho !== null && <EtiquetasDeTags tags={baralho.tags} />}
        </div>

        {baralho !== null && (
          // FR-145 (revisado), SC-078: todas as ações sobre o Baralho ficam
          // reunidas no topo da página, logo abaixo do título e antes da lista
          // de Cartões — alcançáveis sem rolar a lista e precedendo os Cartões
          // na ordem de leitura e de Tab. Sem Cartões, Revisar não leva a lugar
          // nenhum: o botão fica desabilitado e a explicação vem ao lado. Criar
          // Cartão é sempre acessível (FR-392).
          <div className="acoes">
            {quantidadeDeCartoes === 0 ? (
              <button
                type="button"
                className="botao botao--primario"
                disabled
                aria-describedby="motivo-para-nao-revisar"
              >
                {textos.baralhos.btnRevisarEsteBaralho}
              </button>
            ) : (
              <a
                className="botao botao--primario"
                href={`#/baralhos/${id}/estudo`}
              >
                {textos.baralhos.btnRevisarEsteBaralho}
              </a>
            )}
            <a
              className="botao botao--primario"
              href={hashDaRota({ nome: "novo-cartao", baralhoId: id })}
            >
              {textos.baralhos.btnCriarCartao}
            </a>
            <a
              className="botao botao--secundario"
              href={`#/baralhos/${id}/editar`}
            >
              {textos.baralhos.btnRenomear}
            </a>
            <button
              ref={botaoDeExcluirBaralho}
              type="button"
              className="botao botao--perigo"
              aria-label={textos.baralhos.btnExcluirBaralho}
              disabled={excluindoCartao !== null || excluindoBaralho}
              onClick={abrirExclusaoDoBaralho}
            >
              {textos.baralhos.btnExcluirBaralho}
            </button>
          </div>
        )}

        {baralho !== null && quantidadeDeCartoes === 0 && (
          <p id="motivo-para-nao-revisar" className="ajuda">
            {textos.baralhos.ajudaCriarCartoes}
          </p>
        )}
      </div>

      {baralho !== null && quantidadeDeCartoes > 0 && (
        <>
          <section className="filtros" aria-label={textos.baralhos.buscaEFiltros}>
            <div className="campo">
              <label
                className="rotulo"
                htmlFor="busca-de-cartoes-do-baralho"
              >
                {textos.baralhos.buscarCartoes}
              </label>
              <input
                id="busca-de-cartoes-do-baralho"
                ref={campoDeBusca}
                type="search"
                autoComplete="off"
                placeholder={textos.baralhos.buscarCartoesPlaceholder}
                value={consulta}
                onChange={(evento) => setConsulta(evento.target.value)}
              />
            </div>
            <OpcoesDeTags
              opcoes={tagsDisponiveis}
              selecionadas={tagsSelecionadas}
              aoAlterar={setTagsSelecionadas}
            />
            <div className="campo">
              <label
                className="rotulo"
                htmlFor="filtro-de-situacao-dos-cartoes"
              >
                {textos.baralhos.situacaoLabel}
              </label>
              <select
                id="filtro-de-situacao-dos-cartoes"
                value={filtroDeSituacao}
                onChange={(evento) =>
                  setFiltroDeSituacao(
                    evento.target.value as "todos" | "pendente" | "revisado",
                  )
                }
              >
                <option value="todos">{textos.baralhos.situacaoTodos}</option>
                <option value="pendente">{textos.baralhos.situacaoPendente}</option>
                <option value="revisado">{textos.baralhos.situacaoRevisado}</option>
              </select>
            </div>
            <div className="campo campo--filtro-de-tipo">
              <label className="rotulo" htmlFor="filtro-de-tipo-de-cartao">
                {textos.baralhos.tipoCartaoLabel}
              </label>
              <select
                id="filtro-de-tipo-de-cartao"
                value={filtroDeTipo}
                onChange={(evento) =>
                  setFiltroDeTipo(evento.target.value as FiltroDeTipoDeCartao)
                }
              >
                <option value="todos">Todos</option>
                {ORDEM_DOS_TIPOS.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {textos.cartao.nomeDoTipo[tipo]}
                  </option>
                ))}
              </select>
            </div>
          </section>
          <div className="resultado-cabecalho">
            <p role="status" aria-live="polite" aria-atomic="true">
              {textos.baralhos.cartaoEncontrado(cartoesFiltrados.length)}
            </p>
            <button
              type="button"
              className="botao botao--secundario"
              onClick={limparFiltros}
            >
              {textos.baralhos.btnLimparFiltros}
            </button>
          </div>
        </>
      )}

      {carregando ? (
        <EstadoDaCarga estado="carregando" mensagem={textos.baralhos.carregandoBaralho} />
      ) : baralhoNaoEncontrado !== null ? (
        <p className="erro" role="alert" aria-label={textos.baralhos.baralhoNaoEncontradoRotulo}>
          <TextoDoProduto texto={baralhoNaoEncontrado} />
        </p>
      ) : falhaDeCarregamento !== null ? (
        <EstadoDaCarga
          estado="falha"
          mensagem={falhaDeCarregamento}
          aoTentarNovamente={carregar}
        />
      ) : baralho !== null ? (
        <>
          {falhaDeExclusaoDeCartao !== null && (
            <p
              className="erro"
              role="alert"
              aria-label={textos.baralhos.falhaNaExclusaoDeCartao}
            >
              <TextoDoProduto texto={falhaDeExclusaoDeCartao} />
            </p>
          )}

          {anuncio !== null && (
            <p
              key={`anuncio-${sequenciaDeAnuncio}`}
              className="anuncio"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {anuncio}
            </p>
          )}

          <section aria-label={textos.baralhos.cartoesDoBaralho}>
            {baralho.cartoes.length === 0 ? (
              // FR-153, FR-392: o Baralho vazio tem a sua própria apresentação,
              // e a ação que o destrava é criar Cartões neste Baralho.
              <div
                className="estado-vazio"
                role="status"
                aria-label={textos.baralhos.listaVazia}
                aria-live="polite"
                aria-atomic="true"
              >
                <p>{textos.baralhos.vazioSemCartoes}</p>
                <a
                  className="botao botao--primario"
                  href={hashDaRota({ nome: "novo-cartao", baralhoId: id })}
                >
                  {textos.baralhos.btnCriarCartao}
                </a>
              </div>
            ) : cartoesFiltrados.length === 0 ? (
              <div className="estado-vazio" role="status">
                <h2>{textos.baralhos.naoEncontradoCartoes}</h2>
                <p>
                  {textos.baralhos.naoEncontradoCartoesDescricao}
                </p>
                <button
                  type="button"
                  className="botao botao--secundario"
                  onClick={limparFiltros}
                >
                  {textos.baralhos.btnLimparFiltros}
                </button>
              </div>
            ) : (
              <ul className="lista lista--compacta">
                {cartoesFiltrados.map((cartao) => (
                  <li
                    key={cartao.id}
                    className="linha-da-lista linha-da-lista--com-etiqueta"
                  >
                    <ResumoDoCartao cartao={cartao} aoFalharImagem={renovarEnderecos}>
                      <EtiquetasDeTags tags={cartao.tags} />
                    </ResumoDoCartao>
                    <span
                      className={`etiqueta etiqueta--${
                        cartao.situacaoDaRevisao === "em-dia"
                          ? "revisado"
                          : "pendente"
                      }`}
                    >
                      {cartao.situacaoDaRevisao === "em-dia"
                        ? textos.baralhos.cartaoRevisado
                        : textos.baralhos.cartaoPendente}
                    </span>
                    <div className="linha-da-lista__acoes">
                      <a
                        className="botao botao--secundario"
                        href={hashDaRota({
                          nome: "editar-cartao",
                          baralhoId: id,
                          id: cartao.id,
                        })}
                      >
                        {textos.baralhos.btnEditar}
                      </a>
                      <button
                        ref={registrarBotaoDeExcluir(`excluir:${cartao.id}`)}
                        className="botao botao--perigo"
                        type="button"
                        disabled={excluindoCartao !== null}
                        aria-label={`${textos.baralhos.btnExcluirCartao} ${rotuloDoCartao(cartao, textos)}`}
                        onClick={(e) =>
                          void abrirExclusaoDeCartao(
                            cartao,
                            e.currentTarget,
                          )
                        }
                      >
                        {textos.baralhos.btnExcluirCartao}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {falhaDeExclusaoDoBaralho !== null && (
            <p
              className="erro"
              role="alert"
              aria-label={textos.baralhos.falhaNaExclusaoDoBaralho}
            >
              <TextoDoProduto texto={falhaDeExclusaoDoBaralho} />
            </p>
          )}
        </>
      ) : null}

      {cartaoPendingExclusao !== null && (
        <DialogoDeConfirmacao
          aberto
          titulo={`Excluir "${cartaoPendingExclusao.frente}"?`}
          rotuloDeConfirmacao={textos.baralhos.excluirCartaoConfirm}
          confirmacaoDesabilitada={excluindoCartao !== null}
          aoConfirmar={() => void confirmarExclusaoDeCartao()}
          aoCancelar={cancelarExclusaoDeCartao}
        >
          <p>{textos.baralhos.descricaoCartaoExcluido}</p>
        </DialogoDeConfirmacao>
      )}

      {exclusaoDoBaralhoAberta && baralho !== null && (
        <DialogoDeConfirmacao
          aberto
          titulo={`Excluir "${baralho.nome}"?`}
          rotuloDeConfirmacao={textos.baralhos.excluirBaralhoConfirm}
          confirmacaoDesabilitada={excluindoBaralho}
          aoConfirmar={() => void confirmarExclusaoDoBaralho()}
          aoCancelar={cancelarExclusaoDoBaralho}
        >
          <p>{textos.baralhos.descricaoBaralhoExcluido(baralho.cartoes.length, baralho.quantidadeDeAgendamentos)}</p>
        </DialogoDeConfirmacao>
      )}
    </div>
  );
}

