import { randomUUID } from "node:crypto";

import type {
  ArmazenamentoDoAcervo,
  Baralho,
  Cartao,
} from "../armazenamento/porta.ts";
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
 * As formas que atravessam a Porta são declaradas por ela, e o `Acervo` as
 * re-exporta na sua Interface: nenhum caller muda ao trocar de Adapter.
 *
 * `Cartao` é `{ id, frente, verso }` — a Frente **não** é identificador: dois
 * Cartões podem ter a mesma Frente (FR-009). `Baralho` é `{ id, nome }` — o
 * nome é rótulo, não identificador (FR-012).
 */
export type { Baralho, Cartao };

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
 * código estável e a mensagem em português (FR-046). `indisponivel` é a recusa
 * que vem do armazenamento: a operação não foi concluída e o conteúdo
 * informado continua disponível para nova tentativa (FR-044, FR-045).
 */
export type ResultadoDeCriacaoDeCartao =
  | { ok: true; cartao: Cartao }
  | {
      ok: false;
      erro: CodigoDeErroDeCartao | "indisponivel";
      mensagem: string;
    };

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
 * Resultado de `criarBaralho`. Mesma forma de `criarCartao`: recusa de regra
 * com código estável e mensagem em português, ou `indisponivel` quando o
 * armazenamento falhou (FR-046, FR-107).
 */
export type ResultadoDeCriacaoDeBaralho =
  | { ok: true; baralho: Baralho }
  | {
      ok: false;
      erro: CodigoDeErroDeBaralho | "indisponivel";
      mensagem: string;
    };

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
  | {
      ok: false;
      erro: CodigoDeErroDeVinculo | "indisponivel";
      mensagem: string;
    };

/**
 * Resultado de `desvincular`. Mesma forma de `vincular`: sucesso sem carga, ou
 * recusa com código estável e mensagem em português.
 */
export type ResultadoDeDesvinculacao =
  | { ok: true }
  | {
      ok: false;
      erro: CodigoDeErroDeVinculo | "indisponivel";
      mensagem: string;
    };

/**
 * Resultado de `obterBaralho`. Sucesso devolve o Baralho com seus Cartões;
 * Baralho inexistente é recusado como `nao_encontrado`.
 */
export type ResultadoDeObterBaralho =
  | { ok: true; baralho: BaralhoComCartoes }
  | {
      ok: false;
      erro: CodigoDeErroDeVinculo | "indisponivel";
      mensagem: string;
    };

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
      erro: CodigoDeErroDeCartao | "nao_encontrado" | "indisponivel";
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
      erro: CodigoDeErroDeBaralho | "nao_encontrado" | "indisponivel";
      mensagem: string;
    };

/**
 * Resultado de `excluirCartao`. Sucesso não carrega entidade: o Cartão deixa
 * de existir. Cartão inexistente é recusado como `nao_encontrado`, para que a
 * interface não confirme uma exclusão que não ocorreu; falha do armazenamento é
 * recusada como `indisponivel` (FR-044, FR-107).
 */
export type ResultadoDeExclusaoDeCartao =
  | { ok: true }
  | {
      ok: false;
      erro: "nao_encontrado" | "indisponivel";
      mensagem: string;
    };

/**
 * Resultado de `excluirBaralho`. Mesma forma de `excluirCartao`: sucesso sem
 * carga, ou recusa `nao_encontrado` quando o Baralho não existe.
 */
export type ResultadoDeExclusaoDeBaralho =
  | { ok: true }
  | {
      ok: false;
      erro: "nao_encontrado" | "indisponivel";
      mensagem: string;
    };

