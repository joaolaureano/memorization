import type { Cartao, EstadoDaRotina } from "../armazenamento/porta.ts";

/**
 * Tipos públicos do Module `Agenda`, exatamente como o contrato HTTP os expõe
 * (`contracts/api-agenda.md`, FR-248, FR-250).
 *
 * Nada aqui carrega `usuarioId` nem as versões internas da Rotina: o dono entra
 * pela construção do Module, e o histórico de configurações é detalhe do
 * armazenamento.
 */

/**
 * O estado público da Rotina é o mesmo do armazenamento (FR-248), reexportado
 * para que quem consome a Agenda não precise importar a Porta.
 */
export type { EstadoDaRotina } from "../armazenamento/porta.ts";

/** Estado da Rotina como o contrato público o nomeia (FR-248). */
export type EstadoDaRotinaPublico = EstadoDaRotina;

/**
 * Rotina de estudo como o contrato a devolve (FR-248): a configuração vigente,
 * sem `usuarioId` e sem o histórico interno de versões.
 */
export interface RotinaDeEstudo {
  id: string;
  baralhoId: string;
  nomeDoBaralho: string;
  /** Dias da semana: inteiros únicos de 1 (segunda) a 7 (domingo). */
  dias: number[];
  /** Quantidade de Cartões por ocorrência; `null` significa Todos. */
  quantidade: number | null;
  estado: EstadoDaRotinaPublico;
  versao: number;
  /** ISO-8601 UTC da criação. */
  criadaEm: string;
  /**
   * `true` quando o Baralho da Rotina foi excluído ou está sem Cartões
   * (FR-243): a Rotina continua programada, mas novos inícios não são possíveis
   * até o ajuste.
   */
  indisponivel: boolean;
}

/**
 * Estado de um Compromisso de estudo na Agenda (FR-250): projetado pela Rotina
 * ou derivado de uma exceção ou de uma conclusão persistidas.
 */
export type EstadoDoCompromisso =
  | "pendente"
  | "programado"
  | "nao_realizado"
  | "concluido"
  | "cancelado";

/**
 * Compromisso de estudo de um dia (FR-250): a ocorrência da Rotina com a
 * configuração capturada e, quando houver, o Registro da Sessão concluída.
 */
export interface CompromissoDeEstudo {
  rotinaId: string;
  /** Data civil YYYY-MM-DD da ocorrência. */
  data: string;
  baralhoId: string;
  nomeDoBaralho: string;
  quantidade: number | null;
  estado: EstadoDoCompromisso;
  /** `true` quando o Baralho da Rotina foi excluído (FR-248). */
  indisponivel: boolean;
  /** Registro da Sessão concluída; `null` enquanto não houver conclusão. */
  registroId: string | null;
}

/**
 * A Semana da Agenda (FR-248): o intervalo de sete dias a partir de `inicio`,
 * o `hoje` no fuso pedido e os Compromissos do intervalo.
 */
export interface SemanaDaAgenda {
  inicio: string;
  hoje: string;
  fuso: string;
  compromissos: CompromissoDeEstudo[];
  compromissosDeHoje: CompromissoDeEstudo[];
}

/**
 * Início de estudo autorizado pelo servidor (FR-250): os Cartões já
 * selecionados, na ordem apresentada, para abrir a Sessão de um Compromisso.
 */
export interface InicioDeCompromisso {
  id: string;
  rotinaId: string;
  data: string;
  baralhoId: string;
  nomeDoBaralho: string;
  cartoes: Cartao[];
  quantidadeSolicitada: number | null;
}

/** Ação pretendida em `salvarRotina` (FR-248). */
export type AcaoDeRotina =
  | "criar"
  | "editar"
  | "pausar"
  | "retomar"
  | "excluir";

/**
 * Corpo de `salvarRotina` (FR-248): a intenção completa da operação, com a
 * idempotência por `operacaoId` e a concorrência otimista por `versao`.
 */
export interface DadosDeRotina {
  operacaoId: string;
  id?: string;
  versao?: number;
  acao: AcaoDeRotina;
  baralhoId?: string;
  dias?: number[];
  quantidade?: number | null;
  confirmarSobreposicao?: boolean;
  fuso: string;
}

/** Corpo de `iniciarCompromisso` (FR-250): a Rotina, a data e o fuso. */
export interface DadosDeInicio {
  rotinaId: string;
  data: string;
  fuso: string;
}

/**
 * Códigos estáveis de falha da Agenda (FR-250): o caller os distingue sem
 * depender de texto, e a mensagem em português acompanha cada um.
 */
export type CodigoDeErroDeAgenda =
  | "dados_invalidos"
  | "nao_encontrado"
  | "conflito"
  | "sobreposicao"
  | "indisponivel";

/** Recusa da Agenda: código estável e mensagem em português (FR-250). */
export interface FalhaDeAgenda {
  ok: false;
  erro: CodigoDeErroDeAgenda;
  mensagem: string;
}

/** Resultado de `obterAgenda`: a Semana da Agenda, ou a recusa. */
export type ResultadoDeObterAgenda =
  | { ok: true; agenda: SemanaDaAgenda }
  | FalhaDeAgenda;

/** Resultado de `listarRotinas`: as Rotinas ativas e pausadas, ou a recusa. */
export type ResultadoDeListarRotinas =
  | { ok: true; rotinas: RotinaDeEstudo[] }
  | FalhaDeAgenda;

/**
 * Resultado de `salvarRotina`: a Rotina gravada e se ela foi **criada agora**
 * — o que a rota mapeia para 201 (FR-248).
 */
export type ResultadoDeSalvarRotina =
  | { ok: true; rotina: RotinaDeEstudo; criada: boolean }
  | FalhaDeAgenda;

/** Resultado de `iniciarCompromisso`: o Início autorizado, ou a recusa. */
export type ResultadoDeIniciarCompromisso =
  | { ok: true; inicio: InicioDeCompromisso }
  | FalhaDeAgenda;
