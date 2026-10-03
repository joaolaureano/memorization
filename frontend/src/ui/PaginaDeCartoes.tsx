import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { CartaoListado, ClienteDoAcervo } from "../acervo-cliente/cliente";
import { DialogoDeConfirmacao } from "./DialogoDeConfirmacao";
import { EstadoDaCarga } from "./EstadoDaCarga";

/**
 * Tela de Cartões — apenas a lista (T1112;
 * specs/012-interface-visual-navegavel/tasks.md; FR-140, FR-141, FR-144,
 * FR-146, FR-147, FR-148, FR-153, FR-154, FR-155, FR-156).
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
 * Os nomes acessíveis das ações incorporam a Frente do Cartão ("Editar
 * <Frente>", "Excluir <Frente>") para que cada item seja inequívoco para
 * leitores de tela e para as provas (FR-155).
 */

interface PropriedadesDaPaginaDeCartoes {
  cliente: ClienteDoAcervo;
}

export function PaginaDeCartoes({ cliente }: PropriedadesDaPaginaDeCartoes) {
  const [cartoes, setCartoes] = useState<CartaoListado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falhaDeListagem, setFalhaDeListagem] = useState<string | null>(null);

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

  const tituloDaLista = useRef<HTMLHeadingElement>(null);
  const botoesDeEdicao = useRef(new Map<string, HTMLAnchorElement>());
  const botoesDeExclusao = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    let ativo = true;

    void cliente.listarCartoes().then((resultado) => {
      if (!ativo) {
        return;
      }

      if (resultado.ok) {
        setCartoes(resultado.cartoes);
      } else {
        setFalhaDeListagem(resultado.mensagem);
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
      tituloDaLista.current?.focus();
    } else {
      botoesDeExclusao.current.get(focoAposExclusao.cartaoId)?.focus();
    }

    setFocoAposExclusao(null);
  }, [cartaoParaExcluir, focoAposExclusao]);

  /**
   * Relê a lista pela Interface (FR-044, FR-153).
   *
   * A releitura também é o caminho de "Tentar novamente" na falha: nenhuma
   * mensagem é inventada, e a lista volta a retratar o acervo autoritativo.
   */
  async function carregarCartoes(): Promise<void> {
    setCarregando(true);
    setFalhaDeListagem(null);

    const resultado = await cliente.listarCartoes();

    if (resultado.ok) {
      setCartoes(resultado.cartoes);
    } else {
      setFalhaDeListagem(resultado.mensagem);
    }

    setCarregando(false);
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
      // alvo para o fechamento devolvê-lo ao título da lista.
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

  return (
    <div className="pagina">
      <header className="cabecalho-da-pagina">
        <div>
          <p className="sobretitulo">Seu acervo</p>
          <h1>Cartões</h1>
          <p className="texto-secundario">
            Perguntas e respostas para construir sua memória.
          </p>
        </div>
        <a className="botao botao--primario" href="#/cartoes/novo">
          Criar cartão
        </a>
      </header>

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

      <h2 ref={tituloDaLista} tabIndex={-1}>
        Lista de Cartões
      </h2>

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
      ) : (
        <ul className="lista">
          {cartoes.map((cartao) => (
            <li key={cartao.id} className="cartao">
              <p className="lado-do-cartao">Frente</p>
              <p className="conteudo-do-cartao">{cartao.frente}</p>
              <p className="lado-do-cartao">Verso</p>
              <p className="conteudo-do-cartao">{cartao.verso}</p>
              <p className="baralhos-do-cartao">
                {cartao.baralhos.length === 0
                  ? "Em nenhum Baralho"
                  : cartao.baralhos.map((baralho) => baralho.nome).join(", ")}
              </p>
              <div className="acoes">
                <a
                  ref={registrarBotaoDeEdicao(cartao.id)}
                  className="botao botao--secundario"
                  href={`#/cartoes/${encodeURIComponent(cartao.id)}/editar`}
                  aria-label={`Editar ${cartao.frente}`}
                >
                  Editar
                </a>
                <button
                  ref={registrarBotaoDeExclusao(cartao.id)}
                  className="botao botao--perigo"
                  type="button"
                  aria-label={`Excluir ${cartao.frente}`}
                  onClick={() => abrirExclusao(cartao)}
                >
                  Excluir
                </button>
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
