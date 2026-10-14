import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContext, type ReactElement } from "react";

import { AudioDoCartao } from "../src/ui/tipos-de-cartao/AudioDoCartao";
import { ContextoDeIdioma, ProvedorDeIdioma } from "../src/idioma";

/**
 * O tocador próprio de um Cartão do tipo Áudio (028, FR-441, FR-443, FR-444,
 * FR-456, FR-458; research R7).
 *
 * O jsdom não reproduz áudio: `play` e `pause` são substituídos por mocks que
 * mudam `paused` e disparam os eventos que um navegador dispararia.
 */

let playSpy: ReturnType<typeof vi.spyOn>;
let pauseSpy: ReturnType<typeof vi.spyOn>;

/** Define o estado de reprodução e a posição de um elemento, como um navegador. */
function preparar(el: HTMLMediaElement, duracaoSegundos?: number) {
  Object.defineProperty(el, "paused", { value: true, configurable: true, writable: true });
  Object.defineProperty(el, "currentTime", { value: 0, configurable: true, writable: true });
  if (duracaoSegundos !== undefined) {
    Object.defineProperty(el, "duration", { value: duracaoSegundos, configurable: true });
  }
}

function audioDe(container: HTMLElement): HTMLMediaElement {
  const el = container.querySelector("audio");
  if (!el) throw new Error("audio não renderizado");
  return el;
}

function prepararTodos(container: HTMLElement, duracaoSegundos?: number) {
  container.querySelectorAll("audio").forEach((el) => preparar(el, duracaoSegundos));
}

beforeEach(() => {
  playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    Object.defineProperty(this, "paused", { value: false, configurable: true, writable: true });
    return Promise.resolve().then(() => {
      this.dispatchEvent(new Event("play"));
    });
  });
  pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    Object.defineProperty(this, "paused", { value: true, configurable: true, writable: true });
    this.dispatchEvent(new Event("pause"));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Troca o idioma pela mesma API que o seletor usa. */
function BotaoDeTroca({ para }: { para: "pt" | "en" | "es" }) {
  const contexto = useContext(ContextoDeIdioma);
  if (contexto === null) throw new Error("sem provedor");
  return (
    <button type="button" onClick={() => contexto.escolher(para)}>
      trocar para {para}
    </button>
  );
}

function comIdioma(ui: ReactElement, idioma: "pt" | "en" | "es" = "pt") {
  return (
    <ProvedorDeIdioma idiomaInicial={idioma}>
      {ui}
      <BotaoDeTroca para="en" />
    </ProvedorDeIdioma>
  );
}

const URL = "https://midia.exemplo/audio-1.mp3";

