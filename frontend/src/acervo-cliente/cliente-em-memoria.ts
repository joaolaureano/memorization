import {
  INDISPONIVEL,
  MENSAGEM_DE_AGENDA_INDISPONIVEL,
  MENSAGEM_DE_CONFLITO_DE_SESSAO,
  MENSAGEM_DE_CREDENCIAL_INVALIDA,
  MENSAGEM_DE_DADOS_INVALIDOS,
  MENSAGEM_DE_DADOS_INVALIDOS_DE_PREFERENCIAS,
  MENSAGEM_DE_INDISPONIBILIDADE,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_PREFERENCIAS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
  MENSAGEM_DE_NAO_AUTENTICADO,
  MENSAGEM_DE_SESSAO_NAO_ENCONTRADA,
  NAO_AUTENTICADO,
} from "./cliente";
import type {
  Avaliacao,
  Baralho,
  BaralhoComCartoes,
  Cartao,
  ClienteDoAcervo,
  Credencial,
  DadosDeBaralho,
  DadosDeCartao,
  DadosDeInicioDeCompromisso,
  DadosDeRegistro,
  DadosDeRotina,
  DadosDeUsuario,
  OpcaoDeAlgoritmo,
  Preferencias,
  Previa,
  RegistroDeSessao,
  RegistroResumido,
  ResultadoDasPrevias,
  ResultadoDeCriacaoDeBaralho,
  ResultadoDeCriacaoDeCartao,
  ResultadoDeCriacaoDeUsuario,
  ResultadoDeDesvinculacao,
  ResultadoDeEdicaoDeCartao,
  ResultadoDeEntrar,
  ResultadoDeEstatisticas,
  ResultadoDeExclusaoDeBaralho,
  ResultadoDeExclusaoDeCartao,
  ResultadoDeIniciarCompromisso,
  ResultadoDeListagemDeBaralhos,
  ResultadoDeListagemDeCartoes,
  ResultadoDeListarRotinas,
  ResultadoDeObterAgenda,
  ResultadoDeObterBaralho,
  ResultadoDeObterRegistro,
  ResultadoDePreferencias,
  ResultadoDeRegistroDeSessao,
  ResultadoDeRenomeacaoDeBaralho,
  ResultadoDeSalvarPreferencias,
  ResultadoDeSalvarRotina,
  ResultadoDeVinculacao,
  ResultadoDoItemRegistrado,
  ResultadoDoLoteDeRevisao,
  ResultadoDoResumoDaRevisao,
} from "./cliente";
import {
  NOME_DE_USUARIO_EXISTENTE,
  validarFrente,
  validarNomeDeBaralho,
  validarNomeDeUsuario,
  validarSenha,
  validarVerso,
} from "./validacao";

/** O algoritmo padrão e a lista oferecida pela tela de Preferências (FR-212). */
const ALGORITMOS_DISPONIVEIS: OpcaoDeAlgoritmo[] = [
  { id: "sm2", rotulo: "SM-2" },
];

/** O algoritmo e o limite padrão quando o Usuário nunca salvou Preferências (D5). */
const ALGORITMO_PADRAO = "sm2";
const LIMITE_DE_NOVOS_PADRAO = 20;

/**
 * A prévia fixa do stand-in, em dias, por Avaliação. **Não é o SM-2**: é uma
 * tabela simples e documentada só para a interface ser testável sem servidor
 * (D7). O algoritmo real é testado no backend.
 */
