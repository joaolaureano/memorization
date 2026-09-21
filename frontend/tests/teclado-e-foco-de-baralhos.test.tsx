import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { PaginaDeBaralhos } from "../src/ui/PaginaDeBaralhos";

/**
 * T109 — Criar Baralho e navegar a lista apenas por teclado, com foco visível
 * (specs/002-criar-baralho/tasks.md, FR-058, FR-059, SC-018).
 *
 * A tela é exercitada pela superfície da Seam `ClienteDoAcervo` com o
 * `ClienteEmMemoria`, sem servidor. Três provas:
 *
 * 1. O percurso do campo ao salvamento é concluído só por teclado, na ordem
 *    visual — Nome, Criar Baralho — com o elemento focado conferido a cada
 *    passo por `document.activeElement`.
 * 2. Numa recusa, o foco vai ao campo que precisa de correção, guiado apenas
 *    pelo código de erro devolvido pela Interface (nunca por regra de domínio
 *    replicada na tela); quando o transporte falha, nenhum campo é apontado.
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
  nome: string;
  mensagem: RegExp;
}

/** Os dois modos de recusa de regra de Baralho, ambos no campo Nome (FR-059). */
const CASOS_DE_RECUSA: CasoDeRecusa[] = [
  {
    descricao: "nome_vazio",
    nome: "   ",
    mensagem: /o nome do baralho não pode ficar vazio/i,
  },
  {
    descricao: "nome_muito_longo",
    nome: "x".repeat(101),
    mensagem: /o nome do baralho deve ter no máximo 100 caracteres/i,
  },
];

describe("PaginaDeBaralhos por teclado", () => {
  it("conclui a criação do campo ao salvamento apenas por teclado, na ordem visual Nome → Criar Baralho (FR-058, SC-018)", async () => {
    render(<PaginaDeBaralhos cliente={new ClienteEmMemoria()} />);
    await screen.findByText(/ainda não há Baralhos/i);

    const campoNome = screen.getByLabelText("Nome");
    const botaoDeCriacao = screen.getByRole("button", {
      name: "Criar Baralho",
    });

    // Os únicos controles interativos são o campo e o botão, nesta ordem — a
    // mesma da disposição visual da coluna única.
    const controles = controlesInterativos();
    expect(controles).toHaveLength(2);
    expect(controles[0]).toBe(campoNome);
    expect(controles[1]).toBe(botaoDeCriacao);

    apertarTab();
    expect(document.activeElement).toBe(campoNome);
    digitarPeloTeclado(campoNome, "Inglês");

    apertarTab();
    expect(document.activeElement).toBe(botaoDeCriacao);
    apertarEnter(botaoDeCriacao);

    const baralhoListado = await screen.findByRole("listitem");
    expect(baralhoListado).toHaveTextContent("Inglês");
    expect(baralhoListado).toHaveTextContent(
      "Não elegível para estudo: nenhum Cartão vinculado.",
    );
    expect(campoNome).toHaveValue("");
  });

  it.each(CASOS_DE_RECUSA)(
    "numa recusa $descricao, o foco vai ao campo Nome e o conteúdo permanece (FR-059)",
    async (caso) => {
      render(<PaginaDeBaralhos cliente={new ClienteEmMemoria()} />);
      await screen.findByText(/ainda não há Baralhos/i);

      const campoNome = screen.getByLabelText("Nome");

      digitarPeloTeclado(campoNome, caso.nome);

      // Submete percorrendo a ordem visual por teclado.
      apertarTab(); // Nome
      apertarTab(); // Criar Baralho
      const botaoDeCriacao = screen.getByRole("button", {
        name: "Criar Baralho",
      });
      expect(document.activeElement).toBe(botaoDeCriacao);
      apertarEnter(botaoDeCriacao);

      expect(await screen.findByText(caso.mensagem)).toBeInTheDocument();

      expect(document.activeElement).toBe(campoNome);
      expect(campoNome).toHaveFocus();
      expect(campoNome).toHaveValue(caso.nome);
    },
  );

  it("com o transporte indisponível, o foco permanece no botão — nenhum campo precisa de correção (FR-044, FR-059)", async () => {
    const cliente = new ClienteEmMemoria();
    render(<PaginaDeBaralhos cliente={cliente} />);
    await screen.findByText(/ainda não há Baralhos/i);

    const campoNome = screen.getByLabelText("Nome");
    digitarPeloTeclado(campoNome, "Inglês");

    cliente.simularIndisponibilidade();

    apertarTab(); // Nome
    apertarTab(); // Criar Baralho
    const botaoDeCriacao = screen.getByRole("button", {
      name: "Criar Baralho",
    });
    apertarEnter(botaoDeCriacao);

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS),
    ).toBeInTheDocument();

    expect(document.activeElement).toBe(botaoDeCriacao);
    expect(campoNome).toHaveValue("Inglês");
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
