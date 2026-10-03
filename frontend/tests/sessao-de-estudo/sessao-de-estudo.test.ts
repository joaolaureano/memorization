import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Avaliacao, Cartao } from "../../src/acervo-cliente/cliente";
import {
  AleatoriedadeDeterministica,
  AleatoriedadeReal,
} from "../../src/sessao-de-estudo/aleatoriedade";
import {
  MENSAGEM_DE_AVALIACAO_INVALIDA,
  MENSAGEM_DE_BARALHO_INELEGIVEL,
  MENSAGEM_DE_QUANTIDADE_INVALIDA,
  MENSAGEM_DE_REVELACAO_AUSENTE,
  MENSAGEM_DE_REVISAO_VAZIA,
  MENSAGEM_DE_SESSAO_CONCLUIDA,
  SessaoDeEstudo,
  derivarResultado,
  percentualDeAcertos,
} from "../../src/sessao-de-estudo/sessao-de-estudo";
import type { ResumoDaSessao } from "../../src/sessao-de-estudo/sessao-de-estudo";

/**
 * T301–T303 — bateria do Module `SessaoDeEstudo`
 * (specs/004-sessao-de-estudo/tasks.md).
 *
 * Toda asserção atravessa a Interface pública — `iniciar`, `revelar`,
 * `registrarResultado` e `estadoAtual` — nunca o estado interno. A ordem é
 * exercitada com a `AleatoriedadeDeterministica`, o Adapter de teste da Seam
 * `Aleatoriedade`, para provar seleção sem repetição, imutabilidade e limites
 * sem depender de probabilidade.
 *
 * T303 acrescenta a prova negativa: a Sessão não persiste nada e não fala com
 * o transporte do acervo. O Module é lido como texto para assegurar que não
 * importa `cliente-http` e não usa `localStorage`/`sessionStorage`; o
 * comportamento de concluir uma Sessão também não deixa vestígio no
 * armazenamento do navegador.
 */

const BARALHO_ID = "b1";

function criarCartao(id: string): Cartao {
  return { id, frente: `Frente ${id}`, verso: `Verso ${id}` };
}

function cartoes(ids: string[]): Cartao[] {
  return ids.map(criarCartao);
}

function iniciarComSucesso(
  quantidade: number,
  ids: string[],
  valores: number[],
): SessaoDeEstudo {
  const resultado = SessaoDeEstudo.iniciar(
    BARALHO_ID,
    quantidade,
    cartoes(ids),
    new AleatoriedadeDeterministica(valores),
  );

  if (!resultado.ok) {
    throw new Error(`a Sessão deveria iniciar: ${resultado.mensagem}`);
  }

  return resultado.sessao;
}

/** Revela e registra a Avaliação do Item corrente, exigindo sucesso. */
function responder(sessao: SessaoDeEstudo, avaliacao: Avaliacao): void {
  const revelacao = sessao.revelar();

  if (!revelacao.ok) {
    throw new Error(`a Revelação deveria ser aceita: ${revelacao.mensagem}`);
  }

  const registro = sessao.registrarAvaliacao(avaliacao);

  if (!registro.ok) {
    throw new Error(
      `a Avaliação deveria ser aceita: ${registro.mensagem}`,
    );
  }
}

function lerFonte(nome: string): string {
  return readFileSync(
    join(process.cwd(), "src", "sessao-de-estudo", nome),
    "utf8",
  );
}

