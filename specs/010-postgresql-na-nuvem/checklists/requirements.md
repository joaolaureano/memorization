# Specification Quality Checklist: PostgreSQL na Nuvem

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

- **Requisitos funcionais**: 13. São 2 transversais reutilizados (FR-044 e
  FR-045) e 11 específicos (FR-110 a FR-119 e FR-121). O FR-121 veio do clarify;
  o FR-120 pertence à `009`. A faixa
  começa em FR-110, continuando a numeração de `009-porta-de-persistencia`, que
  terminou em FR-109.
- **FR-044 e FR-045 reutilizados com o mesmo enunciado de `009`**: a queda de
  conexão da nuvem é uma indisponibilidade do armazenamento, e o FR-119 a remete
  explicitamente aos dois transversais. Nenhum dos dois é forçado a caber: eles
  descrevem exatamente o que a operação sob conexão caída precisa fazer.
- **FR-040 não é reutilizado**: o enunciado das features anteriores nomeia a
  entidade preservada ("preservar os Cartões", "preservar os Usuários"). A
  persistência entre execuções desta feature é da capacidade de armazenamento e
  está no FR-112, no FR-116 e no SC-049. O transversal não é forçado a caber.
- **FR-042 e FR-046 não são reutilizados**: esta feature não acrescenta tela nem
  texto de interface. A única mensagem exigida — a recusa da URL de conexão — é
  declarada em português pelo próprio FR-114, e a informação do início da
  execução, pelo FR-118.
- **FR-045 aplicado**: a indisponibilidade do armazenamento da nuvem é reportada
  em vez de a aplicação seguir como se o armazenamento existisse, o conteúdo já
  gravado é preservado e a mesma operação pode ser repetida sem nada ser refeito.
- **Critérios de sucesso**: 7, todos novos, SC-044 a SC-050, sem lacuna na
  numeração. A faixa começa em SC-044, continuando a numeração de `009`, que
  terminou em SC-043. Nenhum critério antigo é reutilizado: os de `001` a `006`
  medem comportamento de Cartões, Baralhos, Vínculos e Sessões de estudo, que esta
  feature não altera, e o critério novo para isso é o SC-044, que exige a bateria
  compartilhada passando integralmente contra o Adapter de PostgreSQL.
- **Requisitos negativos**: FR-118, FR-115, FR-117 e FR-044 têm verificação
  declarada na tabela única "Verificação dos Requisitos Negativos". FR-044 é
  reutilizado e continua exigindo verificação própria; FR-118 cobre o segredo da
  URL fora de saída, registro e arquivos versionados; FR-115 cobre a recusa da
  conexão não verificável; FR-117 cobre a exclusividade do script local.
- **Rastreabilidade dos cenários-limite**: cada caso-limite tem cenário de
  aceitação correspondente — URL ausente e malformada em FR-114 (US2, cenários 3 e
  4), URL com aparência de credencial em FR-118 (US3, cenário 3), base nova e
  vazia em FR-116 (US1, cenário 4), conexão não verificável em FR-115 (US3,
  cenário 5), conexão ociosa encerrada pelo provedor em FR-119 (US1, cenário 5),
  armazenamento indisponível em FR-119 e FR-044 (US1, cenário 6), script de início
  local em FR-117 (US2, cenário 1) e script de início da nuvem em FR-117 (US2,
  cenário 5), e segredo de conexão versionado em FR-113 e FR-118 (US3, cenário 4).
- **"Sem detalhes de implementação"**: a spec nomeia PostgreSQL, a URL de
  conexão, a nuvem, a conexão cifrada, a variável de ambiente `DB_URL` e a
  migração versionada porque foi o Product Owner — ou a infraestrutura de nuvem
  existente — quem os nomeou, e a capacidade é operacional. O nome da variável de
  ambiente `DB_URL` é declarado como contrato de integração, e não como escolha de
  implementação. Driver, biblioteca de acesso, formato da URL de conexão, nome dos
  scripts e forma da migração ficam para o `plan`.
- **Escopo da decomposição**: o Adapter de PostgreSQL, a URL de conexão, a
  proteção da conexão, os scripts de nuvem e a migração da base em nuvem
  pertencem a esta feature; a Porta, a bateria compartilhada, o parâmetro de
  construção e o script local pertencem à `009-porta-de-persistencia`, e a divisão
  está declarada na linha Input, na introdução dos requisitos específicos e em
  "Funcionalidades Adiadas".
- **Escopo claramente delimitado**: as "Funcionalidades Adiadas" retiram
  explicitamente o modelo de hospedagem, a migração de dados do armazenamento
  local, o ajuste do conjunto de conexões, as réplicas de leitura e as cópias de
  segurança, alinhando a spec à premissa de que o modelo de hospedagem não faz
  parte do escopo de banco de dados.
- **Clarify pendente**: as três premissas marcadas "a confirmar no clarify" — a
  verificação do Adapter de PostgreSQL sem container, base de teste real ou
  emulação em processo; a migração da base nova no início ou por comando
  explícito; e o desenvolvimento poder apontar a construção da nuvem para um
  PostgreSQL local, entendendo "nuvem" como configuração e não como localização —
  aguardam resposta do Product Owner. Nenhuma delas recebeu marcador [NEEDS
  CLARIFICATION], e a seção `Clarifications` será aberta quando houver sessão de
  clarify.
- **Termos de `CONTEXT.md`**: esta feature não introduz termo de domínio novo e
  não renomeia nenhum termo canônico. Porta, Adapter, armazenamento, URL de
  conexão e migração versionada nomeiam a capacidade operacional pedida pelo
  Product Owner, não o domínio de Cartões, Baralhos, Vínculos, Sessão de estudo,
  Usuário e Credencial. Nenhum sinônimo de `_Avoid_` é usado.

Nenhum item reprovado. **21 de 21.**

### Clarify de 2026-09-21

Três pontos resolvidos:
- verificação contra PostgreSQL real local, por decisão do Arquiteto delegada
  pelo PO;
- migração por comando separado, com o início recusando esquema desatualizado
  (origem do FR-121);
- "nuvem" como configuração, e não como lugar físico.

Continua 21 de 21.
