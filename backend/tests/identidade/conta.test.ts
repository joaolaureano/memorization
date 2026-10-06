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
 * `obterConta`, `trocarSenha` e `excluirConta`, sobre o Adapter local em
 * memória. Senhas e segredo são gerados a cada execução. A alteração do Nome
 * de usuário saiu da Interface (020): a validação e a unicidade do Nome
 * continuam sendo as do Cadastro, provadas em `cadastro.test.ts`.
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
    const criarBaralhoResult = await acervo.criarBaralho({ nome: "Inglês" });
    if (!criarBaralhoResult.ok) throw new Error("Falha ao criar baralho");
    await acervo.criarCartao(criarBaralhoResult.baralho.id, { frente: "To walk", verso: "Caminhar" });

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
    const acervoAna = criarAcervo(aberto.armazenamento, ana.id);
    const resultadoAna = await acervoAna.criarBaralho({ nome: "Inglês" });
    if (!resultadoAna.ok) throw new Error("Falha ao criar baralho de Ana");
    await acervoAna.criarCartao(resultadoAna.baralho.id, {
      frente: "To walk",
      verso: "Caminhar",
    });

    const acervoBruno = criarAcervo(aberto.armazenamento, bruno.id);
    const resultadoBruno = await acervoBruno.criarBaralho({ nome: "Português" });
    if (!resultadoBruno.ok) throw new Error("Falha ao criar baralho de Bruno");
    await acervoBruno.criarCartao(resultadoBruno.baralho.id, {
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
    const acervo = criarAcervo(aberto.armazenamento, ana.id);
    const resultado = await acervo.criarBaralho({ nome: "Inglês" });
    if (!resultado.ok) throw new Error("Falha ao criar baralho");
    await acervo.criarCartao(resultado.baralho.id, {
      frente: "To walk",
      verso: "Caminhar",
    });
    await identidade.excluirConta(ana.id, { senhaAtual: ana.senha });

    const nova = await cadastrarUsuarioDeTeste(identidade, "ana.silva");

    expect(await aberto.armazenamento.listarCartoes(nova.id)).toEqual([]);
  });
});

describe("mensagem única de Senha atual incorreta (FR-279, SC-107)", () => {
  it("é a mesma nas duas ações e não revela Senha nem derivado", async () => {
    const errada = senhaGerada();
    const nova = senhaGerada();

    const recusas = [
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
