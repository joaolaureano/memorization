import { randomUUID } from "node:crypto";

import type { FastifyInstance, InjectOptions } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";
import {
  registrarRotasDeCartoes,
  registrarRotasDeRevisao,
} from "../../src/http/rotas.ts";

/**
 * T1514 — contrato HTTP da Revisão do dia
 * (`specs/015-repeticao-espacada/contracts/contratos.md`, §4).
 *
 * O servidor é montado como na aplicação, com o hook que exige a Credencial: as
 * rotas de Cartão entram só para dar existência real ao acervo — é por elas que
 * o Resumo conta os Cartões novos e o lote tem Cartões para devolver —, e as
 * rotas de Revisão são o objeto do teste. Toda asserção atravessa `inject`, a
 * mesma superfície que um cliente HTTP usa.
 */

let servidor: FastifyInstance;
let contrato: ServidorDeContrato;

beforeEach(async () => {
  contrato = await montarServidorDeContrato(({ servidor, acervoDe }) => {
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

/**
 * Os limites do dia local do **navegador**, como o Module de dia os produz
 * (FR-204, D3): meia-noite local até a meia-noite seguinte.
 */
function limitesDeHoje(): { inicioDoDia: string; fimDoDia: string } {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);

  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 1);

  return { inicioDoDia: inicio.toISOString(), fimDoDia: fim.toISOString() };
}

/** A consulta de `GET /revisao` e de `GET /revisao/lote`. */
function consultaDaJanela(inicioDoDia: string, fimDoDia: string): string {
  return `inicioDoDia=${encodeURIComponent(
    inicioDoDia,
  )}&fimDoDia=${encodeURIComponent(fimDoDia)}`;
}

function lerResumo(inicioDoDia: string, fimDoDia: string) {
  return pedir({
    method: "GET",
    url: `/revisao?${consultaDaJanela(inicioDoDia, fimDoDia)}`,
  });
}

function lerLote(inicioDoDia: string, fimDoDia: string) {
  return pedir({
    method: "GET",
    url: `/revisao/lote?${consultaDaJanela(inicioDoDia, fimDoDia)}`,
  });
}

/** Cria um Cartão real e devolve o seu identificador. */
async function criarCartao(): Promise<string> {
  const resposta = await pedir({
    method: "POST",
    url: "/cartoes",
    payload: { frente: "casa", verso: "house" },
  });
  expect(resposta.statusCode).toBe(201);
  return resposta.json().id as string;
}

const DADOS_DA_REVISAO_INVALIDOS = {
  erro: "dados_invalidos",
  mensagem: "Os dados da Revisão são inválidos.",
};

describe("GET /revisao — Resumo da Revisão do dia (FR-198, FR-199)", () => {
  it("conta os Cartões novos disponíveis hoje e nenhum vencido (FR-199)", async () => {
    await criarCartao();
    await criarCartao();
    await criarCartao();
    const { inicioDoDia, fimDoDia } = limitesDeHoje();

    const resposta = await lerResumo(inicioDoDia, fimDoDia);

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ vencidos: 0, novosHoje: 3, total: 3 });
  });

  it("devolve zeros quando o Usuário não tem Cartão (FR-198)", async () => {
    const { inicioDoDia, fimDoDia } = limitesDeHoje();

    const resposta = await lerResumo(inicioDoDia, fimDoDia);

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ vencidos: 0, novosHoje: 0, total: 0 });
  });

  it("recusa limites que não são instantes ISO-8601 com 400 (FR-204)", async () => {
    const resposta = await lerResumo("ontem", "hoje");

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(DADOS_DA_REVISAO_INVALIDOS);
  });

  it("recusa janela com o início depois do fim com 400 (FR-204)", async () => {
    const { inicioDoDia, fimDoDia } = limitesDeHoje();

    const resposta = await lerResumo(fimDoDia, inicioDoDia);

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(DADOS_DA_REVISAO_INVALIDOS);
  });

  it("recusa a ausência dos limites com 400 (FR-204)", async () => {
    const resposta = await pedir({ method: "GET", url: "/revisao" });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(DADOS_DA_REVISAO_INVALIDOS);
  });

  it("recusa sem Credencial com 401 (FR-090)", async () => {
    const { inicioDoDia, fimDoDia } = limitesDeHoje();

    const resposta = await servidor.inject({
      method: "GET",
      url: `/revisao?${consultaDaJanela(inicioDoDia, fimDoDia)}`,
    });

    expect(resposta.statusCode).toBe(401);
  });

  it("não conta os Cartões de outro Usuário (FR-219)", async () => {
    await criarCartao();
    const outra = await contrato.cadastrar("outra");
    const { inicioDoDia, fimDoDia } = limitesDeHoje();

    const resposta = await pedirComCredencial(servidor, outra, {
      method: "GET",
      url: `/revisao?${consultaDaJanela(inicioDoDia, fimDoDia)}`,
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ vencidos: 0, novosHoje: 0, total: 0 });
  });
});

describe("GET /revisao/lote — lote com a prévia de cada Cartão (FR-201, FR-221)", () => {
  it("devolve os Cartões novos, cada um com a prévia dos quatro níveis (FR-221)", async () => {
    await criarCartao();
    await criarCartao();
    const { inicioDoDia, fimDoDia } = limitesDeHoje();

    const resposta = await lerLote(inicioDoDia, fimDoDia);

    expect(resposta.statusCode).toBe(200);

    const itens = resposta.json().itens as {
      cartao: { id: string };
      previa: Record<string, string>;
    }[];

    expect(itens).toHaveLength(2);

    for (const item of itens) {
      expect(Object.keys(item.previa).sort()).toEqual([
        "bom",
        "dificil",
        "errei",
        "facil",
      ]);

      for (const iso of Object.values(item.previa)) {
        expect(Number.isNaN(Date.parse(iso))).toBe(false);
      }
    }
  });

  it("recusa janela inválida com 400 (FR-204)", async () => {
    const resposta = await pedir({
      method: "GET",
      url: "/revisao/lote?inicioDoDia=ontem&fimDoDia=hoje",
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(DADOS_DA_REVISAO_INVALIDOS);
  });

  it("recusa sem Credencial com 401 (FR-090)", async () => {
    const { inicioDoDia, fimDoDia } = limitesDeHoje();

    const resposta = await servidor.inject({
      method: "GET",
      url: `/revisao/lote?${consultaDaJanela(inicioDoDia, fimDoDia)}`,
    });

    expect(resposta.statusCode).toBe(401);
  });
});

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
