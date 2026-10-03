import type { LightMyRequestResponse } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registrarRotasDaAplicacao } from "../../src/http/servidor.ts";
import { senhaGerada } from "../armazenamento/usuarios-de-teste.ts";
import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";

/**
 * T1808 — o contrato HTTP do Acesso temporário (018, §2 e §3): `POST /entrar`
 * estendido, `GET /acesso`, `POST /acesso/renovar`, `POST /sair` e o hook que
 * aceita o Acesso do cookie **ou** a Credencial Basic. Status e códigos
 * literais — `200/204/401/503`, `acesso_expirado`, `sem_acesso` —, as marcas do
 * cookie e a ausência do Acesso no corpo (FR-289..FR-301, FR-305, FR-306).
 */

let contrato: ServidorDeContrato;
let instante: number;

beforeEach(async () => {
  instante = Date.parse("2026-03-01T12:00:00.000Z");
  contrato = await montarServidorDeContrato(
    ({ servidor, acervoDe, identidade, acessos }) => {
      registrarRotasDaAplicacao(servidor, identidade, acervoDe, acessos);
    },
    {},
    { validadeEmSegundos: 300, agora: () => new Date(instante) },
  );
});

afterEach(async () => {
  await contrato.encerrar();
});

/** O valor do cookie `acesso` que a resposta entrega, ou `null`. */
function valorEntregue(resposta: LightMyRequestResponse): string | null {
  const cabecalho = resposta.headers["set-cookie"];
  const cookie = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
  const encontrado = /^acesso=([^;]+);/.exec(cookie ?? "");

  return encontrado?.[1] ?? null;
}

function cookieDe(valor: string): Record<string, string> {
  return { cookie: `acesso=${valor}` };
}

/** Entra com a Credencial e devolve o valor do Acesso entregue. */
async function entrarComAcesso(
  continuarConectado?: boolean,
  cookieAtual?: string,
): Promise<{ resposta: LightMyRequestResponse; valor: string | null }> {
  const resposta = await contrato.servidor.inject({
    method: "POST",
    url: "/entrar",
    headers: {
      ...contrato.credencial.cabecalho,
      ...(cookieAtual === undefined ? {} : cookieDe(cookieAtual)),
    },
    ...(continuarConectado === undefined
      ? {}
      : { payload: { continuarConectado } }),
  });

  return { resposta, valor: valorEntregue(resposta) };
}

