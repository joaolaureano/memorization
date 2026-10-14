import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { ProvedorDeIdioma } from "../src/idioma";
import type { ItemDeEstudo } from "../src/sessao-de-estudo/sessao-de-estudo";
import { AleatoriedadeDeterministica } from "../src/sessao-de-estudo/aleatoriedade";
import { PaginaDeEstudo } from "../src/ui/PaginaDeEstudo";
import { PaginaDoRegistro } from "../src/ui/PaginaDoRegistro";
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";
import { ResumoDaSessao } from "../src/ui/ResumoDaSessao";
import { FaceDaPergunta } from "../src/ui/tipos-de-cartao/FaceDaPergunta";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";

/**
 * T043 — o Cartão do tipo Áudio no Baralho, na Sessão e no Histórico (028;
 * FR-441, FR-442, FR-443, FR-444, FR-445, FR-447).
 *
 * O jsdom não toca áudio: `play` e `pause` são substituídos por mocks que
 * mudam `paused` e disparam os eventos que um navegador dispararia, como em
 * `tocador-de-audio.test.tsx`.
 */

let cliente: ClienteEmMemoria;
let baralhoId: string;
let pauseSpy: ReturnType<typeof vi.spyOn>;

function definirPausado(el: HTMLMediaElement, pausado: boolean) {
  Object.defineProperty(el, "paused", { value: pausado, configurable: true, writable: true });
}

