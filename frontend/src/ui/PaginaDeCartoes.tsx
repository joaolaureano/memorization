import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type {
  BaralhoListado,
  CartaoListado,
  ClienteDoAcervo,
} from "../acervo-cliente/cliente";
import {
  filtrarCartoes,
  type FiltroDeBaralho,
} from "../acervo-cliente/busca-no-acervo";
import { DialogoDeConfirmacao } from "./DialogoDeConfirmacao";
import { EstadoDaCarga } from "./EstadoDaCarga";

/**
 * Tela de Cartões — apenas a lista (T1112, T2102; spec 012: FR-140, FR-141,
 * FR-147, FR-148, FR-153, FR-154, FR-155, FR-156; spec 021: FR-339, FR-344,
 * FR-345).
 *
 * A criação e a edição saíram desta tela e passaram a ter página própria
 * (`PaginaDoFormularioDeCartao`), alcançável por rota: a criação só acontece
 * pela ação da pessoa (FR-141, FR-147), nunca por um formulário sempre aberto
 * no meio da lista. Aqui restam a leitura do acervo, as ações por item e a
 * exclusão — que continua declarando a consequência real antes de remover o
 * Cartão (FR-007, FR-008, FR-068, FR-069).
 *
 * Consome somente a Interface `ClienteDoAcervo`; o Adapter (Http em produção,
 * EmMemoria em teste) chega por propriedade. As três cargas — carregando,
 * falha e vazio — são delegadas ao `EstadoDaCarga`, e a falha de transporte
 * preserva o acervo exibido e permite nova tentativa (FR-044, FR-144, FR-153).
 *
 * Cada item segue a linha compacta da lista de Baralhos (FR-339) e mostra só
 * o título — a Frente, somente leitura — com as ações Excluir → Editar à
 * direita (FR-344). Verso e Vínculos ficam fora da listagem; as consequências
 * reais continuam declaradas no diálogo de exclusão (FR-345).
 *
 * Os nomes acessíveis das ações incorporam a Frente do Cartão ("Editar
 * <Frente>", "Excluir <Frente>") para que cada item seja inequívoco para
 * leitores de tela e para as provas (FR-155).
 *
 * Desde a 024 (FR-382, SC-150), a Situação da revisão não filtra mais os
 * Cartões: ela pertence aos Baralhos e às suas listas. Aqui restam a busca
 * por Frente/Verso e o filtro de Baralho.
 */

interface PropriedadesDaPaginaDeCartoes {
  cliente: ClienteDoAcervo;
}

