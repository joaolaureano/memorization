import { afterEach, describe, expect, it, vi } from "vitest";

import { ClienteHttp } from "../../src/acervo-cliente/cliente-http";
import type { DadosDeRegistro } from "../../src/acervo-cliente/cliente";

/**
 * 028 — o Cartão do tipo Áudio atravessa o `ClienteHttp` como o Cartão do tipo
 * Imagem: leitura do tipo, da duração e do endereço de reprodução (B1), o
 * endereço resolvido contra a API (B2) e o tipo do Item enviado à Sessão (B3).
 * Espelha `imagens.test.ts`: `fetch` mockado, sem servidor.
 */

const API = "http://127.0.0.1:3001";
const CREDENCIAL = { nomeDeUsuario: "ana.silva", senha: "senha-de-prova-123" };
const CARTAO_DE_AUDIO = "22222222-2222-4222-8222-222222222222";
const CARTAO_DE_IMAGEM = "33333333-3333-4333-8333-333333333333";

afterEach(() => {
  vi.unstubAllGlobals();
});

function resposta(status: number, corpo?: unknown): Response {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function baralhoComCartoes(cartoes: unknown[]): unknown {
  return {
    id: "b1",
    nome: "Idiomas",
    elegivel: true,
    quantidadeDeAgendamentos: 0,
    cartoes,
  };
}

function cartaoDeAudio(url: string): unknown {
  return {
    id: CARTAO_DE_AUDIO,
    frente: "Bonjour",
    verso: "Olá",
    tipo: "audio",
    audio: { url, expiraEm: "2026-10-14T12:05:00.000Z" },
    duracaoMs: 4200,
  };
}

describe("ClienteHttp.obterBaralho — Cartão do tipo Áudio (B1, B2)", () => {
  it("lê tipo, duracaoMs e o endereço de reprodução do Áudio", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        resposta(
          200,
          baralhoComCartoes([cartaoDeAudio(`${API}/midia-local/fala.wav?t=x`)]),
        ),
    );

    const cliente = new ClienteHttp(API, CREDENCIAL);
    const resultado = await cliente.obterBaralho("b1");

    if (!resultado.ok) throw new Error("baralho recusado");
    expect(resultado.baralho.cartoes[0]).toMatchObject({
      id: CARTAO_DE_AUDIO,
      tipo: "audio",
      duracaoMs: 4200,
      audio: { url: `${API}/midia-local/fala.wav?t=x`, expiraEm: "2026-10-14T12:05:00.000Z" },
    });
  });

  it("resolve o endereço relativo do Áudio contra a API, como faz com a Imagem", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        resposta(
          200,
          baralhoComCartoes([
            cartaoDeAudio("/midia-local/arquivo?t=x"),
            {
              id: CARTAO_DE_IMAGEM,
              frente: "",
              verso: "Mapa",
              tipo: "imagem",
              imagem: { url: "/midia-local/mapa?t=y", expiraEm: "2026-10-14T12:05:00.000Z" },
            },
          ]),
        ),
    );

    const cliente = new ClienteHttp(API, CREDENCIAL);
    const resultado = await cliente.obterBaralho("b1");

    if (!resultado.ok) throw new Error("baralho recusado");
    const [audio, imagem] = resultado.baralho.cartoes;
    expect(audio?.audio?.url).toBe(`${API}/midia-local/arquivo?t=x`);
    expect(imagem?.imagem?.url).toBe(`${API}/midia-local/mapa?t=y`);
  });
});

describe("ClienteHttp.registrarSessao — tipo dos Itens (B3)", () => {
  it("envia o tipo do Item de Imagem e de Áudio no corpo do POST /sessoes", async () => {
    const chamadas: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      chamadas.push({ url, init });
      return resposta(201, {
        id: "s1",
        origem: "baralho",
        baralhoId: "b1",
        nomeDoBaralho: "Idiomas",
        concluidaEm: "2026-10-14T12:00:00.000Z",
        itens: [],
      });
    });

    const dados: DadosDeRegistro = {
      id: "s1",
      origem: "baralho",
      baralhoId: "b1",
      nomeDoBaralho: "Idiomas",
      itens: [
        { tipo: "imagem", frente: "", verso: "Mapa", cartaoId: CARTAO_DE_IMAGEM, avaliacao: "bom" },
        { tipo: "audio", frente: "Bonjour", verso: "Olá", cartaoId: CARTAO_DE_AUDIO, avaliacao: "errei" },
        { frente: "Hi", verso: "Oi", cartaoId: "44444444-4444-4444-8444-444444444444", avaliacao: "bom" },
      ],
    };

    const cliente = new ClienteHttp(API, CREDENCIAL);
    await cliente.registrarSessao(dados);

    const corpo = JSON.parse(String(chamadas[0]?.init?.body));
    expect(corpo.itens[0]).toMatchObject({ tipo: "imagem", cartaoId: CARTAO_DE_IMAGEM });
    expect(corpo.itens[1]).toMatchObject({ tipo: "audio", cartaoId: CARTAO_DE_AUDIO });
    expect(corpo.itens[2]).not.toHaveProperty("tipo");
  });
});
