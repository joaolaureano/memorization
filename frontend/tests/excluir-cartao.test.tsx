import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";

/**
 * T504, T505, T506 — exclusão de Cartão dentro de um Baralho
 * (specs/025-criar-cartoes-baralho; regras preservadas de
 * specs/006-excluir-cartao-e-baralho: FR-007, FR-008, FR-068, FR-069,
 * FR-044, FR-045; specs/025: FR-401).
 *
 * As asserções cobrem a consequência declarada pelo diálogo, o cancelamento
 * que não altera o estado e devolve o foco ao controle invocador, a exclusão
 * confirmada, e a falha de transporte que mantém o Cartão exibido.
 */

async function criarBaralhoComCartao(): Promise<{
  cliente: ClienteEmMemoria;
  idDoBaralho: string;
  idDoCartao: string;
}> {
  const cliente = clienteDeProva();
  const baralho = await cliente.criarBaralho({ nome: "Inglês" });

  if (!baralho.ok) {
    throw new Error("a criação do Baralho deveria ser aceita");
  }

  const cartao = await cliente.criarCartao(baralho.baralho.id, {
    frente: "To walk",
    verso: "Caminhar",
  });

  if (!cartao.ok) {
    throw new Error("a criação do Cartão deveria ser aceita");
  }

  return {
    cliente,
    idDoBaralho: baralho.baralho.id,
    idDoCartao: cartao.cartao.id,
  };
}

function itemDoCartao(): HTMLElement {
  const item = screen.getByText("To walk").closest("li");

  if (item === null) {
    throw new Error("item do Cartão não encontrado");
  }

  return item;
}

function botaoDeExcluir(): HTMLElement {
  return within(itemDoCartao()).getByRole("button", { name: "Excluir To walk" });
}

describe("exclusão de Cartão", () => {
  it("o diálogo declara a consequência e o cancelamento não altera o estado (FR-007, FR-008, FR-068, FR-401)", async () => {
    const { cliente, idDoBaralho } = await criarBaralhoComCartao();

    render(comProtecaoDeSaida(<PaginaDoBaralho cliente={cliente} id={idDoBaralho} />, true));

    await screen.findByText("To walk");
    const botao = botaoDeExcluir();

    fireEvent.click(botao);

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveAccessibleName("Excluir \"To walk\"?");
    expect(dialogo).toHaveTextContent(
      "O Cartão e seu Agendamento serão removidos.",
    );
    expect(dialogo).toHaveTextContent(
      /Registros históricos já concluídos permanecerão/i,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("To walk")).toBeInTheDocument();
    expect(botao).toHaveFocus();

    const baralho = await cliente.obterBaralho(idDoBaralho);

    expect(baralho.ok).toBe(true);

    if (baralho.ok) {
      expect(baralho.baralho.cartoes).toHaveLength(1);
      expect(baralho.baralho.cartoes[0].frente).toBe("To walk");
    }
  });

  it("confirmar exclui o Cartão e remove da lista (FR-007, FR-008)", async () => {
    const { cliente, idDoBaralho } = await criarBaralhoComCartao();

    render(comProtecaoDeSaida(<PaginaDoBaralho cliente={cliente} id={idDoBaralho} />, true));

    await screen.findByText("To walk");
    fireEvent.click(botaoDeExcluir());

    fireEvent.click(
      await screen.findByRole("button", { name: "Excluir Cartão" }),
    );

    expect(
      await screen.findByText(
        /Cartão To walk e seu Agendamento foram excluídos/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Este Baralho ainda não tem Cartões."),
    ).toBeInTheDocument();

    const baralho = await cliente.obterBaralho(idDoBaralho);

    expect(baralho.ok).toBe(true);

    if (baralho.ok) {
      expect(baralho.baralho.cartoes).toHaveLength(0);
    }
  });

  it("Escape cancela a exclusão e devolve o foco ao controle invocador (FR-068)", async () => {
    const { cliente, idDoBaralho } = await criarBaralhoComCartao();

    render(comProtecaoDeSaida(<PaginaDoBaralho cliente={cliente} id={idDoBaralho} />, true));

    await screen.findByText("To walk");
    const botao = botaoDeExcluir();

    fireEvent.click(botao);

    const dialogo = await screen.findByRole("dialog");
    fireEvent.keyDown(dialogo, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("To walk")).toBeInTheDocument();
    expect(botao).toHaveFocus();
  });
});
