import type { AddressInfo } from "node:net";

import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyRequest,
} from "fastify";

import { criarAcessos, validadeConfigurada } from "../acesso/acesso.ts";
import type { Acessos } from "../acesso/acesso.ts";
import type { ArmazenamentoDeAcessos } from "../armazenamento/porta.ts";
import type { Identidade } from "../identidade/identidade.ts";
import { exigirCredencial } from "./credencial.ts";
import { exigirSegredoDeOrigem } from "./origem.ts";
import {
  CORPO_INVALIDO,
  registrarRotaDeEntrada,
  registrarRotasDeAcesso,
  registrarRotasDeBaralhos,
  registrarRotasDeAgenda,
  registrarRotasDeCartoes,
  registrarRotasDeConta,
  registrarRotasDePreferencias,
  registrarRotasDeRevisao,
  registrarRotasDeSessoes,
  registrarRotasDeUsuarios,
  type AcervoDeUsuario,
} from "./rotas.ts";

/**
 * Servidor HTTP local.
 *
 * A Credencial é exigida em toda rota, exceto o Cadastro, a prova de vida e o
 * pré-voo de CORS (FR-090). O transporte continua sendo local, e é por isso que
 * a única configuração segura segue sendo escutar exclusivamente no loopback
 * (127.0.0.1). A constante abaixo expressa essa intenção;
 * `assegurarEscutaLocal` a impõe em runtime, verificando o endereço efetivamente
 * vinculado após o `listen`.
 */
export const HOST_LOCAL = "127.0.0.1";

/**
 * Caminho das rotas de Cartão (contrato `api-cartoes.md`). Usado pelo CORS
 * mínimo: o frontend de navegador consome essas rotas de outra origem.
 */
export const CAMINHO_DOS_CARTOES = "/cartoes";

/**
 * Caminho das rotas de Baralho (contrato `api-baralhos.md`). Passa a receber
 * o mesmo tratamento de CORS das rotas de Cartão.
 */
export const CAMINHO_DOS_BARALHOS = "/baralhos";

/**
 * Caminho da rota de Usuário (contrato `api-usuarios.md`). Recebe o mesmo
 * tratamento de CORS mínimo das demais rotas.
 */
export const CAMINHO_DOS_USUARIOS = "/usuarios";

/**
 * Caminho da rota de Entrar (contrato `api-entrar.md`). Recebe o mesmo
 * tratamento de CORS mínimo das demais rotas, e o pré-voo dela passa a pedir
 * `authorization` entre os cabeçalhos permitidos.
 */
export const CAMINHO_DE_ENTRAR = "/entrar";

/**
 * Caminho das rotas de Sessão (contrato da `013`). Recebe o mesmo tratamento
 * de CORS mínimo das demais, porque o Início e o Resumo são consumidos do
 * navegador, em outra origem.
 */
export const CAMINHO_DAS_SESSOES = "/sessoes";

/**
 * Caminho da rota de Estatísticas (contrato da `013`), com o mesmo CORS.
 */
export const CAMINHO_DAS_ESTATISTICAS = "/estatisticas";

/**
 * Caminho da rota de Prévias (contrato da `015`, §4), com o mesmo CORS.
 */
export const CAMINHO_DAS_PREVIAS = "/previas";

/**
 * Caminho das rotas de Preferências (contrato da `015`, §4), com o mesmo CORS.
 */
export const CAMINHO_DAS_PREFERENCIAS = "/preferencias";

/**
 * Caminho das rotas de conta do Usuário (contrato da `017`): `GET` e `DELETE`
 * em `/conta`, mais a troca de Senha em `/conta/senha`, com o mesmo CORS. A
 * alteração do Nome de usuário (`PUT /conta/nome-de-usuario`) saiu do contrato
 * (020): o pré-voo dela **não** é registrado.
 */
export const CAMINHO_DA_CONTA = "/conta";

/**
 * Caminhos da Agenda de estudo (`016`): `GET /agenda`, `GET`/`POST
 * /agenda/rotinas` e `POST /agenda/inicios`, com o mesmo CORS.
 */
export const CAMINHO_DA_AGENDA = "/agenda";
export const CAMINHO_DAS_ROTINAS = "/agenda/rotinas";
export const CAMINHO_DOS_INICIOS = "/agenda/inicios";

