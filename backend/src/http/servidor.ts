import Fastify, { type FastifyInstance } from "fastify";

export function criarServidor(): FastifyInstance {
  const servidor = Fastify();

  servidor.get("/health", async () => ({ status: "ok" }));

  return servidor;
}