describe("tocador de Áudio (028)", () => {
  it("nunca toca sozinho: sem autoplay, com metadados no carregamento, sem controles nativos", () => {
    const { container } = render(
      comIdioma(<AudioDoCartao url={URL} duracaoMs={64000} variante="compacto" />),
    );
    const el = audioDe(container);

    expect(el).not.toHaveAttribute("autoplay");
    expect(el).not.toHaveAttribute("controls");
    expect(el).toHaveAttribute("preload", "metadata");
    expect(playSpy).not.toHaveBeenCalled();
  });

  it("alterna o nome do botão e anuncia o estado pela região de status", async () => {
    const { container } = render(
      comIdioma(<AudioDoCartao url={URL} duracaoMs={64000} variante="compacto" />),
    );
    prepararTodos(container, 64);
    const botao = screen.getByRole("button", { name: "Tocar áudio" });

    expect(botao).not.toHaveAttribute("aria-pressed");
    expect(screen.getByRole("status")).toHaveTextContent("");

    fireEvent.click(botao);
    await screen.findByRole("button", { name: "Pausar áudio" });
    expect(screen.getByRole("status")).toHaveTextContent("Tocando");

    fireEvent.click(screen.getByRole("button", { name: "Pausar áudio" }));
    await screen.findByRole("button", { name: "Tocar áudio" });
    expect(screen.getByRole("status")).toHaveTextContent("Pausado");

    fireEvent.click(screen.getByRole("button", { name: "Tocar áudio" }));
    await screen.findByRole("button", { name: "Pausar áudio" });
    fireEvent(audioDe(container), new Event("ended"));
    expect(screen.getByRole("status")).toHaveTextContent("Fim do áudio");
    expect(screen.getByRole("button", { name: "Tocar áudio" })).toBeInTheDocument();
  });

  it("posição é um controle deslizante com valor falado e setas, Home e End", () => {
    const { container } = render(
      comIdioma(<AudioDoCartao url={URL} duracaoMs={64000} variante="face" />),
    );
    prepararTodos(container, 64);
    const posicao = screen.getByRole("slider", { name: "Posição do áudio" });
    const el = audioDe(container);

    expect(posicao).toHaveAttribute("aria-valuetext", "0 segundo de 1 minuto e 4 segundos");

    fireEvent.keyDown(posicao, { key: "ArrowRight" });
    expect(el.currentTime).toBe(5);

    fireEvent.keyDown(posicao, { key: "End" });
    expect(el.currentTime).toBe(64);

    fireEvent.keyDown(posicao, { key: "Home" });
    expect(el.currentTime).toBe(0);
  });

  it("mostra o tempo visível em m:ss com o total da duração", () => {
    const { container } = render(
      comIdioma(<AudioDoCartao url={URL} duracaoMs={64000} variante="compacto" />),
    );
    prepararTodos(container, 64);

    expect(container.querySelector(".tocador__tempo")).toHaveTextContent("0:00 / 1:04");
  });

  it("tocar um Áudio pausa o anterior", async () => {
    const { container } = render(
      comIdioma(
        <>
          <AudioDoCartao url={URL} duracaoMs={64000} variante="compacto" />
          <AudioDoCartao url={"https://midia.exemplo/audio-2.mp3"} duracaoMs={64000} variante="compacto" />
        </>,
      ),
    );
    prepararTodos(container, 64);
    const [primeiro, segundo] = Array.from(container.querySelectorAll("audio"));
    const pausaDoPrimeiro = vi.spyOn(primeiro, "pause");

    const botoes = screen.getAllByRole("button", { name: "Tocar áudio" });
    fireEvent.click(botoes[0]);
    await waitFor(() => expect(primeiro.paused).toBe(false));

    fireEvent.click(botoes[1]);
    await waitFor(() => expect(segundo.paused).toBe(false));
    expect(pausaDoPrimeiro).toHaveBeenCalled();
    expect(primeiro.paused).toBe(true);
  });

  it("desmontar o componente pausa o Áudio", async () => {
    const { container, unmount } = render(
      comIdioma(<AudioDoCartao url={URL} duracaoMs={64000} variante="compacto" />),
    );
    prepararTodos(container, 64);
    fireEvent.click(screen.getByRole("button", { name: "Tocar áudio" }));
    await screen.findByRole("button", { name: "Pausar áudio" });
    const el = audioDe(container);
    const pausaAoDesmontar = vi.spyOn(el, "pause");

    unmount();

    expect(pausaAoDesmontar).toHaveBeenCalled();
  });

  it("erro com renovar pede um endereço novo uma vez e usa o novo", async () => {
    const renovar = vi.fn().mockResolvedValue("https://midia.exemplo/audio-novo.mp3");
    const { container } = render(
      comIdioma(
        <AudioDoCartao url={URL} duracaoMs={64000} variante="compacto" renovar={renovar} />,
      ),
    );

    fireEvent.error(audioDe(container));
    await waitFor(() =>
      expect(audioDe(container)).toHaveAttribute("src", "https://midia.exemplo/audio-novo.mp3"),
    );
    expect(renovar).toHaveBeenCalledTimes(1);

    fireEvent.error(audioDe(container));
    expect(await screen.findByText("Áudio indisponível")).toBeInTheDocument();
    expect(renovar).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".tocador__botao")).not.toBeInTheDocument();
    expect(container.querySelector("audio")).not.toBeInTheDocument();
  });

  it("sem endereço, mostra Áudio indisponível no lugar do tocador", () => {
    const { container } = render(
      comIdioma(<AudioDoCartao url={null} duracaoMs={64000} variante="compacto" />),
    );

    expect(screen.getByText("Áudio indisponível")).toBeInTheDocument();
    expect(container.querySelector(".tocador__botao")).not.toBeInTheDocument();
    expect(container.querySelector("audio")).not.toBeInTheDocument();
  });

  it("trocar o idioma no meio da reprodução mantém o Áudio tocando", async () => {
    const { container } = render(
      comIdioma(<AudioDoCartao url={URL} duracaoMs={64000} variante="compacto" />),
    );
    prepararTodos(container, 64);
    fireEvent.click(screen.getByRole("button", { name: "Tocar áudio" }));
    await screen.findByRole("button", { name: "Pausar áudio" });
    const el = audioDe(container);
    expect(el.paused).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "trocar para en" }));

    expect(await screen.findByRole("button", { name: "Pause audio" })).toBeInTheDocument();
    expect(pauseSpy).not.toHaveBeenCalled();
    expect(el.paused).toBe(false);
  });

  it("o botão é alcançável pelo teclado e alterna com Enter e com Espaço", async () => {
    render(comIdioma(<AudioDoCartao url={URL} duracaoMs={64000} variante="compacto" />));
    const botao = screen.getByRole("button", { name: "Tocar áudio" });

    // Um <button> nativo entra na ordem de Tab; o navegador dispara o clique
    // com Enter e com Espaço. O jsdom não faz isso, então o clique é simulado
    // depois de cada tecla, como nas outras provas de teclado do projeto.
    expect(botao.tabIndex).toBeGreaterThanOrEqual(0);
    botao.focus();
    expect(document.activeElement).toBe(botao);

    fireEvent.keyDown(botao, { key: "Enter" });
    fireEvent.click(botao);
    await screen.findByRole("button", { name: "Pausar áudio" });

    fireEvent.keyDown(botao, { key: " " });
    fireEvent.click(botao);
    await screen.findByRole("button", { name: "Tocar áudio" });
  });
});
