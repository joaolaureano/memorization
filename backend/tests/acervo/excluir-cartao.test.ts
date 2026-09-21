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
 * T501 — `Acervo` exclui Cartão pela sua Interface, preservando Baralhos e
 * removendo Vínculos.
 *
 * Toda asserção atravessa a Interface (`criarCartao`, `criarBaralho`,
 * `vincular`, `excluirCartao`, `listarCartoes`, `listarBaralhos` e
 * `obterBaralho`) sobre SQLite em memória; nenhum teste inspeciona a tabela.
 * Excluir um Cartão remove apenas o Cartão e os seus Vínculos — nenhum Baralho
 * é destruído (FR-008) — e a elegibilidade dos Baralhos restantes é reavaliada
 * na leitura (FR-024). Cartão inexistente é recusado como `nao_encontrado`.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";

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
function criarCartao(): Cartao {
  return cartaoDo(
    acervo.criarCartao({ frente: FRENTE_VALIDA, verso: VERSO_VALIDO }),
  );
}

/** Cria um Baralho válido pela Interface. */
function criarBaralho(nome: string): Baralho {
  return baralhoDo(acervo.criarBaralho({ nome }));
}

describe("excluirCartao — exclusão pela Interface", () => {
  it("exclui o Cartão e preserva os dois Baralhos, que deixam de ser elegíveis", () => {
    const cartao = criarCartao();
    const primeiroBaralho = criarBaralho("Inglês");
    const segundoBaralho = criarBaralho("Espanhol");

    for (const baralho of [primeiroBaralho, segundoBaralho]) {
      acervo.vincular(cartao.id, baralho.id);
    }

    expect(acervo.excluirCartao(cartao.id)).toEqual({ ok: true });

    expect(acervo.listarCartoes()).toEqual([]);
    expect(acervo.listarBaralhos()).toEqual(
      expect.arrayContaining([
        {
          id: primeiroBaralho.id,
          nome: "Inglês",
          quantidadeDeCartoes: 0,
          elegivel: false,
        },
        {
          id: segundoBaralho.id,
          nome: "Espanhol",
          quantidadeDeCartoes: 0,
          elegivel: false,
        },
      ]),
    );

    for (const baralho of [primeiroBaralho, segundoBaralho]) {
      expect(acervo.obterBaralho(baralho.id)).toEqual({
        ok: true,
        baralho: {
          id: baralho.id,
          nome: baralho.nome,
          elegivel: false,
          cartoes: [],
        },
      });
    }
  });

  it("faz o Baralho do último Cartão sobreviver e perder a elegibilidade", () => {
    const baralho = criarBaralho("Inglês");
    const cartao = criarCartao();

    acervo.vincular(cartao.id, baralho.id);

    expect(acervo.excluirCartao(cartao.id)).toEqual({ ok: true });

    const [listado] = acervo.listarBaralhos();

    expect(listado).toEqual({
      id: baralho.id,
      nome: "Inglês",
      quantidadeDeCartoes: 0,
      elegivel: false,
    });
  });

  it("não destrói Cartões alheios nem seus Vínculos com outros Baralhos", () => {
    const excluido = criarCartao();
    const preservado = criarCartao();
    const baralho = criarBaralho("Inglês");

    acervo.vincular(excluido.id, baralho.id);
    acervo.vincular(preservado.id, baralho.id);

    expect(acervo.excluirCartao(excluido.id)).toEqual({ ok: true });

    expect(acervo.listarCartoes()).toEqual([
      { ...preservado, baralhos: [baralho] },
    ]);
    expect(acervo.obterBaralho(baralho.id)).toEqual({
      ok: true,
      baralho: {
        id: baralho.id,
        nome: "Inglês",
        elegivel: true,
        cartoes: [preservado],
      },
    });
  });

  it("recusa Cartão inexistente como nao_encontrado", () => {
    expect(acervo.excluirCartao("cartao-inexistente")).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Cartão não encontrado.",
    });
  });
});
