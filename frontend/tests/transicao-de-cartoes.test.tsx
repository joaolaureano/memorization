import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClienteDoAcervo } from "../src/acervo-cliente/cliente";
import { PaginaDaTransicaoDeCartoes } from "../src/ui/PaginaDaTransicaoDeCartoes";

afterEach(cleanup);

describe("transição de Cartões", () => {
  it("preserva escolhas e foco quando o salvamento falha, e permite repetir", async () => {
    const concluir = vi.fn()
      .mockResolvedValueOnce({ ok: false, erro: "indisponivel", mensagem: "Tente novamente." })
      .mockResolvedValueOnce({ ok: true });
    const aoConcluir = vi.fn();
    const cliente = { concluirTransicao: concluir } as unknown as ClienteDoAcervo;

    render(<PaginaDaTransicaoDeCartoes
      cliente={cliente}
      cartoes={[{ id: "c1", frente: "Frente", verso: "Verso", baralhos: [] }]}
      baralhos={[{ id: "b1", nome: "Inglês" }]}
      aoConcluir={aoConcluir}
    />);

    fireEvent.change(screen.getByLabelText("Frente"), { target: { value: "b1" } });
    const botao = screen.getByRole("button", { name: "Concluir organização" });
    fireEvent.click(botao);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Tente novamente."));
    expect(screen.getByLabelText("Frente")).toHaveValue("b1");
    expect(botao).toHaveFocus();

    fireEvent.click(botao);
    await waitFor(() => expect(aoConcluir).toHaveBeenCalledOnce());
    expect(concluir).toHaveBeenLastCalledWith([{ cartaoId: "c1", baralhoId: "b1" }]);
  });
});
