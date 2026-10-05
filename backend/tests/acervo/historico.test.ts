import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  criarAcervo,
  type Acervo,
  type Baralho,
  type Cartao,
  type DadosDeRegistro,
  type RegistroDeSessao,
  type RegistroResumido,
  type ResultadoDeCriacaoDeBaralho,
  type ResultadoDeCriacaoDeCartao,
  type ResultadoDeRegistroDeSessao,
} from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/**
 * T1201 — Histórico de estudo: `registrarSessao`, `obterEstatisticas` e
 * `obterRegistroDeSessao` (FR-161 a FR-179).
 *
 * Toda asserção atravessa a Interface do `Acervo` sobre o Adapter do
 * armazenamento local em memória; nenhum teste inspeciona tabela. O tempo é
 * controlado com `vi.setSystemTime` porque `concluidaEm` nasce do relógio do
 * servidor e as Estatísticas dependem da ordem e da janela dos registros.
 */

const BARALHO = "Inglês";
const FRENTE = "To walk";
const VERSO = "Caminhar";

/** O "agora" fixo de todos os testes que mexem com datas. */
const INSTANTE_INICIAL = new Date("2026-10-01T12:00:00.000Z");

const UM_SEGUNDO_EM_MILISSEGUNDOS = 1000;
const UM_DIA_EM_MILISSEGUNDOS = 24 * 60 * 60 * 1000;

/** Nível de Avaliação de um Item (FR-193); o Resultado é derivado dele. */
type NivelDeAvaliacao = "errei" | "dificil" | "bom" | "facil";

/** 1001 Itens válidos — um acima do limite do contrato. */
const ITENS_ACIMA_DO_LIMITE = Array.from({ length: 1001 }, () =>
  itemDe(FRENTE, VERSO, "bom"),
);

let aberto: ArmazenamentoSqliteAberto;
let acervo: Acervo;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  /**
   * O acervo é de um **dono**: todo Cartão, todo Baralho e todo Registro de
   * sessão pertencem a um Usuário, e a Interface do `Acervo` recebe o dono na
   * construção (FR-092, FR-166).
   */
  acervo = criarAcervo(
    aberto.armazenamento,
    await criarDonoDeTeste(aberto.usuarios),
  );

  // Só depois de abrir o armazenamento e criar o dono o relógio é congelado,
  // para que nenhuma infraestrutura de teste dependa do tempo falso.
  vi.useFakeTimers();
  vi.setSystemTime(INSTANTE_INICIAL);
});

afterEach(async () => {
  vi.useRealTimers();
  await aberto.encerrar();
});

/** Avança o relógio controlado, para que registros seguidos tenham instantes distintos. */
function avancar(segundos: number): void {
  vi.setSystemTime(
    new Date(Date.now() + segundos * UM_SEGUNDO_EM_MILISSEGUNDOS),
  );
}

/** Instante 24 h antes de agora — dentro da janela aceita por `desde`. */
function umDiaAtras(): string {
  return new Date(Date.now() - UM_DIA_EM_MILISSEGUNDOS).toISOString();
}

/** Corpo cru de `POST /sessoes` com valores válidos; o teste troca só o campo em questão. */
function corpoDeRegistro(
  mudancas: Partial<DadosDeRegistro> = {},
): DadosDeRegistro {
  return {
    id: randomUUID(),
    origem: "baralho",
    baralhoId: "baralho-1",
    nomeDoBaralho: BARALHO,
    itens: [itemDe(FRENTE, VERSO, "bom"), itemDe("To run", "Correr", "errei")],
    ...mudancas,
  };
}

/**
 * Item cru do corpo: Frente, Verso, Cartão de origem e Avaliação (FR-193). O
 * `cartaoId` é gerado quando o teste não aponta um Cartão de verdade — o
 * Registro é preservado mesmo quando ele já não existe (FR-165).
 */
function itemDe(
  frente: string,
  verso: string,
  avaliacao: NivelDeAvaliacao,
  cartaoId: string = randomUUID(),
): {
  frente: string;
  verso: string;
  cartaoId: string;
  avaliacao: NivelDeAvaliacao;
} {
  return { frente, verso, cartaoId, avaliacao };
}

