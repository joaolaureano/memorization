import type { Pool } from "pg";

import {
  abrirArmazenamentoPostgresql,
  type ArmazenamentoPostgresqlAberto,
} from "../../../src/armazenamento/postgresql/armazenamento.ts";
import {
  criarPiscina,
  type ConfiguracaoDaConexao,
} from "../../../src/armazenamento/postgresql/conexao.ts";
import { aplicarMigracoes } from "../../../src/armazenamento/postgresql/esquema.ts";
import type { ArmazenamentoDoAcervo } from "../../../src/armazenamento/porta.ts";
import type { ArmazenamentoAberto } from "../bateria-da-porta.ts";
import {
  servidorDeTeste,
  type FerramentasDoServidor,
} from "./servidor-de-teste.ts";

/**
 * Apoio de teste das bases do Adapter de PostgreSQL: **uma base nova e vazia por
 * cenário**, migrada pelo **mesmo caminho** que o comando de migração da nuvem
 * usa (T902, FR-111, FR-116, SC-044, SC-048).
 *
 * A fábrica da bateria compartilhada de `009` é `criarArmazenamentoDeTeste()`:
 * cada chamada cria a base, aplica as migrações com o aplicador do Adapter e
 * devolve `{ armazenamento, encerrar() }` na forma que a bateria espera;
 * `encerrar()` fecha o conjunto de conexões e **descarta a base**. Nenhum
 * cenário da bateria conhece porta, senha, nome de base ou TLS: tudo isso vive
 * aqui, e é por isso que a bateria roda contra este Adapter sem uma linha de
 * edição.
 *
 * O CA da configuração é o do servidor de teste, e todas as conexões daqui
 * verificam o certificado de verdade — não há caminho de teste que desligue a
 * cifra nem a verificação (FR-115, SC-047).
 *
 * As funções aceitam um servidor explícito: sem ele, valem para o servidor do
 * processo de teste, e com ele um cenário pode usar um servidor **próprio** — é
 * assim que a indisponibilidade do armazenamento é exercitada parando um
 * servidor de verdade.
 */

/** Um armazenamento de teste aberto sobre uma base nova e já migrada. */
export interface BaseDeTeste {
  /** O nome da base criada para este cenário. */
  readonly nomeDaBase: string;
  readonly armazenamento: ArmazenamentoDoAcervo;
  /** Fecha o conjunto de conexões e descarta a base; em dobro não falha. */
  encerrar(): Promise<void>;
}

/** O servidor informado, ou o do processo de teste quando nenhum é informado. */
async function servidorDe(
  servidor?: FerramentasDoServidor,
): Promise<FerramentasDoServidor> {
  return servidor ?? (await servidorDeTeste());
}

/** A configuração de conexão da base informada, com o CA do servidor de teste. */
export async function configuracaoDaBase(
  nomeDaBase: string,
  servidor?: FerramentasDoServidor,
): Promise<ConfiguracaoDaConexao> {
  const apoio = await servidorDe(servidor);

  return {
    url: apoio.urlDaBase(nomeDaBase),
    ca: apoio.configuracao.certificadoDaAutoridade,
  };
}

/** Abre um conjunto de conexões próprio para a base informada. */
export async function abrirPiscinaDaBase(
  nomeDaBase: string,
  servidor?: FerramentasDoServidor,
): Promise<Pool> {
  return criarPiscina(await configuracaoDaBase(nomeDaBase, servidor));
}

/**
 * Leva a base informada à versão corrente do esquema pelo **mesmo caminho do
 * comando de migração**: o aplicador do Adapter, com uma transação por migração
 * e a trava consultiva. Devolve a versão resultante.
 */
export async function migrarBase(
  nomeDaBase: string,
  servidor?: FerramentasDoServidor,
): Promise<number> {
  const piscina = await abrirPiscinaDaBase(nomeDaBase, servidor);

  try {
    return await aplicarMigracoes(piscina);
  } finally {
    await piscina.end();
  }
}

/** Cria uma base nova e vazia, já na versão corrente do esquema. */
export async function criarBaseMigrada(
  titulo: string,
  servidor?: FerramentasDoServidor,
): Promise<string> {
  const apoio = await servidorDe(servidor);
  const nomeDaBase = await apoio.criarBase(titulo);

  await migrarBase(nomeDaBase, apoio);

  return nomeDaBase;
}

/** Abre o Adapter de PostgreSQL sobre a base informada, sem migrar. */
export async function abrirArmazenamentoDaBase(
  nomeDaBase: string,
  servidor?: FerramentasDoServidor,
): Promise<ArmazenamentoPostgresqlAberto> {
  return await abrirArmazenamentoPostgresql(
    await configuracaoDaBase(nomeDaBase, servidor),
  );
}

/**
 * Cria uma base nova, migra-a pelo caminho do comando e abre o Adapter sobre
 * ela. `encerrar()` fecha o conjunto de conexões **e** descarta a base.
 */
export async function abrirBaseDeTeste(
  titulo = "cenario",
  servidor?: FerramentasDoServidor,
): Promise<BaseDeTeste> {
  const apoio = await servidorDe(servidor);
  const nomeDaBase = await criarBaseMigrada(titulo, apoio);
  const aberto = await abrirArmazenamentoDaBase(nomeDaBase, apoio);

  let encerrado = false;

  return {
    nomeDaBase,
    armazenamento: aberto.armazenamento,

    async encerrar() {
      if (encerrado) {
        return;
      }

      encerrado = true;

      await aberto.encerrar();
      await apoio.descartarBase(nomeDaBase);
    },
  };
}

/**
 * A fábrica da bateria compartilhada de `009`: uma base nova e migrada por
 * chamada, sem que o cenário saiba de onde ela veio.
 */
export async function criarArmazenamentoDeTeste(): Promise<ArmazenamentoAberto> {
  return await abrirBaseDeTeste();
}

/** Descarta as bases que esta execução criou e ainda não descartou. */
export async function descartarBasesDeTeste(): Promise<void> {
  await (await servidorDeTeste()).descartarBases();
}
