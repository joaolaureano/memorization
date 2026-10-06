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

/**
 * Rota padrão da aplicação: o Início (FR-168), o destino de quem acabou de
 * Entrar. Substitui a antiga rota padrão de Baralhos (FR-138).
 */
export const ROTA_PADRAO = "#/inicio";

/** A rota da tela "Entrar", a primeira e única sem Credencial (FR-097). */
export const ROTA_DE_ENTRADA = "#/entrar";

/**
 * Rotas reconhecidas nesta feature. A forma é uma união discriminada por
 * `nome`, para que cada tela decida pela tag e não por comparação de strings
 * espalhada.
 */
export type Rota =
  | { nome: "inicio" }
  | { nome: "central-de-estudo" }
  | { nome: "entrar" }
  | { nome: "registro"; id: string }
  | { nome: "baralhos" }
  | { nome: "novo-baralho" }
  | { nome: "baralho"; id: string }
  | { nome: "editar-baralho"; id: string }
  | { nome: "novo-cartao"; baralhoId: string }
  | { nome: "editar-cartao"; baralhoId: string; id: string }
  | { nome: "estudo"; id: string }
  | { nome: "selecao-temporaria" }
  | { nome: "estudo-temporario" }
  | { nome: "cadastro" }
  | { nome: "preferencias" }
  | { nome: "agenda" }
  | { nome: "nova-rotina" }
  | { nome: "editar-rotina"; id: string }
  | { nome: "estudo-da-agenda" };

/**
 * Interpreta o hash corrente como uma `Rota`, já sob a guarda de Credencial
 * (FR-097, FR-098, SC-027).
 *
 * `temCredencial` diz se a Credencial está mantida. Com ela, as rotas
 * alcançáveis são as do acervo e do Cadastro, e `#/entrar` resolve em Início
 * — a tela "Entrar" não tem o que oferecer a quem já entrou, e Início é o
 * destino de quem acabou de Entrar (FR-168). Sem ela, a única tela alcançável
 * é "Entrar", e `#/criar-conta` continua alcançável porque o Cadastro é o
 * caminho de quem ainda não tem Credencial nenhuma.
 *
 * A rota padrão é Início, inclusive para hashes desconhecidos e vazios: um
 * caminho que a aplicação ainda não reconhece nunca deixa a tela sem conteúdo.
 * Segmentos vazios são descartados, de modo que `#/baralhos/` e `#/baralhos`
 * são a mesma rota.
 */
export function interpretarRota(hash: string, temCredencial: boolean): Rota {
  const rota = interpretarCaminho(hash);

  if (temCredencial) {
    return rota.nome === "entrar" ? { nome: "inicio" } : rota;
  }

  return rota.nome === "cadastro" ? rota : { nome: "entrar" };
}

/**
 * O caminho pedido pelo hash, antes da guarda de Credencial.
 *
 * O casamento é feito por número de segmentos — a profundidade distingue
 * "coleção", "coleção + ação/id" e "coleção + id + ação" —, para que os `case`
 * leiam como o mapa de rotas do contrato. `novo` é palavra reservada em
 * `/baralhos/novo` (FR-140): nunca é tratada como o id de um Baralho.
 *
 * Os ids são decodificados com `decodeURIComponent`; uma sequência de escape
 * malformada (URIError) torna o caminho desconhecido, que resolve na rota
 * padrão em vez de derrubar a interface.
 */
