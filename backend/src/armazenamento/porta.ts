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
 *
 * O arquivo declara também a **segunda Porta**, `ArmazenamentoDeUsuarios`, por
 * onde o Module `Identidade` lê e grava Usuários. Ela é implementada pelos
 * mesmos Adapters e obedece às mesmas regras de desfecho; os Modules do acervo
 * continuam conhecendo apenas `ArmazenamentoDoAcervo`.
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
 * Usuário como o armazenamento o guarda: identificador opaco, Nome de usuário
 * e a transformação **irreversível** da Senha — o `sal` aleatório de cada
 * Usuário, o `hash` derivado dele e os `parametros` da derivação, em JSON, para
 * que um hash antigo continue verificável quando os parâmetros evoluírem.
 *
 * Nenhum campo carrega a Senha, nem derivado dela: nenhuma coluna consegue
 * guardá-la (FR-076). É a Porta quem declara esta forma, porque é ela quem
 * troca esses dados com o armazenamento; o Module `Identidade` a re-exporta na
 * sua Interface.
 */
export interface Usuario {
  id: string;
  nomeDeUsuario: string;
  sal: Uint8Array;
  hash: Uint8Array;
  parametros: string;
}

/**
 * Códigos de falha tipada da gravação de Usuário. `nome_de_usuario_existente`
 * é a unicidade do esquema — sem distinção entre maiúsculas e minúsculas —
 * reconhecida pelo Adapter e devolvida como resultado de domínio, e não como
 * erro do driver; `indisponivel` é a falha do armazenamento, e jamais significa
 * concluído (FR-074, FR-044, FR-107).
 */
export type CodigoDeFalhaDeInsercaoDeUsuario =
  | "nome_de_usuario_existente"
  | "indisponivel";

/**
 * Códigos de falha tipada da leitura de Usuário: ausência de linha a ler e
 * falha do armazenamento.
 */
export type CodigoDeFalhaDeLeituraDeUsuario = "nao_encontrado" | "indisponivel";

/** Desfecho da gravação de Usuário: gravado, ou a recusa tipada. */
export type DesfechoDeInsercaoDeUsuario =
  | { ok: true; valor: Usuario }
  | { ok: false; erro: CodigoDeFalhaDeInsercaoDeUsuario };

/** Desfecho da leitura de Usuário: o Usuário guardado, ou a falha tipada. */
export type DesfechoDeLeituraDeUsuario =
  | { ok: true; valor: Usuario }
  | { ok: false; erro: CodigoDeFalhaDeLeituraDeUsuario };

/**
 * Segunda Porta: a Interface por onde o `Identidade` lê e grava Usuários.
 *
 * É implementada pelos **mesmos** Adapters da `ArmazenamentoDoAcervo`, e as
 * regras que ela garante ao caller são as mesmas da primeira: toda operação
 * devolve `Promise`, nenhum erro do driver atravessa a Interface e o Nome de
 * usuário repetido chega como desfecho tipado (`nome_de_usuario_existente`),
 * nunca como erro de unicidade do driver.
 *
 * A Porta não valida, não transforma a Senha e não tem texto em português: a
 * derivação, a validação e as mensagens são do Module `Identidade`, que é o
 * dono da regra de Cadastro.
 */
export interface ArmazenamentoDeUsuarios {
  /**
   * Guarda um Usuário já validado e já derivado pelo Module. `id` é opaco e
   * vem de quem chama. O Nome de usuário já existente é recusado como
   * `nome_de_usuario_existente`, pela unicidade sem distinção entre maiúsculas
   * e minúsculas do esquema (FR-074).
   */
  inserirUsuario(usuario: Usuario): Promise<DesfechoDeInsercaoDeUsuario>;

  /**
   * Devolve o Usuário do Nome de usuário informado, **sem distinguir
   * maiúsculas de minúsculas**; ausente é `nao_encontrado`. É a leitura de que
   * a verificação da Senha da `008-entrar` vai precisar.
   */
  obterUsuarioPorNomeDeUsuario(
    nomeDeUsuario: string,
  ): Promise<DesfechoDeLeituraDeUsuario>;
}

/**
 * A Interface única por onde o acervo lê e grava dados persistidos.
 *
 * As operações são de armazenamento **do domínio** — Cartão, Baralho, Vínculo
 * e as contagens da elegibilidade —, e não um executor de SQL: o Adapter
 * decide como perguntar, e o Module decide apenas o que perguntar. O que a
 * Interface esconde é esquema, dialeto, transação, tradução do erro do driver
 * e o próprio fato de haver banco.
 *
 * **Toda operação recebe o dono**, o `usuarioId` do Usuário que Entrou
 * (FR-092): é o escopo do acervo, e não um dado da entidade. As duas
 * Implementações restringem a ela toda linha que leem ou gravam, de modo que
 * um Cartão ou um Baralho de outro Usuário responde como inexistente —
 * `nao_encontrado`, o mesmo desfecho de um `id` que nunca existiu (SC-030) —, e
 * nunca como um erro novo ou um 403 que revelasse a existência. Vincular exige
 * as duas extremidades **no mesmo dono** (FR-093).
 */
