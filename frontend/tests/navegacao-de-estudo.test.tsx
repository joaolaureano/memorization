import { act } from "react";

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { Aplicacao } from "../src/ui/Aplicacao";
import { interpretarRota } from "../src/ui/navegacao";
import { CREDENCIAL_DE_PROVA, clienteDeProva } from "./apoio-de-prova";

/**
 * Navegação da Sessão de estudo (T304; specs/004-sessao-de-estudo/tasks.md).
 *
 * A rota `#/baralhos/<id>/estudo` é reconhecida por `interpretarRota` e
 * renderiza `PaginaDeEstudo` na casca da aplicação. O link Baralhos permanece
 * marcado como corrente, porque a Sessão pertence ao Baralho.
 *
 * A casca em uso (`Aplicacao`) é a que registra a proteção de saída: navegar
 * para fora no meio de uma Sessão passa pelo `ProvedorDeProtecaoDeSaida` e
 * pergunta antes de descartar o progresso (T1114, FR-151).
 *
 * T711 (specs/008-entrar/tasks.md): a prova entra antes de operar o acervo — a
 * casca nasce sem Credencial (FR-089) — e as asserções de navegação continuam
 * exatamente as mesmas.
 */

beforeEach(() => {
  window.location.hash = "#/cartoes";
});

/** Muda o hash e entrega o `hashchange` que o navegador dispararia. */
function navegarPara(hash: string): void {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new Event("hashchange"));
  });
}

describe("interpretarRota para Sessão de estudo", () => {
  it("reconhece a rota de estudo do Baralho, inclusive com barra final", () => {
    expect(interpretarRota("#/baralhos/b1/estudo", true)).toEqual({
      nome: "estudo",
      id: "b1",
    });
    expect(interpretarRota("#/baralhos/b1/estudo/", true)).toEqual({
      nome: "estudo",
      id: "b1",
    });
  });

  it("não confunde a rota de estudo com a de detalhe do Baralho", () => {
    expect(interpretarRota("#/baralhos/b1", true)).toEqual({
      nome: "baralho",
      id: "b1",
    });
    // Um caminho mais fundo do que os publicados resolve na rota padrão,
    // Início (FR-168).
    expect(interpretarRota("#/baralhos/b1/estudo/extra", true)).toEqual({
      nome: "inicio",
    });
  });
});

describe("Aplicacao — rota de estudo", () => {
  it("renderiza a tela de estudo e mantém Baralhos como link corrente", async () => {
    const cliente = clienteDeProva();
    const cartao = await cliente.criarCartao({
      frente: "To walk",
      verso: "Caminhar",
    });
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!cartao.ok || !baralho.ok) {
      throw new Error("as criações do cenário deveriam ser aceitas");
    }

    await cliente.vincular(cartao.cartao.id, baralho.baralho.id);

    navegarPara(`#/baralhos/${baralho.baralho.id}/estudo`);
    render(
      <Aplicacao
        criarCliente={(credencial) => cliente.comoUsuario(credencial)}
      />,
    );

    // A casca nasce sem Credencial: a Sessão de estudo só aparece depois de
    // Entrar, pela tela "Entrar" (FR-097).
    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: CREDENCIAL_DE_PROVA.senha },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Estudar Inglês",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Baralhos" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Cartões" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("navegar para fora no meio da Sessão pede confirmação; Cancelar mantém o mesmo Item", async () => {
    const cliente = clienteDeProva();
    const cartao = await cliente.criarCartao({
      frente: "To walk",
      verso: "Caminhar",
    });
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!cartao.ok || !baralho.ok) {
      throw new Error("as criações do cenário deveriam ser aceitas");
    }

    await cliente.vincular(cartao.cartao.id, baralho.baralho.id);

    navegarPara(`#/baralhos/${baralho.baralho.id}/estudo`);
    render(
      <Aplicacao
        criarCliente={(credencial) => cliente.comoUsuario(credencial)}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: CREDENCIAL_DE_PROVA.senha },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    fireEvent.change(screen.getByLabelText("Quantidade de Cartões"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Sessão" }));

    await screen.findByText("Item 1 de 1");

    // Navegar para fora durante a Sessão dispara a confirmação de descarte.
    navegarPara("#/baralhos");

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("Interromper a Sessão?");
    expect(
      within(dialogo).getByRole("button", { name: "Interromper" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Cancelar" }),
    );

    expect(screen.getByText("Item 1 de 1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Revelar verso" }),
    ).toBeInTheDocument();
  });

  it("confirmar a interrupção volta ao Baralho sem Resumo (FR-151)", async () => {
    const cliente = clienteDeProva();
    const cartao = await cliente.criarCartao({
      frente: "To walk",
      verso: "Caminhar",
    });
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!cartao.ok || !baralho.ok) {
      throw new Error("as criações do cenário deveriam ser aceitas");
    }

    await cliente.vincular(cartao.cartao.id, baralho.baralho.id);

    navegarPara(`#/baralhos/${baralho.baralho.id}/estudo`);
    render(
      <Aplicacao
        criarCliente={(credencial) => cliente.comoUsuario(credencial)}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: CREDENCIAL_DE_PROVA.senha },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    fireEvent.change(screen.getByLabelText("Quantidade de Cartões"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Sessão" }));

    await screen.findByText("Item 1 de 1");

    fireEvent.click(screen.getByRole("button", { name: "Interromper" }));

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("Interromper a Sessão?");

    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Interromper" }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Inglês" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Resumo da Sessão" }),
    ).not.toBeInTheDocument();
  });

  it("alterar a quantidade e navegar para fora pede confirmação de descarte", async () => {
    const cliente = clienteDeProva();
    const cartao = await cliente.criarCartao({
      frente: "To walk",
      verso: "Caminhar",
    });
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!cartao.ok || !baralho.ok) {
      throw new Error("as criações do cenário deveriam ser aceitas");
    }

    await cliente.vincular(cartao.cartao.id, baralho.baralho.id);

    navegarPara(`#/baralhos/${baralho.baralho.id}/estudo`);
    render(
      <Aplicacao
        criarCliente={(credencial) => cliente.comoUsuario(credencial)}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: CREDENCIAL_DE_PROVA.senha },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    fireEvent.change(screen.getByLabelText("Quantidade de Cartões"), {
      target: { value: "1" },
    });

    navegarPara("#/baralhos");

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("Descartar a configuração?");
  });
});

