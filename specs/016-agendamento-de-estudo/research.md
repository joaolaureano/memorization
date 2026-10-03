# Research: Agendamento de estudo

## R1 — Integração no acervo existente

**Decision**: adicionar o Module Agenda à composição de Acervo e reutilizar a
Porta ArmazenamentoDoAcervo e seus Adapters SQLite/PostgreSQL. A interface pública
oferece consultar semana, listar/gravar Rotina e autorizar início.
**Rationale**: identidade, credencial, Baralhos e gravação de Sessões já têm
Seams reais; a Agenda precisa da mesma atomicidade do Histórico.
**Alternatives considered**: serviço separado e fila de eventos rejeitados
porque adicionariam sincronização sem um segundo caller ou requisito.

## R2 — Histórico de programação e calendário

**Decision**: Rotinas guardam versões por data civil e versão de concorrência;
a leitura projeta somente os sete dias pedidos, aplicando cancelamentos e
conclusões persistidos. Renomear ou excluir Baralho preserva o nome histórico
nas versões antes de refletir mudanças atuais.
**Rationale**: não materializar infinitas ocorrências; alterações não reescrevem
semana anterior nem dependem de o Usuário ter aberto a Agenda naquele dia.
**Alternatives considered**: calcular todo passado pela configuração atual
viola FR-238; gerar dois anos de ocorrências a cada leitura viola SC-102.

## R3 — Prova de início e conclusão atômica

**Decision**: início autorizado persistido com id opaco, dono, Rotina/data,
configuração e Cartões selecionados. Não guarda progresso ou resultados
parciais. Registro usa o id do início como chave idempotente e snapshot
servidor. Conclusão, Registro e Agendamentos são gravados na mesma transação.
**Rationale**: o POST /sessoes atual valida dados mas não prova que a Sessão
começou pela Agenda. Um compromissoId informado pelo cliente não basta.
**Alternatives considered**: concluir em chamada posterior deixa falso sucesso
parcial; confiar no snapshot do navegador não atende FR-254.

## R4 — Datas

**Decision**: aceitar fuso IANA validado; derivar hoje do relógio servidor nesse
fuso; usar datas civis YYYY-MM-DD validadas estritamente e aritmética de dias
civis. Semana tem exatamente sete datas, segunda a domingo.
**Rationale**: não permitir ao cliente escolher livremente hoje e não depender
de 24 horas nos dias com horário de verão.
**Alternatives considered**: limites de UTC fixos e Date.parse permissivo
introduzem datas impossíveis ou deslocamento de dia.

## R5 — UI e cliente

**Decision**: estender ClienteDoAcervo e seus Adapters HTTP/em memória. Agenda
em componente independente no Início; gerenciamento em rota própria. Reutilizar
PaginaDeEstudo com entrada autorizada da Agenda e os mesmos controles de Sessão.
**Rationale**: preserva teclado, foco, tamanho fixo, avaliações e proteções.
**Alternatives considered**: duplicar toda a Sessão para Agenda perde Locality.

## Evidência

Inspeção local: backend/src/acervo/acervo.ts (registrarSessao),
backend/src/armazenamento/porta.ts (inserirRegistroEAgendamentos), os dois
Adapters, backend/src/http/rotas.ts e servidor.ts; frontend/src/ui/Aplicacao.tsx,
PaginaDeInicio.tsx, PaginaDeEstudo.tsx e acervo-cliente. Não há tecnologia nova.

## Portão de análise (2026-10-03)

`/speckit-analyze` antes do implement (T1601): 1 CRITICAL, 3 HIGH e 4 MEDIUM,
todos corrigidos nos artefatos antes de iniciar a implementação.

- **C1 (Constituição II)**: auditoria apontava para SESSION.md; passou a
  research.md e mensagens de commit (v3.0.0).
- **I1**: status "não autorizada" atualizado; a implementação foi autorizada
  pelo Product Owner em 2026-10-03.
- **U1/U2**: restrições do data-model e refinamentos do plan.md (limite de 1000
  Itens só fora da Agenda; Agendamentos calculados na transação serializada por
  Usuário) citados literalmente em T1602, T1603, T1610 e T1611.
- **F1/U3/U4/L1**: rota `#/agenda/nova` no T1606; 201 ao criar e 200 nas demais
  ações; Ver Sessão leva a `#/sessoes/:registroId`; rotas novas também na lista
  de pré-flight CORS (lição da 015).

Cobertura: FR-222–FR-256 e SC-095–SC-104 com ao menos uma tarefa (100%).

## R6 — Revisão documental do ciclo SDD (2026-10-03)

**Decisão**: manter A-01–A-07 como premissas de produto pendentes. A revisão
não interpreta a autorização ampla de implementação como confirmação individual
dessas decisões; por isso, ela não fecha o ciclo de clarify para essas premissas.

**Contexto e consequência**: spec, checklist e plano continham registros do
escopo inicial, limitado ao planejamento, ao lado da autorização posterior de
implementação. Os registros foram preservados como históricos e passaram a
apontar o estado atual, sem reescrever a narrativa. `tasks.md` passou a declarar
a matriz requisito–teste exigida pela Constituição IX. Nenhum requisito, regra
de domínio ou artefato de aplicação foi alterado nesta revisão.

**Skills aplicadas**:

- `domain-modeling`: aplicada porque a revisão confrontou Agenda de estudo,
  Rotina de estudo e Compromisso de estudo com `CONTEXT.md`, seus invariantes e
  cenários-limite. Os termos já estavam canônicos; não houve alteração do
  glossário.
- `codebase-design`: aplicada porque a revisão conferiu o desenho do Module
  Agenda, sua Interface, os Seams existentes de armazenamento/cliente e a
  estratégia de testes pela Interface. O plano mantém os dois Adapters reais
  em cada Seam e não introduz uma Seam hipotética.
