import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { ProvedorDeIdioma } from "../src/idioma";
import { PaginaDoFormularioDeCartao } from "../src/ui/PaginaDoFormularioDeCartao";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";

/**
 * T051 — edição de Cartão do tipo Áudio na página do formulário (028,
 * contracts/ui.md "Edição"; FR-444, FR-448; US3-1..3).
 *
 * O tipo aparece como texto, sem seletor. O tocador do Áudio atual vem com
 * Trocar e Remover; salvar sem Áudio é recusado com "Escolha um áudio.", com foco
 * no campo. Com o Áudio atual indisponível, os textos seguem editáveis e salváveis.
 */

let cliente: ClienteEmMemoria;
let baralhoId: string;
let cartaoId: string;
let sondas: HTMLAudioElement[];
let duracaoOriginal: PropertyDescriptor | undefined;
let criarUrl: ReturnType<typeof vi.fn>;
let revogarUrl: ReturnType<typeof vi.fn>;

/** Um arquivo de Áudio de prova; a duração declarada é a que o envio confirma. */
function audio(nome = "mapa-sonoro.mp3", duracaoDeTesteMs = 4000): File {
  const arquivo = new File([new Uint8Array(64)], nome, { type: "audio/mpeg" });
  Object.defineProperty(arquivo, "duracaoDeTesteMs", { value: duracaoDeTesteMs });
  return arquivo;
}

async function criarCartaoComAudio(): Promise<void> {
  const enviado = await cliente.enviarAudio(audio());
  if (!enviado.ok) throw new Error("envio de Áudio recusado");
  const criado = await cliente.criarCartao(baralhoId, {
    tipo: "audio",
    audioId: enviado.audioId,
    frente: "",
    verso: "Recife",
  });
  if (!criado.ok) throw new Error("criação do Cartão recusada");
  cartaoId = criado.cartao.id;
}

function abrirEdicao(idioma: "pt" | "en" | "es" = "pt") {
  window.location.hash = `#/baralhos/${baralhoId}/cartoes/${cartaoId}/editar`;
  const pagina = (
    <PaginaDoFormularioDeCartao cliente={cliente} baralhoId={baralhoId} id={cartaoId} />
  );
  render(
    comProtecaoDeSaida(
      idioma === "pt" ? pagina : <ProvedorDeIdioma idiomaInicial={idioma}>{pagina}</ProvedorDeIdioma>,
      true,
    ),
  );
}

/** Pelo id, porque o rótulo muda com o idioma da interface. */
function campoDeAudio(): HTMLInputElement {
  return document.getElementById("campo-audio") as HTMLInputElement;
}

function campoDeVerso(): HTMLTextAreaElement {
  return screen.getByLabelText("Verso") as HTMLTextAreaElement;
}

function escolherArquivo(arquivo: File) {
  fireEvent.change(campoDeAudio(), { target: { files: [arquivo] } });
}

function salvar() {
  fireEvent.submit(document.querySelector("form")!);
}

async function cartaoSalvo() {
  const listagem = await cliente.listarCartoes();
  if (!listagem.ok) throw new Error("listagem recusada");
  const cartao = listagem.cartoes.find((c) => c.id === cartaoId);
  if (!cartao) throw new Error("Cartão não encontrado");
  return cartao;
}

beforeEach(async () => {
  cliente = clienteDeProva();
  const baralho = await cliente.criarBaralho({ nome: "Geografia" });
  if (!baralho.ok) throw new Error("Baralho de prova não criado");
  baralhoId = baralho.baralho.id;
  await criarCartaoComAudio();

  // jsdom não tem endereços de objeto: o formulário os recebe pelo stub.
  criarUrl = vi.fn(() => "blob:audio-de-prova");
  revogarUrl = vi.fn();
  Object.assign(URL, { createObjectURL: criarUrl, revokeObjectURL: revogarUrl });

  // A sonda de duração é um `Audio` capturado; o jsdom não carrega mídia.
  sondas = [];
  const AudioOriginal = window.Audio;
  vi.stubGlobal("Audio", function (this: unknown, fonte?: string) {
    const el = new AudioOriginal(fonte);
    sondas.push(el);
    return el;
  });

  duracaoOriginal = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "duration");
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (duracaoOriginal) {
    Object.defineProperty(HTMLMediaElement.prototype, "duration", duracaoOriginal);
  } else {
    delete (HTMLMediaElement.prototype as unknown as Record<string, unknown>).duration;
  }
  delete (URL as unknown as Record<string, unknown>).createObjectURL;
  delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
});

