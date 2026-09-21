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
 * T203 e T204 — `Acervo` vincula e desvincula pela sua Interface.
 *
 * Toda asserção atravessa a Interface (`criarCartao`, `criarBaralho`,
 * `vincular`, `desvincular`, `listarBaralhos` e `listarCartoes`) sobre o
 * Adapter do armazenamento local em memória; nenhum teste inspeciona a tabela.
 * A recusa de duplicata vem da chave composta do esquema do Adapter e chega
 * pela Porta como `vinculo_duplicado`, traduzida em `vinculo_duplicado` —
 * nenhum desfecho de armazenamento vaza para o caller. Desvincular preserva
 * Cartão e Baralho (FR-021) e a elegibilidade é reavaliada na leitura (FR-024).
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

/** Desembrulha o Cartão de uma criação aceita; falha se foi recusada. */
function cartaoDo(resultado: ResultadoDeCriacaoDeCartao): Cartao {
  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.cartao;
}

/** Desembrulha o Baralho de uma criação aceita; falha se foi recusada. */
function baralhoDo(resultado: ResultadoDeCriacaoDeBaralho): Baralho {
  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.baralho;
}

/** Cria um Cartão válido pela Interface. */
async function criarCartao(): Promise<Cartao> {
  return cartaoDo(
    await acervo.criarCartao({ frente: FRENTE_VALIDA, verso: VERSO_VALIDO }),
  );
}

/** Cria um Baralho válido pela Interface. */
async function criarBaralho(nome = NOME_VALIDO): Promise<Baralho> {
  return baralhoDo(await acervo.criarBaralho({ nome }));
}

describe("vincular — criação de Vínculo pela Interface", () => {
  it("vincula um Cartão existente a um Baralho existente e torna o Baralho elegível", async () => {
    const cartao = await criarCartao();
    const baralho = await criarBaralho();

    expect(await acervo.vincular(cartao.id, baralho.id)).toEqual({ ok: true });

    expect(await acervo.listarBaralhos()).toEqual([
      {
        id: baralho.id,
        nome: NOME_VALIDO,
        quantidadeDeCartoes: 1,
        elegivel: true,
      },
    ]);
    expect(await acervo.listarCartoes()).toEqual([
      { ...cartao, baralhos: [baralho] },
    ]);
  });

  it("recusa Vínculo duplicado com código estável e mensagem em português (FR-023, SC-009)", async () => {
    const cartao = await criarCartao();
    const baralho = await criarBaralho();

    expect(await acervo.vincular(cartao.id, baralho.id)).toEqual({ ok: true });
    expect(await acervo.vincular(cartao.id, baralho.id)).toEqual({
      ok: false,
      erro: "vinculo_duplicado",
      mensagem: "O vínculo já existe.",
    });

    // O esquema é a autoridade da unicidade: a recusa não deixou duplicata.
    const listados = await acervo.listarBaralhos();

    expect(listados).toHaveLength(1);
    expect(listados[0].quantidadeDeCartoes).toBe(1);
  });

  it("recusa Cartão inexistente com código nao_encontrado e mensagem em português", async () => {
    const baralho = await criarBaralho();

    expect(await acervo.vincular("cartao-inexistente", baralho.id)).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Cartão não encontrado.",
    });
  });

  it("recusa Baralho inexistente com código nao_encontrado e mensagem em português", async () => {
    const cartao = await criarCartao();

    expect(await acervo.vincular(cartao.id, "baralho-inexistente")).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });

  it("aceita um Cartão vinculado a 20 Baralhos e um Baralho com 60 Cartões", async () => {
    const cartao = await criarCartao();

    for (let i = 0; i < 20; i += 1) {
      const baralho = await criarBaralho(`Baralho ${i}`);

      expect(await acervo.vincular(cartao.id, baralho.id)).toEqual({ ok: true });
    }

    const baralho = await criarBaralho("Baralho grande");

    for (let i = 0; i < 60; i += 1) {
      const cartaoDoLote = await criarCartao();

      expect(await acervo.vincular(cartaoDoLote.id, baralho.id)).toEqual({
        ok: true,
      });
    }

    expect(await acervo.listarCartoes()).toHaveLength(61);
    expect(
      (await acervo.listarBaralhos()).find(
        (listado) => listado.id === baralho.id,
      )?.quantidadeDeCartoes,
    ).toBe(60);
  });
});

describe("desvincular — remoção de Vínculo pela Interface", () => {
  it("desvincula preservando Cartão e Baralho", async () => {
    const cartao = await criarCartao();
    const baralho = await criarBaralho();

    await acervo.vincular(cartao.id, baralho.id);
    expect(await acervo.desvincular(cartao.id, baralho.id)).toEqual({
      ok: true,
    });

    expect(await acervo.listarCartoes()).toEqual([{ ...cartao, baralhos: [] }]);
    expect(await acervo.listarBaralhos()).toEqual([
      {
        id: baralho.id,
        nome: NOME_VALIDO,
        quantidadeDeCartoes: 0,
        elegivel: false,
      },
    ]);
  });

  it("recusa Vínculo inexistente com código estável e mensagem em português", async () => {
    const cartao = await criarCartao();
    const baralho = await criarBaralho();

    expect(await acervo.desvincular(cartao.id, baralho.id)).toEqual({
      ok: false,
      erro: "vinculo_nao_encontrado",
      mensagem: "O vínculo não existe.",
    });
  });

  it("faz o Baralho perder a elegibilidade ao perder o último Cartão, preservando-o", async () => {
    const cartao = await criarCartao();
    const baralho = await criarBaralho();

    await acervo.vincular(cartao.id, baralho.id);

    expect((await acervo.listarBaralhos())[0].elegivel).toBe(true);

    await acervo.desvincular(cartao.id, baralho.id);

    const [listado] = await acervo.listarBaralhos();

    expect(listado.elegivel).toBe(false);
    expect(listado.quantidadeDeCartoes).toBe(0);
    expect(await acervo.listarCartoes()).toEqual([{ ...cartao, baralhos: [] }]);
  });
});
