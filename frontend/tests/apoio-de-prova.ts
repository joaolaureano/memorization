import { randomBytes } from "node:crypto";

import type { Credencial } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";

/**
 * Apoio das provas de tela e de cliente (T711, T712, T713;
 * specs/008-entrar/tasks.md).
 *
 * Depois de `008-entrar`, operar o acervo exige Credencial: toda prova de tela
 * começa em "Entrar" ou constrói o Adapter **já com ela**. Este módulo reúne as
 * duas coisas que essas provas precisam para isso — a Credencial de prova e o
 * Adapter de memória autenticado —, sem que cada arquivo repita a construção.
 *
 * A Senha é **gerada a cada execução** com `randomBytes`: nenhum valor literal
 * de Senha é versionado, como manda o Princípio VIII e a specs/008-entrar. O
 * Nome de usuário é fixo e não colide com os Nomes de usuário usados nas provas
 * de Cadastro.
 */

/** O Nome de usuário do Usuário de prova. */
export const NOME_DE_USUARIO_DE_PROVA = "usuario.de.prova";

/** A Senha do Usuário de prova, gerada agora, sem valor literal no arquivo. */
export const SENHA_DE_PROVA = randomBytes(12).toString("base64url");

/** A Credencial de prova: o par que acompanha toda operação nas provas. */
export const CREDENCIAL_DE_PROVA: Credencial = {
  nomeDeUsuario: NOME_DE_USUARIO_DE_PROVA,
  senha: SENHA_DE_PROVA,
};

/**
 * Outra Credencial de prova, com Nome de usuário e Senha próprios — o segundo
 * Usuário das provas de isolamento do acervo (FR-092, SC-030).
 */
export function outraCredencialDeProva(
  nomeDeUsuario = "outro.usuario",
): Credencial {
  return {
    nomeDeUsuario,
    senha: randomBytes(12).toString("base64url"),
  };
}

/**
 * O `ClienteEmMemoria` já com a Credencial informada, e com o Usuário dela
 * cadastrado na base do stand-in — como se o Cadastro tivesse acontecido antes
 * da prova. É o ponto de partida das provas que exercitam uma tela do acervo
 * sem passar pelo Cadastro, que ali não é o objeto da prova.
 */
export function clienteDeProva(
  credencial: Credencial | null = CREDENCIAL_DE_PROVA,
): ClienteEmMemoria {
  return new ClienteEmMemoria(
    credencial,
    credencial === null ? [] : [credencial],
  );
}

/**
 * A fábrica de cliente de uma prova de aplicação: todos os clientes que ela
 * devolve — com Credencial e sem ela — compartilham a **mesma** base, como
 * aconteceria contra a API real. Sem isso, entrar em `Aplicacao` traria um
 * acervo novo, vazio, em vez do acervo que a prova preparou.
 */
export function fabricaDeClienteDeProva(): (
  credencial: Credencial | null,
) => ClienteEmMemoria {
  const servidor = clienteDeProva();

  return (credencial) => servidor.comoUsuario(credencial);
}
