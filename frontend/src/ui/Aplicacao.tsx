import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { MENSAGEM_DE_INDISPONIBILIDADE_DO_ACESSO } from "../acervo-cliente/cliente";
import type {
  ClienteDoAcervo,
  Credencial,
  InicioDeCompromisso,
  ResultadoDeObterAcesso,
} from "../acervo-cliente/cliente";
import { decidirRenovacao } from "../acesso/atividade";
import { comGuardaDeCredencial } from "./guarda-de-credencial";
import { Moldura } from "./Moldura";
import { ROTA_DE_ENTRADA, irParaRota } from "./navegacao";
import type { Rota } from "./navegacao";
import { PaginaDaAgenda } from "./PaginaDaAgenda";
import { PaginaDaCentralDeEstudo } from "./PaginaDaCentralDeEstudo";
import { PaginaDoFormularioDeRotina } from "./PaginaDoFormularioDeRotina";
import { PaginaDeAdicionarCartoes } from "./PaginaDeAdicionarCartoes";
import { PaginaDeBaralhos } from "./PaginaDeBaralhos";
import { PaginaDeCadastro } from "./PaginaDeCadastro";
import { PaginaDeCartoes } from "./PaginaDeCartoes";
import {
  MENSAGEM_DE_CONTA_EXCLUIDA,
  MENSAGEM_DE_SAIDA,
  PaginaDeEntrada,
} from "./PaginaDeEntrada";
import type { AvisoDaEntrada, EscolhaDeEntrada } from "./PaginaDeEntrada";
import { PaginaDeEstudo } from "./PaginaDeEstudo";
import { PaginaDaSelecaoTemporaria } from "./PaginaDaSelecaoTemporaria";
import type { Cartao } from "../acervo-cliente/cliente";
import { PaginaDeInicio } from "./PaginaDeInicio";
import { PaginaDePreferencias } from "./PaginaDePreferencias";
import { PaginaDoBaralho } from "./PaginaDoBaralho";
import { PaginaDoFormularioDeBaralho } from "./PaginaDoFormularioDeBaralho";
import { PaginaDoFormularioDeCartao } from "./PaginaDoFormularioDeCartao";
import { PaginaDoRegistro } from "./PaginaDoRegistro";
import {
  ProvedorDeProtecaoDeSaida,
  useAcaoProtegida,
  useDescartarProtecao,
  useRotaExibida,
} from "./protecao-de-saida";

/**
 * Casca da aplicação, guarda de Credencial e navegação principal.
 *
 * A Credencial vive **apenas** no estado desta casca (FR-089): existe enquanto
 * a página estiver aberta, acompanha cada operação — ela chega na construção do
 * `ClienteDoAcervo` —, e nunca vai para `localStorage`, `sessionStorage`,
 * cookie ou URL (SC-033). Recarregar, fechar ou abrir outra aba começa sem
 * Credencial nenhuma, e cada aba mantém a sua.
 *
 * A navegação é por hash (`#/entrar`, `#/cartoes`, `#/baralhos` e
 * `#/criar-conta`), sem dependência de roteador, e o que aparece na tela é
 * decidido por `interpretarRota` com a guarda de Credencial: sem ela, a única
 * tela alcançável é "Entrar", exceto o Cadastro (FR-097); com ela, `#/entrar`
 * resolve no Início (FR-098, FR-168).
 *
 * Desde a `012`, a casca se divide em duas partes: a de fora é dona da
 * Credencial e envolve a de dentro no `ProvedorDeProtecaoDeSaida`; a de dentro
 * lê a rota **exibida** (`useRotaExibida`) e passa toda troca de tela pela
 * proteção de saída (FR-148, FR-151, FR-154). Sem Credencial não há moldura de
 * navegação (FR-098): só a marca. Com ela, a `Moldura` oferece Baralhos,
 * Cartões e "Sair" (FR-139) — "Sair" passa por `useAcaoProtegida` e, quando há
 * algo a perder, pede confirmação antes (FR-151). Numa mudança de rota, o foco
 * é movido para o título da tela — o destino que usuários de teclado e leitor
 * de tela esperam depois de ativar um link de navegação. Uma recusa de
 * Credencial limpa a proteção antes de descartar a Credencial (FR-157), de modo
 * que ela sempre vence.
 */

