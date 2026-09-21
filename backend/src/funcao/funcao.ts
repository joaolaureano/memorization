import awsLambdaFastify from "@fastify/aws-lambda";

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
import {
  registrarRotaDeEntrada,
  registrarRotasDeBaralhos,
  registrarRotasDeCartoes,
  registrarRotasDeUsuarios,
} from "../http/rotas.ts";
import { criarServidor } from "../http/servidor.ts";
import { criarIdentidade } from "../identidade/identidade.ts";
import {
  segredoConfigurado,
  SegredoAusenteError,
  VARIAVEL_DO_SEGREDO,
} from "../identidade/segredo.ts";
import {
  FalhaNaLeituraDoCofreError,
  ParametroAusenteError,
  type LeitorDeSegredos,
} from "./segredos.ts";

/**
 * A Função da nuvem — a terceira raiz de composição, ao lado da local e da da
 * nuvem por linha de comando (FR-122).
 *
 * A aplicação é montada **uma vez por contêiner**: a promise de inicialização
 * vive fora do `handler`, e é reaproveitada nas invocações seguintes. O custo
 * do início a frio — uma chamada ao cofre e o aperto de mão TLS com o banco — é
 * pago uma vez, e não a cada requisição (SC-059).
 *
 * Uma inicialização que **falhou** não fica memorizada: a requisição que a
 * provocou recebe `503` com corpo genérico em português — o motivo não é
 * revelado —, a promise é descartada, e a requisição seguinte inicializa de
 * novo. Enquanto a causa durar, todas as requisições falham; corrigida a causa,
 * a requisição seguinte atende, sem que o contêiner precise ser reciclado
 * (FR-126, SC-054).
 *
 * A ordem do início é a do contrato: lê os três segredos do cofre → valida o
 * segredo das Senhas pela regra da `007` → valida a URL de conexão pela `010` →
 * confere a versão do esquema → abre o Adapter → monta o servidor **sem**
 * escutar. A função **nunca** migra: esquema atrasado é recusa de
 * inicialização, e quem migra é o operador, com o comando da nuvem (FR-127,
 * SC-055).
 *
 * Nada de sensível alcança a saída, o registro ou a resposta: nem a URL, nem a
 * senha, nem o segredo de origem, nem o segredo das Senhas. O que o registro
 * recebe, quando a inicialização é recusada, é a mensagem em português que
 * **nomeia o parâmetro** ou as duas versões do esquema — um nome e um número, e
 * nunca um valor (FR-123, FR-078, SC-052).
 */

/**
 * A resposta da função, no formato da Function URL (payload v2): o Adaptador do
 * evento a devolve, e é ela que a infraestrutura publica.
 */
