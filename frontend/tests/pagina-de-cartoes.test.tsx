import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE } from "../src/acervo-cliente/cliente";
import { clienteDeProva } from "./apoio-de-prova";
import { LIMITE_DE_CARACTERES_DE_CARTAO } from "../src/acervo-cliente/validacao";
import { PaginaDeCartoes } from "../src/ui/PaginaDeCartoes";

/**
 * T009 — telas de lista e criação de Cartão
 * (specs/001-criar-cartao/tasks.md).
 *
 * A tela é exercitada com o `ClienteEmMemoria`, o Adapter de teste da Seam
 * `ClienteDoAcervo`, sem servidor. As asserções cobrem o estado vazio que
 * orienta a primeira ação (FR-043), a comunicação da contagem e do limite
 * durante a digitação (FR-053) e a criação válida que aparece na lista sem
 * recarregar (FR-001, FR-003, FR-004), sempre com as mensagens em português
 * devolvidas pelo próprio cliente (FR-046).
 *
 * T010 — falha de gravação reportada e conteúdo preservado
 * (specs/001-criar-cartao/tasks.md, FR-044, FR-045, SC-012): com o
 * `ClienteDoAcervo` indisponível, a criação recusada exibe a mensagem devolvida
 * pela Interface, não entra na lista como concluída e deixa Frente e Verso
 * intactos para a nova tentativa. A indisponibilidade é simulada pelo próprio
 * Adapter de teste (`ClienteEmMemoria.simularIndisponibilidade`), sem rede e
 * sem que a tela exponha qualquer regra de domínio.
 */

