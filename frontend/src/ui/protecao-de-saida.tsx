import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { DialogoDeConfirmacao } from "./DialogoDeConfirmacao";
import { interpretarRota } from "./navegacao";
import type { Rota } from "./navegacao";

/**
 * Proteção de saída da interface
 * (specs/012-interface-visual-navegavel/research.md §R4).
 *
 * Navegar por link ou pelo botão Voltar do navegador muda o hash *antes* de a
 * interface reagir. Quando há trabalho a perder — um formulário editado
 * (FR-148, FR-151) ou uma operação em andamento (FR-154) —, a rota exibida
 * precisa ficar parada e o hash anterior precisa voltar ao lugar. Este Module
 * concentra essa política em um só lugar: as páginas apenas declaram o estado
 * de proteção, e o resto da interface só conhece a rota de fato exibida.
 *
 * O provedor é dono da rota exibida e da proteção vigente:
 * - guarda o hash aceito em um `ref` e o hash exibido em estado;
 * - escuta `hashchange`; sem proteção, aceita a navegação;
 * - com proteção, restaura a URL anterior por `history.replaceState` (que não
 *   dispara um novo `hashchange`) e mantém a rota exibida;
 * - para descarte, abre o `DialogoDeConfirmacao` já existente;
 * - para pendência, anuncia o motivo em uma região viva e não abre diálogo.
 *
 * A proteção mora em um `ref` porque precisa valer *sincronamente*: quem lê o
 * `hashchange` é o mesmo componente que escreve a proteção, e o valor do render
 * corrente é sempre o que está valendo quando o evento chega.
 *
 * Cada página que usa `useProtecaoDeSaida` limpa, ao desmontar, *apenas* a
 * proteção que ela própria registrou (por identidade). Isso evita a corrida em
 * que uma página sai de cena e outra registra a sua no mesmo commit: a limpeza
 * da primeira não pode apagar a proteção da segunda.
 *
 * Sair e Entrar são decisões explícitas (FR-094, FR-097): quando
 * `temCredencial` muda, a rota exibida é recalculada sem consultar a proteção.
 * Uma recusa de Credencial (FR-157) sempre vence — quem recusa a Credencial
 * limpa a proteção com `useDescartarProtecao` antes de mandar a interface para
 * Entrar.
 */

/**
 * A proteção de saída vigente. É uma união discriminada por `tipo`:
 * - `descarte`: há alterações não salvas a perder; a navegação passa pela
 *   confirmação (FR-148, FR-151);
 * - `pendencia`: há uma operação em andamento; a navegação é bloqueada e o
 *   motivo é anunciado, sem diálogo (FR-154).
 */
export type Protecao =
  | {
      tipo: "descarte";
      titulo: string;
      descricao: string;
      rotuloDeConfirmacao: string;
    }
  | { tipo: "pendencia"; motivo: string };

/** Conteúdo do diálogo de descarte em exibição e o que fazer ao confirmar. */
interface ConfirmacaoPendente {
  titulo: string;
  descricao: string;
  rotuloDeConfirmacao: string;
  aoConfirmar: () => void;
}

/**
 * O anúncio de pendência em exibição. O `n` conta os anúncios: o mesmo motivo
 * repetido precisa ser reanunciado (FR-154), então o texto da região viva é
 * reproduzido com uma `key` que muda a cada anúncio.
 */
interface AnuncioDePendencia {
  motivo: string;
  n: number;
}

/** O que os hooks consomem do provedor. */
interface ContextoDaProtecaoDeSaida {
  rotaExibida: Rota;
  definirProtecao: (protecao: Protecao | null) => Protecao | null;
  protegerAcao: (acao: () => void) => void;
  descartarProtecao: () => void;
  descartarProtecaoSeIgual: (protecao: Protecao | null) => void;
  navegarSemProtecao: (hash: string) => void;
}

const ContextoDaProtecaoDeSaida =
  createContext<ContextoDaProtecaoDeSaida | null>(null);