/**
 * Como a casca opera o cliente (018): com o **Acesso temporário** no cookie do
 * navegador — a Credencial já não está na memória — ou com a Credencial em
 * memória, quando a pessoa desmarcou «Continuar conectado neste navegador».
 */
export interface OpcoesDoCliente {
  usaAcesso: boolean;
}

interface PropriedadesDaAplicacao {
  /**
   * Produz o `ClienteDoAcervo` para uma Credencial, ou para `null` enquanto
   * ninguém tiver entrado. É uma fábrica, e não um cliente pronto, porque a
   * Credencial chega **na construção** do Adapter (FR-089): trocá-la — ao
   * Entrar, ao Sair ou ao descartá-la numa recusa — troca o cliente. Com
   * `usaAcesso`, o cliente não tem Credencial e opera pelo cookie (018).
   */
  criarCliente: (
    credencial: Credencial | null,
    opcoes?: OpcoesDoCliente,
  ) => ClienteDoAcervo;
}

/**
 * Quem está operando: o Nome de usuário e, só quando a continuidade foi
 * desmarcada, a Credencial que vive na memória desta página. Com o Acesso
 * temporário, a Senha **não** fica na memória depois do Entrar (FR-078,
 * FR-089 revisado).
 */
interface Sessao {
  nomeDeUsuario: string;
  credencial: Credencial | null;
}

