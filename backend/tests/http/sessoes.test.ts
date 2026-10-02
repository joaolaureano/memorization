import { randomUUID } from "node:crypto";

import type {
  FastifyInstance,
  InjectOptions,
  LightMyRequestResponse,
} from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";
import type { Acervo } from "../../src/acervo/acervo.ts";
import {
  registrarRotasDeBaralhos,
  registrarRotasDeCartoes,
  registrarRotasDeSessoes,
} from "../../src/http/rotas.ts";

/**
 * T1206 — contrato HTTP do Histórico de Sessões
 * (`specs/013-estatisticas-e-historico/contracts/contratos.md`, §3).
 *
 * O servidor é montado como na aplicação, com o hook que exige a Credencial: as
 * rotas de Cartão e de Baralho entram só para dar existência real ao acervo —
 * é assim que se verifica a contagem de Início e o `baralhoExiste` —, e as
 * rotas de Sessão e de Estatísticas, o objeto do teste. Toda asserção
 * atravessa `inject`, a mesma superfície que um cliente HTTP usa.
 */

const UMA_HORA_EM_MILISSEGUNDOS = 60 * 60 * 1000;

/** Um instante ISO-8601 deslocado do agora, para a janela de `desde`. */
function instanteDeAgora(deslocamentoEmMilissegundos: number): string {
  return new Date(Date.now() + deslocamentoEmMilissegundos).toISOString();
}

/** Uma pausa real, para separar `concluidaEm` de gravações seguidas. */
function pausa(milissegundos: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milissegundos));
}

interface ItemDoRegistroEsperado {
  posicao: number;
  frente: string;
  verso: string;
  resultado: "acertou" | "errou";
}

interface RegistroEsperado {
  id: string;
  baralhoId: string;
  nomeDoBaralho: string;
  concluidaEm: string;
  estudados: number;
  acertos: number;
  erros: number;
  itens: ItemDoRegistroEsperado[];
}

type ResumoEsperado = Omit<RegistroEsperado, "itens">;

/** O registro sem os Itens: exatamente a linha que as listagens devolvem. */
function resumoDe(registro: RegistroEsperado): ResumoEsperado {
  return {
    id: registro.id,
    baralhoId: registro.baralhoId,
    nomeDoBaralho: registro.nomeDoBaralho,
    concluidaEm: registro.concluidaEm,
    estudados: registro.estudados,
    acertos: registro.acertos,
    erros: registro.erros,
  };
}

/**
 * Um `Acervo` que só sabe recusar por indisponibilidade — o único desfecho do
 * armazenamento que estas rotas precisam cobrir (FR-173). O duplo implementa as
 * três operações de Histórico e ignora as demais, que não entram em cena; a
 * asserção dupla evita arrastar para o teste as operações de Cartão e Baralho.
 */
const acervoIndisponivel = {
  registrarSessao: async () => ({ ok: false, erro: "indisponivel" }),
  obterEstatisticas: async () => ({ ok: false, erro: "indisponivel" }),
  obterRegistroDeSessao: async () => ({ ok: false, erro: "indisponivel" }),
} as unknown as Acervo;

let servidor: FastifyInstance;
let contrato: ServidorDeContrato;

beforeEach(async () => {
  contrato = await montarServidorDeContrato(({ servidor, acervoDe }) => {
    registrarRotasDeCartoes(servidor, acervoDe);
    registrarRotasDeBaralhos(servidor, acervoDe);
    registrarRotasDeSessoes(servidor, acervoDe);
  });
  servidor = contrato.servidor;
});

afterEach(async () => {
  await contrato.encerrar();
});

/** Envia a requisição com a Credencial do Usuário que entrou (FR-090). */
function pedir(requisicao: InjectOptions) {
  return pedirComCredencial(servidor, contrato.credencial, requisicao);
}

