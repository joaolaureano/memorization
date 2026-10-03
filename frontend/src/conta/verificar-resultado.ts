import { NAO_AUTENTICADO } from "../acervo-cliente/cliente";
import type { ClienteDoAcervo, Credencial } from "../acervo-cliente/cliente";
import {
  decidirResultadoIncerto,
  proximaVerificacao,
} from "./resultado-incerto";
import type {
  AcaoDeConta,
  DecisaoDoResultadoIncerto,
  Verificacao,
  Verificacoes,
} from "./resultado-incerto";

/**
 * Faz a verificação de um resultado incerto (FR-281): apresenta ao Entrar a
 * Credencial nova e a antiga, na ordem que `resultado-incerto.ts` pede, e
 * devolve a decisão. É a parte com rede; a decisão em si é do Module puro.
 *
 * `entrar` é só leitura — não grava, não emite nada —, de modo que verificar
 * não aplica mudança alguma nem cria estado (FR-283).
 */
export async function verificarResultadoIncerto(
  cliente: ClienteDoAcervo,
  acao: AcaoDeConta,
  credenciais: { antiga: Credencial; nova?: Credencial },
): Promise<DecisaoDoResultadoIncerto> {
  const verificacoes: Verificacoes = {};

  for (;;) {
    const decisao = decidirResultadoIncerto(acao, verificacoes);

    if (decisao !== null) {
      return decisao;
    }

    const alvo = proximaVerificacao(acao, verificacoes);

    if (alvo === null) {
      return "desconhecido";
    }

    const credencial = alvo === "nova" ? credenciais.nova : credenciais.antiga;

    if (credencial === undefined) {
      // Sem Credencial nova para apresentar, a verificação dela é impossível.
      verificacoes[alvo] = "falhou";
      continue;
    }

    verificacoes[alvo] = await apresentar(cliente, credencial);
  }
}

async function apresentar(
  cliente: ClienteDoAcervo,
  credencial: Credencial,
): Promise<Verificacao> {
  const resultado = await cliente.entrar(credencial);

  if (resultado.ok) {
    return "aceita";
  }

  return resultado.erro === NAO_AUTENTICADO ? "recusada" : "falhou";
}
