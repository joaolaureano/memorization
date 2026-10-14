/**
 * Recusas do servidor apresentadas no Idioma da interface (027, FR-018,
 * FR-019, research R4).
 *
 * O servidor identifica a recusa pelo código estável `erro` (com `motivo` e
 * `limite` quando cabe) e manda uma mensagem técnica em inglês, que nunca é
 * mostrada à pessoa. O texto para a pessoa sai daqui, pelo código e pelo
 * contexto da operação, que vem da rota chamada. Em Português, o texto é o
 * mesmo que o servidor mandava antes desta feature.
 */

import { descreverDias } from "../agenda/datas";

/** A recusa como o servidor a identifica. */
export interface RecusaDoServidor {
  erro: string;
  motivo?: string;
  limite?: number;
  /** Dias da semana (1 = segunda) em comum, na sobreposição de Rotinas. */
  dias?: readonly number[];
  /** O campo a corrigir, nas recusas da conta (`novaSenha`, `confirmacaoDaSenha`). */
  campo?: string;
}

/** A área da operação recusada, deduzida da rota (ver `contextoDaRota`). */
export type ContextoDaRecusa =
  | "cartoes"
  | "baralhos"
  | "selecao"
  | "importacao"
  | "transicao"
  | "sessoes"
  | "revisao"
  | "preferencias"
  | "agenda"
  | "conta"
  | "imagens";

/** Todos os contextos, para quem precisa percorrer as recusas conhecidas. */
export const CONTEXTOS_DE_RECUSA: readonly ContextoDaRecusa[] = [
  "cartoes", "baralhos", "selecao", "importacao", "transicao", "sessoes",
  "revisao", "preferencias", "agenda", "conta", "imagens",
];

/** Os códigos de `erro` do contrato HTTP (contracts/http.md). */
export const CODIGOS_DE_RECUSA: readonly string[] = [
  "indisponivel", "nao_encontrado", "dados_invalidos", "conflito",
  "escolhas_invalidas", "frente_duplicada", "sem_acesso",
  "nome_de_usuario_invalido", "nome_de_usuario_existente",
  "frente_muito_longa", "cartoes_indisponiveis", "imagem_invalida",
  "expirado", "corpo_invalido", "conflito_de_versao", "verso_vazio",
  "verso_muito_longo", "tipo_imutavel", "senha_invalida",
  "senha_atual_incorreta", "nome_vazio", "nome_muito_longo", "mesma_senha",
  "imagem_ausente", "frente_vazia", "envio_invalido", "descricao_muito_longa",
  "credencial_invalida", "acesso_expirado", "anki_grande_demais",
  "anki_ilegivel", "anki_corrompido", "anki_incompativel", "sobreposicao",
];

/** Os `motivo`s que mudam o texto de uma recusa. */
export const MOTIVOS_DE_RECUSA: readonly string[] = [
  "formato", "tamanho", "nao_encontrada",
  "baralho_ausente", "dias_invalidos", "quantidade_invalida", "data_invalida",
  "inicio_nao_segunda", "fuso_invalido", "operacao_vazia", "acao_invalida",
  "rotina_ausente", "versao_ausente", "operacao_reutilizada",
  "rotina_nao_encontrada", "versao_desatualizada", "rotina_ja_pausada",
  "rotina_nao_pausada", "baralho_nao_encontrado", "baralho_sem_cartoes",
  "rotina_do_estudo_ausente", "estudo_fora_de_hoje", "estudo_concluido",
  "estudo_cancelado", "sem_estudo_hoje", "baralho_da_rotina_excluido",
  "baralho_da_rotina_sem_cartoes",
];

/** Deduz o contexto a partir do caminho da rota chamada. */
export function contextoDaRota(caminho: string): ContextoDaRecusa {
  if (caminho.startsWith("/baralhos/de-selecao")) return "selecao";
  if (caminho.startsWith("/baralhos/importacoes")) return "importacao";
  if (caminho.startsWith("/baralhos")) return "baralhos";
  if (caminho.startsWith("/cartoes")) return "cartoes";
  if (caminho.startsWith("/acervo/transicao")) return "transicao";
  if (caminho.startsWith("/sessoes") || caminho.startsWith("/estatisticas")) {
    return "sessoes";
  }
  if (caminho.startsWith("/previas")) return "revisao";
  if (caminho.startsWith("/preferencias")) return "preferencias";
  if (caminho.startsWith("/agenda")) return "agenda";
  if (caminho.startsWith("/imagens")) return "imagens";
  return "conta";
}

