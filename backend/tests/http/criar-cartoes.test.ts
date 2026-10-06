import type { FastifyInstance, InjectOptions } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";
import { registrarRotasDeCartoes, registrarRotasDeBaralhos } from "../../src/http/rotas.ts";


/**
 * T025 — contrato HTTP de `POST /baralhos/{id}/cartoes`
 * (specs/025-criar-cartoes-baralho/contracts/http.md).
 *
 * O servidor é montado com o `Acervo` sobre o Adapter do armazenamento local
 * em memória e o Adapter HTTP registrado sobre a sua Interface; toda asserção
 * atravessa `inject`, a mesma superfície que um cliente HTTP usa. Frentes
 * duplicadas no mesmo Baralho recebem numeração; o mesmo Cartão em Baralho
 * diferente não numera. A forma inválida é recusada na borda.
 */

const FRENTE_VALIDA = "to walk";
const VERSO_VALIDO = "Caminhar";
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

/**
 * Envia `POST /baralhos/{id}/cartoes`. `corpo` ausente reproduz requisição sem corpo;
 * `cabecalhos` permite forçar content-type na requisição.
 */
function postarCartaoNoBaralho(
  baralhoId: string,
  corpo?: object | string,
  cabecalhos: Record<string, string> = {},
) {
  return pedir({
    method: "POST",
    url: `/baralhos/${baralhoId}/cartoes`,
    headers: cabecalhos,
    payload: corpo,
  });
}

describe("POST /baralhos/{id}/cartoes — criação conforme o contrato", () => {
  it("responde 201 com o Cartão criado: id, Frente e Verso (FR-001)", async () => {
    const baralho = await criarBaralho();

    const resposta = await postarCartaoNoBaralho(baralho.id, {
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

  it("segunda criação de mesma Frente no mesmo Baralho recebe numeração (FR-025)", async () => {
    const baralho = await criarBaralho();

    const primeira = await postarCartaoNoBaralho(baralho.id, {
      frente: FRENTE_VALIDA,
      verso: VERSO_VALIDO,
    });
    const segunda = await postarCartaoNoBaralho(baralho.id, {
      frente: FRENTE_VALIDA,
      verso: "Caminhar (2)",
    });

    expect(primeira.statusCode).toBe(201);
    expect(segunda.statusCode).toBe(201);

    const primeiroCartao = primeira.json();
    const segundoCartao = segunda.json();

    expect(primeiroCartao.frente).toBe(FRENTE_VALIDA);
    expect(segundoCartao.frente).toBe("to walk (2)");
  });

  it("mesma Frente em outro Baralho não recebe numeração", async () => {
    const baralho1 = await criarBaralho("Inglês 1");
    const baralho2 = await criarBaralho("Inglês 2");

    const primeiro = await postarCartaoNoBaralho(baralho1.id, {
      frente: FRENTE_VALIDA,
      verso: VERSO_VALIDO,
    });
    const segundo = await postarCartaoNoBaralho(baralho2.id, {
      frente: FRENTE_VALIDA,
      verso: VERSO_VALIDO,
    });

    expect(primeiro.statusCode).toBe(201);
    expect(segundo.statusCode).toBe(201);

    const primeiroCartao = primeiro.json();
    const segundoCartao = segundo.json();

    expect(primeiroCartao.frente).toBe(FRENTE_VALIDA);
    expect(segundoCartao.frente).toBe(FRENTE_VALIDA);
  });

  it("recusa Frente vazia com 400, código frente_vazia e mensagem em português (FR-002)", async () => {
    const baralho = await criarBaralho();
    const resposta = await postarCartaoNoBaralho(baralho.id, {
      frente: "",
      verso: VERSO_VALIDO,
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "frente_vazia",
      mensagem: "A frente do cartão não pode ficar vazia.",
    });
  });

  it("recusa Baralho inexistente com 404, código nao_encontrado", async () => {
    const resposta = await postarCartaoNoBaralho("baralho-inexistente", {
      frente: FRENTE_VALIDA,
      verso: VERSO_VALIDO,
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });

  it("recusa Baralho de outro Usuário com 404 e nada é criado", async () => {
    const baralho = await criarBaralho();
    const outroUsuario = await contrato.cadastrar("outro.usuario");

    const resposta = await pedirComCredencial(servidor, outroUsuario, {
      method: "POST",
      url: `/baralhos/${baralho.id}/cartoes`,
      payload: { frente: FRENTE_VALIDA, verso: VERSO_VALIDO },
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });

    // Verifica que nada foi criado no Baralho do primeiro usuário
    const leitura = await pedir({ method: "GET", url: "/cartoes" });
    expect(leitura.json()).toEqual([]);
  });

  it("POST /cartoes não existe mais (retorna 404)", async () => {
    const resposta = await pedir({
      method: "POST",
      url: "/cartoes",
      payload: { frente: FRENTE_VALIDA, verso: VERSO_VALIDO },
    });

    expect(resposta.statusCode).toBe(404);
  });

  it("GET /cartoes traz baralho para cada Cartão", async () => {
    const baralho = await criarBaralho();
    await postarCartaoNoBaralho(baralho.id, {
      frente: FRENTE_VALIDA,
      verso: VERSO_VALIDO,
    });

    const resposta = await pedir({ method: "GET", url: "/cartoes" });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual([
      expect.objectContaining({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
        baralho: { id: baralho.id, nome: NOME_DO_BARALHO },
        proximaRevisaoEm: null,
      }),
    ]);
  });
});

describe("POST /baralhos/{id}/cartoes — forma inválida recusada na borda", () => {
  it("recusa corpo sem Frente com 400 e nada é criado", async () => {
    const baralho = await criarBaralho();
    const resposta = await postarCartaoNoBaralho(baralho.id, { verso: VERSO_VALIDO });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);

    const leitura = await pedir({ method: "GET", url: "/cartoes" });
    expect(leitura.json()).toEqual([]);
  });

  it("recusa corpo que não é JSON com 400 e nada é criado", async () => {
    const baralho = await criarBaralho();
    const resposta = await postarCartaoNoBaralho(baralho.id, "isto não é json {", {
      "content-type": "application/json",
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);

    const leitura = await pedir({ method: "GET", url: "/cartoes" });
    expect(leitura.json()).toEqual([]);
  });

  it("recusa requisição sem corpo com 400 e nada é criado", async () => {
    const baralho = await criarBaralho();
    const resposta = await postarCartaoNoBaralho(baralho.id);

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);
  });
});
