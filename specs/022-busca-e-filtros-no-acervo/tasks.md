# Tasks: Busca e filtros no acervo

**Input**: `spec.md`, `plan.md`, `data-model.md`, `contracts/http.md`, `contracts/ui.md`, protótipos em `design/busca-e-filtros/`.

**Testes**: obrigatórios pela constituição (Princípios V e IX). Cada tarefa de código inclui as provas que a cobrem.

**Execução**: cada tarefa é delegada a um subagente DeepSeek flash (Princípio XI), com os arquivos que pode alterar; o Arquiteto revisa o diff e executa as verificações.

## Phase 1: Setup

Sem tarefas: nenhuma dependência, configuração ou migração nova.

## Phase 2: Foundational (bloqueia US2 e US3)

- [X] T2201 Acrescentar `proximaRevisaoEm: string | null` a `CartaoListado` e preenchê-lo em `listarCartoes` lendo `armazenamento.listarAgendamentos(usuarioId)` uma única vez, associando por `cartaoId` («`null` quando o Cartão não tem Agendamento»), em backend/src/acervo/acervo.ts; atualizar as provas de `listarCartoes` e de `GET /cartoes` em backend/tests/ e cobrir: Cartão sem Agendamento → `null`; Cartão estudado → ISO da próxima revisão; Agendamentos de outro Usuário não aparecem. FR-352, FR-359.
- [X] T2202 Acrescentar `proximaRevisaoEm: string | null` a `CartaoListado` em frontend/src/acervo-cliente/cliente.ts; ler e validar o campo (string ou `null`; ausente ou de outro tipo → resposta fora do contrato) em `lerCartaoListado` de frontend/src/acervo-cliente/cliente-http.ts; preenchê-lo a partir dos Agendamentos do dono em `listarCartoes` de frontend/src/acervo-cliente/cliente-em-memoria.ts; ajustar os duplos e provas de frontend/tests/ que constroem `CartaoListado`. FR-352, FR-359.
- [X] T2203 [P] Criar o Module puro frontend/src/acervo-cliente/busca-no-acervo.ts com `filtrarBaralhos`, `filtrarCartoes` e `situacaoDaRevisao`, conforme data-model.md («NFD, remoção das marcas diacríticas, minúsculas; a consulta é aparada»; `sem-baralho` = `baralhos` vazio; dia local pelos componentes locais de `Date`; ordem recebida preservada), e frontend/tests/busca-no-acervo.test.ts cobrindo acento/capitalização/espaços, consulta vazia, Verso, combinação dos três critérios, Cartão em dois Baralhos sem duplicar, Cartões com a mesma Frente continuam distintos, Sem baralho, e ontem/hoje (horário futuro)/amanhã/sem Agendamento. FR-349–FR-353, SC-139, SC-140.

## Phase 3: User Story 1 — Encontrar Baralhos (P1)

**Goal**: buscar Baralhos pelo nome. **Independent Test**: com «Álgebra linear», buscar `algebra` e ver o Baralho com Estudar e Editar.

- [X] T2204 [US1] Painel `.filtros.filtros--busca-unica` com «Buscar baralhos», faixa `.resultado-cabecalho` (contagem `role="status"` e Limpar filtros) e estado «Nenhum resultado encontrado», conforme contracts/ui.md, usando `filtrarBaralhos`, em frontend/src/ui/PaginaDeBaralhos.tsx; acrescentar `.filtros`, `.filtros--busca-unica`, `.resultado-cabecalho` e as media queries de contracts/ui.md em frontend/src/estilos.css; provas em frontend/tests/pagina-de-baralhos.test.tsx: busca normalizada, contagem singular/plural, sem resultados com Limpar filtros, Limpar restaura e foca a busca, ações Estudar/Editar preservadas, com o mesmo destino, durante a busca, falha e nova tentativa preservando a consulta. FR-348, FR-350, FR-354–FR-358.

## Phase 4: User Story 2 — Encontrar Cartões combinando critérios (P1)

**Goal**: busca na Frente ou no Verso, filtro por Baralho e por situação. **Independent Test**: combinar os três critérios sobre Cartões com Vínculos e Agendamentos diferentes.

- [X] T2205 [US2] Painel com «Buscar cartões», «Baralho» (Todos · Sem baralho · Baralhos de `listarBaralhos`) e «Situação da revisão» (Todos · Novos · Revisão pendente · Em dia), faixa de contagem e estado sem resultados, conforme contracts/ui.md, usando `filtrarCartoes` com `new Date()`, em frontend/src/ui/PaginaDeCartoes.tsx. Ler Cartões e Baralhos juntos; falha de qualquer leitura é falha da página. Se o Baralho selecionado deixar de existir numa recarga, o seletor volta a Todos. Provas em frontend/tests/pagina-de-cartoes.test.tsx: Verso encontra sem exibir o Verso, combinação dos três critérios, Sem baralho, situação, Limpar filtros. FR-349, FR-351–FR-356.

