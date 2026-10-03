import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  criarAcervo,
  type Avaliacao,
  type Baralho,
  type Cartao,
  type DadosDeRegistro,
  type RegistroDeSessao,
} from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/**
 * T1519 — O estudo livre visto pelo `Acervo`: concluir a Sessão de um Baralho
 * aplica o SM-2 ao Cartão estudado, e o Agendamento é do Cartão — não do
 * Vínculo nem da Frente. Estudar por um de dois Baralhos, desvincular ou
 * editar a Frente nem cria um segundo Agendamento nem apaga o existente
 * (FR-205 a FR-208).
 *
 * Toda asserção atravessa a Interface do `Acervo` sobre o Adapter do
 * armazenamento local em memória; nenhum teste inspeciona tabela. O relógio é
 * controlado com `vi.setSystemTime`, porque as datas das revisões nascem dele.
 */

const FRENTE = "To walk";
const VERSO = "Caminhar";

/** O "agora" fixo de todos os testes. */
const INSTANTE_INICIAL = new Date("2026-10-01T12:00:00.000Z");

const UM_SEGUNDO_EM_MILISSEGUNDOS = 1000;
const UM_DIA_EM_MILISSEGUNDOS = 24 * 60 * 60 * 1000;

/** O dia de `INSTANTE_INICIAL` e o seguinte, como a tela os envia (D3). */
const DIA_DO_ESTUDO = [
  "2026-10-01T00:00:00.000Z",
  "2026-10-02T00:00:00.000Z",
] as const;

const DIA_SEGUINTE = [
  "2026-10-02T00:00:00.000Z",
  "2026-10-03T00:00:00.000Z",
] as const;

let aberto: ArmazenamentoSqliteAberto;
let usuarioId: string;
let acervo: ReturnType<typeof criarAcervo>;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  usuarioId = await criarDonoDeTeste(aberto.usuarios);
  acervo = criarAcervo(aberto.armazenamento, usuarioId);

  // Só depois de abrir o armazenamento e criar o dono o relógio é congelado,
  // para que nenhuma infraestrutura de teste dependa do tempo falso.
  vi.useFakeTimers();
  vi.setSystemTime(INSTANTE_INICIAL);
});

afterEach(async () => {
  vi.useRealTimers();
  await aberto.encerrar();
});

/** Avança o relógio controlado, para que instantes seguidos sejam distintos. */
function avancar(segundos: number): void {
  vi.setSystemTime(
    new Date(Date.now() + segundos * UM_SEGUNDO_EM_MILISSEGUNDOS),
  );
}

/** Cria um Cartão válido pela Interface. */
async function criarCartao(frente = FRENTE, verso = VERSO): Promise<Cartao> {
  const resultado = await acervo.criarCartao({ frente, verso });

  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.cartao;
}

/** Cria um Baralho válido pela Interface. */
async function criarBaralho(nome = "Inglês"): Promise<Baralho> {
  const resultado = await acervo.criarBaralho({ nome });

  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.baralho;
}

/** Item cru do corpo: Frente, Verso, Cartão de origem e Avaliação (FR-193). */
function itemDe(
  frente: string,
  verso: string,
  cartaoId: string,
  avaliacao: Avaliacao,
): { frente: string; verso: string; cartaoId: string; avaliacao: Avaliacao } {
  return { frente, verso, cartaoId, avaliacao };
}

/** Corpo cru de `POST /sessoes` do estudo livre por Baralho. */
function corpoComItens(
  itens: {
    frente: string;
    verso: string;
    cartaoId: string;
    avaliacao: Avaliacao;
  }[],
  mudancas: Partial<DadosDeRegistro> = {},
): DadosDeRegistro {
  return {
    id: randomUUID(),
    origem: "baralho",
    baralhoId: "baralho-1",
    nomeDoBaralho: "Inglês",
    itens,
    ...mudancas,
  };
}

/** Registra a Sessão e devolve o Registro; falha se foi recusada. */
async function registrar(corpo: DadosDeRegistro): Promise<RegistroDeSessao> {
  const resultado = await acervo.registrarSessao(corpo);

  if (!resultado.ok) {
    throw new Error(`registro recusado inesperadamente: ${resultado.erro}`);
  }

  return resultado.registro;
}

/** Os identificadores dos Cartões de um lote, na ordem em que vieram. */
async function idsDoLote(
  inicioDoDia: string,
  fimDoDia: string,
): Promise<string[]> {
  const resultado = await acervo.obterLoteDeRevisao(inicioDoDia, fimDoDia);

  if (!resultado.ok) {
    throw new Error(`lote recusado inesperadamente: ${resultado.erro}`);
  }

  return resultado.itens.map((item) => item.cartao.id);
}

/** Os identificadores dos Cartões numa janela a partir de um instante ISO. */
async function idsNoDiaDe(instante: Date): Promise<string[]> {
  return idsDoLote(
    instante.toISOString(),
    new Date(instante.getTime() + UM_DIA_EM_MILISSEGUNDOS).toISOString(),
  );
}