export type TextoDaRecusa = (
  recusa: RecusaDoServidor,
  contexto: ContextoDaRecusa,
) => string;

export const textoDaRecusaPt: TextoDaRecusa = (recusa, contexto) => {
  if (contexto === "agenda") {
    return textoDaRecusaDaAgendaPt(recusa);
  }

  if (recusa.erro === "dados_invalidos" && recusa.campo === "confirmacaoDaSenha") {
    return "A confirmação da Senha não confere com a nova Senha.";
  }

  if (recusa.erro === "dados_invalidos" && recusa.campo === "novaSenha") {
    return "A senha deve ter entre 8 e 128 caracteres.";
  }

  const limite = recusa.limite;

  switch (recusa.erro) {
    case "frente_vazia":
      return "A frente do cartão não pode ficar vazia.";
    case "verso_vazio":
      return "O verso do cartão não pode ficar vazio.";
    case "frente_muito_longa":
      return `A frente do cartão deve ter no máximo ${limite ?? 1000} caracteres.`;
    case "verso_muito_longo":
      return `O verso do cartão deve ter no máximo ${limite ?? 1000} caracteres.`;
    case "descricao_muito_longa":
      return `A descrição da imagem deve ter no máximo ${limite ?? 250} caracteres.`;
    case "nome_vazio":
      return "O nome do baralho não pode ficar vazio.";
    case "nome_muito_longo":
      return `O nome do baralho deve ter no máximo ${limite ?? 100} caracteres.`;
    case "frente_duplicada":
      return contexto === "importacao"
        ? "Há cartões com frentes repetidas na prévia."
        : "Já existe um cartão com esta frente neste baralho.";
    case "tipo_imutavel":
      return "O tipo do cartão não pode ser alterado depois da criação.";
    case "imagem_ausente":
      return "Escolha uma imagem.";
    case "imagem_invalida":
      if (recusa.motivo === "tamanho") return "A imagem deve ter no máximo 5 MB.";
      if (recusa.motivo === "nao_encontrada") {
        return "A imagem enviada não foi encontrada. Escolha a imagem de novo.";
      }
      return "O arquivo não é uma imagem JPEG, PNG, WebP ou GIF.";
    case "envio_invalido":
      return "Escolha uma imagem JPEG, PNG, WebP ou GIF.";
    case "nome_de_usuario_invalido":
      return (
        "O nome de usuário aceita apenas letras de A a Z, sem acento, " +
        "dígitos, ponto, sublinhado e hífen."
      );
    case "nome_de_usuario_existente":
      return "Este nome de usuário já existe. Escolha outro.";
    case "senha_invalida":
      return "A senha deve ter entre 8 e 128 caracteres.";
    case "senha_atual_incorreta":
      return "A Senha atual está incorreta.";
    case "mesma_senha":
      return "A nova Senha é igual à atual.";
    case "credencial_invalida":
      return "Nome de usuário ou Senha incorretos.";
    case "acesso_expirado":
    case "expirado":
      return "Seu acesso expirou. Entre novamente.";
    case "sem_acesso":
      return "Não há acesso neste navegador. Entre para continuar.";
    case "nao_encontrado":
      if (contexto === "sessoes") return "Sessão não encontrada.";
      if (contexto === "cartoes") return "Cartão não encontrado.";
      return "Baralho não encontrado.";
    case "conflito":
    case "conflito_de_versao":
      if (contexto === "sessoes") {
        return "Esta Sessão já foi registrada por outro Usuário.";
      }
      if (contexto === "transicao") {
        return "O acervo mudou; recarregue as escolhas e tente de novo.";
      }
      return "Não foi possível salvar o baralho. Tente novamente.";
    case "escolhas_invalidas":
      return "As escolhas devem ser uma lista válida.";
    case "cartoes_indisponiveis":
      return "Alguns cartões não estão mais disponíveis.";
    case "anki_grande_demais":
      return "O arquivo deve ter no máximo 4 MiB.";
    case "anki_ilegivel":
      return "Não foi possível ler este arquivo Anki.";
    case "anki_corrompido":
      return "O arquivo Anki moderno está corrompido ou excede o limite de expansão.";
    case "anki_incompativel":
      return "O arquivo não contém uma coleção Anki compatível.";
    case "dados_invalidos":
    case "corpo_invalido":
      switch (contexto) {
        case "sessoes":
          return "Os dados da Sessão são inválidos.";
        case "revisao":
          return "Os dados da Revisão são inválidos.";
        case "preferencias":
          return "Os dados das Preferências são inválidos.";
        case "selecao":
          return "Os dados da seleção são inválidos.";
        case "importacao":
          return "Revise os nomes e cartões importados.";
        default:
          return "Os dados informados são inválidos.";
      }
    case "indisponivel":
    default:
      if (contexto === "imagens") {
        return "O envio de imagens não está disponível. Tente novamente.";
      }
      if (contexto === "importacao") return "Não foi possível concluir a importação.";
      return "O armazenamento está indisponível.";
  }
};

