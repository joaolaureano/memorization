import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  criarAcervo,
  type Acervo,
  type Avaliacao,
  type Baralho,
  type Cartao,
  type DadosDeRegistro,
  type RegistroDeSessao,
} from "../../src/acervo/acervo.ts";
import type { AlgoritmoDeRepeticao } from "../../src/repeticao/algoritmo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/**
 * T1510 — Repetição espaçada vista pelo `Acervo`: a conclusão da Sessão aplica
 * o SM-2, Início lê o resumo e o lote do dia, e a troca de algoritmo reconstrói
 * os Agendamentos por replay do Histórico (FR-196, FR-205 a FR-214, SC-083,
 * SC-085).
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

/** O fim do dia de `INSTANTE_INICIAL` e o do dia seguinte. */
const FIM_DO_DIA_DO_ESTUDO = "2026-10-02T00:00:00.000Z";
const FIM_DO_DIA_SEGUINTE = "2026-10-03T00:00:00.000Z";

/**
 * Algoritmo falso, **não registrado** em `ALGORITMOS`: empurra toda revisão
 * para 100 dias. É o que torna visível a troca de algoritmo de ponta a ponta,
 * pela opção de injeção de `criarAcervo` (FR-191, FR-213).
 */
const ALGORITMO_FALSO: AlgoritmoDeRepeticao = {
  id: "falso",
  versao: 1,
  rotulo: "Falso",
  opcoesDeAvaliacao: [
    { chave: "errei", rotulo: "Errei (falso)", resultado: "errou" },
    { chave: "dificil", rotulo: "Difícil (falso)", resultado: "acertou" },
    { chave: "bom", rotulo: "Bom (falso)", resultado: "acertou" },
    { chave: "facil", rotulo: "Fácil (falso)", resultado: "acertou" },
  ],
  avaliar(_estado, avaliacao, agora) {
    return {
      estado: { algoritmo: "falso", versao: 1, dados: { avaliacao } },
      proximaRevisaoEm: new Date(
        agora.getTime() + 100 * UM_DIA_EM_MILISSEGUNDOS,
      ),
    };
  },
};

let aberto: ArmazenamentoSqliteAberto;
let usuarioId: string;
let acervo: Acervo;
let baralho: Baralho;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  usuarioId = await criarDonoDeTeste(aberto.usuarios);
  acervo = criarAcervo(aberto.armazenamento, usuarioId);

  // Só depois de abrir o armazenamento e criar o dono o relógio é congelado,
  // para que nenhuma infraestrutura de teste dependa do tempo falso.
  vi.useFakeTimers();
  vi.setSystemTime(INSTANTE_INICIAL);

  // Cria um Baralho de testes
  const resultadoBaralho = await acervo.criarBaralho({ nome: "Inglês" });
  if (!resultadoBaralho.ok) {
    throw new Error(`criação de Baralho recusada: ${resultadoBaralho.mensagem}`);
  }
  baralho = resultadoBaralho.baralho;
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

