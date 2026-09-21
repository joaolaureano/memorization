import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import type { AddressInfo } from "node:net";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import EmbeddedPostgres from "embedded-postgres";
import { Client, type ClientConfig } from "pg";

/**
 * Apoio de teste do Adapter de PostgreSQL: um PostgreSQL **real** na máquina de
 * desenvolvimento, **sem Docker**, **sem contêiner** e **sem instalação
 * manual** (FR-111, SC-044).
 *
 * O binário vem da devDependency `embedded-postgres`; o servidor sobe numa porta
 * livre do loopback, com diretório de dados temporário, senha **gerada a cada
 * execução** e TLS **ligado**: um CA e um certificado de servidor descartáveis
 * são gerados em tempo de execução pelo `openssl` da máquina, e as conexões
 * verificam o certificado contra esse CA — exatamente o que o Adapter oferece
 * para o CA opcional da entrada da nuvem (`DB_CA_CERT`). Nenhum segredo é
 * versionado: senha, chave privada e CA nascem e morrem a cada execução.
 *
 * **Nada é pulado em silêncio**: se o `openssl` não estiver disponível ou o
 * binário do PostgreSQL não rodar nesta plataforma, o apoio falha alto, com
 * mensagem clara, e a suíte fica vermelha — uma suíte que se pula sozinha
 * aprova o que não verificou (Princípio VI).
 *
 * O servidor é iniciado **uma vez por arquivo de teste**, na primeira chamada de
 * `servidorDeTeste()`, que os arquivos fazem no `beforeAll` com prazo folgado: o
 * processo de teste é o dono do próprio servidor, e nada de banco entra na
 * configuração do Vitest. `iniciarServidorDeTeste()` continua disponível para um
 * teste que precise de um servidor **próprio**: é assim que a indisponibilidade
 * do armazenamento é exercitada, parando um servidor de verdade.
 */

/** Usuário da base de teste; o nome do usuário não é segredo. */
const USUARIO = "postgres";

/** A base padrão do servidor, usada pela conexão administrativa. */
const BASE_ADMINISTRATIVA = "postgres";

/** Host do servidor de teste: o loopback, como o da aplicação. */
const HOST = "127.0.0.1";

/** Nome da autoridade certificadora descartável — sem valor de credencial. */
const NOME_DA_AUTORIDADE = "memorizacao-de-teste";

/** Seção do arquivo de extensões de onde saem as extensões do certificado. */
const SECAO_DAS_EXTENSOES = "extensoes_do_servidor";

/**
 * Extensões do certificado do servidor: o nome alternativo cobre `localhost` e
 * o endereço de loopback, que é por onde as conexões de teste chegam, e o uso é
 * de servidor. É o mínimo para que a verificação do certificado valha de
 * verdade, e não haja caminho que a dispense.
 */
const CONFIGURACAO_DAS_EXTENSOES = `
[ ${SECAO_DAS_EXTENSOES} ]
subjectAltName = DNS:localhost, IP:${HOST}
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
`;

/** Tempo limite para subir e parar o servidor de teste, em milissegundos. */
const TEMPO_LIMITE_DO_SERVIDOR = 120_000;

/** Quantas linhas do diário do servidor acompanham uma falha ao subir. */
const LINHAS_DO_DIARIO_NA_FALHA = 20;

/**
 * A configuração que os testes usam para falar com o PostgreSQL de teste. Ela
 * não tem valor algum versionado: a senha e o CA são gerados a cada execução.
 */
export interface ServidorDeTeste {
  host: string;
  porta: number;
  usuario: string;
  senha: string;
  /** O CA em PEM que confirma o certificado do servidor de teste. */
  certificadoDaAutoridade: string;
}

/**
 * O que o apoio oferece sobre um servidor: bases novas, consultas
 * administrativas e o encerramento das conexões dele — a operação com que a
 * queda de conexão ociosa é exercitada.
 */
export interface FerramentasDoServidor {
  readonly configuracao: ServidorDeTeste;
  /** Cria uma base nova e vazia, com nome exclusivo, e devolve o nome dela. */
  criarBase(titulo: string): Promise<string>;
  /** Descarta a base informada, derrubando antes as conexões dela. */
  descartarBase(nomeDaBase: string): Promise<void>;
  /** Descarta todas as bases que esta execução criou e ainda não descartou. */
  descartarBases(): Promise<void>;
  /** A URL de conexão da base informada, sem CA: o CA é da configuração. */
  urlDaBase(nomeDaBase: string): string;
  /** Executa uma consulta na base informada, com uma conexão curta e cifrada. */
  consultar<Linha>(
    nomeDaBase: string,
    sql: string,
    valores?: unknown[],
  ): Promise<Linha[]>;
  /** Encerra as conexões da base pelo servidor; devolve quantas encerrou. */
  encerrarConexoes(nomeDaBase: string): Promise<number>;
}

