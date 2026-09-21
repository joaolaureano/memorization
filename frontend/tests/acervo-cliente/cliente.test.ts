import { afterEach, describe, expect, it, vi } from "vitest";

import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
} from "../../src/acervo-cliente/cliente";
import type {
  Baralho,
  Cartao,
  ClienteDoAcervo,
} from "../../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../../src/acervo-cliente/cliente-em-memoria";
import { ClienteHttp } from "../../src/acervo-cliente/cliente-http";
import {
  validarFrente,
  validarNomeDeBaralho,
  validarVerso,
} from "../../src/acervo-cliente/validacao";

/**
 * T008 e T106 — bateria dos contratos de Cartões e de Baralhos contra os dois
 * Adapters da Seam `ClienteDoAcervo`
 * (specs/001-criar-cartao/contracts/api-cartoes.md e
 * specs/002-criar-baralho/contracts/api-baralhos.md).
 *
 * A **mesma** bateria — criação, listagem, os modos de recusa de domínio com
 * mensagem exata em português e a indisponibilidade — roda contra
 * `ClienteHttp` e `ClienteEmMemoria`, e produz resultados idênticos. Nenhuma
 * resposta que não seja de sucesso aparece como operação concluída (FR-044).
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";
const NOME_VALIDO = "Inglês";
const ENDERECO_DA_API = "http://127.0.0.1:3001";

afterEach(() => {
  vi.unstubAllGlobals();
});

type AmbienteDeCliente = {
  cliente: ClienteDoAcervo;
  indisponibilizar: () => void;
  restaurar: () => void;
};

type RespostaDeTeste = {
  status: number;
  json: () => Promise<unknown>;
};

function respostaDeTeste(status: number, corpo: unknown): RespostaDeTeste {
  return { status, json: async () => corpo };
}

function criarAmbienteEmMemoria(): AmbienteDeCliente {
  const cliente = new ClienteEmMemoria();

  return {
    cliente,
    indisponibilizar: () => cliente.simularIndisponibilidade(),
    restaurar: () => cliente.restaurarDisponibilidade(),
  };
}

/**
 * Servidor de contrato simulado para o `ClienteHttp`: uma `fetch` falsa que
 * implementa as rotas de Cartões e de Baralhos exatamente como a API —
 * `201`/`200` no sucesso, `400` com `{ erro, mensagem }` nas recusas de
 * domínio, propriedade extra ignorada. A indisponibilidade é simulada fazendo
 * a `fetch` lançar, como numa falha de rede real.
 */
function criarAmbienteHttp(): AmbienteDeCliente {
  const cartoesNoServidor: Cartao[] = [];
  const baralhosNoServidor: Baralho[] = [];
  let sequencia = 0;
  let sequenciaDeBaralhos = 0;
  let indisponivel = false;

  const fetchDeTeste = async (
    entrada: unknown,
    opcoes?: RequestInit,
  ): Promise<RespostaDeTeste> => {
    if (indisponivel) {
      throw new Error("falha de transporte simulada");
    }

    const url = typeof entrada === "string" ? entrada : String(entrada);
    const metodo = opcoes?.method ?? "GET";

    if (url === `${ENDERECO_DA_API}/cartoes` && metodo === "POST") {
      const corpo = JSON.parse(String(opcoes?.body)) as Record<string, unknown>;

      const falha =
        validarFrente(corpo.frente as string) ??
        validarVerso(corpo.verso as string);

      if (falha !== null) {
        return respostaDeTeste(400, {
          erro: falha.erro,
          mensagem: falha.mensagem,
        });
      }

      const cartao: Cartao = {
        id: `s${++sequencia}`,
        frente: corpo.frente as string,
        verso: corpo.verso as string,
      };

      cartoesNoServidor.push(cartao);

      return respostaDeTeste(201, cartao);
    }

    if (url === `${ENDERECO_DA_API}/cartoes` && metodo === "GET") {
      return respostaDeTeste(200, [...cartoesNoServidor]);
    }

    if (url === `${ENDERECO_DA_API}/baralhos` && metodo === "POST") {
      const corpo = JSON.parse(String(opcoes?.body)) as Record<string, unknown>;

      const falha = validarNomeDeBaralho(corpo.nome as string);

      if (falha !== null) {
        return respostaDeTeste(400, {
          erro: falha.erro,
          mensagem: falha.mensagem,
        });
      }

      const baralho: Baralho = {
        id: `s${++sequenciaDeBaralhos}`,
        nome: corpo.nome as string,
      };

      baralhosNoServidor.push(baralho);

      return respostaDeTeste(201, baralho);
    }

    if (url === `${ENDERECO_DA_API}/baralhos` && metodo === "GET") {
      return respostaDeTeste(
        200,
        baralhosNoServidor.map((baralho) => {
          const quantidadeDeCartoes = 0;

          return {
            ...baralho,
            quantidadeDeCartoes,
            elegivel: quantidadeDeCartoes > 0,
          };
        }),
      );
    }

    return respostaDeTeste(404, {
      erro: "nao_encontrado",
      mensagem: "Rota inexistente.",
    });
  };

  vi.stubGlobal("fetch", fetchDeTeste);

  return {
    cliente: new ClienteHttp(ENDERECO_DA_API),
    indisponibilizar: () => {
      indisponivel = true;
    },
    restaurar: () => {
      indisponivel = false;
    },
  };
}

