import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Aplicacao } from "../src/ui/Aplicacao";
import { CREDENCIAL_DE_PROVA, clienteDeProva } from "./apoio-de-prova";

/**
 * T1813 — a expiração do Acesso durante o uso (018; FR-091 revisado, FR-151,
 * FR-157, FR-294, FR-304; SC-115, SC-123): a operação recusada por `401
 * acesso_expirado` leva a Entrar com a mensagem exata, sem se apresentar como
 * concluída, e **mesmo com proteção de saída ativa** — a recusa sempre vence —,
 * sem abrir a confirmação de descarte e sem registrar nada pela metade.
 */

beforeEach(() => {
  window.location.hash = "#/baralhos";
});

afterEach(() => {
  cleanup();
});

describe("expiração do Acesso durante o uso", () => {
  it("com um formulário preenchido, a operação recusada vai a Entrar sem confirmação, sem salvar e com a mensagem exata (FR-157, FR-294)", async () => {
    const servidor = clienteDeProva();
    const criado = await servidor.criarBaralho({ nome: "Inglês" });
    if (!criado.ok) throw new Error("não criou Baralho");
    window.location.hash = `#/baralhos/${criado.baralho.id}/cartoes/novo`;

    await servidor.entrar({ ...CREDENCIAL_DE_PROVA, continuarConectado: true });

    render(
      <Aplicacao criarCliente={(credencial) => servidor.comoUsuario(credencial)} />,
    );

    await screen.findByRole("heading", { level: 1, name: "Criar cartão" });

    fireEvent.change(screen.getByLabelText("Frente"), {
      target: { value: "To walk" },
    });
    fireEvent.change(screen.getByLabelText("Verso"), {
      target: { value: "Caminhar" },
    });

    // O Acesso vence enquanto a pessoa estava preenchendo.
    servidor.avancarRelogio(301_000);

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const alerta = await screen.findByRole("alert", {
      name: "Credencial recusada",
    });

    expect(alerta).toHaveTextContent("Seu acesso expirou. Entre novamente.");
    expect(
      screen.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
    // A recusa vence a proteção de saída: nenhuma confirmação de descarte.
    expect(screen.queryByRole("dialog")).toBeNull();
    // Nada foi criado, e nada aparece como concluído.
    expect(screen.queryByRole("status", { name: /concluíd/i })).toBeNull();

    await servidor.entrar({ ...CREDENCIAL_DE_PROVA, continuarConectado: true });
    expect(await servidor.comoUsuario(null).listarCartoes()).toMatchObject({
      ok: true,
      cartoes: [],
    });
  });

  it("o foco vai ao título de Entrar, perceptível por leitor de tela (FR-304)", async () => {
    const servidor = clienteDeProva();

    await servidor.entrar({ ...CREDENCIAL_DE_PROVA, continuarConectado: true });
    window.location.hash = "#/baralhos";

    render(
      <Aplicacao criarCliente={(credencial) => servidor.comoUsuario(credencial)} />,
    );
    await screen.findByRole("heading", { level: 1, name: "Baralhos" });

    servidor.avancarRelogio(301_000);
    fireEvent.click(screen.getByRole("link", { name: "Estudo" }));

    const titulo = await screen.findByRole("heading", {
      level: 1,
      name: "Entrar",
    });

    expect(await screen.findByRole("alert", { name: "Credencial recusada" })).toBeVisible();
    expect(titulo).toBeVisible();
  });
});
