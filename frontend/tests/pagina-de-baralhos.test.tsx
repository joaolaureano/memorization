import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS } from "../src/acervo-cliente/cliente";
import type { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva } from "./apoio-de-prova";
import { PaginaDeBaralhos } from "../src/ui/PaginaDeBaralhos";

/**
 * T1108 — lista de Baralhos (spec 012: FR-140, FR-144, FR-148, FR-153; e
 * FR-046 herdado de 002/005).
 *
 * A tela é exercitada com o `ClienteEmMemoria`, o Adapter de teste da Seam
 * `ClienteDoAcervo`, sem servidor. A criação mora em outra tela: aqui se prova
 * que a lista apenas a alcança por ação da pessoa (FR-140), que cada Baralho
 * aparece como uma linha compacta, com o nome somente leitura, a contagem e
 * as ações Estudar → Editar (spec 021: FR-340–FR-343), que o estado vazio
 * orienta a primeira ação (FR-153) e que a falha de listagem oferece nova
 * tentativa (FR-148).
 *
 * O acervo é semeado pela própria Interface — `criarBaralho`, `criarCartao` e
 * `vincular` —, nunca por um caminho que a tela ofereça.
 */

/** Cria um Baralho já vinculado aos Cartões informados, pela Interface. */
async function semearBaralho(
  cliente: ClienteEmMemoria,
  nome: string,
  frentes: string[] = [],
): Promise<string> {
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

  return criacao.baralho.id;
}

/** Renderiza a lista com o cliente informado, devolvendo-o para o cenário. */
function renderizarPaginaDeBaralhos(
  cliente: ClienteEmMemoria = clienteDeProva(),
): ClienteEmMemoria {
  render(<PaginaDeBaralhos cliente={cliente} />);

  return cliente;
}

/** O item de lista do Baralho de nome informado, pelo texto do próprio nome. */
function itemDoBaralho(nome: string): HTMLElement {
  const item = screen.getByText(nome).closest("li");

  if (item === null) {
    throw new Error(`Item do Baralho "${nome}" não encontrado.`);
  }

  return item;
}

/** A região do estado vazio, para restringir asserções à sua ação. */
function estadoVazio(): HTMLElement {
  const mensagem = screen.getByText(/ainda não há Baralhos/i);
  const regiao = mensagem.closest("div");

  if (regiao === null) {
    throw new Error("Região do estado vazio não encontrada.");
  }

  return regiao;
}

