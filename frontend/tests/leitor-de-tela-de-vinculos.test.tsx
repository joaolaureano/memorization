import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";
import { PaginaDeAdicionarCartoes } from "../src/ui/PaginaDeAdicionarCartoes";
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";

/**
 * T211 e T1110/T1111 — mudanças de Vínculo e de elegibilidade perceptíveis por
 * leitor de tela (FR-065; regra preservada de
 * specs/003-vincular-cartao-baralho).
 *
 * O jsdom não executa leitor de tela: o anúncio é comprovado pela semântica
 * que o dispara — a mudança é inserida numa região ativa polida
 * (`role="status"`) com nome acessível e `aria-live`/`aria-atomic`
 * explícitos. A elegibilidade é anunciada no mesmo anúncio, sem depender de
 * cor. A falha é uma região assertiva (`role="alert"`), nomeada no contexto
 * da operação.
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

function renderizarDetalhe(
  cliente: ClienteEmMemoria,
  idDoBaralho: string,
): void {
  render(
    comProtecaoDeSaida(
      <PaginaDoBaralho cliente={cliente} id={idDoBaralho} />,
      true,
    ),
  );
}

function renderizarAdicionar(
  cliente: ClienteEmMemoria,
  idDoBaralho: string,
): void {
  render(
    comProtecaoDeSaida(
      <PaginaDeAdicionarCartoes cliente={cliente} id={idDoBaralho} />,
      true,
    ),
  );
}

describe("páginas de Vínculo para leitor de tela", () => {
  it("vincular na página de adicionar é anunciado em região ativa polida (FR-065)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTeste();
    renderizarAdicionar(cliente, idDoBaralho);

    await screen.findByRole("button", { name: "Vincular To walk" });

    fireEvent.click(
      screen.getByRole("button", { name: "Vincular To walk" }),
    );

    // Há mais de uma região viva na página — a do provedor de proteção de saída
    // e a do anúncio de Vínculo —, e a consulta vai pelo nome acessível.
    const anuncio = await screen.findByRole("status", {
      name: "Mudança de Vínculo",
    });

    expect(anuncio).toHaveAccessibleName("Mudança de Vínculo");
    expect(anuncio).toHaveAttribute("aria-live", "polite");
    expect(anuncio).toHaveAttribute("aria-atomic", "true");
    expect(anuncio).toHaveTextContent(/Cartão vinculado ao Baralho\./);
    expect(
      screen.queryByRole("button", { name: "Vincular To walk" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("remover do Baralho e a perda de elegibilidade são anunciados em região ativa polida (FR-065)", async () => {
    const { cliente, idDoBaralho, idDoPrimeiroCartao } =
      await criarAcervoDeTeste();
    await cliente.vincular(idDoPrimeiroCartao, idDoBaralho);

    renderizarDetalhe(cliente, idDoBaralho);

    await screen.findByRole("button", {
      name: "Remover To walk deste baralho",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Remover To walk deste baralho" }),
    );

    // Idem: a consulta vai pelo nome acessível, e não pelo papel sozinho.
    const anuncio = await screen.findByRole("status", {
      name: "Mudança de Vínculo",
    });

    expect(anuncio).toHaveAccessibleName("Mudança de Vínculo");
    expect(anuncio).toHaveAttribute("aria-live", "polite");
    expect(anuncio).toHaveAttribute("aria-atomic", "true");
    expect(anuncio).toHaveTextContent(/Cartão removido deste Baralho\./);
    expect(anuncio).toHaveTextContent(
      /O Baralho ficou sem Cartões; Revisar está indisponível\./,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a falha de Vínculo é um alerta assertivo nomeado, e não um anúncio de sucesso (FR-065, FR-044)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoDeTeste();
    renderizarAdicionar(cliente, idDoBaralho);

    await screen.findByRole("button", { name: "Vincular To walk" });

    cliente.simularIndisponibilidade();
    fireEvent.click(
      screen.getByRole("button", { name: "Vincular To walk" }),
    );

    const alerta = await screen.findByRole("alert");

    expect(alerta).toHaveAccessibleName("Falha na operação de Vínculo");
    expect(alerta).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS);
    expect(alerta).not.toHaveAttribute("aria-live");
    expect(
      screen.queryByRole("status", { name: "Mudança de Vínculo" }),
    ).not.toBeInTheDocument();
  });

  it("o estado vazio da página de adicionar aparece uma única vez, sem anúncio de Vínculo (FR-062, FR-065)", async () => {
    const { cliente, idDoBaralho, idDoPrimeiroCartao, idDoSegundoCartao } =
      await criarAcervoDeTeste();
    await cliente.vincular(idDoPrimeiroCartao, idDoBaralho);
    await cliente.vincular(idDoSegundoCartao, idDoBaralho);

    renderizarAdicionar(cliente, idDoBaralho);

    // A mensagem do estado vazio aparece em um lugar só: `findByText` falha se
    // houver mais de um elemento com o texto.
    expect(
      await screen.findByText("Todos os seus Cartões já estão neste Baralho."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // O estado vazio não é uma mudança de Vínculo: a região viva de anúncio da
    // página não entra em cena, e não há duas regiões anunciando a mesma coisa.
    expect(
      screen.queryByRole("status", { name: "Mudança de Vínculo" }),
    ).not.toBeInTheDocument();
  });
});
