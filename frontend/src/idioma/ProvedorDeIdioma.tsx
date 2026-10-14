import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { pt } from "./pt";
import { en } from "./en";
import { es } from "./es";
import type { Catalogo } from "./pt";
import type { Idioma } from "./tipos";
import { LOCALE } from "./tipos";
import { traduzirMensagem } from "./memoria-de-traducao";
import { resolverIdiomaInicial } from "./resolver";

export interface ContextoDeIdiomaValor {
  idioma: Idioma;
  textos: Catalogo;
  escolher(idioma: Idioma): void;
  formatarData(
    data: Date,
    opcoes: Intl.DateTimeFormatOptions,
  ): string;
  formatarNumero(n: number, opcoes?: Intl.NumberFormatOptions): string;
  plural(
    n: number,
    formas: { one: string; other: string },
  ): string;
  /** Apresenta no idioma vigente uma mensagem conhecida do produto (FR-015). */
  traduzir(texto: string): string;
}

export const ContextoDeIdioma = createContext<ContextoDeIdiomaValor | null>(
  null,
);

interface PropriedadesDoProvedor {
  children: ReactNode;
  idiomaInicial?: Idioma;
  catalogos?: Partial<Record<Idioma, Catalogo>>;
}

const catalogosPadrao: Record<Idioma, Catalogo> = {
  pt,
  en,
  es,
};

/**
 * Provedor de idioma que gerencia o estado do idioma da interface.
 * O prop `catalogos` é usado apenas em testes para sobrescrever catálogos.
 */
/**
 * Os textos do idioma vigente para quem está fora da árvore React, como o
 * cliente HTTP: uma resposta que chega depois de uma troca já usa o novo
 * idioma (FR-016). Sem provedor montado, vale o Português.
 */
let textosVigentes: Catalogo = pt;

export function textosDoIdiomaVigente(): Catalogo {
  return textosVigentes;
}

export function ProvedorDeIdioma({
  children,
  idiomaInicial,
  catalogos: catalogosDoTeste = {},
}: PropriedadesDoProvedor) {
  const [idioma, setIdioma] = useState<Idioma>(() => {
    if (idiomaInicial !== undefined) return idiomaInicial;

    let guardado: string | null = null;
    try {
      guardado = window.localStorage.getItem("memorization.idioma");
    } catch {
      // Armazenamento indisponível: usa a preferência do navegador.
    }

    const preferidos = navigator.languages?.length
      ? navigator.languages
      : [navigator.language];
    return resolverIdiomaInicial(guardado, preferidos);
  });
  const foiMudadoPeloUsuario = useRef(false);
  const regiaoDeLeitura = useRef<HTMLSpanElement>(null);

  // Combina catálogos de teste com os padrões
  const catalogosCombinados = {
    ...catalogosPadrao,
    ...catalogosDoTeste,
  } as Record<Idioma, Catalogo>;

  const textosDoIdioma = catalogosCombinados[idioma];
  const textosDePt = catalogosCombinados.pt;

  // Textos resolvidos com fallback para pt quando a string é vazia
  const textosResolvidos = useMemo(
    () => resolverFallback(textosDoIdioma, textosDePt) as Catalogo,
    [textosDoIdioma, textosDePt],
  );

  const escolher = useCallback((novoIdioma: Idioma) => {
    setIdioma(novoIdioma);
    foiMudadoPeloUsuario.current = true;
    try {
      window.localStorage.setItem("memorization.idioma", novoIdioma);
    } catch {
      // A escolha continua valendo nesta aba mesmo sem armazenamento.
    }
  }, []);

  // Atualizar document.documentElement.lang
  useEffect(() => {
    document.documentElement.lang = LOCALE[idioma];
  }, [idioma]);

  // Publica os textos vigentes para código fora do React (FR-016).
  useEffect(() => {
    textosVigentes = textosResolvidos;
  }, [textosResolvidos]);

  // Anunciar mudança de idioma via aria-live
  useEffect(() => {
    if (foiMudadoPeloUsuario.current && regiaoDeLeitura.current) {
      const anuncio = textosResolvidos.seletor.anuncio(idioma);
      regiaoDeLeitura.current.textContent = anuncio;
    }
  }, [idioma, textosResolvidos]);

  const formatarData = useCallback(
    (data: Date, opcoes: Intl.DateTimeFormatOptions): string => {
      return new Intl.DateTimeFormat(LOCALE[idioma], opcoes).format(data);
    },
    [idioma],
  );

  const formatarNumero = useCallback(
    (n: number, opcoes?: Intl.NumberFormatOptions): string => {
      return new Intl.NumberFormat(LOCALE[idioma], opcoes).format(n);
    },
    [idioma],
  );

  const plural = useCallback(
    (n: number, formas: { one: string; other: string }): string => {
      const regra = new Intl.PluralRules(LOCALE[idioma]);
      const categoria = regra.select(n);
      return categoria === "one" ? formas.one : formas.other;
    },
    [idioma],
  );

  const traduzir = useCallback(
    (texto: string): string => traduzirMensagem(texto, idioma),
    [idioma],
  );

  const valor: ContextoDeIdiomaValor = useMemo(
    () => ({
      idioma,
      textos: textosResolvidos,
      escolher,
      formatarData,
      formatarNumero,
      plural,
      traduzir,
    }),
    [idioma, textosResolvidos, escolher, formatarData, formatarNumero, plural, traduzir],
  );

  return (
    <ContextoDeIdioma.Provider value={valor}>
      <span
        ref={regiaoDeLeitura}
        aria-live="polite"
        className="visualmente-oculto"
      />
      {children}
    </ContextoDeIdioma.Provider>
  );
}

