import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";
import { PaginaDeAdicionarCartoes } from "../src/ui/PaginaDeAdicionarCartoes";

/**
 * T1111 — adicionar Cartões existentes a um Baralho
 * (specs/012-interface-visual-navegavel/tasks.md, FR-145, FR-153–156; regra
 * preservada de specs/003-vincular-cartao-baralho: FR-019, FR-044, FR-045,
 * FR-046).
 *
 * A página lista apenas os Cartões **ainda não vinculados** (FR-145); vincular
 * um Cartão o faz sair da lista e anunciar a mudança. Os vazios são
 * distinguidos — "você ainda não tem Cartões" e "todos os seus Cartões já
 * estão neste Baralho" — e ambos oferecem criar Cartão. Baralho inexistente
 * tem a mensagem em português com o caminho de volta (FR-156), e a falha de
 * transporte mantém a lista como estava, com nova tentativa (FR-044, FR-045).
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
  render(
    comProtecaoDeSaida(
      <PaginaDeAdicionarCartoes cliente={cliente} id={idDoBaralho} />,
      true,
    ),
  );
}

describe("PaginaDeAdicionarCartoes", () => {
  it("lista apenas os Cartões ainda não vinculados (FR-145)", async () => {
    const { cliente, idDoBaralho, idDoPrimeiroCartao } =
      await criarAcervoDeTeste();
    await cliente.vincular(idDoPrimeiroCartao, idDoBaralho);

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Adicionar cartões a Inglês",
    });

    expect(
      screen.getByRole("link", { name: "← Voltar para o Baralho" }),
    ).toHaveAttribute("href", `#/baralhos/${idDoBaralho}`);
    expect(
      screen.queryByRole("button", { name: "Vincular To walk" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Vincular To run" }),
    ).toBeInTheDocument();
  });

  it("vincular remove o Cartão da lista e anuncia a mudança (FR-145, FR-044)", async () => {
    const { cliente, idDoBaralho, idDoPrimeiroCartao } =
      await criarAcervoDeTeste();

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("button", { name: "Vincular To walk" });
    fireEvent.click(
      screen.getByRole("button", { name: "Vincular To walk" }),
    );

    expect(
      await screen.findByText(/Cartão vinculado ao Baralho\./),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Vincular To walk" }),
    ).not.toBeInTheDocument();

    const detalhe = await cliente.obterBaralho(idDoBaralho);

    expect(detalhe.ok).toBe(true);

    if (detalhe.ok) {
      expect(
        detalhe.baralho.cartoes.map((cartao) => cartao.id),
      ).toEqual([idDoPrimeiroCartao]);
    }
  });

  it("sem Cartões no acervo, explica e oferece criar Cartão (FR-153)", async () => {
    const cliente = clienteDeProva();
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!baralho.ok) {
      throw new Error("a criação do Baralho deveria ser aceita");
    }

    renderizar(cliente, baralho.baralho.id);

    expect(
      await screen.findByText("Você ainda não tem Cartões."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Criar cartão" }),
    ).toHaveAttribute("href", "#/cartoes/novo");
  });

  it("com todos os Cartões já vinculados, explica e oferece criar Cartão (FR-145, FR-153)", async () => {
    const { cliente, idDoBaralho, idDoPrimeiroCartao, idDoSegundoCartao } =
      await criarAcervoDeTeste();
    await cliente.vincular(idDoPrimeiroCartao, idDoBaralho);
    await cliente.vincular(idDoSegundoCartao, idDoBaralho);

    renderizar(cliente, idDoBaralho);

    expect(
      await screen.findByText(
        "Todos os seus Cartões já estão neste Baralho.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Criar cartão" }),
    ).toHaveAttribute("href", "#/cartoes/novo");
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
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
      screen.getByRole("link", { name: "← Voltar para o Baralho" }),
    ).toHaveAttribute("href", "#/baralhos/b-inexistente");
  });

  it("com o cliente indisponível, vincular falha e nenhum Vínculo inexistente é exibido (FR-044, FR-045, SC-012)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTeste();
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("button", { name: "Vincular To walk" });

    cliente.simularIndisponibilidade();
    fireEvent.click(
      screen.getByRole("button", { name: "Vincular To walk" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
    );
    expect(
      screen.queryByText(/Cartão vinculado ao Baralho\./),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Vincular To walk" }),
    ).toBeInTheDocument();
    expect(within(screen.getByRole("list")).getAllByRole("listitem"))
      .toHaveLength(2);
  });

  it("a falha de carregamento oferece tentar novamente (FR-153)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTeste();

    cliente.simularIndisponibilidade();

    renderizar(cliente, idDoBaralho);

    // A carga começa por `obterBaralho`: a indisponibilidade devolve a mensagem
    // de Baralhos, não a de Vínculos.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível acessar os Baralhos. Tente novamente.",
    );
    expect(
      screen.getByRole("button", { name: "Tentar novamente" }),
    ).toBeInTheDocument();
  });
});