/** Um servidor de teste iniciado por este arquivo, com o seu encerramento. */
export type ServidorAutonomo = FerramentasDoServidor & {
  encerrar(): Promise<void>;
};

/** Contador de bases criadas, para que dois cenários nunca partilhem o nome. */
let basesCriadas = 0;

/**
 * A senha do servidor de teste, **gerada a cada execução** e nunca versionada.
 * O alfabeto de `base64url` não precisa de escape na URL de conexão, de modo que
 * a senha entra na URL exatamente como saiu daqui.
 */
function senhaGeradaPorExecucao(): string {
  return randomBytes(24).toString("base64url");
}

/** O motivo de uma falha, para a mensagem de erro — e nunca um valor de segredo. */
function motivoDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

/** Executa o `openssl` da máquina, com a saída capturada. */
function executarOpenssl(argumentos: string[]): void {
  execFileSync("openssl", argumentos, { stdio: "pipe", encoding: "utf8" });
}

/**
 * Gera, em tempo de execução, um CA descartável e um certificado de servidor
 * assinado por ele. Nada é versionado: tudo nasce no diretório temporário e
 * morre com o servidor. Sem `openssl` na máquina, a falha é alta e nomeia o
 * comando que faltou.
 */
function gerarCertificados(raiz: string): {
  certificadoDaAutoridade: string;
  arquivoDoCertificado: string;
  arquivoDaChave: string;
} {
  const pasta = join(raiz, "certificados");

  mkdirSync(pasta, { recursive: true });

  const arquivoDaAutoridade = join(pasta, "autoridade.crt");
  const chaveDaAutoridade = join(pasta, "autoridade.key");
  const arquivoDoPedido = join(pasta, "servidor.csr");
  const arquivoDoCertificado = join(pasta, "servidor.crt");
  const arquivoDaChave = join(pasta, "servidor.key");
  const arquivoDeConfiguracao = join(pasta, "extensoes.cnf");

  writeFileSync(arquivoDeConfiguracao, CONFIGURACAO_DAS_EXTENSOES);

  try {
    executarOpenssl([
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      chaveDaAutoridade,
      "-out",
      arquivoDaAutoridade,
      "-days",
      "1",
      "-subj",
      `/CN=${NOME_DA_AUTORIDADE}`,
    ]);
    executarOpenssl([
      "req",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      arquivoDaChave,
      "-out",
      arquivoDoPedido,
      "-subj",
      `/CN=localhost`,
    ]);
    executarOpenssl([
      "x509",
      "-req",
      "-in",
      arquivoDoPedido,
      "-CA",
      arquivoDaAutoridade,
      "-CAkey",
      chaveDaAutoridade,
      "-CAcreateserial",
      "-out",
      arquivoDoCertificado,
      "-days",
      "1",
      "-extfile",
      arquivoDeConfiguracao,
      "-extensions",
      SECAO_DAS_EXTENSOES,
    ]);
  } catch (erro) {
    throw new Error(
      "Não foi possível gerar o CA e o certificado do servidor de teste com o " +
        "`openssl`. O comando precisa estar disponível no PATH para os testes do " +
        `Adapter de PostgreSQL rodarem. Motivo: ${motivoDe(erro)}`,
    );
  }

  /**
   * O PostgreSQL recusa chave privada legível por grupo ou por outros; o
   * `openssl` a cria com a máscara padrão do sistema.
   */
  chmodSync(arquivoDaChave, 0o600);

  return {
    certificadoDaAutoridade: readFileSync(arquivoDaAutoridade, "utf8"),
    arquivoDoCertificado,
    arquivoDaChave,
  };
}

/** Devolve uma porta livre do loopback, escolhida pelo sistema operacional. */
async function portaLivre(): Promise<number> {
  return await new Promise((resolver, recusar) => {
    const sondagem = createServer();

    sondagem.once("error", recusar);
    sondagem.listen(0, HOST, () => {
      const endereco = sondagem.address();

      if (endereco === null || typeof endereco === "string") {
        recusar(new Error("não foi possível determinar a porta livre"));
        return;
      }

      sondagem.close(() => resolver((endereco as AddressInfo).port));
    });
  });
}