const MENSAGEM_FORA_DO_PROVEDOR =
  "Os hooks de proteção de saída só podem ser usados sob ProvedorDeProtecaoDeSaida.";

/**
 * Provedor da rota exibida e da proteção de saída. Envolve a aplicação e
 * substitui o `useRota` comum dos consumidores por `useRotaExibida`.
 */
export function ProvedorDeProtecaoDeSaida({
  temCredencial,
  children,
}: {
  temCredencial: boolean;
  children: ReactNode;
}) {
  const [hashExibido, setHashExibido] = useState(() => window.location.hash);
  const hashAceito = useRef(window.location.hash);
  const protecaoAtiva = useRef<Protecao | null>(null);
  // Destino de uma navegação já autorizada por `navegarSemProtecao`. Enquanto
  // não for `null`, a proteção não pode ser reescrita por um render
  // intermediário: o `hashchange` autorizado ainda está a caminho.
  const navegacaoLiberada = useRef<string | null>(null);

  const [confirmacao, setConfirmacao] = useState<ConfirmacaoPendente | null>(
    null,
  );
  const [anuncioDePendencia, setAnuncioDePendencia] =
    useState<AnuncioDePendencia | null>(null);

  // A rota exibida é derivada a cada render: trocar `temCredencial` (Entrar,
  // Sair, FR-094/FR-097) recalcula a tela sem passar pela proteção.
  const rotaExibida = interpretarRota(hashExibido, temCredencial);

  const aceitarHash = useCallback((hash: string) => {
    hashAceito.current = hash;
    setHashExibido(hash);
  }, []);

  const restaurarUrl = useCallback(() => {
    const destino = hashAceito.current || window.location.pathname;
    // `replaceState` não dispara `hashchange`: a tela continua onde está.
    window.history.replaceState(null, "", destino);
  }, []);

  /**
   * Escreve a proteção vigente e devolve o objeto que ficou de fato
   * armazenado. Uma proteção igual não substitui o objeto corrente: quem
   * escreveu precisa saber *qual* objeto está lá para poder limpar só ele
   * depois.
   */
  const definirProtecao = useCallback(
    (protecao: Protecao | null): Protecao | null => {
      // Com uma navegação liberada a caminho, o render de uma página que está
      // saindo (por exemplo, com `salvando === true`) não pode reescrever a
      // proteção: o `hashchange` autorizado já vem e precisa ser aceito.
      if (navegacaoLiberada.current !== null) {
        return null;
      }

      if (!mesmaProtecao(protecaoAtiva.current, protecao)) {
        protecaoAtiva.current = protecao;
      }

      return protecaoAtiva.current;
    },
    [],
  );

  const descartarProtecao = useCallback(() => {
    protecaoAtiva.current = null;
  }, []);

  /**
   * Limpa a proteção só se ela ainda for o objeto indicado. É o que a limpeza
   * de `useProtecaoDeSaida` usa: se outra página já registrou a proteção dela
   * no mesmo commit, a vigente é outra e não pode ser apagada por engano.
   */
  const descartarProtecaoSeIgual = useCallback((protecao: Protecao | null) => {
    if (protecaoAtiva.current === protecao) {
      protecaoAtiva.current = null;
    }
  }, []);

  /**
   * Libera a navegação para `hash` de forma determinística (FR-157, FR-251):
   * derruba a proteção vigente, marca o destino como autorizado e só então
   * muda a URL. Enquanto a marca estiver de pé, `definirProtecao` não grava
   * nada — um render intermediário entre o pedido e o `hashchange` (o de uma
   * página que ainda tem `salvando === true`, por exemplo) não pode reescrever
   * a proteção nem fazer o ouvinte restaurar a URL anterior.
   */
  const navegarSemProtecao = useCallback((hash: string) => {
    protecaoAtiva.current = null;

    // Se o hash exibido já é o pedido, nenhum `hashchange` virá: nada a liberar.
    if (window.location.hash === hash) {
      return;
    }

    navegacaoLiberada.current = hash;
    window.location.hash = hash;
  }, []);

  const anunciarPendencia = useCallback((motivo: string) => {
    setAnuncioDePendencia((atual) => ({
      motivo,
      n: atual === null ? 0 : atual.n + 1,
    }));
  }, []);

  const abrirDescarte = useCallback(
    (
      protecao: Extract<Protecao, { tipo: "descarte" }>,
      aoConfirmar: () => void,
    ) => {
      setAnuncioDePendencia(null);
      setConfirmacao({
        titulo: protecao.titulo,
        descricao: protecao.descricao,
        rotuloDeConfirmacao: protecao.rotuloDeConfirmacao,
        aoConfirmar,
      });
    },
    [],
  );

  const protegerAcao = useCallback(
    (acao: () => void) => {
      const protecao = protecaoAtiva.current;

      if (protecao === null) {
        acao();
        return;
      }

      if (protecao.tipo === "pendencia") {
        anunciarPendencia(protecao.motivo);
        return;
      }

      abrirDescarte(protecao, () => {
        protecaoAtiva.current = null;
        acao();
      });
    },
    [abrirDescarte, anunciarPendencia],
  );

  useEffect(() => {
    const aoMudarHash = (): void => {
      const hashPedido = window.location.hash;

      // A navegação autorizada por `navegarSemProtecao` chega como o
      // `hashchange` que ela mesma provocou. É aceita sem consultar a proteção
      // (que pode ter sido reescrita por um render intermediário) e encerra a
      // liberação.
      if (
        navegacaoLiberada.current !== null &&
        hashPedido === navegacaoLiberada.current
      ) {
        navegacaoLiberada.current = null;
        aceitarHash(hashPedido);
        return;
      }

      // Um destino diferente chegou com uma liberação de pé: a navegação
      // autorizada não se concretizou e a política normal volta a valer.
      if (navegacaoLiberada.current !== null) {
        navegacaoLiberada.current = null;
      }

      // O mesmo hash aceito pode chegar de volta quando a URL é restaurada; se
      // já é o aceito, não há navegação nova a tratar.
      if (hashPedido === hashAceito.current) {
        return;
      }

      const protecao = protecaoAtiva.current;

      if (protecao === null) {
        aceitarHash(hashPedido);
        return;
      }

      restaurarUrl();

      if (protecao.tipo === "descarte") {
        abrirDescarte(protecao, () => {
          // Confirmado o descarte, a proteção cai e a navegação pedida vale.
          protecaoAtiva.current = null;
          aceitarHash(hashPedido);
          window.location.hash = hashPedido;
        });
      } else {
        anunciarPendencia(protecao.motivo);
      }
    };

    window.addEventListener("hashchange", aoMudarHash);

    return () => {
      window.removeEventListener("hashchange", aoMudarHash);
    };
  }, [aceitarHash, restaurarUrl, abrirDescarte, anunciarPendencia]);

  const contexto: ContextoDaProtecaoDeSaida = {
    rotaExibida,
    definirProtecao,
    protegerAcao,
    descartarProtecao,
    descartarProtecaoSeIgual,
    navegarSemProtecao,
  };

  return (
    <ContextoDaProtecaoDeSaida.Provider value={contexto}>
      {children}
      <p role="status" className="visualmente-oculto">
        {anuncioDePendencia !== null && (
          // A `key` muda a cada anúncio: o mesmo motivo repetido re-renderiza
          // um nó novo e volta a ser anunciado pela região viva.
          <span key={anuncioDePendencia.n}>{anuncioDePendencia.motivo}</span>
        )}
      </p>
      {confirmacao !== null && (
        <DialogoDeConfirmacao
          aberto
          titulo={confirmacao.titulo}
          rotuloDeConfirmacao={confirmacao.rotuloDeConfirmacao}
          aoConfirmar={() => {
            const pendente = confirmacao;
            setConfirmacao(null);
            pendente.aoConfirmar();
          }}
          aoCancelar={() => setConfirmacao(null)}
        >
          {confirmacao.descricao}
        </DialogoDeConfirmacao>
      )}
    </ContextoDaProtecaoDeSaida.Provider>
  );
}

