# Specification Quality Checklist: Gerenciar conta do Usuário

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

- **"Nenhum sinônimo de `_Avoid_` é usado"**: reprovado na primeira conferência.
  O rascunho definia a entidade "Conta", e "conta" é sinônimo evitado de
  Usuário. A entidade saiu. "Minha conta" e "Excluir conta" ficaram como rótulos
  de interface, seguindo o precedente de "Criar conta" para o Cadastro (`007`).
  O `CONTEXT.md` registra esses rótulos na definição de Usuário.
- **"A feature não contém requisito pertencente a outra feature"**: as regras de
  Nome de usuário e de Senha são de `007`, e as de Credencial são de `008`. Esta
  spec só as cita e aplica aos fluxos novos (FR-260, FR-267, FR-089 a FR-091).
  A remoção dos dados da Agenda depende da `016` e está condicionada à
  existência dela (FR-272, FR-274).
- **"Requisitos testáveis e inequívocos"**: o resultado incerto (FR-280 a
  FR-283) era o ponto mais vago. Ele ficou definido como verificação de qual
  Credencial é aceita, com saída explícita para o caso em que nem a verificação
  é possível.

A numeração é global no projeto: FR-257–FR-288 e SC-105–SC-113.

Nenhum item reprovado após a correção. **20 de 20.**
