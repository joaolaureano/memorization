# Specification Quality Checklist: Porta de Persistência

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

- **Requisitos funcionais**: 12. São 2 transversais reutilizados (FR-044 e
  FR-045) e 10 específicos (FR-100 a FR-109), sem lacuna na numeração.
- **FR-040 não é reutilizado**: o enunciado das features anteriores nomeia a
  entidade preservada ("preservar os Cartões", "preservar os Usuários"). A
  garantia de persistência desta feature é da capacidade de armazenamento e está
  no FR-104, novo e específico. O transversal não é forçado a caber.
- **FR-042 e FR-046 não são reutilizados**: esta feature não acrescenta tela nem
  texto de interface. A única mensagem exigida — a recusa do parâmetro de
  armazenamento — é declarada em português pelo próprio FR-102, e a informação
  do início da execução, pelo FR-108.
- **FR-045 aplicado**: a indisponibilidade do armazenamento é reportada em vez de
  a aplicação seguir como se o armazenamento existisse, o conteúdo já gravado é
  preservado e o mesmo comando pode ser repetido sem nada ser refeito.
- **Critérios de sucesso**: 6, todos novos, SC-038 a SC-043, sem lacuna na
  numeração. Nenhum critério antigo é reutilizado: os de `001` a `006` medem
  comportamento de Cartões, Baralhos, Vínculos e Sessões de estudo, que esta
  feature não altera, e o critério novo para isso é o SC-038, que exige a bateria
  existente passando integralmente.
- **Requisitos negativos**: FR-100, FR-102 e FR-108 têm verificação declarada na
  tabela única "Verificação dos Requisitos Negativos", junto de FR-044, que é
  reutilizado e continua exigindo verificação própria.
- **Rastreabilidade dos cenários-limite**: cada caso-limite tem cenário de
  aceitação correspondente — parâmetro ausente e valor não aceito em FR-102
  (US1, cenários 2 e 3), valor com aparência de credencial em FR-108 (US1,
  cenário 5), arquivo indisponível em FR-044 e FR-045 (US1, cenário 6),
  migrações versionadas e cópia limpa em FR-104 e FR-109 (US2, cenários 3 e 4),
  e caminho configurável do arquivo local em FR-103 (US2, cenário 5).
- **"Sem detalhes de implementação"**: a spec nomeia SQLite e PostgreSQL, o
  arquivo local, o caminho configurável e a URL de conexão porque foi o Product
  Owner quem os nomeou, e a capacidade é operacional. Driver, biblioteca, formato
  do parâmetro, forma dos scripts e desenho da Porta ficam para o `plan`.
- **Escopo da decomposição**: a Porta, o Adapter do armazenamento local, a
  escolha por parâmetro e a bateria compartilhada pertencem a esta feature; o
  Adapter de PostgreSQL, a URL, a proteção da conexão e os scripts de nuvem
  pertencem à `010-postgresql-na-nuvem`, e a divisão está declarada na linha
  Input, na introdução dos requisitos específicos e em "Funcionalidades
  Adiadas".
- **Clarify pendente**: as três premissas marcadas "a confirmar no clarify" —
  escolha na construção e construção local com apenas o que o armazenamento local
  precisa; implementação antes da `007` e da `008`; escuta apenas na máquina
  local — aguardam resposta do Product Owner. Nenhuma delas recebeu marcador
  [NEEDS CLARIFICATION], e a seção `Clarifications` será aberta quando houver
  sessão de clarify.
- **Termos de `CONTEXT.md`**: esta feature não introduz termo de domínio novo e
  não renomeia nenhum termo canônico. Porta, Adapter, armazenamento e parâmetro
  nomeiam a capacidade operacional pedida pelo Product Owner, não o domínio de
  Cartões, Baralhos, Vínculos, Sessão de estudo, Usuário e Credencial. Nenhum
  sinônimo de `_Avoid_` é usado.

Nenhum item reprovado. **21 de 21.**
