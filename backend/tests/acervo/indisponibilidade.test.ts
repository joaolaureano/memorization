import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, afterAll, describe, expect, it } from "vitest";

import { criarAcervo, type Acervo } from "../../src/acervo/acervo.ts";
import { abrirArmazenamentoSqlite } from "../../src/armazenamento/sqlite/armazenamento.ts";

/**
 * T804 — o desfecho `indisponivel` da Porta chega ao caller como recusa
 * reportada, e a operação **não** aparece como concluída (FR-044, FR-045,
 * FR-107).
 *
 * A indisponibilidade é produzida pelo Adapter real — o armazenamento é
 * encerrado antes das chamadas —, e não por um dublê: é a falha de fato que a
 * Interface do `Acervo` precisa reportar. As regras de domínio continuam sendo
 * julgadas antes do armazenamento, e a leitura seguinte, com o armazenamento
 * de volta, prova que nada foi gravado pela metade.
 */

const DIRETORIO_TEMPORARIO = mkdtempSync(
  join(tmpdir(), "acervo-indisponivel-"),
);

const CAMINHO = join(DIRETORIO_TEMPORARIO, "memorizacao.sqlite");

const INDISPONIVEL = {
  ok: false,
  erro: "indisponivel",
  mensagem: "O armazenamento não está disponível. Tente novamente.",
};

let acervo: Acervo;

beforeAll(async () => {
  const aberto = await abrirArmazenamentoSqlite(CAMINHO);

  await aberto.encerrar();

  acervo = criarAcervo(aberto.armazenamento);
});

afterAll(() => {
  rmSync(DIRETORIO_TEMPORARIO, { recursive: true, force: true });
});

describe("armazenamento indisponível — recusa reportada, sem operação concluída", () => {
  it("recusa a criação de Cartão e de Baralho com código estável e mensagem em português", async () => {
    expect(
      await acervo.criarCartao({ frente: "To walk", verso: "Caminhar" }),
    ).toEqual(INDISPONIVEL);
    expect(await acervo.criarBaralho({ nome: "Inglês" })).toEqual(
      INDISPONIVEL,
    );
  });

  it("mantém as regras de domínio à frente do armazenamento", async () => {
    expect(
      await acervo.criarCartao({ frente: "", verso: "Caminhar" }),
    ).toEqual({
      ok: false,
      erro: "frente_vazia",
      mensagem: "A frente do cartão não pode ficar vazia.",
    });
    expect(await acervo.criarBaralho({ nome: "  " })).toEqual({
      ok: false,
      erro: "nome_vazio",
      mensagem: "O nome do baralho não pode ficar vazio.",
    });
    expect(
      await acervo.editarCartao("c1", { frente: "", verso: "Caminhar" }),
    ).toEqual({
      ok: false,
      erro: "frente_vazia",
      mensagem: "A frente do cartão não pode ficar vazia.",
    });
  });

  it("recusa as leituras e as escritas por identificador com o mesmo desfecho", async () => {
    expect(await acervo.obterBaralho("b1")).toEqual(INDISPONIVEL);
    expect(
      await acervo.editarCartao("c1", {
        frente: "To walk",
        verso: "Caminhar",
      }),
    ).toEqual(INDISPONIVEL);
    expect(await acervo.renomearBaralho("b1", { nome: "Inglês" })).toEqual(
      INDISPONIVEL,
    );
    expect(await acervo.excluirCartao("c1")).toEqual(INDISPONIVEL);
    expect(await acervo.excluirBaralho("b1")).toEqual(INDISPONIVEL);
    expect(await acervo.vincular("c1", "b1")).toEqual(INDISPONIVEL);
    expect(await acervo.desvincular("c1", "b1")).toEqual(INDISPONIVEL);
  });

  it("carrega apenas o código estável e a mensagem do Module, sem detalhe do driver", async () => {
    const recusa = await acervo.criarCartao({
      frente: "To walk",
      verso: "Caminhar",
    });

    expect(recusa).toEqual(INDISPONIVEL);
    expect(Object.keys(recusa).sort()).toEqual(["erro", "mensagem", "ok"]);
  });

  it("pode ser repetida com o mesmo conteúdo informado, e nada foi gravado", async () => {
    const dados = { frente: "To walk", verso: "Caminhar" };

    expect(await acervo.criarCartao(dados)).toEqual(INDISPONIVEL);
    expect(await acervo.criarCartao(dados)).toEqual(INDISPONIVEL);

    const reaberto = await abrirArmazenamentoSqlite(CAMINHO);

    try {
      expect(await reaberto.armazenamento.listarCartoes()).toEqual([]);
      expect(await reaberto.armazenamento.listarBaralhos()).toEqual([]);
    } finally {
      await reaberto.encerrar();
    }
  });
});