/**
 * A bateria compartilhada. Toda asserção atravessa a Interface
 * `ClienteDoAcervo`, nunca o estado interno do Adapter, e usa expectativas
 * exatas — inclusive as mensagens do contrato — para que os dois Adapters
 * sejam comprovados idênticos na superfície observável.
 */
function executarBateriaDoContrato(
  nomeDoAdapter: string,
  criarAmbiente: () => AmbienteDeCliente,
): void {
  describe(`${nomeDoAdapter} — bateria do contrato de Cartões`, () => {
    it("cria um Cartão válido com id, Frente e Verso (FR-001)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });

      expect(resultado).toEqual({
        ok: true,
        cartao: {
          id: expect.any(String),
          frente: FRENTE_VALIDA,
          verso: VERSO_VALIDO,
        },
      });
    });

    it("lista o Cartão criado (FR-001, FR-003)", async () => {
      const { cliente } = criarAmbiente();

      const criacao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });

      if (!criacao.ok) {
        throw new Error("a criação deveria ser aceita");
      }

      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [criacao.cartao],
      });
    });

    it("lista vazia quando nenhum Cartão existe (FR-003)", async () => {
      const { cliente } = criarAmbiente();

      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [],
      });
    });

    it("aceita dois Cartões com a mesma Frente, ambos presentes (invariante 2)", async () => {
      const { cliente } = criarAmbiente();

      const primeiro = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
      const segundo = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: "Andar",
      });

      if (!primeiro.ok || !segundo.ok) {
        throw new Error("as criações deveriam ser aceitas");
      }

      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: expect.arrayContaining([primeiro.cartao, segundo.cartao]),
      });
    });

    it("devolve cada Cartão com exatamente id, Frente e Verso (FR-004)", async () => {
      const { cliente } = criarAmbiente();

      await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
      const listagem = await cliente.listarCartoes();

      if (!listagem.ok) {
        throw new Error("a listagem deveria ser aceita");
      }

      expect(listagem.cartoes).toHaveLength(1);

      for (const cartao of listagem.cartoes) {
        expect(Object.keys(cartao).sort()).toEqual(["frente", "id", "verso"]);
        expect(cartao.id).toEqual(expect.any(String));
        expect(cartao.frente).toBe(FRENTE_VALIDA);
        expect(cartao.verso).toBe(VERSO_VALIDO);
      }
    });

    it("ignora propriedade extra e ela não retorna nas leituras (FR-009)", async () => {
      const { cliente } = criarAmbiente();

      const dadosComPropriedadeExtra = {
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
        titulo: "propriedade que não existe em Cartão",
      };

      const criacao = await cliente.criarCartao(dadosComPropriedadeExtra);

      if (!criacao.ok) {
        throw new Error("a criação deveria ser aceita");
      }

      expect(Object.keys(criacao.cartao).sort()).toEqual([
        "frente",
        "id",
        "verso",
      ]);
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [criacao.cartao],
      });
    });

    it("aceita Frente e Verso com exatamente 1000 caracteres: limite inclusivo (FR-052)", async () => {
      const { cliente } = criarAmbiente();

      const criacao = await cliente.criarCartao({
        frente: "a".repeat(1000),
        verso: "b".repeat(1000),
      });

      expect(criacao.ok).toBe(true);
    });

    it("recusa Frente vazia com frente_vazia e mensagem exata, sem criar nada (FR-002)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarCartao({
        frente: "",
        verso: VERSO_VALIDO,
      });

      expect(resultado).toEqual({
        ok: false,
        erro: "frente_vazia",
        mensagem: "A frente do cartão não pode ficar vazia.",
      });
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [],
      });
    });

    it("trata Frente composta só de espaços como vazia (FR-051)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarCartao({
        frente: "   ",
        verso: VERSO_VALIDO,
      });

      expect(resultado).toEqual({
        ok: false,
        erro: "frente_vazia",
        mensagem: "A frente do cartão não pode ficar vazia.",
      });
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [],
      });
    });

    it("recusa Verso vazio com verso_vazio e mensagem exata, sem criar nada (FR-002)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: "",
      });

      expect(resultado).toEqual({
        ok: false,
        erro: "verso_vazio",
        mensagem: "O verso do cartão não pode ficar vazio.",
      });
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [],
      });
    });

    it("recusa Frente acima de 1000 caracteres, informando limite e tamanho (FR-052)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarCartao({
        frente: "a".repeat(1001),
        verso: VERSO_VALIDO,
      });

      expect(resultado).toEqual({
        ok: false,
        erro: "frente_muito_longa",
        mensagem:
          "A frente do cartão deve ter no máximo 1000 caracteres; a informada tem 1001.",
      });
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [],
      });
    });

    it("recusa Verso acima de 1000 caracteres, informando limite e tamanho (FR-052)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: "a".repeat(1001),
      });

      expect(resultado).toEqual({
        ok: false,
        erro: "verso_muito_longo",
        mensagem:
          "O verso do cartão deve ter no máximo 1000 caracteres; o informado tem 1001.",
      });
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [],
      });
    });

    it("com o transporte indisponível, criarCartao falha com indisponivel (FR-044)", async () => {
      const { cliente, indisponibilizar } = criarAmbiente();
      indisponibilizar();

      const resultado = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });

      expect(resultado).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
      });
    });

    it("criação falha por indisponibilidade não aparece como concluída: nada é criado (FR-044)", async () => {
      const { cliente, indisponibilizar, restaurar } = criarAmbiente();
      indisponibilizar();

      const criacao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });

      expect(criacao.ok).toBe(false);
      restaurar();

      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [],
      });
    });

    it("com o transporte indisponível, listarCartoes falha com indisponivel", async () => {
      const { cliente, indisponibilizar } = criarAmbiente();
      indisponibilizar();

      expect(await cliente.listarCartoes()).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
      });
    });
  });
}

