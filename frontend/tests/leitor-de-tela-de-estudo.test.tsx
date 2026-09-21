import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva } from "./apoio-de-prova";
import { AleatoriedadeDeterministica } from "../src/sessao-de-estudo/aleatoriedade";
import {
  MENSAGEM_DE_QUANTIDADE_INVALIDA,
} from "../src/sessao-de-estudo/sessao-de-estudo";
import { PaginaDeEstudo } from "../src/ui/PaginaDeEstudo";

/**
 * T306 — mudanças de estado da Sessão perceptíveis por leitor de tela
 * (specs/004-sessao-de-estudo/tasks.md, FR-049).
 *
 * O jsdom não executa leitor de tela: o anúncio é comprovado pela semântica
 * que o dispara. Verso revelado, Resultado registrado e Sessão concluída são
 * inseridos numa região ativa polida (`role="status"`) com nome acessível e
 * `aria-live`/`aria-atomic` explícitos. A recusa de início é uma região
 * assertiva (`role="alert"`), nomeada no contexto da operação e sem
 * `aria-live` redundante.
 */

async function criarAcervoElegivel(
  quantidadeDeCartoes: number,
): Promise<{
  cliente: ClienteEmMemoria;
  idDoBaralho: string;
}> {
  const cliente = clienteDeProva();

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
      aleatoriedade={new AleatoriedadeDeterministica([0, 0])}
    />,
  );
}

async function iniciarSessao(
  cliente: ClienteEmMemoria,
  idDoBaralho: string,
  quantidade: string,
): Promise<void> {
  renderizar(cliente, idDoBaralho);
  await screen.findByRole("heading", {
    level: 1,
    name: "Estudar Inglês",
  });

  fireEvent.change(screen.getByLabelText("Quantidade de Cartões"), {
    target: { value: quantidade },
  });
  fireEvent.click(screen.getByRole("button", { name: "Iniciar Sessão" }));
}

describe("PaginaDeEstudo para leitor de tela", () => {
  it("a Revelação é anunciada em região ativa polida e nomeada (FR-049)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    await iniciarSessao(cliente, idDoBaralho, "2");

    fireEvent.click(screen.getByRole("button", { name: "Revelar" }));

    const anuncio = await screen.findByRole("status");

    expect(anuncio).toHaveAccessibleName("Mudança de estado da Sessão");
    expect(anuncio).toHaveAttribute("aria-live", "polite");
    expect(anuncio).toHaveAttribute("aria-atomic", "true");
    expect(anuncio).toHaveTextContent(/Verso revelado\./);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("o Resultado registrado é anunciado em região ativa polida (FR-049)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    await iniciarSessao(cliente, idDoBaralho, "2");

    fireEvent.click(screen.getByRole("button", { name: "Revelar" }));
    await screen.findByText(/Verso revelado\./);

    fireEvent.click(screen.getByRole("button", { name: "Acertei" }));

    const anuncio = await screen.findByRole("status");

    expect(anuncio).toHaveAccessibleName("Mudança de estado da Sessão");
    expect(anuncio).toHaveAttribute("aria-live", "polite");
    expect(anuncio).toHaveAttribute("aria-atomic", "true");
    expect(anuncio).toHaveTextContent(/Resultado registrado: acertou\./);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a conclusão é anunciada e o Resumo é perceptível (FR-049, FR-037)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(1);
    await iniciarSessao(cliente, idDoBaralho, "1");

    fireEvent.click(screen.getByRole("button", { name: "Revelar" }));
    await screen.findByText(/Verso revelado\./);

    fireEvent.click(screen.getByRole("button", { name: "Errei" }));

    const anuncio = await screen.findByRole("status");

    expect(anuncio).toHaveAccessibleName("Mudança de estado da Sessão");
    expect(anuncio).toHaveTextContent(/Sessão concluída\./);
    expect(
      await screen.findByRole("heading", { name: "Resumo da Sessão" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Itens estudados: 1")).toBeInTheDocument();
    expect(screen.getByText("Acertos: 0")).toBeInTheDocument();
    expect(screen.getByText("Erros: 1")).toBeInTheDocument();
  });

  it("a recusa de início é um alerta assertivo nomeado, sem duplicar anúncios (FR-049, FR-028)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    renderizar(cliente, idDoBaralho);
    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    fireEvent.change(screen.getByLabelText("Quantidade de Cartões"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Sessão" }));

    const alerta = await screen.findByRole("alert");

    expect(alerta).toHaveAccessibleName("Falha ao iniciar a Sessão");
    expect(alerta).toHaveTextContent(MENSAGEM_DE_QUANTIDADE_INVALIDA);
    expect(alerta).not.toHaveAttribute("aria-live");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
