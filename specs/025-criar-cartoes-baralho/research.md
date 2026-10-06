# Decisões — Criar Cartões dentro de Baralhos

## 2026-10-05 — Pedido e modelo de domínio

O Usuário pediu que Cartões sejam criados dentro do detalhe de um Baralho, que cada Cartão pertença a um único Baralho e que o menu e a tela dedicados a Cartões sejam removidos.

Aplicada a skill `domain-modeling` (`.agents/skills/domain-modeling/SKILL.md`) porque o pedido altera a relação entre Cartão e Baralho. A seção Key Entities desta spec registra a nova linguagem: Cartão pertence a exatamente um Baralho; Baralho pode conter zero ou mais Cartões; Pertencimento não é criado separadamente. A constituição v3.2.0 declara o antigo `CONTEXT.md` e ADRs fora de uso; a spec é a autoridade para o novo significado.

As specs 001 e 003 permitem Cartão avulso e associação com zero ou mais Baralhos. As specs 021 e 022 dependem de uma lista global de Cartões. A spec 025 supersede esses pontos conflitantes, preservando as regras compatíveis de conteúdo, estudo, revisão, edição e exclusão. A busca e os filtros globais deixam de existir com a tela retirada; esta feature não introduz busca substituta.

Permanece pendente a política para dados atuais que violam a nova relação: Cartões sem Baralho e Cartões vinculados a vários Baralhos. Há alternativas com consequências diferentes para preservação, duplicação e navegação; a escolha foi deixada para esclarecimento antes do plano. Nenhuma estratégia de migração foi assumida.

## 2026-10-05 — Esclarecimentos sobre a transição

O Usuário escolheu preservar as associações atuais com cópias: cada Cartão sem Baralho recebe um destino escolhido pelo Usuário; para Cartões compartilhados, o Usuário escolhe qual Baralho mantém o Cartão original e cada outro Baralho anterior recebe uma cópia distinta com a mesma Frente e Verso.

O Usuário escolheu que as cópias comecem sem agendamento ou histórico. O Cartão original conserva seus dados de revisão no Baralho escolhido; nenhum histórico é multiplicado. Essas decisões foram incorporadas a FR-397, aos cenários de transição e aos critérios SC-161/SC-162. A lista global, seus filtros e sua busca permanecem removidos conforme o escopo original.

## 2026-10-05 — Cópias e Frentes repetidas

A inspeção da spec 023 revelou que «Salvar como baralho» cria Vínculos para Cartões existentes e preserva Agendamentos. Isso é incompatível com a relação exclusiva da spec 025. O Usuário decidiu criar cópias no novo Baralho e manter intactos os Cartões e Vínculos dos Baralhos de origem; as cópias começam sem Agendamento ou Histórico.

O Usuário definiu que uma Frente repetida no destino recebe contador diretamente na Frente (por exemplo, `To Walk (2)`), em vez de criar um campo de nome separado. Também confirmou numeração automática para criação manual. A regra foi delimitada por Baralho: Frentes podem repetir em Baralhos diferentes; dentro de um Baralho, a Frente é única. Edição que colidir é recusada para não alterar conteúdo sem intenção explícita. Isso revisa a permissão histórica de Frentes iguais em `001` e os requisitos de Vínculo/Salvamento em `003`/`023`.

As decisões influenciaram FR-397–FR-400, os cenários de criação, transição e salvamento temporário, os critérios SC-163/SC-164 e o plano de migração, validação de unicidade e contrato HTTP.

## 2026-10-05 — Exclusões sob pertencimento obrigatório

A regra de Cartão com exatamente um Baralho conflita com `003`/`006`: remover o Vínculo deixaria um Cartão órfão, e excluir um Baralho hoje preserva os Cartões. O Usuário decidiu que remover um Cartão no detalhe significa excluí-lo, com confirmação; excluir um Baralho também exclui seus Cartões. Os Agendamentos são removidos junto. Registros históricos já concluídos permanecem legíveis como snapshots, conforme o modelo de Histórico vigente.

Essa decisão altera o texto da confirmação de exclusão do Baralho para declarar a quantidade e a exclusão dos Cartões/Agendamentos, e requer que Cartão, Agendamento e Baralho sejam removidos atomicamente. A falha de persistência preserva todos. FR-401/FR-402, os cenários e SC-165/SC-166 registram a decisão; os requisitos conflitantes das specs antigas permanecem apenas como histórico.

## 2026-10-05 — Pesquisa e decisões do plano

### Contexto verificado

