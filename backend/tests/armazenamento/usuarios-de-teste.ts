import { randomBytes } from "node:crypto";

import type { ArmazenamentoDeUsuarios } from "../../src/armazenamento/porta.ts";
import type { Identidade } from "../../src/identidade/identidade.ts";

/**
 * Apoio dos cenários que precisam de Usuários: o dono do acervo e a Credencial.
 *
 * Todo valor sensível é **gerado a cada execução** — segredo, Senha e os dados
 * da derivação —, e nenhum aparece em arquivo versionado (Princípio VIII).
 * Este módulo é de teste, e não um Module: por isso pode falar das duas Portas
 * e do `Identidade`, coisa que nenhum Module faz.
 */

/** O segredo do servidor desta execução: descartável, e nunca literal. */
export function segredoGerado(): string {
  return randomBytes(48).toString("base64url");
}

/** Uma Senha gerada nesta execução, dentro do intervalo aceito (FR-075). */
export function senhaGerada(): string {
  return randomBytes(12).toString("base64url");
}

/**
 * O cabeçalho `Authorization: Basic base64(nomeDeUsuario:senha)` — a Credencial
 * que acompanha **toda** requisição de acervo (FR-090). Ela vive só na memória
 * de quem a informa: nada aqui grava o valor em lugar algum.
 */
export function cabecalhoDeCredencial(
  nomeDeUsuario: string,
  senha: string,
): Record<string, string> {
  const valor = Buffer.from(
    `${nomeDeUsuario}:${senha}`,
    "utf8",
  ).toString("base64");

  return { authorization: `Basic ${valor}` };
}

/**
 * Cria um Usuário **direto na Porta**, sem derivação de Senha, e devolve o seu
 * `id`: é o dono do acervo dos cenários que não exercitam o Cadastro nem Entrar
 * — nenhuma Senha é conhecida daqui, e nenhuma verificação é possível com este
 * Usuário. A gravação direta existe porque esses cenários precisam apenas de um
 * dono existente, que é o que o esquema exige de todo Cartão e Baralho.
 */
export async function criarDonoDeTeste(
  usuarios: ArmazenamentoDeUsuarios,
  id = "dono-um",
  nomeDeUsuario = "ana.silva",
): Promise<string> {
  const gravado = await usuarios.inserirUsuario({
    id,
    nomeDeUsuario,
    sal: randomBytes(16),
    hash: randomBytes(64),
    parametros: JSON.stringify({
      algoritmo: "scrypt",
      entrada: "hmac-sha256",
      N: 32768,
      r: 8,
      p: 1,
      tamanhoDoHash: 64,
    }),
  });

  if (!gravado.ok) {
    throw new Error(
      `não foi possível criar o dono do cenário: ${gravado.erro}`,
    );
  }

  return gravado.valor.id;
}

/** A Credencial de um Usuário de teste: o que Entrar verifica. */
export interface CredencialDeTeste {
  readonly id: string;
  readonly nomeDeUsuario: string;
  readonly senha: string;
  /** O cabeçalho que acompanha toda requisição de acervo (FR-090). */
  readonly cabecalho: Record<string, string>;
}

/**
 * Cadastra um Usuário pelo **Module** — com a Senha gerada nesta execução,
 * derivada e guardada como em produção — e devolve a Credencial dele. É por
 * aqui que os cenários de HTTP obtêm a Credencial que apresentam em cada
 * requisição: a Senha nunca é literal, e o hash guardado é o de uma derivação
 * de verdade.
 */
export async function cadastrarUsuarioDeTeste(
  identidade: Identidade,
  nomeDeUsuario = "ana.silva",
  senha = senhaGerada(),
): Promise<CredencialDeTeste> {
  const resultado = await identidade.cadastrar({ nomeDeUsuario, senha });

  if (!resultado.ok) {
    throw new Error(
      `cadastro recusado inesperadamente: ${resultado.erro} ${resultado.mensagem}`,
    );
  }

  return {
    id: resultado.usuario.id,
    nomeDeUsuario: resultado.usuario.nomeDeUsuario,
    senha,
    cabecalho: cabecalhoDeCredencial(nomeDeUsuario, senha),
  };
}
