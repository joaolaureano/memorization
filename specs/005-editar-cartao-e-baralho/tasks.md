# Tasks: Editar Cartão e Baralho

**Executor**: código sob backend, frontend e e2e por subagentes DeepSeek.

## Fase 1 — Acervo e contrato

- [X] T401 Interface do Acervo atualiza Cartão, reaplicando regras e preservando Vínculos
- [X] T402 Interface do Acervo renomeia Baralho, preservando Vínculos e elegibilidade
- [X] T403 Rotas PUT e ClienteDoAcervo passam nos dois Adapters

| ID | Requisitos | Depende | Testes |
|---|---|---|---|
| T401 | FR-005 | 003 | conteúdo inválido, propagação a três Baralhos |
| T402 | FR-015 | T401 | nome inválido, Vínculos intactos |
| T403 | FR-044, FR-046 | T402 | 200, 400, 404 e indisponível |

## Fase 2 — Telas e qualidade

- [ ] T404 Formulários mostram alcance, salvam e confirmam descarte
- [ ] T405 Falha preserva conteúdo e foco/teclado tornam edição acessível
- [ ] T406 [P] Telas em português são utilizáveis em telefone
- [ ] T407 e2e cobre propagação, descarte e falha

| ID | Requisitos | Depende | Testes |
|---|---|---|---|
| T404 | FR-006, FR-050 | T403 | três Baralhos, cancelar descarte |
| T405 | FR-045, FR-067 | T404 | API indisponível, teclado e foco |
| T406 | FR-042, FR-046 | T404 | viewport estreito |
| T407 | SC-014 | T405, T406 | navegador real |

## Rastreabilidade

| Requisito | Tarefa |
|---|---|
| FR-005 | T401 |
| FR-006, FR-050 | T404 |
| FR-015 | T402 |
| FR-042, FR-046 | T403, T406 |
| FR-044 | T403 |
| FR-045, FR-067 | T405 |

