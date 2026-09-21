import type { DatabaseSync } from "node:sqlite";

/**
 * Apoio dos cenários que falam **direto com o SQLite**.
 *
 * Os testes de esquema e de migração precisam gravar linhas antes de a
 * Interface existir, e depois da migração 5 toda linha do acervo pertence a um
 * Usuário: sem a linha de `usuario`, a chave estrangeira e o `NOT NULL` de
 * `usuario_id` recusam a gravação. Aqui ficam essas gravações, e nada mais —
 * nenhuma regra de domínio é reproduzida, apenas o mínimo para preparar uma
 * base.
 */

/** Os dados da derivação de um Usuário sintético, com sal de 16 bytes. */
const PARAMETROS_SINTETICOS = '{"algoritmo":"scrypt","entrada":"hmac-sha256"}';

/**
 * Grava um Usuário direto na tabela `usuario` e devolve o seu `id` — o dono das
 * linhas do acervo que o cenário for gravar (FR-092).
 */
export function gravarDono(
  banco: DatabaseSync,
  id = "dono-um",
  nomeDeUsuario = "ana.silva",
): string {
  banco
    .prepare(
      `INSERT INTO usuario (id, nome_de_usuario, sal, hash, parametros)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      nomeDeUsuario,
      new Uint8Array(16),
      new Uint8Array(64),
      PARAMETROS_SINTETICOS,
    );

  return id;
}

/** Grava um Cartão do dono informado. */
export function gravarCartao(
  banco: DatabaseSync,
  dono: string,
  id: string,
  frente = "To walk",
  verso = "Caminhar",
): void {
  banco
    .prepare(
      "INSERT INTO cartao (id, frente, verso, usuario_id) VALUES (?, ?, ?, ?)",
    )
    .run(id, frente, verso, dono);
}

/** Grava um Baralho do dono informado. */
export function gravarBaralho(
  banco: DatabaseSync,
  dono: string,
  id: string,
  nome = "Inglês",
): void {
  banco
    .prepare("INSERT INTO baralho (id, nome, usuario_id) VALUES (?, ?, ?)")
    .run(id, nome, dono);
}

/**
 * Grava um Cartão na forma **anterior à migração 5**, sem dono: os cenários de
 * migração precisam de uma base antiga com dados, e é justamente esse acervo
 * sem dono que a migração descarta (FR-099, SC-037).
 */
export function gravarCartaoSemDono(
  banco: DatabaseSync,
  id: string,
  frente = "To walk",
  verso = "Caminhar",
): void {
  banco
    .prepare("INSERT INTO cartao (id, frente, verso) VALUES (?, ?, ?)")
    .run(id, frente, verso);
}

/** Grava um Baralho na forma anterior à migração 5, sem dono. */
export function gravarBaralhoSemDono(
  banco: DatabaseSync,
  id: string,
  nome = "Inglês",
): void {
  banco.prepare("INSERT INTO baralho (id, nome) VALUES (?, ?)").run(id, nome);
}

/** Grava o Vínculo entre o Cartão e o Baralho informados. */
export function gravarVinculo(
  banco: DatabaseSync,
  cartaoId: string,
  baralhoId: string,
): void {
  banco
    .prepare("INSERT INTO vinculo (cartao_id, baralho_id) VALUES (?, ?)")
    .run(cartaoId, baralhoId);
}

/** Quantas linhas a tabela informada tem. A tabela é sempre um nome fixo. */
export function contarLinhas(banco: DatabaseSync, tabela: string): number {
  const linha = banco
    .prepare(`SELECT count(*) AS total FROM ${tabela}`)
    .get();

  return Number(linha?.total ?? 0);
}
