# Phase 1 — Data Model: Criar Cartão

Modelo derivado das entidades da spec e do glossário canônico de `CONTEXT.md`.
Nomes de tabela e coluna usam os termos canônicos; sinônimos de `_Avoid_` são
proibidos.

## Escopo desta feature

**Uma tabela: `cartao`.** As tabelas `baralho` e `vinculo` pertencem às features
`002` e `003` e **não** são criadas aqui.

## Entidade durável

### Cartao

| Campo | Tipo | Restrição |
|---|---|---|
| `id` | texto | Chave primária, identificador opaco gerado pelo sistema |
| `frente` | texto | Obrigatório, não vazio após remoção de espaços, no máximo 1000 caracteres (FR-002, FR-051, FR-052) |
| `verso` | texto | Obrigatório, mesmas restrições |

Nenhuma outra propriedade, por FR-009. Não há título, descrição, data ou campo
de conveniência.

A **Frente não é identificador**: dois Cartões podem ter a mesma Frente, e isso
é comportamento especificado, não tolerância.

## Esquema SQLite

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cartao (
  id     TEXT PRIMARY KEY,
  frente TEXT NOT NULL CHECK (length(trim(frente)) > 0 AND length(frente) <= 1000),
  verso  TEXT NOT NULL CHECK (length(trim(verso))  > 0 AND length(verso)  <= 1000)
);
```

`PRAGMA foreign_keys = ON` é ativado já aqui, embora não haja chave estrangeira
nesta feature, para que a feature `003` não dependa de alguém lembrar de
ligá-lo. Sem ele, o SQLite ignora cascatas em silêncio.

As restrições `CHECK` duplicam FR-002, FR-051 e FR-052 **de propósito**: a
validação primária vive no `Acervo`, com mensagem útil ao usuário; a restrição
no banco é a rede de segurança que impede estado inválido mesmo diante de um
erro de programação.

## Entidades de outras features

| Entidade | Feature | Observação |
|---|---|---|
| Baralho | `002-criar-baralho` | Acrescenta a tabela `baralho`. **Gatilho de migração**: é a primeira alteração de esquema com base instalada |
| Vínculo | `003-vincular-cartao-baralho` | Acrescenta `vinculo`, com chave primária composta e cascata |

## Correspondência com as invariantes da spec

| Invariante | Onde é garantida |
|---|---|
| Frente e Verso não vazios, no máximo 1000 caracteres | `CHECK` no esquema mais validação no `Acervo` |
| Conteúdo só de espaços tratado como vazio | `trim` na `CHECK` e na validação |
| A Frente não é identificador | Ausência de `UNIQUE` sobre `frente` |
| Nenhuma propriedade além de Frente e Verso | Ausência de coluna adicional, verificada por teste que envia propriedade extra |
| Persistência entre execuções | Arquivo SQLite, criado na primeira execução |