/**
 * Interface profunda do Module `Acervo` (Princípio IV).
 *
 * As operações escondem as regras de conteúdo de Cartão, de Baralho e de
 * Vínculo, e todo o acesso a dados persistidos: o `Acervo` recebe a Porta
 * `ArmazenamentoDoAcervo` na sua construção e nunca conhece, nomeia ou importa
 * armazenamento concreto (FR-100). Invariantes garantidas pela Interface, que o
 * caller nunca reproduz: Frente e Verso não vazios após descartar espaços nas
 * extremidades (FR-002, FR-051); no máximo 1000 caracteres cada (FR-052);
 * nenhuma propriedade além de Frente e Verso (FR-009). Para Baralho: nome não
 * vazio após descartar espaços nas extremidades (FR-011); no máximo 100
 * caracteres (FR-061); nome é rótulo, não identificador (FR-012); nenhuma
 * propriedade além do nome (FR-018). Para Vínculo: o par (Cartão, Baralho) é
 * único (FR-020); ambos os lados precisam existir; desvincular preserva Cartão
 * e Baralho (FR-021); não há limite superior de Vínculos (FR-022); a
 * elegibilidade é derivada por contagem, nunca armazenada (FR-024).
 *
 * **Todas as operações devolvem `Promise`**, porque a Porta é assíncrona e
 * manter um caminho síncrono dentro do Module faria duas Interfaces para o
 * mesmo Module. Nenhuma operação recebe escolha de armazenamento, e nenhuma
 * delas deixa uma falha do armazenamento passar por concluída: a Porta reporta
 * `indisponivel` e o Module a traduz para a sua recusa em português
 * (FR-044, FR-045, FR-107).
 */
export interface Acervo {
  criarCartao(dados: DadosDeCartao): Promise<ResultadoDeCriacaoDeCartao>;

  /**
   * Cria um Baralho com o nome informado. Nome vazio ou composto só de
   * espaços é recusado como `nome_vazio` (FR-011); mais de 100 caracteres,
   * como `nome_muito_longo` (FR-061). O nome é rótulo, não identificador:
   * dois Baralhos de mesmo nome são ambos aceitos (FR-012).
   */
  criarBaralho(dados: DadosDeBaralho): Promise<ResultadoDeCriacaoDeBaralho>;

  /**
   * Lista todos os Cartões existentes, cada um com sua Frente, seu Verso e
   * os Baralhos a que está vinculado (FR-003, FR-004). Cartão sem Baralho
   * devolve `baralhos: []`. A Frente não é identificador: dois Cartões de
   * Frente idêntica são ambos devolvidos, sem deduplicação.
   */
  listarCartoes(): Promise<CartaoListado[]>;

  /**
   * Lista todos os Baralhos existentes, cada um com id, nome, contagem de
   * Cartões e elegibilidade derivadas na leitura, a partir dos Vínculos. O
   * nome é rótulo, não identificador: dois Baralhos de nome idêntico são
   * ambos devolvidos, sem deduplicação.
   */
  listarBaralhos(): Promise<BaralhoListado[]>;

  /**
   * Devolve um Baralho com a elegibilidade derivada e os Cartões vinculados
   * (FR-014). Baralho inexistente é recusado como `nao_encontrado`.
   */
  obterBaralho(id: string): Promise<ResultadoDeObterBaralho>;

  /**
   * Vincula um Cartão existente a um Baralho existente (FR-019). O par
   * repetido é recusado como `vinculo_duplicado` pela unicidade do esquema do
   * Adapter — o desfecho chega à Porta como `vinculo_duplicado` e é traduzido
   * aqui, nunca vazando para o caller. Cartão ou Baralho inexistente é
   * recusado como `nao_encontrado`.
   */
  vincular(
    cartaoId: string,
    baralhoId: string,
  ): Promise<ResultadoDeVinculacao>;

  /**
   * Desfaz o Vínculo, preservando Cartão e Baralho (FR-021). Vínculo
   * inexistente é recusado como `vinculo_nao_encontrado`.
   */
  desvincular(
    cartaoId: string,
    baralhoId: string,
  ): Promise<ResultadoDeDesvinculacao>;

  /**
   * Edita a Frente e o Verso de um Cartão existente, reaplicando exatamente
   * as regras da criação (FR-002, FR-051, FR-052) e preservando todos os
   * Vínculos do Cartão (FR-005). Cartão inexistente é recusado como
   * `nao_encontrado`.
   */
  editarCartao(
    id: string,
    dados: DadosDeCartao,
  ): Promise<ResultadoDeEdicaoDeCartao>;

