import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";

/**
 * T1110 — tela de detalhe do Baralho
 * (specs/012-interface-visual-navegavel/tasks.md, FR-145, FR-392, FR-396,
 * FR-401, FR-402, FR-153, FR-156; specs/025-criar-cartoes-baralho).
 *
 * A tela é exercitada com o `ClienteEmMemoria`, o Adapter de teste da Seam
 * `ClienteDoAcervo`, sem servidor. As asserções cobrem a apresentação do
 * Baralho e da contagem, o caminho para Revisar (primeiro e desabilitado sem
 * Cartões — a ação da spec 024, FR-378), a criação de Cartões neste Baralho
 * (FR-392), a exclusão de Cartão com confirmação explícita (FR-401, FR-396),
 * o Baralho inexistente e a falha de gravação (FR-044, FR-045, SC-012).
 */

interface AcervoDeTeste {
  cliente: ClienteEmMemoria;
  idDoBaralho: string;
  idDoPrimeiroCartao: string;
  idDoSegundoCartao: string;
}

async function criarAcervoDeTeste(): Promise<AcervoDeTeste> {
  const cliente = clienteDeProva();
  const baralho = await cliente.criarBaralho({ nome: "Inglês" });

  if (!baralho.ok) {
    throw new Error("a criação do Baralho deveria ser aceita");
  }

  const primeiroCartao = await cliente.criarCartao(baralho.baralho.id, {
    frente: "To walk",
    verso: "Caminhar",
  });
  const segundoCartao = await cliente.criarCartao(baralho.baralho.id, {
    frente: "To run",
    verso: "Correr",
  });

  if (!primeiroCartao.ok || !segundoCartao.ok) {
    throw new Error("as criações do Cartão deveriam ser aceitas");
  }

  return {
    cliente,
    idDoBaralho: baralho.baralho.id,
    idDoPrimeiroCartao: primeiroCartao.cartao.id,
    idDoSegundoCartao: segundoCartao.cartao.id,
  };
}

/**
 * Acervo de prova com três Cartões — quantidade suficiente para que
 * a lista de Cartões tenha controles próprios (Editar, Excluir) além das
 * ações do Baralho, o que permite provar a ordem de leitura e de Tab
 * (FR-145 revisado, SC-078).
 */
async function criarAcervoDeTesteComTresCartoes(): Promise<AcervoDeTeste> {
  const cliente = clienteDeProva();
  const baralho = await cliente.criarBaralho({ nome: "Inglês" });

  if (!baralho.ok) {
    throw new Error("a criação do Baralho deveria ser aceita");
  }

  const cartoes: string[] = [];
  for (const [frente, verso] of [
    ["To walk", "Caminhar"],
    ["To run", "Correr"],
    ["To sleep", "Dormir"],
  ]) {
    const cartao = await cliente.criarCartao(baralho.baralho.id, {
      frente,
      verso,
    });

    if (!cartao.ok) {
      throw new Error("a criação do Cartão deveria ser aceita");
    }

    cartoes.push(cartao.cartao.id);
  }

  return {
    cliente,
    idDoBaralho: baralho.baralho.id,
    idDoPrimeiroCartao: cartoes[0],
    idDoSegundoCartao: cartoes[1],
  };
}

function renderizar(cliente: ClienteEmMemoria, idDoBaralho: string): void {
  render(comProtecaoDeSaida(<PaginaDoBaralho cliente={cliente} id={idDoBaralho} />, true));
}

/** A seção cujo título de nível 2 tem o nome informado. */
function secao(nome: string): HTMLElement {
  return screen.getByRole("region", { name: nome });
}

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
 * Aperta Tab a partir de um elemento não tabulável (o título, por exemplo):
 * dispara o evento de teclado e leva o foco ao primeiro controle que vem
 * depois dele na ordem do documento, como faria o navegador.
 */
