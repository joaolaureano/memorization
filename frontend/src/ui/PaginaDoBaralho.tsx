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
  ClienteDoAcervo,
} from "../acervo-cliente/cliente";
import { DialogoDeConfirmacao } from "./DialogoDeConfirmacao";
import { EstadoDaCarga } from "./EstadoDaCarga";
import {
  useNavegarSemProtecao,
  useProtecaoDeSaida,
} from "./protecao-de-saida";

/**
 * Tela de detalhe de um Baralho
 * (T1110; specs/012-interface-visual-navegavel/tasks.md, FR-145, FR-147,
 * FR-153, FR-156).
 *
 * É a página `#/baralhos/<id>`: mostra o Baralho, a contagem de Cartões, o
 * caminho para Estudar e a lista dos Cartões vinculados, com a remoção de cada
 * Vínculo (FR-145, FR-147). As operações que esta tela antes acumulava —
 * renomear e vincular Cartões existentes — passaram a viver nas suas próprias
 * páginas (`#/baralhos/<id>/editar` e `#/baralhos/<id>/adicionar`), e por isso
 * a tela consome apenas `obterBaralho(id)`, que já traz os Cartões vinculados e
 * a elegibilidade derivada.
 *
 * A tela **não reproduz nenhuma regra de domínio** — quem decide se o Baralho
 * existe é o cliente, e a tela apenas exibe as mensagens em português que ele
 * devolve (FR-046). Baralho inexistente e Baralho que não pertence a quem está
 * autenticado resolvem na mesma mensagem, sem distinguir os dois casos
 * (FR-156).
 *
 * FR-044, FR-045, SC-012: remover nunca altera a lista por otimismo. A operação
 * é submetida e, **somente após o sucesso**, a tela relê `obterBaralho` e passa
 * a exibir o que o servidor confirmou. Se a releitura falhar, a lista permanece
 * exatamente como estava — o estado confirmado anteriormente.
 *
 * FR-147: remover um Cartão deste Baralho é reversível — o Cartão e os demais
 * Vínculos continuam existindo (FR-021) —, então não há diálogo de
 * confirmação. Já a exclusão do Baralho (FR-016, FR-017, FR-068, FR-069) é
 * precedida de diálogo acessível que declara quantos Cartões continuarão
 * existindo e que nenhum Cartão será destruído. Confirmada, a tela navega para
 * `#/baralhos`; em falha de transporte, o Baralho continua exibido (FR-045).
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
 * Ação de foco a executar depois que uma remoção bem-sucedida re-renderiza a
 * lista (FR-063, FR-064, SC-019). `proximoCartaoId` é o vizinho que passa a
 * ocupar a posição do Cartão removido — o seguinte, ou o anterior quando o
 * removido era o último. Sem vizinho, o foco vai ao título da seção, nunca de
 * volta ao início da página.
 */
interface FocoAposRemocao {
  cartaoId: string;
  proximoCartaoId: string | null;
}

/** Motivo anunciado enquanto uma operação do Baralho está em andamento (FR-154). */
const MOTIVO_DE_PENDENCIA = "Aguarde: a operação está em andamento.";

