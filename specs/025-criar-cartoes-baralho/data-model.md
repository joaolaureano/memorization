# Phase 1 — Data Model: Criar Cartões dentro de Baralhos

## Cartão

Unidade de conteúdo composta por `id`, `frente` e `verso`. Continua sem propriedade de domínio `baralhoId`; o dono é uma relação exclusiva. Um Cartão publicado sempre tem exatamente um Pertencimento. A Frente é única dentro do Baralho e pode repetir em Baralhos diferentes.

Validações existentes permanecem: Frente e Verso obrigatórios, não vazios após aparar, texto simples e até 1.000 caracteres. A escrita da Frente verifica colisão no Baralho de destino; criação numera automaticamente, edição recusa colisão.

## Baralho

Conjunto nomeado de Cartões. Pode estar vazio, mas não pode conter Frentes duplicadas. A exclusão confirmada apaga o Baralho, seus Cartões e Agendamentos na mesma transação. Itens de Registros concluídos permanecem como snapshots históricos.

## Pertencimento

Relação entre exatamente um Cartão e seu único Baralho.

| Campo | Regra |
|---|---|
| `cartao_id` | Chave primária e chave estrangeira para `cartao(id)`; no máximo um dono por Cartão. |
| `baralho_id` | Chave estrangeira para `baralho(id)`; define o Baralho dono. |
| `frente_chave` | Forma normalizada da Frente, usada somente para unicidade no destino. |

Restrições: `UNIQUE(baralho_id, frente_chave)`; `frente_chave` é derivada por normalização Unicode, remoção de acentos, minúsculas e aparo externo. O Adapter grava Cartão + Pertencimento na mesma transação. A totalidade da relação (nenhum órfão) é garantida pela Interface do `Acervo` e coberta por testes de Interface; a chave primária evita duas relações.

## Cópia

Nova identidade, Frente e Verso copiados, e Pertencimento exclusivo no Baralho de destino. Se a Frente colidir, acrescenta o menor sufixo livre começando em `(2)`. A cópia não recebe Agendamento nem Registro histórico. O Cartão de origem, seus Vínculos legados antes da transição e seus dados de revisão não são alterados.

## Agendamento e Histórico

- Agendamento permanece por Cartão e Usuário. Excluir Cartão remove seu Agendamento por cascata; cópias não recebem linha de Agendamento.
- Registros de Sessão permanecem snapshots. Excluir Cartão/Baralho não reescreve, duplica ou remove Itens históricos.

## Persistência e transição

Versão 12 contém `cartao`, `baralho`, `vinculo`, `agendamento` e Histórico. A migração 13 cria a tabela `pertencimento`, mantendo `vinculo` temporariamente para usuários ainda não migrados.

Por Usuário:

1. Cartões com um único Baralho legado recebem esse Pertencimento automaticamente.
2. Cartões sem Baralho exigem destino escolhido.
3. Cartões com vários Baralhos exigem escolher onde manter o Cartão original; cada outro Baralho recebe uma cópia.
4. Frentes repetidas no destino são numeradas em ordem estável; Cartões originais preservam seus Agendamentos e Histórico.
5. A resolução de todas as escolhas desse Usuário, cópias e remoção de seus dados legados ocorre atomicamente.

Enquanto houver Cartões sem Pertencimento de qualquer Usuário, `vinculo` continua disponível somente como fonte da transição. Depois que todos concluírem, a migração 14 remove a tabela antiga. Um Usuário já migrado continua operando enquanto outro ainda tem escolhas pendentes.

## Regras de transição

```text
legado: Cartão -> 0..N Vínculos
pendente: Cartão sem Pertencimento + Vínculos legados preservados
concluído: Cartão -> exatamente 1 Pertencimento
compartilhado: original no destino escolhido + cópias nos demais destinos
```

O salvamento de seleção temporária cria um novo Baralho e cópias dos Cartões escolhidos em uma transação idempotente. Frentes repetidas são numeradas na ordem da seleção. Os originais e seus Agendamentos permanecem inalterados.