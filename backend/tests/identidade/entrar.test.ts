import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import {
  criarIdentidade,
  type Identidade,
} from "../../src/identidade/identidade.ts";
import {
  segredoGerado,
  senhaGerada,
} from "../armazenamento/usuarios-de-teste.ts";

/**
 * T702 — `Identidade.autenticar` confere a Credencial (FR-086, FR-087,
 * FR-088, SC-029, SC-036).
 *
 * Toda asserção atravessa a **Interface** do Module, sobre o Adapter do
 * armazenamento local em memória: nenhum cenário inspeciona `sal`, `hash` ou
 * qualquer estado interno. O segredo e as Senhas são gerados a cada execução —
 * nenhum valor sensível é literal, e nada dele aparece no arquivo.
 *
 * O que a Interface promete: o Nome de usuário é comparado depois de descartar
 * os espaços ao redor e sem distinguir maiúsculas de minúsculas (SC-036), a
 * Senha é comparada exatamente, com os espaços preservados (FR-087), e as duas
 * recusas — Nome de usuário inexistente e Senha errada — são **indistinguíveis**:
 * a mesma mensagem e a mesma ordem de grandeza de duração (FR-088, SC-029). A
 * Senha não aparece em nenhum retorno, em nenhum caso (FR-078).
 */

/** A recusa única, como o contrato a publica (FR-088). */
const RECUSA = {
  ok: false,
  erro: "credencial_invalida",
  mensagem: "Nome de usuário ou Senha incorretos.",
};

/** Quantas vezes cada recusa é medida no cenário de duração. */
const MEDICOES = 5;

/** Quantas vezes a razão entre as duas durações pode se afastar de 1. */
const FATOR_ACEITO = 10;

let aberto: ArmazenamentoSqliteAberto;
let identidade: Identidade;
let encerrado: boolean;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  identidade = criarIdentidade(aberto.usuarios, segredoGerado());
  encerrado = false;
});

afterEach(async () => {
  if (!encerrado) {
    await aberto.encerrar();
  }
});

