import { randomUUID } from "node:crypto";

import type { FastifyInstance, InjectOptions } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";
import {
  registrarRotasDeBaralhos,
  registrarRotasDeCartoes,
  registrarRotasDeRevisao,
} from "../../src/http/rotas.ts";

/**
 * T1514 — contrato HTTP da prévia do estudo livre
 * (`specs/015-repeticao-espacada/contracts/contratos.md`, §4).
 *
 * O servidor é montado como na aplicação, com o hook que exige a Credencial: as
 * rotas de Cartão entram só para dar existência real ao acervo, e a rota de
 * Prévias é o objeto do teste. A Revisão do dia (`GET /revisao` e
 * `GET /revisao/lote`) saiu da aplicação. Toda asserção atravessa `inject`, a
 * mesma superfície que um cliente HTTP usa.
 */

let servidor: FastifyInstance;
let contrato: ServidorDeContrato;

beforeEach(async () => {
  contrato = await montarServidorDeContrato(({ servidor, acervoDe }) => {
    registrarRotasDeBaralhos(servidor, acervoDe);
    registrarRotasDeCartoes(servidor, acervoDe);
    registrarRotasDeRevisao(servidor, acervoDe);
  });
  servidor = contrato.servidor;
});

afterEach(async () => {
  await contrato.encerrar();
});

/** Envia a requisição com a Credencial do Usuário que entrou (FR-090). */
function pedir(requisicao: InjectOptions) {
  return pedirComCredencial(servidor, contrato.credencial, requisicao);
}

/** Cria um Baralho para armazenar Cartões. */
async function criarBaralho(): Promise<string> {
  const resposta = await pedir({
    method: "POST",
    url: "/baralhos",
    payload: { nome: "Estudo" },
  });
  expect(resposta.statusCode).toBe(201);
  return resposta.json().id as string;
}

/** Cria um Cartão real e devolve o seu identificador. */
async function criarCartao(): Promise<string> {
  const baralho = await criarBaralho();
  const resposta = await pedir({
    method: "POST",
    url: `/baralhos/${baralho}/cartoes`,
    payload: { frente: "casa", verso: "house" },
  });
  expect(resposta.statusCode).toBe(201);
  return resposta.json().id as string;
}

const DADOS_DA_REVISAO_INVALIDOS = {
  erro: "dados_invalidos",
  mensagem: "Os dados da Revisão são inválidos.",
};

describe("POST /previas — prévia do estudo livre (FR-221, FR-219)", () => {
  it("devolve a prévia dos quatro níveis por Cartão informado (FR-221)", async () => {
    const cartaoId = await criarCartao();

    const resposta = await pedir({
      method: "POST",
      url: "/previas",
      payload: { cartaoIds: [cartaoId] },
    });

    expect(resposta.statusCode).toBe(200);

    const previas = resposta.json().previas as Record<
      string,
      Record<string, string>
    >;

    expect(Object.keys(previas)).toEqual([cartaoId]);
    expect(Object.keys(previas[cartaoId]).sort()).toEqual([
      "bom",
      "dificil",
      "errei",
      "facil",
    ]);
  });

  it("omite identificador que não é Cartão do Usuário, sem recusar a lista (FR-219)", async () => {
    const cartaoId = await criarCartao();

    const resposta = await pedir({
      method: "POST",
      url: "/previas",
      payload: { cartaoIds: [cartaoId, randomUUID()] },
    });

    expect(resposta.statusCode).toBe(200);
    expect(Object.keys(resposta.json().previas)).toEqual([cartaoId]);
  });

  it("omite o Cartão de outro Usuário (FR-219)", async () => {
    const cartaoId = await criarCartao();
    const outra = await contrato.cadastrar("outra");

    const resposta = await pedirComCredencial(servidor, outra, {
      method: "POST",
      url: "/previas",
      payload: { cartaoIds: [cartaoId] },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().previas).toEqual({});
  });

  it("recusa mais de 200 identificadores com 400 (FR-221)", async () => {
    const cartaoIds = Array.from({ length: 201 }, () => randomUUID());

    const resposta = await pedir({
      method: "POST",
      url: "/previas",
      payload: { cartaoIds },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(DADOS_DA_REVISAO_INVALIDOS);
  });

  it("recusa lista vazia com 400 (FR-221)", async () => {
    const resposta = await pedir({
      method: "POST",
      url: "/previas",
      payload: { cartaoIds: [] },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(DADOS_DA_REVISAO_INVALIDOS);
  });

  it("recusa sem Credencial com 401 (FR-090)", async () => {
    const resposta = await servidor.inject({
      method: "POST",
      url: "/previas",
      payload: { cartaoIds: [randomUUID()] },
    });

    expect(resposta.statusCode).toBe(401);
  });
});

describe("GET /revisao — a Revisão do dia saiu da aplicação", () => {
  it("não responde mais pelo resumo nem pelo lote", async () => {
    const consulta =
      "inicioDoDia=2026-01-01T00:00:00.000Z&fimDoDia=2026-01-02T00:00:00.000Z";

    expect((await pedir({ method: "GET", url: `/revisao?${consulta}` })).statusCode).toBe(404);
    expect((await pedir({ method: "GET", url: `/revisao/lote?${consulta}` })).statusCode).toBe(404);
  });
});
