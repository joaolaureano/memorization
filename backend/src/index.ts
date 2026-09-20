import { criarServidor } from "./http/servidor.ts";

const HOST = "127.0.0.1";
const PORTA_PADRAO = 3001;

const porta = Number(process.env.PORTA ?? PORTA_PADRAO);
const servidor = criarServidor();

await servidor.listen({ host: HOST, port: porta });
