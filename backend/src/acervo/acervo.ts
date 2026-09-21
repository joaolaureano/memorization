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
  CodigoDeErroDeVinculo,
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
 * Cartão como devolvido por `listarCartoes`: o Cartão mais os Baralhos a que
 * está vinculado. O Cartão sem nenhum Baralho devolve `baralhos: []` — estado
 * legítimo, e não ausência de campo. `criarCartao` continua devolvendo apenas
 * `Cartao`, sem carregar campos que a criação não exige.
 */
export interface CartaoListado extends Cartao {
  baralhos: Baralho[];
}

/**
 * Baralho como devolvido por `listarBaralhos`: o Baralho mais a contagem de
 * Cartões e a elegibilidade, ambas derivadas na leitura — nunca armazenadas
 * (FR-024). `criarBaralho` continua devolvendo apenas `Baralho`, sem carregar
 * campos que a criação não exige.
 */
export interface BaralhoListado extends Baralho {
  quantidadeDeCartoes: number;
  elegivel: boolean;
}

/**
 * Baralho como devolvido por `obterBaralho`: o Baralho com a elegibilidade
 * derivada e os Cartões vinculados, conforme o contrato de
 * `GET /baralhos/{id}` (FR-014).
 */
export interface BaralhoComCartoes extends Baralho {
  elegivel: boolean;
  cartoes: Cartao[];
}

/**
 * Resultado de `vincular`. Falha de domínio é resultado previsto, não exceção:
 * o caller distingue `ok` e, na recusa, recebe o código estável e a mensagem
 * em português (FR-046).
 */
export type ResultadoDeVinculacao =
  | { ok: true }
  | { ok: false; erro: CodigoDeErroDeVinculo; mensagem: string };

/**
 * Resultado de `desvincular`. Mesma forma de `vincular`: sucesso sem carga, ou
 * recusa com código estável e mensagem em português.
 */
export type ResultadoDeDesvinculacao =
  | { ok: true }
  | { ok: false; erro: CodigoDeErroDeVinculo; mensagem: string };

/**
 * Resultado de `obterBaralho`. Sucesso devolve o Baralho com seus Cartões;
 * Baralho inexistente é recusado como `nao_encontrado`.
 */
export type ResultadoDeObterBaralho =
  | { ok: true; baralho: BaralhoComCartoes }
  | { ok: false; erro: CodigoDeErroDeVinculo; mensagem: string };

/**
 * Resultado de `editarCartao`. Falha de domínio é resultado previsto, não
 * exceção: o caller distingue `ok` e, na recusa, recebe o código estável e a
 * mensagem em português (FR-046). As regras de conteúdo são exatamente as da
 * criação; Cartão inexistente é recusado como `nao_encontrado`.
 */
export type ResultadoDeEdicaoDeCartao =
  | { ok: true; cartao: Cartao }
  | {
      ok: false;
      erro: CodigoDeErroDeCartao | "nao_encontrado";
      mensagem: string;
    };

/**
 * Resultado de `renomearBaralho`. Mesma forma de `editarCartao`: sucesso
 * devolve o Baralho renomeado; recusa carrega código estável e mensagem em
 * português. As regras de nome são exatamente as da criação; Baralho
 * inexistente é recusado como `nao_encontrado`.
 */
export type ResultadoDeEdicaoDeBaralho =
  | { ok: true; baralho: Baralho }
  | {
      ok: false;
      erro: CodigoDeErroDeBaralho | "nao_encontrado";
      mensagem: string;
    };

/**
 * Resultado de `excluirCartao`. Sucesso não carrega entidade: o Cartão deixa
 * de existir. Cartão inexistente é recusado como `nao_encontrado`, para que a
 * interface não confirme uma exclusão que não ocorreu.
 */
export type ResultadoDeExclusaoDeCartao =
  | { ok: true }
  | { ok: false; erro: "nao_encontrado"; mensagem: string };

/**
 * Resultado de `excluirBaralho`. Mesma forma de `excluirCartao`: sucesso sem
 * carga, ou recusa `nao_encontrado` quando o Baralho não existe.
 */
export type ResultadoDeExclusaoDeBaralho =
  | { ok: true }
  | { ok: false; erro: "nao_encontrado"; mensagem: string };

