import type { AddressInfo } from "node:net";

import Fastify, { type FastifyError, type FastifyInstance } from "fastify";

import type { Acervo } from "../acervo/acervo.ts";
import { CORPO_INVALIDO, registrarRotasDeCartoes } from "./rotas.ts";

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
 * Erro lançado quando o servidor está escutando fora do loopback.
 *
 * A ausência de autenticação torna inegociável que o processo não fique
 * acessível pela rede; qualquer desvio deve abortar a inicialização.
 */
export class EscutaInseguraError extends Error {}

export function portaConfigurada(env: NodeJS.ProcessEnv = process.env): number {
  return Number(env.PORTA ?? 3001);
}

export function opcoesDeEscuta(env: NodeJS.ProcessEnv = process.env): {
  host: string;
  port: number;
} {
  return { host: HOST_LOCAL, port: portaConfigurada(env) };
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
): Promise<FastifyInstance> {
  const servidor = criarServidor();
  registrarRotasDeCartoes(servidor, acervo);

  await servidor.listen(opcoesDeEscuta(env));

  try {
    assegurarEscutaLocal(servidor);
  } catch (erro) {
    await servidor.close();
    throw erro;
  }

  return servidor;
}