export const textoDaRecusaEn: TextoDaRecusa = (recusa, contexto) => {
  if (contexto === "agenda") {
    return textoDaRecusaDaAgendaEn(recusa);
  }

  if (recusa.erro === "dados_invalidos" && recusa.campo === "confirmacaoDaSenha") {
    return "The password confirmation does not match the new password.";
  }

  if (recusa.erro === "dados_invalidos" && recusa.campo === "novaSenha") {
    return "The password must have between 8 and 128 characters.";
  }

  const limite = recusa.limite;

  switch (recusa.erro) {
    case "frente_vazia":
      return "The card front cannot be empty.";
    case "verso_vazio":
      return "The card back cannot be empty.";
    case "frente_muito_longa":
      return `The card front can have at most ${limite ?? 1000} characters.`;
    case "verso_muito_longo":
      return `The card back can have at most ${limite ?? 1000} characters.`;
    case "descricao_muito_longa":
      return `The image description can have at most ${limite ?? 250} characters.`;
    case "nome_vazio":
      return "The deck name cannot be empty.";
    case "nome_muito_longo":
      return `The deck name can have at most ${limite ?? 100} characters.`;
    case "frente_duplicada":
      return contexto === "importacao"
        ? "Some cards in the preview have the same front."
        : "A card with this front already exists in this deck.";
    case "tipo_imutavel":
      return "The card type cannot be changed after creation.";
    case "imagem_ausente":
      return "Choose an image.";
    case "imagem_invalida":
      if (recusa.motivo === "tamanho") return "The image can be at most 5 MB.";
      if (recusa.motivo === "nao_encontrada") {
        return "The uploaded image was not found. Choose the image again.";
      }
      return "The file is not a JPEG, PNG, WebP or GIF image.";
    case "envio_invalido":
      return "Choose a JPEG, PNG, WebP or GIF image.";
    case "nome_de_usuario_invalido":
      return (
        "The username accepts only letters A to Z without accents, " +
        "digits, period, underscore and hyphen."
      );
    case "nome_de_usuario_existente":
      return "This username already exists. Choose another one.";
    case "senha_invalida":
      return "The password must have between 8 and 128 characters.";
    case "senha_atual_incorreta":
      return "The current password is incorrect.";
    case "mesma_senha":
      return "The new password is the same as the current one.";
    case "credencial_invalida":
      return "Incorrect username or password.";
    case "acesso_expirado":
    case "expirado":
      return "Your access has expired. Sign in again.";
    case "sem_acesso":
      return "There is no access in this browser. Sign in to continue.";
    case "nao_encontrado":
      if (contexto === "sessoes") return "Session not found.";
      if (contexto === "cartoes") return "Card not found.";
      return "Deck not found.";
    case "conflito":
    case "conflito_de_versao":
      if (contexto === "sessoes") {
        return "This session was already recorded by another user.";
      }
      if (contexto === "transicao") {
        return "Your collection changed; reload the choices and try again.";
      }
      return "The deck could not be saved. Try again.";
    case "escolhas_invalidas":
      return "The choices must be a valid list.";
    case "cartoes_indisponiveis":
      return "Some cards are no longer available.";
    case "anki_grande_demais":
      return "The file can be at most 4 MiB.";
    case "anki_ilegivel":
      return "This Anki file could not be read.";
    case "anki_corrompido":
      return "The modern Anki file is corrupted or exceeds the expansion limit.";
    case "anki_incompativel":
      return "The file does not contain a compatible Anki collection.";
    case "dados_invalidos":
    case "corpo_invalido":
      switch (contexto) {
        case "sessoes":
          return "The session data is invalid.";
        case "revisao":
          return "The review data is invalid.";
        case "preferencias":
          return "The preferences data is invalid.";
        case "selecao":
          return "The selection data is invalid.";
        case "importacao":
          return "Check the imported names and cards.";
        default:
          return "The information provided is invalid.";
      }
    case "indisponivel":
    default:
      if (contexto === "imagens") {
        return "Image upload is not available. Try again.";
      }
      if (contexto === "importacao") return "The import could not be completed.";
      return "Storage is unavailable.";
  }
};

