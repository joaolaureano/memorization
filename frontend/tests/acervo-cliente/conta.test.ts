import { afterEach, describe, expect, it, vi } from "vitest";

import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE_DA_CONTA,
  NAO_AUTENTICADO,
} from "../../src/acervo-cliente/cliente";
import type {
  ClienteDoAcervo,
  Credencial,
} from "../../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../../src/acervo-cliente/cliente-em-memoria";
import { ClienteHttp } from "../../src/acervo-cliente/cliente-http";
import { comGuardaDeCredencial } from "../../src/ui/guarda-de-credencial";

/**
 * T1703 — os métodos de conta do `ClienteDoAcervo` (017, §4), nos dois
 * Adapters: parsing e erros de cada método; `403 senha_atual_incorreta`
 * preserva a Credencial; `401` a descarta.
 */

const CREDENCIAL: Credencial = {
  nomeDeUsuario: "ana.silva",
  senha: "senha-da-ana-1",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function respostaDe(status: number, corpo: unknown = null) {
  return { status, json: async () => corpo };
}

/** Um `ClienteHttp` cuja `fetch` responde sempre o que o cenário manda. */
function clienteHttpQueResponde(
  status: number,
  corpo: unknown = null,
): { cliente: ClienteHttp; chamadas: { url: string; init?: RequestInit }[] } {
  const chamadas: { url: string; init?: RequestInit }[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      chamadas.push({ url: String(url), init });

      return respostaDe(status, corpo);
    }),
  );

  return {
    cliente: new ClienteHttp("http://127.0.0.1:3001", CREDENCIAL),
    chamadas,
  };
}

describe("ClienteHttp — obterConta", () => {
  it("devolve nome e contagens, com a Credencial no cabeçalho", async () => {
    const { cliente, chamadas } = clienteHttpQueResponde(200, {
      nomeDeUsuario: "ana.silva",
      contagens: { cartoes: 2, baralhos: 1, registrosDeSessao: 3, agenda: null },
    });

    expect(await cliente.obterConta()).toEqual({
      ok: true,
      dados: {
        nomeDeUsuario: "ana.silva",
        contagens: {
          cartoes: 2,
          baralhos: 1,
          registrosDeSessao: 3,
          agenda: null,
        },
      },
    });
    expect(chamadas[0]?.url).toBe("http://127.0.0.1:3001/conta");
    expect(
      (chamadas[0]?.init?.headers as Record<string, string>).authorization,
    ).toMatch(/^Basic /);
  });

  it.each([
    [401, NAO_AUTENTICADO],
    [503, INDISPONIVEL],
    [500, INDISPONIVEL],
  ])("traduz %s em %s", async (status, erro) => {
    const { cliente } = clienteHttpQueResponde(status, {});

    expect(await cliente.obterConta()).toMatchObject({ ok: false, erro });
  });

  it("recusa corpo fora do contrato como indisponivel", async () => {
    const { cliente } = clienteHttpQueResponde(200, { nomeDeUsuario: "x" });

    expect(await cliente.obterConta()).toMatchObject({
      ok: false,
      erro: INDISPONIVEL,
    });
  });

  it("falha de rede é indisponivel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("rede");
      }),
    );

    expect(
      await new ClienteHttp("http://x", CREDENCIAL).obterConta(),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DA_CONTA,
    });
  });
});

describe("ClienteHttp — trocarSenha e excluirConta", () => {
  const troca = { senhaAtual: "a", novaSenha: "b", confirmacaoDaSenha: "b" };

  it("trocarSenha: 204 é sucesso e 400/403 são recusas do contrato", async () => {
    expect(
      await clienteHttpQueResponde(204).cliente.trocarSenha(troca),
    ).toEqual({ ok: true });

    for (const [status, erro] of [
      [400, "dados_invalidos"],
      [400, "mesma_senha"],
      [403, "senha_atual_incorreta"],
    ] as const) {
      const { cliente } = clienteHttpQueResponde(status, {
        erro,
        mensagem: "texto",
      });

      expect(await cliente.trocarSenha(troca)).toMatchObject({
        ok: false,
        erro,
        mensagem: "texto",
      });
    }
  });

  it("excluirConta: 204 é sucesso, 403 recusa e 409 é fora do contrato", async () => {
    const { cliente, chamadas } = clienteHttpQueResponde(204);

    expect(await cliente.excluirConta({ senhaAtual: "a" })).toEqual({
      ok: true,
    });
    expect(chamadas[0]?.init?.method).toBe("DELETE");
    expect(JSON.parse(String(chamadas[0]?.init?.body))).toEqual({
      senhaAtual: "a",
    });

    expect(
      await clienteHttpQueResponde(403, {
        erro: "senha_atual_incorreta",
        mensagem: "texto",
      }).cliente.excluirConta({ senhaAtual: "a" }),
    ).toMatchObject({ ok: false, erro: "senha_atual_incorreta" });

    expect(
      await clienteHttpQueResponde(409, {
        erro: "nome_indisponivel",
        mensagem: "texto",
      }).cliente.excluirConta({ senhaAtual: "a" }),
    ).toMatchObject({ ok: false, erro: INDISPONIVEL });
  });
});

