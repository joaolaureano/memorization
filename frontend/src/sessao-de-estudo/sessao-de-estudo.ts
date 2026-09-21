import type { Cartao } from "../acervo-cliente/cliente";
import { AleatoriedadeReal } from "./aleatoriedade";
import type { Aleatoriedade } from "./aleatoriedade";

/**
 * Module `SessaoDeEstudo` (T301–T303; specs/004-sessao-de-estudo/plan.md).
 *
 * Mantém uma Sessão de estudo inteiramente em memória: seleciona os Cartões
 * sem repetição no início, esconde o Verso até a Revelação, aceita um único
 * Resultado por Item e deriva o Resumo somente ao final. Nada é persistido e
 * nenhuma operação de rede é feita — interromper a Sessão é simplesmente
 * descartar a instância (FR-038, FR-039).
 *
 * A Interface esconde a seleção, a cópia do conteúdo, a máquina de estados e
 * a derivação do Resumo. O caller nunca reproduz essas regras: recebe o
 * `ItemDeEstudo` já no estado correto e apenas reage a `ok`.
 */

/** Valores aceitos para o Resultado do Item (FR-035, FR-036). */
export const RESULTADOS_DO_ITEM = ["acertou", "errou"] as const;

export type ResultadoDoItem = (typeof RESULTADOS_DO_ITEM)[number];

/**
 * Distingue um Resultado do Item de qualquer outro valor em tempo de execução.
 */
export function ehResultadoDoItem(valor: unknown): valor is ResultadoDoItem {
  return (
    typeof valor === "string" &&
    RESULTADOS_DO_ITEM.some((resultado) => resultado === valor)
  );
}

/**
 * Código estável de recusa do Module. Exaustivo nesta feature: não há outro
 * modo de falha de domínio.
 */
export const CODIGOS_DE_ERRO_DE_SESSAO = [
  "baralho_inelegivel",
  "quantidade_invalida",
  "resultado_invalido",
  "revelacao_ausente",
  "sessao_concluida",
] as const;

export type CodigoDeErroDeSessao =
  (typeof CODIGOS_DE_ERRO_DE_SESSAO)[number];

/** Mensagens em português devolvidas nas recusas (FR-046). */
export const MENSAGEM_DE_BARALHO_INELEGIVEL =
  "Este Baralho não pode ser estudado porque não tem Cartões vinculados.";

export const MENSAGEM_DE_QUANTIDADE_INVALIDA =
  "Informe uma quantidade inteira de Cartões, ao menos igual a 1.";

export const MENSAGEM_DE_RESULTADO_INVALIDO =
  "O resultado do item deve ser acertou ou errou.";

export const MENSAGEM_DE_REVELACAO_AUSENTE =
  "Revele o Verso antes de registrar o resultado.";

export const MENSAGEM_DE_SESSAO_CONCLUIDA =
  "A Sessão já foi concluída.";

/** Item de estudo com o Verso ainda oculto (FR-032). */
export interface ItemDeEstudoOculto {
  readonly cartaoId: string;
  readonly frente: string;
  readonly revelado: false;
  readonly verso: null;
  readonly resultado: null;
}

/** Item de estudo após a Revelação (FR-033). */
export interface ItemDeEstudoRevelado {
  readonly cartaoId: string;
  readonly frente: string;
  readonly revelado: true;
  readonly verso: string;
  readonly resultado: ResultadoDoItem | null;
}

export type ItemDeEstudo = ItemDeEstudoOculto | ItemDeEstudoRevelado;

/** Consolidação final da Sessão (FR-037). */
export interface ResumoDaSessao {
  readonly estudados: number;
  readonly acertos: number;
  readonly erros: number;
}

/** Base do estado observável da Sessão. */
interface EstadoBaseDaSessao {
  readonly baralhoId: string;
  readonly total: number;
  readonly itens: readonly ItemDeEstudo[];
  readonly avisoDeLimite: string | null;
}

export interface EstadoDaSessaoEmAndamento extends EstadoBaseDaSessao {
  readonly concluida: false;
  readonly posicao: number;
  readonly itemAtual: ItemDeEstudo;
  readonly resumo: null;
}

export interface EstadoDaSessaoConcluida extends EstadoBaseDaSessao {
  readonly concluida: true;
  readonly posicao: number;
  readonly itemAtual: null;
  readonly resumo: ResumoDaSessao;
}

export type EstadoDaSessao = EstadoDaSessaoEmAndamento | EstadoDaSessaoConcluida;

export type ResultadoDeInicioDeSessao =
  | { ok: true; sessao: SessaoDeEstudo }
  | {
      ok: false;
      erro: "baralho_inelegivel" | "quantidade_invalida";
      mensagem: string;
    };

