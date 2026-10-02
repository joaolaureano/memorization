# Specification Quality Checklist: Interface visual e navegável

**Purpose**: Revisar a qualidade dos requisitos antes das próximas etapas do Spec Kit.

**Created**: 2026-10-02

**Feature**: [spec.md](../spec.md)

**Review Ownership**: Revisão documental pelo agente autor. `[x]` indica critério de qualidade verificado; não significa aprovação do Product Owner, implementação ou testes executados.

## Content Quality

- [x] CHK001 — Especifica o que a pessoa precisa realizar, sem escolher arquitetura, bibliotecas ou estrutura de código.
- [x] CHK002 — Explica o benefício de cada história para quem usa o produto.
- [x] CHK003 — Mantém linguagem acessível e usa o glossário normativo.
- [x] CHK004 — Preenche cenários, requisitos, entidades, critérios de sucesso e premissas do template.

## Requirement Completeness

- [x] CHK005 — Não há marcadores de esclarecimento obrigatório em aberto; premissas revisáveis estão explícitas.
- [x] CHK006 — Requisitos possuem comportamento observável, incluindo exceções de acesso, saída e fechamento do navegador.
- [x] CHK007 — Critérios de sucesso têm resultados mensuráveis e conjuntos de verificação definidos.
- [x] CHK008 — Critérios de sucesso independem de ferramenta ou arquitetura de implementação.
- [x] CHK009 — Cada história tem cenários Given/When/Then e verificação independente.
- [x] CHK010 — Casos-limite incluem acervo vazio/extenso, texto longo, duplicação, recursos ausentes, perda de acesso e descarte.
- [x] CHK011 — Escopo distingue adoção no produto de ferramentas de demonstração e explorações futuras.
- [x] CHK012 — Dependências e premissas não confirmadas são identificadas.

## Feature Readiness

- [x] CHK013 — Todos os requisitos funcionais possuem critérios observáveis e correspondência nos cenários/critério de sucesso abaixo.
- [x] CHK014 — O percurso Entrar → criar Baralho → criar Cartão → vincular → estudar → concluir está coberto.
- [x] CHK015 — Os critérios de sucesso cobrem os objetivos de acesso, organização, estudo, recuperação e acessibilidade.
- [x] CHK016 — A spec não inclui implementação, plano técnico, tarefas executáveis ou promessa de publicação.

## Consistência com o projeto

- [x] CHK017 — FR-135 a FR-160 e SC-062 a SC-070 continuam a numeração existente sem colisões de definições.
- [x] CHK018 — Nenhuma entidade nova foi criada; Frente, Verso e Revelação seguem `CONTEXT.md`.
- [x] CHK019 — Edição compartilhada, Vínculos, exclusões, isolamento e persistência preservam as regras das features anteriores.
- [x] CHK020 — Refinamentos de Senha visível, descarte, interrupção e percentual são explicitados para revisão, sem aprovação presumida.
- [x] CHK021 — A spec distingue revisão documental de evidência de implementação e não reutiliza testes do protótipo como prova do aplicativo.

## Cobertura documental

US refere-se à história numerada; os números após a barra indicam cenários dessa história. Esta matriz orienta o planejamento posterior e não substitui a rastreabilidade requisito–teste de `tasks`.

| Requisitos | Cenários e critérios |
| --- | --- |
| FR-042, FR-135 a FR-137 | US5/1–5; SC-063, SC-068; inventário visual |
| FR-138, FR-139 | US1/1–2,6–7; US5/1; SC-062, SC-069 |
| FR-140, FR-141 | US1/4; US2/1–2,8–10; SC-062, SC-064 |
| FR-142, FR-143 | US1/1,4–5; SC-062, SC-068, SC-070 |
| FR-144, FR-145 | US2/1–4,10; US3/1; SC-062, SC-066 |
| FR-146, FR-147 | US2/5–7; SC-066 |
| FR-148 | US2/8–9; casos-limite de saída; SC-064 |
| FR-149, FR-150 | US3/1–4; casos-limite de Sessão; SC-062, SC-067 |
| FR-151, FR-152 | US3/5–6; SC-064, SC-067 |
| FR-044, FR-045, FR-153 a FR-155 | US4/1–3,6; caso-limite de operação pendente; SC-065 |
| FR-156, FR-157 | US4/4–5; US1/6–7; SC-069 |
| FR-158, FR-159 | US3/7; US5/3,5; SC-068 |
| FR-046, FR-160 | US1/1; compatibilidade e inventário; SC-070 |

## Notes

- Resultado: **21 de 21 critérios de qualidade documental atendidos**. Spec permanece **Draft** para revisão do Product Owner.
- Aplicada a skill `domain-modeling` conforme a constituição: conferidos termos, invariantes, Vínculos e limites de descarte. Sem novo termo, sem alteração de glossário e sem ADR.
- A referência usa rótulos incidentais para Verso; a spec estabelece **Verso** e **Revelar verso**, preservando FR-046.
- FR-142 declara o refinamento proposto ao FR-078 para mostrar apenas a Senha digitada no formulário atual. Não permite recuperar a Senha armazenada nem adotar Credencial de demonstração.
- As premissas de 600 px, arredondamento do percentual e abrangência do descarte estão marcadas para revisão. Há defaults concretos; nenhuma decisão de arquitetura foi antecipada.
- Nenhuma confirmação do usuário nesta etapa foi inventada. Não foram criados `plan.md`, `tasks.md`, código ou testes executáveis.
- Próxima etapa sugerida: `speckit-clarify`, para revisar as premissas e os refinamentos antes do planejamento técnico.

### Conferência do procedimento em 2026-10-02

- Relido integralmente o fluxo local `speckit-specify` e conferida a entrega contra suas etapas obrigatórias.
- A feature ativa continua `specs/012-interface-visual-navegavel`; trata-se da revisão da mesma especificação, sem criar outra feature.
- Conferidos template aplicado, seções, cenários, requisitos, critérios de sucesso, premissas e checklist. Corrigida a redação do SC-067 para associar explicitamente 100% a todos os acertos, 0% a todos os erros e 67% a dois acertos em três.
- `.specify/extensions.yml` ausente nas conferências de pré e pós-execução; não há hooks a executar.
- Resultado documental mantido em 21/21. Próxima etapa: `speckit-clarify`; nenhuma implementação executada.
