import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE,
  type BaralhoListado,
  type CartaoListado,
  type ClienteDoAcervo,
} from "../src/acervo-cliente/cliente";
import { clienteDeProva } from "./apoio-de-prova";
import { PaginaDeCartoes } from "../src/ui/PaginaDeCartoes";

/**
 * T1112 — lista de Cartões (specs/012-interface-visual-navegavel/tasks.md;
 * FR-140, FR-141, FR-144, FR-146, FR-147, FR-153, FR-156).
 *
 * A tela é exercitada com o `ClienteEmMemoria`, o Adapter de teste da Seam
 * `ClienteDoAcervo`, sem servidor. As asserções cobrem o estado vazio que
 * orienta a primeira ação com um link de criação (FR-043, FR-141), a listagem
 * que mostra só o título de cada Cartão (spec 021: FR-344), as ações
 * únicas por item (FR-147) e as cargas de listagem com nova tentativa
 * (FR-144, FR-153). Criação e edição passaram a ser exercitadas em
 * `formulario-de-cartao.test.tsx`.
 */

function renderizarPaginaDeCartoes(): void {
  render(<PaginaDeCartoes cliente={clienteDeProva()} />);
}

describe("PaginaDeCartoes", () => {
  it("comunica o estado vazio e oferece o link de criação (FR-043, FR-141)", async () => {
    renderizarPaginaDeCartoes();

    expect(
      screen.getByRole("heading", { level: 1, name: "Cartões" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Seu acervo")).toBeNull();

    expect(await screen.findByText(/ainda não há Cartões/i)).toBeInTheDocument();
    expect(screen.getByText(/crie o primeiro/i)).toBeInTheDocument();

    const criacao = screen.getAllByRole("link", { name: "Criar cartão" });
    expect(criacao.length).toBeGreaterThan(0);

    for (const link of criacao) {
      expect(link).toHaveAttribute("href", "#/cartoes/novo");
    }
  });

  it("mostra só a Frente como título, sem Verso nem Vínculos, com Excluir → Editar (FR-344)", async () => {
    const cliente = clienteDeProva();
    const vinculado = await cliente.criarCartao({
      frente: "To walk",
      verso: "Caminhar",
    });
    const semBaralho = await cliente.criarCartao({
      frente: "To run",
      verso: "Correr",
    });
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!vinculado.ok || !semBaralho.ok || !baralho.ok) {
      throw new Error("as criações do cenário deveriam ser aceitas");
    }

    await cliente.vincular(vinculado.cartao.id, baralho.baralho.id);

    render(<PaginaDeCartoes cliente={cliente} />);

    await screen.findByText("To walk");
    const lista = screen.getByRole("list");

    for (const texto of [
      "Caminhar",
      "Correr",
      "Frente",
      "Verso",
      "Em nenhum Baralho",
      "Inglês",
    ]) {
      expect(within(lista).queryByText(texto)).toBeNull();
    }

    for (const frente of ["To walk", "To run"]) {
      const item = within(lista).getByText(frente).closest("li");

      if (item === null) {
        throw new Error("item do Cartão não encontrado");
      }

      const controles = Array.from(
        item.querySelectorAll<HTMLElement>("button, a[href]"),
      );

      expect(controles).toHaveLength(2);
      expect(controles[0]).toHaveAccessibleName(`Excluir ${frente}`);
      expect(controles[1]).toHaveAccessibleName(`Editar ${frente}`);
    }
  });

  it("oferece ações de Editar e Excluir por item, com nomes acessíveis únicos (FR-147, FR-155)", async () => {
    const cliente = clienteDeProva();

    // Frente e Verso distintos: com o mesmo texto nos dois lados, a Frente
    // deixaria de ser localizável de forma inequívoca na lista.
    for (const dados of [
      { frente: "To walk", verso: "Caminhar" },
      { frente: "To run", verso: "Correr" },
    ]) {
      const cartao = await cliente.criarCartao(dados);

      if (!cartao.ok) {
        throw new Error("a criação do Cartão deveria ser aceita");
      }
    }

    render(<PaginaDeCartoes cliente={cliente} />);

    const item = (await screen.findByText("To walk")).closest("li");

    if (item === null) {
      throw new Error("item do Cartão não encontrado");
    }

    expect(
      within(item).getByRole("link", { name: "Editar To walk" }),
    ).toHaveAttribute("href", expect.stringContaining("#/cartoes/"));
    expect(
      within(item).getByRole("button", { name: "Excluir To walk" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Editar To run" }),
    ).toBeInTheDocument();
  });

  it("cliente indisponível desde o carregamento apresenta a falha com nova tentativa (FR-144, FR-153)", async () => {
    const cliente = clienteDeProva();
    cliente.simularIndisponibilidade();

    render(<PaginaDeCartoes cliente={cliente} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE,
    );
    expect(screen.queryByText(/ainda não há Cartões/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();

    cliente.restaurarDisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText(/ainda não há Cartões/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("PaginaDeCartoes — busca e filtros (022)", () => {
  /**
   * Duplo local da Seam `ClienteDoAcervo`: devolve os dados informados, simula
   * indisponibilidade nas primeiras `vezes` chamadas de `listarCartoes` e
   * remove do acervo o Cartão excluído (FR-044).
   */
  function clienteFalso(
    dados: { cartoes: CartaoListado[]; baralhos: BaralhoListado[] },
    opcoes: { falharCartoes?: { vezes: number } } = {},
  ): ClienteDoAcervo {
    let falhasRestantes = opcoes.falharCartoes?.vezes ?? 0;

    return {
      async listarCartoes() {
        if (falhasRestantes > 0) {
          falhasRestantes -= 1;

          return {
            ok: false,
            erro: INDISPONIVEL,
            mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
          };
        }

        return { ok: true, cartoes: [...dados.cartoes] };
      },
      async listarBaralhos() {
        return { ok: true, baralhos: dados.baralhos };
      },
      async excluirCartao(id: string) {
        dados.cartoes = dados.cartoes.filter((cartao) => cartao.id !== id);

        return { ok: true };
      },
    } as unknown as ClienteDoAcervo;
  }

  /**
   * Acervo de prova com datas relativas a hoje: a Situação da revisão depende
   * do dia em que a prova roda.
   */
  function dadosDeProva(): {
    cartoes: CartaoListado[];
    baralhos: BaralhoListado[];
  } {
    const hoje = new Date();
    const ontem = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate() - 1,
      12,
    ).toISOString();
    const amanha = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate() + 1,
      12,
    ).toISOString();

    const ingles = { id: "b1", nome: "Inglês cotidiano" };
    const viagens = { id: "b2", nome: "Viagens" };

    const cartoes: CartaoListado[] = [
      {
        id: "c1",
        frente: "How are you?",
        verso: "Como você está?",
        baralhos: [ingles, viagens],
        proximaRevisaoEm: ontem,
      },
      {
        id: "c2",
        frente: "Where is the station?",
        verso: "Onde fica a estação?",
        baralhos: [ingles],
        proximaRevisaoEm: null,
      },
      {
        id: "c3",
        frente: "Qual é a função das mitocôndrias?",
        verso: "Produzir ATP pela respiração celular.",
        baralhos: [],
        proximaRevisaoEm: amanha,
      },
      {
        id: "c4",
        frente: "O que é osmose?",
        verso: "Passagem de água pela membrana celular.",
        baralhos: [],
        proximaRevisaoEm: null,
      },
    ];

    const baralhos: BaralhoListado[] = [
      {
        id: "b1",
        nome: "Inglês cotidiano",
        quantidadeDeCartoes: 2,
        elegivel: true,
      },
      { id: "b2", nome: "Viagens", quantidadeDeCartoes: 1, elegivel: true },
      { id: "b3", nome: "Biologia", quantidadeDeCartoes: 0, elegivel: false },
    ];

    return { cartoes, baralhos };
  }

  function campoDeBusca(): HTMLElement {
    return screen.getByRole("searchbox", { name: "Buscar cartões" });
  }

  it("busca no Verso encontra o Cartão e mostra só a Frente (FR-349)", async () => {
    render(<PaginaDeCartoes cliente={clienteFalso(dadosDeProva())} />);

    await screen.findByText("How are you?");

    fireEvent.change(campoDeBusca(), { target: { value: "atp" } });

    const itens = screen.getAllByRole("listitem");
    expect(itens).toHaveLength(1);
    expect(
      within(itens[0]).getByText("Qual é a função das mitocôndrias?"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Produzir ATP pela respiração celular."),
    ).toBeNull();
    expect(screen.queryByText("How are you?")).toBeNull();
  });

  it("oferece as opções do seletor Baralho na ordem esperada (FR-351)", async () => {
    render(<PaginaDeCartoes cliente={clienteFalso(dadosDeProva())} />);

    await screen.findByText("How are you?");

    const seletor = screen.getByRole("combobox", { name: "Baralho" });
    const opcoes = within(seletor)
      .getAllByRole("option")
      .map((opcao) => opcao.textContent);

    expect(opcoes).toEqual([
      "Todos",
      "Sem baralho",
      "Inglês cotidiano",
      "Viagens",
      "Biologia",
    ]);
  });

  it("filtra por Baralho sem repetir o Cartão de dois Baralhos (FR-351)", async () => {
    render(<PaginaDeCartoes cliente={clienteFalso(dadosDeProva())} />);

    await screen.findByText("How are you?");

    const seletor = screen.getByRole("combobox", { name: "Baralho" });

    fireEvent.change(seletor, { target: { value: "b2" } });

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("How are you?")).toBeInTheDocument();
    expect(screen.queryByText("Where is the station?")).toBeNull();

    fireEvent.change(seletor, { target: { value: "b1" } });

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryAllByText("How are you?")).toHaveLength(1);
    expect(screen.getByText("Where is the station?")).toBeInTheDocument();
  });

  it("filtra pelos Cartões sem Baralho (FR-351)", async () => {
    render(<PaginaDeCartoes cliente={clienteFalso(dadosDeProva())} />);

    await screen.findByText("How are you?");

    fireEvent.change(screen.getByRole("combobox", { name: "Baralho" }), {
      target: { value: "sem-baralho" },
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(
      screen.getByText("Qual é a função das mitocôndrias?"),
    ).toBeInTheDocument();
    expect(screen.getByText("O que é osmose?")).toBeInTheDocument();
    expect(screen.queryByText("How are you?")).toBeNull();
    expect(screen.queryByText("Where is the station?")).toBeNull();
  });

  it("filtra pela Situação da revisão: novos, pendentes e em dia (FR-352)", async () => {
    render(<PaginaDeCartoes cliente={clienteFalso(dadosDeProva())} />);

    await screen.findByText("How are you?");

    const seletor = screen.getByRole("combobox", {
      name: "Situação da revisão",
    });

    fireEvent.change(seletor, { target: { value: "novos" } });

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Where is the station?")).toBeInTheDocument();
    expect(screen.getByText("O que é osmose?")).toBeInTheDocument();
    expect(screen.queryByText("How are you?")).toBeNull();
    expect(
      screen.queryByText("Qual é a função das mitocôndrias?"),
    ).toBeNull();

    fireEvent.change(seletor, { target: { value: "revisao-pendente" } });

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("How are you?")).toBeInTheDocument();
    expect(screen.queryByText("Where is the station?")).toBeNull();

    fireEvent.change(seletor, { target: { value: "em-dia" } });

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(
      screen.getByText("Qual é a função das mitocôndrias?"),
    ).toBeInTheDocument();
    expect(screen.queryByText("How are you?")).toBeNull();
  });

  it("combina busca, Baralho e Situação e conta os resultados (FR-353, FR-355)", async () => {
    render(<PaginaDeCartoes cliente={clienteFalso(dadosDeProva())} />);

    await screen.findByText("Where is the station?");

    fireEvent.change(campoDeBusca(), { target: { value: "how" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Baralho" }), {
      target: { value: "b1" },
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Situação da revisão" }),
      { target: { value: "revisao-pendente" } },
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("How are you?")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 resultado");
  });

  it("sem resultados, limpa os filtros pelo próprio estado vazio (FR-354)", async () => {
    render(<PaginaDeCartoes cliente={clienteFalso(dadosDeProva())} />);

    await screen.findByText("How are you?");

    const busca = campoDeBusca();
    fireEvent.change(busca, { target: { value: "xyz" } });

    const estadoVazio = screen
      .getByRole("heading", { name: "Nenhum resultado encontrado" })
      .closest("div");

    if (estadoVazio === null) {
      throw new Error("o estado vazio deveria conter o heading");
    }

    fireEvent.click(
      within(estadoVazio).getByRole("button", { name: "Limpar filtros" }),
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(busca).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Baralho" })).toHaveValue(
      "todos",
    );
    expect(
      screen.getByRole("combobox", { name: "Situação da revisão" }),
    ).toHaveValue("todos");
    expect(busca).toHaveFocus();
  });

  it("falha e nova tentativa preservam os critérios já escolhidos (FR-357)", async () => {
    render(
      <PaginaDeCartoes
        cliente={clienteFalso(dadosDeProva(), { falharCartoes: { vezes: 1 } })}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE,
    );

    const regioes = screen.getAllByRole("status");
    expect(regioes.length).toBeGreaterThan(0);
    for (const regiao of regioes) {
      expect(regiao).toBeEmptyDOMElement();
    }

    const busca = campoDeBusca();
    fireEvent.change(busca, { target: { value: "how" } });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Situação da revisão" }),
      { target: { value: "revisao-pendente" } },
    );

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByText("How are you?");

    expect(busca).toHaveValue("how");
    expect(
      screen.getByRole("combobox", { name: "Situação da revisão" }),
    ).toHaveValue("revisao-pendente");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("Where is the station?")).toBeNull();
  });

  it("exclui com filtros ativos e mantém o filtro de Baralho (FR-357)", async () => {
    render(<PaginaDeCartoes cliente={clienteFalso(dadosDeProva())} />);

    await screen.findByText("How are you?");

    fireEvent.change(screen.getByRole("combobox", { name: "Baralho" }), {
      target: { value: "b1" },
    });
    expect(screen.getByText("2 resultados")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Excluir Where is the station?" }),
    );

    const dialogo = screen.getByRole("dialog");
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Excluir Cartão" }),
    );

    expect(await screen.findByText("1 resultado")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Baralho" })).toHaveValue("b1");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("How are you?")).toBeInTheDocument();
    expect(screen.queryByText("Where is the station?")).toBeNull();
  });

  it("digitar não move o foco do campo de busca (FR-358)", async () => {
    render(<PaginaDeCartoes cliente={clienteFalso(dadosDeProva())} />);

    await screen.findByText("How are you?");

    const busca = campoDeBusca();
    busca.focus();
    expect(busca).toHaveFocus();

    fireEvent.change(busca, { target: { value: "how" } });

    expect(busca).toHaveFocus();
    expect(busca).toHaveValue("how");
  });
});
