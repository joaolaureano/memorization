import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type {
  BaralhoComCartoes,
  Cartao,
  CartaoListado,
  ClienteDoAcervo,
} from "../acervo-cliente/cliente";
import { EstadoDaCarga } from "./EstadoDaCarga";
import { useProtecaoDeSaida } from "./protecao-de-saida";

/**
 * Tela de adicionar Cartões existentes a um Baralho
 * (T1111; specs/012-interface-visual-navegavel/tasks.md, FR-145, FR-153–156).
 *
 * É a página `#/baralhos/<id>/adicionar`: lista **apenas** os Cartões que
 * ainda não estão vinculados a este Baralho (FR-145) e vincula um por vez.
 * Consome somente a Interface `ClienteDoAcervo` — `obterBaralho(id)` para o
 * nome e os Vínculos confirmados, `listarCartoes()` para o acervo inteiro —, e
 * **não reproduz nenhuma regra de domínio**: quem decide se o par pode ser
 * vinculado ou se o Baralho existe é o cliente (FR-046).
 *
 * FR-044, FR-045, SC-012: vincular nunca altera a lista por otimismo. A
 * operação é submetida e, **somente após o sucesso**, a tela relê
 * `obterBaralho` e `listarCartoes`; o Cartão vinculado sai da lista porque
 * passou a fazer parte de `baralho.cartoes`. Se qualquer releitura falhar, as
 * listas permanecem como estavam, retratando o último estado confirmado.
 *
 * FR-153, FR-154: carregamento, falha e vazio usam `EstadoDaCarga`; enquanto há
 * vinculação em andamento, sair da tela é protegido com o motivo anunciado e os
 * botões ficam desabilitados.
 *
 * FR-156: Baralho inexistente e Baralho que não pertence a quem está
 * autenticado resolvem na mesma mensagem, com o caminho de volta à lista de
 * Baralhos.
 */

interface PropriedadesDaPaginaDeAdicionarCartoes {
  cliente: ClienteDoAcervo;
  id: string;
}

/**
 * Ação de foco a executar depois que uma vinculação bem-sucedida re-renderiza
 * a lista (FR-063, FR-064, SC-019). `proximoCartaoId` é o vizinho que passa a
 * ocupar a posição do Cartão vinculado — o seguinte, ou o anterior quando o
 * vinculado era o último. Sem vizinho, o foco vai ao título da seção, nunca de
 * volta ao início da página.
 */
interface FocoAposVincular {
  proximoCartaoId: string | null;
}

/** Motivo anunciado enquanto uma vinculação está em andamento (FR-154). */
const MOTIVO_DE_PENDENCIA = "Aguarde: a operação está em andamento.";

