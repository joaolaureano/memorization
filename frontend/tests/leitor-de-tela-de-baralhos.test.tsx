import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS } from "../src/acervo-cliente/cliente";
import type { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva } from "./apoio-de-prova";
import { PaginaDeBaralhos } from "../src/ui/PaginaDeBaralhos";

/**
 * T1109 — a lista de Baralhos perceptível por leitor de tela (spec 012:
 * FR-144, FR-148, FR-153; FR-060 herdado de 002/005).
 *
 * As asserções consultam a semântica acessível, não o texto puro: papel por
 * `getByRole`, nome por `getByRole`/`toHaveAccessibleDescription` e estado de
 * região ativa por `aria-live`. O carregamento é uma região ativa polida
 * (`role="status"`); a falha é uma região assertiva (`role="alert"`), com a
 * mensagem da Interface e a ação de nova tentativa. Cada Baralho é um item
 * de lista cujo nome é o próprio link do detalhe, com ações de nome acessível
 * único, e a elegibilidade se comunica pelo controle Estudar — quando vazio,
 * por um motivo em texto associado ao botão desabilitado.
 */

/** Cria um Baralho já vinculado aos Cartões informados, pela Interface. */
async function semearBaralho(
  cliente: ClienteEmMemoria,
  nome: string,
  frentes: string[] = [],
): Promise<void> {
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
function regiaoDoEstadoVazio(): HTMLElement {
  const mensagem = screen.getByText(/ainda não há Baralhos/i);
  const regiao = mensagem.closest("div");

  if (regiao === null) {
    throw new Error("Região do estado vazio não encontrada.");
  }

  return regiao;
}

describe("PaginaDeBaralhos para leitor de tela", () => {
  it("anuncia o carregamento como região ativa polida (FR-153)", async () => {
    render(<PaginaDeBaralhos cliente={clienteDeProva()} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Carregando Baralhos…",
    );

    await screen.findByText(/ainda não há Baralhos/i);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("o estado vazio traz a mensagem e o acesso à criação (FR-153)", async () => {
    render(<PaginaDeBaralhos cliente={clienteDeProva()} />);

    await screen.findByText(/ainda não há Baralhos/i);

    expect(regiaoDoEstadoVazio()).toHaveTextContent(
      "Ainda não há Baralhos. Crie o primeiro para começar a estudar.",
    );
    expect(
      within(regiaoDoEstadoVazio()).getByRole("link", { name: "Criar baralho" }),
    ).toHaveAttribute("href", "#/baralhos/novo");

    // O vazio não é uma falha: nenhuma região assertiva convive com ele.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a falha é uma região assertiva com a mensagem da Interface e a nova tentativa (FR-046, FR-148)", async () => {
    const cliente = clienteDeProva();
    cliente.simularIndisponibilidade();

    render(<PaginaDeBaralhos cliente={cliente} />);

    const alerta = await screen.findByRole("alert");

    expect(alerta).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS);
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    // O papel `alert` já implica região assertiva e atômica; nenhum
    // `aria-live` explícito redundante, que poderia duplicar o anúncio.
    expect(alerta).not.toHaveAttribute("aria-live");

    expect(
      within(alerta).getByRole("button", { name: "Tentar novamente" }),
    ).toBeEnabled();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("cada Baralho é um item de lista cujo nome abre o detalhe, com ações nomeadas (FR-144)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Inglês", ["Hello"]);
    await semearBaralho(cliente, "Alemão");

    render(<PaginaDeBaralhos cliente={cliente} />);

    await screen.findAllByRole("listitem");

    const itemDeIngles = itemDoBaralho("Inglês");

    expect(
      within(itemDeIngles).getByRole("link", { name: "Inglês" }),
    ).toHaveAttribute("href", expect.stringMatching(/^#\/baralhos\/.+$/));
    expect(
      within(itemDeIngles).getByRole("link", { name: "Estudar Inglês" }),
    ).toBeInTheDocument();

    const itemDeAlemao = itemDoBaralho("Alemão");

    expect(
      within(itemDeAlemao).getByRole("link", { name: "Alemão" }),
    ).toBeInTheDocument();
    expect(
      within(itemDeAlemao).getByRole("button", { name: "Estudar Alemão" }),
    ).toBeDisabled();
  });

  it("o nome acessível do link é só o nome; a contagem é a sua descrição (FR-144)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Inglês", ["Hello", "Goodbye"]);

    render(<PaginaDeBaralhos cliente={cliente} />);

    await screen.findByRole("listitem");

    const item = itemDoBaralho("Inglês");
    const linkDoNome = within(item).getByRole("link", { name: "Inglês" });

    // A contagem está dentro do link e é decoração: não entra no nome.
    expect(linkDoNome).toHaveAccessibleName("Inglês");
    expect(linkDoNome).toHaveAccessibleDescription("2 Cartões");

    // A linha continua com exatamente dois controles: o nome e o Estudar.
    expect(within(item).getAllByRole("link")).toHaveLength(2);
  });

  it("o Estudar desabilitado expõe o motivo em texto, não só pela cor (FR-144)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Alemão");

    render(<PaginaDeBaralhos cliente={cliente} />);

    await screen.findByRole("listitem");

    const item = itemDoBaralho("Alemão");
    const botaoDeEstudo = within(item).getByRole("button", {
      name: "Estudar Alemão",
    });

    expect(botaoDeEstudo).toBeDisabled();
    expect(botaoDeEstudo).toHaveAccessibleDescription(
      "Sem Cartões para estudar.",
    );
    expect(within(item).queryByText(/elegível/i)).not.toBeInTheDocument();
  });
});