/** O corpo cru de um Registro válido, com o que o cenário quiser trocar. */
function registroCru(
  sobrescreve: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: randomUUID(),
    baralhoId: randomUUID(),
    nomeDoBaralho: "Inglês",
    itens: [
      { frente: "casa", verso: "house", resultado: "acertou" },
      { frente: "gato", verso: "cat", resultado: "errou" },
    ],
    ...sobrescreve,
  };
}

/**
 * O corpo que o `inject` aceita, derivado do próprio tipo da requisição — é o
 * mesmo tipo que `payload` espera, de modo que nenhum caso precise recorrer a
 * `any` para postar um corpo cru.
 */
type CorpoDaRequisicao = NonNullable<InjectOptions["payload"]>;

function postarSessao(corpo?: CorpoDaRequisicao) {
  return pedir({ method: "POST", url: "/sessoes", payload: corpo });
}

/** Cria um registro válido e devolve o `RegistroDeSessao` gravado. */
async function registrarSessao(
  sobrescreve: Record<string, unknown> = {},
): Promise<RegistroEsperado> {
  const resposta = await postarSessao(registroCru(sobrescreve));
  expect(resposta.statusCode).toBe(201);
  return resposta.json() as RegistroEsperado;
}

async function criarBaralho(): Promise<string> {
  const resposta = await pedir({
    method: "POST",
    url: "/baralhos",
    payload: { nome: "Inglês" },
  });
  expect(resposta.statusCode).toBe(201);
  return resposta.json().id as string;
}

async function criarCartao(): Promise<void> {
  const resposta = await pedir({
    method: "POST",
    url: "/cartoes",
    payload: { frente: "casa", verso: "house" },
  });
  expect(resposta.statusCode).toBe(201);
}

/** A leitura de Estatísticas com a janela padrão dos cenários. */
function lerEstatisticas(
  desde: string = instanteDeAgora(-UMA_HORA_EM_MILISSEGUNDOS),
) {
  return pedir({
    method: "GET",
    url: `/estatisticas?desde=${encodeURIComponent(desde)}`,
  });
}

describe("POST /sessoes — criação conforme o contrato", () => {
  it("responde 201 com o Registro de sessão e os totais derivados dos Itens (FR-161)", async () => {
    const resposta = await postarSessao(registroCru());

    expect(resposta.statusCode).toBe(201);

    const registro = resposta.json() as RegistroEsperado;
    expect(registro).toEqual({
      id: expect.any(String),
      baralhoId: expect.any(String),
      nomeDoBaralho: "Inglês",
      concluidaEm: expect.any(String),
      estudados: 2,
      acertos: 1,
      erros: 1,
      itens: [
        { posicao: 0, frente: "casa", verso: "house", resultado: "acertou" },
        { posicao: 1, frente: "gato", verso: "cat", resultado: "errou" },
      ],
    });
    expect(Number.isNaN(Date.parse(registro.concluidaEm))).toBe(false);
  });

  it("não precisa que o Baralho exista: guarda o nome como era (FR-165)", async () => {
    const resposta = await postarSessao(
      registroCru({ baralhoId: randomUUID(), nomeDoBaralho: "Baralho excluído" }),
    );

    expect(resposta.statusCode).toBe(201);
    expect(resposta.json().nomeDoBaralho).toBe("Baralho excluído");
  });

  it("ignora propriedade extra, no corpo e no Item, e ela não retorna (FR-018)", async () => {
    const resposta = await postarSessao(
      registroCru({
        observacao: "propriedade que não existe em RegistroDeSessao",
        itens: [
          {
            frente: "casa",
            verso: "house",
            resultado: "acertou",
            extra: "propriedade que não existe em ItemRegistrado",
          },
        ],
      }),
    );

    expect(resposta.statusCode).toBe(201);

    const registro = resposta.json() as RegistroEsperado;
    expect(registro).not.toHaveProperty("observacao");
    expect(registro.itens[0]).not.toHaveProperty("extra");
    expect(registro.itens[0]).toEqual({
      posicao: 0,
      frente: "casa",
      verso: "house",
      resultado: "acertou",
    });
  });
});