/**
 * Hook que acessa o contexto de idioma.
 * Quando não há ProvedorDeIdioma na árvore, retorna um valor padrão em português
 * (útil para componentes testados isoladamente).
 */
export function useIdioma(): ContextoDeIdiomaValor {
  const contexto = useContext(ContextoDeIdioma);
  if (contexto === null) {
    // Retorna padrão em português para testes de componentes isolados
    // Usa type assertion porque pt é completo e confiável
    return {
      idioma: "pt",
      textos: pt as Catalogo,
      escolher: () => {},
      formatarData: (data: Date, opcoes: Intl.DateTimeFormatOptions): string => {
        return new Intl.DateTimeFormat("pt-BR", opcoes).format(data);
      },
      formatarNumero: (n: number, opcoes?: Intl.NumberFormatOptions): string => {
        return new Intl.NumberFormat("pt-BR", opcoes).format(n);
      },
      plural: (n: number, formas: { one: string; other: string }): string => {
        const regra = new Intl.PluralRules("pt-BR");
        const categoria = regra.select(n);
        return categoria === "one" ? formas.one : formas.other;
      },
      traduzir: (texto: string): string => traduzirMensagem(texto, "pt"),
    };
  }
  return contexto;
}

/**
 * Mostra um aviso ou recusa no Idioma da interface vigente: troca de idioma
 * com o aviso visível o reapresenta no novo idioma (FR-015). Texto que não é
 * mensagem do produto aparece como veio.
 */
export function TextoDoProduto({ texto }: { texto: string | null | undefined }) {
  const { traduzir } = useIdioma();

  return texto === null || texto === undefined ? null : <>{traduzir(texto)}</>;
}

/**
 * Resolve um catálogo para o idioma, voltando a pt quando encontra string vazia.
 * Funciona recursivamente para qualquer profundidade.
 */
function resolverFallback(catalogo: unknown, fallback: unknown): unknown {
  if (typeof catalogo === "string") {
    return catalogo === "" ? fallback : catalogo;
  }

  if (typeof catalogo === "function") {
    return catalogo;
  }

  if (catalogo === null || typeof catalogo !== "object") {
    return catalogo;
  }

  const resultado: Record<string, unknown> = {};

  for (const [chave, valor] of Object.entries(catalogo as Record<string, unknown>)) {
    const fallbackValor = (fallback as Record<string, unknown>)[chave];
    resultado[chave] = resolverFallback(valor, fallbackValor);
  }

  return resultado;
}
