# Research e auditoria — 021

## 2026-10-04 — intenção e autorização
Fonte: pedido do Usuário "Implemente o plano atual novo, com deepseek". Tomado como autorização para plan/tasks e implementação da spec 021, com delegação ao DeepSeek flash (MCP `delegate`).
Linha de base do frontend: 15 testes vermelhos herdados do WIP da 020 (Minha conta/renomeação, navegação «Preferências», endereço da API de produção); não pertencem a esta spec.

## 2026-10-04 — plan, tasks e analyze
plan.md e tasks.md escritos pelo Arquiteto. Analyze por leitura: 9 FRs (FR-339–347) e 4 SCs com tarefa e teste vinculados; zero CRITICAL. Sem migração, API ou entidade nova.

## 2026-10-04 — implementação (DeepSeek flash via MCP `delegate`)
- T2101/T2102: componentes gerados pelo DeepSeek, revisados e aplicados (nome do Baralho em texto, Estudar → Editar; Cartão só com a Frente, Excluir → Editar; exclusão, anúncio e foco intactos).
- T2103: CSS da linha comum `linha-da-lista*` escrito pelo Arquiteto. Os botões da linha são compactos (alvo de 44px) para manter a linha ≤72px e as ações ao lado do texto a partir de 360px; com zoom de 200%, as ações quebram para baixo.
- T2104: quatro arquivos de prova do frontend reescritos pelo DeepSeek; só os `it` afetados foram aplicados, após revisão.
- T2105: o DeepSeek listou as trocas do e2e, mas a saída veio fragmentada; o Arquiteto as reaplicou sobre o texto real. Asserções de Verso e Vínculos na lista passaram a ser negativas, e a persistência continua conferida pela API.

## 2026-10-04 — verificação
- Vitest do frontend: 789/804. As 15 falhas são as mesmas da linha de base (020); as 9 provas novas ou reescritas da 021 passam. ESLint limpo nos arquivos tocados.
- tsc/build: os únicos erros são os herdados da 020 (`minha-conta-resultado-incerto.test.tsx`, `pagina-de-inicio.test.tsx`).
- Playwright completo: 44 passam e 30 falham. As 30 falhas foram reproduzidas na base sem a 021 (minha-conta, preferências, visual-e-contraste, percurso-por-teclado na linha 308 «Preferências», acesso-temporario, agendamento, estatísticas e repetição espaçada). O percurso por teclado já passa pelos passos «Editar <Baralho>». Todos os specs ligados às listas passam: lista-de-baralhos (360/390/768/1440), baralhos-/cartoes-responsividade, persistência de baralhos/cartões/vínculos, excluir/editar cartão e baralho, ações do baralho e edição/exclusão-responsividade.
- Sem commit: aguardando o PO. `verificar:ci` só fica verde depois de concluir as pendências da 020.
