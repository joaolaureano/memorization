import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import type {
  Avaliacao,
  BaralhoComCartoes,
  ClienteDoAcervo,
  DadosDeRegistro,
  InicioDeCompromisso,
  Previa,
  ResultadoDasPrevias,
} from "../acervo-cliente/cliente";
import { nomeAcessivelDaAvaliacao, rotuloDaPrevia } from "../revisao/dia";
import { AleatoriedadeReal } from "../sessao-de-estudo/aleatoriedade";
import type { Aleatoriedade } from "../sessao-de-estudo/aleatoriedade";
import {
  MENSAGEM_DE_BARALHO_INELEGIVEL,
  SessaoDeEstudo,
} from "../sessao-de-estudo/sessao-de-estudo";
import type {
  EstadoDaSessao,
  EstadoDaSessaoConcluida,
} from "../sessao-de-estudo/sessao-de-estudo";
import { ResumoDaSessao } from "./ResumoDaSessao";
import type { Baralho, Cartao } from "../acervo-cliente/cliente";
import { SalvarSelecaoComoBaralho } from "./SalvarSelecaoComoBaralho";
import type { ItemDoResumo } from "./ResumoDaSessao";
import { irParaRota } from "./navegacao";
import { useAcaoProtegida, useProtecaoDeSaida } from "./protecao-de-saida";
import type { Protecao } from "./protecao-de-saida";

/**
 * Tela da Sessão de estudo (T304–T307; specs/004-sessao-de-estudo/tasks.md;
 * T1114, T1115; specs/012-interface-visual-navegavel/tasks.md, FR-149 a
 * FR-152, SC-067; FR-025, FR-027 a FR-029, FR-032 a FR-037, FR-041, FR-042,
 * FR-046 a FR-049).
 *
 * Consome somente a Interface `ClienteDoAcervo` para carregar o Baralho e a
 * Interface `SessaoDeEstudo` para iniciar, revelar, registrar Resultado e
 * derivar o Resumo. A Sessão vive apenas no estado deste componente: nenhuma
 * operação de rede acontece depois do carregamento do Baralho, e sair da tela
 * descarta a instância (FR-038, FR-039).
 *
 * A ordem dos Itens usa `AleatoriedadeReal` em produção; testes injetam o
 * Adapter determinístico pela propriedade opcional `aleatoriedade`.
 *
 * A tela reúne as três fases — Configuração, Sessão e Resumo — na mesma rota
 * `#/baralhos/:id/estudo` (FR-149). Sair antes de concluir perde trabalho, e
 * por isso a página registra `useProtecaoDeSaida` (FR-150, FR-151): tanto a
 * quantidade já alterada quanto a Sessão em andamento pedem confirmação antes
 * de qualquer navegação, e o botão "Interromper" passa pela mesma confirmação,
 * via `useAcaoProtegida`. O Resumo apresenta o percentual e as contagens
 * derivadas dos Itens (FR-152, FR-174, SC-067, SC-073).
 *
 * Concluída a Sessão, a página a registra no histórico (FR-161, FR-163) com um
 * `id` gerado uma única vez por Sessão concluída: uma nova tentativa reenvia o
 * mesmo `id` e não duplica o Registro. Sessão interrompida nunca é registrada
 * (FR-162) e, enquanto o Registro não estiver confirmado, sair do Resumo pede
 * confirmação (FR-164).
 *
 * A partir da 015, cada Item é avaliado em **quatro níveis** — Errei, Difícil,
 * Bom e Fácil —, e os quatro botões só aparecem depois da Revelação, no lugar
 * do antigo Acertei/Errei (FR-192, FR-193, FR-194). Ao iniciar a Sessão a
 * página pede ao cliente a prévia da próxima revisão dos Cartões
 * (`obterPrevias`, em blocos de até 200 ids) e cada botão exibe o nível com o
 * rótulo da prévia, no texto e no nome acessível ("Bom · 3 dias" /
 * "Bom, próxima revisão em 3 dias", FR-221); sem prévia, o botão mostra só o
 * nível, a falha é anunciada e o estudo segue. Os atalhos 1 a 4 escolhem as
 * quatro Avaliações quando o Verso está revelado e o foco está na Sessão
 * (FR-218). O Registro passa a carregar a `origem` e a Avaliação de cada Item
 * (FR-196), e o Resumo recebe a Avaliação para exibir a contagem por nível
 * (FR-216).
 */

