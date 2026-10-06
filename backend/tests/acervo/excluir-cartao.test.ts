import { randomUUID } from "node:crypto";

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
 * T501 — `Acervo` exclui Cartão pela sua Interface, removendo o Pertencimento,
 * o Agendamento e preservando o Baralho (FR-008, FR-401, T030).
 *
 * Toda asserção atravessa a Interface (`criarCartao`, `criarBaralho`,
 * `excluirCartao`, `listarCartoes`, `listarBaralhos` e `obterBaralho`) sobre o
 * Adapter do armazenamento local em memória; nenhum teste inspeciona a tabela.
 * Excluir um Cartão remove o Cartão, o Pertencimento, o Agendamento, e a
 * elegibilidade dos Baralhos restantes é reavaliada na leitura (FR-024).
 * Cartão inexistente é recusado como `nao_encontrado`.
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
async function criarCartao(baralhoId: string): Promise<Cartao> {
  return cartaoDo(
    await acervo.criarCartao(baralhoId, { frente: FRENTE_VALIDA, verso: VERSO_VALIDO }),
  );
}

/** Cria um Baralho válido pela Interface. */
async function criarBaralho(nome: string): Promise<Baralho> {
  return baralhoDo(await acervo.criarBaralho({ nome }));
}

describe("excluirCartao — exclusão pela Interface", () => {
  it("exclui o Cartão e preserva o Baralho, que deixa de ser elegível", async () => {
    const baralho = await criarBaralho("Inglês");
    const cartao = await criarCartao(baralho.id);

    expect(await acervo.excluirCartao(cartao.id)).toEqual({ ok: true });

    expect(await acervo.listarCartoes()).toEqual([]);
    expect(await acervo.listarBaralhos()).toEqual([
      {
        id: baralho.id,
        nome: "Inglês",
        quantidadeDeCartoes: 0,
        elegivel: false,
      },
    ]);

    expect(await acervo.obterBaralho(baralho.id)).toEqual({
      ok: true,
      baralho: {
        id: baralho.id,
        nome: baralho.nome,
        elegivel: false,
        cartoes: [],
        quantidadeDeAgendamentos: 0,
      },
    });
  });

  it("faz o Baralho do último Cartão sobreviver e perder a elegibilidade", async () => {
    const baralho = await criarBaralho("Inglês");
    const cartao = await criarCartao(baralho.id);

    expect(await acervo.excluirCartao(cartao.id)).toEqual({ ok: true });

    const [listado] = await acervo.listarBaralhos();

    expect(listado).toEqual({
      id: baralho.id,
      nome: "Inglês",
      quantidadeDeCartoes: 0,
      elegivel: false,
    });
  });

  it("não destrói Cartões alheios do Baralho", async () => {
    const baralho = await criarBaralho("Inglês");
    const excluido = await criarCartao(baralho.id);
    const preservado = await criarCartao(baralho.id);

    expect(await acervo.excluirCartao(excluido.id)).toEqual({ ok: true });

    expect(await acervo.listarCartoes()).toEqual([
      { ...preservado, baralho, proximaRevisaoEm: null },
    ]);
    expect(await acervo.obterBaralho(baralho.id)).toEqual({
      ok: true,
      baralho: {
        id: baralho.id,
        nome: "Inglês",
        elegivel: true,
        cartoes: [preservado],
        quantidadeDeAgendamentos: 0,
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

  it("remove o Agendamento do Cartão excluído, preservando o Registro de sessão (T030)", async () => {
    // Preparação: Baralho e Cartão
    const baralho = await criarBaralho("Inglês");
    const cartao = await criarCartao(baralho.id);

    // Registrar uma Sessão com o Cartão para criar um Agendamento
    const registro = await acervo.registrarSessao({
      id: randomUUID(),
      origem: "baralho",
      baralhoId: baralho.id,
      nomeDoBaralho: baralho.nome,
      itens: [
        {
          frente: FRENTE_VALIDA,
          verso: VERSO_VALIDO,
          cartaoId: cartao.id,
          avaliacao: "bom",
        },
      ],
    });

    expect(registro.ok).toBe(true);

    // Verificar que o Baralho agora tem Agendamento
    const baralhoComAgendamento = await acervo.obterBaralho(baralho.id);
    expect(baralhoComAgendamento.ok && baralhoComAgendamento.baralho.quantidadeDeAgendamentos).toBe(1);

    // Excluir o Cartão com Agendamento
    expect(await acervo.excluirCartao(cartao.id)).toEqual({ ok: true });

    // Verificar que o Cartão foi excluído
    expect(await acervo.listarCartoes()).toEqual([]);

    // Verificar que o Agendamento foi removido
    const baralhoAposExclusao = await acervo.obterBaralho(baralho.id);
    expect(baralhoAposExclusao.ok && baralhoAposExclusao.baralho.quantidadeDeAgendamentos).toBe(0);

    // Verificar que o Registro de sessão permanece
    if (registro.ok) {
      const registroObtido = await acervo.obterRegistroDeSessao(registro.registro.id);
      expect(registroObtido.ok).toBe(true);
      expect(registroObtido.ok && registroObtido.registro.itens).toHaveLength(1);
      expect(registroObtido.ok && registroObtido.registro.itens[0]).toMatchObject({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
    }
  });
});
