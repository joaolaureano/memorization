import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE } from "../src/acervo-cliente/cliente";
import { clienteDeProva } from "./apoio-de-prova";
import { PaginaDeCartoes } from "../src/ui/PaginaDeCartoes";

/**
 * T1112 — lista de Cartões (specs/012-interface-visual-navegavel/tasks.md;
 * FR-140, FR-141, FR-144, FR-146, FR-147, FR-153, FR-156).
 *
 * A tela é exercitada com o `ClienteEmMemoria`, o Adapter de teste da Seam
 * `ClienteDoAcervo`, sem servidor. As asserções cobrem o estado vazio que
 * orienta a primeira ação com um link de criação (FR-043, FR-141), a listagem
 * que mostra só o título de cada Cartão (spec 021: FR-344), as ações
 * únicas por item (FR-147) e as cargas de listagem com nova tentativa
 * (FR-144, FR-153). Criação e edição passaram a ser exercitadas em
 * `formulario-de-cartao.test.tsx`.
 */

function renderizarPaginaDeCartoes(): void {
  render(<PaginaDeCartoes cliente={clienteDeProva()} />);
}

describe("PaginaDeCartoes", () => {
  it("comunica o estado vazio e oferece o link de criação (FR-043, FR-141)", async () => {
    renderizarPaginaDeCartoes();

    expect(
      screen.getByRole("heading", { level: 1, name: "Cartões" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Seu acervo")).toBeNull();

    expect(await screen.findByText(/ainda não há Cartões/i)).toBeInTheDocument();
    expect(screen.getByText(/crie o primeiro/i)).toBeInTheDocument();

    const criacao = screen.getAllByRole("link", { name: "Criar cartão" });
    expect(criacao.length).toBeGreaterThan(0);

    for (const link of criacao) {
      expect(link).toHaveAttribute("href", "#/cartoes/novo");
    }
  });

  it("mostra só a Frente como título, sem Verso nem Vínculos, com Excluir → Editar (FR-344)", async () => {
    const cliente = clienteDeProva();
    const vinculado = await cliente.criarCartao({
      frente: "To walk",
      verso: "Caminhar",
    });
    const semBaralho = await cliente.criarCartao({
      frente: "To run",
      verso: "Correr",
    });
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!vinculado.ok || !semBaralho.ok || !baralho.ok) {
      throw new Error("as criações do cenário deveriam ser aceitas");
    }

    await cliente.vincular(vinculado.cartao.id, baralho.baralho.id);

    render(<PaginaDeCartoes cliente={cliente} />);

    await screen.findByText("To walk");
    const lista = screen.getByRole("list");

    for (const texto of [
      "Caminhar",
      "Correr",
      "Frente",
      "Verso",
      "Em nenhum Baralho",
      "Inglês",
    ]) {
      expect(within(lista).queryByText(texto)).toBeNull();
    }

    for (const frente of ["To walk", "To run"]) {
      const item = within(lista).getByText(frente).closest("li");

      if (item === null) {
        throw new Error("item do Cartão não encontrado");
      }

      const controles = Array.from(
        item.querySelectorAll<HTMLElement>("button, a[href]"),
      );

      expect(controles).toHaveLength(2);
      expect(controles[0]).toHaveAccessibleName(`Excluir ${frente}`);
      expect(controles[1]).toHaveAccessibleName(`Editar ${frente}`);
    }
  });

  it("oferece ações de Editar e Excluir por item, com nomes acessíveis únicos (FR-147, FR-155)", async () => {
    const cliente = clienteDeProva();

    // Frente e Verso distintos: com o mesmo texto nos dois lados, a Frente
    // deixaria de ser localizável de forma inequívoca na lista.
    for (const dados of [
      { frente: "To walk", verso: "Caminhar" },
      { frente: "To run", verso: "Correr" },
    ]) {
      const cartao = await cliente.criarCartao(dados);

      if (!cartao.ok) {
        throw new Error("a criação do Cartão deveria ser aceita");
      }
    }

    render(<PaginaDeCartoes cliente={cliente} />);

    const item = (await screen.findByText("To walk")).closest("li");

    if (item === null) {
      throw new Error("item do Cartão não encontrado");
    }

    expect(
      within(item).getByRole("link", { name: "Editar To walk" }),
    ).toHaveAttribute("href", expect.stringContaining("#/cartoes/"));
    expect(
      within(item).getByRole("button", { name: "Excluir To walk" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Editar To run" }),
    ).toBeInTheDocument();
  });

  it("cliente indisponível desde o carregamento apresenta a falha com nova tentativa (FR-144, FR-153)", async () => {
    const cliente = clienteDeProva();
    cliente.simularIndisponibilidade();

    render(<PaginaDeCartoes cliente={cliente} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE,
    );
    expect(screen.queryByText(/ainda não há Cartões/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();

    cliente.restaurarDisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText(/ainda não há Cartões/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
