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
import { validarFrente, validarVerso } from "./validacao";

/**
 * Adapter em memória do `ClienteDoAcervo` (T008).
 *
 * Stand-in da API inteira para teste: com ele, a interface gráfica é testável
 * sem servidor (plan.md). Reproduz o contrato de Cartões — os quatro modos de
 * recusa de domínio com as mesmas mensagens da API — para que a bateria
 * compartilhada produza resultados idênticos aos do `ClienteHttp`.
 *
 * A indisponibilidade do transporte, que no `ClienteHttp` nasce da rede, aqui
 * é simulada por `simularIndisponibilidade()`; enquanto simulada, nenhuma
 * operação é concluída nem gravada (FR-044).
 */
export class ClienteEmMemoria implements ClienteDoAcervo {
  private readonly cartoes: Cartao[] = [];
  private sequencia = 0;
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
