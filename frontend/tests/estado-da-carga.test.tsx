import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EstadoDaCarga } from "../src/ui/EstadoDaCarga";

/**
 * EstadoDaCarga (FR-144, FR-153).
 *
 * Cada variante é anunciada pelo seu papel — `status` no carregamento e
 * `alert` na falha —, e só a falha oferece "Tentar novamente", ligado ao
 * callback recebido. O vazio aceita uma ação opcional.
 */

describe("EstadoDaCarga — carregando", () => {
  it("anuncia o carregamento com role status", () => {
    render(
      <EstadoDaCarga estado="carregando" mensagem="Carregando os Baralhos…" />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveClass("carregando");
    expect(status).toHaveTextContent("Carregando os Baralhos…");
  });
});

describe("EstadoDaCarga — falha", () => {
  it("anuncia a falha e oferece Tentar novamente", () => {
    const aoTentarNovamente = vi.fn();
    render(
      <EstadoDaCarga
        estado="falha"
        mensagem="Não foi possível carregar os Baralhos."
        aoTentarNovamente={aoTentarNovamente}
      />,
    );

    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveClass("aviso", "aviso--erro");
    expect(alerta).toHaveTextContent("Não foi possível carregar os Baralhos.");

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(aoTentarNovamente).toHaveBeenCalledTimes(1);
  });
});

describe("EstadoDaCarga — vazio", () => {
  it("mostra a mensagem e a ação opcional", () => {
    render(
      <EstadoDaCarga
        estado="vazio"
        mensagem="Você ainda não tem Baralhos."
        acao={<a href="#/baralhos/novo">Criar Baralho</a>}
      />,
    );

    const mensagem = screen.getByText("Você ainda não tem Baralhos.");
    expect(mensagem.parentElement).toHaveClass("estado-vazio");
    expect(screen.getByRole("link", { name: "Criar Baralho" })).toHaveAttribute(
      "href",
      "#/baralhos/novo",
    );
  });

  it("dispensa a ação quando ela não é informada", () => {
    render(
      <EstadoDaCarga estado="vazio" mensagem="Você ainda não tem Cartões." />,
    );

    expect(
      screen.getByText("Você ainda não tem Cartões."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
