import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";

import { SeletorDeIdioma } from "../src/idioma";
import { renderizarComIdioma } from "./apoio-de-prova";

describe("SeletorDeIdioma", () => {
  beforeEach(() => {
    // Limpar o corpo do documento entre os testes
    document.body.innerHTML = "";
  });

  it("mostra o globo e a sigla do idioma atual", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    expect(botao).toBeInTheDocument();

    // Verifica se contém o SVG do globo (aria-hidden)
    const globo = botao.querySelector("svg");
    expect(globo).toBeInTheDocument();
    expect(globo).toHaveAttribute("aria-hidden", "true");

    // Verifica se contém a sigla "PT"
    expect(botao).toHaveTextContent("PT");
  });

  it("tem nome acessível 'Idioma: Português' e haspopup", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    const botao = screen.getByRole("button", { name: "Idioma: Português" });
    expect(botao).toHaveAttribute("aria-haspopup", "menu");
    expect(botao).toHaveAttribute("aria-expanded", "false");
  });

  it("tem alvo de toque mínimo 44x44px definido no CSS", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    const botao = screen.getByRole("button", { name: /Idioma:/i });

    // Verifica se o botão tem a classe que define o tamanho mínimo
    expect(botao).toHaveClass("seletor-de-idioma__botao");
    // O CSS define min-height: 44px e min-width: 44px na classe
    // jsdom não lê CSS de forma confiável, então verificamos a classe
    expect(botao.tagName).toBe("BUTTON");
  });

  it("abre o menu com Enter", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    fireEvent.keyDown(botao, { key: "Enter", code: "Enter" });

    expect(botao).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("abre o menu com Space", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    fireEvent.keyDown(botao, { key: " ", code: "Space" });

    expect(botao).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("abre o menu com ArrowDown", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    fireEvent.keyDown(botao, { key: "ArrowDown", code: "ArrowDown" });

    expect(botao).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();

    // Verifica se o item atual (PT) está focado
    const itens = screen.getAllByRole("menuitemradio");
    expect(itens[0]).toHaveFocus();
  });

  it("mostra os três itens em ordem: PT, EN, ES", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    fireEvent.click(botao);

    const itens = screen.getAllByRole("menuitemradio");
    expect(itens).toHaveLength(3);
    expect(itens[0]).toHaveTextContent("PT Português");
    expect(itens[1]).toHaveTextContent("EN English");
    expect(itens[2]).toHaveTextContent("ES Español");
  });

  it("marca o item atual com aria-checked e checkmark visível", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />, "pt"));

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    fireEvent.click(botao);

    const itens = screen.getAllByRole("menuitemradio");
    const itemPt = itens[0];

    expect(itemPt).toHaveAttribute("aria-checked", "true");
    // Verificar checkmark (pode ser um span com aria-hidden)
    const checkmark = itemPt.querySelector("[aria-hidden='true']");
    expect(checkmark).toBeInTheDocument();
  });

  it("move foco com ArrowDown", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    fireEvent.keyDown(botao, { key: "ArrowDown", code: "ArrowDown" });

    const itens = screen.getAllByRole("menuitemradio");
    expect(itens[0]).toHaveFocus();

    fireEvent.keyDown(itens[0], { key: "ArrowDown", code: "ArrowDown" });
    expect(itens[1]).toHaveFocus();

    fireEvent.keyDown(itens[1], { key: "ArrowDown", code: "ArrowDown" });
    expect(itens[2]).toHaveFocus();
  });

  it("move foco com ArrowUp", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    fireEvent.keyDown(botao, { key: "ArrowDown", code: "ArrowDown" });

    const itens = screen.getAllByRole("menuitemradio");
    fireEvent.keyDown(itens[2], { key: "ArrowUp", code: "ArrowUp" });
    expect(itens[1]).toHaveFocus();

    fireEvent.keyDown(itens[1], { key: "ArrowUp", code: "ArrowUp" });
    expect(itens[0]).toHaveFocus();
  });

  it("vai para o primeiro item com Home", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    fireEvent.keyDown(botao, { key: "ArrowDown", code: "ArrowDown" });

    const itens = screen.getAllByRole("menuitemradio");
    fireEvent.keyDown(itens[2], { key: "Home", code: "Home" });
    expect(itens[0]).toHaveFocus();
  });

  it("vai para o último item com End", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    fireEvent.keyDown(botao, { key: "ArrowDown", code: "ArrowDown" });

    const itens = screen.getAllByRole("menuitemradio");
    fireEvent.keyDown(itens[0], { key: "End", code: "End" });
    expect(itens[2]).toHaveFocus();
  });

  it("seleciona com Enter", async () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    fireEvent.keyDown(botao, { key: "ArrowDown", code: "ArrowDown" });

    const itens = screen.getAllByRole("menuitemradio");
    fireEvent.keyDown(itens[1], { key: "Enter", code: "Enter" });

    // O menu fecha
    expect(botao).toHaveAttribute("aria-expanded", "false");
    // O botão agora mostra EN
    expect(botao).toHaveTextContent("EN");
  });

  it("seleciona com Space", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    fireEvent.keyDown(botao, { key: "ArrowDown", code: "ArrowDown" });

    const itens = screen.getAllByRole("menuitemradio");
    fireEvent.keyDown(itens[2], { key: " ", code: "Space" });

    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(botao).toHaveTextContent("ES");
  });

  it("fecha sem mudança com Escape", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />, "pt"));

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    fireEvent.click(botao);

    const itens = screen.getAllByRole("menuitemradio");
    fireEvent.keyDown(itens[1], { key: "Escape", code: "Escape" });

    expect(botao).toHaveAttribute("aria-expanded", "false");
    // Idioma permanece PT
    expect(botao).toHaveTextContent("PT");
  });

  it("foco volta ao botão após fechar", async () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    fireEvent.keyDown(botao, { key: "ArrowDown", code: "ArrowDown" });

    const itens = screen.getAllByRole("menuitemradio");
    fireEvent.keyDown(itens[1], { key: "Enter", code: "Enter" });

    await act(async () => {});
    await waitFor(() => {
      expect(botao).toHaveFocus();
    });
  });

  it("fecha com clique fora", () => {
    const { container } = render(
      renderizarComIdioma(<SeletorDeIdioma />)
    );

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    fireEvent.click(botao);

    expect(botao).toHaveAttribute("aria-expanded", "true");

    fireEvent.mouseDown(container);
    expect(botao).toHaveAttribute("aria-expanded", "false");
  });

  it("anuncia a mudança na região aria-live", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    fireEvent.click(botao);

    const itens = screen.getAllByRole("menuitemradio");
    fireEvent.click(itens[1]); // Clica em EN

    // Verifica o anúncio na região de leitura (deve estar em inglês)
    const regiaoDeLeitura = document.querySelector('[aria-live="polite"]');
    expect(regiaoDeLeitura?.textContent).toContain("Language changed to English");
  });

  it("não renderiza o menu quando fechado", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("renderiza o menu quando aberto", () => {
    render(renderizarComIdioma(<SeletorDeIdioma />));

    const botao = screen.getByRole("button", { name: /Idioma:/i });
    fireEvent.click(botao);

    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});
