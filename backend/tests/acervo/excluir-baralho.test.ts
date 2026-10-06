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
 * T502 — `Acervo` exclui Baralho pela sua Interface, removendo os Cartões e
 * Agendamentos do Baralho, preservando Registros de sessão (FR-017, FR-402, T030).
 *
 * Toda asserção atravessa a Interface (`criarCartao`, `criarBaralho`,
 * `excluirBaralho`, `listarCartoes` e `listarBaralhos`) sobre o Adapter do
 * armazenamento local em memória; nenhum teste inspeciona a tabela. Excluir um
 * Baralho remove o Baralho, os Cartões do Baralho e seus Agendamentos. Registros
 * de sessão são preservados. Baralho inexistente é recusado como `nao_encontrado`.
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

describe("excluirBaralho — exclusão pela Interface", () => {
  it("exclui o Baralho e seus Cartões", async () => {
    const baralho = await criarBaralho("Inglês");
    const primeiro = await criarCartao(baralho.id);
    const segundo = await criarCartao(baralho.id);

    expect(await acervo.excluirBaralho(baralho.id)).toEqual({ ok: true });

    expect(await acervo.listarBaralhos()).toEqual([]);
    expect(await acervo.listarCartoes()).toEqual([]);
    expect(primeiro.id).not.toBe(segundo.id);
  });

  it("exclui o Baralho e seus Agendamentos, preservando o Registro de sessão (T030)", async () => {
    const baralho = await criarBaralho("Inglês");
    const cartao = await criarCartao(baralho.id);

    // Registrar uma Sessão com o Cartão para criar um Agendamento
    const registroResultado = await acervo.registrarSessao({
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

    expect(registroResultado.ok).toBe(true);

    // Verificar que o Baralho tem Agendamento
    const baralhoComAgendamento = await acervo.obterBaralho(baralho.id);
    expect(baralhoComAgendamento.ok && baralhoComAgendamento.baralho.quantidadeDeAgendamentos).toBe(1);

    // Excluir o Baralho
    expect(await acervo.excluirBaralho(baralho.id)).toEqual({ ok: true });

    // Verificar que o Baralho foi excluído
    expect(await acervo.listarBaralhos()).toEqual([]);

    // Verificar que o Cartão foi excluído
    expect(await acervo.listarCartoes()).toEqual([]);

    // Verificar que o Registro de sessão permanece
    if (registroResultado.ok) {
      const registroObtido = await acervo.obterRegistroDeSessao(registroResultado.registro.id);
      expect(registroObtido.ok).toBe(true);
      expect(registroObtido.ok && registroObtido.baralhoExiste).toBe(false);
    }
  });

  it("não afeta Cartões e Agendamentos de outro Baralho", async () => {
    const baralhoExcluido = await criarBaralho("Inglês");
    const baralhoPreservado = await criarBaralho("Espanhol");
    const cartaoExcluido = await criarCartao(baralhoExcluido.id);
    const cartaoPreservado = await criarCartao(baralhoPreservado.id);

    // Registrar Sessão com o Cartão preservado para criar um Agendamento
    const registroResultado = await acervo.registrarSessao({
      id: randomUUID(),
      origem: "baralho",
      baralhoId: baralhoPreservado.id,
      nomeDoBaralho: baralhoPreservado.nome,
      itens: [
        {
          frente: FRENTE_VALIDA,
          verso: VERSO_VALIDO,
          cartaoId: cartaoPreservado.id,
          avaliacao: "bom",
        },
      ],
    });

    expect(registroResultado.ok).toBe(true);

    // Excluir o Baralho
    expect(await acervo.excluirBaralho(baralhoExcluido.id)).toEqual({ ok: true });

    // Verificar que o Cartão preservado continua
    expect(await acervo.listarCartoes()).toEqual([
      { ...cartaoPreservado, baralho: baralhoPreservado, proximaRevisaoEm: expect.any(String) },
    ]);
    expect(await acervo.listarCartoes()).not.toContainEqual(
      expect.objectContaining({ id: cartaoExcluido.id }),
    );

    // Verificar que o Baralho preservado continua com seu Agendamento
    const baralhoAposExclusao = await acervo.obterBaralho(baralhoPreservado.id);
    expect(baralhoAposExclusao.ok && baralhoAposExclusao.baralho.quantidadeDeAgendamentos).toBe(1);
  });

  it("recusa Baralho inexistente como nao_encontrado", async () => {
    expect(await acervo.excluirBaralho("baralho-inexistente")).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });

  it("recusa excluir Baralho inexistente mesmo com ID válido (T030)", async () => {
    // Criar um ID de Baralho que não existe
    const baralhoInexistente = "baralho-inexistente-nao-existe";

    // Tentar excluir deve retornar nao_encontrado
    expect(await acervo.excluirBaralho(baralhoInexistente)).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });
});
