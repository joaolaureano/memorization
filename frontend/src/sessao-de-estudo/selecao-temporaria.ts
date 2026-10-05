/**
 * Módulo puro da seleção temporária do «Baralho temporário» (FR-363, FR-364,
 * FR-365, FR-367, FR-374, SC-143).
 *
 * Reúne as contas de leitura e escrita do Baralho que vive só no navegador:
 * uma lista de ids de Cartão **na ordem de inclusão e sem repetição** — a
 * identidade do Cartão é o id, nunca o texto (FR-363). Não toca no DOM nem no
 * acervo persistido: recebe a seleção e as listas já carregadas e devolve
 * sempre **um valor novo**, sem mutar a entrada.
 *
 * A seleção não guarda Vínculo vivo com a fonte (FR-364): adicionar um Baralho
 * acrescenta apenas os Cartões que ele tem **agora** e que ainda não estão na
 * seleção; adicionar um Cartão avulso acrescenta-o do mesmo modo. Re-adicionar
 * o que já está presente não muda nada.
 *
 * Antes de iniciar a Sessão, a releitura do acervo pode não trazer mais todos
 * os Cartões (FR-367, FR-374): `indisponiveis` mostra os que sumiram, na ordem
 * da seleção, e `retirarIndisponiveis` devolve a seleção sem eles — para o
 * Usuário escolher entre retirar e seguir.
 */

/** A seleção: ids de Cartão na ordem de inclusão, sem repetição. */
export type SelecaoTemporaria = readonly string[];

/** O teto de Cartões de uma seleção que pode iniciar (FR-365, SC-143). */
export const LIMITE_DA_SELECAO = 1000;

/** A situação da seleção quanto ao início da Sessão (FR-365). */
export type SituacaoDaSelecao = "vazia" | "acima-do-limite" | "ok";

/**
 * A seleção com os Cartões de `cartaoIds` que ainda não estavam nela
 * (FR-363, FR-364).
 *
 * Acrescenta na ordem recebida e também sem repetir dentro de `cartaoIds`: um
 * id repetido no lote entra uma única vez. A entrada não é tocada; o retorno é
 * sempre um array novo.
 */
export function adicionarCartoes(
  selecao: SelecaoTemporaria,
  cartaoIds: readonly string[],
): SelecaoTemporaria {
  const presentes = new Set(selecao);
  const acrescentados: string[] = [];

  for (const cartaoId of cartaoIds) {
    if (presentes.has(cartaoId)) {
      continue;
    }
    presentes.add(cartaoId);
    acrescentados.push(cartaoId);
  }

  return [...selecao, ...acrescentados];
}

/**
 * A seleção sem aquele Cartão (FR-363).
 *
 * Tira só o id pedido, sem tocar nos demais e sem reordenar o resto. Se o id
 * não estiver na seleção, ela volta igual — mas ainda como um valor novo.
 */
export function removerCartao(
  selecao: SelecaoTemporaria,
  cartaoId: string,
): SelecaoTemporaria {
  return selecao.filter((id) => id !== cartaoId);
}

/** A seleção vazia (FR-363): Limpar esvazia o Baralho temporário. */
export function limparSelecao(): SelecaoTemporaria {
  return [];
}

/**
 * A situação da seleção (FR-365, SC-143).
 *
 * Sem Cartões é `vazia`; acima do teto é `acima-do-limite` (o teto em si
 * ainda inicia); de 1 a `LIMITE_DA_SELECAO` é `ok`.
 */
export function situacaoDaSelecao(
  selecao: SelecaoTemporaria,
): SituacaoDaSelecao {
  if (selecao.length === 0) {
    return "vazia";
  }

  if (selecao.length > LIMITE_DA_SELECAO) {
    return "acima-do-limite";
  }

  return "ok";
}

/**
 * Os ids de `cartaoIds` que ainda não estão na seleção (FR-363).
 *
 * É o que distingue «Adicionar» de «Adicionado» na tela. A ordem recebida é
 * preservada e um id repetido no lote aparece no máximo uma vez.
 */
export function cartoesAusentes(
  selecao: SelecaoTemporaria,
  cartaoIds: readonly string[],
): string[] {
  const presentes = new Set(selecao);
  const ausentes: string[] = [];

  for (const cartaoId of cartaoIds) {
    if (presentes.has(cartaoId)) {
      continue;
    }
    presentes.add(cartaoId);
    ausentes.push(cartaoId);
  }

  return ausentes;
}

/**
 * Os Cartões da seleção que não estão mais no acervo (FR-367, FR-374).
 *
 * A releitura do acervo é a verdade: quem sumiu aparece aqui **na ordem da
 * seleção**, para o Usuário decidir antes de iniciar a Sessão.
 */
export function indisponiveis(
  selecao: SelecaoTemporaria,
  idsAtuaisDoAcervo: ReadonlySet<string>,
): string[] {
  return selecao.filter((cartaoId) => !idsAtuaisDoAcervo.has(cartaoId));
}

/**
 * A seleção sem os Cartões que não estão mais no acervo (FR-367, FR-374).
 *
 * Preserva a ordem dos que ficam; a entrada não é tocada e o retorno é sempre
 * um array novo.
 */
export function retirarIndisponiveis(
  selecao: SelecaoTemporaria,
  idsAtuaisDoAcervo: ReadonlySet<string>,
): SelecaoTemporaria {
  return selecao.filter((cartaoId) => idsAtuaisDoAcervo.has(cartaoId));
}
