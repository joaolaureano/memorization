/**
 * O aviso de uma operação da Agenda que terminou em outra tela (FR-251,
 * FR-252): «Rotina salva» precisa chegar a Gerenciar agenda, para onde o
 * formulário navega depois de salvar, e ser lido uma única vez por um leitor de
 * tela. Vive só na memória do módulo — nada vai para o armazenamento do
 * navegador.
 */
let pendente: ((textos: { salvarRotina: string }) => string) | null = null;

/** Deixa o aviso para a próxima tela de Gerenciar agenda. */
export function deixarAvisoDaAgenda(
  mensagemFn: (textos: { salvarRotina: string }) => string,
): void {
  pendente = mensagemFn;
}

/** Entrega o aviso pendente e o esquece. */
export function receberAvisoDaAgenda(textos: { salvarRotina: string }): string | null {
  const aviso = pendente;

  pendente = null;

  return aviso ? aviso(textos) : null;
}
