import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { PaginaDoFormularioDeCartao } from "../src/ui/PaginaDoFormularioDeCartao";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";

/**
 * T021, T039 — o formulário de Cartão com o seletor de Tipo e os campos do
 * tipo Imagem (026, contracts/ui.md; FR-404–FR-406, FR-410, FR-413, FR-420,
 * FR-425).
 */

let cliente: ClienteEmMemoria;
let baralhoId: string;

beforeEach(async () => {
  cliente = clienteDeProva();
  const baralho = await cliente.criarBaralho({ nome: "Geografia" });
  if (!baralho.ok) throw new Error("Baralho de prova não criado");
  baralhoId = baralho.baralho.id;
  window.location.hash = `#/baralhos/${baralhoId}/cartoes/novo`;
});

/** Um PNG de verdade pelos primeiros bytes. */
function png(nome = "mapa.png", tamanho = 64): File {
  const bytes = new Uint8Array(tamanho);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], nome, { type: "image/png" });
}

function abrirCriacao() {
  render(
    comProtecaoDeSaida(<PaginaDoFormularioDeCartao cliente={cliente} baralhoId={baralhoId} />, true),
  );
}

function seletor(): HTMLSelectElement {
  return screen.getByLabelText("Tipo de cartão") as HTMLSelectElement;
}

function escolherTipo(tipo: "frente-verso" | "imagem") {
  fireEvent.change(seletor(), { target: { value: tipo } });
}

function escolherArquivo(arquivo: File) {
  fireEvent.change(screen.getByLabelText("Imagem"), { target: { files: [arquivo] } });
}

function salvar() {
  fireEvent.submit(screen.getByLabelText("Verso").closest("form")!);
}

describe("seletor de Tipo de cartão (FR-404, FR-405)", () => {
  it("toda abertura começa em Frente-Verso, com os campos de sempre", async () => {
    abrirCriacao();

    expect(seletor().value).toBe("frente-verso");
    expect(within(seletor()).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Frente-Verso",
      "Imagem",
    ]);
    expect(screen.getByLabelText("Frente")).toBeInTheDocument();
    expect(screen.queryByLabelText("Imagem")).not.toBeInTheDocument();
  });

  it("começa em Frente-Verso mesmo depois de criar um Cartão do tipo Imagem", async () => {
    const enviada = await cliente.enviarImagem(png());
    if (!enviada.ok) throw new Error("envio recusado");
    await cliente.criarCartao(baralhoId, { tipo: "imagem", imagemId: enviada.imagemId, frente: "", verso: "V" });

    abrirCriacao();

    expect(seletor().value).toBe("frente-verso");
  });

  it("troca os campos sem sair da tela, anuncia a troca e mantém os textos comuns (FR-406, FR-425)", async () => {
    abrirCriacao();
    fireEvent.change(screen.getByLabelText("Frente"), { target: { value: "Qual estado?" } });
    fireEvent.change(screen.getByLabelText("Verso"), { target: { value: "Pernambuco" } });

    escolherTipo("imagem");

    const campos = Array.from(
      document.querySelectorAll<HTMLElement>("form input, form textarea, form select"),
    ).map((campo) => campo.id);
    expect(campos).toEqual([
      "campo-tipo",
      "campo-imagem",
      "campo-descricao",
      "campo-frente",
      "campo-verso",
      expect.any(String), // Tags
    ]);
    expect(screen.getByText("Campos do tipo Imagem")).toBeInTheDocument();
    expect(screen.getByLabelText("Texto da frente (opcional)")).toHaveValue("Qual estado?");
    expect(screen.getByLabelText("Verso")).toHaveValue("Pernambuco");
    expect(screen.getByText("JPEG, PNG, WebP ou GIF, até 5 MB.")).toBeInTheDocument();
    expect(screen.getByText("Descreva a imagem sem revelar a resposta.")).toBeInTheDocument();

    escolherTipo("frente-verso");
    expect(screen.getByText("Campos do tipo Frente-Verso")).toBeInTheDocument();
    expect(screen.getByLabelText("Frente")).toHaveValue("Qual estado?");
  });

  it("pede confirmação para descartar a Imagem; cancelar mantém tipo e Imagem e devolve o foco ao seletor", async () => {
    abrirCriacao();
    escolherTipo("imagem");
    escolherArquivo(png());

    escolherTipo("frente-verso");
    const dialogo = await screen.findByRole("dialog", { name: "Descartar a imagem?" });
    expect(within(dialogo).getByRole("button", { name: "Cancelar" })).toHaveFocus();

    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(seletor().value).toBe("imagem");
    expect(screen.getByRole("button", { name: "Remover imagem" })).toBeInTheDocument();
    expect(seletor()).toHaveFocus();

    escolherTipo("frente-verso");
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Descartar imagem" }),
    );
    expect(seletor().value).toBe("frente-verso");
    expect(screen.queryByLabelText("Imagem")).not.toBeInTheDocument();
  });
});

