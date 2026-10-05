# Tasks: Agendamento de estudo

**Status**: Implementação autorizada pelo Product Owner em 2026-10-03 (branch `implementacao-016-018`), após o portão `/speckit-analyze` de 2026-10-03 sem CRITICAL.

**Input**: spec.md, plan.md, research.md, data-model.md e contracts/api-agenda.md.
**Tests**: obrigatórios pela constituição e critérios da spec; cada tarefa de código inclui teste observável.
**Organization**: fases por história, com requisitos explicitamente rastreados.

## Phase 1: Setup

- [X] T1601 Conferir contratos e portão de análise em specs/016-agendamento-de-estudo/plan.md e contracts/api-agenda.md. Requisitos: FR-222–FR-256.

## Phase 2: Foundational

- [X] T1602 Adicionar tipos/Porta e migração 8 em backend/src/armazenamento/porta.ts e sqlite/postgresql/migracoes.ts; testar upgrade preservando dados. Requisitos: FR-248, FR-250.
  - Restrições literais do data-model: `dias` = inteiros únicos 1=segunda … 7=domingo, ao menos um; `quantidade` = `null` (Todos os Cartões) ou inteiro 1..999; `estado` da Rotina ∈ `ativa|pausada|excluida` (excluída é tombstone); `versao` positiva de concorrência; versões da configuração com data civil de início; `operacaoId` com resultado guardado para reenvio idempotente.
  - Compromisso: no máximo um por Rotina + data `YYYY-MM-DD` dentro do dono (unicidade também no banco); `registroId` opcional, primeiro Registro confirmado, imutável. Persistir só exceções (cancelado) e conclusões; ocorrências comuns são projetadas.
  - Início de Compromisso: id aleatório gerado no servidor, usuarioId, rotinaId, data, iniciadoEm, fuso, baralhoId, nomeDoBaralho, quantidade efetiva e Cartões selecionados com Frente/Verso capturados; sem Avaliações intermediárias.
  - FK de Baralho MUST NOT apagar a programação: excluir o Baralho deixa a Rotina indisponível (sem `ON DELETE CASCADE` para `baralho`).
  - Índices por dono para a consulta da semana (SC-102).
  - Restrição da 017 (data-model, seção "Restrição vinda da 017"): toda tabela da Agenda com dados de um Usuário MUST ter `REFERENCES usuario(id) ON DELETE CASCADE`, direto ou pela cadeia de chaves estrangeiras, nos dois Adapters; o teste prova que excluir um Usuário remove a Agenda dele e preserva a de outro.
- [X] T1603 Adicionar Module Agenda em backend/src/agenda/agenda.ts e tipos.ts, composição Acervo e tipos de cliente em frontend/src/acervo-cliente/cliente.ts. Fundação para FR-222–FR-256; o comportamento aceito é verificado nas tarefas T1604–T1623.
  - Tipos públicos exatamente como em contracts/api-agenda.md (`RotinaDeEstudo`, `CompromissoDeEstudo`, `SemanaDaAgenda`, `InicioDeCompromisso`); sem `usuarioId` público e sem JSON de versões. Datas civis `YYYY-MM-DD` validadas estritamente (rejeitar 31/02) e fuso IANA validado; hoje derivado no servidor nesse fuso.

## Phase 3: User Story 1 — Programar estudo

**Independent Test**: executar a história correspondente de spec.md com dados preparados pela Interface pública; não depende de concluir outras histórias pela UI.

- [X] T1604 [US1] Testar criação, quantidade, dias, overlap e reenvio em backend/tests/agenda/agenda.test.ts. Requisitos: FR-222–FR-226, FR-249, FR-251, SC-095.
- [X] T1605 [US1] Implementar operações de Rotina e HTTP em backend/src/agenda/agenda.ts e backend/src/http/rotas.ts. Requisitos: FR-222–FR-226.
  - `POST /agenda/rotinas` responde **201** ao criar e **200** nas demais ações e no reenvio idempotente. Toda rota nova entra em `registrarRotasDaAplicacao` **e** na lista de pré-flight CORS de `criarServidor`, com o teste de paridade e o teste-guarda de CORS atualizados.
- [X] T1606 [US1] Implementar formulário em frontend/src/ui/PaginaDaAgenda.tsx e testes frontend/tests/agenda.test.tsx; registrar a rota `#/agenda/nova` em frontend/src/ui/navegacao.ts e Aplicacao.tsx. Requisitos: FR-222–FR-226, FR-241, FR-242, SC-095.