/**
 * A rota de fato exibida. Difere de `useRota` quando há proteção ativa: a URL
 * pode já ter mudado sem que a tela acompanhe.
 */
export function useRotaExibida(): Rota {
  return usarContexto().rotaExibida;
}

/**
 * Registra a proteção vigente enquanto a página está montada. Passe `null`
 * quando não houver nada a perder. A proteção é escrita de forma síncrona no
 * render corrente (só muda quando o valor muda) e guarda-se *qual* objeto
 * ficou armazenado, para que a limpeza ao desmontar apague só essa proteção —
 * nunca a de outra página que tenha registrado a sua no mesmo commit.
 */
export function useProtecaoDeSaida(protecao: Protecao | null): void {
  const { definirProtecao, descartarProtecaoSeIgual } = usarContexto();
  const protecaoRegistrada = useRef<Protecao | null>(null);

  // Escreve a proteção do render corrente e lembra o objeto de fato vigente:
  // uma proteção igual não substitui o objeto armazenado, e é esse objeto que
  // a limpeza precisa reconhecer.
  protecaoRegistrada.current = definirProtecao(protecao);

  useEffect(() => {
    return () => {
      descartarProtecaoSeIgual(protecaoRegistrada.current);
    };
  }, [descartarProtecaoSeIgual]);
}

