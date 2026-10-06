import type { FastifyInstance, InjectOptions } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";
import { registrarRotasDeCartoes, registrarRotasDeBaralhos } from "../../src/http/rotas.ts";


/**
 * T403 (backend) — contrato HTTP de `PUT /cartoes/{id}`
 * (specs/005-editar-cartao-e-baralho/contracts/api-edicao.md).
 *
 * O servidor é montado com o `Acervo` sobre o Adapter do armazenamento local
 * em memória e o Adapter HTTP registrado sobre a sua Interface; toda asserção
 * atravessa `inject`. A rota devolve 200 com o Cartão atualizado, 400 para
 * conteúdo inválido — as mesmas recusas da criação —, 404 para Cartão
 * inexistente, e 409 para Frente duplicada no mesmo Baralho, sempre com
 * mensagem em português.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";
const FRENTE_EDITADA = "To stroll";
const VERSO_EDITADO = "Passear";
const NOME_DO_BARALHO = "Inglês";

const RECUSA_DE_CORPO_INVALIDO = {
  erro: "corpo_invalido",
  mensagem: "O corpo da requisição não é válido.",
};

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

/** Cria um Baralho pela rota; falha se a criação for recusada. */
async function criarBaralho(nome = NOME_DO_BARALHO): Promise<{ id: string }> {
  const resposta = await pedir({
    method: "POST",
    url: "/baralhos",
    payload: { nome },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação de baralho recusada: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string };
}

/** Cria um Cartão no Baralho pela rota de criação; falha se a criação for recusada. */
async function criarCartaoNoBaralho(
  baralhoId: string,
  frente: string = FRENTE_VALIDA,
  verso: string = VERSO_VALIDO,
): Promise<{ id: string }> {
  const resposta = await pedir({
    method: "POST",
    url: `/baralhos/${baralhoId}/cartoes`,
    payload: { frente, verso },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação recusada inesperadamente: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string };
}

describe("PUT /cartoes/{id} — edição conforme o contrato", () => {
  it("responde 200 com o Cartão atualizado", async () => {
    const baralho = await criarBaralho();
    const cartao = await criarCartaoNoBaralho(baralho.id);

    const resposta = await pedir({
      method: "PUT",
      url: `/cartoes/${cartao.id}`,
      payload: { frente: FRENTE_EDITADA, verso: VERSO_EDITADO },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({
      id: cartao.id,
      frente: FRENTE_EDITADA,
      verso: VERSO_EDITADO,
    });

    const leitura = await pedir({ method: "GET", url: "/cartoes" });
    expect(leitura.json()).toEqual([
      {
        id: cartao.id,
        frente: FRENTE_EDITADA,
        verso: VERSO_EDITADO,
        baralho: { id: baralho.id, nome: NOME_DO_BARALHO },
        proximaRevisaoEm: null,
      },
    ]);
  });

  it("recusa Frente vazia com 400 e a mesma mensagem da criação", async () => {
    const baralho = await criarBaralho();
    const cartao = await criarCartaoNoBaralho(baralho.id);

    const resposta = await pedir({
      method: "PUT",
      url: `/cartoes/${cartao.id}`,
      payload: { frente: "", verso: VERSO_EDITADO },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "frente_vazia",
      mensagem: "A frente do cartão não pode ficar vazia.",
    });
  });

  it("recusa Cartão inexistente com 404 e mensagem em português", async () => {
    const resposta = await pedir({
      method: "PUT",
      url: "/cartoes/cartao-inexistente",
      payload: { frente: FRENTE_EDITADA, verso: VERSO_EDITADO },
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      erro: "nao_encontrado",
      mensagem: "Cartão não encontrado.",
    });
  });

  it("recusa corpo sem Verso com 400 e não altera o Cartão", async () => {
    const baralho = await criarBaralho();
    const cartao = await criarCartaoNoBaralho(baralho.id);

    const resposta = await pedir({
      method: "PUT",
      url: `/cartoes/${cartao.id}`,
      payload: { frente: FRENTE_EDITADA },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);

    const leitura = await pedir({ method: "GET", url: "/cartoes" });
    expect(leitura.json()).toEqual([
      {
        id: cartao.id,
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
        baralho: { id: baralho.id, nome: NOME_DO_BARALHO },
        proximaRevisaoEm: null,
      },
    ]);
  });

  it("recusa Frente de outro Cartão do mesmo Baralho com 409 frente_duplicada e não altera", async () => {
    const baralho = await criarBaralho();
    await criarCartaoNoBaralho(baralho.id, "To walk");
    const cartao2 = await criarCartaoNoBaralho(baralho.id, "To run");

    const resposta = await pedir({
      method: "PUT",
      url: `/cartoes/${cartao2.id}`,
      payload: { frente: "To walk", verso: VERSO_EDITADO },
    });

    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toEqual({
      erro: "frente_duplicada",
      mensagem: expect.any(String),
    });

    // Verifica que Cartão2 continua com a Frente original
    const leitura = await pedir({ method: "GET", url: "/cartoes" });
    const cartaoNaLeitura = leitura.json().find(
      (c: { id: string }) => c.id === cartao2.id,
    );
    expect(cartaoNaLeitura.frente).toBe("To run");
  });

  it("permite editar para mesma Frente de outro Baralho sem 409", async () => {
    const baralho1 = await criarBaralho("Inglês 1");
    const baralho2 = await criarBaralho("Inglês 2");
    await criarCartaoNoBaralho(baralho1.id, "To walk");
    const cartao2 = await criarCartaoNoBaralho(baralho2.id, "To run");

    const resposta = await pedir({
      method: "PUT",
      url: `/cartoes/${cartao2.id}`,
      payload: { frente: "To walk", verso: VERSO_EDITADO },
    });

    expect(resposta.statusCode).toBe(200);
    const cartaoEditado = resposta.json();
    expect(cartaoEditado.frente).toBe("To walk");
  });
});
