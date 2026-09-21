import type { Pool, PoolClient } from "pg";

import { MIGRACOES, type Migracao } from "./migracoes.ts";

/**
 * Esquema PostgreSQL do `Acervo` — a Seam interna da Implementation do Adapter
 * da nuvem.
 *
 * A tabela `versao_do_esquema` registra a versão corrente — a **mesma noção** da
 * tabela do Adapter local —, e a sequência ordenada de migrações vive em
 * `migracoes.ts`. Aqui fica o aplicador: garante o controle de versão e roda as
 * migrações pendentes, **cada uma numa transação própria**, começada pela trava
 * consultiva e com a elevação de versão dentro da mesma transação.
 *
 * A trava `pg_advisory_xact_lock` é da própria transação: sai no `COMMIT` ou no
 * `ROLLBACK`, de modo que dois comandos de migração disparados ao mesmo tempo
 * nunca migram ao mesmo tempo, e não há tabela de trava para manter. A versão é
 * **releseada depois da trava**, e é isso que faz a segunda instância enxergar a
 * migração que a primeira já aplicou e não a repetir (FR-116, SC-048).
 *
 * O aplicador é chamado **apenas** pelo comando de migração da nuvem: nenhuma
 * entrada aplica migração ao subir (FR-121).
 */

/**
 * A tabela que rastreia a versão do esquema: um único inteiro, sem chave.
 * Guarda uma única linha com a versão da última migração aplicada; 0 significa
 * que nenhuma migração rodou.
 */
const TABELA_DE_VERSAO = `
CREATE TABLE IF NOT EXISTS versao_do_esquema (
  versao INTEGER NOT NULL
);
`;

/** Garante a única linha da tabela de versão, criada na versão 0. */
const GARANTIR_LINHA_DE_VERSAO = `
INSERT INTO versao_do_esquema (versao)
SELECT 0
 WHERE NOT EXISTS (SELECT 1 FROM versao_do_esquema);
`;

/** A trava consultiva da transação corrente, tomada pela chave fixa abaixo. */
const TRAVA_DAS_MIGRACOES = "SELECT pg_advisory_xact_lock($1);";

/**
 * Chave fixa da trava consultiva das migrações. Ela precisa ser a **mesma** em
 * todos os deployamentos para que a exclusão mútua valha; o valor é arbitrário
 * e não guarda significado além do nome: `0x6d656d6f` são as letras "memo".
 */
const CHAVE_DA_TRAVA = 0x6d656d6f;

/** Uma conexão que sabe executar consultas: a piscina ou uma conexão dela. */
type Conexao = Pool | PoolClient;

/** Diz se a tabela de controle já existe, sem depender de exceção para isso. */
async function existeTabelaDeVersao(conexao: Conexao): Promise<boolean> {
  const { rows } = await conexao.query<{ existe: boolean }>(
    "SELECT to_regclass('versao_do_esquema') IS NOT NULL AS existe;",
  );

  return rows[0]?.existe === true;
}

/**
 * Lê a versão corrente da base; 0 quando nenhuma migração foi aplicada — o que
 * inclui a base que ainda nem tem a tabela de controle.
 */
export async function lerVersaoDoEsquema(conexao: Conexao): Promise<number> {
  if (!(await existeTabelaDeVersao(conexao))) {
    return 0;
  }

  const { rows } = await conexao.query<{ versao: number }>(
    "SELECT versao FROM versao_do_esquema;",
  );

  return rows[0] === undefined ? 0 : Number(rows[0].versao);
}

/**
 * A última versão conhecida pelo binário. A lista de migrações é a fonte da
 * verdade: nenhum número é escrito à mão, e é por isso que conferir a versão de
 * uma base continua valendo quando a `007` e a `008` acrescentarem as delas.
 */
export function versaoCorrenteConhecida(): number {
  return MIGRACOES.reduce(
    (maior, migracao) => Math.max(maior, migracao.versao),
    0,
  );
}

/**
 * Executa o corpo numa conexão exclusiva, dentro de uma transação que começa
 * com a trava consultiva das migrações. A trava sai no `COMMIT` ou no
 * `ROLLBACK`, e a conexão volta para o conjunto em qualquer desfecho.
 */
async function emTransacao<T>(
  piscina: Pool,
  corpo: (cliente: PoolClient) => Promise<T>,
): Promise<T> {
  const cliente = await piscina.connect();

  try {
    await cliente.query("BEGIN;");
    await cliente.query(TRAVA_DAS_MIGRACOES, [CHAVE_DA_TRAVA]);

    const resultado = await corpo(cliente);

    await cliente.query("COMMIT;");

    return resultado;
  } catch (erro) {
    try {
      await cliente.query("ROLLBACK;");
    } catch {
      // Sem transação ativa para desfazer; a falha original é a que importa.
    }

    throw erro;
  } finally {
    cliente.release();
  }
}

/**
 * Garante a tabela de controle e a sua única linha. A criação também acontece
 * sob a trava consultiva: dois comandos simultâneos numa base nova não disputam
 * o `CREATE TABLE`.
 */
async function garantirControleDeVersao(piscina: Pool): Promise<void> {
  await emTransacao(piscina, async (cliente) => {
    await cliente.query(TABELA_DE_VERSAO);
    await cliente.query(GARANTIR_LINHA_DE_VERSAO);
  });
}

/**
 * Aplica uma migração pendente e devolve a versão que ficou registrada.
 *
 * A releitura da versão acontece **depois** da trava: se outro comando aplicou
 * esta mesma migração enquanto esperávamos, ela não é aplicada de novo e a
 * versão lida é a que vale.
 */
async function aplicarMigracao(
  piscina: Pool,
  migracao: Migracao,
): Promise<number> {
  return emTransacao(piscina, async (cliente) => {
    const versao = await lerVersaoDoEsquema(cliente);

    if (migracao.versao <= versao) {
      return versao;
    }

    await cliente.query(migracao.sql);
    await cliente.query("UPDATE versao_do_esquema SET versao = $1;", [
      migracao.versao,
    ]);

    return migracao.versao;
  });
}

/**
 * Aplica as migrações pendentes, na ordem da lista, e devolve a versão
 * resultante.
 *
 * A lista é a sequência ordenada: números de versão únicos e crescentes, a
 * partir de 1. Uma base nova recebe todas; uma base já migrada recebe apenas as
 * posteriores à versão registrada, e migração já aplicada nunca roda de novo —
 * a comparação é pela versão, e não pelo conteúdo do DDL. Reexecutar o comando
 * numa base já migrada percorre a lista, não encontra nada pendente e **escreve
 * nada** (FR-116, SC-048).
 *
 * Cada migração roda em transação própria, e a elevação da versão acontece
 * dentro da mesma transação. Se o DDL falhar no meio, o `ROLLBACK` desfaz por
 * completo a migração e a base conserva a versão anterior, sem estado parcial.
 */
export async function aplicarMigracoes(
  piscina: Pool,
  migracoes: readonly Migracao[] = MIGRACOES,
): Promise<number> {
  await garantirControleDeVersao(piscina);

  let versao = await lerVersaoDoEsquema(piscina);

  for (const migracao of migracoes) {
    if (migracao.versao <= versao) {
      continue;
    }

    versao = await aplicarMigracao(piscina, migracao);
  }

  return versao;
}
