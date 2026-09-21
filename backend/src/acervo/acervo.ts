import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { validarFrente, validarVerso } from "./invariantes.ts";
import type { CodigoDeErroDeCartao } from "./invariantes.ts";

/**
 * A única entidade desta feature: Frente e Verso, e nada além (FR-009).
 *
 * O `id` é um identificador opaco gerado pelo sistema. A Frente **não** é
 * identificador: dois Cartões podem ter a mesma Frente.
 */
export interface Cartao {
  id: string;
  frente: string;
  verso: string;
}

/**
 * O que `criarCartao` recebe: exatamente Frente e Verso (FR-001).
 *
 * O objeto pode carregar propriedades além dessas duas: elas são ignoradas,
 * porque a Interface lê apenas os campos canônicos e constrói o `Cartao` a
 * partir deles — é assim que a Interface garante FR-009 sem que o caller
 * reproduza a regra.
 */
export interface DadosDeCartao {
  frente: string;
  verso: string;
}

/**
 * Resultado de `criarCartao`. Falha de regra de domínio é resultado previsto,
 * e não exceção genérica: o caller distingue `ok` e, na recusa, recebe o
 * código estável e a mensagem em português (FR-046).
 */
export type ResultadoDeCriacaoDeCartao =
  | { ok: true; cartao: Cartao }
  | { ok: false; erro: CodigoDeErroDeCartao; mensagem: string };

/**
 * Interface profunda do Module `Acervo` (Princípio IV).
 *
 * Duas operações escondem esquema, transação e as regras de conteúdo de
 * Cartão. Invariantes garantidas pela Interface, que o caller nunca
 * reproduz: Frente e Verso não vazios após descartar espaços nas extremidades
 * (FR-002, FR-051); no máximo 1000 caracteres cada (FR-052); nenhuma
 * propriedade além de Frente e Verso (FR-009).
 *
 * As operações são síncronas e a escrita é atômica.
 */
export interface Acervo {
  criarCartao(dados: DadosDeCartao): ResultadoDeCriacaoDeCartao;

  /**
   * Lista todos os Cartões existentes, cada um com sua Frente e seu Verso
   * (FR-003, FR-004). A Frente não é identificador: dois Cartões de Frente
   * idêntica são ambos devolvidos, sem deduplicação.
   */
  listarCartoes(): Cartao[];
}

/**
 * Cria o `Acervo` sobre um banco já aberto — em memória nos testes, em
 * arquivo na aplicação. O esquema é responsabilidade de `esquema.ts`; aqui
 * vive apenas o comportamento do Module.
 */
export function criarAcervo(banco: DatabaseSync): Acervo {
  const inserir = banco.prepare(
    "INSERT INTO cartao (id, frente, verso) VALUES (?, ?, ?)",
  );
  const listar = banco.prepare("SELECT id, frente, verso FROM cartao");

  return {
    criarCartao(dados) {
      const falha = validarFrente(dados.frente) ?? validarVerso(dados.verso);

      if (falha !== null) {
        return { ok: false, ...falha };
      }

      const cartao: Cartao = {
        id: randomUUID(),
        frente: dados.frente,
        verso: dados.verso,
      };

      inserir.run(cartao.id, cartao.frente, cartao.verso);

      return { ok: true, cartao };
    },

    listarCartoes() {
      return listar.all().map((linha) => ({
        id: linha.id as string,
        frente: linha.frente as string,
        verso: linha.verso as string,
      }));
    },
  };
}
