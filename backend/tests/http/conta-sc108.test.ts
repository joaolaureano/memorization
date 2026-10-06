import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registrarRotasDaAplicacao } from "../../src/http/servidor.ts";
import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";

/**
 * T1711 — SC-108: excluir uma conta com 2.000 Cartões e 500 Registros de
 * sessão é confirmado em menos de 5 s, e remove tudo de uma vez — sem estado
 * parcial (FR-274, FR-275).
 */

let contrato: ServidorDeContrato;

beforeEach(async () => {
  contrato = await montarServidorDeContrato(
    ({ servidor, acervoDe, identidade, acessos }) => {
      registrarRotasDaAplicacao(servidor, identidade, acervoDe, acessos);
    },
  );
});

afterEach(async () => {
  await contrato.encerrar();
});

describe("exclusão de conta grande (SC-108)", () => {
  it("confirma a exclusão em menos de 5 s e não deixa nada para trás", async () => {
    const armazenamento = contrato.aberto.armazenamento;
    const dono = contrato.credencial.id;
    const outro = await contrato.cadastrar("bruno.souza");

    await armazenamento.inserirBaralho(dono, { id: "b1", nome: "Inglês" });

    const baralhoOutro = { id: "b2", nome: "Português" };
    await armazenamento.inserirBaralho(outro.id, baralhoOutro);
    await armazenamento.inserirCartaoNoBaralho(outro.id, baralhoOutro.id, {
      id: "c-outro",
      frente: "To run",
      verso: "Correr",
    });

    for (let i = 0; i < 2000; i += 1) {
      await armazenamento.inserirCartaoNoBaralho(dono, "b1", {
        id: `c${i}`,
        frente: `Frente ${i}`,
        verso: `Verso ${i}`,
      });
    }

    for (let i = 0; i < 500; i += 1) {
      await armazenamento.inserirRegistroDeSessao(dono, {
        id: randomUUID(),
        origem: "baralho",
        baralhoId: "b1",
        nomeDoBaralho: "Inglês",
        concluidaEm: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
        estudados: 1,
        acertos: 1,
        erros: 0,
        itens: [
          {
            posicao: 0,
            frente: "To walk",
            verso: "Caminhar",
            resultado: "acertou",
            cartaoId: null,
            avaliacao: null,
          },
        ],
      });
    }

    const antes = await pedirComCredencial(
      contrato.servidor,
      contrato.credencial,
      { method: "GET", url: "/conta" },
    );

    expect(antes.json().contagens).toMatchObject({
      cartoes: 2000,
      registrosDeSessao: 500,
    });

    const inicio = performance.now();
    const resposta = await pedirComCredencial(
      contrato.servidor,
      contrato.credencial,
      {
        method: "DELETE",
        url: "/conta",
        payload: { senhaAtual: contrato.credencial.senha },
      },
    );
    const duracao = performance.now() - inicio;

    expect(resposta.statusCode).toBe(204);
    expect(duracao).toBeLessThan(5000);

    expect(await armazenamento.listarCartoes(dono)).toEqual([]);
    expect(await armazenamento.listarBaralhos(dono)).toEqual([]);
    expect(await armazenamento.listarRegistrosRecentes(dono, 1000)).toEqual([]);
    expect(await armazenamento.listarCartoes(outro.id)).toHaveLength(1);
  }, 120_000);
});
