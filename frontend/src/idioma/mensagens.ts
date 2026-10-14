/**
 * Mensagens locais do produto — avisos e recusas que o cliente e os Modules de
 * domínio produzem sem passar pelo servidor (027, FR-005, FR-015).
 *
 * O Português é a fonte: as constantes `MENSAGEM_DE_*` do código apontam para
 * estes textos, e as provas existentes continuam comparando o mesmo texto. As
 * outras línguas têm exatamente as mesmas chaves (o compilador recusa uma
 * falta). Quem mostra uma mensagem a passa por `traduzirMensagem`, que a
 * apresenta no Idioma da interface vigente.
 */

import type { Idioma } from "./tipos";

export const MENSAGENS_PT = {
  indisponibilidadeDeCartoes: "Não foi possível acessar os Cartões. Tente novamente.",
  indisponibilidadeDeBaralhos: "Não foi possível acessar os Baralhos. Tente novamente.",
  indisponibilidadeDeUsuarios: "Não foi possível acessar os Usuários. Tente novamente.",
  credencialInvalida: "Nome de usuário ou Senha incorretos.",
  naoAutenticado:
    "A Credencial não é mais válida. Informe o Nome de usuário e a Senha para Entrar novamente.",
  indisponibilidadeDeHistorico:
    "Não foi possível acessar o seu histórico agora. Tente novamente.",
  dadosInvalidosDaSessao: "Os dados da Sessão não são válidos.",
  conflitoDeSessao: "O identificador da Sessão já está em uso.",
  sessaoNaoEncontrada: "Sessão não encontrada.",
  indisponibilidadeDeRevisao: "Não foi possível acessar a revisão agora. Tente novamente.",
  indisponibilidadeDePreferencias:
    "Não foi possível acessar as Preferências. Tente novamente.",
  dadosInvalidosDePreferencias: "As Preferências informadas não são válidas.",
  agendaIndisponivel: "A Agenda não está disponível agora. Tente novamente.",
  indisponibilidadeDaConta: "Não foi possível acessar a sua conta agora. Tente novamente.",
  senhaAtualIncorreta: "A Senha atual está incorreta.",
  acessoExpirado: "Seu acesso expirou. Entre novamente.",
  indisponibilidadeDoAcesso:
    "Não foi possível verificar o seu acesso agora. Tente novamente.",
  escolhasInvalidas: "Escolhas inválidas.",
  conflitoNaTransicao: "Conflito na transição.",
  baralhoInelegivel:
    "Este Baralho não pode ser estudado porque não tem Cartões vinculados.",
  quantidadeInvalida: "Informe uma quantidade inteira de Cartões, ao menos igual a 1.",
  revisaoVazia: "Não há Cartões para revisar hoje.",
  avaliacaoInvalida: "A avaliação do item deve ser errei, dificil, bom ou facil.",
  revelacaoAusente: "Revele o Verso antes de registrar a avaliação.",
  sessaoConcluida: "A Sessão já foi concluída.",
  imagemGrande: "A imagem deve ter no máximo 5 MB.",
  formatoDeImagem: "Escolha uma imagem JPEG, PNG, WebP ou GIF.",
  audioGrande: "O áudio deve ter no máximo 10 MB.",
  formatoDeAudio: "O arquivo não é um áudio MP3, M4A, OGG, WebM ou WAV.",
  audioLongo: "O áudio deve ter no máximo 5 minutos.",
  resultadoDesconhecidoDaExclusao: "Não foi possível confirmar se a conta foi excluída.",
  contaNaoExcluida:
    "Não foi possível excluir a conta agora. Nada foi excluído. Tente novamente.",
  resultadoDesconhecidoDaSenha: "Não foi possível confirmar se a Senha foi trocada.",
  senhaNaoTrocada:
    "Não foi possível trocar a Senha agora. Nada foi alterado. Tente novamente.",
  contaExcluida: "Conta excluída. Todos os dados do Usuário foram removidos.",
  saida: "Você saiu com sucesso.",
  confirmacaoDivergente:
    "A Senha e a Confirmação da Senha estão diferentes. Digite a mesma Senha nos dois campos.",
  saidaBloqueadaDoCadastro: "Aguarde: o Cadastro está sendo enviado.",
  importacaoExigeServidor: "A importação Anki exige conexão com o servidor.",
  selecioneApkg: "Selecione um arquivo .apkg do Anki.",
  confiraConta:
    "Entre novamente para conferir o estado da sua conta: a última alteração não pôde ser confirmada.",
} as const;

