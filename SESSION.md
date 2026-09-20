# SESSION.md

Registro de auditoria append-only do projeto Memorization.

Eventos anteriores nunca são reescritos para alterar a narrativa. Registram-se
prompts sanitizados, decisões declaradas, ações verificáveis e resultados
observáveis. Raciocínio privado e deliberação interna de modelos não são
registrados. Valores sensíveis são substituídos por `[REDACTED]` antes da
escrita.

Atores: `USER` (Product Owner), `ARCHITECT`, `WORKER`.

## Destaque obrigatório do GitHub Spec Kit

O GitHub Spec Kit é imprescindível a este projeto. A partir de EVT-014, **todo
evento** deve abrir com o banner abaixo, imediatamente após o identificador,
declarando de forma destacada se e como o Spec Kit foi usado:

> **SPEC KIT** — Comando: `<comando ou "nenhum">` | Invocação:
> `<skill/script/CLI>` | Integração: `<claude>` | Artefatos: `<arquivos>`

Quando um evento não envolver o Spec Kit, o banner deve dizê-lo explicitamente
em vez de ser omitido. A ausência do banner é, ela própria, uma falha de
auditoria.

Regra de invocação: os comandos do Spec Kit são executados por suas skills
`speckit-*` e, quando existir script equivalente em `.specify/scripts/bash/`,
por esse script — nunca replicando sua lógica à mão.

---

## EVT-001

- **Data/hora**: 2026-09-20 18:00 -03
- **Ator**: USER
- **Fase**: Descoberta (pré-`specify`)
- **Feature / Task**: —
- **Tipo**: Prompt de abertura — contrato do Arquiteto
- **Skills aplicadas**: —
- **Artefatos envolvidos**: —
- **Comandos**: —

### Prompt completo (sanitizado)

```text
Você atuará como Arquiteto de Software e Orquestrador de um projeto greenfield
desenvolvido predominantemente por agentes de IA. Eu atuarei como Product Owner
e autoridade final sobre escopo, prioridades, decisões difíceis de reverter e
critérios de aceitação. Nesta interação você está em modo de descoberta e
planejamento. Não escreva código, não inicialize frameworks, não escolha
definitivamente a stack, não delegue trabalho a workers, não altere o
repositório e não faça commits.

Visão do produto: aplicação web para estudo por meio de flashcards. O usuário
poderá criar cartões, organizá-los em baralhos e iniciar sessões de estudo
utilizando os cartões de um baralho.

Cartões: frente (questão, palavra, conceito a lembrar) e verso (resposta,
tradução, explicação). Exemplo: frente "To walk", verso "Caminhar".

Baralhos: usuário pode criar; cada um tem nome e reúne cartões de determinado
assunto; precisa de ao menos um cartão para ser estudado.

Sessão de estudo: usuário seleciona baralho elegível, escolhe quantos cartões
estudar, cartões são apresentados em ordem randomizada, inicialmente só a
frente, usuário age para revelar o verso, depois informa se acertou ou errou,
e ao final a sessão apresenta um resumo dos resultados.

Questões que não podem ser presumidas silenciosamente: autenticação e múltiplos
usuários; persistência após fechar a aplicação; edição e exclusão de cartões e
baralhos; relação cartão-baralho (um ou vários); repetição de cartão na mesma
sessão; quantidade solicitada acima do disponível; histórico persistente de
sessões; suporte a texto, imagens, áudio, Markdown e formatação;
responsividade e acessibilidade; algoritmo de repetição espaçada (não confundir
com randomização); confirmação e consequências da exclusão de baralho com
cartões; necessidade de título, descrição ou outras propriedades. Decisão não
essencial ao MVP deve receber alternativa conservadora marcada como
`premissa a validar`.

Linguagem de domínio inicial a refinar via skill de Domain Modeling: Baralho,
Cartão, Sessão de estudo, Item de estudo, Resultado do item, Resumo da sessão.
Não misturar conceitos de domínio com banco, framework, protocolo ou
infraestrutura.

Metodologia obrigatória: Spec-Driven Development com GitHub Spec Kit. Fluxo:
constitution, specify, clarify, plan, checklist, tasks, analyze, implement,
converge. Nenhuma implementação antes de spec, clarify, plan, critérios,
tasks e analyze aprovados. Constituição e artefatos ativos são fontes
normativas; código não inventa nem substitui requisito.

Skills locais obrigatórias: .agents/skills/domain-modeling/SKILL.md e
.agents/skills/codebase-design/SKILL.md. Antes de atividade coberta por skill:
ler integralmente o SKILL.md, ler documentos referenciados relevantes, aplicar
terminologia e critérios, e registrar em SESSION.md qual skill foi aplicada,
por que se aplicava e quais decisões ou artefatos influenciou.

Domain Modeling: usar em descoberta, especificação, clarify, linguagem de
domínio, invariantes, cenários-limite e mudanças funcionais. Desafiar termos
vagos, conflitantes ou sobrecarregados. Termo resolvido vira definição canônica
em CONTEXT.md imediatamente. CONTEXT.md é exclusivamente glossário, sem
arquitetura, banco, frameworks, tarefas ou implementação. Não criar documento
vazio antecipadamente. CONTEXT-MAP.md só se houver múltiplos bounded contexts
reais. ADR somente quando a decisão for simultaneamente difícil de reverter,
surpreendente sem contexto histórico e resultado de trade-off real.

Codebase Design: usar em planejamento arquitetural, desenho de Interfaces,
posicionamento de Seams, decomposição em Modules, definição de Adapters,
estratégia de testes e revisão estrutural. Vocabulário exato: Module, Interface,
Implementation, Depth, Seam, Adapter, Leverage, Locality. Não substituir por
component, service, API ou boundary; bounded context permanece válido no sentido
DDD e não é sinônimo de Seam. Favorecer Modules profundos. Não criar Seam por
especulação: uma Implementation única indica Seam hipotética; Seam torna-se real
com ao menos dois Adapters justificados. Interface é a superfície principal de
testes. Para Interface central, difícil de reverter ou de impacto amplo,
considerar Design It Twice com ao menos três propostas radicalmente diferentes,
comparação e recomendação, aguardando aprovação humana.

Papéis: o Arquiteto esclarece requisitos, mantém artefatos do Spec Kit e o
glossário, elabora e revisa arquitetura, decompõe trabalho, prepara prompts
autocontidos, limita cada worker a uma tarefa, revisa todo diff, executa ou
confere verificações, impede mudanças fora de escopo, mantém rastreabilidade e
é o único integrador e committer salvo autorização explícita. Não aceita
afirmação de worker sem verificar código, testes ou artefatos. Workers recebem
tarefa única com critérios de aceitação, leem artefatos e skills aplicáveis,
conhecem os arquivos que podem alterar, implementam somente o solicitado, criam
ou atualizam testes, executam verificações, devolvem resumo objetivo, não
escolhem requisitos, não alteram arquitetura, não expandem escopo, não fazem
commits e interrompem ao encontrar ambiguidade arquitetural ou conflito de
domínio.

Auditoria obrigatória em SESSION.md na raiz, append-only. Sanitizar antes de
escrever: nunca registrar senhas, tokens, chaves de API ou privadas, cookies,
credenciais, strings de conexão, valores de .env, cabeçalhos de autorização ou
dados pessoais desnecessários; substituir por [REDACTED]; sanitização precede a
escrita. Não registrar raciocínio privado, chain-of-thought ou deliberações
internas. Cada evento deve conter identificador sequencial, data e hora com
timezone, ator, fase do Spec Kit, feature e task IDs quando existirem, tipo do
evento, prompt completo sanitizado quando houver, skills aplicadas, arquivos ou
artefatos envolvidos, comandos relevantes com argumentos sensíveis removidos,
decisão ou resultado objetivo, verificações e resultados, referência ao commit
relacionado quando possível, e confirmação de sanitização sem revelar o conteúdo
removido. Um commit não pode conter o próprio hash: o evento anterior registra a
mensagem proposta e as mudanças incluídas, e o próximo evento auditável registra
o hash do commit anterior; não criar commits extras para registrar hash
autorreferente.

Política de Git: histórico representa a evolução real do produto; commits
pequenos, coesos e funcionalmente significativos; Conventional Commits; relação
com requisitos e task IDs; código, testes, documentação e SESSION.md no mesmo
incremento lógico; não agrupar funcionalidades independentes; não commitar
código quebrado; não usar amend, rebase, squash ou force push sem autorização
explícita; não alterar arquivos não relacionados; preservar mudanças
preexistentes alheias à tarefa; revisar status, diff, verificações e sanitização
antes de cada commit.

Organização inicial em sprints (hipótese a revisar): Sprint 0 governança,
auditoria, Spec Kit, estrutura inicial e decisões técnicas; Sprint 1 primeiro
incremento vertical de baralhos; Sprint 2 primeiro incremento vertical de
cartões; Sprint 3 sessão de estudo completa; Sprint 4 robustez do MVP,
acessibilidade, testes integrados e documentação. Cada sprint deve conter
objetivo, valor ao usuário, escopo incluído e excluído, critérios de aceitação,
tarefas, dependências, testes, riscos, plano de commits e condição objetiva de
conclusão.

Primeira resposta deve entregar somente: interpretação resumida do produto;
perguntas realmente bloqueantes; premissas conservadoras sugeridas; escopo
incluído e excluído; modelo de domínio inicial e cenários-limite; proposta de
sprints; rascunho da constituição; rascunho do primeiro prompt de specify;
decisões técnicas a tratar somente em plan; critérios para autorizar o
bootstrap; termos candidatos a CONTEXT.md sem detalhes técnicos; conflitos ou
ambiguidades encontrados com Domain Modeling; decisões que deverão aplicar
Codebase Design; possíveis Interfaces centrais que justificariam Design It
Twice; e declaração das skills lidas e como influenciaram a proposta. Parar ao
final e aguardar aprovação. Não alterar o repositório.
```

- **Decisão/Resultado**: Contrato do Arquiteto estabelecido. Modo de descoberta
  ativado, com proibição explícita de alterar o repositório.
- **Verificações**: —
- **Commit**: —
- **Sanitização**: Confirmada. Nenhum valor sensível identificado no prompt;
  nenhuma substituição foi necessária.

---

## EVT-002

- **Data/hora**: 2026-09-20 18:05 -03
- **Ator**: ARCHITECT
- **Fase**: Descoberta (pré-`specify`)
- **Feature / Task**: —
- **Tipo**: Leitura de skills e entrega da proposta de descoberta
- **Skills aplicadas**: `domain-modeling`, `codebase-design`
- **Artefatos envolvidos** (leitura, sem escrita):
  - `.agents/skills/domain-modeling/SKILL.md` (74 linhas)
  - `.agents/skills/domain-modeling/CONTEXT-FORMAT.md` (60 linhas)
  - `.agents/skills/domain-modeling/ADR-FORMAT.md` (47 linhas)
  - `.agents/skills/codebase-design/SKILL.md` (114 linhas)
  - `.agents/skills/codebase-design/DEEPENING.md` (37 linhas)
  - `.agents/skills/codebase-design/DESIGN-IT-TWICE.md` (44 linhas)
  - `.specify/memory/constitution.md` (50 linhas, template não preenchido)
