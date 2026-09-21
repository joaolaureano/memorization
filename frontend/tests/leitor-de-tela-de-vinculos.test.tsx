import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";

/**
 * T211 — mudanças de Vínculo e de elegibilidade perceptíveis por leitor de
 * tela (specs/003-vincular-cartao-baralho/tasks.md, FR-065).
 *
 * O jsdom não executa leitor de tela: o anúncio é comprovado pela semântica
 * que o dispara — a mudança é inserida numa região ativa polida
 * (`role="status"`) com nome acessível e `aria-live`/`aria-atomic`
 * explícitos. A elegibilidade é anunciada no mesmo anúncio, sem depender de
 * cor. A falha é uma região assertiva (`role="alert"`), nomeada no contexto
 * da operação.
 */

interface AcervoDeTeste {
  cliente: ClienteEmMemoria;
  idDoBaralho: string;
  idDoPrimeiroCartao: string;
  idDoSegundoCartao: string;
}

async function criarAcervoDeTeste(): Promise<AcervoDeTeste> {
  const cliente = new ClienteEmMemoria();
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

describe("PaginaDoBaralho para leitor de tela", () => {
  it("vincular e a elegibilidade decorrente são anunciados em região ativa polida (FR-065)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTeste();
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("button", { name: "Vincular To walk" });

    fireEvent.click(
      screen.getByRole("button", { name: "Vincular To walk" }),
    );

    const anuncio = await screen.findByRole("status");

    expect(anuncio).toHaveAccessibleName("Mudança de Vínculo");
    expect(anuncio).toHaveAttribute("aria-live", "polite");
    expect(anuncio).toHaveAttribute("aria-atomic", "true");
    expect(anuncio).toHaveTextContent(/Cartão vinculado ao Baralho\./);
    expect(anuncio).toHaveTextContent(
      /O Baralho tornou-se elegível para estudo\./,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("desvincular e a perda de elegibilidade são anunciados em região ativa polida (FR-065)", async () => {
    const { cliente, idDoBaralho, idDoPrimeiroCartao } =
      await criarAcervoDeTeste();
    await cliente.vincular(idDoPrimeiroCartao, idDoBaralho);

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("button", { name: "Desvincular To walk" });

    fireEvent.click(
      screen.getByRole("button", { name: "Desvincular To walk" }),
    );

    const anuncio = await screen.findByRole("status");

    expect(anuncio).toHaveAccessibleName("Mudança de Vínculo");
    expect(anuncio).toHaveAttribute("aria-live", "polite");
    expect(anuncio).toHaveAttribute("aria-atomic", "true");
    expect(anuncio).toHaveTextContent(/Cartão desvinculado do Baralho\./);
    expect(anuncio).toHaveTextContent(
      /O Baralho deixou de ser elegível para estudo\./,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a falha de Vínculo é um alerta assertivo nomeado, e não um anúncio de sucesso (FR-065, FR-044)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTeste();
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("button", { name: "Vincular To walk" });

    cliente.simularIndisponibilidade();
    fireEvent.click(
      screen.getByRole("button", { name: "Vincular To walk" }),
    );

    const alerta = await screen.findByRole("alert");

    expect(alerta).toHaveAccessibleName("Falha na operação de Vínculo");
    expect(alerta).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS);
    expect(alerta).not.toHaveAttribute("aria-live");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("o estado vazio sem Cartões é uma região ativa polida e nomeada (FR-062, FR-065)", async () => {
    const cliente = new ClienteEmMemoria();
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!baralho.ok) {
      throw new Error("a criação do Baralho deveria ser aceita");
    }

    renderizar(cliente, baralho.baralho.id);

    const estadoVazio = await screen.findByRole("status");

    expect(estadoVazio).toHaveAccessibleName(
      "Estado vazio da tela de Vínculos",
    );
    expect(estadoVazio).toHaveAttribute("aria-live", "polite");
    expect(estadoVazio).toHaveAttribute("aria-atomic", "true");
    expect(estadoVazio).toHaveTextContent(
      "Ainda não há Cartões. Crie um Cartão antes de vincular.",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      within(document.body).getAllByRole("status"),
    ).toHaveLength(1);
  });
});
