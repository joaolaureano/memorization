import { afterEach, describe, expect, it, vi } from "vitest";

import { ClienteEmMemoria } from "../../src/acervo-cliente/cliente-em-memoria";
import { ClienteHttp } from "../../src/acervo-cliente/cliente-http";
import { INDISPONIVEL, NAO_AUTENTICADO } from "../../src/acervo-cliente/cliente";

/**
 * `enviarAudio` e o Cartão do tipo Áudio nos dois Adapters do
 * `ClienteDoAcervo` (028, contracts/http.md, FR-436, FR-437). Espelha
 * `imagens.test.ts`.
 */

const API = "http://127.0.0.1:3001";
const CREDENCIAL = { nomeDeUsuario: "ana.silva", senha: "senha-de-prova-123" };

afterEach(() => {
  vi.unstubAllGlobals();
});

function wav(tamanho = 32, nome = "fala.wav", tipo = "audio/wav"): File {
  return new File([new Uint8Array(tamanho)], nome, { type: tipo });
}

function audioComDuracao(duracaoDeTesteMs: number): File {
  const arquivo = wav();
  Object.defineProperty(arquivo, "duracaoDeTesteMs", { value: duracaoDeTesteMs });
  return arquivo;
}

function resposta(status: number, corpo?: unknown): Response {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ClienteEmMemoria.enviarAudio", () => {
  async function clienteQueEntrou(): Promise<ClienteEmMemoria> {
    return new ClienteEmMemoria(CREDENCIAL, [CREDENCIAL]);
  }

  it("recusa formato não aceito e arquivo acima de 10.485.760 B", async () => {
    const cliente = await clienteQueEntrou();

    expect(await cliente.enviarAudio(new File(["x"], "a.txt", { type: "text/plain" }))).toMatchObject({
      ok: false,
      erro: "formato",
    });
    expect(await cliente.enviarAudio(wav(10_485_761))).toMatchObject({ ok: false, erro: "tamanho" });
    expect(await cliente.enviarAudio(wav(10_485_760))).toMatchObject({ ok: true });
  });

  it("aceita pela extensão quando o navegador não informa o tipo", async () => {
    const cliente = await clienteQueEntrou();

    expect(await cliente.enviarAudio(new File(["x"], "x.m4a", { type: "" }))).toMatchObject({ ok: true });
    expect(await cliente.enviarAudio(new File(["x"], "x.txt", { type: "" }))).toMatchObject({
      ok: false,
      erro: "formato",
    });
  });

  it("cria o Cartão de Áudio com a duração do envio, e recusa sem Áudio ou com duração acima do limite", async () => {
    const cliente = await clienteQueEntrou();
    const baralho = await cliente.criarBaralho({ nome: "Japonês" });
    if (!baralho.ok) throw new Error("baralho recusado");

    const enviado = await cliente.enviarAudio(wav());
    if (!enviado.ok) throw new Error("envio recusado");

    const criado = await cliente.criarCartao(baralho.baralho.id, {
      tipo: "audio",
      audioId: enviado.audioId,
      frente: "",
      verso: "Obrigado",
    });
    expect(criado).toMatchObject({ ok: true, cartao: { tipo: "audio", verso: "Obrigado" } });
    if (!criado.ok) throw new Error("cartão recusado");
    expect(typeof criado.cartao.duracaoMs).toBe("number");

    expect(
      await cliente.criarCartao(baralho.baralho.id, { tipo: "audio", frente: "", verso: "V" }),
    ).toMatchObject({ ok: false, erro: "audio_ausente" });

    const longo = await cliente.enviarAudio(audioComDuracao(300_001));
    if (!longo.ok) throw new Error("envio recusado");
    expect(
      await cliente.criarCartao(baralho.baralho.id, {
        tipo: "audio",
        audioId: longo.audioId,
        frente: "",
        verso: "V",
      }),
    ).toMatchObject({ ok: false, erro: "audio_invalido", motivo: "duracao" });
  });
});

describe("ClienteHttp.enviarAudio", () => {
  it("prepara na API e envia direto ao armazém, sem Credencial, com os campos e o arquivo", async () => {
    const chamadas: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      chamadas.push({ url, init });
      if (url === `${API}/audios/envios`) {
        return resposta(201, {
          audioId: "11111111-1111-4111-8111-111111111111",
          envio: { url: "https://s3.exemplo/bucket", campos: { key: "pendentes/u/x", Policy: "p" } },
          expiraEm: "2026-10-13T12:05:00.000Z",
          limiteEmBytes: 10485760,
          limiteEmSegundos: 300,
          formatos: ["audio/wav"],
        });
      }
      return new Response(null, { status: 204 });
    });

    expect(await new ClienteHttp(API, CREDENCIAL).enviarAudio(wav())).toEqual({
      ok: true,
      audioId: "11111111-1111-4111-8111-111111111111",
    });
    expect(chamadas[0]!.init?.headers).toMatchObject({ authorization: expect.stringMatching(/^Basic /) });
    const envio = chamadas[1]!;
    expect(envio.url).toBe("https://s3.exemplo/bucket");
    expect(new Headers(envio.init?.headers).has("authorization")).toBe(false);
    const corpo = envio.init?.body as FormData;
    expect([...corpo.keys()]).toEqual(["key", "Policy", "file"]);
  });

  it("recusa 401 na preparação como não autenticado", async () => {
    vi.stubGlobal("fetch", async () => resposta(401, { erro: "nao_autenticado", mensagem: "?" }));

    expect(await new ClienteHttp(API, CREDENCIAL).enviarAudio(wav())).toMatchObject({
      ok: false,
      erro: NAO_AUTENTICADO,
    });
  });

  it("traduz 500 na preparação em indisponibilidade", async () => {
    vi.stubGlobal("fetch", async () => resposta(500, { erro: "x", mensagem: "?" }));

    expect(await new ClienteHttp(API, CREDENCIAL).enviarAudio(wav())).toMatchObject({
      ok: false,
      erro: INDISPONIVEL,
    });
  });
});
