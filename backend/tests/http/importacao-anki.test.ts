import type { FastifyInstance, InjectOptions } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarServidorDeContrato, pedirComCredencial, type ServidorDeContrato } from "./apoio-de-contrato.ts";
import { registrarRotasDeBaralhos } from "../../src/http/rotas.ts";

let servidor: FastifyInstance;
let contrato: ServidorDeContrato;
const parser = vi.fn(async (bytes: Buffer) => ({ tamanho: bytes.byteLength, baralhos: [] }));

beforeEach(async () => {
  parser.mockClear();
  contrato = await montarServidorDeContrato(({ servidor, acervoDe }) => registrarRotasDeBaralhos(servidor, acervoDe, parser));
  servidor = contrato.servidor;
});
afterEach(async () => contrato.encerrar());

function pedir(requisicao: InjectOptions) {
  return pedirComCredencial(servidor, contrato.credencial, requisicao);
}

describe("importação de baralho Anki por HTTP", () => {
  it("envia o pacote para a prévia e recusa arquivo de coleção", async () => {
    const resposta = await pedir({ method: "POST", url: "/baralhos/importacoes/previa", headers: { "content-type": "application/octet-stream", "x-file-name": "curso.apkg" }, payload: Buffer.from("zip") });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ tamanho: 3, baralhos: [] });
    expect(parser).toHaveBeenCalledWith(Buffer.from("zip"));

    const colecao = await pedir({ method: "POST", url: "/baralhos/importacoes/previa", headers: { "content-type": "application/octet-stream", "x-file-name": "collection.apkg" }, payload: Buffer.from("zip") });
    expect(colecao.statusCode).toBe(400);
    expect(parser).toHaveBeenCalledTimes(1);
  });

  it("aceita nome de arquivo com acento codificado pelo cliente e recusa coleção codificada", async () => {
    const resposta = await pedir({ method: "POST", url: "/baralhos/importacoes/previa", headers: { "content-type": "application/octet-stream", "x-file-name": encodeURIComponent("Inglês.apkg") }, payload: Buffer.from("zip") });
    expect(resposta.statusCode).toBe(200);
    expect(parser).toHaveBeenCalledTimes(1);

    const colecao = await pedir({ method: "POST", url: "/baralhos/importacoes/previa", headers: { "content-type": "application/octet-stream", "x-file-name": encodeURIComponent("Coleção.colpkg") }, payload: Buffer.from("zip") });
    expect(colecao.statusCode).toBe(400);
    expect(parser).toHaveBeenCalledTimes(1);
  });

  it("confirma todos os grupos com tags normalizadas e persistência atômica", async () => {
    const resposta = await pedir({ method: "POST", url: "/baralhos/importacoes", payload: { baralhos: [
      { nome: "Francês", cartoes: [{ frente: "Bonjour", verso: "Olá", tags: ["IDIOMAS"] }] },
      { nome: "Espanhol", cartoes: [{ frente: "Hola", verso: "Oi", tags: ["IDIOMAS", "Saudações"] }] },
    ] } });
    expect(resposta.statusCode).toBe(201);
    const acervo = contrato.acervoDe(contrato.credencial.id);
    expect((await acervo.listarBaralhos()).map((baralho) => baralho.nome)).toEqual(["Francês", "Espanhol"]);
    expect((await acervo.listarCartoes()).map((cartao) => cartao.tags)).toEqual([["idiomas"], ["idiomas", "saudações"]]);
  });
});