/** As quatro Avaliações na ordem exibida, com rótulo e atalho (FR-192, FR-218). */
const NIVEIS_DE_AVALIACAO: readonly {
  readonly avaliacao: Avaliacao;
  readonly rotulo: string;
  readonly atalho: string;
}[] = [
  { avaliacao: "errei", rotulo: "Errei", atalho: "1" },
  { avaliacao: "dificil", rotulo: "Difícil", atalho: "2" },
  { avaliacao: "bom", rotulo: "Bom", atalho: "3" },
  { avaliacao: "facil", rotulo: "Fácil", atalho: "4" },
];

/**
 * O máximo de Cartões por chamada de `obterPrevias` (FR-221), como no contrato
 * do cliente (§5): acima disso, a Sessão pede as prévias em blocos.
 */
const TAMANHO_MAXIMO_DO_BLOCO_DE_PREVIAS = 200;

interface PropriedadesDaPaginaDeEstudo {
  cliente: ClienteDoAcervo;
  id: string;
  aleatoriedade?: Aleatoriedade;
  /**
   * O início autorizado pela Agenda (016, FR-231): a Sessão começa direto, com
   * os Cartões que o servidor selecionou, sem configuração de quantidade, e
   * conclui o Compromisso pelo mesmo `id` (FR-254). O snapshot vive só na
   * memória — nunca no armazenamento do navegador.
   */
  inicioDaAgenda?: InicioDeCompromisso;
  /**
   * Chamada ao sair de uma Sessão da Agenda (interromper ou voltar): a casca
   * descarta o início e volta a Início. Sem ela, vale a navegação por hash.
   */
  aoSair?: () => void;
  /**
   * Os Cartões capturados na montagem do baralho temporário (023, FR-366): a
   * Sessão começa direto com todos, embaralhados juntos, e registra com a
   * origem «temporario». Vive só na memória da casca.
   */
  selecaoTemporaria?: readonly Cartao[];
}

type AlvoDeFoco = "frente" | "verso" | "resumo" | "quantidade";

/**
 * A situação do Registro da Sessão no histórico (FR-161, FR-163 a FR-165): o
 * envio é automático ao concluir e, depois de uma falha, pode ser tentado de
 * novo com o **mesmo** `id` — é o que torna a operação idempotente e segura a
 * um reenvio.
 */
type SituacaoDoRegistro =
  | { estado: "ocioso" }
  | { estado: "registrando" }
  | { estado: "registrada" }
  | { estado: "falhou"; mensagem: string };

