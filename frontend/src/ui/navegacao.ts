import { useEffect, useState } from "react";

/**
 * Navegação por hash da aplicação, sem dependência de roteador.
 *
 * `useRota` devolve a rota corrente lida de `location.hash`, com a rota padrão
 * `#/cartoes` para hash vazio. A interpretação fica concentrada em
 * `interpretarRota` de propósito: novas rotas — como `#/baralhos/<id>` e
 * `#/baralhos/<id>/estudo` — são acrescentadas apenas nesta função, sem tocar
 * no hook nem nos consumidores.
 */

/** Rota padrão da aplicação: a lista de Cartões. */
export const ROTA_PADRAO = "#/cartoes";

/**
 * Rotas reconhecidas nesta feature. A forma é uma união discriminada por
 * `nome`, para que cada tela decida pela tag e não por comparação de strings
 * espalhada.
 */
export type Rota =
  | { nome: "cartoes" }
  | { nome: "baralhos" }
  | { nome: "baralho"; id: string }
  | { nome: "estudo"; id: string };

/**
 * Interpreta o hash corrente como uma `Rota`.
 *
 * A rota padrão é Cartões, inclusive para hashes desconhecidos: um caminho
 * que a aplicação ainda não reconhece nunca deixa a tela sem conteúdo.
 * Segmentos vazios são descartados, de modo que `#/baralhos/` e `#/baralhos`
 * são a mesma rota.
 */
export function interpretarRota(hash: string): Rota {
  const segmentos = hash
    .replace(/^#\/?/, "")
    .split("/")
    .filter((segmento) => segmento.length > 0);

  if (segmentos.length === 0) {
    return { nome: "cartoes" };
  }

  if (segmentos.length === 1 && segmentos[0] === "cartoes") {
    return { nome: "cartoes" };
  }

  if (segmentos.length === 1 && segmentos[0] === "baralhos") {
    return { nome: "baralhos" };
  }

  if (segmentos.length === 2 && segmentos[0] === "baralhos") {
    return { nome: "baralho", id: segmentos[1] };
  }

  if (
    segmentos.length === 3 &&
    segmentos[0] === "baralhos" &&
    segmentos[2] === "estudo"
  ) {
    return { nome: "estudo", id: segmentos[1] };
  }

  return { nome: "cartoes" };
}

/**
 * Hook de rota corrente: lê o hash na montagem e reage a `hashchange`.
 */
export function useRota(): Rota {
  const [rota, setRota] = useState<Rota>(() =>
    interpretarRota(window.location.hash),
  );

  useEffect(() => {
    const aoMudarHash = (): void => {
      setRota(interpretarRota(window.location.hash));
    };

    window.addEventListener("hashchange", aoMudarHash);

    return () => {
      window.removeEventListener("hashchange", aoMudarHash);
    };
  }, []);

  return rota;
}