## Phase 4: User Story 2 — Acompanhar semana

**Independent Test**: executar a história correspondente de spec.md com dados preparados pela Interface pública; não depende de concluir outras histórias pela UI.

- [X] T1607 [US2] Testar projeção/estados/totais e janela em backend/tests/agenda/agenda.test.ts. Requisitos: FR-227–FR-230, FR-240, FR-241, SC-096.
- [X] T1608 [US2] Implementar projeção semanal e rota GET em backend/src/agenda/agenda.ts e backend/src/http/rotas.ts. Requisitos: FR-227–FR-230, FR-240.
  - `GET /agenda` e `GET /agenda/rotinas` entram em `registrarRotasDaAplicacao` e na lista de pré-flight CORS, com paridade testada.
- [X] T1609 [US2] Implementar bloco/calendário em frontend/src/ui/AgendaDeEstudo.tsx, PaginaDeInicio.tsx e estilos.css; testar navegação e falha em frontend/tests/agenda.test.tsx. Requisitos: FR-227–FR-230, FR-240, FR-241, SC-096.
  - Ver Sessão de um Compromisso concluído navega para o Registro existente (`#/sessoes/:registroId`, `PaginaDoRegistro`).

## Phase 5: User Story 3 — Concluir Compromisso

**Independent Test**: executar a história correspondente de spec.md com dados preparados pela Interface pública; não depende de concluir outras histórias pela UI.

- [X] T1610 [US3] Testar início, snapshot, reenvio, concorrência e rollback em backend/tests/agenda/conclusao.test.ts e testes dos Adapters. Requisitos: FR-231–FR-236, FR-254, FR-256, SC-097, SC-104.
  - Incluir: Todos os Cartões com mais de 1000 Cartões aceito pela Agenda e recusado fora dela; duas conclusões concorrentes do mesmo Usuário produzem Agendamentos coerentes com a ordem serializada.
- [X] T1611 [US3] Implementar autorização e conclusão atômica em backend/src/agenda/agenda.ts, backend/src/acervo/acervo.ts e ambos armazenamento.ts. Requisitos: FR-231–FR-236, FR-254, FR-256.
  - Refinamentos do plan.md: o limite legado de 1000 Itens por Registro (`LIMITE_DE_ITENS_REGISTRADOS`) continua para Registros sem início da Agenda; com `inicioAgendaId`, o máximo válido é o snapshot autorizado. Os Agendamentos dos Cartões são calculados a partir das leituras da **mesma transação**, serializada por Usuário (SQLite com transação imediata; PostgreSQL com bloqueio por Usuário); o reenvio idempotente é detectado antes de recalcular. A Porta recebe uma função de domínio e não expõe conexão, SQL ou driver ao Module.
  - `POST /agenda/inicios` entra em `registrarRotasDaAplicacao` e na lista de pré-flight CORS.
- [X] T1612 [US3] Integrar início autorizado em frontend/src/ui/PaginaDeEstudo.tsx e Aplicacao.tsx; registrar inicioAgendaId e testar em frontend/tests/agenda.test.tsx. Requisitos: FR-231–FR-236, FR-255, FR-256.

## Phase 6: User Story 4 — Segurança e acesso

**Independent Test**: executar a história correspondente de spec.md com dados preparados pela Interface pública; não depende de concluir outras histórias pela UI.

- [X] T1613 [US4] Testar isolamento/entrada inválida/CORS/migração em backend/tests/agenda/http.test.ts e suites armazenamento existentes. Requisitos: FR-248, FR-250, FR-254, SC-100.
- [X] T1614 [US4] Implementar validação HTTP/credencial em backend/src/http/rotas.ts e servidor.ts; Adapters e guarda em frontend/src/acervo-cliente/ e frontend/src/ui/guarda-de-credencial.ts. Requisitos: FR-248–FR-254.
- [X] T1615 [US4] Testar teclado/foco, geometria e 360/390/768/1440px em e2e/agendamento-de-estudo.spec.ts e frontend/tests/agenda.test.tsx. Requisitos: FR-252, FR-253, FR-255, SC-101, SC-103.

## Phase 7: User Story 5 — Gerenciar Rotinas

**Independent Test**: executar a história correspondente de spec.md com dados preparados pela Interface pública; não depende de concluir outras histórias pela UI.

