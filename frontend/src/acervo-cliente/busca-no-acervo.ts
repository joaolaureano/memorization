/**
 * Módulo puro da busca, dos filtros e da situação da revisão do Acervo
 * (FR-348, FR-349, FR-350, FR-351, FR-353, FR-379–FR-382, SC-140, SC-150,
 * SC-151).
 *
 * Reúne as contas de leitura das telas: quais Baralhos e Cartões aparecem
 * para uma consulta e um conjunto de critérios, e qual é a situação da
 * revisão de um Baralho derivada dos Agendamentos dos seus Cartões. Não toca no DOM nem no
 * acervo persistido: recebe as listas já carregadas e um `agora` explícito, e
 * devolve as listas filtradas — sempre na ordem recebida e sem duplicar um
 * Cartão.
 *
 * O texto é comparado por trecho contínuo (`includes`), sem acentos e sem
 * caixa (FR-348, FR-350): "álgebra" e "ALGEBRA" acham "Álgebra linear". Os
 * critérios se combinam por interseção (FR-353).
 *
 * A situação da revisão é decidida no fuso local do navegador (FR-352,
 * FR-379, SC-140): as fronteiras são os dias do calendário, obtidos pelos
 * getters locais de `Date`, e não os dias UTC — é o dia que a pessoa vive. A
 * classificação não altera o Agendamento. Um Cartão novo, com dia de revisão
 * hoje/anterior ou com data ilegível deixa o Baralho `pendente`; só o
 * conjunto não vazio com todos os Cartões no futuro é `revisado` (FR-379). O
 * Baralho vazio é `sem-cartoes` — situação neutra, nunca Revisado (FR-380).
 *
 * Desde a 024, o filtro de Situação da revisão pertence aos **Baralhos**
 * (FR-381); a lista de Cartões conserva apenas a busca e o filtro de Baralho
 * (FR-382, SC-150).
 */

/** O Baralho como a busca o enxerga: só o id e o nome (FR-348). */
export interface BaralhoPesquisavel {
  id: string;
  nome: string;
}

/** O Cartão como a busca o enxerga: texto, Baralho e Agendamento (FR-349). */
export interface CartaoPesquisavel {
  id: string;
  frente: string;
  verso: string;
  baralho: { id: string };
  proximaRevisaoEm: string | null;
}

/** A situação derivada da revisão de um Cartão (FR-352, SC-140). */
export type SituacaoDaRevisao = "novos" | "revisao-pendente" | "em-dia";

/** O filtro de Baralho dos Cartões: `todos` ou um id (FR-351). */
export type FiltroDeBaralho = "todos" | string;

/** Os critérios da consulta de Cartões, combinados por interseção (FR-353). */
export interface CriteriosDeCartoes {
  consulta: string;
  baralho: FiltroDeBaralho;
}

/**
 * Os Baralhos cujo nome contém a consulta (FR-348, FR-350).
 *
 * A consulta é aparada e normalizada; vazia depois disso, não restringe e a
 * lista volta inteira, na ordem recebida. A correspondência é por trecho
 * contínuo, sem acentos e sem caixa.
 */
export function filtrarBaralhos<B extends BaralhoPesquisavel>(
  baralhos: readonly B[],
  consulta: string,
): B[] {
  const alvo = normalizar(consulta.trim());

  return baralhos.filter(
    (baralho) => alvo === "" || normalizar(baralho.nome).includes(alvo),
  );
}

/**
 * Os Cartões que satisfazem todos os critérios (FR-349, FR-351, FR-353,
 * FR-382).
 *
 * Os critérios se combinam por interseção: a consulta casa na Frente **ou** no
 * Verso; o Baralho é `todos` (não restringe) ou o id do Baralho dono.
 * O filtro de Situação da revisão não
 * pertence mais aos Cartões (FR-382): ele vive nos Baralhos, em
 * `filtrarBaralhosPorSituacao`. A ordem recebida é preservada e cada Cartão
 * aparece no máximo uma vez — é um `filter`, não um `flatMap`.
 */
export function filtrarCartoes<C extends CartaoPesquisavel>(
  cartoes: readonly C[],
  criterios: CriteriosDeCartoes,
): C[] {
  const alvo = normalizar(criterios.consulta.trim());

  return cartoes.filter(
    (cartao) =>
      correspondeAoTexto(cartao, alvo) &&
      correspondeAoBaralho(cartao, criterios.baralho),
  );
}

/**
 * A situação da revisão de um Cartão (FR-352, SC-140).
 *
 * Sem Agendamento (`null`) o Cartão é `novos`. Com Agendamento, a comparação é
 * entre **dias locais**: se o dia de `proximaRevisaoEm` for o de hoje ou
 * anterior, a revisão está `revisao-pendente` — inclusive hoje com horário
 * ainda não alcançado; se for posterior, está `em-dia`. Uma data ilegível
 * (não numérica) conta como `revisao-pendente`: uma data ruim nunca esconde o
 * Cartão de quem procura revisões.
 */
export function situacaoDaRevisao(
  proximaRevisaoEm: string | null,
  agora: Date,
): SituacaoDaRevisao {
  if (proximaRevisaoEm === null) {
    return "novos";
  }

  const diaDaRevisao = new Date(proximaRevisaoEm);
  if (Number.isNaN(diaDaRevisao.getTime())) {
    return "revisao-pendente";
  }

  return meiaNoiteLocal(diaDaRevisao).getTime() <=
    meiaNoiteLocal(agora).getTime()
    ? "revisao-pendente"
    : "em-dia";
}

/** A situação derivada da revisão de um Baralho (FR-379, FR-380, SC-151). */
export type SituacaoDoBaralho = "sem-cartoes" | "pendente" | "revisado";

