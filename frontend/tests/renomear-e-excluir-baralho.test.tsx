import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";

/**
 * T1110 — exclusão de Baralho
 * (specs/012-interface-visual-navegavel/tasks.md; regras preservadas de
 * specs/006-excluir-cartao-e-baralho: FR-016, FR-017, FR-068, FR-069).
 *
 * A renomeação inline saiu desta tela na 012: ela agora pertence à página de
 * formulário (`#/baralhos/<id>/editar`, T1108) e é provada em
 * `formulario-de-baralho.test.tsx`. O que permanece aqui é a exclusão: o
 * diálogo declara a consequência real (quantos Cartões continuarão existindo e
 * que nenhum Cartão será destruído) e as falhas mantêm o Baralho exibido.
 */

interface AcervoDeTeste {
  cliente: ClienteEmMemoria;
  idDoBaralho: string;
}

async function criarBaralhoComDoisCartoes(): Promise<AcervoDeTeste> {
  const cliente = clienteDeProva();
  const baralho = await cliente.criarBaralho({ nome: "Inglês" });

  if (!baralho.ok) {
    throw new Error("a criação do Baralho deveria ser aceita");
  }

  for (const [frente, verso] of [
    ["To walk", "Caminhar"],
    ["To run", "Correr"],
  ]) {
    const cartao = await cliente.criarCartao({ frente, verso });

    if (!cartao.ok) {
      throw new Error("a criação do Cartão deveria ser aceita");
    }

    await cliente.vincular(cartao.cartao.id, baralho.baralho.id);
  }

  return { cliente, idDoBaralho: baralho.baralho.id };
}

function renderizar(cliente: ClienteEmMemoria, idDoBaralho: string): void {
  render(
    comProtecaoDeSaida(
      <PaginaDoBaralho cliente={cliente} id={idDoBaralho} />,
      true,
    ),
  );
}

describe("exclusão de Baralho", () => {
  it("o diálogo nomeia o Baralho, informa quantos Cartões continuarão existindo e o cancelamento foca o botão de excluir (FR-016, FR-017, FR-068)", async () => {
    const { cliente, idDoBaralho } = await criarBaralhoComDoisCartoes();

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", { level: 1, name: "Inglês" });
    const botaoDeExcluir = screen.getByRole("button", {
      name: "Excluir Baralho",
    });

    fireEvent.click(botaoDeExcluir);

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveAccessibleName("Excluir “Inglês”?");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    expect(dialogo).toHaveTextContent(
      "Este Baralho tem 2 Cartões vinculados.",
    );
    expect(dialogo).toHaveTextContent(/os 2 Cartões continuarão existindo/i);
    expect(dialogo).toHaveTextContent(/nenhum Cartão será excluído/i);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Inglês" }),
    ).toBeInTheDocument();
    expect(botaoDeExcluir).toHaveFocus();

    const baralhos = await cliente.listarBaralhos();

    expect(baralhos.ok).toBe(true);

    if (baralhos.ok) {
      expect(baralhos.baralhos).toHaveLength(1);
      expect(baralhos.baralhos[0].quantidadeDeCartoes).toBe(2);
    }
  });

  it("Escape cancela a exclusão e devolve o foco ao botão de excluir (FR-068)", async () => {
    const { cliente, idDoBaralho } = await criarBaralhoComDoisCartoes();

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", { level: 1, name: "Inglês" });
    const botaoDeExcluir = screen.getByRole("button", {
      name: "Excluir Baralho",
    });

    fireEvent.click(botaoDeExcluir);
    const dialogo = await screen.findByRole("dialog");

    fireEvent.keyDown(dialogo, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(botaoDeExcluir).toHaveFocus();
  });

  it("confirmar exclui o Baralho, navega para a lista e preserva os Cartões (FR-016, FR-017)", async () => {
    const { cliente, idDoBaralho } = await criarBaralhoComDoisCartoes();

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", { level: 1, name: "Inglês" });
    fireEvent.click(
      screen.getByRole("button", { name: "Excluir Baralho" }),
    );

    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Excluir Baralho" }),
    );

    await waitFor(() => {
      expect(window.location.hash).toBe("#/baralhos");
    });

    const baralhos = await cliente.listarBaralhos();
    const cartoes = await cliente.listarCartoes();

    expect(baralhos.ok).toBe(true);
    expect(cartoes.ok).toBe(true);

    if (baralhos.ok) {
      expect(baralhos.baralhos).toHaveLength(0);
    }

    if (cartoes.ok) {
      expect(cartoes.cartoes).toHaveLength(2);
    }
  });

  it("com o cliente indisponível, excluir falha e o Baralho permanece exibido (FR-044, FR-045)", async () => {
    const { cliente, idDoBaralho } = await criarBaralhoComDoisCartoes();

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", { level: 1, name: "Inglês" });
    const botaoDeExcluir = screen.getByRole("button", {
      name: "Excluir Baralho",
    });

    fireEvent.click(botaoDeExcluir);

    const dialogo = await screen.findByRole("dialog");
    const confirmar = within(dialogo).getByRole("button", {
      name: "Excluir Baralho",
    });

    cliente.simularIndisponibilidade();
    fireEvent.click(confirmar);

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Inglês" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(botaoDeExcluir).toHaveFocus();
  });
});
