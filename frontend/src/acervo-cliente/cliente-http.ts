import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
} from "./cliente";
import type {
  Baralho,
  BaralhoComCartoes,
  BaralhoListado,
  Cartao,
  CartaoListado,
  ClienteDoAcervo,
  DadosDeBaralho,
  DadosDeCartao,
  ResultadoDeCriacaoDeBaralho,
  ResultadoDeCriacaoDeCartao,
  ResultadoDeDesvinculacao,
  ResultadoDeEdicaoDeCartao,
  ResultadoDeExclusaoDeBaralho,
  ResultadoDeExclusaoDeCartao,
  ResultadoDeListagemDeBaralhos,
  ResultadoDeListagemDeCartoes,
  ResultadoDeObterBaralho,
  ResultadoDeRenomeacaoDeBaralho,
  ResultadoDeVinculacao,
} from "./cliente";
import { ehCodigoDeErroDeBaralho, ehCodigoDeErroDeCartao } from "./validacao";
import type { CodigoDeErroDeBaralho, CodigoDeErroDeCartao } from "./validacao";

/**
 * Adapter HTTP do `ClienteDoAcervo` (T008, T106, T208, T403, T503).
 *
 * Transporta as operações até a API conforme os contratos de Cartões, de
 * Baralhos, de Vínculos, de edição e de exclusão. O endereço da API é
 * recebido na construção — em tempo de build na aplicação (plan.md).
 *
 * Invariante do Adapter: nenhuma resposta que não seja de sucesso aparece
 * como operação concluída (FR-044). Sucesso é, exatamente, o status e o corpo
 * previstos no contrato de cada rota. Qualquer outra resposta — outro status,
 * corpo ilegível, código de erro fora do contrato, falha de rede — vira
 * `indisponivel`.
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
        const cartao = lerCartao(await resposta.json());

        if (cartao !== null) {
          return { ok: true, cartao };
        }

        return this.falhaDeIndisponibilidade();
      }

      if (resposta.status === 400) {
        return this.traduzirRecusaDeCartao(await resposta.json());
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
        const cartoes = lerListaDeCartoesListados(await resposta.json());

        if (cartoes !== null) {
          return { ok: true, cartoes };
        }

        return this.falhaDeIndisponibilidade();
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
        const baralho = lerBaralho(await resposta.json());

        if (baralho !== null) {
          return { ok: true, baralho };
        }

        return this.falhaDeIndisponibilidadeDeBaralhos();
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
        const baralhos = lerListaDeBaralhosListados(await resposta.json());

        if (baralhos !== null) {
          return { ok: true, baralhos };
        }

        return this.falhaDeIndisponibilidadeDeBaralhos();
      }

      return this.falhaDeIndisponibilidadeDeBaralhos();
    } catch {
      return this.falhaDeIndisponibilidadeDeBaralhos();
    }
  }

  async obterBaralho(id: string): Promise<ResultadoDeObterBaralho> {
    try {
      const resposta = await fetch(
        `${this.endereco}/baralhos/${encodeURIComponent(id)}`,
      );

      if (resposta.status === 200) {
        const baralho = lerBaralhoComCartoes(await resposta.json());

        if (baralho !== null) {
          return { ok: true, baralho };
        }

        return this.falhaDeIndisponibilidadeDeBaralhos();
      }

      if (resposta.status === 404) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "nao_encontrado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidadeDeBaralhos();
    } catch {
      return this.falhaDeIndisponibilidadeDeBaralhos();
    }
  }

  async vincular(
    cartaoId: string,
    baralhoId: string,
  ): Promise<ResultadoDeVinculacao> {
    try {
      const resposta = await fetch(
        `${this.endereco}/baralhos/${encodeURIComponent(baralhoId)}/vinculos`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cartaoId }),
        },
      );

      if (resposta.status === 201) {
        return { ok: true };
      }

      if (resposta.status === 404) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "nao_encontrado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      if (resposta.status === 409) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "vinculo_duplicado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidadeDeVinculos();
    } catch {
      return this.falhaDeIndisponibilidadeDeVinculos();
    }
  }

  async desvincular(
    cartaoId: string,
    baralhoId: string,
  ): Promise<ResultadoDeDesvinculacao> {
    try {
      const resposta = await fetch(
        `${this.endereco}/baralhos/${encodeURIComponent(baralhoId)}/vinculos/${encodeURIComponent(cartaoId)}`,
        { method: "DELETE" },
      );

      if (resposta.status === 204) {
        return { ok: true };
      }

      if (resposta.status === 404) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "vinculo_nao_encontrado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidadeDeVinculos();
    } catch {
      return this.falhaDeIndisponibilidadeDeVinculos();
    }
  }

  async editarCartao(
    id: string,
    frente: string,
    verso: string,
  ): Promise<ResultadoDeEdicaoDeCartao> {
    try {
      const resposta = await fetch(
        `${this.endereco}/cartoes/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ frente, verso }),
        },
      );

      if (resposta.status === 200) {
        const cartao = lerCartao(await resposta.json());

        if (cartao !== null) {
          return { ok: true, cartao };
        }

        return this.falhaDeIndisponibilidade();
      }

      if (resposta.status === 400) {
        return this.traduzirRecusaDeCartao(await resposta.json());
      }

      if (resposta.status === 404) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "nao_encontrado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidade();
    } catch {
      return this.falhaDeIndisponibilidade();
    }
  }

  async renomearBaralho(
    id: string,
    nome: string,
  ): Promise<ResultadoDeRenomeacaoDeBaralho> {
    try {
      const resposta = await fetch(
        `${this.endereco}/baralhos/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ nome }),
        },
      );

      if (resposta.status === 200) {
        const baralho = lerBaralho(await resposta.json());

        if (baralho !== null) {
          return { ok: true, baralho };
        }

        return this.falhaDeIndisponibilidadeDeBaralhos();
      }

      if (resposta.status === 400) {
        return this.traduzirRecusaDeBaralho(await resposta.json());
      }

      if (resposta.status === 404) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "nao_encontrado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidadeDeBaralhos();
    } catch {
      return this.falhaDeIndisponibilidadeDeBaralhos();
    }
  }

  async excluirCartao(id: string): Promise<ResultadoDeExclusaoDeCartao> {
    try {
      const resposta = await fetch(
        `${this.endereco}/cartoes/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );

      if (resposta.status === 204) {
        return { ok: true };
      }

      if (resposta.status === 404) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "nao_encontrado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidade();
    } catch {
      return this.falhaDeIndisponibilidade();
    }
  }

  async excluirBaralho(id: string): Promise<ResultadoDeExclusaoDeBaralho> {
    try {
      const resposta = await fetch(
        `${this.endereco}/baralhos/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );

      if (resposta.status === 204) {
        return { ok: true };
      }

      if (resposta.status === 404) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "nao_encontrado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidadeDeBaralhos();
    } catch {
      return this.falhaDeIndisponibilidadeDeBaralhos();
    }
  }

  /**
   * Traduz a recusa uniforme do contrato de Cartões (`{ erro, mensagem }`) no
   * modo de erro correspondente. Um código que não seja regra de Cartão — por
   * exemplo `corpo_invalido` — não atravessa a Interface: vira
   * `indisponivel`, e a operação continua não concluída.
   */
  private traduzirRecusaDeCartao(corpo: unknown): {
    ok: false;
    erro: CodigoDeErroDeCartao | typeof INDISPONIVEL;
    mensagem: string;
  } {
    if (ehCorpoDeRecusaDeCartao(corpo)) {
      return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
    }

    return this.falhaDeIndisponibilidade();
  }

  /**
   * Traduz a recusa uniforme do contrato de Baralhos no modo de erro
   * correspondente. Um código que não seja regra de Baralho vira
   * `indisponivel`, e a operação continua não concluída.
   */
  private traduzirRecusaDeBaralho(corpo: unknown): {
    ok: false;
    erro: CodigoDeErroDeBaralho | typeof INDISPONIVEL;
    mensagem: string;
  } {
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

  private falhaDeIndisponibilidadeDeVinculos(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
    };
  }
}

