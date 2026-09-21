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
} from "../../src/http/rotas.ts";


/**
 * T207 — contrato HTTP de Vínculos
 * (specs/003-vincular-cartao-baralho/contracts/api-vinculos.md).
 *
 * O servidor é montado com o `Acervo` sobre o Adapter do armazenamento local
 * em memória e os dois Adapters HTTP registrados sobre a sua Interface; toda
 * asserção atravessa `inject`. Os códigos 201, 204, 404 e 409 são cobertos com
 * mensagem exata em português, e `GET /baralhos/{id}` devolve o Baralho com os
 * Cartões vinculados.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";
const NOME_VALIDO = "Inglês";

let servidor: FastifyInstance;
let contrato: ServidorDeContrato;

beforeEach(async () => {
  /**
   * O servidor é montado como na aplicação, com o hook que exige a Credencial:
   * cada arquivo registra as suas rotas sobre o `Acervo` do Usuário que entrou.
   */
  contrato = await montarServidorDeContrato(({ servidor, acervoDe }) => {
  registrarRotasDeCartoes(servidor, acervoDe);
  registrarRotasDeBaralhos(servidor, acervoDe);
  });
  servidor = contrato.servidor;
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

/** Cria um Cartão pela rota de criação; falha se a criação for recusada. */
async function criarCartao(): Promise<{ id: string; frente: string; verso: string }> {
  const resposta = await pedir({
    method: "POST",
    url: "/cartoes",
    payload: { frente: FRENTE_VALIDA, verso: VERSO_VALIDO },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação de Cartão recusada: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string; frente: string; verso: string };
}

/** Cria um Baralho pela rota de criação; falha se a criação for recusada. */
async function criarBaralho(
  nome = NOME_VALIDO,
): Promise<{ id: string; nome: string }> {
  const resposta = await pedir({
    method: "POST",
    url: "/baralhos",
    payload: { nome },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação de Baralho recusada: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string; nome: string };
}

describe("POST /baralhos/{baralhoId}/vinculos", () => {
  it("responde 201 e torna o Baralho elegível", async () => {
    const cartao = await criarCartao();
    const baralho = await criarBaralho();

    const resposta = await pedir({
      method: "POST",
      url: `/baralhos/${baralho.id}/vinculos`,
      payload: { cartaoId: cartao.id },
    });

    expect(resposta.statusCode).toBe(201);

    const leitura = await pedir({
      method: "GET",
      url: `/baralhos/${baralho.id}`,
    });

    expect(leitura.statusCode).toBe(200);
    expect(leitura.json()).toEqual({
      id: baralho.id,
      nome: NOME_VALIDO,
      elegivel: true,
      cartoes: [cartao],
    });
  });

  it("recusa Cartão inexistente com 404 e mensagem em português", async () => {
    const baralho = await criarBaralho();

    const resposta = await pedir({
      method: "POST",
      url: `/baralhos/${baralho.id}/vinculos`,
      payload: { cartaoId: "cartao-inexistente" },
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      erro: "nao_encontrado",
      mensagem: "Cartão não encontrado.",
    });
  });

  it("recusa Baralho inexistente com 404 e mensagem em português", async () => {
    const cartao = await criarCartao();

    const resposta = await pedir({
      method: "POST",
      url: "/baralhos/baralho-inexistente/vinculos",
      payload: { cartaoId: cartao.id },
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });

  it("recusa Vínculo duplicado com 409 e mensagem em português (SC-009)", async () => {
    const cartao = await criarCartao();
    const baralho = await criarBaralho();

    const primeira = await pedir({
      method: "POST",
      url: `/baralhos/${baralho.id}/vinculos`,
      payload: { cartaoId: cartao.id },
    });

    expect(primeira.statusCode).toBe(201);

    const duplicada = await pedir({
      method: "POST",
      url: `/baralhos/${baralho.id}/vinculos`,
      payload: { cartaoId: cartao.id },
    });

    expect(duplicada.statusCode).toBe(409);
    expect(duplicada.json()).toEqual({
      erro: "vinculo_duplicado",
      mensagem: "O vínculo já existe.",
    });
  });
});

describe("DELETE /baralhos/{baralhoId}/vinculos/{cartaoId}", () => {
  it("responde 204, preserva Cartão e Baralho e derruba a elegibilidade", async () => {
    const cartao = await criarCartao();
    const baralho = await criarBaralho();

    await pedir({
      method: "POST",
      url: `/baralhos/${baralho.id}/vinculos`,
      payload: { cartaoId: cartao.id },
    });

    const resposta = await pedir({
      method: "DELETE",
      url: `/baralhos/${baralho.id}/vinculos/${cartao.id}`,
    });

    expect(resposta.statusCode).toBe(204);

    const baralhoLido = await pedir({
      method: "GET",
      url: `/baralhos/${baralho.id}`,
    });

    expect(baralhoLido.statusCode).toBe(200);
    expect(baralhoLido.json()).toEqual({
      id: baralho.id,
      nome: NOME_VALIDO,
      elegivel: false,
      cartoes: [],
    });

    const cartoes = await pedir({
      method: "GET",
      url: "/cartoes",
    });

    expect(cartoes.json()).toEqual([{ ...cartao, baralhos: [] }]);
  });

  it("recusa Vínculo inexistente com 404 e mensagem em português", async () => {
    const cartao = await criarCartao();
    const baralho = await criarBaralho();

    const resposta = await pedir({
      method: "DELETE",
      url: `/baralhos/${baralho.id}/vinculos/${cartao.id}`,
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      erro: "vinculo_nao_encontrado",
      mensagem: "O vínculo não existe.",
    });
  });
});

describe("GET /baralhos/{id}", () => {
  it("responde 200 com o Baralho e seus Cartões vinculados", async () => {
    const cartao = await criarCartao();
    const baralho = await criarBaralho();

    await pedir({
      method: "POST",
      url: `/baralhos/${baralho.id}/vinculos`,
      payload: { cartaoId: cartao.id },
    });

    const resposta = await pedir({
      method: "GET",
      url: `/baralhos/${baralho.id}`,
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({
      id: baralho.id,
      nome: NOME_VALIDO,
      elegivel: true,
      cartoes: [cartao],
    });
  });

  it("recusa Baralho inexistente com 404 e mensagem em português", async () => {
    const resposta = await pedir({
      method: "GET",
      url: "/baralhos/baralho-inexistente",
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });
});
