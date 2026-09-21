import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE,
} from "./cliente";
import type {
  Cartao,
  ClienteDoAcervo,
  DadosDeCartao,
  ResultadoDeCriacaoDeCartao,
  ResultadoDeListagemDeCartoes,
} from "./cliente";
import { ehCodigoDeErroDeCartao } from "./validacao";
import type { CodigoDeErroDeCartao } from "./validacao";

/**
 * Adapter HTTP do `ClienteDoAcervo` (T008).
 *
 * Transporta as duas operações até a API conforme o contrato
 * (specs/001-criar-cartao/contracts/api-cartoes.md): `POST /cartoes` para
 * criar, `GET /cartoes` para listar. O endereço da API é recebido na
 * construção — em tempo de build na aplicação (plan.md).
 *
 * Invariante do Adapter: nenhuma resposta que não seja de sucesso aparece
 * como operação concluída (FR-044). Sucesso é, exatamente, `201` na criação
 * e `200` na listagem, com corpo no formato do contrato. Qualquer outra
 * resposta — outro status, corpo ilegível, código de erro fora do contrato,
 * falha de rede — vira `indisponivel`.
 */
export class ClienteHttp implements ClienteDoAcervo {
  private readonly endereco: string;

  constructor(enderecoDaApi: string) {
    this.endereco = enderecoDaApi.replace(/\/+$/, "");
  }

  async criarCartao(
    dados: DadosDeCartao,
  ): Promise<ResultadoDeCriacaoDeCartao> {
    try {
      const resposta = await fetch(`${this.endereco}/cartoes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ frente: dados.frente, verso: dados.verso }),
      });

      if (resposta.status === 201) {
        const cartao = (await resposta.json()) as Cartao;
        return { ok: true, cartao };
      }

      if (resposta.status === 400) {
        return this.traduzirRecusa(await resposta.json());
      }

      return this.falhaDeIndisponibilidade();
    } catch {
      return this.falhaDeIndisponibilidade();
    }
  }

  async listarCartoes(): Promise<ResultadoDeListagemDeCartoes> {
    try {
      const resposta = await fetch(`${this.endereco}/cartoes`);

      if (resposta.status === 200) {
        const cartoes = (await resposta.json()) as Cartao[];
        return { ok: true, cartoes };
      }

      return this.falhaDeIndisponibilidade();
    } catch {
      return this.falhaDeIndisponibilidade();
    }
  }

  /**
   * Traduz a recusa uniforme do contrato (`{ erro, mensagem }`) no modo de
   * erro correspondente. Um código que não seja regra de Cartão — por
   * exemplo `corpo_invalido` — não atravessa a Interface: vira
   * `indisponivel`, e a operação continua não concluída.
   */
  private traduzirRecusa(corpo: unknown): ResultadoDeCriacaoDeCartao {
    if (ehCorpoDeRecusa(corpo)) {
      return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
    }

    return this.falhaDeIndisponibilidade();
  }

  private falhaDeIndisponibilidade(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
    };
  }
}

/**
 * Reconhece o corpo de recusa do contrato: código estável de regra de Cartão
 * e mensagem em texto. Qualquer outra forma é tratada como indisponibilidade.
 */
function ehCorpoDeRecusa(
  corpo: unknown,
): corpo is { erro: CodigoDeErroDeCartao; mensagem: string } {
  if (typeof corpo !== "object" || corpo === null) {
    return false;
  }

  const campos = corpo as Record<string, unknown>;

  return (
    ehCodigoDeErroDeCartao(campos.erro) &&
    typeof campos.mensagem === "string"
  );
}
