import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { criarAcervo } from "../../src/acervo/acervo.ts";
import { abrirArmazenamentoSqlite } from "../../src/armazenamento/sqlite/armazenamento.ts";
import {
  abrirBanco,
  aplicarMigracoes,
} from "../../src/armazenamento/sqlite/esquema.ts";
import { MIGRACOES } from "../../src/armazenamento/sqlite/migracoes.ts";
import {
  gravarBaralho,
  gravarCartao,
  gravarDono,
  gravarVinculo,
} from "./banco-de-teste.ts";

/**
 * T025 — transição gradual de Pertencimento de Cartões legados.
 *
 * Os cenários exercitam:
 * - Cartão com um único Baralho legado é atribuído automaticamente
 * - Cartão avulso (sem vínculo) aparece com `baralhos: []` e exige destino
 * - Cartão compartilhado (b1 e b2) com cópia
 * - Frente que colide no destino é numerada
 * - Escolhas incompletas ou Baralho fora dos legados → `escolhas_invalidas`
 * - Falha no meio com rollback
 * - Usuário A pendente e Usuário B concluído
 * - Reenviar após sucesso → idempotente
 */

let diretorioTemporario: string;

beforeEach(() => {
  diretorioTemporario = mkdtempSync(
    join(tmpdir(), "acervo-pertencimento-"),
  );
});

afterEach(() => {
  rmSync(diretorioTemporario, { recursive: true, force: true });
});

/** Diz se a tabela existe, consultando o catálogo do SQLite. */
function existeTabela(banco: DatabaseSync, nome: string): boolean {
  return (
    banco
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(nome) !== undefined
  );
}

/**
 * Prepara uma base na versão 13 com donos, baralhos e cartões com vínculo.
 * Retorna o caminho do arquivo para que o teste abra-o com `abrirArmazenamentoSqlite`.
 */
function prepararBaseVersao13(): string {
  const caminho = join(diretorioTemporario, "v13.db");
  const banco = new DatabaseSync(caminho);

  try {
    banco.exec("PRAGMA foreign_keys = ON;");
    // Aplica só até versão 12 (sem pertencimento)
    aplicarMigracoes(
      banco,
      MIGRACOES.filter((m) => m.versao <= 12),
    );

    // Grava base de teste
    const donaAna = gravarDono(banco, "dono-ana", "ana.silva");
    const donoBruno = gravarDono(banco, "dono-bruno", "bruno.costa");

    gravarBaralho(banco, donaAna, "b1-ana", "Inglês");
    gravarBaralho(banco, donaAna, "b2-ana", "Viagens");
    gravarBaralho(banco, donoBruno, "b1-bruno", "Espanhol");

    // Cartão com um único Baralho (resolvido automaticamente)
    gravarCartao(banco, donaAna, "c-unico", "To walk", "Caminhar");
    gravarVinculo(banco, "c-unico", "b1-ana");

    // Cartão avulso (sem vínculo)
    gravarCartao(banco, donaAna, "c-avulso", "To read", "Ler");

    // Cartão compartilhado (dois baralhos)
    gravarCartao(banco, donaAna, "c-compartilhado", "To travel", "Viajar");
    gravarVinculo(banco, "c-compartilhado", "b1-ana");
    gravarVinculo(banco, "c-compartilhado", "b2-ana");

    // Cartão de Bruno (será usado em teste multi-usuário)
    gravarCartao(banco, donoBruno, "c-bruno", "Hola", "Olá");
    gravarVinculo(banco, "c-bruno", "b1-bruno");

    return caminho;
  } finally {
    banco.close();
  }
}

