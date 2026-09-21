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
 * T501 — `Acervo` exclui Cartão pela sua Interface, preservando Baralhos e
 * removendo Vínculos.
 *
 * Toda asserção atravessa a Interface (`criarCartao`, `criarBaralho`,
 * `vincular`, `excluirCartao`, `listarCartoes`, `listarBaralhos` e
 * `obterBaralho`) sobre o Adapter do armazenamento local em memória; nenhum
 * teste inspeciona a tabela. Excluir um Cartão remove apenas o Cartão e os seus
 * Vínculos — nenhum Baralho é destruído (FR-008) — e a elegibilidade dos
 * Baralhos restantes é reavaliada na leitura (FR-024). Cartão inexistente é
 * recusado como `nao_encontrado`.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";

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
async function criarBaralho(nome: string): Promise<Baralho> {
  return baralhoDo(await acervo.criarBaralho({ nome }));
}

describe("excluirCartao — exclusão pela Interface", () => {
  it("exclui o Cartão e preserva os dois Baralhos, que deixam de ser elegíveis", async () => {
    const cartao = await criarCartao();
    const primeiroBaralho = await criarBaralho("Inglês");
    const segundoBaralho = await criarBaralho("Espanhol");

    for (const baralho of [primeiroBaralho, segundoBaralho]) {
      await acervo.vincular(cartao.id, baralho.id);
    }

    expect(await acervo.excluirCartao(cartao.id)).toEqual({ ok: true });

    expect(await acervo.listarCartoes()).toEqual([]);
    expect(await acervo.listarBaralhos()).toEqual(
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
      expect(await acervo.obterBaralho(baralho.id)).toEqual({
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

  it("faz o Baralho do último Cartão sobreviver e perder a elegibilidade", async () => {
    const baralho = await criarBaralho("Inglês");
    const cartao = await criarCartao();

    await acervo.vincular(cartao.id, baralho.id);

    expect(await acervo.excluirCartao(cartao.id)).toEqual({ ok: true });

    const [listado] = await acervo.listarBaralhos();

    expect(listado).toEqual({
      id: baralho.id,
      nome: "Inglês",
      quantidadeDeCartoes: 0,
      elegivel: false,
    });
  });

  it("não destrói Cartões alheios nem seus Vínculos com outros Baralhos", async () => {
    const excluido = await criarCartao();
    const preservado = await criarCartao();
    const baralho = await criarBaralho("Inglês");

    await acervo.vincular(excluido.id, baralho.id);
    await acervo.vincular(preservado.id, baralho.id);

    expect(await acervo.excluirCartao(excluido.id)).toEqual({ ok: true });

    expect(await acervo.listarCartoes()).toEqual([
      { ...preservado, baralhos: [baralho] },
    ]);
    expect(await acervo.obterBaralho(baralho.id)).toEqual({
      ok: true,
      baralho: {
        id: baralho.id,
        nome: "Inglês",
        elegivel: true,
        cartoes: [preservado],
      },
    });
  });

  it("recusa Cartão inexistente como nao_encontrado", async () => {
    expect(await acervo.excluirCartao("cartao-inexistente")).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Cartão não encontrado.",
    });
  });
});