export type ChaveDeMensagem = keyof typeof MENSAGENS_PT;

export const MENSAGENS: Record<Idioma, Record<ChaveDeMensagem, string>> = {
  pt: MENSAGENS_PT,
  en: {
    indisponibilidadeDeCartoes: "The cards could not be accessed. Try again.",
    indisponibilidadeDeBaralhos: "The decks could not be accessed. Try again.",
    indisponibilidadeDeUsuarios: "The users could not be accessed. Try again.",
    credencialInvalida: "Incorrect username or password.",
    naoAutenticado:
      "Your credential is no longer valid. Enter your username and password to sign in again.",
    indisponibilidadeDeHistorico: "Your history could not be accessed right now. Try again.",
    dadosInvalidosDaSessao: "The session data is not valid.",
    conflitoDeSessao: "The session identifier is already in use.",
    sessaoNaoEncontrada: "Session not found.",
    indisponibilidadeDeRevisao: "The review could not be accessed right now. Try again.",
    indisponibilidadeDePreferencias: "The preferences could not be accessed. Try again.",
    dadosInvalidosDePreferencias: "The preferences provided are not valid.",
    agendaIndisponivel: "The schedule is not available right now. Try again.",
    indisponibilidadeDaConta: "Your account could not be accessed right now. Try again.",
    senhaAtualIncorreta: "The current password is incorrect.",
    acessoExpirado: "Your access has expired. Sign in again.",
    indisponibilidadeDoAcesso: "Your access could not be verified right now. Try again.",
    escolhasInvalidas: "Invalid choices.",
    conflitoNaTransicao: "Conflict in the transition.",
    baralhoInelegivel: "This deck cannot be studied because it has no cards.",
    quantidadeInvalida: "Enter a whole number of cards, at least 1.",
    revisaoVazia: "There are no cards to review today.",
    avaliacaoInvalida: "The item rating must be again, hard, good or easy.",
    revelacaoAusente: "Reveal the back before rating.",
    sessaoConcluida: "The session is already complete.",
    imagemGrande: "The image can be at most 5 MB.",
    formatoDeImagem: "Choose a JPEG, PNG, WebP or GIF image.",
    audioGrande: "The audio must be at most 10 MB.",
    formatoDeAudio: "The file is not an MP3, M4A, OGG, WebM or WAV audio file.",
    audioLongo: "The audio must be at most 5 minutes long.",
    resultadoDesconhecidoDaExclusao: "We could not confirm whether the account was deleted.",
    contaNaoExcluida:
      "The account could not be deleted right now. Nothing was deleted. Try again.",
    resultadoDesconhecidoDaSenha: "We could not confirm whether the password was changed.",
    senhaNaoTrocada:
      "The password could not be changed right now. Nothing was changed. Try again.",
    contaExcluida: "Account deleted. All of the user's data was removed.",
    saida: "You signed out successfully.",
    confirmacaoDivergente:
      "The password and the password confirmation are different. Type the same password in both fields.",
    saidaBloqueadaDoCadastro: "Please wait: the sign-up is being sent.",
    importacaoExigeServidor: "Anki import requires a connection to the server.",
    selecioneApkg: "Select an Anki .apkg file.",
    confiraConta: "Sign in again to check your account: the last change could not be confirmed.",
  },
  es: {
    indisponibilidadeDeCartoes: "No se pudo acceder a las tarjetas. Inténtalo de nuevo.",
    indisponibilidadeDeBaralhos: "No se pudo acceder a los mazos. Inténtalo de nuevo.",
    indisponibilidadeDeUsuarios: "No se pudo acceder a los usuarios. Inténtalo de nuevo.",
    credencialInvalida: "Nombre de usuario o contraseña incorrectos.",
    naoAutenticado:
      "Tu credencial ya no es válida. Ingresa tu nombre de usuario y contraseña para iniciar sesión de nuevo.",
    indisponibilidadeDeHistorico: "No se pudo acceder a tu historial ahora. Inténtalo de nuevo.",
    dadosInvalidosDaSessao: "Los datos de la sesión no son válidos.",
    conflitoDeSessao: "El identificador de la sesión ya está en uso.",
    sessaoNaoEncontrada: "Sesión no encontrada.",
    indisponibilidadeDeRevisao: "No se pudo acceder al repaso ahora. Inténtalo de nuevo.",
    indisponibilidadeDePreferencias: "No se pudo acceder a las preferencias. Inténtalo de nuevo.",
    dadosInvalidosDePreferencias: "Las preferencias informadas no son válidas.",
    agendaIndisponivel: "La agenda no está disponible ahora. Inténtalo de nuevo.",
    indisponibilidadeDaConta: "No se pudo acceder a tu cuenta ahora. Inténtalo de nuevo.",
    senhaAtualIncorreta: "La contraseña actual es incorrecta.",
    acessoExpirado: "Tu acceso expiró. Inicia sesión de nuevo.",
    indisponibilidadeDoAcesso: "No se pudo verificar tu acceso ahora. Inténtalo de nuevo.",
    escolhasInvalidas: "Opciones no válidas.",
    conflitoNaTransicao: "Conflicto en la transición.",
    baralhoInelegivel: "Este mazo no se puede estudiar porque no tiene tarjetas.",
    quantidadeInvalida: "Indica una cantidad entera de tarjetas, de al menos 1.",
    revisaoVazia: "No hay tarjetas para repasar hoy.",
    avaliacaoInvalida: "La calificación del ítem debe ser otra vez, difícil, bien o fácil.",
    revelacaoAusente: "Revela el reverso antes de calificar.",
    sessaoConcluida: "La sesión ya se completó.",
    imagemGrande: "La imagen puede tener como máximo 5 MB.",
    formatoDeImagem: "Elige una imagen JPEG, PNG, WebP o GIF.",
    audioGrande: "El audio debe tener como máximo 10 MB.",
    formatoDeAudio: "El archivo no es un audio MP3, M4A, OGG, WebM o WAV.",
    audioLongo: "El audio debe durar como máximo 5 minutos.",
    resultadoDesconhecidoDaExclusao: "No pudimos confirmar si la cuenta se eliminó.",
    contaNaoExcluida:
      "No se pudo eliminar la cuenta ahora. No se eliminó nada. Inténtalo de nuevo.",
    resultadoDesconhecidoDaSenha: "No pudimos confirmar si la contraseña se cambió.",
    senhaNaoTrocada:
      "No se pudo cambiar la contraseña ahora. No se cambió nada. Inténtalo de nuevo.",
    contaExcluida: "Cuenta eliminada. Se eliminaron todos los datos del usuario.",
    saida: "Cerraste sesión correctamente.",
    confirmacaoDivergente:
      "La contraseña y la confirmación de la contraseña son diferentes. Escribe la misma contraseña en ambos campos.",
    saidaBloqueadaDoCadastro: "Espera: el registro se está enviando.",
    importacaoExigeServidor: "La importación de Anki requiere conexión con el servidor.",
    selecioneApkg: "Selecciona un archivo .apkg de Anki.",
    confiraConta:
      "Inicia sesión de nuevo para revisar tu cuenta: no se pudo confirmar el último cambio.",
  },
};

