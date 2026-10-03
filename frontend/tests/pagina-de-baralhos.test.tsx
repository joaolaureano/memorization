import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS } from "../src/acervo-cliente/cliente";
import type { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva } from "./apoio-de-prova";
import { PaginaDeBaralhos } from "../src/ui/PaginaDeBaralhos";

/**
 * T1108 — lista de Baralhos (spec 012: FR-140, FR-144, FR-148, FR-153; e
 * FR-046 herdado de 002/005).
 *
 * A tela é exercitada com o `ClienteEmMemoria`, o Adapter de teste da Seam
 * `ClienteDoAcervo`, sem servidor. A criação mora em outra tela: aqui se prova
 * que a lista apenas a alcança por ação da pessoa (FR-140), que cada Baralho
 * aparece como uma linha compacta, com o nome abrindo o detalhe, a contagem e
 * controles de nome acessível único (FR-144, SC-079), que o estado vazio
 * orienta a primeira ação (FR-153) e que a falha de listagem oferece nova
 * tentativa (FR-148).
 *
 * O acervo é semeado pela própria Interface — `criarBaralho`, `criarCartao` e
 * `vincular` —, nunca por um caminho que a tela ofereça.
 */

/** Cria um Baralho já vinculado aos Cartões informados, pela Interface. */
async function semearBaralho(
  cliente: ClienteEmMemoria,
  nome: string,
  frentes: string[] = [],
): Promise<string> {
  const criacao = await cliente.criarBaralho({ nome });

  if (!criacao.ok) {
    throw new Error(`Baralho de prova "${nome}" não foi criado.`);
  }

  for (const frente of frentes) {
    const cartao = await cliente.criarCartao({
      frente,
      verso: `Verso de ${frente}`,
    });

    if (!cartao.ok) {
      throw new Error(`Cartão de prova "${frente}" não foi criado.`);
    }

    const vinculo = await cliente.vincular(cartao.cartao.id, criacao.baralho.id);

    if (!vinculo.ok) {
      throw new Error(`Vínculo de prova "${frente}" não foi criado.`);
    }
  }

  return criacao.baralho.id;
}

/** Renderiza a lista com o cliente informado, devolvendo-o para o cenário. */
function renderizarPaginaDeBaralhos(
  cliente: ClienteEmMemoria = clienteDeProva(),
): ClienteEmMemoria {
  render(<PaginaDeBaralhos cliente={cliente} />);

  return cliente;
}

/** O item de lista do Baralho de nome informado, pelo link do próprio nome. */
function itemDoBaralho(nome: string): HTMLElement {
  const link = screen.getByRole("link", { name: nome });
  const item = link.closest("li");

  if (item === null) {
    throw new Error(`Item do Baralho "${nome}" não encontrado.`);
  }

  return item;
}

/** A região do estado vazio, para restringir asserções à sua ação. */
function estadoVazio(): HTMLElement {
  const mensagem = screen.getByText(/ainda não há Baralhos/i);
  const regiao = mensagem.closest("div");

  if (regiao === null) {
    throw new Error("Região do estado vazio não encontrada.");
  }

  return regiao;
}