Aplicada a skill `codebase-design` (`.agents/skills/codebase-design/SKILL.md` e `DEEPENING.md`) por esta fase definir Interfaces, Modules e estratégia de testes. Ela influenciou a decisão de aprofundar `Acervo`, manter a Seam `ClienteDoAcervo` e evitar nova Seam para a transição.

O grafo do projeto foi consultado após `graphify reflect --if-stale`; a expansão da pergunta usou somente vocabulário presente no grafo: `cards`, `deck`, `frontend`, `backend`, `create`, `persist`, `vinculo`, `tests`. As conexões relevantes apontaram para a tela `PaginaDoBaralho`, `ClienteDoAcervo`, adapters SQLite/PostgreSQL, migrações, testes de persistência e o fluxo `salvarSelecaoComoBaralho`.

Inspeção local confirmou que `PaginaDoBaralho` já consome `obterBaralho(id)` com Cartões, enquanto `PaginaDoFormularioDeCartao` cria sem Baralho e retorna a `#/cartoes`. `Moldura`/`navegacao` oferecem Cartões como destino principal. O `Acervo`, `ClienteDoAcervo` e os adapters expõem criação global e operações de Vínculo. A feature 023 salva seleções criando Vínculos; isso agora é supersedido por cópias. O armazenamento implementa as exclusões em SQLite e PostgreSQL, e a versão atual de ambos é 12.

Os protótipos 022/024 e 023 reutilizam `frontend/src/estilos.css`, são HTML autônomo e têm verificadores Chromium próprios. O novo protótipo seguirá esse padrão, sem tocar nos estilos globais.

### Decisões técnicas

- **Relação persistida**: tabela `pertencimento`, não nova propriedade de domínio em Cartão. `cartao_id` é chave primária da relação; Frente normalizada é chave única por Baralho. O `Acervo` garante totalidade ao inserir Cartão + Pertencimento atomicamente.
- **Migração compatível com decisões por Usuário**: versão 13 acrescenta Pertencimento e preserva `vinculo` como fonte legada. Cada Usuário resolve Cartões avulsos/compartilhados isoladamente; Usuários concluídos continuam usando o acervo novo. Versão 14 remove `vinculo` somente depois de todos os Cartões terem destino único.
- **Dados legados**: relação única pode ser atribuída automaticamente. Cartão avulso exige destino; em Cartão compartilhado, o Usuário escolhe onde fica o original; cópias mantêm as outras associações antigas e não recebem Agendamento/Histórico.
- **Frente única**: chave de comparação usa normalização Unicode, remoção de acentos, caixa baixa e aparo externo. Criação/cópia procura o próximo contador livre; edição colidente falha. `frente_chave` é metadata de armazenamento, não propriedade visível do Cartão.
- **Salvamento temporário**: cria cópias com identidade nova, na ordem estável da seleção, em uma transação idempotente. Reutilizar Vínculos violaria a relação exclusiva; mover originais contrariaria a decisão de preservar os Baralhos de origem.
- **Exclusões**: operações existentes do `Acervo` tornam-se transacionais para apagar Cartão+Agendamento ou Baralho+Cartões+Agendamentos. Snapshots do Histórico ficam intactos.
- **Interfaces**: `Acervo` concentra regra e persistência; `ClienteDoAcervo` segue como Seam com adapters HTTP e em memória. Rotas HTTP continuam adaptadores, sem regra duplicada. Nenhum Module, Seam ou dependência nova.
- **Protótipo**: novo HTML/JS standalone reutiliza estilos globais, contém somente dados fictícios em memória e inclui fluxo de transição e cenário de cópia além de criar/consultar/excluir.

Alternativas rejeitadas: pôr `baralhoId` como propriedade de Cartão (confunde conteúdo e relação e torna a migração dependente de reconstrução de tabela); remover `vinculo` antes de coletar escolhas (perde destinos); manter a criação de Vínculos no salvamento temporário (quebra exclusividade); mover os originais ao salvar (altera os Baralhos de origem). Nenhuma dependência externa ou novo Adapter é necessário.

## 2026-10-05 — Decomposição de implementação

Geradas 47 tasks em `tasks.md`: 5 fundacionais, 14 para US3 (transição), 10 para US1 (criação), 8 para US2 (consulta/exclusão), 7 para US4 (salvar seleção por cópias) e 3 de Polish. O setup não cria dependências ou infraestrutura nova, portanto não há tarefas de scaffold.

As quatro histórias são P1. US3 aparece primeiro porque a transição do acervo legado precisa proteger usuários existentes antes de expor a nova criação e exclusão; US4 é gate de release porque o salvamento temporário ainda criaria múltiplos proprietários se não fosse atualizado. A matriz FR→teste atende ao Princípio IX; cada tarefa de teste precede sua implementação. Tarefas de código de aplicação ficam sujeitas à delegação obrigatória do Princípio XI.