- [X] T1616 [US5] Testar editar/pausar/retomar/excluir/conflito em backend/tests/agenda/agenda.test.ts. Requisitos: FR-237–FR-239, FR-242, FR-249, SC-098.
- [X] T1617 [US5] Implementar versões/CAS/tombstone nos dois Adapters e backend/src/agenda/agenda.ts. Requisitos: FR-237–FR-239, FR-249.
- [X] T1618 [US5] Implementar gerenciamento e confirmações em frontend/src/ui/PaginaDaAgenda.tsx, navegacao.ts, Aplicacao.tsx; testar descarte/conflito em frontend/tests/agenda.test.tsx. Requisitos: FR-237–FR-239, FR-242, FR-249, FR-251.

## Phase 8: User Story 6 — Acervo e datas

**Independent Test**: executar a história correspondente de spec.md com dados preparados pela Interface pública; não depende de concluir outras histórias pela UI.

- [X] T1619 [US6] Testar indisponibilidade, snapshot, meia-noite/fuso/DST e mudança concorrente em backend/tests/agenda/agenda.test.ts e conclusao.test.ts. Requisitos: FR-243–FR-247, SC-099.
- [X] T1620 [US6] Implementar datas civis, atualização de nomes históricos e configuração capturada em backend/src/agenda/agenda.ts e backend/src/acervo/acervo.ts. Requisitos: FR-243–FR-247.
- [X] T1621 [US6] Implementar revalidação de hoje e mensagens de indisponibilidade em frontend/src/ui/AgendaDeEstudo.tsx; testar em frontend/tests/agenda.test.tsx. Requisitos: FR-243–FR-247.

## Phase 9: Polish and validation

- [X] T1622 Testar 100 Rotinas e 2 anos sem leitura de Histórico completo em backend/tests/agenda/desempenho.test.ts. Requisitos: SC-102.
- [X] T1623 Executar E2E real de criação até conclusão/reabertura em e2e/agendamento-de-estudo.spec.ts. Requisitos: FR-222–FR-256, SC-095–SC-104.
- [X] T1624 Executar portões backend/frontend/e2e e revisar diff; registrar evidências em specs/016-agendamento-de-estudo/research.md e na mensagem de commit (Constituição II, v3.0.0). Requisitos: Constituição V, VI, IX, X.
- [X] T1625 Executar converge e registrar cobertura final em specs/016-agendamento-de-estudo/tasks.md, research.md e na mensagem de commit. Requisitos: FR-222–FR-256, SC-095–SC-104.

## Dependencies & Execution Order

Setup → Foundational → histórias P1 → gerenciamento/datas → validação → converge.
Contratos documentais liberam trabalho independente do backend e frontend em
pastas distintas; integração E2E depende dos dois. Não há escrita concorrente
nos mesmos arquivos. Testes de cada história precedem sua implementação.

## Rastreabilidade requisito–teste

Esta matriz declara a tarefa que exercita cada requisito pela Interface
observável. Ela descreve o teste planejado ou executado conforme o marcador da
tarefa; não altera seu estado de conclusão.

| Requisito | Tarefas de teste |
| --- | --- |
| FR-222–FR-226 | T1604, T1606 |
| FR-227–FR-230 | T1607, T1609 |
| FR-231–FR-236 | T1610, T1612 |
| FR-237–FR-239 | T1616, T1618 |
| FR-240 | T1607, T1609 |
| FR-241 | T1606, T1607, T1609 |
| FR-242 | T1606, T1616, T1618 |
| FR-243–FR-247 | T1619, T1621 |
| FR-248 | T1613 |
| FR-249 | T1604, T1616, T1618 |
| FR-250 | T1602, T1613 |
| FR-251 | T1604, T1610, T1618 |
| FR-252–FR-253 | T1615 |
| FR-254 | T1610, T1613 |
| FR-255 | T1612, T1615 |
| FR-256 | T1610, T1612 |
| SC-095 | T1604, T1606 |
| SC-096 | T1607, T1609 |
| SC-097 | T1610 |
| SC-098 | T1616, T1618 |
| SC-099 | T1619, T1621 |
| SC-100 | T1613 |
| SC-101 | T1615 |
| SC-102 | T1622 |
| SC-103 | T1615 |
| SC-104 | T1610, T1612 |

T1623 exercita o percurso integrado de FR-222–FR-256 e SC-095–SC-104; T1624 e
T1625 conferem os portões e a cobertura dessa matriz.

## Parallel Examples

- US1: testes de domínio backend e formulário frontend após contrato fixado.
- US2: projeção backend e desenho do calendário frontend após tipos fixados.
- US3: conclusão transacional backend e consumo do início frontend.
- US4: testes HTTP de isolamento e teclado frontend.
- US5: CAS/persistência backend e diálogos frontend.
- US6: datas/fuso backend e mensagens/atualização frontend.

