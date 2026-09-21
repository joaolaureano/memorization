import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { PaginaDeCartoes } from "../src/ui/PaginaDeCartoes";

/**
 * T012 — Erros e estado vazio perceptíveis por leitor de tela
 * (specs/001-criar-cartao/tasks.md, FR-056).
 *
 * As asserções consultam a semântica acessível, não o texto puro: papel por
 * `getByRole`, nome por `toHaveAccessibleName` e estado de região ativa por
 * `aria-live`/`aria-atomic`. O estado vazio é uma região ativa polida
 * (`role="status"`); as falhas de listagem e de criação são regiões
 * assertivas (`role="alert"`), cada uma única e nomeada no seu contexto e
 * **sem** `aria-live` explícito — o valor redundante sobre o alerta poderia
 * duplicar o anúncio. O conteúdo da região é a mensagem anunciada, e o
 * `aria-label` nomeia a região sem repetir a mensagem: nas duas falhas
 * simultâneas de transporte, a mesma mensagem em dois contextos permanece
 * inequívoca.
 *
 * A tela é exercitada com o `ClienteEmMemoria` pela Interface
 * `ClienteDoAcervo`, sem servidor. O jsdom não executa leitor de tela: o
 * anúncio é comprovado pela semântica que o dispara — conteúdo inserido em
 * região ativa com nome, papel e estado corretos — e pela garantia de que um
 * alerta já presente nunca é reaproveitado como anúncio novo.
 */

interface CasoDeRecusa {
  descricao: string;
  frente: string;
  verso: string;
  mensagem: RegExp;
}

/** Os quatro modos de recusa de regra de Cartão (mesma bateria de T011). */
const CASOS_DE_RECUSA: CasoDeRecusa[] = [
  {
    descricao: "frente_vazia",
    frente: "   ",
    verso: "Caminhar",
    mensagem: /a frente do cartão não pode ficar vazia/i,
  },
  {
    descricao: "frente_muito_longa",
    frente: "x".repeat(1001),
    verso: "Caminhar",
    mensagem: /a frente do cartão deve ter no máximo 1000 caracteres/i,
  },
  {
    descricao: "verso_vazio",
    frente: "To walk",
    verso: "   ",
    mensagem: /o verso do cartão não pode ficar vazio/i,
  },
  {
    descricao: "verso_muito_longo",
    frente: "To walk",
    verso: "x".repeat(1001),
    mensagem: /o verso do cartão deve ter no máximo 1000 caracteres/i,
  },
];

function renderizarPaginaDeCartoes(): void {
  render(<PaginaDeCartoes cliente={new ClienteEmMemoria()} />);
}

/** Preenche um dos campos do formulário de criação pelo rótulo acessível. */
function digitar(rotulo: "Frente" | "Verso", valor: string): void {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
}

/** Submete o formulário de criação pelo botão acessível. */
function submeter(): void {
  fireEvent.click(screen.getByRole("button", { name: "Criar Cartão" }));
}

/** O formulário de criação, para restringir asserções à falha da criação. */
function formularioDeCriacao(): HTMLFormElement {
  const formulario = screen
    .getByRole("button", { name: "Criar Cartão" })
    .closest("form");

  if (formulario === null) {
    throw new Error("Formulário de criação não encontrado.");
  }

  return formulario;
}

/** A seção da lista, para restringir asserções à falha da listagem. */
function secaoDaLista(): HTMLElement {
  const titulo = screen.getByRole("heading", {
    level: 2,
    name: "Lista de Cartões",
  });
  const secao = titulo.closest("section");

  if (secao === null) {
    throw new Error("Seção da lista não encontrada.");
  }

  return secao;
}

