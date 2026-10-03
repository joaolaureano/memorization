import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarAcervo } from "../../src/acervo/acervo.ts";
import {
  criarIdentidade,
  type Identidade,
} from "../../src/identidade/identidade.ts";
import {
  cadastrarUsuarioDeTeste,
  segredoGerado,
  senhaGerada,
  type CredencialDeTeste,
} from "../armazenamento/usuarios-de-teste.ts";

/**
 * T1708 — a gestão da conta pela Interface do `Identidade` (FR-257..FR-279):
 * `obterConta`, `alterarNomeDeUsuario`, `trocarSenha` e `excluirConta`, sobre o
 * Adapter local em memória. Senhas e segredo são gerados a cada execução.
 */

let aberto: ArmazenamentoSqliteAberto;
let identidade: Identidade;
let ana: CredencialDeTeste;
let bruno: CredencialDeTeste;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  identidade = criarIdentidade(aberto.usuarios, segredoGerado());
  ana = await cadastrarUsuarioDeTeste(identidade, "ana.silva");
  bruno = await cadastrarUsuarioDeTeste(identidade, "bruno.souza");
});

afterEach(async () => {
  await aberto.encerrar();
});

describe("obterConta (FR-257, FR-258)", () => {
  it("devolve o Nome de usuário e as contagens, sem nada da Senha", async () => {
    const acervo = criarAcervo(aberto.armazenamento, ana.id);
    await acervo.criarCartao({ frente: "To walk", verso: "Caminhar" });
    await acervo.criarBaralho({ nome: "Inglês" });

    const resultado = await identidade.obterConta(ana.id);

    expect(resultado).toEqual({
      ok: true,
      conta: {
        nomeDeUsuario: "ana.silva",
        contagens: { cartoes: 1, baralhos: 1, registrosDeSessao: 0, agenda: 0 },
      },
    });
    expect(JSON.stringify(resultado)).not.toContain(ana.senha);
    expect(JSON.stringify(resultado)).not.toMatch(/sal|hash|parametros/);
  });
});

