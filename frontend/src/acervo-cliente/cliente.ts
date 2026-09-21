import type {
  CodigoDeErroDeBaralho,
  CodigoDeErroDeCartao,
  CodigoDeErroDeNaoEncontrado,
  CodigoDeErroDeVinculo,
} from "./validacao";

/**
 * Seam `ClienteDoAcervo` (T008; specs/001-criar-cartao/plan.md; T106;
 * specs/003-vincular-cartao-baralho/plan.md; specs/005-editar-cartao-e-baralho/plan.md;
 * specs/006-excluir-cartao-e-baralho/plan.md).
 *
 * Espelha as operações da Interface do Module `Acervo` e acrescenta o que a
 * rede introduz. As operações são **assíncronas e sujeitas a
 * indisponibilidade** — a diferença essencial em relação ao `Acervo`, e a
 * razão de esta Seam existir. Dois Adapters justificados: `ClienteHttp` em
 * produção e `ClienteEmMemoria` em teste.
 *
 * Invariantes garantidas pela Interface, que o caller nunca reproduz:
 * nenhuma resposta que não seja de sucesso é apresentada como operação
 * concluída (FR-044). Modos de erro: os do `Acervo`, mais `indisponivel`
 * para falha de transporte.
 */

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
 * Cartão como devolvido por `listarCartoes`: o Cartão mais os Baralhos a que
 * está vinculado (FR-003). O Cartão sem nenhum Baralho devolve `baralhos: []`
 * — estado legítimo, e não ausência de campo. `criarCartao` e `editarCartao`
 * continuam devolvendo apenas `Cartao`, sem carregar campos que a escrita não
 * exige.
 */
export interface CartaoListado extends Cartao {
  baralhos: Baralho[];
}

/**
 * O que `criarCartao` recebe: exatamente Frente e Verso (FR-001).
 *
 * O objeto pode carregar propriedades além dessas duas: elas são ignoradas,
 * porque a Interface lê apenas os campos canônicos — é assim que a Interface
 * garante FR-009 sem que o caller reproduza a regra.
 */
export interface DadosDeCartao {
  frente: string;
  verso: string;
}

/**
 * Código estável de indisponibilidade do transporte até a API.
 *
 * Não é erro de regra de Cartão: surge quando a API não responde, responde
 * um status fora do contrato ou entrega um corpo que não é o contrato. Em
 * qualquer desses casos a operação **não foi concluída** (FR-044).
 */
export const INDISPONIVEL = "indisponivel" as const;

/**
 * Mensagem em português destinada ao usuário quando o transporte falha
 * (FR-046). A interface exibe `mensagem` e nunca inventa texto próprio para
 * uma falha.
 */
export const MENSAGEM_DE_INDISPONIBILIDADE =
  "Não foi possível acessar os Cartões. Tente novamente.";

/**
 * Mensagem em português destinada ao usuário quando o transporte até as rotas
 * de Baralho falha (FR-046). Mantida separada da mensagem de Cartão para que
 * cada operação anuncie a entidade que falhou.
 */
export const MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS =
  "Não foi possível acessar os Baralhos. Tente novamente.";

/**
 * Mensagem em português destinada ao usuário quando o transporte até as rotas
 * de Vínculo falha (FR-046). Mantida separada das mensagens de Cartão e de
 * Baralho para que cada operação anuncie a entidade que falhou.
 */
export const MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS =
  "Não foi possível acessar os Vínculos. Tente novamente.";

/**
 * Resultado de `criarCartao`. Falha é resultado previsto, e não exceção: o
 * caller distingue `ok` e, na recusa, recebe o código estável e a mensagem
 * em português — os códigos de regra de Cartão, ou `indisponivel`.
 */
export type ResultadoDeCriacaoDeCartao =
  | { ok: true; cartao: Cartao }
  | {
      ok: false;
      erro: CodigoDeErroDeCartao | typeof INDISPONIVEL;
      mensagem: string;
    };

/**
 * Resultado de `listarCartoes`. A listagem não tem recusa de domínio: o único
 * modo de falha é `indisponivel`, e nenhuma lista é entregue sem sucesso.
 */
