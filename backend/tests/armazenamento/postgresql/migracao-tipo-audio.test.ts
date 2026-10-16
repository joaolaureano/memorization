import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  aplicarMigracoes,
  lerVersaoDoEsquema,
  versaoAceitaNoInicio,
  versaoCorrenteConhecida,
} from "../../../src/armazenamento/postgresql/esquema.ts";
import { MIGRACOES } from "../../../src/armazenamento/postgresql/migracoes.ts";
import { abrirPiscinaDaBase, descartarBasesDeTeste } from "./base-de-teste.ts";
import {
  servidorDeTeste,
  type FerramentasDoServidor,
} from "./servidor-de-teste.ts";

/**
 * T006 — migrações 20 e 21 do Adapter da nuvem (`028`, FR-434, FR-435, FR-449,
 * SC-182), em paridade com as do SQLite (`tests/acervo/migracao-tipo-audio.test.ts`).
 *
 * Como as demais provas de migração, as asserções inspecionam as tabelas do
 * PostgreSQL: é o comportamento do esquema que está sob verificação.
 */

let servidor: FerramentasDoServidor;

beforeAll(async () => {
  servidor = await servidorDeTeste();
}, 120_000);

afterAll(async () => {
  await descartarBasesDeTeste();
  await (await servidorDeTeste()).encerrar();
});

const VIOLACAO_DE_CHECK = "23514";

/** Diz se a tabela existe, consultando o catálogo do PostgreSQL. */
async function existeTabela(piscina: Pool, nome: string): Promise<boolean> {
  const { rows } = await piscina.query<{ existe: boolean }>(
    "SELECT to_regclass($1) IS NOT NULL AS existe",
    [nome],
  );
  return rows[0]?.existe === true;
}

/** Cria uma base com o dono `dono-um` já gravado, migrada até `versao`. */
async function baseMigradaAte(titulo: string, versao: number): Promise<Pool> {
  const nomeDaBase = await servidor.criarBase(`tipo-audio-${titulo}`);
  const piscina = await abrirPiscinaDaBase(nomeDaBase);

  await aplicarMigracoes(
    piscina,
    MIGRACOES.filter((migracao) => migracao.versao <= versao),
  );
  await gravarDono(piscina);

  return piscina;
}

async function gravarDono(piscina: Pool): Promise<void> {
  await piscina.query(
    `INSERT INTO usuario (id, nome_de_usuario, sal, hash, parametros)
     VALUES ('dono-um', 'ana.silva', $1, $2, '{}')`,
    [Buffer.alloc(16), Buffer.from("hash-sintetico")],
  );
}

/** Base na versão 19, com um dono e as linhas que a migração precisa preservar. */
async function baseNaVersao19(titulo: string): Promise<Pool> {
  const piscina = await baseMigradaAte(titulo, 19);
  await piscina.query(
    "INSERT INTO baralho (id, nome, usuario_id) VALUES ('b1', 'Inglês', 'dono-um')",
  );
  return piscina;
}

/** Grava um Cartão de Áudio, para os cenários de CHECK. */
async function inserirAudio(
  piscina: Pool,
  id: string,
  frente: string,
  tipo: string,
  audioChave: string | null,
  audioDuracaoMs: number | null,
): Promise<string> {
  return falha(
    piscina,
    `INSERT INTO cartao (id, frente, verso, usuario_id, tipo, audio_chave, audio_duracao_ms)
     VALUES ($1, $2, 'Verso', 'dono-um', $3, $4, $5)`,
    [id, frente, tipo, audioChave, audioDuracaoMs],
  );
}

/** Executa a instrução e devolve o SQLSTATE da falha, ou vazio se ela passou. */
async function falha(piscina: Pool, sql: string, parametros: unknown[]): Promise<string> {
  try {
    await piscina.query(sql, parametros);
    return "";
  } catch (erro) {
    return (erro as { code?: string }).code ?? "erro";
  }
}