describe("POST /sessoes — idempotência pelo id (FR-163)", () => {
  it("reenviar o mesmo registro responde 200, sem duplicar e sem mudar a data", async () => {
    const corpo = registroCru();

    const primeira = await postarSessao(corpo);
    expect(primeira.statusCode).toBe(201);

    await pausa(5);

    const reenvio = await postarSessao(corpo);
    expect(reenvio.statusCode).toBe(200);
    expect(reenvio.json()).toEqual(primeira.json());

    const estatisticas = await lerEstatisticas();
    expect(estatisticas.json().recentes).toHaveLength(1);
  });

  it("guarda o conteúdo da primeira gravação e ignora o reenvio com outro conteúdo", async () => {
    const corpo = registroCru();
    const primeira = await postarSessao(corpo);
    expect(primeira.statusCode).toBe(201);

    await pausa(5);

    const reenvio = await postarSessao(
      registroCru({
        id: corpo.id,
        nomeDoBaralho: "Outro nome",
        itens: [{ frente: "sol", verso: "sun", resultado: "errou" }],
      }),
    );

    expect(reenvio.statusCode).toBe(200);
    expect(reenvio.json()).toEqual(primeira.json());
  });
});

describe("POST /sessoes — recusas de dados inválidos, sem gravar nada", () => {
  const RECUSA = {
    erro: "dados_invalidos",
    mensagem: "Os dados da Sessão são inválidos.",
  };

  it("recusa id fora da forma canônica de UUID com 400 (FR-161)", async () => {
    const resposta = await postarSessao(registroCru({ id: "nao-e-uuid" }));

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA);
  });

  it("recusa Baralho sem identificação com 400 (FR-161)", async () => {
    const resposta = await postarSessao(registroCru({ baralhoId: "   " }));

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA);
  });

  it("recusa nome do Baralho vazio com 400 (FR-161)", async () => {
    const resposta = await postarSessao(registroCru({ nomeDoBaralho: "" }));

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA);
  });

  it("recusa nome do Baralho acima de 100 caracteres com 400 (FR-161)", async () => {
    const resposta = await postarSessao(
      registroCru({ nomeDoBaralho: "a".repeat(101) }),
    );

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA);
  });

  it("recusa lista de Itens vazia com 400 (FR-161)", async () => {
    const resposta = await postarSessao(registroCru({ itens: [] }));

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA);
  });

  it("recusa mais de 1000 Itens com 400 (FR-161)", async () => {
    const itens = Array.from({ length: 1001 }, () => ({
      frente: "casa",
      verso: "house",
      resultado: "acertou",
    }));

    const resposta = await postarSessao(registroCru({ itens }));

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA);
  });

  it("recusa Frente vazia com 400 (FR-161)", async () => {
    const resposta = await postarSessao(
      registroCru({
        itens: [{ frente: "   ", verso: "house", resultado: "acertou" }],
      }),
    );

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA);
  });

  it("recusa Resultado desconhecido com 400 (FR-161)", async () => {
    const resposta = await postarSessao(
      registroCru({
        itens: [{ frente: "casa", verso: "house", resultado: "talvez" }],
      }),
    );

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA);
  });

  it("recusa corpo sem os campos obrigatórios com 400 (FR-161)", async () => {
    const resposta = await postarSessao({});

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA);
  });

  it("recusa campo de tipo errado com 400 (FR-161)", async () => {
    const resposta = await postarSessao(registroCru({ nomeDoBaralho: 42 }));

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA);
  });

  it("recusa Itens que não são lista com 400 (FR-161)", async () => {
    const resposta = await postarSessao(registroCru({ itens: "nada" }));

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA);
  });

  it("recusa requisição sem corpo com 400 (FR-161)", async () => {
    const resposta = await postarSessao();

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA);
  });

  it("não grava nada quando o corpo é recusado (FR-162, FR-164)", async () => {
    await postarSessao(registroCru({ id: "nao-e-uuid" }));
    await postarSessao(registroCru({ itens: [] }));
    await postarSessao(registroCru({ nomeDoBaralho: "" }));

    const estatisticas = await lerEstatisticas();
    expect(estatisticas.json().recentes).toEqual([]);
    expect(estatisticas.json().registrosDaJanela).toEqual([]);
  });
});