describe("POST /entrar com Acesso temporário (§2.1)", () => {
  it("emite o Acesso em cookie, nunca no corpo, e responde 200 (FR-289, FR-297)", async () => {
    const { resposta, valor } = await entrarComAcesso();

    expect(resposta.statusCode).toBe(200);
    expect(valor).not.toBeNull();
    expect(resposta.json()).toEqual({
      id: contrato.credencial.id,
      nomeDeUsuario: contrato.credencial.nomeDeUsuario,
    });
    expect(resposta.body).not.toContain(valor ?? "inexistente");
    expect(String(resposta.headers["set-cookie"])).toBe(
      `acesso=${valor}; HttpOnly; SameSite=Strict; Path=/; Max-Age=34560000`,
    );
  });

  it("aceita a Credencial no corpo, como o contrato descreve", async () => {
    const resposta = await contrato.servidor.inject({
      method: "POST",
      url: "/entrar",
      payload: {
        nomeDeUsuario: contrato.credencial.nomeDeUsuario,
        senha: contrato.credencial.senha,
      },
    });

    expect(resposta.statusCode).toBe(200);
    expect(valorEntregue(resposta)).not.toBeNull();
  });

  it("recusa Credencial errada no corpo com 401 e sem cookie", async () => {
    const resposta = await contrato.servidor.inject({
      method: "POST",
      url: "/entrar",
      payload: {
        nomeDeUsuario: contrato.credencial.nomeDeUsuario,
        senha: senhaGerada(),
      },
    });

    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toMatchObject({ erro: "credencial_invalida" });
    expect(resposta.headers["set-cookie"]).toBeUndefined();
  });

  it("um novo Entrar substitui o Acesso do mesmo navegador (A2)", async () => {
    const primeiro = await entrarComAcesso();
    const segundo = await entrarComAcesso(undefined, primeiro.valor ?? "");

    expect(segundo.valor).not.toBeNull();
    expect(segundo.valor).not.toBe(primeiro.valor);

    const antigo = await contrato.servidor.inject({
      method: "GET",
      url: "/acesso",
      headers: cookieDe(primeiro.valor ?? ""),
    });
    const novo = await contrato.servidor.inject({
      method: "GET",
      url: "/acesso",
      headers: cookieDe(segundo.valor ?? ""),
    });

    expect(antigo.statusCode).toBe(401);
    expect(novo.statusCode).toBe(200);
  });

  it("com continuarConectado falso, revoga e limpa o Acesso atual e não emite outro (FR-292)", async () => {
    const primeiro = await entrarComAcesso();
    const sem = await entrarComAcesso(false, primeiro.valor ?? "");

    expect(sem.resposta.statusCode).toBe(200);
    expect(String(sem.resposta.headers["set-cookie"])).toMatch(
      /^acesso=; .*Max-Age=0/,
    );

    const antigo = await contrato.servidor.inject({
      method: "GET",
      url: "/acesso",
      headers: cookieDe(primeiro.valor ?? ""),
    });

    expect(antigo.statusCode).toBe(401);
  });

  it("com continuarConectado falso e sem cookie, não mexe em cookie algum", async () => {
    const { resposta } = await entrarComAcesso(false);

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers["set-cookie"]).toBeUndefined();
  });

  it("recusa continuarConectado que não é booleano como corpo inválido", async () => {
    const resposta = await contrato.servidor.inject({
      method: "POST",
      url: "/entrar",
      headers: contrato.credencial.cabecalho,
      payload: { continuarConectado: "sim" },
    });

    expect(resposta.statusCode).toBe(400);
  });

  it("responde 503 quando o armazenamento falha ao emitir, sem cookie (FR-301)", async () => {
    contrato.aberto.acessos.criar = async () => ({
      ok: false,
      erro: "indisponivel",
    });

    const { resposta } = await entrarComAcesso();

    expect(resposta.statusCode).toBe(503);
    expect(resposta.headers["set-cookie"]).toBeUndefined();
  });
});

