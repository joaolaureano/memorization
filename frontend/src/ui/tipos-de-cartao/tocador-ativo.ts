/**
 * O Áudio que está tocando agora (028, FR-443). Só um Áudio toca por vez: ao
 * começar outro, o anterior pausa. Módulo único, então todos os tocadores da
 * tela compartilham a mesma posição.
 */

let ativo: HTMLMediaElement | null = null;

/** Marca `el` como o Áudio ativo, pausando o anterior se ele ainda toca. */
export function tornarAtivo(el: HTMLMediaElement): void {
  if (ativo !== null && ativo !== el && !ativo.paused) {
    ativo.pause();
  }
  ativo = el;
}

/** Solta `el` se ele ainda for o Áudio ativo (ao desmontar um tocador). */
export function liberar(el: HTMLMediaElement): void {
  if (ativo === el) {
    ativo = null;
  }
}
