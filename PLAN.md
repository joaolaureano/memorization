# Handoff SDD — specs 016 a 018

**Branch**: `implementacao-016-018`  
**Objetivo**: entregar ao revisor o estado documental e as decisões que ainda
precisam de validação antes de novas implementações.

## Estado consolidado

| Spec | Estado do SDD | Tarefas |
| --- | --- | --- |
| 016 — Agendamento de estudo | A análise e a rastreabilidade foram revisadas. O ciclo não fecha enquanto A-01–A-07 não forem confirmadas pelo Product Owner. | T1601–T1603 concluídas; T1604–T1625 pendentes. |
| 017 — Gerenciar conta do Usuário | `specify → clarify → plan → checklist → tasks → analyze` concluído, sem item CRITICAL. Aguarda aprovação do Product Owner para implementar. | T1701–T1720 pendentes. |
| 018 — Acesso temporário | `specify → clarify → plan → checklist → tasks → analyze` concluído, sem item CRITICAL. Aguarda aprovação do Product Owner para implementar. | T1801–T1818 pendentes. |

## Revisões documentais incluídas

- **016**: corrige os registros históricos de escopo e branch, adiciona a
  matriz requisito–teste e registra a revisão em
  `specs/016-agendamento-de-estudo/research.md`.
- **017**: compatibiliza FR-279 com o retorno HTTP
  `senha_atual_incorreta` e define a contagem de dados da Agenda em SC-113.
- **018**: resolve continuidade sem cookie, substituição e limpeza de Acesso,
  preservação em `503` e a separação entre o Module puro `atividade.ts` e o
  I/O da Aplicação.

## Decisões pendentes da spec 016

O revisor deve obter confirmação explícita do Product Owner para cada proposta
abaixo. Elas permanecem bloqueadores e não devem ser tratadas como aprovadas.

1. **A-01**: um Compromisso só é concluído pela Sessão iniciada por ele.
2. **A-02**: o fuso do navegador define o dia atual da Agenda.
3. **A-03**: alterações afetam hoje pendente e o futuro; passado, conclusões e
   Sessões já iniciadas permanecem preservados.
4. **A-04**: a recorrência é semanal, sem horário; aceita 1–999 Cartões ou
   Todos os Cartões; sobreposições exigem confirmação.
5. **A-05**: faltas não criam reposição, acúmulo nem antecipação automática.
6. **A-06**: Agenda aparece antes de Revisão do dia em Início e seu
   gerenciamento é acessado pelo próprio bloco.
7. **A-07**: 100 Rotinas e dois anos de Compromissos são a escala de aceite,
   sem limitar o cadastro.

## Próximos passos para o revisor

1. Validar ou ajustar A-01–A-07 com o Product Owner.
2. Atualizar a 016 somente após essas decisões e reexecutar sua análise.
3. Obter aprovação explícita antes de implementar 017 ou 018.
4. Ao implementar, delegar todo código em `backend/`, `frontend/` e `e2e/` a
   workers DeepSeek, revisar cada diff e manter a rastreabilidade
   requisito–teste.

## Limites deste handoff

- Este commit contém somente documentação e não marca tarefas pendentes como
  concluídas.
- `SESSION.md` é um arquivo local não rastreado e fica fora do commit.
- Não houve execução de testes de aplicação, pois nenhuma alteração de código
  integra este handoff.