/** Desembrulha o Registro de uma gravação aceita; falha se foi recusada. */
function registroDo(resultado: ResultadoDeRegistroDeSessao): RegistroDeSessao {
  if (!resultado.ok) {
    throw new Error(`registro recusado inesperadamente: ${resultado.erro}`);
  }

  return resultado.registro;
}

/** O registro sem os Itens, como as listagens de Estatísticas o devolvem. */
function resumoDo(registro: RegistroDeSessao): RegistroResumido {
  return {
    id: registro.id,
    baralhoId: registro.baralhoId,
    nomeDoBaralho: registro.nomeDoBaralho,
    concluidaEm: registro.concluidaEm,
    origem: registro.origem,
    estudados: registro.estudados,
    acertos: registro.acertos,
    erros: registro.erros,
  };
}

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
async function criarCartao(frente = FRENTE, verso = VERSO): Promise<Cartao> {
  return cartaoDo(await acervo.criarCartao({ frente, verso }));
}

/** Cria um Baralho válido pela Interface. */
async function criarBaralho(nome: string): Promise<Baralho> {
  return baralhoDo(await acervo.criarBaralho({ nome }));
}

/**
 * Um `Acervo` de **outro** Usuário sobre o mesmo armazenamento (FR-166). O
 * Nome de usuário precisa ser distinto do dono do cenário: a unicidade sem
 * distinção de caixa é do banco (FR-074, SC-025), e dois donos de teste com o
 * mesmo nome colidiriam antes de o caso começar.
 */
async function criarAcervoDeOutroUsuario(): Promise<Acervo> {
  return criarAcervo(
    aberto.armazenamento,
    await criarDonoDeTeste(aberto.usuarios, "dono-dois", "bruno.souza"),
  );
}

