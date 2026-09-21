import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  criarAcervo,
  type Acervo,
  type Baralho,
  type Cartao,
  type ResultadoDeCriacaoDeBaralho,
  type ResultadoDeCriacaoDeCartao,
} from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/**
 * T205 — `obterBaralho` devolve o Baralho com a elegibilidade derivada e os
 * Cartões vinculados, conforme o contrato de `GET /baralhos/{id}` (FR-014).
 *
 * Toda asserção atravessa a Interface (`criarBaralho`, `criarCartao`,
 * `vincular` e `obterBaralho`) sobre o Adapter do armazenamento local em
 * memória; nenhum teste inspeciona a tabela. A ordem dos Cartões não é
 * pré-condição do contrato, portanto as asserções comparam conjuntos, nunca
 * posições.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";
const NOME_VALIDO = "Inglês";

let aberto: ArmazenamentoSqliteAberto;
let acervo: Acervo;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  /**
   * O acervo é de um **dono**: todo Cartão e todo Baralho pertencem a um
   * Usuário, e a Interface do `Acervo` recebe o dono na construção (FR-092).
   */
  const dono = await criarDonoDeTeste(aberto.usuarios);

  acervo = criarAcervo(aberto.armazenamento, dono);
});

afterEach(async () => {
  await aberto.encerrar();
});

/** Desembrulha o Baralho de uma criação aceita; falha se foi recusada. */
function baralhoDo(resultado: ResultadoDeCriacaoDeBaralho): Baralho {
  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.baralho;
}

/** Desembrulha o Cartão de uma criação aceita; falha se foi recusada. */
function cartaoDo(resultado: ResultadoDeCriacaoDeCartao): Cartao {
  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.cartao;
}

async function criarBaralho(nome = NOME_VALIDO): Promise<Baralho> {
  return baralhoDo(await acervo.criarBaralho({ nome }));
}

async function criarCartao(frente: string, verso: string): Promise<Cartao> {
  return cartaoDo(await acervo.criarCartao({ frente, verso }));
}

describe("obterBaralho — leitura pela Interface", () => {
  it("recusa Baralho inexistente com código nao_encontrado e mensagem em português", async () => {
    expect(await acervo.obterBaralho("baralho-inexistente")).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });

  it("devolve Baralho sem Cartões como não elegível, com cartoes vazio", async () => {
    const baralho = await criarBaralho();

    expect(await acervo.obterBaralho(baralho.id)).toEqual({
      ok: true,
      baralho: {
        id: baralho.id,
        nome: NOME_VALIDO,
        elegivel: false,
        cartoes: [],
      },
    });
  });

  it("devolve Baralho elegível com os três Cartões vinculados", async () => {
    const baralho = await criarBaralho();
    const primeiro = await criarCartao("To walk", "Caminhar");
    const segundo = await criarCartao("To run", "Correr");
    const terceiro = await criarCartao("To sleep", "Dormir");

    for (const cartao of [primeiro, segundo, terceiro]) {
      await acervo.vincular(cartao.id, baralho.id);
    }

    const resultado = await acervo.obterBaralho(baralho.id);

    expect(resultado).toEqual({
      ok: true,
      baralho: {
        id: baralho.id,
        nome: NOME_VALIDO,
        elegivel: true,
        cartoes: expect.arrayContaining([primeiro, segundo, terceiro]),
      },
    });
    expect(resultado.ok ? resultado.baralho.cartoes : []).toHaveLength(3);
  });

  it("deriva a elegibilidade da presença de Cartões, nunca de coluna", async () => {
    const baralho = await criarBaralho();
    const cartao = await criarCartao(FRENTE_VALIDA, VERSO_VALIDO);

    const antes = await acervo.obterBaralho(baralho.id);

    expect(antes).toEqual({
      ok: true,
      baralho: {
        id: baralho.id,
        nome: NOME_VALIDO,
        elegivel: false,
        cartoes: [],
      },
    });

    await acervo.vincular(cartao.id, baralho.id);

    expect(await acervo.obterBaralho(baralho.id)).toEqual({
      ok: true,
      baralho: {
        id: baralho.id,
        nome: NOME_VALIDO,
        elegivel: true,
        cartoes: [cartao],
      },
    });

    await acervo.desvincular(cartao.id, baralho.id);

    expect(await acervo.obterBaralho(baralho.id)).toEqual({
      ok: true,
      baralho: {
        id: baralho.id,
        nome: NOME_VALIDO,
        elegivel: false,
        cartoes: [],
      },
    });
  });
});
