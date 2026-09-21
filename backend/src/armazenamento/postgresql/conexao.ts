import { readFileSync } from "node:fs";

import { Pool, type PoolConfig } from "pg";

/**
 * Configuração de conexão do Adapter de PostgreSQL: a URL de conexão que a
 * entrada da nuvem já validou, mais o CA opcional.
 *
 * O Adapter **não lê ambiente**: as variáveis de ambiente são lidas apenas pelas
 * entradas da nuvem, no início do processo, que passam a configuração pronta
 * (FR-113). É o que mantém uma única raiz de composição por armazenamento e torna
 * verificável por leitura de imports que nenhum Module conhece a variável.
 */
export interface ConfiguracaoDaConexao {
  /** A URL de conexão já validada pela entrada da nuvem. */
  url: string;
  /** O CA em PEM, quando a entrada informar um — o valor de `DB_CA_CERT`.
   * Ausente, vale a cadeia pública do provedor. */
  ca?: string;
}

/**
 * Recusa de configuração de conexão da nuvem (FR-113, FR-114, FR-115).
 *
 * A mensagem — em português — nomeia a variável de ambiente e o motivo, e
 * **nenhum pedaço do valor informado**: nem usuário, nem senha, nem host, nem
 * caminho. É o que permite recusar sem que a URL de conexão, que é segredo,
 * apareça na saída ou no registro de quem executou (FR-118, SC-045).
 */
export class UrlDeConexaoInvalidaError extends Error {}

/** Motivo: a variável não foi informada — ausente ou vazia. */
const URL_NAO_INFORMADA = "a variável de ambiente DB_URL não foi informada.";

/** Motivo: o valor informado não é uma URL de conexão utilizável. */
const URL_INVALIDA =
  "a variável de ambiente DB_URL não é uma URL de conexão válida.";

/**
 * Motivo: a URL pede conexão sem verificação do certificado. A cifra é
 * obrigatória, e o objeto `ssl` do Adapter é que manda (FR-115).
 */
const CIFRA_REBAIXADA =
  "a URL de DB_URL pede conexão sem verificação de certificado; " +
  "a conexão cifrada com certificado verificado é obrigatória.";

/** Motivo: o caminho informado não entrega um PEM legível. */
const CA_ILEGIVEL =
  "a variável de ambiente DB_CA_CERT não aponta um certificado legível.";

/** Protocolos aceitos numa URL de conexão de PostgreSQL. */
const PROTOCOLOS_ACEITOS = new Set(["postgres:", "postgresql:"]);

/**
 * Valores de `sslmode` que pedem cifra desligada (`disable`), ou cifra que pode
 * ser dispensada por falta de suporte (`allow`) ou não verificada (`prefer`).
 * Todos os três são recusados antes de qualquer conexão: a cifra com
 * certificado verificado é obrigatória (FR-115, SC-047). `require`, `verify-ca`
 * e `verify-full` são aceitos — e, de todo modo, verificados por inteiro.
 */
const CIFRA_REBAIXADA_PEDIDA = new Set(["disable", "allow", "prefer"]);

/**
 * Valida a URL de conexão e a devolve na forma em que foi informada.
 *
 * Precisa ser **analisável**, ter protocolo `postgres:` ou `postgresql:`, host
 * presente e base nomeada. Caso contrário — e também quando a variável está
 * ausente ou vazia —, a recusa é `UrlDeConexaoInvalidaError`, cuja mensagem
 * nomeia `DB_URL` e nada do valor (FR-113, FR-114, SC-046).
 *
 * A validação acontece **antes de qualquer conexão**: sem URL utilizável a
 * nuvem não sobe, e a aplicação não segue como se o armazenamento existisse.
 */
export function validarUrlDeConexao(bruta: string | undefined): string {
  if (bruta === undefined || bruta.trim() === "") {
    throw new UrlDeConexaoInvalidaError(URL_NAO_INFORMADA);
  }

  const url = bruta.trim();

  let analisada: URL;

  try {
    analisada = new URL(url);
  } catch {
    /**
     * A mensagem do analisador do Node repete parte do valor informado: ela
     * nunca é propagada, nem para o registro de quem executou.
     */
    throw new UrlDeConexaoInvalidaError(URL_INVALIDA);
  }

  if (
    !PROTOCOLOS_ACEITOS.has(analisada.protocol) ||
    analisada.hostname === "" ||
    analisada.pathname.slice(1) === ""
  ) {
    throw new UrlDeConexaoInvalidaError(URL_INVALIDA);
  }

  const cifraPedida = analisada.searchParams.get("sslmode")?.toLowerCase();

  if (cifraPedida !== undefined && CIFRA_REBAIXADA_PEDIDA.has(cifraPedida)) {
    throw new UrlDeConexaoInvalidaError(CIFRA_REBAIXADA);
  }

  return url;
}

