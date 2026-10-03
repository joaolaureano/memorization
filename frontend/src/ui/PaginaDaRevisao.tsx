import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  Avaliacao,
  ClienteDoAcervo,
  DadosDeRegistro,
  ItemDoLoteDeRevisao,
  Previa,
} from "../acervo-cliente/cliente";
import { limitesDoDia, nomeAcessivelDaAvaliacao, rotuloDaPrevia } from "../revisao/dia";
import { SessaoDeEstudo } from "../sessao-de-estudo/sessao-de-estudo";
import type {
  EstadoDaSessao,
  EstadoDaSessaoConcluida,
} from "../sessao-de-estudo/sessao-de-estudo";
import { ResumoDaSessao } from "./ResumoDaSessao";
import type { ItemDoResumo } from "./ResumoDaSessao";
import { irParaRota } from "./navegacao";
import { useAcaoProtegida, useProtecaoDeSaida } from "./protecao-de-saida";
import type { Protecao } from "./protecao-de-saida";

/**
 * Tela da Revisão do dia (T1518; specs/015-repeticao-espacada/contracts/contratos.md §7,
 * FR-198, FR-199, FR-201 a FR-203, FR-215, FR-217, FR-221).
 *
 * A Sessão da Revisão do dia é lançada de Início e reúne Cartões de todos os
 * Baralhos e Cartões sem Vínculo (FR-201). Ao contrário do estudo livre, não há
 * fase de configuração: o lote já vem **ordenado** do servidor — vencidos
 * primeiro —, e a Sessão é criada com `iniciarDaRevisao`, que usa a lista como
 * veio, **sem embaralhar** (FR-201). O lote tem no máximo 20 Itens (FR-203).
 *
 * As prévias de cada Avaliação vêm no próprio lote (FR-221): os quatro botões
 * as exibem ao lado do nível ("Bom · 3 dias"), dentro do nome acessível do
 * botão, sem depender de cor (FR-218). A página não reimplementa o algoritmo —
 * apenas traduz o instante ISO em rótulo humano com `rotuloDaPrevia` (D7).
 *
 * O bloco de carregamento distingue carregando, falha com nova tentativa e
 * sucesso (FR-153, FR-217); um lote vazio mostra "Nada para revisar hoje" e
 * oferece "Voltar a Início" (FR-202), sem iniciar Sessão.
 *
 * Sair no meio da Sessão perde trabalho, e por isso a página registra
 * `useProtecaoDeSaida` (FR-150, FR-151, FR-154): a Sessão em andamento e o
 * Registro ainda não confirmado pedem confirmação antes de qualquer navegação,
 * e o botão "Interromper" passa pela mesma confirmação, via `useAcaoProtegida`.
 *
 * Concluída a Sessão, a página a registra no histórico (FR-161, FR-163) com
 * `origem: "revisao"`, `baralhoId: ""` e `nomeDoBaralho: "Revisão do dia"`
 * (FR-196, FR-215), e um `id` gerado uma única vez por Sessão concluída: uma
 * nova tentativa reenvia o **mesmo** `id` e não duplica o Registro. O Resumo é
 * o mesmo da `013`, com a contagem por nível de Avaliação (FR-216), o nome
 * "Revisão do dia" junto do cabeçalho (FR-215) e as ações "Continuar revisão"
 * e "Voltar a Início" no lugar de "Estudar novamente" e "Voltar ao Baralho"
 * (FR-215).
 */

/** Nome exibido e gravado para a Sessão da Revisão do dia (FR-215, D5). */
const NOME_DA_REVISAO = "Revisão do dia";

/**
 * Os 4 níveis de Avaliação na ordem exibida (FR-192), com o atalho de teclado
 * (FR-218) e a classe do botão — a mesma linguagem visual de Acertei/Errei.
 */
