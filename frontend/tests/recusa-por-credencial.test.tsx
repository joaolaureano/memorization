import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { Credencial } from "../src/acervo-cliente/cliente";
import { Aplicacao } from "../src/ui/Aplicacao";
import { CREDENCIAL_DE_PROVA, clienteDeProva } from "./apoio-de-prova";

/**
 * Recusa por Credencial na interface (T710; FR-044, FR-091, SC-035, e as
 * verificações negativas de FR-078 e FR-079 em SC-033).
 *
 * Quando uma operação do acervo devolve `nao_autenticado`, a interface descarta
 * a Credencial, volta a "Entrar" com mensagem que explica a recusa e **não**
 * apresenta a operação como concluída. A guarda vive uma vez só, na casca da
 * aplicação, e vale para toda tela do acervo — é isso que estas provas
 * exercitam, pela superfície da Interface `ClienteDoAcervo`.
 *
 * A Credencial que deixou de valer é reproduzida pelo próprio stand-in: o
 * Usuário deixa de existir na base depois de Entrar — o cenário do roteiro de
 * FR-091 —, e a Credencial mantida pela página passa a ser recusada em toda
 * operação. Nenhum valor literal de Senha é versionado: a Credencial vem do
 * apoio das provas, gerada a cada execução.
 */

beforeEach(() => {
  window.location.hash = "#/cartoes";
});

/**
 * A fábrica do cliente da aplicação sobre o "servidor" de prova: todos os
 * clientes que ela devolve compartilham a mesma base, como aconteceria contra a
 * API real.
 */
function criarFabricas(
  servidor: ReturnType<typeof clienteDeProva>,
): (credencial: Credencial | null) => ReturnType<typeof clienteDeProva> {
  return (credencial) => servidor.comoUsuario(credencial);
}

/** Entra pela tela "Entrar" com a Credencial de prova. */
function entrarPelaTela(): void {
  fireEvent.change(screen.getByLabelText("Nome de usuário"), {
    target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: CREDENCIAL_DE_PROVA.senha },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("recusa por Credencial", () => {
  it("a operação de outra tela do acervo, recusada, descarta a Credencial e volta a Entrar com a explicação (FR-091, SC-035)", async () => {
    const servidor = clienteDeProva();

    await servidor.criarBaralho({ nome: "Inglês" });

    render(<Aplicacao criarCliente={criarFabricas(servidor)} />);
    entrarPelaTela();

    // A tela de Cartões carrega com a Credencial ainda válida.
    expect(
      await screen.findByRole("heading", { level: 1, name: "Cartões" }),
    ).toBeInTheDocument();

    // O Usuário deixa de existir: a próxima operação de acervo — a listagem da
    // tela de Baralhos — é recusada.
    servidor.esquecerUsuario(CREDENCIAL_DE_PROVA.nomeDeUsuario);

    fireEvent.click(screen.getByRole("link", { name: "Baralhos" }));

    // A recusa é explicada na tela "Entrar", anunciada por região ativa, e
    // nenhuma tela do acervo permanece alcançável.
    const explicacao = await screen.findByRole("alert", {
      name: "Credencial recusada",
    });

    expect(explicacao).toHaveTextContent(/a credencial não é mais válida/i);
    expect(
      screen.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Inglês")).toBeNull();
    expect(screen.queryByRole("heading", { level: 1, name: "Baralhos" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
    expect(window.location.hash).toBe("#/entrar");
  });

  it("uma criação recusada não aparece como concluída e não altera o acervo (FR-044, FR-090)", async () => {
    const servidor = clienteDeProva();

    await servidor.criarCartao({ frente: "To walk", verso: "Caminhar" });

    render(<Aplicacao criarCliente={criarFabricas(servidor)} />);
    entrarPelaTela();

    // O acervo do Usuário aparece: a Credencial ainda vale nesta operação.
    expect(await screen.findByText("To walk")).toBeInTheDocument();

    // O Usuário deixa de existir, e a Credencial mantida pela página deixa de
    // valer (FR-091).
    servidor.esquecerUsuario(CREDENCIAL_DE_PROVA.nomeDeUsuario);

    fireEvent.change(screen.getByLabelText("Frente"), {
      target: { value: "To run" },
    });
    fireEvent.change(screen.getByLabelText("Verso"), {
      target: { value: "Correr" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar Cartão" }));

    // A tela "Entrar" volta com a explicação, e nada da criação aparece como
    // concluída — nem na tela, nem no acervo.
    expect(
      await screen.findByRole("alert", { name: "Credencial recusada" }),
    ).toHaveTextContent(/credencial não é mais válida/i);
    expect(screen.queryByText("To run")).toBeNull();
    expect(screen.queryByText(/cartão criado/i)).toBeNull();
    expect(screen.queryByRole("heading", { level: 1, name: "Cartões" })).toBeNull();

    // A tela "Entrar" volta, e nenhum rastro da criação recusada permanece —
    // nem uma confirmação, nem o Cartão na lista. A prova de que o acervo ficou
    // intacto depois de cada recusa é da bateria da Seam, que a observa pela
    // Interface `ClienteDoAcervo` (cliente.test.ts, T707).
    expect(screen.queryByText("To run")).toBeNull();
    expect(screen.queryByText(/cartão criado/i)).toBeNull();
    expect(window.location.hash).toBe("#/entrar");
  });

  it("não deixa a Credencial em armazenamento, cookie nem endereço, nem antes nem depois da recusa (FR-078, FR-079, SC-033)", async () => {
    const servidor = clienteDeProva();

    render(<Aplicacao criarCliente={criarFabricas(servidor)} />);
    entrarPelaTela();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: "Cartões" }),
      ).toBeInTheDocument(),
    );

    /** O que o navegador guardou: nada pode carregar a Credencial. */
    const estadoDoNavegador = () => ({
      cookie: document.cookie,
      local: Object.keys(window.localStorage),
      sessao: Object.keys(window.sessionStorage),
      endereco: window.location.href,
    });

    expect(estadoDoNavegador()).toEqual({
      cookie: "",
      local: [],
      sessao: [],
      endereco: expect.not.stringContaining(CREDENCIAL_DE_PROVA.nomeDeUsuario),
    });
    expect(window.location.href).not.toContain(CREDENCIAL_DE_PROVA.senha);

    // O Usuário deixa de existir; a próxima operação é recusada, a Credencial
    // é descartada e nada dela fica no navegador.
    servidor.esquecerUsuario(CREDENCIAL_DE_PROVA.nomeDeUsuario);

    fireEvent.change(screen.getByLabelText("Frente"), {
      target: { value: "To run" },
    });
    fireEvent.change(screen.getByLabelText("Verso"), {
      target: { value: "Correr" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar Cartão" }));

    await screen.findByRole("alert", { name: "Credencial recusada" });

    expect(estadoDoNavegador()).toEqual({
      cookie: "",
      local: [],
      sessao: [],
      endereco: expect.not.stringContaining(CREDENCIAL_DE_PROVA.nomeDeUsuario),
    });
    expect(document.cookie).not.toContain(CREDENCIAL_DE_PROVA.senha);
    expect(window.location.href).not.toContain(CREDENCIAL_DE_PROVA.senha);
  });
});