/**
 * A bateria compartilhada de Baralhos. Toda asserção atravessa a Interface
 * `ClienteDoAcervo`, nunca o estado interno do Adapter, e usa expectativas
 * exatas — inclusive as mensagens do contrato — para que os dois Adapters
 * sejam comprovados idênticos na superfície observável.
 */
function executarBateriaDeBaralhos(
  nomeDoAdapter: string,
  criarAmbiente: () => AmbienteDeCliente,
): void {
  describe(`${nomeDoAdapter} — bateria do contrato de Baralhos`, () => {
    it("cria um Baralho válido com id e nome (FR-010)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarBaralho({ nome: NOME_VALIDO });

      expect(resultado).toEqual({
        ok: true,
        baralho: {
          id: expect.any(String),
          nome: NOME_VALIDO,
        },
      });
    });

    it("lista o Baralho criado com quantidadeDeCartoes 0 e elegivel false (FR-013)", async () => {
      const { cliente } = criarAmbiente();

      const criacao = await cliente.criarBaralho({ nome: NOME_VALIDO });

      if (!criacao.ok) {
        throw new Error("a criação deveria ser aceita");
      }

      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [
          {
            ...criacao.baralho,
            quantidadeDeCartoes: 0,
            elegivel: false,
          },
        ],
      });
    });

    it("lista vazia quando nenhum Baralho existe (FR-013)", async () => {
      const { cliente } = criarAmbiente();

      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [],
      });
    });

    it("aceita dois Baralhos com o mesmo nome, ambos presentes (FR-012)", async () => {
      const { cliente } = criarAmbiente();

      const primeiro = await cliente.criarBaralho({ nome: NOME_VALIDO });
      const segundo = await cliente.criarBaralho({ nome: NOME_VALIDO });

      if (!primeiro.ok || !segundo.ok) {
        throw new Error("as criações deveriam ser aceitas");
      }

      const listagem = await cliente.listarBaralhos();

      if (!listagem.ok) {
        throw new Error("a listagem deveria ser aceita");
      }

      expect(listagem.baralhos).toEqual(
        expect.arrayContaining([
          {
            ...primeiro.baralho,
            quantidadeDeCartoes: 0,
            elegivel: false,
          },
          {
            ...segundo.baralho,
            quantidadeDeCartoes: 0,
            elegivel: false,
          },
        ]),
      );
    });

    it("devolve cada Baralho com exatamente id, nome, quantidadeDeCartoes e elegivel (FR-018)", async () => {
      const { cliente } = criarAmbiente();

      await cliente.criarBaralho({ nome: NOME_VALIDO });
      const listagem = await cliente.listarBaralhos();

      if (!listagem.ok) {
        throw new Error("a listagem deveria ser aceita");
      }

      expect(listagem.baralhos).toHaveLength(1);

      for (const baralho of listagem.baralhos) {
        expect(Object.keys(baralho).sort()).toEqual([
          "elegivel",
          "id",
          "nome",
          "quantidadeDeCartoes",
        ]);
        expect(baralho.id).toEqual(expect.any(String));
        expect(baralho.nome).toBe(NOME_VALIDO);
        expect(baralho.quantidadeDeCartoes).toBe(0);
        expect(baralho.elegivel).toBe(false);
      }
    });

    it("ignora propriedade extra e ela não retorna nas leituras (FR-018)", async () => {
      const { cliente } = criarAmbiente();

      const dadosComPropriedadeExtra = {
        nome: NOME_VALIDO,
        descricao: "propriedade que não existe em Baralho",
      };

      const criacao = await cliente.criarBaralho(dadosComPropriedadeExtra);

      if (!criacao.ok) {
        throw new Error("a criação deveria ser aceita");
      }

      expect(Object.keys(criacao.baralho).sort()).toEqual(["id", "nome"]);
      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [
          {
            ...criacao.baralho,
            quantidadeDeCartoes: 0,
            elegivel: false,
          },
        ],
      });
    });

    it("aceita nome com exatamente 100 caracteres: limite inclusivo (FR-061)", async () => {
      const { cliente } = criarAmbiente();

      const criacao = await cliente.criarBaralho({ nome: "a".repeat(100) });

      expect(criacao.ok).toBe(true);
    });

    it("recusa nome vazio com nome_vazio e mensagem exata, sem criar nada (FR-011)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarBaralho({ nome: "" });

      expect(resultado).toEqual({
        ok: false,
        erro: "nome_vazio",
        mensagem: "O nome do baralho não pode ficar vazio.",
      });
      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [],
      });
    });

    it("trata nome composto só de espaços como vazio (FR-011)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarBaralho({ nome: "   " });

      expect(resultado).toEqual({
        ok: false,
        erro: "nome_vazio",
        mensagem: "O nome do baralho não pode ficar vazio.",
      });
      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [],
      });
    });

    it("recusa nome acima de 100 caracteres, informando limite e tamanho (FR-061)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarBaralho({ nome: "a".repeat(101) });

      expect(resultado).toEqual({
        ok: false,
        erro: "nome_muito_longo",
        mensagem:
          "O nome do baralho deve ter no máximo 100 caracteres; o informado tem 101.",
      });
      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [],
      });
    });

    it("com o transporte indisponível, criarBaralho falha com indisponivel (FR-044)", async () => {
      const { cliente, indisponibilizar } = criarAmbiente();
      indisponibilizar();

      const resultado = await cliente.criarBaralho({ nome: NOME_VALIDO });

      expect(resultado).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
      });
    });

    it("criação falha por indisponibilidade não aparece como concluída: nada é criado (FR-044)", async () => {
      const { cliente, indisponibilizar, restaurar } = criarAmbiente();
      indisponibilizar();

      const criacao = await cliente.criarBaralho({ nome: NOME_VALIDO });

      expect(criacao.ok).toBe(false);
      restaurar();

      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [],
      });
    });

    it("com o transporte indisponível, listarBaralhos falha com indisponivel", async () => {
      const { cliente, indisponibilizar } = criarAmbiente();
      indisponibilizar();

      expect(await cliente.listarBaralhos()).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
      });
    });
  });
}

