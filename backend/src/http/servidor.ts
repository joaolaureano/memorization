import type { AddressInfo } from "node:net";

import Fastify, { type FastifyError, type FastifyInstance } from "fastify";

import type { Acervo } from "../acervo/acervo.ts";
import type { Identidade } from "../identidade/identidade.ts";
import {
  CORPO_INVALIDO,
  registrarRotasDeBaralhos,
  registrarRotasDeCartoes,
  registrarRotasDeUsuarios,
} from "./rotas.ts";

/**
 * Servidor HTTP local.
 *
 * A aplicação não possui autenticação. Por isso, a única configuração segura é
 * escutar exclusivamente no loopback (127.0.0.1). A constante abaixo expressa
 * essa intenção; `assegurarEscutaLocal` a impõe em runtime, verificando o
 * endereço efetivamente vinculado após o `listen`.
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
 * Erro lançado quando o servidor está escutando fora do loopback.
 *
 * A ausência de autenticação torna inegociável que o processo não fique
 * acessível pela rede; qualquer desvio deve abortar a inicialização.
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
 * operações de leitura e escrita do Acervo; os cabeçalhos pedidos pelo
 * frontend são exatamente `content-type`, único exigido pelos `fetch` de JSON.
 */
function permitirPreVoo(servidor: FastifyInstance, caminho: string): void {
  servidor.options(caminho, async (_requisicao, resposta) => {
    resposta
      .header("access-control-allow-origin", "*")
      .header("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS")
      .header("access-control-allow-headers", "content-type")
      .header("access-control-max-age", "86400");

    return resposta.code(204).send();
  });
}

export function criarServidor(): FastifyInstance {
  const servidor = Fastify();
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
   * `/usuarios` entra na mesma lista com os mesmos métodos e cabeçalhos. Como
   * a aplicação não possui autenticação e escuta exclusivamente em 127.0.0.1,
   * permitir qualquer origem é a configuração mínima segura — o serviço não é
   * alcançável pela rede.
   */
  for (const caminho of [
    CAMINHO_DOS_CARTOES,
    "/cartoes/:id",
    CAMINHO_DOS_BARALHOS,
    "/baralhos/:id",
    "/baralhos/:baralhoId/vinculos",
    "/baralhos/:baralhoId/vinculos/:cartaoId",
    CAMINHO_DOS_USUARIOS,
  ]) {
    permitirPreVoo(servidor, caminho);
  }

  servidor.addHook("onSend", async (requisicao, resposta, carga) => {
    const caminho = requisicao.url.split("?")[0];

    if (
      caminho === CAMINHO_DOS_CARTOES ||
      caminho.startsWith("/cartoes/") ||
      caminho === CAMINHO_DOS_BARALHOS ||
      caminho.startsWith("/baralhos/") ||
      caminho === CAMINHO_DOS_USUARIOS
    ) {
      resposta.header("access-control-allow-origin", "*");
    }

    return carga;
  });

  return servidor;
}

/**
 * Invariante de runtime: o socket aceito precisa estar vinculado exatamente a
 * `HOST_LOCAL`. Não basta declarar `host` no `listen`; o endereço efetivo é
 * conferido depois que o sistema operacional já vinculou a porta.
 */
export function assegurarEscutaLocal(servidor: FastifyInstance): void {
  const endereco = servidor.server.address();

  if (endereco === null || typeof endereco === "string") {
    throw new EscutaInseguraError(
      "Não foi possível determinar o endereço efetivamente vinculado pelo servidor. " +
        "Como a aplicação não possui autenticação, ela deve escutar exclusivamente " +
        `no loopback (${HOST_LOCAL}). A inicialização foi abortada.`,
    );
  }

  const info: AddressInfo = endereco;

  if (info.address !== HOST_LOCAL) {
    throw new EscutaInseguraError(
      `O servidor está escutando em ${info.address}, fora do loopback (${HOST_LOCAL}). ` +
        "Como a aplicação não possui autenticação, isso expõe o serviço à rede. " +
        "A inicialização foi abortada.",
    );
  }
}

export async function iniciarServidor(
  env: NodeJS.ProcessEnv = process.env,
  acervo: Acervo,
  identidade: Identidade,
): Promise<FastifyInstance> {
  const opcoes = opcoesDeEscuta(env);
  const servidor = criarServidor();
  registrarRotasDeCartoes(servidor, acervo);
  registrarRotasDeBaralhos(servidor, acervo);
  registrarRotasDeUsuarios(servidor, identidade);

  await servidor.listen(opcoes);

  try {
    assegurarEscutaLocal(servidor);
  } catch (erro) {
    await servidor.close();
    throw erro;
  }

  return servidor;
}
