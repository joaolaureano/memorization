import { randomBytes } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  INDISPONIVEL,
  MENSAGEM_DE_CONFLITO_DE_SESSAO,
  MENSAGEM_DE_DADOS_INVALIDOS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
  MENSAGEM_DE_NAO_AUTENTICADO,
  MENSAGEM_DE_SESSAO_NAO_ENCONTRADA,
  NAO_AUTENTICADO,
} from "../../src/acervo-cliente/cliente";
import type {
  Avaliacao,
  ClienteDoAcervo,
  Credencial,
  DadosDeRegistro,
  Estatisticas,
  RegistroDeSessao,
  RegistroResumido,
} from "../../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../../src/acervo-cliente/cliente-em-memoria";
import { ClienteHttp } from "../../src/acervo-cliente/cliente-http";
import { comGuardaDeCredencial } from "../../src/ui/guarda-de-credencial";

/**
 * T1204 (specs/013-estatisticas-e-historico) — bateria do histórico no cliente
 * do frontend contra os dois Adapters da Seam `ClienteDoAcervo` e a guarda de
 * Credencial.
 *
 * Prova o contrato §4: o mapeamento de cada status HTTP para os modos de erro
 * (FR-161, FR-163), a forma exata das requisições, a idempotência pelo `id` e
 * as derivações do Adapter em memória (FR-164, FR-165, FR-166), e a guarda que
 * descarta a Credencial na recusa por `nao_autenticado` (FR-091).
 */

const ENDERECO_DA_API = "http://127.0.0.1:3001";

/**
 * As tipagens locais de `node:crypto` desta base não exportam `randomUUID`; o
 * identificador aleatório vem do `crypto` global, que é o mesmo usado em tempo
 * de execução.
 */
function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

