import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContext } from "react";

import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { ContextoDeIdioma, ProvedorDeIdioma } from "../src/idioma";
import { MENSAGENS_PT } from "../src/idioma/mensagens";
import { PaginaDoFormularioDeCartao } from "../src/ui/PaginaDoFormularioDeCartao";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";

/**
 * T030 — o formulário de Cartão com o tipo Áudio (028, contracts/ui.md
 * "Formulário de criação" e "Troca de idioma"; FR-432, FR-433, FR-438, FR-440,
 * FR-456, FR-457, FR-458, FR-460).
 *
 * A duração lida no navegador vem de uma sonda `Audio` que o teste captura:
 * o jsdom não carrega mídia, então o `loadedmetadata` é disparado à mão.
 */

const ACEITOS =
  "audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/webm,audio/wav,audio/x-wav,.mp3,.m4a,.ogg,.opus,.webm,.wav";
const AJUDA_DO_AUDIO =
  "MP3, M4A, OGG, WebM ou WAV, até 10 MB e 5 minutos. MP3 e M4A tocam em todos os aparelhos.";
const AJUDA_DA_MENSAGEM = "Contexto ou pergunta para o áudio, sem revelar a resposta.";

let cliente: ClienteEmMemoria;
let baralhoId: string;
let sondas: HTMLAudioElement[];
let duracaoOriginal: PropertyDescriptor | undefined;
let criarUrl: ReturnType<typeof vi.fn>;
let revogarUrl: ReturnType<typeof vi.fn>;
let pedirMicrofone: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  cliente = clienteDeProva();
  const baralho = await cliente.criarBaralho({ nome: "Geografia" });
  if (!baralho.ok) throw new Error("Baralho de prova não criado");
  baralhoId = baralho.baralho.id;
  window.location.hash = `#/baralhos/${baralhoId}/cartoes/novo`;

  // jsdom não tem endereços de objeto: o formulário os recebe pelo stub.
  criarUrl = vi.fn(() => "blob:audio-de-prova");
  revogarUrl = vi.fn();
  pedirMicrofone = vi.fn();
  Object.assign(URL, { createObjectURL: criarUrl, revokeObjectURL: revogarUrl });

  // A sonda de duração é um `Audio` capturado, sem depender do DOM.
  sondas = [];
  const AudioOriginal = window.Audio;
  vi.stubGlobal(
    "Audio",
    function (this: unknown, fonte?: string) {
      const el = new AudioOriginal(fonte);
      sondas.push(el);
      return el;
    },
  );

  duracaoOriginal = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "duration");

  // jsdom não toca mídia: o `play` devolve uma promessa que o tocador aguarda.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);

  // O microfone nunca é pedido (FR-440).
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: pedirMicrofone },
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (duracaoOriginal) {
    Object.defineProperty(HTMLMediaElement.prototype, "duration", duracaoOriginal);
  } else {
    delete (HTMLMediaElement.prototype as unknown as Record<string, unknown>).duration;
  }
  delete (navigator as unknown as Record<string, unknown>).mediaDevices;
  delete (URL as unknown as Record<string, unknown>).createObjectURL;
  delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
});

/** Um arquivo de Áudio de prova; o conteúdo não é conferido no navegador. */
function audio(nome = "mapa-sonoro.mp3", tipo = "audio/mpeg", tamanho = 64): File {
  return new File([new Uint8Array(tamanho)], nome, { type: tipo });
}

/** Declara a duração que a sonda lerá do arquivo local. */
function duracaoDoAudio(segundos: number) {
  Object.defineProperty(HTMLMediaElement.prototype, "duration", {
    configurable: true,
    get: () => segundos,
  });
}

/** Dispara o `loadedmetadata` da sonda mais recente. */
function carregarMetadados() {
  const sonda = sondas[sondas.length - 1];
  if (!sonda) throw new Error("sonda de duração não criada");
  act(() => {
    sonda.dispatchEvent(new Event("loadedmetadata"));
  });
}

function abrirCriacao() {
  return render(
    comProtecaoDeSaida(<PaginaDoFormularioDeCartao cliente={cliente} baralhoId={baralhoId} />, true),
  );
}

function seletor(): HTMLSelectElement {
  return screen.getByLabelText("Tipo de cartão") as HTMLSelectElement;
}

function escolherTipo(tipo: "frente-verso" | "imagem" | "audio") {
  fireEvent.change(seletor(), { target: { value: tipo } });
}

function campoDeAudio(): HTMLInputElement {
  return screen.getByLabelText("Áudio") as HTMLInputElement;
}

