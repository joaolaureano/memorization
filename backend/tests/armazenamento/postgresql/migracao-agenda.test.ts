import type { Pool } from "pg";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { aplicarMigracoes } from "../../../src/armazenamento/postgresql/esquema.ts";
import { MIGRACOES } from "../../../src/armazenamento/postgresql/migracoes.ts";
import {
  abrirPiscinaDaBase,
  descartarBasesDeTeste,
} from "./base-de-teste.ts";
import { servidorDeTeste } from "./servidor-de-teste.ts";

/**
 * T1602 — o esquema da **Agenda de estudo** (migração 8) no Adapter da nuvem.
 *
 * O equivalente PostgreSQL da migração é **o mesmo esquema** do Adapter local,
 * com `JSONB` no lugar do JSON textual e `TIMESTAMPTZ` nos instantes. A
 * migração 8 só cria tabelas novas: os dados instalados sobrevivem (FR-220), e
 * é o que o cenário de upgrade prova. Os demais cenários exercitam as garantias
 * do próprio esquema — as cascatas, a unicidade Rotina+data e os `CHECK` de
 * estado (FR-248, FR-250) — inserindo linhas **direto por SQL**, sem passar
 * pela Porta.
 */

/** Instante ISO-8601 UTC fixo, aceito pelas colunas de data do esquema. */
const INSTANTE = "2025-01-01T00:00:00.000Z";

/** Data civil no formato `YYYY-MM-DD`, como as colunas de Compromisso. */
const DATA = "2025-02-10";

beforeAll(async () => {
  await servidorDeTeste();
}, 120_000);

afterAll(async () => {
  await descartarBasesDeTeste();
  await (await servidorDeTeste()).encerrar();
});

/**
 * Cria uma base nova e vazia, migra até `ateAVersao` e executa o corpo sobre um
 * conjunto de conexões próprio; ao fim, fecha a piscina e descarta a base.
 */
async function comBase(
  titulo: string,
  ateAVersao: number,
  corpo: (piscina: Pool) => Promise<void>,
): Promise<void> {
  const apoio = await servidorDeTeste();
  const nomeDaBase = await apoio.criarBase(titulo);
  const piscina = await abrirPiscinaDaBase(nomeDaBase);

  try {
    await aplicarMigracoes(
      piscina,
      MIGRACOES.filter((migracao) => migracao.versao <= ateAVersao),
    );

    await corpo(piscina);
  } finally {
    await piscina.end();
    await apoio.descartarBase(nomeDaBase);
  }
}

/** Quantas linhas a tabela informada tem. A tabela é sempre um nome fixo. */
async function contarLinhas(piscina: Pool, tabela: string): Promise<number> {
  const { rows } = await piscina.query<{ total: string }>(
    `SELECT count(*) AS total FROM ${tabela}`,
  );

  return Number(rows[0]?.total ?? 0);
}