/** A Credencial de prova: gerada agora, nenhuma Senha literal no arquivo. */
const CREDENCIAL: Credencial = {
  nomeDeUsuario: "usuario.de.prova",
  senha: randomBytes(12).toString("base64url"),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

type RespostaDeTeste = {
  status: number;
  json: () => Promise<unknown>;
};

function respostaDeTeste(status: number, corpo: unknown): RespostaDeTeste {
  return { status, json: async () => corpo };
}

/** O Cartão de teste que os Itens enviados referenciam (FR-196). */
const CARTAO_DE_TESTE = "cartao-1";

/**
 * Um Item do corpo de `registrarSessao`: os dados do Cartão de origem e a
 * Avaliação (FR-196). O `resultado` de dois níveis **não** vem do cliente — é
 * o servidor que o deriva da Avaliação (FR-194).
 */
function itemDe(
  frente: string,
  verso: string,
  avaliacao: Avaliacao,
): { frente: string; verso: string; cartaoId: string; avaliacao: Avaliacao } {
  return { frente, verso, cartaoId: CARTAO_DE_TESTE, avaliacao };
}

function dadosValidos(): DadosDeRegistro {
  return {
    id: randomUUID(),
    origem: "baralho",
    baralhoId: "b1",
    nomeDoBaralho: "Inglês",
    itens: [itemDe("To walk", "Caminhar", "bom")],
  };
}

function desdeAmplo(): string {
  return new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
}

function registroCompleto(): RegistroDeSessao {
  return {
    id: randomUUID(),
    origem: "baralho",
    baralhoId: "b1",
    nomeDoBaralho: "Inglês",
    concluidaEm: "2026-10-02T12:00:00.000Z",
    estudados: 2,
    acertos: 1,
    erros: 1,
    itens: [
      { posicao: 0, frente: "To walk", verso: "Caminhar", resultado: "acertou" },
      { posicao: 1, frente: "To run", verso: "Correr", resultado: "errou" },
    ],
  };
}

function resumo(parcial: Partial<RegistroResumido> = {}): RegistroResumido {
  return {
    id: randomUUID(),
    origem: "baralho",
    baralhoId: "b1",
    nomeDoBaralho: "Inglês",
    concluidaEm: "2026-10-02T12:00:00.000Z",
    estudados: 2,
    acertos: 1,
    erros: 1,
    ...parcial,
  };
}

function clienteEmMemoria(): ClienteEmMemoria {
  return new ClienteEmMemoria(CREDENCIAL, [CREDENCIAL]);
}

function ambienteHttp(resposta: RespostaDeTeste): {
  cliente: ClienteDoAcervo;
  chamadas: { entrada: string; opcoes?: RequestInit }[];
} {
  const chamadas: { entrada: string; opcoes?: RequestInit }[] = [];

  vi.stubGlobal("fetch", async (entrada: unknown, opcoes?: RequestInit) => {
    chamadas.push({ entrada: String(entrada), opcoes });
    return resposta;
  });

  return { cliente: new ClienteHttp(ENDERECO_DA_API, CREDENCIAL), chamadas };
}

function clienteQueFalhaNaRede(): ClienteDoAcervo {
  vi.stubGlobal("fetch", async () => {
    throw new Error("conexão recusada");
  });

  return new ClienteHttp(ENDERECO_DA_API, CREDENCIAL);
}

describe("ClienteHttp — registrarSessao", () => {
  it("aceita 201, devolve o Registro e envia exatamente o corpo do contrato (FR-161)", async () => {
    const registro = registroCompleto();
    const { cliente, chamadas } = ambienteHttp(respostaDeTeste(201, registro));

    const dados: DadosDeRegistro = {
      id: registro.id,
      origem: "baralho",
      baralhoId: "b1",
      nomeDoBaralho: "Inglês",
      itens: [
        itemDe("To walk", "Caminhar", "bom"),
        itemDe("To run", "Correr", "errei"),
      ],
    };

    expect(await cliente.registrarSessao(dados)).toEqual({
      ok: true,
      registro,
    });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.entrada).toBe(`${ENDERECO_DA_API}/sessoes`);
    expect(chamadas[0]?.opcoes?.method).toBe("POST");
    expect(JSON.parse(String(chamadas[0]?.opcoes?.body))).toEqual({
      id: registro.id,
      origem: "baralho",
      baralhoId: "b1",
      nomeDoBaralho: "Inglês",
      itens: [
        {
          frente: "To walk",
          verso: "Caminhar",
          cartaoId: CARTAO_DE_TESTE,
          avaliacao: "bom",
        },
        {
          frente: "To run",
          verso: "Correr",
          cartaoId: CARTAO_DE_TESTE,
          avaliacao: "errei",
        },
      ],
    });
  });

  it("aceita 200 como o mesmo Registro já existente (FR-163)", async () => {
    const registro = registroCompleto();
    const { cliente } = ambienteHttp(respostaDeTeste(200, registro));

    expect(await cliente.registrarSessao(dadosValidos())).toEqual({
      ok: true,
      registro,
    });
  });

  it("trata 201 com corpo fora do contrato como indisponivel", async () => {
    const { cliente } = ambienteHttp(respostaDeTeste(201, { id: "s1" }));

    expect(await cliente.registrarSessao(dadosValidos())).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });
  });

  it("recusa 400 com dados_invalidos como recusa de domínio (FR-161)", async () => {
    const { cliente } = ambienteHttp(
      respostaDeTeste(400, {
        erro: "dados_invalidos",
        mensagem: MENSAGEM_DE_DADOS_INVALIDOS,
      }),
    );

    expect(await cliente.registrarSessao(dadosValidos())).toEqual({
      ok: false,
      erro: "dados_invalidos",
      mensagem: MENSAGEM_DE_DADOS_INVALIDOS,
    });
  });

  it("trata 400 com código fora do contrato como indisponivel", async () => {
    const { cliente } = ambienteHttp(
      respostaDeTeste(400, {
        erro: "corpo_invalido",
        mensagem: "O corpo da requisição não é válido.",
      }),
    );

    expect(await cliente.registrarSessao(dadosValidos())).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });
  });

  it("trata 400 com corpo que não é JSON como indisponivel", async () => {
    const { cliente } = ambienteHttp({
      status: 400,
      json: async () => {
        throw new Error("corpo ilegível");
      },
    });

    expect(await cliente.registrarSessao(dadosValidos())).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });
  });

  it("recusa 409 com conflito como recusa de domínio (FR-163)", async () => {
    const { cliente } = ambienteHttp(
      respostaDeTeste(409, {
        erro: "conflito",
        mensagem: MENSAGEM_DE_CONFLITO_DE_SESSAO,
      }),
    );

    expect(await cliente.registrarSessao(dadosValidos())).toEqual({
      ok: false,
      erro: "conflito",
      mensagem: MENSAGEM_DE_CONFLITO_DE_SESSAO,
    });
  });

  it("trata 409 com código fora do contrato como indisponivel", async () => {
    const { cliente } = ambienteHttp(
      respostaDeTeste(409, {
        erro: "vinculo_duplicado",
        mensagem: "O vínculo já existe.",
      }),
    );

    expect(await cliente.registrarSessao(dadosValidos())).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });
  });

  it("trata 401 como nao_autenticado (FR-090)", async () => {
    const { cliente } = ambienteHttp(
      respostaDeTeste(401, {
        erro: "credencial_invalida",
        mensagem: "Nome de usuário ou Senha incorretos.",
      }),
    );

    expect(await cliente.registrarSessao(dadosValidos())).toEqual({
      ok: false,
      erro: NAO_AUTENTICADO,
      mensagem: MENSAGEM_DE_NAO_AUTENTICADO,
    });
  });

  it("trata 500 como indisponivel (FR-161)", async () => {
    const { cliente } = ambienteHttp(respostaDeTeste(500, "erro interno"));

    expect(await cliente.registrarSessao(dadosValidos())).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });
  });

  it("trata falha de rede como indisponivel", async () => {
    expect(
      await clienteQueFalhaNaRede().registrarSessao(dadosValidos()),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });
  });
});

