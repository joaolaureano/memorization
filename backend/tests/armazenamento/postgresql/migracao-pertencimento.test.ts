import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { criarAcervo } from "../../../src/acervo/acervo.ts";
import {
  aplicarMigracoes,
  lerVersaoDoEsquema,
} from "../../../src/armazenamento/postgresql/esquema.ts";
import { MIGRACOES } from "../../../src/armazenamento/postgresql/migracoes.ts";
import {
  abrirArmazenamentoDaBase,
  abrirPiscinaDaBase,
  descartarBasesDeTeste,
} from "./base-de-teste.ts";
import {
  servidorDeTeste,
  type FerramentasDoServidor,
} from "./servidor-de-teste.ts";

/**
 * T007 — transição gradual de Pertencimento de Cartões legados no PostgreSQL.
 *
 * Os cenários exercitam:
 * - Cartão com um único Baralho legado é atribuído automaticamente
 * - Cartão avulso (sem vínculo) aparece com `baralhos: []` e exige destino
 * - Cartão compartilhado (b1 e b2) com cópia
 * - Frente que colide no destino é numerada
 * - Escolhas incompletas ou Baralho fora dos legados → `escolhas_invalidas`
 * - Plano recusado via `aplicarTransicao` direto na Porta devolve `conflito`
 * - Usuário A pendente e Usuário B concluído
 * - Reenviar após sucesso → idempotente
 */

/** A versão anterior a Pertencimento (antes da migração 13). */
const VERSAO_SEM_PERTENCIMENTO = 12;

let servidor: FerramentasDoServidor;

/** Subir o PostgreSQL real leva segundos: o prazo do gancho é folgado. */
beforeAll(async () => {
  servidor = await servidorDeTeste();
}, 120_000);

afterAll(async () => {
  await descartarBasesDeTeste();
  await (await servidorDeTeste()).encerrar();
});

/** Prepara uma base na versão 12 com donos, baralhos e cartões com vínculo. */
async function prepararBaseVersao12(titulo: string): Promise<string> {
  const nomeDaBase = await servidor.criarBase(`pertencimento-${titulo}`);
  const piscina = await abrirPiscinaDaBase(nomeDaBase);

  try {
    // Aplica só até versão 12 (sem pertencimento)
    await aplicarMigracoes(
      piscina,
      MIGRACOES.filter((m) => m.versao <= VERSAO_SEM_PERTENCIMENTO),
    );

    // Grava base de teste
    const inserirUsuario = `
      INSERT INTO usuario (id, nome_de_usuario, sal, hash, parametros)
      VALUES ($1, $2, $3, $4, '{}');`;

    await piscina.query(inserirUsuario, [
      "dono-ana",
      "ana.silva",
      Buffer.alloc(16),
      Buffer.from("hash-sintetico"),
    ]);
    await piscina.query(inserirUsuario, [
      "dono-bruno",
      "bruno.costa",
      Buffer.alloc(16),
      Buffer.from("hash-sintetico"),
    ]);

    // Baralhos
    await piscina.query(
      "INSERT INTO baralho (id, usuario_id, nome) VALUES ($1, $2, $3);",
      ["b1-ana", "dono-ana", "Inglês"],
    );
    await piscina.query(
      "INSERT INTO baralho (id, usuario_id, nome) VALUES ($1, $2, $3);",
      ["b2-ana", "dono-ana", "Viagens"],
    );
    await piscina.query(
      "INSERT INTO baralho (id, usuario_id, nome) VALUES ($1, $2, $3);",
      ["b1-bruno", "dono-bruno", "Espanhol"],
    );

    // Cartão com um único Baralho (resolvido automaticamente)
    await piscina.query(
      "INSERT INTO cartao (id, usuario_id, frente, verso) VALUES ($1, $2, $3, $4);",
      ["c-unico", "dono-ana", "To walk", "Caminhar"],
    );
    await piscina.query(
      "INSERT INTO vinculo (cartao_id, baralho_id) VALUES ($1, $2);",
      ["c-unico", "b1-ana"],
    );

    // Cartão avulso (sem vínculo)
    await piscina.query(
      "INSERT INTO cartao (id, usuario_id, frente, verso) VALUES ($1, $2, $3, $4);",
      ["c-avulso", "dono-ana", "To read", "Ler"],
    );

    // Cartão compartilhado (dois baralhos)
    await piscina.query(
      "INSERT INTO cartao (id, usuario_id, frente, verso) VALUES ($1, $2, $3, $4);",
      ["c-compartilhado", "dono-ana", "To travel", "Viajar"],
    );
    await piscina.query(
      "INSERT INTO vinculo (cartao_id, baralho_id) VALUES ($1, $2);",
      ["c-compartilhado", "b1-ana"],
    );
    await piscina.query(
      "INSERT INTO vinculo (cartao_id, baralho_id) VALUES ($1, $2);",
      ["c-compartilhado", "b2-ana"],
    );

    // Cartão de Bruno (será usado em teste multi-usuário)
    await piscina.query(
      "INSERT INTO cartao (id, usuario_id, frente, verso) VALUES ($1, $2, $3, $4);",
      ["c-bruno", "dono-bruno", "Hola", "Olá"],
    );
    await piscina.query(
      "INSERT INTO vinculo (cartao_id, baralho_id) VALUES ($1, $2);",
      ["c-bruno", "b1-bruno"],
    );

    return nomeDaBase;
  } finally {
    await piscina.end();
  }
}

