import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type {
  KeyboardEvent as KeyboardEventDeReact,
  MouseEvent as MouseEventDeReact,
} from "react";

import type {
  Avaliacao,
  BaralhoComCartoes,
  CartaoListado,
  ClienteDoAcervo,
  DadosDeRegistro,
  InicioDeCompromisso,
  Previa,
  ResultadoDasPrevias,
} from "../acervo-cliente/cliente";
import {
  cartoesDoBaralho,
  cartoesPendentes,
  situacaoDoBaralho,
  type SituacaoDoBaralho,
} from "../acervo-cliente/busca-no-acervo";
import { nomeAcessivelDaAvaliacao, rotuloDaPrevia } from "../revisao/dia";
import { AleatoriedadeReal } from "../sessao-de-estudo/aleatoriedade";
import type { Aleatoriedade } from "../sessao-de-estudo/aleatoriedade";
import { LIMITE_DA_SELECAO } from "../sessao-de-estudo/selecao-temporaria";
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
 * A tela reúne as fases — preparação, Sessão e Resumo — na mesma rota
 * `#/baralhos/:id/estudo` (FR-149). Não há mais formulário de quantidade
 * (FR-383): a preparação é a leitura do acervo, a modal de escolha (quando o
 * Baralho está pendente) ou o início direto (quando está revisado). Sair antes
 * de concluir perde trabalho, e por isso a página registra
 * `useProtecaoDeSaida` (FR-150, FR-151): a Sessão em andamento pede
 * confirmação antes de qualquer navegação, e o botão "Interromper" passa pela
 * mesma confirmação, via `useAcaoProtegida`. O Resumo apresenta o percentual e
 * as contagens derivadas dos Itens (FR-152, FR-174, SC-067, SC-073).
 *
 * Concluída a Sessão, a página a registra no histórico (FR-161, FR-163) com um
 * `id` gerado uma única vez por Sessão concluída: uma nova tentativa reenvia o
 * mesmo `id` e não duplica o Registro. Sessão interrompida nunca é registrada
 * (FR-162) e, enquanto o Registro não estiver confirmado, sair do Resumo pede
 * confirmação (FR-164).
 *
 * A partir da 024 (FR-378–FR-387, SC-151–SC-154), a rota do Baralho deixa de
 * pedir quantidade: ao abrir, a página carrega `obterBaralho` **e**
 * `listarCartoes` — os Agendamentos decidem a situação (FR-385) —, cruza os
 * Vínculos com `cartoesDoBaralho` e classifica o conjunto com `agora`
 * injetado. Pendente abre a modal acessível intitulada "Revisar baralho", com
 * "Só pendentes" e "Todos os cartões", cada ação com a sua contagem em texto
 * separado, e "Cancelar" com o foco inicial (FR-383, FR-387); a escolha
 * inicia direto o conjunto embaralhado, sem configuração de quantidade.
 * Revisado inicia todos em um clique, sem modal (FR-384). Conjuntos acima do
 * limite de registro desabilitam **apenas** a opção excedente na modal, com o
 * motivo e a orientação de usar um Baralho menor ou a seleção temporária, sem
 * truncar (FR-386). Uma falha na leitura das datas mostra a falha com "Tentar
 * novamente" e nunca vira um "Revisado" falso (FR-385, SC-151). "Revisar
 * novamente" relê os dados atuais e aplica a mesma decisão entre modal e
 * início direto (FR-385). A seleção temporária continua iniciando todos os
 * escolhidos sem modal (FR-384), e a Agenda preserva a seleção do
 * Compromisso — o título "Estudar" da Sessão da Agenda e as ações da Agenda
 * não mudam de nome (FR-378).
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

