import type { FastifyInstance, InjectOptions } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { randomBytes } from "node:crypto";

import {
  registrarRotasDeBaralhos,
  registrarRotasDeCartoes,
  registrarRotasDePreferencias,
  registrarRotasDeRevisao,
  registrarRotasDeUsuarios,
} from "../../src/http/rotas.ts";
import { registrarRotasDaAplicacao } from "../../src/http/servidor.ts";
import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";

/**
 * T014 — CORS mínimo para o frontend local
 * (specs/001-criar-cartao/tasks.md).
 *
 * A prova E2E de persistência de T014 usa o frontend real: o navegador o
 * trata como outra origem porque ele roda em outra porta do loopback, e o
 * `fetch` só atravessa origens com os cabeçalhos de CORS. O servidor é
 * montado exatamente como na aplicação — `criarServidor` mais o Adapter HTTP
 * sobre o `Acervo` do Adapter do armazenamento local em memória — e toda
 * asserção atravessa `inject`, a mesma superfície que um cliente HTTP usa.
 */

const ORIGEM_DO_FRONTEND = "http://127.0.0.1:5173";

/** Uma Senha gerada nesta execução, com 16 caracteres — nunca literal. */
function senhaGerada(): string {
  return randomBytes(12).toString("base64url");
}

let servidor: FastifyInstance;
let contrato: ServidorDeContrato;