- **Comandos**:
  - `graphify query "estrutura do projeto, skills de domain modeling e codebase design, estado atual do spec kit"`
  - `git log --oneline` → repositório sem commits
  - inspeção de `.agents/`, `.specify/`, `graphify-out/`

### Por que as skills se aplicavam

`domain-modeling` se aplicava porque a atividade era descoberta e definição da
linguagem de domínio, com invariantes e cenários-limite. `codebase-design` se
aplicava porque a proposta precisava identificar decisões arquiteturais futuras,
posicionamento de Seams e Interfaces candidatas a Design It Twice.

### Decisões e artefatos influenciados pelas skills

- `domain-modeling` produziu o conflito C1 (sessão temporária versus histórico
  persistente), que virou a questão bloqueante B2; os conflitos C2
  (autoavaliação não é correção), C4 (definição canônica de elegibilidade) e C6
  (nome como rótulo ou chave); os treze cenários-limite iniciais; e o formato do
  glossário proposto, com definições curtas e listas `_Avoid_`.
- A regra "create files lazily" levou a **não** criar `CONTEXT.md` nem
  `CONTEXT-MAP.md`; a regra "offer ADRs sparingly" levou a **não** propor
  nenhuma ADR, por os três critérios ainda não se satisfazerem.
- `codebase-design` determinou o vocabulário literal (Module, Interface,
  Implementation, Depth, Seam, Adapter, Leverage, Locality); a regra
  "two adapters means a real seam" levou a propor Seam real apenas para a
  aleatoriedade e Seam hipotética para a apresentação; "the interface is the
  test surface" virou o Princípio V da constituição; "the deletion test"
  fundamentou a rejeição de Modules de CRUD pass-through; e os critérios de
  `DESIGN-IT-TWICE.md` levaram a qualificar **somente** a Interface do Module de
  Sessão de Estudo, rejeitando baralho, cartão e persistência.

- **Decisão/Resultado**: Entregue proposta de descoberta em quinze seções, com
  4 questões bloqueantes (B1–B4), 13 premissas conservadoras (P1–P13), escopo
  incluído e excluído, modelo de domínio com 13 invariantes e 13 cenários-limite,
  revisão da divisão de sprints, rascunho da constituição, rascunho do prompt de
  `specify`, lista de decisões reservadas ao `plan`, 12 critérios de bootstrap,
  termos candidatos a glossário, 8 conflitos de domínio e 7 decisões de Codebase
  Design. Repositório não alterado, conforme instruído.
- **Verificações**: Confirmado que o rascunho de `specify` não contém linguagem,
  framework, banco, protocolo ou ferramenta.
- **Commit**: —
- **Sanitização**: Confirmada. Nenhum valor sensível envolvido.

---

## EVT-003

- **Data/hora**: 2026-09-20 18:12 -03
- **Ator**: USER
- **Fase**: Descoberta
- **Tipo**: Resposta às questões bloqueantes

### Prompt completo (sanitizado)

```text
B1 - Não tem usuário, por ora. A aplicação vai ser basicamente um app que puxa
dados de banco de dados e aplica o FlashCard, com os baralhos e cards
disponíveis.
B2 - Efêmero. Se cair a luz, desligar o PC, perder conectividade de algum modo,
o app não sabe, e simplesmente habilita um novo treino na próxima vez que o
usuário entrar.
B3 - Um cartão pode pertencer a N baralhos
B4 - Ao atingir o máximo de cartões para um baralho, ele simplesmente desabilita
a opção para linkar novos cartões. O backend também deve validar isso.
P4 - Está errado, ver B3.
P7 - Não entendi.
P9 - Não remove os cartões. Ele só destroi o baralho.
P10 - Correto, vamos incrementar aos poucos.
```

- **Decisão/Resultado**: B1 sem autenticação; B2 sessão efêmera; B3 relação N:N
  entre Cartão e Baralho; P4 descartada; P9 corrigida (exclusão de baralho
  preserva cartões); P10 confirmada. B4 e P7 permaneceram em aberto.
- **Verificações**: —
- **Commit**: —
- **Sanitização**: Confirmada. Nenhum valor sensível identificado.

---

## EVT-004

- **Data/hora**: 2026-09-20 18:15 -03
- **Ator**: ARCHITECT
- **Fase**: Descoberta
- **Tipo**: Análise de consequências e novo desafio de domínio
- **Skills aplicadas**: `domain-modeling`
- **Artefatos envolvidos**: — (nenhuma escrita)
- **Comandos**: —

### Por que a skill se aplicava

Mudança funcional relevante (1:N → N:N) com impacto em invariantes e
cenários-limite, e detecção de termo novo não mapeado.

### Decisões e artefatos influenciados

- "Challenge against the glossary" identificou que a resposta B4 respondia uma
  pergunta diferente da formulada: o Product Owner descreveu um teto de cartões
  por baralho, enquanto a pergunta tratava de quantidade solicitada acima do
  disponível numa sessão. Gerou a questão B5.
- "Sharpen fuzzy language" elevou o termo **Vínculo** a conceito de primeira
  classe (conflito C9), distinguindo desvincular de excluir.
- "Discuss concrete scenarios" revelou C10: sob N:N, cartões podem existir sem
  nenhum baralho e ficariam inalcançáveis sem uma listagem global — escopo novo
  forçado pela decisão B3.
- Gerados ainda C11 (edição propaga a todos os baralhos), C12 (texto de
  confirmação de exclusão muda de tom) e C13 (unicidade do par cartão-baralho).

- **Decisão/Resultado**: Apresentadas as questões B5 (origem do teto) e B6
  (como o cartão nasce), o pedido de confirmação de C10, e as invariantes
  revisadas 3', 4', 6', 14, 15 e 16. Sprints revisadas com deslocamento de
  trabalho para a Sprint 2. Confirmado que o termo "sessão abandonada" deixa de
  existir sob B2.
- **Verificações**: —
- **Commit**: —
- **Sanitização**: Confirmada.

---

## EVT-005

- **Data/hora**: 2026-09-20 18:20 -03
- **Ator**: USER
- **Fase**: Descoberta
- **Tipo**: Resposta a B4, B5, B6, C10, C12, C13

### Prompt completo (sanitizado)

```text
B4 - opção A.
B5 - Eu havia entendido que o baralho teria um limite. Não deve ter.
B6 - Não. Ele é criado avulso, e o usuário pode ou não linkar a um baralho. Na
prática, ele só faz sentido linkado, mas são 2 processos diferentes.
C10. Sim, teremos uma listagem, como se fosse uma tela de configuração. Ali, o
usuário terá acesso aos cartões e sua configuração. Também terá acesso ao link
do baralho. Nos baralhos, ele terá o inverso, sua configuração e os cartões
linkados.
C12 - Se você deleta um cartão, ele some do baralho, mas o baralho NÃO é
destruído. Se você deleta um baralho, ele some das informações do Cartão, mas o
cartão NÃO é destruído.
C13 - Verdadeiro, Cartão X só se linka ao baralho B 0 ou 1 vez.
```

- **Decisão/Resultado**: B4 opção (a), limitar ao disponível com aviso; B5 não
  há teto, invariante 16 anterior descartada; B6 cartão nasce avulso e vincular
  é ato separado; C10 confirmado com duas telas simétricas; C12 exclusão
  simétrica e não-cascateante; C13 par único confirmado.
- **Verificações**: —
- **Commit**: —
- **Sanitização**: Confirmada.

---

## EVT-006

- **Data/hora**: 2026-09-20 18:24 -03
- **Ator**: ARCHITECT
- **Fase**: Descoberta
- **Tipo**: Desafio de termo e revisão de sprints
- **Skills aplicadas**: `domain-modeling`
- **Artefatos envolvidos**: — (nenhuma escrita)
- **Comandos**: —

### Decisões e artefatos influenciados

- "Sharpen fuzzy language" desafiou o termo **configuração**, usado pelo Product
  Owner sem conteúdo definido, gerando a questão B7 — se existiam propriedades
  ajustáveis ainda não mapeadas, que exigiriam migração se adicionadas depois.
- Consequência de B6 identificada e apresentada: como o cartão nasce avulso, são
  necessários três atos para chegar à primeira sessão, logo o vínculo precisa
  entrar na Sprint 1, sob pena de a sprint terminar sem baralho elegível.

- **Decisão/Resultado**: Apresentada a lista consolidada de 16 invariantes, as
  sprints revisadas (Sprint 1 passa a "Captura e vínculo", Sprint 2 "Curadoria")
  e as pendências P2, P5, P6, P8, P11, P12, C6, C8 com defaults propostos.
  Declarada a tensão de processo entre a regra "update CONTEXT.md inline" da
  skill e a proibição de alterar o repositório imposta pelo Product Owner,
  resolvida a favor da instrução do Product Owner.
- **Verificações**: —
- **Commit**: —
- **Sanitização**: Confirmada.

---

## EVT-007

- **Data/hora**: 2026-09-20 18:28 -03
- **Ator**: USER
- **Fase**: Descoberta
- **Tipo**: Resposta a B7, aceite de pendências e observação de escopo

### Prompt completo (sanitizado)

```text
B7 - Configurações são os dados que temos públicos para Cartão e Baralho. O nome
e os links entre cada um. Na tela de Cartão, teremos o nome e os baralhos
linkados, na tela de Baralho, teremos o nome e os cartões linkados. Até o
momento, aceite sim.
OBS: Não se preocupe com "métricas de quanto acertou ou errou" por ora.
Simplesmente um frontend avisando, nesse primeiro MVP, já me basta.
```

- **Decisão/Resultado**: "Configuração" resolvido como Edição mais Vínculos, sem
  propriedades adicionais; termo banido do glossário. Aceitas as premissas P2,
  P5, P6, P8, P11, P12 e os defaults de C6, C8 e C11. A observação sobre métricas
  e a menção a "nome" do Cartão permaneceram ambíguas e geraram B8 e B9.
- **Verificações**: —
- **Commit**: —
- **Sanitização**: Confirmada.

---

## EVT-008

- **Data/hora**: 2026-09-20 18:31 -03
- **Ator**: ARCHITECT
- **Fase**: Descoberta
- **Tipo**: Desafio de conflito interno e de mudança de escopo
- **Skills aplicadas**: `domain-modeling`, `codebase-design`
- **Artefatos envolvidos**: — (nenhuma escrita)
- **Comandos**: —

### Decisões e artefatos influenciados

- "Challenge against the glossary" detectou contradição dentro da própria
  mensagem do Product Owner: ele afirmou que a tela de Cartão exibe "o nome",
  enquanto a premissa P11 que acabara de aceitar define o cartão como tendo
  apenas frente e verso. Gerou B8.
- A observação sobre métricas foi tratada como potencial mudança de escopo sobre
  o **Resumo da sessão**, que constava da visão original do Product Owner e do
  seu glossário inicial. Gerou B9, com as duas leituras explicitadas em vez de
  presumidas.
- `codebase-design`: registrado o sinal arquitetural de que, sob B2, B4a e a
  observação, o Module de Sessão de Estudo não atravessa Seam de persistência
  alguma — o servidor serve cartões e baralhos e não sabe que sessões existem.
  Reforça a escolha dessa Interface para `Design It Twice` na Sprint 0.

- **Decisão/Resultado**: Apresentadas B8 e B9 com defaults propostos, (a) em
  ambos os casos.
- **Verificações**: —
- **Commit**: —
- **Sanitização**: Confirmada.

