import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Moldura } from "../src/ui/Moldura";
import type { Rota } from "../src/ui/navegacao";

/**
 * Moldura (FR-139, FR-168).
 *
 * A marca e os destinos do acervo apontam para as rotas canônicas, e o destino
 * corrente é decidido por `destinoAtivo` — por isso a prova percorre cada
 * família de rota: o Início e o Registro de Sessão marcam Início, as de Cartões
 * marcam Cartões, as de Baralho (inclusive a Sessão de estudo, que pertence ao
 * Baralho) marcam Baralhos, e Entrar e Criar conta não marcam nenhum destino.
 *
 * Sair é irmão do `<nav>`: em telas de até 600px só a navegação desce para a
 * barra inferior, e Sair precisa continuar no cabeçalho.
 */

const CASOS: ReadonlyArray<{
  descricao: string;
  rota: Rota;
  ativo: "Início" | "Baralhos" | "Cartões" | null;
}> = [
  { descricao: "Início", rota: { nome: "inicio" }, ativo: "Início" },
  {
    descricao: "Registro de Sessão",
    rota: { nome: "registro", id: "s1" },
    ativo: "Início",
  },
  { descricao: "Baralhos", rota: { nome: "baralhos" }, ativo: "Baralhos" },
  { descricao: "Novo Baralho", rota: { nome: "novo-baralho" }, ativo: "Baralhos" },
  { descricao: "Detalhe do Baralho", rota: { nome: "baralho", id: "b1" }, ativo: "Baralhos" },
  { descricao: "Editar Baralho", rota: { nome: "editar-baralho", id: "b1" }, ativo: "Baralhos" },
  { descricao: "Adicionar Cartões", rota: { nome: "adicionar-cartoes", id: "b1" }, ativo: "Baralhos" },
  { descricao: "Sessão de estudo", rota: { nome: "estudo", id: "b1" }, ativo: "Baralhos" },
  { descricao: "Cartões", rota: { nome: "cartoes" }, ativo: "Cartões" },
  { descricao: "Novo Cartão", rota: { nome: "novo-cartao" }, ativo: "Cartões" },
  { descricao: "Editar Cartão", rota: { nome: "editar-cartao", id: "c1" }, ativo: "Cartões" },
  { descricao: "Entrar", rota: { nome: "entrar" }, ativo: null },
  { descricao: "Criar conta", rota: { nome: "cadastro" }, ativo: null },
];

describe("Moldura — marca e destinos", () => {
  it("aponta a marca e os destinos para as rotas do acervo", () => {
    render(<Moldura rota={{ nome: "baralhos" }} aoSair={() => {}} />);

    expect(
      screen.getByRole("link", { name: "memorization" }),
    ).toHaveAttribute("href", "#/inicio");
    expect(
      screen.getByRole("navigation", { name: "Principal" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute(
      "href",
      "#/inicio",
    );
    expect(screen.getByRole("link", { name: "Baralhos" })).toHaveAttribute(
      "href",
      "#/baralhos",
    );
    expect(screen.getByRole("link", { name: "Cartões" })).toHaveAttribute(
      "href",
      "#/cartoes",
    );

    // FR-168: a navegação lista Início, Baralhos e Cartões, nessa ordem.
    expect(
      within(screen.getByRole("navigation", { name: "Principal" }))
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Início", "Baralhos", "Cartões"]);
  });
});

describe("Moldura — destino corrente", () => {
  it.each(CASOS)("marca o destino de $descricao", ({ rota, ativo }) => {
    render(<Moldura rota={rota} aoSair={() => {}} />);

    for (const nome of ["Início", "Baralhos", "Cartões"] as const) {
      const link = screen.getByRole("link", { name: nome });

      if (nome === ativo) {
        expect(link).toHaveAttribute("aria-current", "page");
      } else {
        expect(link).not.toHaveAttribute("aria-current");
      }
    }
  });
});

describe("Moldura — Sair", () => {
  it("aciona aoSair e fica fora da navegação", () => {
    const aoSair = vi.fn();
    render(<Moldura rota={{ nome: "cartoes" }} aoSair={aoSair} />);

    const sair = screen.getByRole("button", { name: "Sair" });
    expect(sair).toHaveClass("botao-de-saida");
    expect(sair.closest("nav")).toBeNull();

    fireEvent.click(sair);
    expect(aoSair).toHaveBeenCalledTimes(1);
  });
});