describe("PaginaDeBaralhos", () => {
  it("apresenta o cabeçalho e alcança a criação apenas por ação da pessoa (FR-140)", async () => {
    renderizarPaginaDeBaralhos();

    expect(
      screen.getByRole("heading", { level: 1, name: "Baralhos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Seu acervo")).toBeInTheDocument();
    expect(
      screen.getByText("Escolha o que você quer memorizar hoje."),
    ).toBeInTheDocument();

    const linkDeCriacao = screen.getByRole("link", { name: "Criar baralho" });
    expect(linkDeCriacao).toHaveAttribute("href", "#/baralhos/novo");

    // A lista não abre formulário nenhum: a criação começa pelo link.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await screen.findByText(/ainda não há Baralhos/i);
  });

  it("o estado vazio orienta a primeira ação com o mesmo acesso à criação (FR-153)", async () => {
    renderizarPaginaDeBaralhos();

    await screen.findByText(/ainda não há Baralhos/i);

    expect(estadoVazio()).toHaveTextContent(
      "Ainda não há Baralhos. Crie o primeiro para começar a estudar.",
    );
    expect(
      within(estadoVazio()).getByRole("link", { name: "Criar baralho" }),
    ).toHaveAttribute("href", "#/baralhos/novo");
  });

  it("lista cada Baralho em uma linha: o nome abre o detalhe e a contagem fica fora do link (FR-144, SC-079)", async () => {
    const cliente = clienteDeProva();
    const idDeIngles = await semearBaralho(cliente, "Inglês", [
      "Hello",
      "Goodbye",
    ]);
    const idDeAlemao = await semearBaralho(cliente, "Alemão");

    renderizarPaginaDeBaralhos(cliente);

    await screen.findAllByRole("listitem");

    const itemDeIngles = itemDoBaralho("Inglês");
    const nomeDeIngles = within(itemDeIngles).getByRole("link", {
      name: "Inglês",
    });

    expect(nomeDeIngles).toHaveAttribute("href", `#/baralhos/${idDeIngles}`);
    expect(itemDeIngles).toHaveTextContent("2 Cartões");

    const itemDeAlemao = itemDoBaralho("Alemão");

    expect(
      within(itemDeAlemao).getByRole("link", { name: "Alemão" }),
    ).toHaveAttribute("href", `#/baralhos/${idDeAlemao}`);
    expect(itemDeAlemao).toHaveTextContent("0 Cartões");

    // A linha compacta não traz rótulo de tipo nem linha de status.
    expect(screen.queryByText("Baralho")).toBeNull();
    expect(within(itemDeIngles).queryByText(/pronto para/i)).toBeNull();
    expect(within(itemDeAlemao).queryByText(/adicione cartões/i)).toBeNull();
  });

  it("pluraliza a contagem de um único Cartão (FR-144)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Inglês", ["Hello"]);

    renderizarPaginaDeBaralhos(cliente);

    await screen.findByRole("listitem");

    expect(itemDoBaralho("Inglês")).toHaveTextContent("1 Cartão");
  });

  it("o Estudar de um Baralho com Cartões é um link para a Sessão de estudo (FR-144)", async () => {
    const cliente = clienteDeProva();
    const id = await semearBaralho(cliente, "Inglês", ["Hello"]);

    renderizarPaginaDeBaralhos(cliente);

    const linkDeEstudo = await screen.findByRole("link", {
      name: "Estudar Inglês",
    });

    expect(linkDeEstudo).toHaveAttribute("href", `#/baralhos/${id}/estudo`);
  });

  it("o Estudar de um Baralho vazio é um botão desabilitado descrito pelo motivo (FR-144)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Alemão");

    renderizarPaginaDeBaralhos(cliente);

    const botaoDeEstudo = await screen.findByRole("button", {
      name: "Estudar Alemão",
    });

    expect(botaoDeEstudo).toBeDisabled();
    expect(botaoDeEstudo).toHaveAccessibleDescription(
      "Sem Cartões para estudar.",
    );
  });

  it("cada Baralho tem exatamente dois controles, com nomes acessíveis únicos (FR-144, SC-079)", async () => {
    const cliente = clienteDeProva();
    const idDeIngles = await semearBaralho(cliente, "Inglês", ["Hello"]);
    await semearBaralho(cliente, "Alemão");

    renderizarPaginaDeBaralhos(cliente);

    await screen.findAllByRole("listitem");

    const itemDeIngles = itemDoBaralho("Inglês");

    // Só dois controles: o nome (detalhe) e o Estudar. Nada de "Ver baralho".
    expect(within(itemDeIngles).getAllByRole("link")).toHaveLength(2);
    expect(within(itemDeIngles).queryAllByRole("button")).toHaveLength(0);

    const nomeDeIngles = within(itemDeIngles).getByRole("link", {
      name: "Inglês",
    });
    expect(nomeDeIngles).toHaveAttribute("href", `#/baralhos/${idDeIngles}`);

    const estudarIngles = within(itemDeIngles).getByRole("link", {
      name: "Estudar Inglês",
    });
    expect(estudarIngles).toHaveTextContent("Estudar");
    expect(estudarIngles).toHaveAttribute(
      "href",
      `#/baralhos/${idDeIngles}/estudo`,
    );

    const itemDeAlemao = itemDoBaralho("Alemão");

    // O Baralho vazio troca o link por um botão desabilitado, e o nome segue
    // sendo o único outro controle.
    expect(within(itemDeAlemao).getAllByRole("link")).toHaveLength(1);
    expect(
      within(itemDeAlemao).getByRole("link", { name: "Alemão" }),
    ).toBeInTheDocument();
    expect(
      within(itemDeAlemao).getByRole("button", { name: "Estudar Alemão" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("link", { name: "Estudar Alemão" }),
    ).not.toBeInTheDocument();

    // Nenhum nome acessível se repete entre os Baralhos.
    expect(screen.queryByRole("link", { name: /ver baralho/i })).toBeNull();
  });

  it("a falha de listagem traz a mensagem da Interface e relê o acervo na nova tentativa (FR-046, FR-148)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Inglês", ["Hello"]);
    cliente.simularIndisponibilidade();

    renderizarPaginaDeBaralhos(cliente);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    );
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();

    cliente.restaurarDisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByRole("listitem")).toHaveTextContent("Inglês");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
