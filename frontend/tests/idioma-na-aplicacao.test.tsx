import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Aplicacao } from "../src/ui/Aplicacao";
import { CREDENCIAL_DE_PROVA, aguardarVerificacaoDoAcesso, clienteDeProva } from "./apoio-de-prova";

beforeEach(() => { window.location.hash = "#/inicio"; });
afterEach(cleanup);

function selecionarIdioma(nome: string) {
  fireEvent.click(screen.getByRole("button", { name: "Idioma: Português" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: nome }));
}

describe("idioma dentro da Aplicacao", () => {
  it("traduz Entrar pela escolha do seletor", async () => {
    const servidor = clienteDeProva();
    render(<Aplicacao criarCliente={(credencial) => servidor.comoUsuario(credencial)} />);
    await aguardarVerificacaoDoAcesso();

    expect(screen.getByRole("button", { name: "Idioma: Português" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Entrar" })).toBeInTheDocument();
    selecionarIdioma("EN English");

    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("traduz a navegação autenticada sem desmontar a Moldura", async () => {
    const servidor = clienteDeProva();
    await servidor.entrar({ ...CREDENCIAL_DE_PROVA, continuarConectado: true });
    render(<Aplicacao criarCliente={(credencial) => servidor.comoUsuario(credencial)} />);

    const navegacao = await screen.findByRole("navigation", { name: "Principal" });
    selecionarIdioma("ES Español");

    await waitFor(() => expect(screen.getByRole("navigation", { name: "Principal" })).toBe(navegacao));
    expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Estudio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mazos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Perfil" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salir" })).toBeInTheDocument();
  });
});
