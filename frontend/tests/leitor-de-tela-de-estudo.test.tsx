import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CartaoListado } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";
import { AleatoriedadeDeterministica } from "../src/sessao-de-estudo/aleatoriedade";
import { LIMITE_DA_SELECAO } from "../src/sessao-de-estudo/selecao-temporaria";
import { PaginaDeEstudo } from "../src/ui/PaginaDeEstudo";

/**
 * T306 — mudanças de estado da Sessão perceptíveis por leitor de tela
 * (specs/004-sessao-de-estudo/tasks.md, FR-049).
 *
 * O jsdom não executa leitor de tela: o anúncio é comprovado pela semântica
 * que o dispara. Verso revelado, Avaliação registrada e Sessão concluída são
 * inseridos numa região ativa polida (`role="status"`) com nome acessível e
 * `aria-live`/`aria-atomic` explícitos. A modal «Revisar baralho» (024,
 * FR-383, FR-387) é um `dialog` nomeado, com o foco inicial em Cancelar e as
 * contagens fora do nome acessível das ações; a recusa de início — o conjunto
 * acima do limite (FR-386) — é uma região assertiva (`role="alert"`), nomeada
 * no contexto da operação e sem `aria-live` redundante.
 */

/** Instante ISO a `dias` dias locais de hoje, ao meio-dia. */
function isoDaquiA(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  data.setHours(12, 0, 0, 0);

  return data.toISOString();
}

async function criarAcervoElegivel(
  quantidadeDeCartoes: number,
): Promise<{
  cliente: ClienteEmMemoria;
  idDoBaralho: string;
}> {
  const cliente = clienteDeProva();

  for (let indice = 1; indice <= quantidadeDeCartoes; indice += 1) {
    const cartao = await cliente.criarCartao({
      frente: `Frente ${indice}`,
      verso: `Verso ${indice}`,
    });

    if (!cartao.ok) {
      throw new Error("a criação do Cartão deveria ser aceita");
    }
  }

  const baralho = await cliente.criarBaralho({ nome: "Inglês" });

  if (!baralho.ok) {
    throw new Error("a criação do Baralho deveria ser aceita");
  }

  const cartoes = await cliente.listarCartoes();

  if (!cartoes.ok) {
    throw new Error("a listagem de Cartões deveria ser aceita");
  }

  for (const cartao of cartoes.cartoes) {
    await cliente.vincular(cartao.id, baralho.baralho.id);
  }

  return { cliente, idDoBaralho: baralho.baralho.id };
}

function renderizar(cliente: ClienteEmMemoria, idDoBaralho: string): void {
  render(
    comProtecaoDeSaida(
      <PaginaDeEstudo
        cliente={cliente}
        id={idDoBaralho}
        aleatoriedade={new AleatoriedadeDeterministica([0, 0])}
      />,
    ),
  );
}

async function iniciarSessao(
  cliente: ClienteEmMemoria,
  idDoBaralho: string,
): Promise<void> {
  renderizar(cliente, idDoBaralho);
  await screen.findByRole("heading", {
    level: 1,
    name: "Revisar Inglês",
  });

  // Cartões novos estão pendentes: a Sessão começa pela modal (FR-383).
  fireEvent.click(screen.getByRole("button", { name: "Todos os cartões" }));
}

