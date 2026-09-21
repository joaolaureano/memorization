import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { PaginaDeBaralhos } from "../src/ui/PaginaDeBaralhos";

/**
 * T110 — Erros e estado vazio perceptíveis por leitor de tela
 * (specs/002-criar-baralho/tasks.md, FR-060).
 *
 * As asserções consultam a semântica acessível, não o texto puro: papel por
 * `getByRole`, nome por `toHaveAccessibleName` e estado de região ativa por
 * `aria-live`/`aria-atomic`. O estado vazio é uma região ativa polida
 * (`role="status"`); as falhas de listagem e de criação são regiões
 * assertivas (`role="alert"`), cada uma única e nomeada no seu contexto e
 * **sem** `aria-live` explícito — o valor redundante sobre o alerta poderia
 * duplicar o anúncio. O conteúdo da região é a mensagem anunciada, e o
 * `aria-label` nomeia a região sem repetir a mensagem.
 */

interface CasoDeRecusa {
  descricao: string;
  nome: string;
  mensagem: RegExp;
}

/** Os dois modos de recusa de regra de Baralho (mesma bateria de T109). */
const CASOS_DE_RECUSA: CasoDeRecusa[] = [
  {
    descricao: "nome_vazio",
    nome: "   ",
    mensagem: /o nome do baralho não pode ficar vazio/i,
  },
  {
    descricao: "nome_muito_longo",
    nome: "x".repeat(101),
    mensagem: /o nome do baralho deve ter no máximo 100 caracteres/i,
  },
];

function renderizarPaginaDeBaralhos(): void {
  render(<PaginaDeBaralhos cliente={new ClienteEmMemoria()} />);
}

/** Preenche o campo do formulário de criação pelo rótulo acessível. */
function digitar(valor: string): void {
  fireEvent.change(screen.getByLabelText("Nome"), {
    target: { value: valor },
  });
}

/** Submete o formulário de criação pelo botão acessível. */
function submeter(): void {
  fireEvent.click(screen.getByRole("button", { name: "Criar Baralho" }));
}

/** O formulário de criação, para restringir asserções à falha da criação. */
function formularioDeCriacao(): HTMLFormElement {
  const formulario = screen
    .getByRole("button", { name: "Criar Baralho" })
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
    name: "Lista de Baralhos",
  });
  const secao = titulo.closest("section");

  if (secao === null) {
    throw new Error("Seção da lista não encontrada.");
  }

  return secao;
}

describe("PaginaDeBaralhos para leitor de tela", () => {
  it("o estado vazio é uma região ativa polida, com nome, papel e estado acessíveis (FR-060)", async () => {
    renderizarPaginaDeBaralhos();

    const estadoVazio = await screen.findByRole("status");

    expect(estadoVazio).toHaveAccessibleName("Estado vazio da lista de Baralhos");
    expect(estadoVazio).toHaveAttribute("aria-live", "polite");
    expect(estadoVazio).toHaveAttribute("aria-atomic", "true");

    // A mensagem anunciada é o conteúdo da região, em português (FR-046).
    expect(estadoVazio).toHaveTextContent(/ainda não há Baralhos/i);
    expect(estadoVazio).toHaveTextContent(/crie o primeiro Baralho/i);

    // O estado vazio é a única região ativa: nenhum alerta convive com ele.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(within(secaoDaLista()).getByRole("status")).toBe(estadoVazio);
  });

  it("a falha de listagem é um alerta assertivo nomeado, único na página (FR-060)", async () => {
    const cliente = new ClienteEmMemoria();
    cliente.simularIndisponibilidade();
    render(<PaginaDeBaralhos cliente={cliente} />);

    const alerta = await screen.findByRole("alert");

    expect(alerta).toHaveAccessibleName("Falha na listagem de Baralhos");
    expect(alerta).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS);

    // O papel `alert` já implica região assertiva e atômica; nenhum
    // `aria-live` explícito redundante, que poderia duplicar o anúncio.
    expect(alerta).not.toHaveAttribute("aria-live");

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(within(secaoDaLista()).getByRole("alert")).toBe(alerta);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(CASOS_DE_RECUSA)(
    "a recusa $descricao é um alerta nomeado no formulário, sem duplicar anúncios (FR-060)",
    async (caso) => {
      renderizarPaginaDeBaralhos();
      await screen.findByRole("status");

      digitar(caso.nome);
      submeter();

      const alerta = await within(formularioDeCriacao()).findByRole("alert");

      expect(alerta).toHaveAccessibleName("Falha na criação do Baralho");
      expect(alerta).toHaveTextContent(caso.mensagem);
      expect(alerta).not.toHaveAttribute("aria-live");

      // Um único alerta no documento: a recusa da criação não duplica o
      // anúncio, e a listagem continua sendo anunciada só pelo estado vazio.
      expect(screen.getAllByRole("alert")).toHaveLength(1);
      expect(within(secaoDaLista()).queryByRole("alert")).not.toBeInTheDocument();
      expect(within(secaoDaLista()).getByRole("status")).toBeInTheDocument();
    },
  );

  it("falhas simultâneas de listagem e criação ficam em regiões nomeadas, uma por contexto (FR-060)", async () => {
    const cliente = new ClienteEmMemoria();
    cliente.simularIndisponibilidade();
    render(<PaginaDeBaralhos cliente={cliente} />);
    await screen.findByRole("alert");

    digitar("Inglês");
    submeter();

    const alertaDeCriacao = await within(
      formularioDeCriacao(),
    ).findByRole("alert");

    expect(alertaDeCriacao).toHaveAccessibleName("Falha na criação do Baralho");
    expect(alertaDeCriacao).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    );

    // A mesma mensagem em dois contextos distintos: cada contexto tem
    // exatamente uma região assertiva, e cada região é nomeada pelo seu
    // contexto — nenhum anúncio duplicado nem ambíguo.
    expect(within(formularioDeCriacao()).getAllByRole("alert")).toHaveLength(1);
    expect(within(secaoDaLista()).getAllByRole("alert")).toHaveLength(1);
    expect(within(secaoDaLista()).getByRole("alert")).toHaveAccessibleName(
      "Falha na listagem de Baralhos",
    );
  });

  it("cada nova tentativa recusada insere um alerta novo, reanunciável (FR-060)", async () => {
    renderizarPaginaDeBaralhos();
    await screen.findByRole("status");

    digitar("   ");
    submeter();

    const primeiro = await within(formularioDeCriacao()).findByRole("alert");

    // A mesma recusa de novo: o alerta anterior sai da árvore e um novo é
    // inserido — é a inserção na região ativa que dispara o anúncio.
    submeter();

    const segundo = await within(formularioDeCriacao()).findByRole("alert");

    expect(segundo).not.toBe(primeiro);
    expect(segundo).toHaveAccessibleName("Falha na criação do Baralho");
    expect(segundo).toHaveTextContent(/o nome do baralho não pode ficar vazio/i);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});