/**
 * Caminhos das rotas do Acesso temporário (018), com o mesmo CORS — agora
 * **com credenciais**, porque o navegador envia e recebe o cookie do Acesso.
 */
export const CAMINHO_DO_ACESSO = "/acesso";
export const CAMINHO_DA_RENOVACAO_DO_ACESSO = "/acesso/renovar";
export const CAMINHO_DE_SAIR = "/sair";

/**
 * A origem do frontend no ambiente local (018, §4): com `credentials: include` o
 * navegador **recusa** `Access-Control-Allow-Origin: *`, e por isso a política
 * de outra origem passa a nomear a origem exata. O padrão é a do `npm run dev`;
 * `ORIGEM_DO_FRONTEND` a substitui.
 */
export const ORIGEM_PADRAO_DO_FRONTEND = "http://127.0.0.1:5173";

/**
 * Erro lançado quando o servidor está escutando fora do loopback.
 *
 * A Credencial protege o acervo, e nunca o transporte; escutar fora do loopback
 * exporia o serviço à rede, e qualquer desvio deve abortar a inicialização.
 */
export class EscutaInseguraError extends Error {}

/**
 * Erro lançado quando `PORTA` está presente, mas não é uma porta TCP válida.
 *
 * A variável precisa ser um número inteiro entre 1 e 65535, sem sinais,
 * espaços ou casas decimais; qualquer outro valor deve abortar a inicialização
 * com uma mensagem clara, em vez de deixar o Fastify falhar com erro obscuro.
 */
export class PortaInvalidaError extends Error {}

export function portaConfigurada(env: NodeJS.ProcessEnv = process.env): number {
  const bruto = env.PORTA;

  if (bruto === undefined) {
    return 3001;
  }

  const porta = bruto.trim();
  const numero = Number(porta);

  if (
    !/^[0-9]+$/.test(porta) ||
    !Number.isInteger(numero) ||
    numero < 1 ||
    numero > 65535
  ) {
    throw new PortaInvalidaError(
      `PORTA inválida: ${JSON.stringify(bruto)}. Informe um número inteiro entre 1 e 65535.`,
    );
  }

  return numero;
}

export function opcoesDeEscuta(env: NodeJS.ProcessEnv = process.env): {
  host: string;
  port: number;
} {
  return { host: HOST_LOCAL, port: portaConfigurada(env) };
}

/**
 * Registra o pré-voo de CORS para um caminho. O conjunto de métodos cobre as
 * operações de leitura e escrita do Acervo; os cabeçalhos permitidos são
 * `content-type`, exigido pelos `fetch` de JSON, e `authorization`, **exigido
 * pela Credencial** que agora acompanha toda requisição: sem ele o navegador
 * recusa o pré-voo dos `fetch` que carregam o cabeçalho (FR-090).
 */
function permitirPreVoo(
  servidor: FastifyInstance,
  caminho: string,
  origemDa: (requisicao: FastifyRequest) => string,
): void {
  servidor.options(caminho, async (requisicao, resposta) => {
    resposta
      .header("access-control-allow-origin", origemDa(requisicao))
      .header("access-control-allow-credentials", "true")
      .header("vary", "origin")
      .header("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS")
      .header("access-control-allow-headers", "content-type, authorization")
      .header("access-control-max-age", "86400");

    return resposta.code(204).send();
  });
}

/**
 * As duas questões de borda da construção de servidor, ambas opcionais: a
 * guarda do segredo de origem, que só a Função da nuvem registra, e a política
 * permissiva de outra origem, que vale apenas onde a aplicação escuta no
 * loopback. Nenhuma delas cria um segundo servidor: as rotas, os hooks e o
 * tratamento de erro são **os mesmos** em qualquer combinação (FR-125, FR-128).
 */
