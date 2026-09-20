# Phase 1 — Data Model: Criar Baralho

Modelo derivado da spec e do glossário canônico de `CONTEXT.md`.

## Escopo desta feature

Acrescenta **uma tabela: `baralho`**, e a infraestrutura de migração que passa a
ser necessária por existir base instalada da feature `001`. A tabela `vinculo`
pertence à feature `003`.

## Entidade durável

### Baralho

| Campo | Tipo | Restrição |
|---|---|---|
| `id` | texto | Chave primária, identificador opaco |
| `nome` | texto | Obrigatório, não vazio após remoção de espaços, no máximo 100 caracteres (FR-011, FR-061) |

Nenhuma outra propriedade, por FR-018.

**Sem `UNIQUE` sobre `nome`**, e isso é requisito, não descuido: FR-012 determina
que o nome é rótulo, não identificador. Dois Baralhos podem se chamar `Inglês`.

**Sem coluna `elegivel`.** A elegibilidade é derivada por contagem de Vínculos
(FR-024, feature `003`). Nesta feature, todo Baralho é não elegível por não
existir Vínculo algum.

## Esquema e migração

```sql
-- migração 1 (feature 001, já aplicada)
CREATE TABLE IF NOT EXISTS cartao (
  id     TEXT PRIMARY KEY,
  frente TEXT NOT NULL CHECK (length(trim(frente)) > 0 AND length(frente) <= 1000),
  verso  TEXT NOT NULL CHECK (length(trim(verso))  > 0 AND length(verso)  <= 1000)
);

-- migração 2 (esta feature)
CREATE TABLE baralho (
  id   TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0 AND length(nome) <= 100)
);
```

Controle de versão do esquema:

```sql
CREATE TABLE IF NOT EXISTS versao_do_esquema (
  versao INTEGER NOT NULL
);
```

Cada migração é aplicada **em transação**, e a versão é elevada dentro da mesma
transação. Uma base na versão 1 recebe apenas a migração 2; uma base nova recebe
as duas em ordem. Migração já aplicada nunca roda de novo.

A restrição `CHECK` duplica FR-011 e o limite de 100 caracteres **de propósito**:
a validação primária vive no `Acervo`, com mensagem útil; a restrição no banco é
a rede de segurança contra erro de programação.

## Correspondência com as invariantes da spec

| Invariante | Onde é garantida |
|---|---|
| Nome não vazio, no máximo 100 caracteres | `CHECK` no esquema mais validação no `Acervo` |
| Nome não precisa ser único | Ausência de `UNIQUE` sobre `nome` |
| Elegibilidade derivada, nunca persistida | Ausência de coluna; cálculo na leitura |
| Nenhuma propriedade além de nome | Ausência de coluna adicional, verificada por teste que envia propriedade extra |
| Persistência entre execuções | Arquivo SQLite, com migração versionada |
