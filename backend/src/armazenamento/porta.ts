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
 * linha** equivale ao padrão — `algoritmo = "sm2"` —, que a Porta sintetiza
 * na leitura, sem gravar linha a priori (D5).
 */
export interface Preferencias {
  /** Identificador do algoritmo escolhido; precisa estar em `ALGORITMOS`. */
  readonly algoritmo: string;
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
 * Estado da Rotina de estudo (FR-248): `ativa` programa ocorrências;
 * `pausada` interrompe a programação sem apagar o histórico; `excluida` é o
 * tombstone que preserva a identidade da Rotina e a programação já registrada.
 */
export type EstadoDaRotina = "ativa" | "pausada" | "excluida";

/**
 * Versão da configuração de uma Rotina, vigente a partir de `iniciaEm`
 * (data civil YYYY-MM-DD), como o armazenamento a guarda (FR-248). Cada
 * alteração cria uma versão nova, e as versões antigas permanecem para que a
 * programação passada continue explicável.
 */
export interface VersaoDaRotina {
  /** Ordem de alteração: 1, 2, 3... */
  readonly ordem: number;
  /** Data civil a partir da qual esta versão vale. */
  readonly iniciaEm: string;
  readonly baralhoId: string;
  /** Nome do Baralho como era nesta versão; rótulo histórico. */
  readonly nomeDoBaralho: string;
  /** Dias da semana: inteiros únicos de 1 a 7. */
  readonly dias: readonly number[];
  /** Quantidade de Cartões por ocorrência; `null` significa Todos. */
  readonly quantidade: number | null;
  /** Estado vigente a partir de `iniciaEm`; pausa e exclusão têm efeito de data. */
  readonly estado: EstadoDaRotina;
}

/**
 * Rotina de estudo como o armazenamento a guarda (FR-248). `versao` é a
 * concorrência otimista da Rotina; `versoes` guarda o histórico de
 * configurações, cada uma com o `baralhoId` próprio.
 */
export interface RotinaArmazenada {
  readonly id: string;
  /** ISO-8601 UTC. */
  readonly criadaEm: string;
  /** Inteiro >= 1; incrementado pelo Module a cada gravação. */
  readonly versao: number;
  /** Estado atual; `excluida` é tombstone. */
  readonly estado: EstadoDaRotina;
  /**
   * Baralho atual da Rotina; `null` quando o Baralho foi excluído. A Rotina
   * fica indisponível, mas a programação permanece (FR-248).
   */
  readonly baralhoId: string | null;
  /** Versões ordenadas por `ordem`; cada uma guarda o `baralhoId` da época. */
  readonly versoes: readonly VersaoDaRotina[];
}

/** Estado persistido de um Compromisso: exceções e conclusões (FR-250). */
export type EstadoPersistidoDoCompromisso = "cancelado" | "concluido";

/**
 * Compromisso persistido (FR-250): só exceções (`cancelado`) e conclusões.
 * Ocorrências comuns da Rotina são projetadas pelo Module, não guardadas.
 */
export interface CompromissoPersistido {
  readonly rotinaId: string;
  /** Data civil YYYY-MM-DD da ocorrência. */
  readonly data: string;
  readonly estado: EstadoPersistidoDoCompromisso;
  /** Primeiro Registro confirmado; imutável uma vez gravado. */
  readonly registroId: string | null;
  /** Configuração capturada no momento do compromisso. */
  readonly baralhoId: string;
  readonly nomeDoBaralho: string;
  readonly quantidade: number | null;
}

/**
 * Início de estudo autorizado pelo servidor (FR-250): a lista de Cartões já
 * selecionada e imutável, guardada para reabrir a sessão.
 */
export interface InicioAutorizado {
  /** Identificador aleatório, gerado no servidor. */
  readonly id: string;
  readonly rotinaId: string;
  readonly data: string;
  /** ISO-8601 UTC. */
  readonly iniciadoEm: string;
  readonly fuso: string;
  readonly baralhoId: string;
  readonly nomeDoBaralho: string;
  /** Quantidade solicitada; `null` significa Todos. */
  readonly quantidade: number | null;
  /** Cartões selecionados no servidor, com a ordem preservada. */
  readonly cartoes: readonly Cartao[];
}

/**
 * Códigos de falha tipada das operações de Rotina (FR-248). Como os demais
 * códigos da Porta, não são mensagem: a frase que o usuário lê nasce no Module.
 */
export type CodigoDeFalhaDeRotina =
  | "nao_encontrado"
  | "conflito_de_versao"
  | "conflito"
  | "indisponivel";

/** Desfecho tipado das operações de Rotina (FR-248). */
export type DesfechoDeRotina<T> =
  | { ok: true; valor: T }
  | { ok: false; erro: CodigoDeFalhaDeRotina };

/**
 * Intenção de gravação de uma Rotina (FR-248): `operacaoId` é a chave de
 * idempotência, `intencao` distingue reenvio de reuso indevido e
 * `versaoEsperada` implementa o CAS da concorrência otimista.
 */
export interface GravacaoDeRotina {
  readonly operacaoId: string;
  /** Texto canônico da intenção; decide entre reenvio e conflito. */
  readonly intencao: string;
  /** `null` = criação; número = atualização com CAS pela versão guardada. */
  readonly versaoEsperada: number | null;
  /** Estado completo a gravar; o Module já incrementou `versao`. */
  readonly rotina: RotinaArmazenada;
  /**
   * Compromissos de hoje que a alteração cancela (FR-238, FR-239). Gravados
   * como `cancelado` **na mesma transação** da Rotina, e só quando ainda não há
   * linha para `(rotinaId, data)`: uma conclusão nunca é sobrescrita (FR-245).
   */
  readonly cancelamentos?: readonly CompromissoPersistido[];
  /**
   * Datas cujo Compromisso `cancelado` volta a valer (FR-239): a linha
   * `cancelado` de `(rotina.id, data)` é removida na mesma transação. Linha
   * `concluido` nunca é removida.
   */
  readonly reativacoes?: readonly string[];
}

/** Operação de Rotina já gravada: a intenção e a Rotina que ela produziu. */
export interface OperacaoDeRotinaGravada {
  readonly intencao: string;
  readonly rotina: RotinaArmazenada;
}

/**
 * Estado lido **dentro** da transação de conclusão de uma Sessão da Agenda: os
 * Agendamentos e as Preferências vigentes (FR-233, FR-256).
 */
export interface EstadoDeAgendamentoLido {
  readonly agendamentos: readonly Agendamento[];
  readonly preferencias: Preferencias;
}

/**
 * Função de domínio que a Porta chama com o estado lido na transação para obter
 * os Agendamentos a gravar. A Porta não expõe conexão, SQL ou driver ao Module.
 */
export type CalculoDeAgendamentos = (
  estado: EstadoDeAgendamentoLido,
) => readonly Agendamento[];

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
 * Contagens do que pertence a um Usuário — o que `excluirUsuario` remove e o
 * que o diálogo de «Excluir conta» anuncia (FR-272, SC-113). `agenda` soma os
 * registros persistidos da Agenda do Usuário (Rotinas, Compromissos e Inícios);
 * versões guardadas dentro de uma Rotina não contam separadamente. É `null`
 * apenas num armazenamento sem as tabelas da Agenda.
 */
export interface ContagensDaConta {
  cartoes: number;
  baralhos: number;
  registrosDeSessao: number;
  agenda: number | null;
}

/** Transformação irreversível da Senha, como a Porta a troca (FR-078). */
export interface DerivacaoGuardada {
  sal: Uint8Array;
  hash: Uint8Array;
  parametros: string;
}

/** Desfecho das operações de conta sobre o Usuário. */
export type DesfechoDeOperacaoDeConta<T> =
  | { ok: true; valor: T }
  | { ok: false; erro: "nao_encontrado" | "indisponivel" };

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