describe("migrações 20 e 21 — Tipo áudio (PostgreSQL)", () => {
  it("preserva a base v19 e chega à v21 com a fila de Mídia (SC-182, FR-449)", async () => {
    const piscina = await baseNaVersao19("v19");

    try {
      await piscina.query(
        `INSERT INTO cartao (id, frente, verso, usuario_id) VALUES ('c1', 'To walk', 'Caminhar', 'dono-um')`,
      );
      await piscina.query(
        "INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave) VALUES ('c1', 'b1', 'to walk')",
      );
      await piscina.query(
        `INSERT INTO agendamento (usuario_id, cartao_id, algoritmo, versao_do_algoritmo, estado,
           proxima_revisao_em, ultima_avaliacao, revisado_em, criado_em)
         VALUES ('dono-um', 'c1', 'sm2', 1, '{}', '2026-10-20T00:00:00Z', 'bom',
           '2026-10-13T00:00:00Z', '2026-10-13T00:00:00Z')`,
      );
      await piscina.query(
        `INSERT INTO registro_de_sessao (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
           estudados, acertos, erros)
         VALUES ('r1', 'dono-um', 'b1', 'Inglês', '2026-10-13T00:00:00Z', 1, 1, 0)`,
      );
      await piscina.query(
        `INSERT INTO item_de_registro (registro_id, posicao, frente, verso, resultado)
         VALUES ('r1', 0, 'To walk', 'Caminhar', 'acertou')`,
      );
      await piscina.query(
        `INSERT INTO cartao (id, frente, verso, usuario_id, tipo, imagem_chave)
         VALUES ('i1', '', 'Pernambuco', 'dono-um', 'imagem', 'imagens/u/x')`,
      );
      await piscina.query(
        "INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave) VALUES ('i1', 'b1', NULL)",
      );
      await piscina.query(
        "INSERT INTO imagem_a_remover (chave, registrada_em) VALUES ('imagens/u/velha', '2026-10-13T00:00:00Z')",
      );

      const consultaDeCartoes =
        "SELECT id, frente, verso, tipo, imagem_chave FROM cartao ORDER BY id";
      const cartoesAntes = (await piscina.query(consultaDeCartoes)).rows;

      await aplicarMigracoes(piscina);

      expect(await lerVersaoDoEsquema(piscina)).toBe(23);
      expect((await piscina.query(consultaDeCartoes)).rows).toEqual(cartoesAntes);
      expect(
        (await piscina.query<{ chave: string }>("SELECT chave FROM midia_a_remover")).rows.map(
          (linha) => linha.chave,
        ),
      ).toEqual(["imagens/u/velha"]);
      expect(await existeTabela(piscina, "imagem_a_remover")).toBe(false);
      expect(await existeTabela(piscina, "midia_a_remover")).toBe(true);

      await piscina.query("DELETE FROM cartao WHERE id = 'c1'");

      expect(
        (await piscina.query("SELECT count(*)::int AS total FROM pertencimento WHERE cartao_id = 'c1'")).rows,
      ).toEqual([{ total: 0 }]);
      expect(
        (await piscina.query("SELECT count(*)::int AS total FROM agendamento WHERE cartao_id = 'c1'")).rows,
      ).toEqual([{ total: 0 }]);
    } finally {
      await piscina.end();
    }
  });

  it("aceita o tipo 'audio' com chave e duração (FR-434, FR-435)", async () => {
    const piscina = await baseNaVersao19("aceita");

    try {
      await aplicarMigracoes(piscina);

      expect(await inserirAudio(piscina, "a1", "", "audio", "audios/u/a", 4210)).toBe("");
    } finally {
      await piscina.end();
    }
  });

  it("recusa um tipo fora do conjunto (FR-434)", async () => {
    const piscina = await baseNaVersao19("tipo-invalido");

    try {
      await aplicarMigracoes(piscina);

      expect(await inserirAudio(piscina, "a2", "F", "outro", "audios/u/a", 4210)).toBe(VIOLACAO_DE_CHECK);
    } finally {
      await piscina.end();
    }
  });

  it("recusa o tipo 'audio' sem chave de Áudio (FR-435)", async () => {
    const piscina = await baseNaVersao19("sem-chave");

    try {
      await aplicarMigracoes(piscina);

      expect(await inserirAudio(piscina, "a3", "", "audio", null, 4210)).toBe(VIOLACAO_DE_CHECK);
    } finally {
      await piscina.end();
    }
  });

  it("recusa chave de Áudio fora do tipo 'audio' (FR-435)", async () => {
    const piscina = await baseNaVersao19("chave-fora-do-tipo");

    try {
      await aplicarMigracoes(piscina);

      expect(await inserirAudio(piscina, "a4", "F", "frente-verso", "audios/u/a", 4210)).toBe(VIOLACAO_DE_CHECK);
    } finally {
      await piscina.end();
    }
  });

  it("recusa chave de Áudio sem duração (FR-435)", async () => {
    const piscina = await baseNaVersao19("sem-duracao");

    try {
      await aplicarMigracoes(piscina);

      expect(await inserirAudio(piscina, "a5", "", "audio", "audios/u/a", null)).toBe(VIOLACAO_DE_CHECK);
    } finally {
      await piscina.end();
    }
  });

  it("recusa duração 0 (FR-441)", async () => {
    const piscina = await baseNaVersao19("duracao-zero");

    try {
      await aplicarMigracoes(piscina);

      expect(await inserirAudio(piscina, "a6", "", "audio", "audios/u/a", 0)).toBe(VIOLACAO_DE_CHECK);
    } finally {
      await piscina.end();
    }
  });

  it("recusa duração acima de 300 000 ms (FR-441)", async () => {
    const piscina = await baseNaVersao19("duracao-alta");

    try {
      await aplicarMigracoes(piscina);

      expect(await inserirAudio(piscina, "a7", "", "audio", "audios/u/a", 300001)).toBe(VIOLACAO_DE_CHECK);
    } finally {
      await piscina.end();
    }
  });

  it("aceita duração de exatamente 300 000 ms (FR-441)", async () => {
    const piscina = await baseNaVersao19("duracao-limite");

    try {
      await aplicarMigracoes(piscina);

      expect(await inserirAudio(piscina, "a8", "", "audio", "audios/u/a", 300000)).toBe("");
    } finally {
      await piscina.end();
    }
  });

  it("mantém a Frente obrigatória no tipo 'frente-verso' (FR-434)", async () => {
    const piscina = await baseNaVersao19("frente-obrigatoria");

    try {
      await aplicarMigracoes(piscina);

      expect(await inserirAudio(piscina, "f1", "", "frente-verso", null, null)).toBe(VIOLACAO_DE_CHECK);
    } finally {
      await piscina.end();
    }
  });

  it("aceita o tipo 'audio' no snapshot do Histórico e recusa 'outro' (FR-447)", async () => {
    const piscina = await baseNaVersao19("snapshot");

    try {
      await aplicarMigracoes(piscina);
      await piscina.query(
        `INSERT INTO registro_de_sessao (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
           estudados, acertos, erros)
         VALUES ('r1', 'dono-um', 'b1', 'Inglês', '2026-10-13T00:00:00Z', 1, 1, 0)`,
      );
      const inserirItem = `INSERT INTO item_de_registro (registro_id, posicao, frente, verso, resultado, tipo)
                           VALUES ('r1', $1, '', 'Verso', 'acertou', $2)`;

      expect(await falha(piscina, inserirItem, [0, "audio"])).toBe("");
      expect(await falha(piscina, inserirItem, [1, "outro"])).toBe(VIOLACAO_DE_CHECK);
    } finally {
      await piscina.end();
    }
  });

  it("recusa a versão 20 e a 21 no início, porque a 22 não tem precondição, e aceita a 22 (FR-397, research R21)", async () => {
    expect(versaoAceitaNoInicio(20)).toBe(false);
    expect(versaoAceitaNoInicio(21)).toBe(false);
    expect(versaoAceitaNoInicio(22)).toBe(true);
    expect(versaoCorrenteConhecida()).toBe(23);
  });
});

