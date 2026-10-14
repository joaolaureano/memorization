import type { TipoDeCartao } from "../armazenamento/porta.ts";
import {
  LIMITE_DE_CARACTERES_DE_CARTAO,
  normalizarFrente,
  numerarFrente,
  validarFrente,
  validarVerso,
  type FalhaDeRegraDeCartao,
} from "./invariantes.ts";

/**
 * As regras de cada Tipo de cartão (`026`, FR-403a).
 *
 * O fluxo do `Acervo` — criar, editar, listar, estudar — é o mesmo para todo
 * Cartão; o que muda de um tipo para outro vem deste registro: quais campos
 * existem e como são validados e como a Frente entra na unicidade do Baralho. Acrescentar um tipo é acrescentar
 * uma entrada aqui, sem tocar nas regras dos tipos existentes.
 *
 * Não é Seam: há uma única Implementation por tipo, e nada varia entre produção
 * e teste (Princípio IV). As regras são provadas pela Interface do `Acervo`.
 */

/** Limite da Descrição alternativa da Imagem (FR-412). */
export const LIMITE_DA_DESCRICAO_ALTERNATIVA = 250;

/** O que o caller informa para criar ou editar um Cartão de qualquer tipo. */
export interface DadosDoTipo {
  frente: string;
  verso: string;
  /** Envio confirmado da Imagem, no tipo `imagem` (FR-408). */
  imagemId?: string;
  textoAlternativo?: string;
}

export interface RegrasDoTipo {
  /**
   * Valida os textos e a presença da Imagem. `temImagem` diz se o Cartão terá
   * Imagem depois da gravação — enviada agora ou mantida na edição.
   */
  validar(dados: DadosDoTipo, temImagem: boolean): FalhaDeRegraDeCartao | null;
  /** Chave de unicidade da Frente no Baralho; `null` fica fora da regra. */
  chaveDaFrente(frente: string): string | null;
}

const FRENTE_VERSO: RegrasDoTipo = {
  validar(dados) {
    return validarFrente(dados.frente) ?? validarVerso(dados.verso);
  },
  chaveDaFrente(frente) {
    return normalizarFrente(frente);
  },
};

const IMAGEM: RegrasDoTipo = {
  validar(dados, temImagem) {
    if (dados.frente.length > LIMITE_DE_CARACTERES_DE_CARTAO) {
      return validarFrente(dados.frente);
    }

    const falhaNoVerso = validarVerso(dados.verso);

    if (falhaNoVerso !== null) {
      return falhaNoVerso;
    }

    if (
      dados.textoAlternativo !== undefined &&
      dados.textoAlternativo.length > LIMITE_DA_DESCRICAO_ALTERNATIVA
    ) {
      return {
        erro: "descricao_muito_longa",
        mensagem:
          `Description is too long. Maximum ${LIMITE_DA_DESCRICAO_ALTERNATIVA} characters; ` +
          `provided has ${dados.textoAlternativo.length}.`,
        limite: LIMITE_DA_DESCRICAO_ALTERNATIVA,
      };
    }

    return temImagem
      ? null
      : { erro: "imagem_ausente", mensagem: "Choose an image." };
  },
  chaveDaFrente(frente) {
    return frente.trim().length === 0 ? null : normalizarFrente(frente);
  },
};

/** O registro: um conjunto de regras por Tipo de cartão. */
export const TIPOS_DE_CARTAO: Readonly<Record<TipoDeCartao, RegrasDoTipo>> = {
  "frente-verso": FRENTE_VERSO,
  imagem: IMAGEM,
};

/** As regras do tipo do Cartão; `tipo` ausente é `frente-verso`. */
export function regrasDo(tipo: TipoDeCartao | undefined): RegrasDoTipo {
  return TIPOS_DE_CARTAO[tipo ?? "frente-verso"];
}

/** Diz se o valor é um Tipo de cartão conhecido. */
export function ehTipoDeCartao(valor: unknown): valor is TipoDeCartao {
  return valor === "frente-verso" || valor === "imagem";
}

/** Chave de unicidade da Frente do Cartão, pelas regras do seu tipo (FR-414). */
export function chaveDaFrenteDo(cartao: { frente: string; tipo?: TipoDeCartao }): string | null {
  return regrasDo(cartao.tipo).chaveDaFrente(cartao.frente);
}

/**
 * Numera a Frente contra as chaves ocupadas do Baralho (`025`, FR-398). A
 * Frente fora da regra de unicidade — Imagem sem Texto da frente — volta igual.
 */
export function numerarPeloTipo(
  frente: string,
  tipo: TipoDeCartao | undefined,
  ocupadas: ReadonlySet<string>,
): string {
  return regrasDo(tipo).chaveDaFrente(frente) === null
    ? frente
    : numerarFrente(frente, ocupadas);
}
