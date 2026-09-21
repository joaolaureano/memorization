import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva } from "./apoio-de-prova";
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";

/**
 * T209 — tela de Vínculos do Baralho
 * (specs/003-vincular-cartao-baralho/tasks.md, FR-019, FR-021, FR-046,
 * FR-062, FR-066).
 *
 * A tela é exercitada com o `ClienteEmMemoria`, o Adapter de teste da Seam
 * `ClienteDoAcervo`, sem servidor. As asserções cobrem a apresentação do
 * Baralho com os Cartões vinculados e os ainda não vinculados, a criação e a
 * remoção de Vínculos sem diálogo de confirmação, os três estados vazios
 * distinguidos por texto e a falha de gravação que não exibe Vínculo
 * inexistente nem some com Vínculo confirmado (FR-044, FR-045).
 */

interface AcervoDeTeste {
  cliente: ClienteEmMemoria;
  idDoBaralho: string;
  idDoPrimeiroCartao: string;
  idDoSegundoCartao: string;
}

async function criarAcervoDeTeste(): Promise<AcervoDeTeste> {
  const cliente = clienteDeProva();
  const primeiroCartao = await cliente.criarCartao({
    frente: "To walk",
    verso: "Caminhar",
  });
  const segundoCartao = await cliente.criarCartao({
    frente: "To run",
    verso: "Correr",
  });
  const baralho = await cliente.criarBaralho({ nome: "Inglês" });

  if (!primeiroCartao.ok || !segundoCartao.ok || !baralho.ok) {
    throw new Error("as criações do cenário deveriam ser aceitas");
  }

  return {
    cliente,
    idDoBaralho: baralho.baralho.id,
    idDoPrimeiroCartao: primeiroCartao.cartao.id,
    idDoSegundoCartao: segundoCartao.cartao.id,
  };
}

function renderizar(cliente: ClienteEmMemoria, idDoBaralho: string): void {
  render(<PaginaDoBaralho cliente={cliente} id={idDoBaralho} />);
}

/** A seção cujo título de nível 2 tem o nome informado. */
function secao(nome: string): HTMLElement {
  const titulo = screen.getByRole("heading", { level: 2, name: nome });
  const elemento = titulo.closest("section");

  if (elemento === null) {
    throw new Error(`Seção ${nome} não encontrada.`);
  }

  return elemento;
}

