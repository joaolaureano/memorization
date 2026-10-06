import {
  INDISPONIVEL,
  MENSAGEM_DE_ACESSO_EXPIRADO,
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
  MENSAGEM_DE_INDISPONIBILIDADE_DA_CONTA,
  MENSAGEM_DE_INDISPONIBILIDADE_DO_ACESSO,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
  MENSAGEM_DE_NAO_AUTENTICADO,
  MENSAGEM_DE_SENHA_ATUAL_INCORRETA,
  MENSAGEM_DE_SESSAO_NAO_ENCONTRADA,
  NAO_AUTENTICADO,
} from "./cliente";
import type {
  Avaliacao,
  Baralho,
  BaralhoComCartoes,
  CartaoDaTransicao,
  Cartao,
  ClienteDoAcervo,
  ContagensDaConta,
  Credencial,
  DadosDeBaralho,
  DadosDeCartao,
  DadosDeEntrada,
  DadosDeExclusaoDeConta,
  DadosDeInicioDeCompromisso,
  DadosDeTrocaDeSenha,
  DadosDeRegistro,
  DadosDeRotina,
  DadosDeSelecaoParaBaralho,
  DadosDeUsuario,
  EscolhaDeTransicao,
  OpcaoDeAlgoritmo,
  OpcaoDeAvaliacao,
  Preferencias,
  Previa,
  RegistroDeSessao,
  RegistroResumido,
  RecusaDeConta,
  ResultadoDasPrevias,
  ResultadoDeAcaoDeConta,
  ResultadoDeObterAcesso,
  ResultadoDeObterConta,
  ResultadoDeRenovarAcesso,
  ResultadoDeSair,
  ResultadoDeCriacaoDeBaralho,
  ResultadoDeCriacaoDeCartao,
  ResultadoDeCriacaoDeUsuario,
  ResultadoDeEdicaoDeCartao,
  ResultadoDeEntrar,
  ResultadoDeEstatisticas,
  ResultadoDeExclusaoDeBaralho,
  ResultadoDeExclusaoDeCartao,
  ResultadoDeConcluirTransicao,
  ResultadoDeIniciarCompromisso,
  ResultadoDeListagemDeBaralhos,
  ResultadoDeListagemDeCartoes,
  ResultadoDeListarRotinas,
  ResultadoDeObterAgenda,
  ResultadoDeObterBaralho,
  ResultadoDeObterRegistro,
  ResultadoDeObterTransicao,
  ResultadoDePreferencias,
  ResultadoDeRegistroDeSessao,
  ResultadoDeRenomeacaoDeBaralho,
  ResultadoDeSalvarPreferencias,
  ResultadoDeSalvarRotina,
  ResultadoDeSalvarSelecao,
  ResultadoDoItemRegistrado,
} from "./cliente";
import {
  concluirCompromissoEmMemoria,
  contarAgendaEmMemoria,
  excluirAgendaEmMemoria,
  inicioDaConclusao,
  iniciarCompromissoEmMemoria,
  listarRotinasEmMemoria,
  novaAgendaBase,
  obterAgendaEmMemoria,
  salvarRotinaEmMemoria,
} from "./agenda-em-memoria";
import type { AgendaBase, ContextoDaAgenda } from "./agenda-em-memoria";
import {
  NOME_DE_USUARIO_EXISTENTE,
  validarFrente,
  validarNomeDeBaralho,
  validarNomeDeUsuario,
  validarSenha,
  validarVerso,
} from "./validacao";

/**
 * As opções de Avaliação do SM-2 (FR-191, FR-192): em ordem apresentada,
 * com chave estável e classificação de resultado para Estatísticas.
 * Exportada para fallback nas sessões (T2317).
 */
export const OPCOES_DE_AVALIACAO_SM2: readonly OpcaoDeAvaliacao[] = [
  { chave: "errei", rotulo: "Errei", resultado: "errou" },
  { chave: "dificil", rotulo: "Difícil", resultado: "acertou" },
  { chave: "bom", rotulo: "Bom", resultado: "acertou" },
  { chave: "facil", rotulo: "Fácil", resultado: "acertou" },
];

/** O algoritmo padrão e a lista oferecida pela tela de Preferências (FR-212). */
const ALGORITMOS_DISPONIVEIS: OpcaoDeAlgoritmo[] = [
  {
    id: "sm2",
    rotulo: "SM-2",
    opcoesDeAvaliacao: OPCOES_DE_AVALIACAO_SM2,
  },
];

