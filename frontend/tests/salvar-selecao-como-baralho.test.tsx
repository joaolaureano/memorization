import { act } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
  type Cartao,
} from "../src/acervo-cliente/cliente";
import type {
  ClienteEmMemoria,
} from "../src/acervo-cliente/cliente-em-memoria";
import {
  AleatoriedadeDeterministica,
} from "../src/sessao-de-estudo/aleatoriedade";
import { PaginaDeEstudo } from "../src/ui/PaginaDeEstudo";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";

async function criarSelecao(cliente: ClienteEmMemoria): Promise<Cartao[]> {
  const definicoes = [
    { frente: "How are you?", verso: "Como você está?" },
    { frente: "Good morning", verso: "Bom dia" },
    { frente: "Thank you", verso: "Obrigado" },
  ];
  const selecao: Cartao[] = [];
  for (const definicao of definicoes) {
    const resultado = await cliente.criarCartao(definicao);
    if (!resultado.ok) {
      throw new Error("não foi possível criar o Cartão de prova");
    }
    selecao.push(resultado.cartao);
  }
  return selecao;
}

function renderizar(cliente: ClienteEmMemoria, selecao: Cartao[]) {
  render(
    comProtecaoDeSaida(
      <PaginaDeEstudo
        cliente={cliente}
        id=""
        selecaoTemporaria={selecao}
        aleatoriedade={new AleatoriedadeDeterministica([0.99, 0.99])}
        aoSair={vi.fn()}
      />,
    ),
  );
}

async function responder() {
  fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
  await screen.findByRole("heading", { name: "Verso" });
  fireEvent.click(screen.getByRole("button", { name: /^Bom/ }));
}

async function listarBaralhos(cliente: ClienteEmMemoria) {
  const resultado = await cliente.listarBaralhos();
  if (!resultado.ok) {
    throw new Error("não foi possível listar os Baralhos de prova");
  }
  return resultado.baralhos;
}