  /**
   * Devolve o Usuário de `id`; ausente é `nao_encontrado`. É a leitura que a
   * gestão da conta usa para conferir a Senha atual de quem já Entrou (017).
   */
  obterUsuarioPorId(id: string): Promise<DesfechoDeLeituraDeUsuario>;

  /**
   * Substitui `sal`, `hash` e `parametros` do Usuário pela nova derivação. A
   * Senha em texto claro nunca entra na Porta (FR-078, FR-267).
   */
  atualizarSenha(
    id: string,
    derivacao: DerivacaoGuardada,
  ): Promise<DesfechoDeOperacaoDeConta<void>>;

  /**
   * Exclui o Usuário e, pelas cascatas `ON DELETE CASCADE` do esquema, tudo o
   * que lhe pertence, numa única instrução transacional: ou tudo desaparece, ou
   * nada é aplicado (FR-274, FR-275, SC-108).
   */
  excluirUsuario(id: string): Promise<DesfechoDeOperacaoDeConta<void>>;

  /** Conta o que pertence ao Usuário, como `excluirUsuario` removeria (SC-113). */
  contarDadosDoUsuario(
    id: string,
  ): Promise<DesfechoDeOperacaoDeConta<ContagensDaConta>>;
}

/**
 * Terceira Porta: a Interface por onde o Module `Acessos` guarda o **Acesso
 * temporário** (018) — o comprovante emitido ao Entrar que permite continuar
 * operando no mesmo navegador sem reapresentar a Credencial.
 *
 * O **valor em claro nunca entra na Porta**: quem chama informa o digest
 * SHA-256 do valor, e é só ele que se persiste (FR-297). A validade é decidida
 * aqui, pelo servidor, a partir do `expiraEm` gravado — o relógio do aparelho
 * não participa. Os instantes são ISO-8601 UTC.
 *
 * Como nas demais Portas, nenhum erro do driver atravessa a Interface: a falha
 * do armazenamento é `indisponivel`, e jamais se confunde com Acesso ausente ou
 * expirado (FR-301).
 */
