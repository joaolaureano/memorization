import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  criarAcervo,
  type Acervo,
  type Avaliacao,
  type Cartao,
} from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/**
 * T1526 — Desempenho da leitura de Início vista pelo `Acervo` (SC-087): com um
 * acervo de 2.000 Cartões e 500 Sessões concluídas, `obterResumoDaRevisao` e
 * `obterEstatisticas` **juntos** precisam responder em menos de um segundo.
 *
 * O semeio atravessa a Interface do `Acervo` sobre o Adapter do armazenamento
 * local em memória, como os demais testes: os Agendamentos nascem do próprio
 * `registrarSessao`, e nenhum teste inspeciona tabela. O orçamento mede só a
 * leitura, e não a preparação — por isso o tempo limite do teste cobre o semeio
 * inteiro.
 */

const QUANTIDADE_DE_CARTOES = 2_000;
const QUANTIDADE_DE_REGISTROS = 500;
const ITENS_POR_REGISTRO = 20;

/** Orçamento das duas leituras juntas, em milissegundos (SC-087). */
const ORCAMENTO_EM_MILISSEGUNDOS = 1_000;

/** Tempo limite do teste, para acomodar o semeio sem folga apertada. */
const TEMPO_LIMITE_EM_MILISSEGUNDOS = 120_000;

/** Os quatro níveis de Avaliação, para variar os Itens dos registros. */
const AVALIACOES: readonly Avaliacao[] = ["errei", "dificil", "bom", "facil"];

/** O dia do estudo, como a tela o envia (D3). */
const JANELA_DO_DIA = [
  "2026-10-01T00:00:00.000Z",
  "2026-10-02T00:00:00.000Z",
] as const;

/** Instante `desde` das Estatísticas, dentro da janela máxima (FR-169). */
const DESDE_DAS_ESTATISTICAS = "2026-10-01T00:00:00.000Z";

let aberto: ArmazenamentoSqliteAberto;
let usuarioId: string;

beforeAll(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  usuarioId = await criarDonoDeTeste(aberto.usuarios);
});

afterAll(async () => {
  await aberto.encerrar();
});

/** Cria os Cartões do acervo e os devolve na ordem de criação. */
async function semearCartoes(acervo: Acervo): Promise<Cartao[]> {
  const cartoes: Cartao[] = [];

  for (let indice = 0; indice < QUANTIDADE_DE_CARTOES; indice += 1) {
    const resultado = await acervo.criarCartao({
      frente: `Frente ${indice}`,
      verso: `Verso ${indice}`,
    });

    if (!resultado.ok) {
      throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
    }

    cartoes.push(resultado.cartao);
  }

  return cartoes;
}

/**
 * Registra as Sessões concluídas do semeio: 20 Itens cada, girando pelos
 * Cartões existentes e pelas quatro Avaliações, para que os Agendamentos
 * nasçam pelo próprio `registrarSessao` (FR-205, FR-210).
 */
async function semearRegistros(
  acervo: Acervo,
  cartoes: readonly Cartao[],
): Promise<void> {
  for (let registro = 0; registro < QUANTIDADE_DE_REGISTROS; registro += 1) {
    const itens = Array.from({ length: ITENS_POR_REGISTRO }, (_, indice) => {
      const cartao =
        cartoes[(registro * ITENS_POR_REGISTRO + indice) % cartoes.length];

      if (cartao === undefined) {
        throw new Error("semeio sem Cartões suficientes");
      }

      return {
        frente: cartao.frente,
        verso: cartao.verso,
        cartaoId: cartao.id,
        avaliacao: AVALIACOES[(registro + indice) % AVALIACOES.length] ?? "bom",
      };
    });

    const resultado = await acervo.registrarSessao({
      id: randomUUID(),
      origem: "baralho",
      baralhoId: "baralho-1",
      nomeDoBaralho: "Inglês",
      itens,
    });

    if (!resultado.ok) {
      throw new Error(`registro recusado inesperadamente: ${resultado.erro}`);
    }
  }
}

describe("desempenho da leitura de Início (SC-087)", () => {
  it(
    "responde resumo da revisão e estatísticas em menos de um segundo com 2.000 Cartões e 500 Sessões (SC-087)",
    async () => {
      const acervo = criarAcervo(aberto.armazenamento, usuarioId);

      const cartoes = await semearCartoes(acervo);
      await semearRegistros(acervo, cartoes);

      const inicio = performance.now();

      const [resumo, estatisticas] = await Promise.all([
        acervo.obterResumoDaRevisao(...JANELA_DO_DIA),
        acervo.obterEstatisticas(DESDE_DAS_ESTATISTICAS),
      ]);

      const decorrido = performance.now() - inicio;

      expect(resumo.ok).toBe(true);
      expect(estatisticas.ok).toBe(true);

      if (estatisticas.ok) {
        expect(estatisticas.estatisticas.cartoes).toBe(QUANTIDADE_DE_CARTOES);
      }

      expect(decorrido).toBeLessThan(ORCAMENTO_EM_MILISSEGUNDOS);
    },
    TEMPO_LIMITE_EM_MILISSEGUNDOS,
  );
});
