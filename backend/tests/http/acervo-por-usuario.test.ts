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

/** Cria um Cartão pela rota, com a Credencial informada. */
async function criarCartao(
  credencial: CredencialDeTeste,
  frente = "To walk",
): Promise<{ id: string }> {
  const resposta = await pedirComCredencial(servidor, credencial, {
    method: "POST",
    url: "/cartoes",
    payload: { frente, verso: "Caminhar" },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação recusada: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string };
}

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

describe("acervo por usuário no contrato — cada um enxerga somente o seu", () => {
  it("cada listagem traz somente o conteúdo de quem pede (SC-030)", async () => {
    await criarCartao(ana, "To walk");
    await criarBaralho(ana, "Inglês");
    await criarCartao(bruno, "To read");
    await criarBaralho(bruno, "Alemão");

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

    expect(cartoesDaAna.json()).toEqual([
      expect.objectContaining({ frente: "To walk" }),
    ]);
    expect(cartoesDoBruno.json()).toEqual([
      expect.objectContaining({ frente: "To read" }),
    ]);
    expect(baralhosDaAna.json()).toEqual([
      expect.objectContaining({ nome: "Inglês" }),
    ]);
    expect(baralhosDoBruno.json()).toEqual([
      expect.objectContaining({ nome: "Alemão" }),
    ]);
  });

  it("o id do outro responde 404 com a mensagem de um id que nunca existiu, e jamais 403 (SC-030)", async () => {
    const cartaoDoBruno = await criarCartao(bruno, "To read");
    const baralhoDoBruno = await criarBaralho(bruno, "Alemão");
    const cartaoDaAna = await criarCartao(ana, "To walk");
    const baralhoDaAna = await criarBaralho(ana, "Inglês");

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
      url: `/baralhos/${baralhoDoBruno.id}`,
    });
    const renomeacaoDoBaralhoDoVizinho = await pedirComCredencial(servidor, ana, {
      method: "PUT",
      url: `/baralhos/${baralhoDoBruno.id}`,
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
      expect.objectContaining({ id: baralhoDoBruno.id, nome: "Alemão" }),
    ]);

    /** E o próprio conteúdo continua acessível a quem é dono. */
    const baralhoProprio = await pedirComCredencial(servidor, ana, {
      method: "GET",
      url: `/baralhos/${baralhoDaAna.id}`,
    });
    const cartoesProprios = await pedirComCredencial(servidor, ana, {
      method: "GET",
      url: "/cartoes",
    });

    expect(baralhoProprio.statusCode).toBe(200);
    expect(baralhoProprio.json()).toEqual(
      expect.objectContaining({ id: baralhoDaAna.id, nome: "Inglês" }),
    );
    expect(cartoesProprios.json()).toEqual([
      expect.objectContaining({ id: cartaoDaAna.id, frente: "To walk" }),
    ]);
  });

  it("recusa vincular Cartão de um Usuário a Baralho de outro, com 404 e nada mudando (FR-093)", async () => {
    const cartaoDaAna = await criarCartao(ana, "To walk");
    const baralhoDoBruno = await criarBaralho(bruno, "Alemão");
    const cartaoDoBruno = await criarCartao(bruno, "To read");
    const baralhoDaAna = await criarBaralho(ana, "Inglês");

    const daAnaNoBaralhoDoBruno = await pedirComCredencial(servidor, ana, {
      method: "POST",
      url: `/baralhos/${baralhoDoBruno.id}/vinculos`,
      payload: { cartaoId: cartaoDaAna.id },
    });
    const doBrunoNoBaralhoDaAna = await pedirComCredencial(servidor, bruno, {
      method: "POST",
      url: `/baralhos/${baralhoDaAna.id}/vinculos`,
      payload: { cartaoId: cartaoDoBruno.id },
    });

    expect(daAnaNoBaralhoDoBruno.statusCode).toBe(404);
    expect(daAnaNoBaralhoDoBruno.json()).toEqual(BARALHO_NAO_ENCONTRADO);
    expect(doBrunoNoBaralhoDaAna.statusCode).toBe(404);
    expect(doBrunoNoBaralhoDaAna.json()).toEqual(BARALHO_NAO_ENCONTRADO);
    expect(daAnaNoBaralhoDoBruno.statusCode).not.toBe(403);

    /** Nenhum Baralho ficou elegível, e nada foi criado. */
    const baralhosDaAna = await pedirComCredencial(servidor, ana, {
      method: "GET",
      url: "/baralhos",
    });
    const baralhosDoBruno = await pedirComCredencial(servidor, bruno, {
      method: "GET",
      url: "/baralhos",
    });

    expect(baralhosDaAna.json()).toEqual([
      expect.objectContaining({ quantidadeDeCartoes: 0, elegivel: false }),
    ]);
    expect(baralhosDoBruno.json()).toEqual([
      expect.objectContaining({ quantidadeDeCartoes: 0, elegivel: false }),
    ]);
  });

  it("a contagem e a elegibilidade contam só os Vínculos do dono, e a Sessão carrega só os Cartões dele (FR-092, SC-028)", async () => {
    const cartaoDaAna = await criarCartao(ana, "To walk");
    const baralhoDaAna = await criarBaralho(ana, "Inglês");

    await pedirComCredencial(servidor, ana, {
      method: "POST",
      url: `/baralhos/${baralhoDaAna.id}/vinculos`,
      payload: { cartaoId: cartaoDaAna.id },
    });

    const doDono = await pedirComCredencial(servidor, ana, {
      method: "GET",
      url: `/baralhos/${baralhoDaAna.id}`,
    });
    const doVizinho = await pedirComCredencial(servidor, bruno, {
      method: "GET",
      url: `/baralhos/${baralhoDaAna.id}`,
    });

    expect(doDono.json()).toEqual({
      id: baralhoDaAna.id,
      nome: "Inglês",
      elegivel: true,
      cartoes: [
        {
          id: cartaoDaAna.id,
          frente: "To walk",
          verso: "Caminhar",
        },
      ],
    });
    expect(doVizinho.statusCode).toBe(404);
    expect(doVizinho.json()).toEqual(BARALHO_NAO_ENCONTRADO);
  });
});

describe("acervo por usuário — recusa de Credencial não altera nada (FR-090, SC-028)", () => {
  it("sem Credencial e com Credencial inválida, nenhuma operação altera o acervo", async () => {
    const cartaoDaAna = await criarCartao(ana, "To walk");

    const semCredencial: InjectOptions[] = [
      { method: "POST", url: "/cartoes", payload: { frente: "To read", verso: "Ler" } },
      { method: "GET", url: "/cartoes" },
      { method: "PUT", url: `/cartoes/${cartaoDaAna.id}`, payload: { frente: "To drink", verso: "Beber" } },
      { method: "DELETE", url: `/cartoes/${cartaoDaAna.id}` },
      { method: "POST", url: "/baralhos", payload: { nome: "Alemão" } },
      { method: "GET", url: "/baralhos" },
      { method: "DELETE", url: "/baralhos/qualquer" },
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

    expect(cartoes.json()).toEqual([
      expect.objectContaining({
        id: cartaoDaAna.id,
        frente: "To walk",
        verso: "Caminhar",
        baralhos: [],
      }),
    ]);
    expect(baralhos.json()).toEqual([]);
  });
});