/** O algoritmo padrão quando o Usuário nunca salvou Preferências (D5). */
const ALGORITMO_PADRAO = "sm2";

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
   * O "navegador" deste cliente: o cookie do Acesso temporário (018). Clientes
   * criados por `comoUsuario` **compartilham** o navegador — são abas do mesmo
   * navegador —; `outroNavegador` cria um à parte, sobre o mesmo servidor
   * simulado, como o de outro aparelho (FR-298, FR-299).
   */
  private navegador: NavegadorSimulado = { cookie: null };

  /**
   * A última recusa por Credencial foi por Acesso **expirado** (018): é o que
   * troca a mensagem de `nao_autenticado` pela de expiração (FR-294).
   */
  private recusadoPorExpiracao = false;

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

  /**
   * Adiciona cartões legados para testes (025). Deve ser chamado antes de
   * qualquer operação do cliente para que os cartões apareçam em `obterTransicao`.
   */
  adicionarCartoesLegados(
    cartoesLegadosPorUsuario: Array<{
      usuarioId: string;
      cartoesLegados: Array<{
        cartao: Cartao;
        baralhoIds: string[];
      }>;
    }>,
  ): void {
    for (const { usuarioId, cartoesLegados } of cartoesLegadosPorUsuario) {
      for (const { cartao, baralhoIds } of cartoesLegados) {
        this.base.cartoesLegados.push({
          usuarioId,
          cartao,
          baralhoIds,
        });
      }
    }
  }

  async entrar(dados: DadosDeEntrada): Promise<ResultadoDeEntrar> {
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
    const usuario = this.usuarioDaCredencial(dados);

    if (usuario === null) {
      return {
        ok: false,
        erro: NAO_AUTENTICADO,
        mensagem: MENSAGEM_DE_CREDENCIAL_INVALIDA,
      };
    }

    // 018: o Acesso do "navegador" deste stand-in é substituído por um novo — ou
    // apenas revogado, quando a continuidade foi desmarcada (FR-292). Sem a
    // escolha explícita, vale o modo do cliente: com Credencial, não emite.
    const continuar = dados.continuarConectado ?? this.credencial === null;

    this.revogarAcessoDoNavegador();

    if (continuar) {
      this.emitirAcessoNoNavegador(usuario.id);
    }

    return {
      ok: true,
      usuario: { id: usuario.id, nomeDeUsuario: usuario.nomeDeUsuario },
    };
  }

  /**
   * O Acesso do navegador simulado, como `GET /acesso` o reconhece (FR-290):
   * válido, expirado — que limpa o cookie, como a API — ou ausente.
   */
  async obterAcesso(): Promise<ResultadoDeObterAcesso> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DO_ACESSO,
      };
    }

    const situacao = this.situacaoDoAcesso();

    if (situacao.tipo === "valido") {
      return { ok: true, nomeDeUsuario: situacao.usuario.nomeDeUsuario };
    }

    return situacao.tipo === "expirado"
      ? {
          ok: false,
          erro: "acesso_expirado",
          mensagem: MENSAGEM_DE_ACESSO_EXPIRADO,
        }
      : {
          ok: false,
          erro: "sem_acesso",
          mensagem: MENSAGEM_DE_NAO_AUTENTICADO,
        };
  }

  async renovarAcesso(): Promise<ResultadoDeRenovarAcesso> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DO_ACESSO,
      };
    }

    const situacao = this.situacaoDoAcesso();

    if (situacao.tipo === "valido") {
      return { ok: true };
    }

    return {
      ok: false,
      erro: NAO_AUTENTICADO,
      mensagem:
        situacao.tipo === "expirado"
          ? MENSAGEM_DE_ACESSO_EXPIRADO
          : MENSAGEM_DE_NAO_AUTENTICADO,
    };
  }

  /** Sair encerra o Acesso deste navegador e só dele (FR-293, FR-299). */
  async sair(): Promise<ResultadoDeSair> {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DO_ACESSO,
      };
    }

    this.revogarAcessoDoNavegador();

    return { ok: true };
  }

  async criarCartao(
    baralhoId: string,
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

    // Verificar se o baralho existe e pertence ao dono
    const baralho = this.base.baralhos.find(
      (b) => b.id === baralhoId && b.usuarioId === dono.id,
    );

    if (baralho === undefined) {
      return {
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Baralho não encontrado.",
      };
    }

    const falha = validarFrente(dados.frente) ?? validarVerso(dados.verso);

    if (falha !== null) {
      return { ok: false, ...falha };
    }

    // Normalizar frente e verificar duplicação no baralho
    const cartoesDoBara1ho = this.base.cartoes.filter(
      (c) => c.usuarioId === dono.id && c.baralhoId === baralhoId,
    );

    let frenteFinal = dados.frente;
    let numero = 2;
    while (
      cartoesDoBara1ho.some((c) => normalizarFrente(c.frente) === normalizarFrente(frenteFinal.trim()))
    ) {
      frenteFinal = `${dados.frente.trim()} (${numero})`;
      numero++;
    }

    const cartao: CartaoDoDono = {
      id: `c${++this.base.sequenciaDeCartoes}`,
      usuarioId: dono.id,
      baralhoId,
      frente: frenteFinal,
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
        .map((cartao) => {
          const baralho = this.baralhoDoCartao(dono.id, cartao.id);
          return {
            ...cartaoSemDono(cartao),
            baralho: baralho || { id: "", nome: "" }, // Deveria nunca ser null após 025
            proximaRevisaoEm: this.proximaRevisaoDoCartao(dono.id, cartao.id),
          };
        }),
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

  /**
   * Cria o Baralho e os Vínculos com os Cartões escolhidos num gesto único
   * (FR-371). O `id` vem do cliente: o mesmo `id` já usado por um Baralho do
   * dono devolve esse Baralho sem duplicar nada (FR-372); um `id` de outro dono
   * é `conflito` (FR-374); e algum Cartão que não seja do dono é
   * `cartoes_indisponiveis`, com os ids na ordem recebida, sem gravar nada
   * (FR-373).
   */
  async salvarSelecaoComoBaralho(
    dados: DadosDeSelecaoParaBaralho,
  ): Promise<ResultadoDeSalvarSelecao> {
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

    const existente = this.base.baralhos.find(
      (baralho) => baralho.id === dados.id,
    );

    if (existente !== undefined) {
      if (existente.usuarioId !== dono.id) {
        return {
          ok: false,
          erro: "conflito",
          mensagem: "Não foi possível salvar o baralho. Tente novamente.",
        };
      }

      return { ok: true, baralho: baralhoSemDono(existente) };
    }

    // Validar que todos os cartões existem e pertencem ao dono
    const indisponiveis = dados.cartaoIds.filter(
      (cartaoId) =>
        !this.base.cartoes.some(
          (cartao) => cartao.id === cartaoId && cartao.usuarioId === dono.id,
        ),
    );

    if (indisponiveis.length > 0) {
      return {
        ok: false,
        erro: "cartoes_indisponiveis",
        mensagem: "Alguns cartões não estão mais disponíveis.",
        cartaoIds: indisponiveis,
      };
    }

    // Criar o novo baralho
    const baralho: BaralhoDoDono = {
      id: dados.id,
      usuarioId: dono.id,
      nome: dados.nome,
    };

    this.base.baralhos.push(baralho);

    // Criar cópias dos cartões (com IDs novos e Frentes numeradas)
    for (let indice = 0; indice < dados.cartaoIds.length; indice++) {
      const cartaoOriginalId = dados.cartaoIds[indice];
      const cartaoOriginal = this.base.cartoes.find(
        (c) => c.id === cartaoOriginalId && c.usuarioId === dono.id,
      );

      if (cartaoOriginal) {
        // Iniciar a numeração da cópia
        let frenteFinal = cartaoOriginal.frente;
        let numero = 2;
        const cartoesDoBara1ho = this.base.cartoes.filter(
          (c) => c.baralhoId === baralho.id,
        );

        while (
          cartoesDoBara1ho.some(
            (c) => normalizarFrente(c.frente) === normalizarFrente(frenteFinal.trim()),
          )
        ) {
          frenteFinal = `${cartaoOriginal.frente.trim()} (${numero})`;
          numero++;
        }

        const copia: CartaoDoDono = {
          id: `c${++this.base.sequenciaDeCartoes}`,
          usuarioId: dono.id,
          baralhoId: baralho.id,
          frente: frenteFinal,
          verso: cartaoOriginal.verso,
        };

        this.base.cartoes.push(copia);
      }
    }

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
          // Cartões **do dono** neste baralho, e a elegibilidade é contagem maior que zero.
          const quantidadeDeCartoes = this.base.cartoes.filter(
            (cartao) =>
              cartao.usuarioId === dono.id &&
              cartao.baralhoId === baralho.id,
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

    // Cartões que pertencem a este baralho
    const cartoes = this.base.cartoes
      .filter((c) => c.usuarioId === dono.id && c.baralhoId === baralho.id)
      .map((c) => cartaoSemDono(c));

    // Contar agendamentos para os cartões do baralho
    const quantidadeDeAgendamentos = this.base.agendamentos.filter(
      (a) =>
        a.usuarioId === dono.id &&
        cartoes.some((c) => c.id === a.cartaoId),
    ).length;

    const baralhoComCartoes: BaralhoComCartoes = {
      ...baralhoSemDono(baralho),
      elegivel: cartoes.length > 0,
      cartoes,
      quantidadeDeAgendamentos,
    };

    return { ok: true, baralho: baralhoComCartoes };
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

    const cartaoAtual = this.base.cartoes.find(
      (cartao) => cartao.id === id && cartao.usuarioId === dono.id,
    );

    if (cartaoAtual === undefined) {
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

    // Verificar duplicação no mesmo baralho
    const frenteNormalizada = normalizarFrente(frente);
    const cartoesDoBara1ho = this.base.cartoes.filter(
      (c) =>
        c.usuarioId === dono.id &&
        c.baralhoId === cartaoAtual.baralhoId &&
        c.id !== id,
    );

    if (
      cartoesDoBara1ho.some(
        (c) => normalizarFrente(c.frente) === frenteNormalizada,
      )
    ) {
      return {
        ok: false,
        erro: "frente_duplicada",
        mensagem: "Já existe um cartão com esta frente neste baralho.",
      };
    }

    const cartaoAtualizado: CartaoDoDono = {
      ...cartaoAtual,
      frente,
      verso,
    };

    const indice = this.base.cartoes.indexOf(cartaoAtual);
    this.base.cartoes[indice] = cartaoAtualizado;

    return { ok: true, cartao: cartaoSemDono(cartaoAtualizado) };
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

    // Remover agendamentos do cartão
    for (let i = this.base.agendamentos.length - 1; i >= 0; i -= 1) {
      if (
        this.base.agendamentos[i].usuarioId === dono.id &&
        this.base.agendamentos[i].cartaoId === id
      ) {
        this.base.agendamentos.splice(i, 1);
      }
    }

    // Remover o cartão
    this.base.cartoes.splice(indice, 1);

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

    // Remover o baralho
    this.base.baralhos.splice(indice, 1);

    // Remover os cartões que pertencem a este baralho
    for (let i = this.base.cartoes.length - 1; i >= 0; i -= 1) {
      const cartao = this.base.cartoes[i];
      if (cartao.usuarioId === dono.id && cartao.baralhoId === id) {
        // Remover agendamentos associados
        for (let j = this.base.agendamentos.length - 1; j >= 0; j -= 1) {
          if (
            this.base.agendamentos[j].usuarioId === dono.id &&
            this.base.agendamentos[j].cartaoId === cartao.id
          ) {
            this.base.agendamentos.splice(j, 1);
          }
        }
        // Remover o cartão
        this.base.cartoes.splice(i, 1);
      }
    }

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
  async obterAgenda(
    inicio: string,
    fuso: string,
  ): Promise<ResultadoDeObterAgenda> {
    const dono = this.donoDaAgenda();

    return "ok" in dono
      ? dono
      : obterAgendaEmMemoria(
          this.base.agenda,
          this.contextoDaAgenda(dono.usuario),
          inicio,
          fuso,
        );
  }

  async listarRotinas(): Promise<ResultadoDeListarRotinas> {
    const dono = this.donoDaAgenda();

    return "ok" in dono
      ? dono
      : listarRotinasEmMemoria(
          this.base.agenda,
          this.contextoDaAgenda(dono.usuario),
        );
  }

  async salvarRotina(dados: DadosDeRotina): Promise<ResultadoDeSalvarRotina> {
    const dono = this.donoDaAgenda();

    return "ok" in dono
      ? dono
      : salvarRotinaEmMemoria(
          this.base.agenda,
          this.contextoDaAgenda(dono.usuario),
          dados,
        );
  }

  async iniciarCompromisso(
    dados: DadosDeInicioDeCompromisso,
  ): Promise<ResultadoDeIniciarCompromisso> {
    const dono = this.donoDaAgenda();

    return "ok" in dono
      ? dono
      : iniciarCompromissoEmMemoria(
          this.base.agenda,
          this.contextoDaAgenda(dono.usuario),
          dados,
        );
  }

  /**
   * O dono das operações da Agenda, ou a recusa que a rota daria: transporte
   * indisponível ou Credencial/Acesso recusado.
   */
  private donoDaAgenda():
    | { usuario: UsuarioDaBase }
    | {
        ok: false;
        erro: typeof INDISPONIVEL | typeof NAO_AUTENTICADO;
        mensagem: string;
      } {
    if (this.indisponivel) {
      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_AGENDA_INDISPONIVEL,
      };
    }

    const dono = this.dono();

    return dono === null
      ? this.falhaDeNaoAutenticado()
      : { usuario: dono };
  }

  /** O acervo do dono, no instante do relógio do servidor simulado. */
  private contextoDaAgenda(usuario: UsuarioDaBase): ContextoDaAgenda {
    const baralhos = new Map<string, { nome: string; cartoes: Cartao[] }>();

    for (const baralho of this.base.baralhos) {
      if (baralho.usuarioId !== usuario.id) {
        continue;
      }

      const cartoes = this.base.cartoes
        .filter(
          (cartao) =>
            cartao.usuarioId === usuario.id && cartao.baralhoId === baralho.id,
        )
        .map((cartao) => cartaoSemDono(cartao));

      baralhos.set(baralho.id, { nome: baralho.nome, cartoes });
    }

    return {
      usuarioId: usuario.id,
      agora: new Date(this.base.relogio()),
      baralhos,
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

    // Sessão da Agenda (FR-254): o Registro é a conclusão **do Início
    // autorizado** — id igual, conjunto exato de Cartões, Frente e Verso do
    // snapshot — e o limite de 1000 Itens não vale (o máximo é o snapshot).
    const inicioDaAgenda =
      dados.inicioAgendaId === undefined
        ? null
        : inicioDaConclusao(this.base.agenda, dono.id, {
            ...dados,
            inicioAgendaId: dados.inicioAgendaId,
          });

    if (
      dados.inicioAgendaId !== undefined &&
      (inicioDaAgenda === null || !itensDaAgendaValidos(dados))
    ) {
      return {
        ok: false,
        erro: "dados_invalidos",
        mensagem: MENSAGEM_DE_DADOS_INVALIDOS,
      };
    }

    if (
      dados.inicioAgendaId === undefined &&
      !dadosDeRegistroValidos(dados)
    ) {
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
    const ehTemporario = dados.origem === "temporario";
    const semBaralho = ehRevisao || ehTemporario;
    const agora = new Date();

    const registro: RegistroDaBase = {
      id: dados.id,
      usuarioId: dono.id,
      origem: dados.origem,
      // Na Revisão do dia e no Baralho temporário, o Baralho é derivado: sem
      // Baralho e com o nome fixo (FR-196, D5, FR-369, FR-371).
      baralhoId: semBaralho ? "" : dados.baralhoId,
      nomeDoBaralho: ehTemporario
        ? dados.nomeDoBaralho || "Baralho temporário"
        : ehRevisao
          ? "Revisão do dia"
          : (inicioDaAgenda?.nomeDoBaralho ?? dados.nomeDoBaralho),
      concluidaEm: agora.toISOString(),
      estudados,
      acertos,
      erros: estudados - acertos,
      itens: dados.itens.map((item, posicao) => {
        // Na Agenda, Frente e Verso vêm do snapshot do servidor.
        const doSnapshot = inicioDaAgenda?.cartoes.find(
          (cartao) => cartao.id === item.cartaoId,
        );

        // O rótulo da avaliação vem das opções do SM-2 (T2317).
        const opcao = OPCOES_DE_AVALIACAO_SM2.find(
          (o) => o.chave === item.avaliacao,
        );

        return {
          posicao,
          frente: doSnapshot?.frente ?? item.frente,
          verso: doSnapshot?.verso ?? item.verso,
          resultado: resultadoDaAvaliacao(item.avaliacao),
          cartaoId: item.cartaoId,
          avaliacao: item.avaliacao,
          avaliacaoRotulo: opcao?.rotulo ?? null,
        };
      }),
    };

    this.base.registros.push(registro);

    if (inicioDaAgenda !== null) {
      concluirCompromissoEmMemoria(this.base.agenda, inicioDaAgenda);
    }

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
   * Salva as Preferências (FR-212). O algoritmo precisa existir; qualquer
   * desvio é `dados_invalidos`.
   */
  async salvarPreferencias(preferencias: {
    algoritmo: string;
  }): Promise<ResultadoDeSalvarPreferencias> {
    if (this.indisponivel) {
      return this.falhaDeIndisponibilidadeDePreferencias();
    }

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    if (preferencias.algoritmo !== ALGORITMO_PADRAO) {
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
      });
    } else {
      existente.algoritmo = preferencias.algoritmo;
    }

    return { ok: true, preferencias: this.preferenciasDoDono(dono.id) };
  }

  /** Nome de usuário atual e contagens do dono (FR-257, FR-258, FR-272). */
  async obterConta(): Promise<ResultadoDeObterConta> {
    if (this.indisponivel) {
      return this.falhaDeIndisponibilidadeDaConta();
    }

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    return {
      ok: true,
      dados: {
        nomeDeUsuario: dono.nomeDeUsuario,
        contagens: this.contagensDoDono(dono.id),
      },
    };
  }

  /** Troca a Senha com as regras da API (FR-266..FR-271). */
  async trocarSenha(
    dados: DadosDeTrocaDeSenha,
  ): Promise<ResultadoDeAcaoDeConta> {
    if (this.indisponivel) {
      return this.falhaDeIndisponibilidadeDaConta();
    }

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    const invalida = validarSenha(dados.novaSenha);

    if (invalida !== null) {
      return {
        ok: false,
        erro: "dados_invalidos",
        mensagem: invalida.mensagem,
        campo: "novaSenha",
      };
    }

    if (dados.novaSenha !== dados.confirmacaoDaSenha) {
      return {
        ok: false,
        erro: "dados_invalidos",
        mensagem: "A confirmação da Senha não confere com a nova Senha.",
        campo: "confirmacaoDaSenha",
      };
    }

    if (dono.senha !== dados.senhaAtual) {
      return this.recusaDeSenhaAtual();
    }

    if (dados.novaSenha === dados.senhaAtual) {
      return {
        ok: false,
        erro: "mesma_senha",
        mensagem: "A nova Senha é igual à atual.",
      };
    }

    dono.senha = dados.novaSenha;
    this.renovarOsAcessosDoDono(dono.id, this.credencial === null);

    return { ok: true };
  }

  /**
   * Exclui o Usuário e tudo o que é dele, sem tocar no outro (FR-274,
   * FR-275): a Credencial dele deixa de valer.
   */
  async excluirConta(
    dados: DadosDeExclusaoDeConta,
  ): Promise<ResultadoDeAcaoDeConta> {
    if (this.indisponivel) {
      return this.falhaDeIndisponibilidadeDaConta();
    }

    const dono = this.dono();

    if (dono === null) {
      return this.falhaDeNaoAutenticado();
    }

    if (dono.senha !== dados.senhaAtual) {
      return this.recusaDeSenhaAtual();
    }

    const base = this.base;
    const doOutro = <T extends { usuarioId: string }>(itens: T[]): T[] =>
      itens.filter((item) => item.usuarioId !== dono.id);

    base.cartoes = doOutro(base.cartoes);
    base.baralhos = doOutro(base.baralhos);
    base.registros = doOutro(base.registros);
    base.agendamentos = doOutro(base.agendamentos);
    base.preferencias = doOutro(base.preferencias);
    excluirAgendaEmMemoria(base.agenda, dono.id);
    base.usuarios = base.usuarios.filter((usuario) => usuario.id !== dono.id);

    // Os Acessos caem com o Usuário, e nenhum novo é emitido (FR-296).
    for (const [valor, acesso] of base.acessos) {
      if (acesso.usuarioId === dono.id) {
        base.acessos.delete(valor);
      }
    }

    if (
      this.navegador.cookie !== null &&
      !base.acessos.has(this.navegador.cookie)
    ) {
      this.navegador.cookie = null;
    }

    return { ok: true };
  }

  async obterTransicao(): Promise<ResultadoDeObterTransicao> {
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

    // A leitura também resolve automaticamente Cartões com um único Baralho,
    // como faz o servidor antes de devolver as escolhas pendentes.
    await this.concluirTransicao([]);

    // Cartões legados do dono
    const todosOsLegados = this.base.cartoesLegados.filter(
      (cl) => cl.usuarioId === dono.id,
    );

    // Pendentes: os que exigem escolha (0 ou >=2 Baralhos legados)
    const pendentes = todosOsLegados.filter(
      (cl) => cl.baralhoIds.length !== 1,
    );

    // Ordenar pendentes por frente normalizada e id
    const ordenados = pendentes.sort((a, b) => {
      const chavea = normalizarFrente(a.cartao.frente);
      const chaveb = normalizarFrente(b.cartao.frente);
      if (chavea !== chaveb) {
        return chavea.localeCompare(chaveb);
      }
      return a.cartao.id.localeCompare(b.cartao.id);
    });

    // Construir lista de Cartões da Transição com seus Baralhos legados
    const cartoesDaTransicao: CartaoDaTransicao[] = ordenados.map((p) => {
      // Os Baralhos legados são representados como {id, nome}
      // Aqui simulamos apenas os ids como nomes (em teste, eles já têm id)
      const baralhos: Baralho[] = p.baralhoIds.map((id) => ({
        id,
        nome: id, // Em teste, o nome é o próprio id
      }));

      return {
        ...p.cartao,
        baralhos,
      };
    });

    // Baralhos do dono, ordenados por nome
    const todosOsBaralhos = this.base.baralhos
      .filter((b) => b.usuarioId === dono.id)
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map((b) => baralhoSemDono(b));

    return { ok: true, cartoes: cartoesDaTransicao, baralhos: todosOsBaralhos };
  }

  async concluirTransicao(
    escolhas: EscolhaDeTransicao[],
  ): Promise<ResultadoDeConcluirTransicao> {
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

    // Validar escolhas é um array
    if (!Array.isArray(escolhas)) {
      return {
        ok: false,
        erro: "escolhas_invalidas",
        mensagem: "Escolhas inválidas.",
      };
    }

    // Cartões legados do dono
    const todosOsLegados = this.base.cartoesLegados.filter(
      (cl) => cl.usuarioId === dono.id,
    );

    // Auto-atribuição: legados com exatamente 1 Baralho legado
    const podeAutoAtribuir = todosOsLegados.filter(
      (cl) => cl.baralhoIds.length === 1,
    );

    // Auto-atribui aplicando a transição automática
    const chavesAcumuladasPorBaralho = new Map<string, Set<string>>();
    for (const legado of podeAutoAtribuir) {
      const baralhoEscolhido = legado.baralhoIds[0];

      // Obter chaves já usadas do baralho legado
      let chavesUsadas = chavesAcumuladasPorBaralho.get(baralhoEscolhido);
      if (!chavesUsadas) {
        const cartoesDoBaralho = this.base.cartoes.filter(
          (c) => c.baralhoId === baralhoEscolhido && c.usuarioId === dono.id,
        );
        chavesUsadas = new Set(
          cartoesDoBaralho.map((c) => normalizarFrente(c.frente)),
        );
        chavesAcumuladasPorBaralho.set(baralhoEscolhido, chavesUsadas);
      }

      // Calcular frente final
      const frenteFinal = numerarFrente(legado.cartao.frente, chavesUsadas);
      chavesUsadas.add(normalizarFrente(frenteFinal));

      // Criar o cartão no baralho legado
      const novoCartao: CartaoDoDono = {
        id: legado.cartao.id,
        frente: frenteFinal,
        verso: legado.cartao.verso,
        usuarioId: dono.id,
        baralhoId: baralhoEscolhido,
      };

      this.base.cartoes.push(novoCartao);

      // Remover este legado da lista
      const indice = this.base.cartoesLegados.findIndex(
        (cl) =>
          cl.cartao.id === legado.cartao.id && cl.usuarioId === dono.id,
      );
      if (indice >= 0) {
        this.base.cartoesLegados.splice(indice, 1);
      }
    }

    // Pendentes: os que exigem escolha (0 ou >=2 Baralhos legados)
    const pendentes = this.base.cartoesLegados.filter(
      (cl) => cl.usuarioId === dono.id && cl.baralhoIds.length !== 1,
    );

    // Se não há pendentes, retorna ok
    if (pendentes.length === 0) {
      return { ok: true };
    }

    // Validar que há exatamente uma escolha por pendente
    if (escolhas.length !== pendentes.length) {
      return {
        ok: false,
        erro: "escolhas_invalidas",
        mensagem: `Esperado ${pendentes.length} escolhas, obtido ${escolhas.length}.`,
      };
    }

    // Validar que não há cartões repetidos
    const cartaoIds = new Set<string>();
    for (const escolha of escolhas) {
      if (typeof escolha !== "object" || escolha === null) {
        return {
          ok: false,
          erro: "escolhas_invalidas",
          mensagem: "Cada escolha deve ser um objeto.",
        };
      }

      const { cartaoId, baralhoId } = escolha as {
        cartaoId?: unknown;
        baralhoId?: unknown;
      };

      if (typeof cartaoId !== "string" || typeof baralhoId !== "string") {
        return {
          ok: false,
          erro: "escolhas_invalidas",
          mensagem: "Cartão e baralho devem ser strings.",
        };
      }

      if (cartaoIds.has(cartaoId)) {
        return {
          ok: false,
          erro: "escolhas_invalidas",
          mensagem: "Cartão repetido nas escolhas.",
        };
      }

      cartaoIds.add(cartaoId);
    }

    // Validar que todos os ids nas escolhas correspondem a pendentes
    for (const cartaoId of cartaoIds) {
      if (!pendentes.some((p) => p.cartao.id === cartaoId)) {
        return {
          ok: false,
          erro: "escolhas_invalidas",
          mensagem: `Cartão ${cartaoId} não está pendente.`,
        };
      }
    }

    // Monta o mapa de escolhas
    const escolhasMap = new Map<string, string>();
    for (const escolha of escolhas) {
      const { cartaoId, baralhoId } = escolha as {
        cartaoId: string;
        baralhoId: string;
      };
      escolhasMap.set(cartaoId, baralhoId);
    }

    // Validar que os Baralhos escolhidos existem e são válidos
    for (const [cartaoId, baralhoId] of escolhasMap) {
      const pendente = pendentes.find((p) => p.cartao.id === cartaoId);
      if (!pendente) {
        return {
          ok: false,
          erro: "escolhas_invalidas",
          mensagem: `Cartão ${cartaoId} não está pendente.`,
        };
      }

      // Para cartão avulso (baralhoIds.length === 0), o baralho deve existir no sistema moderno
      if (pendente.baralhoIds.length === 0) {
        const baralhoExiste = this.base.baralhos.some(
          (b) => b.id === baralhoId && b.usuarioId === dono.id,
        );

        if (!baralhoExiste) {
          return {
            ok: false,
            erro: "escolhas_invalidas",
            mensagem: `Baralho ${baralhoId} não existe.`,
          };
        }
      } else {
        // Para cartão compartilhado, o baralho deve ser um dos seus legados
        if (!pendente.baralhoIds.includes(baralhoId)) {
          return {
            ok: false,
            erro: "escolhas_invalidas",
            mensagem: `Baralho ${baralhoId} não é um dos baralhos legados do cartão.`,
          };
        }
      }
    }

    // Aplicar as transições dos pendentes (compartilhados/avulsos)
    for (const pendente of pendentes) {
      const baralhoEscolhido = escolhasMap.get(pendente.cartao.id)!;

      // Obter chaves já usadas do baralho escolhido
      let chavesUsadas = chavesAcumuladasPorBaralho.get(baralhoEscolhido);
      if (!chavesUsadas) {
        const cartoesDoBaralho = this.base.cartoes.filter(
          (c) => c.baralhoId === baralhoEscolhido && c.usuarioId === dono.id,
        );
        chavesUsadas = new Set(
          cartoesDoBaralho.map((c) => normalizarFrente(c.frente)),
        );
        chavesAcumuladasPorBaralho.set(baralhoEscolhido, chavesUsadas);
      }

      // Calcular frente final
      const frenteFinal = numerarFrente(pendente.cartao.frente, chavesUsadas);
      chavesUsadas.add(normalizarFrente(frenteFinal));

      // Criar o cartão no baralho escolhido
      const novoCartao: CartaoDoDono = {
        id: pendente.cartao.id,
        frente: frenteFinal,
        verso: pendente.cartao.verso,
        usuarioId: dono.id,
        baralhoId: baralhoEscolhido,
      };

      this.base.cartoes.push(novoCartao);

      // Para cada outro Baralho legado, criar uma cópia
      const outrosBaralhos = pendente.baralhoIds
        .filter((id) => id !== baralhoEscolhido)
        .sort();

      for (const baralhoId of outrosBaralhos) {
        let chaVesDoOutro = chavesAcumuladasPorBaralho.get(baralhoId);
        if (!chaVesDoOutro) {
          const cartoesDoOutroBaralho = this.base.cartoes.filter(
            (c) => c.baralhoId === baralhoId && c.usuarioId === dono.id,
          );
          chaVesDoOutro = new Set(
            cartoesDoOutroBaralho.map((c) => normalizarFrente(c.frente)),
          );
          chavesAcumuladasPorBaralho.set(baralhoId, chaVesDoOutro);
        }

        const frenteDaCopia = numerarFrente(
          pendente.cartao.frente,
          chaVesDoOutro,
        );
        chaVesDoOutro.add(normalizarFrente(frenteDaCopia));

        const copia: CartaoDoDono = {
          id: `${pendente.cartao.id}-copia-${baralhoId}`,
          frente: frenteDaCopia,
          verso: pendente.cartao.verso,
          usuarioId: dono.id,
          baralhoId,
        };

        this.base.cartoes.push(copia);
      }
    }

    // Remover os legados processados
    this.base.cartoesLegados = this.base.cartoesLegados.filter(
      (cl) => !pendentes.some((p) => p.cartao.id === cl.cartao.id),
    );

    return { ok: true };
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
      const [removido] = this.base.usuarios.splice(indice, 1);

      // O Acesso cai junto com o Usuário, como pela cascata do esquema (FR-296).
      for (const [valor, acesso] of this.base.acessos) {
        if (acesso.usuarioId === removido?.id) {
          this.base.acessos.delete(valor);
        }
      }
    }
  }

  /**
   * Avança o relógio do servidor simulado (uso de prova): é assim que a
   * validade deslizante e a expiração do Acesso são exercitadas sem esperar
   * (FR-291, FR-294).
   */
  avancarRelogio(milissegundos: number): void {
    this.base.deslocamentoDoRelogioEmMs += milissegundos;
  }

  /** Define a validade do Acesso do servidor simulado, em segundos (uso de prova). */
  definirValidadeDoAcesso(segundos: number): void {
    this.base.validadeDoAcessoEmMs = segundos * 1000;
  }

  /** Diz se o "navegador" simulado guarda um Acesso (uso de prova, FR-295). */
  temAcessoNoNavegador(): boolean {
    return this.navegador.cookie !== null;
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
    outro.navegador = this.navegador;

    return outro;
  }

  /**
   * Outro cliente sobre o **mesmo servidor** simulado, mas num navegador à
   * parte, sem cookie algum (uso de prova): é como o segundo navegador ou
   * aparelho de um Usuário, cujo Acesso é próprio e independente (018, FR-299).
   */
  outroNavegador(credencial: Credencial | null = null): ClienteEmMemoria {
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
      // Sem Credencial na memória, o que autoriza é o Acesso temporário do
      // "navegador" — e cada operação o renova (018, FR-291).
      const situacao = this.situacaoDoAcesso();

      return situacao.tipo === "valido" ? situacao.usuario : null;
    }

    return this.usuarioDaCredencial(this.credencial);
  }

  /**
   * O estado do Acesso do navegador simulado. Válido **renova** a validade;
   * expirado limpa o cookie, como a API faz em `401 acesso_expirado`, e deixa
   * a marca que `falhaDeNaoAutenticado` lê para usar a mensagem de expiração.
   */
  private situacaoDoAcesso():
    | { tipo: "valido"; usuario: UsuarioDaBase }
    | { tipo: "expirado" }
    | { tipo: "ausente" } {
    const valor = this.navegador.cookie;
    const acesso = valor === null ? undefined : this.base.acessos.get(valor);

    if (valor === null || acesso === undefined) {
      return { tipo: "ausente" };
    }

    if (acesso.expiraEm <= this.base.relogio()) {
      this.base.acessos.delete(valor);
      this.navegador.cookie = null;
      this.recusadoPorExpiracao = true;

      return { tipo: "expirado" };
    }

    const usuario = this.base.usuarios.find(
      (candidato) => candidato.id === acesso.usuarioId,
    );

    if (usuario === undefined) {
      return { tipo: "ausente" };
    }

    acesso.expiraEm = this.base.relogio() + this.base.validadeDoAcessoEmMs;

    return { tipo: "valido", usuario };
  }

  /** Revoga o Acesso do cookie atual e o limpa do navegador simulado. */
  private revogarAcessoDoNavegador(): void {
    if (this.navegador.cookie !== null) {
      this.base.acessos.delete(this.navegador.cookie);
    }

    this.navegador.cookie = null;
  }

  /** Emite um Acesso novo para o Usuário e o entrega ao navegador simulado. */
  private emitirAcessoNoNavegador(usuarioId: string): void {
    const valor = `acesso-${++this.base.sequenciaDeAcessos}`;

    this.base.acessos.set(valor, {
      usuarioId,
      expiraEm: this.base.relogio() + this.base.validadeDoAcessoEmMs,
    });
    this.navegador.cookie = valor;
  }

  /**
   * 018, FR-296: uma alteração da conta encerra **todos** os Acessos do
   * Usuário e, quando a operação foi autenticada por Acesso, emite um novo para
   * este navegador.
   */
  private renovarOsAcessosDoDono(usuarioId: string, viaAcesso: boolean): void {
    for (const [valor, acesso] of this.base.acessos) {
      if (acesso.usuarioId === usuarioId) {
        this.base.acessos.delete(valor);
      }
    }

    if (viaAcesso) {
      this.emitirAcessoNoNavegador(usuarioId);
    } else if (
      this.navegador.cookie !== null &&
      !this.base.acessos.has(this.navegador.cookie)
    ) {
      this.navegador.cookie = null;
    }
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
      algoritmos: ALGORITMOS_DISPONIVEIS.map((opcao) => ({ ...opcao })),
    };
  }

  /** As contagens do dono: o que `excluirConta` removeria (SC-113). */
  private contagensDoDono(usuarioId: string): ContagensDaConta {
    return {
      cartoes: this.base.cartoes.filter((c) => c.usuarioId === usuarioId)
        .length,
      baralhos: this.base.baralhos.filter((b) => b.usuarioId === usuarioId)
        .length,
      registrosDeSessao: this.base.registros.filter(
        (r) => r.usuarioId === usuarioId,
      ).length,
      agenda: contarAgendaEmMemoria(this.base.agenda, usuarioId),
    };
  }

  private recusaDeSenhaAtual(): RecusaDeConta {
    return {
      ok: false,
      erro: "senha_atual_incorreta",
      mensagem: MENSAGEM_DE_SENHA_ATUAL_INCORRETA,
    };
  }

  private falhaDeIndisponibilidadeDaConta(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DA_CONTA,
    };
  }

  private falhaDeNaoAutenticado(): {
    ok: false;
    erro: typeof NAO_AUTENTICADO;
    mensagem: string;
  } {
    const expirado = this.recusadoPorExpiracao;

    this.recusadoPorExpiracao = false;

    return {
      ok: false,
      erro: NAO_AUTENTICADO,
      mensagem: expirado
        ? MENSAGEM_DE_ACESSO_EXPIRADO
        : MENSAGEM_DE_NAO_AUTENTICADO,
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

  /**
   * O Baralho único que contém este Cartão, ou `null` se o Cartão não tiver
   * Baralho (situação de erro que não deve ocorrer após 025).
   */
  private baralhoDoCartao(usuarioId: string, cartaoId: string): Baralho | null {
    const cartao = this.base.cartoes.find(
      (c) => c.id === cartaoId && c.usuarioId === usuarioId,
    );

    if (!cartao) return null;

    const baralho = this.base.baralhos.find(
      (b) => b.id === cartao.baralhoId && b.usuarioId === usuarioId,
    );

    return baralho ? baralhoSemDono(baralho) : null;
  }

  /**
   * A próxima revisão do Agendamento do dono para aquele Cartão, em ISO-8601,
   * ou `null` quando não há Agendamento (FR-352).
   */
  private proximaRevisaoDoCartao(
    usuarioId: string,
    cartaoId: string,
  ): string | null {
    const agendamento = this.base.agendamentos.find(
      (item) => item.usuarioId === usuarioId && item.cartaoId === cartaoId,
    );

    return agendamento?.proximaRevisaoEm ?? null;
  }

}

/** O cookie do Acesso temporário de um navegador simulado (018). */
interface NavegadorSimulado {
  cookie: string | null;
}

/**
 * O estado do stand-in: os Usuários e o acervo que os clientes de prova
 * compartilham, mais a sequência de ids opacos.
 */
/**
 * Cartão legado pendente de transição (025): o Cartão com seus Baralhos legados
 * e o usuário dono.
 */
interface CartaoLegadoDaBase {
  usuarioId: string;
  cartao: Cartao;
  baralhoIds: string[];
}

interface BaseEmMemoria {
  usuarios: UsuarioDaBase[];
  cartoes: CartaoDoDono[];
  baralhos: BaralhoDoDono[];
  registros: RegistroDaBase[];
  agendamentos: AgendamentoDoDono[];
  preferencias: PreferenciasDoDono[];
  /** A Agenda de estudo (016): Rotinas, Compromissos persistidos e Inícios. */
  agenda: AgendaBase;
  /** Cartões legados pendentes de transição por usuário (025). */
  cartoesLegados: CartaoLegadoDaBase[];
  sequenciaDeCartoes: number;
  sequenciaDeBaralhos: number;
  sequenciaDeUsuarios: number;
  /**
   * Os Acessos temporários do servidor simulado (018) e o relógio — controlável
   * pela prova — com que a validade deslizante é decidida (FR-291, FR-297). O
   * cookie não é do servidor: é do `Navegador`, que cada cliente referencia.
   */
  acessos: Map<string, { usuarioId: string; expiraEm: number }>;
  sequenciaDeAcessos: number;
  deslocamentoDoRelogioEmMs: number;
  validadeDoAcessoEmMs: number;
  relogio: () => number;
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

/**
 * Cartão com o dono e seu Baralho único (025): o `usuarioId` é o escopo de
 * toda operação (FR-092), e o `baralhoId` identifica o dono único do Cartão.
 */
interface CartaoDoDono extends Cartao {
  usuarioId: string;
  baralhoId: string;
}

/** Baralho com o dono: o `usuarioId` é o escopo de toda operação (FR-092). */
interface BaralhoDoDono extends Baralho {
  usuarioId: string;
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
}

/** Uma base nova, já com os Usuários que a prova informou. */
function novaBaseEmMemoria(
  usuariosJaCadastrados: readonly DadosDeUsuario[],
): BaseEmMemoria {
  const base: BaseEmMemoria = {
    usuarios: [],
    cartoes: [],
    baralhos: [],
    registros: [],
    agendamentos: [],
    preferencias: [],
    agenda: novaAgendaBase(),
    cartoesLegados: [],
    sequenciaDeCartoes: 0,
    sequenciaDeBaralhos: 0,
    sequenciaDeUsuarios: 0,
    acessos: new Map(),
    sequenciaDeAcessos: 0,
    deslocamentoDoRelogioEmMs: 0,
    validadeDoAcessoEmMs: 300_000,
    relogio: () => Date.now() + base.deslocamentoDoRelogioEmMs,
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

/**
 * Normalizar Frente para comparação de duplicação: sem acentos, lowercase,
 * espaços externos removidos.
 */
function normalizarFrente(f: string): string {
  return f
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/**
 * Enumera a Frente para evitar colisão no Baralho (FR-398).
 *
 * Se a Frente normalizada não está no conjunto, devolve a Frente inalterada.
 * Senão, devolve `` `${frente.trim()} (${n})` `` com o menor n >= 2 cuja
 * chave normalizada esteja livre.
 */
function numerarFrente(
  frente: string,
  chavesOcupadas: ReadonlySet<string>,
): string {
  const chave = normalizarFrente(frente);
  const aparada = frente.trim();

  if (!chavesOcupadas.has(chave)) {
    return frente;
  }

  for (let n = 2; ; n++) {
    const candidata = `${aparada} (${n})`;
    const chaveCandidata = normalizarFrente(candidata);

    if (!chavesOcupadas.has(chaveCandidata)) {
      return candidata;
    }
  }
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

  if (
    dados.origem !== "baralho" &&
    dados.origem !== "revisao" &&
    dados.origem !== "temporario"
  ) {
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
 * Os Itens de uma conclusão da Agenda: só a forma de cada um — o conjunto de
 * Cartões já foi conferido contra o Início — e o `id` em UUID (FR-254).
 */
function itensDaAgendaValidos(dados: DadosDeRegistro): boolean {
  return (
    ehUuid(dados.id) &&
    Array.isArray(dados.itens) &&
    dados.itens.length >= 1 &&
    dados.itens.every(itemDeRegistroValido)
  );
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
