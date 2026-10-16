import { textoDaRecusaPt, type TextoDaRecusa } from "./recusas";
import { NOME_NATIVO, type Idioma } from "./tipos";

// Tipo que descreve a estrutura completa do catálogo com propriedades obrigatórias
// TypeScript deve falhar quando uma chave está faltando em pt, en ou es
export interface Catalogo {
  [key: string]: unknown; // Index signature para compatibilidade com testes
  /** O texto de uma recusa do servidor, pelo código e pelo contexto (FR-019). */
  recusa: TextoDaRecusa;
  seletor: {
    rotulo: (idioma: Idioma) => string;
    anuncio: (idioma: Idioma) => string;
    nomeDoIdioma: string;
  };
  comum: {
    cancelar: string;
    salvar: string;
    voltar: string;
    tentarNovamente: string;
  };
  moldura: {
    labelNav: string;
    inicio: string;
    estudo: string;
    baralhos: string;
    perfil: string;
    sair: string;
  };
  acesso: {
    entrar_rotulo: string;
    criar_conta_rotulo: string;
    nomeDeUsuario: string;
    senha: string;
    confirmacaoDaSenha: string;
    continuarConectado: string;
    entrando: string;
    botaoEntrar: string;
    botaoCriarConta: string;
    criandoConta: string;
    ainda_nao_tem_conta: string;
    link_criar_conta: string;
    ja_tem_uma_conta: string;
    link_entrar: string;
    aria_saida_concluida: string;
    aria_conta_excluida: string;
    aria_credencial_recusada: string;
    aria_falha_ao_entrar: string;
    aria_falha_no_cadastro: string;
    aria_cadastro_concluido: string;
    aria_falha_ao_sair: string;
    regras_nome: (min: number, max: number) => string;
    contador: (atual: number, max: number) => string;
    aviso_nome_minimo: (min: number, atual: number) => string;
    aviso_nome_maximo: (max: number) => string;
    aviso_nome_limite_atingido: (max: number) => string;
    aviso_nome_restante: (restante: number, max: number) => string;
    regras_senha: (min: number, max: number) => string;
    aviso_senha_minimo: (min: number, atual: number) => string;
    aviso_senha_maximo: (max: number) => string;
    aviso_senha_limite_atingido: (max: number) => string;
    aviso_senha_restante: (restante: number, max: number) => string;
    cadastro_concluido: (nomeDeUsuario: string) => string;
    mostrar: string;
    ocultar: string;
    confiraConta: string;
    verificandoAcesso: string;
    falhaAoVerificarAcesso: string;
    voltandoParaInicio: string;
    voltandoParaBaralhos: string;
    descartarCadastro: string;
    dadosPreenchidosPerdidos: string;
    descartar: string;
  };
  inicio: {
    ola: (nome: string) => string;
    ver_baralhos: string;
    estudo_titulo: string;
    estudo_descricao: string;
    agendar_estudo: string;
    gerenciar_rotinas: string;
    estatisticas_titulo: string;
    carregando_estudo: string;
    atualizando: string;
    ultimas_sessoes_titulo: string;
    carregando_sessoes: string;
    nao_foi_possivel_carregar_sessoes: string;
    verificando_cartoes: string;
    organizar_cartoes_titulo: string;
    nao_foi_possivel_atualizar: string;
  };
  baralhos: {
    titulo: string;
    descricao: string;
    btnImportar: string;
    btnCriarBaralho: string;
    btnCriarBaralhoTemporario: string;
    buscarLabel: string;
    buscarPlaceholder: string;
    situacaoLabel: string;
    rotuloDaSituacao: Record<"sem-cartoes" | "pendente" | "revisado", string>;
    situacaoTodos: string;
    situacaoPendente: string;
    situacaoRevisado: string;
    btnLimparFiltros: string;
    carregando: string;
    vazio: string;
    naoEncontrado: string;
    naoEncontradoDescricao: string;
    contagem: (n: number) => string;
    btnRevisar: string;
    btnEditar: string;
    semCartoes: string;
    motivo: string;
    pendingOperation: string;
    deckNotFound: string;
    btnRevisarEsteBaralho: string;
    btnCriarCartao: string;
    btnRenomear: string;
    btnExcluirBaralho: string;
    ajudaCriarCartoes: string;
    buscarCartoes: string;
    buscarCartoesPlaceholder: string;
    tipoCartaoLabel: string;
    tipoCartaoTodos: string;
    cartaoEncontrado: (n: number) => string;
    vazioSemCartoes: string;
    naoEncontradoCartoes: string;
    naoEncontradoCartoesDescricao: string;
    cartaoRevisado: string;
    cartaoPendente: string;
    btnExcluirCartao: string;
    excluirCartaoConfirm: string;
    excluirBaralhoConfirm: string;
    descricaoCartaoExcluido: string;
    descricaoBaralhoExcluido: (cartoes: number, agendamentos?: number) => string;
    pendingSaveBaralho: string;
    descartarAlteracoes: string;
    descartarTexto: string;
    descartarConfirm: string;
    voltarBaralho: string;
    voltarBaralhos: string;
    criarBaralho: string;
    renomearBaralho: string;
    carregandoBaralho: string;
    nomeLabel: string;
    caracteres: string;
    salvando: string;
    salvar: string;
    aviseLimite: (restantes: number, limite: number) => string;
    aviseLimiteCheio: (limite: number) => string;
    aviseLimiteExcedido: (limite: number) => string;
    descricaoAlcance: (cartoes: number) => string;
    contagemCabecalho: (cartoes: number) => string;
    falhaSalvar: string;
    falhaSalvarBaralho: string;
    operacaoEmAndamento: string;
    cartaoExcluidoAnuncio: (frente: string) => string;
    buscaEFiltros: string;
    baralhoNaoEncontradoRotulo: string;
    falhaNaExclusaoDeCartao: string;
    cartoesDoBaralho: string;
    listaVazia: string;
    falhaNaExclusaoDoBaralho: string;
    buscaEFiltrosDaLista: string;
  };
  cartao: {
    anunciarFrenteVerso: string;
    anunciarImagem: string;
    pendingSave: string;
    descartarAlteracoes: string;
    descartarTexto: string;
    descartarConfirm: string;
    editarCartao: string;
    criarCartao: string;
    carregandoCartoes: string;
    cartaoNaoEncontrado: string;
    cartaoNaoEncontradoMsg: string;
    tipoCartaoLabel: string;
    imagemLabel: string;
    imagemHint: string;
    btnTrocarImagem: string;
    btnRemoverImagem: string;
    descricaoLabel: string;
    descricaoHint: string;
    caracteres: string;
    textoFrenteFront: string;
    textoFrente: string;
    textoVerso: string;
    btnEnviandoImagem: string;
    btnSalvando: string;
    btnSalvar: string;
    btnCancelar: string;
    naoEscolheuImagem: string;
    enviandoImagem: string;
    cartaoCriado: (frente: string) => string;
    aviseLimite: (restantes: number, limite: number) => string;
    aviseLimiteCheio: (limite: number) => string;
    aviseLimiteExcedido: (limite: number) => string;
    descartarImagemTitle: string;
    descartarImagemConfirm: string;
    descartarImagemMsg: (tipo: string) => string;
    tagsLabel: string;
    tagsPlaceholder: string;
    tagsAriaLabel: string;
    removerTagAriaLabel: (tag: string) => string;
    tagsFilterLabel: string;
    imagemIndisponivel: string;
    nomeDoTipo: { "frente-verso": string; imagem: string; audio: string };
    anunciarAudio: string;
    audioLabel: string;
    audioHint: string;
    btnTrocarAudio: string;
    btnRemoverAudio: string;
    mensagemLabel: string;
    mensagemHint: string;
    naoEscolheuAudio: string;
    enviandoAudio: string;
    btnEnviandoAudio: string;
    descartarAudioTitle: string;
    descartarAudioConfirm: string;
    descartarAudioMsg: (tipo: string) => string;
    audioIndisponivel: string;
    audioSemMensagem: string;
    cartaoDoTipoAudio: string;
    semMensagem: string;
    tipoAtual: (tipo: string) => string;
    imagemSemDescricao: string;
    pendenciaDeSalvamento: string;
    falhaNaEdicao: string;
    falhaNaCriacao: string;
    tags: string;
    itemDeTotal: (posicao: number, total: number) => string;
  };
  tocador: {
    tocar: string;
    pausar: string;
    posicao: string;
    posicaoFalada: (atual: string, total: string) => string;
    tocando: string;
    pausado: string;
    fim: string;
    duracao: (falada: string) => string;
  };
  sessao: {
    revelarVerse: string;
    verso: string;
    avaliacao: string;
    cartaoDoTipoImagem: string;
    semTexto: string;
    cartaoNoun: (n: number) => string;
    acertosDe: (acertos: number, total: number) => string;
    deAcertos: string;
    placarDaSessao: string;
    contagemPorOpcao: string;
    semAvaliacao: string;
    nenhumCartaoAvaliado: (rotulo: string) => string;
    sessaoIniciada: (total: number) => string;
    interromperSessaoTitulo: string;
    interromperSessaoDescricao: string;
    interromper: string;
    sairSemRegistrarTitulo: string;
    sairSemRegistrarDescricao: string;
    sairSemRegistrar: string;
    baralhoNaoEncontrado: string;
    falhaAoCarregarBaralho: string;
    falhaAoIniciarSessao: string;
    carregandoBaralho: string;
    revisar: string;
    estudar: string;
    voltarParaBaralho: string;
    voltarParaInicio: string;
    soPendentes: string;
    naoHaCartoesPendentes: string;
    todosOsCartoes: string;
    contagem: (n: number) => string;
    contagemPendentes: (n: number) => string;
    contagemNoBaralho: (n: number) => string;
    useMenorOuTemporaria: string;
    sessaoConcluida: string;
    situacaoDoRegistro: string;
    falhaAoRegistrarSessao: string;
    estudoProgramadoConcluido: string;
    revisarNovamente: string;
    tentarRegistrarNovamente: string;
    avaliacaoRegistrada: (rotulo: string) => string;
    revisaoDoDia: string;
    baralhoTemporario: string;
    /** O Baralho temporário no título da Sessão, em minúscula ("Revisar baralho temporário"). */
    baralhoTemporarioNoTitulo: string;
    revisorBaralho: string;
    rotinaPedeMais: (pedida: number, disponiveis: number) => string;
    baralhoNoTitulo: string;
    mudancaDeEstado: string;
    registrandoSessao: string;
    registradaNoHistorico: string;
    baralhoSalvo: string;
    abrirBaralho: string;
    salvarComoBaralho: string;
    voltarParaBaralhos: string;
    registreParaSalvar: string;
    revelarVerso: string;
    escolhaOConjunto: string;
    nivel: { errei: string; dificil: string; bom: string; facil: string };
    previaEmDias: (dias: number) => string;
    proximaRevisaoEm: (rotulo: string, previa: string) => string;
  };
  selecao: {
    excedeLimite: (quantidade: string, limite: string) => string;
    cartoesRepetidosUmaVez: string;
    baralhoTemporario: string;
    cartao: (n: number) => string;
    cartaoIndisponivel: (n: number) => string;
    adicioneUmCartao: string;
    reduza: string;
    todosEmOrdenAleatoria: string;
    naoFoiPossivelCarregar: string;
    acervoVazio: string;
    conteudoDisponivel: string;
    naoHaCartoes: string;
    contagem: (n: number) => string;
    naoHaCartoesParaSalvar: string;
    seraCopiado: (n: number) => string;
    baralhosPreservados: string;
    escolhaUmBaralho: string;
    escolhaOndeManterOriginal: string;
    escolhaBaralhoCartao: string;
    salvando: string;
    concluirOrganizacao: string;
    descartarSelecionado: string;
    selecaoDescartada: string;
    descartar: string;
    naSelecao: (contagem: string) => string;
    criarTemporario: string;
    escolhaOConteudo: string;
    selecaoDoEstudo: string;
    seuEstudoComeca: string;
    adicioneConteudo: string;
    limparSelecao: string;
    retirarIndisponiveis: string;
    verBaralhos: string;
    nenhumResultado: string;
    limparFiltros: string;
    adicionarBaralhos: string;
    adicionarCartoes: string;
    buscarBaralhos: string;
    digiteONome: string;
    situacaoDaRevisao: string;
    baralho: string;
    remover: string;
    buscarCartoes: string;
    buscarNaFrenteOuVerso: string;
    salvarComoBaralhoTitulo: string;
    guardeSelecao: string;
    nomeDoBaralho: string;
    contadorDeCaracteres: (atual: number, limite: number) => string;
    naoFoiPossivelSalvar: string;
    organizarTitulo: string;
    organizarDescricao: string;
    precisaDeUmBaralho: string;
    nomeDoNovoBaralho: string;
    criarBaralho: string;
    selecioneUmBaralho: string;
    adicionar: string;
    adicionado: string;
    adicionarNome: (nome: string) => string;
    adicionadoNome: (nome: string) => string;
    nomeDoBaralhoTemporario: string;
  };
  agenda: {
    marcadorDeHoje: string;
    contagem: (resumo: { total: number; concluidos: number; naoRealizados: number; estado: string }) => string;
    estadoDoDia: Record<string, string>;
    quantidadeCartoes: (quantidade: number | null) => string;
    estadoDoCompromisso: Record<string, string>;
    valoresAtuais: string;
    quantidadePendente: string;
    agendaDeHoje: string;
    agendaSemanal: string;
    carregandoAgenda: string;
    naoFoiPossivelAtualizarAgenda: string;
    atualizandoAgenda: string;
    verTodosEmEstudo: string;
    verAgendaSemanal: string;
    semanaAnterior: string;
    hoje: string;
    semanaSeguinte: string;
    nenhumEstudoAgendadoParaHoje: string;
    agendaDeHojeConcluida: string;
    nenhumEstudoAgendadoParaEsteDia: string;
    baralhoIndisponivel: string;
    verSessao: string;
    ajustarRotina: string;
    rotuloDoBaralho: (rotulo: string, nome: string) => string;
    iniciando: string;
    estudar: string;
    rotinasDeEstudo: string;
    agendar: string;
    carregandoRotinas: string;
    suasRotinas: string;
    naoTemRotinas: string;
    situacao: string;
    pausada: string;
    ativa: string;
    editar: string;
    retomar: string;
    pausar: string;
    excluir: string;
    pausarRotina: (nome: string) => string;
    excluirRotina: (nome: string) => string;
    pausarConfirm: string;
    excluirConfirm: string;
    editarRotina: string;
    agendar2: string;
    carregando: string;
    rotuloEditar: (nome: string) => string;
    rotuloRetomar: (nome: string) => string;
    rotuloPausar: (nome: string) => string;
    rotuloExcluir: (nome: string) => string;
    voltarParaRotinas: string;
    descartarAlteracoes: string;
    descartarAlteracaoProgramacao: string;
    descartarConfirm: string;
    escolhaBaralho: string;
    escolhaDia: string;
    informeQuantidade: string;
    baralhoSemCartoes: string;
    criarBaralhoLinkText: string;
    irParaBaralhosLinkText: string;
    escolhaBaralhoeAlMenumDia: string;
    salvarRotina: string;
    rotuloSalvar: string;
    rotuloEnviando: string;
    salvarAgendamento: string;
    salvarAlteracoes: string;
    naoEncontrada: string;
    rotinaNaoEncontrada: string;
    tentarNovamente: string;
    estudosDosDias: (total: number) => string;
    estudo: (total: number) => string;
    nenhum: string;
    sem: string;
    realizados: string;
    rotinaAlterada: (baralho: string, acao: "criar" | "editar" | "pausar" | "retomar" | "excluir") => string;
    rotinaSendoSalva: string;
    voltarParaEstudo: string;
    efeitoDaPausaOuExclusao: (pausar: boolean) => string;
    sessoesIniciadasConcluem: (excluir: boolean) => string;
    confirmarIndependentes: string;
    confirmarRotulo: string;
  };
  estatisticas: {
    itemEstudado: (n: number) => string;
    sessoesConcluidas: (n: number) => string;
    hoje: string;
    resumoSeteDias: (contagem: string, taxa: string) => string;
    itensEstudados: string;
    rotuloSessoesConcluidas: string;
    taxaDeAcerto: string;
    itensEstudadosNos7Dias: string;
    nenhumaSessao: string;
    carregandoSessao: string;
    sessaoConcluida: string;
    verBaralho: string;
    baralhoExcluido: string;
    estudoComBaralhoTemporario: string;
    ultimosSeteDialosNenhumItem: string;
    semItensEstudadosNos7Dias: string;
    resumoSeteDiasComTaxa: (contagem: string, taxa: number) => string;
    diaComItens: (rotulo: string, itens: number) => string;
    resumoDaSessao: (titulo: string, quando: string, percentual: string) => string;
    voltarParaEstudo: string;
  };
  conta: {
    perfil: string;
    carregandoPerfil: string;
    configuracao: string;
    algoritmoDeRepeticao: string;
    carregandoConfiguracao: string;
    salvandoConfiguracao: string;
    salvarConfig: string;
    configSalva: string;
    minhaConta: string;
    nomeDeUsuario: string;
    carregandoConta: string;
    trocarSenha: string;
    excluirConta: string;
    senhaTrocada: string;
    trocarSenhaForm: string;
    senhaAtual: string;
    novaSenha: string;
    confirmacaoDaSenha: string;
    trocando: string;
    cancelar: string;
    irParaEntrar: string;
    desconhecidoSenha: string;
    naoTrocada: string;
    excluirConta2: string;
    senhaAtualExclusao: string;
    excluindo: string;
    irreversivel: string;
    remocaoDescricao: string;
    nenhumDadoRecuperavel: string;
    desconhecidoExclusao: string;
    naoExcluida: string;
    falhaAoCarregarConfiguracao: string;
    falhaAoSalvarConfiguracao: string;
    falhaAoCarregarConta: string;
    falhaAoTrocarSenha: string;
    falhaAoExcluirConta: string;
    resultadoDesconhecido: string;
    aguardeTroca: string;
    descartarTrocaSenha: string;
    camposPreenchidosPerdidos: string;
    descartar: string;
    descartarAlteracoesConfig: string;
    alteracoesConfigPerdidas: string;
    aguardeExclusao: string;
    linhaCartoes: (n: number) => string;
    linhaBaralhos: (n: number) => string;
    linhaRegistrosDeSessao: (n: number) => string;
    linhaItensDaAgenda: (n: number) => string;
  };
  rotina: {
    salvando: string;
    escolhaUmBaralho: string;
    cartoesDoBaralho: (n: number) => string;
    diasDaSemana: string;
    ajudaDosDias: string;
    quantidadeDeCartoes: string;
    todosOsCartoes: string;
    definirQuantidade: string;
    quantosCartoes: string;
    ajudaDaQuantidade: string;
    ajudaDeTodos: string;
    usarValoresAtuais: string;
    manterODigitado: string;
    falhaAoSalvar: string;
    salvandoStatus: string;
    confirmarAlteracoes: string;
    confirmar: string;
    voltar: string;
    diasRemovidos: string;
    efeitoDiasRemovidos: string;
    diasAdicionados: string;
    efeitoDiasAdicionados: string;
    baralhoOuQuantidadeMudaram: string;
    efeitoBaralhoOuQuantidade: string;
    preservados: string;
    confirmarIndependentes: string;
    confirmarESalvar: string;
    cadaRotinaContaSeparado: string;
    resumo: string;
  };
  importacao: {
    titulo: string;
    descricao: string;
    arquivo: string;
    lendo: string;
    conteudoIgnorado: (notas: number, cartoes: number) => string;
    concluirEdicao: string;
    editarTitulo: string;
    nomeDoBaralho: string;
    adicionado: string;
    modificado: string;
    frente: string;
    verso: string;
    concluir: string;
    editar: string;
    escolherOutro: string;
    importando: string;
    confirmar: string;
  };
  exportacao: {
    titulo: string; todos: string; formato: string; opcaoFormato: string; ajuda: string;
    resumoBaralhos: (n: number) => string; resumoCartoes: (n: number) => string;
    resumoMidias: (imagens: number, audios: number) => string; tamanho: (bytes: string) => string;
    carregando: string; marcarUm: string; semCartoes: string; exportar: string; gerando: string; pronto: (nome: string) => string;
    baixarDeNovo: string; semMidia: (n: number) => string; falha: string;
    antesDeExcluir: string;
  };
  contaDeTeste: {
    entrar: string; ou: string; apresentacao: string; preparando: string; terminou: string;
    etiqueta: string; aviso: string; linkCreditos: string;
    creditos: {
      titulo: string; fechar: string; verFonte: string; verFonteDe: (cartao: string) => string;
      autorELicenca: (autor: string, licenca: string) => string; licencas: Record<string, string>;
    };
    perfil: string; sairConfirmacao: string; sairEApagar: string; cancelar: string;
  };
}