export type ResultadoDeListagemDeCartoes =
  | { ok: true; cartoes: CartaoListado[] }
  | { ok: false; erro: typeof INDISPONIVEL; mensagem: string };

/**
 * A única entidade desta feature: id opaco e nome, e nada além (FR-018).
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
 * a Interface lê apenas os campos canônicos — é assim que a Interface garante
 * FR-018 sem que o caller reproduza a regra.
 */
export interface DadosDeBaralho {
  nome: string;
}

/**
 * Baralho como devolvido por `listarBaralhos`: o Baralho mais a contagem de
 * Cartões e a elegibilidade, ambas derivadas na leitura a partir dos Vínculos
 * — nunca armazenadas (FR-024).
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
 * Resultado de `criarBaralho`. Falha é resultado previsto, e não exceção: o
 * caller distingue `ok` e, na recusa, recebe o código estável e a mensagem
 * em português — os códigos de regra de Baralho, ou `indisponivel`.
 */
export type ResultadoDeCriacaoDeBaralho =
  | { ok: true; baralho: Baralho }
  | {
      ok: false;
      erro: CodigoDeErroDeBaralho | typeof INDISPONIVEL;
      mensagem: string;
    };

/**
 * Resultado de `listarBaralhos`. A listagem não tem recusa de domínio: o único
 * modo de falha é `indisponivel`, e nenhuma lista é entregue sem sucesso.
 */
export type ResultadoDeListagemDeBaralhos =
  | { ok: true; baralhos: BaralhoListado[] }
  | { ok: false; erro: typeof INDISPONIVEL; mensagem: string };

/**
 * Resultado de `vincular`. Sucesso não tem carga; as recusas de domínio são
 * `vinculo_duplicado` (par já existente) e `nao_encontrado` (Cartão ou Baralho
 * inexistente).
 */
export type ResultadoDeVinculacao =
  | { ok: true }
  | {
      ok: false;
      erro:
        | "vinculo_duplicado"
        | CodigoDeErroDeNaoEncontrado
        | typeof INDISPONIVEL;
      mensagem: string;
    };

/**
 * Resultado de `desvincular`. Sucesso não tem carga; a única recusa de domínio
 * é `vinculo_nao_encontrado` (Vínculo inexistente).
 */
export type ResultadoDeDesvinculacao =
  | { ok: true }
  | {
      ok: false;
      erro: CodigoDeErroDeVinculo | typeof INDISPONIVEL;
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
      erro: CodigoDeErroDeNaoEncontrado | typeof INDISPONIVEL;
      mensagem: string;
    };

/**
 * Resultado de `editarCartao`. As regras de conteúdo são as mesmas da criação;
 * Cartão inexistente é recusado como `nao_encontrado`.
 */
export type ResultadoDeEdicaoDeCartao =
  | { ok: true; cartao: Cartao }
  | {
      ok: false;
      erro:
        | CodigoDeErroDeCartao
        | CodigoDeErroDeNaoEncontrado
        | typeof INDISPONIVEL;
      mensagem: string;
    };

/**
 * Resultado de `renomearBaralho`. As regras de nome são as mesmas da criação;
 * Baralho inexistente é recusado como `nao_encontrado`.
 */
export type ResultadoDeRenomeacaoDeBaralho =
  | { ok: true; baralho: Baralho }
  | {
      ok: false;
      erro:
        | CodigoDeErroDeBaralho
        | CodigoDeErroDeNaoEncontrado
        | typeof INDISPONIVEL;
      mensagem: string;
    };

/**
 * Resultado de `excluirCartao`. Sucesso não tem carga; Cartão inexistente é
 * recusado como `nao_encontrado`.
 */
export type ResultadoDeExclusaoDeCartao =
  | { ok: true }
  | {
      ok: false;
      erro: CodigoDeErroDeNaoEncontrado | typeof INDISPONIVEL;
      mensagem: string;
    };

/**
 * Resultado de `excluirBaralho`. Sucesso não tem carga; Baralho inexistente é
 * recusado como `nao_encontrado`.
 */
