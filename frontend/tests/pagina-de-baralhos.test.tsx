import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS } from "../src/acervo-cliente/cliente";
import { clienteDeProva } from "./apoio-de-prova";
import { LIMITE_DE_CARACTERES_DE_BARALHO } from "../src/acervo-cliente/validacao";
import { PaginaDeBaralhos } from "../src/ui/PaginaDeBaralhos";

/**
 * T107 — telas de lista e criação de Baralho
 * (specs/002-criar-baralho/tasks.md).
 *
 * A tela é exercitada com o `ClienteEmMemoria`, o Adapter de teste da Seam
 * `ClienteDoAcervo`, sem servidor. As asserções cobrem o estado vazio que
 * orienta a primeira ação (FR-057), a comunicação da contagem e do limite
 * durante a digitação (FR-061) e a criação válida que aparece na lista sem
 * recarregar (FR-010, FR-013), sempre com as mensagens em português
 * devolvidas pelo próprio cliente (FR-046).
 *
 * T108 — falha de gravação reportada e conteúdo preservado
 * (specs/002-criar-baralho/tasks.md, FR-044, FR-045, SC-012): com o
 * `ClienteDoAcervo` indisponível, a criação recusada exibe a mensagem devolvida
 * pela Interface, não entra na lista como concluída e deixa o nome intacto
 * para a nova tentativa.
 */

function renderizarPaginaDeBaralhos(): void {
  render(<PaginaDeBaralhos cliente={clienteDeProva()} />);
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

describe("PaginaDeBaralhos", () => {
  it("comunica o estado vazio e orienta a primeira ação (FR-057, FR-046)", async () => {
    renderizarPaginaDeBaralhos();

    expect(
      screen.getByRole("heading", { level: 1, name: "Baralhos" }),
    ).toBeInTheDocument();

    expect(await screen.findByText(/ainda não há Baralhos/i)).toBeInTheDocument();
    expect(
      screen.getByText(/crie o primeiro Baralho/i),
    ).toBeInTheDocument();
  });

  it("comunica a contagem e o limite durante a digitação (FR-061)", () => {
    renderizarPaginaDeBaralhos();

    expect(
      screen.queryByText(/faltam \d+ caracteres para o limite/i),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "x".repeat(90) },
    });

    expect(
      screen.getByText(`90 / ${LIMITE_DE_CARACTERES_DE_BARALHO} caracteres`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Atenção: faltam 10 caracteres para o limite de ${LIMITE_DE_CARACTERES_DE_BARALHO}.`,
      ),
    ).toBeInTheDocument();
  });

  it("criação válida aparece na lista sem recarregar, não elegível e com a razão (FR-010, FR-013, FR-026)", async () => {
    renderizarPaginaDeBaralhos();

    await screen.findByText(/ainda não há Baralhos/i);

    digitar("Inglês");
    submeter();

    const baralhoListado = await screen.findByRole("listitem");

    expect(baralhoListado).toHaveTextContent("Inglês");
    expect(baralhoListado).toHaveTextContent("Cartões 0");
    expect(baralhoListado).toHaveTextContent(
      "Não elegível para estudo: nenhum Cartão vinculado.",
    );
    expect(screen.queryByText(/ainda não há Baralhos/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("");

    // O nome do Baralho é o acesso à tela de Vínculos do próprio Baralho.
    const linkDoBaralho = within(baralhoListado).getByRole("link", {
      name: "Inglês",
    });
    expect(linkDoBaralho.getAttribute("href")).toMatch(/^#\/baralhos\//);
  });

  it("recusa de domínio exibe a mensagem do cliente e não lista o Baralho (FR-046)", async () => {
    renderizarPaginaDeBaralhos();

    await screen.findByText(/ainda não há Baralhos/i);

    digitar("   ");
    submeter();

    expect(
      await screen.findByText(/o nome do baralho não pode ficar vazio/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/ainda não há Baralhos/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("   ");
  });

  it("submete conteúdo acima do limite e exibe a recusa do cliente, sem validar na tela", async () => {
    renderizarPaginaDeBaralhos();

    await screen.findByText(/ainda não há Baralhos/i);

    const textoLongo = "x".repeat(101);
    digitar(textoLongo);

    expect(
      screen.getByText(
        `Atenção: o nome excede o limite de ${LIMITE_DE_CARACTERES_DE_BARALHO} caracteres.`,
      ),
    ).toBeInTheDocument();

    submeter();

    expect(
      await screen.findByText(
        `O nome do baralho deve ter no máximo ${LIMITE_DE_CARACTERES_DE_BARALHO} caracteres; o informado tem 101.`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue(textoLongo);
  });

  it("criação com o cliente indisponível reporta a mensagem da Interface, não conclui e preserva o nome (FR-044, FR-045, SC-012)", async () => {
    const cliente = clienteDeProva();
    render(<PaginaDeBaralhos cliente={cliente} />);

    await screen.findByText(/ainda não há Baralhos/i);

    digitar("Inglês");
    cliente.simularIndisponibilidade();
    submeter();

    expect(
      await within(formularioDeCriacao()).findByRole("alert"),
    ).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS);

    // Nenhuma operação aparece como concluída: nada foi inserido na lista e o
    // estado vazio continua sendo o retratado.
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.getByText(/ainda não há Baralhos/i)).toBeInTheDocument();

    // O conteúdo informado permanece integralmente, pronto para nova tentativa.
    expect(screen.getByLabelText("Nome")).toHaveValue("Inglês");
    expect(screen.getByRole("button", { name: "Criar Baralho" })).toBeEnabled();
  });

  it("a nova tentativa reaproveita o conteúdo preservado e só então conclui a criação (FR-045, SC-012)", async () => {
    const cliente = clienteDeProva();
    render(<PaginaDeBaralhos cliente={cliente} />);

    await screen.findByText(/ainda não há Baralhos/i);

    digitar("Inglês");
    cliente.simularIndisponibilidade();
    submeter();
    await within(formularioDeCriacao()).findByRole("alert");

    cliente.restaurarDisponibilidade();
    submeter();

    const baralhoListado = await screen.findByRole("listitem");
    expect(baralhoListado).toHaveTextContent("Inglês");
    expect(baralhoListado).toHaveTextContent(
      "Não elegível para estudo: nenhum Cartão vinculado.",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("");
  });

  it("cliente indisponível desde o carregamento não apresenta a lista como concluída nem perde o conteúdo digitado (FR-044, FR-045)", async () => {
    const cliente = clienteDeProva();
    cliente.simularIndisponibilidade();

    render(<PaginaDeBaralhos cliente={cliente} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    );
    expect(screen.queryByText(/carregando Baralhos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ainda não há Baralhos/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();

    digitar("Inglês");
    submeter();

    expect(
      await within(formularioDeCriacao()).findByRole("alert"),
    ).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS);
    expect(screen.getByLabelText("Nome")).toHaveValue("Inglês");
  });

  it("depois da falha, o acervo volta e a criação preservada é concluída e visível (FR-044, FR-045, SC-012)", async () => {
    const cliente = clienteDeProva();
    cliente.simularIndisponibilidade();

    render(<PaginaDeBaralhos cliente={cliente} />);

    await screen.findByRole("alert");

    digitar("Inglês");
    submeter();
    await within(formularioDeCriacao()).findByRole("alert");

    cliente.restaurarDisponibilidade();
    submeter();

    const baralhoListado = await screen.findByRole("listitem");
    expect(baralhoListado).toHaveTextContent("Inglês");
    expect(
      screen.queryByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS),
    ).not.toBeInTheDocument();
  });
});