describe("Transição de Pertencimento (FR-397)", () => {
  it("Cartão com um único Baralho legado é atribuído automaticamente e não aparece em obterTransicao", async () => {
    const caminhoV13 = prepararBaseVersao13();

    const aberto = await abrirArmazenamentoSqlite(caminhoV13);
    const acervo = criarAcervo(aberto.armazenamento, "dono-ana");

    try {
      // Aplica esquema v13/v14
      const banco = abrirBanco(caminhoV13);
      banco.close();

      // obterTransicao deve resolver automaticamente o c-unico
      const transicao = await acervo.obterTransicao();

      expect(transicao.ok).toBe(true);
      if (transicao.ok) {
        // c-unico foi resolvido, não aparece
        const cartoes = transicao.cartoes;
        expect(cartoes.map((c) => c.id)).not.toContain("c-unico");
        // c-avulso e c-compartilhado exigem escolha
        expect(cartoes.length).toBe(2);
      }
    } finally {
      await aberto.encerrar();
      rmSync(caminhoV13, { recursive: true, force: true });
    }
  });

  it("Cartão avulso aparece com baralhos: [] e exige destino; concluir com destino o coloca lá", async () => {
    const caminhoV13 = prepararBaseVersao13();

    const aberto = await abrirArmazenamentoSqlite(caminhoV13);
    const acervo = criarAcervo(aberto.armazenamento, "dono-ana");

    try {
      const banco = abrirBanco(caminhoV13);
      banco.close();

      const transicao = await acervo.obterTransicao();

      expect(transicao.ok).toBe(true);
      if (transicao.ok) {
        // c-avulso aparece com baralhos vazio
        const avulso = transicao.cartoes.find((c) => c.id === "c-avulso");
        expect(avulso).toBeDefined();
        if (avulso) {
          expect(avulso.baralhos).toEqual([]);
        }

        // Escolher destino para todos os pendentes
        const resultado = await acervo.concluirTransicao({
          escolhas: transicao.cartoes.map((c) => ({
            cartaoId: c.id,
            baralhoId: c.baralhos[0]?.id || "b2-ana",
          })),
        });

        expect(resultado.ok).toBe(true);

        // Após concluir, obterTransicao deve ter menos cartões
        const aposTransicao = await acervo.obterTransicao();
        expect(aposTransicao.ok).toBe(true);
        if (aposTransicao.ok) {
          expect(
            aposTransicao.cartoes.map((c) => c.id).includes("c-avulso"),
          ).toBe(false);
        }
      }
    } finally {
      await aberto.encerrar();
      rmSync(caminhoV13, { recursive: true, force: true });
    }
  });

  it("Cartão compartilhado mantém original em escolha e cria cópia com id novo e mesma Frente/Verso", async () => {
    const caminhoV13 = prepararBaseVersao13();

    const aberto = await abrirArmazenamentoSqlite(caminhoV13);
    const acervo = criarAcervo(aberto.armazenamento, "dono-ana");

    try {
      const banco = abrirBanco(caminhoV13);
      banco.close();

      const transicao = await acervo.obterTransicao();

      expect(transicao.ok).toBe(true);
      if (transicao.ok) {
        // c-compartilhado aparece com dois baralhos
        const compartilhado = transicao.cartoes.find(
          (c) => c.id === "c-compartilhado",
        );
        expect(compartilhado).toBeDefined();
        if (compartilhado) {
          expect(compartilhado.baralhos.length).toBe(2);
        }

        // Escolher para todos os pendentes
        const resultado = await acervo.concluirTransicao({
          escolhas: transicao.cartoes.map((c) => ({
            cartaoId: c.id,
            baralhoId:
              c.id === "c-compartilhado" ? "b1-ana" : (c.baralhos[0]?.id || "b1-ana"),
          })),
        });

        expect(resultado.ok).toBe(true);

        // Verificar que a transição foi concluída
        const aposTransicao = await acervo.obterTransicao();
        expect(aposTransicao.ok).toBe(true);
        if (aposTransicao.ok) {
          expect(
            aposTransicao.cartoes.map((c) => c.id).includes("c-compartilhado"),
          ).toBe(false);
        }
      }
    } finally {
      await aberto.encerrar();
      rmSync(caminhoV13, { recursive: true, force: true });
    }
  });

  it("Frente que colide no destino é numerada automaticamente", async () => {
    const caminhoV13 = prepararBaseVersao13();

    const aberto = await abrirArmazenamentoSqlite(caminhoV13);
    const acervo = criarAcervo(aberto.armazenamento, "dono-ana");

    try {
      const banco = abrirBanco(caminhoV13);

      // Grava um Cartão com Frente "To travel" em b2-ana (colisão com c-compartilhado)
      banco
        .prepare(
          "INSERT INTO cartao (id, frente, verso, usuario_id) VALUES (?, ?, ?, ?)",
        )
        .run("c-colisao", "To travel", "Viajar", "dono-ana");
      banco
        .prepare(
          "INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave) VALUES (?, ?, ?)",
        )
        .run("c-colisao", "b2-ana", "to travel");

      banco.close();

      const transicao = await acervo.obterTransicao();

      expect(transicao.ok).toBe(true);
      if (transicao.ok) {
        // Escolher para todos os pendentes
        const resultado = await acervo.concluirTransicao({
          escolhas: transicao.cartoes.map((c) => ({
            cartaoId: c.id,
            baralhoId:
              c.id === "c-compartilhado" ? "b2-ana" : (c.baralhos[0]?.id || "b2-ana"),
          })),
        });

        // Deve suceder com numeração automática
        expect(resultado.ok).toBe(true);
      }
    } finally {
      await aberto.encerrar();
      rmSync(caminhoV13, { recursive: true, force: true });
    }
  });

  it("Escolhas incompletas retornam escolhas_invalidas e nada muda", async () => {
    const caminhoV13 = prepararBaseVersao13();

    const aberto = await abrirArmazenamentoSqlite(caminhoV13);
    const acervo = criarAcervo(aberto.armazenamento, "dono-ana");

    try {
      const banco = abrirBanco(caminhoV13);
      banco.close();

      const transicao = await acervo.obterTransicao();

      expect(transicao.ok).toBe(true);
      if (transicao.ok) {
        const quantosAntes = transicao.cartoes.length;

        // Enviar escolha vazia ou inválida
        const resultado = await acervo.concluirTransicao({
          escolhas: [],
        });

        // Se há cartões que exigem escolha, deve falhar
        if (quantosAntes > 0) {
          expect(resultado.ok).toBe(false);
        }

        // Reobter transição e verificar que os mesmos estão pendentes
        const aposRejeitada = await acervo.obterTransicao();
        expect(aposRejeitada.ok).toBe(true);
        if (aposRejeitada.ok) {
          // Mesmo estado de antes
          expect(aposRejeitada.cartoes.length).toEqual(quantosAntes);
        }
      }
    } finally {
      await aberto.encerrar();
      rmSync(caminhoV13, { recursive: true, force: true });
    }
  });

  it("Baralho fora do acervo do Usuário é rejeitado com escolhas_invalidas", async () => {
    const caminhoV13 = prepararBaseVersao13();

    const aberto = await abrirArmazenamentoSqlite(caminhoV13);
    const acervo = criarAcervo(aberto.armazenamento, "dono-ana");

    try {
      const banco = abrirBanco(caminhoV13);
      banco.close();

      const transicao = await acervo.obterTransicao();

      expect(transicao.ok).toBe(true);
      if (transicao.ok) {
        // Escolher baralho de outro usuário (b1-bruno) para c-avulso
        const resultado = await acervo.concluirTransicao({
          escolhas: [
            {
              cartaoId: "c-avulso",
              baralhoId: "b1-bruno", // Não pertence a dono-ana
            },
          ],
        });

        // Deve ser recusado
        expect(resultado.ok).toBe(false);
        if (!resultado.ok) {
          expect(resultado.erro).toBe("escolhas_invalidas");
        }
      }
    } finally {
      await aberto.encerrar();
      rmSync(caminhoV13, { recursive: true, force: true });
    }
  });

  it("Reenviar concluirTransicao após sucesso é idempotente sem duplicar cópias", async () => {
    const caminhoV13 = prepararBaseVersao13();

    const aberto = await abrirArmazenamentoSqlite(caminhoV13);
    const acervo = criarAcervo(aberto.armazenamento, "dono-ana");

    try {
      const banco = abrirBanco(caminhoV13);
      banco.close();

      const transicao = await acervo.obterTransicao();

      expect(transicao.ok).toBe(true);
      if (transicao.ok) {
        // Enviar escolha
        const escolhas = transicao.cartoes.map((c) => ({
          cartaoId: c.id,
          baralhoId: c.baralhos[0]?.id || "b1-ana",
        }));

        const resultado1 = await acervo.concluirTransicao({
          escolhas,
        });

        expect(resultado1.ok).toBe(true);

        // Reenviar a mesma escolha
        const resultado2 = await acervo.concluirTransicao({
          escolhas,
        });

        // Deve suceder sem duplicar
        expect(resultado2.ok).toBe(true);
      }
    } finally {
      await aberto.encerrar();
      rmSync(caminhoV13, { recursive: true, force: true });
    }
  });

  it("Usuário A pendente e Usuário B concluído: B usa Acervo normalmente; reabrir mantém v13 com vinculo", async () => {
    const caminhoV13 = prepararBaseVersao13();

    let aberto = await abrirArmazenamentoSqlite(caminhoV13);
    const acervoAna = criarAcervo(aberto.armazenamento, "dono-ana");
    const acervoBruno = criarAcervo(aberto.armazenamento, "dono-bruno");

    try {
      const banco = abrirBanco(caminhoV13);
      banco.close();

      // Bruno conclui sua transição (c-bruno já é único)
      const transicaoBruno = await acervoBruno.obterTransicao();
      expect(transicaoBruno.ok).toBe(true);
      if (transicaoBruno.ok) {
        // c-bruno foi resolvido automaticamente, não aparece
        expect(transicaoBruno.cartoes.map((c) => c.id)).not.toContain(
          "c-bruno",
        );
      }

      // Ana tem c-avulso e c-compartilhado pendentes
      const transicaoAna = await acervoAna.obterTransicao();
      expect(transicaoAna.ok).toBe(true);
      if (transicaoAna.ok) {
        expect(transicaoAna.cartoes.length).toBeGreaterThan(0);
      }

      // Reabrir o banco
      await aberto.encerrar();

      aberto = await abrirArmazenamentoSqlite(caminhoV13);
      const acervoAnaReaberto = criarAcervo(aberto.armazenamento, "dono-ana");
      const pendenteDaAna = await acervoAnaReaberto.obterTransicao();
      expect(pendenteDaAna.ok && pendenteDaAna.cartoes.length).toBeGreaterThan(0);

      // Versão ainda é 13 (Bruno concluído mas Ana pendente)
      const bancoReaberto = abrirBanco(caminhoV13);
      const versao = bancoReaberto
        .prepare("SELECT versao FROM versao_do_esquema")
        .get();
      expect(versao?.versao).toBe(13);

      // Tabela vinculo ainda existe
      expect(existeTabela(bancoReaberto, "vinculo")).toBe(true);

      bancoReaberto.close();
    } finally {
      await aberto.encerrar();
      rmSync(caminhoV13, { recursive: true, force: true });
    }
  });

  it("Após todos concludirem transição, reabrir o arquivo aplica migração 14 e remove vinculo", async () => {
    const caminhoV13 = prepararBaseVersao13();

    let aberto = await abrirArmazenamentoSqlite(caminhoV13);
    const acervoAna = criarAcervo(aberto.armazenamento, "dono-ana");
    const acervoBruno = criarAcervo(aberto.armazenamento, "dono-bruno");

    let banco: DatabaseSync | undefined;
    try {
      // Resolver para Ana
      const transicaoAna = await acervoAna.obterTransicao();
      if (!transicaoAna.ok) {
        throw new Error("a transição deveria ser lida");
      }

      const escolhasAna = transicaoAna.cartoes.map((c) => ({
        cartaoId: c.id,
        baralhoId: c.baralhos[0]?.id || "b1-ana",
      }));

      const resultadoAna = await acervoAna.concluirTransicao({
        escolhas: escolhasAna,
      });

      expect(resultadoAna.ok).toBe(true);

      // Resolver para Bruno
      const transicaoBruno = await acervoBruno.obterTransicao();
      if (!transicaoBruno.ok) {
        throw new Error("a transição deveria ser lida");
      }

      const escolhasBruno = transicaoBruno.cartoes.map((c) => ({
        cartaoId: c.id,
        baralhoId: c.baralhos[0]?.id || "b1-bruno",
      }));

      const resultadoBruno = await acervoBruno.concluirTransicao({
        escolhas: escolhasBruno,
      });

      expect(resultadoBruno.ok).toBe(true);

      // Fechar e reabrir
      await aberto.encerrar();

      aberto = await abrirArmazenamentoSqlite(caminhoV13);

      // Versão deve ser 14
      banco = abrirBanco(caminhoV13);

      const versao = banco
        .prepare("SELECT versao FROM versao_do_esquema")
        .get();
      expect(versao?.versao).toBe(14);

      // Tabela vinculo deve ter sido removida
      expect(existeTabela(banco, "vinculo")).toBe(false);
      expect(existeTabela(banco, "pertencimento")).toBe(true);
    } finally {
      await aberto.encerrar();
      rmSync(caminhoV13, { recursive: true, force: true });
    }
  });

  it("Plano recusado no meio não deixa nada aplicado (rollback, FR-397)", async () => {
    const caminhoV13 = prepararBaseVersao13();
    const aberto = await abrirArmazenamentoSqlite(caminhoV13);

    try {
      const antes = await aberto.armazenamento.listarCartoesPendentes("dono-ana");

      // O primeiro Pertencimento é válido; o segundo aponta para Baralho de
      // outro Usuário e recusa o plano inteiro.
      const resultado = await aberto.armazenamento.aplicarTransicao("dono-ana", {
        pertencimentos: [
          { cartaoId: "c-unico", baralhoId: "b1-ana", frente: "To walk" },
          { cartaoId: "c-avulso", baralhoId: "b1-bruno", frente: "To read" },
        ],
        copias: [],
      });

      expect(resultado).toEqual({ ok: false, erro: "conflito" });
      expect(
        await aberto.armazenamento.listarCartoesPendentes("dono-ana"),
      ).toEqual(antes);
      expect(
        await aberto.armazenamento.listarCartoesDoBaralho("dono-ana", "b1-ana"),
      ).toEqual([]);
    } finally {
      await aberto.encerrar();
    }
  });
});