export const textoDaRecusaEs: TextoDaRecusa = (recusa, contexto) => {
  if (contexto === "agenda") {
    return textoDaRecusaDaAgendaEs(recusa);
  }

  if (recusa.erro === "dados_invalidos" && recusa.campo === "confirmacaoDaSenha") {
    return "La confirmación de la contraseña no coincide con la nueva contraseña.";
  }

  if (recusa.erro === "dados_invalidos" && recusa.campo === "novaSenha") {
    return "La contraseña debe tener entre 8 y 128 caracteres.";
  }

  const limite = recusa.limite;

  switch (recusa.erro) {
    case "frente_vazia":
      return "El anverso de la tarjeta no puede quedar vacío.";
    case "verso_vazio":
      return "El reverso de la tarjeta no puede quedar vacío.";
    case "frente_muito_longa":
      return `El anverso de la tarjeta puede tener como máximo ${limite ?? 1000} caracteres.`;
    case "verso_muito_longo":
      return `El reverso de la tarjeta puede tener como máximo ${limite ?? 1000} caracteres.`;
    case "descricao_muito_longa":
      return `La descripción de la imagen puede tener como máximo ${limite ?? 250} caracteres.`;
    case "nome_vazio":
      return "El nombre del mazo no puede quedar vacío.";
    case "nome_muito_longo":
      return `El nombre del mazo puede tener como máximo ${limite ?? 100} caracteres.`;
    case "frente_duplicada":
      return contexto === "importacao"
        ? "Hay tarjetas con anversos repetidos en la vista previa."
        : "Ya existe una tarjeta con este anverso en este mazo.";
    case "tipo_imutavel":
      return "El tipo de la tarjeta no se puede cambiar después de crearla.";
    case "imagem_ausente":
      return "Elige una imagen.";
    case "imagem_invalida":
      if (recusa.motivo === "tamanho") return "La imagen puede tener como máximo 5 MB.";
      if (recusa.motivo === "nao_encontrada") {
        return "No se encontró la imagen enviada. Elige la imagen de nuevo.";
      }
      return "El archivo no es una imagen JPEG, PNG, WebP o GIF.";
    case "envio_invalido":
      return "Elige una imagen JPEG, PNG, WebP o GIF.";
    case "nome_de_usuario_invalido":
      return (
        "El nombre de usuario acepta solo letras de la A a la Z sin tilde, " +
        "dígitos, punto, guion bajo y guion."
      );
    case "nome_de_usuario_existente":
      return "Este nombre de usuario ya existe. Elige otro.";
    case "senha_invalida":
      return "La contraseña debe tener entre 8 y 128 caracteres.";
    case "senha_atual_incorreta":
      return "La contraseña actual es incorrecta.";
    case "mesma_senha":
      return "La nueva contraseña es igual a la actual.";
    case "credencial_invalida":
      return "Nombre de usuario o contraseña incorrectos.";
    case "acesso_expirado":
    case "expirado":
      return "Tu acceso expiró. Inicia sesión de nuevo.";
    case "sem_acesso":
      return "No hay acceso en este navegador. Inicia sesión para continuar.";
    case "nao_encontrado":
      if (contexto === "sessoes") return "Sesión no encontrada.";
      if (contexto === "cartoes") return "Tarjeta no encontrada.";
      return "Mazo no encontrado.";
    case "conflito":
    case "conflito_de_versao":
      if (contexto === "sessoes") {
        return "Otro usuario ya registró esta sesión.";
      }
      if (contexto === "transicao") {
        return "Tu colección cambió; recarga las opciones e inténtalo de nuevo.";
      }
      return "No se pudo guardar el mazo. Inténtalo de nuevo.";
    case "escolhas_invalidas":
      return "Las opciones deben ser una lista válida.";
    case "cartoes_indisponiveis":
      return "Algunas tarjetas ya no están disponibles.";
    case "anki_grande_demais":
      return "El archivo puede tener como máximo 4 MiB.";
    case "anki_ilegivel":
      return "No se pudo leer este archivo de Anki.";
    case "anki_corrompido":
      return "El archivo moderno de Anki está dañado o supera el límite de expansión.";
    case "anki_incompativel":
      return "El archivo no contiene una colección de Anki compatible.";
    case "dados_invalidos":
    case "corpo_invalido":
      switch (contexto) {
        case "sessoes":
          return "Los datos de la sesión no son válidos.";
        case "revisao":
          return "Los datos del repaso no son válidos.";
        case "preferencias":
          return "Los datos de las preferencias no son válidos.";
        case "selecao":
          return "Los datos de la selección no son válidos.";
        case "importacao":
          return "Revisa los nombres y las tarjetas importadas.";
        default:
          return "Los datos informados no son válidos.";
      }
    case "indisponivel":
    default:
      if (contexto === "imagens") {
        return "El envío de imágenes no está disponible. Inténtalo de nuevo.";
      }
      if (contexto === "importacao") return "No se pudo completar la importación.";
      return "El almacenamiento no está disponible.";
  }
};