describe("Isolamento entre Usuários (FR-166, FR-179)", () => {
  it("o registro de um Usuário é invisível para o outro: 404 (FR-166)", async () => {
    const criado = await registrarSessao();
    const outra = await contrato.cadastrar("outra");

    const resposta = await pedirComCredencial(servidor, outra, {
      method: "GET",
      url: `/sessoes/${criado.id}`,
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      erro: "nao_encontrado",
      mensagem: "Sessão não encontrada.",
    });
  });

  it("reusar o id de outro Usuário é conflito, e não reenvio: 409 (FR-163, FR-166)", async () => {
    const corpo = registroCru();
    expect((await postarSessao(corpo)).statusCode).toBe(201);

    const outra = await contrato.cadastrar("outra");
    const resposta = await pedirComCredencial(servidor, outra, {
      method: "POST",
      url: "/sessoes",
      payload: corpo,
    });

    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toEqual({
      erro: "conflito",
      mensagem: "Esta Sessão já foi registrada por outro Usuário.",
    });
  });

  it("as Estatísticas de um Usuário nunca contam o Histórico do outro (FR-169)", async () => {
    await registrarSessao();
    const outra = await contrato.cadastrar("outra");

    const resposta = await pedirComCredencial(servidor, outra, {
      method: "GET",
      url: `/estatisticas?desde=${encodeURIComponent(
        instanteDeAgora(-UMA_HORA_EM_MILISSEGUNDOS),
      )}`,
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({
      cartoes: 0,
      baralhos: 0,
      registrosDaJanela: [],
      recentes: [],
    });
  });
});

describe("GET /estatisticas — leitura conforme o contrato", () => {
  it("responde 200 com o tamanho do acervo atual e o Histórico (FR-169, FR-170)", async () => {
    await criarCartao();
    await criarCartao();
    await criarBaralho();
    const criado = await registrarSessao();

    const resposta = await lerEstatisticas();

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({
      cartoes: 2,
      baralhos: 1,
      registrosDaJanela: [resumoDe(criado)],
      recentes: [resumoDe(criado)],
    });
  });

  it("a janela de `desde` recorta registrosDaJanela sem mexer nos recentes (FR-169, FR-177)", async () => {
    const criado = await registrarSessao();

    const resposta = await lerEstatisticas(
      instanteDeAgora(UMA_HORA_EM_MILISSEGUNDOS),
    );

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().registrosDaJanela).toEqual([]);
    expect(resposta.json().recentes).toEqual([resumoDe(criado)]);
  });

  it("recentes traz as 5 Sessões mais recentes, da mais nova para a mais antiga (FR-177)", async () => {
    const ids: string[] = [];

    for (let indice = 0; indice < 6; indice += 1) {
      const criado = await registrarSessao();
      ids.push(criado.id);
      await pausa(2);
    }

    const resposta = await lerEstatisticas();
    const recentes = resposta.json().recentes as ResumoEsperado[];

    expect(recentes).toHaveLength(5);
    expect(recentes.map((registro) => registro.id)).toEqual(
      ids.slice(1).reverse(),
    );
  });

  it("recusa `desde` que não é um instante ISO-8601 com 400 (FR-169)", async () => {
    const resposta = await lerEstatisticas("ontem");

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "dados_invalidos",
      mensagem: "Os dados da Sessão são inválidos.",
    });
  });

  it("recusa `desde` há mais de 31 dias com 400 (FR-169)", async () => {
    const resposta = await lerEstatisticas(
      instanteDeAgora(-40 * 24 * UMA_HORA_EM_MILISSEGUNDOS),
    );

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "dados_invalidos",
      mensagem: "Os dados da Sessão são inválidos.",
    });
  });

  it("recusa `desde` ausente com 400, antes do Acervo (FR-169)", async () => {
    const resposta = await pedir({ method: "GET", url: "/estatisticas" });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "dados_invalidos",
      mensagem: "Os dados da Sessão são inválidos.",
    });
  });
});

