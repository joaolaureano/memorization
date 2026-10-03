import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { aplicarMigracoes } from "../../src/armazenamento/sqlite/esquema.ts";
import { MIGRACOES } from "../../src/armazenamento/sqlite/migracoes.ts";
import {
  contarLinhas,
  gravarBaralho,
  gravarCartao,
  gravarDono,
  gravarVinculo,
} from "./banco-de-teste.ts";

/**
 * T1602 — o esquema da **Agenda de estudo** (migração 8) no Adapter local.
 *
 * A migração 8 só cria tabelas novas: Cartões, Baralhos, Vínculos, Usuários,
 * Histórico, Agendamentos e Preferências de uma base instalada sobrevivem
 * intactos (FR-220), e é o que o cenário de upgrade prova. Os demais cenários
 * exercitam as garantias do próprio esquema — as cascatas, a unicidade
 * Rotina+data e os `CHECK` de estado (FR-248, FR-250) — inserindo linhas
 * **direto por SQL**, sem passar pela Porta.
 */

/** Instante ISO-8601 UTC fixo, aceito pelas colunas de data das migrações. */
const INSTANTE = "2025-01-01T00:00:00.000Z";

/** Data civil no formato `YYYY-MM-DD`, como as colunas de Compromisso. */
const DATA = "2025-02-10";

/**
 * Abre uma base em memória já migrada até `ateAVersao`, com a verificação de
 * chaves estrangeiras ligada: sem o pragma, o SQLite ignora as cascatas em
 * silêncio e os cenários de exclusão não provariam nada.
 */
function abrirBanco(ateAVersao: number): DatabaseSync {
  const banco = new DatabaseSync(":memory:");

  aplicarMigracoes(
    banco,
    MIGRACOES.filter((migracao) => migracao.versao <= ateAVersao),
  );
  banco.exec("PRAGMA foreign_keys = ON;");

  return banco;
}

/** Grava uma Rotina de estudo direto por SQL (FR-248). */
function gravarRotina(
  banco: DatabaseSync,
  dono: string,
  id: string,
  baralhoId: string | null,
  estado = "ativa",
): void {
  banco
    .prepare(
      `INSERT INTO rotina_de_estudo
         (id, usuario_id, baralho_id, estado, versao, criada_em, versoes)
       VALUES (?, ?, ?, ?, 1, ?, '[]')`,
    )
    .run(id, dono, baralhoId, estado, INSTANTE);
}

/** Grava a Operação idempotente de uma Rotina (FR-248). */
function gravarOperacao(
  banco: DatabaseSync,
  dono: string,
  operacaoId: string,
  rotinaId: string,
): void {
  banco
    .prepare(
      `INSERT INTO operacao_de_rotina
         (usuario_id, operacao_id, rotina_id, intencao, resultado)
       VALUES (?, ?, ?, 'criar', '{}')`,
    )
    .run(dono, operacaoId, rotinaId);
}

/** Grava um Compromisso persistido (exceção) de uma Rotina (FR-250). */
function gravarCompromisso(
  banco: DatabaseSync,
  dono: string,
  rotinaId: string,
  data: string,
  estado = "cancelado",
): void {
  banco
    .prepare(
      `INSERT INTO compromisso_de_estudo
         (rotina_id, data, usuario_id, estado, registro_id, baralho_id,
          nome_do_baralho, quantidade)
       VALUES (?, ?, ?, ?, NULL, 'b1', 'Inglês', NULL)`,
    )
    .run(rotinaId, data, dono, estado);
}

/** Grava o Início autorizado de um Compromisso (FR-248). */
function gravarInicio(
  banco: DatabaseSync,
  dono: string,
  id: string,
  rotinaId: string,
  data: string,
): void {
  banco
    .prepare(
      `INSERT INTO inicio_de_compromisso
         (id, usuario_id, rotina_id, data, iniciado_em, fuso, baralho_id,
          nome_do_baralho, quantidade, cartoes)
       VALUES (?, ?, ?, ?, ?, 'America/Sao_Paulo', 'b1', 'Inglês', NULL, '[]')`,
    )
    .run(id, dono, rotinaId, data, INSTANTE);
}

