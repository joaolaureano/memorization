import { fireEvent, render, screen, within } from "@testing-library/react";
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
 * de lista com o nome em texto somente leitura, a etiqueta textual da
 * Situação da revisão e as ações Revisar e Editar, de nome acessível único
 * (spec 021: FR-340–FR-343; spec 024: FR-378–FR-381), e a elegibilidade se
 * comunica pelo controle Revisar — quando vazio, por um motivo em texto
 * associado ao botão desabilitado.
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
    const cartao = await cliente.criarCartao(criacao.baralho.id, {
      frente,
      verso: `Verso de ${frente}`,
    });

    if (!cartao.ok) {
      throw new Error(`Cartão de prova "${frente}" não foi criado.`);
    }

  }
}

/** O item de lista do Baralho de nome informado, pelo texto do próprio nome. */
function itemDoBaralho(nome: string): HTMLElement {
  const item = screen.getByText(nome).closest("li");

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

    // A faixa de contagem da busca (spec 022) também é `role="status"`: a
    // região do carregamento é localizada de forma inequívoca pelo próprio
    // texto, não pelo papel.
    const regiaoDoCarregamento = screen
      .getByText("Carregando Baralhos…")
      .closest('[role="status"]');

    expect(regiaoDoCarregamento).toHaveTextContent("Carregando Baralhos…");

    await screen.findByText(/ainda não há Baralhos/i);

    expect(regiaoDoCarregamento).not.toBeInTheDocument();
  });

  it("o estado vazio traz a mensagem e o acesso à criação (FR-153)", async () => {
    render(<PaginaDeBaralhos cliente={clienteDeProva()} />);

    await screen.findByText(/ainda não há Baralhos/i);

    expect(regiaoDoEstadoVazio()).toHaveTextContent(
      "Ainda não há Baralhos. Crie o primeiro para começar a revisar.",
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

  it("cada Baralho é um item de lista com nome, contagem, etiqueta e as ações Revisar e Editar (FR-340, FR-343, FR-381)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Inglês", ["Hello"]);
    await semearBaralho(cliente, "Alemão");

    render(<PaginaDeBaralhos cliente={cliente} />);

    await screen.findAllByRole("listitem");

    const itemDeIngles = itemDoBaralho("Inglês");

    expect(itemDeIngles).toHaveRole("listitem");
    expect(within(itemDeIngles).getByText("1 Cartão")).toBeInTheDocument();
    // Sem Agendamento, a etiqueta textual é «Pendente» — nunca só cor.
    expect(within(itemDeIngles).getByText("Pendente")).toBeVisible();
    expect(
      within(itemDeIngles).getByRole("link", { name: "Revisar Inglês" }),
    ).toHaveAttribute("href", expect.stringMatching(/^#\/baralhos\/.+\/estudo$/));
    expect(
      within(itemDeIngles).getByRole("link", { name: "Editar Inglês" }),
    ).toHaveAttribute("href", expect.stringMatching(/^#\/baralhos\/[^/]+$/));
    expect(within(itemDeIngles).getAllByRole("link")).toHaveLength(2);

    const itemDeAlemao = itemDoBaralho("Alemão");

    expect(within(itemDeAlemao).getByText("0 Cartões")).toBeInTheDocument();
    expect(within(itemDeAlemao).getByText("Sem cartões")).toBeVisible();
    expect(
      within(itemDeAlemao).getByRole("button", { name: "Revisar Alemão" }),
    ).toBeDisabled();
    expect(
      within(itemDeAlemao).getByRole("link", { name: "Editar Alemão" }),
    ).toBeInTheDocument();
  });

  it("o nome do Baralho não é link e clicar nele não navega (FR-341)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Inglês", ["Hello", "Goodbye"]);

    render(<PaginaDeBaralhos cliente={cliente} />);

    await screen.findByRole("listitem");

    const nome = within(itemDoBaralho("Inglês")).getByText("Inglês");

    expect(screen.queryByRole("link", { name: "Inglês" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Inglês" })).toBeNull();
    expect(nome).not.toHaveAttribute("tabindex");
    expect(nome.closest("a")).toBeNull();

    const hashAntes = window.location.hash;
    fireEvent.click(nome);
    expect(window.location.hash).toBe(hashAntes);
  });

  it("o Revisar desabilitado expõe o motivo em texto e o Editar segue disponível (FR-343, FR-380)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Alemão");

    render(<PaginaDeBaralhos cliente={cliente} />);

    await screen.findByRole("listitem");

    const item = itemDoBaralho("Alemão");
    const botaoDeRevisao = within(item).getByRole("button", {
      name: "Revisar Alemão",
    });

    expect(botaoDeRevisao).toBeDisabled();
    expect(botaoDeRevisao).toHaveAccessibleDescription(
      "Sem Cartões para revisar.",
    );
    expect(
      within(item).getByRole("link", { name: "Editar Alemão" }),
    ).toHaveAttribute("href", expect.stringMatching(/^#\/baralhos\/[^/]+$/));
  });

});
