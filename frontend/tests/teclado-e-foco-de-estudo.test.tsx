import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";
import { AleatoriedadeDeterministica } from "../src/sessao-de-estudo/aleatoriedade";
import { PaginaDeEstudo } from "../src/ui/PaginaDeEstudo";

/**
 * T305 — Revelação e Resultado percorridos por teclado, com foco preservado
 * (specs/004-sessao-de-estudo/tasks.md, FR-041, FR-048, SC-007).
 *
 * O jsdom não executa o comportamento padrão de Tab nem de Enter; os
 * auxiliares reproduzem esses comportamentos, sempre disparando antes o evento
 * de teclado real. A prova central é a posição do foco após cada ação: ao
 * iniciar, o foco vai para a Frente do primeiro Item; ao revelar, para o
 * Verso; ao registrar a Avaliação, para a Frente do Item seguinte; ao
 * concluir, para o Resumo.
 *
 * A 015 substitui Acertei/Errei pelas quatro Avaliações (FR-192), então a
 * ordem de tabulação depois da Revelação inclui o texto rolável do Verso,
 * Errei, Difícil, Bom e Fácil; a Sessão é percorrida escolhendo "Bom".
 *
 * A 024 substitui a configuração de quantidade pela modal «Revisar baralho»
 * (FR-383, FR-387): o Tab fica preso ao diálogo, que abre com o foco em
 * Cancelar; a Sessão começa pela escolha «Todos os cartões».
 */

const SELETOR_DE_CONTROLES_INTERATIVOS = [
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function controlesInterativos(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(SELETOR_DE_CONTROLES_INTERATIVOS),
  );
}

/**
 * Aperta Tab como um navegador: dispara o evento de teclado no elemento focado
 * e avança o foco ao próximo controle na ordem de tabulação. Com uma modal
 * `<dialog>` aberta, o foco fica preso a ela — como o elemento nativo faz —,
 * então a ordem é a dos controles do diálogo.
 */
function apertarTab(): void {
  const dialogo = document.activeElement?.closest("dialog[open]") ?? null;
  const controles =
    dialogo === null
      ? controlesInterativos()
      : Array.from(
          dialogo.querySelectorAll<HTMLElement>(
            SELETOR_DE_CONTROLES_INTERATIVOS,
          ),
        );
  const indice = controles.findIndex(
    (controle) => controle === document.activeElement,
  );
  const ativo = document.activeElement;
  const proximo = indice >= 0
    ? controles[(indice + 1) % controles.length]
    : controles.find((controle) => ativo !== null && Boolean(
        ativo.compareDocumentPosition(controle) & Node.DOCUMENT_POSITION_FOLLOWING,
      )) ?? controles[0];

  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab" });
  proximo.focus();
}

/**
 * Aperta Enter como um navegador: dispara o evento de teclado e executa o
 * comportamento padrão — a ativação do botão focado.
 */
function apertarEnter(elemento: HTMLElement): void {
  fireEvent.keyDown(elemento, { key: "Enter" });

  if (elemento instanceof HTMLButtonElement) {
    fireEvent.click(elemento);
  }
}

async function criarAcervoElegivel(): Promise<{
  cliente: ClienteEmMemoria;
  idDoBaralho: string;
}> {
  const cliente = clienteDeProva();

  const baralho = await cliente.criarBaralho({ nome: "Inglês" });
  if (!baralho.ok) throw new Error("a criação do Baralho deveria ser aceita");

  for (let indice = 1; indice <= 2; indice += 1) {
    const cartao = await cliente.criarCartao(baralho.baralho.id, {
      frente: `Frente ${indice}`,
      verso: `Verso ${indice}`,
    });

    if (!cartao.ok) {
      throw new Error("a criação do Cartão deveria ser aceita");
    }
  }

  const cartoes = await cliente.listarCartoes();

  if (!cartoes.ok) {
    throw new Error("a listagem de Cartões deveria ser aceita");
  }

  return { cliente, idDoBaralho: baralho.baralho.id };
}

