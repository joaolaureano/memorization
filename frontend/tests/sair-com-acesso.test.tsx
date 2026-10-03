import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { INDISPONIVEL, NAO_AUTENTICADO } from "../src/acervo-cliente/cliente";
import type { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { Aplicacao } from "../src/ui/Aplicacao";
import { MENSAGEM_DE_SAIDA } from "../src/ui/PaginaDeEntrada";
import {
  CREDENCIAL_DE_PROVA,
  aguardarVerificacaoDoAcesso,
  clienteDeProva,
} from "./apoio-de-prova";

/**
 * T1814 — Sair com Acesso temporário (018; FR-293, FR-295, FR-299, FR-304;
 * SC-119): Sair chama `POST /sair`, encerra o Acesso **deste** navegador,
 * descarta a Credencial e leva a Entrar; a falha do armazenamento não conclui o
 * Sair.
 */

beforeEach(() => {
  window.location.hash = "#/inicio";
});

afterEach(() => {
  cleanup();
});

async function abrirComAcesso(servidor: ClienteEmMemoria): Promise<void> {
  await servidor.entrar({ ...CREDENCIAL_DE_PROVA, continuarConectado: true });

  render(
    <Aplicacao criarCliente={(credencial) => servidor.comoUsuario(credencial)} />,
  );
  await screen.findByRole("navigation", { name: "Principal" });
}

describe("Sair com Acesso temporário", () => {
  it("encerra o Acesso do navegador, leva a Entrar e move o foco para o título (FR-293, FR-295, FR-304)", async () => {
    const servidor = clienteDeProva();

    await abrirComAcesso(servidor);
    expect(servidor.temAcessoNoNavegador()).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    const titulo = await screen.findByRole("heading", {
      level: 1,
      name: "Entrar",
    });

    expect(servidor.temAcessoNoNavegador()).toBe(false);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByText(MENSAGEM_DE_SAIDA)).toBeVisible();
    // O foco vai ao título da tela de destino, o que o leitor de tela anuncia.
    await waitFor(() => expect(titulo).toHaveFocus());
  });

  it("reabrir depois de Sair exige Entrar, e o Acesso encerrado não volta a valer (FR-295, SC-119)", async () => {
    const servidor = clienteDeProva();

    await abrirComAcesso(servidor);
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await screen.findByRole("heading", { level: 1, name: "Entrar" });

    cleanup();

    render(
      <Aplicacao criarCliente={(credencial) => servidor.comoUsuario(credencial)} />,
    );
    await aguardarVerificacaoDoAcesso();

    expect(
      screen.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
    expect(await servidor.obterAcesso()).toMatchObject({
      ok: false,
      erro: "sem_acesso",
    });
    expect(await servidor.comoUsuario(null).listarCartoes()).toMatchObject({
      ok: false,
      erro: NAO_AUTENTICADO,
    });
  });

  it("a falha do armazenamento não conclui o Sair: a pessoa segue onde está, com a falha anunciada (FR-044, FR-295)", async () => {
    const servidor = clienteDeProva();

    await servidor.entrar({ ...CREDENCIAL_DE_PROVA, continuarConectado: true });

    render(
      <Aplicacao
        criarCliente={(credencial) => {
          const cliente = servidor.comoUsuario(credencial);

          cliente.sair = async () => ({
            ok: false,
            erro: INDISPONIVEL,
            mensagem: "Não foi possível verificar o seu acesso agora.",
          });

          return cliente;
        }}
      />,
    );
    await screen.findByRole("navigation", { name: "Principal" });

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(
      await screen.findByRole("alert", { name: "Falha ao Sair" }),
    ).toHaveTextContent(/Não foi possível/);
    expect(
      screen.getByRole("navigation", { name: "Principal" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(MENSAGEM_DE_SAIDA)).toBeNull();
    expect(servidor.temAcessoNoNavegador()).toBe(true);
  });

  it("Sair num navegador não afeta o Acesso do outro (FR-299)", async () => {
    const servidor = clienteDeProva();
    const outroNavegador = servidor.outroNavegador();

    await outroNavegador.entrar({
      ...CREDENCIAL_DE_PROVA,
      continuarConectado: true,
    });
    await abrirComAcesso(servidor);

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await screen.findByRole("heading", { level: 1, name: "Entrar" });

    expect(await outroNavegador.obterAcesso()).toMatchObject({ ok: true });
    expect(await outroNavegador.listarCartoes()).toMatchObject({ ok: true });
  });

  it("com a Credencial em memória, Sair também descarta e leva a Entrar", async () => {
    const servidor = clienteDeProva();

    render(
      <Aplicacao criarCliente={(credencial) => servidor.comoUsuario(credencial)} />,
    );
    await aguardarVerificacaoDoAcesso();

    fireEvent.click(screen.getByLabelText("Continuar conectado neste navegador"));
    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: CREDENCIAL_DE_PROVA.senha },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("navigation", { name: "Principal" });

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
  });
});