describe("GET /acesso (§2.2)", () => {
  it("responde 200 com o Nome de usuário quando o Acesso vale (FR-290)", async () => {
    const { valor } = await entrarComAcesso();
    const resposta = await contrato.servidor.inject({
      method: "GET",
      url: "/acesso",
      headers: cookieDe(valor ?? ""),
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({
      nomeDeUsuario: contrato.credencial.nomeDeUsuario,
    });
    expect(resposta.body).not.toContain(valor ?? "inexistente");
  });

  it("responde 401 sem_acesso e limpa o cookie quando não há Acesso (A3)", async () => {
    for (const headers of [{}, cookieDe("desconhecido")]) {
      const resposta = await contrato.servidor.inject({
        method: "GET",
        url: "/acesso",
        headers,
      });

      expect(resposta.statusCode).toBe(401);
      expect(resposta.json()).toMatchObject({ erro: "sem_acesso" });
      expect(String(resposta.headers["set-cookie"])).toMatch(
        /^acesso=; .*Max-Age=0/,
      );
    }
  });

  it("responde 401 acesso_expirado com a mensagem exata e limpa o cookie (FR-294)", async () => {
    const { valor } = await entrarComAcesso();

    instante += 301_000;

    const resposta = await contrato.servidor.inject({
      method: "GET",
      url: "/acesso",
      headers: cookieDe(valor ?? ""),
    });

    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toEqual({
      erro: "acesso_expirado",
      mensagem: "Seu acesso expirou. Entre novamente.",
    });
    expect(String(resposta.headers["set-cookie"])).toMatch(
      /^acesso=; .*Max-Age=0/,
    );
  });

  it("responde 503 e NÃO limpa o cookie quando o armazenamento falha (FR-301)", async () => {
    const { valor } = await entrarComAcesso();

    contrato.aberto.acessos.obterValido = async () => ({
      ok: false,
      erro: "indisponivel",
    });

    const resposta = await contrato.servidor.inject({
      method: "GET",
      url: "/acesso",
      headers: cookieDe(valor ?? ""),
    });

    expect(resposta.statusCode).toBe(503);
    expect(resposta.headers["set-cookie"]).toBeUndefined();
  });
});

describe("POST /acesso/renovar (§2.3)", () => {
  it("responde 204 e mantém o Acesso vivo enquanto houver ação (FR-291)", async () => {
    const { valor } = await entrarComAcesso();

    for (let passo = 0; passo < 3; passo += 1) {
      instante += 4 * 60_000;

      const resposta = await contrato.servidor.inject({
        method: "POST",
        url: "/acesso/renovar",
        headers: cookieDe(valor ?? ""),
      });

      expect(resposta.statusCode).toBe(204);
    }

    // 12 minutos depois do Entrar, o Acesso segue valendo.
    const vivo = await contrato.servidor.inject({
      method: "GET",
      url: "/acesso",
      headers: cookieDe(valor ?? ""),
    });

    expect(vivo.statusCode).toBe(200);
  });

  it("responde 401 acesso_expirado, 401 sem_acesso e 503 sem limpar em falha (FR-294, FR-301)", async () => {
    const { valor } = await entrarComAcesso();

    const semAcesso = await contrato.servidor.inject({
      method: "POST",
      url: "/acesso/renovar",
    });

    expect(semAcesso.statusCode).toBe(401);
    expect(semAcesso.json()).toMatchObject({ erro: "sem_acesso" });
    expect(String(semAcesso.headers["set-cookie"])).toMatch(/Max-Age=0/);

    contrato.aberto.acessos.obterValido = async () => ({
      ok: false,
      erro: "indisponivel",
    });

    const indisponivel = await contrato.servidor.inject({
      method: "POST",
      url: "/acesso/renovar",
      headers: cookieDe(valor ?? ""),
    });

    expect(indisponivel.statusCode).toBe(503);
    expect(indisponivel.headers["set-cookie"]).toBeUndefined();
  });

  it("responde 401 acesso_expirado depois da ociosidade", async () => {
    const { valor } = await entrarComAcesso();

    instante += 300_000;

    const resposta = await contrato.servidor.inject({
      method: "POST",
      url: "/acesso/renovar",
      headers: cookieDe(valor ?? ""),
    });

    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toMatchObject({ erro: "acesso_expirado" });
  });
});

describe("POST /sair (§2.4)", () => {
  it("responde 204, encerra o Acesso e limpa o cookie; o encerrado não volta a valer (FR-293, FR-295)", async () => {
    const { valor } = await entrarComAcesso();
    const saida = await contrato.servidor.inject({
      method: "POST",
      url: "/sair",
      headers: cookieDe(valor ?? ""),
    });

    expect(saida.statusCode).toBe(204);
    expect(String(saida.headers["set-cookie"])).toMatch(/^acesso=; .*Max-Age=0/);

    // Mesmo copiado antes de Sair, o Acesso encerrado é recusado (FR-295).
    const reutilizado = await contrato.servidor.inject({
      method: "GET",
      url: "/cartoes",
      headers: cookieDe(valor ?? ""),
    });

    expect(reutilizado.statusCode).toBe(401);
  });

  it("é idempotente e responde 204 mesmo sem Acesso", async () => {
    const resposta = await contrato.servidor.inject({
      method: "POST",
      url: "/sair",
    });

    expect(resposta.statusCode).toBe(204);
  });

  it("responde 503 quando o armazenamento falha, sem apresentar sucesso", async () => {
    const { valor } = await entrarComAcesso();

    contrato.aberto.acessos.encerrar = async () => ({
      ok: false,
      erro: "indisponivel",
    });

    const resposta = await contrato.servidor.inject({
      method: "POST",
      url: "/sair",
      headers: cookieDe(valor ?? ""),
    });

    expect(resposta.statusCode).toBe(503);
    expect(resposta.headers["set-cookie"]).toBeUndefined();
  });

  it("encerra só o navegador que saiu: o outro Acesso segue valendo (FR-299)", async () => {
    const um = await entrarComAcesso();
    const outro = await entrarComAcesso();

    await contrato.servidor.inject({
      method: "POST",
      url: "/sair",
      headers: cookieDe(um.valor ?? ""),
    });

    const doOutro = await contrato.servidor.inject({
      method: "GET",
      url: "/cartoes",
      headers: cookieDe(outro.valor ?? ""),
    });

    expect(doOutro.statusCode).toBe(200);
  });
});

describe("hook de Credencial com Acesso (§3)", () => {
  it("autoriza o acervo só pelo Acesso, sem Credencial Basic (FR-090 revisado)", async () => {
    const { valor } = await entrarComAcesso();
    const resposta = await contrato.servidor.inject({
      method: "POST",
      url: "/cartoes",
      headers: cookieDe(valor ?? ""),
      payload: { frente: "To walk", verso: "Caminhar" },
    });

    expect(resposta.statusCode).toBe(201);

    // O cartão pertence ao dono do Acesso.
    const lista = await pedirComCredencial(
      contrato.servidor,
      contrato.credencial,
      { method: "GET", url: "/cartoes" },
    );

    expect(lista.json()).toHaveLength(1);
  });

  it("cada ação renova o Acesso: o uso contínuo ultrapassa os 5 minutos (FR-291)", async () => {
    const { valor } = await entrarComAcesso();

    for (let passo = 0; passo < 4; passo += 1) {
      instante += 4 * 60_000;

      const resposta = await contrato.servidor.inject({
        method: "GET",
        url: "/cartoes",
        headers: cookieDe(valor ?? ""),
      });

      expect(resposta.statusCode).toBe(200);
    }
  });

  it("recusa Acesso expirado com 401 acesso_expirado e limpa o cookie (FR-294)", async () => {
    const { valor } = await entrarComAcesso();

    instante += 301_000;

    const resposta = await contrato.servidor.inject({
      method: "GET",
      url: "/cartoes",
      headers: cookieDe(valor ?? ""),
    });

    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toMatchObject({ erro: "acesso_expirado" });
    expect(String(resposta.headers["set-cookie"])).toMatch(/Max-Age=0/);
  });

  it("Acesso desconhecido cai para a Credencial Basic; sem ela, credencial_invalida", async () => {
    const comBasic = await contrato.servidor.inject({
      method: "GET",
      url: "/cartoes",
      headers: { ...cookieDe("desconhecido"), ...contrato.credencial.cabecalho },
    });
    const semBasic = await contrato.servidor.inject({
      method: "GET",
      url: "/cartoes",
      headers: cookieDe("desconhecido"),
    });

    expect(comBasic.statusCode).toBe(200);
    expect(semBasic.statusCode).toBe(401);
    expect(semBasic.json()).toMatchObject({ erro: "credencial_invalida" });
  });

  it("responde 503 e NÃO limpa o cookie quando o armazenamento falha (FR-301)", async () => {
    const { valor } = await entrarComAcesso();

    contrato.aberto.acessos.obterValido = async () => ({
      ok: false,
      erro: "indisponivel",
    });

    const resposta = await contrato.servidor.inject({
      method: "GET",
      url: "/cartoes",
      headers: cookieDe(valor ?? ""),
    });

    expect(resposta.statusCode).toBe(503);
    expect(resposta.headers["set-cookie"]).toBeUndefined();
  });

  it("o Acesso de um Usuário nunca alcança o acervo de outro (FR-298, SC-117)", async () => {
    const bruno = await contrato.cadastrar("bruno.souza");

    await pedirComCredencial(contrato.servidor, bruno, {
      method: "POST",
      url: "/cartoes",
      payload: { frente: "To run", verso: "Correr" },
    });

    const { valor } = await entrarComAcesso();
    const lista = await contrato.servidor.inject({
      method: "GET",
      url: "/cartoes",
      headers: cookieDe(valor ?? ""),
    });

    expect(lista.json()).toEqual([]);
  });

  it("o Acesso nunca aparece em URL, corpo de erro ou cabeçalho de resposta além do Set-Cookie (FR-297, FR-305)", async () => {
    const { valor } = await entrarComAcesso();
    const resposta = await contrato.servidor.inject({
      method: "GET",
      url: "/acesso",
      headers: cookieDe(valor ?? ""),
    });

    expect(resposta.body).not.toContain(valor ?? "inexistente");

    for (const [cabecalho, conteudo] of Object.entries(resposta.headers)) {
      expect(`${cabecalho}: ${String(conteudo)}`).not.toContain(valor ?? "inexistente");
    }
  });
});

describe("integração com a conta (017, §5; FR-296, SC-120)", () => {
  async function navegadores() {
    const a = await entrarComAcesso();
    const b = await entrarComAcesso();

    return { a: a.valor ?? "", b: b.valor ?? "" };
  }

  it("trocar a Senha por Acesso encerra todos, emite um novo ao navegador da troca e recusa o outro", async () => {
    const { a, b } = await navegadores();
    const nova = senhaGerada();
    const resposta = await contrato.servidor.inject({
      method: "PUT",
      url: "/conta/senha",
      headers: cookieDe(a),
      payload: {
        senhaAtual: contrato.credencial.senha,
        novaSenha: nova,
        confirmacaoDaSenha: nova,
      },
    });

    expect(resposta.statusCode).toBe(204);

    const novo = valorEntregue(resposta);

    expect(novo).not.toBeNull();
    expect(novo).not.toBe(a);

    const doOutro = await contrato.servidor.inject({
      method: "GET",
      url: "/cartoes",
      headers: cookieDe(b),
    });
    const doAntigo = await contrato.servidor.inject({
      method: "GET",
      url: "/cartoes",
      headers: cookieDe(a),
    });
    const doNovo = await contrato.servidor.inject({
      method: "GET",
      url: "/cartoes",
      headers: cookieDe(novo ?? ""),
    });

    expect(doOutro.statusCode).toBe(401);
    expect(doAntigo.statusCode).toBe(401);
    expect(doNovo.statusCode).toBe(200);
  });

  it("alterar o Nome de usuário por Acesso encerra todos e emite um novo", async () => {
    const { a, b } = await navegadores();
    const resposta = await contrato.servidor.inject({
      method: "PUT",
      url: "/conta/nome-de-usuario",
      headers: cookieDe(a),
      payload: {
        senhaAtual: contrato.credencial.senha,
        novoNomeDeUsuario: "ana.nova",
      },
    });

    expect(resposta.statusCode).toBe(200);

    const novo = valorEntregue(resposta);
    const doNovo = await contrato.servidor.inject({
      method: "GET",
      url: "/acesso",
      headers: cookieDe(novo ?? ""),
    });

    expect(doNovo.json()).toEqual({ nomeDeUsuario: "ana.nova" });
    expect(
      (
        await contrato.servidor.inject({
          method: "GET",
          url: "/acesso",
          headers: cookieDe(b),
        })
      ).statusCode,
    ).toBe(401);
  });

  it("a alteração feita por Credencial Basic encerra os Acessos e não emite cookie", async () => {
    const { a } = await navegadores();
    const nova = senhaGerada();
    const resposta = await pedirComCredencial(
      contrato.servidor,
      contrato.credencial,
      {
        method: "PUT",
        url: "/conta/senha",
        payload: {
          senhaAtual: contrato.credencial.senha,
          novaSenha: nova,
          confirmacaoDaSenha: nova,
        },
      },
    );

    expect(resposta.statusCode).toBe(204);
    expect(resposta.headers["set-cookie"]).toBeUndefined();
    expect(
      (
        await contrato.servidor.inject({
          method: "GET",
          url: "/acesso",
          headers: cookieDe(a),
        })
      ).statusCode,
    ).toBe(401);
  });

  it("recusa de Senha atual incorreta não encerra nenhum Acesso", async () => {
    const { a, b } = await navegadores();
    const nova = senhaGerada();
    const resposta = await contrato.servidor.inject({
      method: "PUT",
      url: "/conta/senha",
      headers: cookieDe(a),
      payload: {
        senhaAtual: senhaGerada(),
        novaSenha: nova,
        confirmacaoDaSenha: nova,
      },
    });

    expect(resposta.statusCode).toBe(403);
    expect(resposta.headers["set-cookie"]).toBeUndefined();

    for (const valor of [a, b]) {
      expect(
        (
          await contrato.servidor.inject({
            method: "GET",
            url: "/acesso",
            headers: cookieDe(valor),
          })
        ).statusCode,
      ).toBe(200);
    }
  });

  it("excluir a conta remove todos os Acessos, limpa o cookie e não emite outro", async () => {
    const { a, b } = await navegadores();
    const resposta = await contrato.servidor.inject({
      method: "DELETE",
      url: "/conta",
      headers: cookieDe(a),
      payload: { senhaAtual: contrato.credencial.senha },
    });

    expect(resposta.statusCode).toBe(204);
    expect(String(resposta.headers["set-cookie"])).toMatch(
      /^acesso=; .*Max-Age=0/,
    );

    for (const valor of [a, b]) {
      expect(
        (
          await contrato.servidor.inject({
            method: "GET",
            url: "/acesso",
            headers: cookieDe(valor),
          })
        ).statusCode,
      ).toBe(401);
    }
  });
});