describe("GET /sessoes/:id — leitura conforme o contrato", () => {
  it("responde 200 com o registro e `baralhoExiste` verdadeiro (FR-177)", async () => {
    const baralhoId = await criarBaralho();
    const criado = await registrarSessao({ baralhoId });

    const resposta = await pedir({
      method: "GET",
      url: `/sessoes/${criado.id}`,
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({
      registro: criado,
      baralhoExiste: true,
    });
  });

  it("depois de o Baralho ser excluído, o registro continua e `baralhoExiste` vira falso (FR-178)", async () => {
    const baralhoId = await criarBaralho();
    const criado = await registrarSessao({ baralhoId });

    const exclusao = await pedir({
      method: "DELETE",
      url: `/baralhos/${baralhoId}`,
    });
    expect(exclusao.statusCode).toBe(204);

    const resposta = await pedir({
      method: "GET",
      url: `/sessoes/${criado.id}`,
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({
      registro: criado,
      baralhoExiste: false,
    });
  });

  it("recusa registro inexistente com 404 (FR-179)", async () => {
    const resposta = await pedir({
      method: "GET",
      url: `/sessoes/${randomUUID()}`,
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      erro: "nao_encontrado",
      mensagem: "Sessão não encontrada.",
    });
  });
});

describe("Sem Credencial, nenhuma rota de Histórico roda (FR-090)", () => {
  it("recusa POST /sessoes com 401", async () => {
    const resposta = await servidor.inject({
      method: "POST",
      url: "/sessoes",
      payload: registroCru(),
    });

    expect(resposta.statusCode).toBe(401);
  });

  it("recusa GET /estatisticas com 401", async () => {
    const resposta = await servidor.inject({
      method: "GET",
      url: `/estatisticas?desde=${encodeURIComponent(
        instanteDeAgora(-UMA_HORA_EM_MILISSEGUNDOS),
      )}`,
    });

    expect(resposta.statusCode).toBe(401);
  });

  it("recusa GET /sessoes/:id com 401", async () => {
    const resposta = await servidor.inject({
      method: "GET",
      url: `/sessoes/${randomUUID()}`,
    });

    expect(resposta.statusCode).toBe(401);
  });
});

describe("Indisponibilidade do armazenamento (FR-173)", () => {
  async function pedirComAcervoIndisponivel(
    requisicao: InjectOptions,
  ): Promise<LightMyRequestResponse> {
    const outro = await montarServidorDeContrato(({ servidor }) => {
      registrarRotasDeSessoes(servidor, () => acervoIndisponivel);
    });

    try {
      return await pedirComCredencial(outro.servidor, outro.credencial, requisicao);
    } finally {
      await outro.encerrar();
    }
  }

  it("POST /sessoes responde 503 quando o armazenamento falha", async () => {
    const resposta = await pedirComAcervoIndisponivel({
      method: "POST",
      url: "/sessoes",
      payload: registroCru(),
    });

    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toEqual({
      erro: "indisponivel",
      mensagem: "O armazenamento está indisponível.",
    });
  });

  it("GET /estatisticas responde 503 quando o armazenamento falha", async () => {
    const resposta = await pedirComAcervoIndisponivel({
      method: "GET",
      url: `/estatisticas?desde=${encodeURIComponent(
        instanteDeAgora(-UMA_HORA_EM_MILISSEGUNDOS),
      )}`,
    });

    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toEqual({
      erro: "indisponivel",
      mensagem: "O armazenamento está indisponível.",
    });
  });

  it("GET /sessoes/:id responde 503 quando o armazenamento falha", async () => {
    const resposta = await pedirComAcervoIndisponivel({
      method: "GET",
      url: `/sessoes/${randomUUID()}`,
    });

    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toEqual({
      erro: "indisponivel",
      mensagem: "O armazenamento está indisponível.",
    });
  });
});
