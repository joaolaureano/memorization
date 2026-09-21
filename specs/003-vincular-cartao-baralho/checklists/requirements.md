# Specification Quality Checklist: Vincular Cartão a Baralho

**Purpose**: Validar completude e qualidade dos requisitos
**Created**: 2026-09-21
**Feature**: [spec.md](../spec.md)

**Review Ownership**: Artefato de revisão de qualidade de requisitos. Um item só
é marcado `[x]` quando o revisor determina que o critério está satisfeito.

## Content Quality

- [x] Sem detalhes de implementação (linguagem, framework, API)
- [x] Focado em valor ao usuário
- [x] Escrito para quem não é técnico
- [x] Seções obrigatórias completas

## Requirement Completeness

- [x] Nenhum marcador [NEEDS CLARIFICATION] remanescente
- [x] Requisitos testáveis e inequívocos
- [x] Critérios de sucesso mensuráveis
- [x] Critérios de sucesso independentes de tecnologia
- [x] Todos os cenários de aceitação definidos
- [x] Casos-limite identificados
- [x] Escopo claramente delimitado
- [x] Dependências e premissas identificadas

## Feature Readiness

- [x] Todo requisito funcional tem critério de aceitação claro
- [x] Os cenários cobrem o fluxo principal
- [x] A feature atende aos critérios de sucesso definidos
- [x] Nenhum detalhe de implementação vazou para a spec

## Escopo da Decomposição

- [x] A feature não contém requisito pertencente a outra feature
- [x] As dependências de outras features estão declaradas
- [x] Os termos usados estão definidos em `CONTEXT.md`
- [x] Nenhum sinônimo de `_Avoid_` é usado
- [x] Os requisitos transversais estão presentes, e não apenas assumidos

## Notes

### Avaliação de 2026-09-21

Avaliação item a item. Três pontos exigiram julgamento e estão registrados.

- **"A feature não contém requisito pertencente a outra feature"** — este é o
  item delicado desta feature. A tarefa **T202 exerce FR-008 e FR-017**, que
  pertencem à feature `006-excluir-cartao-e-baralho`. Isso **não** é vazamento
  de escopo: a semântica não-cascateante é propriedade do **esquema criado
  aqui**, e testá-la agora impede que a `006` descubra tarde que a forma estava
  errada. Os dois requisitos não são declarados na spec desta feature — apenas
  exercidos pelo teste, o que a matriz registra explicitamente. Item aprovado
  com a ressalva anotada.
- **"Os requisitos transversais estão presentes"** — fechado o débito de
  EVT-030 com FR-040, FR-042, FR-044, FR-045 e FR-046 reutilizados, e FR-062 a
  FR-066 específicos, todos com cenário.
- **"Requisitos testáveis"** — FR-064 é o mais fácil de aprovar por inspeção
  visual e o mais difícil de verificar de verdade. Exige asserção sobre a
  posição do foco após cada operação, e o artefato de tarefas marca T210 como a
  mais suscetível a ser declarada concluída sem evidência.

Nenhum item reprovado. **21 de 21.**