describe("ClienteEmMemoria — conta", () => {
  function criar(): { ana: ClienteEmMemoria; base: ClienteEmMemoria } {
    const base = new ClienteEmMemoria(CREDENCIAL, [
      CREDENCIAL,
      { nomeDeUsuario: "bruno.souza", senha: "senha-do-bruno" },
    ]);

    return { ana: base, base };
  }

  it("obterConta devolve nome e contagens do dono", async () => {
    const { ana } = criar();

    await ana.criarCartao({ frente: "To walk", verso: "Caminhar" });
    await ana.criarBaralho({ nome: "Inglês" });

    expect(await ana.obterConta()).toEqual({
      ok: true,
      dados: {
        nomeDeUsuario: "ana.silva",
        contagens: { cartoes: 1, baralhos: 1, registrosDeSessao: 0, agenda: 0 },
      },
    });
  });

  it("não expõe alterarNomeDeUsuario: a operação foi removida (FR-336)", () => {
    const { ana } = criar();
    const cliente: ClienteDoAcervo = ana;

    expect("alterarNomeDeUsuario" in cliente).toBe(false);
  });

  it("trocarSenha valida, recusa a mesma Senha e troca", async () => {
    const { ana, base } = criar();
    const nova = "outra-senha-9";

    expect(
      await ana.trocarSenha({
        senhaAtual: CREDENCIAL.senha,
        novaSenha: "curta",
        confirmacaoDaSenha: "curta",
      }),
    ).toMatchObject({ ok: false, erro: "dados_invalidos", campo: "novaSenha" });
    expect(
      await ana.trocarSenha({
        senhaAtual: CREDENCIAL.senha,
        novaSenha: nova,
        confirmacaoDaSenha: "diferente-9",
      }),
    ).toMatchObject({
      ok: false,
      erro: "dados_invalidos",
      campo: "confirmacaoDaSenha",
    });
    expect(
      await ana.trocarSenha({
        senhaAtual: CREDENCIAL.senha,
        novaSenha: CREDENCIAL.senha,
        confirmacaoDaSenha: CREDENCIAL.senha,
      }),
    ).toMatchObject({ ok: false, erro: "mesma_senha" });
    expect(
      await ana.trocarSenha({
        senhaAtual: "errada",
        novaSenha: nova,
        confirmacaoDaSenha: nova,
      }),
    ).toMatchObject({ ok: false, erro: "senha_atual_incorreta" });

    expect(
      await ana.trocarSenha({
        senhaAtual: CREDENCIAL.senha,
        novaSenha: nova,
        confirmacaoDaSenha: nova,
      }),
    ).toEqual({ ok: true });
    expect(await base.obterConta()).toMatchObject({
      ok: false,
      erro: NAO_AUTENTICADO,
    });

    // O Nome de usuário não muda com a troca de Senha: entrar com o mesmo nome
    // e a Senha nova funciona (FR-337).
    expect(
      await base.entrar({
        nomeDeUsuario: CREDENCIAL.nomeDeUsuario,
        senha: nova,
      }),
    ).toMatchObject({
      ok: true,
      usuario: { nomeDeUsuario: CREDENCIAL.nomeDeUsuario },
    });
  });

  it("excluirConta remove tudo do dono e preserva o outro", async () => {
    const { ana, base } = criar();
    const bruno = base.comoUsuario({
      nomeDeUsuario: "bruno.souza",
      senha: "senha-do-bruno",
    });

    await ana.criarCartao({ frente: "To walk", verso: "Caminhar" });
    await bruno.criarCartao({ frente: "To run", verso: "Correr" });

    expect(await ana.excluirConta({ senhaAtual: "errada" })).toMatchObject({
      ok: false,
      erro: "senha_atual_incorreta",
    });
    expect(await ana.excluirConta({ senhaAtual: CREDENCIAL.senha })).toEqual({
      ok: true,
    });

    expect(await ana.obterConta()).toMatchObject({
      ok: false,
      erro: NAO_AUTENTICADO,
    });
    expect(await bruno.obterConta()).toMatchObject({
      ok: true,
      dados: { contagens: { cartoes: 1 } },
    });

    // O Nome de usuário fica livre para novo Cadastro.
    expect(
      await base.criarUsuario({
        nomeDeUsuario: "ana.silva",
        senha: "senha-nova-12",
      }),
    ).toMatchObject({ ok: true });
  });

  it("indisponibilidade não conclui nada", async () => {
    const { ana } = criar();

    ana.simularIndisponibilidade();

    expect(await ana.obterConta()).toMatchObject({ ok: false, erro: INDISPONIVEL });
    expect(await ana.excluirConta({ senhaAtual: CREDENCIAL.senha })).toMatchObject(
      { ok: false, erro: INDISPONIVEL },
    );

    ana.restaurarDisponibilidade();

    expect(await ana.obterConta()).toMatchObject({ ok: true });
  });
});

describe("guarda de Credencial — conta", () => {
  function clienteComResultado(resultado: unknown): ClienteDoAcervo {
    return {
      trocarSenha: async () => resultado,
      excluirConta: async () => resultado,
      obterConta: async () => resultado,
    } as unknown as ClienteDoAcervo;
  }

  it("403 senha_atual_incorreta não descarta a Credencial", async () => {
    const recusar = vi.fn();
    const guardado = comGuardaDeCredencial(
      clienteComResultado({
        ok: false,
        erro: "senha_atual_incorreta",
        mensagem: "x",
      }),
      recusar,
    );

    await guardado.trocarSenha({
      senhaAtual: "a",
      novaSenha: "b",
      confirmacaoDaSenha: "b",
    });
    await guardado.excluirConta({ senhaAtual: "a" });

    expect(recusar).not.toHaveBeenCalled();
  });

  it("401 descarta a Credencial e o resultado segue intacto", async () => {
    const recusar = vi.fn();
    const recusa = { ok: false, erro: NAO_AUTENTICADO, mensagem: "caiu" };
    const guardado = comGuardaDeCredencial(clienteComResultado(recusa), recusar);

    expect(await guardado.obterConta()).toEqual(recusa);
    expect(await guardado.excluirConta({ senhaAtual: "a" })).toEqual(recusa);
    expect(recusar).toHaveBeenCalledTimes(2);
    expect(recusar).toHaveBeenCalledWith("caiu");
  });
});
