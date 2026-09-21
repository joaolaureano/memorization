import type { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  criarAcervo,
  type Acervo,
  type Baralho,
  type Cartao,
  type ResultadoDeCriacaoDeBaralho,
  type ResultadoDeCriacaoDeCartao,
} from "../../src/acervo/acervo.ts";
import { abrirBanco } from "../../src/acervo/esquema.ts";

/**
 * T401 — `Acervo` edita Cartão pela sua Interface, reaplicando as regras da
 * criação e preservando Vínculos.
 *
 * Toda asserção atravessa a Interface (`criarCartao`, `criarBaralho`,
 * `vincular`, `editarCartao`, `listarCartoes` e `obterBaralho`) sobre SQLite
 * em memória; nenhum teste inspeciona a tabela. A edição altera o Cartão, não
 * cópias: a Frente e o Verso novos valem em todos os Baralhos a que ele está
 * vinculado (FR-005). As regras de conteúdo são as mesmas da criação
 * (FR-002, FR-051, FR-052) e Cartão inexistente é recusado como
 * `nao_encontrado`.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";
const FRENTE_EDITADA = "To stroll";
const VERSO_EDITADO = "Passear";

let banco: DatabaseSync;
let acervo: Acervo;

beforeEach(() => {
  banco = abrirBanco(":memory:");
  acervo = criarAcervo(banco);
});

afterEach(() => {
  banco.close();
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
function criarCartao(frente = FRENTE_VALIDA, verso = VERSO_VALIDO): Cartao {
  return cartaoDo(acervo.criarCartao({ frente, verso }));
}

/** Cria um Baralho válido pela Interface. */
function criarBaralho(nome: string): Baralho {
  return baralhoDo(acervo.criarBaralho({ nome }));
}

describe("editarCartao — edição pela Interface", () => {
  it("edita Frente e Verso e devolve o Cartão atualizado", () => {
    const cartao = criarCartao();

    expect(
      acervo.editarCartao(cartao.id, {
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

    expect(acervo.listarCartoes()).toEqual([
      { ...cartao, frente: FRENTE_EDITADA, verso: VERSO_EDITADO, baralhos: [] },
    ]);
  });

  it("propaga a edição a todos os Baralhos a que o Cartão está vinculado", () => {
    const cartao = criarCartao();
    const baralhos = ["Inglês", "Espanhol", "Francês"].map(criarBaralho);

    for (const baralho of baralhos) {
      expect(acervo.vincular(cartao.id, baralho.id)).toEqual({ ok: true });
    }

    const resultado = acervo.editarCartao(cartao.id, {
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
      const obtido = acervo.obterBaralho(baralho.id);

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

    expect(acervo.listarCartoes()).toEqual([
      {
        id: cartao.id,
        frente: FRENTE_EDITADA,
        verso: VERSO_EDITADO,
        baralhos: expect.arrayContaining(baralhos),
      },
    ]);
  });

  it("recusa Frente vazia com a mesma mensagem da criação", () => {
    const cartao = criarCartao();

    expect(acervo.editarCartao(cartao.id, { frente: "", verso: VERSO_EDITADO })).toEqual({
      ok: false,
      erro: "frente_vazia",
      mensagem: "A frente do cartão não pode ficar vazia.",
    });

    expect(acervo.listarCartoes()).toEqual([{ ...cartao, baralhos: [] }]);
  });

  it("trata Frente composta só de espaços como vazia", () => {
    const cartao = criarCartao();

    expect(
      acervo.editarCartao(cartao.id, { frente: "   ", verso: VERSO_EDITADO }),
    ).toEqual({
      ok: false,
      erro: "frente_vazia",
      mensagem: "A frente do cartão não pode ficar vazia.",
    });
  });

  it("recusa Frente acima de 1000 caracteres com a mesma mensagem da criação", () => {
    const cartao = criarCartao();

    expect(
      acervo.editarCartao(cartao.id, {
        frente: "a".repeat(1001),
        verso: VERSO_EDITADO,
      }),
    ).toEqual({
      ok: false,
      erro: "frente_muito_longa",
      mensagem:
        "A frente do cartão deve ter no máximo 1000 caracteres; a informada tem 1001.",
    });
  });

  it("recusa Cartão inexistente como nao_encontrado", () => {
    expect(
      acervo.editarCartao("cartao-inexistente", {
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