describe("PaginaDeCartoes para leitor de tela", () => {
  it("o estado vazio é uma região ativa polida, com nome, papel e estado acessíveis (FR-056)", async () => {
    renderizarPaginaDeCartoes();

    const estadoVazio = await screen.findByRole("status");

    expect(estadoVazio).toHaveAccessibleName("Estado vazio da lista de Cartões");
    expect(estadoVazio).toHaveAttribute("aria-live", "polite");
    expect(estadoVazio).toHaveAttribute("aria-atomic", "true");

    // A mensagem anunciada é o conteúdo da região, em português (FR-046).
    expect(estadoVazio).toHaveTextContent(/ainda não há Cartões/i);
    expect(estadoVazio).toHaveTextContent(/crie o primeiro Cartão/i);

    // O estado vazio é a única região ativa: nenhum alerta convive com ele,
    // para que o anúncio não seja duplicado nem ambíguo.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(within(secaoDaLista()).getByRole("status")).toBe(estadoVazio);
  });

  it("a falha de listagem é um alerta assertivo nomeado, único na página (FR-056)", async () => {
    const cliente = new ClienteEmMemoria();
    cliente.simularIndisponibilidade();
    render(<PaginaDeCartoes cliente={cliente} />);

    const alerta = await screen.findByRole("alert");

    expect(alerta).toHaveAccessibleName("Falha na listagem de Cartões");
    expect(alerta).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE);

    // O papel `alert` já implica região assertiva e atômica; nenhum
    // `aria-live` explícito redundante, que poderia duplicar o anúncio.
    expect(alerta).not.toHaveAttribute("aria-live");

    // Um único alerta, na seção da lista — e o estado vazio não é anunciado
    // junto, pois a lista não respondeu com sucesso.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(within(secaoDaLista()).getByRole("alert")).toBe(alerta);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(CASOS_DE_RECUSA)(
    "a recusa $descricao é um alerta nomeado no formulário, sem duplicar anúncios (FR-056)",
    async (caso) => {
      renderizarPaginaDeCartoes();
      await screen.findByRole("status");

      digitar("Frente", caso.frente);
      digitar("Verso", caso.verso);
      submeter();

      const alerta = await within(formularioDeCriacao()).findByRole("alert");

      expect(alerta).toHaveAccessibleName("Falha na criação do Cartão");
      expect(alerta).toHaveTextContent(caso.mensagem);
      expect(alerta).not.toHaveAttribute("aria-live");

      // Um único alerta no documento: a recusa da criação não duplica o
      // anúncio, e a listagem continua sendo anunciada só pelo estado vazio.
      expect(screen.getAllByRole("alert")).toHaveLength(1);
      expect(within(secaoDaLista()).queryByRole("alert")).not.toBeInTheDocument();
      expect(within(secaoDaLista()).getByRole("status")).toBeInTheDocument();
    },
  );

  it("falhas simultâneas de listagem e criação ficam em regiões nomeadas, uma por contexto (FR-056)", async () => {
    const cliente = new ClienteEmMemoria();
    cliente.simularIndisponibilidade();
    render(<PaginaDeCartoes cliente={cliente} />);
    await screen.findByRole("alert");

    digitar("Frente", "To walk");
    digitar("Verso", "Caminhar");
    submeter();

    const alertaDeCriacao = await within(
      formularioDeCriacao(),
    ).findByRole("alert");

    expect(alertaDeCriacao).toHaveAccessibleName("Falha na criação do Cartão");
    expect(alertaDeCriacao).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE);

    // A mesma mensagem em dois contextos distintos: cada contexto tem
    // exatamente uma região assertiva, e cada região é nomeada pelo seu
    // contexto — nenhum anúncio duplicado nem ambíguo.
    expect(within(formularioDeCriacao()).getAllByRole("alert")).toHaveLength(1);
    expect(within(secaoDaLista()).getAllByRole("alert")).toHaveLength(1);
    expect(within(secaoDaLista()).getByRole("alert")).toHaveAccessibleName(
      "Falha na listagem de Cartões",
    );
  });

  it("cada nova tentativa recusada insere um alerta novo, reanunciável (FR-056)", async () => {
    renderizarPaginaDeCartoes();
    await screen.findByRole("status");

    digitar("Frente", "   ");
    digitar("Verso", "Caminhar");
    submeter();

    const primeiro = await within(formularioDeCriacao()).findByRole("alert");

    // A mesma recusa de novo: o alerta anterior sai da árvore e um novo é
    // inserido — é a inserção na região ativa que dispara o anúncio. Um
    // alerta já presente e apenas reescrito poderia passar despercebido.
    submeter();

    const segundo = await within(formularioDeCriacao()).findByRole("alert");

    expect(segundo).not.toBe(primeiro);
    expect(segundo).toHaveAccessibleName("Falha na criação do Cartão");
    expect(segundo).toHaveTextContent(/a frente do cartão não pode ficar vazia/i);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});