export interface ArmazenamentoDoAcervo {
  /**
   * Guarda um Cartão já validado pelo Module, como acervo do Usuário
   * `usuarioId`. `id` é opaco e vem de quem chama, de modo que o Module
   * continua dono da identidade (FR-009).
   */
  inserirCartao(usuarioId: string, cartao: Cartao): Promise<Desfecho<Cartao>>;

  /** Devolve os Cartões de `usuarioId`, sem prometer ordem alguma. */
  listarCartoes(usuarioId: string): Promise<Cartao[]>;

  /**
   * Devolve o Cartão de `id` **no acervo de `usuarioId`**; ausente — inclusive
   * quando o Cartão é de outro Usuário — é `nao_encontrado`.
   */
  obterCartao(usuarioId: string, id: string): Promise<Desfecho<Cartao>>;

  /**
   * Grava Frente e Verso do Cartão de `cartao.id` no acervo de `usuarioId`,
   * preservando os Vínculos. Ausente é `nao_encontrado`.
   */
  atualizarCartao(usuarioId: string, cartao: Cartao): Promise<Desfecho<Cartao>>;

  /**
   * Exclui o Cartão de `id` do acervo de `usuarioId`; os Vínculos dele caem
   * pela cascata do esquema e os Baralhos são preservados (FR-008). Ausente é
   * `nao_encontrado`.
   */
  excluirCartao(usuarioId: string, id: string): Promise<Desfecho<void>>;

  /**
   * Guarda um Baralho já validado pelo Module, como acervo do Usuário
   * `usuarioId`. `id` é opaco e vem de quem chama; o nome é rótulo, e nomes
   * repetidos são legítimos (FR-012).
   */
  inserirBaralho(usuarioId: string, baralho: Baralho): Promise<Desfecho<Baralho>>;

  /** Devolve os Baralhos de `usuarioId`, sem prometer ordem alguma. */
  listarBaralhos(usuarioId: string): Promise<Baralho[]>;

  /**
   * Devolve o Baralho de `id` no acervo de `usuarioId`; ausente — inclusive
   * quando o Baralho é de outro Usuário — é `nao_encontrado`.
   */
  obterBaralho(usuarioId: string, id: string): Promise<Desfecho<Baralho>>;

  /**
   * Grava o nome do Baralho de `baralho.id` no acervo de `usuarioId`,
   * preservando os Vínculos e a elegibilidade derivada (FR-015). Ausente é
   * `nao_encontrado`.
   */
  atualizarBaralho(usuarioId: string, baralho: Baralho): Promise<Desfecho<Baralho>>;

  /**
   * Exclui o Baralho de `id` do acervo de `usuarioId`; os Vínculos dele caem
   * pela cascata do esquema e os Cartões são preservados (FR-017). Ausente é
   * `nao_encontrado`.
   */
  excluirBaralho(usuarioId: string, id: string): Promise<Desfecho<void>>;

  /**
   * Associa um Cartão existente a um Baralho existente (FR-019), **os dois no
   * acervo de `usuarioId`**: extremidade de outro Usuário é `nao_encontrado`,
   * como se ela não existisse (FR-093). O par repetido é recusado como
   * `vinculo_duplicado` — nenhum dos dois desfechos é falha do armazenamento.
   */
  vincular(
    usuarioId: string,
    cartaoId: string,
    baralhoId: string,
  ): Promise<Desfecho<void>>;

  /**
   * Desfaz o Vínculo no acervo de `usuarioId`, preservando Cartão e Baralho
   * (FR-021). Vínculo inexistente é recusado como `nao_encontrado`.
   */
  desvincular(
    usuarioId: string,
    cartaoId: string,
    baralhoId: string,
  ): Promise<Desfecho<void>>;

  /**
   * Devolve os Baralhos a que o Cartão de `usuarioId` está vinculado, sem
   * ordem prometida.
   */
  listarBaralhosDoCartao(usuarioId: string, cartaoId: string): Promise<Baralho[]>;

  /**
   * Devolve os Cartões vinculados ao Baralho de `usuarioId`, sem ordem
   * prometida.
   */
  listarCartoesDoBaralho(usuarioId: string, baralhoId: string): Promise<Cartao[]>;

  /**
   * Devolve a quantidade de Cartões de cada Baralho **do Usuário
   * `usuarioId`**, lida dos Vínculos. É o insumo da elegibilidade derivada, que
   * o Module calcula como contagem maior que zero (FR-024).
   */
  contarCartoesPorBaralho(
    usuarioId: string,
  ): Promise<ContagemPorBaralho[]>;
}