/** Cria um Cartão válido no Baralho de testes. */
async function criarCartao(frente = FRENTE, verso = VERSO): Promise<Cartao> {
  const resultado = await acervo.criarCartao(baralho.id, { frente, verso });

  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.cartao;
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

/** Os Cartões com revisão marcada antes de `fim`, lidos pela Porta. */
async function idsVencidosAte(fim: string): Promise<string[]> {
  const agendamentos = await aberto.armazenamento.listarAgendamentos(usuarioId);

  return agendamentos
    .filter((agendamento) => agendamento.proximaRevisaoEm < fim)
    .map((agendamento) => agendamento.cartaoId);
}

describe("registrarSessao — a Avaliação vira Agendamento", () => {
  it("agenda o Cartão novo estudado com bom para daqui a um dia (FR-205, SC-082)", async () => {
    const cartao = await criarCartao();

    await registrar(corpoComItens([itemDe(FRENTE, VERSO, cartao.id, "bom")]));

    // No dia do estudo o Cartão ainda não venceu, mas o Agendamento nasceu.
    expect(await idsVencidosAte(FIM_DO_DIA_DO_ESTUDO)).toEqual([]);
    expect(
      (await aberto.armazenamento.listarAgendamentos(usuarioId)).map(
        (agendamento) => agendamento.cartaoId,
      ),
    ).toEqual([cartao.id]);

    // Um dia depois ele vence — era essa a data que o SM-2 calculou.
    expect(await idsVencidosAte(FIM_DO_DIA_SEGUINTE)).toEqual([cartao.id]);
  });

  it("não reaplica as Avaliações quando o mesmo registro é reenviado (FR-210, SC-085)", async () => {
    const cartao = await criarCartao();
    const corpo = corpoComItens([itemDe(FRENTE, VERSO, cartao.id, "bom")]);

    const primeiro = await registrar(corpo);

    avancar(60);

    const reenviado = await registrar(corpo);

    expect(reenviado).toEqual(primeiro);
    expect(reenviado.concluidaEm).toBe(INSTANTE_INICIAL.toISOString());

    // Se tivesse reaplicado, a revisão teria saltado de um dia para seis.
    expect(await idsVencidosAte(FIM_DO_DIA_SEGUINTE)).toEqual([cartao.id]);
  });

  it("registra a Sessão de um Cartão que já não existe sem criar Agendamento (FR-165, FR-213)", async () => {
    const cartao = await criarCartao();

    expect(await acervo.excluirCartao(cartao.id)).toEqual({ ok: true });

    const registro = await registrar(
      corpoComItens([itemDe(FRENTE, VERSO, cartao.id, "bom")]),
    );

    expect(registro.itens[0]?.cartaoId).toBe(cartao.id);

    expect(
      await aberto.armazenamento.listarAgendamentos(usuarioId),
    ).toEqual([]);
  });

  it("deriva Baralho, nome e Baralho inexistente da Sessão de Revisão do dia (FR-196, FR-215)", async () => {
    const cartao = await criarCartao();

    const registro = await registrar(
      corpoComItens([itemDe(FRENTE, VERSO, cartao.id, "bom")], {
        origem: "revisao",
      }),
    );

    expect(registro.origem).toBe("revisao");
    expect(registro.baralhoId).toBe("");
    expect(registro.nomeDoBaralho).toBe("Revisão do dia");

    expect(await acervo.obterRegistroDeSessao(registro.id)).toEqual({
      ok: true,
      registro,
      baralhoExiste: false,
    });
  });

  it("deriva Baralho e nome da Sessão com baralho temporário e agenda o Cartão estudado (FR-369, FR-376)", async () => {
    const cartao = await criarCartao();

    const registro = await registrar(
      corpoComItens([itemDe(FRENTE, VERSO, cartao.id, "bom")], {
        origem: "temporario",
        baralhoId: "qualquer",
        nomeDoBaralho: "",
      }),
    );

    expect(registro.origem).toBe("temporario");
    expect(registro.baralhoId).toBe("");
    expect(registro.nomeDoBaralho).toBe("Baralho temporário");

    expect(await acervo.obterRegistroDeSessao(registro.id)).toEqual({
      ok: true,
      registro,
      baralhoExiste: false,
    });

    expect(await idsVencidosAte(FIM_DO_DIA_SEGUINTE)).toEqual([cartao.id]);
  });

  it("aceita nome válido para baralho temporário e o preserva (FR-369)", async () => {
    const cartao = await criarCartao();

    const registro = await registrar(
      corpoComItens([itemDe(FRENTE, VERSO, cartao.id, "bom")], {
        origem: "temporario",
        baralhoId: "qualquer",
        nomeDoBaralho: "Inglês da viagem",
      }),
    );

    expect(registro.origem).toBe("temporario");
    expect(registro.baralhoId).toBe("");
    expect(registro.nomeDoBaralho).toBe("Inglês da viagem");
  });

  it("recusa baralho temporário com nome muito longo (FR-369)", async () => {
    const cartao = await criarCartao();

    const resultado = await acervo.registrarSessao(
      corpoComItens([itemDe(FRENTE, VERSO, cartao.id, "bom")], {
        origem: "temporario",
        baralhoId: "qualquer",
        nomeDoBaralho: "a".repeat(101),
      }),
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toBe("dados_invalidos");
    }
  });

  it("deriva o Resultado de cada Item da Avaliação (FR-194, FR-195)", async () => {
    const cartao = await criarCartao();

    const registro = await registrar(
      corpoComItens(
        (["errei", "dificil", "bom", "facil"] as const).map((avaliacao) =>
          itemDe(FRENTE, VERSO, cartao.id, avaliacao),
        ),
      ),
    );

    expect(registro.itens.map((item) => item.resultado)).toEqual([
      "errou",
      "acertou",
      "acertou",
      "acertou",
    ]);
  });
});

describe("obterPrevias — a prévia do estudo livre", () => {
  it("devolve os quatro níveis por Cartão e omite identificadores alheios (FR-210, FR-221)", async () => {
    const primeiro = await criarCartao("To walk", "Caminhar");
    const segundo = await criarCartao("To run", "Correr");

    const resultado = await acervo.obterPrevias([
      primeiro.id,
      segundo.id,
      randomUUID(),
    ]);

    expect(resultado.ok).toBe(true);

    if (!resultado.ok) {
      throw new Error(`prévias recusadas inesperadamente: ${resultado.erro}`);
    }

    expect(Object.keys(resultado.previas).sort()).toEqual(
      [primeiro.id, segundo.id].sort(),
    );

    expect(Object.keys(resultado.previas[primeiro.id] ?? {}).sort()).toEqual([
      "bom",
      "dificil",
      "errei",
      "facil",
    ]);
  });

  it("recusa lista ausente, vazia, grande demais ou com item inválido (FR-221)", async () => {
    const muitos = Array.from({ length: 201 }, () => randomUUID());

    for (const cartaoIds of [
      [],
      "abc",
      42,
      null,
      undefined,
      [""],
      ["ok", ""],
      muitos,
    ]) {
      expect(await acervo.obterPrevias(cartaoIds)).toEqual({
        ok: false,
        erro: "dados_invalidos",
      });
    }
  });
});

describe("salvarPreferencias — troca de algoritmo", () => {
  it("reconstrói os Agendamentos com um algoritmo não registrado (FR-213, SC-083)", async () => {
    const cartao = await criarCartao();

    await registrar(corpoComItens([itemDe(FRENTE, VERSO, cartao.id, "bom")]));

    // Com o SM-2, o Cartão vence no dia seguinte.
    expect(await idsVencidosAte(FIM_DO_DIA_SEGUINTE)).toEqual([cartao.id]);

    const comFalso = criarAcervo(aberto.armazenamento, usuarioId, {
      algoritmos: new Map([["falso", ALGORITMO_FALSO]]),
    });

    const preferencias = await comFalso.obterPreferencias();

    expect(preferencias.ok && preferencias.preferencias.algoritmos).toEqual([
      {
        id: "falso",
        rotulo: "Falso",
        opcoesDeAvaliacao: [
          { chave: "errei", rotulo: "Errei (falso)", resultado: "errou" },
          { chave: "dificil", rotulo: "Difícil (falso)", resultado: "acertou" },
          { chave: "bom", rotulo: "Bom (falso)", resultado: "acertou" },
          { chave: "facil", rotulo: "Fácil (falso)", resultado: "acertou" },
        ],
      },
    ]);

    const salvo = await comFalso.salvarPreferencias({
      algoritmo: "falso",
      limiteDeNovosPorDia: 20,
    });

    expect(salvo.ok && salvo.preferencias.algoritmo).toBe("falso");

    // A reconstrução empurrou a revisão para daqui a 100 dias.
    expect(await idsVencidosAte(FIM_DO_DIA_SEGUINTE)).toEqual([]);

    const instanteDaRevisao =
      INSTANTE_INICIAL.getTime() + 100 * UM_DIA_EM_MILISSEGUNDOS;

    expect(
      await idsVencidosAte(
        new Date(instanteDaRevisao + UM_DIA_EM_MILISSEGUNDOS).toISOString(),
      ),
    ).toEqual([cartao.id]);
  });
});