/**
 * Reconhece o corpo de recusa do contrato de Cartões: código estável de regra
 * de Cartão e mensagem em texto. Qualquer outra forma é tratada como
 * indisponibilidade.
 */
function ehCorpoDeRecusaDeCartao(
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

/**
 * Reconhece um corpo de recusa com exatamente o código informado. Usado nas
 * operações em que o contrato prevê um único código para o status — qualquer
 * outro código, ainda que exista em outra rota, é resposta fora do contrato e
 * vira `indisponivel`.
 */
function ehCorpoDeRecusaComCodigo<Codigo extends string>(
  corpo: unknown,
  codigo: Codigo,
): corpo is { erro: Codigo; mensagem: string } {
  if (typeof corpo !== "object" || corpo === null) {
    return false;
  }

  const campos = corpo as Record<string, unknown>;

  return campos.erro === codigo && typeof campos.mensagem === "string";
}

function lerCartao(corpo: unknown): Cartao | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (
    typeof campos.id !== "string" ||
    typeof campos.frente !== "string" ||
    typeof campos.verso !== "string"
  ) {
    return null;
  }

  return {
    id: campos.id,
    frente: campos.frente,
    verso: campos.verso,
  };
}

function lerBaralho(corpo: unknown): Baralho | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (typeof campos.id !== "string" || typeof campos.nome !== "string") {
    return null;
  }

  return {
    id: campos.id,
    nome: campos.nome,
  };
}