function renderizarPaginaDeCartoes(): void {
  render(<PaginaDeCartoes cliente={clienteDeProva()} />);
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

describe("PaginaDeCartoes", () => {
  it("comunica o estado vazio e orienta a primeira ação (FR-043, FR-046)", async () => {
    renderizarPaginaDeCartoes();

    expect(
      screen.getByRole("heading", { level: 1, name: "Cartões" }),
    ).toBeInTheDocument();

    expect(await screen.findByText(/ainda não há Cartões/i)).toBeInTheDocument();
    expect(screen.getByText(/crie o primeiro Cartão/i)).toBeInTheDocument();
  });

  it("comunica a contagem e o limite durante a digitação (FR-053)", () => {
    renderizarPaginaDeCartoes();

    expect(
      screen.queryByText(/faltam \d+ caracteres para o limite/i),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Frente"), {
      target: { value: "x".repeat(950) },
    });

    expect(
      screen.getByText(`950 / ${LIMITE_DE_CARACTERES_DE_CARTAO} caracteres`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Atenção: faltam 50 caracteres para o limite de ${LIMITE_DE_CARACTERES_DE_CARTAO}.`,
      ),
    ).toBeInTheDocument();
  });

  it("criação válida aparece na lista sem recarregar (FR-001, FR-003, FR-004)", async () => {
    renderizarPaginaDeCartoes();

    await screen.findByText(/ainda não há Cartões/i);

    fireEvent.change(screen.getByLabelText("Frente"), {
      target: { value: "To walk" },
    });
    fireEvent.change(screen.getByLabelText("Verso"), {
      target: { value: "Caminhar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar Cartão" }));

    expect(await screen.findByText("To walk")).toBeInTheDocument();
    expect(screen.getByText("Caminhar")).toBeInTheDocument();
    expect(screen.queryByText(/ainda não há Cartões/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Frente")).toHaveValue("");
    expect(screen.getByLabelText("Verso")).toHaveValue("");
  });

  it("indica os Baralhos de cada Cartão, inclusive quando não há Baralho (FR-003, FR-004)", async () => {
    const cliente = clienteDeProva();
    const vinculado = await cliente.criarCartao({
      frente: "To walk",
      verso: "Caminhar",
    });
    const semBaralho = await cliente.criarCartao({
      frente: "To run",
      verso: "Correr",
    });
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!vinculado.ok || !semBaralho.ok || !baralho.ok) {
      throw new Error("as criações do cenário deveriam ser aceitas");
    }

    await cliente.vincular(vinculado.cartao.id, baralho.baralho.id);

    render(<PaginaDeCartoes cliente={cliente} />);

    expect(await screen.findByText("Inglês")).toBeInTheDocument();
    expect(screen.getAllByText("Nenhum Baralho vinculado.")).toHaveLength(1);
    expect(screen.getByText("To walk")).toBeInTheDocument();
    expect(screen.getByText("To run")).toBeInTheDocument();
  });

  it("recusa de domínio exibe a mensagem do cliente e não lista o Cartão (FR-046)", async () => {
    renderizarPaginaDeCartoes();

    await screen.findByText(/ainda não há Cartões/i);

    fireEvent.change(screen.getByLabelText("Frente"), {
      target: { value: "   " },
    });
    fireEvent.change(screen.getByLabelText("Verso"), {
      target: { value: "Caminhar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar Cartão" }));

    expect(
      await screen.findByText(/a frente do cartão não pode ficar vazia/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/ainda não há Cartões/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Frente")).toHaveValue("   ");
  });

  it("submete conteúdo acima do limite e exibe a recusa do cliente, sem validar na tela", async () => {
    renderizarPaginaDeCartoes();

    await screen.findByText(/ainda não há Cartões/i);

    const textoLongo = "x".repeat(1001);
    fireEvent.change(screen.getByLabelText("Frente"), {
      target: { value: textoLongo },
    });
    fireEvent.change(screen.getByLabelText("Verso"), {
      target: { value: "Caminhar" },
    });

    expect(
      screen.getByText(
        `Atenção: o texto excede o limite de ${LIMITE_DE_CARACTERES_DE_CARTAO} caracteres.`,
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Criar Cartão" }));

    expect(
      await screen.findByText(
        `A frente do cartão deve ter no máximo ${LIMITE_DE_CARACTERES_DE_CARTAO} caracteres; a informada tem 1001.`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Frente")).toHaveValue(textoLongo);
  });

  it("criação com o cliente indisponível reporta a mensagem da Interface, não conclui e preserva Frente e Verso (FR-044, FR-045, SC-012)", async () => {
    const cliente = clienteDeProva();
    render(<PaginaDeCartoes cliente={cliente} />);

    await screen.findByText(/ainda não há Cartões/i);

    digitar("Frente", "To walk");
    digitar("Verso", "Caminhar");

    cliente.simularIndisponibilidade();
    submeter();

    expect(
      await within(formularioDeCriacao()).findByRole("alert"),
    ).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE);

    // Nenhuma operação aparece como concluída: nada foi inserido na lista e o
    // estado vazio continua sendo o retratado.
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.getByText(/ainda não há Cartões/i)).toBeInTheDocument();

    // O conteúdo informado permanece integralmente, pronto para nova tentativa.
    expect(screen.getByLabelText("Frente")).toHaveValue("To walk");
    expect(screen.getByLabelText("Verso")).toHaveValue("Caminhar");
    expect(screen.getByRole("button", { name: "Criar Cartão" })).toBeEnabled();
  });

  it("a nova tentativa reaproveita o conteúdo preservado e só então conclui a criação (FR-045, SC-012)", async () => {
    const cliente = clienteDeProva();
    render(<PaginaDeCartoes cliente={cliente} />);

    await screen.findByText(/ainda não há Cartões/i);

    digitar("Frente", "To walk");
    digitar("Verso", "Caminhar");

    cliente.simularIndisponibilidade();
    submeter();
    await within(formularioDeCriacao()).findByRole("alert");

    cliente.restaurarDisponibilidade();
    submeter();

    const cartaoListado = await screen.findByRole("listitem");
    expect(cartaoListado).toHaveTextContent("To walk");
    expect(cartaoListado).toHaveTextContent("Caminhar");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Frente")).toHaveValue("");
    expect(screen.getByLabelText("Verso")).toHaveValue("");
  });

  it("cliente indisponível desde o carregamento não apresenta a lista como concluída nem perde o conteúdo digitado (FR-043, FR-044, FR-045)", async () => {
    const cliente = clienteDeProva();
    cliente.simularIndisponibilidade();

    render(<PaginaDeCartoes cliente={cliente} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE,
    );
    expect(screen.queryByText(/carregando Cartões/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ainda não há Cartões/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();

    digitar("Frente", "To walk");
    digitar("Verso", "Caminhar");
    submeter();

    expect(
      await within(formularioDeCriacao()).findByRole("alert"),
    ).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE);
    expect(screen.getByLabelText("Frente")).toHaveValue("To walk");
    expect(screen.getByLabelText("Verso")).toHaveValue("Caminhar");
  });

  it("depois da falha, o acervo volta e a criação preservada é concluída e visível (FR-044, FR-045, SC-012)", async () => {
    const cliente = clienteDeProva();
    cliente.simularIndisponibilidade();

    render(<PaginaDeCartoes cliente={cliente} />);

    await screen.findByRole("alert");

    digitar("Frente", "To walk");
    digitar("Verso", "Caminhar");
    submeter();
    await within(formularioDeCriacao()).findByRole("alert");

    cliente.restaurarDisponibilidade();
    submeter();

    const cartaoListado = await screen.findByRole("listitem");
    expect(cartaoListado).toHaveTextContent("To walk");
    expect(cartaoListado).toHaveTextContent("Caminhar");
    expect(
      screen.queryByText(MENSAGEM_DE_INDISPONIBILIDADE),
    ).not.toBeInTheDocument();
  });
});
