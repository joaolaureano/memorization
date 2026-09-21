import { afterEach, describe, expect, it, vi } from "vitest";

import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE,
} from "../../src/acervo-cliente/cliente";
import type { Cartao, ClienteDoAcervo } from "../../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../../src/acervo-cliente/cliente-em-memoria";
import { ClienteHttp } from "../../src/acervo-cliente/cliente-http";
import { validarFrente, validarVerso } from "../../src/acervo-cliente/validacao";

/**
 * T008 — bateria do contrato de Cartões contra os dois Adapters da Seam
 * `ClienteDoAcervo` (specs/001-criar-cartao/contracts/api-cartoes.md).
 *
 * A **mesma** bateria — criação, listagem, os quatro modos de recusa de
 * domínio com mensagem exata em português e a indisponibilidade — roda contra
 * `ClienteHttp` e `ClienteEmMemoria`, e produz resultados idênticos. Nenhuma
 * resposta que não seja de sucesso aparece como operação concluída (FR-044).
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";
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
 * implementa as duas rotas de Cartões exatamente como a API — `201`/`200` no
 * sucesso, `400` com `{ erro, mensagem }` nas quatro recusas de domínio,
 * propriedade extra ignorada. A indisponibilidade é simulada fazendo a
 * `fetch` lançar, como numa falha de rede real.
 */
function criarAmbienteHttp(): AmbienteDeCliente {
  const cartoesNoServidor: Cartao[] = [];
  let sequencia = 0;
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

executarBateriaDoContrato("ClienteHttp", criarAmbienteHttp);
executarBateriaDoContrato("ClienteEmMemoria", criarAmbienteEmMemoria);

describe("resultados idênticos entre os dois Adapters", () => {
  it("a mesma sequência de operações produz o mesmo resultado observável", async () => {
    const noHttp = await cenarioCompleto(criarAmbienteHttp());
    const emMemoria = await cenarioCompleto(criarAmbienteEmMemoria());

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

function clienteHttpCom(fetchDeTeste: unknown): ClienteDoAcervo {
  vi.stubGlobal("fetch", fetchDeTeste);
  return new ClienteHttp(ENDERECO_DA_API);
}