export function PaginaDoBaralho({
  cliente,
  id,
}: PropriedadesDaPaginaDoBaralho) {
  const [baralho, setBaralho] = useState<BaralhoComCartoes | null>(null);
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
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [focoAposRemocao, setFocoAposRemocao] =
    useState<FocoAposRemocao | null>(null);
  const [exclusaoPedida, setExclusaoPedida] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [falhaDeExclusao, setFalhaDeExclusao] = useState<string | null>(null);
  const [focoAposExclusao, setFocoAposExclusao] = useState(false);

  const botoes = useRef(new Map<string, HTMLButtonElement>());
  const tituloDaPagina = useRef<HTMLHeadingElement>(null);
  const botaoDeExcluir = useRef<HTMLButtonElement>(null);
  const requisicao = useRef(0);

  const navegarSemProtecao = useNavegarSemProtecao();

  // FR-154: enquanto uma operação está em andamento, sair da tela é bloqueado
  // com o motivo anunciado, e não com um diálogo.
  useProtecaoDeSaida(
    removendo !== null || excluindo
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

    void cliente.obterBaralho(id).then((resultado) => {
      if (minha !== requisicao.current) {
        return;
      }

      if (resultado.ok) {
        setBaralho(resultado.baralho);
      } else {
        setBaralho(null);

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

  useLayoutEffect(() => {
    if (focoAposRemocao === null) {
      return;
    }

    const vizinho =
      focoAposRemocao.proximoCartaoId === null
        ? undefined
        : botoes.current.get(`remover:${focoAposRemocao.proximoCartaoId}`);

    if (vizinho !== undefined) {
      vizinho.focus();
    } else {
      tituloDaPagina.current?.focus();
    }

    setFocoAposRemocao(null);
  }, [focoAposRemocao, baralho]);

  // FR-064, WCAG 2.4.3 (ordem de foco): mover o foco é uma reação a uma
  // mudança de estado, então precisa ser um layout effect. `useEffect` roda
  // depois da pintura, e nesse intervalo o foco fica transitoriamente em
  // `<body>` — um leitor de tela, ou um teste que observa o DOM logo após o
  // commit, enxerga o foco perdido. `useLayoutEffect` roda de forma síncrona
  // logo após a mutação do DOM, sem foco transitório em `<body>`, como já
  // acontece no efeito pós-remoção acima.
  useLayoutEffect(() => {
    if (!focoAposExclusao) {
      return;
    }

    botaoDeExcluir.current?.focus();
    setFocoAposExclusao(false);
  }, [focoAposExclusao, baralho]);

  /**
   * Remove o Cartão deste Baralho, sem confirmação (FR-147, FR-066).
   *
   * FR-044: a lista só muda depois que o servidor confirmou a remoção — o
   * Cartão sai da lista, e o Baralho é relido para que a contagem e a
   * elegibilidade passem a refletir o estado confirmado. Se a remoção ou a
   * releitura falhar, a lista não é tocada e a mensagem do cliente é exibida.
   */
  async function removerDoBaralho(cartao: Cartao): Promise<void> {
    setFalhaDeAcao(null);
    setAnuncio(null);
    setRemovendo(cartao.id);

    const cartoesAtuais = baralho?.cartoes ?? [];
    const indice = cartoesAtuais.findIndex((item) => item.id === cartao.id);
    const vizinho =
      indice < 0
        ? null
        : (cartoesAtuais[indice + 1] ?? cartoesAtuais[indice - 1] ?? null);
    const eraElegivel = baralho?.elegivel ?? false;

    const resultado = await cliente.desvincular(cartao.id, id);

    if (!resultado.ok) {
      setFalhaDeAcao(resultado.mensagem);
      setRemovendo(null);
      return;
    }

    const releitura = await cliente.obterBaralho(id);

    if (!releitura.ok) {
      setFalhaDeAcao(releitura.mensagem);
      setRemovendo(null);
      return;
    }

    const mensagens = ["Cartão removido deste Baralho."];

    if (eraElegivel && !releitura.baralho.elegivel) {
      mensagens.push("O Baralho ficou sem Cartões; Estudar está indisponível.");
    }

    setBaralho(releitura.baralho);
    setAnuncio(mensagens.join(" "));
    setSequenciaDeAnuncio((atual) => atual + 1);
    setFocoAposRemocao({
      cartaoId: cartao.id,
      proximoCartaoId: vizinho?.id ?? null,
    });
    setRemovendo(null);
  }

  function abrirExclusao(): void {
    if (baralho === null) {
      return;
    }

    setFalhaDeExclusao(null);
    setExclusaoPedida(true);
  }

  function cancelarExclusao(): void {
    setExclusaoPedida(false);
    setFocoAposExclusao(true);
  }

  async function confirmarExclusao(): Promise<void> {
    if (baralho === null) {
      return;
    }

    setExcluindo(true);
    setFalhaDeExclusao(null);

    const resultado = await cliente.excluirBaralho(baralho.id);

    setExcluindo(false);

    if (resultado.ok) {
      // FR-044: só depois de o servidor confirmar a exclusão a tela navega
      // para a lista de Baralhos — onde o Baralho não aparecerá mais. A
      // navegação liberada vence a proteção de pendência desta operação
      // (FR-154).
      setExclusaoPedida(false);
      navegarSemProtecao("#/baralhos");
      return;
    }

    setFalhaDeExclusao(resultado.mensagem);
    setExclusaoPedida(false);
    setFocoAposExclusao(true);
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

  const quantidadeDeCartoes = baralho?.cartoes.length ?? 0;

  return (
    <div className="pagina">
      <div className="cabecalho-da-pagina">
        <div>
          <h1 ref={tituloDaPagina} tabIndex={-1}>
            {baralhoNaoEncontrado !== null
              ? "Baralho não encontrado"
              : (baralho?.nome ?? "Baralho")}
          </h1>
          {baralho !== null && (
            <p className="texto-secundario">
              {descricaoDaContagemDeCartoes(quantidadeDeCartoes)}
            </p>
          )}
        </div>

        {baralho !== null && (
          // FR-145 (revisado), SC-078: todas as ações sobre o Baralho ficam
          // reunidas no topo da página, logo abaixo do título e antes da lista
          // de Cartões — alcançáveis sem rolar a lista e precedendo os Cartões
          // na ordem de leitura e de Tab. Sem Cartões, Estudar não leva a lugar
          // nenhum: o botão fica desabilitado e a explicação vem ao lado.
          <div className="acoes">
            {quantidadeDeCartoes === 0 ? (
              <>
                <button
                  type="button"
                  className="botao botao--primario"
                  disabled
                  aria-describedby="motivo-para-nao-estudar"
                >
                  Estudar este Baralho
                </button>
              </>
            ) : (
              <a
                className="botao botao--primario"
                href={`#/baralhos/${id}/estudo`}
              >
                Estudar este Baralho
              </a>
            )}
            <a
              className="botao botao--secundario"
              href={`#/baralhos/${id}/adicionar`}
            >
              Adicionar cartões existentes
            </a>
            <a
              className="botao botao--secundario"
              href={`#/baralhos/${id}/editar`}
            >
              Renomear
            </a>
            <button
              ref={botaoDeExcluir}
              type="button"
              className="botao botao--perigo"
              aria-label="Excluir Baralho"
              disabled={removendo !== null || excluindo}
              onClick={abrirExclusao}
            >
              Excluir Baralho
            </button>
          </div>
        )}

        {baralho !== null && quantidadeDeCartoes === 0 && (
          <p id="motivo-para-nao-estudar" className="ajuda">
            Adicione Cartões ao Baralho para poder estudar.
          </p>
        )}
      </div>

      {carregando ? (
        <EstadoDaCarga estado="carregando" mensagem="Carregando Baralho…" />
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
      ) : baralho !== null ? (
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

          <section aria-label="Cartões do Baralho">
            {baralho.cartoes.length === 0 ? (
              // FR-153: o Baralho vazio tem a sua própria apresentação, e a
              // ação que o destrava é vincular Cartões existentes.
              <div className="estado-vazio">
                <p>Este Baralho ainda não tem Cartões.</p>
              </div>
            ) : (
              <ul className="lista lista--compacta">
                {baralho.cartoes.map((cartao) => (
                  <li key={cartao.id} className="linha-da-lista">
                    <div className="linha-da-lista__texto">
                      <p className="linha-da-lista__titulo">{cartao.frente}</p>
                    </div>
                    <div className="linha-da-lista__acoes">
                      <button
                        ref={registrarBotao(`remover:${cartao.id}`)}
                        className="botao botao--secundario"
                        type="button"
                        disabled={removendo !== null}
                        aria-label={`Remover ${cartao.frente} deste baralho`}
                        onClick={() => void removerDoBaralho(cartao)}
                      >
                        Remover
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

          </section>

          {falhaDeExclusao !== null && (
            <p
              className="erro"
              role="alert"
              aria-label="Falha na exclusão do Baralho"
            >
              {falhaDeExclusao}
            </p>
          )}

        </>
      ) : null}

      {exclusaoPedida && baralho !== null && (
        <DialogoDeConfirmacao
          aberto
          titulo={`Excluir “${baralho.nome}”?`}
          rotuloDeConfirmacao="Excluir Baralho"
          confirmacaoDesabilitada={excluindo}
          aoConfirmar={() => void confirmarExclusao()}
          aoCancelar={cancelarExclusao}
        >
          <p>{descricaoDeExclusaoDeBaralho(baralho)}</p>
        </DialogoDeConfirmacao>
      )}
    </div>
  );
}

/**
 * Informa quantos Cartões o Baralho tem (FR-145). O texto do cabeçalho sai
 * daqui, e é a única apresentação da contagem na página.
 */
function descricaoDaContagemDeCartoes(quantidade: number): string {
  if (quantidade === 0) {
    return "Nenhum Cartão neste Baralho.";
  }

  if (quantidade === 1) {
    return "1 Cartão neste Baralho.";
  }

  return `${quantidade} Cartões neste Baralho.`;
}

/**
 * Declara a consequência real da exclusão de um Baralho (FR-016, FR-017):
 * quantos Cartões continuarão existindo e que nenhum Cartão será destruído.
 */
function descricaoDeExclusaoDeBaralho(baralho: BaralhoComCartoes): string {
  const quantidade = baralho.cartoes.length;

  if (quantidade === 0) {
    return "Este Baralho não tem Cartões vinculados. A exclusão removerá apenas o Baralho; nenhum Cartão será excluído.";
  }

  if (quantidade === 1) {
    return "Este Baralho tem 1 Cartão vinculado. Ao excluir, esse Cartão continuará existindo; apenas o Vínculo será removido. Nenhum Cartão será excluído.";
  }

  return `Este Baralho tem ${quantidade} Cartões vinculados. Ao excluir, os ${quantidade} Cartões continuarão existindo; apenas os Vínculos serão removidos. Nenhum Cartão será excluído.`;
}
