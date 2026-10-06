import { randomUUID } from "node:crypto";

import type {
  Agendamento,
  ArmazenamentoDoAcervo,
  Baralho,
  Cartao,
  CartaoComDono,
  CompromissoPersistido,
  ItemRegistrado,
  Preferencias,
  RegistroDeSessao,
  RegistroResumido,
} from "../armazenamento/porta.ts";
import {
  ALGORITMOS,
  algoritmoPorId,
  previa,
  rotuloDaAvaliacao,
} from "../repeticao/algoritmo.ts";
import type {
  AlgoritmoDeRepeticao,
  Avaliacao,
  EstadoDoAgendamento,
} from "../repeticao/algoritmo.ts";
import { aplicarAvaliacoes, reconstruir } from "../repeticao/revisao.ts";
import {
  LIMITE_DE_CARACTERES_DE_CARTAO,
  normalizarFrente,
  numerarFrente,
  validarFrente,
  validarNomeDeBaralho,
  validarVerso,
} from "./invariantes.ts";
import { criarAgenda } from "../agenda/agenda.ts";
import type {
  DadosDeInicio,
  DadosDeRotina,
  ResultadoDeIniciarCompromisso,
  ResultadoDeListarRotinas,
  ResultadoDeObterAgenda,
  ResultadoDeSalvarRotina,
} from "../agenda/agenda.ts";
import type {
  CodigoDeErroDeBaralho,
  CodigoDeErroDeCartao,
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
 * A Avaliação em quatro níveis é vocabulário **compartilhado** entre o Module
 * de repetição e o Histórico, e o `Acervo` a re-exporta para que quem o consome
 * não precise importar o Module de algoritmo diretamente (FR-192).
 */
export type { Avaliacao };

/**
 * Os tipos públicos da Agenda (FR-248, FR-250) são reexportados na Interface do
 * `Acervo`, como os tipos da Porta e da repetição: quem consome o acervo não
 * precisa importar o Module `Agenda` diretamente.
 */
export type {
  AcaoDeRotina,
  CodigoDeErroDeAgenda,
  CompromissoDeEstudo,
  DadosDeInicio,
  DadosDeRotina,
  EstadoDaRotinaPublico,
  EstadoDoCompromisso,
  FalhaDeAgenda,
  InicioDeCompromisso,
  ResultadoDeIniciarCompromisso,
  ResultadoDeListarRotinas,
  ResultadoDeObterAgenda,
  ResultadoDeSalvarRotina,
  RotinaDeEstudo,
  SemanaDaAgenda,
} from "../agenda/tipos.ts";

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
      erro: CodigoDeErroDeCartao | "nao_encontrado" | "indisponivel";
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
 * Dados brutos recebidos por `salvarSelecaoComoBaralho` para criar um Baralho
 * a partir de uma seleção de Cartões (FR-371–FR-374).
 *
 * - `id`: UUID gerado pelo cliente **uma vez por tentativa de salvar** e
 *   reenviado em novas tentativas; é o que torna o gesto idempotente.
 * - `nome`: regras vigentes de Baralho (não vazio após aparar, até 100
 *   caracteres); nomes repetidos são permitidos.
 * - `cartaoIds`: de 1 a 1.000 strings não vazias e sem repetição.
 *
 * Os campos são `unknown` de propósito: a validação da forma é
 * responsabilidade do Acervo, não do chamador.
 */
export interface DadosDeSelecaoParaBaralho {
  id: unknown;
  nome: unknown;
  cartaoIds: unknown;
}

/**
 * Resultado de `salvarSelecaoComoBaralho` (FR-371–FR-374).
 *
 * - `{ ok: true, baralho, novo }`: `novo` é `true` quando o Baralho e os
 *   Vínculos foram gravados agora; `false` no reenvio do mesmo `id` pelo mesmo
 *   Usuário, sem gravar nada de novo (FR-372).
 * - `{ ok: false, erro: CodigoDeErroDeBaralho, mensagem }`: nome inválido, com
 *   as mensagens de Baralho vigentes.
 * - `{ ok: false, erro: "dados_invalidos" }`: corpo fora da forma — `id` que
 *   não é UUID, `nome` que não é string, `cartaoIds` vazio, repetido, não-lista
 *   ou com mais de 1.000 ids (FR-373).
 * - `{ ok: false, erro: "cartoes_indisponiveis", cartaoIds }`: algum Cartão não
 *   existe ou é de outro Usuário; nada é gravado e a lista devolve apenas os
 *   ids enviados pelo cliente (FR-374).
 * - `{ ok: false, erro: "conflito" }`: o `id` já pertence a outro Usuário.
 * - `{ ok: false, erro: "indisponivel", mensagem }`: falha do armazenamento;
 *   nada é gravado parcialmente.
 */
export type ResultadoDeSalvarSelecao =
  | { ok: true; baralho: Baralho; novo: boolean }
  | { ok: false; erro: CodigoDeErroDeBaralho; mensagem: string }
  | { ok: false; erro: "dados_invalidos" }
  | { ok: false; erro: "cartoes_indisponiveis"; cartaoIds: string[] }
  | { ok: false; erro: "conflito" }
  | { ok: false; erro: "indisponivel"; mensagem: string };

/**
 * Cartão com seus Baralhos legados para a transição (FR-397).
 */
export interface CartaoDaTransicao extends Cartao {
  baralhos: Baralho[];
}

/**
 * Resultado de `obterTransicao` (FR-397).
 */
export type ResultadoDeObterTransicao =
  | {
      ok: true;
      cartoes: CartaoDaTransicao[];
      baralhos: Baralho[];
    }
  | { ok: false; erro: "indisponivel"; mensagem: string };

/**
 * Resultado de `concluirTransicao` (FR-397).
 */
export type ResultadoDeConcluirTransicao =
  | { ok: true }
  | {
      ok: false;
      erro: "escolhas_invalidas" | "conflito" | "indisponivel";
      mensagem: string;
    };

/**
 * Cartão como devolvido por `listarCartoes`: o Cartão com o seu único Baralho
 * dono (Pertencimento) e a próxima revisão do seu Agendamento (FR-389).
 * `criarCartao` continua devolvendo apenas `Cartao`, sem carregar campos que a
 * criação não exige.
 */
export interface CartaoListado extends Cartao {
  baralho: Baralho;
  /**
   * ISO-8601 da próxima revisão do Agendamento do Cartão, ou `null` sem
   * Agendamento (FR-352); só Agendamentos do dono (FR-359).
   */
  proximaRevisaoEm: string | null;
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
 * derivada, os Cartões vinculados e a quantidade de Agendamentos dos Cartões
 * do Baralho (FR-402).
 */
export interface BaralhoComCartoes extends Baralho {
  elegivel: boolean;
  cartoes: Cartao[];
  quantidadeDeAgendamentos: number;
}

/**
 * Resultado de `obterBaralho`. Sucesso devolve o Baralho com seus Cartões;
 * Baralho inexistente é recusado como `nao_encontrado`.
 */
export type ResultadoDeObterBaralho =
  | { ok: true; baralho: BaralhoComCartoes }
  | {
      ok: false;
      erro: "nao_encontrado" | "indisponivel";
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
 * A `origem` diz se a Sessão veio do estudo livre por Baralho (`"baralho"`),
 * da Revisão do dia (`"revisao"`) ou do estudo temporário (`"temporario"`); em
 * `"revisao"` e `"temporario"`, `baralhoId` e `nomeDoBaralho` são ignorados e
 * derivados (D5, FR-196, FR-369). Cada Item traz a Frente, o Verso, o Cartão de
 * origem e a Avaliação em quatro níveis — o Resultado é **derivado** dela
 * (FR-193, FR-194).
 *
 * A validação vive aqui, e não na rota: a mesma Interface de domínio serve a
 * qualquer entrada, e o transporte HTTP continua sendo só transporte (FR-046).
 */
export interface DadosDeRegistro {
  id: unknown;
  origem: unknown;
  baralhoId: unknown;
  nomeDoBaralho: unknown;
  itens: unknown;
  /**
   * Identificador do Início autorizado pela Agenda (FR-254). Quando presente, o
   * Registro é a conclusão **daquela** Sessão: `id` precisa ser igual a ele,
   * Frente, Verso e nome do Baralho vêm do snapshot do servidor, o conjunto de
   * Cartões precisa ser exatamente o autorizado, e só as Avaliações vêm do
   * cliente.
   */
  inicioAgendaId?: unknown;
}

/**
 * Resultado de `registrarSessao`. Como o registro é reenviável, a recusa
 * distingue três situações que o caller trata de modo diferente (FR-163,
 * FR-164, FR-166):
 *
 * - `dados_invalidos`: o corpo não descreve um Registro de sessão válido —
 *   identificador fora da forma UUID, Origem desconhecida, Baralho sem
 *   identificação ou nome fora dos limites na Sessão de Baralho, lista de
 *   Itens vazia ou grande demais, Item sem Cartão de origem ou com Avaliação
 *   fora dos quatro níveis, ou Frente e Verso fora das regras do Cartão. Nada
 *   foi gravado;
 * - `conflito`: o `id` já pertence a um registro de **outro** Usuário. Nada foi
 *   gravado, e o registro alheio continua invisível para quem tentou (FR-166);
 * - `indisponivel`: o armazenamento falhou. O Resumo continua visível e a
 *   pessoa pode registrar de novo com o mesmo conteúdo (FR-164).
 */
export type ResultadoDeRegistroDeSessao =
  | {
      ok: true;
      registro: RegistroDeSessao;
      /**
       * `true` quando este envio criou o Registro; `false` no reenvio do mesmo
       * `id`, que devolve o já guardado. É a Porta quem diz (`novo`), e não a
       * comparação de datas, que dependeria do relógio.
       */
      criada: boolean;
    }
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

/** Algoritmo oferecido na tela de Preferências: identificador e rótulo (FR-212). */
export interface OpcaoDeAlgoritmo {
  id: string;
  rotulo: string;
  opcoesDeAvaliacao: { chave: string; rotulo: string; resultado: "acertou" | "errou" }[];
}

/**
 * Preferências de repetição do Usuário como a Interface as devolve: o
 * algoritmo escolhido, mais a lista de algoritmos disponíveis para a tela de
 * Preferências (FR-212).
 */
export interface PreferenciasDoUsuario {
  algoritmo: string;
  algoritmos: OpcaoDeAlgoritmo[];
}

/**
 * Resultado de `obterPrevias`: a prévia por Cartão informado que ainda existe
 * no acervo do Usuário. Identificador que não é Cartão do Usuário é **omitido**
 * do resultado, e não recusado (FR-210, FR-221).
 */
export type ResultadoDasPrevias =
  | { ok: true; previas: Record<string, Record<Avaliacao, string>> }
  | { ok: false; erro: "dados_invalidos" | "indisponivel" };

/**
 * Resultado de `obterPreferencias`: as Preferências do Usuário já com a lista
 * de algoritmos, ou `indisponivel` quando o armazenamento falhou (FR-212).
 */
export type ResultadoDeObterPreferencias =
  | { ok: true; preferencias: PreferenciasDoUsuario }
  | { ok: false; erro: "indisponivel" };

/**
 * Resultado de `salvarPreferencias`: as Preferências salvas no mesmo formato
 * de `obterPreferencias`. `dados_invalidos` quando o algoritmo não está
 * disponível ou o limite não é inteiro de 0 a 999; `indisponivel` quando o
 * armazenamento falhou, sem apresentar a gravação como concluída (FR-200,
 * FR-212).
 */
export type ResultadoDeSalvarPreferencias =
  | { ok: true; preferencias: PreferenciasDoUsuario }
  | { ok: false; erro: "dados_invalidos" | "indisponivel" };

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
  criarCartao(
    baralhoId: string,
    dados: DadosDeCartao,
  ): Promise<ResultadoDeCriacaoDeCartao>;

  /**
   * Cria um Baralho com o nome informado. Nome vazio ou composto só de
   * espaços é recusado como `nome_vazio` (FR-011); mais de 100 caracteres,
   * como `nome_muito_longo` (FR-061). O nome é rótulo, não identificador:
   * dois Baralhos de mesmo nome são ambos aceitos (FR-012).
   */
  criarBaralho(dados: DadosDeBaralho): Promise<ResultadoDeCriacaoDeBaralho>;

  /**
   * Salva uma seleção de Cartões como um Baralho novo, num gesto único
   * (FR-371–FR-374).
   *
   * Baralho e Vínculos são gravados numa única transação: ou tudo, ou nada.
   * O `id` é o UUID da tentativa de salvar: reenviá-lo devolve o mesmo Baralho
   * com `novo: false`, sem duplicar nada (FR-372). Seleção fora da forma
   * devolve `dados_invalidos` (FR-373); Cartão inexistente ou alheio devolve
   * `cartoes_indisponiveis` com os ids enviados, sem gravar nada e sem alterar
   * Cartões, Vínculos anteriores ou Agendamentos (FR-374).
   */
  salvarSelecaoComoBaralho(
    dados: DadosDeSelecaoParaBaralho,
  ): Promise<ResultadoDeSalvarSelecao>;

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
   * Exclui um Cartão existente (FR-007, FR-401). O Pertencimento e o
   * Agendamento do Cartão caem pela cascata do esquema; os Registros de
   * sessão ficam intactos. Cartão inexistente é recusado como `nao_encontrado`.
   */
  excluirCartao(id: string): Promise<ResultadoDeExclusaoDeCartao>;

  /**
   * Exclui um Baralho existente (FR-402). Os Pertencimentos dos Cartões do
   * Baralho caem pela cascata do esquema, assim como os seus Agendamentos;
   * os Cartões são preservados; os Registros de sessão ficam intactos.
   * Baralho inexistente é recusado como `nao_encontrado`.
   */
  excluirBaralho(id: string): Promise<ResultadoDeExclusaoDeBaralho>;

  /**
   * Obtém o estado da transição de Cartões legados (FR-397): Cartões pendentes
   * com múltiplos Baralhos legados (exigem escolha do Usuário) e a lista de
   * Baralhos disponíveis para destino.
   */
  obterTransicao(): Promise<ResultadoDeObterTransicao>;

  /**
   * Conclui a transição de Cartões legados (FR-397): resolve os pendentes com
   * uma única Frente distribuindo-os entre Baralhos (Pertencimento) e criando
   * cópias nos outros Baralhos legados.
   */
  concluirTransicao(dados: unknown): Promise<ResultadoDeConcluirTransicao>;

  /**
   * Registra a Sessão **concluída** no Histórico do usuário do `Acervo` e
   * aplica as Avaliações aos Agendamentos dos Cartões, na mesma transação
   * (FR-161, FR-210). A Sessão interrompida continua sem rastro: só quem
   * conclui chega aqui, e recusa nenhuma grava pela metade (FR-162, FR-164).
   *
   * O corpo vem cru e é validado nesta Interface: identificador na forma
   * canônica de UUID — é ele que dá a idempotência —, Origem `"baralho"` ou
   * `"revisao"`, de 1 a 1000 Itens, cada um com Frente e Verso válidos como
   * Cartão, Cartão de origem identificado e Avaliação em um dos quatro níveis.
   * `estudados`, `acertos`, `erros`, o `resultado` de cada Item e a `posicao`
   * são **derivados**, de modo que o caller não consegue produzir totais que
   * não batam com a lista (FR-161, FR-194). O Baralho não precisa existir: o
   * nome é guardado como era (FR-165).
   *
   * O instante de conclusão é definido na primeira gravação: reenviar o mesmo
   * registro devolve o registro guardado, sem duplicá-lo, sem mudar a data e
   * **sem reaplicar** as Avaliações (FR-163, FR-210, SC-085).
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

  /**
   * Devolve, para cada Cartão informado que pertence ao Usuário, a prévia da
   * próxima revisão nos quatro níveis de Avaliação (FR-221) — o insumo dos
   * botões do estudo livre.
   *
   * `cartaoIds` é uma lista de 1 a 200 identificadores não vazios; um
   * identificador que não é Cartão do Usuário é **omitido** do resultado, e não
   * recusado (FR-219).
   */
  obterPrevias(cartaoIds: unknown): Promise<ResultadoDasPrevias>;

  /**
   * Devolve as Preferências de repetição do Usuário com a lista de algoritmos
   * disponíveis para a tela (FR-212).
   */
  obterPreferencias(): Promise<ResultadoDeObterPreferencias>;

  /**
   * Salva as Preferências de repetição do Usuário (FR-212). Trocar o algoritmo
   * reconstrói **todos** os Agendamentos por replay do Histórico, sem perder
   * registro algum (FR-213, SC-083).
   *
   * O algoritmo precisa estar disponível e o limite precisa ser inteiro de 0 a
   * 999 — sendo **0** o "não introduzir Cartões novos" (FR-200); fora disso,
   * `dados_invalidos`.
   */
  salvarPreferencias(dados: unknown): Promise<ResultadoDeSalvarPreferencias>;

  /**
   * Devolve a Semana da Agenda (FR-248): as ocorrências das Rotinas entre
   * `inicio` e `inicio + 6`, mais o `hoje` no fuso pedido. `inicio` precisa ser
   * data civil válida e segunda-feira, e `fuso` precisa ser IANA.
   */
  obterAgenda(inicio: string, fuso: string): Promise<ResultadoDeObterAgenda>;

  /**
   * Lista as Rotinas de estudo do Usuário (FR-248): ativas e pausadas na ordem
   * criadaEm/id, omitindo as excluídas.
   */
  listarRotinas(): Promise<ResultadoDeListarRotinas>;

  /**
   * Grava uma Rotina de estudo (FR-248): cria, edita, pausa, retoma ou exclui
   * conforme a ação, com idempotência por `operacaoId` e concorrência otimista
   * por `versao`. `criada` é `true` quando a Rotina foi criada agora.
   */
  salvarRotina(dados: DadosDeRotina): Promise<ResultadoDeSalvarRotina>;

  /**
   * Autoriza o início de um Compromisso (FR-250): seleciona os Cartões no
   * servidor e devolve o Início de estudo. `data` precisa ser data civil
   * válida e `fuso` precisa ser IANA.
   */
  iniciarCompromisso(
    dados: DadosDeInicio,
  ): Promise<ResultadoDeIniciarCompromisso>;
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

const FRENTE_DUPLICADA = {
  erro: "frente_duplicada",
  mensagem: "Já existe um cartão com esta frente neste baralho.",
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

/** Rótulo do Baralho derivado na Sessão de Revisão do dia (D5, FR-196). */
const NOME_DA_REVISAO_DO_DIA = "Revisão do dia";

/** Rótulo do Baralho derivado na Sessão de estudo temporário (FR-369). */
const NOME_DO_BARALHO_TEMPORARIO = "Baralho temporário";

/** Quantidade máxima de identificadores numa consulta de prévias (FR-221). */
const LIMITE_DE_CARTOES_PARA_PREVIA = 200;

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

/** `true` para um dos quatro níveis de Avaliação do contrato (FR-193). */
function ehAvaliacao(valor: unknown): valor is Avaliacao {
  return (
    valor === "errei" ||
    valor === "dificil" ||
    valor === "bom" ||
    valor === "facil"
  );
}

/**
 * Resultado derivado da Avaliação (FR-194): `errei` vira `errou`; os outros
 * três níveis contam como acerto. O cliente nunca envia o Resultado.
 */
function resultadoDaAvaliacao(avaliacao: Avaliacao): "acertou" | "errou" {
  return avaliacao === "errei" ? "errou" : "acertou";
}

/** `true` para objeto não nulo — a forma que um Item decodificado pode ter. */
function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

/**
 * Interpreta um Item cru do corpo, com a `posicao` da ordem apresentada —
 * nunca informada pelo cliente (FR-161).
 *
 * Devolve `null` quando Frente, Verso, Cartão de origem ou Avaliação não
 * passam nas regras vigentes: as de conteúdo são as mesmas da criação e da
 * edição (FR-002, FR-051, FR-052), o `cartaoId` precisa ser uma string não
 * vazia e a Avaliação precisa estar entre os quatro níveis (FR-193). O
 * Resultado é **derivado** da Avaliação (FR-194), e não vem do cliente.
 */
function interpretarItem(
  valor: unknown,
  posicao: number,
): ItemRegistrado | null {
  if (!ehObjeto(valor)) {
    return null;
  }

  const { frente, verso, cartaoId, avaliacao } = valor;

  if (typeof frente !== "string" || validarFrente(frente) !== null) {
    return null;
  }

  if (typeof verso !== "string" || validarVerso(verso) !== null) {
    return null;
  }

  if (typeof cartaoId !== "string" || cartaoId.trim().length === 0) {
    return null;
  }

  if (!ehAvaliacao(avaliacao)) {
    return null;
  }

  return {
    posicao,
    frente,
    verso,
    resultado: resultadoDaAvaliacao(avaliacao),
    cartaoId,
    avaliacao,
    avaliacaoRotulo: rotuloDaAvaliacao(avaliacao),
  };
}

/**
 * Interpreta o corpo cru como Registro de sessão, derivando `estudados`,
 * `acertos`, `erros`, o `resultado` de cada Item e a `posicao`, e datando a
 * conclusão com `agora` (FR-161, FR-163, FR-194).
 *
 * A `origem` decide o Baralho: em `"revisao"`, `baralhoId` e `nomeDoBaralho`
 * são **derivados** para `""` e `"Revisão do dia"`, ignorando o que o cliente
 * mandar (D5, FR-196); em `"temporario"`, do mesmo modo, para `""` e `"Baralho
 * temporário"` (FR-369); em `"baralho"`, valem as regras da `013` — Baralho
 * identificado e nome dentro dos limites vigentes. O Baralho **não** precisa
 * existir: o registro guarda o nome como era, e o Baralho pode ter sido
 * excluído antes mesmo de a Sessão ser registrada (FR-165, FR-178).
 *
 * Devolve `null` — recusa `dados_invalidos` — quando qualquer invariante do
 * contrato falha.
 */
function interpretarRegistro(
  dados: DadosDeRegistro,
  agora: Date,
): RegistroDeSessao | null {
  const { id, origem, baralhoId, nomeDoBaralho, itens } = dados;

  if (typeof id !== "string" || !IDENTIFICADOR_UNICO_UNIVERSAL.test(id)) {
    return null;
  }

  if (
    origem !== "baralho" &&
    origem !== "revisao" &&
    origem !== "temporario"
  ) {
    return null;
  }

  let baralhoDoRegistro: string;
  let nomeDoBaralhoDoRegistro: string;

  if (origem === "revisao") {
    baralhoDoRegistro = "";
    nomeDoBaralhoDoRegistro = NOME_DA_REVISAO_DO_DIA;
  } else if (origem === "temporario") {
    baralhoDoRegistro = "";
    // Se nomeDoBaralho não for string ou vazio após trim, usar o padrão
    if (
      typeof nomeDoBaralho !== "string" ||
      nomeDoBaralho.trim().length === 0
    ) {
      nomeDoBaralhoDoRegistro = NOME_DO_BARALHO_TEMPORARIO;
    } else {
      // Validar o nome como seria para Baralho normal
      if (validarNomeDeBaralho(nomeDoBaralho) !== null) {
        return null; // dados_invalidos
      }
      nomeDoBaralhoDoRegistro = nomeDoBaralho.trim();
    }
  } else {
    if (typeof baralhoId !== "string" || baralhoId.trim().length === 0) {
      return null;
    }

    if (
      typeof nomeDoBaralho !== "string" ||
      validarNomeDeBaralho(nomeDoBaralho) !== null
    ) {
      return null;
    }

    baralhoDoRegistro = baralhoId;
    nomeDoBaralhoDoRegistro = nomeDoBaralho;
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
    baralhoId: baralhoDoRegistro,
    nomeDoBaralho: nomeDoBaralhoDoRegistro,
    origem,
    concluidaEm: agora.toISOString(),
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
 * Interpreta `cartaoIds` de uma seleção: lista de 1 a
 * `LIMITE_DE_ITENS_REGISTRADOS` strings que sobram não vazias depois de
 * `trim()`, sem repetição. Devolve os ids aparados, na ordem recebida, ou
 * `null` quando a forma não é aceita (não-lista, vazia, grande demais, item
 * não-string, item vazio ou id repetido) — FR-373.
 */
function interpretarCartaoIdsDaSelecao(valor: unknown): string[] | null {
  if (!Array.isArray(valor)) {
    return null;
  }

  if (valor.length === 0 || valor.length > LIMITE_DE_ITENS_REGISTRADOS) {
    return null;
  }

  const vistos = new Set<string>();
  const cartaoIds: string[] = [];

  for (const item of valor) {
    if (typeof item !== "string") {
      return null;
    }

    const cartaoId = item.trim();

    if (cartaoId.length === 0 || vistos.has(cartaoId)) {
      return null;
    }

    vistos.add(cartaoId);
    cartaoIds.push(cartaoId);
  }

  return cartaoIds;
}

/**
 * Interpreta a lista crua de identificadores de Cartão de `obterPrevias`.
 *
 * Devolve `null` quando não é uma lista de 1 a 200 strings não vazias
 * (FR-221). A ordem é preservada, e quem chama omite os identificadores que não
 * são Cartões do Usuário.
 */
function interpretarCartaoIds(valor: unknown): string[] | null {
  if (
    !Array.isArray(valor) ||
    valor.length === 0 ||
    valor.length > LIMITE_DE_CARTOES_PARA_PREVIA
  ) {
    return null;
  }

  const ids: string[] = [];

  for (const id of valor) {
    if (typeof id !== "string" || id.trim().length === 0) {
      return null;
    }

    ids.push(id);
  }

  return ids;
}

/**
 * Interpreta o corpo cru de `salvarPreferencias`.
 *
 * Devolve `null` quando o `algoritmo` não está no registro disponível
 * (FR-212).
 */
function interpretarPreferencias(
  valor: unknown,
  algoritmos: ReadonlyMap<string, AlgoritmoDeRepeticao>,
): Preferencias | null {
  if (!ehObjeto(valor)) {
    return null;
  }

  const { algoritmo } = valor;

  if (typeof algoritmo !== "string" || !algoritmos.has(algoritmo)) {
    return null;
  }

  return { algoritmo };
}

/**
 * Estado opaco do Agendamento como o algoritmo o lê; `null` = Cartão novo
 * (FR-188). Espelha o `estadoDoAgendamento` do Module de orquestração, que não
 * é exportado.
 */
function estadoDoAgendamento(
  agendamento: Agendamento | null,
): EstadoDoAgendamento | null {
  if (agendamento === null) {
    return null;
  }

  return {
    algoritmo: agendamento.algoritmo,
    versao: agendamento.versaoDoAlgoritmo,
    dados: agendamento.estado,
  };
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
  /**
   * Ponto único de injeção de dependência do Module, usado pelos testes para
   * exercitar a troca de algoritmo com um algoritmo não registrado em
   * `ALGORITMOS` (FR-191, FR-213). A produção não informa nada: o padrão é
   * `ALGORITMOS`.
   */
  opcoes: {
    algoritmos?: ReadonlyMap<string, AlgoritmoDeRepeticao>;
    /** Relógio injetável para os testes; padrão `() => new Date()`. Vale para a Agenda, as Estatísticas, o registro de Sessões e a Revisão do dia. */
    agora?: () => Date;
  } = {},
): Acervo {
  const algoritmos = opcoes.algoritmos ?? ALGORITMOS;
  /** O instante de agora: toda decisão que depende de «hoje» passa por aqui. */
  const relogio = opcoes.agora ?? (() => new Date());

  /**
   * O Module `Agenda` (FR-248, FR-250) recebe a mesma Porta e o mesmo dono do
   * `Acervo`, além do relógio injetável das opções, para que a projeção da
   * semana e a eleição de `hoje` sejam testáveis junto do restante do acervo.
   */
  const agenda = criarAgenda(armazenamento, usuarioId, { agora: opcoes.agora });

  /**
   * Resolve o algoritmo pelo identificador no registro disponível — o injetado
   * quando houver, `ALGORITMOS` caso contrário. Desconhecido ou removido cai no
   * padrão (FR-191), como `algoritmoPorId` faz para o registro global.
   */
  function resolverAlgoritmo(id: string): AlgoritmoDeRepeticao {
    return algoritmos.get(id) ?? algoritmoPorId(id);
  }

  /** As opções de algoritmo que a tela de Preferências exibe (FR-212). */
  function opcoesDeAlgoritmo(): OpcaoDeAlgoritmo[] {
    return [...algoritmos.values()].map((algoritmo) => ({
      id: algoritmo.id,
      rotulo: algoritmo.rotulo,
      opcoesDeAvaliacao: algoritmo.opcoesDeAvaliacao.map((opcao) => ({
        chave: opcao.chave,
        rotulo: opcao.rotulo,
        resultado: opcao.resultado,
      })),
    }));
  }

  /**
   * Resolve automaticamente os Cartões pendentes com exatamente um Baralho
   * legado (FR-397).
   */
  async function resolverAutomaticos(): Promise<boolean> {
    const pendentesRaw = await armazenamento.listarCartoesPendentes(usuarioId);

    if (!pendentesRaw.ok) {
      return false;
    }

    const pendentes = pendentesRaw.valor;
    const paraSolver = pendentes.filter((p) => p.baralhos.length === 1);

    if (paraSolver.length === 0) {
      return true;
    }

    // Ordena por normalizarFrente e depois por id
    const ordenados = paraSolver.sort((a, b) => {
      const chavea = normalizarFrente(a.cartao.frente);
      const chaveb = normalizarFrente(b.cartao.frente);
      if (chavea !== chaveb) {
        return chavea.localeCompare(chaveb);
      }
      return a.cartao.id.localeCompare(b.cartao.id);
    });

    const pertencimentos: Array<{ cartaoId: string; baralhoId: string; frente: string }> = [];
    const chavesAcumuladas = new Map<string, Set<string>>();

    for (const pendente of ordenados) {
      const baralhoId = pendente.baralhos[0].id;
      const cartoesDoBaralho = await armazenamento.listarCartoesDoBaralho(
        usuarioId,
        baralhoId,
      );

      let chavesUsadas = chavesAcumuladas.get(baralhoId);
      if (!chavesUsadas) {
        chavesUsadas = new Set(
          cartoesDoBaralho.map((c) => normalizarFrente(c.frente)),
        );
        chavesAcumuladas.set(baralhoId, chavesUsadas);
      }

      const frenteFinal = numerarFrente(pendente.cartao.frente, chavesUsadas);
      chavesUsadas.add(normalizarFrente(frenteFinal));

      pertencimentos.push({
        cartaoId: pendente.cartao.id,
        baralhoId,
        frente: frenteFinal,
      });
    }

    // Uma corrida com outra resolução (`conflito`) não é falha: a releitura
    // seguinte encontra o estado já resolvido.
    const aplicado = await armazenamento.aplicarTransicao(usuarioId, {
      pertencimentos,
      copias: [],
    });

    return aplicado.ok || aplicado.erro === "conflito";
  }

  /**
   * Conclui a Sessão iniciada pela Agenda (FR-233–FR-236, FR-254, FR-256).
   *
   * Tudo o que prova a Sessão vem do **Início autorizado** guardado no
   * servidor: o `id` do Registro é o do Início; Baralho, nome, Frente e Verso
   * vêm do snapshot; o conjunto de Cartões precisa ser exatamente o autorizado,
   * sem repetição; só as Avaliações vêm do cliente. O limite legado de 1000
   * Itens não vale aqui — o máximo é o snapshot. Registro, Agendamentos (a
   * partir do estado lido na mesma transação) e conclusão do Compromisso são
   * gravados juntos pela Porta.
   */
  async function registrarSessaoDaAgenda(
    dados: DadosDeRegistro,
    agora: Date,
  ): Promise<ResultadoDeRegistroDeSessao> {
    const { id, origem, baralhoId, itens, inicioAgendaId } = dados;

    if (
      typeof id !== "string" ||
      !IDENTIFICADOR_UNICO_UNIVERSAL.test(id) ||
      typeof inicioAgendaId !== "string" ||
      id !== inicioAgendaId ||
      origem !== "baralho" ||
      !Array.isArray(itens)
    ) {
      return { ok: false, ...DADOS_INVALIDOS };
    }

    const lido = await armazenamento.obterInicio(usuarioId, inicioAgendaId);

    if (!lido.ok) {
      return lido.erro === "nao_encontrado"
        ? { ok: false, ...DADOS_INVALIDOS }
        : { ok: false, ...HISTORICO_INDISPONIVEL };
    }

    const inicio = lido.valor;

    if (
      itens.length !== inicio.cartoes.length ||
      (typeof baralhoId === "string" && baralhoId !== inicio.baralhoId)
    ) {
      return { ok: false, ...DADOS_INVALIDOS };
    }

    const avaliacoes = new Map<string, Avaliacao>();

    for (const item of itens) {
      if (
        !ehObjeto(item) ||
        typeof item.cartaoId !== "string" ||
        !ehAvaliacao(item.avaliacao) ||
        avaliacoes.has(item.cartaoId)
      ) {
        return { ok: false, ...DADOS_INVALIDOS };
      }

      avaliacoes.set(item.cartaoId, item.avaliacao);
    }

    const registrados: ItemRegistrado[] = [];

    for (const [posicao, cartao] of inicio.cartoes.entries()) {
      const avaliacao = avaliacoes.get(cartao.id);

      // Cartão fora do conjunto autorizado ou sem Avaliação: a Sessão enviada
      // não é a que foi iniciada (FR-254).
      if (avaliacao === undefined) {
        return { ok: false, ...DADOS_INVALIDOS };
      }

      registrados.push({
        posicao,
        frente: cartao.frente,
        verso: cartao.verso,
        resultado: resultadoDaAvaliacao(avaliacao),
        cartaoId: cartao.id,
        avaliacao,
        avaliacaoRotulo: rotuloDaAvaliacao(avaliacao),
      });
    }

    const acertos = registrados.filter(
      (item) => item.resultado === "acertou",
    ).length;
    const registro: RegistroDeSessao = {
      id: inicio.id,
      baralhoId: inicio.baralhoId,
      nomeDoBaralho: inicio.nomeDoBaralho,
      origem: "baralho",
      concluidaEm: agora.toISOString(),
      estudados: registrados.length,
      acertos,
      erros: registrados.length - acertos,
      itens: registrados,
    };
    const compromisso: CompromissoPersistido = {
      rotinaId: inicio.rotinaId,
      data: inicio.data,
      estado: "concluido",
      registroId: inicio.id,
      baralhoId: inicio.baralhoId,
      nomeDoBaralho: inicio.nomeDoBaralho,
      quantidade: inicio.quantidade,
    };

    const gravado = await armazenamento.inserirRegistroDaAgenda(
      usuarioId,
      registro,
      compromisso,
      ({ agendamentos, preferencias }) =>
        aplicarAvaliacoes(
          agendamentos,
          registrados.flatMap((item) =>
            item.cartaoId != null && item.avaliacao != null
              ? [{ cartaoId: item.cartaoId, avaliacao: item.avaliacao }]
              : [],
          ),
          resolverAlgoritmo(preferencias.algoritmo),
          agora,
        ),
    );

    if (!gravado.ok) {
      return gravado.erro === "conflito"
        ? { ok: false, ...REGISTRO_EM_CONFLITO }
        : { ok: false, ...HISTORICO_INDISPONIVEL };
    }

    return {
      ok: true,
      registro: gravado.valor.registro,
      criada: gravado.valor.novo,
    };
  }

  return {
    async criarCartao(baralhoId, dados) {
      const falha = validarFrente(dados.frente) ?? validarVerso(dados.verso);

      if (falha !== null) {
        return { ok: false, ...falha };
      }

      const encontrado = await armazenamento.obterBaralho(usuarioId, baralhoId);

      if (!encontrado.ok) {
        if (encontrado.erro === "nao_encontrado") {
          return { ok: false, ...BARALHO_NAO_ENCONTRADO };
        }
        return { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      const cartoesDoBaralho = await armazenamento.listarCartoesDoBaralho(
        usuarioId,
        baralhoId,
      );

      const chavesOcupadas = new Set(
        cartoesDoBaralho.map((c) => normalizarFrente(c.frente)),
      );
      let frente = numerarFrente(dados.frente, chavesOcupadas);

      if (frente.length > LIMITE_DE_CARACTERES_DE_CARTAO) {
        return {
          ok: false,
          erro: "frente_muito_longa",
          mensagem: `A frente do cartão, após numeração, excederia ${LIMITE_DE_CARACTERES_DE_CARTAO} caracteres.`,
        };
      }

      let tentativas = 0;

      while (tentativas < 3) {
        tentativas++;

        const cartao: Cartao = {
          id: randomUUID(),
          frente,
          verso: dados.verso,
        };

        const gravado = await armazenamento.inserirCartaoNoBaralho(
          usuarioId,
          baralhoId,
          cartao,
        );

        if (gravado.ok) {
          return { ok: true, cartao: gravado.valor };
        }

        if (gravado.erro === "frente_duplicada") {
          // Corrida concorrente: relê as chaves e tenta de novo
          const cartoesAtualizados = await armazenamento.listarCartoesDoBaralho(
            usuarioId,
            baralhoId,
          );
          const novasChaves = new Set(
            cartoesAtualizados.map((c) => normalizarFrente(c.frente)),
          );
          frente = numerarFrente(dados.frente, novasChaves);

          if (frente.length > LIMITE_DE_CARACTERES_DE_CARTAO) {
            return {
              ok: false,
              erro: "frente_muito_longa",
              mensagem: `A frente do cartão, após numeração, excederia ${LIMITE_DE_CARACTERES_DE_CARTAO} caracteres.`,
            };
          }

          continue;
        }

        if (gravado.erro === "nao_encontrado") {
          return { ok: false, ...BARALHO_NAO_ENCONTRADO };
        }

        return { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      return { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
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

    async salvarSelecaoComoBaralho(dados) {
      const { id, nome, cartaoIds } = dados;

      if (typeof id !== "string" || !IDENTIFICADOR_UNICO_UNIVERSAL.test(id)) {
        return { ok: false, ...DADOS_INVALIDOS };
      }

      if (typeof nome !== "string") {
        return { ok: false, ...DADOS_INVALIDOS };
      }

      const falhaNoNome = validarNomeDeBaralho(nome);

      if (falhaNoNome !== null) {
        return { ok: false, ...falhaNoNome };
      }

      const cartoesDaSelecao = interpretarCartaoIdsDaSelecao(cartaoIds);

      if (cartoesDaSelecao === null) {
        return { ok: false, ...DADOS_INVALIDOS };
      }

      // a) Verifica se o Baralho já existe (reenvio idempotente)
      const baralhoExistente = await armazenamento.obterBaralho(usuarioId, id);

      if (baralhoExistente.ok) {
        return {
          ok: true,
          baralho: baralhoExistente.valor,
          novo: false,
        };
      }

      // b) Lê os Cartões da seleção e verifica disponibilidade
      const todosOsCartoes = await armazenamento.listarCartoes(usuarioId);
      const cartoesDisponiveisPorId = new Map(
        todosOsCartoes.map((c) => [c.id, c]),
      );

      const indisponiveisNaOrdem: string[] = [];
      const cartoesOrigemNaOrdem: CartaoComDono[] = [];

      for (const cartaoId of cartoesDaSelecao) {
        const cartao = cartoesDisponiveisPorId.get(cartaoId);
        if (!cartao) {
          indisponiveisNaOrdem.push(cartaoId);
        } else {
          cartoesOrigemNaOrdem.push(cartao);
        }
      }

      if (indisponiveisNaOrdem.length > 0) {
        return {
          ok: false,
          erro: "cartoes_indisponiveis",
          cartaoIds: indisponiveisNaOrdem,
        };
      }

      // c) Monta as cópias na ordem da seleção, numerando as frentes
      const copias: Cartao[] = [];
      const chavesJaUsadas = new Set<string>();

      for (const origem of cartoesOrigemNaOrdem) {
        const frente = numerarFrente(
          origem.frente,
          chavesJaUsadas,
        );

        if (frente.length > LIMITE_DE_CARACTERES_DE_CARTAO) {
          return { ok: false, erro: "dados_invalidos" };
        }

        chavesJaUsadas.add(normalizarFrente(frente));

        copias.push({
          id: randomUUID(),
          frente,
          verso: origem.verso,
        });
      }

      // d) Insere o Baralho com as cópias
      const resultado = await armazenamento.inserirBaralhoComCopias(
        usuarioId,
        { id, nome },
        copias,
      );

      if (!resultado.ok) {
        if (resultado.erro === "conflito") {
          return { ok: false, erro: "conflito" };
        }
        return { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      return {
        ok: true,
        baralho: resultado.valor.baralho,
        novo: resultado.valor.novo,
      };
    },

    async listarCartoes() {
      const cartoesComDono = await armazenamento.listarCartoes(usuarioId);

      /**
       * Os Agendamentos do dono são lidos UMA única vez e indexados por Cartão:
       * a próxima revisão de cada Cartão vem do seu Agendamento, e o Cartão sem
       * Agendamento permanece com `null` (FR-352, FR-359).
       */
      const proximaPorCartao = new Map(
        (await armazenamento.listarAgendamentos(usuarioId)).map(
          (agendamento) => [
            agendamento.cartaoId,
            agendamento.proximaRevisaoEm,
          ],
        ),
      );

      return cartoesComDono.map((cartao) => ({
        ...cartao,
        proximaRevisaoEm: proximaPorCartao.get(cartao.id) ?? null,
      }));
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

      const [cartoes, agendamentos] = await Promise.all([
        armazenamento.listarCartoesDoBaralho(usuarioId, id),
        armazenamento.listarAgendamentos(usuarioId),
      ]);

      const quantidadeDeAgendamentosDoBaralho = agendamentos.filter((ag) =>
        cartoes.some((c) => c.id === ag.cartaoId),
      ).length;

      return {
        ok: true,
        baralho: {
          ...encontrado.valor,
          elegivel: cartoes.length > 0,
          cartoes,
          quantidadeDeAgendamentos: quantidadeDeAgendamentosDoBaralho,
        },
      };
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
        if (gravado.erro === "nao_encontrado") {
          return { ok: false, ...CARTAO_NAO_ENCONTRADO };
        }
        if (gravado.erro === "frente_duplicada") {
          return { ok: false, ...FRENTE_DUPLICADA };
        }
        return { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
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

    async obterTransicao() {
      if (!(await resolverAutomaticos())) {
        return { ok: false, erro: "indisponivel", mensagem: ARMAZENAMENTO_INDISPONIVEL.mensagem };
      }

      const pendentesRaw = await armazenamento.listarCartoesPendentes(usuarioId);

      if (!pendentesRaw.ok) {
        return { ok: false, erro: "indisponivel", mensagem: ARMAZENAMENTO_INDISPONIVEL.mensagem };
      }

      const pendentes = pendentesRaw.valor;
      // Avulsos (nenhum Baralho legado) e compartilhados (dois ou mais) exigem escolha.
      const exigemEscolha = pendentes.filter((p) => p.baralhos.length !== 1);

      // Ordena por normalizarFrente e depois por id
      const ordenados = exigemEscolha.sort((a, b) => {
        const chavea = normalizarFrente(a.cartao.frente);
        const chaveb = normalizarFrente(b.cartao.frente);
        if (chavea !== chaveb) {
          return chavea.localeCompare(chaveb);
        }
        return a.cartao.id.localeCompare(b.cartao.id);
      });

      const cartoesDaTransicao: CartaoDaTransicao[] = ordenados.map((p) => ({
        ...p.cartao,
        baralhos: p.baralhos,
      }));

      const todosOsBaralhos = await armazenamento.listarBaralhos(usuarioId);
      const baralhos = todosOsBaralhos.sort((a, b) => a.nome.localeCompare(b.nome));

      return {
        ok: true,
        cartoes: cartoesDaTransicao,
        baralhos,
      };
    },

    async concluirTransicao(dados) {
      if (typeof dados !== "object" || dados === null) {
        return {
          ok: false,
          erro: "escolhas_invalidas",
          mensagem: "Dados inválidos.",
        };
      }

      const { escolhas } = dados as { escolhas?: unknown };

      if (!Array.isArray(escolhas)) {
        return {
          ok: false,
          erro: "escolhas_invalidas",
          mensagem: "Escolhas deve ser uma lista.",
        };
      }

      const resolvidos = await resolverAutomaticos();
      const pendentesRaw = await armazenamento.listarCartoesPendentes(usuarioId);

      if (!resolvidos || !pendentesRaw.ok) {
        return {
          ok: false,
          erro: "indisponivel",
          mensagem: ARMAZENAMENTO_INDISPONIVEL.mensagem,
        };
      }

      const pendentes = pendentesRaw.valor;

      if (pendentes.length === 0) {
        return { ok: true };
      }

      // Valida a forma das escolhas
      const escolhasMap = new Map<string, string>();

      for (const escolha of escolhas) {
        if (typeof escolha !== "object" || escolha === null) {
          return {
            ok: false,
            erro: "escolhas_invalidas",
            mensagem: "Cada escolha deve ser um objeto.",
          };
        }

        const { cartaoId, baralhoId } = escolha as { cartaoId?: unknown; baralhoId?: unknown };

        if (typeof cartaoId !== "string" || typeof baralhoId !== "string") {
          return {
            ok: false,
            erro: "escolhas_invalidas",
            mensagem: "Cartão e baralho devem ser strings.",
          };
        }

        if (escolhasMap.has(cartaoId)) {
          return {
            ok: false,
            erro: "escolhas_invalidas",
            mensagem: "Cartão repetido nas escolhas.",
          };
        }

        escolhasMap.set(cartaoId, baralhoId);
      }

      // Valida que há exatamente uma escolha por pendente
      // Avulsos (nenhum Baralho legado) e compartilhados (dois ou mais) exigem escolha.
      const exigemEscolha = pendentes.filter((p) => p.baralhos.length !== 1);

      if (escolhasMap.size !== exigemEscolha.length) {
        return {
          ok: false,
          erro: "escolhas_invalidas",
          mensagem: `Esperado ${exigemEscolha.length} escolhas, obtido ${escolhasMap.size}.`,
        };
      }

      // Valida que todos os ids nas escolhas correspondem a pendentes
      for (const cartaoId of escolhasMap.keys()) {
        if (!exigemEscolha.some((p) => p.cartao.id === cartaoId)) {
          return {
            ok: false,
            erro: "escolhas_invalidas",
            mensagem: `Cartão ${cartaoId} não está pendente.`,
          };
        }
      }

      // Monta o plano de transição
      const todosOsBaralhos = await armazenamento.listarBaralhos(usuarioId);
      const baralhosPorId = new Map(todosOsBaralhos.map((b) => [b.id, b]));

      // Ordena os pendentes para processamento
      const ordenados = exigemEscolha.sort((a, b) => {
        const chavea = normalizarFrente(a.cartao.frente);
        const chaveb = normalizarFrente(b.cartao.frente);
        if (chavea !== chaveb) {
          return chavea.localeCompare(chaveb);
        }
        return a.cartao.id.localeCompare(b.cartao.id);
      });

      const pertencimentos: Array<{ cartaoId: string; baralhoId: string; frente: string }> = [];
      const copias: Array<{ baralhoId: string; cartao: Cartao }> = [];
      const chavesAcumuladasPorBaralho = new Map<string, Set<string>>();

      for (const pendente of ordenados) {
        const baralhoEscolhido = escolhasMap.get(pendente.cartao.id);

        if (!baralhoEscolhido) {
          return {
            ok: false,
            erro: "escolhas_invalidas",
            mensagem: `Nenhuma escolha para cartão ${pendente.cartao.id}.`,
          };
        }

        // Valida se a escolha é válida
        if (!baralhosPorId.has(baralhoEscolhido)) {
          return {
            ok: false,
            erro: "escolhas_invalidas",
            mensagem: `Baralho ${baralhoEscolhido} não existe.`,
          };
        }

        // Para Cartão compartilhado, o baralho deve ser um dos seus legados;
        // o avulso aceita qualquer Baralho do Usuário, conferido acima.
        if (
          pendente.baralhos.length > 0 &&
          !pendente.baralhos.some((b) => b.id === baralhoEscolhido)
        ) {
          return {
            ok: false,
            erro: "escolhas_invalidas",
            mensagem: `Baralho ${baralhoEscolhido} não é um dos baralhos legados do cartão.`,
          };
        }

        // Calcula a frente numerada para o Pertencimento
        const cartoesDoBaralhoEscolhido = await armazenamento.listarCartoesDoBaralho(
          usuarioId,
          baralhoEscolhido,
        );

        let chavesUsadas = chavesAcumuladasPorBaralho.get(baralhoEscolhido);
        if (!chavesUsadas) {
          chavesUsadas = new Set(
            cartoesDoBaralhoEscolhido.map((c) => normalizarFrente(c.frente)),
          );
          chavesAcumuladasPorBaralho.set(baralhoEscolhido, chavesUsadas);
        }

        const frenteFinal = numerarFrente(pendente.cartao.frente, chavesUsadas);
        chavesUsadas.add(normalizarFrente(frenteFinal));

        pertencimentos.push({
          cartaoId: pendente.cartao.id,
          baralhoId: baralhoEscolhido,
          frente: frenteFinal,
        });

        // Para cada outro Baralho legado, cria uma cópia
        const outrosBaralhos = pendente.baralhos
          .filter((b) => b.id !== baralhoEscolhido)
          .sort((a, b) => a.nome.localeCompare(b.nome));

        for (const baralho of outrosBaralhos) {
          const cartoesDoOutroBaralho = await armazenamento.listarCartoesDoBaralho(
            usuarioId,
            baralho.id,
          );

          let chavesDoOutro = chavesAcumuladasPorBaralho.get(baralho.id);
          if (!chavesDoOutro) {
            chavesDoOutro = new Set(
              cartoesDoOutroBaralho.map((c) => normalizarFrente(c.frente)),
            );
            chavesAcumuladasPorBaralho.set(baralho.id, chavesDoOutro);
          }

          const frenteDaCopia = numerarFrente(pendente.cartao.frente, chavesDoOutro);
          chavesDoOutro.add(normalizarFrente(frenteDaCopia));

          copias.push({
            baralhoId: baralho.id,
            cartao: {
              id: randomUUID(),
              frente: frenteDaCopia,
              verso: pendente.cartao.verso,
            },
          });
        }
      }

      const aplicado = await armazenamento.aplicarTransicao(usuarioId, {
        pertencimentos,
        copias,
      });

      if (!aplicado.ok) {
        if (aplicado.erro === "conflito") {
          return {
            ok: false,
            erro: "conflito",
            mensagem: "O acervo mudou; recarregue as escolhas e tente de novo.",
          };
        }

        return {
          ok: false,
          erro: "indisponivel",
          mensagem: ARMAZENAMENTO_INDISPONIVEL.mensagem,
        };
      }

      return { ok: true };
    },

    async registrarSessao(dados) {
      const agora = relogio();

      if (dados.inicioAgendaId !== undefined) {
        return registrarSessaoDaAgenda(dados, agora);
      }

      const registro = interpretarRegistro(dados, agora);

      if (registro === null) {
        return { ok: false, ...DADOS_INVALIDOS };
      }

      /**
       * O Agendamento nasce da Avaliação de cada Item, aplicada na ordem
       * apresentada sobre o estado atual dos Agendamentos — é o encadeamento
       * que faz duas Avaliações seguidas do mesmo Cartão avançarem as
       * repetições (FR-205, FR-210). As Avaliações já foram validadas em quatro
       * níveis, então todo Item tem Cartão de origem e Avaliação.
       */
      const [preferencias, agendamentos] = await Promise.all([
        armazenamento.obterPreferencias(usuarioId),
        armazenamento.listarAgendamentos(usuarioId),
      ]);

      const algoritmo = resolverAlgoritmo(preferencias.algoritmo);
      const itens = registro.itens.flatMap((item) =>
        item.cartaoId != null && item.avaliacao != null
          ? [{ cartaoId: item.cartaoId, avaliacao: item.avaliacao }]
          : [],
      );
      const aplicados = aplicarAvaliacoes(
        agendamentos,
        itens,
        algoritmo,
        agora,
      );

      /**
       * Registro e Agendamentos entram na mesma transação. O instante de
       * conclusão é definido na primeira inserção: se o `id` já existe para
       * este Usuário, a Porta devolve o registro guardado — com a data
       * original e **sem** reaplicar as Avaliações —, e o reenvio não duplica
       * nem reescreve nada (FR-163, FR-210, SC-085). O mesmo `id` de outro
       * Usuário é `conflito` (FR-166).
       */
      const gravado = await armazenamento.inserirRegistroEAgendamentos(
        usuarioId,
        registro,
        aplicados,
      );

      if (!gravado.ok) {
        return gravado.erro === "conflito"
          ? { ok: false, ...REGISTRO_EM_CONFLITO }
          : { ok: false, ...HISTORICO_INDISPONIVEL };
      }

      return {
        ok: true,
        registro: gravado.valor.registro,
        criada: gravado.valor.novo,
      };
    },

    async obterEstatisticas(desde) {
      const janela = interpretarJanela(desde, relogio());

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
       * A Sessão da Revisão do dia e a do estudo temporário não têm Baralho: o
       * registro é devolvido como está, com `baralhoExiste: false` e sem sequer
       * consultar o Baralho (D5, FR-215, FR-376).
       */
      if (
        encontrado.valor.origem === "revisao" ||
        encontrado.valor.origem === "temporario"
      ) {
        return {
          ok: true,
          registro: encontrado.valor,
          baralhoExiste: false,
        };
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

    async obterPrevias(cartaoIds) {
      const ids = interpretarCartaoIds(cartaoIds);

      if (ids === null) {
        return { ok: false, ...DADOS_INVALIDOS };
      }

      const [cartoes, agendamentos, preferencias] = await Promise.all([
        armazenamento.listarCartoes(usuarioId),
        armazenamento.listarAgendamentos(usuarioId),
        armazenamento.obterPreferencias(usuarioId),
      ]);

      const algoritmo = resolverAlgoritmo(preferencias.algoritmo);
      const existentes = new Set(cartoes.map((cartao) => cartao.id));
      const porCartao = new Map(
        agendamentos.map((agendamento) => [agendamento.cartaoId, agendamento]),
      );
      const agora = relogio();

      /**
       * Identificador que não é Cartão do Usuário é **omitido**, e não
       * recusado: a tela pede a prévia dos Cartões que vai estudar, e um Cartão
       * excluído nesse meio-tempo não invalida os demais (FR-219).
       */
      const previas: Record<string, Record<Avaliacao, string>> = {};

      for (const id of ids) {
        if (!existentes.has(id)) {
          continue;
        }

        previas[id] = previa(
          algoritmo,
          estadoDoAgendamento(porCartao.get(id) ?? null),
          agora,
        );
      }

      return { ok: true, previas };
    },

    async obterPreferencias() {
      const preferencias = await armazenamento.obterPreferencias(usuarioId);

      return {
        ok: true,
        preferencias: {
          algoritmo: preferencias.algoritmo,
          algoritmos: opcoesDeAlgoritmo(),
        },
      };
    },

    async salvarPreferencias(dados) {
      const preferencias = interpretarPreferencias(dados, algoritmos);

      if (preferencias === null) {
        return { ok: false, ...DADOS_INVALIDOS };
      }

      const atuais = await armazenamento.obterPreferencias(usuarioId);

      if (preferencias.algoritmo !== atuais.algoritmo) {
        /**
         * Trocar de algoritmo reconstrói **todos** os Agendamentos por replay
         * do Histórico — nenhum registro se perde, e o Cartão reaparece no dia
         * que o novo algoritmo calcular (FR-213, SC-083).
         */
        const [itensAvaliados, cartoes] = await Promise.all([
          armazenamento.listarItensAvaliados(usuarioId),
          armazenamento.listarCartoes(usuarioId),
        ]);

        const agendamentos = reconstruir(
          itensAvaliados,
          cartoes.map((cartao) => cartao.id),
          resolverAlgoritmo(preferencias.algoritmo),
        );

        const substituido = await armazenamento.substituirAgendamentos(
          usuarioId,
          preferencias,
          agendamentos,
        );

        if (!substituido.ok) {
          return { ok: false, ...HISTORICO_INDISPONIVEL };
        }
      } else {
        const salvo = await armazenamento.salvarPreferencias(
          usuarioId,
          preferencias,
        );

        if (!salvo.ok) {
          return { ok: false, ...HISTORICO_INDISPONIVEL };
        }
      }

      return {
        ok: true,
        preferencias: {
          algoritmo: preferencias.algoritmo,
          algoritmos: opcoesDeAlgoritmo(),
        },
      };
    },

    obterAgenda: (inicio, fuso) => agenda.obterAgenda(inicio, fuso),

    listarRotinas: () => agenda.listarRotinas(),

    salvarRotina: (dados) => agenda.salvarRotina(dados),

    iniciarCompromisso: (dados) => agenda.iniciarCompromisso(dados),
  };
}
