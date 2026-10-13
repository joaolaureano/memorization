import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { InjectOptions } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registrarRotasDeImagensLocais } from "../../src/http/imagens-locais.ts";
import {
  registrarRotasDeBaralhos,
  registrarRotasDeCartoes,
  registrarRotasDeConta,
  registrarRotasDeImagens,
  registrarRotasDeSessoes,
} from "../../src/http/rotas.ts";
import { criarArmazemEmDisco } from "../../src/imagens/armazem-em-disco.ts";
import { pngComMetadados, textoDisfarcado } from "../imagens/amostras.ts";
import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";
import type { CredencialDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/**
 * T020, T031, T038 — o contrato HTTP do Cartão com Imagem (`026`,
 * contracts/http.md), com o armazém em Disco e as rotas locais de envio e de
 * leitura — o mesmo caminho que o navegador faz no modo local.
 */

let contrato: ServidorDeContrato;

beforeEach(async () => {
  const imagens = criarArmazemEmDisco({
    pasta: mkdtempSync(join(tmpdir(), "http-imagens-")),
  });
  contrato = await montarServidorDeContrato(
    ({ servidor, acervoDe, identidade, acessos }) => {
      registrarRotasDeCartoes(servidor, acervoDe);
      registrarRotasDeBaralhos(servidor, acervoDe);
      registrarRotasDeSessoes(servidor, acervoDe);
      registrarRotasDeConta(servidor, identidade, acessos);
      registrarRotasDeImagens(servidor, imagens);
      registrarRotasDeImagensLocais(servidor, imagens);
    },
    {},
    {},
    { imagens },
  );
});

afterEach(async () => {
  await contrato.encerrar();
});

function pedir(requisicao: InjectOptions, credencial = contrato.credencial) {
  return pedirComCredencial(contrato.servidor, credencial, requisicao);
}

/** Corpo `multipart/form-data` com os campos e o arquivo, como o navegador. */
function multipart(campos: Record<string, string>, arquivo: Uint8Array) {
  const fronteira = "fronteira-de-teste";
  const partes = [
    ...Object.entries(campos).map(
      ([nome, valor]) =>
        `--${fronteira}\r\nContent-Disposition: form-data; name="${nome}"\r\n\r\n${valor}\r\n`,
    ),
    `--${fronteira}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`,
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

/** Prepara e faz o envio de uma Imagem; devolve o `imagemId`. */
async function enviar(
  bytes = pngComMetadados(),
  credencial: CredencialDeTeste = contrato.credencial,
): Promise<string> {
  const preparado = await pedir({ method: "POST", url: "/imagens/envios" }, credencial);
  expect(preparado.statusCode).toBe(201);
  const envio = preparado.json() as {
    imagemId: string;
    envio: { url: string; campos: Record<string, string> };
  };
  // O envio local não leva Credencial: quem autoriza é o token do caminho.
  const resposta = await contrato.servidor.inject({
    method: "POST",
    url: envio.envio.url,
    ...multipart(envio.envio.campos, bytes),
  });
  expect(resposta.statusCode).toBe(204);
  return envio.imagemId;
}

async function criarBaralho(credencial = contrato.credencial): Promise<string> {
  const resposta = await pedir({ method: "POST", url: "/baralhos", payload: { nome: "Geografia" } }, credencial);
  return (resposta.json() as { id: string }).id;
}

/** Lê a Imagem pelo endereço de exibição, sem Credencial — como a `<img>`. */
async function lerImagem(url: string) {
  return contrato.servidor.inject({ method: "GET", url });
}

describe("POST /imagens/envios", () => {
  it("exige Entrar e devolve a forma do contrato", async () => {
    expect(
      (await contrato.servidor.inject({ method: "POST", url: "/imagens/envios" })).statusCode,
    ).toBe(401);

    const resposta = await pedir({ method: "POST", url: "/imagens/envios" });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toEqual({
      imagemId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      envio: { url: expect.stringMatching(/^\/imagens-locais\/envios\?t=/), campos: {} },
      expiraEm: expect.any(String),
      limiteEmBytes: 5_242_880,
      formatos: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    });
  });

  it("responde 503 quando a aplicação não tem armazém de Imagens", async () => {
    const semArmazem = await montarServidorDeContrato(({ servidor }) => {
      registrarRotasDeImagens(servidor, undefined);
    });

    try {
      const resposta = await pedirComCredencial(semArmazem.servidor, semArmazem.credencial, {
        method: "POST",
        url: "/imagens/envios",
      });
      expect(resposta.statusCode).toBe(503);
    } finally {
      await semArmazem.encerrar();
    }
  });

  it("recusa envio acima de 5 MB e token adulterado na rota local", async () => {
    const preparado = (await pedir({ method: "POST", url: "/imagens/envios" })).json() as {
      envio: { url: string };
    };

    const grande = await contrato.servidor.inject({
      method: "POST",
      url: preparado.envio.url,
      ...multipart({}, pngComMetadados(5_242_881)),
    });
    expect(grande.statusCode).toBe(413);

    const adulterado = await contrato.servidor.inject({
      method: "POST",
      url: `${preparado.envio.url}x`,
      ...multipart({}, pngComMetadados()),
    });
    expect(adulterado.statusCode).toBe(403);
  });
});

describe("POST /baralhos/{id}/cartoes com tipo (FR-405, FR-409, FR-411)", () => {
  it("cria Frente-Verso sem tipo e Imagem com tipo, servindo a Imagem sem metadados", async () => {
    const baralhoId = await criarBaralho();

    const frenteVerso = await pedir({
      method: "POST",
      url: `/baralhos/${baralhoId}/cartoes`,
      payload: { frente: "To walk", verso: "Caminhar" },
    });
    expect(frenteVerso.statusCode).toBe(201);
    expect(frenteVerso.json()).toEqual({ id: expect.any(String), frente: "To walk", verso: "Caminhar" });

    const imagem = await pedir({
      method: "POST",
      url: `/baralhos/${baralhoId}/cartoes`,
      payload: { tipo: "imagem", imagemId: await enviar(), frente: "", verso: "Pernambuco" },
    });
    expect(imagem.statusCode).toBe(201);
    const cartao = imagem.json() as { tipo: string; imagem: { url: string } };
    expect(cartao).toMatchObject({ tipo: "imagem", imagem: { url: expect.any(String) } });
    expect(JSON.stringify(cartao)).not.toContain("imagemChave");

    const lida = await lerImagem(cartao.imagem.url);
    expect(lida.statusCode).toBe(200);
    expect(lida.headers["content-type"]).toBe("image/png");
    expect(lida.rawPayload.includes(Buffer.from("SEGREDO-GPS"))).toBe(false);
  });

  it("responde 400 imagem_ausente, 422 imagem_invalida e 400 de tipo desconhecido", async () => {
    const baralhoId = await criarBaralho();
    const url = `/baralhos/${baralhoId}/cartoes`;

    const ausente = await pedir({ method: "POST", url, payload: { tipo: "imagem", frente: "", verso: "V" } });
    expect(ausente.statusCode).toBe(400);
    expect(ausente.json()).toMatchObject({ erro: "imagem_ausente" });

    const segredo = "Descrição que não pode vazar";
    const invalida = await pedir({
      method: "POST",
      url,
      payload: {
        tipo: "imagem",
        imagemId: await enviar(textoDisfarcado()),
        frente: "",
        verso: "V",
        textoAlternativo: segredo,
      },
    });
    expect(invalida.statusCode).toBe(422);
    expect(invalida.json()).toEqual({
      erro: "imagem_invalida",
      motivo: "formato",
      mensagem: expect.any(String),
    });
    // FR-428: a recusa não devolve a Descrição nem endereço algum.
    expect(invalida.body).not.toContain(segredo);
    expect(invalida.body).not.toMatch(/imagens(-locais)?\//);

    const naoEncontrada = await pedir({
      method: "POST",
      url,
      payload: { tipo: "imagem", imagemId: "00000000-0000-4000-8000-000000000000", frente: "", verso: "V" },
    });
    expect(naoEncontrada.statusCode).toBe(422);
    expect(naoEncontrada.json()).toMatchObject({ motivo: "nao_encontrada" });

    const desconhecido = await pedir({ method: "POST", url, payload: { tipo: "audio", frente: "F", verso: "V" } });
    expect(desconhecido.statusCode).toBe(400);
  });
});

describe("leitura e isolamento (FR-424, SC-170)", () => {
  it("entrega o endereço só ao dono; outro Usuário não vê o Baralho nem o Cartão", async () => {
    const baralhoId = await criarBaralho();
    await pedir({
      method: "POST",
      url: `/baralhos/${baralhoId}/cartoes`,
      payload: { tipo: "imagem", imagemId: await enviar(), frente: "", verso: "Pernambuco" },
    });

    const doDono = await pedir({ method: "GET", url: `/baralhos/${baralhoId}` });
    expect(doDono.json()).toMatchObject({
      cartoes: [{ tipo: "imagem", imagem: { url: expect.any(String) } }],
    });
    const listados = await pedir({ method: "GET", url: "/cartoes" });
    expect(listados.json()).toEqual([expect.objectContaining({ tipo: "imagem", imagem: expect.any(Object) })]);

    const outro = await contrato.cadastrar("bruno.costa");
    expect((await pedir({ method: "GET", url: `/baralhos/${baralhoId}` }, outro)).statusCode).toBe(404);
    expect((await pedir({ method: "GET", url: "/cartoes" }, outro)).json()).toEqual([]);

    // A chave do arquivo, sem token, não é endereço de leitura.
    expect((await lerImagem("/imagens-locais/arquivo?t=imagens/dono-um/x")).statusCode).toBe(404);
  });

  it("não aceita o envio de outro Usuário num Cartão", async () => {
    const outro = await contrato.cadastrar("bruno.costa");
    const imagemDoOutro = await enviar(pngComMetadados(), outro);
    const baralhoId = await criarBaralho();

    const resposta = await pedir({
      method: "POST",
      url: `/baralhos/${baralhoId}/cartoes`,
      payload: { tipo: "imagem", imagemId: imagemDoOutro, frente: "", verso: "V" },
    });
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json()).toMatchObject({ motivo: "nao_encontrada" });
  });

  it("registra a Sessão com o tipo e devolve o Histórico sem Imagem (FR-419a)", async () => {
    const id = "6f0b7d34-1f4e-4c55-9b0b-0f2f9e3f5a11";
    const registrado = await pedir({
      method: "POST",
      url: "/sessoes",
      payload: {
        id,
        origem: "baralho",
        baralhoId: "b1",
        nomeDoBaralho: "Geografia",
        itens: [{ tipo: "imagem", frente: "", verso: "Pernambuco", cartaoId: "c1", avaliacao: "bom" }],
      },
    });
    expect(registrado.statusCode).toBe(201);

    const lido = await pedir({ method: "GET", url: `/sessoes/${id}` });
    expect(lido.json()).toMatchObject({
      registro: { itens: [{ tipo: "imagem", frente: "", verso: "Pernambuco" }] },
    });
    expect(lido.body).not.toMatch(/"url"|imagens\//);
  });
});

describe("PUT /cartoes/{id} e exclusões (FR-420, FR-421)", () => {
  async function criarCartaoComImagem() {
    const baralhoId = await criarBaralho();
    const criado = await pedir({
      method: "POST",
      url: `/baralhos/${baralhoId}/cartoes`,
      payload: { tipo: "imagem", imagemId: await enviar(), frente: "", verso: "Pernambuco" },
    });
    return { baralhoId, cartao: criado.json() as { id: string; imagem: { url: string } } };
  }

  it("responde 409 tipo_imutavel e troca a Imagem, deixando a anterior inacessível", async () => {
    const { cartao } = await criarCartaoComImagem();

    const mudarTipo = await pedir({
      method: "PUT",
      url: `/cartoes/${cartao.id}`,
      payload: { tipo: "frente-verso", frente: "F", verso: "Pernambuco" },
    });
    expect(mudarTipo.statusCode).toBe(409);
    expect(mudarTipo.json()).toMatchObject({ erro: "tipo_imutavel" });

    const trocado = await pedir({
      method: "PUT",
      url: `/cartoes/${cartao.id}`,
      payload: { tipo: "imagem", imagemId: await enviar(), frente: "", verso: "Pernambuco" },
    });
    expect(trocado.statusCode).toBe(200);
    const novo = trocado.json() as { imagem: { url: string } };
    expect((await lerImagem(novo.imagem.url)).statusCode).toBe(200);
    expect((await lerImagem(cartao.imagem.url)).statusCode).toBe(404);
  });

  it("DELETE /baralhos e DELETE /conta removem as Imagens dos Cartões", async () => {
    const primeiro = await criarCartaoComImagem();
    expect(
      (await pedir({ method: "DELETE", url: `/baralhos/${primeiro.baralhoId}` })).statusCode,
    ).toBe(204);
    expect((await lerImagem(primeiro.cartao.imagem.url)).statusCode).toBe(404);

    const segundo = await criarCartaoComImagem();
    expect(
      (
        await pedir({
          method: "DELETE",
          url: "/conta",
          payload: { senhaAtual: contrato.credencial.senha },
        })
      ).statusCode,
    ).toBe(204);
    expect((await lerImagem(segundo.cartao.imagem.url)).statusCode).toBe(404);
  });
});