export function Aplicacao({ criarCliente }: PropriedadesDaAplicacao) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [avisoDaEntrada, setAvisoDaEntrada] = useState<AvisoDaEntrada | null>(
    null,
  );
  // FR-290: na carga, o servidor diz se este navegador tem Acesso válido antes
  // de qualquer tela aparecer — e é isso que evita o lampejo de «Entrar».
  const [verificacao, setVerificacao] = useState<
    "verificando" | "concluida" | "falhou"
  >("verificando");
  const [numeroDaTentativa, setNumeroDaTentativa] = useState(0);
  // A verificação em voo de cada tentativa. O `StrictMode` executa o efeito
  // duas vezes; sem compartilhar a requisição, a primeira resposta
  // `acesso_expirado` limpa o Cookie e a segunda chegaria como `sem_acesso`,
  // sem a mensagem de expiração (FR-294).
  const verificacaoEmVoo = useRef<{
    tentativa: number;
    criarCliente: PropriedadesDaAplicacao["criarCliente"];
    resultado: Promise<ResultadoDeObterAcesso>;
  } | null>(null);

  const temCredencial = sessao !== null;
  const credencial = sessao?.credencial ?? null;
  const usaAcesso = sessao !== null && credencial === null;

  const clienteDaCredencial = useMemo(
    () => criarCliente(credencial, { usaAcesso }),
    [criarCliente, credencial, usaAcesso],
  );

  /**
   * FR-290, FR-294: a carga consulta `GET /acesso`. Válido leva ao Início sem
   * Entrar; `acesso_expirado` leva a Entrar com «Seu acesso expirou. Entre
   * novamente.»; `sem_acesso` leva a Entrar. A falha do armazenamento **não** é
   * expiração e não descarta o Acesso (FR-301): a tela oferece nova tentativa.
   */
  useEffect(() => {
    let ativo = true;

    setVerificacao("verificando");

    let emVoo = verificacaoEmVoo.current;

    if (
      emVoo === null ||
      emVoo.tentativa !== numeroDaTentativa ||
      emVoo.criarCliente !== criarCliente
    ) {
      emVoo = {
        tentativa: numeroDaTentativa,
        criarCliente,
        resultado: criarCliente(null, { usaAcesso: true }).obterAcesso(),
      };
      verificacaoEmVoo.current = emVoo;
    }

    void emVoo.resultado.then((resultado) => {
      if (!ativo) {
        return;
      }

      if (resultado.ok) {
        setSessao({ nomeDeUsuario: resultado.nomeDeUsuario, credencial: null });
        setVerificacao("concluida");
      } else if (resultado.erro === "indisponivel") {
        setVerificacao("falhou");
      } else {
        if (resultado.erro === "acesso_expirado") {
          setAvisoDaEntrada({ tipo: "falha", texto: resultado.mensagem });
        }

        setVerificacao("concluida");
      }
    });

    return () => {
      ativo = false;
    };
  }, [criarCliente, numeroDaTentativa]);

  /**
   * A recusa por Credencial já tratada desde a última Entrada: pedidos que
   * estavam em voo quando a Credencial foi recusada voltam recusados também, e a
   * mensagem da **primeira** recusa — por exemplo «Seu acesso expirou» — não pode
   * ser trocada pela genérica (FR-294).
   */
  const recusaJaTratada = useRef(false);

  const entrar = useCallback(
    (credencialInformada: Credencial, escolha: EscolhaDeEntrada) => {
      recusaJaTratada.current = false;
      setAvisoDaEntrada(null);
      setSessao({
        nomeDeUsuario: escolha.usuario.nomeDeUsuario,
        // FR-089 revisado: com a continuidade, o Acesso autoriza e a Senha sai
        // da memória; sem ela, a Credencial fica só nesta página aberta.
        credencial: escolha.continuarConectado ? null : credencialInformada,
      });
    },
    [],
  );

  /**
   * FR-094 e SC-034: Sair descarta a Credencial e volta a "Entrar" — o mesmo
   * destino do voltar do navegador, que reencontra a tela "Entrar" porque a
   * Credencial não sobreviveu em lugar nenhum. O Acesso do navegador já foi
   * encerrado no servidor por `POST /sair` (FR-293, FR-295).
   */
  const descartarPorSaida = useCallback(() => {
    // Uma requisição iniciada antes de Sair pode terminar depois que o servidor
    // descartou o Acesso. A decisão explícita de sair vence essa recusa tardia:
    // ela não pode trocar a confirmação de saída por uma falha genérica.
    recusaJaTratada.current = true;
    setSessao(null);
    setAvisoDaEntrada({ tipo: "saida", texto: MENSAGEM_DE_SAIDA });
    irParaRota(ROTA_DE_ENTRADA);
  }, []);

  /**
   * FR-091 e SC-035: recebida a recusa por Credencial — ou por Acesso expirado,
   * FR-294 —, ela é descartada, a tela "Entrar" volta com a mensagem que
   * explica a recusa e nada aparece como concluído — a operação recusada
   * continua não concluída nas telas, que saem de cena com ela.
   */
  const descartarPorRecusa = useCallback((mensagem: string) => {
    if (recusaJaTratada.current) {
      return;
    }

    recusaJaTratada.current = true;
    setSessao(null);
    setAvisoDaEntrada({ tipo: "falha", texto: mensagem });
    irParaRota(ROTA_DE_ENTRADA);
  }, []);

  /**
   * FR-263 e FR-270: renomear ou trocar a Senha **substitui** a Credencial em
   * memória pela nova — a pessoa segue na tela, sem Entrar de novo — e a
   * Credencial antiga, recusada pelo servidor, não vale mais em nenhuma outra
   * página (FR-264). Com o Acesso temporário não há Credencial a substituir: o
   * servidor já emitiu um Acesso novo a este navegador (FR-296), e só o nome
   * mostrado muda.
   */
  const substituirCredencial = useCallback((nova: Credencial) => {
    setSessao((atual) =>
      atual === null
        ? null
        : {
            nomeDeUsuario: nova.nomeDeUsuario,
            credencial: atual.credencial === null ? null : nova,
          },
    );
  }, []);

  /**
   * FR-276: a conta excluída leva a Credencial junto. A Credencial é descartada
   * e a tela "Entrar" volta com «Conta excluída».
   */
  const descartarPorExclusao = useCallback(() => {
    setSessao(null);
    setAvisoDaEntrada({
      tipo: "conta-excluida",
      texto: MENSAGEM_DE_CONTA_EXCLUIDA,
    });
    irParaRota(ROTA_DE_ENTRADA);
  }, []);

  /**
   * FR-282: quando o resultado de uma ação da conta é desconhecido, «Ir para
   * Entrar» descarta a Credencial — que pode já não valer — e leva a pessoa a
   * Entrar, onde o estado real se revela.
   */
  const irParaEntrar = useCallback(() => {
    setSessao(null);
    setAvisoDaEntrada({
      tipo: "falha",
      texto:
        "Entre novamente para conferir o estado da sua conta: a última alteração não pôde ser confirmada.",
    });
    irParaRota(ROTA_DE_ENTRADA);
  }, []);

  if (verificacao !== "concluida") {
    return (
      <>
        <header className="moldura">
          <span className="marca">memorization</span>
        </header>
        <main className="aplicacao">
          {verificacao === "verificando" ? (
            <p className="carregando" role="status">
              Verificando o acesso…
            </p>
          ) : (
            <section className="cartao">
              <p
                className="aviso aviso--erro"
                role="alert"
                aria-label="Falha ao verificar o acesso"
              >
                {MENSAGEM_DE_INDISPONIBILIDADE_DO_ACESSO}
              </p>
              <div className="acoes">
                <button
                  className="botao botao--primario"
                  type="button"
                  onClick={() => setNumeroDaTentativa((atual) => atual + 1)}
                >
                  Tentar novamente
                </button>
              </div>
            </section>
          )}
        </main>
      </>
    );
  }

  return (
    // A casca externa é dona da Credencial; a interna vive sob a proteção de
    // saída e é quem decide moldura, tela e guarda do cliente.
    <ProvedorDeProtecaoDeSaida temCredencial={temCredencial}>
      <CascaDaAplicacao
        temCredencial={temCredencial}
        usaAcesso={usaAcesso}
        nomeDeUsuarioDaCredencial={sessao?.nomeDeUsuario ?? ""}
        clienteDaCredencial={clienteDaCredencial}
        avisoDaEntrada={avisoDaEntrada}
        aoEntrar={entrar}
        aoSair={descartarPorSaida}
        aoRecusar={descartarPorRecusa}
        aoSubstituirCredencial={substituirCredencial}
        aoExcluirConta={descartarPorExclusao}
        aoIrParaEntrar={irParaEntrar}
      />
    </ProvedorDeProtecaoDeSaida>
  );
}

