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
 *
 * T1512 acrescenta os casos da 015 (FR-216, FR-197): a contagem por nível de
 * Avaliação quando todos os Itens a têm, a sua ausência nos Registros
 * anteriores à 015 e o comportamento anterior intacto.
 */

const ITENS_DE_PROVA: ItemDoResumo[] = [
  { frente: "Frente A", verso: "Verso A", resultado: "acertou" },
  { frente: "Frente B", verso: "Verso B", resultado: "errou" },
  { frente: "Frente C", verso: "Verso C", resultado: "acertou" },
];

/**
 * Itens da 015, todos com Avaliação: 2 acertos (`bom`) e 1 erro (`errei`),
 * dando Errei 1 · Difícil 0 · Bom 2 · Fácil 0 (FR-216).
 */
const ITENS_COM_AVALIACAO: ItemDoResumo[] = [
  {
    frente: "Frente A",
    verso: "Verso A",
    resultado: "errou",
    avaliacao: "errei",
  },
  {
    frente: "Frente B",
    verso: "Verso B",
    resultado: "acertou",
    avaliacao: "bom",
  },
  {
    frente: "Frente C",
    verso: "Verso C",
    resultado: "acertou",
    avaliacao: "bom",
  },
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

/** O painel que o botão de um Cartão controla por `aria-controls`. */
function painelDoCartao(botao: HTMLElement): HTMLElement {
  const id = botao.getAttribute("aria-controls");
  const painel = id === null ? null : document.getElementById(id);

  if (painel === null) {
    throw new Error("o painel controlado pelo botão deveria estar no documento");
  }

  return painel;
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
    expect(screen.getByText("2 de 3 Cartões")).toBeInTheDocument();
  });

  it("mostra 100% quando todos os Itens foram acertados (SC-073)", () => {
    renderizar(itensCom(1, 1));

    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("1 de 1 Cartão")).toBeInTheDocument();
  });

  it("mostra 0% quando nenhum Item foi acertado (SC-073)", () => {
    renderizar(itensCom(0, 1));

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("0 de 1 Cartão")).toBeInTheDocument();
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
    const botaoFrenteA = within(acertos).getByRole("button", {
      name: "Frente A",
    });
    const botaoFrenteC = within(acertos).getByRole("button", {
      name: "Frente C",
    });

    expect(botaoFrenteA).toBeInTheDocument();
    expect(botaoFrenteC).toBeInTheDocument();
    expect(
      within(acertos).queryByRole("button", { name: "Frente B" }),
    ).not.toBeInTheDocument();
    expect(painelDoCartao(botaoFrenteA)).toHaveAttribute("hidden");
    expect(painelDoCartao(botaoFrenteC)).toHaveAttribute("hidden");

    fireEvent.click(botaoFrenteA);
    fireEvent.click(botaoFrenteC);

    expect(painelDoCartao(botaoFrenteA)).not.toHaveAttribute("hidden");
    expect(painelDoCartao(botaoFrenteA)).toHaveTextContent("Verso A");
    expect(painelDoCartao(botaoFrenteC)).not.toHaveAttribute("hidden");
    expect(painelDoCartao(botaoFrenteC)).toHaveTextContent("Verso C");

    const erros = listaDo(botaoDeErros);
    const botaoFrenteB = within(erros).getByRole("button", {
      name: "Frente B",
    });

    expect(botaoFrenteB).toBeInTheDocument();
    expect(
      within(erros).queryByRole("button", { name: "Frente A" }),
    ).not.toBeInTheDocument();

    fireEvent.click(botaoFrenteB);

    expect(painelDoCartao(botaoFrenteB)).not.toHaveAttribute("hidden");
    expect(painelDoCartao(botaoFrenteB)).toHaveTextContent("Verso B");
  });

  it("mantém a ordem apresentada dentro de cada grupo (FR-176)", () => {
    renderizar(ITENS_DE_PROVA);

    const botaoDeAcertos = screen.getByRole("button", { name: "Acertos (2)" });
    fireEvent.click(botaoDeAcertos);

    const frentes = within(listaDo(botaoDeAcertos)).getAllByRole("button", {
      name: /^Frente [AC]$/,
    });

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

  it("mostra a contagem por nível quando todos os Itens têm Avaliação (FR-216)", () => {
    renderizar(ITENS_COM_AVALIACAO);

    const lista = screen.getByRole("list", {
      name: "Contagem por nível de Avaliação",
    });
    const niveis = within(lista).getAllByRole("listitem");

    expect(niveis.map((nivel) => nivel.textContent?.trim())).toEqual([
      "Errei 1",
      "Difícil 0",
      "Bom 2",
      "Fácil 0",
    ]);
  });

  it("não mostra a contagem por nível em Registros anteriores à 015 (FR-197)", () => {
    renderizar(ITENS_DE_PROVA);

    expect(
      screen.queryByRole("list", {
        name: "Contagem por nível de Avaliação",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/^(Errei|Difícil|Bom|Fácil) \d+$/),
    ).not.toBeInTheDocument();
  });

  it("não mostra a contagem quando só parte dos Itens tem Avaliação (FR-197)", () => {
    renderizar([
      {
        frente: "Frente A",
        verso: "Verso A",
        resultado: "errou",
        avaliacao: "errei",
      },
      { frente: "Frente B", verso: "Verso B", resultado: "acertou" },
    ]);

    expect(screen.queryByText(/Errei 1/)).not.toBeInTheDocument();
  });

  it("mantém percentual, contagens e grupos com a contagem por nível presente (FR-197)", () => {
    renderizar(ITENS_COM_AVALIACAO);

    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("2 de 3 Cartões")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Acertos (2)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Erros (1)" }),
    ).toBeInTheDocument();
  });

  it("aceita a origem da Sessão sem trazer o título, que é da página (FR-196)", () => {
    render(<ResumoDaSessao itens={ITENS_COM_AVALIACAO} origem="revisao" />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByText("Revisão do dia")).not.toBeInTheDocument();
  });

  it("mostra só a Frente até o Cartão ser acionado e alterna o Verso (FR-176)", () => {
    renderizar(ITENS_DE_PROVA);

    const botaoDeAcertos = screen.getByRole("button", { name: "Acertos (2)" });
    fireEvent.click(botaoDeAcertos);

    const acertos = listaDo(botaoDeAcertos);
    const cartaoA = within(acertos).getByRole("button", { name: "Frente A" });
    const painelA = painelDoCartao(cartaoA);

    expect(cartaoA).toHaveAttribute("aria-expanded", "false");
    expect(painelA).toHaveAttribute("hidden");

    fireEvent.click(cartaoA);

    expect(cartaoA).toHaveAttribute("aria-expanded", "true");
    expect(painelA).not.toHaveAttribute("hidden");
    expect(painelA).toHaveTextContent("Verso");
    expect(painelA).toHaveTextContent("Verso A");

    fireEvent.click(cartaoA);

    expect(cartaoA).toHaveAttribute("aria-expanded", "false");
    expect(painelA).toHaveAttribute("hidden");
  });

  it("apresenta Erros antes de Acertos na ordem do documento (FR-174)", () => {
    renderizar(ITENS_DE_PROVA);

    const botaoDeErros = screen.getByRole("button", { name: "Erros (1)" });
    const botaoDeAcertos = screen.getByRole("button", { name: "Acertos (2)" });

    expect(
      botaoDeErros.compareDocumentPosition(botaoDeAcertos) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
