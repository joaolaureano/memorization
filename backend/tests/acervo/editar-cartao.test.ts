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

/**
 * T401 — `Acervo` edita Cartão pela sua Interface, reaplicando as regras da
 * criação e preservando Vínculos.
 *
 * Toda asserção atravessa a Interface (`criarCartao`, `criarBaralho`,
 * `vincular`, `editarCartao`, `listarCartoes` e `obterBaralho`) sobre o Adapter
 * do armazenamento local em memória; nenhum teste inspeciona a tabela. A edição
 * altera o Cartão, não cópias: a Frente e o Verso novos valem em todos os
 * Baralhos a que ele está vinculado (FR-005). As regras de conteúdo são as
 * mesmas da criação (FR-002, FR-051, FR-052) e Cartão inexistente é recusado
 * como `nao_encontrado`.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";
const FRENTE_EDITADA = "To stroll";
const VERSO_EDITADO = "Passear";

let aberto: ArmazenamentoSqliteAberto;
let acervo: Acervo;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  acervo = criarAcervo(aberto.armazenamento);
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
async function criarCartao(
  frente = FRENTE_VALIDA,
  verso = VERSO_VALIDO,
): Promise<Cartao> {
  return cartaoDo(await acervo.criarCartao({ frente, verso }));
}

/** Cria um Baralho válido pela Interface. */
async function criarBaralho(nome: string): Promise<Baralho> {
  return baralhoDo(await acervo.criarBaralho({ nome }));
}

describe("editarCartao — edição pela Interface", () => {
  it("edita Frente e Verso e devolve o Cartão atualizado", async () => {
    const cartao = await criarCartao();

    expect(
      await acervo.editarCartao(cartao.id, {
        frente: FRENTE_EDITADA,
        verso: VERSO_EDITADO,
      }),
    ).toEqual({
      ok: true,
      cartao: {
        id: cartao.id,
        frente: FRENTE_EDITADA,
        verso: VERSO_EDITADO,
      },
    });

    expect(await acervo.listarCartoes()).toEqual([
      { ...cartao, frente: FRENTE_EDITADA, verso: VERSO_EDITADO, baralhos: [] },
    ]);
  });

  it("propaga a edição a todos os Baralhos a que o Cartão está vinculado", async () => {
    const cartao = await criarCartao();
    const baralhos = await Promise.all(
      ["Inglês", "Espanhol", "Francês"].map(criarBaralho),
    );

    for (const baralho of baralhos) {
      expect(await acervo.vincular(cartao.id, baralho.id)).toEqual({ ok: true });
    }

    const resultado = await acervo.editarCartao(cartao.id, {
      frente: FRENTE_EDITADA,
      verso: VERSO_EDITADO,
    });

    expect(resultado).toEqual({
      ok: true,
      cartao: {
        id: cartao.id,
        frente: FRENTE_EDITADA,
        verso: VERSO_EDITADO,
      },
    });

    for (const baralho of baralhos) {
      const obtido = await acervo.obterBaralho(baralho.id);

      expect(obtido).toEqual({
        ok: true,
        baralho: {
          id: baralho.id,
          nome: baralho.nome,
          elegivel: true,
          cartoes: [
            {
              id: cartao.id,
              frente: FRENTE_EDITADA,
              verso: VERSO_EDITADO,
            },
          ],
        },
      });
    }

    expect(await acervo.listarCartoes()).toEqual([
      {
        id: cartao.id,
        frente: FRENTE_EDITADA,
        verso: VERSO_EDITADO,
        baralhos: expect.arrayContaining(baralhos),
      },
    ]);
  });

  it("recusa Frente vazia com a mesma mensagem da criação", async () => {
    const cartao = await criarCartao();

    expect(
      await acervo.editarCartao(cartao.id, {
        frente: "",
        verso: VERSO_EDITADO,
      }),
    ).toEqual({
      ok: false,
      erro: "frente_vazia",
      mensagem: "A frente do cartão não pode ficar vazia.",
    });

    expect(await acervo.listarCartoes()).toEqual([{ ...cartao, baralhos: [] }]);
  });

  it("trata Frente composta só de espaços como vazia", async () => {
    const cartao = await criarCartao();

    expect(
      await acervo.editarCartao(cartao.id, {
        frente: "   ",
        verso: VERSO_EDITADO,
      }),
    ).toEqual({
      ok: false,
      erro: "frente_vazia",
      mensagem: "A frente do cartão não pode ficar vazia.",
    });
  });

  it("recusa Frente acima de 1000 caracteres com a mesma mensagem da criação (SC-016)", async () => {
    const cartao = await criarCartao();

    expect(
      await acervo.editarCartao(cartao.id, {
        frente: "a".repeat(1001),
        verso: VERSO_EDITADO,
      }),
    ).toEqual({
      ok: false,
      erro: "frente_muito_longa",
      mensagem:
        "A frente do cartão deve ter no máximo 1000 caracteres; a informada tem 1001.",
    });

    expect(await acervo.listarCartoes()).toEqual([{ ...cartao, baralhos: [] }]);
  });

  it("recusa Verso acima de 1000 caracteres na edição e não altera o Cartão (SC-016)", async () => {
    const cartao = await criarCartao();

    expect(
      await acervo.editarCartao(cartao.id, {
        frente: FRENTE_EDITADA,
        verso: "a".repeat(1001),
      }),
    ).toEqual({
      ok: false,
      erro: "verso_muito_longo",
      mensagem:
        "O verso do cartão deve ter no máximo 1000 caracteres; o informado tem 1001.",
    });

    expect(await acervo.listarCartoes()).toEqual([{ ...cartao, baralhos: [] }]);
  });

  it("recusa Cartão inexistente como nao_encontrado", async () => {
    expect(
      await acervo.editarCartao("cartao-inexistente", {
        frente: FRENTE_EDITADA,
        verso: VERSO_EDITADO,
      }),
    ).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Cartão não encontrado.",
    });
  });
});