const NIVEIS_DE_AVALIACAO: readonly {
  readonly avaliacao: Avaliacao;
  readonly rotulo: string;
  readonly atalho: string;
  readonly variante: string;
}[] = [
  { avaliacao: "errei", rotulo: "Errei", atalho: "1", variante: "botao--erro" },
  {
    avaliacao: "dificil",
    rotulo: "Difícil",
    atalho: "2",
    variante: "botao--secundario",
  },
  {
    avaliacao: "bom",
    rotulo: "Bom",
    atalho: "3",
    variante: "botao--sucesso",
  },
  {
    avaliacao: "facil",
    rotulo: "Fácil",
    atalho: "4",
    variante: "botao--primario",
  },
];

interface PropriedadesDaPaginaDaRevisao {
  cliente: ClienteDoAcervo;
}

type AlvoDeFoco = "frente" | "verso" | "resumo";

/**
 * A situação do Registro da Sessão no histórico (FR-161, FR-163 a FR-165): o
 * envio é automático ao concluir e, depois de uma falha, pode ser tentado de
 * novo com o **mesmo** `id` — é o que torna a operação idempotente e segura a
 * um reenvio (FR-210).
 */
type SituacaoDoRegistro =
  | { estado: "ocioso" }
  | { estado: "registrando" }
  | { estado: "registrada" }
  | { estado: "falhou"; mensagem: string };