/** O que a casca interna recebe da casca externa, dona da Credencial. */
interface PropriedadesDaCasca {
  temCredencial: boolean;
  /** A página opera pelo Acesso temporário, e não por Credencial em memória (018). */
  usaAcesso: boolean;
  /** O Nome de usuário da Credencial corrente, para a saudação do Início. */
  nomeDeUsuarioDaCredencial: string;
  clienteDaCredencial: ClienteDoAcervo;
  avisoDaEntrada: AvisoDaEntrada | null;
  aoEntrar: (credencial: Credencial, escolha: EscolhaDeEntrada) => void;
  aoSair: () => void;
  aoRecusar: (mensagem: string) => void;
  aoSubstituirCredencial: (nova: Credencial) => void;
  aoExcluirConta: () => void;
  aoIrParaEntrar: () => void;
}

/**
 * A parte da casca que vive **sob** a proteção de saída (FR-148, FR-151,
 * FR-154): lê a rota exibida e passa cada troca de tela pela política de saída.
 * A Credencial continua na casca externa; aqui ela só decide a moldura, a tela
 * e a guarda do cliente.
 */
function CascaDaAplicacao({
  temCredencial,
  usaAcesso,
  nomeDeUsuarioDaCredencial,
  clienteDaCredencial,
  avisoDaEntrada,
  aoEntrar,
  aoSair,
  aoRecusar,
  aoSubstituirCredencial,
  aoExcluirConta,
  aoIrParaEntrar,
}: PropriedadesDaCasca) {
  const rota = useRotaExibida();
  const protegerAcao = useAcaoProtegida();
  const descartarProtecao = useDescartarProtecao();

  const principal = useRef<HTMLElement>(null);
  const rotaAnterior = useRef(rota);

  /**
   * O início autorizado de uma Sessão da Agenda (016, FR-231): o snapshot dos
   * Cartões fica só na memória da casca, nunca no armazenamento do navegador.
   * Sair da rota da Sessão — ou recarregar — o descarta, e a Sessão não
   * registra estudo parcial (FR-234).
   */
  const [inicioDaAgenda, setInicioDaAgenda] =
    useState<InicioDeCompromisso | null>(null);

  /**
   * Os Cartões capturados ao iniciar o baralho temporário (FR-366, FR-375)
   * ficam só na memória da casca; sair da rota da Sessão — ou recarregar —
   * os descarta e nada é registrado. T2318: inclui o nome opcional do baralho.
   */
  const [selecaoDoEstudoTemporario, setSelecaoDoEstudoTemporario] =
    useState<readonly Cartao[] | null>(null);
  const [nomeDoBaralhoTemporario, setNomeDoBaralhoTemporario] = useState("");

  const iniciarEstudoTemporario = useCallback(
    (cartoes: readonly Cartao[], nomeDoBaralho: string) => {
      setSelecaoDoEstudoTemporario(cartoes);
      setNomeDoBaralhoTemporario(nomeDoBaralho);
    },
    [],
  );

  const sairDoEstudoTemporario = useCallback(() => {
    setSelecaoDoEstudoTemporario(null);
    setNomeDoBaralhoTemporario("");
    irParaRota("#/baralhos");
  }, []);

  const iniciarEstudoDaAgenda = useCallback(
    (inicio: InicioDeCompromisso) => {
      setInicioDaAgenda(inicio);
      irParaRota("#/agenda/estudo");
    },
    [],
  );

  const sairDoEstudoDaAgenda = useCallback(() => {
    setInicioDaAgenda(null);
    irParaRota("#/inicio");
  }, []);

  useEffect(() => {
    if (rota.nome !== "estudo-da-agenda") {
      setInicioDaAgenda(null);
    }
  }, [rota.nome]);

  useEffect(() => {
    if (
      rota.nome !== "estudo-temporario" &&
      rota.nome !== "selecao-temporaria"
    ) {
      setSelecaoDoEstudoTemporario(null);
    }
  }, [rota.nome]);

  /**
   * FR-157: a recusa de Credencial sempre vence. A proteção vigente é limpa
   * antes de descartar a Credencial e ir para Entrar, para que essa navegação
   * não seja barrada por uma confirmação de descarte.
   */
  const recusarCredencial = useCallback(
    (mensagem: string) => {
      descartarProtecao();
      aoRecusar(mensagem);
    },
    [descartarProtecao, aoRecusar],
  );

  /**
   * O cliente que as telas do acervo recebem: o da Credencial corrente, com a
   * guarda que descarta a Credencial quando ela é recusada.
   */
  const cliente = useMemo(
    () => comGuardaDeCredencial(clienteDaCredencial, recusarCredencial),
    [clienteDaCredencial, recusarCredencial],
  );

  /**
   * FR-276 e FR-282: excluir a conta e «Ir para Entrar» são decisões explícitas
   * que vencem a proteção de saída — a tela que os pediu ainda a mantém
   * (operação em andamento ou formulário preenchido), e ela não pode barrar a
   * ida a Entrar, como acontece com a recusa de Credencial (FR-157).
   */
  const excluirConta = useCallback(() => {
    descartarProtecao();
    aoExcluirConta();
  }, [descartarProtecao, aoExcluirConta]);

  const irParaEntrar = useCallback(() => {
    descartarProtecao();
    aoIrParaEntrar();
  }, [descartarProtecao, aoIrParaEntrar]);

  /**
   * FR-151: Sair passa pela proteção de saída — com alterações não salvas ou
   * uma operação em andamento, a confirmação (ou o aviso) vem antes de a
   * Credencial cair.
   */
  const [falhaDeSaida, setFalhaDeSaida] = useState<string | null>(null);

  /**
   * FR-293 e FR-295: Sair encerra o Acesso **no servidor** antes de descartar a
   * Credencial. Se o armazenamento falha, o Acesso pode continuar valendo, e a
   * tela não apresenta o Sair como concluído (FR-044): a pessoa segue onde está,
   * com a falha anunciada, e pode tentar de novo.
   */
  const sair = useCallback(() => {
    protegerAcao(() => {
      setFalhaDeSaida(null);

      void clienteDaCredencial.sair().then((resultado) => {
        if (resultado.ok) {
          aoSair();
        } else {
          setFalhaDeSaida(resultado.mensagem);
        }
      });
    });
  }, [protegerAcao, clienteDaCredencial, aoSair]);

  /**
   * FR-291, SC-124: com o Acesso temporário, a pessoa ativa não pode perder o
   * Acesso no meio de uma Sessão de estudo só porque Revelar, Avaliar e digitar
   * não fazem requisição. A casca observa teclado, clique e toque, informa o
   * instante a `atividade.ts` e, quando ele manda, renova o Acesso — no máximo
   * uma vez a cada 60 s. A recusa vinda da renovação passa pela guarda e leva a
   * Entrar (FR-294).
   */
  useEffect(() => {
    if (!usaAcesso) {
      return;
    }

    let ultimaRenovacaoEm = Date.now();

    function aoInteragir(): void {
      const agora = Date.now();

      if (decidirRenovacao(agora, ultimaRenovacaoEm) === "renovar") {
        ultimaRenovacaoEm = agora;
        void cliente.renovarAcesso();
      }
    }

    const eventos = ["keydown", "click", "touchstart"] as const;

    for (const evento of eventos) {
      window.addEventListener(evento, aoInteragir, { capture: true, passive: true });
    }

    return () => {
      for (const evento of eventos) {
        window.removeEventListener(evento, aoInteragir, { capture: true });
      }
    };
  }, [usaAcesso, cliente]);

  // Layout effect, e não effect: a troca de rota desabilita ou remove o
  // controle que foi ativado, e mover o foco só depois da pintura deixa o foco
  // cair em <body> por um instante — quem observa o DOM logo após o commit
  // (leitor de tela, teste) vê o foco perdido. Rodando de forma síncrona ao
  // commit, o foco já está no título do destino antes de qualquer pintura, sem
  // foco transitório no <body> (WCAG 2.4.3, ordem de foco previsível). É o
  // mesmo padrão de foco pós-remoção usado em `PaginaDoBaralho.tsx`.
  useLayoutEffect(() => {
    // Na montagem o foco permanece onde o navegador o colocou; a partir da
    // primeira mudança de rota, ele passa ao título da tela de destino.
    if (rotaAnterior.current === rota) {
      return;
    }

    rotaAnterior.current = rota;

    const titulo = principal.current?.querySelector("h1");

    if (titulo instanceof HTMLElement) {
      // O título não é interativo por natureza; `tabIndex = -1` o torna
      // programaticamente focalizável sem acrescentá-lo à ordem de Tab.
      titulo.tabIndex = -1;
      titulo.focus();
    }
  }, [rota]);

  return (
    <>
      {temCredencial ? (
        // FR-139: com Credencial, a moldura traz a marca, a navegação principal
        // e "Sair" em toda tela alcançável.
        <Moldura rota={rota} aoSair={sair} />
      ) : (
        // FR-098: sem Credencial não há navegação nem "Sair" — só a marca.
        <header className="moldura">
          <span className="marca">memorization</span>
        </header>
      )}

      <main className="aplicacao" ref={principal}>
        {falhaDeSaida !== null && (
          // FR-044, FR-295: o Sair que não se concluiu é anunciado, e não
          // apresentado como feito.
          <p
            className="aviso aviso--erro"
            role="alert"
            aria-label="Falha ao Sair"
          >
            {falhaDeSaida}
          </p>
        )}

        <TelaDaRota
          rota={rota}
          cliente={cliente}
          clienteSemGuarda={clienteDaCredencial}
          nomeDeUsuario={nomeDeUsuarioDaCredencial}
          avisoDaEntrada={avisoDaEntrada}
          aoEntrar={aoEntrar}
          aoSubstituirCredencial={aoSubstituirCredencial}
          aoExcluirConta={excluirConta}
          aoIrParaEntrar={irParaEntrar}
          inicioDaAgenda={inicioDaAgenda}
          aoIniciarEstudoDaAgenda={iniciarEstudoDaAgenda}
          aoSairDoEstudoDaAgenda={sairDoEstudoDaAgenda}
          selecaoDoEstudoTemporario={selecaoDoEstudoTemporario}
          nomeDoBaralhoTemporario={nomeDoBaralhoTemporario}
          aoIniciarEstudoTemporario={iniciarEstudoTemporario}
          aoSairDoEstudoTemporario={sairDoEstudoTemporario}
        />
      </main>
    </>
  );
}

