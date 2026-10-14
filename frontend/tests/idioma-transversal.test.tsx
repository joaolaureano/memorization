import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClienteHttp } from "../src/acervo-cliente/cliente-http";
import { validarFrente, validarVerso } from "../src/acervo-cliente/validacao";
import { descreverDias } from "../src/agenda/datas";
import {
  ProvedorDeIdioma,
  TextoDoProduto,
  useIdioma,
  type Idioma,
} from "../src/idioma";
import { MENSAGENS_COM_VALOR } from "../src/idioma/mensagens";
import { Aplicacao } from "../src/ui/Aplicacao";
import {
  CREDENCIAL_DE_PROVA,
  aguardarVerificacaoDoAcesso,
  clienteDeProva,
} from "./apoio-de-prova";

/**
 * 027 — provas transversais do Idioma da interface:
 * troca preserva o estado (FR-004), Conteúdo do Usuário intacto (FR-006,
 * SC-003), avisos visíveis mudam de idioma (FR-015), resposta que chega depois
 * da troca vem no idioma vigente (FR-016), validação local e formatos (FR-008).
 */

beforeEach(() => {
  window.location.hash = "#/inicio";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function escolherIdioma(atual: string, nome: string): void {
  fireEvent.click(screen.getByRole("button", { name: atual }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: nome }));
}

describe("troca de idioma na Aplicacao", () => {
  it("preserva o digitado e passa a recusa visível ao novo idioma (FR-004, FR-015)", async () => {
    const servidor = clienteDeProva();
    render(<Aplicacao criarCliente={(credencial) => servidor.comoUsuario(credencial)} />);
    await aguardarVerificacaoDoAcesso();

    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-errada-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Nome de usuário ou Senha incorretos.")).toBeInTheDocument();

    escolherIdioma("Idioma: Português", "EN English");

    expect(await screen.findByText("Incorrect username or password.")).toBeInTheDocument();
    expect(screen.queryByText("Nome de usuário ou Senha incorretos.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveValue(CREDENCIAL_DE_PROVA.nomeDeUsuario);
  });

  it("mostra o Conteúdo do Usuário igual em qualquer idioma (FR-006, SC-003)", async () => {
    const servidor = clienteDeProva();
    const cliente = servidor.comoUsuario(CREDENCIAL_DE_PROVA);
    const baralho = await cliente.criarBaralho({ nome: "Verbos irregulares" });

    if (!baralho.ok) throw new Error("baralho de prova");

    await cliente.criarCartao(baralho.baralho.id, {
      frente: "Novo",
      verso: "Sair",
      tags: [],
    });
    await servidor.entrar({ ...CREDENCIAL_DE_PROVA, continuarConectado: true });
    window.location.hash = `#/baralhos/${baralho.baralho.id}`;
    render(<Aplicacao criarCliente={(credencial) => servidor.comoUsuario(credencial)} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Verbos irregulares" })).toBeInTheDocument();

    for (const [atual, proximo] of [
      ["Idioma: Português", "EN English"],
      ["Language: English", "ES Español"],
    ] as const) {
      escolherIdioma(atual, proximo);

      await waitFor(() =>
        expect(screen.getByRole("heading", { level: 1, name: "Verbos irregulares" })).toBeInTheDocument(),
      );
      expect(screen.getAllByText("Novo").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Sair").length).toBeGreaterThan(0);
    }
  });
});

function SondaDeIdioma({ texto }: { texto: string }) {
  const { escolher, formatarData } = useIdioma();

  return (
    <>
      <p data-testid="mensagem">
        <TextoDoProduto texto={texto} />
      </p>
      <p data-testid="mes">
        {formatarData(new Date("2026-10-05T12:00:00Z"), { month: "long", timeZone: "UTC" })}
      </p>
      <button type="button" onClick={() => escolher("es")}>
        es
      </button>
    </>
  );
}

function montar(idioma: Idioma, texto: string) {
  return render(
    <ProvedorDeIdioma idiomaInicial={idioma}>
      <SondaDeIdioma texto={texto} />
    </ProvedorDeIdioma>,
  );
}

describe("mensagens e formatos no idioma vigente", () => {
  it("apresenta a validação local no idioma escolhido, com os mesmos números (FR-008, FR-015)", () => {
    montar("es", validarVerso("")?.mensagem ?? "");
    expect(screen.getByTestId("mensagem")).toHaveTextContent(
      "El reverso de la tarjeta no puede quedar vacío.",
    );

    fireEvent.click(screen.getByRole("button", { name: "es" }));
  });

  it("reapresenta uma mensagem com valores no novo idioma (FR-015)", () => {
    const longa = validarFrente("x".repeat(1001))?.mensagem ?? "";

    expect(longa).toBe(MENSAGENS_COM_VALOR.frenteLonga.pt(1000, 1001));
    montar("en", longa);

    expect(screen.getByTestId("mensagem")).toHaveTextContent(
      "The card front can have at most 1000 characters; the one provided has 1001.",
    );
  });

  it("deixa intacto o texto que não é mensagem do produto (FR-006)", () => {
    montar("en", "Revisão do dia");

    expect(screen.getByTestId("mensagem")).toHaveTextContent("Revisão do dia");
  });

  it("formata meses e dias da semana pelo idioma (FR-008)", () => {
    montar("en", "");
    expect(screen.getByTestId("mes")).toHaveTextContent("October");

    fireEvent.click(screen.getByRole("button", { name: "es" }));
    expect(screen.getByTestId("mes")).toHaveTextContent("octubre");
    expect(descreverDias([1, 4], "es-419")).toBe("lunes y jueves");
  });

  it("uma recusa que chega depois da troca vem no idioma vigente (FR-016)", async () => {
    let responder: (resposta: Response) => void = () => {};

    vi.stubGlobal(
      "fetch",
      () =>
        new Promise<Response>((resolver) => {
          responder = resolver;
        }),
    );
    montar("pt", "");

    const pedido = new ClienteHttp("http://127.0.0.1:3001", null).criarUsuario({
      nomeDeUsuario: "ana.silva",
      senha: "senha-de-prova-123",
    });

    fireEvent.click(screen.getByRole("button", { name: "es" }));
    await waitFor(() => expect(document.documentElement.lang).toBe("es-419"));

    await act(async () => {
      responder(
        new Response(
          JSON.stringify({ erro: "nome_de_usuario_existente", mensagem: "Username already exists." }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      );
    });

    expect(await pedido).toMatchObject({
      ok: false,
      mensagem: "Este nombre de usuario ya existe. Elige otro.",
    });
  });
});