export function PaginaDaRevisao({ cliente }: PropriedadesDaPaginaDaRevisao) {
  const [carregando, setCarregando] = useState(true);
  const [falhaDeCarregamento, setFalhaDeCarregamento] = useState<string | null>(
    null,
  );
  const [nadaParaRevisar, setNadaParaRevisar] = useState(false);
  const [itensDoLote, setItensDoLote] = useState<
    readonly ItemDoLoteDeRevisao[] | null
  >(null);
  const [sessao, setSessao] = useState<SessaoDeEstudo | null>(null);
  const [estado, setEstado] = useState<EstadoDaSessao | null>(null);
  const [situacaoDoRegistro, setSituacaoDoRegistro] =
    useState<SituacaoDoRegistro>({ estado: "ocioso" });

  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [sequenciaDeAnuncio, setSequenciaDeAnuncio] = useState(0);

  const alvoDeFoco = useRef<AlvoDeFoco | null>(null);
  const frenteRef = useRef<HTMLHeadingElement>(null);
  const versoRef = useRef<HTMLHeadingElement>(null);
  const resumoRef = useRef<HTMLHeadingElement>(null);
  const conteinerDaSessao = useRef<HTMLDivElement | null>(null);
  const idDoRegistroDeSessao = useRef<string | null>(null);
  // Cada carga tem uma geração; respostas de uma carga antiga são descartadas,
  // para que uma nova tentativa lenta não sobreponha a tentativa mais recente.
  const geracaoDeCarga = useRef(0);

  const anunciar = useCallback((mensagem: string): void => {
    setAnuncio(mensagem);
    setSequenciaDeAnuncio((atual) => atual + 1);
  }, []);

  const limparSessao = useCallback((): void => {
    setSessao(null);
    setEstado(null);
    setItensDoLote(null);
    setSituacaoDoRegistro({ estado: "ocioso" });
    idDoRegistroDeSessao.current = null;
    alvoDeFoco.current = null;
  }, []);

  /**
   * Carrega o lote da Revisão do dia e inicia a Sessão (FR-201, FR-203). O
   * lote é usado como veio — a Sessão da revisão não embaralha —, e as prévias
   * que ele traz alimentam os quatro botões (FR-221).
   */
  const carregarLote = useCallback((): void => {
    const geracao = geracaoDeCarga.current + 1;
    geracaoDeCarga.current = geracao;

    setCarregando(true);
    setFalhaDeCarregamento(null);
    setNadaParaRevisar(false);
    limparSessao();

    const { inicioDoDia, fimDoDia } = limitesDoDia(new Date());

    void cliente
      .obterLoteDeRevisao(inicioDoDia, fimDoDia)
      .then((resultado) => {
        if (geracaoDeCarga.current !== geracao) {
          return;
        }

        if (!resultado.ok) {
          setFalhaDeCarregamento(resultado.mensagem);
          setCarregando(false);
          return;
        }

        if (resultado.itens.length === 0) {
          setNadaParaRevisar(true);
          setCarregando(false);
          return;
        }

        const inicio = SessaoDeEstudo.iniciarDaRevisao(
          resultado.itens.map((item) => item.cartao),
        );

        if (!inicio.ok) {
          setFalhaDeCarregamento(inicio.mensagem);
          setCarregando(false);
          return;
        }

        const estadoInicial = inicio.sessao.estadoAtual();

        setItensDoLote(resultado.itens);
        setSessao(inicio.sessao);
        setEstado(estadoInicial);
        setCarregando(false);
        alvoDeFoco.current = "frente";
        anunciar(
          `Revisão iniciada com ${estadoInicial.total} ${
            estadoInicial.total === 1 ? "Item" : "Itens"
          }.`,
        );
      });
  }, [anunciar, cliente, limparSessao]);

  useEffect(() => {
    carregarLote();
  }, [carregarLote]);

  // Movimentação de foco que reage a uma mudança de fase precisa ser um efeito
  // de layout, como em PaginaDeEstudo: `useEffect` roda depois da pintura, e
  // por um instante o foco ficaria no `<body>` (o botão acionado foi
  // removido); `useLayoutEffect` roda antes da pintura e preserva a ordem de
  // foco esperada (WCAG 2.4.3).
  useLayoutEffect(() => {
    if (alvoDeFoco.current === null) {
      return;
    }

    const alvo = alvoDeFoco.current;
    alvoDeFoco.current = null;

    if (alvo === "frente") {
      conteinerDaSessao.current?.querySelectorAll(".conteudo-do-cartao").forEach((texto) => {
        texto.scrollTop = 0;
      });
      frenteRef.current?.focus({ preventScroll: true });
    } else if (alvo === "verso") {
      versoRef.current?.focus({ preventScroll: true });
    } else {
      resumoRef.current?.focus();
    }
  }, [estado]);

  // As prévias por Cartão vêm do lote e são estáveis durante a Sessão (FR-221).
  const previasPorCartao = useMemo(() => {
    const mapa = new Map<string, Previa>();

    if (itensDoLote !== null) {
      for (const item of itensDoLote) {
        mapa.set(item.cartao.id, item.previa);
      }
    }

    return mapa;
  }, [itensDoLote]);

  const emAndamento = sessao !== null && estado !== null && !estado.concluida;
  // Sessão concluída e ainda não registrada: sair perde o Registro, e por isso
  // a navegação pede confirmação até o histórico confirmar (FR-164).
  const aguardandoRegistro =
    estado !== null &&
    estado.concluida &&
    situacaoDoRegistro.estado !== "registrada";
  const protecaoDeSaida: Protecao | null = emAndamento
    ? {
        tipo: "descarte",
        titulo: "Interromper a Revisão?",
        descricao:
          "O progresso desta Revisão será descartado e não haverá Resumo.",
        rotuloDeConfirmacao: "Interromper",
      }
    : aguardandoRegistro
      ? {
          tipo: "descarte",
          titulo: "Sair sem registrar a Sessão?",
          descricao: "Esta Sessão não ficará no seu histórico.",
          rotuloDeConfirmacao: "Sair sem registrar",
        }
      : null;

  useProtecaoDeSaida(protecaoDeSaida);
  const protegerAcao = useAcaoProtegida();

  function interromper(): void {
    geracaoDeCarga.current += 1;
    limparSessao();
    setNadaParaRevisar(false);
    setFalhaDeCarregamento(null);
    setAnuncio(null);
    irParaRota("#/inicio");
  }

  function revelar(): void {
    if (sessao === null) {
      return;
    }

    const resultado = sessao.revelar();

    if (!resultado.ok) {
      return;
    }

    alvoDeFoco.current = "verso";
    setEstado(sessao.estadoAtual());
    anunciar("Verso revelado.");
  }

  function registrarAvaliacao(avaliacao: Avaliacao): void {
    if (sessao === null) {
      return;
    }

    const resposta = sessao.registrarAvaliacao(avaliacao);

    if (!resposta.ok) {
      return;
    }

    const estadoAtualizado = sessao.estadoAtual();
    setEstado(estadoAtualizado);

    if (estadoAtualizado.concluida) {
      alvoDeFoco.current = "resumo";
      anunciar("Revisão do lote concluída.");
      registrarNoHistorico(estadoAtualizado);
      return;
    }

    alvoDeFoco.current = "frente";
    anunciar(`Avaliação registrada: ${avaliacao}.`);
  }

  /**
   * Registra a Sessão concluída no histórico (FR-161, FR-163) com a origem
   * "revisao" (FR-196, FR-215). O `id` é gerado na primeira tentativa e
   * guardado: "Tentar registrar novamente" reenvia o **mesmo** `id`, e é isso
   * que impede o Registro duplicado (FR-210).
   */
  function registrarNoHistorico(estadoConcluido: EstadoDaSessaoConcluida): void {
    const idDoRegistro = idDoRegistroDeSessao.current ?? crypto.randomUUID();
    idDoRegistroDeSessao.current = idDoRegistro;

    setSituacaoDoRegistro({ estado: "registrando" });

    void cliente
      .registrarSessao({
        id: idDoRegistro,
        origem: "revisao",
        baralhoId: "",
        nomeDoBaralho: NOME_DA_REVISAO,
        itens: itensParaRegistro(estadoConcluido),
      })
      .then((resultado) => {
        setSituacaoDoRegistro(
          resultado.ok
            ? { estado: "registrada" }
            : { estado: "falhou", mensagem: resultado.mensagem },
        );
      });
  }

  function registrarNovamente(): void {
    if (estado === null || !estado.concluida) {
      return;
    }

    registrarNoHistorico(estado);
  }

  /**
   * "Continuar revisão" (FR-215): recarrega o resumo da revisão e, se ainda
   * houver Cartões para hoje, carrega o próximo lote e recomeça; senão, mostra
   * "Nada para revisar hoje" (FR-202).
   */
  function continuarRevisao(): void {
    const geracao = geracaoDeCarga.current + 1;
    geracaoDeCarga.current = geracao;

    setCarregando(true);
    setFalhaDeCarregamento(null);
    setNadaParaRevisar(false);

    const { inicioDoDia, fimDoDia } = limitesDoDia(new Date());

    void cliente
      .obterResumoDaRevisao(inicioDoDia, fimDoDia)
      .then((resultado) => {
        if (geracaoDeCarga.current !== geracao) {
          return;
        }

        if (!resultado.ok) {
          setFalhaDeCarregamento(resultado.mensagem);
          setCarregando(false);
          return;
        }

        if (resultado.resumo.total === 0) {
          limparSessao();
          setCarregando(false);
          setNadaParaRevisar(true);
          return;
        }

        carregarLote();
      });
  }

  // Atalhos 1 a 4 = Errei, Difícil, Bom, Fácil (FR-218). Só valem durante uma
  // Sessão em andamento, com o Verso revelado e o foco dentro da Sessão; são
  // ignorados antes da Revelação e em campos de texto, para não roubar a
  // digitação de quem escreve.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent): void {
      if (sessao === null || estado === null || estado.concluida) {
        return;
      }

      if (evento.altKey || evento.ctrlKey || evento.metaKey) {
        return;
      }

      const alvo = evento.target as HTMLElement | null;

      if (alvo !== null && ehCampoDeTexto(alvo)) {
        return;
      }

      if (
        conteinerDaSessao.current !== null &&
        alvo !== null &&
        !conteinerDaSessao.current.contains(alvo)
      ) {
        return;
      }

      if (!estado.itemAtual.revelado) {
        return;
      }

      const nivel = NIVEIS_DE_AVALIACAO.find(
        (candidato) => candidato.atalho === evento.key,
      );

      if (nivel === undefined) {
        return;
      }

      evento.preventDefault();
      registrarAvaliacao(nivel.avaliacao);
    }

    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.removeEventListener("keydown", aoTeclar);
    };
    // `registrarAvaliacao` é recriada a cada render, mas só usa `sessao`, que é
    // estável depois de iniciada; recriar o observador acompanha `estado`.
  }, [sessao, estado]);

  if (carregando) {
    return (
      <div className="pilha">
        <p className="voltar">
          <a href="#/inicio">
            <span aria-hidden="true">←</span> Voltar a Início
          </a>
        </p>
        <h1>{NOME_DA_REVISAO}</h1>
        <p className="carregando">Carregando a revisão…</p>
      </div>
    );
  }

  if (falhaDeCarregamento !== null) {
    return (
      <div className="pilha">
        <p className="voltar">
          <a href="#/inicio">
            <span aria-hidden="true">←</span> Voltar a Início
          </a>
        </p>
        <h1>{NOME_DA_REVISAO}</h1>
        <p className="erro" role="alert" aria-label="Falha ao carregar a revisão">
          {falhaDeCarregamento}
        </p>
        <div className="acoes">
          <button
            className="botao botao--primario"
            type="button"
            onClick={carregarLote}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (nadaParaRevisar) {
    return (
      <div className="pilha">
        <header className="cabecalho-da-pagina">
          <div>
            <p className="sobretitulo">Sessão de estudo</p>
            <h1>{NOME_DA_REVISAO}</h1>
          </div>
        </header>
        <section className="estado-vazio">
          <p>Nada para revisar hoje</p>
        </section>
        <div className="acoes">
          <a className="botao botao--primario" href="#/inicio">
            Voltar a Início
          </a>
        </div>
      </div>
    );
  }

  if (sessao === null || estado === null) {
    return null;
  }

  if (estado.concluida) {
    return (
      <div className="pilha">
        <header className="cabecalho-da-pagina resumo__cabecalho">
          <div>
            <p className="sobretitulo">{NOME_DA_REVISAO}</p>
            <h1 ref={resumoRef} tabIndex={-1}>
              Sessão concluída
            </h1>
          </div>
        </header>

        {anuncio !== null && (
          <p
            key={sequenciaDeAnuncio}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label="Mudança de estado da Sessão"
          >
            {anuncio}
          </p>
        )}

        <ResumoDaSessao itens={itensDoResumo(estado)} origem="revisao">
          {situacaoDoRegistro.estado === "registrando" && (
            <p
              role="status"
              aria-live="polite"
              aria-label="Situação do registro da Sessão"
              className="texto-secundario"
            >
              Registrando a Sessão…
            </p>
          )}

          {situacaoDoRegistro.estado === "registrada" && (
            <p
              role="status"
              aria-live="polite"
              aria-label="Situação do registro da Sessão"
              className="aviso aviso--sucesso"
            >
              <span aria-hidden="true">✓</span> Registrada no seu histórico{" "}
              <a href="#/inicio">Ver em Início</a>
            </p>
          )}

          {situacaoDoRegistro.estado === "falhou" && (
            <div
              className="aviso aviso--erro"
              role="alert"
              aria-label="Falha ao registrar a Sessão"
            >
              <p>{situacaoDoRegistro.mensagem}</p>
              <button
                className="botao botao--secundario"
                type="button"
                onClick={registrarNovamente}
              >
                Tentar registrar novamente
              </button>
            </div>
          )}

          <div className="acoes resumo__acoes">
            <button
              className="botao botao--primario"
              type="button"
              onClick={continuarRevisao}
            >
              Continuar revisão
            </button>
            <a
              className="botao botao--secundario"
              href="#/inicio"
              onClick={(evento) => {
                // Sair do Resumo é uma ação da própria página: sem proteção
                // ativa, navega normalmente; com o Registro pendente ou
                // falhado, passa pela confirmação (FR-164).
                evento.preventDefault();
                protegerAcao(() => irParaRota("#/inicio"));
              }}
            >
              Voltar a Início
            </a>
          </div>
        </ResumoDaSessao>
      </div>
    );
  }

  const itemAtual = estado.itemAtual;
  const previaDoItem = itemAtual.revelado
    ? (previasPorCartao.get(itemAtual.cartaoId) ?? null)
    : null;

  return (
    <div className="pilha" ref={conteinerDaSessao}>
      <div className="acoes">
        <button
          className="botao botao--secundario"
          type="button"
          onClick={() => protegerAcao(interromper)}
        >
          Interromper
        </button>
      </div>

      <header className="cabecalho-da-pagina">
        <div>
          <h1>{NOME_DA_REVISAO}</h1>
        </div>
      </header>

      {estado.avisoDeLimite !== null && (
        <p className="aviso">{estado.avisoDeLimite}</p>
      )}

      {anuncio !== null && (
        <p
          key={sequenciaDeAnuncio}
          className="visualmente-oculto"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label="Mudança de estado da Sessão"
        >
          {anuncio}
        </p>
      )}

      <article
        className="cartao-de-estudo"
        aria-label={`Item ${estado.posicao} de ${estado.total}`}
      >
        <h2 ref={frenteRef} tabIndex={-1} className="lado-do-cartao">
          Frente
        </h2>
        <p className="conteudo-do-cartao" tabIndex={0}>{itemAtual.frente}</p>

        {!itemAtual.revelado ? (
          <>
            <div className="acoes">
              <button
                className="botao botao--primario"
                type="button"
                onClick={revelar}
              >
                Revelar verso
              </button>
            </div>
          </>
        ) : (
          <>
            <hr />
            <h2 ref={versoRef} tabIndex={-1} className="lado-do-cartao">
              Verso
            </h2>
            <p className="conteudo-do-cartao" tabIndex={0}>{itemAtual.verso}</p>
            <div className="botoes-de-resultado">
              {NIVEIS_DE_AVALIACAO.map((nivel) => {
                const previa =
                  previaDoItem === null
                    ? null
                    : rotuloDaPrevia(new Date(), previaDoItem[nivel.avaliacao]);

                return (
                  <button
                    key={nivel.avaliacao}
                    className={`botao ${nivel.variante}`}
                    type="button"
                    aria-label={nomeAcessivelDaAvaliacao(nivel.rotulo, previa)}
                    onClick={() => registrarAvaliacao(nivel.avaliacao)}
                  >
                    <span aria-hidden="true">{nivel.atalho}</span>{" "}
                    <span>
                      {nivel.rotulo}
                      {previa !== null ? ` · ${previa}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </article>
    </div>
  );
}

/**
 * Os Itens do Resumo, na ordem em que foram apresentados (FR-176), com a
 * Avaliação de cada um (FR-216).
 *
 * Ao concluir, todo Item já foi revelado e avaliado — é o que a Sessão exige
 * para chegar ao fim —, então o estreitamento pelo discriminante `revelado`
 * garante Verso, Resultado e Avaliação não nulos, sem asserções sobre valores
 * que possam ser nulos.
 */
function itensDoResumo(estado: EstadoDaSessaoConcluida): ItemDoResumo[] {
  const itens: ItemDoResumo[] = [];

  for (const item of estado.itens) {
    if (item.revelado && item.resultado !== null && item.avaliacao !== null) {
      itens.push({
        frente: item.frente,
        verso: item.verso,
        resultado: item.resultado,
        avaliacao: item.avaliacao,
      });
    }
  }

  return itens;
}

/**
 * Os Itens enviados ao Registro (FR-196): cada um leva o Cartão de origem e a
 * Avaliação. O `resultado` **não** é enviado — é o servidor que o deriva
 * (FR-194, FR-195).
 */
function itensParaRegistro(
  estado: EstadoDaSessaoConcluida,
): DadosDeRegistro["itens"] {
  const itens: DadosDeRegistro["itens"] = [];

  for (const item of estado.itens) {
    if (item.revelado && item.avaliacao !== null) {
      itens.push({
        frente: item.frente,
        verso: item.verso,
        cartaoId: item.cartaoId,
        avaliacao: item.avaliacao,
      });
    }
  }

  return itens;
}

/** Um campo de texto com foco engole os atalhos 1 a 4 (FR-218). */
function ehCampoDeTexto(elemento: HTMLElement): boolean {
  const tag = elemento.tagName;

  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    elemento.isContentEditable
  );
}
