# Tasks: Criar Cartão

**Input**: `spec.md`, `plan.md`

**Executor**: pelo **Princípio XI**, todo código sob `backend/`, `frontend/` e
`e2e/` é criado por subagentes DeepSeek. Cada tarefa é autocontida e não exige
que o worker decida requisito, arquitetura ou termo de domínio.

## Formato

Cada tarefa declara objetivo observável, requisitos rastreados, dependências,
Module e Interface afetados, áreas de arquivo, skill aplicável, testes exigidos,
condição objetiva de conclusão e paralelismo seguro.

`[P]` = paralelizável: arquivos disjuntos, sem dependência mútua.

O estado de cada tarefa é a **caixa de seleção**: `- [ ]` pendente, `- [X]`
concluída. É esse marcador que o comando `implement` do Spec Kit lê e atualiza.
Os metadados exigidos pelo processo ficam na tabela recolhida de cada fase.

</details>

---

## Fase 1 — Fundação

- [X] T001 [P] Projeto backend executa e responde a um comando de verificação
- [X] T002 [P] Projeto frontend executa e responde a um comando de verificação
- [X] T003 [P] Harness e2e abre navegador real
- [X] T004 Tabela `cartao` criada na primeira execução, com as restrições de conteúdo

<details><summary>Metadados das tarefas desta fase</summary>


Dependência técnica real desta feature, não tarefa horizontal: cada item é
verificável isoladamente.

| ID | P | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|---|
| T001 | [P] | Projeto backend executa e responde a um comando de verificação | — | — | — | `backend/` | — | Suíte roda e passa com zero testes | `npm test` e `npm run dev` funcionam |
| T002 | [P] | Projeto frontend executa e responde a um comando de verificação | — | — | — | `frontend/` | — | Idem | `npm test` e `npm run dev` funcionam |
| T003 | [P] | Harness e2e abre navegador real | — | — | — | `e2e/` | — | Um teste trivial de navegação passa | `npm run test:e2e` passa |
| T004 | | Tabela `cartao` criada na primeira execução, com as restrições de conteúdo | FR-002, FR-051, FR-052 | T001 | `Acervo` (Seam interna) | `backend/src/acervo/esquema.ts` | `codebase-design` | Abrir base em memória e verificar que `CHECK` recusa Frente vazia, só de espaços e com 1001 caracteres | As três recusas comprovadas por teste |

</details>

---

## Fase 2 — Criar e listar Cartão

- [X] T005 `Acervo` cria Cartão pela sua Interface, recusando conteúdo inválido
- [X] T006 `Acervo` lista Cartões, inclusive dois com a mesma Frente
- [X] T007 Rotas `POST /cartoes` e `GET /cartoes` respondem conforme o contrato
- [X] T008 `ClienteDoAcervo` funciona com dois Adapters
- [X] T009 Telas de lista e criação, com estado vazio e aviso de limite
- [X] T010 Falha de gravação é reportada e o conteúdo digitado é preservado

<details><summary>Metadados das tarefas desta fase</summary>


| ID | P | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|---|
| T005 | | `Acervo` cria Cartão pela sua Interface, recusando conteúdo inválido | FR-001, FR-002, FR-009, FR-051, FR-052 | T004 | `Acervo` · `criarCartao` | `backend/src/acervo/` | `domain-modeling` | Criação válida; Frente vazia; Verso vazio; Frente só de espaços; Frente com 1001 caracteres; propriedade extra ignorada e ausente das leituras | Seis testes passam, nenhum inspeciona tabela |
| T006 | | `Acervo` lista Cartões, inclusive dois com a mesma Frente | FR-003, FR-004 | T005 | `Acervo` · `listarCartoes` | `backend/src/acervo/` | `domain-modeling` | Lista vazia; lista com dois Cartões de Frente idêntica, ambos presentes | A Frente não é tratada como identificador |
| T007 | | Rotas `POST /cartoes` e `GET /cartoes` respondem conforme o contrato | FR-046 | T006 | Adapter HTTP sobre `Acervo` | `backend/src/http/` | `codebase-design` | Teste de contrato por rota, com os quatro códigos de erro e mensagem em português | Todos os códigos do contrato cobertos |
| T008 | | `ClienteDoAcervo` funciona com dois Adapters | FR-044 | T007, T002 | `ClienteDoAcervo` (Seam) | `frontend/src/acervo-cliente/` | `codebase-design` | A mesma bateria roda contra `ClienteHttp` e `ClienteEmMemoria`, com resultados idênticos | Dois Adapters passam no mesmo conjunto |
| T009 | | Telas de lista e criação, com estado vazio e aviso de limite | FR-003, FR-043, FR-046, FR-053 | T008 | `ClienteDoAcervo` | `frontend/src/ui/` | — | Lista vazia orienta a primeira ação; aviso de limite aparece durante a digitação; criação válida aparece na lista | Nenhuma regra de domínio replicada na tela |
| T010 | | Falha de gravação é reportada e o conteúdo digitado é preservado | FR-044, FR-045 | T009 | `ClienteDoAcervo` | `frontend/src/` | — | Com a API indisponível, a criação não aparece concluída e o texto permanece | Nenhuma perda de conteúdo |

