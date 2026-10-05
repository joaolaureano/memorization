import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { criarAcervo, type Acervo } from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/**
 * T2304a — `Acervo.salvarSelecaoComoBaralho`: cria Baralho e Vínculos num gesto
 * único e idempotente (FR-371–FR-374). Toda asserção passa pela Interface, com
 * o Adapter do armazenamento local em memória; nenhum teste inspeciona tabela.
 */

const LIMITE_DE_ITENS = 1000;
const LIMITE_DO_NOME = 100;
const NOME_VALIDO = "Inglês para a próxima viagem";

let aberto: ArmazenamentoSqliteAberto;
let acervo: Acervo;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  /** O acervo é de um **dono**: Cartões e Baralhos pertencem a um Usuário (FR-092). */
  const dono = await criarDonoDeTeste(aberto.usuarios);

  acervo = criarAcervo(aberto.armazenamento, dono);
});

afterEach(async () => {
  await aberto.encerrar();
});

/** Cria um Cartão válido no Acervo informado e devolve o seu id. */
async function criarCartao(alvo: Acervo = acervo): Promise<string> {
  const resultado = await alvo.criarCartao({
    frente: "How are you?",
    verso: "Como você está?",
  });

  if (!resultado.ok) {
    throw new Error(`criação de Cartão recusada: ${JSON.stringify(resultado)}`);
  }

  return resultado.cartao.id;
}

describe("salvarSelecaoComoBaralho — salvamento pela Interface", () => {
  it("cria o Baralho com todos os Vínculos e devolve novo: true (FR-371)", async () => {
    const cartoes = [await criarCartao(), await criarCartao(), await criarCartao()];
    const id = randomUUID();

    expect(
      await acervo.salvarSelecaoComoBaralho({
        id,
        nome: NOME_VALIDO,
        cartaoIds: cartoes,
      }),
    ).toEqual({
      ok: true,
      baralho: { id, nome: NOME_VALIDO },
      novo: true,
    });

    expect(await acervo.listarBaralhos()).toContainEqual(
      expect.objectContaining({ id, nome: NOME_VALIDO, quantidadeDeCartoes: 3 }),
    );
  });

  it("reenvia o mesmo id com novo: false, sem duplicar o Baralho (FR-372)", async () => {
    const cartoes = [await criarCartao(), await criarCartao()];
    const entrada = { id: randomUUID(), nome: NOME_VALIDO, cartaoIds: cartoes };

    expect(await acervo.salvarSelecaoComoBaralho(entrada)).toEqual({
      ok: true,
      baralho: { id: entrada.id, nome: NOME_VALIDO },
      novo: true,
    });

    expect(await acervo.salvarSelecaoComoBaralho(entrada)).toEqual({
      ok: true,
      baralho: { id: entrada.id, nome: NOME_VALIDO },
      novo: false,
    });

    expect(await acervo.listarBaralhos()).toHaveLength(1);
  });

  it("recusa nome vazio com o código de nome vigente (FR-373)", async () => {
    const cartao = await criarCartao();

    expect(
      await acervo.salvarSelecaoComoBaralho({
        id: randomUUID(),
        nome: "",
        cartaoIds: [cartao],
      }),
    ).toEqual({
      ok: false,
      erro: "nome_vazio",
      mensagem: "O nome do baralho não pode ficar vazio.",
    });
  });

  it("recusa nome com 101 caracteres, informando limite e tamanho atual (FR-373)", async () => {
    const cartao = await criarCartao();

    expect(
      await acervo.salvarSelecaoComoBaralho({
        id: randomUUID(),
        nome: "a".repeat(LIMITE_DO_NOME + 1),
        cartaoIds: [cartao],
      }),
    ).toEqual({
      ok: false,
      erro: "nome_muito_longo",
      mensagem:
        "O nome do baralho deve ter no máximo 100 caracteres; o informado tem 101.",
    });
  });

  it("recusa id que não é UUID e nome que não é string com dados_invalidos (FR-373)", async () => {
    const cartao = await criarCartao();

    expect(
      await acervo.salvarSelecaoComoBaralho({
        id: "não-é-uuid",
        nome: NOME_VALIDO,
        cartaoIds: [cartao],
      }),
    ).toEqual({ ok: false, erro: "dados_invalidos" });

    expect(
      await acervo.salvarSelecaoComoBaralho({
        id: randomUUID(),
        nome: 42,
        cartaoIds: [cartao],
      }),
    ).toEqual({ ok: false, erro: "dados_invalidos" });
  });

  it("recusa cartaoIds fora da forma com dados_invalidos (FR-373)", async () => {
    const cartao = await criarCartao();

    const selecoesInvalidas: unknown[] = [
      [],
      [cartao, cartao],
      ["   "],
      [cartao, "   "],
      [cartao, 42],
      "não é lista",
      undefined,
      Array.from({ length: LIMITE_DE_ITENS + 1 }, (_, indice) => `c${indice}`),
    ];

    for (const cartaoIds of selecoesInvalidas) {
      expect(
        await acervo.salvarSelecaoComoBaralho({
          id: randomUUID(),
          nome: NOME_VALIDO,
          cartaoIds,
        }),
      ).toEqual({ ok: false, erro: "dados_invalidos" });
    }
  });

  it("recusa Cartão de outro Usuário, sem gravar Baralho (FR-374)", async () => {
    const meu = await criarCartao();

    const donoDois = await criarDonoDeTeste(
      aberto.usuarios,
      "dono-dois",
      "bruno.souza",
    );
    const acervoDois = criarAcervo(aberto.armazenamento, donoDois);
    const alheio = await criarCartao(acervoDois);

    expect(
      await acervo.salvarSelecaoComoBaralho({
        id: randomUUID(),
        nome: NOME_VALIDO,
        cartaoIds: [meu, alheio],
      }),
    ).toEqual({
      ok: false,
      erro: "cartoes_indisponiveis",
      cartaoIds: [alheio],
    });

    expect(await acervo.listarBaralhos()).toEqual([]);
  });

  it("não altera os Baralhos de origem nem os seus Vínculos (FR-374)", async () => {
    const um = await criarCartao();
    const dois = await criarCartao();
    const tres = await criarCartao();

    const origem = await acervo.salvarSelecaoComoBaralho({
      id: randomUUID(),
      nome: "Baralho de origem",
      cartaoIds: [um, dois],
    });
    expect(origem.ok).toBe(true);

    const donoDois = await criarDonoDeTeste(
      aberto.usuarios,
      "dono-dois",
      "bruno.souza",
    );
    const acervoDois = criarAcervo(aberto.armazenamento, donoDois);
    const alheio = await criarCartao(acervoDois);

    const antes = await acervo.listarBaralhos();

    expect(
      await acervo.salvarSelecaoComoBaralho({
        id: randomUUID(),
        nome: "Seleção com Cartão alheio",
        cartaoIds: [um, tres, alheio],
      }),
    ).toEqual({
      ok: false,
      erro: "cartoes_indisponiveis",
      cartaoIds: [alheio],
    });

    expect(await acervo.listarBaralhos()).toEqual(antes);
  });
});
