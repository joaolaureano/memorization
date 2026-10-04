# Handoff SDD — specs 016 a 018

**Branch**: `implementacao-016-018`  
**Estado**: as três specs foram implementadas por completo e verificadas.

## Estado consolidado

| Spec | Estado | Tarefas |
| --- | --- | --- |
| 016 — Agendamento de estudo | Implementada: Rotinas versionadas, calendário semanal em Início, Sessão autorizada com conclusão atômica, gerenciamento e formulário. | T1601–T1625 concluídas. |
| 017 — Gerenciar conta do Usuário | Implementada: Nome de usuário, Senha, exclusão da conta e resultado incerto. | T1701–T1720 concluídas. |
| 018 — Acesso temporário | Implementada: cookie `HttpOnly` com validade deslizante, renovação por atividade, Sair e expiração. | T1801–T1818 concluídas. |

## Aprovações assumidas

Este commit nasce do pedido explícito do Product Owner de **implementar o PLAN.md
completamente**. A versão anterior deste handoff dizia que 017 e 018 aguardavam
aprovação do Product Owner e que A-01–A-07 da 016 eram bloqueadores. O pedido foi
tratado como a aprovação para implementar as três specs, **inclusive** para as
premissas A-01–A-07, e isso fica registrado aqui e no commit. Não equivale a uma
confirmação individual de cada premissa: o Product Owner pode revisitá-las, e as
decisões abaixo mostram onde cada uma tem efeito no código.

1. **A-01**: um Compromisso só é concluído pela Sessão iniciada por ele
   (`inicioAgendaId`, conferido no servidor).
2. **A-02**: o fuso do navegador define o dia atual; o servidor deriva «hoje».
3. **A-03**: alterações afetam hoje (se pendente) e o futuro; passado e conclusões
   ficam preservados.
4. **A-04**: recorrência semanal; 1–999 Cartões ou Todos; sobreposição exige confirmação.
5. **A-05**: sem reposição, acúmulo nem antecipação.
6. **A-06**: a Agenda vem antes da Revisão do dia; o gerenciamento é acessado pelo bloco.
7. **A-07**: 100 Rotinas e dois anos de Compromissos como escala de aceite.

## Decisões e desvios de implementação

- **Migrações**: a 8 é a Agenda (016) e a **9** é o Acesso temporário (018), com o
  mesmo número nos dois Adapters.
- **016, Porta**: acrescentadas `obterOperacaoDeRotina`, `cancelamentos` e
  `reativacoes` em `GravacaoDeRotina` e `inserirRegistroDaAgenda` (Registro +
  Agendamentos calculados sobre o estado lido na transação serializada +
  conclusão do Compromisso).
- **016, contrato**: `RotinaDeEstudo.indisponivel` e a rota `#/agenda/estudo` foram
  acrescentados; o limite de 1000 Itens só vale fora da Agenda.
- **017**: a revogação dos Acessos ao trocar a Senha, renomear ou excluir fica na
  camada de rotas, e não em `identidade.ts`.
- **018**: com `credentials: include` a API concede a origem exata do frontend
  (`ORIGEM_DO_FRONTEND`); `ORIGENS_LOCAIS_DE_TESTE` existe **só** para os E2E. A
  primeira recusa por Credencial vence: pedidos em voo não trocam «Seu acesso
  expirou» pela mensagem genérica.
- **Variáveis novas**: `ORIGEM_DO_FRONTEND`, `ACESSO_VALIDADE_SEGUNDOS` e
  `ORIGENS_LOCAIS_DE_TESTE`, documentadas nos READMEs.
- Detalhes por spec ficam na seção «Execução» de cada `tasks.md` e em
  `specs/016-agendamento-de-estudo/research.md` (R7 e evidências).

## Verificação

- **Backend**: `tsc --noEmit` e `eslint .` limpos; `vitest run` com 947 testes
  passando; as builds `local`, `cloud` e `lambda` concluem.
- **Frontend**: `tsc --noEmit`, `eslint .` e `vite build` limpos; `vitest run` com
  781 testes passando.
- **E2E**: suíte completa em navegador real contra a API e o frontend reais,
  incluindo `agendamento-de-estudo.spec.ts`, `minha-conta.spec.ts` e
  `acesso-temporario.spec.ts`.

## Limites

- **PostgreSQL não foi executado**: o PostgreSQL embutido dos testes não sobe neste
  ambiente (`initdb` recusa rodar como root), então 11 arquivos de teste
  dependentes dele não rodaram. Os dois Adapters implementam as mesmas operações e
  a bateria da Porta é compartilhada, mas a parte PostgreSQL dela, a paridade da
  Função da nuvem (`funcao.test.ts`) e `nuvem.test.ts` **precisam ser executadas**
  numa máquina com `embedded-postgres` funcional antes de publicar.
- **Workers DeepSeek não foram usados**: a implementação foi feita diretamente pelo
  Arquiteto, porque os workers não estavam disponíveis. O diff precisa de revisão
  humana.
- `graphify update .` não foi executado (a ferramenta não está instalada aqui).
- Publicação: o trabalho vai apenas para a branch `implementacao-016-018`, como
  a sessão determina; não há merge em `main` nem PR.

## Próximos passos para o revisor

1. Rodar a bateria PostgreSQL e `funcao.test.ts` onde o PostgreSQL embutido funcione.
2. Revisar o diff, em especial as regras temporais da Agenda e a transação de
   conclusão.
3. Confirmar com o Product Owner A-01–A-07, uma a uma, se for preciso.
