import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva } from "./apoio-de-prova";
import { PaginaDeBaralhos } from "../src/ui/PaginaDeBaralhos";

/**
 * T1109 — a lista de Baralhos percorrível apenas por teclado, com foco visível
 * (spec 012: FR-144, FR-148, FR-153; FR-058 e FR-059 herdados de 002/005).
 *
 * A tela é exercitada pela superfície da Seam `ClienteDoAcervo` com o
 * `ClienteEmMemoria`, sem servidor. Três provas:
 *
 * 1. A ordem de tabulação segue a disposição visual — Criar baralho, Criar
 *    baralho temporário, Buscar baralhos, Limpar filtros e, então, o Estudar
 *    e o Editar de cada Baralho;
 *    o nome não recebe foco (spec 021: FR-340, FR-341, FR-346; spec 022:
 *    FR-354, FR-355) —, com o elemento focado conferido a cada passo por
 *    `document.activeElement`.
 * 2. O Estudar de um Baralho vazio fica fora da ordem de tabulação, por ser um
 *    controle desabilitado, e a falha de listagem deixa a nova tentativa como
 *    única ação além do cabeçalho e dos controles de busca, acionável por
 *    Enter.
 * 3. O indicador de foco de `estilos.css` é um contorno geométrico, sem
 *    depender apenas de cor, e nunca é suprimido.
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
 * comportamento padrão — a ativação do botão focado.
 */
function apertarEnter(elemento: HTMLElement): void {
  fireEvent.keyDown(elemento, { key: "Enter" });

  if (elemento instanceof HTMLButtonElement) {
    fireEvent.click(elemento);
  }
}

/** Cria um Baralho já vinculado aos Cartões informados, pela Interface. */
async function semearBaralho(
  cliente: ClienteEmMemoria,
  nome: string,
  frentes: string[] = [],
): Promise<void> {
  const criacao = await cliente.criarBaralho({ nome });

  if (!criacao.ok) {
    throw new Error(`Baralho de prova "${nome}" não foi criado.`);
  }

  for (const frente of frentes) {
    const cartao = await cliente.criarCartao({
      frente,
      verso: `Verso de ${frente}`,
    });

    if (!cartao.ok) {
      throw new Error(`Cartão de prova "${frente}" não foi criado.`);
    }

    const vinculo = await cliente.vincular(cartao.cartao.id, criacao.baralho.id);

    if (!vinculo.ok) {
      throw new Error(`Vínculo de prova "${frente}" não foi criado.`);
    }
  }
}

describe("PaginaDeBaralhos por teclado", () => {
  it("percorre a lista apenas por teclado, na ordem visual Criar baralho → Criar baralho temporário → Buscar → Limpar filtros → Estudar → Editar (FR-340, FR-346, FR-360)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Inglês", ["Hello"]);

    render(<PaginaDeBaralhos cliente={cliente} />);
    await screen.findByRole("listitem");

    const controles = controlesInterativos();
    expect(controles).toEqual([
      screen.getByRole("link", { name: "Criar baralho" }),
      screen.getByRole("link", { name: "Criar baralho temporário" }),
      screen.getByRole("searchbox", { name: "Buscar baralhos" }),
      screen.getByRole("button", { name: "Limpar filtros" }),
      screen.getByRole("link", { name: "Estudar Inglês" }),
      screen.getByRole("link", { name: "Editar Inglês" }),
    ]);

    for (const controle of controles) {
      apertarTab();
      expect(document.activeElement).toBe(controle);
    }
  });

  it("o Estudar de um Baralho vazio fica fora da ordem de tabulação e o Tab segue para Editar (FR-343, FR-346)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Alemão");

    render(<PaginaDeBaralhos cliente={cliente} />);
    await screen.findByRole("listitem");

    const botaoDeEstudo = screen.getByRole("button", {
      name: "Estudar Alemão",
    });
    expect(botaoDeEstudo).toBeDisabled();

    const controles = controlesInterativos();
    expect(controles).not.toContain(botaoDeEstudo);
    expect(controles).toEqual([
      screen.getByRole("link", { name: "Criar baralho" }),
      screen.getByRole("link", { name: "Criar baralho temporário" }),
      screen.getByRole("searchbox", { name: "Buscar baralhos" }),
      screen.getByRole("button", { name: "Limpar filtros" }),
      screen.getByRole("link", { name: "Editar Alemão" }),
    ]);

    // O Estudar desabilitado não entra na ordem: o Tab passa por Criar
    // baralho, Criar baralho temporário, Buscar baralhos e Limpar filtros e
    // segue para Editar.
    for (const controle of controles) {
      apertarTab();
      expect(document.activeElement).toBe(controle);
    }
  });

  it("na falha de listagem, a nova tentativa é a única ação além do cabeçalho e dos controles de busca, acionável por Enter (FR-148)", async () => {
    const cliente = clienteDeProva();
    cliente.simularIndisponibilidade();

    render(<PaginaDeBaralhos cliente={cliente} />);
    await screen.findByRole("alert");

    // Além do cabeçalho (Criar baralho e Criar baralho temporário) e dos
    // controles de busca (Buscar baralhos e Limpar filtros), a nova tentativa
    // é a única ação.
    const controles = controlesInterativos();
    expect(controles).toEqual([
      screen.getByRole("link", { name: "Criar baralho" }),
      screen.getByRole("link", { name: "Criar baralho temporário" }),
      screen.getByRole("searchbox", { name: "Buscar baralhos" }),
      screen.getByRole("button", { name: "Limpar filtros" }),
      screen.getByRole("button", { name: "Tentar novamente" }),
    ]);

    for (const controle of controles) {
      apertarTab();
      expect(document.activeElement).toBe(controle);
    }

    cliente.restaurarDisponibilidade();
    apertarEnter(controles[4]);

    expect(
      await screen.findByText(/ainda não há Baralhos/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("o indicador de foco é um contorno geométrico e não depende apenas de cor (FR-059)", () => {
    // O Vitest esvazia imports de CSS; o arquivo de estilos é lido como
    // texto — o mesmo arquivo que o `main.tsx` carrega na aplicação.
    const estilos = readFileSync(
      join(process.cwd(), "src", "estilos.css"),
      "utf8",
    );

    const regraDeFoco = estilos.match(/:focus-visible\s*\{([^}]*)\}/);
    expect(regraDeFoco).not.toBeNull();

    // Contorno sólido, com espessura e afastamento: indicação geométrica,
    // perceptível mesmo sem distinguir cores.
    const declaracoes = regraDeFoco?.[1] ?? "";
    expect(declaracoes).toMatch(/outline:\s*3px\s+solid/);
    expect(declaracoes).toMatch(/outline-offset:\s*2px/);

    // O indicador nunca é suprimido em nenhum controle interativo.
    expect(estilos).not.toMatch(/outline\s*:\s*(none|0)\s*;?/);
  });
});