function lerCartaoListado(corpo: unknown): CartaoListado | null {
  const cartao = lerCartao(corpo);

  if (cartao === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (!Array.isArray(campos.baralhos)) {
    return null;
  }

  const baralhos: Baralho[] = [];

  for (const item of campos.baralhos) {
    const baralho = lerBaralho(item);

    if (baralho === null) {
      return null;
    }

    baralhos.push(baralho);
  }

  return { ...cartao, baralhos };
}

function lerListaDeCartoesListados(corpo: unknown): CartaoListado[] | null {
  if (!Array.isArray(corpo)) {
    return null;
  }

  const cartoes: CartaoListado[] = [];

  for (const item of corpo) {
    const cartao = lerCartaoListado(item);

    if (cartao === null) {
      return null;
    }

    cartoes.push(cartao);
  }

  return cartoes;
}

function lerBaralhoListado(corpo: unknown): BaralhoListado | null {
  const baralho = lerBaralho(corpo);

  if (baralho === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;
  const quantidadeDeCartoes = campos.quantidadeDeCartoes;
  const elegivel = campos.elegivel;

  if (typeof quantidadeDeCartoes !== "number" || typeof elegivel !== "boolean") {
    return null;
  }

  return {
    ...baralho,
    quantidadeDeCartoes,
    elegivel,
  };
}

function lerListaDeBaralhosListados(corpo: unknown): BaralhoListado[] | null {
  if (!Array.isArray(corpo)) {
    return null;
  }

  const baralhos: BaralhoListado[] = [];

  for (const item of corpo) {
    const baralho = lerBaralhoListado(item);

    if (baralho === null) {
      return null;
    }

    baralhos.push(baralho);
  }

  return baralhos;
}

function lerBaralhoComCartoes(corpo: unknown): BaralhoComCartoes | null {
  const baralho = lerBaralho(corpo);

  if (baralho === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;
  const elegivel = campos.elegivel;
  const cartoesVinculados = campos.cartoes;

  if (typeof elegivel !== "boolean" || !Array.isArray(cartoesVinculados)) {
    return null;
  }

  const cartoes: Cartao[] = [];

  for (const item of cartoesVinculados) {
    const cartao = lerCartao(item);

    if (cartao === null) {
      return null;
    }

    cartoes.push(cartao);
  }

  return {
    ...baralho,
    elegivel,
    cartoes,
  };
}
