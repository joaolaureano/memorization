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
 * ordem de tabulação depois da Revelação passa a ser Interromper, Errei,
 * Difícil, Bom e Fácil; a Sessão é percorrida escolhendo "Bom".
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
 * e avança o foco ao próximo controle na ordem de tabulação.
 */
function apertarTab(): void {
  const controles = controlesInterativos();
  const indice = controles.findIndex(
    (controle) => controle === document.activeElement,
  );
  const proximo = controles[(indice + 1) % controles.length];

  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab" });
  proximo.focus();
}

/** Digita pelo teclado: um `keydown` por caractere e a atualização do valor. */
function digitarPeloTeclado(campo: HTMLElement, texto: string): void {
  for (const caractere of texto) {
    fireEvent.keyDown(campo, { key: caractere });
  }

  fireEvent.change(campo, { target: { value: texto } });
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

  for (let indice = 1; indice <= 2; indice += 1) {
    const cartao = await cliente.criarCartao({
      frente: `Frente ${indice}`,
      verso: `Verso ${indice}`,
    });

    if (!cartao.ok) {
      throw new Error("a criação do Cartão deveria ser aceita");
    }
  }

  const baralho = await cliente.criarBaralho({ nome: "Inglês" });

  if (!baralho.ok) {
    throw new Error("a criação do Baralho deveria ser aceita");
  }

  const cartoes = await cliente.listarCartoes();

  if (!cartoes.ok) {
    throw new Error("a listagem de Cartões deveria ser aceita");
  }

  for (const cartao of cartoes.cartoes) {
    await cliente.vincular(cartao.id, baralho.baralho.id);
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
      name: "Estudar Inglês",
    });

    const campoDeQuantidade = screen.getByLabelText("Quantidade de Cartões");
    const botaoDeInicio = screen.getByRole("button", {
      name: "Iniciar Sessão",
    });

    // Ordem de tabulação na tela de início: voltar, quantidade, iniciar.
    apertarTab();
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Voltar para o Baralho" }),
    );

    apertarTab();
    expect(document.activeElement).toBe(campoDeQuantidade);
    digitarPeloTeclado(campoDeQuantidade, "2");

    apertarTab();
    expect(document.activeElement).toBe(botaoDeInicio);
    apertarEnter(botaoDeInicio);

    // Ao iniciar, o foco vai para a Frente recém-apresentada.
    const primeiraFrente = await screen.findByRole("heading", {
      name: "Frente",
    });
    expect(document.activeElement).toBe(primeiraFrente);
    expect(screen.getByText("Faltam 2 Cartões")).toBeInTheDocument();

    // Interromper e Revelar verso são os próximos controles na ordem de
    // tabulação.
    apertarTab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Interromper" }),
    );

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

    // Depois do Verso, as quatro Avaliações são os próximos controles, na
    // ordem Errei, Difícil, Bom e Fácil (FR-192).
    apertarTab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Interromper" }),
    );

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
    expect(screen.getByText("Falta 1 Cartão")).toBeInTheDocument();

    apertarTab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Interromper" }),
    );

    apertarTab();
    const segundaRevelacao = screen.getByRole("button", {
      name: "Revelar verso",
    });
    expect(document.activeElement).toBe(segundaRevelacao);
    apertarEnter(segundaRevelacao);

    await screen.findByRole("heading", { name: "Verso" });

    apertarTab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Interromper" }),
    );

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
      screen.getByRole("button", { name: "Acertos (2)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Erros (0)" }),
    ).toBeInTheDocument();
  });
});
