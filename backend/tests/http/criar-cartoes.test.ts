import type { FastifyInstance, InjectOptions } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";
import { registrarRotasDeCartoes } from "../../src/http/rotas.ts";


/**
 * T007 — contrato HTTP de `POST /cartoes`
 * (specs/001-criar-cartao/contracts/api-cartoes.md).
 *
 * O servidor é montado com o `Acervo` sobre o Adapter do armazenamento local
 * em memória e o Adapter HTTP registrado sobre a sua Interface; toda asserção
 * atravessa `inject`, a mesma superfície que um cliente HTTP usa. Os quatro
 * códigos de erro do contrato são cobertos com mensagem exata em português, e a
 * forma inválida é recusada na borda, antes de alcançar o `Acervo`.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";

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

/**
 * Envia `POST /cartoes`. `corpo` ausente reproduz requisição sem corpo;
 * `cabecalhos` permite forçar content-type na requisição.
 */
function postarCartao(
  corpo?: object | string,
  cabecalhos: Record<string, string> = {},
) {
  return pedir({
    method: "POST",
    url: "/cartoes",
    headers: cabecalhos,
    payload: corpo,
  });
}

describe("POST /cartoes — criação conforme o contrato", () => {
  it("responde 201 com o Cartão criado: id, Frente e Verso (FR-001)", async () => {
    const resposta = await postarCartao({
      frente: FRENTE_VALIDA,
      verso: VERSO_VALIDO,
    });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toEqual({
      id: expect.any(String),
      frente: FRENTE_VALIDA,
      verso: VERSO_VALIDO,
    });
  });

  it("aceita Frente e Verso com exatamente 1000 caracteres: limite inclusivo (FR-052)", async () => {
    const resposta = await postarCartao({
      frente: "a".repeat(1000),
      verso: "b".repeat(1000),
    });

    expect(resposta.statusCode).toBe(201);
  });

  it("ignora propriedade extra e ela não retorna nas leituras (FR-009)", async () => {
    const resposta = await postarCartao({
      frente: FRENTE_VALIDA,
      verso: VERSO_VALIDO,
      titulo: "propriedade que não existe em Cartão",
    });

    expect(resposta.statusCode).toBe(201);
    const cartao = resposta.json();
    expect(cartao).toEqual({
      id: expect.any(String),
      frente: FRENTE_VALIDA,
      verso: VERSO_VALIDO,
    });

    const leitura = await pedir({ method: "GET", url: "/cartoes" });
    expect(leitura.json()).toEqual([{ ...cartao, baralhos: [] }]);
  });

  it("recusa Frente vazia com 400, código frente_vazia e mensagem em português (FR-002)", async () => {
    const resposta = await postarCartao({ frente: "", verso: VERSO_VALIDO });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "frente_vazia",
      mensagem: "A frente do cartão não pode ficar vazia.",
    });
  });

  it("trata Frente composta só de espaços como vazia (FR-051)", async () => {
    const resposta = await postarCartao({ frente: "   ", verso: VERSO_VALIDO });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "frente_vazia",
      mensagem: "A frente do cartão não pode ficar vazia.",
    });
  });

  it("recusa Verso vazio com 400, código verso_vazio e mensagem em português (FR-002)", async () => {
    const resposta = await postarCartao({ frente: FRENTE_VALIDA, verso: "" });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "verso_vazio",
      mensagem: "O verso do cartão não pode ficar vazio.",
    });
  });

  it("recusa Frente acima de 1000 caracteres com 400, frente_muito_longa, informando limite e tamanho (FR-052, SC-016)", async () => {
    const resposta = await postarCartao({
      frente: "a".repeat(1001),
      verso: VERSO_VALIDO,
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "frente_muito_longa",
      mensagem:
        "A frente do cartão deve ter no máximo 1000 caracteres; a informada tem 1001.",
    });
  });

  it("recusa Verso acima de 1000 caracteres com 400, verso_muito_longo, informando limite e tamanho (FR-052, SC-016)", async () => {
    const resposta = await postarCartao({
      frente: FRENTE_VALIDA,
      verso: "a".repeat(1001),
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "verso_muito_longo",
      mensagem:
        "O verso do cartão deve ter no máximo 1000 caracteres; o informado tem 1001.",
    });
  });
});

describe("POST /cartoes — forma inválida recusada na borda, antes do Acervo", () => {
  it("recusa corpo sem Frente com 400 e nada é criado", async () => {
    const resposta = await postarCartao({ verso: VERSO_VALIDO });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);

    const leitura = await pedir({ method: "GET", url: "/cartoes" });
    expect(leitura.json()).toEqual([]);
  });

  it("recusa Frente de tipo errado com 400 e nada é criado", async () => {
    const resposta = await postarCartao({ frente: 42, verso: VERSO_VALIDO });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);

    const leitura = await pedir({ method: "GET", url: "/cartoes" });
    expect(leitura.json()).toEqual([]);
  });

  it("recusa corpo que não é JSON com 400 e nada é criado", async () => {
    const resposta = await postarCartao("isto não é json {", {
      "content-type": "application/json",
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);

    const leitura = await pedir({ method: "GET", url: "/cartoes" });
    expect(leitura.json()).toEqual([]);
  });

  it("recusa requisição sem corpo com 400 e nada é criado", async () => {
    const resposta = await postarCartao();

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);
  });
});
