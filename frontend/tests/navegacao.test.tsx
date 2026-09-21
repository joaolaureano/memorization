import { act } from "react";

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { Aplicacao } from "../src/ui/Aplicacao";
import { ROTA_PADRAO, interpretarRota } from "../src/ui/navegacao";

/**
 * Casca de aplicação e navegação por hash.
 *
 * A navegação principal expõe os dois destinos em `<nav aria-label="Principal">`,
 * marca o link corrente com `aria-current="page"` e renderiza a tela da rota
 * corrente num único `<main>`. Numa mudança de rota, o foco é movido para o
 * título da tela de destino — o título ganha `tabindex="-1"` para ser
 * focalizável sem entrar na ordem de Tab.
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

describe("interpretarRota", () => {
  it("usa Cartões como rota padrão para hash vazio e rotas desconhecidas", () => {
    expect(ROTA_PADRAO).toBe("#/cartoes");
    expect(interpretarRota("")).toEqual({ nome: "cartoes" });
    expect(interpretarRota("#/")).toEqual({ nome: "cartoes" });
    expect(interpretarRota("#/inexistente")).toEqual({ nome: "cartoes" });
  });

  it("reconhece as rotas de Cartões e de Baralhos, inclusive com barra final", () => {
    expect(interpretarRota("#/cartoes")).toEqual({ nome: "cartoes" });
    expect(interpretarRota("#/cartoes/")).toEqual({ nome: "cartoes" });
    expect(interpretarRota("#/baralhos")).toEqual({ nome: "baralhos" });
    expect(interpretarRota("#/baralhos/")).toEqual({ nome: "baralhos" });
  });

  it("reconhece a rota de detalhe do Baralho", () => {
    expect(interpretarRota("#/baralhos/b1")).toEqual({
      nome: "baralho",
      id: "b1",
    });
    expect(interpretarRota("#/baralhos/b1/")).toEqual({
      nome: "baralho",
      id: "b1",
    });
  });

  it("reconhece a rota da tela Criar conta", () => {
    expect(interpretarRota("#/criar-conta")).toEqual({ nome: "cadastro" });
    expect(interpretarRota("#/criar-conta/")).toEqual({ nome: "cadastro" });
  });
});

describe("Aplicacao — navegação", () => {
  it("renderiza a navegação principal com a rota padrão Cartões", async () => {
    render(<Aplicacao cliente={new ClienteEmMemoria()} />);

    const navegacao = screen.getByRole("navigation", { name: "Principal" });

    const linkDeCartoes = within(navegacao).getByRole("link", {
      name: "Cartões",
    });
    const linkDeBaralhos = within(navegacao).getByRole("link", {
      name: "Baralhos",
    });
    const linkDeCadastro = within(navegacao).getByRole("link", {
      name: "Criar conta",
    });

    expect(linkDeCartoes).toHaveAttribute("href", "#/cartoes");
    expect(linkDeBaralhos).toHaveAttribute("href", "#/baralhos");
    expect(linkDeCadastro).toHaveAttribute("href", "#/criar-conta");
    expect(linkDeCartoes).toHaveAttribute("aria-current", "page");
    expect(linkDeBaralhos).not.toHaveAttribute("aria-current");
    expect(linkDeCadastro).not.toHaveAttribute("aria-current");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Cartões" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Baralhos" }),
    ).not.toBeInTheDocument();
  });

  it("oferece o acesso à tela Criar conta em todas as rotas (FR-084)", async () => {
    render(<Aplicacao cliente={new ClienteEmMemoria()} />);

    const navegacao = screen.getByRole("navigation", { name: "Principal" });

    for (const hash of [
      "#/cartoes",
      "#/baralhos",
      "#/criar-conta",
      "#/baralhos/inexistente",
    ]) {
      navegarPara(hash);

      expect(
        within(navegacao).getByRole("link", { name: "Criar conta" }),
      ).toHaveAttribute("href", "#/criar-conta");
    }
  });

  it("abre a tela Criar conta pela navegação, marca o link corrente e move o foco para o título (FR-084)", async () => {
    render(<Aplicacao cliente={new ClienteEmMemoria()} />);
    await screen.findByRole("heading", { level: 1, name: "Cartões" });

    navegarPara("#/criar-conta");

    const titulo = await screen.findByRole("heading", {
      level: 1,
      name: "Criar conta",
    });

    expect(titulo).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Cartões" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Baralhos" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(document.activeElement).toBe(titulo);

    // Os três campos do Cadastro são os da tela alcançada pelo link.
    expect(screen.getByLabelText("Nome de usuário")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmação da Senha")).toBeInTheDocument();
  });

  it("muda de rota pelo hash, marca o link corrente e move o foco para o título", async () => {
    render(<Aplicacao cliente={new ClienteEmMemoria()} />);
    await screen.findByRole("heading", { level: 1, name: "Cartões" });

    navegarPara("#/baralhos");

    const titulo = await screen.findByRole("heading", {
      level: 1,
      name: "Baralhos",
    });

    expect(titulo).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Cartões" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Baralhos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Cartões" })).not.toHaveAttribute(
      "aria-current",
    );

    // O foco vai para o título da tela de destino, essencial para teclado e
    // leitor de tela.
    expect(document.activeElement).toBe(titulo);
    expect(titulo).toHaveAttribute("tabindex", "-1");
  });

  it("volta para Cartões pelo hash e move o foco para o título", async () => {
    navegarPara("#/baralhos");
    render(<Aplicacao cliente={new ClienteEmMemoria()} />);
    await screen.findByRole("heading", { level: 1, name: "Baralhos" });

    navegarPara("#/cartoes");

    const titulo = await screen.findByRole("heading", {
      level: 1,
      name: "Cartões",
    });

    expect(titulo).toBeInTheDocument();
    expect(document.activeElement).toBe(titulo);
    expect(titulo).toHaveAttribute("tabindex", "-1");
  });
});