function apertarTabAPartirDe(origem: HTMLElement): void {
  fireEvent.keyDown(origem, { key: "Tab" });

  const proximo = controlesInterativos().find(
    (controle) =>
      (origem.compareDocumentPosition(controle) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
      0,
  );

  proximo?.focus();
}

describe("PaginaDoBaralho", () => {
  it("apresenta o Baralho, a contagem e o caminho para Revisar (FR-145, FR-378)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTeste();

    renderizar(cliente, idDoBaralho);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Inglês" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 Cartões neste Baralho.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Revisar este Baralho" }),
    ).toHaveAttribute("href", `#/baralhos/${idDoBaralho}/estudo`);
  });

  it("sem Cartões, Revisar fica desabilitado com a explicação e o vazio oferece criar (FR-145, FR-153, FR-378, FR-392)", async () => {
    const cliente = clienteDeProva();
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!baralho.ok) {
      throw new Error("a criação do Baralho deveria ser aceita");
    }

    renderizar(cliente, baralho.baralho.id);

    await screen.findByRole("heading", { level: 1, name: "Inglês" });

    const revisar = screen.getByRole("button", { name: "Revisar este Baralho" });
    expect(revisar).toBeDisabled();
    expect(revisar).toHaveAccessibleDescription(
      "Crie Cartões neste Baralho para poder revisar.",
    );
    const estadoVazio = screen.getByText("Este Baralho ainda não tem Cartões.").closest(
      "div",
    );
    expect(estadoVazio).toBeInTheDocument();
    expect(
      within(estadoVazio!).getByRole("link", { name: "Criar Cartão" }),
    ).toHaveAttribute("href", `#/baralhos/${baralho.baralho.id}/cartoes/novo`);
  });

  it("apresenta Frente e Verso de cada Cartão com botões Editar e Excluir (FR-025)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTeste();

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", { level: 1, name: "Inglês" });

    const secaoDeCartoes = secao("Cartões do Baralho");
    const cartoes = within(secaoDeCartoes).getAllByRole("listitem");

    expect(cartoes).toHaveLength(2);
    expect(within(cartoes[0]).getByText("To walk")).toBeInTheDocument();
    expect(within(cartoes[0]).getByText("Caminhar")).toBeInTheDocument();
    expect(
      within(cartoes[0]).getByRole("link", { name: "Editar" }),
    ).toHaveAttribute("href", expect.stringContaining("/editar"));
    expect(
      within(cartoes[0]).getByRole("button", { name: "Excluir To walk" }),
    ).toBeInTheDocument();
  });

  it("exclui Cartão com confirmação explícita que menciona Agendamento (FR-401, FR-396)", async () => {
    const { cliente, idDoBaralho, idDoPrimeiroCartao, idDoSegundoCartao } =
      await criarAcervoDeTeste();

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("region", { name: "Cartões do Baralho" });
    const botaoDeExcluir = screen.getByRole("button", {
      name: "Excluir To walk",
    });

    fireEvent.click(botaoDeExcluir);

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveAccessibleName("Excluir \"To walk\"?");
    expect(dialogo).toHaveTextContent(
      "O Cartão e seu Agendamento serão removidos.",
    );
    expect(dialogo).toHaveTextContent(
      /Registros históricos já concluídos permanecerão/i,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("To walk")).toBeInTheDocument();
    expect(botaoDeExcluir).toHaveFocus();

    const baralho = await cliente.obterBaralho(idDoBaralho);

    expect(baralho.ok).toBe(true);

    if (baralho.ok) {
      expect(baralho.baralho.cartoes).toHaveLength(2);
      expect(baralho.baralho.cartoes[0].id).toBe(idDoPrimeiroCartao);
      expect(baralho.baralho.cartoes[1].id).toBe(idDoSegundoCartao);
    }
  });

  it("confirmar exclui o Cartão, remove da lista e anuncia (FR-401, FR-396)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTeste();

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("region", { name: "Cartões do Baralho" });
    fireEvent.click(screen.getByRole("button", { name: "Excluir To walk" }));

    fireEvent.click(
      await screen.findByRole("button", { name: "Excluir Cartão" }),
    );

    expect(
      await screen.findByText(/Cartão To walk e seu Agendamento foram excluídos/i),
    ).toBeInTheDocument();
    expect(
      within(secao("Cartões do Baralho")).getByText("To run"),
    ).toBeInTheDocument();
    expect(screen.queryByText("To walk")).not.toBeInTheDocument();
    expect(screen.getByText("1 Cartão neste Baralho.")).toBeInTheDocument();

    const baralho = await cliente.obterBaralho(idDoBaralho);

    expect(baralho.ok).toBe(true);

    if (baralho.ok) {
      expect(baralho.baralho.cartoes).toHaveLength(1);
      expect(baralho.baralho.cartoes[0].frente).toBe("To run");
    }
  });

  it("Escape cancela a exclusão e devolve o foco ao controle invocador (FR-401)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTeste();

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("region", { name: "Cartões do Baralho" });
    const botaoDeExcluir = screen.getByRole("button", {
      name: "Excluir To walk",
    });

    fireEvent.click(botaoDeExcluir);

    const dialogo = await screen.findByRole("dialog");
    fireEvent.keyDown(dialogo, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("To walk")).toBeInTheDocument();
    expect(botaoDeExcluir).toHaveFocus();
  });

  it("Baralho inexistente mostra a mensagem em português (FR-156)", async () => {
    renderizar(clienteDeProva(), "b-inexistente");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Baralho não encontrado",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Baralho não encontrado.")).toBeInTheDocument();
  });

  it("as ações do Baralho aparecem antes da lista, na ordem Revisar, Criar, Renomear e Excluir (FR-145 revisado, SC-078)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTesteComTresCartoes();

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", { level: 1, name: "Inglês" });

    const acoes = [
      screen.getByRole("link", { name: "Revisar este Baralho" }),
      screen.getByRole("link", { name: "Criar Cartão" }),
      screen.getByRole("link", { name: "Renomear" }),
      screen.getByRole("button", { name: "Excluir Baralho" }),
    ];
    const tituloDosCartoes = screen.getByRole("region", {
      name: "Cartões do Baralho",
    });
    const botoesDeExcluirCartao = within(tituloDosCartoes).getAllByRole(
      "button",
      { name: /^Excluir / },
    );

    expect(botoesDeExcluirCartao).toHaveLength(3);

    // Cada ação precede o título da lista e cada controle de Cartão.
    for (const acao of acoes) {
      expect(
        acao.compareDocumentPosition(tituloDosCartoes) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      for (const excluir of botoesDeExcluirCartao) {
        expect(
          acao.compareDocumentPosition(excluir) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
    }

    // E, entre si, na ordem visual: Revisar, Criar, Renomear e Excluir.
    for (let indice = 1; indice < acoes.length; indice += 1) {
      expect(
        acoes[indice - 1].compareDocumentPosition(acoes[indice]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("a partir do título, o Tab alcança as ações do Baralho antes de qualquer Cartão (FR-158, SC-078)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTesteComTresCartoes();

    renderizar(cliente, idDoBaralho);

    const titulo = await screen.findByRole("heading", {
      level: 1,
      name: "Inglês",
    });
    const revisar = screen.getByRole("link", { name: "Revisar este Baralho" });
    const criar = screen.getByRole("link", { name: "Criar Cartão" });
    const renomear = screen.getByRole("link", { name: "Renomear" });
    const excluirBaralho = screen.getByRole("button", {
      name: "Excluir Baralho",
    });

    apertarTabAPartirDe(titulo);
    expect(document.activeElement).toBe(revisar);

    apertarTab();
    expect(document.activeElement).toBe(criar);

    apertarTab();
    expect(document.activeElement).toBe(renomear);

    apertarTab();
    expect(document.activeElement).toBe(excluirBaralho);

    // Nenhum botão de exclusão de Cartão foi alcançado antes das quatro ações.
    const secaoCartoes = screen.getByRole("region", {
      name: "Cartões do Baralho",
    });
    for (const excluirCartao of within(secaoCartoes).getAllByRole("button", {
      name: /^Excluir /,
    })) {
      expect(excluirCartao).not.toBe(document.activeElement);
    }
  });
});