/**
 * A tela da rota exibida. O `switch` é exaustivo sobre `Rota`: o `default`
 * atribui a `never` para que uma rota nova, acrescentada em `navegacao.ts`,
 * deixe de compilar aqui até ganhar a sua tela. Enquanto as telas próprias das
 * rotas da `012` não existem, estas reutilizam as páginas atuais.
 */
function TelaDaRota({
  rota,
  cliente,
  clienteSemGuarda,
  nomeDeUsuario,
  avisoDaEntrada,
  aoEntrar,
  aoSubstituirCredencial,
  aoExcluirConta,
  aoIrParaEntrar,
  inicioDaAgenda,
  aoIniciarEstudoDaAgenda,
  aoSairDoEstudoDaAgenda,
  selecaoDoEstudoTemporario,
  nomeDoBaralhoTemporario,
  aoIniciarEstudoTemporario,
  aoSairDoEstudoTemporario,
}: {
  rota: Rota;
  cliente: ClienteDoAcervo;
  clienteSemGuarda: ClienteDoAcervo;
  nomeDeUsuario: string;
  avisoDaEntrada: AvisoDaEntrada | null;
  aoEntrar: (credencial: Credencial, escolha: EscolhaDeEntrada) => void;
  aoSubstituirCredencial: (nova: Credencial) => void;
  aoExcluirConta: () => void;
  aoIrParaEntrar: () => void;
  inicioDaAgenda: InicioDeCompromisso | null;
  aoIniciarEstudoDaAgenda: (inicio: InicioDeCompromisso) => void;
  aoSairDoEstudoDaAgenda: () => void;
  selecaoDoEstudoTemporario: readonly Cartao[] | null;
  nomeDoBaralhoTemporario: string;
  aoIniciarEstudoTemporario: (cartoes: readonly Cartao[], nomeDoBaralho: string) => void;
  aoSairDoEstudoTemporario: () => void;
}) {
  switch (rota.nome) {
    case "inicio":
      // FR-168: o Início é o destino de quem acabou de Entrar, e saúda o
      // Usuário que Entrou.
      return (
        <PaginaDeInicio
          cliente={cliente}
          nomeDeUsuario={nomeDeUsuario}
          aoIniciarEstudo={aoIniciarEstudoDaAgenda}
        />
      );

    case "central-de-estudo":
      // FR-312: a área Estudo reúne a Agenda semanal, as Estatísticas dos
      // últimos sete dias e as últimas Sessões; o início autorizado de um
      // Compromisso é o mesmo que o Início já entrega à casca (FR-231).
      return (
        <PaginaDaCentralDeEstudo
          cliente={cliente}
          aoIniciarEstudo={aoIniciarEstudoDaAgenda}
        />
      );

    case "agenda":
      // FR-237: Gerenciar agenda, alcançada pelo bloco da Agenda em Início.
      return <PaginaDaAgenda cliente={cliente} />;

    case "nova-rotina":
      // FR-242: Agendar estudo.
      return <PaginaDoFormularioDeRotina cliente={cliente} />;

    case "editar-rotina":
      return <PaginaDoFormularioDeRotina cliente={cliente} id={rota.id} />;

    case "estudo-da-agenda":
      // FR-231, FR-234: a Sessão autorizada só existe enquanto o início está na
      // memória da casca; recarregar a abandona e volta a Início.
      return inicioDaAgenda === null ? (
        <VoltarParaInicio />
      ) : (
        <PaginaDeEstudo
          cliente={cliente}
          id={inicioDaAgenda.baralhoId}
          inicioDaAgenda={inicioDaAgenda}
          aoSair={aoSairDoEstudoDaAgenda}
        />
      );

    case "registro":
      // FR-177: o Registro de uma Sessão concluída tem tela própria.
      return <PaginaDoRegistro cliente={cliente} id={rota.id} />;

    case "entrar":
      // A tela "Entrar" recebe o cliente **sem** a guarda: a recusa de Entrar
      // é dela, e a tela de destino já é esta.
      return (
        <PaginaDeEntrada
          cliente={clienteSemGuarda}
          aoEntrar={aoEntrar}
          aviso={avisoDaEntrada}
        />
      );

    case "cadastro":
      return <PaginaDeCadastro cliente={clienteSemGuarda} />;

    case "baralhos":
      return <PaginaDeBaralhos cliente={cliente} />;

    case "novo-baralho":
      // FR-140: a criação de Baralho ganha tela própria.
      return <PaginaDoFormularioDeBaralho cliente={cliente} />;

    case "baralho":
      return <PaginaDoBaralho cliente={cliente} id={rota.id} />;

    case "editar-baralho":
      // FR-141: a renomeação de Baralho ganha tela própria.
      return <PaginaDoFormularioDeBaralho cliente={cliente} id={rota.id} />;

    case "adicionar-cartoes":
      return <PaginaDeAdicionarCartoes cliente={cliente} id={rota.id} />;

    case "estudo":
      return <PaginaDeEstudo cliente={cliente} id={rota.id} />;

    case "selecao-temporaria":
      // FR-360: a montagem do baralho temporário.
      return (
        <PaginaDaSelecaoTemporaria
          cliente={cliente}
          aoEstudar={aoIniciarEstudoTemporario}
        />
      );

    case "estudo-temporario":
      // FR-366: a Sessão do baralho temporário só existe enquanto a seleção
      // capturada está na memória da casca; sem ela, a pessoa volta para
      // Baralhos.
      return selecaoDoEstudoTemporario === null ? (
        <VoltarParaBaralhos />
      ) : (
        <PaginaDeEstudo
          cliente={cliente}
          id=""
          selecaoTemporaria={selecaoDoEstudoTemporario}
          nomeDoBaralhoTemporario={nomeDoBaralhoTemporario}
          aoSair={aoSairDoEstudoTemporario}
        />
      );

    case "cartoes":
      return <PaginaDeCartoes cliente={cliente} />;

    case "novo-cartao":
      // FR-140: a criação de Cartão ganha tela própria.
      return <PaginaDoFormularioDeCartao cliente={cliente} />;

    case "editar-cartao":
      // FR-141: a edição de Cartão ganha tela própria.
      return <PaginaDoFormularioDeCartao cliente={cliente} id={rota.id} />;

    case "preferencias":
      // FR-212: as Preferências têm tela própria, alcançável pela Moldura.
      // FR-257: a seção «Minha conta» vive dentro das Preferências.
      return (
        <PaginaDePreferencias
          cliente={cliente}
          aoSubstituirCredencial={aoSubstituirCredencial}
          aoExcluirConta={aoExcluirConta}
          aoIrParaEntrar={aoIrParaEntrar}
        />
      );

    default: {
      // Inalcançável enquanto o `switch` cobrir todas as rotas: é a checagem
      // que obriga a tratar uma rota nova aqui.
      const exaustivo: never = rota;
      throw new Error(`Rota sem tela na casca: ${String(exaustivo)}`);
    }
  }
}

/**
 * A Sessão da Agenda sem início na memória — depois de recarregar — não tem o
 * que apresentar: a Sessão é abandonada, o Compromisso segue pendente e a
 * pessoa volta a Início (FR-234).
 */
function VoltarParaInicio() {
  useEffect(() => {
    window.location.replace("#/inicio");
  }, []);

  return <p className="carregando">Voltando para Início…</p>;
}

/**
 * A Sessão do baralho temporário sem seleção na memória — depois de
 * recarregar — não tem o que apresentar: nada é registrado e a pessoa volta
 * para Baralhos (FR-366).
 */
function VoltarParaBaralhos() {
  useEffect(() => {
    window.location.replace("#/baralhos");
  }, []);

  return <p className="carregando">Voltando para Baralhos…</p>;
}
