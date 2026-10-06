import type { FastifyInstance, InjectOptions } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";
import { registrarRotasDeCartoes } from "../../src/http/rotas.ts";


/**
 * T007 — contrato HTTP de `GET /cartoes`
 * (specs/001-criar-cartao/contracts/api-cartoes.md), com a mudança da feature 025:
 * cada Cartão agora traz um único `baralho` (não mais um array `baralhos`).
 *
 * Toda asserção atravessa `inject` sobre o Adapter HTTP registrado com o
 * `Acervo` sobre o Adapter do armazenamento local em memória. A Frente não é
 * identificador: dois Cartões com a mesma Frente no mesmo Baralho recebem numeração,
 * mas em Baralhos diferentes não. A ordem não é pré-condição do contrato, então
 * as asserções comparam conjuntos de Cartões, nunca posições.
 */

import { registrarRotasDeBaralhos } from "../../src/http/rotas.ts";

const FRENTE_REPETIDA = "To walk";
const VERSO_UM = "Caminhar";
const VERSO_OUTRO = "Andar";

let servidor: FastifyInstance;
let contrato: ServidorDeContrato;
let baralhoId: string;

beforeEach(async () => {
  /**
   * O servidor é montado como na aplicação, com o hook que exige a Credencial:
   * cada arquivo registra as suas rotas sobre o `Acervo` do Usuário que entrou.
   */
  contrato = await montarServidorDeContrato(({ servidor, acervoDe }) => {
  registrarRotasDeBaralhos(servidor, acervoDe);
  registrarRotasDeCartoes(servidor, acervoDe);
  });
  servidor = contrato.servidor;
  const respostaBaralho = await pedirComCredencial(servidor, contrato.credencial, {
    method: "POST",
    url: "/baralhos",
    payload: { nome: "Teste" },
  });
  baralhoId = respostaBaralho.json().id as string;
});

afterEach(async () => {
  await contrato.encerrar();
});

/**
 * Envia a requisição com a Credencial do Usuário que entrou: sem ela, nenhuma
 * rota de acervo roda (FR-090), e é assim que todas as chamadas deste arquivo
 * a apresentam.
 */
function pedir(requisicao: InjectOptions) {
  return pedirComCredencial(servidor, contrato.credencial, requisicao);
}

/** Cria um Cartão no Baralho de teste; falha se a criação for recusada. */
async function criar(
  frente: string,
  verso: string,
): Promise<{ id: string; frente: string; verso: string }> {
  const resposta = await pedir({
    method: "POST",
    url: `/baralhos/${baralhoId}/cartoes`,
    payload: { frente, verso },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação recusada inesperadamente: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string; frente: string; verso: string };
}

describe("GET /cartoes — leitura conforme o contrato", () => {
  it("responde 200 com lista vazia quando nenhum Cartão existe", async () => {
    const resposta = await pedir({ method: "GET", url: "/cartoes" });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual([]);
  });

  it("responde 200 com os dois Cartões de Frente idêntica com numeração", async () => {
    await criar(FRENTE_REPETIDA, VERSO_UM);
    await criar(FRENTE_REPETIDA, VERSO_OUTRO);

    const resposta = await pedir({ method: "GET", url: "/cartoes" });

    expect(resposta.statusCode).toBe(200);
    const cartoes = resposta.json();
    expect(cartoes).toHaveLength(2);
    expect(cartoes[0].frente).toBe(FRENTE_REPETIDA);
    expect(cartoes[1].frente).toBe(`${FRENTE_REPETIDA} (2)`);
    expect(cartoes.every((c: { baralho?: { id: string } }) => c.baralho?.id === baralhoId)).toBe(true);
  });

  it("devolve cada Cartão com id, Frente, Verso e baralho (FR-003, FR-004)", async () => {
    await criar(FRENTE_REPETIDA, VERSO_UM);
    await criar(FRENTE_REPETIDA, VERSO_OUTRO);

    const resposta = await pedir({ method: "GET", url: "/cartoes" });
    const listados = resposta.json() as {
      id: string;
      frente: string;
      verso: string;
      baralho: { id: string; nome: string };
      proximaRevisaoEm: string | null;
    }[];

    expect(listados).toHaveLength(2);
    for (const cartao of listados) {
      expect(Object.keys(cartao).sort()).toEqual([
        "baralho",
        "frente",
        "id",
        "proximaRevisaoEm",
        "verso",
      ]);
      expect(cartao.id).toEqual(expect.any(String));
      expect(cartao.baralho).toEqual({
        id: baralhoId,
        nome: "Teste",
      });
    }
  });

  it("traz proximaRevisaoEm null para Cartão nunca estudado (contrato da 022, FR-352)", async () => {
    await criar(FRENTE_REPETIDA, VERSO_UM);

    const resposta = await pedir({ method: "GET", url: "/cartoes" });

    expect(resposta.statusCode).toBe(200);
    const [cartao] = resposta.json();
    expect(cartao.proximaRevisaoEm).toBeNull();
    expect(cartao).toHaveProperty("proximaRevisaoEm", null);
  });
});
