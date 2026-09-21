# Phase 1 — Data Model: Criar Usuário

Modelo derivado da spec e do glossário canônico de `CONTEXT.md`.

## Escopo desta feature

Esta feature acrescenta **uma tabela, `usuario`**, na migração 4. Nenhuma tabela
existente (`cartao`, `baralho`, `vinculo`, `versao_do_esquema`) é alterada, e o
comportamento de `001` a `006` não muda.

## Entidade durável

### Usuário

| Campo | Tipo | Restrição |
|---|---|---|
| `id` | texto | Chave primária; identificador opaco |
| `nome_de_usuario` | texto | Obrigatório; único **sem distinção entre maiúsculas e minúsculas**; de 3 a 50 caracteres; apenas `A–Z`, `a–z`, dígitos, `.`, `_` e `-` (FR-073, FR-074) |
| `sal` | binário | Obrigatório; exatamente 16 bytes, aleatório por Usuário (FR-076) |
| `hash` | binário | Obrigatório; resultado do scrypt (FR-076) |
| `parametros` | texto | Obrigatório; JSON com os parâmetros usados na derivação |

**Nenhuma coluna guarda a Senha**, e não há outras colunas. FR-076 vale por
construção, não por disciplina de código.

## Esquema e migração

```sql
-- migração 4 (esta feature)
CREATE TABLE usuario (
  id              TEXT PRIMARY KEY,
  nome_de_usuario TEXT NOT NULL UNIQUE COLLATE NOCASE
                  CHECK (length(nome_de_usuario) BETWEEN 3 AND 50)
                  CHECK (nome_de_usuario NOT GLOB '*[^A-Za-z0-9._-]*'),
  sal             BLOB NOT NULL CHECK (length(sal) = 16),
  hash            BLOB NOT NULL,
  parametros      TEXT NOT NULL
);
```

As restrições `CHECK` repetem o FR-073 **de propósito**. A validação principal
fica no `Identidade`, que devolve uma mensagem útil; as restrições do esquema
são uma rede de segurança contra erro de programação. Os limites 3 e 50 são
inclusivos.

O `COLLATE NOCASE` só iguala maiúsculas e minúsculas em ASCII. Por isso o
alfabeto permitido é `A–Z` e `a–z` ([research.md](./research.md), Decisão 5).

O `UNIQUE` também cria o índice usado para detectar duplicatas. A duplicata é
detectada pela **tradução da violação** em `nome_de_usuario_existente`, sem
consulta prévia e, portanto, sem corrida.

Os `parametros` ficam em texto JSON, e não em colunas separadas, para que os
parâmetros da derivação possam mudar sem migração. Um hash antigo continua
verificável.

## Correspondência com as invariantes da spec

| Invariante | Onde é garantida |
|---|---|
| Nome de usuário único, sem distinção entre maiúsculas e minúsculas | `UNIQUE COLLATE NOCASE`, traduzido em `nome_de_usuario_existente` |
| Nome de usuário de 3 a 50 caracteres, com alfabeto restrito | `CHECK` no esquema e validação no `Identidade` |
| Senha de 8 a 128 caracteres, sem regra de composição | Validação no `Identidade` (FR-075, FR-085); a Senha não é gravada |
| Senha guardada apenas de forma irreversível | `sal` e `hash`; nenhuma coluna consegue guardar a Senha (FR-076) |
| Dados não revelam que dois Usuários têm a mesma Senha | `sal` aleatório por Usuário, o que gera hashes distintos (SC-022) |
| Nenhuma sessão, cookie ou token | Não existe tabela, coluna ou estado de sessão (FR-079) |
| Persistência entre execuções | Arquivo SQLite com migração versionada (FR-040, SC-023) |

## O que este modelo deliberadamente não tem

- Coluna de Senha, em qualquer forma, nem mesmo cifrada.
- Coluna derivada da Senha, como comprimento, força ou data de troca.
- Tabela de sessão, token ou cookie.
- Colunas `criado_em`, `ativo` ou `bloqueado`, que estão fora da spec.