  /**
   * Renomeia um Baralho existente, reaplicando exatamente as regras de nome
   * da criação (FR-011, FR-061) e preservando todos os Vínculos e a
   * elegibilidade derivada do Baralho (FR-015). Baralho inexistente é
   * recusado como `nao_encontrado`.
   */
  renomearBaralho(
    id: string,
    dados: DadosDeBaralho,
  ): Promise<ResultadoDeEdicaoDeBaralho>;

  /**
   * Exclui um Cartão existente (FR-007). Os Vínculos do Cartão são removidos
   * pela cascata do esquema e todos os Baralhos são preservados (FR-008);
   * Baralhos que dependiam do Cartão deixam de ser elegíveis na leitura
   * seguinte. Cartão inexistente é recusado como `nao_encontrado`.
   */
  excluirCartao(id: string): Promise<ResultadoDeExclusaoDeCartao>;

  /**
   * Exclui um Baralho existente (FR-016). Os Vínculos do Baralho são
   * removidos pela cascata do esquema e todos os Cartões são preservados
   * (FR-017), inclusive os que ficarem sem Baralho. Baralho inexistente é
   * recusado como `nao_encontrado`.
   */
  excluirBaralho(id: string): Promise<ResultadoDeExclusaoDeBaralho>;
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
 * Recusa por indisponibilidade do armazenamento.
 *
 * A Porta reporta a falha como `indisponivel`, sem texto algum; a frase que o
 * usuário lê é do Module, que é o dono da regra de domínio. A operação **não**
 * passou por concluída, e o conteúdo informado continua disponível para nova
 * tentativa (FR-044, FR-045, FR-107).
 */
const ARMAZENAMENTO_INDISPONIVEL = {
  erro: "indisponivel",
  mensagem: "O armazenamento não está disponível. Tente novamente.",
} as const;

/**
 * Cria o `Acervo` sobre a Porta de armazenamento informada — o Adapter do
 * armazenamento local na execução local, o de PostgreSQL na nuvem.
 *
 * O esquema e as migrações são responsabilidade do Adapter, e nenhum SQL
 * atravessa este Module (FR-100); aqui vive apenas o comportamento do Module,
 * com as mesmas regras, os mesmos códigos estáveis e as mesmas mensagens em
 * português de sempre, agora assíncronos.
 */
export function criarAcervo(armazenamento: ArmazenamentoDoAcervo): Acervo {
  return {
    async criarCartao(dados) {
      const falha = validarFrente(dados.frente) ?? validarVerso(dados.verso);

      if (falha !== null) {
        return { ok: false, ...falha };
      }

      const cartao: Cartao = {
        id: randomUUID(),
        frente: dados.frente,
        verso: dados.verso,
      };

      const gravado = await armazenamento.inserirCartao(cartao);

      if (!gravado.ok) {
        return { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      return { ok: true, cartao: gravado.valor };
    },

    async criarBaralho(dados) {
      const falha = validarNomeDeBaralho(dados.nome);

      if (falha !== null) {
        return { ok: false, ...falha };
      }

      const baralho: Baralho = {
        id: randomUUID(),
        nome: dados.nome,
      };

      const gravado = await armazenamento.inserirBaralho(baralho);

      if (!gravado.ok) {
        return { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      return { ok: true, baralho: gravado.valor };
    },

    async listarCartoes() {
      const cartoes: CartaoListado[] = (
        await armazenamento.listarCartoes()
      ).map((cartao) => ({ ...cartao, baralhos: [] }));

      for (const cartao of cartoes) {
        cartao.baralhos = await armazenamento.listarBaralhosDoCartao(cartao.id);
      }

      return cartoes;
    },

    async listarBaralhos() {
      const baralhos = await armazenamento.listarBaralhos();
      const contagens = await armazenamento.contarCartoesPorBaralho();

      const quantidadePorBaralho = new Map(
        contagens.map((contagem) => [
          contagem.baralhoId,
          contagem.quantidadeDeCartoes,
        ]),
      );

      return baralhos.map((baralho) => {
        // Derivada na leitura, nunca armazenada (FR-024): a contagem vem da
        // Porta, que a lê dos Vínculos, e a elegibilidade é contagem maior que
        // zero — regra que permanece no Module.
        const quantidadeDeCartoes = quantidadePorBaralho.get(baralho.id) ?? 0;

        return {
          ...baralho,
          quantidadeDeCartoes,
          elegivel: quantidadeDeCartoes > 0,
        };
      });
    },

    async obterBaralho(id) {
      const encontrado = await armazenamento.obterBaralho(id);

      if (!encontrado.ok) {
        if (encontrado.erro === "nao_encontrado") {
          return { ok: false, ...BARALHO_NAO_ENCONTRADO };
        }

        return { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      const cartoes = await armazenamento.listarCartoesDoBaralho(id);

      return {
        ok: true,
        baralho: {
          ...encontrado.valor,
          elegivel: cartoes.length > 0,
          cartoes,
        },
      };
    },

    async vincular(cartaoId, baralhoId) {
      /**
       * A existência dos dois lados é conferida aqui, e não deixada para o
       * esquema: só o Module sabe dizer ao usuário **qual** extremidade não
       * existe, e a Porta reporta a ausência sem distinguir as duas.
       */
      const cartao = await armazenamento.obterCartao(cartaoId);

      if (!cartao.ok) {
        return cartao.erro === "nao_encontrado"
          ? { ok: false, ...CARTAO_NAO_ENCONTRADO }
          : { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      const baralho = await armazenamento.obterBaralho(baralhoId);

      if (!baralho.ok) {
        return baralho.erro === "nao_encontrado"
          ? { ok: false, ...BARALHO_NAO_ENCONTRADO }
          : { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      const vinculado = await armazenamento.vincular(cartaoId, baralhoId);

      if (!vinculado.ok) {
        return vinculado.erro === "vinculo_duplicado"
          ? { ok: false, ...VINCULO_DUPLICADO }
          : { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      return { ok: true };
    },

    async desvincular(cartaoId, baralhoId) {
      const removido = await armazenamento.desvincular(cartaoId, baralhoId);

      if (!removido.ok) {
        return removido.erro === "nao_encontrado"
          ? { ok: false, ...VINCULO_NAO_ENCONTRADO }
          : { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      return { ok: true };
    },

    async editarCartao(id, dados) {
      const falha = validarFrente(dados.frente) ?? validarVerso(dados.verso);

      if (falha !== null) {
        return { ok: false, ...falha };
      }

      const gravado = await armazenamento.atualizarCartao({
        id,
        frente: dados.frente,
        verso: dados.verso,
      });

      if (!gravado.ok) {
        return gravado.erro === "nao_encontrado"
          ? { ok: false, ...CARTAO_NAO_ENCONTRADO }
          : { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      return { ok: true, cartao: gravado.valor };
    },

    async renomearBaralho(id, dados) {
      const falha = validarNomeDeBaralho(dados.nome);

      if (falha !== null) {
        return { ok: false, ...falha };
      }

      const gravado = await armazenamento.atualizarBaralho({
        id,
        nome: dados.nome,
      });

      if (!gravado.ok) {
        return gravado.erro === "nao_encontrado"
          ? { ok: false, ...BARALHO_NAO_ENCONTRADO }
          : { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      return { ok: true, baralho: gravado.valor };
    },

    async excluirCartao(id) {
      const excluido = await armazenamento.excluirCartao(id);

      if (!excluido.ok) {
        return excluido.erro === "nao_encontrado"
          ? { ok: false, ...CARTAO_NAO_ENCONTRADO }
          : { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      return { ok: true };
    },

    async excluirBaralho(id) {
      const excluido = await armazenamento.excluirBaralho(id);

      if (!excluido.ok) {
        return excluido.erro === "nao_encontrado"
          ? { ok: false, ...BARALHO_NAO_ENCONTRADO }
          : { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      return { ok: true };
    },
  };
}