export type ResultadoDeRevelacao =
  | { ok: true; item: ItemDeEstudoRevelado }
  | { ok: false; erro: "sessao_concluida"; mensagem: string };

export type ResultadoDeRegistroDeResultado =
  | { ok: true; item: ItemDeEstudoOculto }
  | { ok: true; resumo: ResumoDaSessao }
  | {
      ok: false;
      erro: "resultado_invalido" | "revelacao_ausente" | "sessao_concluida";
      mensagem: string;
    };

interface ItemInterno {
  cartaoId: string;
  frente: string;
  verso: string;
  revelado: boolean;
  resultado: ResultadoDoItem | null;
}

export class SessaoDeEstudo {
  private readonly baralhoId: string;
  private readonly itens: ItemInterno[];
  private readonly avisoDeLimite: string | null;
  private posicaoCorrente = 0;
  private concluida = false;

  private constructor(
    baralhoId: string,
    itens: ItemInterno[],
    avisoDeLimite: string | null,
  ) {
    this.baralhoId = baralhoId;
    this.itens = itens;
    this.avisoDeLimite = avisoDeLimite;
  }

  /**
   * Inicia uma Sessão a partir de um Baralho elegível (FR-025).
   *
   * A elegibilidade é verificada aqui, de forma autoritativa: `cartoes` vazio
   * recusa com `baralho_inelegivel`. A quantidade é `min(solicitada,
   * disponíveis)` e nunca menor que 1; quantidade menor que 1 ou não inteira
   * recusa com `quantidade_invalida`. Quando a quantidade excede os
   * disponíveis, a Sessão começa com todos e o aviso fica disponível em
   * `estadoAtual().avisoDeLimite` (FR-029).
   *
   * A ordem é definida uma única vez, com o Adapter de `Aleatoriedade`
   * recebido (real por padrão; determinístico em teste), e não muda durante a
   * Sessão (FR-030). Cartões repetidos na entrada são reduzidos a um Item cada
   * (FR-031).
   */
  static iniciar(
    baralhoId: string,
    quantidade: number,
    cartoes: readonly Cartao[],
    aleatoriedade: Aleatoriedade = new AleatoriedadeReal(),
  ): ResultadoDeInicioDeSessao {
    const cartoesUnicos = deduplicarCartoes(cartoes);

    if (cartoesUnicos.length === 0) {
      return {
        ok: false,
        erro: "baralho_inelegivel",
        mensagem: MENSAGEM_DE_BARALHO_INELEGIVEL,
      };
    }

    if (!Number.isInteger(quantidade) || quantidade < 1) {
      return {
        ok: false,
        erro: "quantidade_invalida",
        mensagem: MENSAGEM_DE_QUANTIDADE_INVALIDA,
      };
    }

    const total = Math.min(quantidade, cartoesUnicos.length);
    const selecionados = embaralhar(cartoesUnicos, aleatoriedade).slice(
      0,
      total,
    );

    const itens: ItemInterno[] = selecionados.map((cartao) => ({
      cartaoId: cartao.id,
      frente: cartao.frente,
      verso: cartao.verso,
      revelado: false,
      resultado: null,
    }));

    const avisoDeLimite =
      quantidade > cartoesUnicos.length
        ? montarAvisoDeLimite(quantidade, cartoesUnicos.length)
        : null;

    return {
      ok: true,
      sessao: new SessaoDeEstudo(baralhoId, itens, avisoDeLimite),
    };
  }

  /**
   * Revela o Verso do Item corrente (FR-033). A Revelação é idempotente: uma
   * segunda chamada devolve o mesmo Item revelado, sem mudar o estado.
   */
  revelar(): ResultadoDeRevelacao {
    if (this.concluida) {
      return {
        ok: false,
        erro: "sessao_concluida",
        mensagem: MENSAGEM_DE_SESSAO_CONCLUIDA,
      };
    }

    this.itens[this.posicaoCorrente].revelado = true;

    return {
      ok: true,
      item: congelarItemRevelado(this.itens[this.posicaoCorrente]),
    };
  }

