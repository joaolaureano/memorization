import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
} from "./cliente";
import type {
  Baralho,
  BaralhoComCartoes,
  Cartao,
  ClienteDoAcervo,
  DadosDeBaralho,
  DadosDeCartao,
  DadosDeUsuario,
  ResultadoDeCriacaoDeBaralho,
  ResultadoDeCriacaoDeCartao,
  ResultadoDeCriacaoDeUsuario,
  ResultadoDeDesvinculacao,
  ResultadoDeEdicaoDeCartao,
  ResultadoDeExclusaoDeBaralho,
  ResultadoDeExclusaoDeCartao,
  ResultadoDeListagemDeBaralhos,
  ResultadoDeListagemDeCartoes,
  ResultadoDeObterBaralho,
  ResultadoDeRenomeacaoDeBaralho,
  ResultadoDeVinculacao,
  Usuario,
} from "./cliente";
import {
  NOME_DE_USUARIO_EXISTENTE,
  validarFrente,
  validarNomeDeBaralho,
  validarNomeDeUsuario,
  validarSenha,
  validarVerso,
} from "./validacao";

/**
 * Adapter em memória do `ClienteDoAcervo` (T008, T106, T208, T403, T503, T607).
 *
 * Stand-in da API inteira para teste: com ele, a interface gráfica é testável
 * sem servidor (plan.md). Reproduz os contratos de Cartões, de Baralhos, de
 * Vínculos, de edição, de exclusão e de Usuários — os modos de recusa de
 * domínio com as mesmas mensagens da API — para que a bateria compartilhada
 * produza resultados idênticos aos do `ClienteHttp`.
 *
 * A indisponibilidade do transporte, que no `ClienteHttp` nasce da rede, aqui
 * é simulada por `simularIndisponibilidade()`; enquanto simulada, nenhuma
 * operação é concluída nem gravada (FR-044).
 */
export class ClienteEmMemoria implements ClienteDoAcervo {
  private readonly cartoes: Cartao[] = [];
  private readonly baralhos: Baralho[] = [];
  private readonly vinculos: { cartaoId: string; baralhoId: string }[] = [];
  /**
   * Os Usuários cadastrados, na forma da Interface: `id` e `nomeDeUsuario`.
   * Nenhum campo capaz de guardar a Senha existe aqui — nem no stand-in
   * (FR-076, FR-078).
   */
  private readonly usuarios: Usuario[] = [];
  private sequencia = 0;
  private sequenciaDeBaralhos = 0;
  private sequenciaDeUsuarios = 0;
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

    return {
      ok: true,
      cartoes: this.cartoes.map((cartao) => ({
        ...cartao,
        baralhos: this.baralhosDoCartao(cartao.id),
      })),
    };
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
        // Derivada na leitura, nunca armazenada (FR-024): a contagem vem dos
        // Vínculos e a elegibilidade é contagem maior que zero.
        const quantidadeDeCartoes = this.vinculos.filter(
          (vinculo) => vinculo.baralhoId === baralho.id,
        ).length;

