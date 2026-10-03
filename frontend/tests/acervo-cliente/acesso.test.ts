import { afterEach, describe, expect, it, vi } from "vitest";

import {
  INDISPONIVEL,
  MENSAGEM_DE_ACESSO_EXPIRADO,
  MENSAGEM_DE_INDISPONIBILIDADE_DO_ACESSO,
  MENSAGEM_DE_NAO_AUTENTICADO,
  NAO_AUTENTICADO,
} from "../../src/acervo-cliente/cliente";
import type { Credencial } from "../../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../../src/acervo-cliente/cliente-em-memoria";
import { ClienteHttp } from "../../src/acervo-cliente/cliente-http";
import { comGuardaDeCredencial } from "../../src/ui/guarda-de-credencial";

/**
 * T1807 — o Acesso temporário no cliente (018, §6), nos dois Adapters:
 * `credentials: "include"` em toda chamada, `obterAcesso`, `renovarAcesso` e
 * `sair`, `401 acesso_expirado` com a mensagem exata, `401 sem_acesso`, e o
 * `503` que **não** descarta o Acesso.
 */

const CREDENCIAL: Credencial = {
  nomeDeUsuario: "ana.silva",
  senha: "senha-da-ana-1",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

interface Chamada {
  url: string;
  init?: RequestInit;
}

/** Um `fetch` que responde sempre o que o cenário manda, registrando as chamadas. */
function responde(status: number, corpo: unknown = null): Chamada[] {
  const chamadas: Chamada[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      chamadas.push({ url: String(url), init });

      return { status, json: async () => corpo };
    }),
  );

  return chamadas;
}

const http = (credencial: Credencial | null = null, usaAcesso = true) =>
  new ClienteHttp("http://127.0.0.1:3001", credencial, usaAcesso);

describe("ClienteHttp — credentials: include (FR-297)", () => {
  it("toda chamada leva credentials: include, de Entrar às rotas do acervo", async () => {
    const chamadas = responde(200, []);
    const cliente = http(CREDENCIAL, false);

    await cliente.entrar(CREDENCIAL);
    await cliente.listarCartoes();
    await cliente.listarBaralhos();
    await cliente.obterPreferencias();
    await cliente.obterConta();
    await cliente.obterAcesso();
    await cliente.renovarAcesso();
    await cliente.sair();

    expect(chamadas).toHaveLength(8);

    for (const chamada of chamadas) {
      expect(chamada.init?.credentials, chamada.url).toBe("include");
    }
  });

  it("sem Credencial na memória, nenhum cabeçalho Authorization é enviado: só o cookie vale", async () => {
    const chamadas = responde(200, []);

    await http(null).listarCartoes();

    expect(
      (chamadas[0]?.init?.headers as Record<string, string> | undefined)
        ?.authorization,
    ).toBeUndefined();
  });
});

describe("ClienteHttp — entrar com continuarConectado", () => {
  it("envia a Credencial no cabeçalho e a escolha no corpo, nunca a Senha no corpo", async () => {
    const chamadas = responde(200, { id: "u1", nomeDeUsuario: "ana.silva" });

    await http(null, false).entrar({ ...CREDENCIAL, continuarConectado: true });

    const init = chamadas[0]?.init;

    expect(chamadas[0]?.url).toBe("http://127.0.0.1:3001/entrar");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ continuarConectado: true });
    expect(String(init?.body)).not.toContain(CREDENCIAL.senha);
    expect(
      (init?.headers as Record<string, string>).authorization,
    ).toMatch(/^Basic /);
  });

  it("sem a escolha, vale o modo da página: com Acesso, verdadeira; com Credencial, falsa", async () => {
    const comAcesso = responde(200, { id: "u1", nomeDeUsuario: "ana.silva" });

    await http(null, true).entrar(CREDENCIAL);
    expect(JSON.parse(String(comAcesso[0]?.init?.body))).toEqual({
      continuarConectado: true,
    });

    const comCredencial = responde(200, { id: "u1", nomeDeUsuario: "ana.silva" });

    await http(CREDENCIAL, false).entrar(CREDENCIAL);
    expect(JSON.parse(String(comCredencial[0]?.init?.body))).toEqual({
      continuarConectado: false,
    });
  });

  it("explícito, a escolha vence o modo da página", async () => {
    const chamadas = responde(200, { id: "u1", nomeDeUsuario: "ana.silva" });

    await http(null, true).entrar({ ...CREDENCIAL, continuarConectado: false });

    expect(JSON.parse(String(chamadas[0]?.init?.body))).toEqual({
      continuarConectado: false,
    });
  });
});