/** Cadastra um Usuário pela Interface e devolve o id com que ele nasceu. */
async function cadastrar(
  nomeDeUsuario: string,
  senha: string,
): Promise<string> {
  const resultado = await identidade.cadastrar({ nomeDeUsuario, senha });

  if (!resultado.ok) {
    throw new Error(`cadastro recusado inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.usuario.id;
}

/** A mediana das durações das `MEDICOES` execuções do corpo informado. */
async function mediana(corpo: () => Promise<unknown>): Promise<number> {
  const duracoes: number[] = [];

  for (let indice = 0; indice < MEDICOES; indice += 1) {
    const inicio = process.hrtime.bigint();

    await corpo();

    duracoes.push(Number(process.hrtime.bigint() - inicio));
  }

  duracoes.sort((um, outro) => um - outro);

  return duracoes[Math.floor(duracoes.length / 2)] ?? 0;
}

describe("autenticar — a Credencial correta entra", () => {
  it("devolve exatamente id e nomeDeUsuario do Usuário que entrou (FR-086)", async () => {
    const senha = senhaGerada();
    const id = await cadastrar("ana.silva", senha);

    expect(await identidade.autenticar({ nomeDeUsuario: "ana.silva", senha }))
      .toEqual({
        ok: true,
        usuario: { id, nomeDeUsuario: "ana.silva" },
      });
  });

  it("descarta os espaços ao redor e não distingue maiúsculas de minúsculas no Nome de usuário (FR-087, SC-036)", async () => {
    const senha = senhaGerada();

    await cadastrar("Ana.Silva", senha);

    for (const nomeDeUsuario of ["  ana.silva  ", "ANA.SILVA", "Ana.Silva"]) {
      const resultado = await identidade.autenticar({ nomeDeUsuario, senha });

      expect(resultado.ok).toBe(true);
      expect(resultado).toMatchObject({
        usuario: { nomeDeUsuario: "Ana.Silva" },
      });
    }
  });

  it("compara a Senha exatamente, preservando os espaços das pontas (FR-087)", async () => {
    const senha = senhaGerada();
    const comEspacos = `  ${senha}  `;

    await cadastrar("ana.silva", comEspacos);

    expect(
      await identidade.autenticar({ nomeDeUsuario: "ana.silva", senha: comEspacos }),
    ).toMatchObject({ ok: true });

    /** A mesma Senha sem os espaços não é a Senha cadastrada. */
    expect(
      await identidade.autenticar({ nomeDeUsuario: "ana.silva", senha }),
    ).toEqual(RECUSA);
  });
});

describe("autenticar — as duas recusas são uma só", () => {
  it("recusa o Nome de usuário inexistente com a mensagem única (FR-088)", async () => {
    await cadastrar("ana.silva", senhaGerada());

    expect(
      await identidade.autenticar({
        nomeDeUsuario: "nao.existe",
        senha: senhaGerada(),
      }),
    ).toEqual(RECUSA);
  });

  it("recusa a Senha errada com exatamente a mesma recusa (FR-088, SC-029)", async () => {
    const senha = senhaGerada();

    await cadastrar("ana.silva", senha);

    const semEsseNome = await identidade.autenticar({
      nomeDeUsuario: "nao.existe",
      senha,
    });
    const comSenhaErrada = await identidade.autenticar({
      nomeDeUsuario: "ana.silva",
      senha: senhaGerada(),
    });

    /** Objeto idêntico: o caller não distingue um caso do outro. */
    expect(comSenhaErrada).toEqual(semEsseNome);
    expect(comSenhaErrada).toEqual(RECUSA);
  });

  it("leva as duas recusas a ordens de grandeza comparáveis, sem afirmar igualdade de relógio (FR-088, SC-029)", async () => {
    const senha = senhaGerada();

    await cadastrar("ana.silva", senha);

    /**
     * Uma rodada de aquecimento de cada caso, descartada da medição: o que se
     * compara é o custo de regime de cada recusa, e não o da primeira chamada
     * do processo.
     */
    await identidade.autenticar({ nomeDeUsuario: "nao.existe", senha });
    await identidade.autenticar({ nomeDeUsuario: "ana.silva", senha });

    const semEsseNome = await mediana(() =>
      identidade.autenticar({ nomeDeUsuario: "nao.existe", senha }),
    );
    const comSenhaErrada = await mediana(() =>
      identidade.autenticar({ nomeDeUsuario: "ana.silva", senha: senhaGerada() }),
    );

    /** Nenhuma das duas é instantânea: as duas derivam uma chave. */
    expect(semEsseNome).toBeGreaterThan(0);
    expect(comSenhaErrada).toBeGreaterThan(0);

    const razao = Math.max(semEsseNome, comSenhaErrada) /
      Math.min(semEsseNome, comSenhaErrada);

    expect(razao).toBeLessThan(FATOR_ACEITO);
  });
});

describe("autenticar — a Senha nunca aparece em nenhum retorno", () => {
  it("não devolve a Senha no sucesso, e apenas id e nomeDeUsuario (FR-078)", async () => {
    const senha = senhaGerada();
    const id = await cadastrar("ana.silva", senha);

    const resultado = await identidade.autenticar({
      nomeDeUsuario: "ana.silva",
      senha,
    });

    expect(JSON.stringify(resultado)).not.toContain(senha);
    expect(Object.keys(resultado).sort()).toEqual(["ok", "usuario"]);
    expect(Object.keys(resultado.ok ? resultado.usuario : {}).sort()).toEqual([
      "id",
      "nomeDeUsuario",
    ]);
    expect(resultado).toMatchObject({ usuario: { id } });
  });

  it("não devolve a Senha na recusa, e não repete nada do que foi informado (FR-078)", async () => {
    const senha = senhaGerada();

    await cadastrar("ana.silva", senha);

    for (const dados of [
      { nomeDeUsuario: "nao.existe", senha },
      { nomeDeUsuario: "ana.silva", senha: senhaGerada() },
    ]) {
      const recusa = await identidade.autenticar(dados);

      expect(JSON.stringify(recusa)).not.toContain(dados.senha);
      expect(Object.keys(recusa).sort()).toEqual(["erro", "mensagem", "ok"]);
    }
  });
});

describe("autenticar — a falha do armazenamento não é Senha errada", () => {
  it("recusa como indisponivel, sem apresentar a operação como recusa de Credencial (FR-044, FR-045)", async () => {
    const senha = senhaGerada();

    await cadastrar("ana.silva", senha);
    await aberto.encerrar();
    encerrado = true;

    const recusa = await identidade.autenticar({
      nomeDeUsuario: "ana.silva",
      senha,
    });

    expect(recusa).toEqual({
      ok: false,
      erro: "indisponivel",
      mensagem: "O armazenamento não está disponível. Tente novamente.",
    });

    /**
     * A recusa de credencial diz outra coisa: quem não consegue conferir a
     * Senha **não** afirma que ela está errada (FR-088, FR-107).
     */
    expect(recusa).not.toEqual(RECUSA);
  });
});
