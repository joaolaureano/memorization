# Migração 11 — origem `temporario`

Mesmo número de versão nos dois Adapters. Nenhum dado é alterado; só a restrição de valores de `registro_de_sessao.origem` passa a aceitar `'temporario'`.

## PostgreSQL

```sql
ALTER TABLE registro_de_sessao DROP CONSTRAINT IF EXISTS registro_de_sessao_origem_check;
ALTER TABLE registro_de_sessao ADD CONSTRAINT registro_de_sessao_origem_check
  CHECK (origem IN ('baralho','revisao','temporario'));
```

A migração 7 criou a constraint sem nome explícito, e o PostgreSQL a nomeou `registro_de_sessao_origem_check`. A prova confere o nome real antes e depois.

## SQLite

O SQLite não altera `CHECK` de coluna existente, e a migração roda com `foreign_keys = ON`. Um `DROP` direto de `registro_de_sessao` apagaria em cascata os Itens. Por isso, numa única transação:

1. Criar `registro_de_sessao_v11`, com o DDL atual da tabela, todas as colunas da migração 7 e o `CHECK` ampliado.
2. Criar `item_de_registro_v11`, com o DDL atual e a chave estrangeira apontando para `registro_de_sessao_v11(id) ON DELETE CASCADE`.
3. Copiar as linhas, primeiro dos Registros e depois dos Itens, com `INSERT … SELECT` nas colunas explícitas.
4. `DROP TABLE item_de_registro`; depois `DROP TABLE registro_de_sessao`. Na ordem filho → pai, o cascade não alcança as tabelas novas.
5. `ALTER TABLE registro_de_sessao_v11 RENAME TO registro_de_sessao`. O SQLite atualiza a referência em `item_de_registro_v11`.
6. `ALTER TABLE item_de_registro_v11 RENAME TO item_de_registro`.
7. Recriar os índices existentes das duas tabelas, inclusive `registro_de_sessao_usuario_concluida`.

Provas obrigatórias:

- Uma base na versão 10 com Registros e Itens chega à 11 com as mesmas contagens e os mesmos valores.
- A chave estrangeira de `item_de_registro` aponta para `registro_de_sessao`.
- Excluir o Usuário ainda remove Registros e Itens.
- `origem = 'temporario'` passa a ser aceita e `'outra'` continua recusada.
