import { criarAcervo } from "../acervo/acervo.ts";
import {
  abrirArmazenamentoPostgresql,
  type ArmazenamentoPostgresqlAberto,
} from "../armazenamento/postgresql/armazenamento.ts";
import {
  codigoSqlState,
  configuracaoDaConexao,
  criarPiscina,
  UrlDeConexaoInvalidaError,
  type ConfiguracaoDaConexao,
} from "../armazenamento/postgresql/conexao.ts";
import {
  lerVersaoDoEsquema,
  versaoCorrenteConhecida,
} from "../armazenamento/postgresql/esquema.ts";
import { iniciarServidor } from "../http/servidor.ts";
import { criarIdentidade } from "../identidade/identidade.ts";
import {
  segredoConfigurado,
  SegredoAusenteError,
} from "../identidade/segredo.ts";

/**
 * Raiz de composição da execução da nuvem (FR-110, FR-117).
 *
 * É a única entrada que lê `DB_URL` — o nome imposto pela infraestrutura de
 * nuvem existente — e o `DB_CA_CERT` opcional, no início do processo, e passa a
 * configuração **já validada** para o Adapter. O Adapter não lê ambiente, e é
 * por isso que a leitura de variável aparece apenas aqui e em
 * `migrar-nuvem.ts`, e em nenhum Module (FR-113).
 *
 * A ordem do início é a do contrato: lê e valida **o segredo do servidor** →
 * lê e valida a URL → abre o conjunto de conexões → **confere a versão do
 * esquema** → informa o armazenamento em uso → começa a escutar. O início
 * **não** migra: uma base atrasada é recusada, e não servida sobre um esquema
 * que este binário não conhece (FR-121, SC-048).
 *
 * O segredo das Senhas vem primeiro porque sem ele não há Cadastro possível: a
 * aplicação **recusa iniciar** (FR-077, SC-024), e nada mais é lido do ambiente.
 *
 * Nada de sensível alcança a saída ou o registro: nem a URL, nem o usuário, nem
 * a senha, nem o host, nem o segredo das Senhas. A falha do driver vira
 * mensagem genérica em português, acrescida do SQLSTATE quando houver — um
 * código, e não um valor (FR-118, SC-045).
 */

/**
 * A única linha de início, impressa **antes** de escutar: nomeia o tipo do
 * armazenamento em uso, e nada além dele (FR-118, SC-045).
 */
const LINHA_DE_INICIO = "Armazenamento: PostgreSQL (nuvem)";

/** Prefixo das recusas de configuração desta entrada. */
const PREFIXO_DA_RECUSA = "Nuvem recusada";

/**
 * Falha de acesso ao armazenamento da nuvem. A frase é do processo, em
 * português, e não repete a URL nem nada do driver: a aplicação **não** segue
 * como se o armazenamento existisse (FR-044, FR-045, FR-118).
 */
const FALHA_NO_ACESSO =
  "Falha no armazenamento da nuvem: não foi possível acessar a base. " +
  "A aplicação não foi iniciada.";

/**
 * A recusa por esquema atrasado nomeia as duas versões e manda executar o
 * comando de migração da nuvem — que é o **único** caminho que migra (FR-121).
 */
function inicioRecusado(
  versaoEncontrada: number,
  versaoCorrente: number,
): string {
  return (
    "Início recusado: o esquema da base está na versão " +
    `${versaoEncontrada} e a versão corrente é ${versaoCorrente}. ` +
    "Execute o comando de migração da nuvem antes de iniciar."
  );
}

/**
 * A mensagem de uma falha de armazenamento: genérica, em português, mais o
 * SQLSTATE quando o driver trouxer um. Nenhum campo do erro do driver —
 * `message`, `detail`, `hint`, `where` — é reproduzido (FR-118, SC-045).
 */
function mensagemDaFalha(erro: unknown): string {
  const codigo = codigoSqlState(erro);

  return codigo === undefined
    ? FALHA_NO_ACESSO
    : `${FALHA_NO_ACESSO} (SQLSTATE ${codigo})`;
}

/**
 * Lê o segredo do servidor, ou devolve `null` depois de reportar a recusa.
 *
 * A mensagem nomeia a variável de ambiente e a regra, e **nunca** o valor: é o
 * mesmo padrão da recusa de `DB_URL` (FR-077, FR-078).
 */
function lerSegredo(): string | null {
  try {
    return segredoConfigurado(process.env);
  } catch (erro) {
    if (erro instanceof SegredoAusenteError) {
      console.error(`${PREFIXO_DA_RECUSA}: ${erro.message}`);
      process.exitCode = 1;

      return null;
    }

    throw erro;
  }
}

/**
 * Lê e valida `DB_URL` — e o `DB_CA_CERT` opcional —, ou devolve `null` depois
 * de reportar a recusa. Nenhum pedaço do valor informado é impresso: a recusa
 * nomeia a variável de ambiente e o motivo (FR-114, SC-046).
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

/** Reporta a falha de armazenamento — sem segredo algum — e recusa o início. */
function reportarFalha(mensagem: string): false {
  console.error(mensagem);
  process.exitCode = 1;

  return false;
}

/**
 * Confere se a base está na versão corrente do esquema, **sem migrar**.
 *
 * A versão é lida por uma conexão curta, que é fechada em qualquer desfecho. A
 * lista de migrações conhecida pelo binário é a fonte da verdade da versão
 * corrente, de modo que a conferência continua valendo quando a `007` e a `008`
 * acrescentarem as migrações delas (FR-121, SC-048).
 */
async function esquemaNaVersaoCorrente(
  configuracao: ConfiguracaoDaConexao,
): Promise<boolean> {
  const piscina = criarPiscina(configuracao);

  try {
    const encontrada = await lerVersaoDoEsquema(piscina);
    const corrente = versaoCorrenteConhecida();

    return encontrada === corrente
      ? true
      : reportarFalha(inicioRecusado(encontrada, corrente));
  } catch (erro) {
    return reportarFalha(mensagemDaFalha(erro));
  } finally {
    await piscina.end();
  }
}

/**
 * Abre o Adapter da nuvem; a falha é reportada e interrompe o início. A frase
 * não reproduz a URL nem o texto do driver (FR-044, FR-045, FR-118).
 */
async function abrirArmazenamentoDaNuvem(
  configuracao: ConfiguracaoDaConexao,
): Promise<ArmazenamentoPostgresqlAberto | null> {
  try {
    return await abrirArmazenamentoPostgresql(configuracao);
  } catch (erro) {
    reportarFalha(mensagemDaFalha(erro));

    return null;
  }
}

const segredo = lerSegredo();
const configuracao = segredo === null ? null : lerConfiguracao();

if (
  segredo !== null &&
  configuracao !== null &&
  (await esquemaNaVersaoCorrente(configuracao))
) {
  const aberto = await abrirArmazenamentoDaNuvem(configuracao);

  if (aberto !== null) {
    const acervo = criarAcervo(aberto.armazenamento);
    const identidade = criarIdentidade(aberto.usuarios, segredo);

    console.log(LINHA_DE_INICIO);

    await iniciarServidor(process.env, acervo, identidade);
  }
}