/** As recusas da Agenda, pelo `motivo` (027, FR-019). */
function textoDaRecusaDaAgendaPt(recusa: RecusaDoServidor): string {
  if (recusa.erro === "indisponivel") {
    return "O armazenamento não está disponível. Tente novamente.";
  }

  switch (recusa.motivo) {
    case "baralho_ausente":
      return "Escolha um Baralho para a Rotina.";
    case "dias_invalidos":
      return "Escolha ao menos um dia da semana, sem repetir dias.";
    case "quantidade_invalida":
      return "A quantidade precisa ser um número inteiro de 1 a 999, ou Todos os Cartões.";
    case "data_invalida":
      return "A data informada não é uma data válida.";
    case "inicio_nao_segunda":
      return "A data de início precisa ser uma segunda-feira.";
    case "fuso_invalido":
      return "O fuso horário informado não é um fuso IANA válido.";
    case "operacao_vazia":
      return "O identificador da operação não pode ser vazio.";
    case "acao_invalida":
      return "A ação da Rotina não é válida.";
    case "rotina_ausente":
      return "Informe a Rotina da operação.";
    case "versao_ausente":
      return "Informe a versão da Rotina que você viu.";
    case "operacao_reutilizada":
      return "Este identificador de operação já foi usado por outra operação.";
    case "rotina_nao_encontrada":
      return "Rotina não encontrada.";
    case "versao_desatualizada":
      return "A Rotina foi alterada em outro lugar. Revise os valores atuais antes de salvar.";
    case "rotina_ja_pausada":
      return "A Rotina já está pausada.";
    case "rotina_nao_pausada":
      return "A Rotina não está pausada.";
    case "baralho_nao_encontrado":
      return "Baralho não encontrado.";
    case "baralho_sem_cartoes":
      return "O Baralho escolhido não tem Cartões. Adicione Cartões a ele antes de agendar.";
    case "rotina_do_estudo_ausente":
      return "Informe a Rotina do estudo.";
    case "estudo_fora_de_hoje":
      return "Só é possível iniciar o estudo programado para hoje.";
    case "estudo_concluido":
      return "Este estudo já foi concluído.";
    case "estudo_cancelado":
      return "Este estudo foi cancelado.";
    case "sem_estudo_hoje":
      return "Não há estudo programado para esta Rotina hoje.";
    case "baralho_da_rotina_excluido":
      return "O Baralho desta Rotina foi excluído. Ajuste a Rotina para voltar a estudar.";
    case "baralho_da_rotina_sem_cartoes":
      return "O Baralho desta Rotina não tem Cartões. Adicione Cartões ou ajuste a Rotina.";
    case "sobreposicao":
      return `Já existe uma Rotina ativa deste Baralho em ${descreverDias(recusa.dias ?? [], "pt-BR")}. Confirme para criar estudos independentes nesses dias.`;
    default:
      return "Os dados da Agenda são inválidos.";
  }
}

