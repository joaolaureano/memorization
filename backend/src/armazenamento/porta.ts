/**
 * Porta `ArmazenamentoDoAcervo` — a única Interface por onde os Modules do
 * acervo leem e gravam dados persistidos (FR-100).
 *
 * Ela é declarada no domínio, ao lado de nenhum Adapter, e é a única coisa que
 * os Modules conhecem sobre armazenamento. O armazenamento concreto entra na
 * construção do backend, por um Adapter desta Porta: SQLite em arquivo local
 * na execução local, PostgreSQL na nuvem.
 *
 * Invariantes que esta Interface garante ao caller:
 *
 * - **Toda operação devolve `Promise`.** Não há caminho síncrono, porque os
 *   drivers do armazenamento de nuvem não o oferecem.
 * - **Nenhuma operação recebe escolha de armazenamento**, SQL, dialeto,
 *   transação, conexão, caminho de arquivo ou endereço.
 * - **As listagens devolvem linhas; a ordem é do Module**, não da Porta.
 * - **As contagens são derivadas na leitura** (FR-024): a Porta não guarda
 *   total nem marca de elegibilidade.
 * - **A Porta não tem texto em português**: os códigos dos desfechos são
 *   vocabulário de armazenamento, e a frase que o usuário lê nasce no Module,
 *   que é o dono da regra de domínio.
 * - **Nenhum erro do driver atravessa a Porta** (FR-107): o par repetido, a
 *   ausência de linha e a falha do armazenamento chegam como desfecho tipado,
 *   sem texto do driver, caminho de arquivo, cadeia de conexão ou credencial
 *   (FR-108).
 */

/**
 * Cartão como o armazenamento o guarda: identificador opaco, Frente e Verso
 * (FR-009). É a Porta quem declara esta forma, porque é ela quem troca esses
 * dados com o armazenamento; o Module `Acervo` a re-exporta na sua Interface.
 */
export interface Cartao {
  id: string;
  frente: string;
  verso: string;
}

/**
 * Baralho como o armazenamento o guarda: identificador opaco e nome (FR-018).
 * O nome é rótulo, não identificador (FR-012).
 */
export interface Baralho {
  id: string;
  nome: string;
}

/**
 * Quantidade de Cartões vinculados a um Baralho, lida dos Vínculos a cada
 * listagem. É a entrada da elegibilidade derivada, que continua sendo regra do
 * Module: a contagem vem da Porta, a elegibilidade não (FR-024).
 */
export interface ContagemPorBaralho {
  baralhoId: string;
  quantidadeDeCartoes: number;
}

/**
 * Códigos de falha tipada da Porta. São vocabulário de armazenamento, nunca
 * mensagem: `nao_encontrado` é a ausência de linha a ler, a alterar ou a
 * excluir; `vinculo_duplicado` é o par (Cartão, Baralho) repetido, reconhecido
 * pela unicidade do esquema; `indisponivel` é a falha do armazenamento —
 * arquivo, conexão, transação ou consulta —, e jamais significa concluído
 * (FR-044, FR-107).
 */
export type CodigoDeFalhaDeArmazenamento =
  | "nao_encontrado"
  | "vinculo_duplicado"
  | "indisponivel";

/**
 * Desfecho tipado de toda operação da Porta que precisa reportar recusa.
 *
 * Falha de armazenamento é resultado previsto, e não exceção: quem recebe
 * `indisponivel` não apresenta a operação como feita e pode tentar de novo com
 * o mesmo conteúdo informado (FR-044, FR-045, FR-107).
 */
export type Desfecho<T> =
  | { ok: true; valor: T }
  | { ok: false; erro: CodigoDeFalhaDeArmazenamento };

/**
 * A Interface única por onde o acervo lê e grava dados persistidos.
 *
 * As operações são de armazenamento **do domínio** — Cartão, Baralho, Vínculo
 * e as contagens da elegibilidade —, e não um executor de SQL: o Adapter
 * decide como perguntar, e o Module decide apenas o que perguntar. O que a
 * Interface esconde é esquema, dialeto, transação, tradução do erro do driver
 * e o próprio fato de haver banco.
 */
export interface ArmazenamentoDoAcervo {
  /**
   * Guarda um Cartão já validado pelo Module. `id` é opaco e vem de quem
   * chama, de modo que o Module continua dono da identidade (FR-009).
   */
  inserirCartao(cartao: Cartao): Promise<Desfecho<Cartao>>;

  /** Devolve todos os Cartões guardados, sem prometer ordem alguma. */
  listarCartoes(): Promise<Cartao[]>;

  /** Devolve o Cartão de `id`; ausente é `nao_encontrado`. */
  obterCartao(id: string): Promise<Desfecho<Cartao>>;

  /**
   * Grava Frente e Verso do Cartão de `cartao.id`, preservando os Vínculos.
   * Ausente é `nao_encontrado`.
   */
  atualizarCartao(cartao: Cartao): Promise<Desfecho<Cartao>>;

  /**
   * Exclui o Cartão de `id`; os Vínculos dele caem pela cascata do esquema e
   * os Baralhos são preservados (FR-008). Ausente é `nao_encontrado`.
   */
  excluirCartao(id: string): Promise<Desfecho<void>>;

  /**
   * Guarda um Baralho já validado pelo Module. `id` é opaco e vem de quem
   * chama; o nome é rótulo, e nomes repetidos são legítimos (FR-012).
   */
  inserirBaralho(baralho: Baralho): Promise<Desfecho<Baralho>>;

  /** Devolve todos os Baralhos guardados, sem prometer ordem alguma. */
  listarBaralhos(): Promise<Baralho[]>;

  /** Devolve o Baralho de `id`; ausente é `nao_encontrado`. */
  obterBaralho(id: string): Promise<Desfecho<Baralho>>;

  /**
   * Grava o nome do Baralho de `baralho.id`, preservando os Vínculos e a
   * elegibilidade derivada (FR-015). Ausente é `nao_encontrado`.
   */
  atualizarBaralho(baralho: Baralho): Promise<Desfecho<Baralho>>;

  /**
   * Exclui o Baralho de `id`; os Vínculos dele caem pela cascata do esquema e
   * os Cartões são preservados (FR-017). Ausente é `nao_encontrado`.
   */
  excluirBaralho(id: string): Promise<Desfecho<void>>;

  /**
   * Associa um Cartão existente a um Baralho existente (FR-019). O par
   * repetido é recusado como `vinculo_duplicado`, e extremidade inexistente
   * como `nao_encontrado` — nenhum dos dois é falha do armazenamento.
   */
  vincular(cartaoId: string, baralhoId: string): Promise<Desfecho<void>>;

  /**
   * Desfaz o Vínculo, preservando Cartão e Baralho (FR-021). Vínculo
   * inexistente é recusado como `nao_encontrado`.
   */
  desvincular(cartaoId: string, baralhoId: string): Promise<Desfecho<void>>;

  /** Devolve os Baralhos a que o Cartão está vinculado, sem ordem prometida. */
  listarBaralhosDoCartao(cartaoId: string): Promise<Baralho[]>;

  /** Devolve os Cartões vinculados ao Baralho, sem ordem prometida. */
  listarCartoesDoBaralho(baralhoId: string): Promise<Cartao[]>;

  /**
   * Devolve a quantidade de Cartões de cada Baralho, lida dos Vínculos. É o
   * insumo da elegibilidade derivada, que o Module calcula como contagem maior
   * que zero (FR-024).
   */
  contarCartoesPorBaralho(): Promise<ContagemPorBaralho[]>;
}
