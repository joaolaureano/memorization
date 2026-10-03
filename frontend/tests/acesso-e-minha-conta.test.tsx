import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NAO_AUTENTICADO } from "../src/acervo-cliente/cliente";
import type { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { Aplicacao } from "../src/ui/Aplicacao";
import { CREDENCIAL_DE_PROVA, clienteDeProva } from "./apoio-de-prova";

/**
 * T1815 — as alterações da conta (017) com Acesso temporário (018; FR-296,
 * SC-120): trocar a Senha ou alterar o Nome de usuário encerra **todos** os
 * Acessos, e o navegador da alteração segue operando com um Acesso novo, sem
 * Entrar de novo; o outro navegador é recusado na próxima operação. Excluir a
 * conta encerra todos e não emite nenhum.
 */

beforeEach(() => {
  window.location.hash = "#/preferencias";
});

afterEach(() => {
  cleanup();
});

/** Dois navegadores do mesmo Usuário, ambos com Acesso: o da tela e o outro. */
async function doisNavegadores(): Promise<{
  servidor: ClienteEmMemoria;
  outro: ClienteEmMemoria;
}> {
  const servidor = clienteDeProva();
  const outro = servidor.outroNavegador();

  await servidor.entrar({ ...CREDENCIAL_DE_PROVA, continuarConectado: true });
  await outro.entrar({ ...CREDENCIAL_DE_PROVA, continuarConectado: true });

  render(
    <Aplicacao criarCliente={(credencial) => servidor.comoUsuario(credencial)} />,
  );
  await screen.findByRole("heading", { level: 2, name: "Minha conta" });
  // As ações aparecem quando o servidor responde com os dados da conta.
  await screen.findByRole("button", { name: "Trocar Senha" });

  return { servidor, outro };
}

function digitar(rotulo: string, valor: string): void {
  fireEvent.change(screen.getByLabelText(rotulo, { selector: "input" }), {
    target: { value: valor },
  });
}

describe("alterações da conta com Acesso temporário", () => {
  it("trocar a Senha: o navegador da troca segue com um Acesso novo e o outro é recusado (FR-296, SC-120)", async () => {
    const { servidor, outro } = await doisNavegadores();

    fireEvent.click(screen.getByRole("button", { name: "Trocar Senha" }));
    digitar("Senha atual", CREDENCIAL_DE_PROVA.senha);
    digitar("Nova Senha", "outra-senha-9");
    digitar("Confirmação da Senha", "outra-senha-9");
    fireEvent.click(screen.getByRole("button", { name: "Trocar Senha" }));

    expect(await screen.findByText("Senha trocada.")).toBeInTheDocument();

    // O navegador da troca continua operando, sem Entrar de novo.
    expect(servidor.temAcessoNoNavegador()).toBe(true);
    expect(await servidor.comoUsuario(null).listarCartoes()).toMatchObject({
      ok: true,
    });
    fireEvent.click(screen.getByRole("link", { name: "Baralhos" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Baralhos" }),
    ).toBeInTheDocument();

    // O outro navegador é recusado na próxima operação.
    expect(await outro.listarCartoes()).toMatchObject({
      ok: false,
      erro: NAO_AUTENTICADO,
    });
  });

  it("alterar o Nome de usuário: o navegador da alteração mostra o nome novo e o outro é recusado (FR-296)", async () => {
    const { servidor, outro } = await doisNavegadores();

    fireEvent.click(
      screen.getByRole("button", { name: "Alterar Nome de usuário" }),
    );
    digitar("Novo Nome de usuário", "usuario.novo");
    digitar("Senha atual", CREDENCIAL_DE_PROVA.senha);
    fireEvent.click(
      screen.getByRole("button", { name: "Alterar Nome de usuário" }),
    );

    expect(
      await screen.findByText("Nome de usuário alterado."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("usuario.novo")).toBeInTheDocument(),
    );
    expect(servidor.temAcessoNoNavegador()).toBe(true);
    expect(await servidor.obterAcesso()).toMatchObject({
      ok: true,
      nomeDeUsuario: "usuario.novo",
    });
    expect(await outro.obterAcesso()).toMatchObject({ ok: false });
  });

  it("o outro navegador, recusado, volta a Entrar com a mensagem explicativa (FR-091 revisado, FR-296)", async () => {
    const { servidor, outro } = await doisNavegadores();

    // O outro navegador é uma segunda página, com o Acesso dele.
    cleanup();
    render(
      <Aplicacao criarCliente={(credencial) => outro.comoUsuario(credencial)} />,
    );
    await screen.findByRole("navigation", { name: "Principal" });

    // A alteração acontece no primeiro navegador.
    await servidor.trocarSenha({
      senhaAtual: CREDENCIAL_DE_PROVA.senha,
      novaSenha: "outra-senha-9",
      confirmacaoDaSenha: "outra-senha-9",
    });

    fireEvent.click(screen.getByRole("link", { name: "Baralhos" }));

    expect(
      await screen.findByRole("alert", { name: "Credencial recusada" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
  });

  it("excluir a conta encerra todos os Acessos, não emite nenhum e leva a Entrar (FR-296, SC-120)", async () => {
    const { servidor, outro } = await doisNavegadores();

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
    expect(servidor.temAcessoNoNavegador()).toBe(false);
    expect(await outro.obterAcesso()).toMatchObject({ ok: false });
  });
});
