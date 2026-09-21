import { randomUUID } from "node:crypto";
import type { DatabaseSync, StatementSync } from "node:sqlite";

import {
  validarFrente,
  validarNomeDeBaralho,
  validarVerso,
} from "./invariantes.ts";
import type {
  CodigoDeErroDeBaralho,
  CodigoDeErroDeCartao,
} from "./invariantes.ts";

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
 * A única entidade desta etapa: id opaco e nome, e nada além (FR-018).
 *
 * O `id` é um identificador opaco gerado pelo sistema. O nome **não** é
 * identificador: dois Baralhos podem ter o mesmo nome (FR-012).
 */
export interface Baralho {
  id: string;
  nome: string;
}

/**
 * O que `criarBaralho` recebe: exatamente o nome.
 *
 * O objeto pode carregar propriedades além dessa: elas são ignoradas, porque
 * a Interface lê apenas os campos canônicos e constrói o `Baralho` a partir
 * deles — é assim que a Interface garante FR-018 sem que o caller reproduza a
 * regra.
 */
export interface DadosDeBaralho {
  nome: string;
}

/**
 * Resultado de `criarBaralho`. Falha de regra de domínio é resultado previsto,
 * e não exceção genérica: o caller distingue `ok` e, na recusa, recebe o
 * código estável e a mensagem em português (FR-046).
 */
export type ResultadoDeCriacaoDeBaralho =
  | { ok: true; baralho: Baralho }
  | { ok: false; erro: CodigoDeErroDeBaralho; mensagem: string };

/**
 * Baralho como devolvido por `listarBaralhos`: o Baralho mais a contagem de
 * Cartões e a elegibilidade, ambas derivadas na leitura — nunca armazenadas.
 *
 * Nesta etapa não há tabela de vínculo Baralho–Cartão, então a contagem é
 * derivada como 0 e a elegibilidade, como contagem maior que 0: nenhum
 * Baralho é elegível. `criarBaralho` continua devolvendo apenas `Baralho`,
 * sem carregar campos que a criação não exige.
 */
export interface BaralhoListado extends Baralho {
  quantidadeDeCartoes: number;
  elegivel: boolean;
}

/**
 * Interface profunda do Module `Acervo` (Princípio IV).
 *
 * As operações escondem esquema, transação e as regras de conteúdo de Cartão
 * e de Baralho. Invariantes garantidas pela Interface, que o caller nunca
 * reproduz: Frente e Verso não vazios após descartar espaços nas extremidades
 * (FR-002, FR-051); no máximo 1000 caracteres cada (FR-052); nenhuma
 * propriedade além de Frente e Verso (FR-009). Para Baralho: nome não vazio
 * após descartar espaços nas extremidades (FR-011); no máximo 100 caracteres
 * (FR-061); nome é rótulo, não identificador (FR-012); nenhuma propriedade
 * além do nome (FR-018).
 *
 * As operações são síncronas e a escrita é atômica.
 */
export interface Acervo {
  criarCartao(dados: DadosDeCartao): ResultadoDeCriacaoDeCartao;

  /**
   * Cria um Baralho com o nome informado. Nome vazio ou composto só de
   * espaços é recusado como `nome_vazio` (FR-011); mais de 100 caracteres,
   * como `nome_muito_longo` (FR-061). O nome é rótulo, não identificador:
   * dois Baralhos de mesmo nome são ambos aceitos (FR-012).
   */
  criarBaralho(dados: DadosDeBaralho): ResultadoDeCriacaoDeBaralho;

  /**
   * Lista todos os Cartões existentes, cada um com sua Frente e seu Verso
   * (FR-003, FR-004). A Frente não é identificador: dois Cartões de Frente
   * idêntica são ambos devolvidos, sem deduplicação.
   */
  listarCartoes(): Cartao[];

  /**
   * Lista todos os Baralhos existentes, cada um com id, nome, contagem de
   * Cartões e elegibilidade derivadas na leitura. O nome é rótulo, não
   * identificador: dois Baralhos de nome idêntico são ambos devolvidos, sem
   * deduplicação.
   */
  listarBaralhos(): BaralhoListado[];
}

/**
 * Cria o `Acervo` sobre um banco já aberto — em memória nos testes, em
 * arquivo na aplicação. O esquema é responsabilidade de `esquema.ts`; aqui
 * vive apenas o comportamento do Module.
 */
export function criarAcervo(banco: DatabaseSync): Acervo {
  const inserirCartao = banco.prepare(
    "INSERT INTO cartao (id, frente, verso) VALUES (?, ?, ?)",
  );
  const listar = banco.prepare("SELECT id, frente, verso FROM cartao");

  /**
   * Prepared na primeira criação de Baralho, e não na construção do `Acervo`:
   * uma base legada da feature `001` ainda sem a tabela `baralho` continua
   * servindo `criarCartao`/`listarCartoes` até ser migrada. Em base migrada —
   * o único cenário em que `criarBaralho` é chamado — a preparação acontece
   * uma única vez e a escrita permanece atômica.
   */
  let inserirBaralho: StatementSync | undefined;

  /**
   * Preparado na primeira listagem, pelo mesmo motivo de `inserirBaralho`:
   * uma base legada ainda sem a tabela `baralho` continua servindo
   * `criarCartao`/`listarCartoes` até ser migrada.
   */
  let listarBaralhosStatement: StatementSync | undefined;

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

      inserirCartao.run(cartao.id, cartao.frente, cartao.verso);

      return { ok: true, cartao };
    },

    criarBaralho(dados) {
      const falha = validarNomeDeBaralho(dados.nome);

      if (falha !== null) {
        return { ok: false, ...falha };
      }

      inserirBaralho ??= banco.prepare(
        "INSERT INTO baralho (id, nome) VALUES (?, ?)",
      );

      const baralho: Baralho = {
        id: randomUUID(),
        nome: dados.nome,
      };

      inserirBaralho.run(baralho.id, baralho.nome);

      return { ok: true, baralho };
    },

    listarCartoes() {
      return listar.all().map((linha) => ({
        id: linha.id as string,
        frente: linha.frente as string,
        verso: linha.verso as string,
      }));
    },

    listarBaralhos() {
      listarBaralhosStatement ??= banco.prepare(
        "SELECT id, nome FROM baralho",
      );

      return listarBaralhosStatement.all().map((linha) => {
        // Derivada na leitura, nunca armazenada. Nesta etapa não há tabela
        // de vínculo Baralho–Cartão: a contagem é 0 e a elegibilidade,
        // contagem > 0, é falsa para todo Baralho.
        const quantidadeDeCartoes = 0;

        return {
          id: linha.id as string,
          nome: linha.nome as string,
          quantidadeDeCartoes,
          elegivel: quantidadeDeCartoes > 0,
        };
      });
    },
  };
}