export interface OpcoesDoServidor {
  /**
   * O segredo que só o CloudFront injeta. Informado, a guarda de origem é o
   * **primeiro** `onRequest` da aplicação, e toda requisição sem ele é recusada
   * com `403` antes de qualquer trabalho de Credencial; ausente, não há guarda,
   * que é o caso de todas as execuções que escutam no loopback.
   */
  segredoDeOrigem?: string;
  /**
   * A política permissiva de outra origem — pré-voo e
   * `access-control-allow-origin` —, **ligada** por padrão. A execução local a
   * mantém, porque escuta exclusivamente no loopback; a Função da nuvem a
   * desliga, porque SPA e API dividem a origem do CloudFront (FR-128).
   */
  politicaDeOutraOrigem?: boolean;
  /**
   * Os Acessos temporários (018). Informados, o hook de Credencial aceita o
   * Acesso do cookie **ou** a Credencial Basic; ausentes — como nos servidores
   * de teste mínimos —, só a Credencial Basic vale.
   */
  acessos?: Acessos;
  /**
   * A origem exata do frontend, que a política de outra origem concede com
   * credenciais (§4). Padrão: `ORIGEM_PADRAO_DO_FRONTEND`.
   */
  origemDoFrontend?: string;
  /**
   * Só para os testes de navegador: aceita como origem qualquer porta do
   * loopback — o frontend do teste sobe depois da API, numa porta livre, e a
   * origem exata não existe quando a API é iniciada. A API local escuta apenas
   * em 127.0.0.1, e o padrão é desligado.
   */
  qualquerOrigemLocal?: boolean;
}

/**
 * O servidor da aplicação, com as guardas e as respostas comuns.
 *
 * O `Identidade` entra pela construção porque é ele quem verifica a Credencial:
 * **não há como montar um servidor sem credencial**, e é por isso que nenhuma
 * rota nasce desprotegida (FR-090). As rotas são registradas sobre o servidor
 * já com o hook, e nenhuma delas repete a verificação. As opções de borda
 * chegam pelo segundo parâmetro — a guarda de origem, quando houver, primeiro —
 * e quem monta um servidor sem elas obtém exatamente o servidor de hoje.
 */
