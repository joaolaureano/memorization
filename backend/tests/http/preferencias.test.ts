import type { FastifyInstance, InjectOptions } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";
import { registrarRotasDePreferencias } from "../../src/http/rotas.ts";

/**
 * T1514 — contrato HTTP das Preferências de repetição
 * (`specs/015-repeticao-espacada/contracts/contratos.md`, §4).
 *
 * O servidor é montado como na aplicação, com o hook que exige a Credencial, e
 * só as rotas de Preferências entram: o objeto do teste é o algoritmo e o
 * limite de Cartões novos por dia que a tela de Preferências lê e grava
 * (FR-212). Toda asserção atravessa `inject`, a mesma superfície que um
 * cliente HTTP usa.
 */

let servidor: FastifyInstance;
let contrato: ServidorDeContrato;

beforeEach(async () => {
  contrato = await montarServidorDeContrato(({ servidor, acervoDe }) => {
    registrarRotasDePreferencias(servidor, acervoDe);
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

/** O padrão do Usuário sem linha de Preferências: SM-2. */
const PADRAO = {
  algoritmo: "sm2",
  algoritmos: [{ id: "sm2", rotulo: "SM-2" }],
};

const DADOS_DAS_PREFERENCIAS_INVALIDOS = {
  erro: "dados_invalidos",
  mensagem: "Os dados das Preferências são inválidos.",
};

describe("GET /preferencias — leitura conforme o contrato (FR-212)", () => {
  it("devolve SM-2 com a lista de algoritmos", async () => {
    const resposta = await pedir({ method: "GET", url: "/preferencias" });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual(PADRAO);
  });

  it("recusa sem Credencial com 401 (FR-090)", async () => {
    const resposta = await servidor.inject({
      method: "GET",
      url: "/preferencias",
    });

    expect(resposta.statusCode).toBe(401);
  });
});

describe("PUT /preferencias — gravação conforme o contrato (FR-212)", () => {
  it("salva o algoritmo e devolve o mesmo corpo do GET", async () => {
    const resposta = await pedir({
      method: "PUT",
      url: "/preferencias",
      payload: { algoritmo: "sm2" },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual(PADRAO);

    const leitura = await pedir({ method: "GET", url: "/preferencias" });
    expect(leitura.statusCode).toBe(200);
    expect(leitura.json()).toEqual(PADRAO);
  });

  it("ignora o antigo limite de Cartões novos por dia, se vier no corpo", async () => {
    const resposta = await pedir({
      method: "PUT",
      url: "/preferencias",
      payload: { algoritmo: "sm2", limiteDeNovosPorDia: 1000 },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual(PADRAO);
  });

  it("recusa corpo sem algoritmo com 400 (FR-212)", async () => {
    const resposta = await pedir({
      method: "PUT",
      url: "/preferencias",
      payload: {},
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(DADOS_DAS_PREFERENCIAS_INVALIDOS);
  });

  it("recusa algoritmo desconhecido com 400 (FR-212)", async () => {
    const resposta = await pedir({
      method: "PUT",
      url: "/preferencias",
      payload: { algoritmo: "desconhecido" },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(DADOS_DAS_PREFERENCIAS_INVALIDOS);
  });

  it("recusa sem Credencial com 401 (FR-090)", async () => {
    const resposta = await servidor.inject({
      method: "PUT",
      url: "/preferencias",
      payload: { algoritmo: "sm2" },
    });

    expect(resposta.statusCode).toBe(401);
  });
});
