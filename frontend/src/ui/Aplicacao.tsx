import { useEffect, useRef } from "react";

import type { ClienteDoAcervo } from "../acervo-cliente/cliente";
import { useRota } from "./navegacao";
import { PaginaDeBaralhos } from "./PaginaDeBaralhos";
import { PaginaDeCartoes } from "./PaginaDeCartoes";
import { PaginaDoBaralho } from "./PaginaDoBaralho";

/**
 * Casca da aplicação e navegação principal.
 *
 * A navegação é por hash (`#/cartoes` e `#/baralhos`), sem dependência de
 * roteador. O link da rota corrente recebe `aria-current="page"`, e o `<main>`
 * renderiza a tela correspondente. Numa mudança de rota, o foco é movido para
 * o título da tela — o destino que usuários de teclado e leitor de tela
 * esperam depois de ativar um link de navegação.
 */

interface PropriedadesDaAplicacao {
  cliente: ClienteDoAcervo;
}

export function Aplicacao({ cliente }: PropriedadesDaAplicacao) {
  const rota = useRota();
  const principal = useRef<HTMLElement>(null);
  const rotaAnterior = useRef(rota);

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
            rota.nome === "baralhos" || rota.nome === "baralho"
              ? "page"
              : undefined
          }
        >
          Baralhos
        </a>
      </nav>

      <main className="aplicacao" ref={principal}>
        {rota.nome === "baralhos" ? (
          <PaginaDeBaralhos cliente={cliente} />
        ) : rota.nome === "baralho" ? (
          <PaginaDoBaralho cliente={cliente} id={rota.id} />
        ) : (
          <PaginaDeCartoes cliente={cliente} />
        )}
      </main>
    </>
  );
}