describe("alterarNomeDeUsuario (FR-259..FR-265)", () => {
  it("altera o nome, descarta espaços ao redor e libera o anterior", async () => {
    const resultado = await identidade.alterarNomeDeUsuario(ana.id, {
      senhaAtual: ana.senha,
      novoNomeDeUsuario: "  ana.nova  ",
    });

    expect(resultado).toEqual({ ok: true, nomeDeUsuario: "ana.nova" });

    expect(
      await identidade.autenticar({
        nomeDeUsuario: "ana.nova",
        senha: ana.senha,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await identidade.autenticar({
        nomeDeUsuario: "ana.silva",
        senha: ana.senha,
      }),
    ).toMatchObject({ ok: false, erro: "credencial_invalida" });

    /** O nome liberado já pode ser cadastrado por outra pessoa. */
    expect(
      await identidade.cadastrar({
        nomeDeUsuario: "ana.silva",
        senha: senhaGerada(),
      }),
    ).toMatchObject({ ok: true });
  });

  it.each([
    ["curto demais", "ab"],
    ["longo demais", "a".repeat(51)],
    ["com caractere inválido", "ana silva"],
    ["com acento", "aná"],
  ])("recusa nome %s como dados_invalidos no campo do nome", async (_, nome) => {
    const resultado = await identidade.alterarNomeDeUsuario(ana.id, {
      senhaAtual: ana.senha,
      novoNomeDeUsuario: nome,
    });

    expect(resultado).toMatchObject({
      ok: false,
      erro: "dados_invalidos",
      campo: "nomeDeUsuario",
    });
  });

  it("aceita os limites de 3 e 50 caracteres", async () => {
    expect(
      await identidade.alterarNomeDeUsuario(ana.id, {
        senhaAtual: ana.senha,
        novoNomeDeUsuario: "abc",
      }),
    ).toEqual({ ok: true, nomeDeUsuario: "abc" });
    expect(
      await identidade.alterarNomeDeUsuario(ana.id, {
        senhaAtual: ana.senha,
        novoNomeDeUsuario: "a".repeat(50),
      }),
    ).toEqual({ ok: true, nomeDeUsuario: "a".repeat(50) });
  });

  it("recusa o nome igual ao atual como mesmo_nome (FR-261)", async () => {
    expect(
      await identidade.alterarNomeDeUsuario(ana.id, {
        senhaAtual: ana.senha,
        novoNomeDeUsuario: " ana.silva ",
      }),
    ).toMatchObject({ ok: false, erro: "mesmo_nome" });
  });

  it("recusa nome de outro Usuário, mesmo diferindo só em maiúsculas (FR-262, SC-112)", async () => {
    expect(
      await identidade.alterarNomeDeUsuario(ana.id, {
        senhaAtual: ana.senha,
        novoNomeDeUsuario: "BRUNO.souza",
      }),
    ).toMatchObject({ ok: false, erro: "nome_indisponivel" });

    expect(
      await identidade.autenticar({
        nomeDeUsuario: "ana.silva",
        senha: ana.senha,
      }),
    ).toMatchObject({ ok: true });
  });

  it("recusa a Senha atual incorreta sem alterar nada (FR-279)", async () => {
    expect(
      await identidade.alterarNomeDeUsuario(ana.id, {
        senhaAtual: senhaGerada(),
        novoNomeDeUsuario: "ana.nova",
      }),
    ).toMatchObject({ ok: false, erro: "senha_atual_incorreta" });

    expect(
      await identidade.autenticar({
        nomeDeUsuario: "ana.silva",
        senha: ana.senha,
      }),
    ).toMatchObject({ ok: true });
  });
});

describe("trocarSenha (FR-266..FR-271)", () => {
  it("troca a Senha: a antiga deixa de valer e a nova passa a valer", async () => {
    const nova = senhaGerada();

    expect(
      await identidade.trocarSenha(ana.id, {
        senhaAtual: ana.senha,
        novaSenha: nova,
        confirmacaoDaSenha: nova,
      }),
    ).toEqual({ ok: true });

    expect(
      await identidade.autenticar({
        nomeDeUsuario: "ana.silva",
        senha: ana.senha,
      }),
    ).toMatchObject({ ok: false, erro: "credencial_invalida" });
    expect(
      await identidade.autenticar({ nomeDeUsuario: "ana.silva", senha: nova }),
    ).toMatchObject({ ok: true });

    /** A Senha de outro Usuário não muda. */
    expect(
      await identidade.autenticar({
        nomeDeUsuario: "bruno.souza",
        senha: bruno.senha,
      }),
    ).toMatchObject({ ok: true });
  });

  it("preserva espaços da nova Senha e aceita 8 e 128 caracteres (FR-267)", async () => {
    const oito = "  abcd  ";

    expect(
      await identidade.trocarSenha(ana.id, {
        senhaAtual: ana.senha,
        novaSenha: oito,
        confirmacaoDaSenha: oito,
      }),
    ).toEqual({ ok: true });
    expect(
      await identidade.autenticar({ nomeDeUsuario: "ana.silva", senha: oito }),
    ).toMatchObject({ ok: true });

    const longa = "x".repeat(128);

    expect(
      await identidade.trocarSenha(ana.id, {
        senhaAtual: oito,
        novaSenha: longa,
        confirmacaoDaSenha: longa,
      }),
    ).toEqual({ ok: true });
  });

  it.each([["1 a 7", "1234567"], ["129", "x".repeat(129)]])(
    "recusa nova Senha com %s caracteres como dados_invalidos",
    async (_, nova) => {
      expect(
        await identidade.trocarSenha(ana.id, {
          senhaAtual: ana.senha,
          novaSenha: nova,
          confirmacaoDaSenha: nova,
        }),
      ).toMatchObject({
        ok: false,
        erro: "dados_invalidos",
        campo: "novaSenha",
      });
    },
  );

  it("recusa Confirmação diferente apontando o campo (FR-269)", async () => {
    expect(
      await identidade.trocarSenha(ana.id, {
        senhaAtual: ana.senha,
        novaSenha: senhaGerada(),
        confirmacaoDaSenha: senhaGerada(),
      }),
    ).toMatchObject({
      ok: false,
      erro: "dados_invalidos",
      campo: "confirmacaoDaSenha",
    });
  });

  it("recusa a nova Senha igual à atual como mesma_senha (FR-268)", async () => {
    expect(
      await identidade.trocarSenha(ana.id, {
        senhaAtual: ana.senha,
        novaSenha: ana.senha,
        confirmacaoDaSenha: ana.senha,
      }),
    ).toMatchObject({ ok: false, erro: "mesma_senha" });
  });

  it("recusa a Senha atual incorreta sem alterar nada (FR-279)", async () => {
    const nova = senhaGerada();

    expect(
      await identidade.trocarSenha(ana.id, {
        senhaAtual: senhaGerada(),
        novaSenha: nova,
        confirmacaoDaSenha: nova,
      }),
    ).toMatchObject({ ok: false, erro: "senha_atual_incorreta" });
    expect(
      await identidade.autenticar({
        nomeDeUsuario: "ana.silva",
        senha: ana.senha,
      }),
    ).toMatchObject({ ok: true });
  });
});

describe("excluirConta (FR-272..FR-278)", () => {
  it("remove o Usuário e o que é dele, sem tocar no outro (FR-274, FR-275)", async () => {
    await criarAcervo(aberto.armazenamento, ana.id).criarCartao({
      frente: "To walk",
      verso: "Caminhar",
    });
    await criarAcervo(aberto.armazenamento, bruno.id).criarCartao({
      frente: "To run",
      verso: "Correr",
    });

    expect(
      await identidade.excluirConta(ana.id, { senhaAtual: ana.senha }),
    ).toEqual({ ok: true });

    expect(
      await identidade.autenticar({
        nomeDeUsuario: "ana.silva",
        senha: ana.senha,
      }),
    ).toMatchObject({ ok: false, erro: "credencial_invalida" });
    expect(await aberto.armazenamento.listarCartoes(ana.id)).toEqual([]);
    expect(await aberto.armazenamento.listarCartoes(bruno.id)).toHaveLength(1);
  });

  it("recusa a Senha atual incorreta sem excluir (FR-279)", async () => {
    expect(
      await identidade.excluirConta(ana.id, { senhaAtual: senhaGerada() }),
    ).toMatchObject({ ok: false, erro: "senha_atual_incorreta" });
    expect(
      await identidade.autenticar({
        nomeDeUsuario: "ana.silva",
        senha: ana.senha,
      }),
    ).toMatchObject({ ok: true });
  });

  it("permite novo Cadastro com o nome excluído, sem dado anterior (FR-277)", async () => {
    await criarAcervo(aberto.armazenamento, ana.id).criarCartao({
      frente: "To walk",
      verso: "Caminhar",
    });
    await identidade.excluirConta(ana.id, { senhaAtual: ana.senha });

    const nova = await cadastrarUsuarioDeTeste(identidade, "ana.silva");

    expect(await aberto.armazenamento.listarCartoes(nova.id)).toEqual([]);
  });
});

describe("mensagem única de Senha atual incorreta (FR-279, SC-107)", () => {
  it("é a mesma nas três ações e não revela Senha nem derivado", async () => {
    const errada = senhaGerada();
    const nova = senhaGerada();

    const recusas = [
      await identidade.alterarNomeDeUsuario(ana.id, {
        senhaAtual: errada,
        novoNomeDeUsuario: "ana.nova",
      }),
      await identidade.trocarSenha(ana.id, {
        senhaAtual: errada,
        novaSenha: nova,
        confirmacaoDaSenha: nova,
      }),
      await identidade.excluirConta(ana.id, { senhaAtual: errada }),
    ];

    for (const recusa of recusas) {
      expect(recusa).toEqual({
        ok: false,
        erro: "senha_atual_incorreta",
        mensagem: recusas[0] && "mensagem" in recusas[0] ? recusas[0].mensagem : "",
      });
    }

    const mensagens = new Set(
      recusas.map((recusa) => ("mensagem" in recusa ? recusa.mensagem : "")),
    );

    expect(mensagens.size).toBe(1);

    for (const mensagem of mensagens) {
      expect(mensagem).not.toContain(errada);
      expect(mensagem).not.toContain(ana.senha);
    }
  });
});