/** Grava um Usuário direto por SQL e devolve o `id`. */
async function gravarDono(
  piscina: Pool,
  id: string,
  nomeDeUsuario: string,
): Promise<string> {
  await piscina.query(
    `INSERT INTO usuario (id, nome_de_usuario, sal, hash, parametros)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, nomeDeUsuario, Buffer.alloc(16), Buffer.alloc(64), "{}"],
  );

  return id;
}

/** Grava um Cartão do dono informado. */
async function gravarCartao(
  piscina: Pool,
  dono: string,
  id: string,
): Promise<void> {
  await piscina.query(
    `INSERT INTO cartao (id, frente, verso, usuario_id)
     VALUES ($1, $2, $3, $4)`,
    [id, "To walk", "Caminhar", dono],
  );
}

/** Grava um Baralho do dono informado. */
async function gravarBaralho(
  piscina: Pool,
  dono: string,
  id: string,
  nome = "Inglês",
): Promise<void> {
  await piscina.query(
    `INSERT INTO baralho (id, nome, usuario_id) VALUES ($1, $2, $3)`,
    [id, nome, dono],
  );
}

/** Grava o Vínculo entre o Cartão e o Baralho informados. */
async function gravarVinculo(
  piscina: Pool,
  cartaoId: string,
  baralhoId: string,
): Promise<void> {
  await piscina.query(
    `INSERT INTO vinculo (cartao_id, baralho_id) VALUES ($1, $2)`,
    [cartaoId, baralhoId],
  );
}

/** Grava um Registro de sessão e o seu único Item. */
async function gravarRegistroDeSessao(
  piscina: Pool,
  dono: string,
  id: string,
): Promise<void> {
  await piscina.query(
    `INSERT INTO registro_de_sessao
       (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
        estudados, acertos, erros)
     VALUES ($1, $2, $3, $4, $5, 1, 1, 0)`,
    [id, dono, "b1", "Inglês", INSTANTE],
  );
  await piscina.query(
    `INSERT INTO item_de_registro
       (registro_id, posicao, frente, verso, resultado)
     VALUES ($1, 0, $2, $3, 'acertou')`,
    [id, "To walk", "Caminhar"],
  );
}

/** Grava um Agendamento do dono informado. */
async function gravarAgendamento(
  piscina: Pool,
  dono: string,
  cartaoId: string,
): Promise<void> {
  await piscina.query(
    `INSERT INTO agendamento
       (usuario_id, cartao_id, algoritmo, versao_do_algoritmo, estado,
        proxima_revisao_em, ultima_avaliacao, revisado_em, criado_em)
     VALUES ($1, $2, 'sm2', 1, $3, $4, 'bom', $4, $4)`,
    [dono, cartaoId, "{}", INSTANTE],
  );
}

/** Grava as Preferências do dono informado. */
async function gravarPreferencias(
  piscina: Pool,
  dono: string,
): Promise<void> {
  await piscina.query(
    `INSERT INTO preferencias (usuario_id, algoritmo, limite_de_novos_por_dia)
     VALUES ($1, 'sm2', 20)`,
    [dono],
  );
}

/** Grava uma Rotina de estudo direto por SQL (FR-248). */
async function gravarRotina(
  piscina: Pool,
  dono: string,
  id: string,
  baralhoId: string | null,
  estado = "ativa",
): Promise<void> {
  await piscina.query(
    `INSERT INTO rotina_de_estudo
       (id, usuario_id, baralho_id, estado, versao, criada_em, versoes)
     VALUES ($1, $2, $3, $4, 1, $5, $6)`,
    [id, dono, baralhoId, estado, INSTANTE, "[]"],
  );
}

/** Grava a Operação idempotente de uma Rotina (FR-248). */
async function gravarOperacao(
  piscina: Pool,
  dono: string,
  operacaoId: string,
  rotinaId: string,
): Promise<void> {
  await piscina.query(
    `INSERT INTO operacao_de_rotina
       (usuario_id, operacao_id, rotina_id, intencao, resultado)
     VALUES ($1, $2, $3, 'criar', $4)`,
    [dono, operacaoId, rotinaId, "{}"],
  );
}

/** Grava um Compromisso persistido (exceção) de uma Rotina (FR-250). */
async function gravarCompromisso(
  piscina: Pool,
  dono: string,
  rotinaId: string,
  data: string,
  estado = "cancelado",
): Promise<void> {
  await piscina.query(
    `INSERT INTO compromisso_de_estudo
       (rotina_id, data, usuario_id, estado, registro_id, baralho_id,
        nome_do_baralho, quantidade)
     VALUES ($1, $2, $3, $4, NULL, 'b1', 'Inglês', NULL)`,
    [rotinaId, data, dono, estado],
  );
}

/** Grava o Início autorizado de um Compromisso (FR-248). */
async function gravarInicio(
  piscina: Pool,
  dono: string,
  id: string,
  rotinaId: string,
  data: string,
): Promise<void> {
  await piscina.query(
    `INSERT INTO inicio_de_compromisso
       (id, usuario_id, rotina_id, data, iniciado_em, fuso, baralho_id,
        nome_do_baralho, quantidade, cartoes)
     VALUES ($1, $2, $3, $4, $5, $6, 'b1', 'Inglês', NULL, $7)`,
    [id, dono, rotinaId, data, INSTANTE, "America/Sao_Paulo", "[]"],
  );
}

describe("migração 8 — esquema da Agenda de estudo no PostgreSQL", () => {
  it("preserva os dados instalados ao levar a base da versão 7 à 8 (FR-248, FR-250)", async () => {
    await comBase("migracao-agenda-upgrade", 7, async (piscina) => {
      const dono = await gravarDono(piscina, "dono-um", "ana.silva");
      await gravarCartao(piscina, dono, "c1");
      await gravarBaralho(piscina, dono, "b1");
      await gravarVinculo(piscina, "c1", "b1");
      await gravarRegistroDeSessao(piscina, dono, "r1");
      await gravarAgendamento(piscina, dono, "c1");
      await gravarPreferencias(piscina, dono);

      // Aplica a migração 8, que só cria tabelas novas.
      await aplicarMigracoes(piscina);

      expect(await contarLinhas(piscina, "usuario")).toBe(1);
      expect(await contarLinhas(piscina, "cartao")).toBe(1);
      expect(await contarLinhas(piscina, "baralho")).toBe(1);
      expect(await contarLinhas(piscina, "vinculo")).toBe(1);
      expect(await contarLinhas(piscina, "registro_de_sessao")).toBe(1);
      expect(await contarLinhas(piscina, "item_de_registro")).toBe(1);
      expect(await contarLinhas(piscina, "agendamento")).toBe(1);
      expect(await contarLinhas(piscina, "preferencias")).toBe(1);

      expect(await contarLinhas(piscina, "rotina_de_estudo")).toBe(0);
      expect(await contarLinhas(piscina, "operacao_de_rotina")).toBe(0);
      expect(await contarLinhas(piscina, "compromisso_de_estudo")).toBe(0);
      expect(await contarLinhas(piscina, "inicio_de_compromisso")).toBe(0);
    });
  });

  it("excluir o Usuário remove as Rotinas, Operações, Compromissos e Inícios dele e preserva os do outro (FR-248)", async () => {
    await comBase("migracao-agenda-usuario", 8, async (piscina) => {
      const um = await gravarDono(piscina, "usuario-um", "ana.silva");
      const dois = await gravarDono(piscina, "usuario-dois", "bruno.souza");
      await gravarBaralho(piscina, um, "b1");
      await gravarBaralho(piscina, dois, "b2");

      await gravarRotina(piscina, um, "rot-um", "b1");
      await gravarRotina(piscina, dois, "rot-dois", "b2");
      await gravarOperacao(piscina, um, "op-um", "rot-um");
      await gravarOperacao(piscina, dois, "op-dois", "rot-dois");
      await gravarCompromisso(piscina, um, "rot-um", DATA);
      await gravarCompromisso(piscina, dois, "rot-dois", DATA);
      await gravarInicio(piscina, um, "ini-um", "rot-um", DATA);
      await gravarInicio(piscina, dois, "ini-dois", "rot-dois", DATA);

      await piscina.query("DELETE FROM usuario WHERE id = $1", [um]);

      expect(await contarLinhas(piscina, "rotina_de_estudo")).toBe(1);
      expect(await contarLinhas(piscina, "operacao_de_rotina")).toBe(1);
      expect(await contarLinhas(piscina, "compromisso_de_estudo")).toBe(1);
      expect(await contarLinhas(piscina, "inicio_de_compromisso")).toBe(1);

      const { rows } = await piscina.query<{ id: string }>(
        "SELECT id FROM rotina_de_estudo",
      );
      expect(rows[0]?.id).toBe("rot-dois");
    });
  });

  it("a unicidade Rotina+data recusa o segundo Compromisso e aceita datas e Rotinas diferentes (FR-250)", async () => {
    await comBase("migracao-agenda-unicidade", 8, async (piscina) => {
      const dono = await gravarDono(piscina, "dono-um", "ana.silva");
      await gravarBaralho(piscina, dono, "b1");
      await gravarRotina(piscina, dono, "rot-um", "b1");
      await gravarRotina(piscina, dono, "rot-dois", "b1");

      await gravarCompromisso(piscina, dono, "rot-um", "2025-02-10");

      await expect(
        gravarCompromisso(piscina, dono, "rot-um", "2025-02-10"),
      ).rejects.toThrow();

      await gravarCompromisso(piscina, dono, "rot-um", "2025-02-11");
      await gravarCompromisso(piscina, dono, "rot-dois", "2025-02-10");

      expect(await contarLinhas(piscina, "compromisso_de_estudo")).toBe(3);
    });
  });

  it("excluir o Baralho preserva a Rotina com baralho_id nulo, mantendo os Compromissos e Inícios (FR-248)", async () => {
    await comBase("migracao-agenda-baralho", 8, async (piscina) => {
      const dono = await gravarDono(piscina, "dono-um", "ana.silva");
      await gravarBaralho(piscina, dono, "b1");
      await gravarRotina(piscina, dono, "rot-um", "b1");
      await gravarCompromisso(piscina, dono, "rot-um", DATA);
      await gravarInicio(piscina, dono, "ini-um", "rot-um", DATA);

      await piscina.query("DELETE FROM baralho WHERE id = $1", ["b1"]);

      expect(await contarLinhas(piscina, "rotina_de_estudo")).toBe(1);
      expect(await contarLinhas(piscina, "compromisso_de_estudo")).toBe(1);
      expect(await contarLinhas(piscina, "inicio_de_compromisso")).toBe(1);

      const { rows } = await piscina.query<{ baralho_id: string | null }>(
        "SELECT baralho_id FROM rotina_de_estudo WHERE id = $1",
        ["rot-um"],
      );
      expect(rows[0]?.baralho_id).toBeNull();
    });
  });

  it("os estados de Rotina e de Compromisso recusam valor fora do CHECK (FR-248, FR-250)", async () => {
    await comBase("migracao-agenda-estado", 8, async (piscina) => {
      const dono = await gravarDono(piscina, "dono-um", "ana.silva");
      await gravarBaralho(piscina, dono, "b1");

      await expect(
        gravarRotina(piscina, dono, "rot-x", "b1", "arquivada"),
      ).rejects.toThrow();

      await gravarRotina(piscina, dono, "rot-um", "b1");

      await expect(
        gravarCompromisso(piscina, dono, "rot-um", DATA, "pendente"),
      ).rejects.toThrow();

      await gravarRotina(piscina, dono, "rot-ok", "b1", "pausada");
      await gravarCompromisso(
        piscina,
        dono,
        "rot-um",
        "2025-03-01",
        "concluido",
      );

      expect(await contarLinhas(piscina, "rotina_de_estudo")).toBe(2);
      expect(await contarLinhas(piscina, "compromisso_de_estudo")).toBe(1);
    });
  });
});