        return {
          ...baralho,
          quantidadeDeCartoes,
          elegivel: quantidadeDeCartoes > 0,
        };
      }),
    };
  }

  async obterBaralho(id: string): Promise<ResultadoDeObterBaralho> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
      };
    }

    const baralho = this.baralhos.find((item) => item.id === id);

    if (baralho === undefined) {
      return {
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Baralho não encontrado.",
      };
    }

    const cartoes = this.vinculos
      .filter((vinculo) => vinculo.baralhoId === id)
      .map((vinculo) =>
        this.cartoes.find((cartao) => cartao.id === vinculo.cartaoId),
      )
      .filter((cartao): cartao is Cartao => cartao !== undefined)
      .map((cartao) => ({
        id: cartao.id,
        frente: cartao.frente,
        verso: cartao.verso,
      }));

    const baralhoComCartoes: BaralhoComCartoes = {
      id: baralho.id,
      nome: baralho.nome,
      elegivel: cartoes.length > 0,
      cartoes,
    };

    return { ok: true, baralho: baralhoComCartoes };
  }

  async vincular(
    cartaoId: string,
    baralhoId: string,
  ): Promise<ResultadoDeVinculacao> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
      };
    }

    if (!this.cartoes.some((cartao) => cartao.id === cartaoId)) {
      return {
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Cartão não encontrado.",
      };
    }

    if (!this.baralhos.some((baralho) => baralho.id === baralhoId)) {
      return {
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Baralho não encontrado.",
      };
    }

    if (
      this.vinculos.some(
        (vinculo) =>
          vinculo.cartaoId === cartaoId && vinculo.baralhoId === baralhoId,
      )
    ) {
      return {
        ok: false,
        erro: "vinculo_duplicado",
        mensagem: "O vínculo já existe.",
      };
    }

    this.vinculos.push({ cartaoId, baralhoId });

    return { ok: true };
  }

  async desvincular(
    cartaoId: string,
    baralhoId: string,
  ): Promise<ResultadoDeDesvinculacao> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
      };
    }

    const indice = this.vinculos.findIndex(
      (vinculo) =>
        vinculo.cartaoId === cartaoId && vinculo.baralhoId === baralhoId,
    );

    if (indice === -1) {
      return {
        ok: false,
        erro: "vinculo_nao_encontrado",
        mensagem: "O vínculo não existe.",
      };
    }

    this.vinculos.splice(indice, 1);

    return { ok: true };
  }

  async editarCartao(
    id: string,
    frente: string,
    verso: string,
  ): Promise<ResultadoDeEdicaoDeCartao> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
      };
    }

    const indice = this.cartoes.findIndex((cartao) => cartao.id === id);

    if (indice === -1) {
      return {
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Cartão não encontrado.",
      };
    }

    const falha = validarFrente(frente) ?? validarVerso(verso);

    if (falha !== null) {
      return { ok: false, ...falha };
    }

    const cartao: Cartao = { id, frente, verso };

    this.cartoes[indice] = cartao;

    return { ok: true, cartao };
  }

  async renomearBaralho(
    id: string,
    nome: string,
  ): Promise<ResultadoDeRenomeacaoDeBaralho> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
      };
    }

    const indice = this.baralhos.findIndex((baralho) => baralho.id === id);

    if (indice === -1) {
      return {
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Baralho não encontrado.",
      };
    }

    const falha = validarNomeDeBaralho(nome);

    if (falha !== null) {
      return { ok: false, ...falha };
    }

    const baralho: Baralho = { id, nome };

    this.baralhos[indice] = baralho;

    return { ok: true, baralho };
  }

  async excluirCartao(id: string): Promise<ResultadoDeExclusaoDeCartao> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
      };
    }

    const indice = this.cartoes.findIndex((cartao) => cartao.id === id);

    if (indice === -1) {
      return {
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Cartão não encontrado.",
      };
    }

    this.cartoes.splice(indice, 1);
    this.removerVinculosDoCartao(id);

    return { ok: true };
  }

  async excluirBaralho(id: string): Promise<ResultadoDeExclusaoDeBaralho> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
      };
    }

    const indice = this.baralhos.findIndex((baralho) => baralho.id === id);

    if (indice === -1) {
      return {
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Baralho não encontrado.",
      };
    }

    this.baralhos.splice(indice, 1);
    this.removerVinculosDoBaralho(id);

    return { ok: true };
  }

  async criarUsuario(
    dados: DadosDeUsuario,
  ): Promise<ResultadoDeCriacaoDeUsuario> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
      };
    }

    // Espaços ao redor são descartados **antes** da validação, como na API
    // (FR-073); os da Senha são preservados (FR-075).
    const nomeDeUsuario = dados.nomeDeUsuario.trim();
    const falha =
      validarNomeDeUsuario(nomeDeUsuario) ?? validarSenha(dados.senha);

    if (falha !== null) {
      return { ok: false, ...falha };
    }

    // A unicidade não distingue maiúsculas de minúsculas (FR-074, SC-025).
    const chave = nomeDeUsuario.toLowerCase();
    const jaExiste = this.usuarios.some(
      (usuario) => usuario.nomeDeUsuario.toLowerCase() === chave,
    );

    if (jaExiste) {
      return { ok: false, ...NOME_DE_USUARIO_EXISTENTE };
    }

    const usuario: Usuario = {
      id: `u${++this.sequenciaDeUsuarios}`,
      nomeDeUsuario,
    };

    this.usuarios.push(usuario);

    return { ok: true, usuario };
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

  private baralhosDoCartao(cartaoId: string): Baralho[] {
    return this.vinculos
      .filter((vinculo) => vinculo.cartaoId === cartaoId)
      .map((vinculo) =>
        this.baralhos.find((baralho) => baralho.id === vinculo.baralhoId),
      )
      .filter((baralho): baralho is Baralho => baralho !== undefined)
      .map((baralho) => ({ id: baralho.id, nome: baralho.nome }));
  }

  private removerVinculosDoCartao(cartaoId: string): void {
    for (let indice = this.vinculos.length - 1; indice >= 0; indice -= 1) {
      if (this.vinculos[indice].cartaoId === cartaoId) {
        this.vinculos.splice(indice, 1);
      }
    }
  }

  private removerVinculosDoBaralho(baralhoId: string): void {
    for (let indice = this.vinculos.length - 1; indice >= 0; indice -= 1) {
      if (this.vinculos[indice].baralhoId === baralhoId) {
        this.vinculos.splice(indice, 1);
      }
    }
  }
}