beforeEach(async () => {
  cliente = clienteDeProva();
  const baralho = await cliente.criarBaralho({ nome: "Poesia" });
  if (!baralho.ok) throw new Error("Baralho de prova não criado");
  baralhoId = baralho.baralho.id;

  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    definirPausado(this, false);
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    definirPausado(this, true);
    this.dispatchEvent(new Event("pause"));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Um arquivo de Áudio de prova; a duração que a prova declara vale 4 s por padrão. */
function mp3(duracaoDeTesteMs = 4000): File {
  const arquivo = new File([new Uint8Array(64)], "poema.mp3", { type: "audio/mpeg" });
  Object.defineProperty(arquivo, "duracaoDeTesteMs", { value: duracaoDeTesteMs });
  return arquivo;
}

async function criarAudio(
  dados: { frente?: string; verso?: string; duracaoDeTesteMs?: number } = {},
) {
  const enviado = await cliente.enviarAudio(mp3(dados.duracaoDeTesteMs));
  if (!enviado.ok) throw new Error("envio recusado");
  const criado = await cliente.criarCartao(baralhoId, {
    tipo: "audio",
    audioId: enviado.audioId,
    frente: dados.frente ?? "",
    verso: dados.verso ?? "Camões",
  });
  if (!criado.ok) throw new Error("criação recusada");
  return criado.cartao;
}

async function criarFrenteVerso(frente: string, verso: string) {
  const criado = await cliente.criarCartao(baralhoId, { frente, verso });
  if (!criado.ok) throw new Error("criação recusada");
  return criado.cartao;
}

async function abrirBaralho(idioma: "pt" | "en" = "pt") {
  render(
    <ProvedorDeIdioma idiomaInicial={idioma}>
      {comProtecaoDeSaida(<PaginaDoBaralho cliente={cliente} id={baralhoId} />)}
    </ProvedorDeIdioma>,
  );
  await screen.findByRole("heading", { level: 1, name: "Poesia" });
}

function iniciarSessao(idioma: "pt" | "en" = "pt") {
  render(
    <ProvedorDeIdioma idiomaInicial={idioma}>
      {comProtecaoDeSaida(
        <PaginaDeEstudo
          cliente={cliente}
          id={baralhoId}
          aleatoriedade={new AleatoriedadeDeterministica([0, 0, 0, 0])}
        />,
      )}
    </ProvedorDeIdioma>,
  );
}

async function iniciarTodosOsCartoes() {
  fireEvent.click(await screen.findByRole("button", { name: "Todos os cartões" }));
}

describe("detalhe do Baralho (FR-441, FR-445)", () => {
  it("rotula o tipo Áudio, mostra o tocador, a duração falada e a Mensagem e o Verso", async () => {
    await criarAudio({ frente: "Quem escreveu o poema?", verso: "Camões" });

    await abrirBaralho();

    const cartoes = within(screen.getByRole("region", { name: "Cartões do Baralho" }));
    expect(cartoes.getByText("Áudio")).toBeInTheDocument();
    expect(cartoes.getByRole("button", { name: "Tocar áudio" })).toBeInTheDocument();
    expect(cartoes.getByText("0:04")).toBeInTheDocument();
    expect(cartoes.getByRole("img", { name: "Duração: 4 segundos" })).toHaveTextContent("0:04");
    expect(cartoes.getByText("Quem escreveu o poema?")).toBeInTheDocument();
    expect(cartoes.getByText("Camões")).toBeInTheDocument();
  });

  it("não mostra a Mensagem quando ela está vazia", async () => {
    await criarAudio({ frente: "", verso: "Camões" });

    await abrirBaralho();

    expect(screen.getByRole("button", { name: "Tocar áudio" })).toBeInTheDocument();
    expect(document.querySelector(".linha-da-lista__titulo")).toBeNull();
    expect(screen.getByText("Camões")).toBeInTheDocument();
  });

  it("o filtro de Tipo oferece Áudio, mostra só os Cartões de Áudio e \"Todos\" restaura", async () => {
    await criarFrenteVerso("To walk", "Caminhar");
    await criarAudio({ frente: "Quem escreveu o poema?", verso: "Camões" });
    await abrirBaralho();
    const filtro = screen.getByLabelText("Tipo de cartão");

    expect(within(filtro).getByRole("option", { name: "Áudio" })).toBeInTheDocument();

    fireEvent.change(filtro, { target: { value: "audio" } });
    expect(screen.getByText("Quem escreveu o poema?")).toBeInTheDocument();
    expect(screen.queryByText("To walk")).not.toBeInTheDocument();

    fireEvent.change(filtro, { target: { value: "todos" } });
    expect(screen.getByText("To walk")).toBeInTheDocument();
    expect(screen.getByText("Quem escreveu o poema?")).toBeInTheDocument();
  });

  it("encontra o Cartão de Áudio pela Mensagem e pelo Verso", async () => {
    await criarFrenteVerso("To walk", "Caminhar");
    await criarAudio({ frente: "Quem escreveu o poema?", verso: "Camões" });
    await abrirBaralho();
    const busca = screen.getByLabelText("Buscar Cartões");

    fireEvent.change(busca, { target: { value: "poema" } });
    expect(screen.getByRole("button", { name: "Tocar áudio" })).toBeInTheDocument();
    expect(screen.queryByText("To walk")).not.toBeInTheDocument();

    fireEvent.change(busca, { target: { value: "camões" } });
    expect(screen.getByRole("button", { name: "Tocar áudio" })).toBeInTheDocument();
    expect(screen.queryByText("To walk")).not.toBeInTheDocument();
  });

  it("em inglês, rotula Audio, nomeia o botão Play audio e fala a duração em inglês", async () => {
    await criarAudio({ frente: "Who wrote the poem?", verso: "Camões" });

    await abrirBaralho("en");

    const cartoes = within(screen.getByRole("region", { name: "Deck cards" }));
    expect(cartoes.getByText("Audio")).toBeInTheDocument();
    expect(cartoes.getByRole("button", { name: "Play audio" })).toBeInTheDocument();
    expect(cartoes.getByRole("img", { name: "Duration: 4 seconds" })).toHaveTextContent("0:04");
  });
});

describe("Sessão de estudo (FR-442, FR-443, FR-444)", () => {
  it("mostra a Mensagem e o tocador antes da revelação, e o Verso só depois, com o tocador ainda lá", async () => {
    await criarAudio({ frente: "Quem escreveu o poema?", verso: "Camões" });
    iniciarSessao();
    await iniciarTodosOsCartoes();

    const artigo = await screen.findByRole("article");
    expect(within(artigo).getByText("Quem escreveu o poema?")).toBeInTheDocument();
    expect(within(artigo).getByRole("button", { name: "Tocar áudio" })).toBeInTheDocument();
    expect(within(artigo).queryByText("Camões")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));

    expect(await within(artigo).findByText("Camões")).toBeInTheDocument();
    expect(within(artigo).getByRole("button", { name: "Tocar áudio" })).toBeInTheDocument();
  });

  it("tocar e revelar não pausa o Áudio", async () => {
    await criarAudio({ frente: "Quem escreveu o poema?", verso: "Camões" });
    iniciarSessao();
    await iniciarTodosOsCartoes();

    fireEvent.click(await screen.findByRole("button", { name: "Tocar áudio" }));
    await screen.findByRole("button", { name: "Pausar áudio" });
    const pausasAntesDaRevelacao = pauseSpy.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    await screen.findByRole("heading", { name: "Verso" });

    expect(pauseSpy).toHaveBeenCalledTimes(pausasAntesDaRevelacao);
    expect(screen.getByRole("button", { name: "Pausar áudio" })).toBeInTheDocument();
  });

  it("avaliar e passar ao próximo Item pausa o Áudio que tocava", async () => {
    await criarAudio({ frente: "Primeira", verso: "Um" });
    await criarAudio({ frente: "Segunda", verso: "Dois" });
    iniciarSessao();
    await iniciarTodosOsCartoes();

    await screen.findByRole("article", { name: "Item 1 de 2" });
    fireEvent.click(screen.getByRole("button", { name: "Tocar áudio" }));
    await screen.findByRole("button", { name: "Pausar áudio" });
    const pausasAntesDaAvaliacao = pauseSpy.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    fireEvent.click(await screen.findByRole("button", { name: /Bom/ }));

    await screen.findByRole("article", { name: "Item 2 de 2" });
    expect(pauseSpy.mock.calls.length).toBeGreaterThan(pausasAntesDaAvaliacao);
    expect(screen.getByRole("button", { name: "Tocar áudio" })).toBeInTheDocument();
  });

  it("um Item seguinte com o mesmo Cartão, depois do Áudio tocado, começa parado (remontagem pela posição)", async () => {
    // A Sessão não repete um Cartão (ela deduplica a entrada), então o caso
    // de Cartão repetido é provado na face, com o mesmo `cartaoId` em duas
    // posições seguidas.
    const item: ItemDeEstudo = {
      cartaoId: "cartao-repetido",
      frente: "Quem escreveu o poema?",
      revelado: false,
      verso: null,
      avaliacao: null,
      resultado: null,
      tipo: "audio",
      audio: { url: "memoria://audios/aud1", expiraEm: new Date(Date.now() + 900_000).toISOString() },
      duracaoMs: 4000,
    };
    const { rerender } = render(
      <ProvedorDeIdioma idiomaInicial="pt">
        <FaceDaPergunta item={item} posicao={1} />
      </ProvedorDeIdioma>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tocar áudio" }));
    await screen.findByRole("button", { name: "Pausar áudio" });
    const pausasAntesDoProximo = pauseSpy.mock.calls.length;

    rerender(
      <ProvedorDeIdioma idiomaInicial="pt">
        <FaceDaPergunta item={item} posicao={2} />
      </ProvedorDeIdioma>,
    );

    expect(pauseSpy.mock.calls.length).toBeGreaterThan(pausasAntesDoProximo);
    expect(screen.getByRole("button", { name: "Tocar áudio" })).toBeInTheDocument();
  });

  it("com o Áudio indisponível, mantém a Mensagem e deixa avaliar", async () => {
    await criarAudio({ frente: "Quem escreveu o poema?", verso: "Camões" });
    const listar = cliente.listarCartoes.bind(cliente);
    vi.spyOn(cliente, "listarCartoes").mockImplementation(async () => {
      const resultado = await listar();
      if (!resultado.ok) return resultado;
      return { ...resultado, cartoes: resultado.cartoes.map((cartao) => ({ ...cartao, audio: null })) };
    });
    const registrar = vi.spyOn(cliente, "registrarSessao");
    iniciarSessao();
    await iniciarTodosOsCartoes();

    const artigo = await screen.findByRole("article");
    expect(await within(artigo).findByText("Áudio indisponível")).toBeInTheDocument();
    expect(within(artigo).getByText("Quem escreveu o poema?")).toBeInTheDocument();
    expect(within(artigo).queryByRole("button", { name: "Tocar áudio" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    fireEvent.click(await screen.findByRole("button", { name: /Bom/ }));

    await waitFor(() => expect(registrar).toHaveBeenCalled());
  });
});

describe("Histórico (FR-447)", () => {
  it("rotula o Cartão de Áudio com a Mensagem, sem player", async () => {
    render(
      <ResumoDaSessao
        itens={[
          { tipo: "audio", frente: "Quem escreveu o poema?", verso: "Camões", resultado: "acertou", avaliacao: "bom" },
        ]}
      />,
    );

    expect(screen.getByText("Cartão do tipo Áudio")).toBeInTheDocument();
    expect(screen.getByText(/Quem escreveu o poema\?/)).toBeInTheDocument();
    expect(screen.getByText("Camões")).toBeInTheDocument();
    expect(document.querySelector("audio")).toBeNull();
  });

  it("mostra \"sem mensagem\" quando a Mensagem está vazia", () => {
    render(
      <ResumoDaSessao
        itens={[{ tipo: "audio", frente: "", verso: "Camões", resultado: "acertou", avaliacao: "bom" }]}
      />,
    );

    expect(screen.getByText("Cartão do tipo Áudio")).toBeInTheDocument();
    expect(screen.getByText(/sem mensagem/)).toBeInTheDocument();
    expect(document.querySelector("audio")).toBeNull();
  });
});

describe("Estudo até o Registro (FR-447)", () => {
  it("estuda o Cartão de Áudio até o fim e o Registro mostra o tipo Áudio", async () => {
    const registrar = vi.spyOn(cliente, "registrarSessao");
    await criarAudio({ frente: "Quem escreveu o poema?", verso: "Camões" });
    iniciarSessao();
    await iniciarTodosOsCartoes();

    fireEvent.click(await screen.findByRole("button", { name: "Revelar verso" }));
    fireEvent.click(await screen.findByRole("button", { name: /Bom/ }));

    await waitFor(() => expect(registrar).toHaveBeenCalled());
    const dados = registrar.mock.calls[0]![0];
    expect(dados.itens.map((item) => item.tipo)).toEqual(["audio"]);

    const registro = render(<PaginaDoRegistro cliente={cliente} id={dados.id} />);
    const pagina = within(registro.container);

    expect(await pagina.findByRole("heading", { name: "Sessão concluída" })).toBeInTheDocument();
    expect(pagina.getByText("Cartão do tipo Áudio")).toBeInTheDocument();
    expect(registro.container.querySelector("audio")).toBeNull();
  });
});