/**
 * Rotas próprias das telas novas da `015` na casca (T1522, §7): a Revisão do
 * dia (`#/revisao`) e as Preferências (`#/preferencias`) são reconhecidas por
 * `interpretarRota` e renderizadas por `TelaDaRota`, sob a mesma Moldura e o
 * mesmo cliente com guarda de Credencial das demais páginas. O lançamento da
 * Revisão se dá pelo botão "Revisar" do Início (FR-198), que leva a `#/revisao`.
 */
describe("Aplicacao — Revisão do dia e Preferências", () => {
  /** Entra na casca pela tela "Entrar", como as demais provas de navegação. */
  function entrar(): void {
    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: CREDENCIAL_DE_PROVA.senha },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  }

  it("apresenta a Revisão do dia em #/revisao e marca Início como corrente (FR-198, §7)", async () => {
    const cliente = clienteDeProva();

    navegarPara("#/revisao");
    render(
      <Aplicacao
        criarCliente={(credencial) => cliente.comoUsuario(credencial)}
      />,
    );

    entrar();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Revisão do dia",
      }),
    ).toBeInTheDocument();
    // A Revisão do dia pertence ao Início (`destinoAtivo`, §7).
    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("apresenta as Preferências em #/preferencias e marca Preferências como corrente (FR-212, §7)", async () => {
    const cliente = clienteDeProva();

    navegarPara("#/preferencias");
    render(
      <Aplicacao
        criarCliente={(credencial) => cliente.comoUsuario(credencial)}
      />,
    );

    entrar();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Preferências",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Preferências" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("o botão Revisar do Início leva a #/revisao (FR-198, FR-202)", async () => {
    const cliente = clienteDeProva();
    await cliente.criarCartao({ frente: "To walk", verso: "Caminhar" });

    navegarPara("#/inicio");
    render(
      <Aplicacao
        criarCliente={(credencial) => cliente.comoUsuario(credencial)}
      />,
    );

    entrar();

    fireEvent.click(await screen.findByRole("link", { name: "Revisar" }));

    // A PaginaDaRevisao troca de <h1> entre os estados (carregando → Sessão),
    // e o elemento achado por `findByRole` sai do documento antes do expect;
    // `waitFor` espera o estado estável (FR-202).
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "Revisão do dia",
        }),
      ).toBeInTheDocument(),
    );
    // Com 1 Cartão novo, a Sessão fica pronta e o botão de Revelar aparece,
    // confirmando o estado estável antes de conferir a rota.
    await screen.findByRole("button", { name: "Revelar verso" });
    expect(window.location.hash).toBe("#/revisao");
  });
});