/**
 * Interface profunda do Module `Acervo` (Princípio IV).
 *
 * As operações escondem esquema, transação e as regras de conteúdo de Cartão,
 * de Baralho e de Vínculo. Invariantes garantidas pela Interface, que o caller
 * nunca reproduz: Frente e Verso não vazios após descartar espaços nas
 * extremidades (FR-002, FR-051); no máximo 1000 caracteres cada (FR-052);
 * nenhuma propriedade além de Frente e Verso (FR-009). Para Baralho: nome não
 * vazio após descartar espaços nas extremidades (FR-011); no máximo 100
 * caracteres (FR-061); nome é rótulo, não identificador (FR-012); nenhuma
 * propriedade além do nome (FR-018). Para Vínculo: o par (Cartão, Baralho) é
 * único (FR-020); ambos os lados precisam existir; desvincular preserva Cartão
 * e Baralho (FR-021); não há limite superior de Vínculos (FR-022); a
 * elegibilidade é derivada por contagem, nunca armazenada (FR-024).
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
   * Lista todos os Cartões existentes, cada um com sua Frente, seu Verso e
   * os Baralhos a que está vinculado (FR-003, FR-004). Cartão sem Baralho
   * devolve `baralhos: []`. A Frente não é identificador: dois Cartões de
   * Frente idêntica são ambos devolvidos, sem deduplicação.
   */
  listarCartoes(): CartaoListado[];

  /**
   * Lista todos os Baralhos existentes, cada um com id, nome, contagem de
   * Cartões e elegibilidade derivadas na leitura, a partir dos Vínculos. O
   * nome é rótulo, não identificador: dois Baralhos de nome idêntico são
   * ambos devolvidos, sem deduplicação.
   */
  listarBaralhos(): BaralhoListado[];

  /**
   * Devolve um Baralho com a elegibilidade derivada e os Cartões vinculados
   * (FR-014). Baralho inexistente é recusado como `nao_encontrado`.
   */
  obterBaralho(id: string): ResultadoDeObterBaralho;

  /**
   * Vincula um Cartão existente a um Baralho existente (FR-019). O par
   * repetido é recusado como `vinculo_duplicado` pela chave primária composta
   * do esquema — o erro do driver é traduzido aqui, nunca vaza para o caller.
   * Cartão ou Baralho inexistente é recusado como `nao_encontrado`.
   */
  vincular(cartaoId: string, baralhoId: string): ResultadoDeVinculacao;

  /**
   * Desfaz o Vínculo, preservando Cartão e Baralho (FR-021). Vínculo
   * inexistente é recusado como `vinculo_nao_encontrado`.
   */
  desvincular(cartaoId: string, baralhoId: string): ResultadoDeDesvinculacao;

  /**
   * Edita a Frente e o Verso de um Cartão existente, reaplicando exatamente
   * as regras da criação (FR-002, FR-051, FR-052) e preservando todos os
   * Vínculos do Cartão (FR-005). Cartão inexistente é recusado como
   * `nao_encontrado`.
   */
  editarCartao(id: string, dados: DadosDeCartao): ResultadoDeEdicaoDeCartao;

  /**
   * Renomeia um Baralho existente, reaplicando exatamente as regras de nome
   * da criação (FR-011, FR-061) e preservando todos os Vínculos e a
   * elegibilidade derivada do Baralho (FR-015). Baralho inexistente é
   * recusado como `nao_encontrado`.
   */
  renomearBaralho(
    id: string,
    dados: DadosDeBaralho,
  ): ResultadoDeEdicaoDeBaralho;

  /**
   * Exclui um Cartão existente (FR-007). Os Vínculos do Cartão são removidos
   * pela cascata do esquema e todos os Baralhos são preservados (FR-008);
   * Baralhos que dependiam do Cartão deixam de ser elegíveis na leitura
   * seguinte. Cartão inexistente é recusado como `nao_encontrado`.
   */
  excluirCartao(id: string): ResultadoDeExclusaoDeCartao;

  /**
   * Exclui um Baralho existente (FR-016). Os Vínculos do Baralho são
   * removidos pela cascata do esquema e todos os Cartões são preservados
   * (FR-017), inclusive os que ficarem sem Baralho. Baralho inexistente é
   * recusado como `nao_encontrado`.
   */
  excluirBaralho(id: string): ResultadoDeExclusaoDeBaralho;
}

/**
 * Recusas de domínio de Vínculo. São resultados previstos da Interface, não
 * exceções: o caller recebe o código estável e a mensagem em português
 * (FR-046) sem capturar erro do driver.
 */
const CARTAO_NAO_ENCONTRADO = {
  erro: "nao_encontrado",
  mensagem: "Cartão não encontrado.",
} as const;

const BARALHO_NAO_ENCONTRADO = {
  erro: "nao_encontrado",
  mensagem: "Baralho não encontrado.",
} as const;

