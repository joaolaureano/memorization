import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
} from "./cliente";
import type {
  Baralho,
  BaralhoListado,
  Cartao,
  ClienteDoAcervo,
  DadosDeBaralho,
  DadosDeCartao,
  ResultadoDeCriacaoDeBaralho,
  ResultadoDeCriacaoDeCartao,
  ResultadoDeListagemDeBaralhos,
  ResultadoDeListagemDeCartoes,
} from "./cliente";
import { ehCodigoDeErroDeBaralho, ehCodigoDeErroDeCartao } from "./validacao";
import type { CodigoDeErroDeBaralho, CodigoDeErroDeCartao } from "./validacao";

/**
 * Adapter HTTP do `ClienteDoAcervo` (T008, T106).
 *
 * Transporta as quatro operações até a API conforme os contratos de Cartões
 * (specs/001-criar-cartao/contracts/api-cartoes.md) e de Baralhos
 * (specs/002-criar-baralho/contracts/api-baralhos.md): `POST /cartoes` e
 * `POST /baralhos` para criar, `GET /cartoes` e `GET /baralhos` para listar.
 * O endereço da API é recebido na construção — em tempo de build na aplicação
 * (plan.md).
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

  async criarBaralho(
    dados: DadosDeBaralho,
  ): Promise<ResultadoDeCriacaoDeBaralho> {
    try {
      const resposta = await fetch(`${this.endereco}/baralhos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome: dados.nome }),
      });

      if (resposta.status === 201) {
        const baralho = (await resposta.json()) as Baralho;
        return { ok: true, baralho };
      }

      if (resposta.status === 400) {
        return this.traduzirRecusaDeBaralho(await resposta.json());
      }

      return this.falhaDeIndisponibilidadeDeBaralhos();
    } catch {
      return this.falhaDeIndisponibilidadeDeBaralhos();
    }
  }

  async listarBaralhos(): Promise<ResultadoDeListagemDeBaralhos> {
    try {
      const resposta = await fetch(`${this.endereco}/baralhos`);

      if (resposta.status === 200) {
        const baralhos = (await resposta.json()) as BaralhoListado[];
        return { ok: true, baralhos };
      }

      return this.falhaDeIndisponibilidadeDeBaralhos();
    } catch {
      return this.falhaDeIndisponibilidadeDeBaralhos();
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

  /**
   * Traduz a recusa uniforme do contrato de Baralhos no modo de erro
   * correspondente. Um código que não seja regra de Baralho vira
   * `indisponivel`, e a operação continua não concluída.
   */
  private traduzirRecusaDeBaralho(
    corpo: unknown,
  ): ResultadoDeCriacaoDeBaralho {
    if (ehCorpoDeRecusaDeBaralho(corpo)) {
      return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
    }

    return this.falhaDeIndisponibilidadeDeBaralhos();
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

  private falhaDeIndisponibilidadeDeBaralhos(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
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

/**
 * Reconhece o corpo de recusa do contrato de Baralhos: código estável de
 * regra de Baralho e mensagem em texto. Qualquer outra forma é tratada como
 * indisponibilidade.
 */
function ehCorpoDeRecusaDeBaralho(
  corpo: unknown,
): corpo is { erro: CodigoDeErroDeBaralho; mensagem: string } {
  if (typeof corpo !== "object" || corpo === null) {
    return false;
  }

  const campos = corpo as Record<string, unknown>;

  return (
    ehCodigoDeErroDeBaralho(campos.erro) &&
    typeof campos.mensagem === "string"
  );
}