beforeEach(async () => {
  /**
   * O servidor é montado como na aplicação, agora com o hook que exige a
   * Credencial: o pré-voo e as rotas isentas continuam sem cabeçalho, e as
   * demais chamadas apresentam a Credencial do Usuário que entrou.
   */
  contrato = await montarServidorDeContrato(({ servidor, acervoDe, identidade }) => {
    registrarRotasDeCartoes(servidor, acervoDe);
    registrarRotasDeBaralhos(servidor, acervoDe);
    registrarRotasDeRevisao(servidor, acervoDe);
    registrarRotasDePreferencias(servidor, acervoDe);
    registrarRotasDeUsuarios(servidor, identidade);
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

describe("CORS para o frontend local", () => {
  it("responde ao pré-voo de POST /cartoes com 204 e os cabeçalhos de permissão", async () => {
    const resposta = await pedir({
      method: "OPTIONS",
      url: "/cartoes",
      headers: {
        origin: ORIGEM_DO_FRONTEND,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type, authorization",
      },
    });

    expect(resposta.statusCode).toBe(204);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
    expect(resposta.headers["access-control-allow-methods"]).toContain("POST");
    expect(resposta.headers["access-control-allow-headers"]).toContain(
      "content-type",
    );
    /** Sem `authorization`, o navegador recusaria o `fetch` com Credencial. */
    expect(resposta.headers["access-control-allow-headers"]).toContain(
      "authorization",
    );
  });

  it("responde ao pré-voo de POST /entrar com 204, permitindo authorization e POST (FR-090)", async () => {
    const resposta = await pedir({
      method: "OPTIONS",
      url: "/entrar",
      headers: {
        origin: ORIGEM_DO_FRONTEND,
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization",
      },
    });

    expect(resposta.statusCode).toBe(204);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
    expect(resposta.headers["access-control-allow-methods"]).toContain("POST");
    expect(resposta.headers["access-control-allow-headers"]).toContain(
      "authorization",
    );
  });

  it("permite a leitura da recusa de Credencial: 401 sem Credencial devolve access-control-allow-origin", async () => {
    const resposta = await servidor.inject({ method: "GET", url: "/cartoes" });

    expect(resposta.statusCode).toBe(401);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
  });

  it("permite a leitura da listagem: GET /cartoes devolve access-control-allow-origin", async () => {
    const resposta = await pedir({ method: "GET", url: "/cartoes" });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
  });

  it("permite a leitura da criação concluída: POST 201 devolve access-control-allow-origin", async () => {
    const resposta = await pedir({
      method: "POST",
      url: "/cartoes",
      payload: { frente: "To walk", verso: "Caminhar" },
    });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
  });

  it("permite a leitura até da recusa: POST 400 devolve access-control-allow-origin", async () => {
    const resposta = await pedir({
      method: "POST",
      url: "/cartoes",
      payload: { frente: "", verso: "Caminhar" },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
  });

  it("responde ao pré-voo de POST /baralhos com 204 e os cabeçalhos de permissão", async () => {
    const resposta = await pedir({
      method: "OPTIONS",
      url: "/baralhos",
      headers: {
        origin: ORIGEM_DO_FRONTEND,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });

    expect(resposta.statusCode).toBe(204);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
    expect(resposta.headers["access-control-allow-methods"]).toContain("POST");
    expect(resposta.headers["access-control-allow-headers"]).toContain(
      "content-type",
    );
  });

  it("permite a leitura da listagem: GET /baralhos devolve access-control-allow-origin", async () => {
    const resposta = await pedir({ method: "GET", url: "/baralhos" });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
  });

  it("permite a leitura da criação concluída: POST /baralhos 201 devolve access-control-allow-origin", async () => {
    const resposta = await pedir({
      method: "POST",
      url: "/baralhos",
      payload: { nome: "Inglês" },
    });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
  });

  it("permite a leitura até da recusa: POST /baralhos 400 devolve access-control-allow-origin", async () => {
    const resposta = await pedir({
      method: "POST",
      url: "/baralhos",
      payload: { nome: "" },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
  });

  it("responde ao pré-voo de PUT /cartoes/{id} com 204 e permissão de PUT", async () => {
    const resposta = await pedir({
      method: "OPTIONS",
      url: "/cartoes/c1",
      headers: {
        origin: ORIGEM_DO_FRONTEND,
        "access-control-request-method": "PUT",
        "access-control-request-headers": "content-type",
      },
    });

    expect(resposta.statusCode).toBe(204);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
    expect(resposta.headers["access-control-allow-methods"]).toContain("PUT");
    expect(resposta.headers["access-control-allow-headers"]).toContain(
      "content-type",
    );
  });

  it("responde ao pré-voo de DELETE /cartoes/{id} com 204 e permissão de DELETE", async () => {
    const resposta = await pedir({
      method: "OPTIONS",
      url: "/cartoes/c1",
      headers: {
        origin: ORIGEM_DO_FRONTEND,
        "access-control-request-method": "DELETE",
        "access-control-request-headers": "content-type",
      },
    });

    expect(resposta.statusCode).toBe(204);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
    expect(resposta.headers["access-control-allow-methods"]).toContain("DELETE");
  });

  it("responde ao pré-voo de PUT /baralhos/{id} com 204 e permissão de PUT", async () => {
    const resposta = await pedir({
      method: "OPTIONS",
      url: "/baralhos/b1",
      headers: {
        origin: ORIGEM_DO_FRONTEND,
        "access-control-request-method": "PUT",
        "access-control-request-headers": "content-type",
      },
    });

    expect(resposta.statusCode).toBe(204);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
    expect(resposta.headers["access-control-allow-methods"]).toContain("PUT");
  });

  it("responde ao pré-voo de DELETE /baralhos/{id} com 204 e permissão de DELETE", async () => {
    const resposta = await pedir({
      method: "OPTIONS",
      url: "/baralhos/b1",
      headers: {
        origin: ORIGEM_DO_FRONTEND,
        "access-control-request-method": "DELETE",
        "access-control-request-headers": "content-type",
      },
    });

    expect(resposta.statusCode).toBe(204);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
    expect(resposta.headers["access-control-allow-methods"]).toContain("DELETE");
  });

  it("responde ao pré-voo de POST /baralhos/{id}/vinculos com 204 e permissão de POST", async () => {
    const resposta = await pedir({
      method: "OPTIONS",
      url: "/baralhos/b1/vinculos",
      headers: {
        origin: ORIGEM_DO_FRONTEND,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });

    expect(resposta.statusCode).toBe(204);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
    expect(resposta.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("responde ao pré-voo de DELETE /baralhos/{id}/vinculos/{cartaoId} com 204 e permissão de DELETE", async () => {
    const resposta = await pedir({
      method: "OPTIONS",
      url: "/baralhos/b1/vinculos/c1",
      headers: {
        origin: ORIGEM_DO_FRONTEND,
        "access-control-request-method": "DELETE",
        "access-control-request-headers": "content-type",
      },
    });

    expect(resposta.statusCode).toBe(204);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
    expect(resposta.headers["access-control-allow-methods"]).toContain("DELETE");
  });

  it("permite a leitura de caminho parametrizado: GET /baralhos/{id} devolve access-control-allow-origin", async () => {
    const resposta = await pedir({
      method: "GET",
      url: "/baralhos/baralho-inexistente",
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
  });

  it("responde ao pré-voo de POST /usuarios com 204 e os cabeçalhos de permissão", async () => {
    const resposta = await pedir({
      method: "OPTIONS",
      url: "/usuarios",
      headers: {
        origin: ORIGEM_DO_FRONTEND,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });

    expect(resposta.statusCode).toBe(204);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
    expect(resposta.headers["access-control-allow-methods"]).toContain("POST");
    expect(resposta.headers["access-control-allow-headers"]).toContain(
      "content-type",
    );
  });

  it("permite a leitura do Cadastro concluído: POST /usuarios 201 devolve access-control-allow-origin", async () => {
    const resposta = await pedir({
      method: "POST",
      url: "/usuarios",
      payload: { nomeDeUsuario: "Bruno.Souza", senha: senhaGerada() },
    });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
  });

  it("permite a leitura até da recusa: POST /usuarios 400 devolve access-control-allow-origin", async () => {
    const resposta = await pedir({
      method: "POST",
      url: "/usuarios",
      payload: { nomeDeUsuario: "ab", senha: senhaGerada() },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
  });

  it("não altera rotas alheias: GET /health segue sem cabeçalho de CORS", async () => {
    const resposta = await pedir({ method: "GET", url: "/health" });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("responde ao pré-voo de POST /previas com 204 e lê a resposta com access-control-allow-origin (FR-221)", async () => {
    const preVoo = await pedir({
      method: "OPTIONS",
      url: "/previas",
      headers: {
        origin: ORIGEM_DO_FRONTEND,
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization",
      },
    });

    expect(preVoo.statusCode).toBe(204);
    expect(preVoo.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
    expect(preVoo.headers["access-control-allow-methods"]).toContain("POST");
    expect(preVoo.headers["access-control-allow-headers"]).toContain(
      "authorization",
    );

    const resposta = await pedir({
      method: "POST",
      url: "/previas",
      payload: { cartaoIds: [] },
    });

    /** A recusa de domínio também precisa ser legível do navegador (FR-044). */
    expect(resposta.statusCode).not.toBe(404);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
  });

  it("responde ao pré-voo de GET /preferencias com 204 e lê as Preferências com access-control-allow-origin (FR-212)", async () => {
    const preVoo = await pedir({
      method: "OPTIONS",
      url: "/preferencias",
      headers: {
        origin: ORIGEM_DO_FRONTEND,
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization",
      },
    });

    expect(preVoo.statusCode).toBe(204);
    expect(preVoo.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
    expect(preVoo.headers["access-control-allow-methods"]).toContain("GET");
    expect(preVoo.headers["access-control-allow-headers"]).toContain(
      "authorization",
    );

    const resposta = await pedir({ method: "GET", url: "/preferencias" });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
  });

  it("responde ao pré-voo de PUT /preferencias com 204 e salva as Preferências com access-control-allow-origin (FR-213)", async () => {
    const preVoo = await pedir({
      method: "OPTIONS",
      url: "/preferencias",
      headers: {
        origin: ORIGEM_DO_FRONTEND,
        "access-control-request-method": "PUT",
        "access-control-request-headers": "authorization",
      },
    });

    expect(preVoo.statusCode).toBe(204);
    expect(preVoo.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
    expect(preVoo.headers["access-control-allow-methods"]).toContain("PUT");
    expect(preVoo.headers["access-control-allow-headers"]).toContain(
      "authorization",
    );

    /** O `PUT` reenvia as Preferências atuais, para exercitar o caminho de sucesso. */
    const atuais = await pedir({ method: "GET", url: "/preferencias" });
    expect(atuais.statusCode).toBe(200);
    const { algoritmo } = atuais.json();

    const resposta = await pedir({
      method: "PUT",
      url: "/preferencias",
      payload: { algoritmo },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
  });
});

/**
 * Guarda de CORS (T-c8): a lista de caminhos com pré-voo e cabeçalho
 * permissivo vive em `criarServidor`, separada de `registrarRotasDaAplicacao`.
 * Esta prova percorre **todas** as rotas efetivamente registradas pela
 * aplicação e exige o pré-voo de cada uma, de modo que uma rota nova — como as
 * da `015` foram um dia — não passe esquecida sem CORS (FR-128, SC-056).
 */
describe("guarda: toda rota da aplicação tem pré-voo permitido (T-c8)", () => {
  it("responde ao pré-voo de cada rota registrada por registrarRotasDaAplicacao com 204 e os cabeçalhos de CORS", async () => {
    const rotas: string[] = [];

    const aplicacao = await montarServidorDeContrato(
      ({ servidor, acervoDe, identidade, acessos }) => {
        /** Captura cada rota que a aplicação registra, antes de registrá-las. */
        servidor.addHook("onRoute", (rota) => {
          rotas.push(rota.path);
        });

        registrarRotasDaAplicacao(servidor, identidade, acervoDe, acessos);
      },
    );

    try {
      expect(rotas.length).toBeGreaterThan(0);

      for (const caminho of rotas) {
        const resposta = await pedirComCredencial(
          aplicacao.servidor,
          aplicacao.credencial,
          {
            method: "OPTIONS",
            url: caminho,
            headers: {
              origin: ORIGEM_DO_FRONTEND,
              "access-control-request-method": "GET",
              "access-control-request-headers": "authorization",
            },
          },
        );

        expect(resposta.statusCode, `pré-voo de ${caminho}`).toBe(204);
        expect(
          resposta.headers["access-control-allow-origin"],
          `origem de ${caminho}`,
        ).toBe(ORIGEM_DO_FRONTEND);
        expect(
          resposta.headers["access-control-allow-credentials"],
          `credenciais de ${caminho}`,
        ).toBe("true");
      }
    } finally {
      await aplicacao.encerrar();
    }
  });
});

/**
 * 018, §4 — com `credentials: include` o navegador recusa
 * `Access-Control-Allow-Origin: *`: a política de outra origem nomeia a origem
 * exata do frontend e concede credenciais. As rotas do Acesso temporário entram
 * na mesma lista de pré-voo.
 */
describe("CORS com credenciais para o Acesso temporário (018, §4)", () => {
  it("nunca responde com * e concede credenciais, no pré-voo e na resposta, de cada rota do Acesso", async () => {
    for (const [metodo, caminho] of [
      ["GET", "/acesso"],
      ["POST", "/acesso/renovar"],
      ["POST", "/sair"],
      ["POST", "/entrar"],
    ] as const) {
      const preVoo = await servidor.inject({
        method: "OPTIONS",
        url: caminho,
        headers: {
          origin: ORIGEM_DO_FRONTEND,
          "access-control-request-method": metodo,
          "access-control-request-headers": "content-type",
        },
      });

      expect(preVoo.statusCode, `pré-voo de ${caminho}`).toBe(204);
      expect(preVoo.headers["access-control-allow-origin"]).toBe(
        ORIGEM_DO_FRONTEND,
      );
      expect(preVoo.headers["access-control-allow-credentials"]).toBe("true");
      expect(preVoo.headers["vary"]).toContain("origin");
    }
  });

  it("a resposta de uma rota do Acesso, inclusive a recusa, carrega a origem e as credenciais", async () => {
    const resposta = await servidor.inject({ method: "GET", url: "/cartoes" });

    expect(resposta.statusCode).toBe(401);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
    expect(resposta.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("usa a origem configurada, e não a padrão, quando ela é informada", async () => {
    const configurado = await montarServidorDeContrato(
      ({ servidor, acervoDe, identidade, acessos }) => {
        registrarRotasDaAplicacao(servidor, identidade, acervoDe, acessos);
      },
      { origemDoFrontend: "http://127.0.0.1:4999" },
    );

    try {
      const resposta = await configurado.servidor.inject({
        method: "OPTIONS",
        url: "/acesso",
        headers: { origin: "http://127.0.0.1:4999" },
      });

      expect(resposta.headers["access-control-allow-origin"]).toBe(
        "http://127.0.0.1:4999",
      );
    } finally {
      await configurado.encerrar();
    }
  });

  it("só com qualquerOrigemLocal aceita outra porta do loopback, e nunca origem de fora", async () => {
    const aberto = await montarServidorDeContrato(
      ({ servidor, acervoDe, identidade, acessos }) => {
        registrarRotasDaAplicacao(servidor, identidade, acervoDe, acessos);
      },
      { qualquerOrigemLocal: true },
    );

    try {
      const local = await aberto.servidor.inject({
        method: "OPTIONS",
        url: "/acesso",
        headers: { origin: "http://127.0.0.1:43210" },
      });
      const externa = await aberto.servidor.inject({
        method: "OPTIONS",
        url: "/acesso",
        headers: { origin: "https://exemplo.com" },
      });

      expect(local.headers["access-control-allow-origin"]).toBe(
        "http://127.0.0.1:43210",
      );
      expect(externa.headers["access-control-allow-origin"]).toBe(
        ORIGEM_DO_FRONTEND,
      );
    } finally {
      await aberto.encerrar();
    }
  });

  it("sem a opção, outra porta do loopback não é aceita", async () => {
    const resposta = await servidor.inject({
      method: "OPTIONS",
      url: "/acesso",
      headers: { origin: "http://127.0.0.1:43210" },
    });

    expect(resposta.headers["access-control-allow-origin"]).toBe(
      ORIGEM_DO_FRONTEND,
    );
  });
});

/**
 * T1003 — a política permissiva de outra origem é uma **opção** da mesma
 * construção de servidor, e a Função da nuvem a desliga (FR-128, SC-056).
 *
 * Com `politicaDeOutraOrigem: false` nem o pré-voo nem o cabeçalho permissivo
 * existem: a ausência é **por construção**, e não limpeza posterior — em
 * produção o SPA e a API dividem a origem do CloudFront, e o navegador não faz
 * pré-voo de outra origem. O mesmo cenário com o padrão continua permissivo,
 * como hoje, e é o que os cenários acima provam. Nenhuma rota, hook ou
 * tratamento de erro é duplicado: é o mesmo `criarServidor`.
 */
describe("política de outra origem desligada (T1003, FR-128, SC-056)", () => {
  let producao: ServidorDeContrato;

  beforeEach(async () => {
    producao = await montarServidorDeContrato(
      ({ servidor, acervoDe, identidade }) => {
        registrarRotasDeCartoes(servidor, acervoDe);
        registrarRotasDeBaralhos(servidor, acervoDe);
        registrarRotasDeUsuarios(servidor, identidade);
      },
      { politicaDeOutraOrigem: false },
    );
  });

  afterEach(async () => {
    await producao.encerrar();
  });

  /** Envia a requisição com a Credencial do Usuário que entrou (FR-090). */
  function pedirNaProducao(requisicao: InjectOptions) {
    return pedirComCredencial(
      producao.servidor,
      producao.credencial,
      requisicao,
    );
  }

  /** Nenhum cabeçalho permissivo de outra origem — em nenhuma resposta. */
  function exigirSemPermissivos(resposta: { headers: Record<string, unknown> }) {
    const permissivos = Object.keys(resposta.headers).filter((cabecalho) =>
      cabecalho.toLowerCase().startsWith("access-control-"),
    );

    expect(permissivos).toEqual([]);
  }

  it("não responde ao pré-voo de outra origem", async () => {
    const resposta = await pedirNaProducao({
      method: "OPTIONS",
      url: "/cartoes",
      headers: {
        origin: ORIGEM_DO_FRONTEND,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type, authorization",
      },
    });

    expect(resposta.statusCode).not.toBe(204);
    exigirSemPermissivos(resposta);
  });

  it("não envia cabeçalho permissivo na listagem concluída", async () => {
    const resposta = await pedirNaProducao({ method: "GET", url: "/cartoes" });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers["access-control-allow-origin"]).toBeUndefined();
    exigirSemPermissivos(resposta);
  });

  it("não envia cabeçalho permissivo na criação concluída", async () => {
    const resposta = await pedirNaProducao({
      method: "POST",
      url: "/cartoes",
      payload: { frente: "To walk", verso: "Caminhar" },
    });

    expect(resposta.statusCode).toBe(201);
    exigirSemPermissivos(resposta);
  });

  it("não envia cabeçalho permissivo na recusa de forma", async () => {
    const resposta = await pedirNaProducao({
      method: "POST",
      url: "/cartoes",
      payload: { frente: "", verso: "Caminhar" },
    });

    expect(resposta.statusCode).toBe(400);
    exigirSemPermissivos(resposta);
  });

  it("não envia cabeçalho permissivo na recusa de Credencial", async () => {
    const resposta = await producao.servidor.inject({
      method: "GET",
      url: "/cartoes",
    });

    expect(resposta.statusCode).toBe(401);
    exigirSemPermissivos(resposta);
  });

  it("não envia cabeçalho permissivo no Cadastro, que é isento de Credencial", async () => {
    const resposta = await producao.servidor.inject({
      method: "POST",
      url: "/usuarios",
      payload: { nomeDeUsuario: "Bruno.Souza", senha: senhaGerada() },
    });

    expect(resposta.statusCode).toBe(201);
    exigirSemPermissivos(resposta);
  });

  it("mantém as rotas iguais às do servidor local, mudando só a política de origem", async () => {
    /** A recusa de forma é determinística, e é a mesma nas duas construções. */
    const recusa: InjectOptions = {
      method: "POST",
      url: "/baralhos",
      payload: { nome: "" },
    };

    const local = await pedir(recusa);
    const daProducao = await pedirNaProducao(recusa);

    expect(daProducao.statusCode).toBe(local.statusCode);
    expect(daProducao.body).toBe(local.body);

    /** E o sucesso continua sendo o de sempre: 201 com o Baralho criado. */
    const criacao: InjectOptions = {
      method: "POST",
      url: "/baralhos",
      payload: { nome: "Inglês" },
    };

    const criadoLocal = await pedir(criacao);
    const criadoNaProducao = await pedirNaProducao(criacao);

    expect(criadoNaProducao.statusCode).toBe(criadoLocal.statusCode);
    expect(criadoNaProducao.json()).toMatchObject({ nome: "Inglês" });
  });
});
