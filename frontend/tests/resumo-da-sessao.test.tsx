import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResumoDaSessao } from "../src/ui/ResumoDaSessao";
import type { ItemDoResumo } from "../src/ui/ResumoDaSessao";

/**
 * T1208 — Resumo da Sessão (specs/013-estatisticas-e-historico/contracts/contratos.md §7;
 * FR-174 a FR-176, SC-073).
 *
 * O componente é exercitado sem tela e sem cliente: ele recebe os Itens e
 * deriva daí o percentual, as contagens e os grupos. As asserções cobrem os
 * rótulos com as contagens, os dois grupos recolhidos ao nascer, a expansão
 * independente com `aria-expanded`/`aria-controls`, o conteúdo de cada lista, o
 * grupo vazio desabilitado e descrito, o acionamento por teclado e os
 * percentuais de SC-073.
 */

const ITENS_DE_PROVA: ItemDoResumo[] = [
  { frente: "Frente A", verso: "Verso A", resultado: "acertou" },
  { frente: "Frente B", verso: "Verso B", resultado: "errou" },
  { frente: "Frente C", verso: "Verso C", resultado: "acertou" },
];

function renderizar(itens: readonly ItemDoResumo[]): void {
  render(<ResumoDaSessao itens={itens} />);
}

/** `total` Itens, dos quais os `acertos` primeiros acertaram. */
function itensCom(acertos: number, total: number): ItemDoResumo[] {
  return Array.from({ length: total }, (_, indice) => ({
    frente: `Frente ${indice + 1}`,
    verso: `Verso ${indice + 1}`,
    resultado: indice < acertos ? "acertou" : "errou",
  }));
}

/** A lista que o botão controla por `aria-controls`. */
function listaDo(botao: HTMLElement): HTMLElement {
  const id = botao.getAttribute("aria-controls");
  const lista = id === null ? null : document.getElementById(id);

  if (lista === null) {
    throw new Error("o grupo controlado pelo botão deveria estar no documento");
  }

  return lista;
}

/** Aciona o botão como um navegador: Enter dispara o clique padrão do botão. */
function acionarPorTeclado(botao: HTMLElement): void {
  botao.focus();
  fireEvent.keyDown(botao, { key: "Enter" });
  fireEvent.click(botao);
}

