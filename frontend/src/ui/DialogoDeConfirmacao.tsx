import { useId, useLayoutEffect, useRef } from "react";
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
 *
 * O efeito é um *layout effect* (`useLayoutEffect`) porque gerencia foco em
 * reação a uma mudança de estado: ele roda de forma síncrona logo após a
 * mutação do DOM e antes da pintura, enquanto um efeito passivo roda depois da
 * pintura. Com um efeito passivo, entre o commit e a execução do efeito o foco
 * ficava momentaneamente em `<body>` (o botão antes focado havia sido
 * desabilitado/removido) e qualquer observador do DOM logo após o commit — um
 * leitor de tela ou um teste — via o foco perdido. O layout effect preserva a
 * ordem de foco da WCAG, sem foco transitório no `<body>`.
 *
 * Há ainda um motivo de ordenação: a página que fecha o diálogo reposiciona o
 * foco em seu próprio layout effect. Layout effects de filhos rodam antes dos
 * do pai, então o diálogo já está fechado (e seu estado `inert` suspenso)
 * quando a página move o foco. Com um efeito passivo, a página focava primeiro
 * e o `close()` posterior enviava o foco para o `<body>`.
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

  useLayoutEffect(() => {
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