/**
 * Mensagens com valores (limites, tamanhos, quantidades). Cada uma recebe só
 * números, o que permite à memória de tradução reconhecê-la em qualquer
 * idioma e reapresentá-la com os mesmos números.
 */
export const MENSAGENS_COM_VALOR = {
  frenteLonga: {
    pt: (limite: number, atual: number) =>
      `A frente do cartão deve ter no máximo ${limite} caracteres; a informada tem ${atual}.`,
    en: (limite: number, atual: number) =>
      `The card front can have at most ${limite} characters; the one provided has ${atual}.`,
    es: (limite: number, atual: number) =>
      `El anverso de la tarjeta puede tener como máximo ${limite} caracteres; el informado tiene ${atual}.`,
  },
  versoLongo: {
    pt: (limite: number, atual: number) =>
      `O verso do cartão deve ter no máximo ${limite} caracteres; o informado tem ${atual}.`,
    en: (limite: number, atual: number) =>
      `The card back can have at most ${limite} characters; the one provided has ${atual}.`,
    es: (limite: number, atual: number) =>
      `El reverso de la tarjeta puede tener como máximo ${limite} caracteres; el informado tiene ${atual}.`,
  },
  nomeDeBaralhoLongo: {
    pt: (limite: number, atual: number) =>
      `O nome do baralho deve ter no máximo ${limite} caracteres; o informado tem ${atual}.`,
    en: (limite: number, atual: number) =>
      `The deck name can have at most ${limite} characters; the one provided has ${atual}.`,
    es: (limite: number, atual: number) =>
      `El nombre del mazo puede tener como máximo ${limite} caracteres; el informado tiene ${atual}.`,
  },
  nomeDeUsuarioCurto: {
    pt: (limite: number, atual: number) =>
      `O nome de usuário deve ter pelo menos ${limite} caracteres; o informado tem ${atual}.`,
    en: (limite: number, atual: number) =>
      `The username must have at least ${limite} characters; the one provided has ${atual}.`,
    es: (limite: number, atual: number) =>
      `El nombre de usuario debe tener al menos ${limite} caracteres; el informado tiene ${atual}.`,
  },
  nomeDeUsuarioLongo: {
    pt: (limite: number, atual: number) =>
      `O nome de usuário deve ter no máximo ${limite} caracteres; o informado tem ${atual}.`,
    en: (limite: number, atual: number) =>
      `The username can have at most ${limite} characters; the one provided has ${atual}.`,
    es: (limite: number, atual: number) =>
      `El nombre de usuario puede tener como máximo ${limite} caracteres; el informado tiene ${atual}.`,
  },
  descricaoLonga: {
    pt: (limite: number, atual: number) =>
      `A descrição da imagem deve ter no máximo ${limite} caracteres; a informada tem ${atual}.`,
    en: (limite: number, atual: number) =>
      `The image description can have at most ${limite} characters; the one provided has ${atual}.`,
    es: (limite: number, atual: number) =>
      `La descripción de la imagen puede tener como máximo ${limite} caracteres; la informada tiene ${atual}.`,
  },
  quantidadeAcimaDoBaralho: {
    pt: (solicitada: number, disponiveis: number) =>
      `Você pediu ${solicitada} Cartões, mas este Baralho tem ${disponiveis}. ` +
      `A Sessão terá ${disponiveis} ${disponiveis === 1 ? "Item" : "Itens"}.`,
    en: (solicitada: number, disponiveis: number) =>
      `You asked for ${solicitada} cards, but this deck has ${disponiveis}. ` +
      `The session will have ${disponiveis} ${disponiveis === 1 ? "item" : "items"}.`,
    es: (solicitada: number, disponiveis: number) =>
      `Pediste ${solicitada} tarjetas, pero este mazo tiene ${disponiveis}. ` +
      `La sesión tendrá ${disponiveis} ${disponiveis === 1 ? "ítem" : "ítems"}.`,
  },
} satisfies Record<string, Record<Idioma, (a: number, b: number) => string>>;

export type ChaveDeMensagemComValor = keyof typeof MENSAGENS_COM_VALOR;
