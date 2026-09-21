import { useEffect, useId, useRef } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

/**
 * Diálogo de confirmação acessível (T504, T505;
 * specs/006-excluir-cartao-e-baralho/tasks.md).
 *
 * Usa o `<dialog>` nativo com `showModal()`: em navegador, o próprio elemento
 * move o foco para dentro, prende a navegação por Tab e trata Escape como
 * cancelamento. O jsdom pode não implementar `showModal`/`close`; o efeito
 * detecta a ausência e cai para o atributo `open`, mantendo a semântica
 * testável (`role="dialog"` implícito do elemento).
 *
 * O foco inicial vai para o botão de cancelamento — a ação sem consequência —
 * para que ninguém confirme por acidente ao percorrer o diálogo por teclado.
 * Escape cancela pelo `onKeyDown`; o clique no pano de fundo também cancela.
 * O diálogo é nomeado por `aria-labelledby` (título) e descrito por
 * `aria-describedby` (consequência).
 */

interface PropriedadesDoDialogoDeConfirmacao {
  aberto: boolean;
  titulo: string;
  children: ReactNode;
  rotuloDeConfirmacao: string;
  rotuloDeCancelamento?: string;
  confirmacaoDesabilitada?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}

export function DialogoDeConfirmacao({
  aberto,
  titulo,
  children,
  rotuloDeConfirmacao,
  rotuloDeCancelamento = "Cancelar",
  confirmacaoDesabilitada = false,
  aoConfirmar,
  aoCancelar,
}: PropriedadesDoDialogoDeConfirmacao) {
  const id = useId();
  const tituloId = `${id}-titulo`;
  const descricaoId = `${id}-descricao`;
  const dialogo = useRef<HTMLDialogElement>(null);
  const botaoDeCancelamento = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const elemento = dialogo.current;

    if (elemento === null) {
      return;
    }

    if (aberto && !elemento.open) {
      if (typeof elemento.showModal === "function") {
        elemento.showModal();
      } else {
        elemento.setAttribute("open", "");
      }

      botaoDeCancelamento.current?.focus();
    } else if (!aberto && elemento.open) {
      if (typeof elemento.close === "function") {
        elemento.close();
      } else {
        elemento.removeAttribute("open");
      }
    }
  }, [aberto]);

  function aoTeclar(evento: KeyboardEvent<HTMLDialogElement>): void {
    if (evento.key === "Escape") {
      evento.preventDefault();
      aoCancelar();
    }
  }

  function aoClicarNoFundo(evento: MouseEvent<HTMLDialogElement>): void {
    if (evento.target === evento.currentTarget) {
      aoCancelar();
    }
  }

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={tituloId}
      aria-describedby={descricaoId}
      onKeyDown={aoTeclar}
      onClick={aoClicarNoFundo}
    >
      <h2 id={tituloId} className="titulo-do-dialogo">
        {titulo}
      </h2>
      <div id={descricaoId} className="descricao-do-dialogo">
        {children}
      </div>
      <div className="acoes-do-dialogo">
        <button
          ref={botaoDeCancelamento}
          type="button"
          onClick={aoCancelar}
        >
          {rotuloDeCancelamento}
        </button>
        <button
          className="botao-de-confirmacao"
          type="button"
          disabled={confirmacaoDesabilitada}
          onClick={aoConfirmar}
        >
          {rotuloDeConfirmacao}
        </button>
      </div>
    </dialog>
  );
}
