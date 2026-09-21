# Phase 1 — Data Model: Vincular Cartão a Baralho

## Escopo desta feature

Acrescenta **uma tabela: `vinculo`**, pela migração 3. As tabelas `cartao` e
`baralho` já existem, das features `001` e `002`, e **não são alteradas**.

## Entidade durável

### Vinculo

| Campo | Tipo | Restrição |
|---|---|---|
| `cartao_id` | texto | Chave estrangeira para `cartao(id)`, `ON DELETE CASCADE` |
| `baralho_id` | texto | Chave estrangeira para `baralho(id)`, `ON DELETE CASCADE` |

**Chave primária composta `(cartao_id, baralho_id)`**, que implementa FR-020 no
próprio esquema: a duplicata é impossível, não apenas verificada.

Sem coluna `id` própria e sem data de criação: nenhum requisito os usa.

## Esquema e migração

```sql
-- migração 3 (esta feature)
CREATE TABLE vinculo (
  cartao_id  TEXT NOT NULL REFERENCES cartao(id)  ON DELETE CASCADE,
  baralho_id TEXT NOT NULL REFERENCES baralho(id) ON DELETE CASCADE,
  PRIMARY KEY (cartao_id, baralho_id)
);
```

Aplicada pela infraestrutura de migração criada na feature `002`, em transação,
elevando a versão do esquema de 2 para 3.

## A semântica não-cascateante é propriedade da forma

Este é o ponto central do modelo, e ele **não depende de código**:

- `cartao` **não** referencia `baralho`
- `baralho` **não** referencia `cartao`
- apenas `vinculo` referencia ambos, com cascata

Portanto excluir um Cartão remove as linhas de `vinculo` que o referenciam e
**nada mais**; excluir um Baralho faz o simétrico. Não existe caminho pelo qual
uma exclusão alcance a entidade do outro lado. FR-008 e FR-017, que serão
exercidos na feature `006`, já estão garantidos aqui pela forma do esquema.

**`PRAGMA foreign_keys = ON` é obrigatório.** Sem ele o SQLite ignora as
cascatas silenciosamente e as invariantes deixam de valer sem nenhum sinal. Foi
ativado na feature `001` por antecipação a esta necessidade.

## Elegibilidade

Continua **derivada**, nunca armazenada (FR-024):

```sql
SELECT COUNT(*) FROM vinculo WHERE baralho_id = ?
```

`elegivel` é `quantidadeDeCartoes > 0`. A partir desta feature o valor varia; o
formato publicado pela feature `002` já o contemplava.

## Correspondência com as invariantes da spec

| Invariante | Onde é garantida |
|---|---|
| Cartão vinculado a zero ou mais Baralhos | Ausência de restrição de cardinalidade |
| Par (Cartão, Baralho) único | Chave primária composta |
| Baralho elegível ⟺ ao menos um Cartão vinculado | Contagem na leitura |
| Desvincular preserva ambos | Remoção de linha de `vinculo`, sem efeito nas outras tabelas |
| Sem limite superior de Vínculos | Ausência de restrição de contagem, verificada por teste com 20 e 60 |