const DIAS_DA_PREVIA: Record<Avaliacao, number> = {
  errei: 1,
  dificil: 1,
  bom: 3,
  facil: 6,
};

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
   * Registra uma Sessão concluída no histórico (FR-161, FR-163).
   *
   * O `id` vem do cliente: se já existir neste Usuário, devolve o Registro
   * existente sem alterar nada — é o que torna a operação idempotente. O mesmo
   * `id` no histórico de **outro** Usuário é `conflito`: nunca se sobrescreve o
   * Registro alheio. Os totais e a `concluidaEm` são derivados aqui, como o
   * servidor os derivaria, e nunca aceitos do cliente.
   */
  /**
   * Stubs da Agenda (FR-248, FR-250): o comportamento completo chega na Onda B
   * (T1606+). Até lá, nenhuma das quatro operações é concluída nem grava.
   */
  async obterAgenda(
    _inicio: string,
    _fuso: string,
  ): Promise<ResultadoDeObterAgenda> {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_AGENDA_INDISPONIVEL,
    };
  }

  async listarRotinas(): Promise<ResultadoDeListarRotinas> {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_AGENDA_INDISPONIVEL,
    };
  }

  async salvarRotina(_dados: DadosDeRotina): Promise<ResultadoDeSalvarRotina> {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_AGENDA_INDISPONIVEL,
    };
  }

  async iniciarCompromisso(
    _dados: DadosDeInicioDeCompromisso,
  ): Promise<ResultadoDeIniciarCompromisso> {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_AGENDA_INDISPONIVEL,
    };
  }

  async registrarSessao(
    dados: DadosDeRegistro,
  ): Promise<ResultadoDeRegistroDeSessao> {
    if (this.indisponivel) {
      return this.falhaDeIndisponibilidadeDeHistorico();
    }

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    if (!dadosDeRegistroValidos(dados)) {
      return {
        ok: false,
        erro: "dados_invalidos",
        mensagem: MENSAGEM_DE_DADOS_INVALIDOS,
      };
    }

    const existente = this.base.registros.find(
      (registro) => registro.id === dados.id,
    );

    if (existente !== undefined) {
      if (existente.usuarioId !== dono.id) {
        return {
          ok: false,
          erro: "conflito",
          mensagem: MENSAGEM_DE_CONFLITO_DE_SESSAO,
        };
      }

      return { ok: true, registro: registroSemDono(existente) };
    }

    const estudados = dados.itens.length;
    const acertos = dados.itens.filter(
      (item) => resultadoDaAvaliacao(item.avaliacao) === "acertou",
    ).length;
    const ehRevisao = dados.origem === "revisao";
    const agora = new Date();

    const registro: RegistroDaBase = {
      id: dados.id,
      usuarioId: dono.id,
      origem: dados.origem,
      // Na Revisão do dia, o Baralho é derivado: sem Baralho e com o nome
      // fixo (FR-196, D5).
      baralhoId: ehRevisao ? "" : dados.baralhoId,
      nomeDoBaralho: ehRevisao ? "Revisão do dia" : dados.nomeDoBaralho,
      concluidaEm: agora.toISOString(),
      estudados,
      acertos,
      erros: estudados - acertos,
      itens: dados.itens.map((item, posicao) => ({
        posicao,
        frente: item.frente,
        verso: item.verso,
        resultado: resultadoDaAvaliacao(item.avaliacao),
        cartaoId: item.cartaoId,
        avaliacao: item.avaliacao,
      })),
    };

    this.base.registros.push(registro);

    // Só no Registro novo as Avaliações alcançam os Agendamentos (FR-210,
    // SC-085): o reenvio do mesmo `id` não reaplica nada.
    this.atualizarAgendamentos(dono.id, dados, agora);

    return { ok: true, registro: registroSemDono(registro) };
  }

  /**
   * Os números do Início (FR-164, FR-165): o tamanho atual do acervo do dono,
   * os Registros com `concluidaEm >= desde` e os 5 mais recentes, do mais
   * recente ao mais antigo.
   */
  async obterEstatisticas(desde: string): Promise<ResultadoDeEstatisticas> {
    if (this.indisponivel) {
      return this.falhaDeIndisponibilidadeDeHistorico();
    }

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    const registros = this.registrosDoDono(dono.id);

    return {
      ok: true,
      estatisticas: {
        cartoes: this.base.cartoes.filter(
          (cartao) => cartao.usuarioId === dono.id,
        ).length,
        baralhos: this.base.baralhos.filter(
          (baralho) => baralho.usuarioId === dono.id,
        ).length,
        registrosDaJanela: registros
          .filter((registro) => registro.concluidaEm >= desde)
          .map(registroResumido),
        recentes: registros.slice(0, 5).map(registroResumido),
      },
    };
  }

  /**
   * Abre um Registro do histórico com os itens na ordem apresentada e informa
   * se o Baralho da Sessão ainda existe no acervo do dono (FR-166). O Registro
   * de outro Usuário se comporta como inexistente (FR-092).
   */
  async obterRegistroDeSessao(
    id: string,
  ): Promise<ResultadoDeObterRegistro> {
    if (this.indisponivel) {
      return this.falhaDeIndisponibilidadeDeHistorico();
    }

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    const registro = this.base.registros.find(
      (item) => item.id === id && item.usuarioId === dono.id,
    );

    if (registro === undefined) {
      return {
        ok: false,
        erro: "nao_encontrado",
        mensagem: MENSAGEM_DE_SESSAO_NAO_ENCONTRADA,
      };
    }

    const baralhoExiste = this.base.baralhos.some(
      (baralho) =>
        baralho.id === registro.baralhoId && baralho.usuarioId === dono.id,
    );

    return {
      ok: true,
      registro: registroSemDono(registro),
      baralhoExiste,
    };
  }

  /** O resumo da Revisão do dia (FR-198, FR-199). */
  async obterResumoDaRevisao(
    inicioDoDia: string,
    fimDoDia: string,
  ): Promise<ResultadoDoResumoDaRevisao> {
    if (this.indisponivel) {
      return this.falhaDeIndisponibilidadeDeRevisao();
    }

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    const contagem = this.contagemDaRevisao(dono.id, inicioDoDia, fimDoDia);

    return {
      ok: true,
      resumo: {
        vencidos: contagem.vencidos,
        novosHoje: contagem.novosHoje,
        total: contagem.vencidos + contagem.novosHoje,
      },
    };
  }

  /**
   * O lote da Revisão do dia: vencidos por `proximaRevisaoEm` ascendente,
   * depois os novos na ordem de criação, limitados ao que ainda cabe hoje e a
   * 20 Itens no total (FR-201, FR-203).
   */
  async obterLoteDeRevisao(
    inicioDoDia: string,
    fimDoDia: string,
  ): Promise<ResultadoDoLoteDeRevisao> {
    if (this.indisponivel) {
      return this.falhaDeIndisponibilidadeDeRevisao();
    }

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    const agora = new Date();
    const cartoes = this.base.cartoes.filter(
      (cartao) => cartao.usuarioId === dono.id,
    );
    const agendamentos = this.base.agendamentos.filter(
      (agendamento) => agendamento.usuarioId === dono.id,
    );

    const porCartao = new Map<string, AgendamentoDoDono>();

    for (const agendamento of agendamentos) {
      porCartao.set(agendamento.cartaoId, agendamento);
    }

    const vencidos = cartoes
      .filter((cartao) => {
        const agendamento = porCartao.get(cartao.id);

        return (
          agendamento !== undefined && agendamento.proximaRevisaoEm < fimDoDia
        );
      })
      .sort((a, b) => {
        const primeiro = porCartao.get(a.id)?.proximaRevisaoEm ?? "";
        const segundo = porCartao.get(b.id)?.proximaRevisaoEm ?? "";

        if (primeiro === segundo) {
          return 0;
        }

        return primeiro < segundo ? -1 : 1;
      });

    const novos = cartoes
      .filter((cartao) => !porCartao.has(cartao.id))
      .slice(
        0,
        this.contagemDaRevisao(dono.id, inicioDoDia, fimDoDia).novosHoje,
      );

    return {
      ok: true,
      itens: [...vencidos, ...novos].slice(0, 20).map((cartao) => ({
        cartao: cartaoSemDono(cartao),
        previa: previaFixa(agora),
      })),
    };
  }

  /**
   * A prévia dos Cartões informados (FR-221). Como a prévia do stand-in é
   * fixa, cada `cartaoId` recebe a mesma tabela — ela não depende do Cartão.
   */
  async obterPrevias(cartaoIds: string[]): Promise<ResultadoDasPrevias> {
    if (this.indisponivel) {
      return this.falhaDeIndisponibilidadeDeRevisao();
    }

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    const agora = new Date();
    const previas: Record<string, Previa> = {};

    if (Array.isArray(cartaoIds)) {
      for (const cartaoId of cartaoIds) {
        if (typeof cartaoId === "string") {
          previas[cartaoId] = previaFixa(agora);
        }
      }
    }

    return { ok: true, previas };
  }

  /** As Preferências do Usuário mais a lista de algoritmos (FR-212). */
  async obterPreferencias(): Promise<ResultadoDePreferencias> {
    if (this.indisponivel) {
      return this.falhaDeIndisponibilidadeDePreferencias();
    }

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    return { ok: true, preferencias: this.preferenciasDoDono(dono.id) };
  }

  /**
   * Salva as Preferências (FR-200). O limite precisa ser inteiro de 0 a 999 e
   * o algoritmo precisa existir; qualquer desvio é `dados_invalidos`.
   */
  async salvarPreferencias(preferencias: {
    algoritmo: string;
    limiteDeNovosPorDia: number;
  }): Promise<ResultadoDeSalvarPreferencias> {
    if (this.indisponivel) {
      return this.falhaDeIndisponibilidadeDePreferencias();
    }

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    if (
      preferencias.algoritmo !== ALGORITMO_PADRAO ||
      !Number.isInteger(preferencias.limiteDeNovosPorDia) ||
      preferencias.limiteDeNovosPorDia < 0 ||
      preferencias.limiteDeNovosPorDia > 999
    ) {
      return {
        ok: false,
        erro: "dados_invalidos",
        mensagem: MENSAGEM_DE_DADOS_INVALIDOS_DE_PREFERENCIAS,
      };
    }

    const existente = this.base.preferencias.find(
      (salvas) => salvas.usuarioId === dono.id,
    );

    if (existente === undefined) {
      this.base.preferencias.push({
        usuarioId: dono.id,
        algoritmo: preferencias.algoritmo,
        limiteDeNovosPorDia: preferencias.limiteDeNovosPorDia,
      });
    } else {
      existente.algoritmo = preferencias.algoritmo;
      existente.limiteDeNovosPorDia = preferencias.limiteDeNovosPorDia;
    }

    return { ok: true, preferencias: this.preferenciasDoDono(dono.id) };
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

  /**
   * A contagem do dia (FR-198, FR-199, FR-201): os Agendamentos vencidos até o
   * fim do dia e quantos Cartões novos ainda cabem no limite, descontados os
   * já introduzidos hoje.
   */
  private contagemDaRevisao(
    usuarioId: string,
    inicioDoDia: string,
    fimDoDia: string,
  ): { vencidos: number; novosHoje: number } {
    const agendamentos = this.base.agendamentos.filter(
      (agendamento) => agendamento.usuarioId === usuarioId,
    );

    const vencidos = agendamentos.filter(
      (agendamento) => agendamento.proximaRevisaoEm < fimDoDia,
    ).length;

    const introduzidosHoje = agendamentos.filter(
      (agendamento) =>
        agendamento.criadoEm >= inicioDoDia && agendamento.criadoEm < fimDoDia,
    ).length;

    const comAgendamento = new Set(
      agendamentos.map((agendamento) => agendamento.cartaoId),
    );
    const semAgendamento = this.base.cartoes.filter(
      (cartao) =>
        cartao.usuarioId === usuarioId && !comAgendamento.has(cartao.id),
    ).length;

    const limite = this.preferenciasDoDono(usuarioId).limiteDeNovosPorDia;
    const novosHoje = Math.min(
      semAgendamento,
      Math.max(0, limite - introduzidosHoje),
    );

    return { vencidos, novosHoje };
  }

  /**
   * Aplica as Avaliações do Registro novo aos Agendamentos do dono, na ordem
   * dos Itens: cria o Agendamento na primeira Avaliação e atualiza a próxima
   * revisão nas seguintes (FR-205, FR-210).
   */
  private atualizarAgendamentos(
    usuarioId: string,
    dados: DadosDeRegistro,
    agora: Date,
  ): void {
    for (const item of dados.itens) {
      const proximaRevisaoEm = previaFixa(agora)[item.avaliacao];
      const existente = this.base.agendamentos.find(
        (agendamento) =>
          agendamento.usuarioId === usuarioId &&
          agendamento.cartaoId === item.cartaoId,
      );

      if (existente === undefined) {
        this.base.agendamentos.push({
          usuarioId,
          cartaoId: item.cartaoId,
          proximaRevisaoEm,
          criadoEm: agora.toISOString(),
        });
      } else {
        existente.proximaRevisaoEm = proximaRevisaoEm;
      }
    }
  }

  /**
   * As Preferências do dono no formato da Interface: quando ele nunca salvou
   * nada, valem os padrões, e a lista de algoritmos acompanha sempre
   * (D5, FR-212).
   */
  private preferenciasDoDono(usuarioId: string): Preferencias {
    const salvas = this.base.preferencias.find(
      (preferencias) => preferencias.usuarioId === usuarioId,
    );

    return {
      algoritmo: salvas?.algoritmo ?? ALGORITMO_PADRAO,
      limiteDeNovosPorDia:
        salvas?.limiteDeNovosPorDia ?? LIMITE_DE_NOVOS_PADRAO,
      algoritmos: ALGORITMOS_DISPONIVEIS.map((opcao) => ({ ...opcao })),
    };
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

  private falhaDeIndisponibilidadeDeHistorico(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    };
  }

  private falhaDeIndisponibilidadeDeRevisao(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO,
    };
  }

  private falhaDeIndisponibilidadeDePreferencias(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_PREFERENCIAS,
    };
  }

  /**
   * Os Registros do dono, do mais recente ao mais antigo (FR-164). Como dois
   * Registros podem ter a mesma `concluidaEm` — o relógio é o mesmo —, o
   * desempate é a ordem de inserção, do último para o primeiro.
   */
  private registrosDoDono(usuarioId: string): RegistroDaBase[] {
    return this.base.registros
      .filter((registro) => registro.usuarioId === usuarioId)
      .map((registro, indice) => ({ registro, indice }))
      .sort((a, b) => {
        if (a.registro.concluidaEm === b.registro.concluidaEm) {
          return b.indice - a.indice;
        }

        return a.registro.concluidaEm < b.registro.concluidaEm ? 1 : -1;
      })
      .map(({ registro }) => registro);
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
  registros: RegistroDaBase[];
  agendamentos: AgendamentoDoDono[];
  preferencias: PreferenciasDoDono[];
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

/**
 * Agendamento em memória do stand-in: o dono, o Cartão, a próxima revisão e o
 * instante em que ele foi introduzido — insumo da contagem de novos do dia
 * (FR-198, FR-205). O estado opaco do algoritmo real não existe aqui: a prévia
 * é fixa (D7).
 */
interface AgendamentoDoDono {
  usuarioId: string;
  cartaoId: string;
  proximaRevisaoEm: string;
  criadoEm: string;
}

/** Preferências salvas do dono; a ausência equivale aos padrões (D5). */
interface PreferenciasDoDono {
  usuarioId: string;
  algoritmo: string;
  limiteDeNovosPorDia: number;
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
    registros: [],
    agendamentos: [],
    preferencias: [],
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

/** Registro do histórico com o dono: o `usuarioId` é o escopo (FR-161). */
interface RegistroDaBase extends RegistroDeSessao {
  usuarioId: string;
}

/** O Registro como a Interface o devolve: sem o dono, que é Implementation. */
function registroSemDono(registro: RegistroDaBase): RegistroDeSessao {
  return {
    id: registro.id,
    origem: registro.origem,
    baralhoId: registro.baralhoId,
    nomeDoBaralho: registro.nomeDoBaralho,
    concluidaEm: registro.concluidaEm,
    estudados: registro.estudados,
    acertos: registro.acertos,
    erros: registro.erros,
    itens: registro.itens.map((item) => ({ ...item })),
  };
}

/** A linha da listagem: o Registro sem os itens (FR-164). */
function registroResumido(registro: RegistroDaBase): RegistroResumido {
  return {
    id: registro.id,
    origem: registro.origem,
    baralhoId: registro.baralhoId,
    nomeDoBaralho: registro.nomeDoBaralho,
    concluidaEm: registro.concluidaEm,
    estudados: registro.estudados,
    acertos: registro.acertos,
    erros: registro.erros,
  };
}

const FORMATO_DE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ehUuid(valor: unknown): valor is string {
  return typeof valor === "string" && FORMATO_DE_UUID.test(valor);
}

/**
 * Reconhece uma das 4 Avaliações (FR-193).
 */
function ehAvaliacao(valor: unknown): valor is Avaliacao {
  return (
    valor === "errei" ||
    valor === "dificil" ||
    valor === "bom" ||
    valor === "facil"
  );
}

/**
 * O `resultado` de dois níveis **derivado** da Avaliação (FR-194): `errei` é o
 * único erro; os demais são acerto.
 */
function resultadoDaAvaliacao(avaliacao: Avaliacao): ResultadoDoItemRegistrado {
  return avaliacao === "errei" ? "errou" : "acertou";
}

function itemDeRegistroValido(item: unknown): boolean {
  if (typeof item !== "object" || item === null) {
    return false;
  }

  const campos = item as Record<string, unknown>;

  if (
    typeof campos.frente !== "string" ||
    validarFrente(campos.frente) !== null
  ) {
    return false;
  }

  if (
    typeof campos.verso !== "string" ||
    validarVerso(campos.verso) !== null
  ) {
    return false;
  }

  // O Item da 015 carrega o Cartão de origem e a Avaliação (FR-196).
  if (typeof campos.cartaoId !== "string" || campos.cartaoId === "") {
    return false;
  }

  return ehAvaliacao(campos.avaliacao);
}

/**
 * As invariantes de `registrarSessao` (FR-161, FR-194, FR-196): só dados assim
 * chegam à base. Qualquer desvio é `dados_invalidos`, e nada é gravado.
 */
function dadosDeRegistroValidos(dados: DadosDeRegistro): boolean {
  if (!ehUuid(dados.id)) {
    return false;
  }

  if (dados.origem !== "baralho" && dados.origem !== "revisao") {
    return false;
  }

  // Na Revisão do dia, Baralho e nome são derivados, não validados (FR-196).
  if (dados.origem === "baralho") {
    if (typeof dados.baralhoId !== "string" || dados.baralhoId === "") {
      return false;
    }

    if (
      typeof dados.nomeDoBaralho !== "string" ||
      validarNomeDeBaralho(dados.nomeDoBaralho) !== null
    ) {
      return false;
    }
  }

  if (!Array.isArray(dados.itens)) {
    return false;
  }

  if (dados.itens.length < 1 || dados.itens.length > 1000) {
    return false;
  }

  return dados.itens.every(itemDeRegistroValido);
}

/**
 * A prévia fixa do stand-in: errei/dificil em 1 dia, bom em 3 e facil em 6, a
 * contar de `agora`. **Não é o SM-2** — o algoritmo real é testado no backend
 * (D7); aqui basta uma tabela simples e documentada para a interface ser
 * testável sem servidor.
 */
function previaFixa(agora: Date): Previa {
  return {
    errei: somarDias(agora, DIAS_DA_PREVIA.errei),
    dificil: somarDias(agora, DIAS_DA_PREVIA.dificil),
    bom: somarDias(agora, DIAS_DA_PREVIA.bom),
    facil: somarDias(agora, DIAS_DA_PREVIA.facil),
  };
}

/** O instante ISO a `dias` dias de 24 h de `agora`. */
function somarDias(agora: Date, dias: number): string {
  return new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000).toISOString();
}
