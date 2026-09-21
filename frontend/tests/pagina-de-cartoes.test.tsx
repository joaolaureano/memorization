import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
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
 */

function renderizarPaginaDeCartoes(): void {
  render(<PaginaDeCartoes cliente={new ClienteEmMemoria()} />);
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
});