</details>

---

## Fase 3 — Acessibilidade, responsividade e validação final

- [X] T011 Criar Cartão e navegar a lista apenas por teclado, com foco visível
- [X] T012 Erros e estado vazio perceptíveis por leitor de tela
- [X] T013 [P] As telas são utilizáveis em largura de telefone
- [X] T014 Os Cartões sobrevivem a fechar e reabrir a aplicação

<details><summary>Metadados das tarefas desta fase</summary>


| ID | P | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|---|
| T011 | | Criar Cartão e navegar a lista apenas por teclado, com foco visível | FR-054, FR-055 · SC-017 | T009 | — | `frontend/src/ui/` | — | Percurso do primeiro campo ao salvamento só por teclado; numa recusa, o foco vai ao campo a corrigir; indicador de foco não depende de cor | Asserções de teclado e foco passam |
| T012 | | Erros e estado vazio perceptíveis por leitor de tela | FR-056 | T011 | — | `frontend/src/ui/` | — | Nome, papel e estado acessíveis asseverados; mensagem de erro anunciada | Asserções de semântica passam |
| T013 | [P] | As telas são utilizáveis em largura de telefone | FR-042 · SC-011 | T009 | — | `frontend/src/ui/` | — | Sem rolagem horizontal em viewport estreita, com 50 Cartões na lista | Verificado em navegador real |
| T014 | | Os Cartões sobrevivem a fechar e reabrir a aplicação | FR-040 · SC-003 | T010 | — | `e2e/` | — | Criar dois Cartões, reiniciar ambos os processos, conferir que persistem | Teste e2e passa |

---

## Dependências e Ordem

```
T001 [P] T002 [P] T003
   └─ T004 → T005 → T006 → T007 → T008 → T009 → T010 → T014
                                            ├─ T011 → T012
                                            └─ T013 [P]
```

**Paralelismo seguro**: T001, T002 e T003 entre si, por serem três projetos
independentes; T013 com T011 e T012, por tocarem asserções disjuntas. Tudo o
mais é sequencial, e a execução é **serial por padrão**.

## Matriz de Rastreabilidade Requisito ↔ Tarefa

Exigida pelo **Princípio IX**. Todo requisito aparece em ao menos uma tarefa, e
toda tarefa rastreia ao menos um requisito.

| Requisito | Tarefa |
|---|---|
| FR-001 | T005 |
| FR-002 | T004, T005 |
| FR-003 | T006, T009 |
| FR-004 | T006 |
| FR-009 | T005 |
| FR-040 | T014 |
| FR-042 | T013 |
| FR-043 | T009 |
| FR-044 | T008, T010 |
| FR-045 | T010 |
| FR-046 | T007, T009 |
| FR-051 | T004, T005 |
| FR-052 | T004, T005 |
| FR-053 | T009 |
| FR-054 | T011 |
| FR-055 | T011 |
| FR-056 | T012 |

| Critério | Tarefa |
|---|---|
| SC-001 | T009 |
| SC-003 | T014 |
| SC-011 | T013 |
| SC-012 | T010 |
| SC-016 | T004, T005 |
| SC-017 | T011 |

## Notas

- Nenhuma tarefa exige decisão de produto ou arquitetura do worker. Ambiguidade
  encontrada é reportada, não resolvida.
- Nenhuma tarefa introduz Seam ou Adapter novo: a única Seam, `ClienteDoAcervo`,
  já está justificada em `plan.md`, e T008 apenas a materializa.
- Nenhuma tarefa cria tabela de outra feature. `baralho` e `vinculo` pertencem a
  `002` e `003`.
- Toda tarefa tem teste ou verificação observável.
