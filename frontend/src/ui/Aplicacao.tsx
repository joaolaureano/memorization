import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ClienteDoAcervo, Credencial } from "../acervo-cliente/cliente";
import { comGuardaDeCredencial } from "./guarda-de-credencial";
import { ROTA_DE_ENTRADA, irParaRota, useRota } from "./navegacao";
import { PaginaDeBaralhos } from "./PaginaDeBaralhos";
import { PaginaDeCadastro } from "./PaginaDeCadastro";
import { PaginaDeCartoes } from "./PaginaDeCartoes";
import { MENSAGEM_DE_SAIDA, PaginaDeEntrada } from "./PaginaDeEntrada";
import type { AvisoDaEntrada } from "./PaginaDeEntrada";
import { PaginaDeEstudo } from "./PaginaDeEstudo";
import { PaginaDoBaralho } from "./PaginaDoBaralho";

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
 * resolve em Cartões (FR-098).
 *
 * Sem Credencial não há navegação principal nem "Sair" (FR-098): ambos
 * aparecem em toda tela alcançável depois de Entrar, com `aria-current="page"`
 * no link da rota corrente e "Sair" como ação de teclado que descarta a
 * Credencial e volta a "Entrar" (FR-094). Numa mudança de rota, o foco é movido
 * para o título da tela — o destino que usuários de teclado e leitor de tela
 * esperam depois de ativar um link de navegação.
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
  const rota = useRota(temCredencial);
  const principal = useRef<HTMLElement>(null);
  const rotaAnterior = useRef(rota);

  const clienteDaCredencial = useMemo(
    () => criarCliente(credencial),
    [criarCliente, credencial],
  );

  /**
   * FR-091 e SC-035: recebida a recusa por Credencial, ela é descartada, a tela
   * "Entrar" volta com a mensagem que explica a recusa e nada aparece como
   * concluído — a operação recusada continua não concluída nas telas, que saem
   * de cena com ela.
   */
  const recusarCredencial = useCallback((mensagem: string) => {
    setCredencial(null);
    setAvisoDaEntrada({ tipo: "falha", texto: mensagem });
    irParaRota(ROTA_DE_ENTRADA);
  }, []);

  /**
   * O cliente que as telas do acervo recebem: o da Credencial corrente, com a
   * guarda que descarta a Credencial quando ela é recusada.
   */
  const cliente = useMemo(
    () => comGuardaDeCredencial(clienteDaCredencial, recusarCredencial),
    [clienteDaCredencial, recusarCredencial],
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
  const sair = useCallback(() => {
    setCredencial(null);
    setAvisoDaEntrada({ tipo: "saida", texto: MENSAGEM_DE_SAIDA });
    irParaRota(ROTA_DE_ENTRADA);
  }, []);

  useEffect(() => {
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
      {temCredencial && (
        // FR-098: a navegação principal para Cartões e Baralhos e o acesso a
        // "Sair" aparecem somente depois de Entrar, em toda tela alcançável
        // (FR-094). O link "Criar conta" que a `007` oferecia aqui passou para
        // a tela "Entrar".
        <nav aria-label="Principal" className="navegacao-principal">
          <a
            href="#/cartoes"
            aria-current={rota.nome === "cartoes" ? "page" : undefined}
          >
            Cartões
          </a>
          <a
            href="#/baralhos"
            aria-current={
              rota.nome === "baralhos" ||
              rota.nome === "baralho" ||
              rota.nome === "estudo"
                ? "page"
                : undefined
            }
          >
            Baralhos
          </a>
          <button className="botao-de-saida" type="button" onClick={sair}>
            Sair
          </button>
        </nav>
      )}

      <main className="aplicacao" ref={principal}>
        {rota.nome === "entrar" ? (
          // A tela "Entrar" recebe o cliente **sem** a guarda: a recusa de
          // Entrar é dela, e a tela de destino já é esta.
          <PaginaDeEntrada
            cliente={clienteDaCredencial}
            aoEntrar={entrar}
            aviso={avisoDaEntrada}
          />
        ) : rota.nome === "cadastro" ? (
          <PaginaDeCadastro cliente={clienteDaCredencial} />
        ) : rota.nome === "baralhos" ? (
          <PaginaDeBaralhos cliente={cliente} />
        ) : rota.nome === "baralho" ? (
          <PaginaDoBaralho cliente={cliente} id={rota.id} />
        ) : rota.nome === "estudo" ? (
          <PaginaDeEstudo cliente={cliente} id={rota.id} />
        ) : (
          <PaginaDeCartoes cliente={cliente} />
        )}
      </main>
    </>
  );
}
