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
 * T502 — `Acervo` exclui Baralho pela sua Interface, preservando Cartões e
 * removendo Vínculos.
 *
 * Toda asserção atravessa a Interface (`criarCartao`, `criarBaralho`,
 * `vincular`, `excluirBaralho`, `listarCartoes` e `listarBaralhos`) sobre o
 * Adapter do armazenamento local em memória; nenhum teste inspeciona a tabela.
 * Excluir um Baralho remove apenas o Baralho e os seus Vínculos — nenhum Cartão
 * é destruído (FR-017) — e os Cartões continuam alcançáveis pela lista,
 * inclusive os que ficarem sem Baralho (SC-006). Baralho inexistente é recusado
 * como `nao_encontrado`.
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

describe("excluirBaralho — exclusão pela Interface", () => {
  it("exclui o Baralho e preserva os Cartões, que ficam alcançáveis sem Baralho", async () => {
    const baralho = await criarBaralho("Inglês");
    const primeiro = await criarCartao();
    const segundo = await criarCartao();

    await acervo.vincular(primeiro.id, baralho.id);
    await acervo.vincular(segundo.id, baralho.id);

    expect(await acervo.excluirBaralho(baralho.id)).toEqual({ ok: true });

    expect(await acervo.listarBaralhos()).toEqual([]);
    expect(await acervo.listarCartoes()).toEqual(
      expect.arrayContaining([
        { ...primeiro, baralhos: [] },
        { ...segundo, baralhos: [] },
      ]),
    );
  });

  it("não torna órfão o Cartão que também está em outro Baralho", async () => {
    const excluido = await criarBaralho("Inglês");
    const preservado = await criarBaralho("Espanhol");
    const cartao = await criarCartao();

    await acervo.vincular(cartao.id, excluido.id);
    await acervo.vincular(cartao.id, preservado.id);

    expect(await acervo.excluirBaralho(excluido.id)).toEqual({ ok: true });

    expect(await acervo.listarCartoes()).toEqual([
      { ...cartao, baralhos: [preservado] },
    ]);
    expect(await acervo.listarBaralhos()).toEqual([
      {
        id: preservado.id,
        nome: "Espanhol",
        quantidadeDeCartoes: 1,
        elegivel: true,
      },
    ]);
  });

  it("recusa Baralho inexistente como nao_encontrado", async () => {
    expect(await acervo.excluirBaralho("baralho-inexistente")).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });
});
