# Tasks: MVP de Estudo por Flashcards

**Input**: `spec.md`, `plan.md`, `data-model.md`, `contracts/api-acervo.md`, `research.md`, `quickstart.md`

**Prerequisites**: plan.md aprovado; constituição 2.1.0; glossário em `CONTEXT.md`

**Executor**: pelo **Princípio XI**, todo código sob `backend/`, `frontend/` e
`e2e/` é criado por subagentes DeepSeek. Cada tarefa abaixo é autocontida e não
exige que o worker decida requisito, arquitetura ou termo de domínio.

## Formato

Cada tarefa declara: objetivo observável, requisitos e critérios rastreados,
dependências, Module e Interface afetados, áreas de arquivo, skill aplicável,
testes exigidos, condição objetiva de conclusão e se pode rodar em paralelo.

`[P]` = paralelizável com segurança: arquivos disjuntos, sem dependência mútua.

**Skill aplicável**: `domain-modeling` quando a tarefa toca linguagem de domínio
ou invariante; `codebase-design` quando toca Interface, Seam ou Adapter.

---

## Fase 1 — Fundação (bloqueia tudo)

Nenhuma história pode começar antes desta fase. Não é tarefa horizontal
disfarçada: é dependência técnica real, e cada item é verificável isoladamente.

| ID | P | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|---|
| T001 | [P] | Projeto backend executa e responde a um comando de verificação | — | — | — | `backend/` | — | Comando de teste roda e passa com zero testes | `npm test` e `npm run dev` funcionam |
| T002 | [P] | Projeto frontend executa e responde a um comando de verificação | — | — | — | `frontend/` | — | Idem | `npm test` e `npm run dev` funcionam |
| T003 | [P] | Harness e2e abre um navegador real | — | — | — | `e2e/` | — | Um teste trivial de navegação passa | `npm run test:e2e` passa |
| T004 | | Esquema SQLite criado na primeira execução, com integridade referencial ativa | Invariantes 1–4, 14, 15 | T001 | `Acervo` (Seam interna) | `backend/src/acervo/esquema.ts` | `codebase-design` | Teste que abre base em memória, insere Vínculo e verifica que a cascata remove só o Vínculo | `PRAGMA foreign_keys` ativo verificado por teste; cascata comprovada nos dois sentidos |

**Checkpoint**: fundação pronta. As histórias podem começar.

---

## Fase 2 — História 1: Registrar conteúdo e torná-lo estudável (P1)

**Objetivo**: ao final, existe um Baralho elegível e ele sobrevive ao fechamento
da aplicação.

| ID | P | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|---|
| T005 | | `Acervo` cria e lista Cartão, recusando vazio e excesso de tamanho | FR-001, FR-002, FR-003, FR-004, FR-051, FR-052 | T004 | `Acervo` · `criarCartao`, `listarCartoes` | `backend/src/acervo/` | `domain-modeling` | Pela Interface, com SQLite em memória: criação válida; Frente vazia; Frente só de espaços; Frente com 1001 caracteres | Os quatro testes passam e nenhum inspeciona tabela |
| T006 | [P] | `Acervo` cria, lista e renomeia Baralho, expondo elegibilidade derivada | FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-024, FR-052 | T004 | `Acervo` · `criarBaralho`, `listarBaralhos`, `obterBaralho`, `renomearBaralho` | `backend/src/acervo/` | `domain-modeling` | Nome vazio recusado; nome com 101 caracteres recusado; dois Baralhos homônimos aceitos; Baralho sem Cartão reportado não elegível | Elegibilidade nunca lida de coluna persistida |
| T007 | | `Acervo` vincula e desvincula, recusando duplicata | FR-019, FR-020, FR-021, FR-022, FR-023 | T005, T006 | `Acervo` · `vincular`, `desvincular` | `backend/src/acervo/` | `domain-modeling` | Vínculo criado torna Baralho elegível; segundo Vínculo idêntico recusado; desvincular preserva ambos; Cartão em 20 Baralhos e Baralho com 60 Cartões aceitos | Recusa de duplicata vem do esquema, não de verificação prévia em código |
| T008 | | Rotas HTTP de Cartão, Baralho e Vínculo respondem conforme o contrato | FR-023, FR-046; contrato | T007 | Adapter HTTP sobre `Acervo` | `backend/src/http/` | `codebase-design` | Teste de contrato por rota, incluindo 409 em Vínculo duplicado e 400 com código de erro e mensagem em português | Todos os códigos de erro do contrato cobertos |
| T009 | | `ClienteDoAcervo` funciona com dois Adapters | FR-044 | T008 | `ClienteDoAcervo` (Seam) | `frontend/src/acervo-cliente/` | `codebase-design` | A mesma bateria roda contra `ClienteHttp` e `ClienteEmMemoria`, com resultados idênticos | Dois Adapters passam no mesmo conjunto de testes |
| T010 | | Telas de lista e criação de Cartão e Baralho, com estado vazio | FR-003, FR-013, FR-043, FR-046, FR-053 | T009 | `ClienteDoAcervo` | `frontend/src/ui/` | — | Lista vazia orienta a primeira ação; aviso de limite aparece durante a digitação | Nenhuma regra de domínio replicada na tela |
| T011 | | O acervo sobrevive a fechar e reabrir a aplicação | FR-040 · SC-003 | T010 | — | `e2e/` | — | Criar Cartão, Baralho e Vínculo; reiniciar; conferir que tudo persiste e o Baralho está elegível | Teste e2e passa |