describe("ClienteHttp — obterAcesso", () => {
  it("200 devolve o Nome de usuário", async () => {
    const chamadas = responde(200, { nomeDeUsuario: "ana.silva" });

    expect(await http().obterAcesso()).toEqual({
      ok: true,
      nomeDeUsuario: "ana.silva",
    });
    expect(chamadas[0]?.url).toBe("http://127.0.0.1:3001/acesso");
  });

  it("401 acesso_expirado leva a mensagem exata (FR-294)", async () => {
    responde(401, { erro: "acesso_expirado", mensagem: "x" });

    expect(await http().obterAcesso()).toEqual({
      ok: false,
      erro: "acesso_expirado",
      mensagem: "Seu acesso expirou. Entre novamente.",
    });
    expect(MENSAGEM_DE_ACESSO_EXPIRADO).toBe("Seu acesso expirou. Entre novamente.");
  });

  it("401 sem_acesso leva a Entrar sem aviso de expiração", async () => {
    responde(401, { erro: "sem_acesso", mensagem: "x" });

    expect(await http().obterAcesso()).toMatchObject({
      ok: false,
      erro: "sem_acesso",
      mensagem: MENSAGEM_DE_NAO_AUTENTICADO,
    });
  });

  it("503, outro status, corpo fora do contrato e falha de rede são indisponivel — não expiração (FR-301)", async () => {
    for (const [status, corpo] of [
      [503, { erro: "indisponivel", mensagem: "x" }],
      [500, {}],
      [200, { semNome: true }],
      [401, { erro: "outra_coisa" }],
    ] as const) {
      responde(status, corpo);

      expect(await http().obterAcesso()).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DO_ACESSO,
      });
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("rede");
      }),
    );

    expect(await http().obterAcesso()).toMatchObject({
      ok: false,
      erro: INDISPONIVEL,
    });
  });
});

describe("ClienteHttp — renovarAcesso e sair", () => {
  it("renovarAcesso: 204 é sucesso; 401 vira nao_autenticado, com a mensagem de expiração quando é o caso", async () => {
    const chamadas = responde(204);

    expect(await http().renovarAcesso()).toEqual({ ok: true });
    expect(chamadas[0]?.url).toBe("http://127.0.0.1:3001/acesso/renovar");
    expect(chamadas[0]?.init?.method).toBe("POST");

    responde(401, { erro: "acesso_expirado", mensagem: "x" });
    expect(await http().renovarAcesso()).toEqual({
      ok: false,
      erro: NAO_AUTENTICADO,
      mensagem: MENSAGEM_DE_ACESSO_EXPIRADO,
    });

    responde(401, { erro: "sem_acesso", mensagem: "x" });
    expect(await http().renovarAcesso()).toMatchObject({
      ok: false,
      erro: NAO_AUTENTICADO,
      mensagem: MENSAGEM_DE_NAO_AUTENTICADO,
    });

    responde(503, {});
    expect(await http().renovarAcesso()).toMatchObject({
      ok: false,
      erro: INDISPONIVEL,
    });
  });

  it("sair: só 204 conclui; qualquer outra resposta é indisponivel", async () => {
    const chamadas = responde(204);

    expect(await http().sair()).toEqual({ ok: true });
    expect(chamadas[0]?.url).toBe("http://127.0.0.1:3001/sair");
    expect(chamadas[0]?.init?.method).toBe("POST");

    responde(503, {});
    expect(await http().sair()).toMatchObject({ ok: false, erro: INDISPONIVEL });
  });
});

describe("ClienteHttp — 401 de qualquer operação", () => {
  it("acesso_expirado numa operação do acervo leva a mensagem de expiração (FR-091 revisado)", async () => {
    responde(401, { erro: "acesso_expirado", mensagem: "x" });

    expect(await http().listarCartoes()).toEqual({
      ok: false,
      erro: NAO_AUTENTICADO,
      mensagem: MENSAGEM_DE_ACESSO_EXPIRADO,
    });
  });

  it("credencial_invalida usa a mensagem geral, e corpo ilegível não impede a recusa", async () => {
    responde(401, { erro: "credencial_invalida", mensagem: "x" });
    expect(await http().listarCartoes()).toMatchObject({
      erro: NAO_AUTENTICADO,
      mensagem: MENSAGEM_DE_NAO_AUTENTICADO,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 401,
        json: async () => {
          throw new Error("sem corpo");
        },
      })),
    );
    expect(await http().listarCartoes()).toMatchObject({
      erro: NAO_AUTENTICADO,
      mensagem: MENSAGEM_DE_NAO_AUTENTICADO,
    });
  });
});

describe("guarda de Credencial — Acesso", () => {
  it("a renovação recusada descarta a Credencial com a mensagem, e o 503 não (FR-294, FR-301)", async () => {
    const recusar = vi.fn();
    const base = new ClienteEmMemoria(null, [CREDENCIAL]);

    base.renovarAcesso = async () => ({
      ok: false,
      erro: NAO_AUTENTICADO,
      mensagem: MENSAGEM_DE_ACESSO_EXPIRADO,
    });

    await comGuardaDeCredencial(base, recusar).renovarAcesso();
    expect(recusar).toHaveBeenCalledWith(MENSAGEM_DE_ACESSO_EXPIRADO);

    recusar.mockClear();
    base.renovarAcesso = async () => ({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DO_ACESSO,
    });

    await comGuardaDeCredencial(base, recusar).renovarAcesso();
    expect(recusar).not.toHaveBeenCalled();
  });
});