describe("ClienteHttp — obterEstatisticas", () => {
  it("aceita 200, devolve as Estatisticas e codifica o desde na query (FR-164)", async () => {
    const estatisticas: Estatisticas = {
      cartoes: 3,
      baralhos: 2,
      registrosDaJanela: [resumo({ id: "r1" })],
      recentes: [resumo({ id: "r1" }), resumo({ id: "r2" })],
    };
    const { cliente, chamadas } = ambienteHttp(
      respostaDeTeste(200, estatisticas),
    );

    const desde = "2026-09-26T00:00:00.000Z";

    expect(await cliente.obterEstatisticas(desde)).toEqual({
      ok: true,
      estatisticas,
    });
    expect(chamadas[0]?.entrada).toBe(
      `${ENDERECO_DA_API}/estatisticas?desde=${encodeURIComponent(desde)}`,
    );
  });

  it("trata 200 com corpo fora do contrato como indisponivel", async () => {
    const { cliente } = ambienteHttp(
      respostaDeTeste(200, { cartoes: 3, baralhos: 2 }),
    );

    expect(await cliente.obterEstatisticas(desdeAmplo())).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });
  });

  it("trata 400 como indisponivel: o contrato do cliente não tem dados_invalidos aqui", async () => {
    const { cliente } = ambienteHttp(
      respostaDeTeste(400, {
        erro: "dados_invalidos",
        mensagem: MENSAGEM_DE_DADOS_INVALIDOS,
      }),
    );

    expect(await cliente.obterEstatisticas(desdeAmplo())).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });
  });

  it("trata 401 como nao_autenticado (FR-090)", async () => {
    const { cliente } = ambienteHttp(
      respostaDeTeste(401, {
        erro: "credencial_invalida",
        mensagem: "Nome de usuário ou Senha incorretos.",
      }),
    );

    expect(await cliente.obterEstatisticas(desdeAmplo())).toEqual({
      ok: false,
      erro: NAO_AUTENTICADO,
      mensagem: MENSAGEM_DE_NAO_AUTENTICADO,
    });
  });

  it("trata 500 e falha de rede como indisponivel", async () => {
    const { cliente } = ambienteHttp(respostaDeTeste(500, "erro interno"));

    expect(await cliente.obterEstatisticas(desdeAmplo())).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });
    expect(
      await clienteQueFalhaNaRede().obterEstatisticas(desdeAmplo()),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });
  });
});