export type DesfechoDeAcesso<T> =
  | { ok: true; valor: T }
  | { ok: false; erro: "nao_encontrado" | "indisponivel" };

/** Desfecho de `obterValido`: o dono do Acesso, ou por que ele não vale. */
export type DesfechoDeAcessoValido =
  | { ok: true; valor: { usuarioId: string } }
  | { ok: false; erro: "nao_encontrado" | "expirado" | "indisponivel" };

export interface ArmazenamentoDeAcessos {
  /** Grava o digest, o dono e o vencimento de um Acesso novo. */
  criar(
    digest: string,
    usuarioId: string,
    expiraEm: string,
  ): Promise<DesfechoDeAcesso<void>>;

  /**
   * Devolve o dono do Acesso quando a linha existe e `expiraEm > agora`;
   * `expirado` quando existe e `expiraEm <= agora` — para autorizar, conta como
   * ausente, mas o código permite responder `acesso_expirado` —; e
   * `nao_encontrado` quando não existe (FR-294, FR-301).
   */
  obterValido(
    digest: string,
    agora: string,
  ): Promise<DesfechoDeAcessoValido>;

  /** Atualiza `expiraEm` e `ultimaAcaoEm` do Acesso; ausente é `nao_encontrado`. */
  renovar(
    digest: string,
    novoExpiraEm: string,
  ): Promise<DesfechoDeAcesso<void>>;

  /** Remove o Acesso do digest; ausente também é sucesso (idempotente). */
  encerrar(digest: string): Promise<DesfechoDeAcesso<void>>;

  /** Remove **todos** os Acessos do Usuário — outros navegadores incluídos (FR-296). */
  encerrarTodosDoUsuario(usuarioId: string): Promise<DesfechoDeAcesso<void>>;

  /** Remove os Acessos com `expiraEm < agora` e devolve quantos eram (D7). */
  removerExpirados(agora: string): Promise<DesfechoDeAcesso<number>>;
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
   * (`algoritmo = "sm2"`) e nunca grava linha a
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

  /**
   * Grava uma Rotina de estudo no acervo de `usuarioId` (FR-248), numa única
   * transação idempotente. Se `(usuarioId, operacaoId)` já existe: mesma
   * `intencao` devolve a Rotina guardada com `repetida: true`, sem gravar; outra
   * `intencao` recusa como `conflito`. `versaoEsperada === null` insere; caso
   * contrário, atualiza com CAS pela versão guardada, distinguindo
   * `nao_encontrado` de `conflito_de_versao`. Falha do armazenamento é
   * `indisponivel`, jamais gravação parcial (FR-044, FR-107, FR-248).
   */
  gravarRotina(
    usuarioId: string,
    gravacao: GravacaoDeRotina,
  ): Promise<DesfechoDeRotina<{ rotina: RotinaArmazenada; repetida: boolean }>>;

