import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE } from "../src/acervo-cliente/cliente";
import { clienteDeProva } from "./apoio-de-prova";
import { PaginaDeCartoes } from "../src/ui/PaginaDeCartoes";

/**
 * T011 — Criar Cartão e navegar a lista apenas por teclado, com foco visível
 * (specs/001-criar-cartao/tasks.md, FR-054, FR-055, SC-017).
 *
 * A tela é exercitada pela superfície da Seam `ClienteDoAcervo` com o
 * `ClienteEmMemoria`, sem servidor. Três provas:
 *
 * 1. O percurso do primeiro campo ao salvamento é concluído só por teclado, na
 *    ordem visual — Frente, Verso, Criar Cartão — com o elemento focado
 *    conferido a cada passo por `document.activeElement`.
 * 2. Numa recusa, o foco vai ao campo que precisa de correção, guiado apenas
 *    pelo código de erro devolvido pela Interface (nunca por regra de domínio
 *    replicada na tela); quando o transporte falha, nenhum campo é apontado.
 * 3. O indicador de foco de `estilos.css` é um contorno geométrico, sem
 *    depender apenas de cor, e nunca é suprimido.
 *
 * O jsdom não executa os comportamentos padrão de Tab (avanço de foco) nem de
 * Enter sobre botão de submissão (ativação). Os auxiliares abaixo reproduzem
 * exatamente esses comportamentos de navegador — o mesmo papel que
 * `user-event` cumpre — sempre disparando antes o evento de teclado real.
 */

/** Controles interativos da página, na ordem de tabulação (ordem do DOM). */
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
 * comportamento padrão — a ativação do botão de submissão focado.
 */
function apertarEnter(elemento: HTMLElement): void {
  fireEvent.keyDown(elemento, { key: "Enter" });

  if (elemento instanceof HTMLButtonElement && elemento.type === "submit") {
    fireEvent.click(elemento);
  }
}

interface CasoDeRecusa {
  descricao: string;
  frente: string;
  verso: string;
  campo: "Frente" | "Verso";
  mensagem: RegExp;
}

/** Os quatro modos de recusa de regra de Cartão, um por campo (FR-055). */
const CASOS_DE_RECUSA: CasoDeRecusa[] = [
  {
    descricao: "frente_vazia",
    frente: "   ",
    verso: "Caminhar",
    campo: "Frente",
    mensagem: /a frente do cartão não pode ficar vazia/i,
  },
  {
    descricao: "frente_muito_longa",
    frente: "x".repeat(1001),
    verso: "Caminhar",
    campo: "Frente",
    mensagem: /a frente do cartão deve ter no máximo 1000 caracteres/i,
  },
  {
    descricao: "verso_vazio",
    frente: "To walk",
    verso: "   ",
    campo: "Verso",
    mensagem: /o verso do cartão não pode ficar vazio/i,
  },
  {
    descricao: "verso_muito_longo",
    frente: "To walk",
    verso: "x".repeat(1001),
    campo: "Verso",
    mensagem: /o verso do cartão deve ter no máximo 1000 caracteres/i,
  },
];

describe("PaginaDeCartoes por teclado", () => {
  it("conclui a criação do primeiro campo ao salvamento apenas por teclado, na ordem visual Frente → Verso → Criar Cartão (FR-054, SC-017)", async () => {
    render(<PaginaDeCartoes cliente={clienteDeProva()} />);
    await screen.findByText(/ainda não há Cartões/i);

    const campoFrente = screen.getByLabelText("Frente");
    const campoVerso = screen.getByLabelText("Verso");
    const botaoDeCriacao = screen.getByRole("button", { name: "Criar Cartão" });

    // Os únicos controles interativos são os dois campos e o botão, nesta
    // ordem — a mesma da disposição visual da coluna única.
    const controles = controlesInterativos();
    expect(controles).toHaveLength(3);
    expect(controles[0]).toBe(campoFrente);
    expect(controles[1]).toBe(campoVerso);
    expect(controles[2]).toBe(botaoDeCriacao);

    apertarTab();
    expect(document.activeElement).toBe(campoFrente);
    digitarPeloTeclado(campoFrente, "To walk");

    apertarTab();
    expect(document.activeElement).toBe(campoVerso);
    digitarPeloTeclado(campoVerso, "Caminhar");

    apertarTab();
    expect(document.activeElement).toBe(botaoDeCriacao);
    apertarEnter(botaoDeCriacao);

    const cartaoListado = await screen.findByRole("listitem");
    expect(cartaoListado).toHaveTextContent("To walk");
    expect(cartaoListado).toHaveTextContent("Caminhar");
    expect(campoFrente).toHaveValue("");
    expect(campoVerso).toHaveValue("");
  });

  it.each(CASOS_DE_RECUSA)(
    "numa recusa $descricao, o foco vai ao campo $campo e o conteúdo permanece (FR-055)",
    async (caso) => {
      render(<PaginaDeCartoes cliente={clienteDeProva()} />);
      await screen.findByText(/ainda não há Cartões/i);

      const campoFrente = screen.getByLabelText("Frente");
      const campoVerso = screen.getByLabelText("Verso");

      digitarPeloTeclado(campoFrente, caso.frente);
      digitarPeloTeclado(campoVerso, caso.verso);

      // Submete percorrendo a ordem visual por teclado.
      apertarTab(); // Frente
      apertarTab(); // Verso
      apertarTab(); // Criar Cartão
      const botaoDeCriacao = screen.getByRole("button", {
        name: "Criar Cartão",
      });
      expect(document.activeElement).toBe(botaoDeCriacao);
      apertarEnter(botaoDeCriacao);

      expect(await screen.findByText(caso.mensagem)).toBeInTheDocument();

      const campoACorrigir = caso.campo === "Frente" ? campoFrente : campoVerso;
      expect(document.activeElement).toBe(campoACorrigir);
      expect(campoACorrigir).toHaveFocus();
      expect(campoACorrigir).toHaveValue(
        caso.campo === "Frente" ? caso.frente : caso.verso,
      );
    },
  );

  it("com o transporte indisponível, o foco permanece no botão — nenhum campo precisa de correção (FR-044, FR-055)", async () => {
    const cliente = clienteDeProva();
    render(<PaginaDeCartoes cliente={cliente} />);
    await screen.findByText(/ainda não há Cartões/i);

    digitarPeloTeclado(screen.getByLabelText("Frente"), "To walk");
    digitarPeloTeclado(screen.getByLabelText("Verso"), "Caminhar");

    cliente.simularIndisponibilidade();

    apertarTab(); // Frente
    apertarTab(); // Verso
    apertarTab(); // Criar Cartão
    const botaoDeCriacao = screen.getByRole("button", { name: "Criar Cartão" });
    apertarEnter(botaoDeCriacao);

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE),
    ).toBeInTheDocument();

    expect(document.activeElement).toBe(botaoDeCriacao);
    expect(screen.getByLabelText("Frente")).toHaveValue("To walk");
    expect(screen.getByLabelText("Verso")).toHaveValue("Caminhar");
  });

  it("o indicador de foco é um contorno geométrico e não depende apenas de cor (FR-055, SC-013)", () => {
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
