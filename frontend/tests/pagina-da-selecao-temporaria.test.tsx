import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cartao } from "../src/acervo-cliente/cliente";
import { PaginaDaSelecaoTemporaria } from "../src/ui/PaginaDaSelecaoTemporaria";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";

type Cliente = ReturnType<typeof clienteDeProva>;

function exigirOk(resultado: unknown): void {
  if (
    typeof resultado === "object" &&
    resultado !== null &&
    "ok" in resultado &&
    resultado.ok === false
  ) {
    throw new Error("operação recusada pelo cliente de prova");
  }
}

function idDoCartao(
  resultado: Awaited<ReturnType<Cliente["criarCartao"]>>,
): string {
  if (!resultado.ok) throw new Error("não foi possível criar o cartão");
  return resultado.cartao.id;
}

function idDoBaralho(
  resultado: Awaited<ReturnType<Cliente["criarBaralho"]>>,
): string {
  if (!resultado.ok) throw new Error("não foi possível criar o baralho");
  return resultado.baralho.id;
}

async function semear(cliente: Cliente) {
  const c1 = idDoCartao(
    await cliente.criarCartao({
      frente: "How are you?",
      verso: "Como você está?",
    }),
  );
  const c2 = idDoCartao(
    await cliente.criarCartao({ frente: "Good morning", verso: "Bom dia" }),
  );
  const c3 = idDoCartao(
    await cliente.criarCartao({ frente: "Thank you", verso: "Obrigado" }),
  );
  const c4 = idDoCartao(
    await cliente.criarCartao({ frente: "See you", verso: "Até mais" }),
  );

  const a = idDoBaralho(await cliente.criarBaralho({ nome: "Inglês" }));
  const b = idDoBaralho(await cliente.criarBaralho({ nome: "Viagem" }));
  const vazio = idDoBaralho(await cliente.criarBaralho({ nome: "Vazio" }));

  exigirOk(await cliente.vincular(c1, a));
  exigirOk(await cliente.vincular(c2, a));
  exigirOk(await cliente.vincular(c2, b));
  exigirOk(await cliente.vincular(c3, b));

  return { c1, c2, c3, c4, a, b, vazio };
}

function renderizar(
  cliente: Cliente,
  aoEstudar = vi.fn<(c: readonly Cartao[]) => void>(),
) {
  render(
    comProtecaoDeSaida(
      <PaginaDaSelecaoTemporaria cliente={cliente} aoEstudar={aoEstudar} />,
      true,
    ),
  );
  return aoEstudar;
}

type Espiao = ReturnType<typeof renderizar>;

function regiaoDaSelecao(): HTMLElement {
  return screen.getByRole("region", { name: "Seleção do estudo" });
}

function textoNormalizado(elemento: HTMLElement): string {
  return (elemento.textContent ?? "").replace(/\s+/g, " ");
}

function cartoesEntregues(
  espiao: Espiao,
): { id: string; frente: string; verso: string }[] {
  const chamadas = espiao.mock.calls;
  const ultima = chamadas[chamadas.length - 1];
  if (!ultima) throw new Error("aoEstudar não foi chamado");
  return (ultima[0] ?? []).map(({ id, frente, verso }) => ({
    id,
    frente,
    verso,
  }));
}

function aguardarAcervo() {
  return screen.findByRole("button", { name: "Adicionar Inglês" });
}