describe("PaginaDeEstudo para leitor de tela", () => {
  it("a Revelação é anunciada em região ativa polida e nomeada (FR-049)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    await iniciarSessao(cliente, idDoBaralho);

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));

    const anuncio = await screen.findByRole("status", {
      name: "Mudança de estado da Sessão",
    });

    expect(anuncio).toHaveAccessibleName("Mudança de estado da Sessão");
    expect(anuncio).toHaveAttribute("aria-live", "polite");
    expect(anuncio).toHaveAttribute("aria-atomic", "true");
    expect(anuncio).toHaveTextContent(/Verso revelado\./);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a Avaliação registrada é anunciada em região ativa polida (FR-049, FR-193)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    await iniciarSessao(cliente, idDoBaralho);

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    await screen.findByText(/Verso revelado\./);

    fireEvent.click(screen.getByRole("button", { name: /^Bom/ }));

    const anuncio = await screen.findByRole("status", {
      name: "Mudança de estado da Sessão",
    });

    expect(anuncio).toHaveAccessibleName("Mudança de estado da Sessão");
    expect(anuncio).toHaveAttribute("aria-live", "polite");
    expect(anuncio).toHaveAttribute("aria-atomic", "true");
    expect(anuncio).toHaveTextContent(/Avaliação registrada: Bom\./);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a conclusão é anunciada e o Resumo é perceptível (FR-049, FR-037)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(1);
    await iniciarSessao(cliente, idDoBaralho);

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    await screen.findByText(/Verso revelado\./);

    fireEvent.click(screen.getByRole("button", { name: /^Errei/ }));

    // A conclusão é anunciada pelo foco no título do Resumo, sem a mensagem
    // "Sessão concluída." à vista.
    const titulo = await screen.findByRole("heading", {
      name: "Sessão concluída",
    });
    expect(titulo).toHaveFocus();
    expect(screen.queryByText("Sessão concluída.")).toBeNull();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("de acertos")).toBeInTheDocument();
    expect(screen.getByText("0 de 1 Cartão")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Bom (0)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Errei (1)" }),
    ).toBeInTheDocument();
  });

  it("a modal de escolha é um diálogo nomeado, com as contagens fora do nome acessível das ações (FR-383, FR-387)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    renderizar(cliente, idDoBaralho);

    const dialogo = await screen.findByRole("dialog");

    // O nome do diálogo vem do título; as ações têm nome exato e a contagem
    // em descrição separada (FR-387).
    expect(dialogo).toHaveAccessibleName("Revisar baralho");
    expect(
      screen.getByRole("button", { name: "Só pendentes" }),
    ).toHaveAccessibleDescription("2 Cartões pendentes");
    expect(
      screen.getByRole("button", { name: "Todos os cartões" }),
    ).toHaveAccessibleDescription("2 Cartões no Baralho");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();

    // Enquanto a escolha está aberta não há Sessão nem anúncio de estado.
    expect(
      screen.queryByRole("status", { name: "Mudança de estado da Sessão" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("a recusa por limite é um alerta assertivo nomeado, sem duplicar anúncios (FR-049, FR-386)", async () => {
    const cliente = clienteDeProva();
    const criacao = await cliente.criarBaralho({ nome: "Inglês" });

    if (!criacao.ok) {
      throw new Error("a criação do Baralho deveria ser aceita");
    }

    const idDoBaralho = criacao.baralho.id;
    // Todos os Cartões agendados para o futuro: o conjunto está Revisado e
    // tentaria iniciar direto — mas excede o limite (FR-386).
    const vinculados: CartaoListado[] = Array.from(
      { length: LIMITE_DA_SELECAO + 1 },
      (_, indice) => ({
        id: `c${indice + 1}`,
        frente: `Frente ${indice + 1}`,
        verso: `Verso ${indice + 1}`,
        baralhos: [{ id: idDoBaralho, nome: "Inglês" }],
        proximaRevisaoEm: isoDaquiA(3),
      }),
    );

    vi.spyOn(cliente, "listarCartoes").mockResolvedValue({
      ok: true,
      cartoes: vinculados,
    });
    vi.spyOn(cliente, "obterBaralho").mockResolvedValue({
      ok: true,
      baralho: {
        id: idDoBaralho,
        nome: "Inglês",
        elegivel: true,
        cartoes: [],
      },
    });

    renderizar(cliente, idDoBaralho);

    const alerta = await screen.findByRole("alert");

    expect(alerta).toHaveAccessibleName("Falha ao iniciar a Sessão");
    expect(alerta).toHaveTextContent(/excede o limite de 1\.000 por Sessão/);
    expect(alerta).not.toHaveAttribute("aria-live");
    expect(
      screen.queryByRole("status", { name: "Mudança de estado da Sessão" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});