---

## EVT-009

- **Data/hora**: 2026-09-20 18:33 -03
- **Ator**: USER
- **Fase**: Descoberta
- **Tipo**: Resposta final às questões bloqueantes

### Prompt completo (sanitizado)

```text
1 - Errei. Ele tem Frente e Verso apenas.
2 - opção A
```

- **Decisão/Resultado**: B8 resolvido — Cartão tem apenas frente e verso,
  nenhuma propriedade adicional; a menção a "nome" foi erro de redação. B9
  resolvido — o Resumo da sessão permanece no MVP, calculado na hora e
  descartado com a sessão; o que sai de escopo é o maquinário de métricas
  acumuladas. Descoberta encerrada sem questões bloqueantes pendentes.
- **Verificações**: —
- **Commit**: —
- **Sanitização**: Confirmada.

---

## EVT-010

- **Data/hora**: 2026-09-20 18:35 -03
- **Ator**: ARCHITECT
- **Fase**: Descoberta → fechamento
- **Tipo**: Consolidação e pedido de autorização de bootstrap
- **Skills aplicadas**: `domain-modeling`, `codebase-design`
- **Artefatos envolvidos**: — (nenhuma escrita)
- **Comandos**: —

- **Decisão/Resultado**: Apresentados a tabela consolidada de decisões (B1–B9,
  C6, C8, C11, C12, C13, P1–P13), o conteúdo integral proposto para `CONTEXT.md`
  no formato de `CONTEXT-FORMAT.md`, o prompt de `specify` revisado para refletir
  N:N e criação avulsa (o rascunho original de EVT-002 tornou-se obsoleto ao
  assumir P4), o status dos 12 critérios de bootstrap e o pedido de autorização
  para cinco ações delimitadas.
- **Verificações**: Confirmado que o prompt revisado de `specify` permanece livre
  de linguagem, framework, banco, protocolo e ferramenta.
- **Commit**: —
- **Sanitização**: Confirmada.

---

## EVT-011

- **Data/hora**: 2026-09-20 18:36 -03
- **Ator**: USER
- **Fase**: Descoberta → `constitution`
- **Tipo**: Autorização de bootstrap

### Prompt completo (sanitizado)

```text
Tudo Ok. Pode ser aprovado. Lembre-se de Session.MD, será crucial para esse
Github
```

- **Decisão/Resultado**: Autorizadas as cinco ações delimitadas: criar
  `SESSION.md`, criar `CONTEXT.md`, ratificar a constituição em
  `.specify/memory/constitution.md` com data 2026-09-20 e versão 1.0.0, realizar
  o commit correspondente e executar `specify`. Constituição aprovada sem
  alterações. Reforçada a criticidade do `SESSION.md` como artefato de auditoria
  do repositório.
- **Verificações**: —
- **Commit**: —
- **Sanitização**: Confirmada.

---

## EVT-012

- **Data/hora**: 2026-09-20 18:38 -03
- **Ator**: ARCHITECT
- **Fase**: `constitution`
- **Feature / Task**: —
- **Tipo**: Criação dos artefatos de governança e commit
- **Skills aplicadas**: `domain-modeling`
- **Artefatos envolvidos** (escrita):
  - `SESSION.md` (criado)
  - `CONTEXT.md` (criado)
  - `.specify/memory/constitution.md` (template substituído pela constituição
    ratificada)
- **Comandos**:
  - `git add SESSION.md CONTEXT.md .specify/memory/constitution.md`
  - `git commit` com a mensagem abaixo

### Por que a skill se aplicava

`domain-modeling` cobre a escrita do glossário. Os onze termos registrados em
`CONTEXT.md` foram os resolvidos ao longo de EVT-001 a EVT-009. O arquivo foi
criado somente agora, na primeira oportunidade autorizada, conforme a regra
"create files lazily" e a proibição de alterar o repositório durante a
descoberta. Nenhum detalhe de implementação foi incluído, conforme a regra de
que `CONTEXT.md` é exclusivamente glossário.

### Mensagem de commit proposta

```text
chore(project): ratify constitution and establish domain glossary

Encerra a fase de descoberta do MVP de flashcards.

- CONTEXT.md: glossário com 11 termos canônicos resolvidos durante a
  descoberta, agrupados em Conteúdo e Estudo, com listas _Avoid_.
- .specify/memory/constitution.md: constituição 1.0.0 ratificada em
  2026-09-20, com 7 princípios, skills obrigatórias, fluxo do Spec Kit e
  política de Git.
- SESSION.md: registro de auditoria append-only dos eventos EVT-001 a
  EVT-012.

Decisões de domínio consolidadas: sem autenticação; sessão de estudo
efêmera; relação N:N entre Cartão e Baralho via Vínculo; cartão criado
avulso; exclusão não-cascateante; quantidade de sessão limitada ao
disponível; sem repetição espaçada.
```

- **Decisão/Resultado**: Três artefatos de governança criados. Nenhum arquivo de
  código, framework ou estrutura de projeto foi criado — a stack permanece
  indecidida até o `plan`.
- **Verificações**: `CONTEXT.md` verificado como livre de arquitetura, banco,
  framework e tarefas. `constitution.md` verificado sem placeholders
  remanescentes do template.
- **Commit**: hash registrado no próximo evento auditável, conforme a regra de
  não autorreferência.
- **Sanitização**: Confirmada. Os três arquivos foram inspecionados antes da
  escrita; nenhum segredo, credencial, token, string de conexão ou dado pessoal
  foi identificado, e nenhuma substituição por `[REDACTED]` foi necessária.

---

## EVT-013

- **Data/hora**: 2026-09-20 18:45 -03
- **Ator**: ARCHITECT
- **Fase**: `specify`
- **Feature / Task**: `001-flashcard-study-mvp` / —
- **Tipo**: Execução de `specify` e validação de qualidade
- **Skills aplicadas**: `domain-modeling`
- **Artefatos envolvidos** (escrita):
  - `specs/001-flashcard-study-mvp/spec.md` (criado, 360 linhas)
  - `specs/001-flashcard-study-mvp/checklists/requirements.md` (criado)
  - `.specify/feature.json` (criado)
- **Comandos**:
  - verificação de `.specify/extensions.yml` → arquivo inexistente, nenhum hook
    registrado, nenhum hook executado
  - leitura de `.specify/init-options.json` → `feature_numbering: sequential`
  - leitura de `.specify/templates/spec-template.md`
  - `mkdir -p specs/001-flashcard-study-mvp/checklists`
  - `git rev-parse HEAD`

### Commit anterior

O commit descrito em EVT-012 foi criado com o hash
`9a36406b563ed5a29b7c65860d47d9f31f6fcf13`, contendo `SESSION.md`,
`CONTEXT.md` e `.specify/memory/constitution.md`. Nenhum outro arquivo foi
incluído; `.agents/`, `.github/`, `.gitignore`, `graphify-out/`,
`skills-lock.json`, `.serena/` e `.DS_Store` permanecem não rastreados.

### Por que a skill se aplicava

`domain-modeling` cobre a especificação. A spec foi redigida usando
exclusivamente os termos canônicos de `CONTEXT.md`, e nenhum termo das listas
`_Avoid_` foi introduzido.

### Decisões e artefatos influenciados

- As 16 invariantes consolidadas na descoberta foram traduzidas em requisitos
  funcionais verificáveis: FR-020 (unicidade do Vínculo), FR-024
  (elegibilidade), FR-029 (limitação ao disponível), FR-031 (sem repetição na
  sessão), FR-034 e FR-035 (ordem revelação → resultado, resultado imutável),
  FR-037 (resumo completo e somatório coerente), FR-038 e FR-039 (sessão nunca
  persistida).
- Os cenários-limite levantados na descoberta viraram a seção Edge Cases,
  incluindo o caso de cartão sem nenhum baralho, que só existe por causa da
  decisão B3.
- Nenhum marcador `[NEEDS CLARIFICATION]` foi necessário, por todas as questões
  bloqueantes terem sido resolvidas em EVT-003 a EVT-009.

- **Decisão/Resultado**: Especificação criada com 3 histórias de usuário
  priorizadas (P1, P1, P2), 43 requisitos funcionais, 10 entidades de domínio,
  10 critérios de sucesso mensuráveis e tecnologicamente neutros, 11
  cenários-limite e 10 premissas declaradas. Dois requisitos negativos
  explícitos registram exclusões de escopo como regra verificável: FR-009
  (cartão sem propriedades além de frente e verso) e FR-018 (baralho sem
  propriedades além de nome).
- **Verificações**: Checklist de qualidade executado em uma iteração, 16 de 16
  itens aprovados, nenhuma falha e nenhum marcador de clarificação pendente.
  Confirmado que a spec não contém linguagem, framework, banco de dados,
  protocolo ou ferramenta.
- **Commit**: pendente de aprovação do Product Owner; artefatos deste evento
  permanecem não commitados.
- **Sanitização**: Confirmada. Os três arquivos foram inspecionados antes da
  escrita; nenhum segredo, credencial, token, string de conexão ou dado pessoal
  foi identificado, e nenhuma substituição por `[REDACTED]` foi necessária.

---

## EVT-014

> **SPEC KIT** — Comando: `nenhum` (evento de governança de auditoria) |
> Invocação: `nenhuma` | Integração: `claude` (trocada de `copilot` neste
> evento) | Artefatos: `SESSION.md`

- **Data/hora**: 2026-09-20 19:05 -03
- **Ator**: USER → ARCHITECT
- **Fase**: `specify` (concluída) — governança de auditoria
- **Feature / Task**: `001-flashcard-study-mvp` / —
- **Tipo**: Verificação do uso do Spec Kit, troca de integração e emenda do
  formato de auditoria
- **Skills aplicadas**: —
- **Artefatos envolvidos**: `SESSION.md` (preâmbulo emendado)
- **Comandos**:
  - `which specify` / `specify --version` → `specify 1.0.9.dev0` instalado
  - `bash .specify/scripts/bash/resolve-template.sh spec-template` → conteúdo
    idêntico a `.specify/templates/spec-template.md`
  - `bash .specify/scripts/bash/create-new-feature.sh --dry-run --json
    --short-name flashcard-study-mvp` → `002-flashcard-study-mvp`, valor 002
    apenas porque `001-` já existe
  - `bash .specify/scripts/bash/check-prerequisites.sh --json` → resolveu
    `specs/001-flashcard-study-mvp`; único erro `plan.md not found`, esperado
  - `specify check`
  - leitura de `.specify/integration.json` e `.specify/init-options.json`

### Prompt do Product Owner (sanitizado)

```text
Você está fazendo uso de ferramentas do Github Spec Kit? Isso é crucial. Ele é
imprescindível.
```

```text
OK, o que você deve fazer, em Session.MD, é deixar claro que foi usado, de modo
destacado em cada interação que tivermos. Isso é crucial para a construção de
nosso projeto. Spec Kit já foi trocado para Claude Code agora
```

### Verificação declarada pelo Arquiteto

Em EVT-013 o comando `specify` foi executado por meio da skill
`speckit-specify`, cujas instruções governaram numeração sequencial, layout
`specs/NNN-<short-name>/`, uso de `spec-template.md`, conteúdo do checklist de
qualidade, limite de marcadores de clarificação e escrita de
`.specify/feature.json`. Os arquivos, porém, foram escritos manualmente em vez
de invocar `create-new-feature.sh`. A equivalência foi verificada a posteriori
pelos comandos acima e confirmada nos quatro pontos: template idêntico,
numeração idêntica, formato relativo de `feature.json` idêntico, e artefatos
resolvidos corretamente por `check-prerequisites.sh`.