export interface RespostaDaFuncao {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

/** O que o `handler` exportado é: o evento v2 entra, a resposta sai. */
export interface FuncaoDaNuvem {
  handler(evento: unknown, contexto?: unknown): Promise<RespostaDaFuncao>;
}

/**
 * O Adaptador do evento, na forma em que esta fábrica o usa. O tipo é declarado
 * aqui — e não importado da biblioteca — porque o que a fábrica promete é
 * exatamente esta assinatura, e nada do arcabouço de tipos dela.
 */
type AdaptadorDoEvento = (
  evento: unknown,
  contexto: unknown,
) => Promise<RespostaDaFuncao>;

/**
 * O que a fábrica recebe além do leitor: peças de composição, e **nenhuma
 * regra**.
 *
 * O prefixo é o do cofre, e entra apenas na linha de processo que reporta a
 * inicialização recusada — o nome do prefixo não é segredo, e é ele que situa
 * quem lê o registro. O caminho do certificado é o do CA privado do banco,
 * quando houver um: na nuvem a cadeia do provedor é **pública** e não há
 * arquivo a informar; nos testes é por aqui que o CA descartável do apoio de
 * teste da `010` entra, e nenhuma regra de conexão muda por causa disso.
 */
export interface OpcoesDaFuncao {
  /** O prefixo do cofre, usado só na linha de falha da inicialização. */
  prefixo?: string;
  /** O caminho do PEM que confirma o banco; ausente, vale a cadeia pública. */
  caminhoDoCertificado?: string;
}

/**
 * Recusa de inicialização com mensagem própria, montada aqui: ela nomeia as
 * duas versões do esquema ou repete a falha de acesso da `010` — sempre em
 * português, e nunca com valor de segredo (FR-123, FR-127).
 */
export class InicializacaoRecusadaError extends Error {}

/** A única linha de reporte da falha de inicialização. */
const FALHA_NA_INICIALIZACAO = "Falha na inicialização da função";

/**
 * A recusa da inicialização, na resposta: genérica, em português, e sem o
 * motivo. O que nomeia o parâmetro ou as versões fica no **registro** de
 * processo, e não na resposta (FR-126, SC-054).
 */
const INICIALIZACAO_INDISPONIVEL = {
  erro: "indisponivel",
  mensagem: "A aplicação não pôde ser inicializada. Tente novamente.",
} as const;

/**
 * Falha de acesso ao banco: genérica, em português, e sem nada do driver — nem
 * a URL, nem o usuário, nem a senha, nem o endereço (FR-118, FR-123).
 */
const FALHA_NO_ACESSO =
  "Falha no armazenamento da nuvem: não foi possível acessar a base.";

/** A resposta de falha de inicialização, com o status e o corpo únicos. */
function respostaDeInicializacaoFalha(): RespostaDaFuncao {
  return {
    statusCode: 503,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(INICIALIZACAO_INDISPONIVEL),
    isBase64Encoded: false,
  };
}

/**
 * A mensagem de uma falha de armazenamento: genérica, em português, mais o
 * SQLSTATE quando o driver trouxer um — um código, e não um valor (FR-118).
 */
function mensagemDaFalha(erro: unknown): string {
  const codigo = codigoSqlState(erro);

  return codigo === undefined
    ? FALHA_NO_ACESSO
    : `${FALHA_NO_ACESSO} (SQLSTATE ${codigo})`;
}

/**
 * Diz se a mensagem do erro pode ir para o registro. Só as recusas **nossas**
 * podem: as de `007` e `010`, a da Seam dos segredos e as desta fábrica nomeiam
 * um parâmetro, uma variável ou uma versão, e nunca um valor. Qualquer outra —
 * a falha crua do driver, por exemplo — vira frase genérica, porque o texto do
 * driver costuma carregar host, usuário e endereço (FR-118, FR-123).
 */
function mensagemRegistravel(erro: unknown): string {
  return erro instanceof ParametroAusenteError ||
    erro instanceof FalhaNaLeituraDoCofreError ||
    erro instanceof UrlDeConexaoInvalidaError ||
    erro instanceof SegredoAusenteError ||
    erro instanceof InicializacaoRecusadaError
    ? erro.message
    : "A causa não pôde ser detalhada sem revelar valor de segredo.";
}

/**
 * Confere se a base está na versão corrente do esquema, **sem migrar**: a
 * versão é lida por uma conexão curta, fechada em qualquer desfecho, e a lista
 * de migrações conhecida pelo binário é a fonte da verdade da versão corrente
 * (FR-127, SC-055). Uma base atrasada recusa a inicialização, e nenhuma
 * migração é aplicada.
 */
async function conferirVersaoDoEsquema(
  configuracao: ConfiguracaoDaConexao,
): Promise<void> {
  const piscina = criarPiscina(configuracao);

  try {
    const encontrada = await lerVersaoDoEsquema(piscina);
    const corrente = versaoCorrenteConhecida();

    if (encontrada !== corrente) {
      throw new InicializacaoRecusadaError(
        "Início recusado: o esquema da base está na versão " +
          `${encontrada} e a versão corrente é ${corrente}. ` +
          "Execute o comando de migração da nuvem antes de publicar.",
      );
    }
  } catch (erro) {
    throw erro instanceof InicializacaoRecusadaError
      ? erro
      : new InicializacaoRecusadaError(mensagemDaFalha(erro));
  } finally {
    await piscina.end();
  }
}

/** Abre o Adapter da nuvem; a falha vira recusa de inicialização sem valor algum. */
async function abrirArmazenamentoDaNuvem(
  configuracao: ConfiguracaoDaConexao,
): Promise<ArmazenamentoPostgresqlAberto> {
  try {
    return await abrirArmazenamentoPostgresql(configuracao);
  } catch (erro) {
    throw new InicializacaoRecusadaError(mensagemDaFalha(erro));
  }
}

/**
 * Cria a Função da nuvem sobre o leitor de segredos informado — o Adapter de
 * SSM em produção, o de memória nos testes.
 *
 * A fábrica devolve o `handler` no formato da Function URL (payload v2), e é
 * ela que decide **quando** montar: na primeira invocação do contêiner, e nunca
 * no carregamento do módulo, para que um erro de configuração saia como
 * resposta HTTP controlada — e não como falha de importação, sem nova
 * tentativa.
 */
export function criarFuncao(
  leitor: LeitorDeSegredos,
  opcoes: OpcoesDaFuncao = {},
): FuncaoDaNuvem {
  /**
   * A promise de inicialização vive **fora** do `handler`: o contêiner morno
   * reaproveita a aplicação já montada, e duas invocações concorrentes
   * compartilham a **mesma** promise (FR-122, SC-054).
   */
  let pronta: Promise<AdaptadorDoEvento> | undefined;

  /**
   * Monta a aplicação: os segredos descem prontos — a URL validada pela `010`,
   * o segredo das Senhas validado pela regra da `007` e o segredo de origem
   * para a guarda de borda —, o esquema é conferido **sem migrar**, o Adapter é
   * aberto e o servidor é montado **sem `listen`** e com a política permissiva
   * de outra origem desligada (FR-122, FR-127, FR-128).
   */
  async function montar(): Promise<AdaptadorDoEvento> {
    const segredos = await leitor.ler();

    const segredoDasSenhas = segredoConfigurado({
      [VARIAVEL_DO_SEGREDO]: segredos.segredoDasSenhas,
    });

    const configuracao = configuracaoDaConexao(
      segredos.urlDeConexao,
      opcoes.caminhoDoCertificado,
    );

    await conferirVersaoDoEsquema(configuracao);

    const aberto = await abrirArmazenamentoDaNuvem(configuracao);
    const identidade = criarIdentidade(aberto.usuarios, segredoDasSenhas);

    const servidor = criarServidor(identidade, {
      segredoDeOrigem: segredos.segredoDeOrigem,
      politicaDeOutraOrigem: false,
    });

    const acervoDe = (usuarioId: string) =>
      criarAcervo(aberto.armazenamento, usuarioId);

    registrarRotasDeCartoes(servidor, acervoDe);
    registrarRotasDeBaralhos(servidor, acervoDe);
    registrarRotasDeUsuarios(servidor, identidade);
    registrarRotaDeEntrada(servidor);

    /**
     * O Adaptador do evento é criado **antes** do `ready()`: ele decora a
     * requisição, e o Fastify não aceita decoração depois de pronto. Nenhum
     * porto é aberto em momento algum: o `inject` do Fastify é o caminho da
     * invocação, e `listen` não aparece em nenhum caminho desta fábrica
     * (FR-122).
     */
    const adaptador = awsLambdaFastify(servidor) as unknown as AdaptadorDoEvento;

    await servidor.ready();

    return adaptador;
  }

  /**
   * A inicialização memorizada **e descartável**: a promise é guardada, e
   * **descartada na falha**, de modo que a requisição seguinte inicialize de
   * novo, sem herdar o resultado falho (FR-126, SC-054).
   */
  function inicializar(): Promise<AdaptadorDoEvento> {
    pronta ??= montar().catch((erro: unknown) => {
      pronta = undefined;

      throw erro;
    });

    return pronta;
  }

  return {
    async handler(evento, contexto) {
      let adaptador: AdaptadorDoEvento;

      try {
        adaptador = await inicializar();
      } catch (erro) {
        /**
         * O motivo vai para o registro — nomeando o parâmetro ou as versões, e
         * nunca um valor —, e a resposta é genérica: ela não revela se faltou
         * um parâmetro, se o banco não respondeu ou se o esquema está atrasado
         * (FR-123, FR-126).
         */
        const cofre =
          opcoes.prefixo === undefined ? "" : ` (cofre ${opcoes.prefixo})`;

        console.error(
          `${FALHA_NA_INICIALIZACAO}${cofre}: ${mensagemRegistravel(erro)}`,
        );

        return respostaDeInicializacaoFalha();
      }

      return await adaptador(evento, contexto);
    },
  };
}
