# Phase 1 — Data Model: Editar Cartão e Baralho

Não há entidade, tabela ou migração nova.

| Entidade | Campos alteráveis | Invariantes |
|---|---|---|
| Cartão | Frente, Verso | não vazios após trim; até 1000 caracteres; Vínculos preservados |
| Baralho | nome | não vazio após trim; até 100 caracteres; Vínculos preservados |

O estado de formulário é transitório no frontend. Não salvo, não altera o
Acervo; descartá-lo exige confirmação quando houver mudança.