const VINCULO_DUPLICADO = {
  erro: "vinculo_duplicado",
  mensagem: "O vínculo já existe.",
} as const;

const VINCULO_NAO_ENCONTRADO = {
  erro: "vinculo_nao_encontrado",
  mensagem: "O vínculo não existe.",
} as const;

/**
 * Reconhece a violação de chave primária composta da tabela `vinculo`. O
 * SQLite entrega `errcode` 1555 (SQLITE_CONSTRAINT_PRIMARYKEY) quando o par
 * repetido é inserido; qualquer outro erro é relançado, para que falha de
 * programação ou de banco não vire recusa de domínio.
 */
function ehVinculoDuplicado(erro: unknown): boolean {
  if (typeof erro !== "object" || erro === null) {
    return false;
  }

  const candidato = erro as { code?: unknown; errcode?: unknown };

  return candidato.code === "ERR_SQLITE_ERROR" && candidato.errcode === 1555;
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
  const cartaoExiste = banco.prepare("SELECT id FROM cartao WHERE id = ?");

  /** Prepared com o `Acervo`, pois `cartao` existe em toda base legada. */
  const atualizarCartao = banco.prepare(
    "UPDATE cartao SET frente = ?, verso = ? WHERE id = ?",
  );
  const excluirCartaoStatement = banco.prepare(
    "DELETE FROM cartao WHERE id = ?",
  );

  /**
   * Prepared na primeira criação de Baralho, e não na construção do `Acervo`:
   * uma base legada da feature `001` ainda sem a tabela `baralho` continua
   * servindo `criarCartao`/`listarCartoes` até ser migrada. Em base migrada —
   * o único cenário em que `criarBaralho` é chamado — a preparação acontece
   * uma única vez e a escrita permanece atômica.
   */
  let inserirBaralho: StatementSync | undefined;

  /** Prepared na primeira listagem, pelo mesmo motivo de `inserirBaralho`. */
  let listarBaralhosStatement: StatementSync | undefined;

  /** Prepared na primeira consulta por id, pelo mesmo motivo. */
  let obterBaralhoPorId: StatementSync | undefined;

  /** Prepared na primeira consulta de existência de Baralho. */
  let baralhoExiste: StatementSync | undefined;

  /** Prepared na primeira edição ou exclusão de Baralho. */
  let atualizarBaralho: StatementSync | undefined;
  let excluirBaralhoStatement: StatementSync | undefined;

  /** Prepared na primeira operação de Vínculo. */
  let inserirVinculo: StatementSync | undefined;
  let removerVinculo: StatementSync | undefined;
  let listarBaralhosDoCartao: StatementSync | undefined;
  let listarCartoesDoBaralho: StatementSync | undefined;

  /**
   * Diz se a base já tem a tabela `vinculo`. Bases legadas da feature `001`
   * ou `002` continuam servindo `criarCartao`/`listarCartoes` antes de serem
   * migradas; nesse caso a listagem devolve `baralhos: []` sem preparar a
   * consulta de Vínculos, que falharia por tabela ausente.
   */
  let temTabelaDeVinculo: boolean | undefined;

  function baseTemVinculo(): boolean {
    temTabelaDeVinculo ??=
      banco
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'vinculo'",
        )
        .get() !== undefined;

    return temTabelaDeVinculo;
  }

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
      const cartoes: CartaoListado[] = listar.all().map((linha) => ({
        id: linha.id as string,
        frente: linha.frente as string,
        verso: linha.verso as string,
        baralhos: [],
      }));

      if (!baseTemVinculo()) {
        return cartoes;
      }

      listarBaralhosDoCartao ??= banco.prepare(
        `SELECT baralho.id, baralho.nome
           FROM vinculo
           JOIN baralho ON baralho.id = vinculo.baralho_id
          WHERE vinculo.cartao_id = ?`,
      );

      for (const cartao of cartoes) {
        cartao.baralhos = listarBaralhosDoCartao.all(cartao.id).map((linha) => ({
          id: linha.id as string,
          nome: linha.nome as string,
        }));
      }

      return cartoes;
    },

    listarBaralhos() {
      listarBaralhosStatement ??= banco.prepare(
        `SELECT baralho.id,
                baralho.nome,
                COUNT(vinculo.cartao_id) AS quantidadeDeCartoes
           FROM baralho
           LEFT JOIN vinculo ON vinculo.baralho_id = baralho.id
          GROUP BY baralho.id`,
      );

      return listarBaralhosStatement.all().map((linha) => {
        // Derivada na leitura, nunca armazenada (FR-024): a contagem vem da
        // tabela de Vínculos e a elegibilidade é contagem maior que zero.
        const quantidadeDeCartoes = Number(linha.quantidadeDeCartoes);

        return {
          id: linha.id as string,
          nome: linha.nome as string,
          quantidadeDeCartoes,
          elegivel: quantidadeDeCartoes > 0,
        };
      });
    },

    obterBaralho(id) {
      obterBaralhoPorId ??= banco.prepare(
        "SELECT id, nome FROM baralho WHERE id = ?",
      );

      const linha = obterBaralhoPorId.get(id);

      if (linha === undefined) {
        return { ok: false, ...BARALHO_NAO_ENCONTRADO };
      }

      listarCartoesDoBaralho ??= banco.prepare(
        `SELECT cartao.id, cartao.frente, cartao.verso
           FROM vinculo
           JOIN cartao ON cartao.id = vinculo.cartao_id
          WHERE vinculo.baralho_id = ?
          ORDER BY cartao.id`,
      );

      const cartoes: Cartao[] = listarCartoesDoBaralho.all(id).map((cartao) => ({
        id: cartao.id as string,
        frente: cartao.frente as string,
        verso: cartao.verso as string,
      }));

      return {
        ok: true,
        baralho: {
          id: linha.id as string,
          nome: linha.nome as string,
          elegivel: cartoes.length > 0,
          cartoes,
        },
      };
    },

    vincular(cartaoId, baralhoId) {
      if (cartaoExiste.get(cartaoId) === undefined) {
        return { ok: false, ...CARTAO_NAO_ENCONTRADO };
      }

      baralhoExiste ??= banco.prepare(
        "SELECT id FROM baralho WHERE id = ?",
      );

      if (baralhoExiste.get(baralhoId) === undefined) {
        return { ok: false, ...BARALHO_NAO_ENCONTRADO };
      }

      inserirVinculo ??= banco.prepare(
        "INSERT INTO vinculo (cartao_id, baralho_id) VALUES (?, ?)",
      );

      try {
        inserirVinculo.run(cartaoId, baralhoId);
      } catch (erro) {
        if (ehVinculoDuplicado(erro)) {
          return { ok: false, ...VINCULO_DUPLICADO };
        }

        throw erro;
      }

      return { ok: true };
    },

    desvincular(cartaoId, baralhoId) {
      removerVinculo ??= banco.prepare(
        "DELETE FROM vinculo WHERE cartao_id = ? AND baralho_id = ?",
      );

      const resultado = removerVinculo.run(cartaoId, baralhoId);

      if (Number(resultado.changes) === 0) {
        return { ok: false, ...VINCULO_NAO_ENCONTRADO };
      }

      return { ok: true };
    },

    editarCartao(id, dados) {
      const falha = validarFrente(dados.frente) ?? validarVerso(dados.verso);

      if (falha !== null) {
        return { ok: false, ...falha };
      }

      if (cartaoExiste.get(id) === undefined) {
        return { ok: false, ...CARTAO_NAO_ENCONTRADO };
      }

      atualizarCartao.run(dados.frente, dados.verso, id);

      return {
        ok: true,
        cartao: { id, frente: dados.frente, verso: dados.verso },
      };
    },

    renomearBaralho(id, dados) {
      const falha = validarNomeDeBaralho(dados.nome);

      if (falha !== null) {
        return { ok: false, ...falha };
      }

      baralhoExiste ??= banco.prepare(
        "SELECT id FROM baralho WHERE id = ?",
      );

      if (baralhoExiste.get(id) === undefined) {
        return { ok: false, ...BARALHO_NAO_ENCONTRADO };
      }

      atualizarBaralho ??= banco.prepare(
        "UPDATE baralho SET nome = ? WHERE id = ?",
      );

      atualizarBaralho.run(dados.nome, id);

      return { ok: true, baralho: { id, nome: dados.nome } };
    },

    excluirCartao(id) {
      if (cartaoExiste.get(id) === undefined) {
        return { ok: false, ...CARTAO_NAO_ENCONTRADO };
      }

      excluirCartaoStatement.run(id);

      return { ok: true };
    },

    excluirBaralho(id) {
      baralhoExiste ??= banco.prepare(
        "SELECT id FROM baralho WHERE id = ?",
      );

      if (baralhoExiste.get(id) === undefined) {
        return { ok: false, ...BARALHO_NAO_ENCONTRADO };
      }

      excluirBaralhoStatement ??= banco.prepare(
        "DELETE FROM baralho WHERE id = ?",
      );

      excluirBaralhoStatement.run(id);

      return { ok: true };
    },
  };
}
