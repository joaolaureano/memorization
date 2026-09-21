import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarIdentidade } from "../../src/identidade/identidade.ts";
import type { Identidade } from "../../src/identidade/identidade.ts";

/**
 * T603 — `Identidade.cadastrar` aceita um Cadastro válido e recusa o inválido,
 * pelas regras de Nome de usuário e de Senha (FR-070, FR-071, FR-073 a FR-075,
 * FR-085; SC-025, SC-026).
 *
 * Os casos são exercitados **pela Interface** do Module, sobre o Adapter do
 * armazenamento local em memória: nenhum teste aqui inspeciona tabela — a
 * leitura direta dos dados armazenados é a verificação negativa de T604, e é
 * dela, não destes casos. O segredo é **gerado a cada execução**, como manda o
 * Princípio VIII: nenhum valor de segredo, de Senha ou de hash é versionado.
 *
 * Cada Cadastro bem sucedido deriva a Senha com scrypt (`N=32768`), o que custa
 * dezenas de milissegundos: é o preço da exigência de memória de FR-076, e o
 * Cadastro não é caminho quente.
 */

/** O segredo descartável desta execução: nunca literal, nunca versionado. */
const SEGREDO = randomBytes(48).toString("base64url");

/**
 * Senhas desta execução, também geradas: os valores existem apenas em memória,
 * e nenhum deles aparece em arquivo versionado.
 */
const SENHA = randomBytes(12).toString("base64url");
const OUTRA_SENHA = randomBytes(12).toString("base64url");

/** Uma Senha gerada com exatamente `tamanho` caracteres, para os limites. */
function senhaDe(tamanho: number): string {
  return randomBytes(tamanho).toString("base64url").slice(0, tamanho);
}

/**
 * Uma Senha gerada só com letras minúsculas, para o caso sem regra de
 * composição (FR-085): o valor continua sendo gerado, e não literal.
 */
function senhaSemComposicao(tamanho: number): string {
  const alfabeto = "abcdefghijklmnopqrstuvwxyz";

  return Array.from(
    randomBytes(tamanho),
    (byte) => alfabeto[byte % alfabeto.length] as string,
  ).join("");
}

let aberto: ArmazenamentoSqliteAberto;
let identidade: Identidade;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  identidade = criarIdentidade(aberto.usuarios, SEGREDO);
});

afterEach(async () => {
  await aberto.encerrar();
});

/** Cadastra um Usuário e devolve o resultado, sem repetir o corpo do teste. */
function cadastrar(nomeDeUsuario: string, senha: string = SENHA) {
  return identidade.cadastrar({ nomeDeUsuario, senha });
}

describe("cadastro válido", () => {
  it("aceita Nome de usuário e Senha válidos e devolve o Usuário criado", async () => {
    const resultado = await cadastrar("ana.silva");

    expect(resultado.ok).toBe(true);
    expect(resultado.ok && resultado.usuario.nomeDeUsuario).toBe("ana.silva");
    expect(resultado.ok && resultado.usuario.id).toEqual(expect.any(String));
  });

  it("devolve apenas id e nomeDeUsuario, sem a Senha nem transformação dela", async () => {
    const resultado = await cadastrar("ana.silva");

    expect(resultado.ok).toBe(true);
    expect(Object.keys(resultado).sort()).toEqual(["ok", "usuario"]);
    expect(
      Object.keys(resultado.ok ? resultado.usuario : {}).sort(),
    ).toEqual(["id", "nomeDeUsuario"]);
    expect(JSON.stringify(resultado)).not.toContain(SENHA);
  });

  it("descarta os espaços ao redor do Nome de usuário antes de validar", async () => {
    const resultado = await cadastrar("  ana  ");

    expect(resultado.ok && resultado.usuario.nomeDeUsuario).toBe("ana");
  });

  it("aceita Nome de usuário com exatamente 3 e 50 caracteres", async () => {
    expect((await cadastrar("abc")).ok).toBe(true);
    expect((await cadastrar("a".repeat(50))).ok).toBe(true);
    expect((await cadastrar("1.a-2_b")).ok).toBe(true);
  });

  it("aceita Senha com exatamente 8 e 128 caracteres", async () => {
    expect((await cadastrar("ana.silva", senhaDe(8))).ok).toBe(true);
    expect((await cadastrar("bruno.souza", senhaDe(128))).ok).toBe(true);
  });

  it("aceita Senha de só letras minúsculas: nenhuma regra de composição é imposta", async () => {
    expect((await cadastrar("ana.silva", senhaSemComposicao(10))).ok).toBe(true);
  });

  it("preserva e conta os espaços da Senha, inclusive nas pontas", async () => {
    const comEspacosNasPontas = `  ${senhaDe(5)}  `;

    expect((await cadastrar("ana.silva", comEspacosNasPontas)).ok).toBe(true);

    /** Oito espaços são oito caracteres: a Senha não é descartada nem podada. */
    expect((await cadastrar("bruno.souza", " ".repeat(8))).ok).toBe(true);
  });

  it("ignora propriedade extra do que recebe, inclusive a Confirmação da Senha", async () => {
    /** A Confirmação não faz parte do contrato: FR-072 é verificado na tela. */
    const dados = {
      nomeDeUsuario: "ana.silva",
      senha: SENHA,
      confirmacaoDaSenha: OUTRA_SENHA,
    };

    const resultado = await identidade.cadastrar(dados);

    expect(resultado.ok).toBe(true);
    expect(JSON.stringify(resultado)).not.toContain(OUTRA_SENHA);
  });
});

