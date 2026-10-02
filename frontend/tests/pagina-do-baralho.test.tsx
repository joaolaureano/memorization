import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";

/**
 * T1110 — tela de detalhe do Baralho
 * (specs/012-interface-visual-navegavel/tasks.md, FR-145, FR-147, FR-153,
 * FR-156; e as regras preservadas de 003/005/006: FR-021, FR-044, FR-045,
 * FR-046, FR-066).
 *
 * A tela é exercitada com o `ClienteEmMemoria`, o Adapter de teste da Seam
 * `ClienteDoAcervo`, sem servidor. As asserções cobrem a apresentação do
 * Baralho e da contagem, o caminho para Estudar (primeiro e desabilitado sem
 * Cartões), a remoção de um Cartão **sem** diálogo de confirmação (FR-147,
 * FR-066), o Baralho inexistente e a falha de gravação que não some com o
 * Vínculo confirmado (FR-044, FR-045, SC-012).
 */

interface AcervoDeTeste {
  cliente: ClienteEmMemoria;
  idDoBaralho: string;
  idDoPrimeiroCartao: string;
  idDoSegundoCartao: string;
}

async function criarAcervoDeTeste(): Promise<AcervoDeTeste> {
  const cliente = clienteDeProva();
  const primeiroCartao = await cliente.criarCartao({
    frente: "To walk",
    verso: "Caminhar",
  });
  const segundoCartao = await cliente.criarCartao({
    frente: "To run",
    verso: "Correr",
  });
  const baralho = await cliente.criarBaralho({ nome: "Inglês" });

  if (!primeiroCartao.ok || !segundoCartao.ok || !baralho.ok) {
    throw new Error("as criações do cenário deveriam ser aceitas");
  }

  return {
    cliente,
    idDoBaralho: baralho.baralho.id,
    idDoPrimeiroCartao: primeiroCartao.cartao.id,
    idDoSegundoCartao: segundoCartao.cartao.id,
  };
}

function renderizar(cliente: ClienteEmMemoria, idDoBaralho: string): void {
  render(comProtecaoDeSaida(<PaginaDoBaralho cliente={cliente} id={idDoBaralho} />, true));
}

/** A seção cujo título de nível 2 tem o nome informado. */
function secao(nome: string): HTMLElement {
  const titulo = screen.getByRole("heading", { level: 2, name: nome });
  const elemento = titulo.closest("section");

  if (elemento === null) {
    throw new Error(`Seção ${nome} não encontrada.`);
  }

  return elemento;
}

describe("PaginaDoBaralho", () => {
  it("apresenta o Baralho, a contagem e o caminho para Estudar (FR-145)", async () => {
    const { cliente, idDoBaralho, idDoPrimeiroCartao } =
      await criarAcervoDeTeste();
    await cliente.vincular(idDoPrimeiroCartao, idDoBaralho);

    renderizar(cliente, idDoBaralho);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Inglês" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Baralho")).toBeInTheDocument();
    expect(screen.getByText("1 Cartão neste Baralho.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Estudar este Baralho" }),
    ).toHaveAttribute("href", `#/baralhos/${idDoBaralho}/estudo`);
    expect(
      screen.getByRole("link", { name: "← Voltar para Baralhos" }),
    ).toHaveAttribute("href", "#/baralhos");
  });

  it("sem Cartões, Estudar fica desabilitado com a explicação e o vazio oferece adicionar (FR-145, FR-153)", async () => {
    const cliente = clienteDeProva();
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!baralho.ok) {
      throw new Error("a criação do Baralho deveria ser aceita");
    }

    renderizar(cliente, baralho.baralho.id);

    await screen.findByRole("heading", { level: 1, name: "Inglês" });

    const estudar = screen.getByRole("button", { name: "Estudar este Baralho" });
    expect(estudar).toBeDisabled();
    expect(estudar).toHaveAccessibleDescription(
      "Adicione Cartões ao Baralho para poder estudar.",
    );
    expect(
      screen.getByText("Este Baralho ainda não tem Cartões."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Adicionar cartões existentes" }),
    ).toHaveAttribute("href", `#/baralhos/${baralho.baralho.id}/adicionar`);
  });

  it("remove um Cartão sem confirmação e preserva os demais Vínculos e o Cartão no acervo (FR-147, FR-066, FR-021)", async () => {
    const { cliente, idDoBaralho, idDoPrimeiroCartao, idDoSegundoCartao } =
      await criarAcervoDeTeste();
    await cliente.vincular(idDoPrimeiroCartao, idDoBaralho);
    await cliente.vincular(idDoSegundoCartao, idDoBaralho);

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("button", {
      name: "Remover To walk deste baralho",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Remover To walk deste baralho" }),
    );

    expect(
      await screen.findByText(/Cartão removido deste Baralho\./),
    ).toBeInTheDocument();

    // Remover é reversível e não destrói nada: nenhum diálogo é apresentado.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    const cartoesDoBaralho = secao("Cartões do Baralho");
    expect(within(cartoesDoBaralho).getAllByRole("listitem")).toHaveLength(1);
    expect(within(cartoesDoBaralho).getByText("To run")).toBeInTheDocument();
    expect(screen.getByText("1 Cartão neste Baralho.")).toBeInTheDocument();

    // O Cartão removido continua no acervo.
    const acervo = await cliente.listarCartoes();

    expect(acervo.ok).toBe(true);

    if (acervo.ok) {
      expect(acervo.cartoes).toHaveLength(2);
      expect(acervo.cartoes.some((cartao) => cartao.id === idDoPrimeiroCartao))
        .toBe(true);
    }
  });

  it("Baralho inexistente mostra a mensagem em português com o link de volta (FR-156)", async () => {
    renderizar(clienteDeProva(), "b-inexistente");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Baralho não encontrado",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Baralho não encontrado.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "← Voltar para Baralhos" }),
    ).toHaveAttribute("href", "#/baralhos");
  });

  it("com o cliente indisponível, remover falha e o Vínculo confirmado permanece exibido (FR-044, FR-045, SC-012)", async () => {
    const { cliente, idDoBaralho, idDoPrimeiroCartao } =
      await criarAcervoDeTeste();
    await cliente.vincular(idDoPrimeiroCartao, idDoBaralho);

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("button", {
      name: "Remover To walk deste baralho",
    });

    cliente.simularIndisponibilidade();
    fireEvent.click(
      screen.getByRole("button", { name: "Remover To walk deste baralho" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
    );

    expect(
      screen.queryByText(/Cartão removido deste Baralho\./),
    ).not.toBeInTheDocument();
    expect(within(secao("Cartões do Baralho")).getAllByRole("listitem"))
      .toHaveLength(1);
    // A elegibilidade é comunicada apenas pelo estado de "Estudar este
    // Baralho": com o Vínculo confirmado, o caminho continua disponível.
    expect(
      screen.getByRole("link", { name: "Estudar este Baralho" }),
    ).toHaveAttribute("href", `#/baralhos/${idDoBaralho}/estudo`);
    expect(screen.getByText("1 Cartão neste Baralho.")).toBeInTheDocument();
  });

  it("a falha de carregamento oferece tentar novamente (FR-153)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTeste();

    cliente.simularIndisponibilidade();

    renderizar(cliente, idDoBaralho);

    // A carga desta tela vem de `obterBaralho`: a indisponibilidade devolve a
    // mensagem de Baralhos, não a de Vínculos.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível acessar os Baralhos. Tente novamente.",
    );
    expect(
      screen.getByRole("button", { name: "Tentar novamente" }),
    ).toBeInTheDocument();
  });
});