  /**
   * Devolve a operação de Rotina `operacaoId` de `usuarioId` (FR-249), para que
   * o reenvio seja reconhecido **antes** de qualquer verificação que dependa do
   * estado atual; ausente é `nao_encontrado`.
   */
  obterOperacaoDeRotina(
    usuarioId: string,
    operacaoId: string,
  ): Promise<Desfecho<OperacaoDeRotinaGravada>>;

  /**
   * Devolve a Rotina de `id` no acervo de `usuarioId` (FR-248); ausente —
   * inclusive quando é de outro Usuário — é `nao_encontrado`.
   */
  obterRotina(
    usuarioId: string,
    id: string,
  ): Promise<Desfecho<RotinaArmazenada>>;

  /**
   * Devolve as Rotinas de `usuarioId`, incluindo as excluídas (tombstones),
   * sem prometer ordem (FR-248).
   */
  listarRotinas(usuarioId: string): Promise<RotinaArmazenada[]>;

  /**
   * Grava uma exceção ou conclusão de Compromisso no acervo de `usuarioId`
   * (FR-250). Rotina inexistente ou de outro dono é `nao_encontrado`. Sem
   * linha para `(rotinaId, data)`, insere com `alterado: true`. Com linha
   * `concluido`, devolve a existente intacta (`alterado: false`; conclusão
   * imutável). Com linha `cancelado`, atualiza estado, registro e
   * configuração, preservando `registroId` existente.
   */
  gravarCompromisso(
    usuarioId: string,
    compromisso: CompromissoPersistido,
  ): Promise<Desfecho<{ compromisso: CompromissoPersistido; alterado: boolean }>>;

  /**
   * Devolve o Compromisso de `(rotinaId, data)` no acervo de `usuarioId`
   * (FR-250); ausente é `nao_encontrado`.
   */
  obterCompromisso(
    usuarioId: string,
    rotinaId: string,
    data: string,
  ): Promise<Desfecho<CompromissoPersistido>>;

  /**
   * Devolve os Compromissos de `usuarioId` entre `de` e `ate`, datas
   * YYYY-MM-DD inclusivas, sem ordem prometida (FR-250).
   */
  listarCompromissos(
    usuarioId: string,
    de: string,
    ate: string,
  ): Promise<CompromissoPersistido[]>;

  /**
   * Guarda um Início autorizado no acervo de `usuarioId` (FR-250). Rotina
   * inexistente ou de outro dono é `nao_encontrado`; mesmo `id` de outro
   * Usuário é `conflito`; mesmo `id` do mesmo Usuário devolve o já guardado
   * sem alterar.
   */
  gravarInicio(
    usuarioId: string,
    inicio: InicioAutorizado,
  ): Promise<Desfecho<InicioAutorizado>>;

  /**
   * Devolve o Início de `id` no acervo de `usuarioId` (FR-250); ausente —
   * inclusive quando é de outro Usuário — é `nao_encontrado`.
   */
  obterInicio(
    usuarioId: string,
    id: string,
  ): Promise<Desfecho<InicioAutorizado>>;

  /**
   * Numa **única transação** serializada por Usuário, guarda o Registro de uma
   * Sessão iniciada pela Agenda, aplica os Agendamentos calculados por
   * `calcular` sobre o estado lido na mesma transação e conclui o Compromisso
   * (FR-233, FR-235, FR-256).
   *
   * Reenvio do mesmo `registro.id` pelo mesmo Usuário devolve o Registro
   * guardado com `novo: false`, sem recalcular nem gravar nada; `id` de outro
   * Usuário é `conflito`. O Compromisso `concluido` já guardado nunca é
   * substituído (o primeiro Registro permanece); `cancelado` passa a
   * `concluido`; ausente é inserido. Falha de qualquer gravação desfaz tudo e
   * chega como `indisponivel`.
   */
  inserirRegistroDaAgenda(
    usuarioId: string,
    registro: RegistroDeSessao,
    compromisso: CompromissoPersistido,
    calcular: CalculoDeAgendamentos,
  ): Promise<Desfecho<{ registro: RegistroDeSessao; novo: boolean }>>;
}
