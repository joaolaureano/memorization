import { useEffect, useRef, useState } from "react";

import { useIdioma } from "./ProvedorDeIdioma";
import { IDIOMAS, SIGLA, NOME_NATIVO, type Idioma } from "./tipos";

/**
 * Seletor de idioma: menu-button com globo e sigla, abre com Enter/Space/ArrowDown,
 * navega com ArrowUp/ArrowDown/Home/End, seleciona com Enter/Space, fecha com Escape.
 * Fecho fecha sempre com foco de volta ao botão.
 */
export function SeletorDeIdioma() {
  const { idioma, textos, escolher } = useIdioma();
  const [aberto, setAberto] = useState(false);
  const [indiceFocado, setIndiceFocado] = useState(0);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fechar o menu quando clicar fora
  useEffect(() => {
    if (!aberto) {
      return;
    }

    function manipuladorDeClique(evento: MouseEvent) {
      if (
        botaoRef.current &&
        !botaoRef.current.contains(evento.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(evento.target as Node)
      ) {
        setAberto(false);
        botaoRef.current.focus();
      }
    }

    // Usar mousedown para responder antes do foco se mover
    document.addEventListener("mousedown", manipuladorDeClique);
    return () => document.removeEventListener("mousedown", manipuladorDeClique);
  }, [aberto]);

  // Quando abre, posiciona no item atual
  useEffect(() => {
    if (aberto) {
      const indice = IDIOMAS.indexOf(idioma);
      setIndiceFocado(indice);
    }
  }, [aberto, idioma]);

  function abrirMenu() {
    setAberto(true);
  }

  function fecharMenu(selecionado?: Idioma) {
    if (selecionado) {
      escolher(selecionado);
    }
    setAberto(false);

    // Garantir que o foco volta ao botão após o estado ser atualizado
    setTimeout(() => {
      botaoRef.current?.focus();
    }, 0);
  }

  function manipuladorDeCliqueBotao() {
    if (aberto) {
      fecharMenu();
    } else {
      abrirMenu();
    }
  }

  function manipuladorDeTecladoBotao(evento: React.KeyboardEvent) {
    switch (evento.key) {
      case "Enter":
      case " ":
        evento.preventDefault();
        if (aberto) {
          fecharMenu();
        } else {
          abrirMenu();
        }
        break;
      case "ArrowDown":
        evento.preventDefault();
        if (!aberto) {
          abrirMenu();
        }
        break;
      case "Escape":
        evento.preventDefault();
        if (aberto) {
          fecharMenu();
        }
        break;
      default:
        break;
    }
  }

  function manipuladorDeTecladoItem(
    evento: React.KeyboardEvent,
    indice: number,
  ) {
    switch (evento.key) {
      case "ArrowDown":
        evento.preventDefault();
        setIndiceFocado((indice + 1) % IDIOMAS.length);
        break;
      case "ArrowUp":
        evento.preventDefault();
        setIndiceFocado((indice - 1 + IDIOMAS.length) % IDIOMAS.length);
        break;
      case "Home":
        evento.preventDefault();
        setIndiceFocado(0);
        break;
      case "End":
        evento.preventDefault();
        setIndiceFocado(IDIOMAS.length - 1);
        break;
      case "Enter":
      case " ":
        evento.preventDefault();
        fecharMenu(IDIOMAS[indice]);
        break;
      case "Escape":
        evento.preventDefault();
        fecharMenu();
        break;
      default:
        break;
    }
  }

  function manipuladorDeClickItem(novoIdioma: Idioma) {
    fecharMenu(novoIdioma);
  }

  // Efeito para focar o item quando indiceFocado muda
  useEffect(() => {
    if (aberto && menuRef.current) {
      const itens = menuRef.current.querySelectorAll('[role="menuitemradio"]');
      const item = itens[indiceFocado] as HTMLElement;
      if (item) {
        item.focus();
      }
    }
  }, [indiceFocado, aberto]);

  return (
    <div className="seletor-de-idioma">
      <button
        ref={botaoRef}
        type="button"
        className="seletor-de-idioma__botao"
        onClick={manipuladorDeCliqueBotao}
        onKeyDown={manipuladorDeTecladoBotao}
        aria-label={textos.seletor.rotulo(idioma)}
        aria-haspopup="menu"
        aria-expanded={aberto}
      >
        {/* Globo SVG inline */}
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span>{SIGLA[idioma]}</span>
      </button>

      {aberto && (
        <div
          ref={menuRef}
          role="menu"
          className="seletor-de-idioma__menu"
        >
          {IDIOMAS.map((id, indice) => (
            <button
              key={id}
              role="menuitemradio"
              type="button"
              className="seletor-de-idioma__item"
              onClick={() => manipuladorDeClickItem(id)}
              onKeyDown={(evento) => manipuladorDeTecladoItem(evento, indice)}
              aria-checked={id === idioma}
            >
              <span className="seletor-de-idioma__item-texto">
                {SIGLA[id]} {NOME_NATIVO[id]}
              </span>
              {id === idioma && (
                <span
                  className="seletor-de-idioma__checkmark"
                  aria-hidden="true"
                >
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
