import { mkdtempSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { InjectOptions } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registrarRotasDeMidiaLocal } from "../../src/http/midia-local.ts";
import {
  registrarRotasDeAudios,
  registrarRotasDeBaralhos,
  registrarRotasDeCartoes,
  registrarRotasDeConta,
  registrarRotasDeSessoes,
} from "../../src/http/rotas.ts";
import { criarArmazemEmDisco } from "../../src/midia/armazem-em-disco.ts";
import { amostraWav } from "../midia/amostras-de-audio/wav.ts";
import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";
import type { CredencialDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/**
 * T029 — o contrato HTTP do Cartão com Áudio (`028`, contracts/http.md), com o
 * armazém em Disco e as rotas locais de envio e de leitura: o mesmo caminho
 * que o navegador faz no modo local.
 */

let contrato: ServidorDeContrato;
let pasta: string;

beforeEach(async () => {
  pasta = mkdtempSync(join(tmpdir(), "http-audios-"));
  const audios = criarArmazemEmDisco({ pasta });
  contrato = await montarServidorDeContrato(
    ({ servidor, acervoDe, identidade, acessos }) => {
      registrarRotasDeCartoes(servidor, acervoDe);
      registrarRotasDeBaralhos(servidor, acervoDe);
      registrarRotasDeSessoes(servidor, acervoDe);
      registrarRotasDeConta(servidor, identidade, acessos);
      registrarRotasDeAudios(servidor, audios);
      registrarRotasDeMidiaLocal(servidor, audios);
    },
    {},
    {},
    { imagens: audios },
  );
});

afterEach(async () => {
  await contrato.encerrar();
});

function pedir(requisicao: InjectOptions, credencial = contrato.credencial) {
  return pedirComCredencial(contrato.servidor, credencial, requisicao);
}

/** Corpo `multipart/form-data` com os campos e o arquivo, como o navegador. */
function multipart(
  campos: Record<string, string>,
  arquivo: Uint8Array,
  nomeDoArquivo = "a.wav",
  tipo = "audio/wav",
) {
  const fronteira = "fronteira-de-teste";
  const partes = [
    ...Object.entries(campos).map(
      ([nome, valor]) =>
        `--${fronteira}\r\nContent-Disposition: form-data; name="${nome}"\r\n\r\n${valor}\r\n`,
    ),
    `--${fronteira}\r\nContent-Disposition: form-data; name="file"; filename="${nomeDoArquivo}"\r\nContent-Type: ${tipo}\r\n\r\n`,
  ];
  return {
    payload: Buffer.concat([
      Buffer.from(partes.join("")),
      Buffer.from(arquivo),
      Buffer.from(`\r\n--${fronteira}--\r\n`),
    ]),
    headers: { "content-type": `multipart/form-data; boundary=${fronteira}` },
  };
}

/** Prepara e faz o envio de um Áudio; devolve o `audioId`. */
async function enviar(
  bytes = amostraWav({ segundos: 1 }),
  credencial: CredencialDeTeste = contrato.credencial,
  nomeDoArquivo = "a.wav",
): Promise<string> {
  const preparado = await pedir({ method: "POST", url: "/audios/envios" }, credencial);
  expect(preparado.statusCode).toBe(201);
  const envio = preparado.json() as {
    audioId: string;
    envio: { url: string; campos: Record<string, string> };
  };
  // O envio local não leva Credencial: quem autoriza é o token do caminho.
  const resposta = await contrato.servidor.inject({
    method: "POST",
    url: envio.envio.url,
    ...multipart(envio.envio.campos, bytes, nomeDoArquivo),
  });
  expect(resposta.statusCode).toBe(204);
  return envio.audioId;
}

async function criarBaralho(credencial = contrato.credencial): Promise<string> {
  const resposta = await pedir({ method: "POST", url: "/baralhos", payload: { nome: "Japonês" } }, credencial);
  return (resposta.json() as { id: string }).id;
}

/** Lê o Áudio pelo endereço de reprodução, sem Credencial — como o `<audio>`. */
async function lerAudio(url: string) {
  return contrato.servidor.inject({ method: "GET", url });
}

describe("POST /audios/envios", () => {
  it("exige Entrar e devolve a forma do contrato", async () => {
    expect(
      (await contrato.servidor.inject({ method: "POST", url: "/audios/envios" })).statusCode,
    ).toBe(401);

    const resposta = await pedir({ method: "POST", url: "/audios/envios" });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toEqual({
      audioId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      envio: { url: expect.stringMatching(/^\/midia-local\/envios\?t=/), campos: {} },
      expiraEm: expect.any(String),
      limiteEmBytes: 10_485_760,
      limiteEmSegundos: 300,
      formatos: ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/webm", "audio/wav"],
    });
  });
});

describe("POST /baralhos/{id}/cartoes com tipo audio (FR-434, FR-435, FR-436)", () => {
  it("cria Áudio com duração e endereço, e o Áudio toca sem Credencial", async () => {
    const baralhoId = await criarBaralho();

    const criado = await pedir({
      method: "POST",
      url: `/baralhos/${baralhoId}/cartoes`,
      payload: { tipo: "audio", audioId: await enviar(), frente: "", verso: "Obrigado", tags: [] },
    });
    expect(criado.statusCode).toBe(201);
    const cartao = criado.json() as { tipo: string; duracaoMs: number; audio: { url: string } };
    expect(cartao).toMatchObject({ tipo: "audio", duracaoMs: 1000, audio: { url: expect.any(String) } });
    expect(JSON.stringify(cartao)).not.toContain("audioChave");

    expect((await lerAudio(cartao.audio.url)).statusCode).toBe(200);
  });

  it("responde 400 audio_ausente quando o tipo audio não traz audioId", async () => {
    const baralhoId = await criarBaralho();

    const ausente = await pedir({
      method: "POST",
      url: `/baralhos/${baralhoId}/cartoes`,
      payload: { tipo: "audio", frente: "", verso: "Obrigado" },
    });
    expect(ausente.statusCode).toBe(400);
    expect(ausente.json()).toEqual({ erro: "audio_ausente", mensagem: "Choose an audio file." });
  });

  it("responde 422 audio_invalido com motivo para formato, duração e não encontrado", async () => {
    const baralhoId = await criarBaralho();
    const url = `/baralhos/${baralhoId}/cartoes`;

    const formato = await pedir({
      method: "POST",
      url,
      payload: {
        tipo: "audio",
        audioId: await enviar(Buffer.from("texto que nao e audio")),
        frente: "",
        verso: "Obrigado",
      },
    });
    expect(formato.statusCode).toBe(422);
    expect(formato.json()).toEqual({
      erro: "audio_invalido",
      motivo: "formato",
      mensagem: "File is not a supported audio format.",
    });

    const longo = await pedir({
      method: "POST",
      url,
      payload: {
        tipo: "audio",
        audioId: await enviar(amostraWav({ segundos: 300.001, bits: 8 })),
        frente: "",
        verso: "Obrigado",
      },
    });
    expect(longo.statusCode).toBe(422);
    expect(longo.json()).toEqual({
      erro: "audio_invalido",
      motivo: "duracao",
      mensagem: "Audio exceeds the duration limit.",
      limite: 300,
    });

    const naoEncontrado = await pedir({
      method: "POST",
      url,
      payload: { tipo: "audio", audioId: "00000000-0000-4000-8000-000000000000", frente: "", verso: "V" },
    });
    expect(naoEncontrado.statusCode).toBe(422);
    expect(naoEncontrado.json()).toMatchObject({ erro: "audio_invalido", motivo: "nao_encontrado" });
  });

  it("não devolve a Mensagem, o endereço nem o nome do arquivo numa recusa (FR-455)", async () => {
    const baralhoId = await criarBaralho();
    const mensagem = "Segredo da Mensagem";
    const nomeDoArquivo = "segredo-do-arquivo.wav";

    const invalida = await pedir({
      method: "POST",
      url: `/baralhos/${baralhoId}/cartoes`,
      payload: {
        tipo: "audio",
        audioId: await enviar(Buffer.from("texto que nao e audio"), contrato.credencial, nomeDoArquivo),
        frente: mensagem,
        verso: "Obrigado",
      },
    });
    expect(invalida.statusCode).toBe(422);
    expect(invalida.body).not.toContain(mensagem);
    expect(invalida.body).not.toContain(nomeDoArquivo);
    expect(invalida.body).not.toMatch(/midia-local|audios\/|pendentes\//);
  });

  it("recusa texto com nome .mp3 e tipo declarado audio/mpeg, decidindo pelo conteúdo (FR-437)", async () => {
    const baralhoId = await criarBaralho();
    const preparado = (await pedir({ method: "POST", url: "/audios/envios" })).json() as {
      audioId: string;
      envio: { url: string; campos: Record<string, string> };
    };
    const enviado = await contrato.servidor.inject({
      method: "POST",
      url: preparado.envio.url,
      ...multipart(preparado.envio.campos, Buffer.from("texto disfarçado de mp3"), "bom.mp3", "audio/mpeg"),
    });
    expect(enviado.statusCode).toBe(204);

    const recusado = await pedir({
      method: "POST",
      url: `/baralhos/${baralhoId}/cartoes`,
      payload: { tipo: "audio", audioId: preparado.audioId, frente: "", verso: "V" },
    });
    expect(recusado.statusCode).toBe(422);
    expect(recusado.json()).toMatchObject({ motivo: "formato" });
  });
});

describe("leitura e isolamento do Áudio (FR-441, FR-453)", () => {
  it("entrega o endereço só ao dono e lista o Áudio com duração", async () => {
    const baralhoId = await criarBaralho();
    await pedir({
      method: "POST",
      url: `/baralhos/${baralhoId}/cartoes`,
      payload: { tipo: "audio", audioId: await enviar(), frente: "", verso: "Obrigado" },
    });

    const doDono = await pedir({ method: "GET", url: `/baralhos/${baralhoId}` });
    expect(doDono.json()).toMatchObject({
      cartoes: [{ tipo: "audio", duracaoMs: 1000, audio: { url: expect.any(String) } }],
    });
    const listados = await pedir({ method: "GET", url: "/cartoes" });
    expect(listados.json()).toEqual([
      expect.objectContaining({ tipo: "audio", duracaoMs: 1000, audio: expect.any(Object) }),
    ]);

    const outro = await contrato.cadastrar("bruno.costa");
    expect((await pedir({ method: "GET", url: `/baralhos/${baralhoId}` }, outro)).statusCode).toBe(404);
    expect((await pedir({ method: "GET", url: "/cartoes" }, outro)).json()).toEqual([]);
  });

  it("registra a Sessão com o tipo audio e não devolve o Áudio", async () => {
    const id = "6f0b7d34-1f4e-4c55-9b0b-0f2f9e3f5a11";
    const registrado = await pedir({
      method: "POST",
      url: "/sessoes",
      payload: {
        id,
        origem: "baralho",
        baralhoId: "b1",
        nomeDoBaralho: "Japonês",
        itens: [{ tipo: "audio", frente: "", verso: "Obrigado", cartaoId: "c1", avaliacao: "bom" }],
      },
    });
    expect(registrado.statusCode).toBe(201);

    const lido = await pedir({ method: "GET", url: `/sessoes/${id}` });
    expect(lido.json()).toMatchObject({
      registro: { itens: [{ tipo: "audio", frente: "", verso: "Obrigado" }] },
    });
    expect(lido.body).not.toMatch(/"url"|audios\//);
  });
});

/** Os arquivos de Áudio que estão na pasta do armazém em Disco agora. */
function arquivosDeAudio(): string[] {
  const raiz = join(pasta, "audios");
  if (!existsSync(raiz)) return [];
  return readdirSync(raiz, { recursive: true, withFileTypes: true })
    .filter((entrada) => entrada.isFile())
    .map((entrada) => join(entrada.parentPath, entrada.name));
}

describe("PUT /cartoes/{id} com Áudio (FR-448, FR-449, FR-450)", () => {
  async function criarCartaoDeAudio(): Promise<{ id: string; duracaoMs: number; audio: { url: string } }> {
    const baralhoId = await criarBaralho();
    const criado = await pedir({
      method: "POST",
      url: `/baralhos/${baralhoId}/cartoes`,
      payload: { tipo: "audio", audioId: await enviar(), frente: "", verso: "Obrigado" },
    });
    expect(criado.statusCode).toBe(201);
    return criado.json();
  }

  it("troca o Áudio pelo novo e remove o arquivo anterior da pasta", async () => {
    const cartao = await criarCartaoDeAudio();
    const antigo = arquivosDeAudio();
    expect(antigo).toHaveLength(1);

    const editado = await pedir({
      method: "PUT",
      url: `/cartoes/${cartao.id}`,
      payload: {
        tipo: "audio",
        audioId: await enviar(amostraWav({ segundos: 2 })),
        frente: "",
        verso: "Novo",
      },
    });
    expect(editado.statusCode).toBe(200);
    const novo = editado.json() as { duracaoMs: number; audio: { url: string } };
    expect(novo).toMatchObject({ duracaoMs: 2000, audio: { url: expect.any(String) } });
    expect(novo.audio.url).not.toBe(cartao.audio.url);

    expect((await lerAudio(novo.audio.url)).statusCode).toBe(200);
    expect((await lerAudio(cartao.audio.url)).statusCode).toBe(404);
    const depois = arquivosDeAudio();
    expect(depois).toHaveLength(1);
    expect(depois[0]).not.toBe(antigo[0]);
  });

  it("sem audioId mantém o Áudio e a duração", async () => {
    const cartao = await criarCartaoDeAudio();

    const editado = await pedir({
      method: "PUT",
      url: `/cartoes/${cartao.id}`,
      payload: { tipo: "audio", frente: "", verso: "Novo" },
    });
    expect(editado.statusCode).toBe(200);
    expect(editado.json()).toMatchObject({
      verso: "Novo",
      duracaoMs: cartao.duracaoMs,
      audio: { url: expect.any(String) },
    });
    expect((await lerAudio(editado.json().audio.url)).statusCode).toBe(200);
    expect(arquivosDeAudio()).toHaveLength(1);
  });

  it("responde 409 tipo_imutavel ao pedir o tipo imagem num Cartão de Áudio", async () => {
    const cartao = await criarCartaoDeAudio();

    const trocado = await pedir({
      method: "PUT",
      url: `/cartoes/${cartao.id}`,
      payload: { tipo: "imagem", frente: "", verso: "Obrigado" },
    });
    expect(trocado.statusCode).toBe(409);
    expect(trocado.json()).toMatchObject({ erro: "tipo_imutavel" });
  });
});
