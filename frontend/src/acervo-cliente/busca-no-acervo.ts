/**
 * Módulo puro da busca e dos filtros do Acervo (FR-348, FR-349, FR-350,
 * FR-351, FR-352, FR-353, SC-140).
 *
 * Reúne as contas de leitura da página: quais Baralhos e Cartões aparecem
 * para uma consulta e um conjunto de critérios. Não toca no DOM nem no
 * acervo persistido: recebe as listas já carregadas e um `agora` explícito, e
 * devolve as listas filtradas — sempre na ordem recebida e sem duplicar um
 * Cartão.
 *
 * O texto é comparado por trecho contínuo (`includes`), sem acentos e sem
 * caixa (FR-348, FR-350): "álgebra" e "ALGEBRA" acham "Álgebra linear". Os
 * critérios se combinam por interseção (FR-353).
 *
 * A situação da revisão é decidida no fuso local do navegador (FR-352,
 * SC-140): as fronteiras são os dias do calendário, obtidos pelos getters
 * locais de `Date`, e não os dias UTC — é o dia que a pessoa vive. A
 * classificação não altera o Agendamento.
 */

/** O Baralho como a busca o enxerga: só o id e o nome (FR-348). */
export interface BaralhoPesquisavel {
  id: string;
  nome: string;
}

/** O Cartão como a busca o enxerga: texto, Vínculos e Agendamento (FR-349). */
export interface CartaoPesquisavel {
  id: string;
  frente: string;
  verso: string;
  baralhos: readonly { id: string }[];
  proximaRevisaoEm: string | null;
}

/** A situação derivada da revisão de um Cartão (FR-352, SC-140). */
export type SituacaoDaRevisao = "novos" | "revisao-pendente" | "em-dia";

/** O filtro de Baralho dos Cartões: `todos`, `sem-baralho` ou um id (FR-351). */
export type FiltroDeBaralho = "todos" | "sem-baralho" | string;

/** O filtro de situação dos Cartões (FR-352). */
export type FiltroDeSituacao = "todos" | SituacaoDaRevisao;

/** Os critérios da consulta de Cartões, combinados por interseção (FR-353). */
export interface CriteriosDeCartoes {
  consulta: string;
  baralho: FiltroDeBaralho;
  situacao: FiltroDeSituacao;
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
 * Os Cartões que satisfazem todos os critérios (FR-349, FR-351, FR-353).
 *
 * Os critérios se combinam por interseção: a consulta casa na Frente **ou** no
 * Verso; o Baralho é `todos` (não restringe), `sem-baralho` (sem Vínculos) ou
 * o id de um Baralho entre os Vínculos; a situação compara
 * `situacaoDaRevisao` com o filtro. A ordem recebida é preservada e cada
 * Cartão aparece no máximo uma vez — é um `filter`, não um `flatMap`.
 */
export function filtrarCartoes<C extends CartaoPesquisavel>(
  cartoes: readonly C[],
  criterios: CriteriosDeCartoes,
  agora: Date,
): C[] {
  const alvo = normalizar(criterios.consulta.trim());

  return cartoes.filter(
    (cartao) =>
      correspondeAoTexto(cartao, alvo) &&
      correspondeAoBaralho(cartao, criterios.baralho) &&
      correspondeASituacao(cartao, criterios.situacao, agora),
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

  if (filtro === "sem-baralho") {
    return cartao.baralhos.length === 0;
  }

  return cartao.baralhos.some((baralho) => baralho.id === filtro);
}

/** O Cartão passa pelo filtro de situação (FR-352). */
function correspondeASituacao(
  cartao: CartaoPesquisavel,
  filtro: FiltroDeSituacao,
  agora: Date,
): boolean {
  if (filtro === "todos") {
    return true;
  }

  return situacaoDaRevisao(cartao.proximaRevisaoEm, agora) === filtro;
}