## Implementation Strategy

Com a implementação autorizada (2026-10-03), workers DeepSeek recebem
um pacote coeso de tarefas e caminhos permitidos;
nenhum worker altera requisitos, faz commit ou declara revisão final. O Arquiteto
só marca tarefa após conferir diff e testes. Começar pelo cadastro/consulta,
acrescentar conclusão e gerenciamento e executar o percurso completo. Não
publicar automaticamente esta branch de trabalho.


## Execução (2026-10-03)

**Resultado**: T1604–T1625 concluídas; T1601–T1603 já estavam. A implementação foi
feita pelo Arquiteto diretamente (workers DeepSeek não estavam disponíveis) e a
aprovação para implementar — inclusive para A-01–A-07 — foi assumida a partir do
pedido explícito do Product Owner de implementar o `PLAN.md` por completo.

**Onde cada requisito é exercitado** (a matriz acima aponta as tarefas; estes são
os arquivos):

| Tarefas | Arquivos de teste |
| --- | --- |
| T1602 | `backend/tests/acervo/migracao-agenda.test.ts`, `backend/tests/armazenamento/bateria-da-porta.ts` |
| T1604, T1607, T1616, T1619 | `backend/tests/agenda/agenda.test.ts` |
| T1610, T1611 | `backend/tests/agenda/conclusao.test.ts` e as novas operações da bateria da Porta |
| T1613, T1614 | `backend/tests/agenda/http.test.ts`, guarda de CORS em `backend/tests/http/cors.test.ts`, paridade em `backend/tests/funcao/funcao.test.ts` |
| T1606, T1609, T1612, T1618, T1621 | `frontend/tests/agenda.test.tsx`, `frontend/tests/agenda-datas.test.ts`, `frontend/tests/acervo-cliente/agenda.test.ts` |
| T1615, T1623 | `e2e/agendamento-de-estudo.spec.ts` |
| T1622 | `backend/tests/agenda/desempenho.test.ts` |

**Desvios e decisões**

- **Porta**: acrescentadas `obterOperacaoDeRotina` (reenvio reconhecido antes de
  qualquer checagem de estado), `cancelamentos`/`reativacoes` em `GravacaoDeRotina`
  (cancelar/reativar o Compromisso de hoje na mesma transação da Rotina) e
  `inserirRegistroDaAgenda` (Registro + Agendamentos calculados sobre o estado
  lido na transação serializada + conclusão do Compromisso).
- **Contrato**: `RotinaDeEstudo.indisponivel` e a rota `#/agenda/estudo` foram
  acrescentados (ver `contracts/api-agenda.md`).
- **Conclusão** (`inicioAgendaId`): `id` do Registro = id do Início; Frente, Verso e
  nome vêm do snapshot do servidor; conjunto de Cartões exatamente o autorizado;
  limite legado de 1000 Itens só fora da Agenda.
- **PostgreSQL**: o Adapter implementa as mesmas operações, mas a bateria não pôde
  ser executada aqui (ver `specs/017-gerenciar-conta-usuario/tasks.md`).

## Phase 10: Convergence

- [X] T1626 Editar rotina: remover o parágrafo genérico do fim de PaginaDoFormularioDeRotina.tsx e, ao Salvar alterações, abrir confirmação contextual (DialogoDeConfirmacao) que resume somente os efeitos da alteração — dias removidos cancelam o pendente de hoje, dias adicionados podem criá-lo, Baralho/quantidade atualizam pendentes, passado e conclusões preservados, exceção de Sessão já iniciada; foco inicial em Cancelar, Escape cancela; provas pelo DOM per FR-238, US5/AC8 (contradicts)
- [X] T1627 Combo-box Baralho do formulário Editar rotina com texto centralizado (`text-align-last`/`text-align: center`), sem mudar nome acessível nem foco; prova de estilo computado em e2e per FR-257, US5/AC8 (missing)
- [X] T1628 Gerenciar agenda: linha e etiqueta «Pausada» com tom âmbar discreto (tokens em estilos.css, contraste ≥ 4.5:1 no texto, rótulo textual mantido); provas pelo DOM e contraste em e2e per FR-237, US5/AC7 (missing)
- [X] T1629 Atualizar e2e/agendamento-de-estudo.spec.ts afetado e rodar `npm run verificar:ci` per T1623–T1624 (partial)