describe("SessaoDeEstudo — início (T301)", () => {
  it("inicia de um Baralho elegível com a quantidade exata e sem repetição (FR-025, FR-027, FR-030, FR-031)", () => {
    const sessao = iniciarComSucesso(
      3,
      ["c1", "c2", "c3", "c4", "c5"],
      [0, 0, 0, 0],
    );

    const estado = sessao.estadoAtual();

    expect(estado.concluida).toBe(false);
    if (estado.concluida) {
      throw new Error("a Sessão deveria estar em andamento");
    }
    expect(estado.total).toBe(3);
    expect(estado.posicao).toBe(1);
    expect(estado.itemAtual.revelado).toBe(false);
    expect(estado.itens.map((item) => item.cartaoId)).toEqual([
      "c2",
      "c3",
      "c4",
    ]);
    expect(new Set(estado.itens.map((item) => item.cartaoId)).size).toBe(3);
  });

  it("em cem Sessões de um Baralho com dez Cartões, nenhum se repete e a ordem varia (SC-002)", () => {
    const ids = Array.from({ length: 10 }, (_, indice) => `c${indice + 1}`);
    const ordens = new Set<string>();

    for (let sessao = 0; sessao < 100; sessao += 1) {
      const resultado = SessaoDeEstudo.iniciar(
        BARALHO_ID,
        ids.length,
        cartoes(ids),
        new AleatoriedadeReal(),
      );

      if (!resultado.ok) {
        throw new Error(`a Sessão deveria iniciar: ${resultado.mensagem}`);
      }

      const ordem = resultado.sessao
        .estadoAtual()
        .itens.map((item) => item.cartaoId);

      expect(ordem).toHaveLength(ids.length);
      expect(new Set(ordem).size).toBe(ids.length);
      ordens.add(ordem.join(","));
    }

    expect(ordens.size).toBeGreaterThan(1);
  });

  it("limita ao disponível e avisa antes do primeiro Item (FR-029)", () => {
    const sessao = iniciarComSucesso(50, ["c1", "c2", "c3"], [0, 0]);

    const estado = sessao.estadoAtual();

    if (estado.concluida) {
      throw new Error("a Sessão deveria estar em andamento");
    }
    expect(estado.total).toBe(3);
    expect(estado.itemAtual.revelado).toBe(false);
    expect(estado.avisoDeLimite).toBe(
      "Você pediu 50 Cartões, mas este Baralho tem 3. A Sessão terá 3 Itens.",
    );
  });

  it("recusa quantidade menor que um ou não inteira (FR-028)", () => {
    for (const quantidade of [0, -1, 1.5]) {
      const resultado = SessaoDeEstudo.iniciar(
        BARALHO_ID,
        quantidade,
        cartoes(["c1"]),
      );

      expect(resultado).toEqual({
        ok: false,
        erro: "quantidade_invalida",
        mensagem: MENSAGEM_DE_QUANTIDADE_INVALIDA,
      });
    }
  });

  it("recusa Baralho inelegível: nenhum Cartão vinculado (FR-025)", () => {
    const resultado = SessaoDeEstudo.iniciar(BARALHO_ID, 3, []);

    expect(resultado).toEqual({
      ok: false,
      erro: "baralho_inelegivel",
      mensagem: MENSAGEM_DE_BARALHO_INELEGIVEL,
    });
  });

  it("estudar todos os Cartões apresenta cada um exatamente uma vez (FR-031)", () => {
    const sessao = iniciarComSucesso(
      5,
      ["c1", "c2", "c3", "c4", "c5"],
      [0.99, 0.99, 0.99, 0.99],
    );

    const ids = sessao.estadoAtual().itens.map((item) => item.cartaoId);

    expect(ids).toHaveLength(5);
    expect(new Set(ids)).toEqual(new Set(["c1", "c2", "c3", "c4", "c5"]));
  });

  it("Baralho com exatamente um Cartão é uma Sessão válida de um Item", () => {
    const sessao = iniciarComSucesso(1, ["c1"], []);

    const estado = sessao.estadoAtual();

    if (estado.concluida) {
      throw new Error("a Sessão deveria estar em andamento");
    }
    expect(estado.total).toBe(1);
    expect(estado.posicao).toBe(1);
    expect(estado.itemAtual.revelado).toBe(false);
  });

  it("a ordem é definida no início e não muda durante a Sessão (FR-030)", () => {
    const sessao = iniciarComSucesso(3, ["c1", "c2", "c3"], [0, 0]);

    const ordemInicial = sessao.estadoAtual().itens.map((item) => item.cartaoId);

    responder(sessao, "bom");

    const ordemDepois = sessao.estadoAtual().itens.map((item) => item.cartaoId);

    expect(ordemDepois).toEqual(ordemInicial);
  });

  it("captura Frente e Verso no início: alterar o Cartão depois não muda o Item", () => {
    const cartao = criarCartao("c1");
    const resultado = SessaoDeEstudo.iniciar(
      BARALHO_ID,
      1,
      [cartao],
      new AleatoriedadeDeterministica([]),
    );

    if (!resultado.ok) {
      throw new Error(`a Sessão deveria iniciar: ${resultado.mensagem}`);
    }

    cartao.frente = "Frente alterada";
    cartao.verso = "Verso alterado";

    const estado = resultado.sessao.estadoAtual();

    if (estado.concluida) {
      throw new Error("a Sessão deveria estar em andamento");
    }
    expect(estado.itemAtual.frente).toBe("Frente c1");

    const revelacao = resultado.sessao.revelar();
    if (!revelacao.ok) {
      throw new Error(`a Revelação deveria ser aceita: ${revelacao.mensagem}`);
    }

    expect(revelacao.item.verso).toBe("Verso c1");
  });
});