describe("campos do tipo Imagem (FR-410, FR-413)", () => {
  it("mostra a pré-visualização com Trocar e Remover", async () => {
    abrirCriacao();
    escolherTipo("imagem");
    escolherArquivo(png("estado.png"));

    expect(screen.getByRole("button", { name: "Trocar imagem" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remover imagem" }));
    expect(screen.queryByRole("button", { name: "Remover imagem" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Imagem")).toHaveFocus();
  });

  it.each([
    ["formato não aceito", new File(["texto"], "notas.txt", { type: "text/plain" }), "Escolha uma imagem JPEG, PNG, WebP ou GIF."],
    ["acima de 5 MB", png("grande.png", 5_242_881), "A imagem deve ter no máximo 5 MB."],
  ])("recusa na escolha um arquivo %s, com foco no campo e os textos preservados", async (_, arquivo, mensagem) => {
    abrirCriacao();
    escolherTipo("imagem");
    fireEvent.change(screen.getByLabelText("Verso"), { target: { value: "Pernambuco" } });

    escolherArquivo(arquivo);

    expect(screen.getByRole("alert")).toHaveTextContent(mensagem);
    expect(screen.getByLabelText("Imagem")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Imagem")).toHaveFocus();
    expect(screen.getByLabelText("Verso")).toHaveValue("Pernambuco");
    expect(screen.queryByRole("button", { name: "Remover imagem" })).not.toBeInTheDocument();
  });

  it("recusa salvar sem Imagem com \"Escolha uma imagem.\"", async () => {
    abrirCriacao();
    escolherTipo("imagem");
    fireEvent.change(screen.getByLabelText("Verso"), { target: { value: "Pernambuco" } });

    salvar();

    expect(await screen.findByText("Escolha uma imagem.")).toBeInTheDocument();
    expect(screen.getByLabelText("Imagem")).toHaveFocus();
  });

  it("recusa no salvamento um texto disfarçado de PNG, com foco no campo e os textos preservados (FR-411)", async () => {
    abrirCriacao();
    escolherTipo("imagem");
    fireEvent.change(screen.getByLabelText("Verso"), { target: { value: "Pernambuco" } });
    escolherArquivo(new File(["não sou imagem"], "falso.png", { type: "image/png" }));

    salvar();

    expect(await screen.findByText("O arquivo não é uma imagem JPEG, PNG, WebP ou GIF.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Imagem")).toHaveFocus());
    expect(screen.getByLabelText("Verso")).toHaveValue("Pernambuco");
  });

  it("cria o Cartão do tipo Imagem e volta ao Baralho", async () => {
    abrirCriacao();
    escolherTipo("imagem");
    escolherArquivo(png());
    fireEvent.change(screen.getByLabelText("Descrição da imagem (opcional)"), { target: { value: "Mapa" } });
    fireEvent.change(screen.getByLabelText("Verso"), { target: { value: "Pernambuco" } });

    salvar();

    await waitFor(() => expect(window.location.hash).toBe(`#/baralhos/${baralhoId}`));
    const baralho = await cliente.obterBaralho(baralhoId);
    expect(baralho.ok && baralho.baralho.cartoes).toEqual([
      expect.objectContaining({ tipo: "imagem", frente: "", verso: "Pernambuco", textoAlternativo: "Mapa" }),
    ]);
  });
});

describe("edição do Cartão do tipo Imagem (FR-420, US3-1..3)", () => {
  async function criarEAbrirEdicao(): Promise<string> {
    const enviada = await cliente.enviarImagem(png());
    if (!enviada.ok) throw new Error("envio recusado");
    const criado = await cliente.criarCartao(baralhoId, {
      tipo: "imagem",
      imagemId: enviada.imagemId,
      frente: "",
      verso: "Pernambuco",
    });
    if (!criado.ok) throw new Error("criação recusada");
    window.location.hash = `#/baralhos/${baralhoId}/cartoes/${criado.cartao.id}/editar`;
    render(
      comProtecaoDeSaida(
        <PaginaDoFormularioDeCartao cliente={cliente} baralhoId={baralhoId} id={criado.cartao.id} />,
        true,
      ),
    );
    await screen.findByText("Tipo: Imagem");
    return criado.cartao.id;
  }

  it("mostra o tipo como texto, sem seletor, com a Imagem atual e Trocar/Remover", async () => {
    await criarEAbrirEdicao();

    expect(screen.queryByLabelText("Tipo de cartão")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar imagem" })).toBeInTheDocument();
  });

  it("recusa salvar depois de remover a Imagem sem escolher outra", async () => {
    await criarEAbrirEdicao();

    fireEvent.click(screen.getByRole("button", { name: "Remover imagem" }));
    salvar();

    expect(await screen.findByText("Escolha uma imagem.")).toBeInTheDocument();
    expect(screen.getByLabelText("Imagem")).toHaveFocus();
  });

  it("troca a Imagem e salva", async () => {
    const id = await criarEAbrirEdicao();

    escolherArquivo(png("outro.png"));
    salvar();

    await waitFor(() => expect(window.location.hash).toBe(`#/baralhos/${baralhoId}`));
    const listagem = await cliente.listarCartoes();
    expect(listagem.ok && listagem.cartoes.find((c) => c.id === id)?.imagem?.url).toMatch(/img2$/);
  });
});

describe("teclado (FR-425, T022)", () => {
  it("todos os controles do tipo Imagem são alcançáveis por Tab, na ordem visual", async () => {
    abrirCriacao();
    escolherTipo("imagem");

    const antes = Array.from(
      document.querySelectorAll<HTMLElement>("form select, form input, form textarea, form button"),
    ).filter((elemento) => elemento.tabIndex >= 0 && !elemento.hasAttribute("disabled"));
    expect(antes.map((e) => e.getAttribute("aria-label") ?? (e as HTMLInputElement).labels?.[0]?.textContent ?? e.textContent)).toEqual([
      "Tipo de cartão",
      "Imagem",
      "Descrição da imagem (opcional)",
      "Texto da frente (opcional)",
      "Verso",
      "Tags",
      "Salvar",
      "Cancelar",
    ]);

    escolherArquivo(png());
    const trocar = screen.getByRole("button", { name: "Trocar imagem" });
    const remover = screen.getByRole("button", { name: "Remover imagem" });
    trocar.focus();
    expect(trocar).toHaveFocus();
    remover.focus();
    fireEvent.keyDown(remover, { key: "Enter" });
    fireEvent.click(remover);
    expect(screen.getByLabelText("Imagem")).toHaveFocus();
  });
});
