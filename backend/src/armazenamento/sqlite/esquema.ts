import { DatabaseSync } from "node:sqlite";

import { MIGRACOES, type Migracao } from "./migracoes.ts";

/**
 * Esquema SQLite do `Acervo` — a Seam interna da sua Implementation.
 *
 * A partir da feature `002` há base instalada, e o esquema passa a ser
 * controlado por migração versionada: a tabela `versao_do_esquema` registra a
 * versão corrente, e a sequência ordenada de migrações vive em
 * `migracoes.ts`. Aqui fica o aplicador: liga as chaves estrangeiras da
 * conexão, garante o controle de versão e roda as migrações pendentes, cada
 * uma em transação própria com a elevação de versão dentro da mesma
 * transação.
 */

/**
 * Liga as chaves estrangeiras já nesta feature, embora `cartao` não tenha
 * nenhuma. Sem o `PRAGMA`, o SQLite ignora cascatas em silêncio; ativá-lo agora
 * evita que a feature de Vínculo dependa de alguém lembrar de fazê-lo.
 *
 * É um PRAGMA por conexão: cada `abrirBanco` o executa de novo na conexão
 * recém-aberta, e a aplicação das migrações nunca o desliga.
 */
const PRAGMA_CHAVES_ESTRANGEIRAS = "PRAGMA foreign_keys = ON;";

/**
 * A tabela que rastreia a versão do esquema: um único inteiro, sem chave.
 * Guarda uma única linha com a versão da última migração aplicada; 0
 * significa que nenhuma migração rodou.
 */
const TABELA_DE_VERSAO = `
CREATE TABLE IF NOT EXISTS versao_do_esquema (
  versao INTEGER NOT NULL
);
`;

/** Garante a tabela de versão e a sua única linha, criada na versão 0. */
function prepararControleDeVersao(banco: DatabaseSync): void {
  banco.exec(TABELA_DE_VERSAO);

  const linha = banco.prepare("SELECT versao FROM versao_do_esquema").get();

  if (linha === undefined) {
    banco.prepare("INSERT INTO versao_do_esquema (versao) VALUES (0)").run();
  }
}

/** Lê a versão corrente da base; 0 quando nenhuma migração foi aplicada. */
function versaoAtual(banco: DatabaseSync): number {
  const linha = banco.prepare("SELECT versao FROM versao_do_esquema").get();

  return linha === undefined ? 0 : Number(linha.versao);
}

/**
 * Aplica as migrações pendentes, na ordem da lista.
 *
 * A lista é a sequência ordenada: números de versão únicos e crescentes, a
 * partir de 1. Uma base nova recebe todas; uma base já migrada recebe apenas
 * as posteriores à versão registrada, e migração já aplicada nunca roda de
 * novo — a comparação é pela versão, não pelo conteúdo do DDL.
 *
 * Cada migração roda em transação própria, e a elevação da versão acontece
 * dentro da mesma transação. Se o DDL falhar no meio, o `ROLLBACK` desfaz por
 * completo a migração e a base conserva a versão anterior, sem estado
 * parcial.
 *
 * A tabela de controle é criada sob demanda, o que permite adotar arquivos
 * legados da feature `001`, que têm `cartao` mas não têm
 * `versao_do_esquema`.
 */
export function aplicarMigracoes(
  banco: DatabaseSync,
  migracoes: readonly Migracao[],
): void {
  prepararControleDeVersao(banco);

  const elevarVersao = banco.prepare(
    "UPDATE versao_do_esquema SET versao = ?",
  );

  let versao = versaoAtual(banco);

  for (const migracao of migracoes) {
    if (migracao.versao <= versao) {
      continue;
    }

    try {
      banco.exec("BEGIN");
      banco.exec(migracao.sql);
      elevarVersao.run(migracao.versao);
      banco.exec("COMMIT");
      versao = migracao.versao;
    } catch (erro) {
      try {
        banco.exec("ROLLBACK");
      } catch {
        // Sem transação ativa para desfazer; a falha original é a que importa.
      }
      throw erro;
    }
  }
}

/**
 * Aplica o esquema a um banco já aberto: liga as chaves estrangeiras da
 * conexão e roda as migrações pendentes. Exposta para que o `Acervo` e os
 * testes usem a mesma conexão das operações, sem abrir um banco próprio.
 */
export function aplicarEsquema(banco: DatabaseSync): void {
  banco.exec(PRAGMA_CHAVES_ESTRANGEIRAS);
  aplicarMigracoes(banco, MIGRACOES);
}

/**
 * Abre um banco SQLite no caminho informado — `":memory:"` nos testes — e
 * garante que o esquema exista. Migrar na abertura torna a primeira execução
 * idêntica à reabertura de uma base já migrada.
 */
export function abrirBanco(caminho: string): DatabaseSync {
  const banco = new DatabaseSync(caminho);
  aplicarEsquema(banco);
  return banco;
}
