# Specification Quality Checklist: Acesso temporário

**Purpose**: Validar completude e qualidade dos requisitos antes de `tasks`
**Created**: 2026-10-03
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

## Notes

### Avaliação de 2026-10-03

Avaliação real item a item, não confirmação. Três pontos foram verificados com
atenção, por serem os candidatos naturais a reprovação:

- **"Nenhum sinônimo de `_Avoid_` é usado"**: "token", "sessão", "cookie" e
  "login" são sinônimos evitados de Credencial, e "Sessão" já é Sessão de
  estudo. O conceito novo ganhou o termo **Acesso temporário**, registrado no
  `CONTEXT.md` com a sua própria lista `_Avoid_`. A definição de Credencial foi
  ajustada: ela deixou de ser "apresentada a cada operação".
- **"A feature não contém requisito pertencente a outra feature"**: a 018
  **revisa** FR-079, FR-089, FR-090 e FR-091 da `008`, de forma declarada na
  tabela "Compatibilidade com specs anteriores", e estende os eventos da `017`
  (FR-263, FR-270) sem redefini-los.
- **"Requisitos testáveis e inequívocos"**: as três marcações de clarificação
  foram resolvidas pelo Product Owner (validade de 5 minutos renovada por ação,
  opção marcada por padrão, Sair só no navegador). "Ação" ficou definida para
  incluir Revelar, Avaliar e navegar (FR-291).

A numeração é global no projeto: FR-289–FR-306 e SC-114–SC-124.

Nenhum item reprovado após a correção. **20 de 20.**