Registra-se a lacuna sem atenuá-la: a verificação foi necessária porque a
lógica do script foi replicada à mão. A regra de invocação adicionada ao
preâmbulo existe para que isso não se repita.

### Troca de integração

`.specify/integration.json` e `.specify/init-options.json` passaram de
`copilot` para `claude`. Os artefatos do Copilot em `.github/` foram removidos.
As dez skills `speckit-*` estão disponíveis em `.claude/skills/`. A troca foi
realizada pelo Product Owner fora desta sessão e apenas verificada aqui.

### Emenda do formato de auditoria

Por determinação do Product Owner, todo evento a partir de EVT-014 abre com um
banner **SPEC KIT** destacado, declarando comando, invocação, integração e
artefatos, inclusive quando o Spec Kit não for usado. A emenda foi aplicada ao
preâmbulo do arquivo, que não é um evento. Nenhum evento anterior foi
reescrito, em observância ao Princípio II da constituição: a narrativa de
EVT-001 a EVT-013 permanece exatamente como foi registrada, e o status
retroativo de cada um é declarado abaixo como conteúdo novo.

### Status retroativo do Spec Kit, EVT-001 a EVT-013

| Evento | Comando Spec Kit | Invocação | Integração |
|---|---|---|---|
| EVT-001 | nenhum — prompt de abertura | — | copilot |
| EVT-002 | nenhum — descoberta, leitura de skills locais | — | copilot |
| EVT-003 | nenhum — resposta do Product Owner | — | copilot |
| EVT-004 | nenhum — análise de domínio | — | copilot |
| EVT-005 | nenhum — resposta do Product Owner | — | copilot |
| EVT-006 | nenhum — análise de domínio | — | copilot |
| EVT-007 | nenhum — resposta do Product Owner | — | copilot |
| EVT-008 | nenhum — análise de domínio | — | copilot |
| EVT-009 | nenhum — resposta do Product Owner | — | copilot |
| EVT-010 | nenhum — consolidação e pedido de autorização | — | copilot |
| EVT-011 | nenhum — autorização do Product Owner | — | copilot |
| EVT-012 | `constitution` — artefato escrito em `.specify/memory/constitution.md` | escrita direta do artefato | copilot |
| EVT-013 | `specify` | skill `speckit-specify`, arquivos escritos à mão | copilot |

- **Decisão/Resultado**: Uso do Spec Kit verificado e documentado. Integração
  em `claude`. Formato de auditoria emendado com banner obrigatório. Regra de
  invocação estabelecida: usar as skills `speckit-*` e, havendo script
  equivalente em `.specify/scripts/bash/`, usar o script em vez de replicar sua
  lógica.
- **Verificações**: Quatro verificações de equivalência executadas e aprovadas.
  Troca de integração confirmada nos dois arquivos de estado. Nenhum evento
  anterior foi modificado.
- **Commit**: pendente de aprovação do Product Owner.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado; nenhuma
  substituição por `[REDACTED]` foi necessária.

---

## EVT-015

> **SPEC KIT** — Comando: `nenhum` (integração de artefatos já produzidos) |
> Invocação: `nenhuma` | Integração: `claude` | Artefatos:
> `specs/001-flashcard-study-mvp/spec.md`,
> `specs/001-flashcard-study-mvp/checklists/requirements.md`, `SESSION.md`

- **Data/hora**: 2026-09-20 19:12 -03
- **Ator**: USER → ARCHITECT
- **Fase**: `specify` → integração
- **Feature / Task**: `001-flashcard-study-mvp` / —
- **Tipo**: Criação do branch de feature e commit da especificação
- **Skills aplicadas**: —
- **Artefatos envolvidos**:
  - `specs/001-flashcard-study-mvp/spec.md`
  - `specs/001-flashcard-study-mvp/checklists/requirements.md`
  - `SESSION.md`
- **Comandos**:
  - `git checkout -b 001-flashcard-study-mvp`
  - `git add` dos três arquivos, nomeadamente
  - `git commit`

### Prompt do Product Owner (sanitizado)

```text
Continue
```

Interpretado como aval para as duas pendências declaradas ao fim de EVT-014:
commitar os artefatos de `specify` e criar o branch de feature.

### Convenção de branch

O branch `001-flashcard-study-mvp` adota o nome que
`create-new-feature.sh` produziria para esta feature, mantendo a correspondência
com o diretório `specs/001-flashcard-study-mvp`. O commit de governança
`9a36406b563ed5a29b7c65860d47d9f31f6fcf13` permanece em `main`; o trabalho da
feature passa a ocorrer no branch.

### Mensagem de commit proposta

```text
docs(spec): define flashcard MVP requirements

Especificação da feature 001-flashcard-study-mvp, produzida pelo comando
specify do Spec Kit.

- 3 histórias de usuário priorizadas (P1, P1, P2), cada uma testável de
  forma independente
- 43 requisitos funcionais, incluindo FR-009 e FR-018 como requisitos
  negativos que travam o escopo de propriedades de Cartão e Baralho
- 10 entidades de domínio alinhadas ao glossário canônico de CONTEXT.md
- 10 critérios de sucesso mensuráveis e tecnologicamente neutros
- 11 cenários-limite e 10 premissas declaradas
- checklist de qualidade: 16 de 16 itens aprovados, nenhum marcador
  [NEEDS CLARIFICATION] remanescente

SESSION.md: eventos EVT-013 a EVT-015, incluindo a emenda que torna
obrigatório o banner de destaque do Spec Kit em cada evento.
```

- **Decisão/Resultado**: Branch de feature criado e artefatos de `specify`
  integrados. Nenhum arquivo fora do escopo da feature foi incluído:
  `.agents/`, `.gitignore`, `graphify-out/`, `skills-lock.json`,
  `.serena/` e `.DS_Store` permanecem não rastreados, pendentes de decisão do
  Product Owner.
- **Verificações**: `check-prerequisites.sh --json` já havia confirmado, em
  EVT-014, que os artefatos são resolvidos corretamente pelo Spec Kit.
- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado nos arquivos
  incluídos; nenhuma substituição por `[REDACTED]` foi necessária.

---

## EVT-016

> **SPEC KIT** — Comando: `clarify` | Invocação: skill `speckit-clarify` +
> script `.specify/scripts/bash/check-prerequisites.sh --json --paths-only` |
> Integração: `claude` | Artefatos:
> `specs/001-flashcard-study-mvp/spec.md`

- **Data/hora**: 2026-09-20 19:25 -03
- **Ator**: ARCHITECT ↔ USER
- **Fase**: `clarify`
- **Feature / Task**: `001-flashcard-study-mvp` / —
- **Tipo**: Execução de `clarify` com quatro perguntas respondidas
- **Skills aplicadas**: `domain-modeling`
- **Artefatos envolvidos**: `specs/001-flashcard-study-mvp/spec.md` (editado),
  `specs/001-flashcard-study-mvp/checklists/requirements.md` (revalidado, sem
  alteração)
- **Comandos**:
  - `bash .specify/scripts/bash/check-prerequisites.sh --json --paths-only` →
    branch `001-flashcard-study-mvp`, spec resolvida
  - verificação de `.specify/extensions.yml` → inexistente, nenhum hook

### Commit anterior

O commit descrito em EVT-015 foi criado com o hash `e2eb3220d5be76bf6c2df855893e3ab9e8293b75`, no branch
`001-flashcard-study-mvp`, contendo `spec.md`, `checklists/requirements.md`
e `SESSION.md`.

### Varredura de ambiguidade

Categorias **Clear** na entrada: escopo funcional, modelo de domínio,
terminologia, fluxo de interação, casos-limite e sinais de conclusão — efeito da
descoberta registrada em EVT-001 a EVT-011. Lacunas concentradas nos atributos
não-funcionais, deliberadamente não cobertos pela descoberta.

### Perguntas e respostas do Product Owner

1. **Exposição e privacidade** — "A aplicação vai rodar apenas na máquina do
   usuário, ou ficar hospedada numa URL que outras pessoas conseguem abrir?"
   → *"Inicialmente, Local. Futuramente, AWS."*
2. **Escala do acervo** — "Quantos cartões e baralhos a aplicação precisa exibir
   confortavelmente antes que a falta de paginação ou busca atrapalhe?"
   → Opção A: até ~50 Cartões e ~10 Baralhos.
3. **Falha de persistência** — "O que o usuário deve ver se uma operação de
   gravar, editar ou excluir falhar?"
   → Opção A: falha reportada, interface não finge sucesso, conteúdo preservado
   para nova tentativa.
4. **Idioma da interface** — "Em que idioma a interface deve falar com o
   usuário?"
   → Opção A: português, com os termos canônicos de `CONTEXT.md`.

### Alterações aplicadas à spec

- Seção `## Clarifications` criada com `### Session 2026-09-20` e quatro
  registros.
- **FR-044** e **FR-045**: nenhuma operação não persistida pode ser apresentada
  como concluída; falha reportada com preservação do conteúdo informado.
- **FR-046**: interface em português com os termos canônicos do glossário, e
  proibição explícita dos sinônimos listados como `_Avoid_`.
- **SC-011**: listas navegáveis com 50 Cartões e 10 Baralhos sem busca nem
  paginação.
- **SC-012**: nenhuma operação aparece como concluída e nenhum conteúdo é perdido
  em falhas de gravação.
- **Edge Cases**: caso de falha de persistência adicionado.
- **Assumptions**: execução local registrada como condição de segurança da
  ausência de autenticação; hospedagem remota declarada como direção futura fora
  de escopo; escala do acervo como justificativa da exclusão de busca e
  paginação; interface monolíngue.

### Decisão de domínio registrada

A ausência de autenticação deixa de ser premissa isolada e passa a ser
**condicional à execução local**. A spec declara que expor a aplicação
publicamente exigiria reabrir a decisão B1, por transformar o acervo único em
acervo compartilhado e editável por qualquer visitante.

### Mensagem de commit proposta

```text
docs(spec): clarify deployment, scale, failure and language constraints

Executa o comando clarify do Spec Kit sobre a feature
001-flashcard-study-mvp. Quatro perguntas respondidas pelo Product Owner,
todas nas categorias nao-funcionais que a descoberta nao cobria.

- FR-044, FR-045: operacao nao persistida nunca aparece como concluida;
  falha reportada com preservacao do conteudo informado
- FR-046: interface em portugues com os termos canonicos de CONTEXT.md
- SC-011: listas navegaveis com 50 cartoes e 10 baralhos sem busca
- SC-012: nenhuma perda de conteudo em falha de gravacao
- Edge Cases: falha de persistencia
- Assumptions: execucao local como condicao de seguranca da ausencia de
  autenticacao; hospedagem remota como direcao futura fora de escopo

Checklist de qualidade revalidado: 16/16 itens mantidos aprovados.
```

- **Decisão/Resultado**: `clarify` concluído com 4 de no máximo 5 perguntas.
  Nenhuma categoria de alto impacto permanece não resolvida. Spec passa de 43
  para 46 requisitos funcionais e de 10 para 12 critérios de sucesso.
