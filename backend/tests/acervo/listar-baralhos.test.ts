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
 * T104 — `Acervo` lista Baralhos pela sua Interface; e T205 — a contagem e a
 * elegibilidade passam a ser derivadas dos Vínculos na leitura, nunca lidas de
 * coluna.
 *
 * Cada item carrega exatamente id, nome, quantidadeDeCartoes e elegivel. O
 * nome é rótulo, não identificador: dois Baralhos homônimos aparecem
 * separadamente. A elegibilidade é `quantidadeDeCartoes > 0` (FR-024).
 *
 * Toda asserção atravessa a Interface (`criarBaralho`, `criarCartao`,
 * `vincular` e `listarBaralhos`) sobre o Adapter do armazenamento local em
 * memória; nenhum teste inspeciona a tabela. A ordem não é pré-condição da
 * Interface, portanto as asserções comparam conjuntos de Baralhos, nunca
 * posições na lista.
 */

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

/** Cria um Baralho válido pela Interface e devolve o Baralho criado. */
async function criar(nome: string): Promise<Baralho> {
  return baralhoDo(await acervo.criarBaralho({ nome }));
}

/** Cria um Cartão válido pela Interface e devolve o Cartão criado. */
async function criarCartao(frente: string, verso: string): Promise<Cartao> {
  return cartaoDo(await acervo.criarCartao({ frente, verso }));
}

describe("listarBaralhos — leitura pela Interface", () => {
  it("devolve lista vazia quando nenhum Baralho existe", async () => {
    expect(await acervo.listarBaralhos()).toEqual([]);
  });

  it("devolve cada Baralho com exatamente id, nome, quantidadeDeCartoes e elegivel", async () => {
    const criado = await criar(NOME_VALIDO);

    expect(await acervo.listarBaralhos()).toEqual([
      {
        id: criado.id,
        nome: NOME_VALIDO,
        quantidadeDeCartoes: 0,
        elegivel: false,
      },
    ]);
  });

  it("deriva quantidadeDeCartoes como 0 e elegivel como contagem > 0 para Baralho sem Vínculo", async () => {
    await criar(NOME_VALIDO);

    const [listado] = await acervo.listarBaralhos();

    expect(listado.quantidadeDeCartoes).toBe(0);
    expect(listado.elegivel).toBe(listado.quantidadeDeCartoes > 0);
    expect(listado.elegivel).toBe(false);
  });

  it("devolve os dois Baralhos de nome idêntico, ambos presentes, sem deduplicação", async () => {
    const primeiro = await criar(NOME_VALIDO);
    const segundo = await criar(NOME_VALIDO);

    const listados = await acervo.listarBaralhos();

    expect(listados).toHaveLength(2);
    expect(listados).toEqual(
      expect.arrayContaining([
        {
          id: primeiro.id,
          nome: NOME_VALIDO,
          quantidadeDeCartoes: 0,
          elegivel: false,
        },
        {
          id: segundo.id,
          nome: NOME_VALIDO,
          quantidadeDeCartoes: 0,
          elegivel: false,
        },
      ]),
    );
    expect(new Set(listados.map((baralho) => baralho.id)).size).toBe(2);
  });

  it("deriva quantidadeDeCartoes e elegivel da contagem de Vínculos para 0, 1 e 3 Cartões", async () => {
    const vazio = await criar("Vazio");
    const comUm = await criar("Com um");
    const comTres = await criar("Com três");

    await acervo.vincular((await criarCartao("To walk", "Caminhar")).id, comUm.id);

    for (const cartao of [
      await criarCartao("To run", "Correr"),
      await criarCartao("To sleep", "Dormir"),
      await criarCartao("To read", "Ler"),
    ]) {
      await acervo.vincular(cartao.id, comTres.id);
    }

    const listados = await acervo.listarBaralhos();

    expect(listados).toEqual(
      expect.arrayContaining([
        {
          id: vazio.id,
          nome: "Vazio",
          quantidadeDeCartoes: 0,
          elegivel: false,
        },
        {
          id: comUm.id,
          nome: "Com um",
          quantidadeDeCartoes: 1,
          elegivel: true,
        },
        {
          id: comTres.id,
          nome: "Com três",
          quantidadeDeCartoes: 3,
          elegivel: true,
        },
      ]),
    );

    for (const listado of listados) {
      expect(listado.elegivel).toBe(listado.quantidadeDeCartoes > 0);
    }
  });
});
