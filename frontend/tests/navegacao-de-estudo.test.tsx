import { act } from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { Aplicacao } from "../src/ui/Aplicacao";
import { interpretarRota } from "../src/ui/navegacao";

/**
 * Navegação da Sessão de estudo (T304; specs/004-sessao-de-estudo/tasks.md).
 *
 * A rota `#/baralhos/<id>/estudo` é reconhecida por `interpretarRota` e
 * renderiza `PaginaDeEstudo` na casca da aplicação. O link Baralhos permanece
 * marcado como corrente, porque a Sessão pertence ao Baralho.
 */

beforeEach(() => {
  window.location.hash = "#/cartoes";
});

/** Muda o hash e entrega o `hashchange` que o navegador dispararia. */
function navegarPara(hash: string): void {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new Event("hashchange"));
  });
}

describe("interpretarRota para Sessão de estudo", () => {
  it("reconhece a rota de estudo do Baralho, inclusive com barra final", () => {
    expect(interpretarRota("#/baralhos/b1/estudo")).toEqual({
      nome: "estudo",
      id: "b1",
    });
    expect(interpretarRota("#/baralhos/b1/estudo/")).toEqual({
      nome: "estudo",
      id: "b1",
    });
  });

  it("não confunde a rota de estudo com a de detalhe do Baralho", () => {
    expect(interpretarRota("#/baralhos/b1")).toEqual({
      nome: "baralho",
      id: "b1",
    });
    expect(interpretarRota("#/baralhos/b1/estudo/extra")).toEqual({
      nome: "cartoes",
    });
  });
});

describe("Aplicacao — rota de estudo", () => {
  it("renderiza a tela de estudo e mantém Baralhos como link corrente", async () => {
    const cliente = new ClienteEmMemoria();
    const cartao = await cliente.criarCartao({
      frente: "To walk",
      verso: "Caminhar",
    });
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!cartao.ok || !baralho.ok) {
      throw new Error("as criações do cenário deveriam ser aceitas");
    }

    await cliente.vincular(cartao.cartao.id, baralho.baralho.id);

    navegarPara(`#/baralhos/${baralho.baralho.id}/estudo`);
    render(<Aplicacao cliente={cliente} />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Estudar Inglês",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Baralhos" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Cartões" }),
    ).not.toHaveAttribute("aria-current");
  });
});
