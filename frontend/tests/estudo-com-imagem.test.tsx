import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { AleatoriedadeDeterministica } from "../src/sessao-de-estudo/aleatoriedade";
import { PaginaDeEstudo } from "../src/ui/PaginaDeEstudo";
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";
import { ResumoDaSessao } from "../src/ui/ResumoDaSessao";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";

/**
 * T032 — o Cartão do tipo Imagem no Baralho, na Sessão e no Histórico (026;
 * FR-415, FR-416, FR-418, FR-419, FR-419a, FR-426, FR-429).
 */

let cliente: ClienteEmMemoria;
let baralhoId: string;

beforeEach(async () => {
  cliente = clienteDeProva();
  const baralho = await cliente.criarBaralho({ nome: "Geografia" });
  if (!baralho.ok) throw new Error("Baralho de prova não criado");
  baralhoId = baralho.baralho.id;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function png(): File {
  const bytes = new Uint8Array(32);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], "mapa.png", { type: "image/png" });
}

async function criarImagem(dados: { frente?: string; verso?: string; textoAlternativo?: string } = {}) {
  const enviada = await cliente.enviarImagem(png());
  if (!enviada.ok) throw new Error("envio recusado");
  const criado = await cliente.criarCartao(baralhoId, {
    tipo: "imagem",
    imagemId: enviada.imagemId,
    frente: dados.frente ?? "",
    verso: dados.verso ?? "Pernambuco",
    ...(dados.textoAlternativo !== undefined ? { textoAlternativo: dados.textoAlternativo } : {}),
  });
  if (!criado.ok) throw new Error("criação recusada");
  return criado.cartao;
}

async function abrirBaralho() {
  render(comProtecaoDeSaida(<PaginaDoBaralho cliente={cliente} id={baralhoId} />));
  await screen.findByRole("heading", { level: 1, name: "Geografia" });
}

