# Specification Quality Checklist: Agendamento de estudo

**Purpose**: Validar completude, clareza e consistência da spec antes do planejamento.
**Created**: 2026-10-03
**Feature**: [spec.md](../spec.md)
**Review Ownership**: revisão documental do autor no ciclo `speckit-specify`; decisões de produto e aprovação permanecem com o Product Owner.
**Marker Semantics**: `[x]` indica qualidade do requisito revisada, não implementação concluída, teste executado ou aprovação do Product Owner.

## Content Quality

- [x] CHK001 A spec descreve necessidades e comportamento, sem escolher linguagem, framework, contratos ou estrutura de armazenamento.
- [x] CHK002 Os cenários explicam o valor para o Usuário: programar, acompanhar e concluir estudos.
- [x] CHK003 A linguagem é compreensível sem conhecimento da implementação, com termos definidos em `CONTEXT.md`.
- [x] CHK004 As seções obrigatórias do template resolvido pelo Spec Kit estão preenchidas; invariantes e funcionalidades adiadas seguem a referência `001`.

## Requirement Completeness

- [x] CHK005 Não há marcadores de esclarecimento sem resposta, placeholders ou alternativas concorrentes dentro de um requisito; os padrões propostos estão explícitos em A-01 a A-07.
- [x] CHK006 FR-222 a FR-256 têm condições e resultados verificáveis, incluindo datas, duplicidade e concorrência.
- [x] CHK007 SC-095 a SC-104 definem resultados mensuráveis.
- [x] CHK008 Os critérios de sucesso não dependem de uma tecnologia de implementação.
- [x] CHK009 As seis histórias contêm prioridade, valor, teste independente e cenários Given/When/Then.
- [x] CHK010 Casos-limite cobrem vazio, falha, reenvio, indisponibilidade, conteúdo longo, mudança de data e edição durante a Sessão.
- [x] CHK011 O escopo é delimitado em Funcionalidades Adiadas; lembretes, horários, recuperação e conclusão manual ficam fora.
- [x] CHK012 Dependências e premissas são identificadas, sem tratar decisões propostas como confirmação do Usuário.

## Feature Readiness

- [x] CHK013 Todos os requisitos funcionais estão ligados a critérios de aceitação na matriz abaixo.
- [x] CHK014 Os cenários cobrem criação, acompanhamento, conclusão, gerenciamento, recuperação de falhas, isolamento e acessibilidade.
- [x] CHK015 Os critérios de sucesso correspondem aos resultados exigidos pela feature e permitem uma futura verificação objetiva.
- [x] CHK016 UI e entidades descrevem o que o produto oferece; decisões técnicas ficam para `speckit-plan`.

## Matriz de cobertura de aceitação

`USn.m` identifica o cenário m da User Story n na spec. Esta matriz liga
requisitos a cenários, não substitui a rastreabilidade requisito–teste de tasks.

| Requisito | Cenários de aceitação | Critérios de sucesso |
| --- | --- | --- |
| FR-222 | US1.1 | SC-095 |
| FR-223 | US1.6 | SC-095, SC-096 |
| FR-224 | US1.1, US1.2 | SC-095 |
| FR-225 | US1.3 | SC-096, SC-099 |
| FR-226 | US1.4, US3.6 | SC-096, SC-097 |
| FR-227 | US2.1, US2.2 | SC-096 |
| FR-228 | US2.1, US2.3, US2.5 | SC-096, SC-099 |
| FR-229 | US2.3, US2.4, US2.6 | SC-096 |
| FR-230 | US2.1, US2.3 | SC-096 |
| FR-231 | US3.1, US6.6 | SC-097 |
| FR-232 | US3.1, US3.2, US6.2 | SC-097 |
| FR-233 | US3.3, US3.5 | SC-097, SC-104 |
| FR-234 | US3.4 | SC-097 |
| FR-235 | US3.5, US3.8 | SC-097 |
| FR-236 | US3.6, US3.7 | SC-097, SC-104 |
| FR-237 | US5.1 | SC-098, SC-101 |
| FR-238 | US5.2, US5.3 | SC-098 |
| FR-239 | US5.3, US5.4 | SC-098 |
| FR-240 | US2.6 | SC-096 |
| FR-241 | US1.6, US2.4 | SC-095, SC-096 |
| FR-242 | US1.2, US5.5 | SC-095, SC-101 |
| FR-243 | US6.1 | SC-096 |
| FR-244 | US6.2 | SC-098 |
| FR-245 | US6.2, US6.5 | SC-097, SC-098 |
| FR-246 | US2.5, US6.4 | SC-099 |
| FR-247 | US3.4, US6.3, US6.4, US6.6 | SC-099 |
| FR-248 | US4.1, US4.5 | SC-100 |
| FR-249 | US1.5, US5.6 | SC-097, SC-098 |
| FR-250 | US1.1, US4.2 | SC-098, SC-100 |
| FR-251 | US1.2, US1.5, US2.6, US3.5, US5.5 | SC-095, SC-097 |
| FR-252 | US4.3 | SC-101 |
| FR-253 | US4.4 | SC-101 |
| FR-254 | US4.6 | SC-100 |
| FR-255 | US4.3, US4.7 | SC-103 |
| FR-256 | US2.2, US3.3, US3.7 | SC-104 |

SC-102 define o cenário adicional de volume para a verificação de desempenho
no planejamento: 100 Rotinas e 2 anos de Compromissos, semana visível em até 1 s.

## Notes

- **Resultado**: 16/16 critérios de qualidade documental satisfeitos; 35/35 requisitos funcionais cobertos pela matriz. Nenhum teste da feature foi executado: ela ainda não foi implementada.
- **Método**: leitura do template ativo, da constituição, do glossário, da spec 001, das dependências 012–015 e da proposta visual; revisão dos fluxos e das exceções, seguida de verificação estrutural de identificadores, links e cobertura.
- **Ajustes na revisão**: diferenciar criação duplicada por reenvio de Rotinas deliberadamente sobrepostas; definir cancelados versus indisponíveis nos totais; preservar a conclusão de Sessão iniciada antes de alterações; distinguir data do Compromisso de instante do Registro; ordenar as histórias P1 antes das P2.
- **Premissas**: A-01 a A-07 são padrões definidos para tornar o rascunho verificável. Esses padrões sustentam o plano e permanecem premissas a validar; não houve confirmação individual presumida. Não são escolhas técnicas nem alternativas deixadas em aberto dentro dos requisitos.
- **Limite de entrega**: plano e backlog preparados para revisão; A-01–A-07 permanecem premissas explícitas. O Product Owner proibiu implementação nesta etapa. Checklist documental não autoriza executar tarefas ou declarar implementação concluída.
- **Framework**: `create-new-feature.sh` criou a feature 016 a partir do template resolvido e atualizou `.specify/feature.json`. `check-prerequisites.sh --json --paths-only` resolveu a feature correta. O campo `BRANCH` retornado por esse script identifica a feature lógica; a branch Git continua `wip/outro-agente-cartao-fixo`.
- **Hooks**: `.specify/extensions.yml` ausente; não há hooks locais de antes/depois de specify para executar.
- O ciclo de vida de `checklists/requirements.md` é mantido por `speckit-specify`/`speckit-clarify`. Uma futura execução de implementação não deve alterar seus marcadores para declarar aprovação.
