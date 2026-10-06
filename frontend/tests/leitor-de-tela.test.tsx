import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS } from "../src/acervo-cliente/cliente";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";
import { PaginaDoFormularioDeCartao } from "../src/ui/PaginaDoFormularioDeCartao";
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";

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

async function renderizarLista(indisponivel = false): Promise<void> {
  const cliente = clienteDeProva();
  const resultado = await cliente.criarBaralho({ nome: "Inglês" });
  if (!resultado.ok) throw new Error("Baralho de prova não criado");
  if (indisponivel) cliente.simularIndisponibilidade();
  render(comProtecaoDeSaida(<PaginaDoBaralho cliente={cliente} id={resultado.baralho.id} />, true));
}

async function renderizarFormulario(): Promise<void> {
  const cliente = clienteDeProva();
  const resultado = await cliente.criarBaralho({ nome: "Inglês" });
  if (!resultado.ok) throw new Error("Baralho de prova não criado");
  render(
    comProtecaoDeSaida(
      <PaginaDoFormularioDeCartao cliente={cliente} baralhoId={resultado.baralho.id} />,
      true,
    ),
  );
}

/** Preenche um dos campos do formulário pelo rótulo acessível. */
function digitar(rotulo: "Frente" | "Verso", valor: string): void {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
}

/** Submete o formulário pelo botão acessível. */
function submeter(): void {
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
}

/** O formulário, para restringir asserções à falha de salvamento. */
function formulario(): HTMLFormElement {
  // Ancora no campo Frente, e não no botão "Salvar": durante um salvamento o
  // botão passa a "Salvando…", mas o formulário continua sendo o mesmo.
  const elemento = screen.getByLabelText("Frente").closest("form");

  if (elemento === null) {
    throw new Error("Formulário não encontrado.");
  }

  return elemento;
}

describe("Cartões no Baralho para leitor de tela", () => {
  it("o estado vazio é uma região ativa polida, com nome, papel e estado acessíveis (FR-056, FR-153)", async () => {
    await renderizarLista();

    // Pelo nome acessível, e não por um `getByRole("status")` solto: a página
    // tem mais de uma região viva (o carregamento e a proteção de saída).
    const estadoVazio = await screen.findByRole("status", {
      name: "Lista de Cartões vazia",
    });

    expect(estadoVazio).toHaveAttribute("aria-live", "polite");
    expect(estadoVazio).toHaveAttribute("aria-atomic", "true");
    expect(estadoVazio).toHaveTextContent(/ainda não tem Cartões/i);
    expect(estadoVazio).toHaveTextContent(/Criar Cartão/i);

    // O estado vazio é a única região ativa: nenhum alerta convive com ele.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a falha de listagem é um alerta assertivo com nova tentativa (FR-056, FR-144)", async () => {
    await renderizarLista(true);

    const alerta = await screen.findByRole("alert");

    expect(alerta).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS);
    expect(alerta).not.toHaveAttribute("aria-live");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    // A faixa de contagem (role="status") existe sempre, mas deve ficar vazia durante a falha para não competir com o alerta.
    for (const regiao of screen.queryAllByRole("status")) {
      expect(regiao).toBeEmptyDOMElement();
    }
  });

  it.each(CASOS_DE_RECUSA)(
    "a recusa $descricao é um alerta nomeado no formulário (FR-056, FR-155)",
    async (caso) => {
      await renderizarFormulario();

      digitar("Frente", caso.frente);
      digitar("Verso", caso.verso);
      submeter();

      const alerta = await within(formulario()).findByRole("alert");

      expect(alerta).toHaveAccessibleName("Falha na criação do Cartão");
      expect(alerta).toHaveTextContent(caso.mensagem);
      expect(alerta).not.toHaveAttribute("aria-live");
      expect(screen.getAllByRole("alert")).toHaveLength(1);
    },
  );

  it("cada nova tentativa recusada insere um alerta novo, reanunciável (FR-056)", async () => {
    await renderizarFormulario();

    digitar("Frente", "   ");
    digitar("Verso", "Caminhar");
    submeter();

    const primeiro = await within(formulario()).findByRole("alert");

    // A mesma recusa de novo: o alerta anterior sai da árvore e um novo é
    // inserido — é a inserção na região ativa que dispara o anúncio.
    submeter();

    const segundo = await within(formulario()).findByRole("alert");

    expect(segundo).not.toBe(primeiro);
    expect(segundo).toHaveAccessibleName("Falha na criação do Cartão");
    expect(segundo).toHaveTextContent(/a frente do cartão não pode ficar vazia/i);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});
