import type { FastifyInstance, InjectOptions } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";
import { registrarRotasDeCartoes, registrarRotasDeBaralhos, registrarRotasDeTransicao } from "../../src/http/rotas.ts";
import type { Acervo } from "../../src/acervo/acervo.ts";


/**
 * T025 — contrato HTTP de `GET /acervo/transicao-cartoes` e
 * `POST /acervo/transicao-cartoes` (specs/025-criar-cartoes-baralho/contracts/http.md).
 *
 * O servidor é montado com o `Acervo` sobre o Adapter do armazenamento local
 * em memória; toda asserção atravessa `inject`. As rotas exigem Credencial
 * (401 sem ela), fazem segregação por Usuário, e repassam erros de domínio com
 * status e código estáveis.
 */

const NOME_DO_BARALHO = "Inglês";

let servidor: FastifyInstance;
let contrato: ServidorDeContrato;

beforeEach(async () => {
  contrato = await montarServidorDeContrato(({ servidor, acervoDe }) => {
    registrarRotasDeCartoes(servidor, acervoDe);
    registrarRotasDeBaralhos(servidor, acervoDe);
    registrarRotasDeTransicao(servidor, acervoDe);
  });
  servidor = contrato.servidor;
});

afterEach(async () => {
  await contrato.encerrar();
});

/**
 * Envia a requisição com a Credencial do Usuário que entrou.
 */
function pedir(requisicao: InjectOptions) {
  return pedirComCredencial(servidor, contrato.credencial, requisicao);
}

/**
 * Envia a requisição **sem Credencial**.
 */
function pedirSemCredencial(requisicao: InjectOptions) {
  return servidor.inject(requisicao);
}

/** Cria um Baralho; falha se a criação for recusada. */
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

describe("GET /acervo/transicao-cartoes — leitura de transição", () => {
  it("retorna 401 sem Credencial", async () => {
    const resposta = await pedirSemCredencial({
      method: "GET",
      url: "/acervo/transicao-cartoes",
    });

    expect(resposta.statusCode).toBe(401);
  });

  it("retorna 200 com base nova: cartoes vazio, baralhos da lista", async () => {
    const baralho1 = await criarBaralho("Inglês");
    const baralho2 = await criarBaralho("Alemão");

    const resposta = await pedir({
      method: "GET",
      url: "/acervo/transicao-cartoes",
    });

    expect(resposta.statusCode).toBe(200);
    const dados = resposta.json();
    expect(dados).toEqual({
      cartoes: [],
      baralhos: expect.arrayContaining([
        { id: baralho1.id, nome: "Inglês" },
        { id: baralho2.id, nome: "Alemão" },
      ]),
    });
  });

  it("retorna somente os Baralhos do Usuário autenticado", async () => {
    const baralho1 = await criarBaralho("Inglês");
    const outroUsuario = await contrato.cadastrar("outro.usuario");

    // Outro usuário cria seu próprio baralho
    await pedirComCredencial(servidor, outroUsuario, {
      method: "POST",
      url: "/baralhos",
      payload: { nome: "Francês" },
    });

    const resposta = await pedir({
      method: "GET",
      url: "/acervo/transicao-cartoes",
    });

    const dados = resposta.json();
    expect(dados.baralhos).toHaveLength(1);
    expect(dados.baralhos[0]).toEqual({
      id: baralho1.id,
      nome: "Inglês",
    });
  });
});

describe("POST /acervo/transicao-cartoes — conclusão de transição", () => {
  it("retorna 204 com escolhas vazio e nada pendente", async () => {
    const resposta = await pedir({
      method: "POST",
      url: "/acervo/transicao-cartoes",
      payload: { escolhas: [] },
    });

    expect(resposta.statusCode).toBe(204);
  });

  it("retorna 400 com corpo fora da forma", async () => {
    const respostas = [
      await pedir({
        method: "POST",
        url: "/acervo/transicao-cartoes",
        payload: { algo: "inválido" },
      }),
      await pedir({
        method: "POST",
        url: "/acervo/transicao-cartoes",
      }),
    ];

    for (const resposta of respostas) {
      expect(resposta.statusCode).toBe(400);
      expect(resposta.json()).toEqual({
        erro: "escolhas_invalidas",
        mensagem: expect.any(String),
      });
    }
  });

  it("retorna 400 quando escolhas não é array", async () => {
    const resposta = await pedir({
      method: "POST",
      url: "/acervo/transicao-cartoes",
      payload: { escolhas: "não é array" },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "escolhas_invalidas",
      mensagem: expect.any(String),
    });
  });

  it("retorna 409 conflito quando acervo retorna conflito", async () => {
    // Montamos um servidor com um Acervo falso que retorna erro de conflito
    const contratoFalso = await montarServidorDeContrato(
      ({ servidor, acervoDe: acervoOriginal }) => {
        // Substituir acervoDe por um que retorna erro
        const acervoDeFalso = (usuarioId: string) => {
          const acervo = acervoOriginal(usuarioId);
          const acervoModificado: Partial<Acervo> = {
            ...acervo,
            concluirTransicao: async () => ({
              ok: false,
              erro: "conflito",
              mensagem: "Houve um conflito ao processar as transições.",
            }),
          };
          return acervoModificado as Acervo;
        };

        registrarRotasDeCartoes(servidor, acervoDeFalso);
        registrarRotasDeBaralhos(servidor, acervoDeFalso);
        registrarRotasDeTransicao(servidor, acervoDeFalso);
      },
    );

    const resposta = await pedirComCredencial(
      contratoFalso.servidor,
      contratoFalso.credencial,
      {
        method: "POST",
        url: "/acervo/transicao-cartoes",
        payload: { escolhas: [] },
      },
    );

    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toEqual({
      erro: "conflito",
      mensagem: "Houve um conflito ao processar as transições.",
    });

    await contratoFalso.encerrar();
  });

  it("retorna 503 indisponibilidade quando acervo retorna indisponivel", async () => {
    const contratoFalso = await montarServidorDeContrato(
      ({ servidor, acervoDe: acervoOriginal }) => {
        const acervoDeFalso = (usuarioId: string) => {
          const acervo = acervoOriginal(usuarioId);
          const acervoModificado: Partial<Acervo> = {
            ...acervo,
            concluirTransicao: async () => ({
              ok: false,
              erro: "indisponivel",
              mensagem: "Armazenamento indisponível.",
            }),
          };
          return acervoModificado as Acervo;
        };

        registrarRotasDeCartoes(servidor, acervoDeFalso);
        registrarRotasDeBaralhos(servidor, acervoDeFalso);
        registrarRotasDeTransicao(servidor, acervoDeFalso);
      },
    );

    const resposta = await pedirComCredencial(
      contratoFalso.servidor,
      contratoFalso.credencial,
      {
        method: "POST",
        url: "/acervo/transicao-cartoes",
        payload: { escolhas: [] },
      },
    );

    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toEqual({
      erro: "indisponivel",
      mensagem: "Armazenamento indisponível.",
    });

    await contratoFalso.encerrar();
  });
});
