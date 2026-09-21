# Tasks: Excluir Cartão e Baralho

**Executor**: código sob backend, frontend e e2e por subagentes DeepSeek.

## Fase 1 — Acervo e contrato

- [X] T501 Interface exclui Cartão, preservando Baralhos e removendo Vínculos
- [X] T502 Interface exclui Baralho, preservando Cartões e removendo Vínculos
- [X] T503 Rotas DELETE e ClienteDoAcervo passam nos dois Adapters

| ID | Requisitos | Depende | Testes |
|---|---|---|---|
| T501 | FR-007, FR-008 | 003 | dois Baralhos sobrevivem |
| T502 | FR-016, FR-017 | T501 | Cartões sobrevivem e ficam alcançáveis |
| T503 | FR-044, FR-046 | T502 | 204, 404 e indisponível |

## Fase 2 — Confirmação e qualidade

- [X] T504 Diálogos declaram consequências e cancelamento não altera estado
- [X] T505 Diálogo é operável por teclado e anunciado por leitor de tela
- [X] T506 Falha preserva entidade exibida
- [X] T507 [P] Telas em português são utilizáveis em telefone
- [X] T508 e2e cobre exclusão, cancelamento e elegibilidade derivada

| ID | Requisitos | Depende | Testes |
|---|---|---|---|
| T504 | FR-007, FR-016 | T503 | consequência e cancelamento |
| T505 | FR-068, FR-069 | T504 | foco e anúncios |
| T506 | FR-045 | T504 | API indisponível |
| T507 | FR-042, FR-046 | T504 | viewport estreito |
| T508 | SC-005, SC-006 | T505, T506, T507 | navegador real |

## Rastreabilidade

| Requisito | Tarefa |
|---|---|
| FR-007, FR-008 | T501, T504 |
| FR-016, FR-017 | T502, T504 |
| FR-042, FR-046 | T503, T507 |
| FR-044 | T503 |
| FR-045 | T506 |
| FR-068, FR-069 | T505 |