/** O filtro de Situação dos Baralhos (FR-381). */
export type FiltroDeSituacaoDoBaralho = "todos" | "pendente" | "revisado";

/**
 * A situação da revisão de um Baralho a partir das próximas revisões dos seus
 * Cartões (FR-379, FR-380).
 *
 * Sem Cartões, o Baralho é `sem-cartoes` — situação neutra, nunca `revisado`.
 * Com Cartões, basta um não estar `em-dia` (novo, vencido ou com data
 * ilegível) para o Baralho ser `pendente`; `revisado` exige o conjunto não
 * vazio com todos os Cartões no futuro. Uma lista de datas vazia e um Baralho
 * sem Cartões são o mesmo caso: quem chama passa só as datas dos Cartões do
 * Baralho.
 */
export function situacaoDoBaralho(
  proximasRevisoesEm: readonly (string | null)[],
  agora: Date,
): SituacaoDoBaralho {
  if (proximasRevisoesEm.length === 0) {
    return "sem-cartoes";
  }

  const pendente = proximasRevisoesEm.some(
    (proxima) => situacaoDaRevisao(proxima, agora) !== "em-dia",
  );

  return pendente ? "pendente" : "revisado";
}

/**
 * A situação de cada Baralho da lista (FR-379, FR-380).
 *
 * Devolve uma entrada para **todo** Baralho recebido: os que não têm Cartão
 * (ou não aparecem nos Vínculos) ficam `sem-cartoes`, o que mantém o mapa
 * completo para o filtro e para as etiquetas. Um Cartão com dois Vínculos
 * conta nos dois Baralhos.
 */
export function classificarBaralhos(
  baralhos: readonly { id: string }[],
  cartoes: readonly CartaoPesquisavel[],
  agora: Date,
): Map<string, SituacaoDoBaralho> {
  const proximasPorBaralho = new Map<string, (string | null)[]>();

  for (const cartao of cartoes) {
    const proximas = proximasPorBaralho.get(cartao.baralho.id);
    if (proximas === undefined) {
      proximasPorBaralho.set(cartao.baralho.id, [cartao.proximaRevisaoEm]);
    } else {
      proximas.push(cartao.proximaRevisaoEm);
    }
  }

  const situacoes = new Map<string, SituacaoDoBaralho>();
  for (const baralho of baralhos) {
    situacoes.set(
      baralho.id,
      situacaoDoBaralho(proximasPorBaralho.get(baralho.id) ?? [], agora),
    );
  }

  return situacoes;
}

/**
 * Os Baralhos que passam pelo filtro de Situação (FR-381, SC-150).
 *
 * `todos` não restringe e devolve a lista inteira, incluindo os Baralhos
 * `sem-cartoes`; `pendente` e `revisado` excluem quem não tem a situação
 * (inclusive os vazios). A ordem recebida é preservada.
 */
export function filtrarBaralhosPorSituacao<B extends { id: string }>(
  baralhos: readonly B[],
  situacoes: ReadonlyMap<string, SituacaoDoBaralho>,
  filtro: FiltroDeSituacaoDoBaralho,
): B[] {
  return baralhos.filter(
    (baralho) =>
      filtro === "todos" ||
      (situacoes.get(baralho.id) ?? "sem-cartoes") === filtro,
  );
}

/**
 * Os Cartões vinculados a um Baralho, na ordem recebida (FR-384).
 *
 * Um Cartão com mais de um Vínculo aparece em cada Baralho uma única vez —
 * `some`, não `filter` aninhado. O conjunto preserva a ordem da lista de
 * Cartões.
 */
export function cartoesDoBaralho<C extends CartaoPesquisavel>(
  cartoes: readonly C[],
  baralhoId: string,
): C[] {
  return cartoes.filter((cartao) => cartao.baralho.id === baralhoId);
}

/**
 * Os Cartões pendentes de revisão: novos, vencidos ou com data ilegível
 * (FR-383).
 *
 * É o complemento exato de `em-dia`: nunca descarta um Cartão cuja data não
 * foi possível ler (FR-387) — uma data ilegível conta como pendente, nunca
 * como revisada.
 */
export function cartoesPendentes<C extends CartaoPesquisavel>(
  cartoes: readonly C[],
  agora: Date,
): C[] {
  return cartoes.filter(
    (cartao) => situacaoDaRevisao(cartao.proximaRevisaoEm, agora) !== "em-dia",
  );
}

/**
 * O rótulo textual da situação de um Baralho (FR-380, SC-152).
 *
 * "Sem cartões" é neutro e tem maiúscula de início de frase; "Pendente" e
 * "Revisado" também começam a frase — o chamador usa o mesmo texto na
 * etiqueta e no anúncio.
 */
export function rotuloDaSituacaoDoBaralho(
  situacao: SituacaoDoBaralho,
): string {
  switch (situacao) {
    case "sem-cartoes":
      return "Sem cartões";
    case "pendente":
      return "Pendente";
    case "revisado":
      return "Revisado";
  }
}

/** O texto de comparação: sem acentos e em minúsculas (FR-348, FR-350). */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** A meia-noite local do dia de um instante (FR-352, SC-140). */
function meiaNoiteLocal(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

/** A consulta casa na Frente ou no Verso do Cartão (FR-349). */
function correspondeAoTexto(cartao: CartaoPesquisavel, alvo: string): boolean {
  if (alvo === "") {
    return true;
  }

  return (
    normalizar(cartao.frente).includes(alvo) ||
    normalizar(cartao.verso).includes(alvo)
  );
}

/** O Cartão passa pelo filtro de Baralho (FR-351). */
function correspondeAoBaralho(
  cartao: CartaoPesquisavel,
  filtro: FiltroDeBaralho,
): boolean {
  if (filtro === "todos") {
    return true;
  }

  return cartao.baralho.id === filtro;
}
