import { randomBytes } from "node:crypto";

import { GetParametersCommand, SSMClient } from "@aws-sdk/client-ssm";

import { describe, expect, it, vi } from "vitest";

import {
  FalhaNaLeituraDoCofreError,
  nomeDoParametro,
  NOMES_DOS_PARAMETROS,
  ParametroAusenteError,
  type SegredosDaFuncao,
} from "../../src/funcao/segredos.ts";
import { leitorDeSegredosDoSsm, type EnviarAoCofre } from "../../src/funcao/ssm.ts";
import {
  leitorDeSegredosEmMemoria,
  PREFIXO_DE_TESTE,
} from "./segredos-em-memoria.ts";

/**
 * T1001 — a Seam `LeitorDeSegredos`: os três segredos numa leitura só, e a
 * ausência de um deles como falha que **nomeia o parâmetro** e nunca o valor
 * (FR-077, FR-123; SC-052).
 *
 * O SDK é substituído pela Interface — um envio de mentira —, de modo que
 * **nenhuma chamada de rede acontece**: o que se prova é a chamada que o Adapter
 * monta (uma só, com os três nomes sob o prefixo e `WithDecryption: true`) e o
 * tratamento dos três desfechos de leitura: nome ausente, nome devolvido vazio e
 * falha inteira da leitura. Todo valor é **gerado por execução**, e nenhum
 * aparece em arquivo versionado (Princípio VIII).
 */

/** O prefixo do cofre desta execução — o mesmo que a infraestrutura provisiona. */
const PREFIXO = PREFIXO_DE_TESTE;

/** O nome completo de um dos três parâmetros, como o cofre o conhece. */
function completo(chave: keyof typeof NOMES_DOS_PARAMETROS): string {
  return nomeDoParametro(PREFIXO, NOMES_DOS_PARAMETROS[chave]);
}

/** Os três segredos desta execução: gerados agora, e nunca literais. */
function segredosGerados(): SegredosDaFuncao {
  const senhaDoBanco = randomBytes(18).toString("base64url");

  return {
    urlDeConexao:
      `postgresql://usuario:${senhaDoBanco}@base.exemplo.invalid:5432/` +
      "memorizacao?sslmode=verify-full",
    segredoDeOrigem: randomBytes(48).toString("base64url"),
    segredoDasSenhas: randomBytes(48).toString("base64url"),
  };
}

/** O cofre de mentira: registra os comandos recebidos e devolve o que lhe mandarem. */
interface CofreDeMentira {
  readonly enviar: EnviarAoCofre;
  readonly comandos: GetParametersCommand[];
}

/**
 * Um envio de mentira que devolve os parâmetros informados — e, quando um deles
 * faltar no mapa, devolve a resposta **sem** ele, exatamente como o SSM faz com
 * um nome que não existe.
 */
function cofreDeMentira(
  valores: Partial<Record<string, string | undefined>>,
): CofreDeMentira {
  const comandos: GetParametersCommand[] = [];
  const parametros = Object.entries(valores).map(([Name, Value]) => ({
    Name,
    Value,
  }));

  return {
    comandos,
    async enviar(comando) {
      comandos.push(comando);

      return { Parameters: parametros };
    },
  };
}

/** Um envio de mentira que falha com a mensagem informada. */
function cofreQueFalha(mensagem: string): CofreDeMentira {
  const comandos: GetParametersCommand[] = [];

  return {
    comandos,
    async enviar(comando) {
      comandos.push(comando);

      throw new Error(mensagem);
    },
  };
}

/** Todos os valores de um cenário, para a varredura de ausência deles. */
function valoresDe(segredos: SegredosDaFuncao): string[] {
  return [
    segredos.urlDeConexao,
    segredos.urlDeConexao.split(":")[2],
    segredos.segredoDeOrigem,
    segredos.segredoDasSenhas,
  ];
}

/** O mapa dos três nomes completos para os valores gerados. */
function parametrosDoCofre(segredos: SegredosDaFuncao): Record<string, string> {
  return {
    [completo("urlDeConexao")]: segredos.urlDeConexao,
    [completo("segredoDeOrigem")]: segredos.segredoDeOrigem,
    [completo("segredoDasSenhas")]: segredos.segredoDasSenhas,
  };
}

