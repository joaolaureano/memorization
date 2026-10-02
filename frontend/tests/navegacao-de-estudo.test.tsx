import { act } from "react";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { Aplicacao } from "../src/ui/Aplicacao";
import { interpretarRota } from "../src/ui/navegacao";
import { CREDENCIAL_DE_PROVA, clienteDeProva } from "./apoio-de-prova";

/**
 * Navegação da Sessão de estudo (T304; specs/004-sessao-de-estudo/tasks.md).
 *
 * A rota `#/baralhos/<id>/estudo` é reconhecida por `interpretarRota` e
 * renderiza `PaginaDeEstudo` na casca da aplicação. O link Baralhos permanece
 * marcado como corrente, porque a Sessão pertence ao Baralho.
 *
 * A casca em uso (`Aplicacao`) é a que registra a proteção de saída: navegar
 * para fora no meio de uma Sessão passa pelo `ProvedorDeProtecaoDeSaida` e
 * pergunta antes de descartar o progresso (T1114, FR-151).
 *
 * T711 (specs/008-entrar/tasks.md): a prova entra antes de operar o acervo — a
 * casca nasce sem Credencial (FR-089) — e as asserções de navegação continuam
 * exatamente as mesmas.
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
    expect(interpretarRota("#/baralhos/b1/estudo", true)).toEqual({
      nome: "estudo",
      id: "b1",
    });
    expect(interpretarRota("#/baralhos/b1/estudo/", true)).toEqual({
      nome: "estudo",
      id: "b1",
    });
  });

  it("não confunde a rota de estudo com a de detalhe do Baralho", () => {
    expect(interpretarRota("#/baralhos/b1", true)).toEqual({
      nome: "baralho",
      id: "b1",
    });
    // Um caminho mais fundo do que os publicados resolve na rota padrão,
    // Início (FR-168).
    expect(interpretarRota("#/baralhos/b1/estudo/extra", true)).toEqual({
      nome: "inicio",
    });
  });
});

describe("Aplicacao — rota de estudo", () => {
  it("renderiza a tela de estudo e mantém Baralhos como link corrente", async () => {
    const cliente = clienteDeProva();
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
    render(
      <Aplicacao
        criarCliente={(credencial) => cliente.comoUsuario(credencial)}
      />,
    );

    // A casca nasce sem Credencial: a Sessão de estudo só aparece depois de
    // Entrar, pela tela "Entrar" (FR-097).
    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: CREDENCIAL_DE_PROVA.senha },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

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

  it("navegar para fora no meio da Sessão pede confirmação; Cancelar mantém o mesmo Item", async () => {
    const cliente = clienteDeProva();
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
    render(
      <Aplicacao
        criarCliente={(credencial) => cliente.comoUsuario(credencial)}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: CREDENCIAL_DE_PROVA.senha },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    fireEvent.change(screen.getByLabelText("Quantidade de Cartões"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Sessão" }));

    await screen.findByText("Item 1 de 1");

    // Navegar para fora durante a Sessão dispara a confirmação de descarte.
    navegarPara("#/baralhos");

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("Interromper a Sessão?");
    expect(
      within(dialogo).getByRole("button", { name: "Interromper" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Cancelar" }),
    );

    expect(screen.getByText("Item 1 de 1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Revelar verso" }),
    ).toBeInTheDocument();
  });

  it("confirmar a interrupção volta ao Baralho sem Resumo (FR-151)", async () => {
    const cliente = clienteDeProva();
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
    render(
      <Aplicacao
        criarCliente={(credencial) => cliente.comoUsuario(credencial)}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: CREDENCIAL_DE_PROVA.senha },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    fireEvent.change(screen.getByLabelText("Quantidade de Cartões"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Sessão" }));

    await screen.findByText("Item 1 de 1");

    fireEvent.click(screen.getByRole("button", { name: "Interromper" }));

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("Interromper a Sessão?");

    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Interromper" }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Inglês" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Resumo da Sessão" }),
    ).not.toBeInTheDocument();
  });

  it("alterar a quantidade e navegar para fora pede confirmação de descarte", async () => {
    const cliente = clienteDeProva();
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
    render(
      <Aplicacao
        criarCliente={(credencial) => cliente.comoUsuario(credencial)}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: CREDENCIAL_DE_PROVA.senha },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    fireEvent.change(screen.getByLabelText("Quantidade de Cartões"), {
      target: { value: "1" },
    });

    navegarPara("#/baralhos");

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("Descartar a configuração?");
  });
});
