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

import type { Avaliacao } from "../repeticao/algoritmo.ts";

/**
 * A Avaliação em quatro níveis é vocabulário **compartilhado**: o Module de
 * repetição a produz e a Porta a grava, e por isso a Porta a re-exporta, como
 * já faz com outros tipos do domínio (FR-192).
 */
export type { Avaliacao };

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
 * Resultado de um Item dentro de um Registro de sessão (FR-161): o que a
 * pessoa respondeu naquele Item, no instante da conclusão.
 *
 * É vocabulário de domínio gravado como texto e restrito pelo `CHECK` do
 * esquema, para que nenhum outro valor entre por engano — a Porta não valida,
 * apenas guarda o que o Module já aceitou.
 */
export type ResultadoDoItemRegistrado = "acertou" | "errou";

/**
 * Item estudado como o Registro de sessão o guarda (FR-161): a posição na
 * ordem apresentada, a Frente e o Verso que o Cartão tinha naquele momento e o
 * Resultado declarado.
 *
 * A Frente e o Verso são **cópias**, não referências ao Cartão: editar ou
 * excluir o Cartão depois não muda o Registro (FR-165), e o Resumo de um
 * registro antigo continua mostrando o que foi estudado (FR-178).
 */
export interface ItemRegistrado {
  /** Posição na ordem apresentada: `0..n-1`, derivada pelo Module. */
  readonly posicao: number;
  readonly frente: string;
  readonly verso: string;
  readonly resultado: ResultadoDoItemRegistrado;
  /** Cartão de origem; ausente/nulo em Itens anteriores à 015 (FR-196, FR-197). */
  readonly cartaoId?: string | null;
  /** Avaliação em 4 níveis; ausente/nula em Itens anteriores à 015 (FR-196, FR-197). */
  readonly avaliacao?: Avaliacao | null;
}

/**
 * Registro de sessão: a Sessão **concluída** como ela fica no Histórico de um
 * Usuário (FR-161). É imutável para o Usuário (FR-165) e persistido nos dois
 * armazenamentos suportados (FR-167).
 *
 * `id` é gerado pelo **cliente** e é a chave da idempotência: reenviar o mesmo
 * registro não o duplica, e `concluidaEm` permanece o da primeira inserção
 * (FR-163). `baralhoId` é guardado **sem chave estrangeira**, porque o Baralho
 * pode ser excluído depois sem que o registro se perca (FR-165, FR-178); o
 * `nomeDoBaralho` é o nome como era ao concluir. Os totais e a `posicao` de
 * cada Item são derivados dos Itens pelo Module, nunca informados pelo cliente.
 */
export interface RegistroDeSessao {
  readonly id: string;
  readonly baralhoId: string;
  readonly nomeDoBaralho: string;
  /**
   * Origem da Sessão: estudo livre por Baralho (`"baralho"`) ou Revisão do dia
   * (`"revisao"`) (FR-196). Na Revisão do dia, `baralhoId` vale `""` e
   * `nomeDoBaralho` vale `"Revisão do dia"` — ambos derivados pelo Module (D5).
   */
  readonly origem: "baralho" | "revisao";
  /** ISO-8601 UTC, definido pelo Module na primeira inserção. */
  readonly concluidaEm: string;
  readonly estudados: number;
  readonly acertos: number;
  readonly erros: number;
  readonly itens: readonly ItemRegistrado[];
}

/**
 * Linha de listagem do Histórico: o Registro **sem os Itens**.
 *
 * Início só precisa dos totais e do instante de cada Sessão, e o Histórico
 * grande continua respondendo porque a listagem não carrega os Itens
 * (FR-169, SC-077).
 */
export type RegistroResumido = Omit<RegistroDeSessao, "itens">;

/**
 * Agendamento do Cartão: a relação entre um Usuário e um Cartão que guarda
 * quando aquele Cartão deve ser revisto (FR-187). É por Cartão e por Usuário,
 * **nunca** por Vínculo (FR-207): o mesmo Agendamento vale em todos os Baralhos
 * a que o Cartão esteja vinculado.
 *
 * `estado` é **opaco**: só o Algoritmo de repetição o interpreta (FR-188,
 * FR-189). O único campo que o restante do produto lê, além do Cartão e do
 * Usuário donos, é `proximaRevisaoEm` (FR-189).
 */
