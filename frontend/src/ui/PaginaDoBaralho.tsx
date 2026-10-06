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
import { consumirAvisoDeCartao } from "./aviso-de-cartao";
import { EstadoDaCarga } from "./EstadoDaCarga";
import { hashDaRota } from "./navegacao";
import {
  useNavegarSemProtecao,
  useProtecaoDeSaida,
} from "./protecao-de-saida";

/**
 * Tela de detalhe de um Baralho
 * (T1110; specs/012-interface-visual-navegavel/tasks.md, FR-145, FR-392,
 * FR-396, FR-401, FR-402, FR-153, FR-156; specs/025-criar-cartoes-baralho).
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
      ? { tipo: "pendencia", motivo: MOTIVO_DE_PENDENCIA }
      : null,
  );

  const carregar = useCallback(() => {
    const minha = ++requisicao.current;

    setCarregando(true);
    setFalhaDeCarregamento(null);
    setBaralhoNaoEncontrado(null);
    setAnuncio(null);

    void cliente.obterBaralho(id).then((resultado) => {
      if (minha !== requisicao.current) {
        return;
      }

      if (resultado.ok) {
        setBaralho(resultado.baralho);
        const aviso = consumirAvisoDeCartao(id);
        if (aviso !== null) {
          setAnuncio(aviso);
          setSequenciaDeAnuncio((atual) => atual + 1);
        }
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
      `Cartão ${cartaoParaExcluir.frente} e seu Agendamento foram excluídos. O Histórico permanece.`,
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
                Revisar este Baralho
              </button>
            ) : (
              <a
                className="botao botao--primario"
                href={`#/baralhos/${id}/estudo`}
              >
                Revisar este Baralho
              </a>
            )}
            <a
              className="botao botao--primario"
              href={hashDaRota({ nome: "novo-cartao", baralhoId: id })}
            >
              Criar Cartão
            </a>
            <a
              className="botao botao--secundario"
              href={`#/baralhos/${id}/editar`}
            >
              Renomear
            </a>
            <button
              ref={botaoDeExcluirBaralho}
              type="button"
              className="botao botao--perigo"
              aria-label="Excluir Baralho"
              disabled={excluindoCartao !== null || excluindoBaralho}
              onClick={abrirExclusaoDoBaralho}
            >
              Excluir Baralho
            </button>
          </div>
        )}

        {baralho !== null && quantidadeDeCartoes === 0 && (
          <p id="motivo-para-nao-revisar" className="ajuda">
            Crie Cartões neste Baralho para poder revisar.
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
          {falhaDeExclusaoDeCartao !== null && (
            <p
              className="erro"
              role="alert"
              aria-label="Falha na exclusão de Cartão"
            >
              {falhaDeExclusaoDeCartao}
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

          <section aria-label="Cartões do Baralho">
            {baralho.cartoes.length === 0 ? (
              // FR-153, FR-392: o Baralho vazio tem a sua própria apresentação,
              // e a ação que o destrava é criar Cartões neste Baralho.
              <div className="estado-vazio" role="status" aria-label="Lista de Cartões vazia" aria-live="polite" aria-atomic="true">
                <p>Este Baralho ainda não tem Cartões.</p>
                <a
                  className="botao botao--primario"
                  href={hashDaRota({ nome: "novo-cartao", baralhoId: id })}
                >
                  Criar Cartão
                </a>
              </div>
            ) : (
              <ul className="lista lista--compacta">
                {baralho.cartoes.map((cartao) => (
                  <li key={cartao.id} className="linha-da-lista">
                    <div className="linha-da-lista__texto">
                      <p className="linha-da-lista__titulo">{cartao.frente}</p>
                      <p className="linha-da-lista__verso">{cartao.verso}</p>
                    </div>
                    <div className="linha-da-lista__acoes">
                      <a
                        className="botao botao--secundario"
                        href={hashDaRota({
                          nome: "editar-cartao",
                          baralhoId: id,
                          id: cartao.id,
                        })}
                      >
                        Editar
                      </a>
                      <button
                        ref={registrarBotaoDeExcluir(`excluir:${cartao.id}`)}
                        className="botao botao--perigo"
                        type="button"
                        disabled={excluindoCartao !== null}
                        aria-label={`Excluir ${cartao.frente}`}
                        onClick={(e) =>
                          void abrirExclusaoDeCartao(
                            cartao,
                            e.currentTarget,
                          )
                        }
                      >
                        Excluir
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
              aria-label="Falha na exclusão do Baralho"
            >
              {falhaDeExclusaoDoBaralho}
            </p>
          )}
        </>
      ) : null}

      {cartaoPendingExclusao !== null && (
        <DialogoDeConfirmacao
          aberto
          titulo={`Excluir "${cartaoPendingExclusao.frente}"?`}
          rotuloDeConfirmacao="Excluir Cartão"
          confirmacaoDesabilitada={excluindoCartao !== null}
          aoConfirmar={() => void confirmarExclusaoDeCartao()}
          aoCancelar={cancelarExclusaoDeCartao}
        >
          <p>{descricaoDeExclusaoDeCartao()}</p>
        </DialogoDeConfirmacao>
      )}

      {exclusaoDoBaralhoAberta && baralho !== null && (
        <DialogoDeConfirmacao
          aberto
          titulo={`Excluir "${baralho.nome}"?`}
          rotuloDeConfirmacao="Excluir Baralho"
          confirmacaoDesabilitada={excluindoBaralho}
          aoConfirmar={() => void confirmarExclusaoDoBaralho()}
          aoCancelar={cancelarExclusaoDoBaralho}
        >
          <p>{descricaoDeExclusaoDoBaralho(baralho)}</p>
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
 * Declara a consequência real da exclusão de um Cartão (FR-401, FR-402):
 * que o Cartão e seu Agendamento serão removidos e que o Histórico permanece.
 */
function descricaoDeExclusaoDeCartao(): string {
  return "O Cartão e seu Agendamento serão removidos. Registros históricos já concluídos permanecerão.";
}

/**
 * Declara a consequência real da exclusão de um Baralho (FR-016, FR-017, FR-402):
 * quantos Cartões e Agendamentos serão removidos e que o Histórico permanece.
 */
function descricaoDeExclusaoDoBaralho(baralho: BaralhoComCartoes): string {
  const quantidadeDeCartoes = baralho.cartoes.length;
  const quantidadeDeAgendamentos = baralho.quantidadeDeAgendamentos;

  let descricao = `Serão removidos o Baralho, ${quantidadeDeCartoes} ${quantidadeDeCartoes === 1 ? "Cartão" : "Cartões"}`;

  if (quantidadeDeAgendamentos > 0) {
    descricao += ` e ${quantidadeDeAgendamentos} ${quantidadeDeAgendamentos === 1 ? "Agendamento" : "Agendamentos"}`;
  }

  descricao += ". Registros históricos já concluídos permanecerão.";

  return descricao;
}