describe("recusa de Nome de usuário", () => {
  it("recusa Nome de usuário com menos de 3 caracteres, informando a regra", async () => {
    const resultado = await cadastrar("ab");

    expect(resultado).toEqual({
      ok: false,
      erro: "nome_de_usuario_invalido",
      mensagem: expect.stringContaining("pelo menos 3 caracteres"),
    });
  });

  it("recusa Nome de usuário com mais de 50 caracteres, informando a regra", async () => {
    const resultado = await cadastrar("a".repeat(51));

    expect(resultado).toEqual({
      ok: false,
      erro: "nome_de_usuario_invalido",
      mensagem: expect.stringContaining("no máximo 50 caracteres"),
    });
  });

  it("recusa letra acentuada, porque a comparação sem caixa é ASCII", async () => {
    const resultado = await cadastrar("josé");

    expect(resultado).toEqual({
      ok: false,
      erro: "nome_de_usuario_invalido",
      mensagem: expect.stringContaining("letras de A a Z"),
    });
  });

  it("recusa Nome de usuário com espaço, e nada é gravado por isso", async () => {
    const resultado = await cadastrar("ana silva");

    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.erro).toBe(
      "nome_de_usuario_invalido",
    );

    /** O Nome de usuário em volta continua livre depois da recusa. */
    expect((await cadastrar("ana.silva")).ok).toBe(true);
  });

  it("recusa Nome de usuário só de espaços, depois de descartá-los", async () => {
    const resultado = await cadastrar("   ");

    expect(resultado.ok === false && resultado.erro).toBe(
      "nome_de_usuario_invalido",
    );
  });

  it("recusa um Nome de usuário já existente sem distinguir maiúsculas de minúsculas", async () => {
    expect((await cadastrar("Ana.Silva")).ok).toBe(true);

    for (const repetido of ["ana.silva", "ANA.SILVA", "  Ana.Silva  "]) {
      const resultado = await cadastrar(repetido);

      expect(resultado).toEqual({
        ok: false,
        erro: "nome_de_usuario_existente",
        mensagem: expect.stringContaining("já existe"),
      });
    }
  });

  it("recusa a duplicata sem repetir a Senha na mensagem", async () => {
    await cadastrar("Ana.Silva");

    const resultado = await cadastrar("ana.silva");

    expect(resultado.ok).toBe(false);
    expect(JSON.stringify(resultado)).not.toContain(SENHA);
  });
});

describe("recusa de Senha", () => {
  it("recusa Senha com menos de 8 caracteres, informando o intervalo", async () => {
    const resultado = await cadastrar("ana.silva", senhaDe(7));

    expect(resultado).toEqual({
      ok: false,
      erro: "senha_invalida",
      mensagem: expect.stringContaining("entre 8 e 128 caracteres"),
    });
  });

  it("recusa Senha com mais de 128 caracteres, informando o intervalo", async () => {
    const resultado = await cadastrar("ana.silva", senhaDe(129));

    expect(resultado).toEqual({
      ok: false,
      erro: "senha_invalida",
      mensagem: expect.stringContaining("entre 8 e 128 caracteres"),
    });
  });

  it("recusa Senha de sete espaços, contando os espaços que a Senha tem", async () => {
    const resultado = await cadastrar("ana.silva", " ".repeat(7));

    expect(resultado.ok === false && resultado.erro).toBe("senha_invalida");
  });

  it("não repete a Senha recebida em nenhuma mensagem de recusa", async () => {
    const senhaCurta = OUTRA_SENHA.slice(0, 7);
    const resultado = await cadastrar("ana.silva", senhaCurta);

    expect(resultado.ok).toBe(false);
    expect(JSON.stringify(resultado)).not.toContain(senhaCurta);
  });

  it("recusa a Senha antes do Nome de usuário apenas quando o Nome é válido", async () => {
    /** Nome de usuário inválido e Senha inválida: a primeira regra responde. */
    const resultado = await cadastrar("ab", senhaDe(7));

    expect(resultado.ok === false && resultado.erro).toBe(
      "nome_de_usuario_invalido",
    );
  });
});

describe("falha do armazenamento", () => {
  it("recusa o Cadastro como indisponivel, sem apresentá-lo como concluído", async () => {
    const fechado = aberto;

    await fechado.encerrar();

    /**
     * O armazenamento encerrado é o que responde à tentativa; o `afterEach`
     * fecha o que é aberto aqui, porque encerrar duas vezes o mesmo arquivo é
     * erro do driver.
     */
    aberto = await abrirArmazenamentoSqlite(":memory:");

    const resultado = await cadastrar("ana.silva");

    expect(resultado).toEqual({
      ok: false,
      erro: "indisponivel",
      mensagem: "O armazenamento não está disponível. Tente novamente.",
    });
    expect(JSON.stringify(resultado)).not.toContain(SENHA);
  });

  it("aceita o mesmo Cadastro numa nova tentativa, com o armazenamento de volta", async () => {
    const fechado = aberto;

    await fechado.encerrar();

    expect((await cadastrar("ana.silva")).ok).toBe(false);

    /** Nova tentativa, com o mesmo conteúdo informado: nada foi redigitado. */
    aberto = await abrirArmazenamentoSqlite(":memory:");
    identidade = criarIdentidade(aberto.usuarios, SEGREDO);

    expect((await cadastrar("ana.silva")).ok).toBe(true);
  });
});