## Phase 5: User Story 3 — Recuperação e acessibilidade (P1)

**Goal**: critérios preservados em falha e exclusão, anúncio sem mover o foco. **Independent Test**: falha → Tentar novamente; excluir com filtros ativos; uso por teclado.

- [X] T2206 [US3] Em frontend/src/ui/PaginaDeCartoes.tsx: Tentar novamente preserva os critérios; excluir com filtros ativos mantém os critérios e atualiza a contagem; o foco segue indo ao título da página, como já fazia; digitar na busca não move o foco. Provas em frontend/tests/pagina-de-cartoes.test.tsx. FR-357, FR-358, SC-141.
- [X] T2207 [US3] E2E com API real em e2e/busca-e-filtros.spec.ts: Baralhos (`algebra`), Cartões (Verso, combinação, Sem baralho, situação Novos/Em dia depois de estudar, Limpar filtros, sem resultados) e isolamento entre dois Usuários. SC-138, SC-139, SC-140, FR-359.
- [X] T2208 [US3] Responsividade e teclado em e2e/busca-e-filtros-responsividade.spec.ts: 360, 390, 768 e 1440 px e zoom de 200%, sem rolagem horizontal, alvos de 44 px, busca, filtros e Limpar só por teclado, contagem anunciada sem tirar o foco da busca. SC-142, FR-358.

## Phase 6: Polish & Cross-Cutting

- [X] T2209 Ajustar provas e2e existentes que dependam da estrutura das páginas de Baralhos e Cartões (e2e/lista-de-baralhos.spec.ts, e2e/cartoes-responsividade.spec.ts, e2e/baralhos-responsividade.spec.ts e outras que falharem), sem afrouxar asserções.
- [X] T2210 Verificação final: `npm run verificar:ci`; atualizar README.md e README.pt-BR.md (tabela de capacidades) e registrar o resultado em research.md.

## Dependencies & Execution Order

- T2201 → T2202 (contrato) → T2205, T2206, T2207.
- T2203 é independente e paralelo a T2201/T2202; bloqueia T2204–T2206.
- US1 (T2204) depende só de T2203; US2 (T2205) depende de T2202 e T2203; US3 depende de US2.
- T2209 e T2210 por último.

## Parallel Opportunities

- T2203 [P] em paralelo a T2201.
- T2204 (Baralhos) em paralelo a T2202, porque não toca o contrato de Cartões.

## Implementation Strategy

MVP: T2203 + T2204 (busca de Baralhos). Em seguida, o contrato (T2201–T2202) e Cartões (T2205–T2206), depois e2e e polimento. Cada tarefa vira um commit coeso após revisão e verificação.

## Rastreabilidade

| Requisito | Tarefas | Provas |
|---|---|---|
| FR-348 | T2204 | pagina-de-baralhos.test.tsx, busca-e-filtros.spec.ts |
| FR-349 | T2203, T2205 | busca-no-acervo.test.ts, pagina-de-cartoes.test.tsx |
| FR-350 | T2203, T2204 | busca-no-acervo.test.ts, pagina-de-baralhos.test.tsx |
| FR-351 | T2203, T2205 | busca-no-acervo.test.ts, pagina-de-cartoes.test.tsx, busca-e-filtros.spec.ts |
| FR-352 | T2201–T2203, T2205 | testes de backend de /cartoes, busca-no-acervo.test.ts, busca-e-filtros.spec.ts |
| FR-353 | T2203, T2205 | busca-no-acervo.test.ts, pagina-de-cartoes.test.tsx |
| FR-354 | T2204, T2205 | pagina-de-baralhos.test.tsx, pagina-de-cartoes.test.tsx |
| FR-355 | T2204, T2205 | idem |
| FR-356 | T2204, T2205 | idem (ações preservadas) |
| FR-357 | T2204, T2206 | pagina-de-cartoes.test.tsx, excluir-cartao.test.tsx |
| FR-358 | T2204, T2206, T2208 | testes de página, busca-e-filtros-responsividade.spec.ts |
| FR-359 | T2201, T2202, T2207 | testes de backend, busca-e-filtros.spec.ts |
| SC-138–SC-142 | T2207, T2208 | e2e |