async function chegarAoSalvamento(
  cliente: ClienteEmMemoria,
  selecao: Cartao[],
) {
  renderizar(cliente, selecao);
  await responder();
  await responder();
  await responder();
  await waitFor(() => {
    expect(
      screen.getByRole("status", {
        name: "Situação do registro da Sessão",
      }),
    ).toHaveTextContent("Sessão registrada no histórico.");
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Salvar como baralho" }),
  );
  await screen.findByRole("heading", { name: "Salvar como baralho" });
}

describe("salvar a seleção como Baralho", () => {
  it("cria um único Baralho com os 3 Cartões e volta ao Resumo com «Abrir baralho» focado (FR-371, FR-372, SC-146)", async () => {
    const cliente = clienteDeProva();
    const selecao = await criarSelecao(cliente);
    await chegarAoSalvamento(cliente, selecao);

    fireEvent.change(screen.getByLabelText("Nome do baralho"), {
      target: { value: "Inglês para viagem" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await screen.findByRole("heading", { name: "Sessão concluída" });
    expect(screen.getByText("Baralho salvo.")).toBeInTheDocument();

    const link = await screen.findByRole("link", { name: "Abrir baralho" });
    const baralhos = await listarBaralhos(cliente);
    expect(baralhos).toHaveLength(1);
    expect(baralhos[0].nome).toBe("Inglês para viagem");
    expect(baralhos[0].quantidadeDeCartoes).toBe(3);
    expect(link).toHaveAttribute("href", `#/baralhos/${baralhos[0].id}`);
    await waitFor(() => expect(link).toHaveFocus());
    expect(
      screen.queryByRole("button", { name: "Salvar como baralho" }),
    ).not.toBeInTheDocument();
  });

  it("abre com foco no nome, contador e contagem (FR-371, FR-377)", async () => {
    const cliente = clienteDeProva();
    const selecao = await criarSelecao(cliente);
    await chegarAoSalvamento(cliente, selecao);

    const campo = screen.getByLabelText("Nome do baralho");
    await waitFor(() => expect(campo).toHaveFocus());
    expect(campo).toHaveValue("");
    expect(screen.getByText("0 / 100 caracteres")).toBeInTheDocument();
    expect(
      screen.getByText(
        "3 Cartões serão vinculados. Os baralhos de origem serão preservados.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancelar" }),
    ).toBeInTheDocument();

    fireEvent.change(campo, { target: { value: "Viagem" } });
    expect(screen.getByText("6 / 100 caracteres")).toBeInTheDocument();
  });

  it("Cancelar volta ao Resumo com foco em «Salvar como baralho» e nada é criado (FR-370)", async () => {
    const cliente = clienteDeProva();
    const selecao = await criarSelecao(cliente);
    await chegarAoSalvamento(cliente, selecao);

    fireEvent.change(screen.getByLabelText("Nome do baralho"), {
      target: { value: "Inglês para viagem" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await screen.findByRole("heading", { name: "Sessão concluída" });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Salvar como baralho" }),
      ).toHaveFocus(),
    );
    expect(await listarBaralhos(cliente)).toHaveLength(0);
  });

  it("nome vazio mostra a mensagem, foca o campo e não cria nada (FR-371)", async () => {
    const cliente = clienteDeProva();
    const selecao = await criarSelecao(cliente);
    await chegarAoSalvamento(cliente, selecao);

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O nome do baralho não pode ficar vazio.",
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Nome do baralho")).toHaveFocus(),
    );
    expect(await listarBaralhos(cliente)).toHaveLength(0);
  });

  it("falha preserva o nome, e a nova tentativa reenvia o mesmo id e salva (FR-373, SC-147)", async () => {
    const cliente = clienteDeProva();
    const selecao = await criarSelecao(cliente);
    const espiao = vi
      .spyOn(cliente, "salvarSelecaoComoBaralho")
      .mockResolvedValueOnce({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
      });
    await chegarAoSalvamento(cliente, selecao);

    const campo = screen.getByLabelText("Nome do baralho");
    fireEvent.change(campo, { target: { value: "Inglês para viagem" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível salvar. Seu nome e a seleção foram preservados. Tente novamente.",
    );
    expect(campo).toHaveValue("Inglês para viagem");

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await screen.findByRole("heading", { name: "Sessão concluída" });

    expect(espiao).toHaveBeenCalledTimes(2);
    expect(espiao.mock.calls[0][0].id).toBe(espiao.mock.calls[1][0].id);
    const baralhos = await listarBaralhos(cliente);
    expect(baralhos).toHaveLength(1);
    expect(baralhos[0].id).toBe(espiao.mock.calls[0][0].id);
  });

  it("Cartão excluído antes de salvar exige retirar: a contagem passa a 2 e o Baralho salvo tem 2 Cartões (FR-374)", async () => {
    const cliente = clienteDeProva();
    const selecao = await criarSelecao(cliente);
    await chegarAoSalvamento(cliente, selecao);

    await act(async () => {
      await cliente.excluirCartao(selecao[0].id);
    });

    fireEvent.change(screen.getByLabelText("Nome do baralho"), {
      target: { value: "Inglês para viagem" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "1 Cartão não está mais disponível. Retire-o e confira a nova contagem antes de salvar.",
    );
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "Retirar indisponíveis" }),
    );

    expect(
      screen.getByText(
        "2 Cartões serão vinculados. Os baralhos de origem serão preservados.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await screen.findByRole("heading", { name: "Sessão concluída" });
    expect(screen.getByText("Baralho salvo.")).toBeInTheDocument();

    const baralhos = await listarBaralhos(cliente);
    expect(baralhos).toHaveLength(1);
    expect(baralhos[0].nome).toBe("Inglês para viagem");
    expect(baralhos[0].quantidadeDeCartoes).toBe(2);
  });

  it("sem Cartões restantes, «Salvar» fica desabilitado com a mensagem própria (FR-374)", async () => {
    const cliente = clienteDeProva();
    const selecao = await criarSelecao(cliente);
    await chegarAoSalvamento(cliente, selecao);

    await act(async () => {
      for (const cartao of selecao) {
        await cliente.excluirCartao(cartao.id);
      }
    });

    fireEvent.change(screen.getByLabelText("Nome do baralho"), {
      target: { value: "Inglês para viagem" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "3 Cartões não estão mais disponíveis. Retire-os e confira a nova contagem antes de salvar.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Retirar indisponíveis" }),
    );
    expect(
      await screen.findByText("Não há Cartões disponíveis para salvar."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(await listarBaralhos(cliente)).toHaveLength(0);
  });
});