describe("migração 8 — esquema da Agenda de estudo no SQLite", () => {
  it("preserva os dados instalados ao levar a base da versão 7 à 8 (FR-248, FR-250)", () => {
    const banco = abrirBanco(7);

    try {
      const dono = gravarDono(banco);
      gravarCartao(banco, dono, "c1");
      gravarBaralho(banco, dono, "b1");
      gravarVinculo(banco, "c1", "b1");

      // Registro de sessão e Item, na forma que a migração 6 deixou.
      banco
        .prepare(
          `INSERT INTO registro_de_sessao
             (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
              estudados, acertos, erros)
           VALUES (?, ?, ?, ?, ?, 1, 1, 0)`,
        )
        .run("r1", dono, "b1", "Inglês", INSTANTE);
      banco
        .prepare(
          `INSERT INTO item_de_registro
             (registro_id, posicao, frente, verso, resultado)
           VALUES (?, 0, ?, ?, 'acertou')`,
        )
        .run("r1", "To walk", "Caminhar");

      // Agendamento e Preferências, na forma que a migração 7 deixou.
      banco
        .prepare(
          `INSERT INTO agendamento
             (usuario_id, cartao_id, algoritmo, versao_do_algoritmo, estado,
              proxima_revisao_em, ultima_avaliacao, revisado_em, criado_em)
           VALUES (?, ?, 'sm2', 1, '{}', ?, 'bom', ?, ?)`,
        )
        .run(dono, "c1", INSTANTE, INSTANTE, INSTANTE);
      banco
        .prepare(
          `INSERT INTO preferencias (usuario_id, algoritmo, limite_de_novos_por_dia)
           VALUES (?, 'sm2', 20)`,
        )
        .run(dono);

      // A migração 8 é aplicada sobre a base já povoada.
      aplicarMigracoes(banco, MIGRACOES);
      banco.exec("PRAGMA foreign_keys = ON;");

      // Os dados anteriores continuam.
      expect(contarLinhas(banco, "usuario")).toBe(1);
      expect(contarLinhas(banco, "cartao")).toBe(1);
      expect(contarLinhas(banco, "baralho")).toBe(1);
      expect(contarLinhas(banco, "vinculo")).toBe(1);
      expect(contarLinhas(banco, "registro_de_sessao")).toBe(1);
      expect(contarLinhas(banco, "item_de_registro")).toBe(1);
      expect(contarLinhas(banco, "agendamento")).toBe(1);
      expect(contarLinhas(banco, "preferencias")).toBe(1);

      // As quatro tabelas novas existem e nascem vazias.
      expect(contarLinhas(banco, "rotina_de_estudo")).toBe(0);
      expect(contarLinhas(banco, "operacao_de_rotina")).toBe(0);
      expect(contarLinhas(banco, "compromisso_de_estudo")).toBe(0);
      expect(contarLinhas(banco, "inicio_de_compromisso")).toBe(0);
    } finally {
      banco.close();
    }
  });

  it("excluir o Usuário remove as Rotinas, Operações, Compromissos e Inícios dele e preserva os do outro (FR-248)", () => {
    const banco = abrirBanco(8);

    try {
      const um = gravarDono(banco, "usuario-um", "ana.silva");
      const dois = gravarDono(banco, "usuario-dois", "bruno.souza");
      gravarBaralho(banco, um, "b1");
      gravarBaralho(banco, dois, "b2");

      gravarRotina(banco, um, "rot-um", "b1");
      gravarRotina(banco, dois, "rot-dois", "b2");
      gravarOperacao(banco, um, "op-um", "rot-um");
      gravarOperacao(banco, dois, "op-dois", "rot-dois");
      gravarCompromisso(banco, um, "rot-um", DATA);
      gravarCompromisso(banco, dois, "rot-dois", DATA);
      gravarInicio(banco, um, "ini-um", "rot-um", DATA);
      gravarInicio(banco, dois, "ini-dois", "rot-dois", DATA);

      banco.prepare("DELETE FROM usuario WHERE id = ?").run(um);

      expect(contarLinhas(banco, "rotina_de_estudo")).toBe(1);
      expect(contarLinhas(banco, "operacao_de_rotina")).toBe(1);
      expect(contarLinhas(banco, "compromisso_de_estudo")).toBe(1);
      expect(contarLinhas(banco, "inicio_de_compromisso")).toBe(1);

      const restante = banco
        .prepare("SELECT id FROM rotina_de_estudo")
        .get() as { id: string } | undefined;
      expect(restante?.id).toBe("rot-dois");
    } finally {
      banco.close();
    }
  });

  it("a unicidade Rotina+data recusa o segundo Compromisso e aceita datas e Rotinas diferentes (FR-250)", () => {
    const banco = abrirBanco(8);

    try {
      const dono = gravarDono(banco);
      gravarBaralho(banco, dono, "b1");
      gravarRotina(banco, dono, "rot-um", "b1");
      gravarRotina(banco, dono, "rot-dois", "b1");

      gravarCompromisso(banco, dono, "rot-um", "2025-02-10");

      expect(() =>
        gravarCompromisso(banco, dono, "rot-um", "2025-02-10"),
      ).toThrow();

      expect(() =>
        gravarCompromisso(banco, dono, "rot-um", "2025-02-11"),
      ).not.toThrow();
      expect(() =>
        gravarCompromisso(banco, dono, "rot-dois", "2025-02-10"),
      ).not.toThrow();

      expect(contarLinhas(banco, "compromisso_de_estudo")).toBe(3);
    } finally {
      banco.close();
    }
  });

  it("excluir o Baralho preserva a Rotina com baralho_id nulo, mantendo os Compromissos e Inícios (FR-248)", () => {
    const banco = abrirBanco(8);

    try {
      const dono = gravarDono(banco);
      gravarBaralho(banco, dono, "b1");
      gravarRotina(banco, dono, "rot-um", "b1");
      gravarCompromisso(banco, dono, "rot-um", DATA);
      gravarInicio(banco, dono, "ini-um", "rot-um", DATA);

      banco.prepare("DELETE FROM baralho WHERE id = ?").run("b1");

      expect(contarLinhas(banco, "rotina_de_estudo")).toBe(1);
      expect(contarLinhas(banco, "compromisso_de_estudo")).toBe(1);
      expect(contarLinhas(banco, "inicio_de_compromisso")).toBe(1);

      const rotina = banco
        .prepare("SELECT baralho_id FROM rotina_de_estudo WHERE id = ?")
        .get("rot-um") as { baralho_id: string | null } | undefined;
      expect(rotina?.baralho_id).toBeNull();
    } finally {
      banco.close();
    }
  });

  it("os estados de Rotina e de Compromisso recusam valor fora do CHECK (FR-248, FR-250)", () => {
    const banco = abrirBanco(8);

    try {
      const dono = gravarDono(banco);
      gravarBaralho(banco, dono, "b1");

      expect(() =>
        gravarRotina(banco, dono, "rot-x", "b1", "arquivada"),
      ).toThrow();

      gravarRotina(banco, dono, "rot-um", "b1");

      expect(() =>
        gravarCompromisso(banco, dono, "rot-um", DATA, "pendente"),
      ).toThrow();

      expect(() =>
        gravarRotina(banco, dono, "rot-ok", "b1", "pausada"),
      ).not.toThrow();
      expect(() =>
        gravarCompromisso(banco, dono, "rot-um", "2025-03-01", "concluido"),
      ).not.toThrow();

      expect(contarLinhas(banco, "rotina_de_estudo")).toBe(2);
      expect(contarLinhas(banco, "compromisso_de_estudo")).toBe(1);
    } finally {
      banco.close();
    }
  });
});