function interpretarCaminho(hash: string): Rota {
  try {
    const segmentos = hash
      .replace(/^#\/?/, "")
      .split("/")
      .filter((segmento) => segmento.length > 0);

    switch (segmentos.length) {
      case 0:
        return { nome: "inicio" };

      case 1: {
        const [primeiro] = segmentos;

        if (primeiro === "inicio") {
          return { nome: "inicio" };
        }

        if (primeiro === "entrar") {
          return { nome: "entrar" };
        }

        if (primeiro === "baralhos") {
          return { nome: "baralhos" };
        }

        // A tela "Criar conta" (FR-084): a rota é `#/criar-conta`, e não
        // `#/usuarios`, porque o caminho nomeia a ação que a interface oferece.
        if (primeiro === "criar-conta") {
          return { nome: "cadastro" };
        }

        // As Preferências (FR-212) são um destino de primeiro nível, como o
        // Início e os Baralhos.
        if (primeiro === "preferencias") {
          return { nome: "preferencias" };
        }

        // A área Estudo (FR-307): Agenda semanal, Estatísticas e Últimas
        // sessões, um destino de primeiro nível como o Início.
        if (primeiro === "estudo") {
          return { nome: "central-de-estudo" };
        }

        // As Rotinas de estudo (FR-237, FR-316): destino de segundo nível,
        // alcançado a partir da área Estudo, sem novo item na navegação
        // principal.
        if (primeiro === "agenda") {
          return { nome: "agenda" };
        }

        return { nome: "inicio" };
      }

      case 2: {
        const [colecao, segundo] = segmentos;

        if (colecao === "baralhos") {
          if (segundo === "temporario") {
            // FR-360: "temporario" é palavra reservada, como "novo".
            return { nome: "selecao-temporaria" };
          }
          return segundo === "novo"
            ? { nome: "novo-baralho" }
            : { nome: "baralho", id: decodificar(segundo) };
        }

        // Agendar estudo (FR-242): `novo` é palavra reservada, nunca um id.
        if (colecao === "agenda" && segundo === "nova") {
          return { nome: "nova-rotina" };
        }

        // A Sessão autorizada de um Compromisso (FR-231): o snapshot vive só na
        // memória da casca, e recarregar abandona a Sessão e volta a Início.
        if (colecao === "agenda" && segundo === "estudo") {
          return { nome: "estudo-da-agenda" };
        }

        // O Registro de uma Sessão concluída é alcançado pelo id do registro, e
        // não pelo Baralho, que pode ter sido excluído desde então (FR-166).
        if (colecao === "sessoes") {
          return { nome: "registro", id: decodificar(segundo) };
        }

        return { nome: "inicio" };
      }

      case 3: {
        const [colecao, id, acao] = segmentos;

        if (colecao === "baralhos") {
          if (id === "temporario") {
            // FR-366: a Sessão do baralho temporário vive só na memória da casca.
            return acao === "estudo"
              ? { nome: "estudo-temporario" }
              : { nome: "inicio" };
          }
          if (acao === "editar") {
            return { nome: "editar-baralho", id: decodificar(id) };
          }

          if (acao === "estudo") {
            return { nome: "estudo", id: decodificar(id) };
          }

          if (acao === "cartoes") {
            // Cartões dentro de um Baralho (FR-025): `#/baralhos/{baralhoId}/cartoes`
            // não é uma rota válida de dois segmentos; continuamos a três.
            return { nome: "inicio" };
          }
        }

        if (colecao === "agenda" && acao === "editar") {
          return { nome: "editar-rotina", id: decodificar(id) };
        }

        return { nome: "inicio" };
      }

      case 4: {
        const [colecao, baralhoId, cartoes, acao] = segmentos;

        if (colecao === "baralhos" && cartoes === "cartoes") {
          if (acao === "novo") {
            // FR-025: criar Cartão dentro de um Baralho.
            return { nome: "novo-cartao", baralhoId: decodificar(baralhoId) };
          }

          return { nome: "inicio" };
        }

        return { nome: "inicio" };
      }

      case 5: {
        const [colecao, baralhoId, cartoes, id, acao] = segmentos;

        if (colecao === "baralhos" && cartoes === "cartoes" && acao === "editar") {
          // FR-025: editar Cartão dentro de um Baralho.
          return {
            nome: "editar-cartao",
            baralhoId: decodificar(baralhoId),
            id: decodificar(id),
          };
        }

        return { nome: "inicio" };
      }

      default:
        return { nome: "inicio" };
    }
  } catch {
    return { nome: "inicio" };
  }
}

/** Decodifica um segmento de id, deixando o URIError escapar para o chamador. */
function decodificar(segmento: string): string {
  return decodeURIComponent(segmento);
}

/**
 * O hash canônico de uma `Rota`: o inverso de `interpretarRota`. Serve para a
 * interface montar links sem repetir a forma das rotas em cada tela. Os ids
 * voltam codificados com `encodeURIComponent`, de modo que ida e volta se
 * componham.
 */
export function hashDaRota(rota: Rota): string {
  switch (rota.nome) {
    case "inicio":
      return ROTA_PADRAO;

    case "central-de-estudo":
      return "#/estudo";

    case "entrar":
      return ROTA_DE_ENTRADA;

    case "registro":
      return `#/sessoes/${encodeURIComponent(rota.id)}`;

    case "cadastro":
      return "#/criar-conta";

    case "preferencias":
      return "#/preferencias";

    case "agenda":
      return "#/agenda";

    case "nova-rotina":
      return "#/agenda/nova";

    case "estudo-da-agenda":
      return "#/agenda/estudo";

    case "editar-rotina":
      return `#/agenda/${encodeURIComponent(rota.id)}/editar`;

    case "baralhos":
      return "#/baralhos";

    case "novo-baralho":
      return "#/baralhos/novo";

    case "baralho":
      return `#/baralhos/${encodeURIComponent(rota.id)}`;

    case "editar-baralho":
      return `#/baralhos/${encodeURIComponent(rota.id)}/editar`;

    case "novo-cartao":
      // FR-025: criar Cartão dentro de um Baralho.
      return `#/baralhos/${encodeURIComponent(rota.baralhoId)}/cartoes/novo`;

    case "editar-cartao":
      // FR-025: editar Cartão dentro de um Baralho.
      return `#/baralhos/${encodeURIComponent(rota.baralhoId)}/cartoes/${encodeURIComponent(rota.id)}/editar`;

    case "estudo":
      return `#/baralhos/${encodeURIComponent(rota.id)}/estudo`;
    case "selecao-temporaria":
      return "#/baralhos/temporario";
    case "estudo-temporario":
      return "#/baralhos/temporario/estudo";
  }
}

/**
 * Qual destino da moldura a rota ativa: Início, Estudo, Cartões, Baralhos,
 * Preferências, ou nenhum quando não há moldura de navegação (Entrar e Criar
 * conta). A área Estudo, o Registro de uma Sessão, as Rotinas de
 * estudo e a Sessão autorizada de um Compromisso pertencem a Estudo, que é
 * quem os apresenta (FR-307, FR-323). Concentrar essa decisão aqui evita que
 * o cabeçalho compare strings soltas para saber o que sublinhar (FR-139,
 * FR-168, FR-212).
 */
export function destinoAtivo(
  rota: Rota,
): "inicio" | "estudo" | "baralhos" | "preferencias" | null {
  switch (rota.nome) {
    case "inicio":
      return "inicio";

    case "central-de-estudo":
    case "registro":
    case "agenda":
    case "nova-rotina":
    case "editar-rotina":
    case "estudo-da-agenda":
      return "estudo";

    case "baralhos":
    case "novo-baralho":
    case "baralho":
    case "editar-baralho":
    case "novo-cartao":
    case "editar-cartao":
    case "estudo":
    case "selecao-temporaria":
    case "estudo-temporario":
      return "baralhos";

    case "preferencias":
      return "preferencias";

    case "entrar":
    case "cadastro":
      return null;
  }
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
