import { randomUUID } from "node:crypto";

import type {
  ArmazenamentoDoAcervo,
  Baralho,
  Cartao,
  ItemRegistrado,
  RegistroDeSessao,
  RegistroResumido,
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
export type {
  Baralho,
  Cartao,
  ItemRegistrado,
  RegistroDeSessao,
  RegistroResumido,
};

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
 * Corpo de `POST /sessoes` ainda **cru**: tudo é `unknown`, porque vem da rede
 * e nada garante a forma antes de o `Acervo` validar (FR-161, FR-164).
 *
 * A validação vive aqui, e não na rota: a mesma Interface de domínio serve a
 * qualquer entrada, e o transporte HTTP continua sendo só transporte (FR-046).
 */
export interface DadosDeRegistro {
  id: unknown;
  baralhoId: unknown;
  nomeDoBaralho: unknown;
  itens: unknown;
}

/**
 * Resultado de `registrarSessao`. Como o registro é reenviável, a recusa
 * distingue três situações que o caller trata de modo diferente (FR-163,
 * FR-164, FR-166):
 *
 * - `dados_invalidos`: o corpo não descreve um Registro de sessão válido —
 *   identificador fora da forma UUID, Baralho sem identificação, nome do
 *   Baralho fora dos limites vigentes, lista de Itens vazia ou grande demais,
 *   Item com Frente, Verso ou Resultado fora das regras do Cartão. Nada foi
 *   gravado;
 * - `conflito`: o `id` já pertence a um registro de **outro** Usuário. Nada foi
 *   gravado, e o registro alheio continua invisível para quem tentou (FR-166);
 * - `indisponivel`: o armazenamento falhou. O Resumo continua visível e a
 *   pessoa pode registrar de novo com o mesmo conteúdo (FR-164).
 */
export type ResultadoDeRegistroDeSessao =
  | { ok: true; registro: RegistroDeSessao }
  | { ok: false; erro: "dados_invalidos" | "conflito" | "indisponivel" };

/**
 * Os números de Início (FR-169): o tamanho do acervo **atual** — Cartões e
 * Baralhos — e o Histórico que interessa à primeira tela — os registros da
 * janela pedida e as 5 Sessões concluídas mais recentes.
 *
 * Nada aqui é guardado como verdade própria (FR-170): tudo é derivado na
 * leitura, dos Cartões e Baralhos existentes e dos registros do Histórico.
 */
export interface Estatisticas {
  cartoes: number;
  baralhos: number;
  registrosDaJanela: RegistroResumido[];
  recentes: RegistroResumido[];
}

/**
 * Resultado de `obterEstatisticas`: `dados_invalidos` quando `desde` não é um
 * instante ISO-8601 utilizável como limite da janela, ou `indisponivel` quando
 * o armazenamento falhou — caso em que a falha das Estatísticas não impede
 * navegar para Baralhos e Cartões (FR-173).
 */
export type ResultadoDeEstatisticas =
  | { ok: true; estatisticas: Estatisticas }
  | { ok: false; erro: "dados_invalidos" | "indisponivel" };

/**
 * Resultado de `obterRegistroDeSessao`. `baralhoExiste` diz se o Baralho do
 * registro ainda está no acervo: o Resumo de um registro antigo mostra os
 * textos guardados de qualquer modo, e só indica "Baralho excluído" quando ele
 * não existe mais (FR-178). Registro inexistente — inclusive o de outro
 * Usuário — é `nao_encontrado` (FR-166, FR-179).
 */
export type ResultadoDeObterRegistro =
  | { ok: true; registro: RegistroDeSessao; baralhoExiste: boolean }
  | { ok: false; erro: "nao_encontrado" | "indisponivel" };

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

  /**
   * Registra a Sessão **concluída** no Histórico do usuário do `Acervo`
   * (FR-161). A Sessão interrompida continua sem rastro: só quem conclui chega
   * aqui, e recusa nenhuma grava pela metade (FR-162, FR-164).
   *
   * O corpo vem cru e é validado nesta Interface: identificador na forma
   * canônica de UUID — é ele que dá a idempotência —, Baralho identificado,
   * nome do Baralho dentro dos limites vigentes, de 1 a 1000 Itens, cada um com
   * Frente e Verso válidos como Cartão e Resultado `acertou` ou `errou`.
   * `estudados`, `acertos`, `erros` e `posicao` são **derivados** dos Itens, de
   * modo que o caller não consegue produzir totais que não batam com a lista
   * (FR-161). O Baralho não precisa existir: o nome é guardado como era
   * (FR-165).
   *
   * O instante de conclusão é definido na primeira gravação: reenviar o mesmo
   * registro devolve o registro guardado, sem duplicá-lo e sem mudar a data
   * (FR-163).
   */
  registrarSessao(
    dados: DadosDeRegistro,
  ): Promise<ResultadoDeRegistroDeSessao>;

  /**
   * Devolve as Estatísticas de Início do usuário do `Acervo` (FR-169, FR-170):
   * o tamanho do acervo atual, o Histórico de `desde` em diante e as 5 Sessões
   * concluídas mais recentes (FR-177).
   *
   * `desde` é um instante ISO-8601: no futuro além de um dia (relógio de quem
   * chama adiantado) ou há mais de 31 dias no passado é recusado como
   * `dados_invalidos` — a janela do mês é o máximo que Início precisa.
   */
  obterEstatisticas(desde: string): Promise<ResultadoDeEstatisticas>;

  /**
   * Devolve o Registro de sessão completo de `id` no Histórico do usuário do
   * `Acervo`, com os Itens na ordem apresentada e a informação de o Baralho
   * ainda existir (FR-177, FR-178). Registro de outro Usuário se comporta como
   * inexistente (FR-166, FR-179).
   */
  obterRegistroDeSessao(id: string): Promise<ResultadoDeObterRegistro>;
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
 * Recusas das operações de Histórico. São resultados previstos da Interface —
 * o caller as distingue por `erro`, e nenhuma delas é exceção.
 *
 * Elas não carregam mensagem porque os resultados desta feature são só código
 * (contrato da `013`): quem traduz a falha em frase para a tela é o cliente,
 * que conhece o texto de cada rota.
 */
const DADOS_INVALIDOS = { erro: "dados_invalidos" } as const;

const REGISTRO_EM_CONFLITO = { erro: "conflito" } as const;

const REGISTRO_NAO_ENCONTRADO = { erro: "nao_encontrado" } as const;

const HISTORICO_INDISPONIVEL = { erro: "indisponivel" } as const;

/** Limite de Itens de um Registro de sessão (contrato da `013`, FR-161). */
const LIMITE_DE_ITENS_REGISTRADOS = 1000;

/** Quantas Sessões concluídas Início mostra (FR-169). */
const LIMITE_DE_SESSOES_RECENTES = 5;

/** Janela máxima aceita em `desde`, em dias (FR-169). */
const DIAS_MAXIMOS_NA_JANELA = 31;

/** Tolerância para relógio adiantado de quem chama o `desde`. */
const DIAS_DE_TOLERANCIA_NO_FUTURO = 1;

const UM_DIA_EM_MILISSEGUNDOS = 24 * 60 * 60 * 1000;

/**
 * Identificador único universal na forma canônica de `randomUUID`.
 *
 * O `id` do Registro é a chave da idempotência (FR-163), então recusar o que
 * não tem essa forma impede que um texto arbitrário do cliente colida com o
 * registro de outra pessoa (FR-166).
 */
const IDENTIFICADOR_UNICO_UNIVERSAL =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Instante ISO-8601 completo, com hora, minuto, segundo e fuso — a forma
 * combinada para o `desde` das Estatísticas.
 *
 * `Date.parse` sozinho aceitaria textos ambíguos ("2026-10-01" ou "ontem") que
 * não identificam um instante, e a janela precisa de um limite no tempo.
 */
const INSTANTE_ISO_8601 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** `true` para objeto não nulo — a forma que um Item decodificado pode ter. */
function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

/**
 * Interpreta um Item cru do corpo, com a `posicao` da ordem apresentada —
 * nunca informada pelo cliente (FR-161).
 *
 * Devolve `null` quando Frente, Verso ou Resultado não passam nas regras
 * vigentes: as de Cartão são as mesmas da criação e da edição (FR-002, FR-051,
 * FR-052), e o Resultado precisa ser `acertou` ou `errou`. Reaproveitar
 * `validarFrente` e `validarVerso` garante que um Item guardado nunca teria
 * sido recusado como Cartão.
 */
function interpretarItem(
  valor: unknown,
  posicao: number,
): ItemRegistrado | null {
  if (!ehObjeto(valor)) {
    return null;
  }

  const { frente, verso, resultado } = valor;

  if (typeof frente !== "string" || validarFrente(frente) !== null) {
    return null;
  }

  if (typeof verso !== "string" || validarVerso(verso) !== null) {
    return null;
  }

  if (resultado === "acertou" || resultado === "errou") {
    return { posicao, frente, verso, resultado };
  }

  return null;
}

/**
 * Interpreta o corpo cru como Registro de sessão, derivando `estudados`,
 * `acertos`, `erros` e a `posicao` de cada Item, e datando a conclusão com o
 * relógio do servidor (FR-161, FR-163).
 *
 * Devolve `null` — recusa `dados_invalidos` — quando qualquer invariante do
 * contrato falha. O Baralho **não** precisa existir: o registro guarda o nome
 * como era, e o Baralho pode ter sido excluído antes mesmo de a Sessão ser
 * registrada (FR-165, FR-178).
 */
function interpretarRegistro(dados: DadosDeRegistro): RegistroDeSessao | null {
  const { id, baralhoId, nomeDoBaralho, itens } = dados;

  if (typeof id !== "string" || !IDENTIFICADOR_UNICO_UNIVERSAL.test(id)) {
    return null;
  }

  if (typeof baralhoId !== "string" || baralhoId.trim().length === 0) {
    return null;
  }

  if (
    typeof nomeDoBaralho !== "string" ||
    validarNomeDeBaralho(nomeDoBaralho) !== null
  ) {
    return null;
  }

  if (
    !Array.isArray(itens) ||
    itens.length === 0 ||
    itens.length > LIMITE_DE_ITENS_REGISTRADOS
  ) {
    return null;
  }

  const registrados: ItemRegistrado[] = [];

  for (const [posicao, item] of itens.entries()) {
    const registrado = interpretarItem(item, posicao);

    if (registrado === null) {
      return null;
    }

    registrados.push(registrado);
  }

  const acertos = registrados.filter(
    (item) => item.resultado === "acertou",
  ).length;

  return {
    id,
    baralhoId,
    nomeDoBaralho,
    concluidaEm: new Date().toISOString(),
    estudados: registrados.length,
    acertos,
    erros: registrados.length - acertos,
    itens: registrados,
  };
}

/**
 * Devolve o `desde` já validado, ou `null` quando ele não serve como limite da
 * janela.
 *
 * Não basta ser um texto: precisa ser um instante ISO-8601 completo, não mais
 * de um dia no futuro — a tolerância para relógio adiantado de quem chama — e
 * não mais de 31 dias no passado, que é a maior janela que Início pede
 * (FR-169).
 */
function interpretarJanela(desde: unknown, agora: Date): string | null {
  if (typeof desde !== "string" || !INSTANTE_ISO_8601.test(desde)) {
    return null;
  }

  const instante = Date.parse(desde);

  if (Number.isNaN(instante)) {
    return null;
  }

  const limiteSuperior =
    agora.getTime() + DIAS_DE_TOLERANCIA_NO_FUTURO * UM_DIA_EM_MILISSEGUNDOS;

  if (instante > limiteSuperior) {
    return null;
  }

  const limiteInferior =
    agora.getTime() - DIAS_MAXIMOS_NA_JANELA * UM_DIA_EM_MILISSEGUNDOS;

  return instante >= limiteInferior ? desde : null;
}

/**
 * Cria o `Acervo` do Usuário `usuarioId` sobre a Porta de armazenamento
 * informada — o Adapter do armazenamento local na execução local, o de
 * PostgreSQL na nuvem.
 *
 * O **dono entra pela construção**, e não por cada operação: a Interface
 * pública do Module não muda, e o escopo por proprietário deixa de ser uma
 * disciplina repetida em cada chamada para ser uma propriedade do valor criado.
 * Quem cria o `Acervo` é a rota, **por requisição**, com o `usuarioId` que o
 * hook da Credencial decorou na requisição (FR-090, FR-092); a Credencial em si
 * nunca entra neste Module.
 *
 * O esquema e as migrações são responsabilidade do Adapter, e nenhum SQL
 * atravessa este Module (FR-100); aqui vive apenas o comportamento do Module,
 * com as mesmas regras, os mesmos códigos estáveis e as mesmas mensagens em
 * português de sempre, agora assíncronos e restritos a um dono.
 */
export function criarAcervo(
  armazenamento: ArmazenamentoDoAcervo,
  usuarioId: string,
): Acervo {
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

      const gravado = await armazenamento.inserirCartao(usuarioId, cartao);

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

      const gravado = await armazenamento.inserirBaralho(usuarioId, baralho);

      if (!gravado.ok) {
        return { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      return { ok: true, baralho: gravado.valor };
    },

    async listarCartoes() {
      const cartoes: CartaoListado[] = (
        await armazenamento.listarCartoes(usuarioId)
      ).map((cartao) => ({ ...cartao, baralhos: [] }));

      for (const cartao of cartoes) {
        cartao.baralhos = await armazenamento.listarBaralhosDoCartao(
          usuarioId,
          cartao.id,
        );
      }

      return cartoes;
    },

    async listarBaralhos() {
      const baralhos = await armazenamento.listarBaralhos(usuarioId);
      const contagens = await armazenamento.contarCartoesPorBaralho(usuarioId);

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
      const encontrado = await armazenamento.obterBaralho(usuarioId, id);

      if (!encontrado.ok) {
        if (encontrado.erro === "nao_encontrado") {
          return { ok: false, ...BARALHO_NAO_ENCONTRADO };
        }

        return { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      const cartoes = await armazenamento.listarCartoesDoBaralho(usuarioId, id);

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
      const cartao = await armazenamento.obterCartao(usuarioId, cartaoId);

      if (!cartao.ok) {
        return cartao.erro === "nao_encontrado"
          ? { ok: false, ...CARTAO_NAO_ENCONTRADO }
          : { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      const baralho = await armazenamento.obterBaralho(usuarioId, baralhoId);

      if (!baralho.ok) {
        return baralho.erro === "nao_encontrado"
          ? { ok: false, ...BARALHO_NAO_ENCONTRADO }
          : { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      const vinculado = await armazenamento.vincular(
        usuarioId,
        cartaoId,
        baralhoId,
      );

      if (!vinculado.ok) {
        return vinculado.erro === "vinculo_duplicado"
          ? { ok: false, ...VINCULO_DUPLICADO }
          : { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      return { ok: true };
    },

    async desvincular(cartaoId, baralhoId) {
      const removido = await armazenamento.desvincular(
        usuarioId,
        cartaoId,
        baralhoId,
      );

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

      const gravado = await armazenamento.atualizarCartao(usuarioId, {
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

      const gravado = await armazenamento.atualizarBaralho(usuarioId, {
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
      const excluido = await armazenamento.excluirCartao(usuarioId, id);

      if (!excluido.ok) {
        return excluido.erro === "nao_encontrado"
          ? { ok: false, ...CARTAO_NAO_ENCONTRADO }
          : { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      return { ok: true };
    },

    async excluirBaralho(id) {
      const excluido = await armazenamento.excluirBaralho(usuarioId, id);

      if (!excluido.ok) {
        return excluido.erro === "nao_encontrado"
          ? { ok: false, ...BARALHO_NAO_ENCONTRADO }
          : { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      return { ok: true };
    },

    async registrarSessao(dados) {
      const registro = interpretarRegistro(dados);

      if (registro === null) {
        return { ok: false, ...DADOS_INVALIDOS };
      }

      /**
       * O instante de conclusão vai junto, mas quem manda é a primeira
       * inserção: se o `id` já existe para este Usuário, a Porta devolve o
       * registro guardado — com a data original — e o reenvio não duplica nem
       * reescreve nada (FR-163). O mesmo `id` de outro Usuário é `conflito`
       * (FR-166).
       */
      const gravado = await armazenamento.inserirRegistroDeSessao(
        usuarioId,
        registro,
      );

      if (!gravado.ok) {
        return gravado.erro === "conflito"
          ? { ok: false, ...REGISTRO_EM_CONFLITO }
          : { ok: false, ...HISTORICO_INDISPONIVEL };
      }

      return { ok: true, registro: gravado.valor };
    },

    async obterEstatisticas(desde) {
      const janela = interpretarJanela(desde, new Date());

      if (janela === null) {
        return { ok: false, ...DADOS_INVALIDOS };
      }

      /**
       * O tamanho do acervo é lido pelas listagens já existentes — Cartões e
       * Baralhos **atuais** —, e o Histórico vem recortado em duas leituras:
       * a janela pedida e as Sessões recentes (FR-169). Nada disso é guardado
       * como verdade própria (FR-170), e a listagem sem Itens é o que mantém
       * Início respondendo com Histórico grande (SC-077).
       */
      const [cartoes, baralhos, registrosDaJanela, recentes] = await Promise.all(
        [
          armazenamento.listarCartoes(usuarioId),
          armazenamento.listarBaralhos(usuarioId),
          armazenamento.listarRegistrosDesde(usuarioId, janela),
          armazenamento.listarRegistrosRecentes(
            usuarioId,
            LIMITE_DE_SESSOES_RECENTES,
          ),
        ],
      );

      return {
        ok: true,
        estatisticas: {
          cartoes: cartoes.length,
          baralhos: baralhos.length,
          registrosDaJanela,
          recentes,
        },
      };
    },

    async obterRegistroDeSessao(id) {
      const encontrado = await armazenamento.obterRegistroDeSessao(
        usuarioId,
        id,
      );

      if (!encontrado.ok) {
        return encontrado.erro === "nao_encontrado"
          ? { ok: false, ...REGISTRO_NAO_ENCONTRADO }
          : { ok: false, ...HISTORICO_INDISPONIVEL };
      }

      /**
       * O registro é devolvido como está — a Porta não tem como ele mudar
       * (FR-165) —, e a existência do Baralho é conferida na hora da leitura:
       * o Resumo antigo só indica "Baralho excluído" quando ele sumiu de
       * verdade (FR-178).
       */
      const baralho = await armazenamento.obterBaralho(
        usuarioId,
        encontrado.valor.baralhoId,
      );

      return {
        ok: true,
        registro: encontrado.valor,
        baralhoExiste: baralho.ok,
      };
    },
  };
}