describe("PaginaDaSelecaoTemporaria (spec 023)", () => {
  beforeEach(() => {
    window.location.hash = "#/baralhos/temporario";
  });

  it("abre com foco no título, seleção vazia, «0 Cartões» e Estudar desabilitado com a orientação (FR-365, FR-377)", async () => {
    const cliente = clienteDeProva();
    await semear(cliente);
    renderizar(cliente);
    await aguardarAcervo();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Criar baralho temporário",
      }),
    ).toHaveFocus();

    expect(
      screen.getByRole("button", { name: "Adicionar baralhos" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Adicionar cartões" }),
    ).toHaveAttribute("aria-pressed", "false");

    const selecao = regiaoDaSelecao();
    expect(within(selecao).getByText("0 Cartões")).toBeInTheDocument();
    expect(
      within(selecao).getByText("Seu estudo começa aqui"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Adicione pelo menos um cartão para estudar."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Estudar" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Cancelar" }),
    ).toBeInTheDocument();
  });

  it("A + B dão 3 Cartões únicos na ordem C1, C2, C3, com o anúncio; os dois Baralhos passam a «Adicionado» (FR-363, FR-364, SC-143)", async () => {
    const cliente = clienteDeProva();
    await semear(cliente);
    renderizar(cliente);
    await aguardarAcervo();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar Inglês" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Viagem" }));

    await screen.findByText(
      "3 Cartões na seleção. Cartões repetidos entram uma só vez.",
    );

    expect(
      screen.getByRole("button", { name: "Adicionado Inglês" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Adicionado Viagem" }),
    ).toBeDisabled();

    const selecao = regiaoDaSelecao();
    expect(within(selecao).getByText("3 Cartões")).toBeInTheDocument();
    expect(
      within(selecao).getByRole("button", { name: "Remover How are you?" }),
    ).toBeInTheDocument();
    expect(
      within(selecao).getByRole("button", { name: "Remover Good morning" }),
    ).toBeInTheDocument();
    expect(
      within(selecao).getByRole("button", { name: "Remover Thank you" }),
    ).toBeInTheDocument();

    const texto = textoNormalizado(selecao);
    expect(texto.indexOf("How are you?")).toBeLessThan(
      texto.indexOf("Good morning"),
    );
    expect(texto.indexOf("Good morning")).toBeLessThan(
      texto.indexOf("Thank you"),
    );
  });

  it("na fonte Cartões, C1 aparece «Adicionado» e o avulso C4 (sem Baralho) entra: 4 Cartões (FR-361)", async () => {
    const cliente = clienteDeProva();
    await semear(cliente);
    renderizar(cliente);
    await aguardarAcervo();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar Inglês" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Viagem" }));
    await screen.findByText(
      "3 Cartões na seleção. Cartões repetidos entram uma só vez.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Adicionar cartões" }));

    expect(
      await screen.findByRole("button", { name: "Adicionado How are you?" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar See you" }));

    await waitFor(() =>
      expect(
        within(regiaoDaSelecao()).getByText("4 Cartões"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Remover See you" }),
    ).toBeInTheDocument();
  });

  it("buscar e filtrar na fonte Cartões não muda a contagem da seleção (FR-362)", async () => {
    const cliente = clienteDeProva();
    await semear(cliente);
    renderizar(cliente);
    await aguardarAcervo();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar Inglês" }));
    await screen.findByText(
      "2 Cartões na seleção. Cartões repetidos entram uma só vez.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Adicionar cartões" }));

    const busca = screen.getByRole("searchbox", { name: "Buscar cartões" });
    fireEvent.change(busca, { target: { value: "morning" } });

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Adicionar Thank you" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Adicionado Good morning" }),
    ).toBeDisabled();

    fireEvent.change(busca, { target: { value: "" } });

    const baralho = screen.getByRole("combobox", { name: "Baralho" });
    const opcaoViagem = within(baralho).getByRole("option", {
      name: /Viagem/,
    }) as HTMLOptionElement;
    fireEvent.change(baralho, { target: { value: opcaoViagem.value } });

    const situacao = screen.getByRole("combobox", {
      name: "Situação da revisão",
    });
    const opcoes = within(situacao).getAllByRole("option");
    const ultima = opcoes[opcoes.length - 1] as HTMLOptionElement;
    fireEvent.change(situacao, { target: { value: ultima.value } });

    expect(
      within(regiaoDaSelecao()).getByText("2 Cartões"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remover How are you?" }),
    ).toBeInTheDocument();
  });

  it("Remover tira só aquele Cartão; Limpar seleção esvazia (FR-363)", async () => {
    const cliente = clienteDeProva();
    await semear(cliente);
    renderizar(cliente);
    await aguardarAcervo();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar Inglês" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Viagem" }));
    await screen.findByText(
      "3 Cartões na seleção. Cartões repetidos entram uma só vez.",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Remover Good morning" }),
    );

    await waitFor(() =>
      expect(
        within(regiaoDaSelecao()).getByText("2 Cartões"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Remover Good morning" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remover How are you?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remover Thank you" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));

    await waitFor(() =>
      expect(
        within(regiaoDaSelecao()).getByText("0 Cartões"),
      ).toBeInTheDocument(),
    );
    expect(
      within(regiaoDaSelecao()).getByText("Seu estudo começa aqui"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Estudar" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Remover How are you?" }),
    ).not.toBeInTheDocument();
  });

  it("Baralho vazio mostra «0 Cartões · Baralho vazio» e «Sem cartões Vazio» desabilitado (FR-377)", async () => {
    const cliente = clienteDeProva();
    await semear(cliente);
    renderizar(cliente);
    await aguardarAcervo();

    expect(screen.getAllByText("2 Cartões")).toHaveLength(2);
    expect(screen.getByText("0 Cartões · Baralho vazio")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sem cartões Vazio" }),
    ).toBeDisabled();
  });

  it("Cartão excluído depois da adição: Estudar não chama aoEstudar, mostra o alerta; «Retirar indisponíveis» deixa a seleção sem ele e então Estudar chama aoEstudar (FR-367)", async () => {
    const cliente = clienteDeProva();
    const { c1, c2 } = await semear(cliente);
    const aoEstudar = renderizar(cliente);
    await aguardarAcervo();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar Inglês" }));
    await screen.findByText(
      "2 Cartões na seleção. Cartões repetidos entram uma só vez.",
    );

    await act(async () => {
      exigirOk(await cliente.excluirCartao(c1));
    });

    fireEvent.click(screen.getByRole("button", { name: "Estudar" }));

    await screen.findByText("1 Cartão não está mais disponível.");
    expect(aoEstudar).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Retirar indisponíveis" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByText("1 Cartão não está mais disponível."),
      ).not.toBeInTheDocument(),
    );
    expect(within(regiaoDaSelecao()).getByText("1 Cartão")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remover How are you?" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Estudar" }));

    await waitFor(() => expect(aoEstudar).toHaveBeenCalledTimes(1));
    expect(cartoesEntregues(aoEstudar)).toEqual([
      { id: c2, frente: "Good morning", verso: "Bom dia" },
    ]);
  });

  it("Baralho de origem excluído depois da adição não impede: Estudar entrega os 2 Cartões (FR-363)", async () => {
    const cliente = clienteDeProva();
    const { a, c1, c2 } = await semear(cliente);
    const aoEstudar = renderizar(cliente);
    await aguardarAcervo();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar Inglês" }));
    await screen.findByText(
      "2 Cartões na seleção. Cartões repetidos entram uma só vez.",
    );

    await act(async () => {
      exigirOk(await cliente.excluirBaralho(a));
    });

    fireEvent.click(screen.getByRole("button", { name: "Estudar" }));

    await waitFor(() => expect(aoEstudar).toHaveBeenCalledTimes(1));
    expect(cartoesEntregues(aoEstudar)).toEqual([
      { id: c1, frente: "How are you?", verso: "Como você está?" },
      { id: c2, frente: "Good morning", verso: "Bom dia" },
    ]);
    await waitFor(() =>
      expect(window.location.hash).toBe("#/baralhos/temporario/estudo"),
    );
  });

  it("Estudar entrega os textos atuais depois de editar a Frente, na ordem da seleção (FR-366, FR-367)", async () => {
    const cliente = clienteDeProva();
    const { c1, c2 } = await semear(cliente);
    const aoEstudar = renderizar(cliente);
    await aguardarAcervo();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar Inglês" }));
    await screen.findByText(
      "2 Cartões na seleção. Cartões repetidos entram uma só vez.",
    );

    await act(async () => {
      exigirOk(
        await cliente.editarCartao(c1, "How are you doing?", "Como vai você?"),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Estudar" }));

    await waitFor(() => expect(aoEstudar).toHaveBeenCalledTimes(1));
    expect(cartoesEntregues(aoEstudar)).toEqual([
      { id: c1, frente: "How are you doing?", verso: "Como vai você?" },
      { id: c2, frente: "Good morning", verso: "Bom dia" },
    ]);
    await waitFor(() =>
      expect(window.location.hash).toBe("#/baralhos/temporario/estudo"),
    );
  });

  it("falha de carga mostra a mensagem e Tentar novamente carrega o acervo (FR-377)", async () => {
    const cliente = clienteDeProva();
    await semear(cliente);
    await act(async () => {
      cliente.simularIndisponibilidade();
    });

    renderizar(cliente);

    await screen.findByText("Não foi possível carregar o acervo.");
    expect(
      screen.getByRole("button", { name: "Tentar novamente" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Adicionar Inglês" }),
    ).not.toBeInTheDocument();

    await act(async () => {
      cliente.restaurarDisponibilidade();
    });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await aguardarAcervo();
    expect(
      screen.queryByText("Não foi possível carregar o acervo."),
    ).not.toBeInTheDocument();
  });

  it("com seleção, sair pede «Descartar este percurso?» (FR-375)", async () => {
    const cliente = clienteDeProva();
    await semear(cliente);
    renderizar(cliente);
    await aguardarAcervo();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar Inglês" }));
    await screen.findByText(
      "2 Cartões na seleção. Cartões repetidos entram uma só vez.",
    );

    await act(async () => {
      window.location.hash = "#/baralhos";
    });

    const dialogo = await screen.findByRole("dialog");
    expect(
      within(dialogo).getByText("Descartar este percurso?"),
    ).toBeInTheDocument();
  });
});