describe("registrarSessao no estudo livre — o Agendamento nasce do Cartão", () => {
  it("conclui a Sessão de um Cartão novo e reduz em 1 os novos de hoje (FR-205, FR-206)", async () => {
    const cartao = await criarCartao();

    // Antes de estudar, o Cartão é novo e conta no resumo de hoje.
    expect(await acervo.obterResumoDaRevisao(...DIA_DO_ESTUDO)).toEqual({
      ok: true,
      resumo: { vencidos: 0, novosHoje: 1, total: 1 },
    });

    await registrar(corpoComItens([itemDe(FRENTE, VERSO, cartao.id, "bom")]));

    // O Agendamento nasceu: o Cartão deixou de ser novo hoje.
    expect(await acervo.obterResumoDaRevisao(...DIA_DO_ESTUDO)).toEqual({
      ok: true,
      resumo: { vencidos: 0, novosHoje: 0, total: 0 },
    });

    // E reaparece no dia que o SM-2 calculou a partir da primeira Avaliação.
    expect(await idsNoDiaDe(new Date(
      INSTANTE_INICIAL.getTime() + UM_DIA_EM_MILISSEGUNDOS,
    ))).toEqual([cartao.id]);
  });

  it("reagenda pelo SM-2 um Cartão não vencido avaliado no estudo livre (FR-205)", async () => {
    const cartao = await criarCartao();

    await registrar(corpoComItens([itemDe(FRENTE, VERSO, cartao.id, "bom")]));

    // O primeiro "bom" empurrou a revisão para o dia seguinte.
    expect(await idsDoLote(...DIA_SEGUINTE)).toEqual([cartao.id]);

    // Estudar de novo no mesmo dia é permitido mesmo sem vencimento: o SM-2
    // avança as repetições e a revisão salta de um para seis dias.
    await registrar(corpoComItens([itemDe(FRENTE, VERSO, cartao.id, "bom")]));

    expect(await idsDoLote(...DIA_SEGUINTE)).toEqual([]);

    const sextoDia = new Date(
      INSTANTE_INICIAL.getTime() + 6 * UM_DIA_EM_MILISSEGUNDOS,
    );

    expect(await idsNoDiaDe(sextoDia)).toEqual([cartao.id]);
  });
});

describe("o Agendamento é do Cartão, não do Vínculo (FR-206, FR-207, FR-208)", () => {
  it("mantém um único Agendamento para um Cartão estudado por um de dois Baralhos (FR-206, FR-207)", async () => {
    const cartao = await criarCartao();
    const primeiro = await criarBaralho("Inglês");
    const segundo = await criarBaralho("Viagem");

    expect(await acervo.vincular(cartao.id, primeiro.id)).toEqual({ ok: true });
    expect(await acervo.vincular(cartao.id, segundo.id)).toEqual({ ok: true });

    // Estudado por um dos Baralhos apenas.
    await registrar(
      corpoComItens([itemDe(FRENTE, VERSO, cartao.id, "bom")], {
        baralhoId: primeiro.id,
        nomeDoBaralho: primeiro.nome,
      }),
    );

    // Um Agendamento só: o vencido conta uma vez, não uma por Vínculo.
    expect(await acervo.obterResumoDaRevisao(...DIA_SEGUINTE)).toEqual({
      ok: true,
      resumo: { vencidos: 1, novosHoje: 0, total: 1 },
    });
  });

  it("preserva o Agendamento ao desvincular e ao editar a Frente (FR-207, FR-208)", async () => {
    const cartao = await criarCartao();
    const baralho = await criarBaralho("Inglês");

    expect(await acervo.vincular(cartao.id, baralho.id)).toEqual({ ok: true });

    await registrar(
      corpoComItens([itemDe(FRENTE, VERSO, cartao.id, "bom")], {
        baralhoId: baralho.id,
        nomeDoBaralho: baralho.nome,
      }),
    );

    expect(await idsDoLote(...DIA_SEGUINTE)).toEqual([cartao.id]);

    // Nem perder o Vínculo nem trocar a Frente mexem no Agendamento.
    expect(await acervo.desvincular(cartao.id, baralho.id)).toEqual({
      ok: true,
    });

    expect(
      await acervo.editarCartao(cartao.id, { frente: "To stroll", verso: VERSO }),
    ).toEqual({
      ok: true,
      cartao: { id: cartao.id, frente: "To stroll", verso: VERSO },
    });

    expect(await idsDoLote(...DIA_SEGUINTE)).toEqual([cartao.id]);
  });

  it("não reaplica a Avaliação ao reenviar o mesmo id (FR-205, FR-210, SC-085)", async () => {
    const cartao = await criarCartao();
    const corpo = corpoComItens([itemDe(FRENTE, VERSO, cartao.id, "bom")]);

    await registrar(corpo);

    avancar(60);

    // O reenvio devolve o registro guardado sem reaplicar a Avaliação.
    const reenviado = await registrar(corpo);

    expect(reenviado.concluidaEm).toBe(INSTANTE_INICIAL.toISOString());

    // Se tivesse reaplicado, a revisão já teria saltado de um para seis dias e
    // o Cartão não apareceria no dia seguinte — é o que esta asserção prova.
    const diaSeguinte = new Date(
      INSTANTE_INICIAL.getTime() + UM_DIA_EM_MILISSEGUNDOS,
    );

    expect(await idsNoDiaDe(diaSeguinte)).toEqual([cartao.id]);
  });
});