describe("o Adapter de SSM lê os três segredos numa chamada só", () => {
  it("faz uma única GetParameters, com os três nomes sob o prefixo e com decifragem", async () => {
    const segredos = segredosGerados();
    const cofre = cofreDeMentira(parametrosDoCofre(segredos));

    const lidos = await leitorDeSegredosDoSsm(PREFIXO, cofre.enviar).ler();

    expect(cofre.comandos).toHaveLength(1);

    const [comando] = cofre.comandos;

    expect(comando.input.Names).toEqual([
      completo("urlDeConexao"),
      completo("segredoDeOrigem"),
      completo("segredoDasSenhas"),
    ]);
    expect(comando.input.WithDecryption).toBe(true);

    /** Os valores chegam como vieram do cofre, e nos três campos certos. */
    expect(lidos).toEqual(segredos);
  });

  it("não duplica a barra quando o prefixo informado termina em barra", async () => {
    const segredos = segredosGerados();
    const cofre = cofreDeMentira(parametrosDoCofre(segredos));

    await leitorDeSegredosDoSsm(`${PREFIXO}/`, cofre.enviar).ler();

    expect(cofre.comandos[0]?.input.Names).toEqual([
      completo("urlDeConexao"),
      completo("segredoDeOrigem"),
      completo("segredoDasSenhas"),
    ]);
  });

  it("não toca no cliente do SDK: nenhuma chamada de rede acontece", async () => {
    const envioDoSdk = vi.spyOn(SSMClient.prototype, "send");
    const segredos = segredosGerados();
    const cofre = cofreDeMentira(parametrosDoCofre(segredos));

    try {
      await leitorDeSegredosDoSsm(PREFIXO, cofre.enviar).ler();

      expect(envioDoSdk).not.toHaveBeenCalled();
    } finally {
      envioDoSdk.mockRestore();
    }
  });
});

describe("parâmetro ausente ou vazio é falha que nomeia o parâmetro", () => {
  it.each([
    ["a URL de conexão", "urlDeConexao" as const],
    ["o segredo de origem", "segredoDeOrigem" as const],
    ["o segredo das Senhas", "segredoDasSenhas" as const],
  ])("nomeia %s quando o cofre não o devolve", async (_rotulo, chave) => {
    const segredos = segredosGerados();
    const presentes = parametrosDoCofre(segredos);

    delete presentes[completo(chave)];

    const cofre = cofreDeMentira(presentes);
    const recusa = await leitorDeSegredosDoSsm(PREFIXO, cofre.enviar)
      .ler()
      .catch((erro: unknown) => erro);

    expect(recusa).toBeInstanceOf(ParametroAusenteError);
    expect((recusa as Error).message).toContain(completo(chave));

    /** Nenhum valor do cenário aparece na mensagem (FR-123, SC-052). */
    for (const valor of valoresDe(segredos)) {
      expect((recusa as Error).message).not.toContain(valor);
    }
  });

  it("trata o parâmetro devolvido vazio como ausente, e o nomeia", async () => {
    const segredos = segredosGerados();
    const cofre = cofreDeMentira({
      ...parametrosDoCofre(segredos),
      [completo("urlDeConexao")]: "   ",
    });

    const recusa = await leitorDeSegredosDoSsm(PREFIXO, cofre.enviar)
      .ler()
      .catch((erro: unknown) => erro);

    expect(recusa).toBeInstanceOf(ParametroAusenteError);
    expect((recusa as Error).message).toContain(completo("urlDeConexao"));
    expect((recusa as Error).message).not.toContain(segredos.segredoDeOrigem);
  });
});

describe("a falha da leitura não propaga a mensagem do SDK", () => {
  it("responde com mensagem própria, nomeando só o prefixo", async () => {
    const segredos = segredosGerados();
    const mensagemDoSdk =
      `AccessDenied: não autorizado a ler ${segredos.segredoDeOrigem} ` +
      `com a credencial da URL ${segredos.urlDeConexao}`;

    const cofre = cofreQueFalha(mensagemDoSdk);
    const recusa = await leitorDeSegredosDoSsm(PREFIXO, cofre.enviar)
      .ler()
      .catch((erro: unknown) => erro);

    expect(recusa).toBeInstanceOf(FalhaNaLeituraDoCofreError);
    expect((recusa as Error).message).toContain(PREFIXO);

    expect((recusa as Error).message).not.toContain("AccessDenied");
    for (const valor of valoresDe(segredos)) {
      expect((recusa as Error).message).not.toContain(valor);
    }
  });
});

describe("o Adapter em memória, usado pelos cenários do handler", () => {
  it("devolve os três valores do cenário", async () => {
    const segredos = segredosGerados();

    await expect(leitorDeSegredosEmMemoria(segredos).ler()).resolves.toEqual(
      segredos,
    );
  });

  it("falha do mesmo modo quando um dos valores falta, sem repetir valor algum", async () => {
    const segredos = segredosGerados();
    const { segredoDeOrigem, ...semOrigem } = segredos;

    const recusa = await leitorDeSegredosEmMemoria(semOrigem)
      .ler()
      .catch((erro: unknown) => erro);

    expect(recusa).toBeInstanceOf(ParametroAusenteError);
    expect((recusa as Error).message).toContain(completo("segredoDeOrigem"));
    expect((recusa as Error).message).not.toContain(segredoDeOrigem);
  });
});