function escolherArquivo(arquivo: File) {
  fireEvent.change(campoDeAudio(), { target: { files: [arquivo] } });
}

function salvar() {
  fireEvent.submit(screen.getByLabelText("Verso").closest("form")!);
}

describe("seletor de Tipo de cartão com Áudio (FR-432)", () => {
  it("lista Frente-Verso, Imagem e Áudio, nesta ordem, e começa em Frente-Verso", () => {
    abrirCriacao();

    expect(seletor().value).toBe("frente-verso");
    expect(within(seletor()).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Frente-Verso",
      "Imagem",
      "Áudio",
    ]);
  });

  it("começa em Frente-Verso mesmo depois de escolher Áudio numa abertura anterior", async () => {
    const primeira = abrirCriacao();
    escolherTipo("audio");
    escolherArquivo(audio());
    await waitFor(() => expect(criarUrl).toHaveBeenCalled());

    // Uma nova abertura do formulário.
    primeira.unmount();
    abrirCriacao();

    expect(seletor().value).toBe("frente-verso");
  });

  it("escolher Áudio anuncia os campos do tipo e mostra Áudio, Mensagem e Verso", () => {
    abrirCriacao();

    escolherTipo("audio");

    expect(screen.getByText("Campos do tipo Áudio")).toBeInTheDocument();
    expect(campoDeAudio()).toBeInTheDocument();
    expect(campoDeAudio()).toHaveAttribute("accept", ACEITOS);
    expect(screen.getByText(AJUDA_DO_AUDIO)).toBeInTheDocument();
    expect(screen.getByLabelText("Mensagem (opcional)")).toBeInTheDocument();
    expect(screen.getByText(AJUDA_DA_MENSAGEM)).toBeInTheDocument();
    expect(screen.getByLabelText("Verso")).toBeInTheDocument();
    expect(screen.queryByLabelText("Frente")).not.toBeInTheDocument();
  });
});

describe("troca de tipo com Áudio (FR-433)", () => {
  it("mantém Frente/Mensagem/Texto da frente, Verso e Tags ao passar por Áudio e Imagem", () => {
    abrirCriacao();
    fireEvent.change(screen.getByLabelText("Frente"), { target: { value: "Qual cidade?" } });
    fireEvent.change(screen.getByLabelText("Verso"), { target: { value: "Recife" } });
    const tag = screen.getByPlaceholderText("Digite uma tag e pressione Enter");
    fireEvent.change(tag, { target: { value: "capitais" } });
    fireEvent.keyDown(tag, { key: "Enter" });

    escolherTipo("audio");
    expect(screen.getByLabelText("Mensagem (opcional)")).toHaveValue("Qual cidade?");
    expect(screen.getByLabelText("Verso")).toHaveValue("Recife");
    expect(screen.getByText("capitais")).toBeInTheDocument();

    escolherTipo("imagem");
    expect(screen.getByLabelText("Texto da frente (opcional)")).toHaveValue("Qual cidade?");
    expect(screen.getByLabelText("Verso")).toHaveValue("Recife");
    expect(screen.getByText("capitais")).toBeInTheDocument();
  });

  it("com um Áudio escolhido, trocar para Imagem pede confirmação com foco em Cancelar; Cancelar mantém tipo e arquivo", async () => {
    abrirCriacao();
    escolherTipo("audio");
    escolherArquivo(audio());

    escolherTipo("imagem");
    const dialogo = await screen.findByRole("dialog", { name: "Descartar o áudio?" });
    expect(
      within(dialogo).getByText("O áudio escolhido não existe no tipo Imagem e será descartado."),
    ).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Cancelar" })).toHaveFocus();

    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(seletor().value).toBe("audio");
    expect(screen.getByRole("button", { name: "Remover áudio" })).toBeInTheDocument();
    expect(seletor()).toHaveFocus();
  });

  it("confirmar o descarte troca o tipo e limpa o arquivo", async () => {
    abrirCriacao();
    escolherTipo("audio");
    escolherArquivo(audio());

    escolherTipo("imagem");
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Descartar áudio" }),
    );

    expect(seletor().value).toBe("imagem");
    expect(screen.queryByLabelText("Áudio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover áudio" })).not.toBeInTheDocument();
  });

  it("trocar de Imagem para Áudio com uma Imagem escolhida avisa com o nome do tipo de destino", async () => {
    abrirCriacao();
    escolherTipo("imagem");
    fireEvent.change(screen.getByLabelText("Imagem"), {
      target: { files: [new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "mapa.png", { type: "image/png" }) ] },
    });

    escolherTipo("audio");
    const dialogo = await screen.findByRole("dialog", { name: "Descartar a imagem?" });
    expect(
      within(dialogo).getByText("A imagem escolhida não existe no tipo Áudio e será descartada."),
    ).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(seletor().value).toBe("imagem");
  });
});

