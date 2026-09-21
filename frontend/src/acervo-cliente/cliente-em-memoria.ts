import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
} from "./cliente";
import type {
  Baralho,
  Cartao,
  ClienteDoAcervo,
  DadosDeBaralho,
  DadosDeCartao,
  ResultadoDeCriacaoDeBaralho,
  ResultadoDeCriacaoDeCartao,
  ResultadoDeListagemDeBaralhos,
  ResultadoDeListagemDeCartoes,
} from "./cliente";
import { validarFrente, validarNomeDeBaralho, validarVerso } from "./validacao";

/**
 * Adapter em memória do `ClienteDoAcervo` (T008, T106).
 *
 * Stand-in da API inteira para teste: com ele, a interface gráfica é testável
 * sem servidor (plan.md). Reproduz os contratos de Cartões e de Baralhos — os
 * modos de recusa de domínio com as mesmas mensagens da API — para que a
 * bateria compartilhada produza resultados idênticos aos do `ClienteHttp`.
 *
 * A indisponibilidade do transporte, que no `ClienteHttp` nasce da rede, aqui
 * é simulada por `simularIndisponibilidade()`; enquanto simulada, nenhuma
 * operação é concluída nem gravada (FR-044).
 */
export class ClienteEmMemoria implements ClienteDoAcervo {
  private readonly cartoes: Cartao[] = [];
  private readonly baralhos: Baralho[] = [];
  private sequencia = 0;
  private sequenciaDeBaralhos = 0;
  private indisponivel = false;

  async criarCartao(
    dados: DadosDeCartao,
  ): Promise<ResultadoDeCriacaoDeCartao> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
      };
    }

    const falha = validarFrente(dados.frente) ?? validarVerso(dados.verso);

    if (falha !== null) {
      return { ok: false, ...falha };
    }

    const cartao: Cartao = {
      id: `c${++this.sequencia}`,
      frente: dados.frente,
      verso: dados.verso,
    };

    this.cartoes.push(cartao);

    return { ok: true, cartao };
  }

  async listarCartoes(): Promise<ResultadoDeListagemDeCartoes> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
      };
    }

    return { ok: true, cartoes: [...this.cartoes] };
  }

  async criarBaralho(
    dados: DadosDeBaralho,
  ): Promise<ResultadoDeCriacaoDeBaralho> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
      };
    }

    const falha = validarNomeDeBaralho(dados.nome);

    if (falha !== null) {
      return { ok: false, ...falha };
    }

    const baralho: Baralho = {
      id: `b${++this.sequenciaDeBaralhos}`,
      nome: dados.nome,
    };

    this.baralhos.push(baralho);

    return { ok: true, baralho };
  }

  async listarBaralhos(): Promise<ResultadoDeListagemDeBaralhos> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
      };
    }

    return {
      ok: true,
      baralhos: this.baralhos.map((baralho) => {
        // Derivada na leitura, nunca armazenada. Nesta feature não há
        // vínculo Baralho–Cartão: a contagem é 0 e a elegibilidade é falsa.
        const quantidadeDeCartoes = 0;

        return {
          ...baralho,
          quantidadeDeCartoes,
          elegivel: quantidadeDeCartoes > 0,
        };
      }),
    };
  }

  /**
   * Simula a indisponibilidade do transporte (uso de teste). Enquanto
   * simulada, nenhuma operação é concluída nem gravada.
   */
  simularIndisponibilidade(): void {
    this.indisponivel = true;
  }

  /** Encerra a simulação de indisponibilidade (uso de teste). */
  restaurarDisponibilidade(): void {
    this.indisponivel = false;
  }
}
