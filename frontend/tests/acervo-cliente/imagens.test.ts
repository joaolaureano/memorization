import { afterEach, describe, expect, it, vi } from "vitest";

import { ClienteEmMemoria } from "../../src/acervo-cliente/cliente-em-memoria";
import { ClienteHttp } from "../../src/acervo-cliente/cliente-http";

/**
 * T018 — `enviarImagem` e o Cartão do tipo Imagem nos dois Adapters do
 * `ClienteDoAcervo` (026, contracts/http.md, research R4).
 */

const API = "http://127.0.0.1:3001";
const CREDENCIAL = { nomeDeUsuario: "ana.silva", senha: "senha-de-prova-123" };

afterEach(() => {
  vi.unstubAllGlobals();
});

function png(tamanho = 32, nome = "mapa.png"): File {
  const bytes = new Uint8Array(tamanho);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], nome, { type: "image/png" });
}

function resposta(status: number, corpo?: unknown): Response {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ClienteEmMemoria.enviarImagem", () => {
  async function clienteQueEntrou(): Promise<ClienteEmMemoria> {
    return new ClienteEmMemoria(CREDENCIAL, [CREDENCIAL]);
  }

  it("recusa formato não aceito e arquivo acima de 5.242.880 B", async () => {
    const cliente = await clienteQueEntrou();

    expect(await cliente.enviarImagem(new File(["x"], "a.txt", { type: "text/plain" }))).toMatchObject({
      ok: false,
      erro: "formato",
    });
    expect(await cliente.enviarImagem(png(5_242_881))).toMatchObject({ ok: false, erro: "tamanho" });
    expect(await cliente.enviarImagem(png(5_242_880))).toMatchObject({ ok: true });
  });

  it("confirma no Cartão só o envio do próprio Usuário e pelo conteúdo real", async () => {
    const cliente = await clienteQueEntrou();
    const baralho = await cliente.criarBaralho({ nome: "Geografia" });
    if (!baralho.ok) throw new Error("baralho recusado");

    const falso = await cliente.enviarImagem(new File(["não sou png"], "falso.png", { type: "image/png" }));
    if (!falso.ok) throw new Error("envio recusado");

    expect(
      await cliente.criarCartao(baralho.baralho.id, { tipo: "imagem", imagemId: falso.imagemId, frente: "", verso: "V" }),
    ).toMatchObject({ ok: false, erro: "imagem_invalida", motivo: "formato" });
    expect(
      await cliente.criarCartao(baralho.baralho.id, { tipo: "imagem", imagemId: "img-alheia", frente: "", verso: "V" }),
    ).toMatchObject({ ok: false, erro: "imagem_invalida", motivo: "nao_encontrada" });
  });
});

describe("ClienteHttp.enviarImagem", () => {
  it("prepara na API e envia direto ao armazém, sem Credencial, com os campos e o arquivo", async () => {
    const chamadas: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      chamadas.push({ url, init });
      if (url === `${API}/imagens/envios`) {
        return resposta(201, {
          imagemId: "11111111-1111-4111-8111-111111111111",
          envio: { url: "https://s3.exemplo/bucket", campos: { key: "pendentes/u/x", Policy: "p" } },
          expiraEm: "2026-10-13T12:05:00.000Z",
        });
      }
      return new Response(null, { status: 204 });
    });

    const cliente = new ClienteHttp(API, CREDENCIAL);

    expect(await cliente.enviarImagem(png())).toEqual({
      ok: true,
      imagemId: "11111111-1111-4111-8111-111111111111",
    });
    expect(chamadas[0]!.init?.headers).toMatchObject({ authorization: expect.stringMatching(/^Basic /) });
    const envio = chamadas[1]!;
    expect(envio.url).toBe("https://s3.exemplo/bucket");
    expect(new Headers(envio.init?.headers).has("authorization")).toBe(false);
    const corpo = envio.init?.body as FormData;
    expect([...corpo.keys()]).toEqual(["key", "Policy", "file"]);
  });

  it("resolve o envio relativo do modo local contra a API e traduz o limite estourado em `tamanho`", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      return url.endsWith("/imagens/envios")
        ? resposta(201, {
            imagemId: "22222222-2222-4222-8222-222222222222",
            envio: { url: "/imagens-locais/envios?t=abc", campos: {} },
            expiraEm: "2026-10-13T12:05:00.000Z",
          })
        : resposta(413, { erro: "EntityTooLarge" });
    });

    expect(await new ClienteHttp(API, CREDENCIAL).enviarImagem(png())).toMatchObject({
      ok: false,
      erro: "tamanho",
    });
    expect(urls[1]).toBe(`${API}/imagens-locais/envios?t=abc`);
  });

  it("recusa no navegador o arquivo fora do formato, sem tocar a rede", async () => {
    const fetchDeTeste = vi.fn();
    vi.stubGlobal("fetch", fetchDeTeste);

    expect(
      await new ClienteHttp(API, CREDENCIAL).enviarImagem(new File(["x"], "a.txt", { type: "text/plain" })),
    ).toMatchObject({ ok: false, erro: "formato" });
    expect(fetchDeTeste).not.toHaveBeenCalled();
  });

  it("lê o tipo, resolve o endereço de exibição relativo e traduz `422 imagem_invalida`", async () => {
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const corpo = JSON.parse(String(init?.body ?? "{}")) as { tipo?: string };
      if (corpo.tipo === "imagem" && url.endsWith("/cartoes") && corpo && "imagemId" in corpo) {
        return (corpo as { imagemId: string }).imagemId === "ruim"
          ? resposta(422, { erro: "imagem_invalida", motivo: "formato", mensagem: "Não é imagem." })
          : resposta(201, {
              id: "c1",
              tipo: "imagem",
              frente: "",
              verso: "Pernambuco",
              imagem: { url: "/imagens-locais/arquivo?t=xyz", expiraEm: "2026-10-13T12:15:00.000Z" },
            });
      }
      return resposta(404, { erro: "nao_encontrado", mensagem: "?" });
    });
    const cliente = new ClienteHttp(API, CREDENCIAL);

    expect(
      await cliente.criarCartao("b1", { tipo: "imagem", imagemId: "bom", frente: "", verso: "Pernambuco" }),
    ).toEqual({
      ok: true,
      cartao: {
        id: "c1",
        tipo: "imagem",
        frente: "",
        verso: "Pernambuco",
        imagem: { url: `${API}/imagens-locais/arquivo?t=xyz`, expiraEm: "2026-10-13T12:15:00.000Z" },
      },
    });
    expect(
      await cliente.criarCartao("b1", { tipo: "imagem", imagemId: "ruim", frente: "", verso: "V" }),
    ).toEqual({ ok: false, erro: "imagem_invalida", motivo: "formato", mensagem: "Não é imagem." });
  });
});