describe("PaginaDeBaralhos", () => {
  it("apresenta o cabeçalho e alcança a criação apenas por ação da pessoa (FR-140)", async () => {
    renderizarPaginaDeBaralhos();

    expect(
      screen.getByRole("heading", { level: 1, name: "Baralhos" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Seu acervo")).toBeNull();
    expect(
      screen.getByText("Escolha o que você quer memorizar hoje."),
    ).toBeInTheDocument();

    const linkDeCriacao = screen.getByRole("link", { name: "Criar baralho" });
    expect(linkDeCriacao).toHaveAttribute("href", "#/baralhos/novo");

    // A lista não abre formulário nenhum: a criação começa pelo link.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await screen.findByText(/ainda não há Baralhos/i);
  });

  it("o estado vazio orienta a primeira ação com o mesmo acesso à criação (FR-153)", async () => {
    renderizarPaginaDeBaralhos();

    await screen.findByText(/ainda não há Baralhos/i);

    expect(estadoVazio()).toHaveTextContent(
      "Ainda não há Baralhos. Crie o primeiro para começar a estudar.",
    );
    expect(
      within(estadoVazio()).getByRole("link", { name: "Criar baralho" }),
    ).toHaveAttribute("href", "#/baralhos/novo");
  });

  it("lista cada Baralho em uma linha: o nome é texto somente leitura e Editar abre o detalhe (FR-341, FR-342)", async () => {
    const cliente = clienteDeProva();
    const idDeIngles = await semearBaralho(cliente, "Inglês", [
      "Hello",
      "Goodbye",
    ]);
    const idDeAlemao = await semearBaralho(cliente, "Alemão");

    renderizarPaginaDeBaralhos(cliente);

    await screen.findAllByRole("listitem");

    for (const [nome, id, contagem] of [
      ["Inglês", idDeIngles, "2 Cartões"],
      ["Alemão", idDeAlemao, "0 Cartões"],
    ] as const) {
      const item = itemDoBaralho(nome);
      const nomeDoBaralho = within(item).getByText(nome);

      expect(screen.queryByRole("link", { name: nome })).toBeNull();
      expect(screen.queryByRole("button", { name: nome })).toBeNull();
      expect(nomeDoBaralho).not.toHaveAttribute("tabindex");
      expect(nomeDoBaralho.closest("a")).toBeNull();
      expect(within(item).getByText(contagem)).toBeInTheDocument();

      // Editar leva ao mesmo destino que o antigo link do nome (FR-342).
      expect(
        within(item).getByRole("link", { name: `Editar ${nome}` }),
      ).toHaveAttribute("href", `#/baralhos/${id}`);
    }

    // A linha compacta não traz rótulo de tipo nem linha de status.
    expect(screen.queryByText("Baralho")).toBeNull();
    expect(screen.queryByText(/pronto para/i)).toBeNull();
    expect(screen.queryByText(/adicione cartões/i)).toBeNull();
  });

  it("pluraliza a contagem de um único Cartão em texto visível (FR-340)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Inglês", ["Hello"]);

    renderizarPaginaDeBaralhos(cliente);

    await screen.findByRole("listitem");

    expect(
      within(itemDoBaralho("Inglês")).getByText("1 Cartão"),
    ).toBeVisible();
  });

  it("o Estudar de um Baralho com Cartões é um link para a Sessão de estudo (FR-144)", async () => {
    const cliente = clienteDeProva();
    const id = await semearBaralho(cliente, "Inglês", ["Hello"]);

    renderizarPaginaDeBaralhos(cliente);

    const linkDeEstudo = await screen.findByRole("link", {
      name: "Estudar Inglês",
    });

    expect(linkDeEstudo).toHaveAttribute("href", `#/baralhos/${id}/estudo`);
  });

  it("o Estudar de um Baralho vazio é um botão desabilitado descrito pelo motivo (FR-144)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Alemão");

    renderizarPaginaDeBaralhos(cliente);

    const botaoDeEstudo = await screen.findByRole("button", {
      name: "Estudar Alemão",
    });

    expect(botaoDeEstudo).toBeDisabled();
    expect(botaoDeEstudo).toHaveAccessibleDescription(
      "Sem Cartões para estudar.",
    );
  });

  it("cada Baralho tem exatamente dois controles, Estudar e Editar, nessa ordem (FR-340, FR-346)", async () => {
    const cliente = clienteDeProva();
    const idDeIngles = await semearBaralho(cliente, "Inglês", ["Hello"]);
    const idDeAlemao = await semearBaralho(cliente, "Alemão");

    renderizarPaginaDeBaralhos(cliente);

    await screen.findAllByRole("listitem");

    const controlesDeIngles = Array.from(
      itemDoBaralho("Inglês").querySelectorAll<HTMLElement>("button, a[href]"),
    );

    expect(controlesDeIngles).toHaveLength(2);
    expect(controlesDeIngles[0]).toHaveAccessibleName("Estudar Inglês");
    expect(controlesDeIngles[0]).toHaveAttribute(
      "href",
      `#/baralhos/${idDeIngles}/estudo`,
    );
    expect(controlesDeIngles[1]).toHaveAccessibleName("Editar Inglês");
    expect(controlesDeIngles[1]).toHaveAttribute(
      "href",
      `#/baralhos/${idDeIngles}`,
    );

    const controlesDeAlemao = Array.from(
      itemDoBaralho("Alemão").querySelectorAll<HTMLElement>("button, a[href]"),
    );

    expect(controlesDeAlemao).toHaveLength(2);
    expect(controlesDeAlemao[0]).toHaveAccessibleName("Estudar Alemão");
    expect(controlesDeAlemao[0]).toBeDisabled();
    expect(controlesDeAlemao[1]).toHaveAccessibleName("Editar Alemão");
    expect(controlesDeAlemao[1]).toHaveAttribute(
      "href",
      `#/baralhos/${idDeAlemao}`,
    );
  });

  it("a falha de listagem traz a mensagem da Interface e relê o acervo na nova tentativa (FR-046, FR-148)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Inglês", ["Hello"]);
    cliente.simularIndisponibilidade();

    renderizarPaginaDeBaralhos(cliente);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    );
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();

    cliente.restaurarDisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByRole("listitem")).toHaveTextContent("Inglês");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("PaginaDeBaralhos — busca (022)", () => {
  /** A região de «Nenhum resultado encontrado», para restringir asserções. */
  function regiaoSemResultados(): HTMLElement {
    const titulo = screen.getByRole("heading", {
      name: "Nenhum resultado encontrado",
    });
    const regiao = titulo.closest("div");

    if (regiao === null) {
      throw new Error("Região de «Nenhum resultado encontrado» não achada.");
    }

    return regiao;
  }

  it("encontra «Álgebra linear» buscando «algebra», com a contagem «1 resultado» (FR-348, FR-350, FR-355)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Álgebra linear");
    await semearBaralho(cliente, "Biologia");

    renderizarPaginaDeBaralhos(cliente);
    await screen.findAllByRole("listitem");

    const campo = screen.getByRole("searchbox", { name: "Buscar baralhos" });
    campo.focus();

    // O texto casa por trecho contínuo, sem acentos e sem caixa (FR-348).
    fireEvent.change(campo, { target: { value: "algebra" } });

    expect(
      within(itemDoBaralho("Álgebra linear")).getByText("Álgebra linear"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("Biologia")).not.toBeInTheDocument();

    // A contagem é anunciada pela faixa `role="status"` (FR-355).
    expect(screen.getByRole("status")).toHaveTextContent("1 resultado");

    // Digitar só refiltra: o foco não sai do campo (FR-358).
    expect(campo).toHaveFocus();
  });

  it("conta no plural e mostra todos com a busca vazia ou só com espaços (FR-350, FR-355)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Álgebra linear");
    await semearBaralho(cliente, "Biologia");

    renderizarPaginaDeBaralhos(cliente);
    await screen.findAllByRole("listitem");

    const campo = screen.getByRole("searchbox", { name: "Buscar baralhos" });

    expect(screen.getByRole("status")).toHaveTextContent("2 resultados");

    // Consulta só com espaços não restringe (FR-350).
    fireEvent.change(campo, { target: { value: "   " } });

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("2 resultados");

    fireEvent.change(campo, { target: { value: "" } });

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("2 resultados");
  });

  it("mostra «Nenhum resultado encontrado» com Limpar filtros, que restaura a lista e devolve o foco à busca (FR-354, FR-355)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Álgebra linear");
    await semearBaralho(cliente, "Biologia");

    renderizarPaginaDeBaralhos(cliente);
    await screen.findAllByRole("listitem");

    const campo = screen.getByRole("searchbox", { name: "Buscar baralhos" });
    fireEvent.change(campo, { target: { value: "xyz" } });

    // Nenhum Baralho satisfaz a consulta: estado distinto do acervo vazio
    // (FR-354), com a contagem honesta (FR-355).
    expect(
      screen.getByRole("heading", { name: "Nenhum resultado encontrado" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 resultados");

    // O "Limpar filtros" acionado é o do próprio estado vazio, não o da faixa.
    fireEvent.click(
      within(regiaoSemResultados()).getByRole("button", {
        name: "Limpar filtros",
      }),
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(campo).toHaveValue("");
    expect(campo).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("2 resultados");
  });

  it("preserva Estudar e Editar com o mesmo destino durante a busca (FR-356)", async () => {
    const cliente = clienteDeProva();
    const id = await semearBaralho(cliente, "Álgebra linear", ["Fórmula"]);
    await semearBaralho(cliente, "Biologia");

    renderizarPaginaDeBaralhos(cliente);
    await screen.findAllByRole("listitem");

    const hrefDeEstudo = within(itemDoBaralho("Álgebra linear"))
      .getByRole("link", { name: "Estudar Álgebra linear" })
      .getAttribute("href");
    const hrefDeEdicao = within(itemDoBaralho("Álgebra linear"))
      .getByRole("link", { name: "Editar Álgebra linear" })
      .getAttribute("href");

    expect(hrefDeEstudo).toBe(`#/baralhos/${id}/estudo`);
    expect(hrefDeEdicao).toBe(`#/baralhos/${id}`);

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar baralhos" }),
      { target: { value: "algebra" } },
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(
      within(itemDoBaralho("Álgebra linear"))
        .getByRole("link", { name: "Estudar Álgebra linear" })
        .getAttribute("href"),
    ).toBe(hrefDeEstudo);
    expect(
      within(itemDoBaralho("Álgebra linear"))
        .getByRole("link", { name: "Editar Álgebra linear" })
        .getAttribute("href"),
    ).toBe(hrefDeEdicao);
  });

  it("acervo vazio continua com o estado vazio existente, não com «Nenhum resultado» (FR-355)", async () => {
    renderizarPaginaDeBaralhos();

    await screen.findByText(/ainda não há Baralhos/i);

    const campo = screen.getByRole("searchbox", { name: "Buscar baralhos" });
    fireEvent.change(campo, { target: { value: "xyz" } });

    expect(estadoVazio()).toHaveTextContent(
      "Ainda não há Baralhos. Crie o primeiro para começar a estudar.",
    );
    expect(
      within(estadoVazio()).getByRole("link", { name: "Criar baralho" }),
    ).toHaveAttribute("href", "#/baralhos/novo");
    expect(
      screen.queryByRole("heading", { name: "Nenhum resultado encontrado" }),
    ).not.toBeInTheDocument();
    expect(campo).toBeInTheDocument();
  });

  it("falha de leitura não mostra contagem e Tentar novamente preserva a consulta (FR-357)", async () => {
    const cliente = clienteDeProva();
    await semearBaralho(cliente, "Álgebra linear");
    await semearBaralho(cliente, "Biologia");
    cliente.simularIndisponibilidade();

    renderizarPaginaDeBaralhos(cliente);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    );

    // A faixa de contagem existe sempre, mas fica vazia durante a falha.
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    // O painel de busca continua disponível durante a falha: a consulta é
    // digitada entre a falha e a nova tentativa.
    const campo = screen.getByRole("searchbox", { name: "Buscar baralhos" });
    fireEvent.change(campo, { target: { value: "algebra" } });

    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    cliente.restaurarDisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findAllByRole("listitem");

    // A releitura não zera a consulta: o texto permanece e o filtro segue
    // aplicado (FR-357).
    expect(campo).toHaveValue("algebra");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(
      within(itemDoBaralho("Álgebra linear")).getByText("Álgebra linear"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Biologia")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 resultado");
  });
});