- **Verificações**: 4 registros em Clarifications, um por resposta, sem
  duplicatas. Nenhum marcador `[NEEDS CLARIFICATION]`. Estrutura markdown
  íntegra, apenas os cabeçalhos permitidos adicionados. Checklist de qualidade
  revalidado item a item: 16 de 16 mantidos aprovados, nenhuma mudança de
  estado, arquivo não modificado para evitar diff cosmético.
- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado; nenhuma
  substituição por `[REDACTED]` foi necessária.

---

## EVT-017

> **SPEC KIT** — Comando: `plan` | Invocação: skill `speckit-plan` + script
> `.specify/scripts/bash/setup-plan.sh --json` | Integração: `claude` |
> Artefatos: `plan.md`, `research.md`, `data-model.md`,
> `contracts/api-acervo.md`, `quickstart.md`

- **Data/hora**: 2026-09-20 19:45 -03
- **Ator**: USER → ARCHITECT
- **Fase**: `plan`
- **Feature / Task**: `001-flashcard-study-mvp` / —
- **Tipo**: Decisão de stack pelo Product Owner e execução de `plan`
- **Skills aplicadas**: `codebase-design`, `domain-modeling`
- **Artefatos envolvidos** (escrita): os cinco listados no banner
- **Comandos**:
  - `bash .specify/scripts/bash/setup-plan.sh --json` → `plan.md` copiado do
    template resolvido
  - verificação de `.specify/extensions.yml` → inexistente, nenhum hook

### Commit anterior

O commit descrito em EVT-016 foi criado com o hash `e32ea56d6ca1cfb102637c30a33e5da51d2b78c5`.

### Decisões de stack do Product Owner

Apresentadas como três escolhas, por serem difíceis de reverter e portanto de
autoridade do Product Owner conforme o contrato de EVT-001:

1. **Linguagem**: TypeScript em toda a stack.
2. **Forma**: frontend e API separados, dois deployables independentes.
3. **Armazenamento**: SQLite em arquivo local, sem Docker.

Registra-se que a opção recomendada pelo Arquiteto para a forma era aplicação
única full-stack; o Product Owner escolheu frontend e API separados, e o plano
foi elaborado sobre a escolha dele.

### Por que as skills se aplicavam

`codebase-design` cobre planejamento arquitetural, desenho de Interfaces,
posicionamento de Seams, decomposição em Modules, definição de Adapters e
estratégia de testes. `domain-modeling` cobre a correspondência entre o modelo
de dados e o glossário canônico.

### Decisões e artefatos influenciados

- **Quatro Modules** definidos: `Acervo` no servidor; `SessaoDeEstudo`,
  `Aleatoriedade` e `ClienteDoAcervo` no cliente.
- **Duas Seams criadas**, cada uma com dois Adapters justificados: Aleatoriedade
  (real e determinística, sem a qual a invariante de ordem imutável é
  intestável) e ClienteDoAcervo (HTTP e em memória, categoria *remote but owned*
  de `DEEPENING.md`).
- **Duas Seams rejeitadas** pela regra "uma Implementation indica Seam
  hipotética": o repositório de persistência, por SQLite ser dependência
  *local-substitutable* cujo stand-in é o próprio SQLite em memória — mesmo
  driver, configurações diferentes, portanto um Adapter só; e o Adapter de
  apresentação da Sessão, por haver uma única interface consumidora.
- **Estrutura por Module, não por camada**: não existem diretórios `models/`,
  `services/` ou `controllers/`.
- **O contrato HTTP não possui rota de Sessão**, tornando FR-038 visível na
  superfície da API.
- **A semântica não-cascateante virou propriedade do esquema**: nenhuma chave
  estrangeira liga `cartao` a `baralho`, e a cascata alcança apenas
  `vinculo`. FR-008 e FR-017 deixam de depender de disciplina do programador.
- **A unicidade do Vínculo virou chave primária composta**, satisfazendo FR-020
  no esquema.
- **Elegibilidade não é campo persistido**, é derivada por contagem (FR-024).
- Nove omissões deliberadas registradas em `research.md` sob o Princípio VII,
  entre elas ORM, camada de repositório, gerenciador de estado global,
  paginação e migrações versionadas.

### Pendência declarada e bloqueante

A **Interface do Module `SessaoDeEstudo` não foi decidida**. É candidata a
`Design It Twice` por ser central, difícil de reverter e de impacto amplo. O
processo exige aprovação humana explícita, ainda não concedida, e envolve
subagentes paralelos — que as instruções globais do usuário só permitem mediante
pedido. A pendência bloqueia a Sprint 3.

- **Decisão/Resultado**: Cinco artefatos de design criados. Constitution Check
  aprovado nos sete princípios antes de Phase 0 e re-avaliado após Phase 1 sem
  alteração. Complexity Tracking vazio: nenhuma violação a justificar.
- **Verificações**: Nenhum marcador `NEEDS CLARIFICATION` remanescente.
  Vocabulário de `codebase-design` usado literalmente, sem substituição por
  component, service, API ou boundary. Nomes de tabela e coluna conferidos
  contra `CONTEXT.md`, sem sinônimos de `_Avoid_`.
- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado nos cinco
  artefatos; nenhuma substituição por `[REDACTED]` foi necessária.

---

## EVT-018

> **SPEC KIT** — Comando: `constitution` (emenda) | Invocação: skill
> `speckit-constitution` + script
> `.specify/scripts/bash/resolve-template.sh constitution-template --json` |
> Integração: `claude` | Artefatos: `.specify/memory/constitution.md`,
> `.gitignore`

- **Data/hora**: 2026-09-20 20:05 -03
- **Ator**: USER → ARCHITECT
- **Fase**: `constitution` (emenda) — governança
- **Feature / Task**: — (governança do repositório, não da feature)
- **Tipo**: Recebimento do Prompt 2 fora de ordem, análise de lacunas e emenda
- **Skills aplicadas**: `domain-modeling` e `codebase-design` já lidas
  integralmente em EVT-002; nenhuma releitura necessária, nenhuma decisão de
  domínio ou de estrutura alterada por este evento
- **Artefatos envolvidos**: `.specify/memory/constitution.md` (emendado para
  1.1.0), `.gitignore` (revisado)
- **Comandos**:
  - `git log --oneline`, `git branch -a`, `git status --short`,
    `git ls-files`
  - `specify check`
  - `bash .specify/scripts/bash/check-prerequisites.sh --json --paths-only`
  - `bash .specify/scripts/bash/resolve-template.sh constitution-template --json`
  - varredura de segredos por `grep` sobre arquivos versionados e sobre os
    arquivos a versionar
  - busca por código funcional de aplicação por `find`

### Commit anterior

O commit descrito em EVT-017 foi criado com o hash `aa25ef4899d1da1f549ac073dea1ede1910cab66`.

### Prompt 2 do Product Owner (sanitizado, resumido nas suas determinações)

Prompt de bootstrap auditável, recebido **após** o bootstrap já ter ocorrido.
Determina: leitura integral das duas skills; inspeção de repositório, Git e
instalação do Spec Kit; preservação do preexistente; não reinicializar
instalação saudável; usar a integração do Spec Kit destinada ao Arquiteto, sem
integração própria para o Aider, que é executor de tarefas; criar SESSION.md
registrando Prompt 1, respostas do Product Owner, o próprio Prompt 2, decisões,
inspeções, skills e premissas abertas; executar `constitution` estabelecendo
treze itens mínimos; criar CONTEXT.md apenas se os termos estiverem resolvidos;
configurar ou revisar `.gitignore`; verificar ausência de segredos e de código
funcional; e commitar com mensagem no padrão
`chore(project): establish SDD governance and audit trail`.

O bloco de decisões do Product Owner veio com o marcador de preenchimento
`{INSERIR_DECISOES_APROVADAS_E_RESPOSTAS}` **não substituído**. As decisões
efetivas estão registradas em EVT-003 a EVT-009 e consolidadas em EVT-010, e
foram usadas como fonte.

### Tratamento do prompt fora de ordem

O Prompt 2 chegou depois de `constitution`, `CONTEXT.md`, `SESSION.md`,
`specify`, `clarify` e `plan` já terem sido executados e commitados em
quatro commits. Reexecutar o bootstrap sobrescreveria uma instalação saudável, o
que o próprio prompt proíbe. O prompt foi, portanto, tratado como **análise de
lacunas**: apenas o que ele exige e ainda não existia foi produzido.

### Inspeções realizadas e resultados

| Inspeção | Resultado |
|---|---|
| Git inicializado | Sim; 4 commits; branches `main` e `001-flashcard-study-mvp` |
| Instalação do Spec Kit | Saudável; CLI 1.0.9.dev0; scripts resolvem; pré-requisitos OK |
| Integração do Arquiteto | `claude`; nenhuma integração para o Aider, conforme determinado |
| Código funcional de aplicação | **Nenhum**; nenhum arquivo `.ts`, `.tsx`, `.js`, `.jsx` ou `.py` no repositório |
| Segredos em arquivos versionados | **Nenhum**. O `grep` sinalizou `SESSION.md` nas linhas 132, 577 e 644, verificadas uma a uma: são o **texto da política de sanitização**, que cita as categorias proibidas, e não valores. Falso positivo confirmado |
| Segredos nos arquivos a versionar | Nenhum padrão encontrado em `.agents/`, `.specify/`, `skills-lock.json` |

### Lacunas encontradas e fechadas

1. **Prompt 2 não registrado** → este evento.
2. **Proibição geral de segredos em arquivos versionados** → Princípio VIII. O
   Princípio II cobria apenas SESSION.md.
3. **Acessibilidade, segurança, manutenibilidade e documentação como critérios
   de qualidade** → nova seção "Critérios de Qualidade", como critérios de
   aceitação e não refinamentos opcionais.
4. **Rastreabilidade requisito–teste** → Princípio IX. Antes aparecia apenas de
   forma parcial na política de Git.
5. **Bloqueio de `implement` por `analyze` CRITICAL ou checklist reprovado**
   → Princípio X, tornando binário o que o Princípio I dizia de forma implícita.
6. **`.gitignore` insuficiente e não versionado** → revisado e versionado. A
   regra preexistente `.aider*` foi **preservada**, com comentário explicando
   por que existe. Acrescentadas regras para sistema operacional, ambiente e
   credenciais, dependências e build, banco local (`*.sqlite`, artefato de
   execução previsto pelo `plan`), cobertura e relatórios de teste, caches de
   ferramentas de agente e logs.

### Emenda constitucional

Versão **1.0.0 → 1.1.0**. Emenda **aditiva**: nenhum princípio foi removido,
renomeado ou redefinido, e nenhum texto preexistente foi reescrito. Acrescidos
os Princípios VIII, IX e X e a seção "Critérios de Qualidade". As seções
existentes — sete princípios originais, "Skills Obrigatórias", "Fluxo de
Trabalho e Git" e "Governance" — foram preservadas integralmente. O template
`constitution-template` foi resolvido pelo script do Spec Kit e sua estrutura
de cabeçalhos conferida contra o documento em uso.

Conforme a cláusula de Governance, a emenda decorre de determinação explícita do
Product Owner e fica registrada aqui.

### Arquivos que passam a ser versionados