describe("detalhe do Baralho (FR-415, FR-418, FR-419, FR-426)", () => {
  it("rotula o tipo por texto e mostra a Imagem direto no item, sem link", async () => {
    await cliente.criarCartao(baralhoId, { frente: "To walk", verso: "Caminhar" });
    await criarImagem({ textoAlternativo: "Mapa com um estado destacado" });

    await abrirBaralho();

    const cartoesDoBaralho = within(
      screen.getByRole("region", { name: "Cartões do Baralho" }),
    );
    expect(cartoesDoBaralho.getByText("Frente-Verso")).toBeInTheDocument();
    expect(cartoesDoBaralho.getByText("Imagem")).toBeInTheDocument();
    const imagem = screen.getByRole("img", { name: "Mapa com um estado destacado" });
    expect(imagem).toHaveClass("imagem-do-cartao--miniatura");
    expect(imagem.closest("a")).toBeNull();
  });

  it("usa como texto alternativo a Descrição, senão o Texto da frente, senão \"Imagem do Cartão\"", async () => {
    await criarImagem({ frente: "Qual estado?" });
    await criarImagem({ verso: "Bahia" });

    await abrirBaralho();

    expect(screen.getByRole("img", { name: "Qual estado?" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Imagem do Cartão" })).toBeInTheDocument();
  });

  it("encontra o Cartão do tipo Imagem pelo Texto da frente e pelo Verso", async () => {
    await cliente.criarCartao(baralhoId, { frente: "To walk", verso: "Caminhar" });
    await criarImagem({ frente: "Qual estado?", verso: "Pernambuco" });
    await abrirBaralho();
    const busca = screen.getByLabelText("Buscar Cartões");

    fireEvent.change(busca, { target: { value: "pernambuco" } });
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.queryByText("To walk")).not.toBeInTheDocument();

    fireEvent.change(busca, { target: { value: "qual estado" } });
    expect(screen.getByText("Qual estado?")).toBeInTheDocument();
  });

  it("renova os endereços uma vez e, persistindo a falha, mostra Imagem indisponível", async () => {
    await criarImagem({ textoAlternativo: "Mapa" });
    await abrirBaralho();
    const obterBaralho = vi.spyOn(cliente, "obterBaralho");

    fireEvent.error(screen.getByRole("img", { name: "Mapa" }));
    await waitFor(() => expect(obterBaralho).toHaveBeenCalledTimes(1));

    fireEvent.error(await screen.findByRole("img", { name: "Mapa" }));
    expect(await screen.findByText("Imagem indisponível")).toBeInTheDocument();
  });
});

describe("Sessão de estudo (FR-416, FR-418, FR-429)", () => {
  function iniciarSessao() {
    render(
      comProtecaoDeSaida(
        <PaginaDeEstudo
          cliente={cliente}
          id={baralhoId}
          aleatoriedade={new AleatoriedadeDeterministica([0, 0, 0, 0])}
        />,
      ),
    );
  }

  it("mostra a Imagem antes da revelação e o Verso só depois", async () => {
    await criarImagem({ frente: "Qual estado?", textoAlternativo: "Mapa" });
    iniciarSessao();
    fireEvent.click(await screen.findByRole("button", { name: "Todos os cartões" }));

    const artigo = await screen.findByRole("article");
    expect(within(artigo).getByRole("img", { name: "Mapa" })).toHaveClass("imagem-do-cartao--face");
    expect(within(artigo).getByText("Qual estado?")).toBeInTheDocument();
    expect(within(artigo).queryByText("Pernambuco")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    expect(await within(artigo).findByText("Pernambuco")).toBeInTheDocument();
  });

  it("mostra Imagem indisponível com a Descrição e deixa avaliar", async () => {
    await criarImagem({ textoAlternativo: "Mapa do Nordeste" });
    iniciarSessao();
    fireEvent.click(await screen.findByRole("button", { name: "Todos os cartões" }));

    fireEvent.error(await screen.findByRole("img", { name: "Mapa do Nordeste" }));
    fireEvent.error(await screen.findByRole("img", { name: "Mapa do Nordeste" }));

    expect(await screen.findByText("Imagem indisponível")).toBeInTheDocument();
    expect(screen.getByText("Mapa do Nordeste", { selector: ".imagem-do-cartao__descricao" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    expect(await screen.findByRole("heading", { name: "Verso" })).toBeInTheDocument();
  });

  it("com movimento reduzido, desenha a Imagem parada numa tela, sem <img> animada", async () => {
    vi.stubGlobal("matchMedia", (consulta: string) => ({
      matches: consulta.includes("prefers-reduced-motion"),
      media: consulta,
      addEventListener() {},
      removeEventListener() {},
    }));
    await criarImagem({ textoAlternativo: "GIF do mapa" });
    iniciarSessao();
    fireEvent.click(await screen.findByRole("button", { name: "Todos os cartões" }));

    const parada = await screen.findByRole("img", { name: "GIF do mapa" });
    expect(parada.tagName).toBe("CANVAS");
    expect(document.querySelector("article img")).toBeNull();
  });

  it("registra o tipo no Histórico, sem a Imagem (FR-419a)", async () => {
    const cartao = await criarImagem();
    const registrar = vi.spyOn(cliente, "registrarSessao");
    iniciarSessao();
    fireEvent.click(await screen.findByRole("button", { name: "Todos os cartões" }));

    fireEvent.click(await screen.findByRole("button", { name: "Revelar verso" }));
    fireEvent.click(await screen.findByRole("button", { name: /Bom/ }));

    await waitFor(() => expect(registrar).toHaveBeenCalled());
    expect(registrar.mock.calls[0]![0].itens).toEqual([
      { tipo: "imagem", frente: "", verso: "Pernambuco", cartaoId: cartao.id, avaliacao: "bom" },
    ]);
  });
});

describe("Histórico (FR-419a)", () => {
  it("rotula o item como Cartão do tipo Imagem e não exibe Imagem", () => {
    render(
      <ResumoDaSessao
        itens={[{ tipo: "imagem", frente: "", verso: "Pernambuco", resultado: "acertou", avaliacao: "bom" }]}
      />,
    );

    expect(screen.getByText("Cartão do tipo Imagem")).toBeInTheDocument();
    expect(screen.getByText(/sem texto/)).toBeInTheDocument();
    expect(document.querySelector("img, canvas")).toBeNull();
  });
});