## 2026-10-05 — Remediações aprovadas e aplicadas

O Usuário pediu aplicar todas as remediações apontadas na análise. FR-394 foi restringido para que as consequências específicas de exclusão sejam as de FR-401/402. As tasks T020–T028 agora exigem teste e validação autoritativa de edição de Frente conflitante pela Interface do `Acervo`, adapters e HTTP, incluindo aceitação da mesma Frente em Baralhos distintos.

T001/T002/T003/T004/T006/T007/T016/T019 explicitam backfill automático quando há um único destino, retenção da versão 13 e da tabela `vinculo` enquanto houver Usuário pendente, e remoção somente após conclusão global. T048 acrescenta teste do produto em 360, 390, 768 e 1440 px, zoom CSS de 200%, sem sobreposição/rolagem horizontal e com teclado. O total passa a 48 tasks. Nenhum código de aplicação foi alterado.

Na revisão da ordem de execução, a verificação responsiva passou a T047 e `verificar:ci` a T048, mantendo o gate completo como última task. A matriz FR-396 foi atualizada para apontar T047.

## 2026-10-05 — Compatibilidade de entrypoints durante v13

A inspeção de `backend/src/entradas/nuvem.ts` e `backend/src/funcao/funcao.ts` mostrou que ambos recusam qualquer esquema diferente da versão corrente. Isso bloquearia todos os Usuários enquanto houvesse uma migração por Usuário pendente, contrariando a decisão de que Usuários concluídos continuam usando o acervo. O plano e T010/T016/T018 agora especificam v13 como estado transitório aceito, v12 e anteriores recusados, e nova execução do comando cloud após a última transição para aplicar v14. Foram adicionados cenários de validação ao quickstart. Nenhum código de aplicação foi escrito nesta atualização documental.

## 2026-10-05 — Backfill singleton na transição por Usuário

Ao confrontar o harness versionado com `frente_chave`, ficou definido que a migração 13 cria a tabela `pertencimento` vazia e preserva integralmente `vinculo`. A atribuição automática dos Cartões que têm exatamente um destino ocorre na operação transacional de preparação da transição do Usuário, onde a normalização Unicode da Frente e a colisão podem ser aplicadas corretamente. Cartões avulsos/compartilhados seguem exigindo escolhas explícitas. T001–T004 e T011 foram alinhadas a esse limite; os testes de migração agora separam criação do esquema da resolução do domínio.

## 2026-10-05 — Verificação da implementação

`rtk npm run verificar:ci` foi executado fora do sandbox, necessário para arquivos temporários e portas locais. Gitleaks, typecheck, lint e testes do backend (incluindo PostgreSQL), lint, testes e build do frontend passaram. A etapa Playwright falhou: 17 cenários passaram, vários cenários históricos ainda chamam o removido `POST /cartoes` ou procuram a antiga tela global de Cartões; 5 cenários não foram executados depois das falhas. A tarefa T048 permanece aberta. O cenário atualizado `e2e/persistencia-de-cartoes.spec.ts` passou isoladamente no Chromium: criação em Baralho, ausência em outro, numeração e persistência após reinício.

Depois dessa execução, os E2E de persistência, exclusão em cascata com Histórico, navegação sem tela global, lista e ações de Baralhos e sessão de estudo passaram isoladamente. A cobertura de T047 passou no Chromium em 360, 390, 768, 1440 px e zoom CSS 200%, com criação, edição e exclusão por teclado, sem rolagem horizontal ou sobreposição de controles.

Ainda não foram verificados manualmente com leitor de tela o anúncio da Frente numerada e o fluxo completo de escolha da transição. A confirmação de exclusão passou por teclado no Chromium, mas a leitura do diálogo por tecnologia assistiva continua sem verificação manual.

## 2026-10-06 — Gate final

`rtk npm run verificar:ci` passou integralmente. Gitleaks não encontrou segredos; backend typecheck/lint/testes gerais/PostgreSQL, frontend lint/testes/build e Playwright passaram. A suíte E2E contém 92 cenários ativos e todos passaram. O verificador do protótipo e `rtk git diff --check` também passaram. T019, T044, T046, T047 e T048 estão concluídas.

A suíte deixou de executar provas dedicadas às telas globais de Cartões, vínculos e criação de relações removidas pelo modelo 025; as jornadas relevantes foram cobertas no detalhe contextual do Baralho, na persistência da nova propriedade, na transição legada e na responsividade. Permanecem sem revisão manual com leitor de tela: anúncio da Frente numerada, fluxo completo de transição e leitura das confirmações.