export function criarServidor(
  identidade: Identidade,
  opcoes: OpcoesDoServidor = {},
): FastifyInstance {
  const servidor = Fastify();

  /**
   * A guarda do segredo de origem é o **primeiro** hook: a requisição que não
   * veio do CloudFront não chega ao trabalho de verificar Senha (FR-125).
   */
  if (opcoes.segredoDeOrigem !== undefined) {
    exigirSegredoDeOrigem(servidor, opcoes.segredoDeOrigem);
  }

  /**
   * O ponto único da verificação, registrado **antes** das rotas: daqui em
   * diante toda rota exige Credencial válida, menos as três isentas do
   * contrato.
   */
  exigirCredencial(servidor, identidade, opcoes.acessos);

  servidor.get("/health", async () => ({ status: "ok" }));

  /**
   * Corpo malformado (JSON inválido sob content-type de JSON) é recusado pelo
   * parser do Fastify antes de qualquer handler, com resposta padrão em
   * inglês. Este handler converte apenas esses erros de forma — os de prefixo
   * `FST_ERR_CTP`, todos de status 400 — na mesma recusa uniforme das rotas,
   * mantendo a interface em português (FR-046). Qualquer outro erro segue o
   * caminho padrão do Fastify, que é exatamente `resposta.send(erro)`.
   */
  servidor.setErrorHandler<FastifyError>((erro, _requisicao, resposta) => {
    if (erro.statusCode === 400 && erro.code.startsWith("FST_ERR_CTP")) {
      return resposta.status(400).send(CORPO_INVALIDO);
    }

    return resposta.send(erro);
  });

  /**
   * CORS mínimo para o frontend local (T014; specs/001-criar-cartao/tasks.md).
   *
   * O frontend real roda em outra porta do mesmo loopback, e o navegador
   * trata a diferença de porta como outra origem: sem estes cabeçalhos, o
   * `fetch` do navegador recusa o pré-voo dos `POST`, `PUT` e `DELETE` — o
   * content-type application/json torna as requisições com corpo não simples —
   * e impede a leitura das respostas. Os caminhos parametrizados de edição,
   * exclusão e Vínculo recebem o mesmo tratamento das rotas de coleção, e
   * `/usuarios` e `/entrar` entram na mesma lista com os mesmos métodos e
   * cabeçalhos, agora incluindo `authorization`. As rotas de Histórico —
   * `/sessoes`, `/sessoes/:id` e `/estatisticas` —, que o Início consome do
   * navegador em outra origem, recebem o mesmo tratamento. Como a aplicação
   * escuta
   * exclusivamente em 127.0.0.1, permitir qualquer origem é a configuração
   * mínima segura — o serviço não é alcançável pela rede.
   *
   * Toda rota nova do contrato precisa entrar **também** nesta lista, além de
   * ser registrada em `registrarRotasDaAplicacao`: registrar a rota sem
   * acrescentá-la aqui a deixa sem pré-voo e sem cabeçalho permissivo, e o
   * navegador recusa a chamada de outra origem — foi assim que `GET /revisao`
   * respondia `404` ao pré-voo e deixava a Revisão sem CORS. O teste-guarda de
   * `cors.test.ts` percorre as rotas registradas para que esse esquecimento
   * falhe.
   *
   * Com `politicaDeOutraOrigem` desligada, nem o pré-voo nem o `onSend` são
   * registrados: em produção, com SPA e API na mesma origem do CloudFront, a
   * resposta da função simplesmente **não tem** cabeçalho permissivo — a
   * ausência é por construção, e não limpeza posterior (FR-128, SC-056).
   */
  if (opcoes.politicaDeOutraOrigem ?? true) {
    const origemConfigurada =
      opcoes.origemDoFrontend ?? ORIGEM_PADRAO_DO_FRONTEND;

    /**
     * A origem concedida: a configurada — e, só quando `qualquerOrigemLocal`,
     * a de qualquer porta do loopback que a requisição declarar. Nunca `*`:
     * com credenciais ele é inválido (§4).
     */
    const origemDa = (requisicao: FastifyRequest): string => {
      const declarada = requisicao.headers.origin;

      return opcoes.qualquerOrigemLocal === true &&
        typeof declarada === "string" &&
        /^http:\/\/(127\.0\.0\.1|localhost):[0-9]+$/.test(declarada)
        ? declarada
        : origemConfigurada;
    };

    for (const caminho of [
      CAMINHO_DOS_CARTOES,
      "/cartoes/:id",
      CAMINHO_DOS_BARALHOS,
      "/baralhos/:id",
      "/baralhos/:baralhoId/vinculos",
      "/baralhos/:baralhoId/vinculos/:cartaoId",
      CAMINHO_DOS_USUARIOS,
      CAMINHO_DE_ENTRAR,
      CAMINHO_DAS_SESSOES,
      "/sessoes/:id",
      CAMINHO_DAS_ESTATISTICAS,
      CAMINHO_DAS_PREVIAS,
      CAMINHO_DAS_PREFERENCIAS,
      CAMINHO_DA_AGENDA,
      CAMINHO_DAS_ROTINAS,
      CAMINHO_DOS_INICIOS,
      CAMINHO_DA_CONTA,
      "/conta/senha",
      CAMINHO_DO_ACESSO,
      CAMINHO_DA_RENOVACAO_DO_ACESSO,
      CAMINHO_DE_SAIR,
    ]) {
      permitirPreVoo(servidor, caminho, origemDa);
    }

    servidor.addHook("onSend", async (requisicao, resposta, carga) => {
      const caminho = requisicao.url.split("?")[0];

      if (
        caminho === CAMINHO_DOS_CARTOES ||
        caminho.startsWith("/cartoes/") ||
        caminho === CAMINHO_DOS_BARALHOS ||
        caminho.startsWith("/baralhos/") ||
        caminho === CAMINHO_DOS_USUARIOS ||
        caminho === CAMINHO_DE_ENTRAR ||
        caminho === CAMINHO_DAS_SESSOES ||
        caminho.startsWith("/sessoes/") ||
        caminho === CAMINHO_DAS_ESTATISTICAS ||
        caminho === CAMINHO_DAS_PREVIAS ||
        caminho === CAMINHO_DAS_PREFERENCIAS ||
        caminho === CAMINHO_DA_AGENDA ||
        caminho.startsWith("/agenda/") ||
        caminho === CAMINHO_DA_CONTA ||
        caminho === "/conta/senha" ||
        caminho === CAMINHO_DO_ACESSO ||
        caminho === CAMINHO_DA_RENOVACAO_DO_ACESSO ||
        caminho === CAMINHO_DE_SAIR
      ) {
        resposta
          .header("access-control-allow-origin", origemDa(requisicao))
          .header("access-control-allow-credentials", "true")
          .header("vary", "origin");
      }

      return carga;
    });
  }

  return servidor;
}

