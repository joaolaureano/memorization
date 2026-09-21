import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
} from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { AleatoriedadeDeterministica } from "../src/sessao-de-estudo/aleatoriedade";
import {
  MENSAGEM_DE_BARALHO_INELEGIVEL,
  MENSAGEM_DE_QUANTIDADE_INVALIDA,
} from "../src/sessao-de-estudo/sessao-de-estudo";
import { PaginaDeEstudo } from "../src/ui/PaginaDeEstudo";
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";

/**
 * T304 — telas de início e de Item da Sessão de estudo
 * (specs/004-sessao-de-estudo/tasks.md, FR-025, FR-027 a FR-029, FR-047).
 *
 * A tela é exercitada com o `ClienteEmMemoria` e o Adapter determinístico de
 * `Aleatoriedade`, sem servidor. As asserções cobrem a recusa de Baralho
 * inelegível, a comunicação da quantidade disponível, o aviso de limite antes
 * do primeiro Item, a recusa de quantidade inválida, a posição contínua e os
 * textos em português.
 */

const VALORES_DETERMINISTICOS = [0, 0, 0, 0];

interface AcervoDeTeste {
  cliente: ClienteEmMemoria;
  idDoBaralho: string;
}

async function criarAcervoElegivel(
  quantidadeDeCartoes: number,
): Promise<AcervoDeTeste> {
  const cliente = new ClienteEmMemoria();

  for (let indice = 1; indice <= quantidadeDeCartoes; indice += 1) {
    const cartao = await cliente.criarCartao({
      frente: `Frente ${indice}`,
      verso: `Verso ${indice}`,
    });

    if (!cartao.ok) {
      throw new Error("a criação do Cartão deveria ser aceita");
    }
  }

  const baralho = await cliente.criarBaralho({ nome: "Inglês" });

  if (!baralho.ok) {
    throw new Error("a criação do Baralho deveria ser aceita");
  }

  const cartoes = await cliente.listarCartoes();

  if (!cartoes.ok) {
    throw new Error("a listagem de Cartões deveria ser aceita");
  }

  for (const cartao of cartoes.cartoes) {
    await cliente.vincular(cartao.id, baralho.baralho.id);
  }

  return { cliente, idDoBaralho: baralho.baralho.id };
}

function renderizar(cliente: ClienteEmMemoria, idDoBaralho: string): void {
  render(
    <PaginaDeEstudo
      cliente={cliente}
      id={idDoBaralho}
      aleatoriedade={
        new AleatoriedadeDeterministica(VALORES_DETERMINISTICOS)
      }
    />,
  );
}

/** Preenche a quantidade e inicia a Sessão pela interface. */
function iniciarCom(quantidade: string): void {
  fireEvent.change(screen.getByLabelText("Quantidade de Cartões"), {
    target: { value: quantidade },
  });
  fireEvent.click(screen.getByRole("button", { name: "Iniciar Sessão" }));
}

describe("PaginaDeEstudo", () => {
  it("recusa Baralho inelegível e oferece o caminho de volta (FR-025)", async () => {
    const cliente = new ClienteEmMemoria();
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!baralho.ok) {
      throw new Error("a criação do Baralho deveria ser aceita");
    }

    renderizar(cliente, baralho.baralho.id);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Estudar Inglês",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(MENSAGEM_DE_BARALHO_INELEGIVEL)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para o Baralho" }),
    ).toHaveAttribute("href", `#/baralhos/${baralho.baralho.id}`);
    expect(
      screen.queryByLabelText("Quantidade de Cartões"),
    ).not.toBeInTheDocument();
  });

  it("comunica a quantidade disponível e inicia uma Sessão com a quantidade informada (FR-027)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(5);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    expect(
      screen.getByLabelText("Quantidade de Cartões"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Este Baralho tem 5 Cartões vinculados."),
    ).toBeInTheDocument();

    iniciarCom("3");

    expect(await screen.findByText("Item 1 de 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Frente" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Verso" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Quantidade de Cartões"),
    ).not.toBeInTheDocument();
  });

  it("solicitar mais que o disponível inicia com todos e avisa antes do primeiro Item (FR-029)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(5);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    iniciarCom("50");

    expect(await screen.findByText("Item 1 de 5")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Você pediu 50 Cartões, mas este Baralho tem 5. A Sessão terá 5 Itens.",
      ),
    ).toBeInTheDocument();
  });

  it.each(["0", "-1"])(
    "recusa quantidade %s e mantém o foco no campo para correção (FR-028)",
    async (quantidade) => {
      const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
      renderizar(cliente, idDoBaralho);

      await screen.findByRole("heading", {
        level: 1,
        name: "Estudar Inglês",
      });

      iniciarCom(quantidade);

      const alerta = await screen.findByRole("alert");

      expect(alerta).toHaveTextContent(MENSAGEM_DE_QUANTIDADE_INVALIDA);
      expect(screen.getByLabelText("Quantidade de Cartões")).toHaveFocus();
      expect(
        screen.queryByText(/^Item \d+ de \d+$/),
      ).not.toBeInTheDocument();
    },
  );

  it("Baralho inexistente mostra a mensagem em português com o link de volta", async () => {
    renderizar(new ClienteEmMemoria(), "b-inexistente");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Baralho não encontrado",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Baralho não encontrado.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para o Baralho" }),
    ).toHaveAttribute("href", "#/baralhos/b-inexistente");
  });

  it("com o cliente indisponível, comunica a falha de carregamento em português", async () => {
    const cliente = new ClienteEmMemoria();
    cliente.simularIndisponibilidade();

    renderizar(cliente, "b1");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    );
  });

  it("a tela da Sessão usa os termos canônicos em português (FR-046)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    iniciarCom("2");

    await screen.findByText("Item 1 de 2");

    expect(screen.getByRole("heading", { name: "Frente" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Revelar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Interromper" }),
    ).toHaveAttribute("href", `#/baralhos/${idDoBaralho}`);

    fireEvent.click(screen.getByRole("button", { name: "Revelar" }));

    expect(
      await screen.findByRole("heading", { name: "Verso" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Acertei" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Errei" }),
    ).toBeInTheDocument();
  });

  it("PaginaDoBaralho oferece o link para a Sessão de estudo", async () => {
    const cliente = new ClienteEmMemoria();
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!baralho.ok) {
      throw new Error("a criação do Baralho deveria ser aceita");
    }

    render(<PaginaDoBaralho cliente={cliente} id={baralho.baralho.id} />);

    await screen.findByRole("heading", { level: 1, name: "Inglês" });

    expect(
      screen.getByRole("link", { name: "Estudar este Baralho" }),
    ).toHaveAttribute("href", `#/baralhos/${baralho.baralho.id}/estudo`);
  });
});