export interface Agendamento {
  readonly cartaoId: string;
  /** Identificador do algoritmo que produziu o estado; hoje `"sm2"`. */
  readonly algoritmo: string;
  /** Versão do algoritmo; estado de outra versão não é lido (D1, D4). */
  readonly versaoDoAlgoritmo: number;
  /** Estado opaco próprio do algoritmo; a Porta apenas o guarda (FR-188). */
  readonly estado: unknown;
  /** ISO-8601 UTC: a próxima data de revisão do Cartão (FR-187, FR-189). */
  readonly proximaRevisaoEm: string;
  /** Última Avaliação declarada; o `CHECK` do esquema é a rede de segurança. */
  readonly ultimaAvaliacao: Avaliacao;
  /** ISO-8601 UTC: o instante da última revisão. */
  readonly revisadoEm: string;
  /**
   * ISO-8601 UTC: o instante da **primeira** Avaliação que originou o
   * Agendamento. É preservado em toda atualização posterior e é o que faz o
   * Cartão contar no limite de Cartões novos do dia (D3, FR-199, FR-200).
   */
  readonly criadoEm: string;
}

/**
 * Preferências de repetição espaçada de um Usuário (FR-212). A **ausência de
 * linha** equivale aos padrões — `algoritmo = "sm2"` e `limiteDeNovosPorDia =
 * 20` —, que a Porta sintetiza na leitura, sem gravar linha a priori (D5).
 */
export interface Preferencias {
  /** Identificador do algoritmo escolhido; precisa estar em `ALGORITMOS`. */
  readonly algoritmo: string;
  /**
   * Inteiro de 0 a 999; **0** significa não introduzir Cartões novos
   * (FR-200).
   */
  readonly limiteDeNovosPorDia: number;
}

/**
 * Item do Histórico com Avaliação e Cartão de origem — o insumo do replay que
 * reconstrói os Agendamentos na troca de algoritmo (FR-213). Itens anteriores
 * à 015, com `avaliacao` ou `cartaoId` ausentes, ficam de fora.
 */
export interface ItemAvaliado {
  readonly cartaoId: string;
  readonly avaliacao: Avaliacao;
  /** ISO-8601 UTC: o instante da conclusão da Sessão a que o Item pertence. */
  readonly concluidaEm: string;
  /** Posição do Item na ordem apresentada: `0..n-1`. */
  readonly posicao: number;
}

/**
 * Códigos de falha tipada da Porta. São vocabulário de armazenamento, nunca
 * mensagem: `nao_encontrado` é a ausência de linha a ler, a alterar ou a
 * excluir; `vinculo_duplicado` é o par (Cartão, Baralho) repetido, reconhecido
 * pela unicidade do esquema; `conflito` é o identificador de um Registro de
 * sessão já usado **por outro Usuário**, reconhecido pela chave primária do
 * registro (FR-163, FR-166); `indisponivel` é a falha do armazenamento —
 * arquivo, conexão, transação ou consulta —, e jamais significa concluído
 * (FR-044, FR-107).
 */