executarBateriaDoContrato("ClienteHttp", criarAmbienteHttp);
executarBateriaDoContrato("ClienteEmMemoria", criarAmbienteEmMemoria);

executarBateriaDeBaralhos("ClienteHttp", criarAmbienteHttp);
executarBateriaDeBaralhos("ClienteEmMemoria", criarAmbienteEmMemoria);

describe("resultados idênticos entre os dois Adapters", () => {
  it("a mesma sequência de operações produz o mesmo resultado observável", async () => {
    const noHttp = await cenarioCompleto(criarAmbienteHttp());
    const emMemoria = await cenarioCompleto(criarAmbienteEmMemoria());

    expect(comIdsOcultos(emMemoria)).toEqual(comIdsOcultos(noHttp));
  });

  it("a mesma sequência de operações de Baralho produz o mesmo resultado observável", async () => {
    const noHttp = await cenarioDeBaralhos(criarAmbienteHttp());
    const emMemoria = await cenarioDeBaralhos(criarAmbienteEmMemoria());

    expect(comIdsOcultos(emMemoria)).toEqual(comIdsOcultos(noHttp));
  });
});

/**
 * Sequência que atravessa sucesso, recusas e indisponibilidade nas duas
 * operações. Os ids são opacos, então a igualdade entre Adapters é comparada
 * com ids ocultos — todo o resto precisa ser idêntico, inclusive as mensagens.
 */