export const pt: Catalogo = {
  recusa: textoDaRecusaPt,
  seletor: {
    rotulo: (idioma: Idioma) =>
      `Idioma: ${NOME_NATIVO[idioma]}`,
    anuncio: (idioma: Idioma) =>
      `Idioma alterado para ${NOME_NATIVO[idioma]}`,
    nomeDoIdioma: "Português",
  },
  comum: {
    cancelar: "Cancelar",
    salvar: "Salvar",
    voltar: "Voltar",
    tentarNovamente: "Tentar novamente",
  },
  moldura: {
    labelNav: "Principal",
    inicio: "Início",
    estudo: "Estudo",
    baralhos: "Baralhos",
    perfil: "Perfil",
    sair: "Sair",
  },
  acesso: {
    entrar_rotulo: "Entrar",
    criar_conta_rotulo: "Criar conta",
    nomeDeUsuario: "Nome de usuário",
    senha: "Senha",
    confirmacaoDaSenha: "Confirmação da Senha",
    continuarConectado: "Continuar conectado neste navegador",
    entrando: "Entrando…",
    botaoEntrar: "Entrar",
    botaoCriarConta: "Criar conta",
    criandoConta: "Criando conta…",
    ainda_nao_tem_conta: "Ainda não tem conta?",
    link_criar_conta: "Criar conta",
    ja_tem_uma_conta: "Já tem uma conta?",
    link_entrar: "Entrar",
    aria_saida_concluida: "Saída concluída",
    aria_conta_excluida: "Conta excluída",
    aria_credencial_recusada: "Credencial recusada",
    aria_falha_ao_entrar: "Falha ao Entrar",
    aria_falha_no_cadastro: "Falha no Cadastro",
    aria_cadastro_concluido: "Cadastro concluído",
    aria_falha_ao_sair: "Falha ao Sair",
    regras_nome: (min: number, max: number) =>
      `De ${min} a ${max} caracteres: letras de A a Z sem acento, dígitos, ponto, sublinhado e hífen.`,
    contador: (atual: number, max: number) =>
      `${atual} / ${max} caracteres`,
    aviso_nome_minimo: (min: number, atual: number) =>
      `Atenção: o nome de usuário deve ter pelo menos ${min} caracteres; o informado tem ${atual}.`,
    aviso_nome_maximo: (max: number) =>
      `Atenção: o nome de usuário excede o limite de ${max} caracteres.`,
    aviso_nome_limite_atingido: (max: number) =>
      `Atenção: o nome de usuário atingiu o limite de ${max} caracteres.`,
    aviso_nome_restante: (restante: number, max: number) =>
      `Atenção: faltam ${restante} caracteres para o limite de ${max}.`,
    regras_senha: (min: number, max: number) =>
      `De ${min} a ${max} caracteres: qualquer caractere, inclusive espaços.`,
    aviso_senha_minimo: (min: number, atual: number) =>
      `Atenção: a Senha deve ter pelo menos ${min} caracteres; a informada tem ${atual}.`,
    aviso_senha_maximo: (max: number) =>
      `Atenção: a Senha excede o limite de ${max} caracteres.`,
    aviso_senha_limite_atingido: (max: number) =>
      `Atenção: a Senha atingiu o limite de ${max} caracteres.`,
    aviso_senha_restante: (restante: number, max: number) =>
      `Atenção: faltam ${restante} caracteres para o limite da Senha de ${max}.`,
    cadastro_concluido: (nomeDeUsuario: string) =>
      `Cadastro concluído. O Usuário ${nomeDeUsuario} foi criado.`,
    mostrar: "Mostrar",
    ocultar: "Ocultar",
    confiraConta: "Entre novamente para conferir o estado da sua conta: a última alteração não pôde ser confirmada.",
    verificandoAcesso: "Verificando o acesso…",
    falhaAoVerificarAcesso: "Falha ao verificar o acesso",
    voltandoParaInicio: "Voltando para Início…",
    voltandoParaBaralhos: "Voltando para Baralhos…",
    descartarCadastro: "Descartar o Cadastro?",
    dadosPreenchidosPerdidos: "Os dados preenchidos serão perdidos.",
    descartar: "Descartar",
  },
  inicio: {
    ola: (nome: string) => `Olá, ${nome}`,
    ver_baralhos: "Ver Baralhos",
    estudo_titulo: "Estudo",
    estudo_descricao: "Acompanhe a semana, seus resultados e as últimas Sessões.",
    agendar_estudo: "Agendar estudo",
    gerenciar_rotinas: "Gerenciar rotinas",
    estatisticas_titulo: "Seu estudo nos últimos 7 dias",
    carregando_estudo: "Carregando o seu estudo…",
    atualizando: "Atualizando…",
    ultimas_sessoes_titulo: "Últimas sessões",
    carregando_sessoes: "Carregando as últimas Sessões…",
    nao_foi_possivel_carregar_sessoes: "Não foi possível carregar as últimas Sessões.",
    verificando_cartoes: "Verificando Cartões existentes…",
    organizar_cartoes_titulo: "Organizar Cartões existentes",
    nao_foi_possivel_atualizar: "Não foi possível atualizar as Estatísticas. Os dados abaixo podem estar desatualizados.",
  },
  baralhos: {
    titulo: "Baralhos",
    descricao: "Escolha o que você quer memorizar hoje.",
    btnImportar: "Importar",
    btnCriarBaralho: "Criar baralho",
    btnCriarBaralhoTemporario: "Criar baralho temporário",
    buscarLabel: "Buscar baralhos",
    buscarPlaceholder: "Digite o nome do baralho",
    situacaoLabel: "Situação da revisão",
    rotuloDaSituacao: { "sem-cartoes": "Sem cartões", pendente: "Pendente", revisado: "Revisado" },
    situacaoTodos: "Todos",
    situacaoPendente: "Pendente",
    situacaoRevisado: "Revisado",
    btnLimparFiltros: "Limpar filtros",
    carregando: "Carregando Baralhos…",
    vazio: "Ainda não há Baralhos. Crie o primeiro para começar a revisar.",
    naoEncontrado: "Nenhum resultado encontrado",
    naoEncontradoDescricao: "Altere a busca ou limpe os filtros para ver o acervo.",
    contagem: (n: number) => `${n} ${n === 1 ? "resultado" : "resultados"}`,
    btnRevisar: "Revisar",
    btnEditar: "Editar",
    semCartoes: "Sem Cartões para revisar.",
    motivo: "Aguarde: a operação está em andamento.",
    pendingOperation: "Aguarde: a operação está em andamento.",
    deckNotFound: "Baralho não encontrado",
    btnRevisarEsteBaralho: "Revisar este Baralho",
    btnCriarCartao: "Criar Cartão",
    btnRenomear: "Renomear",
    btnExcluirBaralho: "Excluir Baralho",
    ajudaCriarCartoes: "Crie Cartões neste Baralho para poder revisar.",
    buscarCartoes: "Buscar Cartões",
    buscarCartoesPlaceholder: "Digite o nome ou conteúdo do Cartão",
    tipoCartaoLabel: "Tipo de cartão",
    tipoCartaoTodos: "Todos",
    cartaoEncontrado: (n: number) => n === 1 ? "1 Cartão encontrado." : `${n} Cartões encontrados.`,
    vazioSemCartoes: "Este Baralho ainda não tem Cartões.",
    naoEncontradoCartoes: "Nenhum Cartão encontrado",
    naoEncontradoCartoesDescricao: "Altere a busca ou limpe os filtros para ver os Cartões deste Baralho.",
    cartaoRevisado: "Revisado",
    cartaoPendente: "Pendente",
    btnExcluirCartao: "Excluir",
    excluirCartaoConfirm: "Excluir Cartão",
    excluirBaralhoConfirm: "Excluir Baralho",
    descricaoCartaoExcluido: "O Cartão e seu Agendamento serão removidos. Registros históricos já concluídos permanecerão.",
    descricaoBaralhoExcluido: (cartoes: number, agendamentos?: number) => {
      let desc = `Serão removidos o Baralho, ${cartoes} ${cartoes === 1 ? "Cartão" : "Cartões"}`;
      if (agendamentos !== undefined && agendamentos > 0) {
        desc += ` e ${agendamentos} ${agendamentos === 1 ? "Agendamento" : "Agendamentos"}`;
      }
      desc += ". Registros históricos já concluídos permanecerão.";
      return desc;
    },
    pendingSaveBaralho: "Aguarde: o Baralho está sendo salvo.",
    descartarAlteracoes: "Descartar as alterações?",
    descartarTexto: "O nome digitado será perdido.",
    descartarConfirm: "Descartar",
    voltarBaralho: "← Voltar para o Baralho",
    voltarBaralhos: "← Voltar para Baralhos",
    criarBaralho: "Criar baralho",
    renomearBaralho: "Renomear Baralho",
    carregandoBaralho: "Carregando Baralho…",
    nomeLabel: "Nome",
    caracteres: "caracteres",
    salvando: "Salvando…",
    salvar: "Salvar",
    aviseLimite: (restantes: number, limite: number) => `Atenção: faltam ${restantes} caracteres para o limite de ${limite}.`,
    aviseLimiteCheio: (limite: number) => `Atenção: o nome atingiu o limite de ${limite} caracteres.`,
    aviseLimiteExcedido: (limite: number) => `Atenção: o nome excede o limite de ${limite} caracteres.`,
    descricaoAlcance: (cartoes: number) => cartoes === 0 ? "Este Baralho não tem Cartões vinculados." : cartoes === 1 ? "Este Baralho tem 1 Cartão vinculado." : `Este Baralho tem ${cartoes} Cartões vinculados.`,
    contagemCabecalho: (cartoes: number) => cartoes === 0 ? "Nenhum Cartão neste Baralho." : cartoes === 1 ? "1 Cartão neste Baralho." : `${cartoes} Cartões neste Baralho.`,
    falhaSalvar: "Falha ao salvar o Baralho",
    falhaSalvarBaralho: "Falha ao salvar o Baralho",
    operacaoEmAndamento: "Aguarde: a operação está em andamento.",
    cartaoExcluidoAnuncio: (frente: string) => `Cartão ${frente} e seu Agendamento foram excluídos. O Histórico permanece.`,
    buscaEFiltros: "Busca e filtros dos Cartões",
    baralhoNaoEncontradoRotulo: "Baralho não encontrado",
    falhaNaExclusaoDeCartao: "Falha na exclusão de Cartão",
    cartoesDoBaralho: "Cartões do Baralho",
    listaVazia: "Lista de Cartões vazia",
    falhaNaExclusaoDoBaralho: "Falha na exclusão do Baralho",
    buscaEFiltrosDaLista: "Busca e filtros",
  },
  cartao: {
    anunciarFrenteVerso: "Campos do tipo Frente-Verso",
    anunciarImagem: "Campos do tipo Imagem",
    pendingSave: "Aguarde: o Cartão está sendo salvo.",
    descartarAlteracoes: "Descartar as alterações?",
    descartarTexto: "O texto digitado será perdido.",
    descartarConfirm: "Descartar",
    editarCartao: "Editar Cartão",
    criarCartao: "Criar cartão",
    carregandoCartoes: "Carregando Cartões…",
    cartaoNaoEncontrado: "Cartão não encontrado",
    cartaoNaoEncontradoMsg: "O Cartão não existe ou não pertence a você.",
    tipoCartaoLabel: "Tipo de cartão",
    imagemLabel: "Imagem",
    imagemHint: "JPEG, PNG, WebP ou GIF, até 5 MB.",
    btnTrocarImagem: "Trocar imagem",
    btnRemoverImagem: "Remover imagem",
    descricaoLabel: "Descrição da imagem (opcional)",
    descricaoHint: "Descreva a imagem sem revelar a resposta.",
    caracteres: "caracteres",
    textoFrenteFront: "Texto da frente (opcional)",
    textoFrente: "Frente",
    textoVerso: "Verso",
    btnEnviandoImagem: "Enviando imagem…",
    btnSalvando: "Salvando…",
    btnSalvar: "Salvar",
    btnCancelar: "Cancelar",
    naoEscolheuImagem: "Escolha uma imagem.",
    enviandoImagem: "Enviando imagem…",
    cartaoCriado: (frente: string) => `Cartão criado: ${frente || "Imagem"}.`,
    aviseLimite: (restantes: number, limite: number) => `Atenção: faltam ${restantes} caracteres para o limite de ${limite}.`,
    aviseLimiteCheio: (limite: number) => `Atenção: o texto atingiu o limite de ${limite} caracteres.`,
    aviseLimiteExcedido: (limite: number) => `Atenção: o texto excede o limite de ${limite} caracteres.`,
    descartarImagemTitle: "Descartar a imagem?",
    descartarImagemConfirm: "Descartar imagem",
    descartarImagemMsg: (tipo: string) => `A imagem escolhida não existe no tipo ${tipo} e será descartada.`,
    tagsLabel: "Tags",
    tagsPlaceholder: "Digite uma tag e pressione Enter",
    tagsAriaLabel: "Tags adicionadas",
    removerTagAriaLabel: (tag: string) => `Remover tag ${tag}`,
    tagsFilterLabel: "Tags",
    imagemIndisponivel: "Imagem indisponível",
    nomeDoTipo: { "frente-verso": "Frente-Verso", imagem: "Imagem", audio: "Áudio" },
    anunciarAudio: "Campos do tipo Áudio",
    audioLabel: "Áudio",
    audioHint: "MP3, M4A, OGG, WebM ou WAV, até 10 MB e 5 minutos. MP3 e M4A tocam em todos os aparelhos.",
    btnTrocarAudio: "Trocar áudio",
    btnRemoverAudio: "Remover áudio",
    mensagemLabel: "Mensagem (opcional)",
    mensagemHint: "Contexto ou pergunta para o áudio, sem revelar a resposta.",
    naoEscolheuAudio: "Escolha um áudio.",
    enviandoAudio: "Enviando áudio…",
    btnEnviandoAudio: "Enviando áudio…",
    descartarAudioTitle: "Descartar o áudio?",
    descartarAudioConfirm: "Descartar áudio",
    descartarAudioMsg: (tipo: string) => `O áudio escolhido não existe no tipo ${tipo} e será descartado.`,
    audioIndisponivel: "Áudio indisponível",
    audioSemMensagem: "Áudio do Cartão",
    cartaoDoTipoAudio: "Cartão do tipo Áudio",
    semMensagem: "sem mensagem",
    tipoAtual: (tipo: string) => `Tipo: ${tipo}`,
    imagemSemDescricao: "Imagem do Cartão",
    pendenciaDeSalvamento: "Aguarde: o Cartão está sendo salvo.",
    falhaNaEdicao: "Falha na edição do Cartão",
    falhaNaCriacao: "Falha na criação do Cartão",
    tags: "Tags",
    itemDeTotal: (posicao: number, total: number) => `Item ${posicao} de ${total}`,
  },
  tocador: {
    tocar: "Tocar áudio",
    pausar: "Pausar áudio",
    posicao: "Posição do áudio",
    posicaoFalada: (atual: string, total: string) => `${atual} de ${total}`,
    tocando: "Tocando",
    pausado: "Pausado",
    fim: "Fim do áudio",
    duracao: (falada: string) => `Duração: ${falada}`,
  },
  sessao: {
    revelarVerse: "Verso revelado.",
    verso: "Verso",
    avaliacao: "Avaliação:",
    cartaoDoTipoImagem: "Cartão do tipo Imagem",
    semTexto: "sem texto",
    cartaoNoun: (n: number) => n === 1 ? "Cartão" : "Cartões",
    acertosDe: (acertos: number, total: number) => `${acertos} de ${total}`,
    deAcertos: "de acertos",
    placarDaSessao: "Placar da Sessão",
    contagemPorOpcao: "Contagem por opção de Avaliação",
    semAvaliacao: "Sem avaliação",
    nenhumCartaoAvaliado: (rotulo: string) => `Nenhum Cartão avaliado como ${rotulo}`,
    sessaoIniciada: (total: number) => `Sessão iniciada com ${total} ${total === 1 ? "Item" : "Itens"}.`,
    interromperSessaoTitulo: "Interromper a Sessão?",
    interromperSessaoDescricao: "O progresso desta Sessão será descartado e não haverá Resumo.",
    interromper: "Interromper",
    sairSemRegistrarTitulo: "Sair sem registrar a Sessão?",
    sairSemRegistrarDescricao: "Esta Sessão não ficará no seu histórico.",
    sairSemRegistrar: "Sair sem registrar",
    baralhoNaoEncontrado: "Baralho não encontrado",
    falhaAoCarregarBaralho: "Falha ao carregar o Baralho",
    falhaAoIniciarSessao: "Falha ao iniciar a Sessão",
    carregandoBaralho: "Carregando Baralho…",
    revisar: "Revisar",
    estudar: "Estudar",
    voltarParaBaralho: "Voltar para o Baralho",
    voltarParaInicio: "Voltar para Início",
    soPendentes: "Só pendentes",
    naoHaCartoesPendentes: "Não há Cartões pendentes neste Baralho.",
    todosOsCartoes: "Todos os cartões",
    contagem: (n: number) => n === 1 ? "1 Cartão" : `${n} Cartões`,
    contagemPendentes: (n: number) => n === 1 ? "1 Cartão pendente" : `${n} Cartões pendentes`,
    contagemNoBaralho: (n: number) => n === 1 ? "1 Cartão no Baralho" : `${n} Cartões no Baralho`,
    useMenorOuTemporaria: "Use um Baralho menor ou a seleção temporária.",
    sessaoConcluida: "Sessão concluída",
    situacaoDoRegistro: "Situação do registro da Sessão",
    falhaAoRegistrarSessao: "Falha ao registrar a Sessão",
    estudoProgramadoConcluido: "O estudo programado de hoje foi concluído.",
    revisarNovamente: "Revisar novamente",
    tentarRegistrarNovamente: "Tentar registrar novamente",
    avaliacaoRegistrada: (rotulo: string) => `Avaliação registrada: ${rotulo}.`,
    revisaoDoDia: "Revisão do dia",
    baralhoTemporario: "Baralho temporário",
    baralhoTemporarioNoTitulo: "baralho temporário",
    revisorBaralho: "Revisar baralho",
    rotinaPedeMais: (pedida: number, disponiveis: number) => `A Rotina pede ${pedida} Cartões, mas este Baralho tem ${disponiveis}. A Sessão terá ${disponiveis} ${disponiveis === 1 ? "Item" : "Itens"}.`,
    baralhoNoTitulo: "Baralho",
    mudancaDeEstado: "Mudança de estado da Sessão",
    registrandoSessao: "Registrando a Sessão…",
    registradaNoHistorico: "Sessão registrada no histórico.",
    baralhoSalvo: "Baralho salvo.",
    abrirBaralho: "Abrir baralho",
    salvarComoBaralho: "Salvar como baralho",
    voltarParaBaralhos: "Voltar para Baralhos",
    registreParaSalvar: "Registre a Sessão para salvar o baralho.",
    revelarVerso: "Revelar verso",
    escolhaOConjunto: "Escolha o conjunto que você quer revisar agora.",
    nivel: { errei: "Errei", dificil: "Difícil", bom: "Bom", facil: "Fácil" },
    previaEmDias: (dias: number) => (dias === 1 ? "1 dia" : `${dias} dias`),
    proximaRevisaoEm: (rotulo: string, previa: string) => `${rotulo}, próxima revisão em ${previa}`,
  },
  selecao: {
    excedeLimite: (quantidade, limite) => `O conjunto tem ${quantidade} Cartões e excede o limite de ${limite} por Sessão.`,
    cartoesRepetidosUmaVez: "Cartões repetidos entram uma só vez.",
    baralhoTemporario: "Baralho temporário",
    cartao: (n: number) => n === 1 ? "1 Cartão" : `${n} Cartões`,
    cartaoIndisponivel: (n: number) => n === 1 ? "1 Cartão não está mais disponível." : `${n} Cartões não estão mais disponíveis.`,
    adicioneUmCartao: "Adicione pelo menos um cartão para revisar.",
    reduza: "Reduza a seleção para no máximo 1.000 cartões.",
    todosEmOrdenAleatoria: "Todos os cartões selecionados serão revisados em ordem aleatória.",
    naoFoiPossivelCarregar: "Não foi possível carregar o acervo.",
    acervoVazio: "Seu acervo está vazio. Crie cartões para montar um estudo.",
    conteudoDisponivel: "Conteúdo disponível",
    naoHaCartoes: "0 Cartões · Baralho vazio",
    contagem: (n: number) => `${n} ${n === 1 ? "Cartão" : "Cartões"}`,
    naoHaCartoesParaSalvar: "Não há Cartões disponíveis para salvar.",
    seraCopiado: (n: number) => n === 1 ? "Será criada 1 cópia de Cartão. Os baralhos de origem serão preservados." : `Serão criadas ${n} cópias de Cartões. Os baralhos de origem serão preservados.`,
    baralhosPreservados: "Os baralhos de origem serão preservados.",
    escolhaUmBaralho: "Escolha um Baralho para cada Cartão.",
    escolhaOndeManterOriginal: "Escolha onde manter o original. Os outros Baralhos receberão cópias.",
    escolhaBaralhoCartao: "Escolha um Baralho para este Cartão.",
    salvando: "Salvando…",
    concluirOrganizacao: "Concluir organização",
    descartarSelecionado: "Descartar este percurso?",
    selecaoDescartada: "A seleção e os campos não salvos serão descartados.",
    descartar: "Descartar",
    naSelecao: (contagem: string) => `${contagem} na seleção. `,
    criarTemporario: "Criar baralho temporário",
    escolhaOConteudo: "Escolha o conteúdo para esta Sessão. Você poderá salvar o baralho ao terminar.",
    selecaoDoEstudo: "Seleção do estudo",
    seuEstudoComeca: "Seu estudo começa aqui",
    adicioneConteudo: "Adicione baralhos ou cartões individuais. Cartões repetidos entram uma só vez.",
    limparSelecao: "Limpar seleção",
    retirarIndisponiveis: "Retirar indisponíveis",
    verBaralhos: "Ver baralhos",
    nenhumResultado: "Nenhum resultado encontrado. Altere a busca ou os filtros.",
    limparFiltros: "Limpar filtros",
    adicionarBaralhos: "Adicionar baralhos",
    adicionarCartoes: "Adicionar cartões",
    buscarBaralhos: "Buscar baralhos",
    digiteONome: "Digite o nome do baralho",
    situacaoDaRevisao: "Situação da revisão",
    baralho: "Baralho",
    remover: "Remover",
    buscarCartoes: "Buscar cartões",
    buscarNaFrenteOuVerso: "Buscar na frente ou no verso",
    salvarComoBaralhoTitulo: "Salvar como baralho",
    guardeSelecao: "Guarde esta seleção para revisar novamente.",
    nomeDoBaralho: "Nome do baralho",
    contadorDeCaracteres: (atual: number, limite: number) => `${atual} / ${limite} caracteres`,
    naoFoiPossivelSalvar: "Não foi possível salvar. Seu nome e a seleção foram preservados. Tente novamente.",
    organizarTitulo: "Organizar Cartões existentes",
    organizarDescricao: "Escolha onde cada Cartão deve ficar. As escolhas serão salvas juntas.",
    precisaDeUmBaralho: "Você precisa de um Baralho para organizar seus Cartões. Crie um Baralho para continuar.",
    nomeDoNovoBaralho: "Nome do Baralho",
    criarBaralho: "Criar Baralho",
    selecioneUmBaralho: "Selecione um Baralho",
    adicionar: "Adicionar",
    adicionado: "Adicionado",
    adicionarNome: (nome) => `Adicionar ${nome}`,
    adicionadoNome: (nome) => `Adicionado ${nome}`,
    nomeDoBaralhoTemporario: "Nome do baralho temporário (opcional)",
  },
  agenda: {
    marcadorDeHoje: " (hoje)",
    contagem: (resumo) => {
      if (resumo.total === 0) return "Nenhum estudo agendado";
      const plural = new Intl.PluralRules("pt-BR");
      const estudo = plural.select(resumo.total) === "one" ? "estudo concluído" : "estudos concluídos";
      const base = `${resumo.concluidos} de ${resumo.total} ${estudo}`;
      if (resumo.estado !== "nao_realizado") return base;
      const naoRealizado = plural.select(resumo.naoRealizados) === "one" ? "não realizado" : "não realizados";
      return `${base}; ${resumo.naoRealizados} ${naoRealizado}`;
    },
    estadoDoDia: { sem_estudos: "Sem estudos", concluido: "Concluído", nao_realizado: "Não realizado", programado: "Programado", pendente: "Pendente", parcial: "Parcial" },
    quantidadeCartoes: (quantidade: number | null) => {
      if (quantidade === null) return "Todos os Cartões";
      const plural = new Intl.PluralRules("pt-BR");
      return `${quantidade} ${plural.select(quantidade) === "one" ? "Cartão" : "Cartões"}`;
    },
    estadoDoCompromisso: { pendente: "Pendente", programado: "Programado", nao_realizado: "Não realizado", concluido: "Concluído", cancelado: "Cancelado" },
    valoresAtuais: "Valores atuais",
    quantidadePendente: "(informe a quantidade)",
    agendaDeHoje: "Agenda de hoje",
    agendaSemanal: "Agenda semanal",
    carregandoAgenda: "Carregando a agenda…",
    naoFoiPossivelAtualizarAgenda: "Não foi possível atualizar a agenda. Os dados abaixo podem estar desatualizados.",
    atualizandoAgenda: "Atualizando a agenda…",
    verTodosEmEstudo: "Ver todos em Estudo",
    verAgendaSemanal: "Ver agenda semanal",
    semanaAnterior: "Semana anterior",
    hoje: "Hoje",
    semanaSeguinte: "Semana seguinte",
    nenhumEstudoAgendadoParaHoje: "Nenhum estudo agendado para hoje",
    agendaDeHojeConcluida: "Agenda de hoje concluída",
    nenhumEstudoAgendadoParaEsteDia: "Nenhum estudo agendado para este dia.",
    baralhoIndisponivel: "Baralho indisponível",
    verSessao: "Ver Sessão",
    ajustarRotina: "Ajustar rotina",
    rotuloDoBaralho: (rotulo: string, nome: string) => `${rotulo} de ${nome}`,
    iniciando: "Iniciando…",
    estudar: "Estudar",
    rotinasDeEstudo: "Rotinas de estudo",
    agendar: "Agendar estudo",
    carregandoRotinas: "Carregando as Rotinas…",
    suasRotinas: "Suas rotinas",
    naoTemRotinas: "Você ainda não tem Rotinas de estudo.",
    situacao: "Situação:",
    pausada: "Pausada",
    ativa: "Ativa",
    editar: "Editar",
    retomar: "Retomar",
    pausar: "Pausar",
    excluir: "Excluir",
    pausarRotina: (nome: string) => `Pausar a Rotina de ${nome}?`,
    excluirRotina: (nome: string) => `Excluir a Rotina de ${nome}?`,
    pausarConfirm: "Pausar Rotina",
    excluirConfirm: "Excluir Rotina",
    editarRotina: "Editar rotina",
    agendar2: "Agendar estudo",
    carregando: "Carregando…",
    rotuloEditar: (nome: string) => `Editar rotina de ${nome}`,
    rotuloRetomar: (nome: string) => `Retomar rotina de ${nome}`,
    rotuloPausar: (nome: string) => `Pausar rotina de ${nome}`,
    rotuloExcluir: (nome: string) => `Excluir rotina de ${nome}`,
    voltarParaRotinas: "← Voltar para Rotinas de estudo",
    descartarAlteracoes: "Descartar as alterações?",
    descartarAlteracaoProgramacao: "A programação digitada será perdida.",
    descartarConfirm: "Descartar",
    escolhaBaralho: "Escolha um Baralho para a Rotina.",
    escolhaDia: "Escolha ao menos um dia da semana.",
    informeQuantidade: "Informe um número inteiro de 1 a 999 Cartões, ou escolha Todos os Cartões.",
    baralhoSemCartoes: "Você ainda não tem um Baralho com Cartões para agendar. Crie um Baralho, ou adicione Cartões a um Baralho existente.",
    criarBaralhoLinkText: "Criar Baralho",
    irParaBaralhosLinkText: "Ir para Baralhos",
    escolhaBaralhoeAlMenumDia: "Escolha o Baralho e ao menos um dia para ver o resumo.",
    salvarRotina: "Rotina de",
    rotuloSalvar: "Salvar",
    rotuloEnviando: "Enviando…",
    salvarAgendamento: "Salvar agendamento",
    salvarAlteracoes: "Salvar alterações",
    naoEncontrada: "Rotina não encontrada.",
    rotinaNaoEncontrada: "Rotina não encontrada.",
    tentarNovamente: "Tentar novamente",
    estudosDosDias: (total: number) => total === 1 ? "1 estudo" : `${total} estudos`,
    estudo: (n: number) => n === 1 ? "estudo" : "estudos",
    nenhum: "Nenhum",
    sem: "sem",
    realizados: "realizados",
    rotinaAlterada: (baralho: string, acao: "criar" | "editar" | "pausar" | "retomar" | "excluir") => `Rotina de ${baralho} ${{ criar: "criada", editar: "alterada", pausar: "pausada", retomar: "retomada", excluir: "excluída" }[acao]}.`,
    rotinaSendoSalva: "Aguarde: a Rotina está sendo salva.",
    voltarParaEstudo: "Voltar para Estudo",
    efeitoDaPausaOuExclusao: (pausar: boolean) => `Os estudos de hoje que ainda não foram concluídos serão cancelados, e nenhum novo estudo será programado${pausar ? " até você retomar" : ""}. Os estudos passados e concluídos, os Cartões, os Baralhos, os Registros de sessão e o Histórico permanecem.`,
    sessoesIniciadasConcluem: (excluir: boolean) => `Sessões já iniciadas ainda poderão concluir o estudo de hoje.${excluir ? " Excluir uma Rotina não pode ser desfeito." : ""}`,
    confirmarIndependentes: "Confirmar estudos independentes?",
    confirmarRotulo: "Confirmar",
  },
  estatisticas: {
    itemEstudado: (n: number) => n === 1 ? "1 Item estudado" : `${n} Itens estudados`,
    sessoesConcluidas: (n: number) => n === 1 ? "1 Sessão concluída" : `${n} Sessões concluídas`,
    hoje: "Hoje",
    resumoSeteDias: (contagem, taxa) => `Últimos 7 dias: ${contagem} · ${taxa} de acerto`,
    itensEstudados: "Itens estudados",
    rotuloSessoesConcluidas: "Sessões concluídas",
    taxaDeAcerto: "Taxa de acerto",
    itensEstudadosNos7Dias: "Itens estudados nos últimos 7 dias",
    nenhumaSessao: "Você ainda não concluiu nenhuma Sessão.",
    carregandoSessao: "Carregando a Sessão…",
    sessaoConcluida: "Sessão concluída",
    verBaralho: "Ver baralho",
    baralhoExcluido: "Baralho excluído",
    estudoComBaralhoTemporario: "Estudo com baralho temporário",
    ultimosSeteDialosNenhumItem: "Últimos 7 dias: nenhum Item estudado.",
    semItensEstudadosNos7Dias: "Sem Itens estudados nos últimos 7 dias",
    resumoSeteDiasComTaxa: (contagem: string, taxa: number) => `Últimos 7 dias: ${contagem} · ${taxa}% de acerto`,
    diaComItens: (rotulo: string, itens: number) => `${rotulo}: ${itens} Itens`,
    resumoDaSessao: (titulo: string, quando: string, percentual: string) => `${titulo}, ${quando}, ${percentual} de acerto`,
    voltarParaEstudo: "Voltar para Estudo",
  },
  conta: {
    perfil: "Perfil",
    carregandoPerfil: "Carregando Perfil…",
    configuracao: "Configuração",
    algoritmoDeRepeticao: "Algoritmo de repetição espaçada",
    carregandoConfiguracao: "Carregando a Configuração",
    salvandoConfiguracao: "Aguarde: a Configuração está sendo salva.",
    salvarConfig: "Salvar",
    configSalva: "Configuração salva.",
    minhaConta: "Minha conta",
    nomeDeUsuario: "Nome de usuário:",
    carregandoConta: "Carregando a conta…",
    trocarSenha: "Trocar Senha",
    excluirConta: "Excluir conta",
    senhaTrocada: "Senha trocada.",
    trocarSenhaForm: "Trocar Senha",
    senhaAtual: "Senha atual",
    novaSenha: "Nova Senha",
    confirmacaoDaSenha: "Confirmação da Senha",
    trocando: "Trocando…",
    cancelar: "Cancelar",
    irParaEntrar: "Ir para Entrar",
    desconhecidoSenha: "Não foi possível confirmar se a Senha foi trocada.",
    naoTrocada: "Não foi possível trocar a Senha agora. Nada foi alterado. Tente novamente.",
    excluirConta2: "Excluir conta?",
    senhaAtualExclusao: "Senha atual",
    excluindo: "Excluindo…",
    irreversivel: "Esta ação é irreversível.",
    remocaoDescricao: "Excluir a conta remove o Usuário e tudo o que é dele:",
    nenhumDadoRecuperavel: "Nenhum dado poderá ser recuperado, e o Nome de usuário ficará livre para novo Cadastro.",
    desconhecidoExclusao: "Não foi possível confirmar se a conta foi excluída.",
    naoExcluida: "Não foi possível excluir a conta agora. Nada foi excluído. Tente novamente.",
    falhaAoCarregarConfiguracao: "Falha ao carregar a Configuração",
    falhaAoSalvarConfiguracao: "Falha ao salvar a Configuração",
    falhaAoCarregarConta: "Falha ao carregar a conta",
    falhaAoTrocarSenha: "Falha ao trocar a Senha",
    falhaAoExcluirConta: "Falha ao excluir a conta",
    resultadoDesconhecido: "Resultado desconhecido",
    aguardeTroca: "Aguarde: a Senha está sendo trocada.",
    descartarTrocaSenha: "Descartar a troca de Senha?",
    camposPreenchidosPerdidos: "Os campos preenchidos serão perdidos.",
    descartar: "Descartar",
    descartarAlteracoesConfig: "Descartar as alterações?",
    alteracoesConfigPerdidas: "As alterações não salvas da Configuração serão perdidas.",
    aguardeExclusao: "Aguarde: a conta está sendo excluída.",
    linhaCartoes: (n: number) => `${n} ${n === 1 ? "Cartão" : "Cartões"}`,
    linhaBaralhos: (n: number) => `${n} ${n === 1 ? "Baralho" : "Baralhos"}`,
    linhaRegistrosDeSessao: (n: number) => `${n} ${n === 1 ? "Registro de sessão" : "Registros de sessão"}`,
    linhaItensDaAgenda: (n: number) => `${n} ${n === 1 ? "item da Agenda" : "itens da Agenda"}`,
  },
  rotina: {
    salvando: "Aguarde: a Rotina está sendo salva.",
    resumo: "Resumo",
    escolhaUmBaralho: "Escolha um Baralho",
    cartoesDoBaralho: (n: number) => (n === 0 ? "sem Cartões" : n === 1 ? "1 Cartão" : `${n} Cartões`),
    diasDaSemana: "Dias da semana",
    ajudaDosDias: "Escolha um ou mais dias. A rotina se repete toda semana.",
    quantidadeDeCartoes: "Quantidade de Cartões",
    todosOsCartoes: "Todos os Cartões",
    definirQuantidade: "Definir quantidade",
    quantosCartoes: "Quantos Cartões por estudo",
    ajudaDaQuantidade: "De 1 a 999. Se o Baralho tiver menos Cartões, o estudo usa todos os disponíveis.",
    ajudaDeTodos: "O estudo usa todos os Cartões do Baralho no momento em que começa.",
    usarValoresAtuais: "Usar os valores atuais",
    manterODigitado: "Manter o que digitei",
    falhaAoSalvar: "Falha ao salvar a Rotina",
    salvandoStatus: "Salvando…",
    confirmarAlteracoes: "Confirmar alterações",
    confirmar: "Confirmar",
    voltar: "Voltar",
    diasRemovidos: "Dias removidos:",
    efeitoDiasRemovidos: "cancelam o estudo pendente de hoje.",
    diasAdicionados: "Dias adicionados:",
    efeitoDiasAdicionados: "podem criar o estudo de hoje.",
    baralhoOuQuantidadeMudaram: "Baralho ou quantidade mudaram:",
    efeitoBaralhoOuQuantidade: "atualizam os compromissos pendentes de hoje e futuros.",
    preservados: "Estudos passados e concluídos são preservados. Sessões já iniciadas ainda poderão concluir o estudo capturado.",
    confirmarIndependentes: "Confirmar estudos independentes?",
    confirmarESalvar: "Confirmar e salvar",
    cadaRotinaContaSeparado: "Cada Rotina gera o seu próprio estudo, e os dois contam separadamente.",
  },
  importacao: {
    titulo: "Importar baralho",
    descricao: "Importe arquivos Anki no formato .apkg.",
    arquivo: "Arquivo .apkg",
    lendo: "Lendo arquivo Anki…",
    conteudoIgnorado: (notas: number, cartoes: number) => `Conteúdo ignorado: ${notas} notas não básicas ou incompletas e ${cartoes} cartões com HTML ou mídia. HTML é convertido em texto e mídias não são importadas.`,
    concluirEdicao: "Concluir edição",
    editarTitulo: "Editar título",
    nomeDoBaralho: "Nome do baralho",
    adicionado: "Adicionado",
    modificado: "Modificado",
    frente: "Frente",
    verso: "Verso",
    concluir: "Concluir",
    editar: "Editar",
    escolherOutro: "Escolher outro arquivo",
    importando: "Importando…",
    confirmar: "Confirmar importação",
  },
  exportacao: {
    titulo: "Exportar",
    todos: "Todos os Baralhos",
    formato: "Formato",
    opcaoFormato: "Pacote Anki (.apkg)",
    ajuda: "Abre no Anki, no AnkiDroid e no AnkiMobile. Ao importar no Anki, marque «Importar progresso de estudo».",
    resumoBaralhos: (n) => `${n} ${new Intl.PluralRules("pt-BR").select(n) === "one" ? "Baralho" : "Baralhos"}`,
    resumoCartoes: (n) => `${n} ${new Intl.PluralRules("pt-BR").select(n) === "one" ? "Cartão" : "Cartões"}`,
    resumoMidias: (imagens, audios) => `${imagens} com Imagem, ${audios} com Áudio`,
    tamanho: (bytes) => `Tamanho aproximado: ${bytes}`,
    carregando: "Carregando…",
    marcarUm: "Marque ao menos um Baralho",
    semCartoes: "Não há Cartões para exportar",
    exportar: "Exportar arquivo",
    gerando: "Gerando arquivo…",
    pronto: (nome) => `Arquivo pronto: ${nome}`,
    baixarDeNovo: "Baixar de novo",
    semMidia: (n) => `${n} cartões foram exportados sem a mídia.`,
    falha: "Não foi possível gerar o arquivo.",
    antesDeExcluir: "Exportar meu acervo antes",
  },
  contaDeTeste: {
    entrar: "Entrar como Teste",
    ou: "ou",
    apresentacao: "Experimente com Baralhos de exemplo. Tudo é apagado ao sair.",
    preparando: "Preparando sua Conta de teste…",
    terminou: "Sua Conta de teste terminou. Entre como Teste para começar de novo.",
    etiqueta: "Conta de teste",
    aviso: "Esta é uma Conta de teste. Tudo será apagado ao sair.",
    linkCreditos: "Créditos do acervo de demonstração",
    creditos: {
      titulo: "Créditos do acervo de demonstração",
      fechar: "Fechar",
      verFonte: "Ver fonte",
      verFonteDe: (cartao: string) => `Ver fonte de ${cartao}`,
      autorELicenca: (autor: string, licenca: string) => `${autor} · ${licenca}`,
      licencas: {
        "LicenseRef-Public-Domain": "Domínio público",
        "CC0-1.0": "CC0 1.0",
        "CC-BY-3.0": "CC BY 3.0",
        "CC-BY-4.0": "CC BY 4.0",
        "CC-BY-SA-3.0": "CC BY-SA 3.0",
        "CC-BY-SA-4.0": "CC BY-SA 4.0",
      },
    },
    perfil: "A Conta de teste não pode ser alterada nem excluída.",
    sairConfirmacao: "Sair apaga a Conta de teste e tudo o que você fez nela.",
    sairEApagar: "Sair e apagar",
    cancelar: "Cancelar",
  },
};