/**
 * Envolve uma ação que muda de tela (por exemplo, o botão Sair): sem proteção,
 * roda agora; com descarte, passa pela mesma confirmação; com pendência, apenas
 * anuncia o motivo e não roda.
 */
export function useAcaoProtegida(): (acao: () => void) => void {
  return usarContexto().protegerAcao;
}

/**
 * Limpa a proteção de imediato, sem esperar o próximo render. É o que uma
 * página faz depois de salvar em segurança e o que a recusa de Credencial usa
 * antes de ir para Entrar (FR-157), pois essa navegação sempre vence.
 */
export function useDescartarProtecao(): () => void {
  return usarContexto().descartarProtecao;
}

/**
 * Libera a navegação para `hash` sem passar pela proteção (FR-157, FR-251):
 * é o que uma página usa no caminho de sucesso, depois de deixar o trabalho
 * pronto e antes de mudar de tela. Diferente de `useDescartarProtecao`, que só
 * limpa a proteção, a liberação aqui é determinística — um render intermediário
 * entre o pedido e o `hashchange` (o de uma página que ainda tem
 * `salvando === true`, por exemplo) não pode reescrever a proteção nem fazer o
 * ouvinte restaurar a URL anterior. Use `useDescartarProtecao` quando não
 * houver navegação a fazer.
 */
export function useNavegarSemProtecao(): (hash: string) => void {
  return usarContexto().navegarSemProtecao;
}

function usarContexto(): ContextoDaProtecaoDeSaida {
  const contexto = useContext(ContextoDaProtecaoDeSaida);

  if (contexto === null) {
    throw new Error(MENSAGEM_FORA_DO_PROVEDOR);
  }

  return contexto;
}

/**
 * Igualdade das proteções por conteúdo, para só reescrever o `ref` quando o
 * valor realmente muda. As páginas costumam montar o objeto a cada render; sem
 * isso, o `ref` seria reescrito sem necessidade.
 */
function mesmaProtecao(a: Protecao | null, b: Protecao | null): boolean {
  if (a === b) {
    return true;
  }

  if (a === null || b === null) {
    return false;
  }

  if (a.tipo === "descarte" && b.tipo === "descarte") {
    return (
      a.titulo === b.titulo &&
      a.descricao === b.descricao &&
      a.rotuloDeConfirmacao === b.rotuloDeConfirmacao
    );
  }

  if (a.tipo === "pendencia" && b.tipo === "pendencia") {
    return a.motivo === b.motivo;
  }

  return false;
}
