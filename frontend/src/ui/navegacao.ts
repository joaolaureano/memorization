import { useEffect, useState } from "react";

/**
 * Navegação por hash da aplicação, sem dependência de roteador.
 *
 * `useRota` devolve a rota corrente lida de `location.hash`, interpretada pela
 * guarda de Credencial: enquanto ninguém tiver entrado, toda rota resolve em
 * "Entrar", exceto a tela "Criar conta" (FR-097, SC-027). O hash não é tocado
 * por essa decisão — é só o que aparece na tela que muda —, de modo que o
 * destino pedido continue valendo depois de Entrar.
 *
 * A interpretação fica concentrada em `interpretarRota` de propósito: novas
 * rotas são acrescentadas apenas nesta função, sem tocar no hook nem nos
 * consumidores.
 */

/** Rota padrão da aplicação: a lista de Cartões. */
export const ROTA_PADRAO = "#/cartoes";

/** A rota da tela "Entrar", a primeira e única sem Credencial (FR-097). */
export const ROTA_DE_ENTRADA = "#/entrar";

/**
 * Rotas reconhecidas nesta feature. A forma é uma união discriminada por
 * `nome`, para que cada tela decida pela tag e não por comparação de strings
 * espalhada.
 */
export type Rota =
  | { nome: "entrar" }
  | { nome: "cartoes" }
  | { nome: "baralhos" }
  | { nome: "baralho"; id: string }
  | { nome: "estudo"; id: string }
  | { nome: "cadastro" };

/**
 * Interpreta o hash corrente como uma `Rota`, já sob a guarda de Credencial
 * (FR-097, FR-098, SC-027).
 *
 * `temCredencial` diz se a Credencial está mantida. Com ela, as rotas
 * alcançáveis são as do acervo e do Cadastro, e `#/entrar` resolve em Cartões —
 * a tela "Entrar" não tem o que oferecer a quem já entrou. Sem ela, a única
 * tela alcançável é "Entrar", e `#/criar-conta` continua alcançável porque o
 * Cadastro é o caminho de quem ainda não tem Credencial nenhuma.
 *
 * A rota padrão é Cartões, inclusive para hashes desconhecidos: um caminho que
 * a aplicação ainda não reconhece nunca deixa a tela sem conteúdo. Segmentos
 * vazios são descartados, de modo que `#/baralhos/` e `#/baralhos` são a mesma
 * rota.
 */
export function interpretarRota(hash: string, temCredencial: boolean): Rota {
  const rota = interpretarCaminho(hash);

  if (temCredencial) {
    return rota.nome === "entrar" ? { nome: "cartoes" } : rota;
  }

  return rota.nome === "cadastro" ? rota : { nome: "entrar" };
}

/** O caminho pedido pelo hash, antes da guarda de Credencial. */
function interpretarCaminho(hash: string): Rota {
  const segmentos = hash
    .replace(/^#\/?/, "")
    .split("/")
    .filter((segmento) => segmento.length > 0);

  if (segmentos.length === 0) {
    return { nome: "cartoes" };
  }

  if (segmentos.length === 1 && segmentos[0] === "entrar") {
    return { nome: "entrar" };
  }

  if (segmentos.length === 1 && segmentos[0] === "cartoes") {
    return { nome: "cartoes" };
  }

  if (segmentos.length === 1 && segmentos[0] === "baralhos") {
    return { nome: "baralhos" };
  }

  // A tela "Criar conta" (FR-084): a rota é `#/criar-conta`, e não
  // `#/usuarios`, porque o caminho nomeia a ação que a interface oferece.
  if (segmentos.length === 1 && segmentos[0] === "criar-conta") {
    return { nome: "cadastro" };
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
 * Hook de rota corrente: lê o hash na montagem, reage a `hashchange` e aplica
 * a guarda de Credencial a cada render — assim, entrar ou Sair muda a tela sem
 * que nenhum hash precise ser reescrito.
 */
export function useRota(temCredencial: boolean): Rota {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const aoMudarHash = (): void => {
      setHash(window.location.hash);
    };

    window.addEventListener("hashchange", aoMudarHash);

    return () => {
      window.removeEventListener("hashchange", aoMudarHash);
    };
  }, []);

  return interpretarRota(hash, temCredencial);
}

/**
 * Leva a aplicação para a rota informada, pelo hash: é a mesma navegação que a
 * barra de endereço e o voltar do navegador usam, e é o que faz Sair deixar um
 * registro no histórico (FR-094, SC-034).
 */
export function irParaRota(hash: string): void {
  window.location.hash = hash;
}