describe("SessaoDeEstudo — Revelação, Resultado e Resumo (T302)", () => {
  it("apresenta apenas a Frente até a Revelação: Verso e Resultado ocultos (FR-032)", () => {
    const sessao = iniciarComSucesso(1, ["c1"], []);

    const estado = sessao.estadoAtual();

    if (estado.concluida) {
      throw new Error("a Sessão deveria estar em andamento");
    }

    const item = estado.itemAtual;

    expect(item.revelado).toBe(false);
    expect(item.verso).toBeNull();
    expect(item.resultado).toBeNull();
  });

  it("Revelação exibe o Verso e torna o Resultado disponível (FR-033)", () => {
    const sessao = iniciarComSucesso(1, ["c1"], []);

    const revelacao = sessao.revelar();

    if (!revelacao.ok) {
      throw new Error(`a Revelação deveria ser aceita: ${revelacao.mensagem}`);
    }

    expect(revelacao.item.revelado).toBe(true);
    expect(revelacao.item.verso).toBe("Verso c1");
    expect(revelacao.item.resultado).toBeNull();

    const estado = sessao.estadoAtual();

    if (estado.concluida) {
      throw new Error("a Sessão deveria estar em andamento");
    }
    expect(estado.itemAtual.revelado).toBe(true);
  });

  it("recusa a Avaliação antes da Revelação (FR-034, FR-193)", () => {
    const sessao = iniciarComSucesso(1, ["c1"], []);

    const registro = sessao.registrarAvaliacao("bom");

    expect(registro).toEqual({
      ok: false,
      erro: "revelacao_ausente",
      mensagem: MENSAGEM_DE_REVELACAO_AUSENTE,
    });
    expect(sessao.estadoAtual().concluida).toBe(false);
  });

  it("aceita apenas as 4 Avaliações como entrada (FR-192, FR-193)", () => {
    const sessao = iniciarComSucesso(1, ["c1"], []);
    sessao.revelar();

    const registro = sessao.registrarAvaliacao("correto" as Avaliacao);

    expect(registro).toEqual({
      ok: false,
      erro: "avaliacao_invalida",
      mensagem: MENSAGEM_DE_AVALIACAO_INVALIDA,
    });
  });

  it("registra uma única Avaliação e avança para o próximo Item (FR-035, FR-150)", () => {
    const sessao = iniciarComSucesso(2, ["c1", "c2"], [0.99]);

    responder(sessao, "bom");

    const estado = sessao.estadoAtual();

    expect(estado.concluida).toBe(false);
    if (estado.concluida) {
      throw new Error("a Sessão deveria estar em andamento");
    }
    expect(estado.posicao).toBe(2);
    expect(estado.itemAtual.cartaoId).toBe("c2");
    expect(estado.itemAtual.revelado).toBe(false);

    const primeiro = estado.itens[0];
    expect(primeiro.cartaoId).toBe("c1");
    expect(primeiro.revelado).toBe(true);

    if (primeiro.revelado) {
      expect(primeiro.avaliacao).toBe("bom");
      expect(primeiro.resultado).toBe("acertou");
      expect(Object.isFrozen(primeiro)).toBe(true);
    }

    // Uma nova tentativa de registro agora mira o Item seguinte, ainda com o
    // Verso oculto; é recusada, e a Avaliação anterior permanece intacta.
    expect(sessao.registrarAvaliacao("errei")).toEqual({
      ok: false,
      erro: "revelacao_ausente",
      mensagem: MENSAGEM_DE_REVELACAO_AUSENTE,
    });

    const depois = sessao.estadoAtual().itens[0];
    if (depois.revelado) {
      expect(depois.avaliacao).toBe("bom");
      expect(depois.resultado).toBe("acertou");
    }
  });

  it("recusa uma segunda Avaliação no mesmo Item (FR-150)", () => {
    const sessao = iniciarComSucesso(2, ["c1", "c2"], [0.99]);

    responder(sessao, "bom");

    // Após a Avaliação, o Item anterior está fechado: sem uma nova Revelação
    // do Item seguinte, qualquer Avaliação é recusada.
    expect(sessao.registrarAvaliacao("facil")).toEqual({
      ok: false,
      erro: "revelacao_ausente",
      mensagem: MENSAGEM_DE_REVELACAO_AUSENTE,
    });
    expect(sessao.estadoAtual().itens[0].resultado).toBe("acertou");
  });

  it("Resumo coerente ao final: acertos + erros = estudados (FR-037)", () => {
    const sessao = iniciarComSucesso(3, ["c1", "c2", "c3"], [0.99, 0.99]);

    responder(sessao, "bom");
    responder(sessao, "errei");
    sessao.revelar();
    const registro = sessao.registrarAvaliacao("facil");

    if (!registro.ok || !("resumo" in registro)) {
      throw new Error("a Sessão deveria concluir com Resumo");
    }

    expect(registro.resumo).toEqual({ estudados: 3, acertos: 2, erros: 1 });

    const estado = sessao.estadoAtual();

    if (!estado.concluida) {
      throw new Error("a Sessão deveria estar concluída");
    }

    expect(estado.itemAtual).toBeNull();
    expect(estado.resumo).toEqual({ estudados: 3, acertos: 2, erros: 1 });
    expect(estado.resumo.acertos + estado.resumo.erros).toBe(
      estado.resumo.estudados,
    );
  });

  it("Resumo com todos os Itens errados tem zero acertos (edge case)", () => {
    const sessao = iniciarComSucesso(2, ["c1", "c2"], [0.99]);

    responder(sessao, "errei");
    sessao.revelar();
    const registro = sessao.registrarAvaliacao("errei");

    if (!registro.ok || !("resumo" in registro)) {
      throw new Error("a Sessão deveria concluir com Resumo");
    }

    expect(registro.resumo).toEqual({ estudados: 2, acertos: 0, erros: 2 });
  });

  it("recusa Revelação e Avaliação após a conclusão", () => {
    const sessao = iniciarComSucesso(1, ["c1"], []);
    responder(sessao, "bom");

    expect(sessao.revelar()).toEqual({
      ok: false,
      erro: "sessao_concluida",
      mensagem: MENSAGEM_DE_SESSAO_CONCLUIDA,
    });
    expect(sessao.registrarAvaliacao("errei")).toEqual({
      ok: false,
      erro: "sessao_concluida",
      mensagem: MENSAGEM_DE_SESSAO_CONCLUIDA,
    });
  });
});

