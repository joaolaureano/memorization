/**
 * Seam `Aleatoriedade` (T301; specs/004-sessao-de-estudo/plan.md).
 *
 * Esconde a fonte de números usada para definir, uma única vez, a ordem dos
 * Itens da Sessão. O Module `SessaoDeEstudo` consome somente a Interface e
 * recebe um Adapter por injeção: `AleatoriedadeReal` em produção e
 * `AleatoriedadeDeterministica` em teste. A ordem é uniforme e sem memória
 * (FR-030); o Adapter determinístico torna essa ordem estável para provar
 * ausência de repetição e imutabilidade sem testes probabilísticos frágeis.
 */
export interface Aleatoriedade {
  /**
   * Devolve um número no intervalo `[0, 1)`, como `Math.random`.
   */
  proximo(): number;
}

/**
 * Adapter real: delega a `Math.random` do ambiente de execução.
 */
export class AleatoriedadeReal implements Aleatoriedade {
  proximo(): number {
    return Math.random();
  }
}

/**
 * Adapter determinístico: devolve, em ordem, a sequência recebida na
 * construção. Quando a sequência termina, falha em vez de inventar um valor —
 * assim a Sessão nunca depende de aleatoriedade implícita durante os testes.
 */
export class AleatoriedadeDeterministica implements Aleatoriedade {
  private readonly valores: readonly number[];
  private indice = 0;

  constructor(valores: readonly number[]) {
    this.valores = [...valores];
  }

  proximo(): number {
    if (this.indice >= this.valores.length) {
      throw new Error(
        "A sequência determinística de Aleatoriedade terminou.",
      );
    }

    const valor = this.valores[this.indice];
    this.indice += 1;
    return valor;
  }
}
