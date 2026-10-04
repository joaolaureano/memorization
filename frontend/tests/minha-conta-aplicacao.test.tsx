import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { NAO_AUTENTICADO } from "../src/acervo-cliente/cliente";
import { Aplicacao } from "../src/ui/Aplicacao";
import {
  CREDENCIAL_DE_PROVA,
  clienteDeProva,
  aguardarVerificacaoDoAcesso,
} from "./apoio-de-prova";

/**
 * T1714 — a casca da aplicação com «Minha conta» (017; FR-263, FR-264, FR-270,
 * FR-276, SC-105, SC-106, SC-111): trocar a Senha **substitui** a
 * Credencial em memória sem nova Entrada; excluir a descarta e leva a Entrar
 * com «Conta excluída»; a navegação principal não ganha destino novo.
 */

beforeEach(() => {
  window.location.hash = "#/preferencias";
});

function entrarPelaTela(): void {
  fireEvent.change(screen.getByLabelText("Nome de usuário"), {
    target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: CREDENCIAL_DE_PROVA.senha },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

function digitar(rotulo: string, valor: string): void {
  fireEvent.change(screen.getByLabelText(rotulo, { selector: "input" }), {
    target: { value: valor },
  });
}

async function abrirPreferencias(servidor = clienteDeProva()) {
  render(
    <Aplicacao criarCliente={(credencial) => servidor.comoUsuario(credencial)} />,
  );
  await aguardarVerificacaoDoAcesso();
  entrarPelaTela();

  await screen.findByRole("heading", { level: 1, name: "Perfil" });
  await screen.findByRole("heading", { level: 2, name: "Minha conta" });

  // Os títulos acima renderizam antes de `obterPreferencias()` e `obterConta()`
  // terminarem — o h1 e o h2 aparecem enquanto «Carregando…» ainda está na
  // tela. Só os controles abaixo provam que cada carga chegou ao estado final;
  // sem esta espera, uma requisição inicial ainda em voo com a Credencial
  // antiga poderia voltar recusada depois que o teste a invalida (trocar a
  // Senha, excluir) e encerrar a sessão conforme a ordem das tarefas.
  await waitFor(() => {
    expect(screen.queryByText("Carregando Perfil…")).toBeNull();
    expect(screen.queryByText("Carregando a conta…")).toBeNull();
  });
  // Estado final de cada seção: o campo/controle da carga concluída.
  expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Trocar Senha" }),
  ).toBeInTheDocument();

  return servidor;
}

describe("Minha conta na casca", () => {
  it("não cria destino novo na navegação principal (FR-257)", async () => {
    await abrirPreferencias();

    const navegacao = screen.getByRole("navigation");
    const destinos = within(navegacao).getAllByRole("link");

    expect(destinos.map((destino) => destino.textContent)).not.toContain(
      "Minha conta",
    );
  });

  it("mostra o Nome de usuário somente leitura, sem ação de renomear (FR-336)", async () => {
    await abrirPreferencias();

    expect(
      screen.getByText(CREDENCIAL_DE_PROVA.nomeDeUsuario, { selector: "strong" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Alterar Nome de usuário/ }),
    ).toBeNull();
    expect(screen.queryByLabelText(/Novo Nome de usuário/)).toBeNull();
  });

  it("trocar a Senha mantém a pessoa na tela com a Credencial nova (FR-270)", async () => {
    await abrirPreferencias();

    fireEvent.click(screen.getByRole("button", { name: "Trocar Senha" }));
    digitar("Senha atual", CREDENCIAL_DE_PROVA.senha);
    digitar("Nova Senha", "outra-senha-9");
    digitar("Confirmação da Senha", "outra-senha-9");
    fireEvent.click(screen.getByRole("button", { name: "Trocar Senha" }));

    expect(await screen.findByText("Senha trocada.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Baralhos" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Baralhos" }),
    ).toBeInTheDocument();
  });

  it("excluir a conta descarta a Credencial e leva a Entrar com «Conta excluída» (FR-276, SC-105, SC-111)", async () => {
    const servidor = await abrirPreferencias();

    await servidor.comoUsuario(CREDENCIAL_DE_PROVA).criarCartao({
      frente: "To walk",
      verso: "Caminhar",
    });

    fireEvent.click(screen.getByRole("button", { name: "Excluir conta" }));

    const dialogo = await screen.findByRole("dialog", { name: "Excluir conta?" });

    fireEvent.change(
      within(dialogo).getByLabelText("Senha atual", { selector: "input" }),
      { target: { value: CREDENCIAL_DE_PROVA.senha } },
    );
    fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir conta" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Conta excluída" }),
    ).toHaveTextContent("Conta excluída");
    // Sem Credencial, não há moldura de navegação.
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(window.location.hash).toBe("#/entrar");

    // A Credencial antiga não vale mais.
    expect(
      await servidor.comoUsuario(CREDENCIAL_DE_PROVA).obterConta(),
    ).toMatchObject({ ok: false, erro: NAO_AUTENTICADO });
  });
});
