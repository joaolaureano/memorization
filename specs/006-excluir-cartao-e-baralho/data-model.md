# Phase 1 — Data Model: Excluir Cartão e Baralho

Não há tabela ou migração nova. A tabela vinculo existente já define:

| Operação | Linhas removidas | Preservado |
|---|---|---|
| Excluir Cartão | Cartão e seus Vínculos | todos os Baralhos |
| Excluir Baralho | Baralho e seus Vínculos | todos os Cartões |

A elegibilidade de Baralho restante continua derivada da contagem de Vínculos.
Cartão sem Baralho é estado legítimo e aparece na lista.