export function PaginaDeCartoes({ cliente }: PropriedadesDaPaginaDeCartoes) {
  const [cartoes, setCartoes] = useState<CartaoListado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falhaDeListagem, setFalhaDeListagem] = useState<string | null>(null);
  const [baralhos, setBaralhos] = useState<BaralhoListado[]>([]);

  /**
   * Os critérios de busca vivem enquanto a página está montada: recarregar a
   * lista ou excluir um Cartão não os zera. Só "Limpar filtros" os apaga
   * (FR-354, FR-357).
   */
  const [consulta, setConsulta] = useState("");
  const [filtroDeBaralho, setFiltroDeBaralho] =
    useState<FiltroDeBaralho>("todos");
  const campoDeBusca = useRef<HTMLInputElement>(null);

  const [cartaoParaExcluir, setCartaoParaExcluir] =
    useState<CartaoListado | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [falhaDeExclusao, setFalhaDeExclusao] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [sequenciaDeAnuncio, setSequenciaDeAnuncio] = useState(0);

  /**
   * Alvo do foco a aplicar depois que o diálogo de exclusão fechar (FR-159).
   *
   * Enquanto o modal está aberto, o conteúdo fora dele é inerte e um `focus()`
   * síncrono seria ignorado; ao fechar, o navegador tentaria restaurar o foco
   * no botão "Excluir" que saiu da árvore, deixando-o em `<body>`. Por isso o
   * alvo desejado é registrado aqui e consumido só quando o diálogo já fechou.
   */
  const [focoAposExclusao, setFocoAposExclusao] = useState<
    { alvo: "titulo" } | { alvo: "botao"; cartaoId: string } | null
  >(null);

  const tituloDaPagina = useRef<HTMLHeadingElement>(null);
  const botoesDeEdicao = useRef(new Map<string, HTMLAnchorElement>());
  const botoesDeExclusao = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    let ativo = true;

    void Promise.all([
      cliente.listarCartoes(),
      cliente.listarBaralhos(),
    ]).then(([resultadoDeCartoes, resultadoDeBaralhos]) => {
      if (!ativo) {
        return;
      }

      if (resultadoDeCartoes.ok) {
        setCartoes(resultadoDeCartoes.cartoes);
      }

      if (resultadoDeBaralhos.ok) {
        setBaralhos(resultadoDeBaralhos.baralhos);
        setFiltroDeBaralho((atual) =>
          filtroDeBaralhoValido(atual, resultadoDeBaralhos.baralhos),
        );
      }

      if (!resultadoDeCartoes.ok) {
        setFalhaDeListagem(resultadoDeCartoes.mensagem);
      } else if (!resultadoDeBaralhos.ok) {
        setFalhaDeListagem(resultadoDeBaralhos.mensagem);
      }

      setCarregando(false);
    });

    return () => {
      ativo = false;
    };
  }, [cliente]);

  /**
   * Devolve o foco depois que o diálogo de exclusão fecha (FR-159).
   *
   * Enquanto o modal está aberto o restante da página é inerte, então mover o
   * foco nesse instante seria ignorado; ao fechar, o navegador tentaria
   * restaurá-lo no botão "Excluir" já removido, deixando-o em `<body>`. Aplicar
   * o alvo registrado aqui — com o diálogo já fechado — garante que o foco
   * volte a um lugar significativo, nunca ao `<body>`.
   */
  useLayoutEffect(() => {
    if (cartaoParaExcluir !== null || focoAposExclusao === null) {
      return;
    }

    if (focoAposExclusao.alvo === "titulo") {
      tituloDaPagina.current?.focus();
    } else {
      botoesDeExclusao.current.get(focoAposExclusao.cartaoId)?.focus();
    }

    setFocoAposExclusao(null);
  }, [cartaoParaExcluir, focoAposExclusao]);

  /**
   * Relê Cartões e Baralhos pela Interface (FR-044, FR-153).
   *
   * A releitura também é o caminho de "Tentar novamente" na falha: nenhuma
   * mensagem é inventada, e a lista volta a retratar o acervo autoritativo.
   * Os critérios de busca já escolhidos são preservados (FR-357), exceto um
   * filtro de Baralho que tenha deixado de existir.
   */
  async function carregarCartoes(): Promise<void> {
    setCarregando(true);
    setFalhaDeListagem(null);

    const [resultadoDeCartoes, resultadoDeBaralhos] = await Promise.all([
      cliente.listarCartoes(),
      cliente.listarBaralhos(),
    ]);

    if (resultadoDeCartoes.ok) {
      setCartoes(resultadoDeCartoes.cartoes);
    }

    if (resultadoDeBaralhos.ok) {
      setBaralhos(resultadoDeBaralhos.baralhos);
      setFiltroDeBaralho((atual) =>
        filtroDeBaralhoValido(atual, resultadoDeBaralhos.baralhos),
      );
    }

    if (!resultadoDeCartoes.ok) {
      setFalhaDeListagem(resultadoDeCartoes.mensagem);
    } else if (!resultadoDeBaralhos.ok) {
      setFalhaDeListagem(resultadoDeBaralhos.mensagem);
    }

    setCarregando(false);
  }

  /**
   * Apaga todos os critérios de busca e devolve o foco ao campo de consulta
   * (FR-354).
   */
  function limparFiltros(): void {
    setConsulta("");
    setFiltroDeBaralho("todos");
    campoDeBusca.current?.focus();
  }

  function abrirExclusao(cartao: CartaoListado): void {
    setCartaoParaExcluir(cartao);
    setFalhaDeExclusao(null);
  }

  function cancelarExclusao(): void {
    if (cartaoParaExcluir === null) {
      return;
    }

    const cartaoId = cartaoParaExcluir.id;

    // FR-159: com o diálogo aberto o foco não pode ser movido (conteúdo
    // inerte); registra o alvo para o fechamento devolver o foco ao botão.
    setFocoAposExclusao({ alvo: "botao", cartaoId });
    setCartaoParaExcluir(null);
  }

  async function confirmarExclusao(): Promise<void> {
    if (cartaoParaExcluir === null) {
      return;
    }

    const cartao = cartaoParaExcluir;

    setExcluindo(true);
    setFalhaDeExclusao(null);

    const resultado = await cliente.excluirCartao(cartao.id);

    if (resultado.ok) {
      // FR-044: a remoção só sai da lista depois que o servidor confirmou a
      // exclusão. A lista é relida para refletir o acervo autoritativo.
      setCartoes((atuais) => atuais.filter((item) => item.id !== cartao.id));
      // FR-159: com o diálogo ainda aberto o foco seria ignorado; registra o
      // alvo para o fechamento devolvê-lo ao título da página.
      setFocoAposExclusao({ alvo: "titulo" });
      setCartaoParaExcluir(null);
      setAnuncio("Cartão excluído. Nenhum Baralho foi excluído.");
      setSequenciaDeAnuncio((atual) => atual + 1);

      await carregarCartoes();
    } else {
      setFalhaDeExclusao(resultado.mensagem);
      // FR-159: a exclusão falhou e o Cartão permanece; devolve o foco ao seu
      // botão "Excluir" depois do fechamento, em vez de deixá-lo em `<body>`.
      setFocoAposExclusao({ alvo: "botao", cartaoId: cartao.id });
      setCartaoParaExcluir(null);
    }

    setExcluindo(false);
  }

  function registrarBotaoDeEdicao(cartaoId: string) {
    return (elemento: HTMLAnchorElement | null): void => {
      if (elemento === null) {
        botoesDeEdicao.current.delete(cartaoId);
      } else {
        botoesDeEdicao.current.set(cartaoId, elemento);
      }
    };
  }

  function registrarBotaoDeExclusao(cartaoId: string) {
    return (elemento: HTMLButtonElement | null): void => {
      if (elemento === null) {
        botoesDeExclusao.current.delete(cartaoId);
      } else {
        botoesDeExclusao.current.set(cartaoId, elemento);
      }
    };
  }

  const cartoesFiltrados = filtrarCartoes(cartoes, {
    consulta,
    baralho: filtroDeBaralho,
  });
  const listaCarregada = !carregando && falhaDeListagem === null;

  return (
    <div className="pagina">
      <header className="cabecalho-da-pagina">
        <div>
          <h1 ref={tituloDaPagina} tabIndex={-1}>
            Cartões
          </h1>
          <p className="texto-secundario">
            Perguntas e respostas para construir sua memória.
          </p>
        </div>
        <a className="botao botao--primario" href="#/cartoes/novo">
          Criar cartão
        </a>
      </header>

      <section className="filtros" aria-label="Busca e filtros">
        <div className="campo">
          <label className="rotulo" htmlFor="busca-de-cartoes">
            Buscar cartões
          </label>
          <input
            id="busca-de-cartoes"
            type="search"
            autoComplete="off"
            placeholder="Buscar na frente ou no verso"
            value={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            ref={campoDeBusca}
          />
        </div>
        <div className="campo">
          <label className="rotulo" htmlFor="filtro-de-baralho">
            Baralho
          </label>
          <select
            id="filtro-de-baralho"
            value={filtroDeBaralho}
            onChange={(evento) => setFiltroDeBaralho(evento.target.value)}
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
      </section>

      <div className="resultado-cabecalho">
        <p role="status" aria-live="polite" aria-atomic="true">
          {listaCarregada ? contagemDeResultados(cartoesFiltrados.length) : null}
        </p>
        <button
          type="button"
          className="botao botao--secundario"
          onClick={limparFiltros}
        >
          Limpar filtros
        </button>
      </div>

      {anuncio !== null && (
        <p
          key={sequenciaDeAnuncio}
          className="anuncio-de-acao"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label="Mudança de Cartão"
        >
          {anuncio}
        </p>
      )}

      {falhaDeExclusao !== null && (
        <p
          className="erro"
          role="alert"
          aria-label="Falha na exclusão do Cartão"
        >
          {falhaDeExclusao}
        </p>
      )}

      {carregando ? (
        <EstadoDaCarga estado="carregando" mensagem="Carregando Cartões…" />
      ) : falhaDeListagem !== null ? (
        <EstadoDaCarga
          estado="falha"
          mensagem={falhaDeListagem}
          aoTentarNovamente={() => void carregarCartoes()}
        />
      ) : cartoes.length === 0 ? (
        // O estado vazio é a única região ativa polida da listagem e tem nome
        // acessível próprio (FR-056, FR-153): assim o anúncio é inequívoco
        // mesmo com a região viva que a proteção de saída mantém na árvore.
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label="Lista de Cartões vazia"
        >
          <EstadoDaCarga
            estado="vazio"
            mensagem="Ainda não há Cartões. Crie o primeiro para começar."
            acao={
              <a className="botao botao--primario" href="#/cartoes/novo">
                Criar cartão
              </a>
            }
          />
        </div>
      ) : cartoesFiltrados.length === 0 ? (
        <div className="estado-vazio">
          <h2>Nenhum resultado encontrado</h2>
          <p>Altere a busca ou limpe os filtros para ver o acervo.</p>
          <button
            type="button"
            className="botao botao--secundario"
            onClick={limparFiltros}
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <ul className="lista lista--compacta">
          {cartoesFiltrados.map((cartao) => (
            <li key={cartao.id} className="linha-da-lista">
              <div className="linha-da-lista__texto">
                <p className="linha-da-lista__titulo">{cartao.frente}</p>
              </div>
              <div className="linha-da-lista__acoes">
                <button
                  ref={registrarBotaoDeExclusao(cartao.id)}
                  className="botao botao--perigo"
                  type="button"
                  aria-label={`Excluir ${cartao.frente}`}
                  onClick={() => abrirExclusao(cartao)}
                >
                  Excluir
                </button>
                <a
                  ref={registrarBotaoDeEdicao(cartao.id)}
                  className="botao botao--secundario"
                  href={`#/cartoes/${encodeURIComponent(cartao.id)}/editar`}
                  aria-label={`Editar ${cartao.frente}`}
                >
                  Editar
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      {cartaoParaExcluir !== null && (
        <DialogoDeConfirmacao
          aberto
          titulo="Excluir Cartão"
          rotuloDeConfirmacao="Excluir Cartão"
          confirmacaoDesabilitada={excluindo}
          aoConfirmar={() => void confirmarExclusao()}
          aoCancelar={cancelarExclusao}
        >
          <p>{descricaoDeExclusaoDeCartao(cartaoParaExcluir)}</p>
        </DialogoDeConfirmacao>
      )}
    </div>
  );
}

/**
 * Descreve a quantidade de resultados em linguagem corrente (FR-354).
 */
function contagemDeResultados(quantidade: number): string {
  return quantidade === 1 ? "1 resultado" : `${quantidade} resultados`;
}

/**
 * Mantém o filtro de Baralho coerente com o acervo (FR-357): "todos" e
 * "sem-baralho" são sempre válidos; um identificador inexistente volta a
 * "todos".
 */
function filtroDeBaralhoValido(
  atual: FiltroDeBaralho,
  baralhos: readonly BaralhoListado[],
): FiltroDeBaralho {
  if (atual === "todos" || atual === "sem-baralho") {
    return atual;
  }

  return baralhos.some((baralho) => baralho.id === atual) ? atual : "todos";
}

/**
 * Declara a consequência real da exclusão de um Cartão (FR-007, FR-008):
 * apenas os Vínculos deixam de existir, e nenhum Baralho é destruído.
 */
function descricaoDeExclusaoDeCartao(cartao: CartaoListado): string {
  const quantidade = cartao.baralhos.length;

  if (quantidade === 0) {
    return "Este Cartão não está vinculado a nenhum Baralho. A exclusão removerá o Cartão e não afetará Baralhos.";
  }

  if (quantidade === 1) {
    return "Este Cartão está vinculado a 1 Baralho. A exclusão removerá o Cartão e o Vínculo; nenhum Baralho será excluído.";
  }

  return `Este Cartão está vinculado a ${quantidade} Baralhos. A exclusão removerá o Cartão e os ${quantidade} Vínculos; nenhum Baralho será excluído.`;
}
