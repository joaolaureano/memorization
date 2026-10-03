# Specification Quality Checklist: Repetição espaçada

**Purpose**: Validar completude e qualidade dos requisitos antes de `tasks`
**Created**: 2026-10-02
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

Avaliação real item a item, não confirmação. Quatro pontos verificados com
atenção, por serem os candidatos naturais a reprovação:

- **"Sem detalhes de implementação"**: FR-220 cita SQLite e PostgreSQL. É o
  precedente da `013` (FR-167): os dois armazenamentos são escolhas do produto já
  fixadas em `009` e `010`, e não decisões desta feature. FR-187–FR-191 descrevem
  a plugabilidade como comportamento (o que o algoritmo recebe e devolve, e o que
  incluir um novo não pode alterar), e a forma técnica da porta fica no plano.
- **"A feature não contém requisito pertencente a outra feature"**: FR-194
  (Avaliação em 4 níveis no lugar de Acertei/Errei), FR-196 (Avaliação no
  Registro de sessão) e o bloco de Início alteram comportamentos da `004`, da
  `012` e da `013`. A alteração é desta feature e está declarada na tabela
  "Compatibilidade com specs anteriores". Nenhum requisito daquelas specs foi
  duplicado; os transversais (FR-148, FR-150, FR-152–FR-159, FR-161–FR-179) são
  apenas citados.
- **"Os termos usados estão definidos em `CONTEXT.md`"**: Avaliação, Agendamento
  do cartão, Cartão novo, Cartão vencido, Revisão do dia, Estudo livre,
  Preferências e Algoritmo de repetição espaçada foram acrescentados ao glossário
  nesta feature. "Avaliação" saiu do `_Avoid_` de Resultado do item, porque
  passou a ser termo próprio.
- **"Nenhum sinônimo de `_Avoid_` é usado"**: reprovado na primeira conferência.
  A spec usava "atrasado" (evitado em Cartão vencido) em quatro pontos e
  "intervalo" (evitado em Agendamento do cartão) num caso-limite. Foram trocados
  por "vencido há mais tempo" e "próxima revisão". "Revisão do dia" é termo
  definido, e não o sinônimo "revisão" evitado em Sessão de estudo.

A numeração é global no projeto: FR-187–FR-221 e SC-080–SC-090. O
`/speckit-clarify` de 2026-10-02 resolveu os pontos residuais: 20 novos por dia,
lotes de 20, acervo anterior como Cartões novos e a prévia da próxima revisão nos
botões (FR-221).

Nenhum item reprovado após a correção. **20 de 20.**