describe("registrarSessao — registro da Sessão concluída", () => {
  it("registra a Sessão derivando totais, resultados e posições dos Itens", async () => {
    const primeiro = itemDe(FRENTE, VERSO, "bom");
    const segundo = itemDe("To run", "Correr", "errei");
    const terceiro = itemDe("To sleep", "Dormir", "facil");

    const corpo = corpoDeRegistro({ itens: [primeiro, segundo, terceiro] });

    const registro = registroDo(await acervo.registrarSessao(corpo));

    expect(registro).toEqual({
      id: corpo.id,
      baralhoId: corpo.baralhoId,
      nomeDoBaralho: corpo.nomeDoBaralho,
      origem: "baralho",
      concluidaEm: INSTANTE_INICIAL.toISOString(),
      estudados: 3,
      acertos: 2,
      erros: 1,
      itens: [
        {
          posicao: 0,
          frente: FRENTE,
          verso: VERSO,
          resultado: "acertou",
          cartaoId: primeiro.cartaoId,
          avaliacao: "bom",
          avaliacaoRotulo: "Bom",
        },
        {
          posicao: 1,
          frente: "To run",
          verso: "Correr",
          resultado: "errou",
          cartaoId: segundo.cartaoId,
          avaliacao: "errei",
          avaliacaoRotulo: "Errei",
        },
        {
          posicao: 2,
          frente: "To sleep",
          verso: "Dormir",
          resultado: "acertou",
          cartaoId: terceiro.cartaoId,
          avaliacao: "facil",
          avaliacaoRotulo: "Fácil",
        },
      ],
    });
  });

  it("registra Sessão de 1 Item com o percentual correspondente", async () => {
    const comAcerto = registroDo(
      await acervo.registrarSessao(
        corpoDeRegistro({ itens: [itemDe(FRENTE, VERSO, "bom")] }),
      ),
    );

    const comErro = registroDo(
      await acervo.registrarSessao(
        corpoDeRegistro({ itens: [itemDe(FRENTE, VERSO, "errei")] }),
      ),
    );

    expect(comAcerto).toMatchObject({ estudados: 1, acertos: 1, erros: 0 });
    expect(comErro).toMatchObject({ estudados: 1, acertos: 0, erros: 1 });
  });

  it("recusa identificador fora da forma UUID como dados_invalidos", async () => {
    for (const id of ["", "sessao-1", "123", 42, null, undefined]) {
      expect(await acervo.registrarSessao(corpoDeRegistro({ id }))).toEqual({
        ok: false,
        erro: "dados_invalidos",
      });
    }
  });

  it("recusa Baralho sem identificação como dados_invalidos", async () => {
    for (const baralhoId of ["", "   ", 7, null, undefined]) {
      expect(
        await acervo.registrarSessao(corpoDeRegistro({ baralhoId })),
      ).toEqual({ ok: false, erro: "dados_invalidos" });
    }
  });

  it("recusa nome do Baralho fora de 1 a 100 caracteres como dados_invalidos", async () => {
    for (const nomeDoBaralho of [
      "",
      "   ",
      "a".repeat(101),
      7,
      null,
      undefined,
    ]) {
      expect(
        await acervo.registrarSessao(corpoDeRegistro({ nomeDoBaralho })),
      ).toEqual({ ok: false, erro: "dados_invalidos" });
    }
  });

  it("recusa lista de Itens ausente, vazia ou acima de 1000 como dados_invalidos", async () => {
    for (const itens of [
      undefined,
      null,
      [],
      "itens",
      42,
      {},
      ITENS_ACIMA_DO_LIMITE,
    ]) {
      expect(await acervo.registrarSessao(corpoDeRegistro({ itens }))).toEqual({
        ok: false,
        erro: "dados_invalidos",
      });
    }
  });

  it("recusa Item com Frente ou Verso fora das regras de Cartão como dados_invalidos", async () => {
    const casos = [
      [itemDe("", VERSO, "bom")],
      [itemDe("   ", VERSO, "bom")],
      [itemDe(FRENTE, "", "bom")],
      [itemDe("a".repeat(1001), VERSO, "bom")],
      [itemDe(FRENTE, "a".repeat(1001), "bom")],
    ];

    for (const itens of casos) {
      expect(await acervo.registrarSessao(corpoDeRegistro({ itens }))).toEqual({
        ok: false,
        erro: "dados_invalidos",
      });
    }
  });

  it("recusa Item com Avaliação desconhecida como dados_invalidos", async () => {
    for (const avaliacao of [
      "acerto",
      "erro",
      "ACERTOU",
      "",
      1,
      null,
      undefined,
    ]) {
      const itens = [
        { frente: FRENTE, verso: VERSO, cartaoId: randomUUID(), avaliacao },
      ];

      expect(await acervo.registrarSessao(corpoDeRegistro({ itens }))).toEqual({
        ok: false,
        erro: "dados_invalidos",
      });
    }
  });

  it("recusa Item que não é objeto como dados_invalidos", async () => {
    for (const item of ["To walk", null, 1, [FRENTE, VERSO, "acertou"], {}]) {
      expect(
        await acervo.registrarSessao(corpoDeRegistro({ itens: [item] })),
      ).toEqual({ ok: false, erro: "dados_invalidos" });
    }
  });

  it("não registra nada quando o corpo é recusado (FR-162, FR-164)", async () => {
    await acervo.registrarSessao(corpoDeRegistro({ id: "sessao-1" }));
    await acervo.registrarSessao(corpoDeRegistro({ itens: [] }));

    expect(await acervo.obterEstatisticas(umDiaAtras())).toEqual({
      ok: true,
      estatisticas: {
        cartoes: 0,
        baralhos: 0,
        registrosDaJanela: [],
        recentes: [],
      },
    });
  });

  it("aceita o mesmo registro reenviado sem duplicar e preserva o instante de conclusão (FR-163)", async () => {
    const corpo = corpoDeRegistro();

    const primeiro = registroDo(await acervo.registrarSessao(corpo));

    avancar(60);

    const segundo = registroDo(await acervo.registrarSessao(corpo));

    expect(segundo).toEqual(primeiro);
    expect(segundo.concluidaEm).toBe(INSTANTE_INICIAL.toISOString());

    expect(await acervo.obterEstatisticas(umDiaAtras())).toEqual({
      ok: true,
      estatisticas: {
        cartoes: 0,
        baralhos: 0,
        registrosDaJanela: [resumoDo(primeiro)],
        recentes: [resumoDo(primeiro)],
      },
    });
  });

  it("recusa o mesmo identificador vindo de outro Usuário como conflito (FR-166)", async () => {
    const corpo = corpoDeRegistro();

    registroDo(await acervo.registrarSessao(corpo));

    const outroAcervo = await criarAcervoDeOutroUsuario();

    expect(await outroAcervo.registrarSessao(corpo)).toEqual({
      ok: false,
      erro: "conflito",
    });
  });

  it("trata o registro de outro Usuário como inexistente (FR-166, SC-075)", async () => {
    const registro = registroDo(await acervo.registrarSessao(corpoDeRegistro()));

    const outroAcervo = await criarAcervoDeOutroUsuario();

    expect(await outroAcervo.obterRegistroDeSessao(registro.id)).toEqual({
      ok: false,
      erro: "nao_encontrado",
    });

    expect(await outroAcervo.obterEstatisticas(umDiaAtras())).toEqual({
      ok: true,
      estatisticas: {
        cartoes: 0,
        baralhos: 0,
        registrosDaJanela: [],
        recentes: [],
      },
    });
  });
});

