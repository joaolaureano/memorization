import type { FastifyInstance, InjectOptions } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  registrarRotasDeBaralhos,
  registrarRotasDeCartoes,
} from "../../src/http/rotas.ts";
import type { CredencialDeTeste } from "../armazenamento/usuarios-de-teste.ts";
import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";

/**
 * T706 — no contrato HTTP, o conteúdo de outro Usuário é indistinguível de
 * inexistente: o mesmo `404 nao_encontrado`, com a mesma mensagem do `id` que
 * nunca existiu, e **nunca 403** (FR-090, FR-092, FR-093, FR-044, SC-028,
 * SC-030).
 *
 * Dois Usuários entram com Credenciais próprias, e cada requisição é enviada
 * com a Credencial de quem pede: o `Acervo` de cada um é construído por
 * requisição, com o dono decorado pelo hook. Sem Credencial ou com Credencial
 * inválida, nenhuma operação altera o acervo — a rota não roda (SC-028).
 */

/** A recusa de `id` inexistente, como o contrato a publica (SC-030). */
const CARTAO_NAO_ENCONTRADO = {
  erro: "nao_encontrado",
  mensagem: "Cartão não encontrado.",
};

const BARALHO_NAO_ENCONTRADO = {
  erro: "nao_encontrado",
  mensagem: "Baralho não encontrado.",
};

let contrato: ServidorDeContrato;
let servidor: FastifyInstance;
let ana: CredencialDeTeste;
let bruno: CredencialDeTeste;

beforeEach(async () => {
  contrato = await montarServidorDeContrato(({ servidor, acervoDe }) => {
    registrarRotasDeCartoes(servidor, acervoDe);
    registrarRotasDeBaralhos(servidor, acervoDe);
  });
  servidor = contrato.servidor;
  ana = contrato.credencial;
  bruno = await contrato.cadastrar("bruno.souza");
});

afterEach(async () => {
  await contrato.encerrar();
});