describe("ClienteHttp — obterRegistroDeSessao", () => {
  it("aceita 200, devolve o Registro com baralhoExiste e codifica o id (FR-166)", async () => {
    const registro = registroCompleto();
    const { cliente, chamadas } = ambienteHttp(
      respostaDeTeste(200, { registro, baralhoExiste: true }),
    );

    const id = "sessão/1";

    expect(await cliente.obterRegistroDeSessao(id)).toEqual({
      ok: true,
      registro,
      baralhoExiste: true,
    });
    expect(chamadas[0]?.entrada).toBe(
      `${ENDERECO_DA_API}/sessoes/${encodeURIComponent(id)}`,
    );
  });

  it("aceita baralhoExiste false (FR-166)", async () => {
    const registro = registroCompleto();
    const { cliente } = ambienteHttp(
      respostaDeTeste(200, { registro, baralhoExiste: false }),
    );

    expect(await cliente.obterRegistroDeSessao(registro.id)).toEqual({
      ok: true,
      registro,
      baralhoExiste: false,
    });
  });

  it("trata 200 sem baralhoExiste como indisponivel", async () => {
    const { cliente } = ambienteHttp(
      respostaDeTeste(200, { registro: registroCompleto() }),
    );

    expect(await cliente.obterRegistroDeSessao(randomUUID())).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });
  });

  it("recusa 404 com nao_encontrado como recusa de domínio (FR-166)", async () => {
    const { cliente } = ambienteHttp(
      respostaDeTeste(404, {
        erro: "nao_encontrado",
        mensagem: MENSAGEM_DE_SESSAO_NAO_ENCONTRADA,
      }),
    );

    expect(await cliente.obterRegistroDeSessao(randomUUID())).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: MENSAGEM_DE_SESSAO_NAO_ENCONTRADA,
    });
  });

  it("trata 404 com código fora do contrato como indisponivel", async () => {
    const { cliente } = ambienteHttp(
      respostaDeTeste(404, {
        erro: "vinculo_nao_encontrado",
        mensagem: "O vínculo não existe.",
      }),
    );

    expect(await cliente.obterRegistroDeSessao(randomUUID())).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });
  });

  it("trata 401 como nao_autenticado (FR-090)", async () => {
    const { cliente } = ambienteHttp(
      respostaDeTeste(401, {
        erro: "credencial_invalida",
        mensagem: "Nome de usuário ou Senha incorretos.",
      }),
    );

    expect(await cliente.obterRegistroDeSessao(randomUUID())).toEqual({
      ok: false,
      erro: NAO_AUTENTICADO,
      mensagem: MENSAGEM_DE_NAO_AUTENTICADO,
    });
  });

  it("trata 500 e falha de rede como indisponivel", async () => {
    const { cliente } = ambienteHttp(respostaDeTeste(500, "erro interno"));

    expect(await cliente.obterRegistroDeSessao(randomUUID())).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });
    expect(
      await clienteQueFalhaNaRede().obterRegistroDeSessao(randomUUID()),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });
  });
});