/** Aguarda a promessa, com prazo: o apoio nunca espera para sempre. */
async function dentroDoPrazo<T>(
  promessa: Promise<T>,
  acao: string,
): Promise<T> {
  let relogio: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promessa,
      new Promise<never>((_, recusar) => {
        relogio = setTimeout(() => {
          recusar(
            new Error(
              `o tempo limite de ${TEMPO_LIMITE_DO_SERVIDOR}ms para ${acao} o ` +
                `PostgreSQL de teste esgotou`,
            ),
          );
        }, TEMPO_LIMITE_DO_SERVIDOR);
      }),
    ]);
  } finally {
    clearTimeout(relogio);
  }
}

/** Para o servidor, sem propagar falha de quem já estava parado. */
async function parar(servidor: EmbeddedPostgres): Promise<void> {
  try {
    await servidor.stop();
  } catch {
    // O servidor já estava parado: não há o que encerrar.
  }
}

/** Parâmetros de uma conexão de teste curta, com o certificado verificado. */
function parametrosDaConexao(
  configuracao: ServidorDeTeste,
  base: string,
): ClientConfig {
  return {
    host: configuracao.host,
    port: configuracao.porta,
    user: configuracao.usuario,
    password: configuracao.senha,
    database: base,
    /** TLS de verdade: o certificado do servidor é verificado contra o CA. */
    ssl: { rejectUnauthorized: true, ca: configuracao.certificadoDaAutoridade },
  };
}

/** Executa o corpo com uma conexão curta à base informada, encerrando-a ao fim. */
async function comConexao<T>(
  configuracao: ServidorDeTeste,
  base: string,
  corpo: (cliente: Client) => Promise<T>,
): Promise<T> {
  const cliente = new Client(parametrosDaConexao(configuracao, base));

  await cliente.connect();

  try {
    return await corpo(cliente);
  } finally {
    await cliente.end();
  }
}

/** SQLSTATE de objeto em uso: a base ainda tem conexões ativas. */
const BASE_EM_USO = "55006";

/** Diz se a falha é a base ainda em uso por outras conexões. */
function ehBaseEmUso(erro: unknown): boolean {
  return (
    typeof erro === "object" &&
    erro !== null &&
    (erro as { code?: unknown }).code === BASE_EM_USO
  );
}

/**
 * Descarta a base informada. O caminho comum é o `DROP` simples, que é rápido
 * quando ninguém está conectado; se ainda houver conexões — um cenário que não
 * encerrou o armazenamento, por exemplo —, elas são derrubadas e o `DROP` é
 * repetido com `FORCE`.
 */
async function descartarBase(
  configuracao: ServidorDeTeste,
  bases: Set<string>,
  nomeDaBase: string,
): Promise<void> {
  await comConexao(configuracao, BASE_ADMINISTRATIVA, async (cliente) => {
    try {
      await cliente.query(`DROP DATABASE IF EXISTS "${nomeDaBase}";`);
    } catch (erro) {
      if (!ehBaseEmUso(erro)) {
        throw erro;
      }

      await cliente.query(
        `DROP DATABASE IF EXISTS "${nomeDaBase}" WITH (FORCE);`,
      );
    }
  });

  bases.delete(nomeDaBase);
}

/** O nome de base derivado do título informado, seguro para o SQL. */
function nomeDeBase(titulo: string): string {
  basesCriadas += 1;

  const limpo = titulo.toLowerCase().replace(/[^a-z0-9_]/g, "_");

  return `${limpo}_${basesCriadas}_${randomBytes(3).toString("hex")}`;
}

/**
 * As operações sobre um servidor já iniciado. Elas só dependem da configuração,
 * de modo que valem tanto para o servidor da suíte quanto para um servidor
 * próprio de um teste.
 */
