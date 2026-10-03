import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { ClienteDoAcervo, Credencial } from "../acervo-cliente/cliente";
import { comGuardaDeCredencial } from "./guarda-de-credencial";
import { Moldura } from "./Moldura";
import { ROTA_DE_ENTRADA, irParaRota } from "./navegacao";
import type { Rota } from "./navegacao";
import { PaginaDeAdicionarCartoes } from "./PaginaDeAdicionarCartoes";
import { PaginaDaRevisao } from "./PaginaDaRevisao";
import { PaginaDeBaralhos } from "./PaginaDeBaralhos";
import { PaginaDeCadastro } from "./PaginaDeCadastro";
import { PaginaDeCartoes } from "./PaginaDeCartoes";
import { MENSAGEM_DE_SAIDA, PaginaDeEntrada } from "./PaginaDeEntrada";
import type { AvisoDaEntrada } from "./PaginaDeEntrada";
import { PaginaDeEstudo } from "./PaginaDeEstudo";
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

interface PropriedadesDaAplicacao {
  /**
   * Produz o `ClienteDoAcervo` para uma Credencial, ou para `null` enquanto
   * ninguém tiver entrado. É uma fábrica, e não um cliente pronto, porque a
   * Credencial chega **na construção** do Adapter (FR-089): trocá-la — ao
   * Entrar, ao Sair ou ao descartá-la numa recusa — troca o cliente.
   */
  criarCliente: (credencial: Credencial | null) => ClienteDoAcervo;
}

export function Aplicacao({ criarCliente }: PropriedadesDaAplicacao) {
  const [credencial, setCredencial] = useState<Credencial | null>(null);
  const [avisoDaEntrada, setAvisoDaEntrada] = useState<AvisoDaEntrada | null>(
    null,
  );

  const temCredencial = credencial !== null;

  const clienteDaCredencial = useMemo(
    () => criarCliente(credencial),
    [criarCliente, credencial],
  );

  const entrar = useCallback((credencialInformada: Credencial) => {
    setAvisoDaEntrada(null);
    setCredencial(credencialInformada);
  }, []);

  /**
   * FR-094 e SC-034: Sair descarta a Credencial e volta a "Entrar" — o mesmo
   * destino do voltar do navegador, que reencontra a tela "Entrar" porque a
   * Credencial não sobreviveu em lugar nenhum.
   */
  const descartarPorSaida = useCallback(() => {
    setCredencial(null);
    setAvisoDaEntrada({ tipo: "saida", texto: MENSAGEM_DE_SAIDA });
    irParaRota(ROTA_DE_ENTRADA);
  }, []);

  /**
   * FR-091 e SC-035: recebida a recusa por Credencial, ela é descartada, a tela
   * "Entrar" volta com a mensagem que explica a recusa e nada aparece como
   * concluído — a operação recusada continua não concluída nas telas, que saem
   * de cena com ela.
   */
  const descartarPorRecusa = useCallback((mensagem: string) => {
    setCredencial(null);
    setAvisoDaEntrada({ tipo: "falha", texto: mensagem });
    irParaRota(ROTA_DE_ENTRADA);
  }, []);

  return (
    // A casca externa é dona da Credencial; a interna vive sob a proteção de
    // saída e é quem decide moldura, tela e guarda do cliente.
    <ProvedorDeProtecaoDeSaida temCredencial={temCredencial}>
      <CascaDaAplicacao
        temCredencial={temCredencial}
        nomeDeUsuarioDaCredencial={credencial?.nomeDeUsuario ?? ""}
        clienteDaCredencial={clienteDaCredencial}
        avisoDaEntrada={avisoDaEntrada}
        aoEntrar={entrar}
        aoSair={descartarPorSaida}
        aoRecusar={descartarPorRecusa}
      />
    </ProvedorDeProtecaoDeSaida>
  );
}

/** O que a casca interna recebe da casca externa, dona da Credencial. */
interface PropriedadesDaCasca {
  temCredencial: boolean;
  /** O Nome de usuário da Credencial corrente, para a saudação do Início. */
  nomeDeUsuarioDaCredencial: string;
  clienteDaCredencial: ClienteDoAcervo;
  avisoDaEntrada: AvisoDaEntrada | null;
  aoEntrar: (credencial: Credencial) => void;
  aoSair: () => void;
  aoRecusar: (mensagem: string) => void;
}

/**
 * A parte da casca que vive **sob** a proteção de saída (FR-148, FR-151,
 * FR-154): lê a rota exibida e passa cada troca de tela pela política de saída.
 * A Credencial continua na casca externa; aqui ela só decide a moldura, a tela
 * e a guarda do cliente.
 */
function CascaDaAplicacao({
  temCredencial,
  nomeDeUsuarioDaCredencial,
  clienteDaCredencial,
  avisoDaEntrada,
  aoEntrar,
  aoSair,
  aoRecusar,
}: PropriedadesDaCasca) {
  const rota = useRotaExibida();
  const protegerAcao = useAcaoProtegida();
  const descartarProtecao = useDescartarProtecao();

  const principal = useRef<HTMLElement>(null);
  const rotaAnterior = useRef(rota);

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
   * FR-151: Sair passa pela proteção de saída — com alterações não salvas ou
   * uma operação em andamento, a confirmação (ou o aviso) vem antes de a
   * Credencial cair.
   */
  const sair = useCallback(() => {
    protegerAcao(aoSair);
  }, [protegerAcao, aoSair]);

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
        <TelaDaRota
          rota={rota}
          cliente={cliente}
          clienteSemGuarda={clienteDaCredencial}
          nomeDeUsuario={nomeDeUsuarioDaCredencial}
          avisoDaEntrada={avisoDaEntrada}
          aoEntrar={aoEntrar}
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
}: {
  rota: Rota;
  cliente: ClienteDoAcervo;
  clienteSemGuarda: ClienteDoAcervo;
  nomeDeUsuario: string;
  avisoDaEntrada: AvisoDaEntrada | null;
  aoEntrar: (credencial: Credencial) => void;
}) {
  switch (rota.nome) {
    case "inicio":
      // FR-168: o Início é o destino de quem acabou de Entrar, e saúda o
      // Usuário que Entrou.
      return (
        <PaginaDeInicio cliente={cliente} nomeDeUsuario={nomeDeUsuario} />
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

    case "cartoes":
      return <PaginaDeCartoes cliente={cliente} />;

    case "novo-cartao":
      // FR-140: a criação de Cartão ganha tela própria.
      return <PaginaDoFormularioDeCartao cliente={cliente} />;

    case "editar-cartao":
      // FR-141: a edição de Cartão ganha tela própria.
      return <PaginaDoFormularioDeCartao cliente={cliente} id={rota.id} />;

    case "revisao":
      // FR-198: a Revisão do dia é lançada de Início e tem tela própria; por
      // isso `destinoAtivo` a marca como pertencente ao Início (§7).
      return <PaginaDaRevisao cliente={cliente} />;

    case "preferencias":
      // FR-212: as Preferências têm tela própria, alcançável pela Moldura.
      return <PaginaDePreferencias cliente={cliente} />;

    default: {
      // Inalcançável enquanto o `switch` cobrir todas as rotas: é a checagem
      // que obriga a tratar uma rota nova aqui.
      const exaustivo: never = rota;
      throw new Error(`Rota sem tela na casca: ${String(exaustivo)}`);
    }
  }
}
