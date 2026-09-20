import type { AddressInfo } from "node:net";

import Fastify, { type FastifyInstance } from "fastify";

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
): Promise<FastifyInstance> {
  const servidor = criarServidor();

  await servidor.listen(opcoesDeEscuta(env));

  try {
    assegurarEscutaLocal(servidor);
  } catch (erro) {
    await servidor.close();
    throw erro;
  }

  return servidor;
}