describe("campo de Áudio (FR-410, FR-438)", () => {
  it("mostra o tocador, o nome do arquivo, Trocar e Remover; Remover limpa o campo", () => {
    abrirCriacao();
    escolherTipo("audio");

    escolherArquivo(audio("mapa-sonoro.mp3"));

    expect(screen.getByRole("button", { name: "Tocar áudio" })).toBeInTheDocument();
    expect(screen.getByText("mapa-sonoro.mp3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar áudio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover áudio" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remover áudio" }));

    expect(screen.queryByRole("button", { name: "Tocar áudio" })).not.toBeInTheDocument();
    expect(screen.queryByText("mapa-sonoro.mp3")).not.toBeInTheDocument();
    expect(campoDeAudio()).toHaveFocus();
  });

  it("recusa um arquivo que não é áudio, com aria-invalid, foco no campo e os textos preservados", () => {
    abrirCriacao();
    escolherTipo("audio");
    fireEvent.change(screen.getByLabelText("Mensagem (opcional)"), { target: { value: "Pergunta" } });
    fireEvent.change(screen.getByLabelText("Verso"), { target: { value: "Recife" } });

    escolherArquivo(new File(["texto"], "notas.txt", { type: "text/plain" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "O arquivo não é um áudio MP3, M4A, OGG, WebM ou WAV.",
    );
    expect(campoDeAudio()).toHaveAttribute("aria-invalid", "true");
    expect(campoDeAudio()).toHaveFocus();
    expect(screen.getByLabelText("Mensagem (opcional)")).toHaveValue("Pergunta");
    expect(screen.getByLabelText("Verso")).toHaveValue("Recife");
    expect(screen.queryByRole("button", { name: "Remover áudio" })).not.toBeInTheDocument();
  });

  it("recusa um arquivo de 11 MB com a mensagem de tamanho", () => {
    abrirCriacao();
    escolherTipo("audio");
    const grande = audio("grande.mp3");
    Object.defineProperty(grande, "size", { value: 11 * 1024 * 1024 });

    escolherArquivo(grande);

    expect(screen.getByRole("alert")).toHaveTextContent("O áudio deve ter no máximo 10 MB.");
    expect(campoDeAudio()).toHaveAttribute("aria-invalid", "true");
    expect(campoDeAudio()).toHaveFocus();
  });

  it("recusa, pela duração lida no navegador, um áudio com mais de 5 minutos", async () => {
    duracaoDoAudio(301);
    abrirCriacao();
    escolherTipo("audio");
    fireEvent.change(screen.getByLabelText("Verso"), { target: { value: "Recife" } });

    escolherArquivo(audio("longo.mp3"));
    carregarMetadados();

    expect(await screen.findByRole("alert")).toHaveTextContent("O áudio deve ter no máximo 5 minutos.");
    expect(campoDeAudio()).toHaveAttribute("aria-invalid", "true");
    expect(campoDeAudio()).toHaveFocus();
    expect(screen.getByLabelText("Verso")).toHaveValue("Recife");
  });
});

describe("salvar o Cartão do tipo Áudio (FR-436, FR-457)", () => {
  it("anuncia o envio, cria o Cartão sem Mensagem e volta ao Baralho", async () => {
    abrirCriacao();
    escolherTipo("audio");
    escolherArquivo(audio());
    fireEvent.change(screen.getByLabelText("Verso"), { target: { value: "Recife" } });

    salvar();

    expect(screen.getByText("Enviando áudio…", { selector: "p" })).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe(`#/baralhos/${baralhoId}`));
    const baralho = await cliente.obterBaralho(baralhoId);
    expect(baralho.ok && baralho.baralho.cartoes).toEqual([
      expect.objectContaining({ tipo: "audio", frente: "", verso: "Recife" }),
    ]);
  });

  it("recusa do servidor (duração acima do limite): erro no campo de Áudio, com foco, e o tipo Áudio fica", async () => {
    abrirCriacao();
    escolherTipo("audio");
    fireEvent.change(screen.getByLabelText("Mensagem (opcional)"), { target: { value: "Pergunta" } });
    fireEvent.change(screen.getByLabelText("Verso"), { target: { value: "Recife" } });
    const longo = audio("longo.mp3");
    Object.defineProperty(longo, "duracaoDeTesteMs", { value: 300_001 });
    escolherArquivo(longo);

    salvar();

    expect(await screen.findByRole("alert")).toHaveTextContent("O áudio deve ter no máximo 5 minutos.");
    await waitFor(() => expect(campoDeAudio()).toHaveFocus());
    expect(campoDeAudio()).toHaveAttribute("aria-invalid", "true");
    expect(seletor().value).toBe("audio");
    expect(screen.getByLabelText("Verso")).toHaveValue("Recife");
    expect(screen.getByLabelText("Mensagem (opcional)")).toHaveValue("Pergunta");
  });

  it("recusa do servidor de formato (audio_invalido): a mensagem fica em #erro-do-audio, com aria-invalid e foco", async () => {
    abrirCriacao();
    escolherTipo("audio");
    fireEvent.change(screen.getByLabelText("Verso"), { target: { value: "Recife" } });
    escolherArquivo(audio());
    vi.spyOn(cliente, "criarCartao").mockResolvedValueOnce({
      ok: false,
      erro: "audio_invalido",
      motivo: "formato",
      mensagem: MENSAGENS_PT.formatoDeAudio,
    } as Awaited<ReturnType<typeof cliente.criarCartao>>);

    salvar();

    await waitFor(() => expect(campoDeAudio()).toHaveFocus());
    expect(document.querySelector("#erro-do-audio")).toHaveTextContent("MP3, M4A, OGG, WebM ou WAV");
    expect(campoDeAudio()).toHaveAttribute("aria-invalid", "true");
    expect(campoDeAudio().getAttribute("aria-describedby")).toContain("erro-do-audio");
    expect(screen.getByLabelText("Verso")).toHaveValue("Recife");
  });
});

describe("microfone (FR-440)", () => {
  it("o fluxo de escolher, ouvir e salvar nunca pede o microfone", async () => {
    abrirCriacao();
    escolherTipo("audio");
    escolherArquivo(audio());
    fireEvent.click(screen.getByRole("button", { name: "Tocar áudio" }));
    fireEvent.change(screen.getByLabelText("Verso"), { target: { value: "Recife" } });

    salvar();

    await waitFor(() => expect(window.location.hash).toBe(`#/baralhos/${baralhoId}`));
    expect(pedirMicrofone).not.toHaveBeenCalled();
  });
});

describe("teclado (FR-456)", () => {
  it("o fluxo do Áudio é feito por teclado, com o foco nos campos certos", () => {
    abrirCriacao();

    seletor().focus();
    escolherTipo("audio");
    expect(seletor()).toHaveFocus();

    campoDeAudio().focus();
    fireEvent.keyDown(campoDeAudio(), { key: "Enter" });
    escolherArquivo(audio());

    const trocar = screen.getByRole("button", { name: "Trocar áudio" });
    trocar.focus();
    fireEvent.keyDown(trocar, { key: " " });
    fireEvent.click(trocar);

    const remover = screen.getByRole("button", { name: "Remover áudio" });
    remover.focus();
    fireEvent.keyDown(remover, { key: "Enter" });
    fireEvent.click(remover);
    expect(campoDeAudio()).toHaveFocus();
  });
});

describe("troca de idioma (FR-458, FR-460)", () => {
  function BotaoDeTroca({ para }: { para: "pt" | "en" | "es" }) {
    const contexto = useContext(ContextoDeIdioma);
    if (contexto === null) throw new Error("sem provedor");
    return (
      <button type="button" onClick={() => contexto.escolher(para)}>
        trocar para {para}
      </button>
    );
  }

  it("em inglês, os rótulos e o anúncio mudam; o nome do arquivo e a Mensagem não mudam", () => {
    render(
      comProtecaoDeSaida(
        <ProvedorDeIdioma idiomaInicial="pt">
          <PaginaDoFormularioDeCartao cliente={cliente} baralhoId={baralhoId} />
          <BotaoDeTroca para="en" />
        </ProvedorDeIdioma>,
        true,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "trocar para en" }));

    const select = document.getElementById("campo-tipo") as HTMLSelectElement;
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Front and back",
      "Image",
      "Audio",
    ]);

    fireEvent.change(select, { target: { value: "audio" } });

    expect(screen.getByText("Audio card fields")).toBeInTheDocument();
    expect(screen.getByLabelText("Audio")).toBeInTheDocument();
    expect(screen.getByLabelText("Message (optional)")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Message (optional)"), { target: { value: "Which city?" } });
    fireEvent.change(screen.getByLabelText("Audio"), { target: { files: [audio("tide-song.mp3")] } });

    expect(screen.getByText("tide-song.mp3")).toBeInTheDocument();
    expect(screen.getByLabelText("Message (optional)")).toHaveValue("Which city?");
  });
});
