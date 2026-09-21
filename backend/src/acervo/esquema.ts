import { DatabaseSync } from "node:sqlite";

/**
 * Esquema SQLite do `Acervo` — a Seam interna da sua Implementation.
 *
 * A tabela `cartao` é criada na primeira execução, sem migração versionada:
 * não há base instalada nesta feature. `baralho` e `vinculo` pertencem às
 * features seguintes e não são criados aqui.
 */

/**
 * Liga as chaves estrangeiras já nesta feature, embora `cartao` não tenha
 * nenhuma. Sem o `PRAGMA`, o SQLite ignora cascatas em silêncio; ativá-lo agora
 * evita que a feature de Vínculo dependa de alguém lembrar de fazê-lo.
 */
const PRAGMA_CHAVES_ESTRANGEIRAS = "PRAGMA foreign_keys = ON;";

/**
 * As restrições `CHECK` duplicam FR-002, FR-051 e FR-052 de propósito. A
 * validação primária vive no `Acervo`, com mensagem útil ao usuário; aqui fica
 * a rede de segurança que impede estado inválido mesmo diante de um erro de
 * programação. `trim` descarta espaços nas extremidades, de modo que conteúdo
 * só de espaços conta como vazio; `length` conta caracteres, e o limite de
 * 1000 é inclusivo. A ausência de `UNIQUE` sobre `frente` é o que torna dois
 * Cartões de mesma Frente legítimos: a Frente não é identificador.
 */
const ESQUEMA_CARTAO = `
CREATE TABLE IF NOT EXISTS cartao (
  id     TEXT PRIMARY KEY,
  frente TEXT NOT NULL CHECK (length(trim(frente)) > 0 AND length(frente) <= 1000),
  verso  TEXT NOT NULL CHECK (length(trim(verso))  > 0 AND length(verso)  <= 1000)
);
`;

/**
 * Aplica o esquema a um banco já aberto. Exposta para que o `Acervo` aplique o
 * esquema à mesma conexão que usa nas operações, sem abrir um banco próprio.
 */
export function aplicarEsquema(banco: DatabaseSync): void {
  banco.exec(PRAGMA_CHAVES_ESTRANGEIRAS);
  banco.exec(ESQUEMA_CARTAO);
}

/**
 * Abre um banco SQLite no caminho informado — `":memory:"` nos testes — e
 * garante que o esquema exista. Criar a tabela na abertura torna a primeira
 * execução idêntica a todas as outras.
 */
export function abrirBanco(caminho: string): DatabaseSync {
  const banco = new DatabaseSync(caminho);
  aplicarEsquema(banco);
  return banco;
}
