import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva } from "./apoio-de-prova";
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";

/**
 * T210 — vincular e desvincular apenas por teclado, com foco preservado
 * (specs/003-vincular-cartao-baralho/tasks.md, FR-063, FR-064, SC-019).
 *
 * O jsdom não executa o comportamento padrão de Tab nem de Enter. Os
 * auxiliares reproduzem esses comportamentos — o mesmo papel que
 * `user-event` cumpre — sempre disparando antes o evento de teclado real.
 *
 * A prova central é a posição do foco após cada operação: vincular dois
 * Cartões em sequência, sem tocar o ponteiro, e asseverar que o foco vai para
 * o botão equivalente na outra lista — nunca de volta ao início da página.
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

/**
 * Aperta Enter como um navegador: dispara o evento de teclado e executa o
 * comportamento padrão de ativação do botão focado.
 */
function apertarEnter(elemento: HTMLElement): void {
  fireEvent.keyDown(elemento, { key: "Enter" });

  if (elemento instanceof HTMLButtonElement) {
    fireEvent.click(elemento);
  }
}

interface AcervoDeTeste {
  cliente: ClienteEmMemoria;
  idDoBaralho: string;
  idDoPrimeiroCartao: string;
  idDoSegundoCartao: string;
}

async function criarAcervoDeTeste(): Promise<AcervoDeTeste> {
  const cliente = clienteDeProva();
  const primeiroCartao = await cliente.criarCartao({
    frente: "To walk",
    verso: "Caminhar",
  });
  const segundoCartao = await cliente.criarCartao({
    frente: "To run",
    verso: "Correr",
  });
  const baralho = await cliente.criarBaralho({ nome: "Inglês" });

  if (!primeiroCartao.ok || !segundoCartao.ok || !baralho.ok) {
    throw new Error("as criações do cenário deveriam ser aceitas");
  }

  return {
    cliente,
    idDoBaralho: baralho.baralho.id,
    idDoPrimeiroCartao: primeiroCartao.cartao.id,
    idDoSegundoCartao: segundoCartao.cartao.id,
  };
}

describe("PaginaDoBaralho por teclado", () => {
  it("vincula dois Cartões em sequência só por teclado e preserva a posição do foco (FR-063, FR-064, SC-019)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTeste();
    render(<PaginaDoBaralho cliente={cliente} id={idDoBaralho} />);

    await screen.findByRole("heading", { level: 1, name: "Inglês" });

    const botaoVincularPrimeiro = screen.getByRole("button", {
      name: "Vincular To walk",
    });
    const botaoVincularSegundo = screen.getByRole("button", {
      name: "Vincular To run",
    });

    // A ordem de tabulação começa no link de volta e segue pelos botões de
    // Vincular, na mesma ordem das duas listas.
    const controlesIniciais = controlesInterativos();
    expect(controlesIniciais[0]).toBe(
      screen.getByRole("link", { name: "Voltar para Baralhos" }),
    );
    expect(controlesIniciais[1]).toBe(botaoVincularPrimeiro);
    expect(controlesIniciais[2]).toBe(botaoVincularSegundo);

    apertarTab();
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Voltar para Baralhos" }),
    );

    apertarTab();
    expect(document.activeElement).toBe(botaoVincularPrimeiro);
    apertarEnter(botaoVincularPrimeiro);

    expect(
      await screen.findByText(/Cartão vinculado ao Baralho\./),
    ).toBeInTheDocument();

    // Após vincular, o foco vai ao botão equivalente na outra lista: o
    // "Desvincular" do Cartão recém-movido.
    const botaoDesvincularPrimeiro = screen.getByRole("button", {
      name: "Desvincular To walk",
    });
    expect(document.activeElement).toBe(botaoDesvincularPrimeiro);

    // O segundo Cartão continua a um Tab de distância, sem voltar ao início.
    apertarTab();
    const botaoVincularRestante = screen.getByRole("button", {
      name: "Vincular To run",
    });
    expect(document.activeElement).toBe(botaoVincularRestante);

    apertarEnter(botaoVincularRestante);

    expect(
      await screen.findByRole("button", { name: "Desvincular To run" }),
    ).toBeInTheDocument();

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Desvincular To run" }),
    );
  });
});