describe("obterRegistroDeSessao — registro imutável", () => {
  it("trata registro inexistente como nao_encontrado", async () => {
    expect(await acervo.obterRegistroDeSessao(randomUUID())).toEqual({
      ok: false,
      erro: "nao_encontrado",
    });
  });

  it("preserva os textos e o nome do Baralho depois de editar o Cartão e excluir o Baralho (FR-165, FR-178)", async () => {
    const baralho = await criarBaralho(BARALHO);
    const cartao = await criarCartao();

    expect(await acervo.vincular(cartao.id, baralho.id)).toEqual({ ok: true });

    const registro = registroDo(
      await acervo.registrarSessao(
        corpoDeRegistro({
          baralhoId: baralho.id,
          nomeDoBaralho: baralho.nome,
          itens: [itemDe(cartao.frente, cartao.verso, "errei", cartao.id)],
        }),
      ),
    );

    expect(await acervo.obterRegistroDeSessao(registro.id)).toEqual({
      ok: true,
      registro,
      baralhoExiste: true,
    });

    expect(
      await acervo.editarCartao(cartao.id, {
        frente: "To stroll",
        verso: "Passear",
      }),
    ).toEqual({
      ok: true,
      cartao: { id: cartao.id, frente: "To stroll", verso: "Passear" },
    });

    expect(await acervo.obterRegistroDeSessao(registro.id)).toEqual({
      ok: true,
      registro,
      baralhoExiste: true,
    });

    expect(await acervo.excluirBaralho(baralho.id)).toEqual({ ok: true });

    expect(await acervo.obterRegistroDeSessao(registro.id)).toEqual({
      ok: true,
      registro,
      baralhoExiste: false,
    });
  });

  it("preserva o registro mesmo quando o Cartão estudado é excluído (FR-165)", async () => {
    const cartao = await criarCartao();

    const registro = registroDo(
      await acervo.registrarSessao(
        corpoDeRegistro({
          itens: [itemDe(cartao.frente, cartao.verso, "bom", cartao.id)],
        }),
      ),
    );

    expect(await acervo.excluirCartao(cartao.id)).toEqual({ ok: true });

    expect(await acervo.obterRegistroDeSessao(registro.id)).toEqual({
      ok: true,
      registro,
      baralhoExiste: false,
    });
  });
});