describe("ClienteEmMemoria — histórico", () => {
  it("registra a Sessão, deriva os totais e devolve os itens na ordem (FR-161, FR-162)", async () => {
    const cliente = clienteEmMemoria();
    const id = randomUUID();

    const resultado = await cliente.registrarSessao({
      id,
      origem: "baralho",
      baralhoId: "b1",
      nomeDoBaralho: "Inglês",
      itens: [
        itemDe("To walk", "Caminhar", "bom"),
        itemDe("To run", "Correr", "errei"),
        itemDe("To sleep", "Dormir", "bom"),
      ],
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) {
      throw new Error("o registro deveria ser aceito");
    }

    expect(resultado.registro).toMatchObject({
      id,
      baralhoId: "b1",
      nomeDoBaralho: "Inglês",
      estudados: 3,
      acertos: 2,
      erros: 1,
    });
    expect(resultado.registro.itens).toEqual([
      {
        posicao: 0,
        frente: "To walk",
        verso: "Caminhar",
        resultado: "acertou",
        cartaoId: CARTAO_DE_TESTE,
        avaliacao: "bom",
        avaliacaoRotulo: "Bom",
      },
      {
        posicao: 1,
        frente: "To run",
        verso: "Correr",
        resultado: "errou",
        cartaoId: CARTAO_DE_TESTE,
        avaliacao: "errei",
        avaliacaoRotulo: "Errei",
      },
      {
        posicao: 2,
        frente: "To sleep",
        verso: "Dormir",
        resultado: "acertou",
        cartaoId: CARTAO_DE_TESTE,
        avaliacao: "bom",
        avaliacaoRotulo: "Bom",
      },
    ]);
    expect(new Date(resultado.registro.concluidaEm).toISOString()).toBe(
      resultado.registro.concluidaEm,
    );
  });

  it("é idempotente pelo id: o mesmo id devolve o mesmo Registro, sem duplicar (FR-163)", async () => {
    const cliente = clienteEmMemoria();
    const dados: DadosDeRegistro = {
      id: randomUUID(),
      origem: "baralho",
      baralhoId: "b1",
      nomeDoBaralho: "Inglês",
      itens: [itemDe("To walk", "Caminhar", "bom")],
    };

    const primeira = await cliente.registrarSessao(dados);
    const segunda = await cliente.registrarSessao({
      ...dados,
      itens: [itemDe("To run", "Correr", "errei")],
    });

    expect(segunda).toEqual(primeira);

    const estatisticas = await cliente.obterEstatisticas(desdeAmplo());
    if (!estatisticas.ok) {
      throw new Error("as estatísticas deveriam vir");
    }
    expect(estatisticas.estatisticas.registrosDaJanela).toHaveLength(1);
  });

  it("recusa conflito quando o id pertence ao histórico de outro Usuário (FR-163)", async () => {
    const cliente = clienteEmMemoria();
    const outraCredencial: Credencial = {
      nomeDeUsuario: "outro.usuario",
      senha: randomBytes(12).toString("base64url"),
    };
    const cadastro = await cliente.criarUsuario(outraCredencial);
    expect(cadastro.ok).toBe(true);

    const outro = cliente.comoUsuario(outraCredencial);
    const dados: DadosDeRegistro = {
      id: randomUUID(),
      origem: "baralho",
      baralhoId: "b1",
      nomeDoBaralho: "Inglês",
      itens: [itemDe("To walk", "Caminhar", "bom")],
    };

    await cliente.registrarSessao(dados);

    expect(await outro.registrarSessao(dados)).toEqual({
      ok: false,
      erro: "conflito",
      mensagem: MENSAGEM_DE_CONFLITO_DE_SESSAO,
    });
  });

  it("recusa dados fora das invariantes como dados_invalidos, sem gravar nada (FR-161)", async () => {
    const cliente = clienteEmMemoria();

    const idNaoEhUuid: DadosDeRegistro = {
      id: "sessao-1",
      origem: "baralho",
      baralhoId: "b1",
      nomeDoBaralho: "Inglês",
      itens: [itemDe("To walk", "Caminhar", "bom")],
    };
    const semItens: DadosDeRegistro = {
      id: randomUUID(),
      origem: "baralho",
      baralhoId: "b1",
      nomeDoBaralho: "Inglês",
      itens: [],
    };

    const recusa = {
      ok: false,
      erro: "dados_invalidos",
      mensagem: MENSAGEM_DE_DADOS_INVALIDOS,
    };

    expect(await cliente.registrarSessao(idNaoEhUuid)).toEqual(recusa);
    expect(await cliente.registrarSessao(semItens)).toEqual(recusa);

    const estatisticas = await cliente.obterEstatisticas(desdeAmplo());
    if (!estatisticas.ok) {
      throw new Error("as estatísticas deveriam vir");
    }
    expect(estatisticas.estatisticas.registrosDaJanela).toEqual([]);
  });

  it("conta os Cartões e Baralhos atuais e filtra a janela por desde (FR-164)", async () => {
    const cliente = clienteEmMemoria();

    const baralho = await cliente.criarBaralho({ nome: "Inglês" });
    if (baralho.ok) {
      await cliente.criarCartao(baralho.baralho.id, { frente: "To walk", verso: "Caminhar" });
    }
    await cliente.registrarSessao(dadosValidos());

    const dentro = await cliente.obterEstatisticas(desdeAmplo());
    if (!dentro.ok) {
      throw new Error("as estatísticas deveriam vir");
    }
    expect(dentro.estatisticas.cartoes).toBe(1);
    expect(dentro.estatisticas.baralhos).toBe(1);
    expect(dentro.estatisticas.registrosDaJanela).toHaveLength(1);

    const fora = await cliente.obterEstatisticas(
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    );
    if (!fora.ok) {
      throw new Error("as estatísticas deveriam vir");
    }
    expect(fora.estatisticas.registrosDaJanela).toEqual([]);
  });

  it("devolve apenas os 5 Registros mais recentes, do mais recente ao mais antigo (FR-165)", async () => {
    const cliente = clienteEmMemoria();
    const ids: string[] = [];

    for (let indice = 0; indice < 6; indice += 1) {
      const id = randomUUID();
      ids.push(id);
      await cliente.registrarSessao({
        id,
        origem: "baralho",
        baralhoId: "b1",
        nomeDoBaralho: "Inglês",
        itens: [itemDe("To walk", "Caminhar", "bom")],
      });
    }

    const estatisticas = await cliente.obterEstatisticas(desdeAmplo());
    if (!estatisticas.ok) {
      throw new Error("as estatísticas deveriam vir");
    }

    expect(estatisticas.estatisticas.recentes.map((item) => item.id)).toEqual(
      ids.slice(1).reverse(),
    );
  });

  it("informa baralhoExiste pelos Baralhos do dono; o Registro sobrevive à exclusão (FR-166)", async () => {
    const cliente = clienteEmMemoria();
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!baralho.ok) {
      throw new Error("a criação deveria ser aceita");
    }

    const id = randomUUID();

    await cliente.registrarSessao({
      id,
      origem: "baralho",
      baralhoId: baralho.baralho.id,
      nomeDoBaralho: "Inglês",
      itens: [itemDe("To walk", "Caminhar", "bom")],
    });

    const antes = await cliente.obterRegistroDeSessao(id);
    if (!antes.ok) {
      throw new Error("o registro deveria existir");
    }
    expect(antes.baralhoExiste).toBe(true);

    await cliente.excluirBaralho(baralho.baralho.id);

    const depois = await cliente.obterRegistroDeSessao(id);
    if (!depois.ok) {
      throw new Error("o registro deveria sobreviver");
    }
    expect(depois.baralhoExiste).toBe(false);
    expect(depois.registro.nomeDoBaralho).toBe("Inglês");
  });

  it("recusa Registro inexistente como nao_encontrado (FR-166)", async () => {
    const cliente = clienteEmMemoria();

    expect(await cliente.obterRegistroDeSessao(randomUUID())).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: MENSAGEM_DE_SESSAO_NAO_ENCONTRADA,
    });
  });

  it("com a indisponibilidade simulada, as 3 operações falham com a mensagem do histórico (FR-161)", async () => {
    const cliente = clienteEmMemoria();
    cliente.simularIndisponibilidade();

    const recusa = {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    };

    expect(await cliente.registrarSessao(dadosValidos())).toEqual(recusa);
    expect(await cliente.obterEstatisticas(desdeAmplo())).toEqual(recusa);
    expect(await cliente.obterRegistroDeSessao(randomUUID())).toEqual(recusa);
  });

  it("sem Credencial, as 3 operações são recusadas com nao_autenticado (FR-090)", async () => {
    const cliente = new ClienteEmMemoria(null);

    const recusa = {
      ok: false,
      erro: NAO_AUTENTICADO,
      mensagem: MENSAGEM_DE_NAO_AUTENTICADO,
    };

    expect(await cliente.registrarSessao(dadosValidos())).toEqual(recusa);
    expect(await cliente.obterEstatisticas(desdeAmplo())).toEqual(recusa);
    expect(await cliente.obterRegistroDeSessao(randomUUID())).toEqual(recusa);
  });
});