  /**
   * Registra o Resultado do Item corrente (FR-035, FR-036).
   *
   * Recusa antes da Revelação (`revelacao_ausente`) e depois da conclusão
   * (`sessao_concluida`). Quando aceito, o Resultado é definitivo: a Sessão
   * avança para o próximo Item (devolvido com o Verso oculto) ou, se este era
   * o último, devolve o Resumo.
   */
  registrarResultado(
    resultado: ResultadoDoItem,
  ): ResultadoDeRegistroDeResultado {
    if (this.concluida) {
      return {
        ok: false,
        erro: "sessao_concluida",
        mensagem: MENSAGEM_DE_SESSAO_CONCLUIDA,
      };
    }

    if (!ehResultadoDoItem(resultado)) {
      return {
        ok: false,
        erro: "resultado_invalido",
        mensagem: MENSAGEM_DE_RESULTADO_INVALIDO,
      };
    }

    const item = this.itens[this.posicaoCorrente];

    if (!item.revelado) {
      return {
        ok: false,
        erro: "revelacao_ausente",
        mensagem: MENSAGEM_DE_REVELACAO_AUSENTE,
      };
    }

    item.resultado = resultado;

    if (this.posicaoCorrente === this.itens.length - 1) {
      this.concluida = true;
      return { ok: true, resumo: this.resumoCongelado() };
    }

    this.posicaoCorrente += 1;
    return {
      ok: true,
      item: congelarItemOculto(this.itens[this.posicaoCorrente]),
    };
  }

  /**
   * Fotografia imutável do estado corrente: posição, total, Item corrente,
   * aviso de limite e, somente ao final, o Resumo.
   */
  estadoAtual(): EstadoDaSessao {
    const itens = this.itensCongelados();

    if (this.concluida) {
      const estado: EstadoDaSessaoConcluida = {
        concluida: true,
        baralhoId: this.baralhoId,
        total: this.itens.length,
        posicao: this.itens.length,
        itemAtual: null,
        resumo: this.resumoCongelado(),
        avisoDeLimite: this.avisoDeLimite,
        itens,
      };

      return Object.freeze(estado);
    }

    const estado: EstadoDaSessaoEmAndamento = {
      concluida: false,
      baralhoId: this.baralhoId,
      total: this.itens.length,
      posicao: this.posicaoCorrente + 1,
      itemAtual: congelarItem(this.itens[this.posicaoCorrente]),
      resumo: null,
      avisoDeLimite: this.avisoDeLimite,
      itens,
    };

    return Object.freeze(estado);
  }

  private itensCongelados(): readonly ItemDeEstudo[] {
    return Object.freeze(this.itens.map((item) => congelarItem(item)));
  }

  private resumoCongelado(): ResumoDaSessao {
    let acertos = 0;
    let erros = 0;

    for (const item of this.itens) {
      if (item.resultado === "acertou") {
        acertos += 1;
      } else if (item.resultado === "errou") {
        erros += 1;
      }
    }

    const resumo: ResumoDaSessao = {
      estudados: this.itens.length,
      acertos,
      erros,
    };

    return Object.freeze(resumo);
  }
}

function deduplicarCartoes(cartoes: readonly Cartao[]): Cartao[] {
  const vistos = new Set<string>();
  const unicos: Cartao[] = [];

  for (const cartao of cartoes) {
    if (!vistos.has(cartao.id)) {
      vistos.add(cartao.id);
      unicos.push(cartao);
    }
  }

  return unicos;
}

function embaralhar<T>(itens: readonly T[], aleatoriedade: Aleatoriedade): T[] {
  const copia = [...itens];

  for (let indice = copia.length - 1; indice > 0; indice -= 1) {
    const sorteio = Math.floor(aleatoriedade.proximo() * (indice + 1));
    const temporario = copia[indice];
    copia[indice] = copia[sorteio];
    copia[sorteio] = temporario;
  }

  return copia;
}

function montarAvisoDeLimite(solicitada: number, disponiveis: number): string {
  const item = disponiveis === 1 ? "Item" : "Itens";

  return (
    `Você pediu ${solicitada} Cartões, mas este Baralho tem ${disponiveis}. ` +
    `A Sessão terá ${disponiveis} ${item}.`
  );
}

function congelarItem(item: ItemInterno): ItemDeEstudo {
  if (!item.revelado) {
    return congelarItemOculto(item);
  }

  return congelarItemRevelado(item);
}

function congelarItemOculto(item: ItemInterno): ItemDeEstudoOculto {
  const oculto: ItemDeEstudoOculto = {
    cartaoId: item.cartaoId,
    frente: item.frente,
    revelado: false,
    verso: null,
    resultado: null,
  };

  return Object.freeze(oculto);
}

function congelarItemRevelado(item: ItemInterno): ItemDeEstudoRevelado {
  const revelado: ItemDeEstudoRevelado = {
    cartaoId: item.cartaoId,
    frente: item.frente,
    revelado: true,
    verso: item.verso,
    resultado: item.resultado,
  };

  return Object.freeze(revelado);
}