export function PaginaDeEstudo({
  cliente,
  id,
  aleatoriedade,
  inicioDaAgenda,
  aoSair,
  selecaoTemporaria,
}: PropriedadesDaPaginaDeEstudo) {
  const [aleatoriedadePadrao] = useState(() => new AleatoriedadeReal());
  const aleatoriedadeDaSessao = aleatoriedade ?? aleatoriedadePadrao;

  const [baralho, setBaralho] = useState<BaralhoComCartoes | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falhaDeCarregamento, setFalhaDeCarregamento] = useState<string | null>(
    null,
  );
  const [baralhoNaoEncontrado, setBaralhoNaoEncontrado] = useState<string | null>(
    null,
  );

  const [quantidade, setQuantidade] = useState("");
  const [falhaDeInicio, setFalhaDeInicio] = useState<string | null>(null);
  const [sessao, setSessao] = useState<SessaoDeEstudo | null>(null);
  const [estado, setEstado] = useState<EstadoDaSessao | null>(null);
  const [situacaoDoRegistro, setSituacaoDoRegistro] =
    useState<SituacaoDoRegistro>({ estado: "ocioso" });

  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [sequenciaDeAnuncio, setSequenciaDeAnuncio] = useState(0);
  // As prévias de próxima revisão por Cartão e por Avaliação (FR-221), quando
  // o cliente consegue obtê-las; sem elas, os botões mostram só o nível.
  const [previas, setPrevias] = useState<Record<string, Previa>>({});

  const alvoDeFoco = useRef<AlvoDeFoco | null>(null);
  const frenteRef = useRef<HTMLHeadingElement>(null);
  const versoRef = useRef<HTMLHeadingElement>(null);
  const resumoRef = useRef<HTMLHeadingElement>(null);
  const quantidadeRef = useRef<HTMLInputElement>(null);
  const conteinerDaSessao = useRef<HTMLDivElement>(null);
  const idDoRegistroDeSessao = useRef<string | null>(null);
  const [salvandoComoBaralho, setSalvandoComoBaralho] = useState(false);
  const [baralhoSalvo, setBaralhoSalvo] = useState<Baralho | null>(null);
  const botaoDeSalvarRef = useRef<HTMLButtonElement>(null);
  const linkDoBaralhoSalvoRef = useRef<HTMLAnchorElement>(null);
  const focoAoVoltarAoResumo = useRef<"salvar" | "abrir" | null>(null);

  // FR-370, FR-373 — Cancelar volta o foco a «Salvar como baralho»; o
  // sucesso o leva a «Abrir baralho».
  useEffect(() => {
    if (salvandoComoBaralho) {
      return;
    }
    const alvo = focoAoVoltarAoResumo.current;
    if (alvo === "salvar") {
      botaoDeSalvarRef.current?.focus();
    } else if (alvo === "abrir") {
      linkDoBaralhoSalvoRef.current?.focus();
    }
    focoAoVoltarAoResumo.current = null;
  }, [salvandoComoBaralho]);

  useEffect(() => {
    let ativo = true;

    setCarregando(true);
    setFalhaDeCarregamento(null);
    setBaralhoNaoEncontrado(null);
    setBaralho(null);
    setQuantidade("");
    setFalhaDeInicio(null);
    setSessao(null);
    setEstado(null);
    setAnuncio(null);
    setSequenciaDeAnuncio(0);
    setSituacaoDoRegistro({ estado: "ocioso" });
    setPrevias({});
    idDoRegistroDeSessao.current = null;
    alvoDeFoco.current = null;

    if (selecaoTemporaria !== undefined) {
      // Baralho temporário (FR-366, FR-368): todos os Cartões da seleção,
      // embaralhados juntos uma única vez, sem configurar quantidade.
      const iniciada = SessaoDeEstudo.iniciar(
        "",
        selecaoTemporaria.length,
        selecaoTemporaria,
        aleatoriedadeDaSessao,
      );

      setBaralho({
        id: "",
        nome: "baralho temporário",
        elegivel: true,
        cartoes: [...selecaoTemporaria],
      });

      if (iniciada.ok) {
        const estadoInicial = iniciada.sessao.estadoAtual();

        setSessao(iniciada.sessao);
        setEstado(estadoInicial);
        carregarPrevias(estadoInicial.itens.map((item) => item.cartaoId));
        alvoDeFoco.current = "frente";
        anunciar(
          `Sessão iniciada com ${estadoInicial.total} ${
            estadoInicial.total === 1 ? "Item" : "Itens"
          }.`,
        );
      } else {
        setFalhaDeCarregamento(iniciada.mensagem);
      }

      setCarregando(false);

      return;
    }

    if (inicioDaAgenda !== undefined) {
      // Sessão da Agenda (FR-231, FR-232): começa direto, na ordem e com o
      // conteúdo capturados pelo servidor; o Registro usa o id do início.
      const iniciada = SessaoDeEstudo.iniciarDaRevisao(inicioDaAgenda.cartoes);

      setBaralho({
        id: inicioDaAgenda.baralhoId,
        nome: inicioDaAgenda.nomeDoBaralho,
        elegivel: true,
        cartoes: inicioDaAgenda.cartoes,
      });

      if (iniciada.ok) {
        const estadoInicial = iniciada.sessao.estadoAtual();

        idDoRegistroDeSessao.current = inicioDaAgenda.id;
        setSessao(iniciada.sessao);
        setEstado(estadoInicial);
        carregarPrevias(estadoInicial.itens.map((item) => item.cartaoId));
        alvoDeFoco.current = "frente";
        anunciar(
          `Sessão iniciada com ${estadoInicial.total} ${
            estadoInicial.total === 1 ? "Item" : "Itens"
          }.`,
        );
      } else {
        setFalhaDeCarregamento(iniciada.mensagem);
      }

      setCarregando(false);

      return;
    }

    void cliente.obterBaralho(id).then((resultado) => {
      if (!ativo) {
        return;
      }

      if (!resultado.ok) {
        if (resultado.erro === "nao_encontrado") {
          setBaralhoNaoEncontrado(resultado.mensagem);
        } else {
          setFalhaDeCarregamento(resultado.mensagem);
        }
      } else {
        setBaralho(resultado.baralho);
      }

      setCarregando(false);
    });

    return () => {
      ativo = false;
    };
  }, [cliente, id, inicioDaAgenda, selecaoTemporaria]);

  // Movimentação de foco que reage a uma mudança de fase precisa ser um efeito
  // de layout: `useEffect` roda depois da pintura, então por um instante o foco
  // ficaria no `<body>` (o botão acionado foi desabilitado/removido) e quem
  // observa o DOM logo após o commit — leitor de tela ou teste — enxergaria o
  // foco perdido. `useLayoutEffect` roda de forma síncrona imediatamente após a
  // mutação do DOM e antes da pintura, sem foco transitório no `<body>`,
  // preservando a ordem de foco esperada (WCAG 2.4.3); é o mesmo padrão de
  // `PaginaDoBaralho.tsx` para o foco após remoção.
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
    } else if (alvo === "resumo") {
      resumoRef.current?.focus();
    } else {
      quantidadeRef.current?.focus();
    }
  }, [estado]);

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
  }, [sessao, estado]);

  const emAndamento = sessao !== null && estado !== null && !estado.concluida;
  // Sessão concluída e ainda não registrada: sair perde o Registro, e por isso
  // a navegação pede confirmação até o histórico confirmar (FR-164).
  const aguardandoRegistro =
    estado !== null &&
    estado.concluida &&
    situacaoDoRegistro.estado !== "registrada";
  const emConfiguracaoComMudanca =
    sessao === null &&
    estado === null &&
    baralho !== null &&
    quantidade !== "";
  const protecaoDeSaida: Protecao | null = emAndamento
    ? {
        tipo: "descarte",
        titulo: "Interromper a Sessão?",
        descricao:
          "O progresso desta Sessão será descartado e não haverá Resumo.",
        rotuloDeConfirmacao: "Interromper",
      }
    : aguardandoRegistro
      ? {
          tipo: "descarte",
          titulo: "Sair sem registrar a Sessão?",
          descricao: "Esta Sessão não ficará no seu histórico.",
          rotuloDeConfirmacao: "Sair sem registrar",
        }
      : emConfiguracaoComMudanca
        ? {
            tipo: "descarte",
            titulo: "Descartar a configuração?",
            descricao: "A quantidade escolhida será perdida.",
            rotuloDeConfirmacao: "Descartar",
          }
        : null;

  useProtecaoDeSaida(protecaoDeSaida);
  const protegerAcao = useAcaoProtegida();

  function anunciar(mensagem: string): void {
    setAnuncio(mensagem);
    setSequenciaDeAnuncio((atual) => atual + 1);
  }

  function interromper(): void {
    setSessao(null);
    setEstado(null);
    setQuantidade("");
    setAnuncio(null);
    setSituacaoDoRegistro({ estado: "ocioso" });
    setPrevias({});
    idDoRegistroDeSessao.current = null;
    alvoDeFoco.current = null;
    sairDaPagina();
  }

  /**
   * Sai da página: Sessão da Agenda volta a Início pela casca (que descarta o
   * início); a do Baralho volta ao Baralho.
   */
  function sairDaPagina(): void {
    if (selecaoTemporaria !== undefined) {
      // O baralho temporário volta para Baralhos pela casca, que descarta a
      // seleção — FR-375.
      if (aoSair !== undefined) {
        aoSair();
      } else {
        irParaRota("#/baralhos");
      }

      return;
    }

    if (inicioDaAgenda !== undefined) {
      if (aoSair !== undefined) {
        aoSair();
      } else {
        irParaRota("#/inicio");
      }

      return;
    }

    irParaRota(`#/baralhos/${id}`);
  }

  function estudarNovamente(): void {
    alvoDeFoco.current = "quantidade";
    setSessao(null);
    setEstado(null);
    setQuantidade("");
    setFalhaDeInicio(null);
    setAnuncio(null);
    setSituacaoDoRegistro({ estado: "ocioso" });
    setPrevias({});
    idDoRegistroDeSessao.current = null;
  }

  function iniciarSessao(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();

    if (baralho === null) {
      return;
    }

    setFalhaDeInicio(null);
    setSituacaoDoRegistro({ estado: "ocioso" });
    idDoRegistroDeSessao.current = null;

    const resultado = SessaoDeEstudo.iniciar(
      id,
      Number(quantidade),
      baralho.cartoes,
      aleatoriedadeDaSessao,
    );

    if (!resultado.ok) {
      setFalhaDeInicio(resultado.mensagem);
      quantidadeRef.current?.focus();
      return;
    }

    const novaSessao = resultado.sessao;
    const estadoInicial = novaSessao.estadoAtual();

    setSessao(novaSessao);
    setEstado(estadoInicial);
    carregarPrevias(estadoInicial.itens.map((item) => item.cartaoId));
    alvoDeFoco.current = "frente";
    // O aviso de limite é exibido na própria tela (FR-149); o anúncio é
    // distinto para não duplicar o mesmo texto na página.
    anunciar(
      `Sessão iniciada com ${estadoInicial.total} ${
        estadoInicial.total === 1 ? "Item" : "Itens"
      }.`,
    );
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

  /**
   * Registra a Avaliação do Item corrente (FR-193). Só é chamada com o Verso
   * revelado — os botões e os atalhos nascem depois da Revelação —, e o
   * `resultado` de duas vias é derivado pela própria Sessão (FR-194).
   */
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
      // A conclusão é anunciada pelo foco no título "Sessão concluída".
      alvoDeFoco.current = "resumo";
      setAnuncio(null);
      // Os Itens do Registro saem do estado da Sessão concluída, na ordem em
      // que foram apresentados (FR-176): é essa a ordem que a tela exibe e que
      // o Registro transporta, com Cartão e Avaliação (FR-196).
      registrarNoHistorico(itensDoRegistro(estadoAtualizado));
      return;
    }

    alvoDeFoco.current = "frente";
    anunciar(`Avaliação registrada: ${rotuloDaAvaliacao(avaliacao)}.`);
  }

  /**
   * Busca as prévias dos Cartões da Sessão (FR-221) e as guarda por Cartão.
   * Uma falha não bloqueia: a mensagem é anunciada e os botões aparecem só com
   * o nível, de modo que o estudo continua.
   */
  function carregarPrevias(cartaoIds: readonly string[]): void {
    setPrevias({});

    void carregarTodasAsPrevias(cliente, cartaoIds).then((resultado) => {
      if (resultado.ok) {
        setPrevias(resultado.previas);
        return;
      }

      anunciar(resultado.mensagem);
    });
  }

  /**
   * Registra a Sessão concluída no histórico (FR-161, FR-163). O `id` é gerado
   * na primeira tentativa e guardado: "Tentar registrar novamente" reenvia o
   * **mesmo** `id`, e é isso que impede o Registro duplicado. Só é chamada
   * quando a Sessão termina — Sessão interrompida nunca registra (FR-162).
   */
  function registrarNoHistorico(itens: DadosDeRegistro["itens"]): void {
    if (baralho === null) {
      return;
    }

    const idDoRegistro = idDoRegistroDeSessao.current ?? crypto.randomUUID();
    idDoRegistroDeSessao.current = idDoRegistro;

    setSituacaoDoRegistro({ estado: "registrando" });

    void cliente
      .registrarSessao({
        id: idDoRegistro,
        // O servidor deriva o nome «Baralho temporário» (FR-369).
        origem: selecaoTemporaria !== undefined ? "temporario" : "baralho",
        baralhoId: selecaoTemporaria !== undefined ? "" : id,
        nomeDoBaralho: baralho.nome,
        ...(inicioDaAgenda !== undefined
          ? { inicioAgendaId: inicioDaAgenda.id }
          : {}),
        itens,
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

    registrarNoHistorico(itensDoRegistro(estado));
  }

  if (carregando) {
    return (
      <div className="pilha">
        <p className="voltar">
          <a href={`#/baralhos/${id}`}>
            <span aria-hidden="true">←</span> Voltar para o Baralho
          </a>
        </p>
        <h1>Estudar Baralho</h1>
        <p className="carregando">Carregando Baralho…</p>
      </div>
    );
  }

  if (baralhoNaoEncontrado !== null) {
    return (
      <div className="pilha">
        <p className="voltar">
          <a href={`#/baralhos/${id}`}>
            <span aria-hidden="true">←</span> Voltar para o Baralho
          </a>
        </p>
        <h1>Baralho não encontrado</h1>
        <p className="erro" role="alert" aria-label="Baralho não encontrado">
          {baralhoNaoEncontrado}
        </p>
      </div>
    );
  }

  if (falhaDeCarregamento !== null) {
    return (
      <div className="pilha">
        <p className="voltar">
          <a href={`#/baralhos/${id}`}>
            <span aria-hidden="true">←</span> Voltar para o Baralho
          </a>
        </p>
        <h1>Estudar Baralho</h1>
        <p
          className="erro"
          role="alert"
          aria-label="Falha ao carregar o Baralho"
        >
          {falhaDeCarregamento}
        </p>
      </div>
    );
  }

  if (baralho === null) {
    return null;
  }

  const linkDeVoltar = (
    <p className="voltar">
      <a href={`#/baralhos/${id}`}>
        <span aria-hidden="true">←</span> Voltar para o Baralho
      </a>
    </p>
  );
  const ehDaAgenda = inicioDaAgenda !== undefined;
  const ehTemporario = selecaoTemporaria !== undefined;
  const avisoDaAgenda =
    inicioDaAgenda !== undefined &&
    inicioDaAgenda.quantidadeSolicitada !== null &&
    inicioDaAgenda.cartoes.length < inicioDaAgenda.quantidadeSolicitada
      ? `A Rotina pede ${inicioDaAgenda.quantidadeSolicitada} Cartões, mas este Baralho tem ${inicioDaAgenda.cartoes.length}. A Sessão terá ${inicioDaAgenda.cartoes.length} ${inicioDaAgenda.cartoes.length === 1 ? "Item" : "Itens"}.`
      : null;

  if (!baralho.elegivel) {
    return (
      <div className="pilha">
        {linkDeVoltar}
        <header className="cabecalho-da-pagina">
          <div>
            <h1>Estudar {baralho.nome}</h1>
          </div>
        </header>
        <section className="estado-vazio">
          <p>{MENSAGEM_DE_BARALHO_INELEGIVEL}</p>
        </section>
      </div>
    );
  }

  if (sessao === null || estado === null) {
    return (
      <div className="pilha">
        {linkDeVoltar}
        <header className="cabecalho-da-pagina">
          <div>
            <h1>Estudar {baralho.nome}</h1>
          </div>
        </header>

        <form className="cartao pilha" onSubmit={iniciarSessao} noValidate>
          <div className="campo">
            <label className="rotulo" htmlFor="campo-quantidade">
              Quantidade de Cartões
            </label>
            <input
              id="campo-quantidade"
              ref={quantidadeRef}
              type="number"
              inputMode="numeric"
              value={quantidade}
              onChange={(evento) => setQuantidade(evento.target.value)}
              aria-describedby="quantidade-disponivel"
            />
            <p id="quantidade-disponivel" className="ajuda">
              Este Baralho tem {baralho.cartoes.length}{" "}
              {baralho.cartoes.length === 1
                ? "Cartão vinculado."
                : "Cartões vinculados."}
            </p>
          </div>

          {falhaDeInicio !== null && (
            <p
              className="erro"
              role="alert"
              aria-label="Falha ao iniciar a Sessão"
            >
              {falhaDeInicio}
            </p>
          )}

          <div className="acoes">
            <button className="botao botao--primario" type="submit">
              Iniciar Sessão
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (estado.concluida) {
    if (selecaoTemporaria !== undefined && salvandoComoBaralho) {
      // FR-371–FR-374: «Salvar como baralho» substitui o Resumo na mesma rota.
      return (
        <SalvarSelecaoComoBaralho
          cliente={cliente}
          cartaoIds={selecaoTemporaria.map((cartao) => cartao.id)}
          aoSalvar={(baralho) => {
            focoAoVoltarAoResumo.current = "abrir";
            setBaralhoSalvo(baralho);
            setSalvandoComoBaralho(false);
          }}
          aoCancelar={() => {
            focoAoVoltarAoResumo.current = "salvar";
            setSalvandoComoBaralho(false);
          }}
        />
      );
    }

    return (
      <div className="pilha">
        <header className="cabecalho-da-pagina resumo__cabecalho">
          <div>
            <h1 ref={resumoRef} tabIndex={-1}>
              Sessão concluída
            </h1>
            {ehTemporario && (
              <p className="texto-secundario">
                Estudo com baralho temporário
              </p>
            )}
          </div>
        </header>

        <ResumoDaSessao itens={itensDoResumo(estado)} origem="baralho">
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
              className="visualmente-oculto"
            >
              Sessão registrada no histórico.
              {ehDaAgenda ? " O estudo programado de hoje foi concluído." : ""}
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

          {ehTemporario ? (
            <div className="acoes resumo__acoes">
              {baralhoSalvo !== null ? (
                <>
                  <p className="aviso aviso--sucesso">Baralho salvo.</p>
                  <a
                    ref={linkDoBaralhoSalvoRef}
                    className="botao botao--primario"
                    href={`#/baralhos/${encodeURIComponent(baralhoSalvo.id)}`}
                  >
                    Abrir baralho
                  </a>
                </>
              ) : (
                <button
                  ref={botaoDeSalvarRef}
                  className="botao botao--primario"
                  type="button"
                  disabled={situacaoDoRegistro.estado !== "registrada"}
                  onClick={() => setSalvandoComoBaralho(true)}
                  aria-describedby={
                    situacaoDoRegistro.estado !== "registrada"
                      ? "motivo-de-salvar-como-baralho"
                      : undefined
                  }
                >
                  Salvar como baralho
                </button>
              )}
              <a
                className="botao botao--secundario"
                href="#/baralhos"
                onClick={(evento) => {
                  evento.preventDefault();
                  protegerAcao(sairDaPagina);
                }}
              >
                Voltar para Baralhos
              </a>
              {situacaoDoRegistro.estado !== "registrada" && (
                <p id="motivo-de-salvar-como-baralho" className="ajuda">
                  Registre a Sessão para salvar o baralho.
                </p>
              )}
            </div>
          ) : (
          <div className="acoes resumo__acoes">
            {!ehDaAgenda && (
              <button
                className="botao botao--primario"
                type="button"
                onClick={estudarNovamente}
              >
                Estudar novamente
              </button>
            )}
            <a
              className={
                ehDaAgenda
                  ? "botao botao--primario"
                  : "botao botao--secundario"
              }
              href={ehDaAgenda ? "#/inicio" : `#/baralhos/${id}`}
              onClick={(evento) => {
                // Sair do Resumo é uma ação da própria página: sem proteção
                // ativa, navega normalmente; com o Registro pendente ou
                // falhado, passa pela confirmação (FR-164).
                evento.preventDefault();
                protegerAcao(sairDaPagina);
              }}
            >
              {ehDaAgenda ? "Voltar para Início" : "Voltar para o Baralho"}
            </a>
          </div>
          )}
        </ResumoDaSessao>
      </div>
    );
  }

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
          <h1>Estudar {baralho.nome}</h1>
        </div>
      </header>

      {estado.avisoDeLimite !== null && (
        <p className="aviso">{estado.avisoDeLimite}</p>
      )}

      {avisoDaAgenda !== null && <p className="aviso">{avisoDaAgenda}</p>}

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
        <p className="conteudo-do-cartao" tabIndex={0}>{estado.itemAtual.frente}</p>

        {!estado.itemAtual.revelado ? (
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
            <p className="conteudo-do-cartao" tabIndex={0}>{estado.itemAtual.verso}</p>
            <div className="botoes-de-resultado">
              {NIVEIS_DE_AVALIACAO.map(({ avaliacao, rotulo, atalho }) => {
                const previa = previaDaAvaliacao(
                  previas,
                  estado.itemAtual.cartaoId,
                  avaliacao,
                );

                return (
                  <button
                    key={avaliacao}
                    className="botao botao--secundario"
                    type="button"
                    aria-label={nomeAcessivelDaAvaliacao(rotulo, previa)}
                    aria-keyshortcuts={atalho}
                    onClick={() => registrarAvaliacao(avaliacao)}
                  >
                    {previa === null ? rotulo : `${rotulo} · ${previa}`}
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
 * Os Itens do Resumo, na ordem em que foram apresentados (FR-176).
 *
 * Ao concluir, todo Item já foi revelado e respondido — é o que a Sessão exige
 * para chegar ao fim —, então o estreitamento pelo discriminante `revelado`
 * garante Verso e Resultado não nulos, sem asserções sobre valores que possam
 * ser nulos. A ordem é a do próprio estado da Sessão, que é a ordem exibida, e
 * a Avaliação acompanha cada Item para a contagem por nível (FR-196, FR-216).
 */
function itensDoResumo(estado: EstadoDaSessaoConcluida): ItemDoResumo[] {
  const itens: ItemDoResumo[] = [];

  for (const item of estado.itens) {
    if (item.revelado && item.resultado !== null) {
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
 * Os Itens do Registro de sessão, na ordem apresentada, com o Cartão de origem
 * e a Avaliação de cada um (FR-196). O `resultado` não é enviado: quem o
 * deriva é o servidor (FR-194).
 */
function itensDoRegistro(
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

/** O rótulo em português de uma Avaliação, para anúncios (FR-046). */
function rotuloDaAvaliacao(avaliacao: Avaliacao): string {
  const nivel = NIVEIS_DE_AVALIACAO.find(
    (candidato) => candidato.avaliacao === avaliacao,
  );

  return nivel?.rotulo ?? avaliacao;
}

/**
 * O rótulo humano da próxima revisão de uma Avaliação para um Cartão
 * (FR-221), ou `null` quando a prévia não foi obtida — caso em que o botão
 * mostra só o nível.
 */
function previaDaAvaliacao(
  previas: Record<string, Previa>,
  cartaoId: string,
  avaliacao: Avaliacao,
): string | null {
  const iso = previas[cartaoId]?.[avaliacao];

  if (iso === undefined) {
    return null;
  }

  return rotuloDaPrevia(new Date(), iso);
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

/**
 * Reúne as prévias de todos os Cartões da Sessão, em blocos de até 200 ids
 * (FR-221, contrato §5). Qualquer bloco que falhe interrompe a coleta e a
 * falha é propagada — a página a anuncia sem impedir o estudo.
 */
async function carregarTodasAsPrevias(
  cliente: ClienteDoAcervo,
  cartaoIds: readonly string[],
): Promise<ResultadoDasPrevias> {
  const previas: Record<string, Previa> = {};

  for (
    let inicio = 0;
    inicio < cartaoIds.length;
    inicio += TAMANHO_MAXIMO_DO_BLOCO_DE_PREVIAS
  ) {
    const bloco = cartaoIds.slice(
      inicio,
      inicio + TAMANHO_MAXIMO_DO_BLOCO_DE_PREVIAS,
    );
    const resultado = await cliente.obterPrevias(bloco);

    if (!resultado.ok) {
      return resultado;
    }

    Object.assign(previas, resultado.previas);
  }

  return { ok: true, previas };
}
