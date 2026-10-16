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
 * que o abriu (`retornoDeFoco`). A lista é agrupada por baralho; cada cartão é
 * um item com o nome, a linha de autor e licença (licença legível) e o link
 * "Ver fonte". O cabeçalho, com o botão Fechar, fica fixo enquanto só a lista rola.
 */

function nomeDoCartao(credito: CreditoDoAcervo): string {
  return credito.cientifico
    ? `${credito.cartao} (${credito.cientifico})`
    : credito.cartao;
}

function agruparPorBaralho(
  creditos: CreditoDoAcervo[],
): Array<[string, CreditoDoAcervo[]]> {
  const grupos = new Map<string, CreditoDoAcervo[]>();

  for (const credito of creditos) {
    grupos.set(credito.baralho, [...(grupos.get(credito.baralho) ?? []), credito]);
  }

  return [...grupos];
}
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

  const textosDosCreditos = textos.contaDeTeste.creditos;
  const grupos = agruparPorBaralho(creditos);

  function rotuloDaLicenca(licenca: string): string {
    const rotulo = textosDosCreditos.licencas[licenca] as string | undefined;

    return rotulo ?? licenca;
  }

  return (
    <dialog
      ref={dialogo}
      className="ca-dialogo-creditos"
      aria-labelledby="titulo-dos-creditos"
      onKeyDown={aoTeclar}
    >
      <div className="ca-dialogo-creditos__cabecalho">
        <h2 id="titulo-dos-creditos" className="titulo-do-dialogo">
          {textosDosCreditos.titulo}
        </h2>
        <button
          ref={botaoFechar}
          type="button"
          className="botao botao--secundario"
          onClick={aoFechar}
        >
          {textosDosCreditos.fechar}
        </button>
      </div>
      <div className="ca-creditos-lista">
        {grupos.map(([baralho, itens]) => (
          <section key={baralho} className="ca-creditos-grupo">
            <h3 className="ca-creditos-grupo__titulo">{baralho}</h3>
            <ul className="ca-creditos-itens">
              {itens.map((credito) => (
                <li key={`${credito.baralho}/${credito.cartao}`} className="ca-credito">
                  <h4 className="ca-credito__titulo">{nomeDoCartao(credito)}</h4>
                  <p className="ca-credito__autor">
                    {textosDosCreditos.autorELicenca(
                      credito.autor,
                      rotuloDaLicenca(credito.licenca),
                    )}
                  </p>
                  <a
                    className="ca-credito__fonte"
                    href={credito.fonte}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={textosDosCreditos.verFonteDe(credito.cartao)}
                  >
                    {textosDosCreditos.verFonte}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </dialog>
  );
}