describe("SessaoDeEstudo — Avaliação em 4 níveis e derivação (T1511, FR-192–FR-195)", () => {
  const derivacoes: ReadonlyArray<[Avaliacao, "acertou" | "errou"]> = [
    ["errei", "errou"],
    ["dificil", "acertou"],
    ["bom", "acertou"],
    ["facil", "acertou"],
  ];

  for (const [avaliacao, esperado] of derivacoes) {
    it(`registra a Avaliação ${avaliacao} e deriva o Resultado ${esperado} (FR-193, FR-194)`, () => {
      const sessao = iniciarComSucesso(1, ["c1"], []);

      responder(sessao, avaliacao);

      const item = sessao.estadoAtual().itens[0];

      expect(item.revelado).toBe(true);
      if (item.revelado) {
        expect(item.avaliacao).toBe(avaliacao);
        expect(item.resultado).toBe(esperado);
      }
    });
  }

  it("derivarResultado traduz as 4 Avaliações para as 2 vias (FR-194, FR-195)", () => {
    expect(derivarResultado("errei")).toBe("errou");
    expect(derivarResultado("dificil")).toBe("acertou");
    expect(derivarResultado("bom")).toBe("acertou");
    expect(derivarResultado("facil")).toBe("acertou");
  });

  it("cada Item guarda o cartaoId do Cartão de origem (FR-196)", () => {
    const sessao = iniciarComSucesso(2, ["c7", "c9"], [0.99]);

    expect(sessao.estadoAtual().itens.map((item) => item.cartaoId)).toEqual([
      "c7",
      "c9",
    ]);
  });
});

