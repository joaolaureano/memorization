import {
  codigoSqlState,
  configuracaoDaConexao,
  criarPiscina,
  UrlDeConexaoInvalidaError,
  type ConfiguracaoDaConexao,
} from "../armazenamento/postgresql/conexao.ts";
import { aplicarMigracoes } from "../armazenamento/postgresql/esquema.ts";

/**
 * O comando de migração da nuvem (FR-116, SC-048).
 *
 * É a **única** forma de migrar: as entradas não aplicam migração ao subir, e o
 * início da nuvem confere a versão e recusa quando ela está atrasada (FR-121).
 * Roda uma vez por implantação, **antes** de subir a aplicação, e o operador
 * aponta `DB_URL` para o endpoint **direto** do provedor, porque DDL com trava
 * consultiva em transação atravessa mal o agrupador.
 *
 * O aplicador é o do Adapter: cada migração pendente numa transação que começa
 * pela trava consultiva `pg_advisory_xact_lock`, com a elevação de versão dentro
 * da mesma transação. Numa base já migrada o comando percorre a lista, não
 * encontra nada pendente e **não escreve nada**; dois comandos simultâneos não
 * aplicam a mesma migração duas vezes; e uma migração que falha desfaz por
 * completo, sem deixar DDL nem versão pela metade.
 *
 * A saída informa o resultado e a versão resultante, e **nunca** a URL, o host,
 * o usuário, a senha nem a cadeia de conexão: a falha do driver vira mensagem
 * genérica em português, acrescida do SQLSTATE quando houver (FR-118, SC-045).
 */

/** Prefixo das recusas de configuração deste comando. */
const PREFIXO_DA_RECUSA = "Migração recusada";

/** Falha ao aplicar as migrações: genérica, em português, sem nada do driver. */
const FALHA_NA_MIGRACAO =
  "Falha na migração da nuvem: não foi possível aplicar as migrações. " +
  "Nenhuma migração ficou pela metade.";

/**
 * Lê e valida `DB_URL` — e o `DB_CA_CERT` opcional —, ou devolve `null` depois
 * de reportar a recusa, nomeando a variável de ambiente e nada do valor
 * (FR-113, FR-114, SC-046).
 */
function lerConfiguracao(): ConfiguracaoDaConexao | null {
  try {
    return configuracaoDaConexao(process.env.DB_URL, process.env.DB_CA_CERT);
  } catch (erro) {
    if (erro instanceof UrlDeConexaoInvalidaError) {
      console.error(`${PREFIXO_DA_RECUSA}: ${erro.message}`);
      process.exitCode = 1;

      return null;
    }

    throw erro;
  }
}

/** A mensagem de falha do driver: genérica, mais o SQLSTATE quando houver. */
function mensagemDaFalha(erro: unknown): string {
  const codigo = codigoSqlState(erro);

  return codigo === undefined
    ? FALHA_NA_MIGRACAO
    : `${FALHA_NA_MIGRACAO} (SQLSTATE ${codigo})`;
}

/** Aplica as migrações pendentes e informa a versão resultante do esquema. */
async function migrar(configuracao: ConfiguracaoDaConexao): Promise<void> {
  const piscina = criarPiscina(configuracao);

  try {
    const versao = await aplicarMigracoes(piscina);

    console.log(
      `Migração concluída: o esquema da base está na versão ${versao}.`,
    );
  } catch (erro) {
    console.error(mensagemDaFalha(erro));
    process.exitCode = 1;
  } finally {
    await piscina.end();
  }
}

const configuracao = lerConfiguracao();

if (configuracao !== null) {
  await migrar(configuracao);
}