describe("PaginaDoBaralho", () => {
  it("apresenta o Baralho, a elegibilidade e separa vinculados de não vinculados (FR-019, FR-014)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTeste();
    renderizar(cliente, idDoBaralho);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Inglês" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Não elegível para estudo: nenhum Cartão vinculado.",
      ),
    ).toBeInTheDocument();

    const vinculados = secao("Cartões do Baralho");
    const naoVinculados = secao("Cartões não vinculados");

    expect(vinculados).toHaveTextContent(
      "Este Baralho ainda não tem Cartões vinculados.",
    );
    expect(within(naoVinculados).getAllByRole("listitem")).toHaveLength(2);
    expect(within(naoVinculados).getByText("To walk")).toBeInTheDocument();
    expect(within(naoVinculados).getByText("To run")).toBeInTheDocument();
  });

  it("vincula um Cartão e relê as listas confirmadas pelo cliente (FR-019, FR-044)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTeste();
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", { level: 1, name: "Inglês" });

    fireEvent.click(
      screen.getByRole("button", { name: "Vincular To walk" }),
    );

    expect(
      await screen.findByText(/Cartão vinculado ao Baralho\./),
    ).toBeInTheDocument();

    const vinculados = secao("Cartões do Baralho");
    const naoVinculados = secao("Cartões não vinculados");

    expect(within(vinculados).getAllByRole("listitem")).toHaveLength(1);
    expect(within(vinculados).getByText("To walk")).toBeInTheDocument();
    expect(within(naoVinculados).getAllByRole("listitem")).toHaveLength(1);
    expect(within(naoVinculados).getByText("To run")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Vincular To walk" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desvincular To walk" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Elegível para estudo.")).toBeInTheDocument();
  });

  it("desvincula sem pedir confirmação e preserva Cartão e Baralho (FR-021, FR-066)", async () => {
    const { cliente, idDoBaralho, idDoPrimeiroCartao } =
      await criarAcervoDeTeste();
    await cliente.vincular(idDoPrimeiroCartao, idDoBaralho);

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("button", { name: "Desvincular To walk" });

    fireEvent.click(
      screen.getByRole("button", { name: "Desvincular To walk" }),
    );

    expect(
      await screen.findByText(/Cartão desvinculado do Baralho\./),
    ).toBeInTheDocument();

    // Desvincular é reversível e não destrói nada: nenhum diálogo de
    // confirmação é apresentado.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    expect(secao("Cartões do Baralho")).toHaveTextContent(
      "Este Baralho ainda não tem Cartões vinculados.",
    );
    expect(within(secao("Cartões não vinculados")).getAllByRole("listitem")).toHaveLength(
      2,
    );
    expect(
      screen.getByText(
        "Não elegível para estudo: nenhum Cartão vinculado.",
      ),
    ).toBeInTheDocument();
  });

  it("comunica a ausência total de Cartões, distinguindo-a dos demais vazios (FR-062)", async () => {
    const cliente = clienteDeProva();
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!baralho.ok) {
      throw new Error("a criação do Baralho deveria ser aceita");
    }

    renderizar(cliente, baralho.baralho.id);

    expect(
      await screen.findByText(
        "Ainda não há Cartões. Crie um Cartão antes de vincular.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Este Baralho ainda não tem Cartões vinculados."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Todos os Cartões já estão vinculados a este Baralho.",
      ),
    ).not.toBeInTheDocument();
  });

  it("comunica quando todos os Cartões já estão vinculados (FR-062)", async () => {
    const { cliente, idDoBaralho, idDoPrimeiroCartao, idDoSegundoCartao } =
      await criarAcervoDeTeste();
    await cliente.vincular(idDoPrimeiroCartao, idDoBaralho);
    await cliente.vincular(idDoSegundoCartao, idDoBaralho);

    renderizar(cliente, idDoBaralho);

    expect(
      await screen.findByText(
        "Todos os Cartões já estão vinculados a este Baralho.",
      ),
    ).toBeInTheDocument();
    expect(within(secao("Cartões do Baralho")).getAllByRole("listitem")).toHaveLength(
      2,
    );
    expect(
      screen.queryByText("Este Baralho ainda não tem Cartões vinculados."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Ainda não há Cartões. Crie um Cartão antes de vincular."),
    ).not.toBeInTheDocument();
  });

  it("Baralho inexistente mostra a mensagem em português com o link de volta", async () => {
    renderizar(clienteDeProva(), "b-inexistente");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Baralho não encontrado" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Baralho não encontrado.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para Baralhos" }),
    ).toHaveAttribute("href", "#/baralhos");
  });

  it("com o cliente indisponível, vincular falha e nenhum Vínculo inexistente é exibido (FR-044, FR-045, SC-012)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTeste();
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("button", { name: "Vincular To walk" });

    cliente.simularIndisponibilidade();
    fireEvent.click(
      screen.getByRole("button", { name: "Vincular To walk" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
    );

    expect(
      screen.queryByText(/Cartão vinculado ao Baralho\./),
    ).not.toBeInTheDocument();
    expect(secao("Cartões do Baralho")).toHaveTextContent(
      "Este Baralho ainda não tem Cartões vinculados.",
    );
    expect(
      within(secao("Cartões não vinculados")).getAllByRole("listitem"),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Vincular To walk" }),
    ).toBeInTheDocument();
  });

  it("com o cliente indisponível, desvincular falha e o Vínculo confirmado permanece exibido (FR-044, FR-045, SC-012)", async () => {
    const { cliente, idDoBaralho, idDoPrimeiroCartao } =
      await criarAcervoDeTeste();
    await cliente.vincular(idDoPrimeiroCartao, idDoBaralho);

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("button", { name: "Desvincular To walk" });

    cliente.simularIndisponibilidade();
    fireEvent.click(
      screen.getByRole("button", { name: "Desvincular To walk" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
    );

    expect(
      screen.queryByText(/Cartão desvinculado do Baralho\./),
    ).not.toBeInTheDocument();
    expect(within(secao("Cartões do Baralho")).getAllByRole("listitem")).toHaveLength(
      1,
    );
    expect(
      screen.getByRole("button", { name: "Desvincular To walk" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Elegível para estudo.")).toBeInTheDocument();
  });
});