function renderizar(cliente: ClienteEmMemoria, idDoBaralho: string): void {
  render(
    comProtecaoDeSaida(
      <PaginaDeEstudo
        cliente={cliente}
        id={idDoBaralho}
        aleatoriedade={new AleatoriedadeDeterministica([0, 0])}
      />,
    ),
  );
}

describe("PaginaDeEstudo por teclado", () => {
  it("percorre uma Sessão inteira só por teclado, do início ao Resumo, com foco no conteúdo novo (FR-041, FR-048, SC-007)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel();
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Revisar Inglês",
    });

    // A modal abre com o foco em Cancelar — a ação sem consequência (FR-387).
    const cancelar = screen.getByRole("button", { name: "Cancelar" });
    expect(document.activeElement).toBe(cancelar);

    apertarTab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Só pendentes" }),
    );

    apertarTab();
    const botaoTodos = screen.getByRole("button", {
      name: "Todos os cartões",
    });
    expect(document.activeElement).toBe(botaoTodos);
    apertarEnter(botaoTodos);

    // Ao iniciar, o foco vai para a Frente recém-apresentada.
    const primeiraFrente = await screen.findByRole("heading", {
      name: "Frente",
    });
    expect(document.activeElement).toBe(primeiraFrente);
    expect(
      screen.getByRole("article", { name: "Item 1 de 2" }),
    ).toBeInTheDocument();

    // O texto da Frente recebe foco para permitir rolagem pelo teclado;
    // depois vem Revelar verso.
    apertarTab();
    expect(document.activeElement).toHaveClass("conteudo-do-cartao");

    apertarTab();
    const botaoDeRevelacao = screen.getByRole("button", {
      name: "Revelar verso",
    });
    expect(document.activeElement).toBe(botaoDeRevelacao);
    apertarEnter(botaoDeRevelacao);

    // Ao revelar, o foco vai para o Verso recém-apresentado.
    const primeiroVerso = await screen.findByRole("heading", {
      name: "Verso",
    });
    expect(document.activeElement).toBe(primeiroVerso);

    // O texto do Verso permite rolagem pelo teclado; depois vêm as quatro
    // Avaliações na ordem Errei, Difícil, Bom e Fácil (FR-192).
    apertarTab();
    expect(document.activeElement).toHaveClass("conteudo-do-cartao");

    apertarTab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^Errei/ }),
    );

    apertarTab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^Difícil/ }),
    );

    apertarTab();
    const botaoBom = screen.getByRole("button", { name: /^Bom/ });
    expect(document.activeElement).toBe(botaoBom);
    apertarEnter(botaoBom);

    // Ao registrar a Avaliação, o foco vai para a Frente do Item seguinte.
    const segundaFrente = await screen.findByRole("heading", {
      name: "Frente",
    });
    expect(document.activeElement).toBe(segundaFrente);
    expect(
      screen.getByRole("article", { name: "Item 2 de 2" }),
    ).toBeInTheDocument();

    apertarTab();
    expect(document.activeElement).toHaveClass("conteudo-do-cartao");

    apertarTab();
    const segundaRevelacao = screen.getByRole("button", {
      name: "Revelar verso",
    });
    expect(document.activeElement).toBe(segundaRevelacao);
    apertarEnter(segundaRevelacao);

    await screen.findByRole("heading", { name: "Verso" });

    apertarTab();
    expect(document.activeElement).toHaveClass("conteudo-do-cartao");

    apertarTab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^Errei/ }),
    );

    apertarTab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^Difícil/ }),
    );

    apertarTab();
    const segundoBom = screen.getByRole("button", { name: /^Bom/ });
    expect(document.activeElement).toBe(segundoBom);
    apertarEnter(segundoBom);

    // Ao concluir, o foco vai para o Resumo.
    const resumo = await screen.findByRole("heading", {
      name: "Sessão concluída",
    });
    expect(document.activeElement).toBe(resumo);
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("2 de 2 Cartões")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Bom (2)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Errei (0)" }),
    ).toBeInTheDocument();
  });
});