async function cenarioCompleto(ambiente: AmbienteDeCliente) {
  const { cliente, indisponibilizar, restaurar } = ambiente;

  const criado = await cliente.criarCartao({
    frente: FRENTE_VALIDA,
    verso: VERSO_VALIDO,
  });
  const repetido = await cliente.criarCartao({
    frente: FRENTE_VALIDA,
    verso: "Andar",
  });
  const frenteVazia = await cliente.criarCartao({
    frente: "",
    verso: VERSO_VALIDO,
  });
  const frenteLonga = await cliente.criarCartao({
    frente: "a".repeat(1001),
    verso: VERSO_VALIDO,
  });
  const lista = await cliente.listarCartoes();

  indisponibilizar();
  const criacaoIndisponivel = await cliente.criarCartao({
    frente: "Never",
    verso: "Nunca",
  });
  const listaIndisponivel = await cliente.listarCartoes();

  restaurar();
  const listaAposRestaurar = await cliente.listarCartoes();

  return {
    criado,
    repetido,
    frenteVazia,
    frenteLonga,
    lista,
    criacaoIndisponivel,
    listaIndisponivel,
    listaAposRestaurar,
  };
}

/**
 * Sequência de Baralhos que atravessa sucesso, recusas e indisponibilidade.
 * Os ids são opacos, então a igualdade entre Adapters é comparada com ids
 * ocultos — todo o resto precisa ser idêntico, inclusive as mensagens.
 */
