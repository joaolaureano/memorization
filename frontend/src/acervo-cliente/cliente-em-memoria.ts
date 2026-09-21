import {
  INDISPONIVEL,
  MENSAGEM_DE_CREDENCIAL_INVALIDA,
  MENSAGEM_DE_INDISPONIBILIDADE,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
  MENSAGEM_DE_NAO_AUTENTICADO,
  NAO_AUTENTICADO,
} from "./cliente";
import type {
  Baralho,
  BaralhoComCartoes,
  Cartao,
  ClienteDoAcervo,
  Credencial,
  DadosDeBaralho,
  DadosDeCartao,
  DadosDeUsuario,
  ResultadoDeCriacaoDeBaralho,
  ResultadoDeCriacaoDeCartao,
  ResultadoDeCriacaoDeUsuario,
  ResultadoDeDesvinculacao,
  ResultadoDeEdicaoDeCartao,
  ResultadoDeEntrar,
  ResultadoDeExclusaoDeBaralho,
  ResultadoDeExclusaoDeCartao,
  ResultadoDeListagemDeBaralhos,
  ResultadoDeListagemDeCartoes,
  ResultadoDeObterBaralho,
  ResultadoDeRenomeacaoDeBaralho,
  ResultadoDeVinculacao,
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
 * Adapter em memória do `ClienteDoAcervo` (T008, T106, T208, T403, T503, T607;
 * T707 de specs/008-entrar/tasks.md).
 *
 * Stand-in da API inteira para teste: com ele, a interface gráfica é testável
 * sem servidor (plan.md). Reproduz os contratos de Cartões, de Baralhos, de
 * Vínculos, de edição, de exclusão, de Usuários e de Entrar — os modos de
 * recusa de domínio com as mesmas mensagens da API —, para que a bateria
 * compartilhada produza resultados idênticos aos do `ClienteHttp`.
 *
 * A Credencial chega pela construção, como no `ClienteHttp`, e é ela que
 * identifica o dono de cada operação: sem Credencial, ou com Credencial que
 * não corresponde a um Usuário cadastrado, toda operação de acervo é recusada
 * com `nao_autenticado` e nada muda (FR-090, SC-028). Os Cartões, Baralhos e
 * Vínculos ficam escopados pelo Usuário — o conteúdo de um não aparece para o
 * outro e se comporta como inexistente, com a mesma recusa de um id que nunca
 * existiu (FR-092, SC-030).
 *
 * A indisponibilidade do transporte, que no `ClienteHttp` nasce da rede, aqui
 * é simulada por `simularIndisponibilidade()`; enquanto simulada, nenhuma
 * operação é concluída nem gravada (FR-044).
 */
export class ClienteEmMemoria implements ClienteDoAcervo {
  /**
   * O estado do stand-in — os Usuários, o acervo e a sequência de ids —,
   * compartilhável entre clientes por `comoUsuario` (FR-092).
   */
  private base: BaseEmMemoria;

  /**
   * A Credencial apresentada em toda operação, ou `null` enquanto a pessoa não
   * tiver entrado. Vive apenas aqui, como viveria no estado da página aberta
   * (FR-089), e nunca é gravada em armazenamento do navegador (SC-033).
   */
  private readonly credencial: Credencial | null;

  private indisponivel = false;

  /**
   * Cria o Adapter sobre uma base nova.
   *
   * `usuariosJaCadastrados` são os Usuários que a base já tem — o Cadastro
   * feito antes da prova começar. Existe para que uma prova de tela possa
   * operar o acervo já autenticada sem percorrer a tela "Criar conta" antes:
   * quando o Cadastro é o objeto da prova, ele continua sendo o único caminho
   * exercitado, por `criarUsuario`.
   */
  constructor(
    credencial: Credencial | null = null,
    usuariosJaCadastrados: readonly DadosDeUsuario[] = [],
  ) {
    this.credencial = credencial;
    this.base = novaBaseEmMemoria(usuariosJaCadastrados);
  }

  async entrar(credencial: Credencial): Promise<ResultadoDeEntrar> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
      };
    }

    // Espaços ao redor do Nome de usuário são descartados e a comparação não
    // distingue maiúsculas de minúsculas; a Senha é comparada exatamente
    // (FR-087, SC-036). A recusa é a mesma nos dois casos, com a mensagem
    // única do contrato (FR-088), e nada da Senha atravessa a Interface
    // (FR-078).
    const usuario = this.usuarioDaCredencial(credencial);

    if (usuario === null) {
      return {
        ok: false,
        erro: NAO_AUTENTICADO,
        mensagem: MENSAGEM_DE_CREDENCIAL_INVALIDA,
      };
    }

    return {
      ok: true,
      usuario: { id: usuario.id, nomeDeUsuario: usuario.nomeDeUsuario },
    };
  }

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

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    const falha = validarFrente(dados.frente) ?? validarVerso(dados.verso);

    if (falha !== null) {
      return { ok: false, ...falha };
    }

    const cartao: CartaoDoDono = {
      id: `c${++this.base.sequenciaDeCartoes}`,
      usuarioId: dono.id,
      frente: dados.frente,
      verso: dados.verso,
    };

    this.base.cartoes.push(cartao);

    return { ok: true, cartao: cartaoSemDono(cartao) };
  }

  async listarCartoes(): Promise<ResultadoDeListagemDeCartoes> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
      };
    }

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    return {
      ok: true,
      cartoes: this.base.cartoes
        .filter((cartao) => cartao.usuarioId === dono.id)
        .map((cartao) => ({
          ...cartaoSemDono(cartao),
          baralhos: this.baralhosDoCartao(dono.id, cartao.id),
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

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    const falha = validarNomeDeBaralho(dados.nome);

    if (falha !== null) {
      return { ok: false, ...falha };
    }

    const baralho: BaralhoDoDono = {
      id: `b${++this.base.sequenciaDeBaralhos}`,
      usuarioId: dono.id,
      nome: dados.nome,
    };

    this.base.baralhos.push(baralho);

    return { ok: true, baralho: baralhoSemDono(baralho) };
  }

  async listarBaralhos(): Promise<ResultadoDeListagemDeBaralhos> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
      };
    }

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    return {
      ok: true,
      baralhos: this.base.baralhos
        .filter((baralho) => baralho.usuarioId === dono.id)
        .map((baralho) => {
          // Derivada na leitura, nunca armazenada (FR-024): a contagem vem dos
          // Vínculos **do dono** e a elegibilidade é contagem maior que zero.
          const quantidadeDeCartoes = this.base.vinculos.filter(
            (vinculo) =>
              vinculo.usuarioId === dono.id &&
              vinculo.baralhoId === baralho.id,
          ).length;

          return {
            ...baralhoSemDono(baralho),
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

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    // O Baralho de outro Usuário não existe neste escopo e cai na mesma recusa
    // de um id que nunca existiu (FR-092, SC-030).
    const baralho = this.base.baralhos.find(
      (item) => item.id === id && item.usuarioId === dono.id,
    );

    if (baralho === undefined) {
      return {
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Baralho não encontrado.",
      };
    }

    const cartoes = this.base.vinculos
      .filter(
        (vinculo) =>
          vinculo.usuarioId === dono.id && vinculo.baralhoId === baralho.id,
      )
      .map((vinculo) =>
        this.base.cartoes.find((cartao) => cartao.id === vinculo.cartaoId),
      )
      .filter((cartao): cartao is CartaoDoDono => cartao !== undefined)
      .map((cartao) => cartaoSemDono(cartao));

    const baralhoComCartoes: BaralhoComCartoes = {
      ...baralhoSemDono(baralho),
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

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    // Cartão e Baralho precisam existir **no escopo de quem pede**: um Vínculo
    // une somente um Cartão e um Baralho do mesmo Usuário (FR-093), e o par
    // com o conteúdo de outro Usuário é o mesmo `nao_encontrado` (FR-092).
    if (
      !this.base.cartoes.some(
        (cartao) => cartao.id === cartaoId && cartao.usuarioId === dono.id,
      )
    ) {
      return {
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Cartão não encontrado.",
      };
    }

    if (
      !this.base.baralhos.some(
        (baralho) => baralho.id === baralhoId && baralho.usuarioId === dono.id,
      )
    ) {
      return {
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Baralho não encontrado.",
      };
    }

    if (
      this.base.vinculos.some(
        (vinculo) =>
          vinculo.usuarioId === dono.id &&
          vinculo.cartaoId === cartaoId &&
          vinculo.baralhoId === baralhoId,
      )
    ) {
      return {
        ok: false,
        erro: "vinculo_duplicado",
        mensagem: "O vínculo já existe.",
      };
    }

    this.base.vinculos.push({
      usuarioId: dono.id,
      cartaoId,
      baralhoId,
    });

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

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    const indice = this.base.vinculos.findIndex(
      (vinculo) =>
        vinculo.usuarioId === dono.id &&
        vinculo.cartaoId === cartaoId &&
        vinculo.baralhoId === baralhoId,
    );

    if (indice === -1) {
      return {
        ok: false,
        erro: "vinculo_nao_encontrado",
        mensagem: "O vínculo não existe.",
      };
    }

    this.base.vinculos.splice(indice, 1);

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

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    const indice = this.base.cartoes.findIndex(
      (cartao) => cartao.id === id && cartao.usuarioId === dono.id,
    );

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

    const cartao: CartaoDoDono = { id, usuarioId: dono.id, frente, verso };

    this.base.cartoes[indice] = cartao;

    return { ok: true, cartao: cartaoSemDono(cartao) };
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

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    const indice = this.base.baralhos.findIndex(
      (baralho) => baralho.id === id && baralho.usuarioId === dono.id,
    );

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

    const baralho: BaralhoDoDono = { id, usuarioId: dono.id, nome };

    this.base.baralhos[indice] = baralho;

    return { ok: true, baralho: baralhoSemDono(baralho) };
  }

  async excluirCartao(id: string): Promise<ResultadoDeExclusaoDeCartao> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
      };
    }

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    const indice = this.base.cartoes.findIndex(
      (cartao) => cartao.id === id && cartao.usuarioId === dono.id,
    );

    if (indice === -1) {
      return {
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Cartão não encontrado.",
      };
    }

    this.base.cartoes.splice(indice, 1);
    this.removerVinculosDoCartao(dono.id, id);

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

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    const indice = this.base.baralhos.findIndex(
      (baralho) => baralho.id === id && baralho.usuarioId === dono.id,
    );

    if (indice === -1) {
      return {
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Baralho não encontrado.",
      };
    }

    this.base.baralhos.splice(indice, 1);
    this.removerVinculosDoBaralho(dono.id, id);

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
    const jaExiste = this.base.usuarios.some(
      (usuario) => usuario.nomeDeUsuario.toLowerCase() === chave,
    );

    if (jaExiste) {
      return { ok: false, ...NOME_DE_USUARIO_EXISTENTE };
    }

    const usuario: UsuarioDaBase = {
      id: `u${++this.base.sequenciaDeUsuarios}`,
      nomeDeUsuario,
      senha: dados.senha,
    };

    this.base.usuarios.push(usuario);

    // A Senha fica na base do stand-in apenas para verificar o próximo Entrar,
    // como o `sal` e o `hash` ficam na base da API: nenhum retorno a devolve
    // (FR-076, FR-078).
    return {
      ok: true,
      usuario: { id: usuario.id, nomeDeUsuario: usuario.nomeDeUsuario },
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

  /**
   * Esquece o Usuário informado, como a API faria se ele deixasse de existir
   * (uso de prova): a Credencial dele deixa de valer, e toda operação do acervo
   * passa a ser recusada com `nao_autenticado` — o roteiro de FR-091, em que a
   * Credencial é descartada e a pessoa volta a Entrar. O acervo do Usuário
   * permanece na base, intacto.
   */
  esquecerUsuario(nomeDeUsuario: string): void {
    const chave = nomeDeUsuario.trim().toLowerCase();
    const indice = this.base.usuarios.findIndex(
      (usuario) => usuario.nomeDeUsuario.toLowerCase() === chave,
    );

    if (indice >= 0) {
      this.base.usuarios.splice(indice, 1);
    }
  }

  /**
   * Outro cliente sobre a **mesma** base, com a Credencial informada (uso de
   * prova): é assim que uma prova de isolamento opera dois Usuários contra o
   * mesmo stand-in, como faria contra a API real, em que dois clientes
   * conversam com o mesmo acervo (FR-092, SC-030).
   */
  comoUsuario(credencial: Credencial | null): ClienteEmMemoria {
    const outro = new ClienteEmMemoria(credencial);

    outro.base = this.base;

    return outro;
  }

  /**
   * O Usuário dono das operações deste cliente, ou `null` quando não há
   * Credencial válida — o que recusa toda operação do acervo com
   * `nao_autenticado` (FR-090).
   */
  private dono(): UsuarioDaBase | null {
    if (this.credencial === null) {
      return null;
    }

    return this.usuarioDaCredencial(this.credencial);
  }

  /**
   * O Usuário da Credencial informada, com as regras do contrato: espaços ao
   * redor do Nome de usuário descartados, comparação sem distinguir maiúsculas
   * e Senha comparada exatamente (FR-087).
   */
  private usuarioDaCredencial(credencial: Credencial): UsuarioDaBase | null {
    const chave = credencial.nomeDeUsuario.trim().toLowerCase();
    const usuario = this.base.usuarios.find(
      (candidato) => candidato.nomeDeUsuario.toLowerCase() === chave,
    );

    if (usuario === undefined || usuario.senha !== credencial.senha) {
      return null;
    }

    return usuario;
  }

  private falhaDeNaoAutenticado(): {
    ok: false;
    erro: typeof NAO_AUTENTICADO;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: NAO_AUTENTICADO,
      mensagem: MENSAGEM_DE_NAO_AUTENTICADO,
    };
  }

  private baralhosDoCartao(usuarioId: string, cartaoId: string): Baralho[] {
    return this.base.vinculos
      .filter(
        (vinculo) =>
          vinculo.usuarioId === usuarioId && vinculo.cartaoId === cartaoId,
      )
      .map((vinculo) =>
        this.base.baralhos.find(
          (baralho) =>
            baralho.id === vinculo.baralhoId &&
            baralho.usuarioId === usuarioId,
        ),
      )
      .filter((baralho): baralho is BaralhoDoDono => baralho !== undefined)
      .map((baralho) => baralhoSemDono(baralho));
  }

  private removerVinculosDoCartao(usuarioId: string, cartaoId: string): void {
    for (let indice = this.base.vinculos.length - 1; indice >= 0; indice -= 1) {
      const vinculo = this.base.vinculos[indice];

      if (vinculo.usuarioId === usuarioId && vinculo.cartaoId === cartaoId) {
        this.base.vinculos.splice(indice, 1);
      }
    }
  }

  private removerVinculosDoBaralho(usuarioId: string, baralhoId: string): void {
    for (let indice = this.base.vinculos.length - 1; indice >= 0; indice -= 1) {
      const vinculo = this.base.vinculos[indice];

      if (vinculo.usuarioId === usuarioId && vinculo.baralhoId === baralhoId) {
        this.base.vinculos.splice(indice, 1);
      }
    }
  }
}

/**
 * O estado do stand-in: os Usuários e o acervo que os clientes de prova
 * compartilham, mais a sequência de ids opacos.
 */
interface BaseEmMemoria {
  usuarios: UsuarioDaBase[];
  cartoes: CartaoDoDono[];
  baralhos: BaralhoDoDono[];
  vinculos: VinculoDoDono[];
  sequenciaDeCartoes: number;
  sequenciaDeBaralhos: number;
  sequenciaDeUsuarios: number;
}

/**
 * Usuário na base do stand-in.
 *
 * A Senha existe **apenas** para verificar o próximo Entrar, como o `sal` e o
 * `hash` existem na base da API: ela não atravessa a Interface em nenhum
 * retorno (FR-076, FR-078) e não é gravada em armazenamento do navegador
 * (SC-033).
 */
interface UsuarioDaBase {
  id: string;
  nomeDeUsuario: string;
  senha: string;
}

/** Cartão com o dono: o `usuarioId` é o escopo de toda operação (FR-092). */
interface CartaoDoDono extends Cartao {
  usuarioId: string;
}

/** Baralho com o dono: o `usuarioId` é o escopo de toda operação (FR-092). */
interface BaralhoDoDono extends Baralho {
  usuarioId: string;
}

/** Vínculo com o dono, que é sempre o mesmo do Cartão e do Baralho (FR-093). */
interface VinculoDoDono {
  usuarioId: string;
  cartaoId: string;
  baralhoId: string;
}

/** Uma base nova, já com os Usuários que a prova informou. */
function novaBaseEmMemoria(
  usuariosJaCadastrados: readonly DadosDeUsuario[],
): BaseEmMemoria {
  const base: BaseEmMemoria = {
    usuarios: [],
    cartoes: [],
    baralhos: [],
    vinculos: [],
    sequenciaDeCartoes: 0,
    sequenciaDeBaralhos: 0,
    sequenciaDeUsuarios: 0,
  };

  for (const dados of usuariosJaCadastrados) {
    base.usuarios.push({
      id: `u${++base.sequenciaDeUsuarios}`,
      nomeDeUsuario: dados.nomeDeUsuario.trim(),
      senha: dados.senha,
    });
  }

  return base;
}

/** O Cartão como a Interface o devolve: sem o dono, que é Implementation. */
function cartaoSemDono(cartao: CartaoDoDono): Cartao {
  return { id: cartao.id, frente: cartao.frente, verso: cartao.verso };
}

/** O Baralho como a Interface o devolve: sem o dono, que é Implementation. */
function baralhoSemDono(baralho: BaralhoDoDono): Baralho {
  return { id: baralho.id, nome: baralho.nome };
}