**Checkpoint**: História 1 demonstrável de ponta a ponta.

---

## Fase 3 — História 2: Estudar um baralho e ver o resultado (P1)

| ID | P | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|---|
| T012 | [P] | `Aleatoriedade` embaralha, com Adapter determinístico para teste | FR-030 | T002 | `Aleatoriedade` (Seam) · `embaralhar` | `frontend/src/aleatoriedade/` | `codebase-design` | A saída é permutação da entrada; o Adapter determinístico produz a mesma ordem para a mesma semente | Dois Adapters existentes e testados |
| T013 | | `iniciar` monta a Sessão com quantidade limitada, sem repetição e em ordem fixa | FR-027, FR-028, FR-029, FR-030, FR-031 | T012 | `SessaoDeEstudo` · `iniciar` | `frontend/src/sessao/` | `codebase-design` | Quantidade 0 recusada; solicitar 50 com 12 disponíveis produz 12; nenhum Cartão repetido; ordem imutável após iniciar | Testes usam Aleatoriedade determinística; nenhum toca I/O |
| T014 | | `revelar`, `responder` e `estado` implementam a máquina de estados do Item | FR-032, FR-033, FR-034, FR-035, FR-036, FR-037, FR-047 | T013 | `SessaoDeEstudo` · `revelar`, `responder`, `estado` | `frontend/src/sessao/` | `codebase-design` | `estado` omite o Verso antes da Revelação; `responder` sem revelar é recusado; segundo `responder` recusado; Resumo só no fim, com `acertos + erros = estudados`; posição e total sempre presentes | Nenhum teste inspeciona campo interno da Sessão |
| T015 | | O servidor recusa iniciar estudo de Baralho não elegível | FR-025, FR-026 | T008 | Adapter HTTP sobre `Acervo` · `obterCartoesParaEstudo` | `backend/src/http/` | — | Baralho sem Cartão responde 409 `baralho_nao_elegivel` | Elegibilidade verificada no servidor, não só na tela |
| T016 | | Tela da Sessão exibe frente, revela verso, registra resultado e mostra progresso e resumo | FR-032, FR-033, FR-035, FR-037, FR-047 | T014, T015 | `SessaoDeEstudo` | `frontend/src/ui/` | — | Percurso completo de 3 itens com resumo correto; posição e total visíveis | Nenhuma regra de sessão replicada na tela |
| T017 | | A Sessão é operável só por teclado, com foco visível e mudanças anunciadas | FR-041, FR-048, FR-049 · SC-013 | T016 | — | `frontend/src/ui/` | — | Teclas dedicadas para revelar, acertou e errou; foco movido ao avançar; nome, papel e estado acessíveis asseverados | Asserções de acessibilidade passam |
| T018 | | Sessão inteira percorrida por teclado em navegador real, e nada dela sobrevive | FR-038, FR-039 · SC-007, SC-008 | T017 | — | `e2e/` | — | Percurso só por teclado até o resumo; interromper no meio e conferir ausência de vestígio ao reabrir | Dois testes e2e passam |

**Checkpoint**: o produto cumpre seu propósito.

---

## Fase 4 — História 3: Corrigir e descartar conteúdo (P2)

| ID | P | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|---|
| T019 | | `Acervo` edita e exclui Cartão e Baralho sem cascatear entre entidades | FR-005, FR-007, FR-008, FR-016, FR-017 | T007 | `Acervo` · `editarCartao`, `excluirCartao`, `excluirBaralho` | `backend/src/acervo/` | `domain-modeling` | Editar Cartão vale nos Baralhos onde está; excluir Cartão preserva Baralhos; excluir Baralho preserva Cartões; Baralho perde elegibilidade ao perder o último Cartão | Nenhuma exclusão atravessa de uma entidade para a outra |
| T020 | | Rotas de edição e exclusão respondem conforme o contrato | Contrato | T019 | Adapter HTTP sobre `Acervo` | `backend/src/http/` | — | Teste de contrato por rota, incluindo 404 | Contrato satisfeito |
| T021 | | Telas de edição e confirmação honesta de exclusão | FR-006, FR-007, FR-016 · SC-005, SC-006 | T020, T010 | `ClienteDoAcervo` | `frontend/src/ui/` | — | Edição informa em quantos Baralhos o Cartão está; confirmação de exclusão de Baralho informa quantos Cartões sobrevivem; recusar a confirmação não exclui nada | Cartão sem Baralho permanece alcançável pela lista |
| T022 | | Sair de uma edição com alterações não salvas exige confirmação | FR-050 · SC-014 | T021 | — | `frontend/src/ui/` | — | Confirmação pedida; ao recusar, a edição segue aberta com o conteúdo intacto | Nenhuma alteração descartada silenciosamente |

---

