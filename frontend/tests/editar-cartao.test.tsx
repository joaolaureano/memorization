import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";
import { PaginaDoFormularioDeCartao } from "../src/ui/PaginaDoFormularioDeCartao";

/**
 * T404 e T405 — edição de Cartão na página do formulário
 * (specs/005-editar-cartao-e-baralho/tasks.md, FR-005, FR-006, FR-050,
 * FR-044, FR-045, SC-014; e specs/012-interface-visual-navegavel, FR-146,
 * FR-148, FR-154, FR-156).
 *
 * A página é exercitada com o `ClienteEmMemoria`, sem servidor, envolvida pelo
 * `ProvedorDeProtecaoDeSaida`. As asserções cobrem o alcance da edição em três
 * Baralhos, a recusa que preserva conteúdo e foco, a confirmação de descarte e
 * a falha de transporte que não conclui a operação nem perde o texto digitado.
 */

async function criarCartaoVinculadoATresBaralhos(): Promise<{
  cliente: ClienteEmMemoria;
  id: string;
}> {
  const cliente = clienteDeProva();
  const cartao = await cliente.criarCartao({
    frente: "To walk",
    verso: "Caminhar",
  });

  if (!cartao.ok) {
    throw new Error("a criação do Cartão deveria ser aceita");
  }

  for (const nome of ["Inglês", "Espanhol", "Francês"]) {
    const baralho = await cliente.criarBaralho({ nome });

    if (!baralho.ok) {
      throw new Error("a criação do Baralho deveria ser aceita");
    }

    await cliente.vincular(cartao.cartao.id, baralho.baralho.id);
  }

  return { cliente, id: cartao.cartao.id };
}

async function criarCartao(): Promise<{ cliente: ClienteEmMemoria; id: string }> {
  const cliente = clienteDeProva();
  const cartao = await cliente.criarCartao({
    frente: "To walk",
    verso: "Caminhar",
  });

  if (!cartao.ok) {
    throw new Error("a criação do Cartão deveria ser aceita");
  }

  return { cliente, id: cartao.cartao.id };
}

function campoDeFrenteEmEdicao(): HTMLTextAreaElement {
  return screen.getByLabelText("Frente") as HTMLTextAreaElement;
}

function campoDeVersoEmEdicao(): HTMLTextAreaElement {
  return screen.getByLabelText("Verso") as HTMLTextAreaElement;
}

function renderizarEdicao(cliente: ClienteEmMemoria, id: string): void {
  render(
    comProtecaoDeSaida(
      <PaginaDoFormularioDeCartao cliente={cliente} id={id} />,
      true,
    ),
  );
}

describe("edição de Cartão", () => {
  it("edita um Cartão vinculado a três Baralhos e informa o alcance antes de salvar (FR-005, FR-006, FR-146)", async () => {
    const { cliente, id } = await criarCartaoVinculadoATresBaralhos();

    renderizarEdicao(cliente, id);

    expect(
      await screen.findByText(
        /vinculado a 3 Baralhos: Inglês, Espanhol, Francês/i,
      ),
    ).toBeInTheDocument();

    fireEvent.change(campoDeFrenteEmEdicao(), {
      target: { value: "To run" },
    });
    fireEvent.change(campoDeVersoEmEdicao(), {
      target: { value: "Correr" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(window.location.hash).toBe("#/cartoes");
    });

    // A alteração vale no próprio Cartão e, por isso, em todos os Baralhos
    // a que ele está vinculado — nenhum Vínculo é recriado ou alterado.
    const cartoes = await cliente.listarCartoes();

    expect(cartoes.ok).toBe(true);

    if (!cartoes.ok) {
      return;
    }

    expect(cartoes.cartoes[0].frente).toBe("To run");
    expect(cartoes.cartoes[0].baralhos).toHaveLength(3);

    for (const baralho of cartoes.cartoes[0].baralhos) {
      const detalhe = await cliente.obterBaralho(baralho.id);

      expect(detalhe.ok).toBe(true);

      if (detalhe.ok) {
        expect(detalhe.baralho.cartoes[0].frente).toBe("To run");
      }
    }
  });

  it("recusa conteúdo vazio na edição, preserva o texto digitado e foca o campo a corrigir (FR-005, FR-055)", async () => {
    const { cliente, id } = await criarCartao();

    renderizarEdicao(cliente, id);
    await screen.findByDisplayValue("To walk");

    fireEvent.change(campoDeFrenteEmEdicao(), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText(/a frente do cartão não pode ficar vazia/i),
    ).toBeInTheDocument();
    expect(campoDeFrenteEmEdicao()).toHaveValue("   ");
    expect(campoDeFrenteEmEdicao()).toHaveFocus();
  });

  it("formulário sujo pede confirmação de descarte ao sair (FR-050, FR-148, SC-014)", async () => {
    const { cliente, id } = await criarCartao();

    renderizarEdicao(cliente, id);
    await screen.findByDisplayValue("To walk");

    fireEvent.change(campoDeFrenteEmEdicao(), {
      target: { value: "To run" },
    });

    window.location.hash = "#/baralhos";

    const dialogo = await screen.findByRole("dialog");

    expect(dialogo).toHaveTextContent(/o texto digitado será perdido/i);
  });

  it("com o cliente indisponível, salvar edição falha e o conteúdo digitado permanece (FR-044, FR-045, SC-012)", async () => {
    const { cliente, id } = await criarCartao();

    renderizarEdicao(cliente, id);
    await screen.findByDisplayValue("To walk");

    fireEvent.change(campoDeFrenteEmEdicao(), {
      target: { value: "To run" },
    });
    fireEvent.change(campoDeVersoEmEdicao(), {
      target: { value: "Correr" },
    });

    cliente.simularIndisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE),
    ).toBeInTheDocument();
    expect(campoDeFrenteEmEdicao()).toHaveValue("To run");
    expect(campoDeVersoEmEdicao()).toHaveValue("Correr");
  });
});