describe("comGuardaDeCredencial — histórico", () => {
  it("avisa e repassa a recusa por nao_autenticado sem apresentá-la como concluída (FR-091)", async () => {
    const mensagens: string[] = [];
    const cliente = comGuardaDeCredencial(
      new ClienteEmMemoria(null),
      (mensagem) => mensagens.push(mensagem),
    );

    const resultado = await cliente.registrarSessao(dadosValidos());

    expect(resultado).toEqual({
      ok: false,
      erro: NAO_AUTENTICADO,
      mensagem: MENSAGEM_DE_NAO_AUTENTICADO,
    });
    expect(mensagens).toEqual([MENSAGEM_DE_NAO_AUTENTICADO]);
  });

  it("não avisa na recusa por indisponivel: ela não é recusa de Credencial", async () => {
    const parado = clienteEmMemoria();
    parado.simularIndisponibilidade();

    const mensagens: string[] = [];
    const cliente = comGuardaDeCredencial(parado, (mensagem) =>
      mensagens.push(mensagem),
    );

    expect(await cliente.obterEstatisticas(desdeAmplo())).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });
    expect(mensagens).toEqual([]);
  });

  it("não avisa quando a operação é bem-sucedida", async () => {
    const mensagens: string[] = [];
    const cliente = comGuardaDeCredencial(clienteEmMemoria(), (mensagem) =>
      mensagens.push(mensagem),
    );

    const resultado = await cliente.registrarSessao(dadosValidos());

    expect(resultado.ok).toBe(true);
    expect(mensagens).toEqual([]);
  });
});
