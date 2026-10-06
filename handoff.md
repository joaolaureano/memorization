# Handoff — 025 Criar Cartões dentro de Baralhos

## Estado — 2026-10-06, 11:58 (America/Sao_Paulo)

As quatro histórias da spec 025 estão implementadas. Todas as 48 tasks de `specs/025-criar-cartoes-baralho/tasks.md` estão concluídas. O acervo dá a cada Cartão exatamente um Baralho dono; a tela global de Cartões e as ações de vínculo foram removidas.

SQLite e PostgreSQL usam as migrações 13/14: a versão 13 preserva os Vínculos legados durante a transição por Usuário; a versão 14 só os elimina quando todos os Cartões têm Pertencimento. A transição mantém a atribuição automática de casos simples, exige escolhas para Cartões avulsos/compartilhados, copia conteúdo sem Agendamentos/Histórico e reverte a operação inteira em caso de falha.

A criação e a edição de Cartões são contextuais ao detalhe do Baralho, com Frente duplicada numerada na criação e conflito recusado na edição. Exclusões removem o Cartão e seu Agendamento, preservando snapshots do Histórico. Salvar uma seleção temporária cria cópias com identidade própria e suporta repetição idempotente.

## Verificação

`rtk npm run verificar:ci` passou integralmente em 2026-10-06: Gitleaks sem segredos, typecheck e lint do backend, testes gerais e PostgreSQL, lint/testes/build do frontend e **92 testes E2E aprovados**. O verificador do protótipo passou. A comparação visual com o produto está registrada em `specs/025-criar-cartoes-baralho/prototipos.md`.

As provas E2E novas cobrem transição multiusuário e recuperação em `e2e/transicao-de-cartoes.spec.ts`, salvamento repetido de Frentes em `e2e/baralho-temporario.spec.ts`, criação contextual/persistência em `e2e/persistencia-de-cartoes.spec.ts` e responsividade em `e2e/baralhos-responsividade.spec.ts`. Provas antigas que cobriam apenas a lista global, vínculos ou telas removidas foram substituídas por cobertura contextual atual.

Falta somente verificação manual com leitor de tela para o anúncio de Frente numerada e a jornada completa da transição. As capturas existentes representam o protótipo, não o produto.

As mudanças permanecem sem commit. A alteração preexistente em `.specify/memory/constitution.md` foi preservada.
