// Créditos do Acervo de demonstração (030, FR-494).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";

import type {
  ClienteDoAcervo,
  CreditoDoAcervo,
} from "../acervo-cliente/cliente";
import { useIdioma } from "../idioma";

/**
 * O diálogo de créditos da Conta de teste (030, FR-494): título, autor, licença
 * e link da fonte de cada mídia do acervo de demonstração, lidos de
 * `obterCreditos` quando o diálogo abre.
 *
 * Usa o `<dialog>` nativo com `showModal()`, como o `DialogoDeConfirmacao`; onde
 * `showModal` não existe (jsdom), cai para o atributo `open`. Esc fecha pelo
 * `onKeyDown`, e o fechamento — por Esc ou pelo botão — devolve o foco ao link
 * que o abriu (`retornoDeFoco`). A tabela vira blocos empilhados em telas de até
 * 600 px, com o nome de cada coluna em `data-rotulo`, para não haver rolagem
 * horizontal em 360 px.
 */
export function CreditosDaDemonstracao({
  aberto,
  cliente,
  aoFechar,
  retornoDeFoco,
}: {
  aberto: boolean;
  cliente: ClienteDoAcervo;
  aoFechar: () => void;
  retornoDeFoco: RefObject<HTMLElement | null>;
}) {
  const { textos } = useIdioma();
  const dialogo = useRef<HTMLDialogElement>(null);
  const botaoFechar = useRef<HTMLButtonElement>(null);
  const [creditos, setCreditos] = useState<CreditoDoAcervo[]>([]);

  useEffect(() => {
    if (!aberto) {
      return;
    }

    let ativo = true;

    void cliente.obterCreditos().then((lista) => {
      if (ativo) {
        setCreditos(lista);
      }
    });

    return () => {
      ativo = false;
    };
  }, [aberto, cliente]);

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

      botaoFechar.current?.focus();
    } else if (!aberto && elemento.open) {
      if (typeof elemento.close === "function") {
        elemento.close();
      } else {
        elemento.removeAttribute("open");
      }

      // Depois do close(), o foco volta ao link que abriu o diálogo.
      retornoDeFoco.current?.focus();
    }
  }, [aberto, retornoDeFoco]);

  function aoTeclar(evento: KeyboardEvent<HTMLDialogElement>): void {
    if (evento.key === "Escape") {
      evento.preventDefault();
      aoFechar();
    }
  }

  const colunas = textos.contaDeTeste.creditos;

  return (
    <dialog
      ref={dialogo}
      className="ca-dialogo-creditos"
      aria-labelledby="titulo-dos-creditos"
      onKeyDown={aoTeclar}
    >
      <h2 id="titulo-dos-creditos" className="titulo-do-dialogo">
        {colunas.titulo}
      </h2>
      <table className="ca-tabela-creditos">
        <thead>
          <tr>
            <th scope="col">{colunas.colunaTitulo}</th>
            <th scope="col">{colunas.colunaAutor}</th>
            <th scope="col">{colunas.colunaLicenca}</th>
            <th scope="col">{colunas.colunaFonte}</th>
          </tr>
        </thead>
        <tbody>
          {creditos.map((credito) => (
            <tr key={`${credito.baralho}/${credito.cartao}`}>
              <td data-rotulo={colunas.colunaTitulo}>{credito.titulo}</td>
              <td data-rotulo={colunas.colunaAutor}>{credito.autor}</td>
              <td data-rotulo={colunas.colunaLicenca}>{credito.licenca}</td>
              <td data-rotulo={colunas.colunaFonte}>
                <a href={credito.fonte}>{credito.fonte}</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="acoes-do-dialogo ca-acoes">
        <button
          ref={botaoFechar}
          type="button"
          className="botao botao--secundario"
          onClick={aoFechar}
        >
          {textos.comum.voltar}
        </button>
      </div>
    </dialog>
  );
}