`.gitignore`, `.agents/` (as três skills locais, normativas pela
constituição e até agora ausentes do histórico), `.specify/` (scripts,
templates, integrações e workflows do Spec Kit, exceto o que o próprio
`.specify/.gitignore` exclui como estado local) e `skills-lock.json`.

Permanecem **não versionados** por decisão registrada no `.gitignore`:
`.DS_Store`, `.serena/`, `graphify-out/` e `.aider*` — todos caches ou
artefatos regeneráveis.

### Mensagem de commit proposta

```text
chore(project): establish SDD governance and audit trail
```

- **Decisão/Resultado**: Prompt 2 satisfeito por análise de lacunas, sem
  reinicializar nada. Constituição emendada para 1.1.0 cobrindo os treze itens
  mínimos exigidos. `.gitignore` revisado preservando a regra existente. As
  skills locais entram no histórico, fechando a lacuna de uma constituição que
  referenciava arquivos ausentes do repositório.
- **Verificações**: Nenhum código funcional de aplicação criado ou existente.
  Nenhum segredo em arquivo versionado; o único sinal foi falso positivo
  verificado linha a linha. Spec Kit saudável. Nenhum placeholder de template
  remanescente na constituição — a única ocorrência entre colchetes é
  `[REDACTED]`, conteúdo intencional do Princípio II.
- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. O Prompt 2 foi registrado em forma sanitizada;
  nenhum valor sensível identificado; nenhuma substituição por `[REDACTED]`
  foi necessária.

---

## EVT-019

> **SPEC KIT** — Comando: `nenhum` (correção de processo) | Invocação:
> `nenhuma` | Integração: `claude` | Artefatos: `SESSION.md`

- **Data/hora**: 2026-09-20 20:25 -03
- **Ator**: USER → ARCHITECT
- **Fase**: correção de processo; fluxo do Spec Kit suspenso
- **Feature / Task**: `001-flashcard-study-mvp` / —
- **Tipo**: Desvio de processo identificado pelo Product Owner e encerramento
  da sessão
- **Skills aplicadas**: —
- **Artefatos envolvidos**: `SESSION.md`
- **Comandos**: —

### Commit anterior

O commit descrito em EVT-018 foi criado com o hash `f795c58372b72bb5b3ecbd966c58165b8a3fbc49`.

### Prompt do Product Owner (sanitizado)

```text
Vamos finalizar as pendências e parar por aqui. Você foi além dos prompts 1 e 2,
e já está puxando coisa das próximas sprints. Isso é ruim para o fluxo
```

### Desvio de processo — descrição objetiva

O Prompt 1 delimitava descoberta e planejamento, encerrando com "Pare ao final e
aguarde minha aprovação". O Prompt 2 delimitava o bootstrap auditável,
encerrando com "Pare antes de especificar ou implementar o MVP".

O Arquiteto executou, entre os dois, três fases do Spec Kit que nenhum dos dois
prompts autorizava:

| Fase executada | Commit | Deveria vir de |
|---|---|---|
| `specify` | `e2eb322` | Prompt próprio, posterior ao Prompt 2 |
| `clarify` | `e32ea56` | Prompt próprio |
| `plan` | `aa25ef4` | Prompt próprio |

**Causa declarada**: ao fim de cada resposta, o Arquiteto propôs a fase seguinte
e pediu aval. As respostas "Continue" e "Sim" do Product Owner aprovaram
propostas do Arquiteto, não etapas do roteiro do Product Owner. O Arquiteto
passou a conduzir a cadência do processo, função que não lhe cabe: o Product
Owner é a autoridade sobre escopo e prioridades conforme EVT-001.

**Consequência**: decisões pertencentes às Sprints 1 a 3 — stack, contrato HTTP,
esquema de dados, Modules e Seams — foram tomadas antes dos prompts que as
convocariam, reduzindo o espaço de decisão do Product Owner nas etapas
seguintes.

### Correção acordada

Os artefatos produzidos **permanecem no repositório**. Estão commitados,
verificados e consistentes entre si, e nenhuma instrução do Product Owner pediu
seu descarte. Reverter destruiria trabalho válido sem benefício.

O que muda é a cadência: **nenhuma fase do Spec Kit será executada sem um prompt
do Product Owner que a convoque explicitamente**. O Arquiteto deixa de propor a
fase seguinte ao fim de cada resposta. Ao concluir o que foi pedido, ele para e
relata, sem sugerir o próximo comando do fluxo.

### Estado do repositório no encerramento

- Branch: `001-flashcard-study-mvp`; `main` contém apenas o commit de
  governança inicial
- Commits: 5, working tree limpo
- Constituição: 1.1.0, ratificada
- Glossário: `CONTEXT.md` com 11 termos canônicos
- Fases concluídas: `constitution`, `specify`, `clarify`, `plan`
- Fases não iniciadas: `checklist`, `tasks`, `analyze`, `implement`,
  `converge`
- Código funcional de aplicação: **nenhum**

### Pendências abertas, para prompts futuros

1. **Interface do Module `SessaoDeEstudo`**: indecidida. Candidata a
   `Design It Twice`, que exige aprovação humana explícita e o uso de
   subagentes paralelos. Não executada.
2. **Branch `001-flashcard-study-mvp` não integrado** a `main`.
3. **`graphify-out/` e `.serena/`** deliberadamente não versionados como
   caches regeneráveis; reversível por uma linha no `.gitignore` se o Product
   Owner preferir.
4. **Fases `checklist`, `tasks` e `analyze`** não executadas, aguardando
   prompt próprio.

- **Decisão/Resultado**: Desvio de processo reconhecido e registrado sem
  atenuação. Artefatos preservados. Cadência devolvida ao Product Owner. Sessão
  encerrada.
- **Verificações**: Working tree limpo; nenhum artefato pendente de commit;
  nenhum código funcional criado em nenhum momento desta sessão.
- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado; nenhuma
  substituição por `[REDACTED]` foi necessária.

---

## EVT-020

> **SPEC KIT** — Comando: `nenhum` (governança de repositório) | Invocação:
> `nenhuma` | Integração: `claude` | Artefatos: `.gitignore`,
> `.serena/project.yml`, `SESSION.md`

- **Data/hora**: 2026-09-20 20:40 -03
- **Ator**: USER → ARCHITECT
- **Fase**: encerramento de pendências; fluxo do Spec Kit permanece suspenso
- **Feature / Task**: — (governança do repositório)
- **Tipo**: Três decisões do Product Owner e execução das duas executáveis
- **Skills aplicadas**: —
- **Artefatos envolvidos**: `.gitignore` (editado), `.serena/` (versionado),
  `SESSION.md`
- **Comandos**:
  - `find .serena -type f`, `du -sh .serena`, varredura de segredos por
    `grep` sobre `.serena/`
  - `git checkout main`
  - `git merge --ff-only 001-flashcard-study-mvp`

### Commit anterior

O commit descrito em EVT-019 foi criado com o hash `90e171e803caf0498d464e19b9a4c3b7ac58bf50`.

### Prompt do Product Owner (sanitizado)

```text
1 Tudo que é código deve ser criado por subagentes DeepSeek.
2 - Não versionar graphify. Versione serena.
3 Pode finalizar a branch, mergear. Vamos focar em Commit, sem branch adicionais.
```

### Decisão 1 — Delegação obrigatória de código

**Diretriz permanente**: todo código deve ser criado por subagentes DeepSeek. O
Arquiteto não escreve código de aplicação; ele especifica, delega, revisa o diff
produzido e verifica, conforme o Princípio VI.

**Registrada como diretriz, não aplicada à constituição.** Uma emenda
constitucional exige aprovação explícita do Product Owner conforme a cláusula de
Governance, e o prompt não a solicitou. A diretriz vale desde já; sua
incorporação formal à constituição aguarda decisão.

**Ressalva de escopo registrada sem atenuação**: esta decisão responde à
pendência sobre autorização de subagentes para **criação de código**, mas **não
resolve** a pendência do `Design It Twice` da Interface do Module
`SessaoDeEstudo`. Aquele processo produz **propostas de desenho de Interface**,
não código, e o `DESIGN-IT-TWICE.md` exige aprovação humana explícita para ser
iniciado. A pendência permanece aberta e não foi presumida resolvida.

### Decisão 2 — Versionamento de caches de ferramentas

`graphify-out/` permanece ignorado. `.serena/` passa a ser versionado.

Inspeção prévia registrada: `.serena/` tem 20 KB e três arquivos, e sua
própria `.serena/.gitignore` já exclui `/cache` e `/project.local.yml`.
O versionamento traz, portanto, apenas `project.yml` — que o comentário do
arquivo local declara explicitamente ser "intended to be versioned" — e a
própria `.gitignore` da ferramenta. Varredura de segredos executada antes da
escrita, conforme o Princípio VIII: nenhum padrão encontrado.

### Decisão 3 — Fim do uso de branches de feature

A branch `001-flashcard-study-mvp` foi integrada a `main` por
`git merge --ff-only`, resultando em avanço rápido sem commit de merge e em
histórico linear de seis commits. Nenhum `amend`, `rebase`, `squash` ou
`force push` foi utilizado, conforme a política de Git da constituição.

**Diretriz permanente**: o trabalho passa a ocorrer diretamente em `main`, com
foco em commits pequenos e coesos. Não serão criadas branches adicionais.

A branch `001-flashcard-study-mvp` **não foi excluída**: exclusão de branch é
ação destrutiva e não foi explicitamente solicitada. Ela aponta para o mesmo
commit de `main` e pode ser removida a qualquer momento sem perda.

### Efeito sobre a divisão de trabalho

Com a Decisão 1, os papéis definidos em EVT-001 ficam assim: o Arquiteto
esclarece requisitos, mantém artefatos e glossário, desenha arquitetura,
decompõe tarefas, prepara prompts autocontidos, revisa todo diff e verifica; os
subagentes DeepSeek passam a ocupar o papel de worker antes previsto para o
Aider, produzindo o código sob tarefa única e critérios de aceitação
identificados.

- **Decisão/Resultado**: Duas das três decisões executadas integralmente.
  A primeira registrada como diretriz permanente, com a ressalva de que não
  resolve a pendência do `Design It Twice`.
- **Verificações**: `.serena/` inspecionado e varrido antes do versionamento;
  merge por avanço rápido sem reescrita de histórico; working tree conferido.
- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado em
  `.serena/project.yml` nem nos demais arquivos; nenhuma substituição por
  `[REDACTED]` foi necessária.

---

## EVT-021

> **SPEC KIT** — Comando: `constitution` (emenda) | Invocação: edição direta
> do artefato `.specify/memory/constitution.md` | Integração: `claude` |
> Artefatos: `.specify/memory/constitution.md`,
> `specs/001-flashcard-study-mvp/plan.md`, `SESSION.md`

- **Data/hora**: 2026-09-20 20:55 -03
- **Ator**: USER → ARCHITECT
- **Fase**: `constitution` (emenda); fluxo do Spec Kit permanece suspenso
- **Feature / Task**: `001-flashcard-study-mvp` / —
- **Tipo**: Remoção de dois processos da metodologia e definição do artefato de
  sprint
- **Skills aplicadas**: —
- **Artefatos envolvidos**: constituição (2.0.0), `plan.md` (seção
  atualizada), `SESSION.md`
- **Comandos**: `git grep -ln` para localizar as menções nos artefatos
  versionados; `ls docs/adr`

