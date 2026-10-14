import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { LOCALE, duracaoFalada, formatarDuracao, useIdioma } from "../../idioma";
import { liberar, tornarAtivo } from "./tocador-ativo";

/**
 * O tocador de um Cartão do tipo Áudio (028, FR-441 a FR-444, FR-456, FR-458).
 * O mesmo componente serve a lista, a Sessão, a edição e a pré-escuta.
 *
 * - Nunca toca sozinho: sem `autoplay`, sem `controls` nativos, porque os
 *   rótulos nativos seguem o idioma do navegador, não o da interface.
 * - Botão Tocar/Pausar com nome no idioma da interface, sem `aria-pressed`.
 * - Controle de posição com valor falado; setas andam 5 s; Home e End vão ao
 *   início e ao fim.
 * - Um Áudio por vez, pelo coordenador `tocador-ativo`.
 * - Se o endereço falha, pede um novo uma vez; se continua falhando, o tocador
 *   sai e fica o aviso de Áudio indisponível (FR-444).
 */

const PASSO_DAS_SETAS_S = 5;

interface PropriedadesDoAudioDoCartao {
  /** Endereço do Áudio; `null` quando o servidor não o emitiu. */
  url: string | null;
  /** Duração conhecida pelo servidor; sem ela, vale o `loadedmetadata`. */
  duracaoMs?: number;
  variante: "compacto" | "face";
  /** Pede um endereço novo depois de uma falha de carga. */
  renovar?: () => Promise<string | null>;
}

type EstadoDeReproducao = "vazio" | "tocando" | "pausado" | "fim";

export function AudioDoCartao({ url, duracaoMs, variante, renovar }: PropriedadesDoAudioDoCartao) {
  const { textos, idioma } = useIdioma();
  const locale = LOCALE[idioma];
  const el = useRef<HTMLAudioElement>(null);

  const [urlVista, setUrlVista] = useState(url);
  const [fonte, setFonte] = useState(url);
  const [indisponivel, setIndisponivel] = useState(url === null);
  const [tentouRenovar, setTentouRenovar] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [estado, setEstado] = useState<EstadoDeReproducao>("vazio");
  const [atualMs, setAtualMs] = useState(0);
  const [duracaoCarregadaMs, setDuracaoCarregadaMs] = useState(0);

  // Um endereço novo vindo de quem chama reinicia o tocador (ajuste durante a
  // renderização, sem efeito).
  if (url !== urlVista) {
    setUrlVista(url);
    setFonte(url);
    setIndisponivel(url === null);
    setTentouRenovar(false);
  }

  const totalMs = duracaoMs ?? duracaoCarregadaMs;
  const totalSegundos = Math.floor(totalMs / 1000);

  // Ao desmontar, o Áudio para e sai do coordenador. O elemento é guardado na
  // montagem: a árvore pode já ter tirado o `<audio>` quando a limpeza roda.
  useEffect(() => {
    const elemento = el.current;
    return () => {
      if (elemento) {
        elemento.pause();
        liberar(elemento);
      }
    };
  }, []);

  function posicionar(segundos: number) {
    const elemento = el.current;
    if (!elemento) return;
    elemento.currentTime = segundos;
    setAtualMs(segundos * 1000);
  }

  function alternar() {
    const elemento = el.current;
    if (!elemento) return;

    if (tocando) {
      elemento.pause();
      return;
    }

    tornarAtivo(elemento);
    // Um play recusado pelo navegador (política de reprodução) não muda nada.
    elemento.play().catch(() => undefined);
  }

  function aoTeclarNaPosicao(evento: KeyboardEvent<HTMLInputElement>) {
    const elemento = el.current;
    if (!elemento) return;

    const fim = totalMs > 0 ? totalMs / 1000 : Number.POSITIVE_INFINITY;
    let alvo: number | null = null;

    switch (evento.key) {
      case "ArrowRight":
      case "ArrowUp":
        alvo = Math.min(elemento.currentTime + PASSO_DAS_SETAS_S, fim);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        alvo = Math.max(elemento.currentTime - PASSO_DAS_SETAS_S, 0);
        break;
      case "Home":
        alvo = 0;
        break;
      case "End":
        alvo = Number.isFinite(fim) ? fim : null;
        break;
    }

    if (alvo !== null) {
      // Impede o passo nativo de 1 s do controle deslizante.
      evento.preventDefault();
      posicionar(alvo);
    }
  }

  async function falhou() {
    if (renovar && !tentouRenovar) {
      setTentouRenovar(true);
      const nova = await renovar().catch(() => null);
      if (nova !== null) {
        setFonte(nova);
        return;
      }
    }
    setIndisponivel(true);
  }

  if (indisponivel) {
    return <p className="audio-indisponivel">{textos.cartao.audioIndisponivel}</p>;
  }

  const textoDoEstado = {
    vazio: "",
    tocando: textos.tocador.tocando,
    pausado: textos.tocador.pausado,
    fim: textos.tocador.fim,
  }[estado];

  return (
    <div className={`tocador tocador--${variante}`}>
      <audio
        ref={el}
        src={fonte ?? undefined}
        preload="metadata"
        hidden
        onPlay={() => {
          setTocando(true);
          setEstado("tocando");
        }}
        onPause={() => {
          setTocando(false);
          setEstado("pausado");
        }}
        onEnded={() => {
          setTocando(false);
          setEstado("fim");
        }}
        onLoadedMetadata={(evento) => {
          const segundos = evento.currentTarget.duration;
          if (Number.isFinite(segundos)) {
            setDuracaoCarregadaMs(segundos * 1000);
          }
        }}
        onTimeUpdate={(evento) => setAtualMs(evento.currentTarget.currentTime * 1000)}
        onError={() => void falhou()}
      />
      <button type="button" className="tocador__botao" onClick={alternar}>
        <svg className="tocador__icone" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          {tocando ? (
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
          ) : (
            <path d="M8 5v14l11-7z" fill="currentColor" />
          )}
        </svg>
        <span className="visualmente-oculto">
          {tocando ? textos.tocador.pausar : textos.tocador.tocar}
        </span>
      </button>
      <input
        type="range"
        className="tocador__posicao"
        aria-label={textos.tocador.posicao}
        min={0}
        max={totalSegundos}
        step={1}
        value={Math.min(Math.floor(atualMs / 1000), totalSegundos)}
        aria-valuetext={textos.tocador.posicaoFalada(
          duracaoFalada(atualMs, locale),
          duracaoFalada(totalMs, locale),
        )}
        onChange={(evento) => posicionar(Number(evento.currentTarget.value))}
        onKeyDown={aoTeclarNaPosicao}
      />
      <span className="tocador__tempo">
        {`${formatarDuracao(atualMs, locale)} / ${formatarDuracao(totalMs, locale)}`}
      </span>
      <span role="status" aria-live="polite" className="visualmente-oculto">
        {textoDoEstado}
      </span>
    </div>
  );
}