describe("migrações 20 e 21 — base com Cartão sem Pertencimento (PostgreSQL)", () => {
  it("chega à v22 com o tipo Áudio utilizável e `vinculo` ainda presente, e à v23 depois da transição", async () => {
    const nomeDaBase = await servidor.criarBase("tipo-audio-transicao");
    const piscina = await abrirPiscinaDaBase(nomeDaBase);

    try {
      await aplicarMigracoes(
        piscina,
        MIGRACOES.filter((migracao) => migracao.versao <= 12),
      );
      await gravarDono(piscina);
      await piscina.query(
        "INSERT INTO baralho (id, nome, usuario_id) VALUES ('b1', 'Inglês', 'dono-um')",
      );
      await piscina.query(
        `INSERT INTO cartao (id, frente, verso, usuario_id) VALUES ('c1', 'To walk', 'Caminhar', 'dono-um')`,
      );
      await aplicarMigracoes(
        piscina,
        MIGRACOES.filter((migracao) => migracao.versao <= 17),
      );

      await aplicarMigracoes(piscina);

      expect(await lerVersaoDoEsquema(piscina)).toBe(22);
      expect(await existeTabela(piscina, "vinculo")).toBe(true);
      expect(await inserirAudio(piscina, "a1", "", "audio", "audios/u/a", 4210)).toBe("");

      await piscina.query(
        "INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave) VALUES ('c1', 'b1', 'to walk')",
      );
      await piscina.query(
        "INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave) VALUES ('a1', 'b1', NULL)",
      );
      await piscina.query(
        `INSERT INTO registro_de_sessao (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
           estudados, acertos, erros, origem)
         VALUES ('r1', 'dono-um', 'b1', 'Revisão do dia', '2026-10-13T00:00:00Z', 1, 1, 0, 'revisao')`,
      );

      await aplicarMigracoes(piscina);

      expect(await lerVersaoDoEsquema(piscina)).toBe(23);
      expect(await existeTabela(piscina, "vinculo")).toBe(false);
      expect(
        (await piscina.query("SELECT nome_do_baralho FROM registro_de_sessao WHERE id = 'r1'")).rows,
      ).toEqual([{ nome_do_baralho: "" }]);
    } finally {
      await piscina.end();
    }
  });
});
