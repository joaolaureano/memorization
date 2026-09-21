import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { PaginaDeCartoes } from "../src/ui/PaginaDeCartoes";

/**
 * T404 e T405 — edição de Cartão pela tela de Cartões
 * (specs/005-editar-cartao-e-baralho/tasks.md, FR-005, FR-006, FR-050,
 * FR-044, FR-045, SC-014).
 *
 * A tela é exercitada com o `ClienteEmMemoria`, sem servidor. As asserções
 * cobrem o alcance da edição em três Baralhos, a recusa que preserva conteúdo
 * e foco, a confirmação de descarte e a falha de transporte que não conclui a
 * operação nem perde o texto digitado.
 */

async function criarCartaoVinculadoATresBaralhos(): Promise<ClienteEmMemoria> {
  const cliente = new ClienteEmMemoria();
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

  return cliente;
}

async function criarCartao(): Promise<ClienteEmMemoria> {
  const cliente = new ClienteEmMemoria();
  const cartao = await cliente.criarCartao({
    frente: "To walk",
    verso: "Caminhar",
  });

  if (!cartao.ok) {
    throw new Error("a criação do Cartão deveria ser aceita");
  }

  return cliente;
}

function abrirEdicao(): void {
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
}

function campoDeFrenteEmEdicao(): HTMLTextAreaElement {
  return screen.getByLabelText("Frente do Cartão") as HTMLTextAreaElement;
}

function campoDeVersoEmEdicao(): HTMLTextAreaElement {
  return screen.getByLabelText("Verso do Cartão") as HTMLTextAreaElement;
}

describe("edição de Cartão", () => {
  it("edita um Cartão vinculado a três Baralhos e informa o alcance antes de salvar (FR-005, FR-006)", async () => {
    const cliente = await criarCartaoVinculadoATresBaralhos();

    render(<PaginaDeCartoes cliente={cliente} />);

    const item = (await screen.findByText("To walk")).closest("li");

    if (item === null) {
      throw new Error("item do Cartão não encontrado");
    }

    fireEvent.click(within(item).getByRole("button", { name: "Editar" }));

    expect(
      screen.getByText("Este Cartão está vinculado a 3 Baralhos."),
    ).toBeInTheDocument();

    fireEvent.change(campoDeFrenteEmEdicao(), {
      target: { value: "To run" },
    });
    fireEvent.change(campoDeVersoEmEdicao(), {
      target: { value: "Correr" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    expect(await screen.findByText("Cartão editado.")).toBeInTheDocument();
    expect(screen.getByText("To run")).toBeInTheDocument();
    expect(screen.getByText("Correr")).toBeInTheDocument();
    expect(screen.queryByText("To walk")).not.toBeInTheDocument();

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

  it("recusa conteúdo vazio na edição, preserva o texto digitado e foca o campo a corrigir", async () => {
    const cliente = await criarCartao();

    render(<PaginaDeCartoes cliente={cliente} />);

    await screen.findByText("To walk");
    abrirEdicao();

    fireEvent.change(campoDeFrenteEmEdicao(), {
      target: { value: "   " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    expect(
      await screen.findByText(/a frente do cartão não pode ficar vazia/i),
    ).toBeInTheDocument();
    expect(campoDeFrenteEmEdicao()).toHaveValue("   ");
    expect(campoDeFrenteEmEdicao()).toHaveFocus();
  });

  it("sair de edição suja exige confirmação; recusar preserva a edição e confirmar descarta (FR-050, SC-014)", async () => {
    const cliente = await criarCartao();

    render(<PaginaDeCartoes cliente={cliente} />);

    await screen.findByText("To walk");
    abrirEdicao();

    fireEvent.change(campoDeFrenteEmEdicao(), {
      target: { value: "To run" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent(
      /alterações não salvas neste Cartão/i,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Continuar editando" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(campoDeFrenteEmEdicao()).toHaveValue("To run");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Descartar alterações" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Frente do Cartão")).not.toBeInTheDocument();
    expect(screen.getByText("To walk")).toBeInTheDocument();
  });

  it("com o cliente indisponível, salvar edição falha e o conteúdo digitado permanece (FR-044, FR-045, SC-012)", async () => {
    const cliente = await criarCartao();

    render(<PaginaDeCartoes cliente={cliente} />);

    await screen.findByText("To walk");
    abrirEdicao();

    fireEvent.change(campoDeFrenteEmEdicao(), {
      target: { value: "To run" },
    });
    fireEvent.change(campoDeVersoEmEdicao(), {
      target: { value: "Correr" },
    });

    cliente.simularIndisponibilidade();
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE),
    ).toBeInTheDocument();
    expect(screen.queryByText("Cartão editado.")).not.toBeInTheDocument();
    expect(campoDeFrenteEmEdicao()).toHaveValue("To run");
    expect(campoDeVersoEmEdicao()).toHaveValue("Correr");
  });
});
