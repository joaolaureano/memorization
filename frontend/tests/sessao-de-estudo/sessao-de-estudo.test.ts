import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Cartao } from "../../src/acervo-cliente/cliente";
import {
  AleatoriedadeDeterministica,
  AleatoriedadeReal,
} from "../../src/sessao-de-estudo/aleatoriedade";
import {
  MENSAGEM_DE_BARALHO_INELEGIVEL,
  MENSAGEM_DE_QUANTIDADE_INVALIDA,
  MENSAGEM_DE_RESULTADO_INVALIDO,
  MENSAGEM_DE_REVELACAO_AUSENTE,
  MENSAGEM_DE_SESSAO_CONCLUIDA,
  SessaoDeEstudo,
} from "../../src/sessao-de-estudo/sessao-de-estudo";
import type { ResultadoDoItem } from "../../src/sessao-de-estudo/sessao-de-estudo";

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

/** Revela e registra o Resultado do Item corrente, exigindo sucesso. */
function responder(
  sessao: SessaoDeEstudo,
  resultado: ResultadoDoItem,
): void {
  const revelacao = sessao.revelar();

  if (!revelacao.ok) {
    throw new Error(`a Revelação deveria ser aceita: ${revelacao.mensagem}`);
  }

  const registro = sessao.registrarResultado(resultado);

  if (!registro.ok) {
    throw new Error(
      `o Resultado deveria ser aceito: ${registro.mensagem}`,
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

    responder(sessao, "acertou");

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

  it("recusa Resultado antes da Revelação (FR-034)", () => {
    const sessao = iniciarComSucesso(1, ["c1"], []);

    const registro = sessao.registrarResultado("acertou");

    expect(registro).toEqual({
      ok: false,
      erro: "revelacao_ausente",
      mensagem: MENSAGEM_DE_REVELACAO_AUSENTE,
    });
    expect(sessao.estadoAtual().concluida).toBe(false);
  });

  it("aceita apenas acertou e errou como Resultado (FR-036)", () => {
    const sessao = iniciarComSucesso(1, ["c1"], []);
    sessao.revelar();

    const registro = sessao.registrarResultado(
      "correto" as ResultadoDoItem,
    );

    expect(registro).toEqual({
      ok: false,
      erro: "resultado_invalido",
      mensagem: MENSAGEM_DE_RESULTADO_INVALIDO,
    });
  });

  it("registra um único Resultado e avança para o próximo Item (FR-035)", () => {
    const sessao = iniciarComSucesso(2, ["c1", "c2"], [0.99]);

    responder(sessao, "acertou");

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
      expect(primeiro.resultado).toBe("acertou");
      expect(Object.isFrozen(primeiro)).toBe(true);
    }

    // Uma nova tentativa de registro agora mira o Item seguinte, ainda com o
    // Verso oculto; é recusada, e o Resultado anterior permanece intacto.
    expect(sessao.registrarResultado("errou")).toEqual({
      ok: false,
      erro: "revelacao_ausente",
      mensagem: MENSAGEM_DE_REVELACAO_AUSENTE,
    });

    const depois = sessao.estadoAtual().itens[0];
    if (depois.revelado) {
      expect(depois.resultado).toBe("acertou");
    }
  });

  it("Resumo coerente ao final: acertos + erros = estudados (FR-037)", () => {
    const sessao = iniciarComSucesso(3, ["c1", "c2", "c3"], [0.99, 0.99]);

    responder(sessao, "acertou");
    responder(sessao, "errou");
    sessao.revelar();
    const registro = sessao.registrarResultado("acertou");

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

    responder(sessao, "errou");
    sessao.revelar();
    const registro = sessao.registrarResultado("errou");

    if (!registro.ok || !("resumo" in registro)) {
      throw new Error("a Sessão deveria concluir com Resumo");
    }

    expect(registro.resumo).toEqual({ estudados: 2, acertos: 0, erros: 2 });
  });

  it("recusa Revelação e Resultado após a conclusão", () => {
    const sessao = iniciarComSucesso(1, ["c1"], []);
    responder(sessao, "acertou");

    expect(sessao.revelar()).toEqual({
      ok: false,
      erro: "sessao_concluida",
      mensagem: MENSAGEM_DE_SESSAO_CONCLUIDA,
    });
    expect(sessao.registrarResultado("errou")).toEqual({
      ok: false,
      erro: "sessao_concluida",
      mensagem: MENSAGEM_DE_SESSAO_CONCLUIDA,
    });
  });
});

describe("SessaoDeEstudo — interrupção e ausência de persistência (T303)", () => {
  it("interromper descarta a Sessão: uma nova começa sem vestígios (FR-039)", () => {
    const primeira = iniciarComSucesso(
      3,
      ["c1", "c2", "c3"],
      [0.99, 0.99],
    );
    responder(primeira, "acertou");

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
    responder(sessao, "acertou");

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
