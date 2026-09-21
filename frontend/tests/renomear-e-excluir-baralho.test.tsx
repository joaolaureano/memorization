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
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";

/**
 * T404, T405, T504, T505, T506 — renomeação e exclusão de Baralho
 * (specs/005-editar-cartao-e-baralho/tasks.md e
 * specs/006-excluir-cartao-e-baralho/tasks.md).
 *
 * A tela é exercitada com o `ClienteEmMemoria`, sem servidor. As asserções
 * cobrem o alcance da renomeação, a preservação de Vínculos, a confirmação de
 * descarte, a consequência declarada na exclusão e as falhas que mantêm a
 * entidade exibida.
 */

interface AcervoDeTeste {
  cliente: ClienteEmMemoria;
  idDoBaralho: string;
}

async function criarBaralhoComDoisCartoes(): Promise<AcervoDeTeste> {
  const cliente = new ClienteEmMemoria();
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
  render(<PaginaDoBaralho cliente={cliente} id={idDoBaralho} />);
}

describe("renomeação de Baralho", () => {
  it("renomeia o Baralho informando o alcance e preserva Vínculos e elegibilidade (FR-015)", async () => {
    const { cliente, idDoBaralho } = await criarBaralhoComDoisCartoes();

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", { level: 1, name: "Inglês" });
    fireEvent.click(screen.getByRole("button", { name: "Renomear" }));

    expect(
      screen.getByText("Este Baralho tem 2 Cartões vinculados."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Idiomas" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Idiomas" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Baralho renomeado.")).toBeInTheDocument();
    expect(screen.getByText("Elegível para estudo.")).toBeInTheDocument();

    const detalhe = await cliente.obterBaralho(idDoBaralho);

    expect(detalhe.ok).toBe(true);

    if (detalhe.ok) {
      expect(detalhe.baralho.nome).toBe("Idiomas");
      expect(detalhe.baralho.elegivel).toBe(true);
      expect(detalhe.baralho.cartoes).toHaveLength(2);
    }
  });

  it("cancelar renomeação suja pede confirmação; recusar preserva e confirmar descarta (FR-050, SC-014)", async () => {
    const { cliente, idDoBaralho } = await criarBaralhoComDoisCartoes();

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", { level: 1, name: "Inglês" });
    fireEvent.click(screen.getByRole("button", { name: "Renomear" }));

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Idiomas" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent(
      /alterações não salvas neste Baralho/i,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Continuar editando" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Idiomas");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Descartar alterações" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Inglês" }),
    ).toBeInTheDocument();
  });

  it("com o cliente indisponível, renomear falha e o conteúdo digitado permanece (FR-044, FR-045)", async () => {
    const { cliente, idDoBaralho } = await criarBaralhoComDoisCartoes();

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", { level: 1, name: "Inglês" });
    fireEvent.click(screen.getByRole("button", { name: "Renomear" }));

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Idiomas" },
    });

    cliente.simularIndisponibilidade();
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS),
    ).toBeInTheDocument();
    expect(screen.queryByText("Baralho renomeado.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Idiomas");
  });
});

describe("exclusão de Baralho", () => {
  it("o diálogo informa quantos Cartões continuarão existindo e o cancelamento não altera o estado (FR-016, FR-017, FR-068)", async () => {
    const { cliente, idDoBaralho } = await criarBaralhoComDoisCartoes();

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", { level: 1, name: "Inglês" });
    const botaoDeExcluir = screen.getByRole("button", {
      name: "Excluir Baralho",
    });

    fireEvent.click(botaoDeExcluir);

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveAccessibleName("Excluir Baralho");
    expect(dialogo).toHaveTextContent(
      "Este Baralho tem 2 Cartões vinculados.",
    );
    expect(dialogo).toHaveTextContent(
      /os 2 Cartões continuarão existindo/i,
    );
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