export function PaginaDeAdicionarCartoes({
  cliente,
  id,
}: PropriedadesDaPaginaDeAdicionarCartoes) {
  const [baralho, setBaralho] = useState<BaralhoComCartoes | null>(null);
  const [cartoes, setCartoes] = useState<CartaoListado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falhaDeCarregamento, setFalhaDeCarregamento] = useState<string | null>(
    null,
  );
  const [baralhoNaoEncontrado, setBaralhoNaoEncontrado] = useState<
    string | null
  >(null);
  const [falhaDeAcao, setFalhaDeAcao] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [sequenciaDeAnuncio, setSequenciaDeAnuncio] = useState(0);
  const [vinculando, setVinculando] = useState<string | null>(null);
  const [focoAposVincular, setFocoAposVincular] =
    useState<FocoAposVincular | null>(null);

  const botoes = useRef(new Map<string, HTMLButtonElement>());
  const tituloDaLista = useRef<HTMLHeadingElement>(null);
  const requisicao = useRef(0);

  useProtecaoDeSaida(
    vinculando !== null
      ? { tipo: "pendencia", motivo: MOTIVO_DE_PENDENCIA }
      : null,
  );

  const carregar = useCallback(() => {
    const minha = ++requisicao.current;

    setCarregando(true);
    setFalhaDeCarregamento(null);
    setBaralhoNaoEncontrado(null);
    setFalhaDeAcao(null);
    setAnuncio(null);

    void Promise.all([cliente.obterBaralho(id), cliente.listarCartoes()]).then(
      ([resultadoDoBaralho, resultadoDosCartoes]) => {
        if (minha !== requisicao.current) {
          return;
        }

        if (!resultadoDoBaralho.ok) {
          setBaralho(null);
          setCartoes([]);

          if (resultadoDoBaralho.erro === "nao_encontrado") {
            setBaralhoNaoEncontrado(resultadoDoBaralho.mensagem);
          } else {
            setFalhaDeCarregamento(resultadoDoBaralho.mensagem);
          }
        } else if (!resultadoDosCartoes.ok) {
          setFalhaDeCarregamento(resultadoDosCartoes.mensagem);
        } else {
          setBaralho(resultadoDoBaralho.baralho);
          setCartoes(resultadoDosCartoes.cartoes);
        }

        setCarregando(false);
      },
    );
  }, [cliente, id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /**
   * `useLayoutEffect`, e não `useEffect` (FR-063, FR-064, SC-019): o foco tem de
   * ser restaurado de forma síncrona logo após a mutação do DOM. Um `useEffect`
   * corre depois da pintura e, no intervalo, o botão focado já foi removido ou
   * desabilitado, deixando o foco no `<body>` — um foco transitório no `body`
   * que quebra a ordem de foco da WCAG e é observável por leitores de tela e por
   * quem inspeciona o DOM logo após o commit. É o mesmo padrão de
   * `PaginaDoBaralho.tsx` para o foco pós-remoção.
   */
  useLayoutEffect(() => {
    if (focoAposVincular === null) {
      return;
    }

    const botao =
      focoAposVincular.proximoCartaoId === null
        ? undefined
        : botoes.current.get(`vincular:${focoAposVincular.proximoCartaoId}`);

    if (botao !== undefined) {
      botao.focus();
    } else {
      tituloDaLista.current?.focus();
    }

    setFocoAposVincular(null);
  }, [focoAposVincular, cartoes]);

  /**
   * Os Cartões que ainda não estão vinculados a este Baralho (FR-145): o acervo
   * confirmado (`listarCartoes`) menos os Vínculos confirmados
   * (`obterBaralho`).
   */
  function cartoesDisponiveis(): CartaoListado[] {
    const idsVinculados = new Set(
      (baralho?.cartoes ?? []).map((cartao) => cartao.id),
    );

    return cartoes.filter((cartao) => !idsVinculados.has(cartao.id));
  }

  /**
   * Vincula um Cartão a este Baralho (FR-145). FR-044: a lista só muda depois
   * que o servidor confirmou a vinculação e a releitura trouxe o estado novo —
   * o Cartão vinculado sai da lista de disponíveis.
   */
  async function vincular(cartao: Cartao): Promise<void> {
    setFalhaDeAcao(null);
    setAnuncio(null);
    setVinculando(cartao.id);

    // O vizinho que passará a ocupar a posição do Cartão vinculado na lista (o
    // seguinte, ou o anterior quando o vinculado era o último); sem vizinho, o
    // foco vai ao título da seção.
    const disponiveis = cartoesDisponiveis();
    const indice = disponiveis.findIndex((item) => item.id === cartao.id);
    const vizinho =
      indice < 0
        ? null
        : (disponiveis[indice + 1] ?? disponiveis[indice - 1] ?? null);

    const resultado = await cliente.vincular(cartao.id, id);

    if (!resultado.ok) {
      setFalhaDeAcao(resultado.mensagem);
      setVinculando(null);
      return;
    }

    const [resultadoDoBaralho, resultadoDosCartoes] = await Promise.all([
      cliente.obterBaralho(id),
      cliente.listarCartoes(),
    ]);

    if (!resultadoDoBaralho.ok) {
      setFalhaDeAcao(resultadoDoBaralho.mensagem);
      setVinculando(null);
      return;
    }

    if (!resultadoDosCartoes.ok) {
      setFalhaDeAcao(resultadoDosCartoes.mensagem);
      setVinculando(null);
      return;
    }

    setBaralho(resultadoDoBaralho.baralho);
    setCartoes(resultadoDosCartoes.cartoes);
    setAnuncio("Cartão vinculado ao Baralho.");
    setSequenciaDeAnuncio((atual) => atual + 1);
    setFocoAposVincular({ proximoCartaoId: vizinho?.id ?? null });
    setVinculando(null);
  }

  function registrarBotao(chave: string) {
    return (elemento: HTMLButtonElement | null): void => {
      if (elemento === null) {
        botoes.current.delete(chave);
      } else {
        botoes.current.set(chave, elemento);
      }
    };
  }

  const disponiveis = cartoesDisponiveis();
  const semCartoesNoAcervo = cartoes.length === 0;

  return (
    <div className="pagina">
      <p className="voltar">
        <a href={`#/baralhos/${id}`}>← Voltar para o Baralho</a>
      </p>

      <div className="cabecalho-da-pagina">
        <div>
          <p className="sobretitulo">Baralho</p>
          <h1>
            {baralhoNaoEncontrado !== null
              ? "Baralho não encontrado"
              : `Adicionar cartões a ${baralho?.nome ?? "Baralho"}`}
          </h1>
          <p className="texto-secundario">
            Um Cartão pode fazer parte de vários Baralhos.
          </p>
        </div>
      </div>

      {carregando ? (
        <EstadoDaCarga estado="carregando" mensagem="Carregando Cartões…" />
      ) : baralhoNaoEncontrado !== null ? (
        <p className="erro" role="alert" aria-label="Baralho não encontrado">
          {baralhoNaoEncontrado}
        </p>
      ) : falhaDeCarregamento !== null ? (
        <EstadoDaCarga
          estado="falha"
          mensagem={falhaDeCarregamento}
          aoTentarNovamente={carregar}
        />
      ) : (
        <>
          {falhaDeAcao !== null && (
            <p
              className="erro"
              role="alert"
              aria-label="Falha na operação de Vínculo"
            >
              {falhaDeAcao}
            </p>
          )}

          {anuncio !== null && (
            <p
              key={`anuncio-de-vinculo-${sequenciaDeAnuncio}`}
              className="anuncio-de-vinculo"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label="Mudança de Vínculo"
            >
              {anuncio}
            </p>
          )}

          <section>
            <h2 ref={tituloDaLista} tabIndex={-1}>
              Cartões disponíveis
            </h2>

            {disponiveis.length === 0 ? (
              <EstadoDaCarga
                estado="vazio"
                mensagem={
                  semCartoesNoAcervo
                    ? "Você ainda não tem Cartões."
                    : "Todos os seus Cartões já estão neste Baralho."
                }
                acao={
                  <a className="botao botao--primario" href="#/cartoes/novo">
                    Criar cartão
                  </a>
                }
              />
            ) : (
              <ul className="lista">
                {disponiveis.map((cartao) => (
                  <li key={cartao.id} className="cartao">
                    <p className="lado-do-cartao">Frente</p>
                    <p className="conteudo-do-cartao">{cartao.frente}</p>
                    <p className="lado-do-cartao">Verso</p>
                    <p className="conteudo-do-cartao">{cartao.verso}</p>
                    <div className="acoes">
                      <button
                        ref={registrarBotao(`vincular:${cartao.id}`)}
                        className="botao botao--primario"
                        type="button"
                        disabled={vinculando !== null}
                        aria-label={`Vincular ${cartao.frente}`}
                        onClick={() => void vincular(cartao)}
                      >
                        Vincular
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="acoes">
            <a className="botao botao--secundario" href={`#/baralhos/${id}`}>
              Concluir
            </a>
          </div>
        </>
      )}
    </div>
  );
}