/** Cria um Baralho pela rota, com a Credencial informada. */
async function criarBaralho(
  credencial: CredencialDeTeste,
  nome = "Inglês",
): Promise<{ id: string }> {
  const resposta = await pedirComCredencial(servidor, credencial, {
    method: "POST",
    url: "/baralhos",
    payload: { nome },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação recusada: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string };
}

/** Cria um Cartão no Baralho, com a Credencial informada. */
async function criarCartaoNoBaralho(
  credencial: CredencialDeTeste,
  baralhoId: string,
  frente = "To walk",
): Promise<{ id: string }> {
  const resposta = await pedirComCredencial(servidor, credencial, {
    method: "POST",
    url: `/baralhos/${baralhoId}/cartoes`,
    payload: { frente, verso: "Caminhar" },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação recusada: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string };
}

describe("acervo por usuário no contrato — cada um enxerga somente o seu", () => {
  it("cada listagem traz somente o conteúdo de quem pede (SC-030)", async () => {
    const baralhoAna = await criarBaralho(ana, "Inglês");
    await criarCartaoNoBaralho(ana, baralhoAna.id, "To walk");
    const baralhoIngles = await criarBaralho(bruno, "Alemão");
    await criarCartaoNoBaralho(bruno, baralhoIngles.id, "To read");

    const cartoesDaAna = await pedirComCredencial(servidor, ana, {
      method: "GET",
      url: "/cartoes",
    });
    const cartoesDoBruno = await pedirComCredencial(servidor, bruno, {
      method: "GET",
      url: "/cartoes",
    });
    const baralhosDaAna = await pedirComCredencial(servidor, ana, {
      method: "GET",
      url: "/baralhos",
    });
    const baralhosDoBruno = await pedirComCredencial(servidor, bruno, {
      method: "GET",
      url: "/baralhos",
    });

    expect(cartoesDaAna.json()).toMatchObject([
      { frente: "To walk", baralho: { id: baralhoAna.id } },
    ]);
    expect(cartoesDoBruno.json()).toMatchObject([
      { frente: "To read", baralho: { id: baralhoIngles.id } },
    ]);
    expect(baralhosDaAna.json()).toMatchObject([
      { nome: "Inglês" },
    ]);
    expect(baralhosDoBruno.json()).toMatchObject([
      { nome: "Alemão" },
    ]);
  });

  it("o id do outro responde 404 com a mensagem de um id que nunca existiu, e jamais 403 (SC-030)", async () => {
    const baralhoBruno = await criarBaralho(bruno, "Alemão");
    const cartaoDoBruno = await criarCartaoNoBaralho(bruno, baralhoBruno.id, "To read");
    const baralhoAna = await criarBaralho(ana, "Inglês");
    const cartaoDaAna = await criarCartaoNoBaralho(ana, baralhoAna.id, "To walk");

    const edicaoDoInexistente = await pedirComCredencial(servidor, ana, {
      method: "PUT",
      url: "/cartoes/cartao-que-nunca-existiu",
      payload: { frente: "To walk", verso: "Caminhar" },
    });
    const exclusaoDoInexistente = await pedirComCredencial(servidor, ana, {
      method: "DELETE",
      url: "/cartoes/id-desconhecido",
    });
    const baralhoInexistente = await pedirComCredencial(servidor, ana, {
      method: "GET",
      url: "/baralhos/baralho-que-nunca-existiu",
    });

    const edicaoDoVizinho = await pedirComCredencial(servidor, ana, {
      method: "PUT",
      url: `/cartoes/${cartaoDoBruno.id}`,
      payload: { frente: "To drink", verso: "Beber" },
    });
    const exclusaoDoVizinho = await pedirComCredencial(servidor, ana, {
      method: "DELETE",
      url: `/cartoes/${cartaoDoBruno.id}`,
    });
    const leituraDoBaralhoDoVizinho = await pedirComCredencial(servidor, ana, {
      method: "GET",
      url: `/baralhos/${baralhoBruno.id}`,
    });
    const renomeacaoDoBaralhoDoVizinho = await pedirComCredencial(servidor, ana, {
      method: "PUT",
      url: `/baralhos/${baralhoBruno.id}`,
      payload: { nome: "Francês" },
    });

    expect(edicaoDoVizinho.statusCode).toBe(404);
    expect(edicaoDoVizinho.json()).toEqual(CARTAO_NAO_ENCONTRADO);
    expect(edicaoDoVizinho.json()).toEqual(edicaoDoInexistente.json());
    expect(exclusaoDoVizinho.statusCode).toBe(404);
    expect(exclusaoDoVizinho.json()).toEqual(exclusaoDoInexistente.json());
    expect(leituraDoBaralhoDoVizinho.statusCode).toBe(404);
    expect(leituraDoBaralhoDoVizinho.json()).toEqual(
      baralhoInexistente.json(),
    );
    expect(renomeacaoDoBaralhoDoVizinho.statusCode).toBe(404);
    expect(renomeacaoDoBaralhoDoVizinho.json()).toEqual(
      BARALHO_NAO_ENCONTRADO,
    );

    /** Jamais 403: revelar a existência seria a violação (SC-030). */
    for (const resposta of [
      edicaoDoVizinho,
      exclusaoDoVizinho,
      leituraDoBaralhoDoVizinho,
      renomeacaoDoBaralhoDoVizinho,
    ]) {
      expect(resposta.statusCode).not.toBe(403);
    }

    /** Nada do outro Usuário mudou. */
    const cartoesDoBruno = await pedirComCredencial(servidor, bruno, {
      method: "GET",
      url: "/cartoes",
    });
    const baralhosDoBruno = await pedirComCredencial(servidor, bruno, {
      method: "GET",
      url: "/baralhos",
    });

    expect(cartoesDoBruno.json()).toEqual([
      expect.objectContaining({ id: cartaoDoBruno.id, frente: "To read" }),
    ]);
    expect(baralhosDoBruno.json()).toEqual([
      expect.objectContaining({ id: baralhoBruno.id, nome: "Alemão" }),
    ]);

    /** E o próprio conteúdo continua acessível a quem é dono. */
    const baralhoProprio = await pedirComCredencial(servidor, ana, {
      method: "GET",
      url: `/baralhos/${baralhoAna.id}`,
    });
    const cartoesProprios = await pedirComCredencial(servidor, ana, {
      method: "GET",
      url: "/cartoes",
    });

    expect(baralhoProprio.statusCode).toBe(200);
    expect(baralhoProprio.json()).toEqual(
      expect.objectContaining({ id: baralhoAna.id, nome: "Inglês" }),
    );
    expect(cartoesProprios.json()).toEqual([
      expect.objectContaining({ id: cartaoDaAna.id, frente: "To walk" }),
    ]);
  });

  it("um Baralho com Cartões mostra somente a quem é dono (SC-028)", async () => {
    const baralhoAna = await criarBaralho(ana, "Inglês");
    await criarCartaoNoBaralho(ana, baralhoAna.id, "To walk");

    const doDono = await pedirComCredencial(servidor, ana, {
      method: "GET",
      url: `/baralhos/${baralhoAna.id}`,
    });
    const doVizinho = await pedirComCredencial(servidor, bruno, {
      method: "GET",
      url: `/baralhos/${baralhoAna.id}`,
    });

    expect(doDono.statusCode).toBe(200);
    expect(doDono.json()).toMatchObject({
      id: baralhoAna.id,
      nome: "Inglês",
    });
    expect(doVizinho.statusCode).toBe(404);
    expect(doVizinho.json()).toEqual(BARALHO_NAO_ENCONTRADO);
  });
});

describe("acervo por usuário — recusa de Credencial não altera nada (FR-090, SC-028)", () => {
  it("sem Credencial e com Credencial inválida, nenhuma operação altera o acervo", async () => {
    const baralhoAna = await criarBaralho(ana, "Inglês");
    const cartaoDaAna = await criarCartaoNoBaralho(ana, baralhoAna.id, "To walk");

    const semCredencial: InjectOptions[] = [
      { method: "POST", url: "/baralhos", payload: { nome: "Alemão" } },
      { method: "GET", url: "/cartoes" },
      { method: "PUT", url: `/cartoes/${cartaoDaAna.id}`, payload: { frente: "To drink", verso: "Beber" } },
      { method: "DELETE", url: `/cartoes/${cartaoDaAna.id}` },
      { method: "GET", url: "/baralhos" },
      { method: "DELETE", url: `/baralhos/${baralhoAna.id}` },
    ];

    for (const requisicao of semCredencial) {
      const recusa = await servidor.inject(requisicao);
      const invalida = await servidor.inject({
        ...requisicao,
        headers: {
          authorization: `Basic ${Buffer.from(
            `ninguem.aqui:${contrato.credencial.senha}`,
            "utf8",
          ).toString("base64")}`,
        },
      });

      const rotulo = `${requisicao.method} ${String(requisicao.url)}`;

      expect(recusa.statusCode, rotulo).toBe(401);
      expect(invalida.statusCode, rotulo).toBe(401);
    }

    /** O acervo do dono continua exatamente como estava. */
    const cartoes = await pedirComCredencial(servidor, ana, {
      method: "GET",
      url: "/cartoes",
    });
    const baralhos = await pedirComCredencial(servidor, ana, {
      method: "GET",
      url: "/baralhos",
    });

    expect(cartoes.json()).toMatchObject([
      {
        id: cartaoDaAna.id,
        frente: "To walk",
        verso: "Caminhar",
        baralho: { id: baralhoAna.id },
      },
    ]);
    expect(baralhos.json()).toMatchObject([
      {
        id: baralhoAna.id,
        nome: "Inglês",
      },
    ]);
  });
});
