import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * T011 (027, FR-005, FR-014, SC-001, research R8/R10): nenhum Texto do
 * produto fora do catálogo. Varre `src/**` (exceto `src/idioma/`) e recusa:
 *
 * - texto JSX com letras;
 * - literal em atributos de texto (`aria-label`, `placeholder`, `title`,
 *   `alt`, `label`, `titulo`, `descricao`, `motivo`);
 * - qualquer literal de string com letra acentuada do português.
 *
 * É uma heurística por expressões regulares: comentários são descartados antes
 * da varredura, e as exceções abaixo são explícitas e justificadas.
 */

const RAIZ = join(process.cwd(), "src");

/** Trechos permitidos, cada um com o motivo. */
const EXCECOES: ReadonlyArray<{ arquivo: string; trecho: string; motivo: string }> = [
  { arquivo: "ui/Moldura.tsx", trecho: "memorization", motivo: "a marca não se traduz" },
  { arquivo: "ui/Aplicacao.tsx", trecho: "memorization", motivo: "a marca não se traduz" },
  {
    arquivo: "acervo-cliente/cliente-em-memoria.ts",
    trecho: "Difícil",
    motivo: "rótulo de dado do SM-2 gravado no Histórico, como no servidor; a tela traduz pela chave",
  },
  {
    arquivo: "acervo-cliente/cliente-em-memoria.ts",
    trecho: "Fácil",
    motivo: "rótulo de dado do SM-2 gravado no Histórico, como no servidor; a tela traduz pela chave",
  },
];

function arquivos(diretorio: string): string[] {
  return readdirSync(diretorio).flatMap((nome) => {
    const caminho = join(diretorio, nome);

    if (statSync(caminho).isDirectory()) {
      return nome === "idioma" ? [] : arquivos(caminho);
    }

    return /\.(ts|tsx)$/.test(nome) && !nome.endsWith(".d.ts") ? [caminho] : [];
  });
}

/** Troca comentários por espaços, preservando as quebras de linha. */
function semComentarios(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (linha, antes: string) => antes + " ".repeat(linha.length - antes.length));
}

function linhaDe(fonte: string, posicao: number): number {
  return fonte.slice(0, posicao).split("\n").length;
}

const ACENTO = /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/;
const LETRA = /[A-Za-zÀ-ÖØ-öø-ÿ]/;

function achados(caminho: string): string[] {
  const nome = caminho.slice(RAIZ.length + 1);
  const fonte = semComentarios(readFileSync(caminho, "utf8"));
  const lista: { posicao: number; trecho: string }[] = [];

  for (const literal of fonte.matchAll(/"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|'(?:[^'\\\n]|\\.)*'/g)) {
    if (ACENTO.test(literal[0])) {
      lista.push({ posicao: literal.index, trecho: literal[0] });
    }
  }

  if (nome.endsWith(".tsx")) {
    for (const texto of fonte.matchAll(/>([^<>{}]+)(?=[<{])/g)) {
      const conteudo = texto[1].trim();

      const depoisDeSeta = fonte[texto.index - 1] === "=";
      const tipoIsolado = /^(?:void|string|number|boolean|unknown|never|null|undefined|Promise|Array|Record|Readonly|ReactNode|Element|HTMLElement|[A-Z][A-Za-z]*)$/.test(conteudo);

      if (
        LETRA.test(conteudo) &&
        !depoisDeSeta &&
        !tipoIsolado &&
        !/[;=&|]|=>|\(|\)/.test(conteudo) &&
        !/^(?:as|extends|keyof|typeof)\b/.test(conteudo) &&
        !/\breadonly\b/.test(conteudo)
      ) {
        lista.push({ posicao: texto.index, trecho: conteudo });
      }
    }

    for (const texto of fonte.matchAll(/\}([^<>{}]+)(?=<\/)/g)) {
      const conteudo = texto[1].trim();

      if (LETRA.test(conteudo) && !/[;=&|()]/.test(conteudo)) {
        lista.push({ posicao: texto.index, trecho: conteudo });
      }
    }

    for (const atributo of fonte.matchAll(
      /\b(?:aria-label|placeholder|title|alt|label|titulo|descricao|motivo|rotulo[A-Za-z]*)="([^"]*)"/g,
    )) {
      if (LETRA.test(atributo[1])) {
        lista.push({ posicao: atributo.index, trecho: atributo[0] });
      }
    }
  }

  return lista
    .filter(
      ({ trecho }) =>
        !EXCECOES.some((excecao) => excecao.arquivo === nome && trecho.includes(excecao.trecho)),
    )
    .map(({ posicao, trecho }) => `${nome}:${linhaDe(fonte, posicao)}: ${trecho.slice(0, 80)}`);
}

describe("texto do produto fora do catálogo (T011)", () => {
  it("não há texto solto em src/ fora de src/idioma/", () => {
    const encontrados = arquivos(RAIZ).flatMap(achados);

    expect(encontrados).toEqual([]);
  });
});
