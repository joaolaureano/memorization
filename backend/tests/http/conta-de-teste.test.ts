// Conta de teste pela HTTP (030, T018/T023/T025/T032).

import { mkdtempSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { criarAcessos, type Acessos } from "../../src/acesso/acesso.ts";
import { criarAcervo } from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { registrarRotasDeMidiaLocal } from "../../src/http/midia-local.ts";
import {
  criarServidor,
  registrarRotasDaAplicacao,
} from "../../src/http/servidor.ts";
import {
  criarIdentidade,
  type Identidade,
} from "../../src/identidade/identidade.ts";
import { criarArmazemEmDisco } from "../../src/midia/armazem-em-disco.ts";
import {
  cadastrarUsuarioDeTeste,
  segredoGerado,
  type CredencialDeTeste,
} from "../armazenamento/usuarios-de-teste.ts";
import { pedirComCredencial } from "./apoio-de-contrato.ts";

/** Segredo das Senhas desta execução: alimenta a origem por HMAC (R5). */
const SEGREDO_DE_TESTE = segredoGerado();

interface Contexto {
  readonly servidor: FastifyInstance;
  readonly identidade: Identidade;
  readonly acessos: Acessos;
  readonly aberto: ArmazenamentoSqliteAberto;
  /** Conta real, cadastrada pelo Module e usada com Credencial Basic. */
  readonly credencial: CredencialDeTeste;
}

let ctx: Contexto;

/**
 * Monta o servidor como na aplicação: SQLite em memória, armazém de Mídia em
 * Disco, `Identidade` com a Porta de contas de teste e o segredo de origem.
 */
async function montar(): Promise<Contexto> {
  const aberto = await abrirArmazenamentoSqlite(":memory:");
  const imagens = criarArmazemEmDisco({
    pasta: mkdtempSync(join(tmpdir(), "conta-de-teste-")),
  });
  const identidade = criarIdentidade(aberto.usuarios, segredoGerado(), {
    midia: imagens,
    contasDeTeste: aberto.armazenamento,
  });
  const acessos = criarAcessos(aberto.acessos, {});
  const servidor = criarServidor(identidade, {
    acessos,
    segredoDasSenhas: SEGREDO_DE_TESTE,
  });
  registrarRotasDaAplicacao(
    servidor,
    identidade,
    (usuarioId) => criarAcervo(aberto.armazenamento, usuarioId, { imagens }),
    acessos,
    undefined,
    imagens,
  );
  registrarRotasDeMidiaLocal(servidor, imagens);
  const credencial = await cadastrarUsuarioDeTeste(identidade);

  return { servidor, identidade, acessos, aberto, credencial };
}

beforeEach(async () => {
  ctx = await montar();
});

afterEach(async () => {
  await ctx.servidor.close();
  await ctx.aberto.encerrar();
});

/** Pede `POST /contas-de-teste` com o corpo e, se houver, o cookie informado. */
function criarContaDeTeste(
  corpo: unknown,
  cookie?: string,
): Promise<LightMyRequestResponse> {
  return ctx.servidor.inject({
    method: "POST",
    url: "/contas-de-teste",
    payload: corpo as Record<string, unknown>,
    headers: cookie === undefined ? {} : { cookie },
  });
}

/** O par `nome=valor` do `Set-Cookie`, pronto para ser enviado de volta. */
function cookieDe(resposta: LightMyRequestResponse): string {
  const cabecalho = resposta.headers["set-cookie"];
  const texto = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;

  return (texto ?? "").split(";")[0] ?? "";
}

/** Pede a rota com o cookie do Acesso, sem Credencial Basic. */
function pedirComCookie(
  metodo: "GET" | "POST",
  url: string,
  cookie: string,
): Promise<LightMyRequestResponse> {
  return ctx.servidor.inject({ method: metodo, url, headers: { cookie } });
}

const CORPO_VALIDO = { fuso: "America/Sao_Paulo", idioma: "pt" };

describe("POST /contas-de-teste", () => {
  it("cria a conta sem autenticação e responde 201 com o Acesso no cookie", async () => {
    const resposta = await criarContaDeTeste(CORPO_VALIDO);

    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toEqual({
      nomeDeUsuario: expect.stringMatching(/^teste-/),
      contaDeTeste: true,
    });
    expect(cookieDe(resposta)).toMatch(/^[^=]+=.+/);
  });

  it("revoga o Acesso anterior deste navegador", async () => {
    const primeira = await criarContaDeTeste(CORPO_VALIDO);
    const antigo = cookieDe(primeira);

    const segunda = await criarContaDeTeste(CORPO_VALIDO, antigo);
    const novo = cookieDe(segunda);

    expect(segunda.statusCode).toBe(201);
    expect(novo).not.toBe(antigo);
    expect((await pedirComCookie("GET", "/baralhos", antigo)).statusCode).toBe(401);
    expect((await pedirComCookie("GET", "/baralhos", novo)).statusCode).toBe(200);
  });

  it("responde 400 corpo_invalido para fuso ou idioma inválidos", async () => {
    const fusoInvalido = await criarContaDeTeste({ fuso: "Marte/Olimpo", idioma: "pt" });
    const idiomaInvalido = await criarContaDeTeste({ fuso: "America/Sao_Paulo", idioma: "fr" });
    const semCorpo = await criarContaDeTeste(undefined);

    for (const resposta of [fusoInvalido, idiomaInvalido, semCorpo]) {
      expect(resposta.statusCode).toBe(400);
      expect(resposta.json()).toMatchObject({ erro: "corpo_invalido" });
    }
  });

  it("lista os três Baralhos e marca a conta como de teste", async () => {
    const criada = await criarContaDeTeste(CORPO_VALIDO);
    const cookie = cookieDe(criada);

    const baralhos = await pedirComCookie("GET", "/baralhos", cookie);
    expect(baralhos.statusCode).toBe(200);
    expect(baralhos.json()).toHaveLength(3);

    const conta = await pedirComCookie("GET", "/conta", cookie);
    expect(conta.statusCode).toBe(200);
    expect(conta.json()).toMatchObject({ contaDeTeste: true });
  });

  it("devolve endereço de leitura para o Cartão de Imagem da demonstração", async () => {
    const cookie = cookieDe(await criarContaDeTeste(CORPO_VALIDO));

    const cartoes = (await pedirComCookie("GET", "/cartoes", cookie)).json() as Array<{
      tipo?: string;
      imagem?: { url: string };
    }>;
    const comImagem = cartoes.find((cartao) => cartao.tipo === "imagem");

    expect(comImagem?.imagem?.url).toEqual(expect.any(String));

    const lida = await ctx.servidor.inject({ method: "GET", url: comImagem?.imagem?.url ?? "" });
    expect(lida.statusCode).toBe(200);
  });

  it("mantém a conta real com contaDeTeste false", async () => {
    const resposta = await pedirComCredencial(ctx.servidor, ctx.credencial, {
      method: "GET",
      url: "/conta",
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({ contaDeTeste: false });
  });
});

describe("GET /demonstracao/creditos", () => {
  it("é público e lista os 20 créditos com os campos do contrato", async () => {
    const resposta = await ctx.servidor.inject({ method: "GET", url: "/demonstracao/creditos" });

    expect(resposta.statusCode).toBe(200);

    const creditos = resposta.json() as Array<Record<string, unknown>>;
    expect(creditos).toHaveLength(20);
    for (const credito of creditos) {
      expect(credito).toEqual({
        baralho: expect.any(String),
        cartao: expect.any(String),
        titulo: expect.any(String),
        autor: expect.any(String),
        licenca: expect.any(String),
        fonte: expect.any(String),
      });
    }
  });
});

describe("ciclo de vida e proteção da Conta de teste", () => {
  it("isola contas criadas em paralelo", async () => {
    const [a, b] = await Promise.all([
      criarContaDeTeste(CORPO_VALIDO),
      criarContaDeTeste(CORPO_VALIDO),
    ]);
    const cookieA = cookieDe(a);
    const cookieB = cookieDe(b);
    const decksA = (await pedirComCookie("GET", "/baralhos", cookieA)).json() as Array<{ id: string }>;
    const decksB = (await pedirComCookie("GET", "/baralhos", cookieB)).json() as Array<{ id: string }>;

    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);
    expect(decksA.map(({ id }) => id)).not.toEqual(decksB.map(({ id }) => id));
    const criado = await ctx.servidor.inject({
      method: "POST", url: "/baralhos", headers: { cookie: cookieA }, payload: { nome: "Francês" },
    });
    expect(criado.statusCode).toBe(201);
    expect((await pedirComCookie("GET", "/baralhos", cookieA)).json()).toHaveLength(4);
    expect((await pedirComCookie("GET", "/baralhos", cookieB)).json()).toHaveLength(3);
  });

  it("mantém edição, exclusão, importação, exportação e mídia de demonstração isoladas", async () => {
    const [a, b] = await Promise.all([
      criarContaDeTeste(CORPO_VALIDO),
      criarContaDeTeste(CORPO_VALIDO),
    ]);
    const cookieA = cookieDe(a);
    const cookieB = cookieDe(b);
    const cartoesA = (await pedirComCookie("GET", "/cartoes", cookieA)).json() as Array<{
      id: string;
      tipo: string;
      frente: string;
      verso: string;
      tags?: string[];
      imagem?: { url: string };
      baralho?: { nome: string };
    }>;
    const cartoesB = (await pedirComCookie("GET", "/cartoes", cookieB)).json() as Array<{
      id: string;
      tipo?: string;
      frente: string;
      verso: string;
      baralho?: { id: string; nome: string };
    }>;
    const estadoB = cartoesB.map(({ id, frente, verso, baralho }) => ({ id, frente, verso, baralhoId: baralho?.id }));
    expect(cartoesA.map(({ frente, verso, tipo, baralho }) => [baralho?.nome, tipo ?? "frente-verso", frente, verso]))
      .toEqual(cartoesB.map(({ frente, verso, tipo, baralho }) => [baralho?.nome, tipo ?? "frente-verso", frente, verso]));
    const lerEstadoB = async () => ((await pedirComCookie("GET", "/cartoes", cookieB)).json() as typeof cartoesB)
      .map(({ id, frente, verso, baralho }) => ({ id, frente, verso, baralhoId: baralho?.id }));
    const texto = cartoesA.find((cartao) => cartao.tipo === undefined && cartao.frente !== "");
    const imagem = cartoesA.find((cartao) => cartao.tipo === "imagem");
    expect(texto).toBeDefined();
    expect(imagem?.imagem?.url).toEqual(expect.any(String));

    const edicao = await ctx.servidor.inject({
      method: "PUT", url: `/cartoes/${texto!.id}`, headers: { cookie: cookieA },
      payload: { frente: `${texto!.frente} (alterado)`, verso: texto!.verso, tags: texto!.tags ?? [] },
    });
    expect(edicao.statusCode).toBe(200);
    expect(await lerEstadoB()).toEqual(estadoB);

    const exclusao = await ctx.servidor.inject({
      method: "DELETE", url: `/cartoes/${imagem!.id}`, headers: { cookie: cookieA },
    });
    expect(exclusao.statusCode).toBe(204);
    expect((await ctx.servidor.inject({ method: "GET", url: imagem!.imagem!.url })).statusCode).toBe(200);
    expect(await lerEstadoB()).toEqual(estadoB);

    const importacao = await ctx.servidor.inject({
      method: "POST", url: "/baralhos/importacoes", headers: { cookie: cookieA },
      payload: { baralhos: [{ nome: "Importado", cartoes: [{ frente: "novo", verso: "new" }] }] },
    });
    expect(importacao.statusCode).toBe(201);
    const baralhosA = (await pedirComCookie("GET", "/baralhos", cookieA)).json() as Array<{ id: string }>;
    const exportacao = await ctx.servidor.inject({
      method: "POST", url: "/exportacoes", headers: { cookie: cookieA },
      payload: { formato: "apkg", baralhos: [baralhosA[0]!.id], fuso: "America/Sao_Paulo", idioma: "pt" },
    });
    expect(exportacao.statusCode).toBe(201);
    expect((await pedirComCookie("GET", "/baralhos", cookieB)).json()).toHaveLength(3);
    expect(await lerEstadoB()).toEqual(estadoB);
  });

  it("copia mídia de demonstração para uma chave própria ao salvar em outro Baralho", async () => {
    const cookie = cookieDe(await criarContaDeTeste(CORPO_VALIDO));
    const cartoes = (await pedirComCookie("GET", "/cartoes", cookie)).json() as Array<{
      id: string;
      tipo: string;
      baralho?: { id: string };
      imagem?: { url: string };
    }>;
    const original = cartoes.find((cartao) => cartao.tipo === "imagem");
    expect(original?.imagem?.url).toEqual(expect.any(String));

    const salvo = await ctx.servidor.inject({
      method: "POST", url: "/baralhos/de-selecao", headers: { cookie },
      payload: { id: randomUUID(), nome: "Cópias", cartaoIds: [original!.id] },
    });
    expect(salvo.statusCode).toBe(201);

    const copias = (await pedirComCookie("GET", "/cartoes", cookie)).json() as typeof cartoes;
    const copia = copias.find((cartao) => cartao.baralho?.id === salvo.json().id);
    expect(copia?.imagem?.url).toEqual(expect.any(String));

    const apagado = await ctx.servidor.inject({
      method: "DELETE", url: `/cartoes/${original!.id}`, headers: { cookie },
    });
    expect(apagado.statusCode).toBe(204);
    expect((await ctx.servidor.inject({ method: "GET", url: copia!.imagem!.url })).statusCode).toBe(200);
  });

  it("Sair revoga o Acesso, apaga a conta e limpa o cookie", async () => {
    const cookie = cookieDe(await criarContaDeTeste(CORPO_VALIDO));
    const resposta = await pedirComCookie("POST", "/sair", cookie);

    expect(resposta.statusCode).toBe(204);
    expect(resposta.headers["set-cookie"]).toContain("Max-Age=0");
    expect((await pedirComCookie("GET", "/baralhos", cookie)).statusCode).toBe(401);
  });

  it("limpa o cookie mesmo se a exclusão falhar e a limpeza posterior recolhe a conta", async () => {
    const criada = await criarContaDeTeste(CORPO_VALIDO);
    const cookie = cookieDe(criada);
    const usuario = await ctx.aberto.usuarios.obterUsuarioPorNomeDeUsuario(
      criada.json().nomeDeUsuario,
    );
    if (!usuario.ok) throw new Error("Conta recém criada não foi encontrada");
    const falha = vi.spyOn(ctx.identidade, "encerrarContaDeTeste").mockRejectedValueOnce(new Error("armazenamento indisponível"));

    const resposta = await pedirComCookie("POST", "/sair", cookie);

    expect(falha).toHaveBeenCalledWith(usuario.valor.id);
    expect(resposta.statusCode).toBe(204);
    expect(resposta.headers["set-cookie"]).toContain("Max-Age=0");
    expect((await pedirComCookie("GET", "/baralhos", cookie)).statusCode).toBe(401);

    await ctx.identidade.limparContasDeTesteEncerradas(new Date(Date.now() + 3 * 60_000));
    expect(await ctx.aberto.usuarios.obterUsuarioPorId(usuario.valor.id)).toEqual({
      ok: false, erro: "nao_encontrado",
    });
  });

  it("recusa troca de senha e exclusão direta da Conta de teste", async () => {
    const respostaDeCriacao = await criarContaDeTeste(CORPO_VALIDO);
    const cookie = cookieDe(respostaDeCriacao);
    const senha = await ctx.servidor.inject({
      method: "PUT", url: "/conta/senha", headers: { cookie },
      payload: { senhaAtual: "qualquer", novaSenha: "senha nova valida", confirmacaoDaSenha: "senha nova valida" },
    });
    const exclusao = await ctx.servidor.inject({
      method: "DELETE", url: "/conta", headers: { cookie }, payload: { senhaAtual: "qualquer" },
    });

    expect(senha.statusCode).toBe(403);
    expect(senha.json()).toMatchObject({ erro: "conta_de_teste" });
    expect(exclusao.statusCode).toBe(403);
    expect(exclusao.json()).toMatchObject({ erro: "conta_de_teste" });

    const nomeDeUsuario = (respostaDeCriacao.json() as { nomeDeUsuario: string }).nomeDeUsuario;
    const entrada = await ctx.servidor.inject({
      method: "POST", url: "/entrar", payload: { nomeDeUsuario, senha: "qualquer senha" },
    });
    const basic = await ctx.servidor.inject({
      method: "GET", url: "/baralhos",
      headers: { authorization: `Basic ${Buffer.from(`${nomeDeUsuario}:qualquer senha`).toString("base64")}` },
    });
    expect(entrada.statusCode).toBe(401);
    expect(entrada.json()).toMatchObject({ erro: "credencial_invalida" });
    expect(basic.statusCode).toBe(401);
    expect(basic.json()).toMatchObject({ erro: "credencial_invalida" });
  });

  it("limita a 30 preparações de envio compartilhadas entre Imagem e Áudio", async () => {
    const cookie = cookieDe(await criarContaDeTeste(CORPO_VALIDO));
    for (let indice = 0; indice < 30; indice += 1) {
      const resposta = await ctx.servidor.inject({
        method: "POST", url: "/imagens/envios", headers: { cookie },
      });
      expect(resposta.statusCode).toBe(201);
    }

    const imagem = await ctx.servidor.inject({
      method: "POST", url: "/imagens/envios", headers: { cookie },
    });
    const audio = await ctx.servidor.inject({
      method: "POST", url: "/audios/envios", headers: { cookie },
    });
    expect(imagem.statusCode).toBe(413);
    expect(imagem.json()).toMatchObject({ erro: "limite_de_midia_da_conta_de_teste", limite: 30 });
    expect(audio.statusCode).toBe(413);
  });
});