## Fase 5 — Transversal

| ID | P | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|---|
| T023 | | Falha de gravação é reportada e o conteúdo digitado é preservado | FR-044, FR-045 · SC-012 | T021 | `ClienteDoAcervo` | `frontend/src/` | — | Com armazenamento indisponível, a operação não aparece concluída e o texto permanece | Nenhuma perda de conteúdo em falha |
| T024 | [P] | As telas são utilizáveis em largura de telefone | FR-042 | T016, T021 | — | `frontend/src/ui/` | — | Sem rolagem horizontal em viewport estreita, incluindo a tela da Sessão | Verificado em navegador real |
| T025 | [P] | Os requisitos negativos são verificados | FR-009, FR-018, FR-022, FR-036, FR-038 | T014, T019 | `Acervo`, `SessaoDeEstudo` | `backend/tests/`, `frontend/tests/` | `domain-modeling` | Conforme a tabela **Verificação dos Requisitos Negativos** da spec | Os seis requisitos têm teste correspondente |
| T026 | | O roteiro de `quickstart.md` passa integralmente | Todos | T023, T024, T025 | — | — | — | Execução completa do roteiro | Nenhum passo falha |

---

## Dependências e Ordem de Execução

```
Fase 1 (T001–T004)  →  Fase 2 (T005–T011)  →  Fase 3 (T012–T018)
                                            →  Fase 4 (T019–T022)
                                            →  Fase 5 (T023–T026)
```

- **Fase 1 bloqueia tudo.** T001, T002 e T003 são mutuamente paralelos; T004
  depende de T001.
- **Fase 2 é pré-requisito real das Fases 3 e 4**, não sequenciamento por
  conveniência: sem Acervo e sem cliente não há Cartão a estudar nem a editar.
- **Fases 3 e 4 podem correr em paralelo** depois da Fase 2, por tocarem
  Modules e arquivos disjuntos. T012 pode inclusive começar logo após T002, por
  não depender do Acervo.
- **T026 é a última**, por definição.

### Paralelismo seguro

| Grupo | Tarefas | Por que é seguro |
|---|---|---|
| Fundação | T001, T002, T003 | Três projetos independentes |
| Início da Fase 2 | T006 paralelo a T005 | Baralho e Cartão são agregados independentes até o Vínculo |
| Aleatoriedade | T012 | Nenhuma dependência do Acervo |
| Polimento | T024, T025 | Arquivos disjuntos |

Tudo o mais é sequencial. **T005 e T007 não são paralelos**: o Vínculo depende
das duas entidades existirem.

---

## Matriz de Rastreabilidade Requisito ↔ Tarefa

Exigida pelo **Princípio IX**. Todo requisito funcional aparece em ao menos uma
tarefa, e toda tarefa rastreia ao menos um requisito.

| Requisitos | Tarefa |
|---|---|
| FR-001, FR-002, FR-003, FR-004, FR-051, FR-052 | T005 |
| FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-024, FR-052 | T006 |
| FR-019, FR-020, FR-021, FR-022, FR-023 | T007 |
| FR-023, FR-046 | T008 |
| FR-044 | T009, T023 |
| FR-043, FR-046, FR-053 | T010 |
| FR-040 | T011 |
| FR-030 | T012, T013 |
| FR-027, FR-028, FR-029, FR-031 | T013 |
| FR-032, FR-033, FR-034, FR-035, FR-036, FR-037, FR-047 | T014 |
| FR-025, FR-026 | T015 |
| FR-041, FR-048, FR-049 | T017 |
| FR-038, FR-039 | T018, T025 |
| FR-005, FR-007, FR-008, FR-016, FR-017 | T019 |
| FR-006 | T021 |
| FR-050 | T022 |
| FR-045 | T023 |
| FR-042 | T024 |
| FR-009, FR-018, FR-022, FR-036 | T025 |

| Critérios de sucesso | Tarefa |
|---|---|
| SC-001, SC-002 | T013, T016 |
| SC-003 | T011 |
| SC-004 | T014 |
| SC-005, SC-006 | T021 |
| SC-007 | T018 |
| SC-008 | T018 |
| SC-009 | T007, T008 |
| SC-010 | T013 |
| SC-011 | T024 |
| SC-012 | T023 |
| SC-013 | T017 |
| SC-014 | T022 |
| SC-015 | T014 |
| SC-016 | T005, T006 |

---

## Notas

- Nenhuma tarefa exige que o worker decida requisito, arquitetura ou termo de
  domínio. Ambiguidade encontrada é reportada, não resolvida pelo worker.
- Nenhuma tarefa introduz Seam ou Adapter novo: as duas Seams — Aleatoriedade e
  ClienteDoAcervo — já estão justificadas em `plan.md`, e T012 e T009 apenas as
  materializam.
- Nenhuma tarefa depende de Interface não decidida: as quatro Interfaces estão
  especificadas em `plan.md`.
- Toda tarefa tem teste ou verificação observável. A Interface é a superfície de
  teste; `e2e/` só aparece onde navegador real é indispensável.
- A terminologia segue `CONTEXT.md`. Nenhum sinônimo de `_Avoid_` é usado.