type AlvoDeFoco = "frente" | "verso" | "resumo";

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

  /**
   * Os Cartões vinculados ao Baralho da rota, com os Agendamentos, e a
   * situação do conjunto derivada deles (FR-379, FR-385). Vivem em estado
   * porque a modal de escolha trabalha sobre os dados carregados para aquele
   * início; uma nova revisão relê tudo.
   */
  const [cartoesVinculados, setCartoesVinculados] = useState<
    readonly CartaoListado[] | null
  >(null);
  const [situacaoDoConjunto, setSituacaoDoConjunto] =
    useState<SituacaoDoBaralho | null>(null);
  /** A modal "Revisar baralho" está pedindo a escolha do conjunto (FR-383). */
  const [escolhaPedida, setEscolhaPedida] = useState(false);
  /** Relê o Baralho e os Agendamentos: nova tentativa e «Revisar novamente». */
  const [tentativa, setTentativa] = useState(0);
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
    setCartoesVinculados(null);
    setSituacaoDoConjunto(null);
    setEscolhaPedida(false);
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

    void Promise.all([cliente.obterBaralho(id), cliente.listarCartoes()]).then(
      ([resultadoDeBaralho, resultadoDeCartoes]) => {
        if (!ativo) {
          return;
        }

        if (!resultadoDeBaralho.ok) {
          if (resultadoDeBaralho.erro === "nao_encontrado") {
            setBaralhoNaoEncontrado(resultadoDeBaralho.mensagem);
          } else {
            setFalhaDeCarregamento(resultadoDeBaralho.mensagem);
          }
          setCarregando(false);
          return;
        }

        if (!resultadoDeCartoes.ok) {
          // FR-385: sem os Agendamentos não há classificação confiável — a
          // falha é recuperável («Tentar novamente») e nunca vira "Revisado".
          setBaralho(resultadoDeBaralho.baralho);
          setFalhaDeCarregamento(resultadoDeCartoes.mensagem);
          setCarregando(false);
          return;
        }

        const vinculados = cartoesDoBaralho(resultadoDeCartoes.cartoes, id);
        const situacao = situacaoDoBaralho(
          vinculados.map((cartao) => cartao.proximaRevisaoEm),
          new Date(),
        );

        setBaralho(resultadoDeBaralho.baralho);
        setCartoesVinculados(vinculados);
        setSituacaoDoConjunto(situacao);
        setCarregando(false);

        if (vinculados.length === 0) {
          // FR-386: um conjunto vazio não inicia Sessão vazia; a tela mostra
          // o estado «Sem cartões» com o motivo.
          return;
        }

        if (situacao === "revisado") {
          // FR-384: um Baralho Revisado inicia todos imediatamente, sem modal.
          iniciarComCartoes(vinculados);
        } else {
          // FR-383: um Baralho pendente pede a escolha do conjunto na modal.
          setEscolhaPedida(true);
        }
      },
    );

    return () => {
      ativo = false;
    };
  }, [cliente, id, inicioDaAgenda, selecaoTemporaria, tentativa]);

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

  /**
   * Inicia a Sessão de revisão com o conjunto já decidido (FR-383, FR-384).
   *
   * É o único caminho de início do Baralho: a modal («Só pendentes» ou
   * «Todos os cartões») e o início direto de um Baralho Revisado chegam aqui
   * com os Cartões carregados — embaralhados pela própria Sessão, sem
   * quantidade. Um conjunto acima do limite de registro é recusado com o
   * motivo e a orientação, sem truncar (FR-386); um conjunto vazio não inicia
   * Sessão vazia (a tela já o impede antes). O aviso de limite da própria
   * Sessão é exibido na tela (FR-149) e o anúncio é distinto para não
   * duplicar o mesmo texto na página.
   */
  function iniciarComCartoes(cartoesDaSessao: readonly CartaoListado[]): void {
    setEscolhaPedida(false);
    setFalhaDeInicio(null);
    setSituacaoDoRegistro({ estado: "ocioso" });
    idDoRegistroDeSessao.current = null;

    if (cartoesDaSessao.length > LIMITE_DA_SELECAO) {
      setFalhaDeInicio(motivoDoLimiteExcedido(cartoesDaSessao.length));
      return;
    }

    const resultado = SessaoDeEstudo.iniciar(
      id,
      cartoesDaSessao.length,
      cartoesDaSessao,
      aleatoriedadeDaSessao,
    );

    if (!resultado.ok) {
      setFalhaDeInicio(resultado.mensagem);
      return;
    }

    const novaSessao = resultado.sessao;
    const estadoInicial = novaSessao.estadoAtual();

    setSessao(novaSessao);
    setEstado(estadoInicial);
    carregarPrevias(estadoInicial.itens.map((item) => item.cartaoId));
    alvoDeFoco.current = "frente";
    anunciar(
      `Sessão iniciada com ${estadoInicial.total} ${
        estadoInicial.total === 1 ? "Item" : "Itens"
      }.`,
    );
  }

  /**
   * A escolha da modal (FR-383): «Só pendentes» inclui os Cartões novos ou
   * vencidos; «Todos os cartões» usa o conjunto carregado para este início.
   * Um conjunto pendente vazio não inicia Sessão vazia (FR-386).
   */
  function escolherConjuntoDaRevisao(chave: ChaveDaRevisao): void {
    if (cartoesVinculados === null) {
      return;
    }

    const conjunto =
      chave === "pendentes"
        ? cartoesPendentes(cartoesVinculados, new Date())
        : cartoesVinculados;

    if (conjunto.length === 0) {
      return;
    }

    iniciarComCartoes(conjunto);
  }

  /**
   * Cancela a modal sem iniciar Sessão (FR-383, FR-387): fecha e volta ao
   * detalhe do Baralho, o destino do «Voltar para o Baralho» desta rota.
   */
  function cancelarEscolha(): void {
    setEscolhaPedida(false);
    sairDaPagina();
  }

  /**
   * Relê o Baralho e os Agendamentos (FR-385): é o «Tentar novamente» da
   * falha de leitura.
   */
  function recarregar(): void {
    setTentativa((atual) => atual + 1);
  }

  /**
   * «Revisar novamente» (FR-378, FR-385): relê os dados atuais e aplica a
   * mesma decisão entre modal e início direto — a classificação nunca fica
   * velha.
   */
  function revisarNovamente(): void {
    setSessao(null);
    setEstado(null);
    setAnuncio(null);
    setSituacaoDoRegistro({ estado: "ocioso" });
    setPrevias({});
    idDoRegistroDeSessao.current = null;
    alvoDeFoco.current = null;
    recarregar();
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
        <h1>{inicioDaAgenda === undefined ? "Revisar" : "Estudar"} Baralho</h1>
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
        <h1>{inicioDaAgenda === undefined ? "Revisar" : "Estudar"} Baralho</h1>
        <p
          className="erro"
          role="alert"
          aria-label="Falha ao carregar o Baralho"
        >
          {falhaDeCarregamento}
        </p>
        {inicioDaAgenda === undefined &&
          selecaoTemporaria === undefined && (
            <div className="acoes">
              <button
                type="button"
                className="botao botao--primario"
                onClick={recarregar}
              >
                Tentar novamente
              </button>
            </div>
          )}
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

  if (!baralho.elegivel || situacaoDoConjunto === "sem-cartoes") {
    // FR-380, FR-386: um Baralho vazio mostra «Sem cartões» como situação
    // neutra, e um conjunto vazio não inicia Sessão vazia.
    return (
      <div className="pilha">
        {linkDeVoltar}
        <header className="cabecalho-da-pagina">
          <div>
            <h1>
              {ehDaAgenda ? "Estudar" : "Revisar"} {baralho.nome}
            </h1>
          </div>
        </header>
        <section className="estado-vazio">
          <p>{MENSAGEM_DE_BARALHO_INELEGIVEL}</p>
        </section>
      </div>
    );
  }

  if (sessao === null || estado === null) {
    // A preparação da revisão (FR-383): a modal pede a escolha do conjunto
    // quando o Baralho está pendente; um Baralho revisado já iniciou direto e
    // não passa por aqui. `falhaDeInicio` cobre a recusa por limite (FR-386).
    return (
      <div className="pilha">
        {linkDeVoltar}
        <header className="cabecalho-da-pagina">
          <div>
            <h1>
              {ehDaAgenda ? "Estudar" : "Revisar"} {baralho.nome}
            </h1>
          </div>
        </header>

        {falhaDeInicio !== null && (
          <p
            className="erro"
            role="alert"
            aria-label="Falha ao iniciar a Sessão"
          >
            {falhaDeInicio}
          </p>
        )}

        <DialogoDaEscolhaDaRevisao
          aberto={escolhaPedida}
          opcoes={opcoesDaEscolhaDaRevisao(cartoesVinculados ?? [])}
          aoEscolher={escolherConjuntoDaRevisao}
          aoCancelar={cancelarEscolha}
        />
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
                onClick={revisarNovamente}
              >
                Revisar novamente
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
          <h1>
            {ehDaAgenda ? "Estudar" : "Revisar"} {baralho.nome}
          </h1>
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

/** A chave das ações da modal de escolha (FR-383). */
type ChaveDaRevisao = "pendentes" | "todos";

/** Uma ação da modal de escolha: a contagem e o motivo da recusa (FR-383, FR-386). */
interface OpcaoDaEscolhaDaRevisao {
  chave: ChaveDaRevisao;
  rotulo: string;
  contagem: string;
  motivoDesabilitado: string | null;
}

/**
 * As duas ações da modal com as contagens e os motivos (FR-383, FR-386).
 *
 * «Só pendentes» conta os Cartões novos ou vencidos — nunca mais que o
 * conjunto —; «Todos os cartões» conta o conjunto carregado inteiro. Uma ação
 * acima do limite de registro fica desabilitada com o motivo e a orientação,
 * sem truncar e sem desabilitar a outra; um conjunto pendente vazio também
 * não inicia Sessão vazia.
 */
function opcoesDaEscolhaDaRevisao(
  vinculados: readonly CartaoListado[],
): OpcaoDaEscolhaDaRevisao[] {
  const pendentes = cartoesPendentes(vinculados, new Date());

  return [
    {
      chave: "pendentes",
      rotulo: "Só pendentes",
      contagem: contagemDeCartoesPendentes(pendentes.length),
      motivoDesabilitado:
        pendentes.length === 0
          ? "Não há Cartões pendentes neste Baralho."
          : motivoDeLimite(pendentes.length),
    },
    {
      chave: "todos",
      rotulo: "Todos os cartões",
      contagem: contagemDeCartoesNoBaralho(vinculados.length),
      motivoDesabilitado: motivoDeLimite(vinculados.length),
    },
  ];
}

/** A mensagem da recusa por limite, com o motivo e a orientação (FR-386). */
function motivoDoLimiteExcedido(quantidade: number): string {
  return (
    `O conjunto tem ${quantidade} Cartões e excede o limite de ` +
    `${LIMITE_DA_SELECAO.toLocaleString("pt-BR")} por Sessão. ` +
    "Use um Baralho menor ou a seleção temporária."
  );
}

/** O motivo da recusa por limite; `null` quando o conjunto cabe (FR-386). */
function motivoDeLimite(quantidade: number): string | null {
  if (quantidade <= LIMITE_DA_SELECAO) {
    return null;
  }

  return motivoDoLimiteExcedido(quantidade);
}

/** «1 Cartão pendente» ou «N Cartões pendentes» (FR-383). */
function contagemDeCartoesPendentes(quantidade: number): string {
  return quantidade === 1
    ? "1 Cartão pendente"
    : `${quantidade} Cartões pendentes`;
}

/** «1 Cartão no Baralho» ou «N Cartões no Baralho» (FR-383). */
function contagemDeCartoesNoBaralho(quantidade: number): string {
  return quantidade === 1
    ? "1 Cartão no Baralho"
    : `${quantidade} Cartões no Baralho`;
}

/**
 * A modal de escolha da revisão (FR-383, FR-386, FR-387).
 *
 * Usa o `<dialog>` nativo com `showModal()` — o próprio elemento prende a
 * navegação por Tab e trata Escape como cancelamento — e cai para o atributo
 * `open` quando o jsdom não implementa `showModal`/`close`, como em
 * `DialogoDeConfirmacao`. Só existe no DOM enquanto está aberta: as ações não
 * aparecem na página antes da escolha.
 *
 * O foco inicial vai para "Cancelar" — a ação sem consequência —, para que
 * ninguém inicie uma Sessão por engano ao percorrer o diálogo por teclado
 * (FR-387). Cada ação tem o nome acessível exato («Só pendentes», «Todos os
 * cartões») e a contagem, com o motivo quando desabilitada, em texto
 * separado, referenciado por `aria-describedby` — a contagem não polui o nome
 * do botão. Escape e o clique no pano de fundo cancelam sem iniciar.
 */
function DialogoDaEscolhaDaRevisao({
  aberto,
  opcoes,
  aoEscolher,
  aoCancelar,
}: {
  aberto: boolean;
  opcoes: readonly OpcaoDaEscolhaDaRevisao[];
  aoEscolher: (chave: ChaveDaRevisao) => void;
  aoCancelar: () => void;
}) {
  const id = useId();
  const tituloId = `${id}-titulo`;
  const dialogo = useRef<HTMLDialogElement>(null);
  const botaoDeCancelamento = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const elemento = dialogo.current;

    if (elemento === null || !aberto) {
      return;
    }

    if (!elemento.open) {
      if (typeof elemento.showModal === "function") {
        elemento.showModal();
      } else {
        elemento.setAttribute("open", "");
      }
    }

    botaoDeCancelamento.current?.focus();
  }, [aberto]);

  if (!aberto) {
    return null;
  }

  function aoTeclar(evento: KeyboardEventDeReact<HTMLDialogElement>): void {
    if (evento.key === "Escape") {
      evento.preventDefault();
      aoCancelar();
    }
  }

  function aoClicarNoFundo(evento: MouseEventDeReact<HTMLDialogElement>): void {
    if (evento.target === evento.currentTarget) {
      aoCancelar();
    }
  }

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={tituloId}
      onKeyDown={aoTeclar}
      onClick={aoClicarNoFundo}
    >
      <h2 id={tituloId} className="titulo-do-dialogo">
        Revisar baralho
      </h2>
      <p className="descricao-do-dialogo">
        Escolha o conjunto que você quer revisar agora.
      </p>
      <ul className="opcoes-da-revisao">
        {opcoes.map((opcao) => {
          const ajudaId = `${id}-ajuda-${opcao.chave}`;
          const desabilitada = opcao.motivoDesabilitado !== null;

          return (
            <li key={opcao.chave}>
              <button
                type="button"
                className="botao botao--primario"
                disabled={desabilitada}
                aria-describedby={ajudaId}
                onClick={() => aoEscolher(opcao.chave)}
              >
                {opcao.rotulo}
              </button>
              <p id={ajudaId} className="ajuda">
                {opcao.contagem}
                {opcao.motivoDesabilitado === null
                  ? ""
                  : ` ${opcao.motivoDesabilitado}`}
              </p>
            </li>
          );
        })}
      </ul>
      <div className="acoes-do-dialogo">
        <button ref={botaoDeCancelamento} type="button" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </dialog>
  );
}