/**
 * Monta a configuração pronta do Adapter a partir dos dois valores que a
 * entrada da nuvem leu do ambiente: a URL de conexão e, opcionalmente, o
 * caminho de um PEM que entra como CA do conjunto de conexões.
 *
 * A leitura de ambiente acontece **apenas** na entrada, e termina nela: daqui
 * para baixo o Adapter recebe configuração pronta e não lê variável alguma
 * (FR-113).
 */
export function configuracaoDaConexao(
  urlBruta: string | undefined,
  caminhoDoCertificado?: string,
): ConfiguracaoDaConexao {
  const url = validarUrlDeConexao(urlBruta);

  if (caminhoDoCertificado === undefined || caminhoDoCertificado.trim() === "") {
    return { url };
  }

  try {
    return { url, ca: readFileSync(caminhoDoCertificado.trim(), "utf8") };
  } catch {
    /** Nem o caminho informado sai na recusa: só o nome da variável. */
    throw new UrlDeConexaoInvalidaError(CA_ILEGIVEL);
  }
}

/**
 * O SQLSTATE de uma falha do driver, quando ela traz um.
 *
 * É um código de cinco caracteres definido pelo padrão SQL, e **não** um valor
 * sensível: não carrega host, usuário, senha nem cadeia de conexão. É por isso
 * que ele é o único dado da falha do driver que a entrada pode imprimir, ao lado
 * da mensagem genérica em português (FR-118, SC-045).
 *
 * Falhas que não vêm do servidor — conexão recusada, certificado não
 * confirmado, por exemplo — trazem o código do próprio Node, que não é SQLSTATE:
 * nelas a entrada imprime apenas a mensagem genérica.
 */
export function codigoSqlState(erro: unknown): string | undefined {
  if (typeof erro !== "object" || erro === null) {
    return undefined;
  }

  const codigo = (erro as { code?: unknown }).code;

  return typeof codigo === "string" && /^[0-9A-Z]{5}$/.test(codigo)
    ? codigo
    : undefined;
}

/**
 * Máximo de conexões do conjunto: pequeno e **fixo** (4). O ajuste do conjunto
 * de conexões está adiado na spec, e a Interface da Porta não expõe configuração
 * de conexão — de modo que não há aqui nada a ajustar por ambiente.
 */
export const MAXIMO_DE_CONEXOES = 4;

/** Porta padrão do PostgreSQL, usada quando a URL não a informa. */
const PORTA_PADRAO = 5432;

/**
 * Traduz a URL de conexão nos parâmetros do conjunto de conexões. A URL chega
 * **já validada** pela entrada da nuvem: aqui ela é apenas traduzida em campos.
 *
 * A URL **não** é entregue ao driver como `connectionString`: o driver
 * reanalisaria a cadeia e a diretiva `sslmode` que ela trouxesse sobrescreveria
 * o objeto `ssl` — um caminho pelo qual a própria URL rebaixaria a verificação
 * do certificado, contra FR-115. Traduzida em campos, é o objeto `ssl` do
 * Adapter que manda sempre, e nenhuma diretiva de texto consegue desligar a
 * cifra nem a verificação.
 */
function parametrosDaUrl(url: string): PoolConfig {
  const analisada = new URL(url);
  const base = analisada.pathname.slice(1);

  return {
    host: decodeURIComponent(analisada.hostname),
    port: analisada.port === "" ? PORTA_PADRAO : Number(analisada.port),
    user: decodeURIComponent(analisada.username),
    password: decodeURIComponent(analisada.password),
    database: base === "" ? undefined : decodeURI(base),
  };
}

/**
 * Abre o conjunto de conexões do Adapter: máximo pequeno e fixo, e cifra ligada
 * com o certificado do servidor **sempre** verificado (FR-115).
 *
 * O conjunto recebe um ouvinte de `error` que **descarta o evento em silêncio**.
 * É o que faz a queda de uma conexão ociosa — encerrada pelo provedor de nuvem —
 * custar apenas uma conexão do conjunto: sem ouvinte, o Node trataria o evento
 * de erro do fluxo como exceção não capturada e derrubaria o processo; com
 * ouvinte, a conexão sai do conjunto e a próxima operação abre outra e conclui
 * (FR-119, SC-049). Não escrever nada é deliberado: a mensagem do driver de uma
 * conexão ociosa costuma carregar host, usuário e endereço da base, e nada
 * disso pode alcançar a saída nem o registro da aplicação (FR-118, SC-045).
 */
export function criarPiscina(configuracao: ConfiguracaoDaConexao): Pool {
  const piscina = new Pool({
    ...parametrosDaUrl(configuracao.url),
    max: MAXIMO_DE_CONEXOES,
    ssl: {
      rejectUnauthorized: true,
      ...(configuracao.ca === undefined ? {} : { ca: configuracao.ca }),
    },
  });

  piscina.on("error", () => {
    // Conexão ociosa encerrada pelo provedor: descartada em silêncio de
    // propósito. A próxima operação abre outra e conclui.
  });

  return piscina;
}
