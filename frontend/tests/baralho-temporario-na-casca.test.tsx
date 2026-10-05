import { act } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { Aplicacao } from "../src/ui/Aplicacao";
import {
  CREDENCIAL_DE_PROVA,
  aguardarVerificacaoDoAcesso,
  clienteDeProva,
} from "./apoio-de-prova";

function entrarPelaTela(): void {
  fireEvent.change(screen.getByLabelText("Nome de usuário"), {
    target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: CREDENCIAL_DE_PROVA.senha },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

async function abrir(servidor: ClienteEmMemoria): Promise<void> {
  render(
    <Aplicacao
      criarCliente={(credencial) => servidor.comoUsuario(credencial)}
    />,
  );
  await aguardarVerificacaoDoAcesso();
  entrarPelaTela();
  await screen.findByText(/Olá,/);
}

async function irPara(hash: string): Promise<void> {
  await act(async () => {
    window.location.hash = hash;
  });
}

async function exigirTituloDaPagina(nome: string): Promise<void> {
  const titulo = await screen.findByRole("heading", {
    level: 1,
    name: nome,
  });
  expect(titulo).toBeTruthy();
}

async function semearIngles(servidor: ClienteEmMemoria): Promise<void> {
  const baralho = await servidor.criarBaralho({ nome: "Inglês" });
  if (!baralho.ok) {
    throw new Error("não foi possível criar o baralho Inglês");
  }

  const pares = [
    { frente: "dog", verso: "cachorro" },
    { frente: "cat", verso: "gato" },
  ];

  for (const par of pares) {
    const cartao = await servidor.criarCartao(par);
    if (!cartao.ok) {
      throw new Error(`não foi possível criar o cartão ${par.frente}`);
    }

    const vinculo = await servidor.vincular(
      cartao.cartao.id,
      baralho.baralho.id,
    );
    if (!vinculo.ok) {
      throw new Error(`não foi possível vincular ${par.frente}`);
    }
  }
}

describe("baralho temporário na casca Aplicacao", () => {
  beforeEach(() => {
    window.location.hash = "#/inicio";
  });

  afterEach(() => {
    cleanup();
  });

  it(
    "abrir o estudo temporário sem seleção na memória volta " +
      "para Baralhos (FR-366, FR-375)",
    async () => {
      const servidor = clienteDeProva();
      await abrir(servidor);

      await irPara("#/baralhos/temporario/estudo");

      await waitFor(() => {
        expect(window.location.hash).toBe("#/baralhos");
      });
      await exigirTituloDaPagina("Baralhos");
    },
  );

  it(
    "de Baralhos, monta, estuda e interrompe de volta " +
      "para Baralhos (FR-360, FR-366, FR-375)",
    async () => {
      const servidor = clienteDeProva();
      await semearIngles(servidor);
      await abrir(servidor);

      await irPara("#/baralhos");

      const link = await screen.findByRole("link", {
        name: "Criar baralho temporário",
      });
      await irPara(link.getAttribute("href")!);

      await exigirTituloDaPagina("Criar baralho temporário");

      fireEvent.click(
        await screen.findByRole("button", { name: "Adicionar Inglês" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Estudar" }));

      await exigirTituloDaPagina("Estudar baralho temporário");
      await waitFor(() => {
        expect(window.location.hash).toBe("#/baralhos/temporario/estudo");
      });

      fireEvent.click(screen.getByRole("button", { name: "Interromper" }));

      const dialogo = await screen.findByRole("dialog");
      fireEvent.click(
        within(dialogo).getByRole("button", { name: "Interromper" }),
      );

      await waitFor(() => {
        expect(window.location.hash).toBe("#/baralhos");
      });
      await exigirTituloDaPagina("Baralhos");
    },
  );
});