describe("ClienteEmMemoria — Acesso do navegador simulado", () => {
  const entrar = (continuarConectado?: boolean) => ({
    ...CREDENCIAL,
    ...(continuarConectado === undefined ? {} : { continuarConectado }),
  });

  it("entrar emite o Acesso, obterAcesso o reconhece e sair o encerra", async () => {
    const cliente = new ClienteEmMemoria(null, [CREDENCIAL]);

    await cliente.entrar(entrar(true));

    expect(await cliente.obterAcesso()).toEqual({
      ok: true,
      nomeDeUsuario: "ana.silva",
    });
    expect(await cliente.sair()).toEqual({ ok: true });
    expect(await cliente.obterAcesso()).toMatchObject({
      ok: false,
      erro: "sem_acesso",
    });
  });

  it("a validade é deslizante e vence pelo relógio do servidor (FR-291, FR-294, FR-297)", async () => {
    const cliente = new ClienteEmMemoria(null, [CREDENCIAL]);

    await cliente.entrar(entrar(true));

    cliente.avancarRelogio(4 * 60_000);
    expect(await cliente.listarCartoes()).toMatchObject({ ok: true });
    cliente.avancarRelogio(4 * 60_000);
    expect(await cliente.listarCartoes()).toMatchObject({ ok: true });
    cliente.avancarRelogio(5 * 60_000);

    expect(await cliente.listarCartoes()).toMatchObject({
      ok: false,
      erro: NAO_AUTENTICADO,
      mensagem: MENSAGEM_DE_ACESSO_EXPIRADO,
    });
    expect(cliente.temAcessoNoNavegador()).toBe(false);
  });

  it("a renovação mantém o Acesso vivo sem outra operação (FR-291)", async () => {
    const cliente = new ClienteEmMemoria(null, [CREDENCIAL]);

    await cliente.entrar(entrar(true));

    for (let passo = 0; passo < 3; passo += 1) {
      cliente.avancarRelogio(4 * 60_000);
      expect(await cliente.renovarAcesso()).toEqual({ ok: true });
    }

    expect(await cliente.obterAcesso()).toMatchObject({ ok: true });
  });

  it("continuarConectado falso revoga o Acesso anterior e não emite outro (FR-292)", async () => {
    const cliente = new ClienteEmMemoria(null, [CREDENCIAL]);

    await cliente.entrar(entrar(true));
    await cliente.entrar(entrar(false));

    expect(cliente.temAcessoNoNavegador()).toBe(false);
  });

  it("um novo Entrar substitui o Acesso do mesmo navegador", async () => {
    const cliente = new ClienteEmMemoria(null, [CREDENCIAL]);

    await cliente.entrar(entrar(true));
    await cliente.entrar(entrar(true));

    expect(await cliente.obterAcesso()).toMatchObject({ ok: true });
  });

  it("navegadores diferentes têm Acessos independentes (FR-299)", async () => {
    const um = new ClienteEmMemoria(null, [CREDENCIAL]);
    const outro = um.outroNavegador();

    await um.entrar(entrar(true));
    await outro.entrar(entrar(true));
    await um.sair();

    expect(await um.obterAcesso()).toMatchObject({ ok: false });
    expect(await outro.obterAcesso()).toMatchObject({ ok: true });
  });

  it("a Senha trocada encerra todos os Acessos e emite um novo só para quem trocou (FR-296)", async () => {
    const um = new ClienteEmMemoria(null, [CREDENCIAL]);
    const outro = um.outroNavegador();

    await um.entrar(entrar(true));
    await outro.entrar(entrar(true));

    expect(
      await um.trocarSenha({
        senhaAtual: CREDENCIAL.senha,
        novaSenha: "outra-senha-9",
        confirmacaoDaSenha: "outra-senha-9",
      }),
    ).toEqual({ ok: true });

    expect(await um.obterAcesso()).toMatchObject({ ok: true });
    expect(await outro.obterAcesso()).toMatchObject({ ok: false });
  });

  it("a indisponibilidade não é expiração: nada é descartado (FR-301)", async () => {
    const cliente = new ClienteEmMemoria(null, [CREDENCIAL]);

    await cliente.entrar(entrar(true));
    cliente.simularIndisponibilidade();

    expect(await cliente.obterAcesso()).toMatchObject({
      ok: false,
      erro: INDISPONIVEL,
    });
    expect(await cliente.renovarAcesso()).toMatchObject({
      ok: false,
      erro: INDISPONIVEL,
    });
    expect(await cliente.sair()).toMatchObject({ ok: false, erro: INDISPONIVEL });
    expect(cliente.temAcessoNoNavegador()).toBe(true);
  });
});
