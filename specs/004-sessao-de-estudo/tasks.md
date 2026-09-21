# Tasks: Sessão de Estudo

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`

**Executor**: todo código em `frontend/` e `e2e/` será criado por subagentes
DeepSeek.

## Fase 1 — Module efêmero

- [ ] T301 `SessaoDeEstudo` inicia com seleção sem repetição e limite ao disponível
- [ ] T302 Revelação, Resultado imutável e Resumo coerente são garantidos pela Interface
- [ ] T303 Interrupção descarta todo o estado e nenhuma rota/tabela de Sessão existe

| ID | Requisitos | Depende | Áreas | Testes |
|---|---|---|---|---|
| T301 | FR-025, FR-027 a FR-031 | 003 | `frontend/src/sessao-de-estudo/` | Adapter determinístico prova ordem e unicidade |
| T302 | FR-032 a FR-037 | T301 | mesmo Module | revelação obrigatória, um Resultado, Resumo correto |
| T303 | FR-038, FR-039 | T302 | frontend, contratos | recarregar/interromper sem vestígio |

## Fase 2 — Telas e qualidade

- [ ] T304 Tela de início e de Item comunica elegibilidade, limite e progresso
- [ ] T305 Revelação e Resultado são percorridos por teclado, com foco preservado
- [ ] T306 Mudanças são anunciadas por leitor de tela
- [ ] T307 [P] Sessão é utilizável em telefone e em português
- [ ] T308 Fluxo e2e encerra no Resumo e confirma descarte ao interromper

| ID | Requisitos | Depende | Áreas | Testes |
|---|---|---|---|---|
| T304 | FR-025, FR-029, FR-047 | T303 | `frontend/src/ui/` | início inelegível, limite, progresso |
| T305 | FR-041, FR-048 | T304 | `frontend/src/ui/` | teclado e foco no Item seguinte |
| T306 | FR-049 | T305 | `frontend/src/ui/` | regiões ativas |
| T307 | FR-042, FR-046 | T304 | UI, `e2e/` | português e viewport estreito |
| T308 | SC-002, SC-004, SC-007, SC-008, SC-010, SC-013, SC-015 | T306, T307 | `e2e/` | navegador real |

## Rastreabilidade

| Requisito | Tarefa |
|---|---|
| FR-025, FR-027 a FR-031 | T301 |
| FR-032 a FR-037 | T302 |
| FR-038, FR-039 | T303 |
| FR-041, FR-048 | T305 |
| FR-042, FR-046 | T307 |
| FR-047 | T304 |
| FR-049 | T306 |