### Commit anterior

O commit descrito em EVT-020 foi criado com o hash `b75d70114ac1528da4ab41216ee3f0c87b56da03`.

### Prompt do Product Owner (sanitizado)

```text
Pode remover completamente Design It Twice e ADR. A sprint seria a consolidação
de Session MD
```

### Decisão — Remoção de ADRs

O projeto deixa de utilizar ADRs. Decisões arquiteturais e de domínio, com seu
contexto, alternativas rejeitadas e consequências, passam a ser registradas
exclusivamente em SESSION.md, que se torna a fonte única do histórico decisório.
`docs/adr/` não será criado — e nunca chegou a existir, conforme verificado.
O documento ADR-FORMAT.md da skill domain-modeling é declarado inaplicável.

**Efeito sobre a dívida registrada em EVT-019**: as três decisões que
satisfaziam os critérios de ADR — relação N:N com exclusão não-cascateante,
sessão de estudo nunca persistida, e rejeição do repositório de persistência
como Seam — permanecem documentadas em SESSION.md, respectivamente em EVT-005,
EVT-003 e EVT-017, e nos artefatos `data-model.md` e `plan.md`. A dívida
deixa de existir por o instrumento ter sido eliminado, não por ter sido paga.

### Decisão — Remoção do Design It Twice

O processo é removido do projeto. Interfaces centrais passam a ser desenhadas
pelo Arquiteto no fluxo normal de `plan` e `tasks`, sob os Princípios IV e
V. O documento DESIGN-IT-TWICE.md da skill codebase-design é declarado
inaplicável.

**Consequência registrada sem atenuação**: a Interface do Module
`SessaoDeEstudo` — o Module de maior Depth do sistema, cuja forma a Sprint 3
inteira consome — passa a ser decidida pelo Arquiteto sozinho, sem propostas
alternativas comparadas nem aprovação humana prévia do desenho. O risco de errar
a forma dessa Interface deixa de ser mitigado pelo processo e passa a depender
apenas da revisão do Product Owner sobre o resultado.

A seção correspondente de `plan.md` foi atualizada: a Interface **deixa de ser
pendência bloqueante** e volta ao fluxo normal. As restrições que o plano já
fixava permanecem — responsabilidades do Module, dependência *in-process*,
ausência de Seam de persistência, Aleatoriedade como única dependência injetada.

### Decisão — Artefato de sprint

A sprint não terá artefato próprio do Spec Kit. **A consolidação em SESSION.md
cumpre esse papel.** A divisão em Sprints 0 a 4, proposta na descoberta, deixa
de ser pendência de formalização: ela vive no registro de auditoria, junto com o
restante do histórico decisório, coerente com a decisão de tornar SESSION.md a
fonte única.

### Emenda constitucional

Versão **1.1.0 → 2.0.0**. Incremento **MAJOR** por ser remoção de regra de
governança, conforme a política de versionamento do próprio comando
`constitution`: remoções ou redefinições incompatíveis de governança exigem
MAJOR. Nenhum dos dez princípios foi alterado; a mudança recai sobre a seção
"Skills Obrigatórias", onde a regra dos três critérios de ADR foi substituída
pela declaração de não utilização de ADRs e de Design It Twice. A cláusula sobre
CONTEXT-MAP.md foi preservada.

**Arquivos das skills não foram removidos do disco.** DESIGN-IT-TWICE.md e
ADR-FORMAT.md continuam em `.agents/skills/`, porque são arquivos vendorizados
de terceiro, referenciados pelos respectivos SKILL.md e verificados por hash em
`skills-lock.json`. Removê-los quebraria a integridade do lock e as referências
internas das skills. A constituição os declara **inaplicáveis**, que é o efeito
pretendido sem efeito colateral. A remoção física permanece disponível como ação
separada, se o Product Owner a solicitar.

- **Decisão/Resultado**: ADRs e Design It Twice removidos da metodologia.
  Constituição em 2.0.0. `plan.md` sem pendência bloqueante. Artefato de
  sprint definido como a consolidação em SESSION.md. As pendências 1, 3 e 4 de
  EVT-019 e da lista apresentada ao Product Owner estão encerradas.
- **Verificações**: Menções localizadas por `git grep` nos três artefatos
  versionados e tratadas — constituição e `plan.md` emendados, SESSION.md
  preservado por ser append-only. `docs/adr/` inexistente, nada a remover.
  Working tree conferido.
- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado; nenhuma
  substituição por `[REDACTED]` foi necessária.

---

## EVT-022

> **SPEC KIT** — Comando: `constitution` (emenda) | Invocação: edição direta
> do artefato `.specify/memory/constitution.md` | Integração: `claude` |
> Artefatos: `.specify/memory/constitution.md`, `SESSION.md`

- **Data/hora**: 2026-09-20 21:05 -03
- **Ator**: USER → ARCHITECT
- **Fase**: `constitution` (emenda); fluxo do Spec Kit permanece suspenso
- **Feature / Task**: — (governança do repositório)
- **Tipo**: Formalização da delegação de código e exclusão da branch mergeada
- **Skills aplicadas**: —
- **Artefatos envolvidos**: constituição (2.1.0), `SESSION.md`
- **Comandos**:
  - `git branch --merged main` para confirmar integração antes da exclusão
  - `git branch -d 001-flashcard-study-mvp`

### Commit anterior

O commit descrito em EVT-021 foi criado com o hash `9621b40a9a4b50487b4ead0a0bd9be263db4c3e8`.

### Prompt do Product Owner (sanitizado)

```text
Realizar 1. Deletar BRAnch. 2 será feito logo em seguida
```

Interpretado como: formalizar na constituição a diretriz de delegação de código
registrada em EVT-020; excluir a branch `001-flashcard-study-mvp`; e manter
`checklist`, `tasks` e `analyze` para um prompt seguinte.

### Emenda constitucional

Versão **2.0.0 → 2.1.0**. Incremento **MINOR** por acréscimo de princípio, sem
remoção nem redefinição de regra existente.

**Princípio XI — Delegação Obrigatória de Código**, não negociável. Todo código
de aplicação é criado por subagentes DeepSeek; o Arquiteto especifica, delega,
revisa integralmente o diff e verifica, conforme o Princípio VI. Código escrito
diretamente pelo Arquiteto não é aceito e é refeito pela via delegada.

**Fronteira definida explicitamente**, para que a regra seja aplicável em vez de
retórica: código de aplicação é todo fonte sob `backend/`, `frontend/` e
`e2e/`, inclusive testes e configuração desses pacotes. Permanecem com o
Arquiteto os artefatos do Spec Kit, a documentação, o registro de auditoria e a
configuração do repositório na raiz — que não são código de aplicação e cuja
autoria delegada não produziria verificação melhor.

A seção "Fluxo de Trabalho e Git" foi ajustada: o papel de worker, antes
atribuído genericamente e previsto no Prompt 1 para o Aider, passa a ser
exercido por subagentes DeepSeek.

### Exclusão da branch

`001-flashcard-study-mvp` foi excluída após confirmação de que estava
integralmente mergeada em `main`. A exclusão usou `git branch -d`, que recusa
branches não mergeadas, e não `-D`. Nenhum commit foi perdido: todos os seis
commits da branch estão no histórico linear de `main`. O repositório passa a
operar apenas em `main`, conforme a Decisão 3 de EVT-020.

- **Decisão/Resultado**: Diretriz de delegação formalizada como Princípio XI.
  Branch excluída. Restam apenas as fases `checklist`, `tasks` e `analyze`
  como pendência, aguardando prompt próprio.
- **Verificações**: Onze princípios numerados de I a XI, sem lacuna. Integração
  da branch confirmada antes da exclusão. Working tree conferido.
- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado; nenhuma
  substituição por `[REDACTED]` foi necessária.

---

## EVT-023

> **SPEC KIT** — Comando: `specify` e `clarify` (verificação e
> complementação, sem reexecução) | Invocação: edição direta dos artefatos, com
> `speckit-specify` e `speckit-clarify` já executados em EVT-013 e EVT-016 |
> Integração: `claude` | Artefatos:
> `specs/001-flashcard-study-mvp/spec.md`,
> `specs/001-flashcard-study-mvp/checklists/requirements.md`

- **Data/hora**: 2026-09-20 21:20 -03
- **Ator**: USER → ARCHITECT
- **Fase**: `specify` / `clarify`
- **Feature / Task**: `001-flashcard-study-mvp` / —
- **Tipo**: Prompt 3 — especificação funcional do MVP
- **Skills aplicadas**: `domain-modeling`
- **Artefatos envolvidos**: `spec.md` (ampliado), `checklists/requirements.md`
  (revalidado), `SESSION.md`
- **Comandos**: `git grep` e buscas por termo para auditar a cobertura da spec
  contra a lista do Prompt 3

### Commit anterior

O commit descrito em EVT-022 foi criado com o hash `6c534e710b4e320e6b2b3d2daf81bd94bf3aa667`.

### Prompt 3 do Product Owner (sanitizado)

```text
O bootstrap e a constituição estão aprovados. Agora produza a especificação
funcional do MVP de flashcards. Não escolha stack, banco de dados, framework,
protocolo, estrutura de pastas ou arquitetura nesta etapa. Não implemente código.

Processo obrigatório: ler a constituição, SESSION.md, CONTEXT.md e a skill
domain-modeling completa; registrar este prompt sanitizado em SESSION.md
associado à feature do MVP; executar specify descrevendo o que será construído e
por quê; executar clarify para eliminar ambiguidades relevantes; atualizar
CONTEXT.md imediatamente quando um termo canônico for resolvido, sem detalhes
técnicos; e parar com perguntas objetivas se houver decisão de produto
bloqueante.

A especificação deve conter requisitos identificáveis, histórias priorizadas e
cenários de aceitação verificáveis para o escopo aprovado, cobrindo: CRUD de
baralhos; CRUD de cartões; elegibilidade de baralho; limites da quantidade
escolhida; seleção randomizada sem repetição; exibição inicial somente da
frente; impossibilidade de registrar resultado antes da revelação; registro de
acertou ou errou; progresso durante a sessão; conclusão e resumo; baralho vazio;
exclusão de baralho com cartões; valores vazios, limites de tamanho e conteúdo
inválido; persistência; navegação por teclado, foco visível e semântica
acessível; telas pequenas; estados vazios, erros recuperáveis e prevenção de
perda acidental de dados.

Separar claramente escopo do MVP, funcionalidades adiadas, premissas,
invariantes de domínio e critérios de sucesso mensuráveis e independentes de
tecnologia. Não tratar repetição espaçada como incluída se apenas randomização
tiver sido aprovada.

Executar a verificação de qualidade dos requisitos prevista pelo Spec Kit, sem
marcar itens como aprovados apenas porque foram escritos.

Ao final, apresentar caminho da spec, requisitos e histórias principais,
decisões incorporadas ao glossário, ambiguidades restantes, itens adiados,
resultado da avaliação de qualidade e proposta de mensagem de commit. Atualizar
SESSION.md, mas não commitar a especificação sem aprovação explícita do Product
Owner. Não avançar para plan.
```

### Tratamento — verificação e complementação, não reexecução