describe("obterEstatisticas — números de Início", () => {
  it("devolve zeros e listas vazias num Histórico sem registros (FR-172)", async () => {
    expect(await acervo.obterEstatisticas(umDiaAtras())).toEqual({
      ok: true,
      estatisticas: {
        cartoes: 0,
        baralhos: 0,
        registrosDaJanela: [],
        recentes: [],
      },
    });
  });

  it("conta Cartões e Baralhos atuais e os registros da janela, do mais novo ao mais antigo (FR-169)", async () => {
    const baralho = await criarBaralho(BARALHO);

    await criarCartao();
    await criarCartao("To run", "Correr");

    const primeiro = registroDo(
      await acervo.registrarSessao(
        corpoDeRegistro({
          baralhoId: baralho.id,
          nomeDoBaralho: baralho.nome,
        }),
      ),
    );

    avancar(60);

    const segundo = registroDo(
      await acervo.registrarSessao(
        corpoDeRegistro({
          baralhoId: baralho.id,
          nomeDoBaralho: baralho.nome,
          itens: [itemDe(FRENTE, VERSO, "errei")],
        }),
      ),
    );

    expect(await acervo.obterEstatisticas(umDiaAtras())).toEqual({
      ok: true,
      estatisticas: {
        cartoes: 2,
        baralhos: 1,
        registrosDaJanela: [resumoDo(segundo), resumoDo(primeiro)],
        recentes: [resumoDo(segundo), resumoDo(primeiro)],
      },
    });
  });

  it("deixa a janela vazia para registros fora dela sem esconder as Sessões recentes (FR-169)", async () => {
    const registro = registroDo(await acervo.registrarSessao(corpoDeRegistro()));

    const janelaNoFuturo = new Date(
      Date.now() + 60 * 60 * UM_SEGUNDO_EM_MILISSEGUNDOS,
    ).toISOString();

    expect(await acervo.obterEstatisticas(janelaNoFuturo)).toEqual({
      ok: true,
      estatisticas: {
        cartoes: 0,
        baralhos: 0,
        registrosDaJanela: [],
        recentes: [resumoDo(registro)],
      },
    });
  });

  it("mostra as 5 Sessões mais recentes, da mais nova para a mais antiga (FR-169, FR-177)", async () => {
    const registros: RegistroDeSessao[] = [];

    for (let indice = 0; indice < 7; indice += 1) {
      registros.push(registroDo(await acervo.registrarSessao(corpoDeRegistro())));

      avancar(60);
    }

    const resultado = await acervo.obterEstatisticas(umDiaAtras());

    if (!resultado.ok) {
      throw new Error(`estatísticas recusadas inesperadamente: ${resultado.erro}`);
    }

    const maisNovosPrimeiro = registros
      .map((registro) => registro.id)
      .reverse();

    const resumoPorId = new Map(
      registros.map(
        (registro) => [registro.id, resumoDo(registro)] as const,
      ),
    );

    expect(resultado.estatisticas.registrosDaJanela.map((r) => r.id)).toEqual(
      maisNovosPrimeiro,
    );

    expect(resultado.estatisticas.recentes).toEqual(
      maisNovosPrimeiro.slice(0, 5).map((id) => resumoPorId.get(id)),
    );
  });

  it("recusa desde fora de ISO-8601, muito no futuro ou muito no passado (FR-169)", async () => {
    const agora = INSTANTE_INICIAL.getTime();

    const recusados = [
      "",
      "ontem",
      "2026-10-01",
      "2026-13-01T00:00:00.000Z",
      new Date(agora + 2 * UM_DIA_EM_MILISSEGUNDOS).toISOString(),
      new Date(agora - 32 * UM_DIA_EM_MILISSEGUNDOS).toISOString(),
    ];

    for (const desde of recusados) {
      expect(await acervo.obterEstatisticas(desde)).toEqual({
        ok: false,
        erro: "dados_invalidos",
      });
    }
  });

  it("aceita desde dentro da janela, no limite do mês e com relógio adiantado (FR-169)", async () => {
    const agora = INSTANTE_INICIAL.getTime();

    const aceitos = [
      new Date(agora).toISOString(),
      new Date(agora - 31 * UM_DIA_EM_MILISSEGUNDOS).toISOString(),
      new Date(agora + UM_DIA_EM_MILISSEGUNDOS).toISOString(),
    ];

    for (const desde of aceitos) {
      expect(await acervo.obterEstatisticas(desde)).toEqual({
        ok: true,
        estatisticas: {
          cartoes: 0,
          baralhos: 0,
          registrosDaJanela: [],
          recentes: [],
        },
      });
    }
  });
});
