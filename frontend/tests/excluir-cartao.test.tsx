import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { PaginaDeCartoes } from "../src/ui/PaginaDeCartoes";

/**
 * T504, T505, T506 — exclusão de Cartão pela tela de Cartões
 * (specs/006-excluir-cartao-e-baralho/tasks.md, FR-007, FR-008, FR-068,
 * FR-069, FR-044, FR-045).
 *
 * As asserções cobrem a consequência declarada pelo diálogo, o cancelamento
 * que não altera o estado e devolve o foco ao controle invocador, a exclusão
 * confirmada que preserva os Baralhos e a falha de transporte que mantém o
 * Cartão exibido.
 */

async function criarCartaoVinculadoADoisBaralhos(): Promise<ClienteEmMemoria> {
  const cliente = new ClienteEmMemoria();
  const cartao = await cliente.criarCartao({
    frente: "To walk",
    verso: "Caminhar",
  });

  if (!cartao.ok) {
    throw new Error("a criação do Cartão deveria ser aceita");
  }

  for (const nome of ["Inglês", "Espanhol"]) {
    const baralho = await cliente.criarBaralho({ nome });

    if (!baralho.ok) {
      throw new Error("a criação do Baralho deveria ser aceita");
    }

    await cliente.vincular(cartao.cartao.id, baralho.baralho.id);
  }

  return cliente;
}

function itemDoCartao(): HTMLElement {
  const item = screen.getByText("To walk").closest("li");

  if (item === null) {
    throw new Error("item do Cartão não encontrado");
  }

  return item;
}

function botaoDeExcluir(): HTMLElement {
  return within(itemDoCartao()).getByRole("button", { name: "Excluir" });
}

describe("exclusão de Cartão", () => {
  it("o diálogo declara a consequência e o cancelamento não altera o estado (FR-007, FR-008, FR-068)", async () => {
    const cliente = await criarCartaoVinculadoADoisBaralhos();

    render(<PaginaDeCartoes cliente={cliente} />);

    await screen.findByText("To walk");
    const botao = botaoDeExcluir();

    fireEvent.click(botao);

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveAccessibleName("Excluir Cartão");
    expect(dialogo).toHaveTextContent(
      "Este Cartão está vinculado a 2 Baralhos.",
    );
    expect(dialogo).toHaveTextContent(
      /nenhum Baralho será excluído/i,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("To walk")).toBeInTheDocument();
    expect(botao).toHaveFocus();

    const baralhos = await cliente.listarBaralhos();

    expect(baralhos.ok).toBe(true);

    if (baralhos.ok) {
      expect(baralhos.baralhos).toHaveLength(2);
      expect(baralhos.baralhos[0].quantidadeDeCartoes).toBe(1);
      expect(baralhos.baralhos[1].quantidadeDeCartoes).toBe(1);
    }
  });

  it("confirmar exclui o Cartão, remove os Vínculos e preserva os dois Baralhos (FR-007, FR-008)", async () => {
    const cliente = await criarCartaoVinculadoADoisBaralhos();

    render(<PaginaDeCartoes cliente={cliente} />);

    await screen.findByText("To walk");
    fireEvent.click(botaoDeExcluir());

    fireEvent.click(
      await screen.findByRole("button", { name: "Excluir Cartão" }),
    );

    expect(
      await screen.findByText(
        "Cartão excluído. Nenhum Baralho foi excluído.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ainda não há Cartões. Crie o primeiro Cartão para começar a memorizar.",
      ),
    ).toBeInTheDocument();

    const cartoes = await cliente.listarCartoes();
    const baralhos = await cliente.listarBaralhos();

    expect(cartoes.ok).toBe(true);
    expect(baralhos.ok).toBe(true);

    if (cartoes.ok) {
      expect(cartoes.cartoes).toHaveLength(0);
    }

    if (baralhos.ok) {
      expect(baralhos.baralhos).toHaveLength(2);
      expect(
        baralhos.baralhos.every(
          (baralho) =>
            baralho.quantidadeDeCartoes === 0 && !baralho.elegivel,
        ),
      ).toBe(true);
    }
  });

  it("Escape cancela a exclusão e devolve o foco ao controle invocador (FR-068)", async () => {
    const cliente = await criarCartaoVinculadoADoisBaralhos();

    render(<PaginaDeCartoes cliente={cliente} />);

    await screen.findByText("To walk");
    const botao = botaoDeExcluir();

    fireEvent.click(botao);

    const dialogo = await screen.findByRole("dialog");
    fireEvent.keyDown(dialogo, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("To walk")).toBeInTheDocument();
    expect(botao).toHaveFocus();
  });

  it("com o cliente indisponível, a exclusão falha e o Cartão permanece exibido (FR-044, FR-045)", async () => {
    const cliente = await criarCartaoVinculadoADoisBaralhos();

    render(<PaginaDeCartoes cliente={cliente} />);

    await screen.findByText("To walk");
    const botao = botaoDeExcluir();

    fireEvent.click(botao);

    await screen.findByRole("button", { name: "Excluir Cartão" });
    cliente.simularIndisponibilidade();

    fireEvent.click(
      screen.getByRole("button", { name: "Excluir Cartão" }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE);
    expect(screen.getByText("To walk")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });
});