/**
 * Invariante de runtime: o socket aceito precisa estar vinculado exatamente a
 * `HOST_LOCAL`. Não basta declarar `host` no `listen`; o endereço efetivo é
 * conferido depois que o sistema operacional já vinculou a porta.
 *
 * A Credencial não substitui esta invariante: ela protege o acervo de outro
 * Usuário, e não a máquina de estranhos na rede.
 */
export function assegurarEscutaLocal(servidor: FastifyInstance): void {
  const endereco = servidor.server.address();

  if (endereco === null || typeof endereco === "string") {
    throw new EscutaInseguraError(
      "Não foi possível determinar o endereço efetivamente vinculado pelo servidor. " +
        `A aplicação deve escutar exclusivamente no loopback (${HOST_LOCAL}). ` +
        "A inicialização foi abortada.",
    );
  }

  const info: AddressInfo = endereco;

  if (info.address !== HOST_LOCAL) {
    throw new EscutaInseguraError(
      `O servidor está escutando em ${info.address}, fora do loopback (${HOST_LOCAL}). ` +
        "Isso expõe o serviço à rede. A inicialização foi abortada.",
    );
  }
}

/**
 * Registra **todas** as rotas da aplicação sobre o servidor já montado:
 * Cartões, Baralhos, Sessões, Revisão, Preferências, Usuários e Entrar. É a
 * **única fonte da verdade**
 * da lista de rotas, e as duas entradas — a local, por `iniciarServidor`, e a da
 * nuvem, pela fábrica da `funcao` — precisam chamá-la.
 *
 * A duplicação anterior deixava cada entrada montar a sua própria lista, e uma
 * rota podia existir em uma e faltar na outra: foi assim que o Histórico da
 * `013` passou a responder no loopback e a devolver `404` de rota na AWS. Com
 * uma só função, a rota que não estiver aqui não existe em lugar algum, e não há
 * como divergir.
 *
 * A Credencial já foi exigida pelo hook registrado em `criarServidor`, antes
 * destas rotas; por isso nenhuma delas repete a verificação (FR-090).
 */
export function registrarRotasDaAplicacao(
  servidor: FastifyInstance,
  identidade: Identidade,
  acervoDe: AcervoDeUsuario,
  acessos: Acessos,
): void {
  registrarRotasDeCartoes(servidor, acervoDe);
  registrarRotasDeBaralhos(servidor, acervoDe);
  registrarRotasDeSessoes(servidor, acervoDe);
  registrarRotasDeRevisao(servidor, acervoDe);
  registrarRotasDePreferencias(servidor, acervoDe);
  registrarRotasDeAgenda(servidor, acervoDe);
  registrarRotasDeUsuarios(servidor, identidade);
  registrarRotasDeConta(servidor, identidade, acessos);
  registrarRotaDeEntrada(servidor, identidade, acessos);
  registrarRotasDeAcesso(servidor, identidade, acessos);
}

/**
 * Sobe o servidor com todas as rotas do contrato.
 *
 * O `Acervo` entra como **construtor por Usuário** (`acervoDe`), e não como
 * instância: cada requisição recebe o acervo de quem Entrou, criado com o
 * `usuarioId` que o hook decorou (FR-092). Nenhum `Acervo` de ninguém é
 * guardado entre requisições, e nada de Credencial atravessa a composição.
 */
export async function iniciarServidor(
  env: NodeJS.ProcessEnv = process.env,
  identidade: Identidade,
  acervoDe: AcervoDeUsuario,
  armazenamentoDeAcessos: ArmazenamentoDeAcessos,
): Promise<FastifyInstance> {
  const opcoes = opcoesDeEscuta(env);
  const acessos = criarAcessos(armazenamentoDeAcessos, {
    validadeEmSegundos: validadeConfigurada(env),
  });
  const servidor = criarServidor(identidade, {
    acessos,
    origemDoFrontend: env.ORIGEM_DO_FRONTEND ?? ORIGEM_PADRAO_DO_FRONTEND,
    qualquerOrigemLocal: env.ORIGENS_LOCAIS_DE_TESTE === "sim",
  });
  registrarRotasDaAplicacao(servidor, identidade, acervoDe, acessos);

  await servidor.listen(opcoes);

  try {
    assegurarEscutaLocal(servidor);
  } catch (erro) {
    await servidor.close();
    throw erro;
  }

  return servidor;
}