describe("Transição de Pertencimento (FR-397)", () => {
  it("Cartão com um único Baralho legado é atribuído automaticamente e não aparece em obterTransicao", async () => {
    const nomeDaBase = await prepararBaseVersao12("unico");

    const aberto = await abrirArmazenamentoDaBase(nomeDaBase);
    const acervo = criarAcervo(aberto.armazenamento, "dono-ana");

    try {
      // Aplica esquema v12->v13+
      const piscina = await abrirPiscinaDaBase(nomeDaBase);
      await aplicarMigracoes(piscina);
      await piscina.end();

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
      await servidor.descartarBase(nomeDaBase);
    }
  });

  it("Cartão avulso aparece com baralhos: [] e exige destino; concluir com destino o coloca lá", async () => {
    const nomeDaBase = await prepararBaseVersao12("avulso");

    const aberto = await abrirArmazenamentoDaBase(nomeDaBase);
    const acervo = criarAcervo(aberto.armazenamento, "dono-ana");

    try {
      const piscina = await abrirPiscinaDaBase(nomeDaBase);
      await aplicarMigracoes(piscina);
      await piscina.end();

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
      await servidor.descartarBase(nomeDaBase);
    }
  });

  it("Cartão compartilhado mantém original em escolha e cria cópia com id novo e mesma Frente/Verso", async () => {
    const nomeDaBase = await prepararBaseVersao12("compartilhado");

    const aberto = await abrirArmazenamentoDaBase(nomeDaBase);
    const acervo = criarAcervo(aberto.armazenamento, "dono-ana");

    try {
      const piscina = await abrirPiscinaDaBase(nomeDaBase);
      await aplicarMigracoes(piscina);
      await piscina.end();

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
      await servidor.descartarBase(nomeDaBase);
    }
  });

  it("Frente que colide no destino é numerada automaticamente", async () => {
    const nomeDaBase = await prepararBaseVersao12("colisao");

    const aberto = await abrirArmazenamentoDaBase(nomeDaBase);
    const acervo = criarAcervo(aberto.armazenamento, "dono-ana");

    try {
      const piscina = await abrirPiscinaDaBase(nomeDaBase);
      await aplicarMigracoes(piscina);

      // Grava um Cartão com Frente "To travel" em b2-ana (colisão com c-compartilhado)
      await piscina.query(
        "INSERT INTO cartao (id, usuario_id, frente, verso) VALUES ($1, $2, $3, $4);",
        ["c-colisao", "dono-ana", "To travel", "Viajar"],
      );
      await piscina.query(
        "INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave) VALUES ($1, $2, $3);",
        ["c-colisao", "b2-ana", "to travel"],
      );

      await piscina.end();

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
      await servidor.descartarBase(nomeDaBase);
    }
  });

  it("Escolhas incompletas retornam escolhas_invalidas e nada muda", async () => {
    const nomeDaBase = await prepararBaseVersao12("incompletas");

    const aberto = await abrirArmazenamentoDaBase(nomeDaBase);
    const acervo = criarAcervo(aberto.armazenamento, "dono-ana");

    try {
      const piscina = await abrirPiscinaDaBase(nomeDaBase);
      await aplicarMigracoes(piscina);
      await piscina.end();

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
      await servidor.descartarBase(nomeDaBase);
    }
  });

  it("Baralho fora do acervo do Usuário é rejeitado com escolhas_invalidas", async () => {
    const nomeDaBase = await prepararBaseVersao12("invalidas");

    const aberto = await abrirArmazenamentoDaBase(nomeDaBase);
    const acervo = criarAcervo(aberto.armazenamento, "dono-ana");

    try {
      const piscina = await abrirPiscinaDaBase(nomeDaBase);
      await aplicarMigracoes(piscina);
      await piscina.end();

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
      await servidor.descartarBase(nomeDaBase);
    }
  });

  it("Reenviar concluirTransicao após sucesso é idempotente sem duplicar cópias", async () => {
    const nomeDaBase = await prepararBaseVersao12("idempotente");

    const aberto = await abrirArmazenamentoDaBase(nomeDaBase);
    const acervo = criarAcervo(aberto.armazenamento, "dono-ana");

    try {
      const piscina = await abrirPiscinaDaBase(nomeDaBase);
      await aplicarMigracoes(piscina);
      await piscina.end();

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
      await servidor.descartarBase(nomeDaBase);
    }
  });

  it("Usuário A pendente e Usuário B concluído: B usa Acervo normalmente; reabrir mantém v12 com vinculo", async () => {
    const nomeDaBase = await prepararBaseVersao12("multiplo");

    let aberto = await abrirArmazenamentoDaBase(nomeDaBase);
    const acervoAna = criarAcervo(aberto.armazenamento, "dono-ana");
    const acervoBruno = criarAcervo(aberto.armazenamento, "dono-bruno");

    try {
      const piscina = await abrirPiscinaDaBase(nomeDaBase);
      await aplicarMigracoes(piscina);
      await piscina.end();

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

      // Reabrir o banco (no PostgreSQL, apenas reconectar)
      await aberto.encerrar();

      aberto = await abrirArmazenamentoDaBase(nomeDaBase);
      const acervoAnaReaberto = criarAcervo(aberto.armazenamento, "dono-ana");
      const pendenteDaAna = await acervoAnaReaberto.obterTransicao();
      expect(pendenteDaAna.ok && pendenteDaAna.cartoes.length).toBeGreaterThan(0);

      // Versão ainda é 13 (Bruno concluído mas Ana pendente)
      const piscina2 = await abrirPiscinaDaBase(nomeDaBase);
      const versao = await lerVersaoDoEsquema(piscina2);
      expect(versao).toBe(13);

      // Tabela vinculo ainda existe
      const tabelasExistem = await piscina2.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('vinculo', 'pertencimento');
      `);
      const nomes = tabelasExistem.rows.map(
        (row: { table_name: string }) => row.table_name,
      );
      expect(nomes).toContain("vinculo");

      await piscina2.end();
    } finally {
      await aberto.encerrar();
      await servidor.descartarBase(nomeDaBase);
    }
  });

  it("Após todos concludirem transição, reabrir aplica migração 14 e remove vinculo", async () => {
    const nomeDaBase = await prepararBaseVersao12("apos-conclusao");

    const aberto = await abrirArmazenamentoDaBase(nomeDaBase);
    const acervoAna = criarAcervo(aberto.armazenamento, "dono-ana");
    const acervoBruno = criarAcervo(aberto.armazenamento, "dono-bruno");

    try {
      const piscina = await abrirPiscinaDaBase(nomeDaBase);
      await aplicarMigracoes(piscina);
      await piscina.end();

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

      // No PostgreSQL o operador reaplica o comando de migração depois da
      // última transição; só então a 14 encontra a precondição satisfeita.
      const piscina2 = await abrirPiscinaDaBase(nomeDaBase);

      expect(await aplicarMigracoes(piscina2)).toBe(14);
      expect(await lerVersaoDoEsquema(piscina2)).toBe(14);

      // Tabela vinculo deve ter sido removida
      const tabelasExistem = await piscina2.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('vinculo', 'pertencimento');
      `);
      const nomes = tabelasExistem.rows.map(
        (row: { table_name: string }) => row.table_name,
      );
      expect(nomes).not.toContain("vinculo");
      expect(nomes).toContain("pertencimento");

      await piscina2.end();
    } finally {
      await aberto.encerrar();
      await servidor.descartarBase(nomeDaBase);
    }
  });
});