describe("ResumoDaSessao", () => {
  it("mostra o percentual de acertos e a contagem de Itens (FR-174)", () => {
    renderizar(ITENS_DE_PROVA);

    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("de acertos")).toBeInTheDocument();
    expect(screen.getByText("2 de 3 Itens")).toBeInTheDocument();
  });

  it("mostra 100% quando todos os Itens foram acertados (SC-073)", () => {
    renderizar(itensCom(1, 1));

    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("1 de 1 Itens")).toBeInTheDocument();
  });

  it("mostra 0% quando nenhum Item foi acertado (SC-073)", () => {
    renderizar(itensCom(0, 1));

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("0 de 1 Itens")).toBeInTheDocument();
  });

  it("apresenta as contagens nos rótulos e nasce com os grupos recolhidos (FR-175)", () => {
    renderizar(ITENS_DE_PROVA);

    const botaoDeAcertos = screen.getByRole("button", { name: "Acertos (2)" });
    const botaoDeErros = screen.getByRole("button", { name: "Erros (1)" });

    expect(botaoDeAcertos).toHaveAttribute("aria-expanded", "false");
    expect(botaoDeErros).toHaveAttribute("aria-expanded", "false");
    expect(listaDo(botaoDeAcertos)).toHaveAttribute("hidden");
    expect(listaDo(botaoDeErros)).toHaveAttribute("hidden");
  });

  it("expande e recolhe cada grupo de forma independente (FR-175)", () => {
    renderizar(ITENS_DE_PROVA);

    const botaoDeAcertos = screen.getByRole("button", { name: "Acertos (2)" });
    const botaoDeErros = screen.getByRole("button", { name: "Erros (1)" });

    expect(botaoDeAcertos).toHaveAttribute(
      "aria-controls",
      listaDo(botaoDeAcertos).id,
    );
    expect(botaoDeErros).toHaveAttribute(
      "aria-controls",
      listaDo(botaoDeErros).id,
    );

    fireEvent.click(botaoDeAcertos);

    expect(botaoDeAcertos).toHaveAttribute("aria-expanded", "true");
    expect(listaDo(botaoDeAcertos)).not.toHaveAttribute("hidden");
    expect(botaoDeErros).toHaveAttribute("aria-expanded", "false");
    expect(listaDo(botaoDeErros)).toHaveAttribute("hidden");

    fireEvent.click(botaoDeErros);

    expect(botaoDeErros).toHaveAttribute("aria-expanded", "true");
    expect(listaDo(botaoDeErros)).not.toHaveAttribute("hidden");

    fireEvent.click(botaoDeAcertos);

    expect(botaoDeAcertos).toHaveAttribute("aria-expanded", "false");
    expect(listaDo(botaoDeAcertos)).toHaveAttribute("hidden");
    expect(botaoDeErros).toHaveAttribute("aria-expanded", "true");
    expect(listaDo(botaoDeErros)).not.toHaveAttribute("hidden");
  });

  it("lista Frente e Verso apenas dos Itens de cada grupo (FR-176)", () => {
    renderizar(ITENS_DE_PROVA);

    const botaoDeAcertos = screen.getByRole("button", { name: "Acertos (2)" });
    const botaoDeErros = screen.getByRole("button", { name: "Erros (1)" });

    fireEvent.click(botaoDeAcertos);
    fireEvent.click(botaoDeErros);

    const acertos = listaDo(botaoDeAcertos);

    expect(within(acertos).getByText("Frente A")).toBeInTheDocument();
    expect(within(acertos).getByText("Verso A")).toBeInTheDocument();
    expect(within(acertos).getByText("Frente C")).toBeInTheDocument();
    expect(within(acertos).getByText("Verso C")).toBeInTheDocument();
    expect(within(acertos).queryByText("Frente B")).not.toBeInTheDocument();
    expect(within(acertos).getAllByText("Frente")).toHaveLength(2);
    expect(within(acertos).getAllByText("Verso")).toHaveLength(2);

    const erros = listaDo(botaoDeErros);

    expect(within(erros).getByText("Frente B")).toBeInTheDocument();
    expect(within(erros).getByText("Verso B")).toBeInTheDocument();
    expect(within(erros).queryByText("Frente A")).not.toBeInTheDocument();
    expect(within(erros).getAllByText("Frente")).toHaveLength(1);
  });

  it("mantém a ordem apresentada dentro de cada grupo (FR-176)", () => {
    renderizar(ITENS_DE_PROVA);

    const botaoDeAcertos = screen.getByRole("button", { name: "Acertos (2)" });
    fireEvent.click(botaoDeAcertos);

    const frentes = within(listaDo(botaoDeAcertos)).getAllByText(
      /^Frente [AC]$/,
    );

    expect(frentes.map((elemento) => elemento.textContent)).toEqual([
      "Frente A",
      "Frente C",
    ]);
  });

  it("desabilita o grupo de Erros vazio e o descreve (FR-175)", () => {
    renderizar(itensCom(1, 1));

    expect(screen.getByRole("button", { name: "Acertos (1)" })).toBeEnabled();
    expect(
      screen.queryByText("Nenhum acerto nesta Sessão"),
    ).not.toBeInTheDocument();

    const botaoDeErros = screen.getByRole("button", { name: "Erros (0)" });

    expect(botaoDeErros).toBeDisabled();
    expect(botaoDeErros).toHaveAccessibleDescription(
      "Nenhum erro nesta Sessão",
    );
    expect(screen.getByText("Nenhum erro nesta Sessão")).toBeInTheDocument();
  });

  it("desabilita o grupo de Acertos vazio e o descreve (FR-175)", () => {
    renderizar(itensCom(0, 1));

    expect(screen.getByRole("button", { name: "Erros (1)" })).toBeEnabled();

    const botaoDeAcertos = screen.getByRole("button", { name: "Acertos (0)" });

    expect(botaoDeAcertos).toBeDisabled();
    expect(botaoDeAcertos).toHaveAccessibleDescription(
      "Nenhum acerto nesta Sessão",
    );
    expect(screen.getByText("Nenhum acerto nesta Sessão")).toBeInTheDocument();
  });

  it("permite abrir e fechar os grupos pelo teclado (FR-176)", () => {
    renderizar(ITENS_DE_PROVA);

    const botaoDeErros = screen.getByRole("button", { name: "Erros (1)" });

    acionarPorTeclado(botaoDeErros);

    expect(botaoDeErros).toHaveFocus();
    expect(botaoDeErros).toHaveAttribute("aria-expanded", "true");
    expect(listaDo(botaoDeErros)).not.toHaveAttribute("hidden");

    acionarPorTeclado(botaoDeErros);

    expect(botaoDeErros).toHaveAttribute("aria-expanded", "false");
    expect(listaDo(botaoDeErros)).toHaveAttribute("hidden");
  });

  it("renderiza as ações ao fim e não traz título próprio (FR-174)", () => {
    render(
      <ResumoDaSessao itens={ITENS_DE_PROVA}>
        <a href="#/baralhos/b1">Voltar para o Baralho</a>
      </ResumoDaSessao>,
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();

    const percentual = screen.getByText("de acertos");
    const acao = screen.getByRole("link", { name: "Voltar para o Baralho" });

    expect(
      percentual.compareDocumentPosition(acao) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
