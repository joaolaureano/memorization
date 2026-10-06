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
} from "../../src/http/rotas.ts";

/**
 * T039 — contrato HTTP de `POST /baralhos/de-selecao`
 * (specs/025-criar-cartoes-baralho/contracts/http.md).
 *
 * O servidor é montado como na aplicação, com o `Acervo` sobre o Adapter do
 * armazenamento local em memória e o Adapter HTTP registrado sobre a sua
 * Interface; toda asserção atravessa `inject`, a mesma superfície que um
 * cliente HTTP usa. Os Cartões da seleção são criados antes em um Baralho de
 * origem, de modo que o teste percorre o caminho real do Usuário. O `id`
 * enviado pelo cliente é o que torna o reenvio idempotente — `201` na primeira
 * vez, `200` na seguinte, sempre um único Baralho. As cópias têm ids novos e
 * Frentes numeradas quando repetidas na seleção.
 */

const NOME_VALIDO = "Inglês para a próxima viagem";

const DADOS_DA_SELECAO_INVALIDOS = {
  erro: "dados_invalidos",
  mensagem: "Os dados da seleção são inválidos.",
};

let servidor: FastifyInstance;
let contrato: ServidorDeContrato;

beforeEach(async () => {
  contrato = await montarServidorDeContrato(({ servidor, acervoDe }) => {
    registrarRotasDeBaralhos(servidor, acervoDe);
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

/** Cria um Baralho de origem; falha se a criação for recusada. */
async function criarBaralho(): Promise<{ id: string; nome: string }> {
  const resposta = await pedir({
    method: "POST",
    url: "/baralhos",
    payload: { nome: "Baralho de Origem" },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação de baralho recusada: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string; nome: string };
}

/**
 * Cria um Cartão no Baralho de origem via `POST /baralhos/{id}/cartoes` e
 * devolve o seu `id`; o Cartão é o insumo da seleção que será salva como Baralho.
 */
async function criarCartaoNoBaralho(
  baralhoId: string,
  frente: string,
  verso: string,
): Promise<string> {
  const resposta = await pedir({
    method: "POST",
    url: `/baralhos/${baralhoId}/cartoes`,
    payload: { frente, verso },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(
      `Cartão de apoio não foi criado: ${resposta.statusCode} ${resposta.body}`,
    );
  }

  return resposta.json().id as string;
}

/**
 * Envia `POST /baralhos/de-selecao`. O `corpo` é montado a cada caso para que
 * o `id` da tentativa seja explícito e reproduzível.
 */
function postarSelecao(corpo: object | string) {
  return pedir({
    method: "POST",
    url: "/baralhos/de-selecao",
    payload: corpo,
  });
}

/** Lê os Baralhos do Usuário que entrou. */
function lerBaralhos() {
  return pedir({ method: "GET", url: "/baralhos" });
}

describe("POST /baralhos/de-selecao — salvar a seleção como Baralho", () => {
  it("responde 201 e cria cópias com ids diferentes (T039)", async () => {
    const baralho = await criarBaralho();
    const primeiro = await criarCartaoNoBaralho(baralho.id, "How are you?", "Como você está?");
    const segundo = await criarCartaoNoBaralho(baralho.id, "Good morning", "Bom dia");

    const resposta = await postarSelecao({
      id: randomUUID(),
      nome: NOME_VALIDO,
      cartaoIds: [primeiro, segundo],
    });

    expect(resposta.statusCode).toBe(201);
    const baralhoNovo = resposta.json();
    expect(baralhoNovo).toEqual({
      id: expect.any(String),
      nome: NOME_VALIDO,
    });

    const leitura = await lerBaralhos();
    expect(leitura.statusCode).toBe(200);
    expect(leitura.json()).toHaveLength(2);
    const novoBaralho = leitura.json().find((b: { id: string }) => b.id === baralhoNovo.id);
    expect(novoBaralho).toMatchObject({
      id: baralhoNovo.id,
      nome: NOME_VALIDO,
      quantidadeDeCartoes: 2,
    });

    // Verifica que os Cartões foram copiados com ids novos
    const cartoes = await pedir({ method: "GET", url: "/cartoes" });
    const copias = cartoes.json().filter((c: { baralho: { id: string } }) => c.baralho.id === baralhoNovo.id);
    expect(copias).toHaveLength(2);
    expect(copias.every((c: { id: string }) => c.id !== primeiro && c.id !== segundo)).toBe(true);
  });

  it("responde 200 no reenvio do mesmo id, sem duplicar o Baralho (FR-372)", async () => {
    const baralho = await criarBaralho();
    const cartao = await criarCartaoNoBaralho(baralho.id, "How are you?", "Como você está?");
    const corpo = {
      id: randomUUID(),
      nome: NOME_VALIDO,
      cartaoIds: [cartao],
    };

    const primeira = await postarSelecao(corpo);
    const segunda = await postarSelecao(corpo);

    expect(primeira.statusCode).toBe(201);
    expect(segunda.statusCode).toBe(200);
    expect(segunda.json()).toEqual(primeira.json());

    const leitura = await lerBaralhos();
    const baralhos = leitura.json();
    const criadosComNomeValido = baralhos.filter((b: { nome: string }) => b.nome === NOME_VALIDO);
    expect(criadosComNomeValido).toHaveLength(1);
  });

  it("recusa nome vazio com 400, código nome_vazio e mensagem em português (FR-373)", async () => {
    const baralho = await criarBaralho();
    const cartao = await criarCartaoNoBaralho(baralho.id, "How are you?", "Como você está?");

    const resposta = await postarSelecao({
      id: randomUUID(),
      nome: "   ",
      cartaoIds: [cartao],
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "nome_vazio",
      mensagem: "O nome do baralho não pode ficar vazio.",
    });

    const leitura = await lerBaralhos();
    const baralhos = leitura.json();
    const criadosComNomeValido = baralhos.filter((b: { nome: string }) => b.nome === NOME_VALIDO);
    expect(criadosComNomeValido).toHaveLength(0);
  });

  it("recusa cartaoIds vazio com 400 dados_invalidos e nada é criado (FR-374)", async () => {
    const resposta = await postarSelecao({
      id: randomUUID(),
      nome: NOME_VALIDO,
      cartaoIds: [],
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(DADOS_DA_SELECAO_INVALIDOS);

    const leitura = await lerBaralhos();
    const baralhos = leitura.json();
    const criadosComNomeValido = baralhos.filter((b: { nome: string }) => b.nome === NOME_VALIDO);
    expect(criadosComNomeValido).toHaveLength(0);
  });

  it("recusa id que não é UUID com 400 dados_invalidos e nada é criado (FR-374)", async () => {
    const baralho = await criarBaralho();
    const cartao = await criarCartaoNoBaralho(baralho.id, "How are you?", "Como você está?");

    const resposta = await postarSelecao({
      id: "não-é-um-uuid",
      nome: NOME_VALIDO,
      cartaoIds: [cartao],
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(DADOS_DA_SELECAO_INVALIDOS);

    const leitura = await lerBaralhos();
    const baralhos = leitura.json();
    const criadosComNomeValido = baralhos.filter((b: { nome: string }) => b.nome === NOME_VALIDO);
    expect(criadosComNomeValido).toHaveLength(0);
  });

  it("responde 409 cartoes_indisponiveis com o id inexistente e nenhum Baralho novo (FR-374)", async () => {
    const inexistente = randomUUID();

    const resposta = await postarSelecao({
      id: randomUUID(),
      nome: NOME_VALIDO,
      cartaoIds: [inexistente],
    });

    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toEqual({
      erro: "cartoes_indisponiveis",
      mensagem: "Alguns cartões não estão mais disponíveis.",
      cartaoIds: [inexistente],
    });

    const leitura = await lerBaralhos();
    const baralhos = leitura.json();
    const criadosComNomeValido = baralhos.filter((b: { nome: string }) => b.nome === NOME_VALIDO);
    expect(criadosComNomeValido).toHaveLength(0);
  });

  it("responde 401 sem Credencial (FR-090)", async () => {
    const resposta = await servidor.inject({
      method: "POST",
      url: "/baralhos/de-selecao",
      payload: {
        id: randomUUID(),
        nome: NOME_VALIDO,
        cartaoIds: [randomUUID()],
      },
    });

    expect(resposta.statusCode).toBe(401);
  });
});
