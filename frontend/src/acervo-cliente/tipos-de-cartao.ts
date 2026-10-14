import { textoDaRecusaPt } from "../idioma/recusas";
import { MENSAGENS_COM_VALOR, MENSAGENS_PT } from "../idioma/mensagens";
import type { Cartao, TipoDeCartao } from "./cliente";
import {
  LIMITE_DE_CARACTERES_DE_CARTAO,
  validarFrente,
  validarVerso,
  type FalhaDeRegraDeCartao,
} from "./validacao";

/**
 * As regras de cada Tipo de cartão do lado do cliente (026, FR-403a): a mesma
 * divisão do backend. O formulário, a busca e as telas pedem ao registro o
 * que muda de um tipo para outro, sem ramificar pelo tipo. As regras daqui dão
 * retorno rápido; quem decide é o servidor.
 */

/** Limite da Descrição alternativa da Imagem (FR-412). */
export const LIMITE_DA_DESCRICAO_ALTERNATIVA = 250;

/** Limite do arquivo de Imagem: 5 MB (FR-410). */
export const LIMITE_DE_BYTES_DA_IMAGEM = 5_242_880;

/** Os formatos aceitos, como o seletor de arquivo os anuncia. */
export const FORMATOS_DE_IMAGEM = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/** As extensões aceitas, conferidas quando o navegador não informa o tipo. */
const EXTENSOES_DE_IMAGEM = /\.(jpe?g|png|webp|gif)$/i;

export const MENSAGEM_DE_IMAGEM_GRANDE = MENSAGENS_PT.imagemGrande;
export const MENSAGEM_DE_FORMATO_DE_IMAGEM = MENSAGENS_PT.formatoDeImagem;

/** O que o formulário valida antes de enviar (FR-408, FR-409, FR-412). */
export interface DadosDoFormulario {
  frente: string;
  verso: string;
  textoAlternativo?: string;
  /** Diz se haverá Imagem depois de salvar — escolhida agora ou mantida. */
  temImagem: boolean;
}

export interface RegrasDoTipo {
  validar(dados: DadosDoFormulario): FalhaDeRegraDeCartao | null;
  /** Os textos em que a busca do Baralho procura (FR-419). */
  textosPesquisaveis(cartao: Pick<Cartao, "frente" | "verso">): string[];
}

const FRENTE_VERSO: RegrasDoTipo = {
  validar: (dados) => validarFrente(dados.frente) ?? validarVerso(dados.verso),
  textosPesquisaveis: (cartao) => [cartao.frente, cartao.verso],
};

const IMAGEM: RegrasDoTipo = {
  validar(dados) {
    if (dados.frente.length > LIMITE_DE_CARACTERES_DE_CARTAO) {
      return validarFrente(dados.frente);
    }

    const falhaNoVerso = validarVerso(dados.verso);

    if (falhaNoVerso !== null) {
      return falhaNoVerso;
    }

    if ((dados.textoAlternativo ?? "").length > LIMITE_DA_DESCRICAO_ALTERNATIVA) {
      return {
        erro: "descricao_muito_longa",
        mensagem:
          MENSAGENS_COM_VALOR.descricaoLonga.pt(LIMITE_DA_DESCRICAO_ALTERNATIVA, (dados.textoAlternativo ?? "").length),
      };
    }

    return dados.temImagem
      ? null
      : { erro: "imagem_ausente", mensagem: textoDaRecusaPt({ erro: "imagem_ausente" }, "cartoes") };
  },
  // O Texto da frente e o Verso; a Imagem não tem texto a buscar.
  textosPesquisaveis: (cartao) => [cartao.frente, cartao.verso],
};

/** O registro: as regras de cada Tipo de cartão. */
export const TIPOS_DE_CARTAO: Readonly<Record<TipoDeCartao, RegrasDoTipo>> = {
  "frente-verso": FRENTE_VERSO,
  imagem: IMAGEM,
};

/** Os tipos na ordem do seletor; o primeiro é o padrão (FR-405). */
export const ORDEM_DOS_TIPOS: readonly TipoDeCartao[] = ["frente-verso", "imagem"];

/** O tipo do Cartão; ausente é Frente-Verso. */
export function tipoDo(cartao: Pick<Cartao, "tipo">): TipoDeCartao {
  return cartao.tipo ?? "frente-verso";
}

/** As regras do tipo do Cartão. */
export function regrasDo(tipo: TipoDeCartao | undefined): RegrasDoTipo {
  return TIPOS_DE_CARTAO[tipo ?? "frente-verso"];
}

/**
 * Confere o arquivo escolhido pelo formato declarado e pelo tamanho (FR-410).
 * É só o retorno imediato: um arquivo disfarçado passa por aqui e é recusado
 * pelo servidor ao salvar (FR-411).
 */
export function conferirArquivoDeImagem(
  arquivo: File,
): { ok: false; erro: "formato" | "tamanho"; mensagem: string } | null {
  const formatoAceito =
    (FORMATOS_DE_IMAGEM as readonly string[]).includes(arquivo.type) ||
    (arquivo.type === "" && EXTENSOES_DE_IMAGEM.test(arquivo.name));

  if (!formatoAceito) {
    return { ok: false, erro: "formato", mensagem: MENSAGEM_DE_FORMATO_DE_IMAGEM };
  }

  if (arquivo.size === 0 || arquivo.size > LIMITE_DE_BYTES_DA_IMAGEM) {
    return { ok: false, erro: "tamanho", mensagem: MENSAGEM_DE_IMAGEM_GRANDE };
  }

  return null;
}

/**
 * O texto alternativo da Imagem exibida (FR-426): a Descrição, senão o Texto
 * da frente, senão "Imagem do Cartão".
 */
export function textoAlternativoDa(
  cartao: Pick<Cartao, "frente" | "textoAlternativo">,
  semDescricao: string,
): string {
  const descricao = cartao.textoAlternativo?.trim();
  const frente = cartao.frente.trim();

  return descricao || frente || semDescricao;
}

/** Os campos do tipo no corpo de criação e edição. */
export function camposDoTipo(dados: {
  tipo?: TipoDeCartao;
  imagemId?: string;
  textoAlternativo?: string;
}): Record<string, string> {
  if (dados.tipo !== "imagem") {
    return {};
  }

  return {
    tipo: "imagem",
    ...(dados.imagemId !== undefined ? { imagemId: dados.imagemId } : {}),
    ...(dados.textoAlternativo ? { textoAlternativo: dados.textoAlternativo } : {}),
  };
}