function ferramentas(configuracao: ServidorDeTeste): FerramentasDoServidor {
  /** As bases criadas neste servidor e ainda não descartadas. */
  const bases = new Set<string>();

  return {
    configuracao,

    async criarBase(titulo) {
      const nome = nomeDeBase(titulo);

      await comConexao(configuracao, BASE_ADMINISTRATIVA, async (cliente) => {
        await cliente.query(`CREATE DATABASE "${nome}";`);
      });

      bases.add(nome);

      return nome;
    },

    async descartarBase(nomeDaBase) {
      await descartarBase(configuracao, bases, nomeDaBase);
    },

    async descartarBases() {
      for (const nome of [...bases].reverse()) {
        await descartarBase(configuracao, bases, nome);
      }
    },

    urlDaBase(nomeDaBase) {
      const { host, porta, usuario, senha } = configuracao;

      return `postgresql://${usuario}:${senha}@${host}:${porta}/${nomeDaBase}?sslmode=verify-full`;
    },

    async consultar<Linha>(
      nomeDaBase: string,
      sql: string,
      valores: unknown[] = [],
    ): Promise<Linha[]> {
      return await comConexao(configuracao, nomeDaBase, async (cliente) => {
        const { rows } = await cliente.query(sql, valores);

        return rows as Linha[];
      });
    },

    async encerrarConexoes(nomeDaBase) {
      return await comConexao(
        configuracao,
        BASE_ADMINISTRATIVA,
        async (cliente) => {
          /** É assim que o provedor de nuvem encerra uma conexão ociosa. */
          const { rows } = await cliente.query(
            `SELECT pg_terminate_backend(pid) AS encerrada
               FROM pg_stat_activity
              WHERE datname = $1
                AND pid <> pg_backend_pid();`,
            [nomeDaBase],
          );

          return rows.length;
        },
      );
    },
  };
}

/**
 * Sobe um PostgreSQL real, cifrado, com senha e certificados gerados agora, e
 * devolve as ferramentas para usá-lo. O servidor é encerrado por `encerrar()`,
 * que também apaga o diretório temporário — chamá-lo duas vezes não falha.
 */
export async function iniciarServidorDeTeste(): Promise<ServidorAutonomo> {
  const raiz = mkdtempSync(join(tmpdir(), "postgresql-de-teste-"));
  const certificados = gerarCertificados(raiz);
  const porta = await portaLivre();
  const senha = senhaGeradaPorExecucao();

  const configuracao: ServidorDeTeste = {
    host: HOST,
    porta,
    usuario: USUARIO,
    senha,
    certificadoDaAutoridade: certificados.certificadoDaAutoridade,
  };

  /** Diário do servidor: só as últimas linhas, e só para o caso de falha. */
  const diario: string[] = [];
  const anotar = (mensagem: unknown): void => {
    diario.push(String(mensagem));

    if (diario.length > LINHAS_DO_DIARIO_NA_FALHA) {
      diario.shift();
    }
  };

  const servidor = new EmbeddedPostgres({
    databaseDir: join(raiz, "dados"),
    port: porta,
    user: USUARIO,
    password: senha,
    /** O diretório de dados é descartável: some com o servidor. */
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    /** TLS ligado com o certificado e a chave gerados acima. */
    postgresFlags: [
      "-c",
      "ssl=on",
      "-c",
      `ssl_cert_file=${certificados.arquivoDoCertificado}`,
      "-c",
      `ssl_key_file=${certificados.arquivoDaChave}`,
    ],
    /** Silêncio: nada do servidor de teste vai para a saída da suíte. */
    onLog: anotar,
    onError: anotar,
  });

  try {
    await dentroDoPrazo(servidor.initialise(), "inicializar");
    await dentroDoPrazo(servidor.start(), "iniciar");
  } catch (erro) {
    await parar(servidor);
    rmSync(raiz, { recursive: true, force: true });

    throw new Error(
      "Não foi possível subir o PostgreSQL real dos testes (binário da " +
        `devDependency \`embedded-postgres\`). Motivo: ${motivoDe(erro)}` +
        (diario.length === 0 ? "" : `\n${diario.join("")}`),
    );
  }

  let encerrado = false;

  return {
    ...ferramentas(configuracao),

    async encerrar() {
      if (encerrado) {
        return;
      }

      encerrado = true;

      await parar(servidor);
      rmSync(raiz, { recursive: true, force: true });
    },
  };
}

/**
 * O servidor de teste do processo de teste: subido na primeira chamada e
 * partilhado por todos os cenários do arquivo. O `beforeAll` de cada arquivo o
 * pede com prazo folgado — subir um PostgreSQL real leva alguns segundos —, e o
 * `afterAll` o encerra com `encerrar()`, que também apaga o diretório
 * temporário. Chamá-lo duas vezes não falha.
 */
let servidorDoProcesso: Promise<ServidorAutonomo> | undefined;

export async function servidorDeTeste(): Promise<ServidorAutonomo> {
  servidorDoProcesso ??= iniciarServidorDeTeste();

  return await servidorDoProcesso;
}