describe("edição do Cartão do tipo Áudio (028, FR-448, US3)", () => {
  it("mostra o tipo como texto, sem seletor, com o tocador do Áudio atual", async () => {
    abrirEdicao();

    expect(await screen.findByText("Tipo: Áudio")).toBeInTheDocument();
    expect(screen.queryByLabelText("Tipo de cartão")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tocar áudio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar áudio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover áudio" })).toBeInTheDocument();
  });

  it("trocar o áudio mostra a pré-escuta com o nome e salva o novo Áudio e a nova duração", async () => {
    abrirEdicao();
    await screen.findByText("Tipo: Áudio");

    escolherArquivo(audio("novo.mp3", 7000));

    expect(await screen.findByText("novo.mp3")).toBeInTheDocument();
    salvar();

    await waitFor(() => expect(window.location.hash).toBe(`#/baralhos/${baralhoId}`));
    const cartao = await cartaoSalvo();
    expect(cartao.audio?.url).toMatch(/aud2$/);
    expect(cartao.duracaoMs).toBe(7000);
  });

  it("salvar sem tocar no áudio mantém o Áudio e a duração", async () => {
    abrirEdicao();
    await screen.findByText("Tipo: Áudio");

    fireEvent.change(campoDeVerso(), { target: { value: "Olinda" } });
    salvar();

    await waitFor(() => expect(window.location.hash).toBe(`#/baralhos/${baralhoId}`));
    const cartao = await cartaoSalvo();
    expect(cartao.verso).toBe("Olinda");
    expect(cartao.audio?.url).toMatch(/aud1$/);
    expect(cartao.duracaoMs).toBe(4000);
  });

  it("remover o áudio e salvar é recusado com \"Escolha um áudio.\" e foco no campo Áudio", async () => {
    abrirEdicao();
    await screen.findByText("Tipo: Áudio");

    fireEvent.click(screen.getByRole("button", { name: "Remover áudio" }));
    salvar();

    expect(await screen.findByText("Escolha um áudio.")).toBeInTheDocument();
    expect(campoDeAudio()).toHaveFocus();
    expect(window.location.hash).toBe(`#/baralhos/${baralhoId}/cartoes/${cartaoId}/editar`);
  });

  it("com o Áudio atual indisponível, mostra Áudio indisponível e os textos seguem salváveis (FR-444)", async () => {
    const original = cliente.listarCartoes.bind(cliente);
    vi.spyOn(cliente, "listarCartoes").mockImplementation(async () => {
      const listagem = await original();
      if (!listagem.ok) return listagem;
      return {
        ...listagem,
        cartoes: listagem.cartoes.map((cartao) => ({ ...cartao, audio: null })),
      };
    });

    abrirEdicao();

    expect(await screen.findByText("Áudio indisponível")).toBeInTheDocument();
    fireEvent.change(campoDeVerso(), { target: { value: "Olinda" } });
    salvar();

    await waitFor(() => expect(window.location.hash).toBe(`#/baralhos/${baralhoId}`));
    expect((await cartaoSalvo()).verso).toBe("Olinda");
  });

  it("uma falha de carga do Áudio atual pede o endereço de novo uma vez e aplica o novo src (FR-444)", async () => {
    const original = cliente.listarCartoes.bind(cliente);
    let cargas = 0;
    const listar = vi.spyOn(cliente, "listarCartoes").mockImplementation(async () => {
      const listagem = await original();
      cargas += 1;
      if (!listagem.ok || cargas === 1) return listagem;
      return {
        ...listagem,
        cartoes: listagem.cartoes.map((cartao) => ({
          ...cartao,
          audio: { url: "https://exemplo.test/renovado.mp3", expiraEm: "2099-01-01T00:00:00.000Z" },
        })),
      };
    });

    abrirEdicao();
    await screen.findByText("Tipo: Áudio");
    const chamadasNaCarga = listar.mock.calls.length;
    const player = document.querySelector(".previa-do-audio audio") as HTMLAudioElement;

    fireEvent.error(player);

    await waitFor(() => expect(listar).toHaveBeenCalledTimes(chamadasNaCarga + 1));
    await waitFor(() =>
      expect(document.querySelector(".previa-do-audio audio")).toHaveAttribute(
        "src",
        "https://exemplo.test/renovado.mp3",
      ),
    );
    expect(screen.queryByText("Áudio indisponível")).not.toBeInTheDocument();

    fireEvent.error(document.querySelector(".previa-do-audio audio") as HTMLAudioElement);

    expect(await screen.findByText("Áudio indisponível")).toBeInTheDocument();
    expect(listar).toHaveBeenCalledTimes(chamadasNaCarga + 1);
  });

  it("em inglês, o tipo lê-se \"Type: Audio\" e a recusa vem em inglês", async () => {
    abrirEdicao("en");

    expect(await screen.findByText("Type: Audio")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove audio" }));
    salvar();

    expect(await screen.findByText("Choose an audio file.")).toBeInTheDocument();
    expect(campoDeAudio()).toHaveFocus();
  });

  it("em espanhol, o tipo lê-se \"Tipo: Audio\" e a recusa vem em espanhol", async () => {
    abrirEdicao("es");

    expect(await screen.findByText("Tipo: Audio")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Quitar audio" }));
    salvar();

    expect(await screen.findByText("Elige un audio.")).toBeInTheDocument();
    expect(campoDeAudio()).toHaveFocus();
  });
});