export type CodigoDeFalhaDeArmazenamento =
  | "nao_encontrado"
  | "vinculo_duplicado"
  | "conflito"
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
 * As operações são de armazenamento **do domínio** — Cartão, Baralho, Vínculo,
 * as contagens da elegibilidade e o Registro de sessão do Histórico —, e não
 * um executor de SQL: o Adapter decide como perguntar, e o Module decide
 * apenas o que perguntar. O que a Interface esconde é esquema, dialeto,
 * transação, tradução do erro do driver e o próprio fato de haver banco.
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

  /**
   * Guarda um Registro de sessão concluída (FR-161) no Histórico de
   * `usuarioId`. Registro e Itens entram **numa única transação** (FR-167), de
   * modo que não existe Histórico pela metade.
   *
   * `id` vem de quem chama e é a chave da idempotência: reinserir o mesmo `id`
   * **do mesmo Usuário** devolve o registro já guardado, sem alterá-lo — a
   * primeira `concluidaEm` é a que vale, e o reenvio após falha nunca duplica
   * (FR-163). O mesmo `id` de **outro** Usuário é recusado como `conflito`,
   * porque Históricos não se misturam entre donos (FR-166). A falha do
   * armazenamento chega como `indisponivel`, jamais como concluído (FR-164).
   */
  inserirRegistroDeSessao(
    usuarioId: string,
    registro: RegistroDeSessao,
  ): Promise<Desfecho<RegistroDeSessao>>;

  /**
   * Devolve os registros de `usuarioId` com `concluidaEm >= desde` (ISO-8601),
   * **do mais recente ao mais antigo** — a janela das Estatísticas de Início
   * (FR-169). A lista vem sem os Itens, para que o Histórico grande continue
   * respondendo (SC-077).
   */
  listarRegistrosDesde(
    usuarioId: string,
    desde: string,
  ): Promise<RegistroResumido[]>;

  /**
   * Devolve os `limite` registros mais recentes de `usuarioId`, **do mais
   * recente ao mais antigo** — as Sessões recentes de Início (FR-169, FR-177).
   * Sem os Itens, pela mesma razão de `listarRegistrosDesde`.
   */
  listarRegistrosRecentes(
    usuarioId: string,
    limite: number,
  ): Promise<RegistroResumido[]>;

  /**
   * Devolve o Registro completo de `id` **no Histórico de `usuarioId`**, com os
   * Itens na ordem apresentada (FR-177). Registro inexistente — inclusive
   * quando é de outro Usuário — é `nao_encontrado` (FR-166, FR-179), o mesmo
   * desfecho dos demais recursos do acervo.
   */
  obterRegistroDeSessao(
    usuarioId: string,
    id: string,
  ): Promise<Desfecho<RegistroDeSessao>>;

  /**
   * Devolve as Preferências de repetição espaçada de `usuarioId` (FR-212).
   * Ausência de linha **não** é `nao_encontrado`: a Porta sintetiza os padrões
   * (`algoritmo = "sm2"`, `limiteDeNovosPorDia = 20`) e nunca grava linha a
   * priori (D5).
   */
  obterPreferencias(usuarioId: string): Promise<Preferencias>;

  /**
   * Grava (insert ou update) as Preferências de `usuarioId` (FR-212). Já
   * validadas pelo Module, a Porta apenas as guarda; a falha do armazenamento
   * chega como `indisponivel`, jamais como concluído (FR-044, FR-107).
   */
  salvarPreferencias(
    usuarioId: string,
    preferencias: Preferencias,
  ): Promise<Desfecho<Preferencias>>;

  /** Devolve os Agendamentos de `usuarioId`, sem prometer ordem alguma. */
  listarAgendamentos(usuarioId: string): Promise<Agendamento[]>;

  /**
   * Numa **única transação**, guarda um Registro de sessão concluída e aplica
   * a ele os Agendamentos resultantes das Avaliações (FR-167, FR-210).
   *
   * Se o `id` do Registro já existe **para o mesmo Usuário**, devolve o
   * Registro já guardado com `novo: false` e **não** grava Agendamento algum —
   * é a idempotência do Histórico estendida aos Agendamentos (FR-163,
   * FR-210). O mesmo `id` de **outro** Usuário é recusado como `conflito`,
   * como em `inserirRegistroDeSessao` (FR-166). A falha do armazenamento chega
   * como `indisponivel`, jamais como concluído (FR-164).
   *
   * Agendamento de Cartão inexistente — excluído entre a leitura e a gravação —
   * é descartado em silêncio, sem derrubar a transação (D5).
   */
  inserirRegistroEAgendamentos(
    usuarioId: string,
    registro: RegistroDeSessao,
    agendamentos: readonly Agendamento[],
  ): Promise<Desfecho<{ registro: RegistroDeSessao; novo: boolean }>>;

  /**
   * Numa **única transação**, salva as Preferências de `usuarioId`, apaga
   * **todos** os Agendamentos dele e grava os novos — a reconstrução que a
   * troca de algoritmo dispara (FR-212, FR-213). A falha do armazenamento
   * chega como `indisponivel`.
   */
  substituirAgendamentos(
    usuarioId: string,
    preferencias: Preferencias,
    agendamentos: readonly Agendamento[],
  ): Promise<Desfecho<void>>;

  /**
   * Devolve os Itens de `usuarioId` que têm Avaliação e Cartão de origem,
   * **em ordem `(concluidaEm, posicao)`** — o insumo do replay que reconstrói
   * os Agendamentos (FR-213). Itens anteriores à 015, com `avaliacao` ou
   * `cartaoId` ausentes, ficam de fora.
   */
  listarItensAvaliados(usuarioId: string): Promise<ItemAvaliado[]>;
}