describe("SessaoDeEstudo — Revisão do dia (T1511, FR-201)", () => {
  it("cria a Sessão a partir da lista já ordenada, sem embaralhar (FR-201)", () => {
    const resultado = SessaoDeEstudo.iniciarDaRevisao(
      cartoes(["c3", "c1", "c2"]),
    );

    if (!resultado.ok) {
      throw new Error(`a Sessão deveria iniciar: ${resultado.mensagem}`);
    }

    const estado = resultado.sessao.estadoAtual();

    expect(estado.total).toBe(3);
    expect(estado.itens.map((item) => item.cartaoId)).toEqual([
      "c3",
      "c1",
      "c2",
    ]);

    if (estado.concluida) {
      throw new Error("a Sessão deveria estar em andamento");
    }
    expect(estado.itemAtual.cartaoId).toBe("c3");
    expect(estado.itemAtual.revelado).toBe(false);
  });

  it("recusa a Revisão sem Cartões, com código próprio (FR-201)", () => {
    const resultado = SessaoDeEstudo.iniciarDaRevisao([]);

    expect(resultado).toEqual({
      ok: false,
      erro: "revisao_vazia",
      mensagem: MENSAGEM_DE_REVISAO_VAZIA,
    });
  });

  it("a Sessão da Revisão aceita Avaliação normalmente (FR-201)", () => {
    const resultado = SessaoDeEstudo.iniciarDaRevisao(cartoes(["c1", "c2"]));

    if (!resultado.ok) {
      throw new Error(`a Sessão deveria iniciar: ${resultado.mensagem}`);
    }

    responder(resultado.sessao, "bom");

    const item = resultado.sessao.estadoAtual().itens[0];
    if (item.revelado) {
      expect(item.avaliacao).toBe("bom");
      expect(item.resultado).toBe("acertou");
    }
  });
});

describe("SessaoDeEstudo — interrupção e ausência de persistência (T303)", () => {
  it("interromper descarta a Sessão: uma nova começa sem vestígios (FR-039)", () => {
    const primeira = iniciarComSucesso(
      3,
      ["c1", "c2", "c3"],
      [0.99, 0.99],
    );
    responder(primeira, "bom");

    // Interromper é abandonar a instância; não há retomada. Uma nova Sessão
    // do mesmo Baralho nasce do zero, sem posição, Revelação ou Resultado.
    const nova = iniciarComSucesso(3, ["c1", "c2", "c3"], [0.99, 0.99]);
    const estado = nova.estadoAtual();

    expect(estado.concluida).toBe(false);
    if (estado.concluida) {
      throw new Error("a Sessão deveria estar em andamento");
    }
    expect(estado.posicao).toBe(1);
    expect(estado.itemAtual.revelado).toBe(false);
    expect(estado.resumo).toBeNull();

    for (const item of estado.itens) {
      expect(item.revelado).toBe(false);
      expect(item.resultado).toBeNull();
    }
  });

  it("concluir uma Sessão não deixa vestígio no armazenamento do navegador (FR-038)", () => {
    localStorage.clear();
    sessionStorage.clear();

    const sessao = iniciarComSucesso(1, ["c1"], []);
    responder(sessao, "bom");

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("o Module não importa o transporte do acervo nem usa armazenamento local/sessão", () => {
    const fontes = [
      lerFonte("sessao-de-estudo.ts"),
      lerFonte("aleatoriedade.ts"),
    ].join("\n");

    expect(fontes).not.toContain("cliente-http");
    expect(fontes).not.toContain("ClienteHttp");
    expect(fontes).not.toMatch(/\blocalStorage\b/);
    expect(fontes).not.toMatch(/\bsessionStorage\b/);
    expect(fontes).not.toMatch(/\bfetch\s*\(/);
  });
});

describe("percentualDeAcertos (T1114, FR-152, SC-067)", () => {
  const casos: ReadonlyArray<[ResumoDaSessao, number]> = [
    [{ estudados: 1, acertos: 1, erros: 0 }, 100],
    [{ estudados: 1, acertos: 0, erros: 1 }, 0],
    [{ estudados: 3, acertos: 2, erros: 1 }, 67],
    [{ estudados: 3, acertos: 1, erros: 2 }, 33],
    [{ estudados: 3, acertos: 3, erros: 0 }, 100],
    [{ estudados: 3, acertos: 0, erros: 3 }, 0],
  ];

  for (const [resumo, esperado] of casos) {
    it(`para ${resumo.acertos} acertos em ${resumo.estudados} itens, devolve ${esperado}`, () => {
      expect(percentualDeAcertos(resumo)).toBe(esperado);
    });
  }

  it("devolve 0 quando nada foi estudado, sem dividir por zero", () => {
    expect(percentualDeAcertos({ estudados: 0, acertos: 0, erros: 0 })).toBe(0);
  });
});