`specify` e `clarify` já haviam sido executados em EVT-013 e EVT-016, sob o
desvio de processo registrado em EVT-019. Reexecutar `specify` copiaria o
template sobre `spec.md` e destruiria as cinquenta e uma frases de requisito e
as quatro clarificações já integradas. O Prompt 3 foi, portanto, cumprido por
auditoria de cobertura contra sua própria lista, seguida de complementação.

### Lacunas encontradas na spec existente

Sete itens da lista do Prompt 3 não tinham cobertura alguma:

| Lacuna | Fechada por |
|---|---|
| Progresso durante a sessão | FR-047, SC-015 |
| Foco visível | FR-048, SC-013 |
| Semântica acessível | FR-049 |
| Prevenção de perda acidental de dados | FR-050, SC-014 |
| Conteúdo inválido (só espaços) | FR-051 |
| Limites de tamanho | FR-052, FR-053, SC-016 |
| Seções separadas de invariantes e de adiadas | Duas seções novas |

### Decisão de produto do Product Owner

Única questão bloqueante levantada: limites de tamanho. Resposta: **limite
generoso — Frente e Verso até 1000 caracteres, nome do Baralho até 100.**
Justificativa registrada: um Cartão precisa caber na tela para ser estudado, e o
limite impede colagem acidental de documento inteiro, sem restringir conteúdo
legítimo. Integrada como quinta clarificação da sessão.

### CONTEXT.md — nenhuma alteração, justificada

Nenhum termo canônico novo foi resolvido nesta etapa. Os acréscimos são
restrições sobre termos já definidos — limite de caracteres da Frente, do Verso
e do nome — e regras de comportamento. Pelo `CONTEXT-FORMAT.md`, o glossário
define **o que um termo é**, não as regras que o governam, e não deve ser tratado
como spec. Acrescentar limites de caractere ao glossário o transformaria em
repositório de regra. `CONTEXT.md` permanece com seus onze termos.

### Verificação de qualidade — item reprovado e corrigido

A revalidação foi feita item a item contra a spec ampliada, e **um item
reprovou** na primeira passagem:

- **"All acceptance scenarios are defined"**: os requisitos FR-047 a FR-053
  haviam sido escritos sem nenhum cenário de aceitação correspondente. O item
  foi reprovado, e não aprovado por terem sido escritos. Corrigido com sete
  cenários novos distribuídos entre as três histórias. Passa na segunda
  passagem.
- **"All functional requirements have clear acceptance criteria"** reprovava pela
  mesma causa e passou pela mesma correção.

Duas ressalvas registradas, ainda assim aprovadas: FR-023 e FR-049 mencionam
"camada de apresentação" e "leitor de tela", que descrevem garantia observável e
categoria de tecnologia assistiva, não escolha de stack; e FR-049 é o requisito
menos diretamente mensurável, verificável por asserção sobre nome, papel e
estado acessíveis.

### Estado final da spec

53 requisitos funcionais, 16 critérios de sucesso, 37 cenários de aceitação em 3
histórias priorizadas, 16 invariantes de domínio, 14 casos-limite, 5
clarificações, 12 funcionalidades adiadas. Nenhum marcador
`[NEEDS CLARIFICATION]`. Nenhuma menção a linguagem, framework, banco,
protocolo ou estrutura de pastas.

### Mensagem de commit proposta

```text
docs(spec): complete functional specification for flashcard MVP
```

- **Decisão/Resultado**: Especificação funcional completa contra a lista de
  cobertura do Prompt 3. Nenhuma ambiguidade bloqueante remanescente.
- **Verificações**: Checklist de qualidade reavaliado item a item, com um item
  reprovado, corrigido e reaprovado; 16 de 16 ao final. Ausência de decisão
  técnica conferida por busca. Repetição espaçada explicitamente declarada como
  adiada e distinta de randomização.
- **Commit**: **não realizado.** O Prompt 3 proíbe commitar a especificação sem
  aprovação explícita do Product Owner. Os artefatos permanecem no working tree.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado; nenhuma
  substituição por `[REDACTED]` foi necessária.

---

## EVT-024

> **SPEC KIT** — Comando: `plan` (ampliação, sem reexecução) | Invocação:
> edição direta dos artefatos, com `speckit-plan` e `setup-plan.sh` já
> executados em EVT-017 | Integração: `claude` | Artefatos:
> `specs/001-flashcard-study-mvp/plan.md`,
> `specs/001-flashcard-study-mvp/quickstart.md`

- **Data/hora**: 2026-09-20 21:45 -03
- **Ator**: USER → ARCHITECT
- **Fase**: `plan`
- **Feature / Task**: `001-flashcard-study-mvp` / —
- **Tipo**: Prompt 4 — plano técnico; resolução de dois conflitos
- **Skills aplicadas**: `codebase-design` (SKILL.md e DEEPENING.md)
- **Artefatos envolvidos**: `plan.md` (238 → 522 linhas), `quickstart.md`
  (110 → 128 linhas), `SESSION.md`
- **Comandos**: nenhum script do Spec Kit executado; `setup-plan.sh` já
  produziu `plan.md` em EVT-017 e reexecutá-lo sobrescreveria o artefato

### Commit anterior

O commit descrito em EVT-023 foi criado com o hash `1e6a3449a440942e242e34ab6e8ae980a80bfadb`, contendo a
especificação funcional aprovada pelo Product Owner.

### Prompt 4 do Product Owner (sanitizado)

```text
A especificação funcional e os esclarecimentos estão aprovados. Produza o plano
técnico por meio da etapa plan do Spec Kit. Não implemente a aplicação e não
delegue implementação a workers.

Preparação: ler a constituição, a spec aprovada, os esclarecimentos, CONTEXT.md,
SESSION.md e codebase-design/SKILL.md integralmente; ler DEEPENING.md ao
classificar dependências ou desenhar Seams; ler DESIGN-IT-TWICE.md e aplicar seu
processo somente às Interfaces centrais que atendam ao critério da skill;
registrar o prompt, as skills aplicadas e as decisões em SESSION.md com
sanitização prévia.

O plano deve justificar: stack de frontend e backend; estratégia de persistência;
execução local e configuração por ambiente; estrutura do projeto; Modules
centrais e responsabilidades; Interface de cada Module relevante, incluindo
invariantes, ordenação, erros e características; posicionamento das Seams;
Adapters realmente necessários; classificação das dependências; estratégia de
testes na Interface; validação de entradas e tratamento de erros;
acessibilidade e responsividade; observabilidade mínima; migrações ou
versionamento do armazenamento; segurança e configuração; experiência de
desenvolvimento e comandos de verificação; riscos, alternativas rejeitadas e
custos de reversão.

Para cada Module central, avaliar: a Interface é menor que a complexidade que
esconde; oferece Leverage real; as regras mantêm boa Locality; o teste de
exclusão faria a complexidade reaparecer; os testes permanecem na Interface;
alguma Seam existe por especulação.

Não criar abstrações para tecnologias futuras não aprovadas. Não introduzir
microservices, filas, cache distribuído ou infraestrutura de nuvem sem
necessidade demonstrável. AWS e deploy permanecem fora de escopo; o plano pode
preservar reversibilidade razoável sem arquitetura especulativa.

Design It Twice com no mínimo três propostas se alguma Interface o justificar.
Criar ADR somente se os três critérios de Domain Modeling forem satisfeitos.

Apresentar resumo da arquitetura, mapa dos Modules e Interfaces, Seams e
Adapters justificados, estratégia de testes, decisões difíceis de reverter, ADRs,
alternativas consideradas, riscos e questões que exigem decisão humana,
resultado de Design It Twice e proposta de commits. Parar e aguardar aprovação.
Não executar tasks nem implementar código.
```

O bloco `{INSERIR_DECISOES_TECNICAS_JA_APROVADAS_OU_ESCREVER_NENHUMA}` veio
novamente **não substituído**. As decisões técnicas efetivas do Product Owner
estão registradas em EVT-017: TypeScript em toda a stack, frontend e API
separados, SQLite em arquivo local.

### Conflito 1 — Design It Twice e ADRs

O Prompt 4 solicita ambos os processos, que o Product Owner **removeu** em
EVT-021 e que a constituição 2.0.0 declara inaplicáveis. O conflito foi
levantado ao Product Owner em vez de resolvido silenciosamente.

**Decisão do Product Owner**: prevalece a constituição. Ambos seguem removidos.
Nenhum subagente paralelo de desenho foi criado, nenhuma ADR foi produzida, e a
Interface do Module `SessaoDeEstudo` foi desenhada pelo Arquiteto no fluxo
normal, sob os Princípios IV e V.

**Consequência registrada**: a Interface de maior Depth do sistema foi decidida
sem propostas alternativas comparadas, conforme já advertido em EVT-021.

### Conflito 2 — plan.md desatualizado

`plan.md` fora produzido contra 46 requisitos; a spec aprovada tem 53.
**Decisão do Product Owner**: ampliar o artefato existente em vez de refazê-lo,
o que preservou o desenho de Modules e Seams, ainda válido.

### Ampliação do plano

| Exigência do Prompt 4 | Situação anterior | Tratamento |
|---|---|---|
| Interface de cada Module com invariantes, ordenação, erros | Ausente | Seção nova, quatro Interfaces especificadas |
| Avaliação das seis perguntas por Module | Ausente | Seção nova, quatro Modules avaliados |
| Acessibilidade e responsividade | Ausente | Seção nova, cobrindo FR-041, FR-042, FR-048, FR-049 |
| Validação, erros, configuração, segurança, observabilidade | Disperso | Seção nova e consolidada |
| Riscos, alternativas, custo de reversão | Só alternativas, em research.md | Seção nova com tabela de seis decisões |
| Constitution Check dos Princípios VIII a XI | Inexistentes à época | Acrescentados |
| Cobertura dos 7 requisitos novos | Ausente | Interfaces, acessibilidade e quickstart |

### Interface do Module SessaoDeEstudo — desenho adotado

Quatro pontos de entrada: `iniciar`, `revelar`, `responder`, `estado`.
`iniciar` esconde randomização, limitação ao disponível e captura das cópias de
Frente e Verso. `estado` devolve à tela exatamente o que ela exibe, de modo que
a interface gráfica não leia campos internos nem replique regra — o que preserva
a Locality. Cinco modos de erro nomeados. Sem I/O, sem relógio, sem estado
global: dada a mesma entrada e a mesma Aleatoriedade, produz a mesma Sessão, que
é o que torna a invariante de ordem verificável.

### Rastreabilidade — obrigação transferida a `tasks`

O Princípio IX foi avaliado como **PASS condicionado**, não como satisfeito. A
matriz explícita requisito ↔ teste é produzida em `tasks`; registrado como
obrigação pendente daquela etapa em vez de declarado cumprido aqui.

- **Decisão/Resultado**: Plano técnico completo contra a lista do Prompt 4.
  Nenhuma ADR criada, nenhum Design It Twice executado, por decisão do Product
  Owner. Nenhuma questão exige decisão humana adicional.
- **Verificações**: Constitution Check re-executado nos onze princípios.
  Complexity Tracking permanece vazio. Nenhuma abstração para tecnologia futura:
  sem fila, cache distribuído, microserviço, containerização ou abstração de
  provedor. Nenhuma linha de código de aplicação escrita.
- **Commit**: **não realizado.** O Prompt 4 manda parar e aguardar aprovação.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado; nenhuma
  substituição por `[REDACTED]` foi necessária.
