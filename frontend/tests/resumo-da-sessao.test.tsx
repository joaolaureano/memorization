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
 * Itens da 015, todos com Avaliação: 1 `errei` e 2 `bom`,
 * dando Errei 1 · Difícil 0 · Bom 2 · Fácil 0 (FR-216, T2316).
 */
const ITENS_COM_AVALIACAO: ItemDoResumo[] = [
  {
    frente: "Frente A",
    verso: "Verso A",
    resultado: "errou",
    avaliacao: "errei",
    avaliacaoRotulo: "Errei",
  },
  {
    frente: "Frente B",
    verso: "Verso B",
    resultado: "acertou",
    avaliacao: "bom",
    avaliacaoRotulo: "Bom",
  },
  {
    frente: "Frente C",
    verso: "Verso C",
    resultado: "acertou",
    avaliacao: "bom",
    avaliacaoRotulo: "Bom",
  },
];

function renderizar(itens: readonly ItemDoResumo[]): void {
  render(<ResumoDaSessao itens={itens} />);
}

/**
 * `total` Itens com Avaliação: `acertos` primeiros são "bom", resto são "errei"
 * (T2316 - necessário para testar agrupamento por opção).
 */
function itensCom(acertos: number, total: number): ItemDoResumo[] {
  return Array.from({ length: total }, (_, indice) => {
    const ehAcerto = indice < acertos;
    const avaliacao = ehAcerto ? "bom" : "errei";
    const rotulo = ehAcerto ? "Bom" : "Errei";
    return {
      frente: `Frente ${indice + 1}`,
      verso: `Verso ${indice + 1}`,
      resultado: ehAcerto ? "acertou" : "errou",
      avaliacao: avaliacao as "bom" | "errei",
      avaliacaoRotulo: rotulo,
    };
  });
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

  it("apresenta as contagens nos rótulos e nasce com os grupos recolhidos (FR-175, T2316)", () => {
    renderizar(ITENS_COM_AVALIACAO);

    const botaoErrei = screen.getByRole("button", { name: "Errei (1)" });
    const botaoBom = screen.getByRole("button", { name: "Bom (2)" });

    expect(botaoErrei).toHaveAttribute("aria-expanded", "false");
    expect(botaoBom).toHaveAttribute("aria-expanded", "false");
    expect(listaDo(botaoErrei)).toHaveAttribute("hidden");
    expect(listaDo(botaoBom)).toHaveAttribute("hidden");
  });

  it("expande e recolhe cada grupo de forma independente (FR-175, T2316)", () => {
    renderizar(ITENS_COM_AVALIACAO);

    const botaoErrei = screen.getByRole("button", { name: "Errei (1)" });
    const botaoBom = screen.getByRole("button", { name: "Bom (2)" });

    expect(botaoErrei).toHaveAttribute(
      "aria-controls",
      listaDo(botaoErrei).id,
    );
    expect(botaoBom).toHaveAttribute(
      "aria-controls",
      listaDo(botaoBom).id,
    );

    fireEvent.click(botaoErrei);

    expect(botaoErrei).toHaveAttribute("aria-expanded", "true");
    expect(listaDo(botaoErrei)).not.toHaveAttribute("hidden");
    expect(botaoBom).toHaveAttribute("aria-expanded", "false");
    expect(listaDo(botaoBom)).toHaveAttribute("hidden");

    fireEvent.click(botaoBom);

    expect(botaoBom).toHaveAttribute("aria-expanded", "true");
    expect(listaDo(botaoBom)).not.toHaveAttribute("hidden");

    fireEvent.click(botaoErrei);

    expect(botaoErrei).toHaveAttribute("aria-expanded", "false");
    expect(listaDo(botaoErrei)).toHaveAttribute("hidden");
    expect(botaoBom).toHaveAttribute("aria-expanded", "true");
    expect(listaDo(botaoBom)).not.toHaveAttribute("hidden");
  });

  it("lista Frente e Verso apenas dos Itens de cada grupo (FR-176, T2316)", () => {
    renderizar(ITENS_COM_AVALIACAO);

    const botaoBom = screen.getByRole("button", { name: "Bom (2)" });
    const botaoErrei = screen.getByRole("button", { name: "Errei (1)" });

    fireEvent.click(botaoBom);
    fireEvent.click(botaoErrei);

    const bom = listaDo(botaoBom);
    const botaoFrenteB = within(bom).getByRole("button", {
      name: "Frente B",
    });
    const botaoFrenteC = within(bom).getByRole("button", {
      name: "Frente C",
    });

    expect(botaoFrenteB).toBeInTheDocument();
    expect(botaoFrenteC).toBeInTheDocument();
    expect(
      within(bom).queryByRole("button", { name: "Frente A" }),
    ).not.toBeInTheDocument();
    expect(painelDoCartao(botaoFrenteB)).toHaveAttribute("hidden");
    expect(painelDoCartao(botaoFrenteC)).toHaveAttribute("hidden");

    fireEvent.click(botaoFrenteB);
    fireEvent.click(botaoFrenteC);

    expect(painelDoCartao(botaoFrenteB)).not.toHaveAttribute("hidden");
    expect(painelDoCartao(botaoFrenteB)).toHaveTextContent("Verso B");
    expect(painelDoCartao(botaoFrenteC)).not.toHaveAttribute("hidden");
    expect(painelDoCartao(botaoFrenteC)).toHaveTextContent("Verso C");

    const errei = listaDo(botaoErrei);
    const botaoFrenteA = within(errei).getByRole("button", {
      name: "Frente A",
    });

    expect(botaoFrenteA).toBeInTheDocument();
    expect(
      within(errei).queryByRole("button", { name: "Frente B" }),
    ).not.toBeInTheDocument();

    fireEvent.click(botaoFrenteA);

    expect(painelDoCartao(botaoFrenteA)).not.toHaveAttribute("hidden");
    expect(painelDoCartao(botaoFrenteA)).toHaveTextContent("Verso A");
  });

  it("mantém a ordem apresentada dentro de cada grupo (FR-176, T2316)", () => {
    renderizar(ITENS_COM_AVALIACAO);

    const botaoBom = screen.getByRole("button", { name: "Bom (2)" });
    fireEvent.click(botaoBom);

    const frentes = within(listaDo(botaoBom)).getAllByRole("button", {
      name: /^Frente [BC]$/,
    });

    expect(frentes.map((elemento) => elemento.textContent)).toEqual([
      "Frente B",
      "Frente C",
    ]);
  });

  it("desabilita o grupo vazio e o descreve (FR-175, T2316)", () => {
    renderizar(itensCom(1, 1));

    expect(screen.getByRole("button", { name: "Bom (1)" })).toBeEnabled();

    // itensCom(1, 1) cria um item "bom", então outras opções estão vazias
    const botaoDificil = screen.getByRole("button", { name: "Difícil (0)" });

    expect(botaoDificil).toBeDisabled();
    expect(botaoDificil).toHaveAccessibleDescription(
      "Nenhum Cartão avaliado como Difícil",
    );
    expect(screen.getByText("Nenhum Cartão avaliado como Difícil")).toBeInTheDocument();
  });

  it("desabilita grupo vazio e o descreve corretamente (FR-175, T2316)", () => {
    renderizar(itensCom(0, 1));

    expect(screen.getByRole("button", { name: "Errei (1)" })).toBeEnabled();

    // itensCom(0, 1) cria um item "errei", então outras opções estão vazias
    const botaoBom = screen.getByRole("button", { name: "Bom (0)" });

    expect(botaoBom).toBeDisabled();
    expect(botaoBom).toHaveAccessibleDescription(
      "Nenhum Cartão avaliado como Bom",
    );
    expect(screen.getByText("Nenhum Cartão avaliado como Bom")).toBeInTheDocument();
  });

  it("permite abrir e fechar os grupos pelo teclado (FR-176, T2316)", () => {
    renderizar(ITENS_COM_AVALIACAO);

    const botaoErrei = screen.getByRole("button", { name: "Errei (1)" });

    acionarPorTeclado(botaoErrei);

    expect(botaoErrei).toHaveFocus();
    expect(botaoErrei).toHaveAttribute("aria-expanded", "true");
    expect(listaDo(botaoErrei)).not.toHaveAttribute("hidden");

    acionarPorTeclado(botaoErrei);

    expect(botaoErrei).toHaveAttribute("aria-expanded", "false");
    expect(listaDo(botaoErrei)).toHaveAttribute("hidden");
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

  it("mostra a contagem por opção quando todos os Itens têm Avaliação (FR-216, T2316)", () => {
    renderizar(ITENS_COM_AVALIACAO);

    const lista = screen.getByRole("list", {
      name: "Contagem por opção de Avaliação",
    });
    const opcoes = within(lista).getAllByRole("listitem");

    expect(opcoes.map((opcao) => opcao.textContent?.trim())).toEqual([
      "Errei 1",
      "Difícil 0",
      "Bom 2",
      "Fácil 0",
    ]);
  });

  it("mostra a legenda com todos os grupos incluindo 'Sem avaliação' para Registros anteriores à 015 (FR-174, FR-197, T2316)", () => {
    renderizar(ITENS_DE_PROVA);

    // ITENS_DE_PROVA têm 3 items sem avaliacao - legenda deve mostrar
    // todas as 4 opções SM-2 com contagem 0 + "Sem avaliação 3"
    const lista = screen.getByRole("list", {
      name: "Contagem por opção de Avaliação",
    });
    const opcoes = within(lista).getAllByRole("listitem");

    expect(opcoes.map((op) => op.textContent?.trim())).toEqual([
      "Errei 0",
      "Difícil 0",
      "Bom 0",
      "Fácil 0",
      "Sem avaliação 3",
    ]);
  });

  it("mostra a legenda com contagens quando parte dos Itens tem Avaliação (FR-174, FR-197, T2316)", () => {
    renderizar([
      {
        frente: "Frente A",
        verso: "Verso A",
        resultado: "errou",
        avaliacao: "errei",
        avaliacaoRotulo: "Errei",
      },
      { frente: "Frente B", verso: "Verso B", resultado: "acertou" },
    ]);

    // Um item com avaliacao "errei", um sem - legenda deve mostrar
    // todas as 4 opções + "Sem avaliação 1"
    const lista = screen.getByRole("list", {
      name: "Contagem por opção de Avaliação",
    });
    const opcoes = within(lista).getAllByRole("listitem");

    expect(opcoes.map((op) => op.textContent?.trim())).toEqual([
      "Errei 1",
      "Difícil 0",
      "Bom 0",
      "Fácil 0",
      "Sem avaliação 1",
    ]);
  });

  it("mantém percentual, contagens e grupos com a contagem por opção presente (FR-197, T2316)", () => {
    renderizar(ITENS_COM_AVALIACAO);

    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("2 de 3 Cartões")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Bom (2)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Errei (1)" }),
    ).toBeInTheDocument();
  });

  it("aceita a origem da Sessão sem trazer o título, que é da página (FR-196)", () => {
    render(<ResumoDaSessao itens={ITENS_COM_AVALIACAO} origem="revisao" />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByText("Revisão do dia")).not.toBeInTheDocument();
  });

  it("mostra só a Frente até o Cartão ser acionado e alterna o Verso (FR-176, T2316)", () => {
    renderizar(ITENS_COM_AVALIACAO);

    const botaoBom = screen.getByRole("button", { name: "Bom (2)" });
    fireEvent.click(botaoBom);

    const bom = listaDo(botaoBom);
    const cartaoB = within(bom).getByRole("button", { name: "Frente B" });
    const painelB = painelDoCartao(cartaoB);

    expect(cartaoB).toHaveAttribute("aria-expanded", "false");
    expect(painelB).toHaveAttribute("hidden");

    fireEvent.click(cartaoB);

    expect(cartaoB).toHaveAttribute("aria-expanded", "true");
    expect(painelB).not.toHaveAttribute("hidden");
    expect(painelB).toHaveTextContent("Verso");
    expect(painelB).toHaveTextContent("Verso B");

    fireEvent.click(cartaoB);

    expect(cartaoB).toHaveAttribute("aria-expanded", "false");
    expect(painelB).toHaveAttribute("hidden");
  });

  it("apresenta grupos nas opções por avaliação em ordem (FR-174, T2316)", () => {
    // Usando ITENS_DE_PROVA (sem avaliação) com SM-2 fallback: mostra todos os 4 grupos + "Sem avaliação"
    renderizar(ITENS_DE_PROVA);

    const botoes = screen.getAllByRole("button", {
      name: /^(Errei|Difícil|Bom|Fácil|Sem avaliação) \(/,
    });

    // Deve ter 5 botões: os 4 da SM-2 + "Sem avaliação"
    expect(botoes).toHaveLength(5);
    expect(botoes[0]).toHaveTextContent("Errei");
    expect(botoes[1]).toHaveTextContent("Difícil");
    expect(botoes[2]).toHaveTextContent("Bom");
    expect(botoes[3]).toHaveTextContent("Fácil");
    expect(botoes[4]).toHaveTextContent("Sem avaliação");
  });
});