async function cenarioDeBaralhos(ambiente: AmbienteDeCliente) {
  const { cliente, indisponibilizar, restaurar } = ambiente;

  const criado = await cliente.criarBaralho({ nome: NOME_VALIDO });
  const repetido = await cliente.criarBaralho({ nome: NOME_VALIDO });
  const nomeVazio = await cliente.criarBaralho({ nome: "" });
  const nomeLongo = await cliente.criarBaralho({ nome: "a".repeat(101) });
  const lista = await cliente.listarBaralhos();

  indisponibilizar();
  const criacaoIndisponivel = await cliente.criarBaralho({ nome: "Nunca" });
  const listaIndisponivel = await cliente.listarBaralhos();

  restaurar();
  const listaAposRestaurar = await cliente.listarBaralhos();

  return {
    criado,
    repetido,
    nomeVazio,
    nomeLongo,
    lista,
    criacaoIndisponivel,
    listaIndisponivel,
    listaAposRestaurar,
  };
}

/**
 * Substitui todo `id` por "<id>" em profundidade: identificadores são opacos
 * e não fazem parte da igualdade entre os resultados dos dois Adapters.
 */
function comIdsOcultos(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(comIdsOcultos);
  }

  if (typeof valor === "object" && valor !== null) {
    const resultado: Record<string, unknown> = {};

    for (const [chave, item] of Object.entries(valor)) {
      resultado[chave] = chave === "id" ? "<id>" : comIdsOcultos(item);
    }

    return resultado;
  }

  return valor;
}

describe("ClienteHttp — resposta fora do contrato nunca aparece como sucesso (FR-044)", () => {
  it("trata status 500 como indisponivel, na criação e na listagem", async () => {
    const cliente = clienteHttpCom(async () =>
      respostaDeTeste(500, "erro interno"),
    );

    expect(
      await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      }),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
    });
    expect(await cliente.listarCartoes()).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
    });
  });

  it("trata 400 com corpo que não é JSON como indisponivel", async () => {
    const cliente = clienteHttpCom(async () => ({
      status: 400,
      json: async () => {
        throw new Error("corpo ilegível");
      },
    }));

    expect(
      await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      }),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
    });
  });

  it("trata 400 com código fora do contrato como indisponivel", async () => {
    const cliente = clienteHttpCom(async () =>
      respostaDeTeste(400, {
        erro: "corpo_invalido",
        mensagem: "O corpo da requisição não é válido.",
      }),
    );

    expect(
      await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      }),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
    });
  });

  it("trata falha de rede como indisponivel", async () => {
    const cliente = clienteHttpCom(async () => {
      throw new Error("conexão recusada");
    });

    expect(
      await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      }),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
    });
  });
});

describe("ClienteHttp — resposta fora do contrato de Baralhos nunca aparece como sucesso (FR-044)", () => {
  it("trata status 500 como indisponivel, na criação e na listagem", async () => {
    const cliente = clienteHttpCom(async () =>
      respostaDeTeste(500, "erro interno"),
    );

    expect(await cliente.criarBaralho({ nome: NOME_VALIDO })).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    });
    expect(await cliente.listarBaralhos()).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    });
  });

  it("trata 400 com corpo que não é JSON como indisponivel", async () => {
    const cliente = clienteHttpCom(async () => ({
      status: 400,
      json: async () => {
        throw new Error("corpo ilegível");
      },
    }));

    expect(await cliente.criarBaralho({ nome: NOME_VALIDO })).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    });
  });

  it("trata 400 com código fora do contrato como indisponivel", async () => {
    const cliente = clienteHttpCom(async () =>
      respostaDeTeste(400, {
        erro: "corpo_invalido",
        mensagem: "O corpo da requisição não é válido.",
      }),
    );

    expect(await cliente.criarBaralho({ nome: NOME_VALIDO })).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    });
  });

  it("trata falha de rede como indisponivel", async () => {
    const cliente = clienteHttpCom(async () => {
      throw new Error("conexão recusada");
    });

    expect(await cliente.criarBaralho({ nome: NOME_VALIDO })).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    });
  });
});

function clienteHttpCom(fetchDeTeste: unknown): ClienteDoAcervo {
  vi.stubGlobal("fetch", fetchDeTeste);
  return new ClienteHttp(ENDERECO_DA_API);
}