export type ResultadoDeExclusaoDeBaralho =
  | { ok: true }
  | {
      ok: false;
      erro: CodigoDeErroDeNaoEncontrado | typeof INDISPONIVEL;
      mensagem: string;
    };

/**
 * Interface do Module `ClienteDoAcervo` (Princípio IV).
 *
 * As operações assíncronas escondem o transporte até a API e a forma dos
 * dados na rede. Os dois Adapters — `ClienteHttp` e `ClienteEmMemoria` —
 * satisfazem esta mesma Interface e passam pela mesma bateria de contrato
 * com resultados idênticos.
 */
export interface ClienteDoAcervo {
  criarCartao(dados: DadosDeCartao): Promise<ResultadoDeCriacaoDeCartao>;

  /**
   * Lista todos os Cartões existentes, cada um com sua Frente, seu Verso e
   * os Baralhos a que está vinculado (FR-003, FR-004). A Frente não é
   * identificador: dois Cartões de Frente idêntica são ambos devolvidos, sem
   * deduplicação.
   */
  listarCartoes(): Promise<ResultadoDeListagemDeCartoes>;

  /**
   * Cria um Baralho com o nome informado. Nome vazio ou composto só de
   * espaços é recusado como `nome_vazio` (FR-011); mais de 100 caracteres,
   * como `nome_muito_longo` (FR-061). O nome é rótulo, não identificador:
   * dois Baralhos de mesmo nome são ambos aceitos (FR-012).
   */
  criarBaralho(dados: DadosDeBaralho): Promise<ResultadoDeCriacaoDeBaralho>;

  /**
   * Lista todos os Baralhos existentes, cada um com id, nome, contagem de
   * Cartões e elegibilidade derivadas na leitura, a partir dos Vínculos. O
   * nome é rótulo, não identificador: dois Baralhos de nome idêntico são
   * ambos devolvidos, sem deduplicação.
   */
  listarBaralhos(): Promise<ResultadoDeListagemDeBaralhos>;

  /**
   * Devolve um Baralho com a elegibilidade derivada e os Cartões vinculados
   * (FR-014). Baralho inexistente é recusado como `nao_encontrado`.
   */
  obterBaralho(id: string): Promise<ResultadoDeObterBaralho>;

  /**
   * Vincula um Cartão existente a um Baralho existente (FR-019). O par
   * repetido é recusado como `vinculo_duplicado`; Cartão ou Baralho
   * inexistente, como `nao_encontrado`.
   */
  vincular(cartaoId: string, baralhoId: string): Promise<ResultadoDeVinculacao>;

  /**
   * Desfaz o Vínculo, preservando Cartão e Baralho (FR-021). Vínculo
   * inexistente é recusado como `vinculo_nao_encontrado`.
   */
  desvincular(
    cartaoId: string,
    baralhoId: string,
  ): Promise<ResultadoDeDesvinculacao>;

  /**
   * Edita a Frente e o Verso de um Cartão existente (FR-005), reaplicando as
   * mesmas regras de conteúdo da criação. A alteração vale em todos os
   * Baralhos a que o Cartão está vinculado, sem alterar Vínculos.
   */
  editarCartao(
    id: string,
    frente: string,
    verso: string,
  ): Promise<ResultadoDeEdicaoDeCartao>;

  /**
   * Renomeia um Baralho existente (FR-015), reaplicando as mesmas regras de
   * nome da criação. Vínculos e elegibilidade são preservados.
   */
  renomearBaralho(
    id: string,
    nome: string,
  ): Promise<ResultadoDeRenomeacaoDeBaralho>;

  /**
   * Exclui um Cartão existente (FR-007), removendo também os seus Vínculos e
   * preservando todos os Baralhos (FR-008).
   */
  excluirCartao(id: string): Promise<ResultadoDeExclusaoDeCartao>;

  /**
   * Exclui um Baralho existente (FR-016), removendo também os seus Vínculos e
   * preservando todos os Cartões (FR-017).
   */
  excluirBaralho(id: string): Promise<ResultadoDeExclusaoDeBaralho>;
}
