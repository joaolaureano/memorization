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