/** As recusas da Agenda, pelo `motivo` (027, FR-019). */
function textoDaRecusaDaAgendaEn(recusa: RecusaDoServidor): string {
  if (recusa.erro === "indisponivel") {
    return "Storage is not available. Try again.";
  }

  switch (recusa.motivo) {
    case "baralho_ausente":
      return "Choose a deck for the routine.";
    case "dias_invalidos":
      return "Choose at least one weekday, without repeating days.";
    case "quantidade_invalida":
      return "The quantity must be a whole number from 1 to 999, or All cards.";
    case "data_invalida":
      return "The date provided is not a valid date.";
    case "inicio_nao_segunda":
      return "The start date must be a Monday.";
    case "fuso_invalido":
      return "The time zone provided is not a valid IANA time zone.";
    case "operacao_vazia":
      return "The operation identifier cannot be empty.";
    case "acao_invalida":
      return "The routine action is not valid.";
    case "rotina_ausente":
      return "Provide the routine for the operation.";
    case "versao_ausente":
      return "Provide the version of the routine you saw.";
    case "operacao_reutilizada":
      return "This operation identifier was already used by another operation.";
    case "rotina_nao_encontrada":
      return "Routine not found.";
    case "versao_desatualizada":
      return "The routine was changed elsewhere. Review the current values before saving.";
    case "rotina_ja_pausada":
      return "The routine is already paused.";
    case "rotina_nao_pausada":
      return "The routine is not paused.";
    case "baralho_nao_encontrado":
      return "Deck not found.";
    case "baralho_sem_cartoes":
      return "The chosen deck has no cards. Add cards to it before scheduling.";
    case "rotina_do_estudo_ausente":
      return "Provide the routine for the study.";
    case "estudo_fora_de_hoje":
      return "Only the study scheduled for today can be started.";
    case "estudo_concluido":
      return "This study was already completed.";
    case "estudo_cancelado":
      return "This study was canceled.";
    case "sem_estudo_hoje":
      return "There is no study scheduled for this routine today.";
    case "baralho_da_rotina_excluido":
      return "This routine's deck was deleted. Adjust the routine to study again.";
    case "baralho_da_rotina_sem_cartoes":
      return "This routine's deck has no cards. Add cards or adjust the routine.";
    case "sobreposicao":
      return `An active routine for this deck already exists on ${descreverDias(recusa.dias ?? [], "en-US")}. Confirm to create independent studies on those days.`;
    default:
      return "The schedule data is invalid.";
  }
}

/** As recusas da Agenda, pelo `motivo` (027, FR-019). */
function textoDaRecusaDaAgendaEs(recusa: RecusaDoServidor): string {
  if (recusa.erro === "indisponivel") {
    return "El almacenamiento no está disponible. Inténtalo de nuevo.";
  }

  switch (recusa.motivo) {
    case "baralho_ausente":
      return "Elige un mazo para la rutina.";
    case "dias_invalidos":
      return "Elige al menos un día de la semana, sin repetir días.";
    case "quantidade_invalida":
      return "La cantidad debe ser un número entero de 1 a 999, o Todas las tarjetas.";
    case "data_invalida":
      return "La fecha informada no es una fecha válida.";
    case "inicio_nao_segunda":
      return "La fecha de inicio debe ser un lunes.";
    case "fuso_invalido":
      return "La zona horaria informada no es una zona IANA válida.";
    case "operacao_vazia":
      return "El identificador de la operación no puede estar vacío.";
    case "acao_invalida":
      return "La acción de la rutina no es válida.";
    case "rotina_ausente":
      return "Indica la rutina de la operación.";
    case "versao_ausente":
      return "Indica la versión de la rutina que viste.";
    case "operacao_reutilizada":
      return "Este identificador de operación ya fue usado por otra operación.";
    case "rotina_nao_encontrada":
      return "Rutina no encontrada.";
    case "versao_desatualizada":
      return "La rutina se modificó en otro lugar. Revisa los valores actuales antes de guardar.";
    case "rotina_ja_pausada":
      return "La rutina ya está pausada.";
    case "rotina_nao_pausada":
      return "La rutina no está pausada.";
    case "baralho_nao_encontrado":
      return "Mazo no encontrado.";
    case "baralho_sem_cartoes":
      return "El mazo elegido no tiene tarjetas. Agrégale tarjetas antes de programar.";
    case "rotina_do_estudo_ausente":
      return "Indica la rutina del estudio.";
    case "estudo_fora_de_hoje":
      return "Solo se puede iniciar el estudio programado para hoy.";
    case "estudo_concluido":
      return "Este estudio ya se completó.";
    case "estudo_cancelado":
      return "Este estudio fue cancelado.";
    case "sem_estudo_hoje":
      return "No hay estudio programado para esta rutina hoy.";
    case "baralho_da_rotina_excluido":
      return "El mazo de esta rutina fue eliminado. Ajusta la rutina para volver a estudiar.";
    case "baralho_da_rotina_sem_cartoes":
      return "El mazo de esta rutina no tiene tarjetas. Agrega tarjetas o ajusta la rutina.";
    case "sobreposicao":
      return `Ya existe una rutina activa de este mazo el ${descreverDias(recusa.dias ?? [], "es-419")}. Confirma para crear estudios independientes en esos días.`;
    default:
      return "Los datos de la agenda no son válidos.";
  }
}
