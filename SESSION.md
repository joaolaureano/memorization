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

## EVT-039

> **SPEC KIT** — Comando: implement | Invocação: workers DeepSeek em worktrees
> isolados | Integração: claude | Artefatos: e2e/ e Acervo

- **Data/hora**: 2026-09-20 21:54 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 001-criar-cartao / T003 e T005 — concluídas

T003 foi executada em worktree próprio, abriu Chromium real contra servidor
loopback e passou. T005 foi executada em outro worktree, passou 26 testes do
backend, build e lint. O Arquiteto revisou os diffs e integrou-os mecanicamente.
As caixas de tarefa foram atualizadas. Nenhum worker fez commit.

- **Commit**: pendente.
- **Sanitização**: Confirmada.

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

---

## EVT-025

> **SPEC KIT** — Comando: `checklist`, `tasks` e `analyze` | Invocação:
> script `.specify/scripts/bash/setup-tasks.sh --json` e as skills
> `speckit-checklist`, `speckit-tasks`, `speckit-analyze` | Integração:
> `claude` | Artefatos: `checklists/dominio.md`, `tasks.md`, `spec.md`

- **Data/hora**: 2026-09-20 22:10 -03
- **Ator**: USER → ARCHITECT
- **Fase**: `checklist` → `tasks` → `analyze`
- **Feature / Task**: `001-flashcard-study-mvp` / T001–T026
- **Tipo**: Prompt 5 — transformação da spec e do plano em trabalho executável
- **Skills aplicadas**: `domain-modeling`, `codebase-design`
- **Artefatos envolvidos**: `checklists/dominio.md` (criado), `tasks.md`
  (criado), `spec.md` (seção nova), `SESSION.md`
- **Comandos**:
  - `bash .specify/scripts/bash/setup-tasks.sh --json`
  - três passagens de `analyze` por script, comparando `spec.md`,
    `plan.md` e `tasks.md`

### Commit anterior

O commit descrito em EVT-024 foi criado com o hash `961b88aa4ab9739de5ccba9fcbe77e6839eaf55b`, contendo o plano
técnico aprovado.

### Prompt 5 do Product Owner (sanitizado)

```text
O plano técnico está aprovado. Transforme a especificação e o plano em trabalho
executável, sem implementar código.

Processo: ler todos os artefatos ativos da feature, a constituição, CONTEXT.md,
as ADRs aplicáveis e SESSION.md; ler as duas skills locais; registrar o prompt e
as decisões em SESSION.md; incorporar ao plano os ajustes aprovados; executar
checklist avaliando realmente cada critério; executar tasks produzindo tarefas
pequenas, ordenadas, rastreáveis e verificáveis; executar analyze; corrigir cada
inconsistência no artefato que a origina e reexecutar analyze até não haver
inconsistências críticas.

Cada tarefa deve informar ou permitir determinar: ID estável, objetivo
observável, requisito e critério relacionados, dependências, Module e Interface
afetados, arquivos esperados, skill aplicável, testes exigidos, condição
objetiva de conclusão e possibilidade segura de execução paralela.

Não decompor em tarefas horizontais grandes; preferir incrementos verticais sem
forçar verticalidade quando houver fundação técnica que seja dependência real.

Tasks não estarão prontas se usarem terminologia incompatível com CONTEXT.md,
alterarem regras sem rastreabilidade, dependerem de Interface não decidida,
introduzirem Seam ou Adapter sem justificativa, não tiverem verificação
observável, misturarem responsabilidades ou exigirem que o worker decida produto
ou arquitetura.

Depois da análise limpa: revisar diff e sanitização, atualizar SESSION.md, fazer
os commits documentais e registrar os hashes no próximo evento. Apresentar
resultado do checklist, resultado final de analyze, lista de tasks e
dependências, commits criados e risco residual. Parar antes da implementação.
```

O bloco `{INSERIR_DECISOES_E_AJUSTES_APROVADOS}` veio **não substituído** pela
terceira vez consecutiva. Nenhum ajuste foi incorporado ao plano, por não haver
ajuste declarado. As ADRs mencionadas no processo não existem: foram removidas
em EVT-021.

### `checklist` — dois itens reprovados e corrigidos

Criado `checklists/dominio.md` com 22 itens em cinco categorias, focado nas
áreas de maior risco desta feature. A avaliação foi real, e **dois itens
reprovaram**:

- **CHK012** — Requisitos negativos e estruturais não declaravam meio de
  verificação. FR-009, FR-018, FR-022, FR-036, FR-038 e FR-044 afirmam o que o
  sistema **não** faz, e um cenário Given/When/Then não os alcança.
  **Corrigido no artefato que o origina**: a spec ganhou a seção *Verificação
  dos Requisitos Negativos*, com o meio concreto de verificação de cada um.
- **CHK010** — Não existia matriz requisito ↔ teste, exigida pelo Princípio IX.
  **Corrigido** pela criação de `tasks.md` com a matriz.

Resultado final: **22 de 22**.

### `tasks` — 26 tarefas em cinco fases

Fase 1 fundação (T001–T004), Fase 2 História 1 (T005–T011), Fase 3 História 2
(T012–T018), Fase 4 História 3 (T019–T022), Fase 5 transversal (T023–T026).

A Fase 1 é a única horizontal, e o artefato justifica por quê: é dependência
técnica real, com cada item verificável isoladamente. As demais são incrementos
verticais demonstráveis.

### `analyze` — três passagens, duas inconsistências corrigidas

| Passagem | Achado | Correção |
|---|---|---|
| 1ª | 35 requisitos apareciam na matriz em **notação abreviada** (`FR-001, 002, 003`), ilegível por máquina e ambígua para o worker | Todas as referências expandidas para identificador completo |
| 1ª | Quatro termos de `_Avoid_` sinalizados: `deck`, `flashcard`, `score`, `flip` | **Falsos positivos**, verificados linha a linha: "subdecks" nomeia funcionalidade **adiada**; as linhas do plano **declaram** os sinônimos como proibidos; "Flashcards" no título é a categoria do produto. Nenhuma correção necessária |
| 2ª | **FR-050** constava da tarefa T022 mas estava **ausente da matriz** | Linha acrescentada. Foi exatamente o tipo de furo que a matriz existe para revelar |
| 3ª | Nenhum achado | — |

Verificações da passagem final, todas limpas: nenhum requisito fora da matriz,
nenhum critério fora da matriz, nenhum requisito fantasma, nenhuma tarefa sem
requisito rastreado, nenhuma tarefa sem teste declarado, as quatro Interfaces do
plano presentes, **nenhuma Seam nova introduzida** pelas tarefas, e zero
marcadores `NEEDS CLARIFICATION` nos três artefatos.

### Mensagem de commit proposta

```text
docs(tasks): break MVP into 26 traceable tasks with quality checklist
```

- **Decisão/Resultado**: 26 tarefas rastreáveis, análise limpa, checklist 22/22.
  Nenhum bloqueio exige decisão humana.
- **Verificações**: Três passagens de `analyze` por script sobre os três
  artefatos; duas inconsistências corrigidas no artefato de origem; a terceira
  passagem não encontrou achado.
- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado; nenhuma
  substituição por `[REDACTED]` foi necessária.

---

## EVT-026

> **SPEC KIT** — Comando: `nenhum` (planejamento de sprint sobre artefatos
> existentes) | Invocação: `nenhuma` | Integração: `claude` | Artefatos:
> `SESSION.md`

- **Data/hora**: 2026-09-20 22:35 -03
- **Ator**: USER → ARCHITECT
- **Fase**: planejamento de sprint; `implement` não iniciado
- **Feature / Task**: `001-flashcard-study-mvp` / T001–T011
- **Tipo**: Prompt 6 — proposta da próxima sprint
- **Skills aplicadas**: `codebase-design`, `domain-modeling`
- **Artefatos envolvidos**: `SESSION.md`
- **Comandos**: nenhum

### Commit anterior

O commit descrito em EVT-025 foi criado com o hash `c13da45a9611b531e8cbc98234c9bd23d2c45038`.

### Prompt 6 do Product Owner (sanitizado)

```text
Com base exclusivamente na constituição aprovada, no glossário de domínio, nas
ADRs aplicáveis e nos artefatos atuais do Spec Kit, proponha a próxima sprint.
Não implemente nada e não invoque workers ainda.

A sprint deverá formar um incremento demonstrável e conter: objetivo; valor
entregue; requisitos e critérios cobertos; tasks incluídas e dependências; tasks
adiadas; ordem de execução; pontos de integração; Modules e Interfaces afetados;
skills aplicáveis por tarefa; estratégia de testes e comandos de verificação;
riscos e pontos de revisão humana; oportunidades seguras de paralelismo;
prompts exatos e sanitizados para cada worker via Aider; arquivos que cada
worker poderá alterar; plano de commits; demonstração esperada; definição
objetiva de concluído.

Cada prompt de worker deverá conter task ID e requisitos, objetivo e
comportamento observável, critérios de aceitação, artefatos a ler, skills
obrigatórias, termos de domínio, Module, Interface e Seam afetados, arquivos
permitidos e proibidos, restrições de arquitetura e segurança, testes a criar,
comandos de verificação, formato do relatório, instrução explícita para não
commitar e instrução para parar diante de conflito de domínio, decisão
arquitetural ausente, segredo ou mudança fora de escopo. Nenhum prompt poderá
delegar decisões de produto ou arquitetura ao worker.

Execução serial por padrão; paralelismo apenas sem compartilhamento de arquivos,
estado mutável ou decisões pendentes. Registrar prompt e proposta em SESSION.md.
Parar e solicitar aprovação explícita para executar a sprint.
```

O identificador `{INSERIR_IDENTIFICADOR_OU_ESCREVER_PROXIMA_SPRINT_ELEGIVEL}`
veio **não substituído** pela quarta vez consecutiva. As ADRs mencionadas no
prompt não existem: foram removidas em EVT-021.

### Conflito resolvido — executor dos workers

O Prompt 6 pede prompts "para cada worker **via Aider**". O **Princípio XI**,
não negociável e ratificado em EVT-022, determina subagentes DeepSeek e registra
que o papel de worker migrou do Aider. O conflito foi levantado ao Product
Owner em vez de resolvido silenciosamente.

**Decisão do Product Owner**: prevalece a constituição. Os prompts de worker
serão escritos para subagentes DeepSeek.

### Interrupção — crítica estrutural do Product Owner

Durante a elaboração da proposta, o Product Owner interrompeu com a seguinte
observação, registrada literalmente:

```text
Uma coisa que não ficou boa. Não sei se por minha conta ou por você. Voce criou
apenas 1 spec. Não é assim que Github Spec Kit deveria funcionar. Cada Spec é
uma funcionalidade. Voce criou tudo num mesmo guarda-chuva
```

**Avaliação do Arquiteto, sem atenuação**: a crítica procede em substância. A
feature `001-flashcard-study-mvp` cobre o MVP inteiro — Cartões, Baralhos,
Vínculos, Sessão de estudo e curadoria — em 53 requisitos, 3 histórias e 26
tarefas. É um guarda-chuva, e a responsabilidade é do Arquiteto: foi ele quem
alimentou `specify` com o MVP completo, em EVT-013, durante o desvio de processo
registrado em EVT-019, e nunca propôs decomposição em features.

Ressalva técnica registrada para não superestimar o erro: o
`spec-template.md` do Spec Kit prevê **múltiplas histórias priorizadas por
spec**, exigindo apenas que cada uma seja independentemente testável. Uma spec
com mais de uma história não é, por si, violação. O problema é de **granulação**:
uma única spec para o MVP inteiro está no extremo grosso da escala e anula a
entrega incremental que a ferramenta existe para viabilizar.

**Proposta da sprint suspensa.** A forma da sprint depende da decomposição em
features, e propor sprint sobre uma estrutura que o Product Owner considera
errada seria construir sobre fundação em disputa. Nenhuma proposta foi escrita.

- **Decisão/Resultado**: Prompt 6 registrado. Conflito de executor resolvido a
  favor da constituição. Proposta de sprint **não produzida**, por dependência
  de decisão estrutural pendente do Product Owner.
- **Verificações**: Nenhum artefato do Spec Kit foi alterado neste evento.
- **Commit**: pendente.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado; nenhuma
  substituição por `[REDACTED]` foi necessária.

---

## EVT-027

> **SPEC KIT** — Comando: `specify` (seis features novas) | Invocação: script
> `.specify/scripts/bash/create-new-feature.sh --json --number --short-name`,
> seis execuções | Integração: `claude` | Artefatos: seis `spec.md` novos;
> `specs/001-flashcard-study-mvp/` removido

- **Data/hora**: 2026-09-20 23:05 -03
- **Ator**: USER → ARCHITECT
- **Fase**: `specify` — reestruturação em features
- **Feature / Task**: features `001` a `006`
- **Tipo**: Decomposição do guarda-chuva em seis features do Spec Kit
- **Skills aplicadas**: `domain-modeling`
- **Artefatos envolvidos**: seis `spec.md` criados; a feature
  `001-flashcard-study-mvp` inteira removida do working tree
- **Comandos**:
  - `git rm -r specs/001-flashcard-study-mvp`
  - seis execuções de `create-new-feature.sh`
  - renumeração dos diretórios e reescrita de `.specify/feature.json`
  - verificação de cobertura por script, comparando com a spec antiga recuperada
    de `git show HEAD:...`

### Commit anterior

O commit descrito em EVT-026 não chegou a existir: aquele evento foi registrado
mas não commitado, por a proposta de sprint ter sido suspensa. O último commit é
`c13da45a9611b531e8cbc98234c9bd23d2c45038`, de EVT-025.

### Decisão do Product Owner

Questionado sobre a granularidade, o Product Owner respondeu:

```text
Isso pede mais granularidade. 1 - Criar Cartao. 2 - Criar Baralho 3 - Linkar os 2
4 - Sessão de estudo. Isso é apenas uma sugestão, mas poderia ser mais quebrado
ainda.
```

E aprovou **redistribuir e remover a 001**.

O Arquiteto estendeu a sugestão para cobrir os 53 requisitos — todo requisito
precisa de casa — e o Product Owner confirmou a decomposição em **seis
features**.

### Decomposição adotada

| Feature | Escopo | Requisitos |
|---|---|---|
| `001-criar-cartao` | Criar e listar Cartão; carrega a fundação de projeto e persistência | FR-001–004, 009, 040, 042–046, 051–053 |
| `002-criar-baralho` | Criar e listar Baralho | FR-010–014, 018 |
| `003-vincular-cartao-baralho` | Vincular, desvincular, elegibilidade derivada | FR-019–024, 026 |
| `004-sessao-de-estudo` | Sessão completa, com acessibilidade e progresso | FR-025, 027–039, 041, 047–049 |
| `005-editar-cartao-e-baralho` | Edição, aviso de propagação, alterações não salvas | FR-005, 006, 015, 050 |
| `006-excluir-cartao-e-baralho` | Exclusão com confirmação, não-cascateante | FR-007, 008, 016, 017 |

Ordem: 001 → 002 → 003 → 004. As features 005 e 006 podem vir após a 003.

### Onde o Arquiteto parou de quebrar, e por quê

A Sessão **não** foi dividida em iniciar, percorrer e resumir: nenhuma das três
se demonstra sozinha de forma útil, e as invariantes de ordenação — revelar
antes de responder, Resultado imutável — atravessam as três. Separá-las
espalharia uma máquina de estados por três specs, destruindo a Locality que o
Princípio IV protege.

Os requisitos transversais — persistência, falha de gravação, teclado, foco,
semântica, responsividade, limites, idioma — foram **distribuídos** para a
feature onde são observáveis, em vez de concentrados numa feature
"acessibilidade". Uma feature transversal seria a mesma doença do guarda-chuva
em escala menor.

### Verificação de cobertura

Script comparando as seis specs novas com a spec antiga recuperada do histórico
Git:

- **53 de 53 requisitos funcionais** preservados; nenhum perdido, nenhum
  inventado, **nenhum requisito em mais de uma feature**.
- **16 de 16 critérios de sucesso** preservados. A primeira passagem detectou
  **SC-011 perdido**, e ele foi redistribuído para as features `001` e `002`,
  onde as listas existem.
- Três critérios aparecem em mais de uma feature — SC-003, SC-006 e SC-016 — por
  serem transversais e observáveis em mais de um contexto. Repetição
  deliberada, não duplicação acidental.

### Artefatos perdidos do working tree e seu destino

A remoção da `001-flashcard-study-mvp` levou consigo `plan.md`,
`research.md`, `data-model.md`, `contracts/api-acervo.md`,
`quickstart.md`, `tasks.md` e os dois checklists. Todos permanecem
recuperáveis no histórico Git, nos commits `1e6a344`, `961b88a` e
`c13da45`.

O desenho arquitetural — quatro Modules, duas Seams reais, duas rejeitadas,
Interfaces especificadas — **não foi descartado**: será reaproveitado no
`plan` de cada feature, escopado ao que aquela feature precisa, em vez de
ressuscitado como um segundo guarda-chuva.

### Consequência registrada

`plan`, `tasks`, `checklist` e `analyze` **não existem para nenhuma das
seis features**. Cada uma percorrerá o fluxo do Spec Kit quando for assumida, que
é exatamente o funcionamento que a crítica do Product Owner restaura.

### Mensagem de commit proposta

```text
refactor(specs): split umbrella MVP spec into six features
```

- **Decisão/Resultado**: Guarda-chuva desfeito. Seis features com spec própria,
  dependências declaradas e escopo demonstrável. Cobertura verificada por
  script.
- **Verificações**: 53/53 requisitos e 16/16 critérios cobertos; um critério
  perdido foi detectado e corrigido antes do commit; nenhuma feature contém
  decisão técnica.
- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado; nenhuma
  substituição por `[REDACTED]` foi necessária.

---

## EVT-028

> **SPEC KIT** — Comando: `nenhum` (verificação de portões; implementação
> recusada) | Invocação: `nenhuma` | Integração: `claude` | Artefatos:
> `SESSION.md`

- **Data/hora**: 2026-09-20 23:30 -03
- **Ator**: USER → ARCHITECT
- **Fase**: verificação de pré-requisitos de `implement`
- **Feature / Task**: `001-criar-cartao` / —
- **Tipo**: Prompt 7 — autorização de sprint recusada por portões fechados
- **Skills aplicadas**: —
- **Artefatos envolvidos**: `SESSION.md`
- **Comandos**: inventário de artefatos por feature; `git log`,
  `git status`; busca por código de aplicação

### Commit anterior

O commit descrito em EVT-027 foi criado com o hash `9d326c6d0dabc6a3a15c6d1428c9f7c11d201cb1`.

### Prompt 7 do Product Owner (sanitizado)

```text
A sprint abaixo está aprovada para execução. Execute somente o escopo aprovado;
qualquer expansão deverá voltar ao Product Owner.

Antes da primeira implementação: confirmar que constituição, spec, plan,
checklist, tasks, análise, CONTEXT.md e ADRs aplicáveis estão consistentes;
confirmar que o checklist não contém gate reprovado; ler as skills aplicáveis;
registrar o prompt e a autorização em SESSION.md; verificar o estado do Git e
preservar mudanças não relacionadas; estabelecer baseline executando as
verificações existentes; se a baseline já estiver falhando, registrar e
determinar se bloqueia a sprint.

Para cada task: selecionar uma task elegível com dependências concluídas; gerar
o prompt do worker; sanitizar e registrar integralmente em SESSION.md; enviar ao
worker via Aider; não permitir commit pelo worker; registrar resumo verificável;
inspecionar pessoalmente os arquivos e o diff; rejeitar mudanças fora do escopo;
executar testes e verificações proporcionais ao risco; conferir aderência a
spec, plano, CONTEXT.md, ADRs e skills; verificar se mudanças de domínio exigem
retorno à especificação; verificar sanitização; atualizar SESSION.md; commitar
apenas quando aprovado; registrar o hash no evento seguinte.

Se um worker falhar, diagnosticar a causa antes de reenviar. Não repetir
indefinidamente o mesmo prompt. Não alterar checklist para parecer aprovado e
não marcar task como concluída sem evidência.

Ao final da sprint: executar toda a suíte; conferir rastreabilidade entre
requisitos, tasks, testes e commits; realizar a demonstração; registrar débitos
e riscos sem escondê-los; atualizar SESSION.md; apresentar entregas, tasks,
testes, commits, desvios e pendências. Não executar converge. Parar e aguardar
autorização para a avaliação final.
```

O bloco `{INSERIR_IDENTIFICADOR_DA_SPRINT_E_EVENTUAIS_AJUSTES_APROVADOS}` veio
**não substituído pela quinta vez consecutiva**.

### Implementação recusada — portões fechados

O Arquiteto **recusou iniciar a implementação**. A recusa não é discricionária:
decorre de dois princípios não negociáveis, e cedê-los por conveniência seria a
violação que eles existem para impedir.

**Estado verificado dos artefatos**, feature a feature:

| Feature | spec | plan | tasks | checklist | analyze |
|---|---|---|---|---|---|
| 001 a 006 | presente | **ausente** | **ausente** | **ausente** | **ausente** |

A decomposição de EVT-027 removeu `plan.md`, `tasks.md` e os checklists junto
com a feature `001-flashcard-study-mvp`, à qual pertenciam. Nenhuma das seis
features possui plano, tarefas, checklist ou análise.

- **Princípio I** — nenhuma implementação começa antes de spec, clarify, plan,
  critérios de aceitação, tasks e analyze aprovados. Quatro dos seis estão
  ausentes.
- **Princípio X** — `analyze` com CRITICAL ou checklist reprovado bloqueia
  `implement`. A situação é mais severa do que a prevista: não há analyze nem
  checklist a avaliar.

**Não existe sprint aprovada.** A proposta do Prompt 6 nunca foi escrita, por ter
sido suspensa em EVT-026 diante da crítica estrutural do Product Owner. O
"escopo aprovado" que o Prompt 7 manda executar não tem referente.

**Conflito de executor**, pela segunda vez: o Prompt 7 manda "enviar o prompt ao
worker via Aider", contra o Princípio XI. Mantido DeepSeek, conforme a decisão
do Product Owner registrada em EVT-026.

### Estado do repositório na recusa

Nenhum código de aplicação existe: não há `backend/`,
`frontend/`, `e2e/` nem manifesto de projeto. Baseline de verificações não
foi estabelecida por não haver suíte a executar — registrado como ausência, não
como falha.

### Decisão do Product Owner

Apresentadas três saídas, o Product Owner escolheu **executar o fluxo do Spec
Kit apenas para `001-criar-cartao`** — `clarify`, `plan`, `checklist`,
`tasks`, `analyze` — parando antes de qualquer código e apresentando a
proposta de sprint para aprovação.

- **Decisão/Resultado**: Implementação recusada por portões fechados. Nenhuma
  linha de código escrita. Fluxo da feature 001 autorizado a seguir.
- **Verificações**: Inventário de artefatos por feature; ausência de código de
  aplicação confirmada; modificação alheia preservada.
- **Commit**: pendente.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado.

---

## EVT-029

> **SPEC KIT** — Comando: `clarify`, `plan`, `checklist`, `tasks`,
> `analyze` | Invocação: script `.specify/scripts/bash/setup-plan.sh --json`
> e as skills correspondentes | Integração: `claude` | Artefatos:
> `specs/001-criar-cartao/{spec,plan,tasks}.md`,
> `specs/001-criar-cartao/checklists/requirements.md`

- **Data/hora**: 2026-09-20 23:50 -03
- **Ator**: ARCHITECT ↔ USER
- **Fase**: `clarify` → `plan` → `checklist` → `tasks` → `analyze`
- **Feature / Task**: `001-criar-cartao` / T001–T014
- **Tipo**: Fluxo completo da primeira feature, sem implementação
- **Skills aplicadas**: `domain-modeling`, `codebase-design`
- **Artefatos envolvidos**: os quatro do banner
- **Comandos**: `setup-plan.sh --json`; `check-prerequisites.sh`; análise de
  consistência por script sobre os três artefatos

### Commit anterior

O commit descrito em EVT-027 foi criado com o hash `9d326c6d0dabc6a3a15c6d1428c9f7c11d201cb1`. O EVT-028 foi
registrado sem commit próprio, por ter sido um evento de recusa sem alteração de
artefato.

### `clarify` — uma lacuna criada pela própria decomposição

Nenhum marcador `[NEEDS CLARIFICATION]`, e a spec herdou as clarificações já
resolvidas. Uma lacuna **nova**, porém, foi criada pela decomposição de EVT-027:
os requisitos de teclado, foco e semântica — FR-041, FR-048 e FR-049 — foram
atribuídos **integralmente à feature 004**, a Sessão. A feature 001 ficou sem
requisito de acessibilidade.

A constituição, na seção *Critérios de Qualidade*, afirma acessibilidade como
critério de aceitação de qualquer entrega. Mas afirmação normativa sem requisito
na spec **não gera teste**: pelo Princípio IX todo requisito precisa de teste
rastreável, e não haveria requisito a rastrear. O formulário de criação de
Cartão — a primeira tela que o usuário encontra — seria entregue sem nenhuma
verificação de teclado.

**Decisão do Product Owner**: a feature ganha requisito próprio.

Integrados **FR-054** (teclado), **FR-055** (foco visível e foco que vai ao campo
a corrigir numa recusa), **FR-056** (erros e estado vazio perceptíveis por leitor
de tela), **SC-017**, dois cenários de aceitação e uma invariante. Os requisitos
de acessibilidade da Sessão permanecem na feature `004` e **não** foram
duplicados.

### `plan` — escopo estreito, deliberadamente

Um Module (`Acervo`, com duas operações), uma Seam real (`ClienteDoAcervo`,
com `ClienteHttp` e `ClienteEmMemoria`), uma Seam rejeitada (repositório de
persistência, por SQLite ser *local-substitutable*). Contrato com duas rotas.
**Uma tabela apenas**: `baralho` e `vinculo` pertencem às features `002` e
`003` e não são criadas aqui.

O desenho foi reaproveitado do plano removido em EVT-027, **escopado** ao que
esta feature exige, em vez de ressuscitado inteiro.

**Gatilho de migração declarado**: o esquema é criado na primeira execução, sem
migração versionada. A feature `002` acrescentará a tabela `baralho`, e
**esse é o momento** em que migração passa a ser necessária, por haver base
instalada. Registrado para que a decisão não seja tomada por omissão.

### `checklist` — 17 de 17, avaliado item a item

Dois pontos verificados com atenção por serem candidatos naturais a reprovação:
os requisitos FR-054 a FR-056 **nasceram com cenários e critério**, não repetindo
o defeito da feature anterior, em que requisitos foram escritos sem cenário; e a
ausência de requisito pertencente a outra feature foi conferida contra a
decomposição de EVT-027. Nenhum item reprovado.

### `tasks` — 14 tarefas em três fases

Fase 1 fundação (T001–T004), Fase 2 criar e listar (T005–T010), Fase 3
acessibilidade, responsividade e validação (T011–T014). Execução **serial por
padrão**; paralelismo declarado apenas entre T001, T002 e T003, e entre T013 e o
par T011–T012.

### `analyze` — limpo na primeira passagem

| Verificação | Resultado |
|---|---|
| Requisitos ausentes da matriz | nenhum |
| Critérios ausentes da matriz | nenhum |
| Requisitos ou critérios fantasma | nenhum |
| Tarefas sem teste declarado | nenhuma |
| Marcadores `NEEDS CLARIFICATION` | zero |
| Requisitos pertencentes a outra feature | nenhum |
| Tarefas introduzindo Seam nova | nenhuma |

Dois sinais investigados e descartados como **falsos positivos**: `flashcard`
aparece uma vez no `plan.md`, na linha do Constitution Check que o **declara
proibido**; e `Baralho` aparece sete vezes na spec, todas em construção
negativa — "sem precisar escolher um Baralho", "sem depender de Baralho" — que
definem a **ausência** de dependência, além de uma referência à feature `003`
na seção de adiadas. Zero menções em `tasks.md`.

### Mensagem de commit proposta

```text
docs(001): plan, checklist and tasks for criar-cartao
```

- **Decisão/Resultado**: Fluxo do Spec Kit completo para a feature `001`.
  Portões dos Princípios I e X agora **abertos** para esta feature. Nenhuma
  linha de código escrita.
- **Verificações**: Checklist 17/17 avaliado item a item; `analyze` limpo na
  primeira passagem; dois falsos positivos investigados linha a linha.
- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado.

---

## EVT-030

> **SPEC KIT** — Comando: `nenhum` (auditoria de qualidade das specs) |
> Invocação: `nenhuma` | Integração: `claude` | Artefatos: `SESSION.md`

- **Data/hora**: 2026-09-21 00:05 -03
- **Ator**: USER → ARCHITECT
- **Fase**: auditoria pré-implementação
- **Feature / Task**: features `002` a `006`
- **Tipo**: Débito conhecido registrado — lacuna transversal sistemática
- **Skills aplicadas**: `domain-modeling`
- **Artefatos envolvidos**: `SESSION.md`
- **Comandos**: auditoria por script sobre as seis specs, verificando
  completude estrutural e cobertura dos requisitos transversais

### Commit anterior

O commit descrito em EVT-029 foi criado com o hash `5150162af8450bd16fa337783dcd7dee3fb29d22`.

### Pergunta do Product Owner (sanitizada)

```text
Antes de fazer, todos os specs foram bem-definidos ?
```

### Resposta verificada: não

Apenas a feature `001-criar-cartao` está bem definida. As outras cinco foram
escritas em passagem única durante a decomposição de EVT-027 e **não passaram
por `clarify`, `checklist` nem `analyze`**.

Completude **estrutural**: as seis têm requisitos, critérios, cenários,
invariantes, casos-limite, funcionalidades adiadas e premissas. Nenhuma seção
ausente.

Completude **substantiva**, por tema transversal:

| Feature | teclado/foco/semântica | falha ao gravar | idioma | responsividade | estado vazio |
|---|---|---|---|---|---|
| 001 | sim | sim | sim | sim | sim |
| 002 | **ausente** | **ausente** | **ausente** | **ausente** | **ausente** |
| 003 | **ausente** | **ausente** | **ausente** | **ausente** | **ausente** |
| 004 | sim | não se aplica | **ausente** | **ausente** | não se aplica |
| 005 | **ausente** | **ausente** | **ausente** | **ausente** | **ausente** |
| 006 | **ausente** | **ausente** | **ausente** | **ausente** | **ausente** |

Na feature `004` a falha de gravação e o estado vazio **não se aplicam**: a
Sessão nunca persiste (FR-038), portanto não há gravação que possa falhar.

### Causa, declarada sem atenuação

Ao decompor em EVT-027, o Arquiteto alocou os requisitos transversais — FR-042,
FR-043, FR-044, FR-045, FR-046 — **apenas à feature onde os encontrou primeiro**,
a `001`, e escreveu nas outras cinco uma linha de premissa: *"As premissas de
`001-criar-cartao` valem integralmente."*

**Premissa não é requisito.** Não gera teste, não entra em matriz de
rastreabilidade e não bloqueia conclusão de tarefa. É exatamente o defeito que o
`clarify` da feature `001` identificou em EVT-029, e o Arquiteto o corrigiu
**somente naquela feature**, sem reconhecer que a causa era sistemática. A
omissão é do Arquiteto e deveria ter sido percebida no momento da decomposição.

**Consequência concreta se não fosse corrigido**: criar Baralho, vincular Cartão,
renomear e excluir seriam entregues sem nenhuma verificação de teclado, sem
tratamento de falha de gravação e sem responsividade. A seção *Critérios de
Qualidade* da constituição obriga tudo isso, mas obrigação normativa sem
requisito na spec desaparece na verificação.

### Débito conhecido — a fechar no `clarify` de cada feature

Registrado nominalmente para que a lacuna não dependa de ser redescoberta:

| Feature | Requisitos a acrescentar no seu `clarify` |
|---|---|
| `002-criar-baralho` | teclado e foco no formulário e na lista; falha de gravação; idioma da interface; responsividade; estado vazio da lista de Baralhos |
| `003-vincular-cartao-baralho` | teclado e foco na ação de vincular e desvincular; falha de gravação; idioma; responsividade; estado vazio quando não há Cartão ou Baralho a vincular |
| `004-sessao-de-estudo` | idioma da interface; responsividade das telas da Sessão. Falha de gravação e estado vazio **não se aplicam** |
| `005-editar-cartao-e-baralho` | teclado e foco nos formulários de edição; falha de gravação ao salvar; idioma; responsividade |
| `006-excluir-cartao-e-baralho` | teclado e foco no diálogo de confirmação, com anúncio por leitor de tela; falha de gravação ao excluir; idioma; responsividade |

### Decisão do Product Owner

Apresentadas três saídas, o Product Owner escolheu **registrar como débito e
seguir com a feature 001**, que está limpa. Corrigir as cinco agora seria
trabalho adiantado sobre features que ainda não serão executadas — o mesmo
desvio apontado em EVT-019 e em EVT-026.

### Estado da feature 001

17 requisitos, 6 critérios, 11 cenários, checklist 17 de 17 avaliado item a item,
`analyze` limpo na primeira passagem, 14 tarefas com matriz completa. Portões
dos Princípios I e X **abertos**. Pronta para execução mediante autorização
explícita.

- **Decisão/Resultado**: Débito nomeado e registrado. Feature `001` confirmada
  como a única bem definida. Nenhuma spec alterada neste evento.
- **Verificações**: Auditoria por script sobre as seis specs, cobrindo estrutura
  e cinco temas transversais.
- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado.

---

## EVT-031

> **SPEC KIT** — Comando: `implement` (sprint da feature 001) | Invocação:
> delegação a subagente DeepSeek pelo MCP `delegate`, conforme o Princípio XI |
> Integração: `claude` | Artefatos: `SESSION.md`; código sob `backend/` a ser
> produzido pelo worker

- **Data/hora**: 2026-09-21 00:20 -03
- **Ator**: USER → ARCHITECT → WORKER
- **Fase**: `implement`
- **Feature / Task**: `001-criar-cartao` / **T001**
- **Tipo**: Autorização da sprint, baseline e primeira delegação
- **Skills aplicadas**: `codebase-design` (estrutura por Module, não por camada)
- **Comandos de baseline**: `node --version`, `npm --version`, inventário de
  suítes, `git status --short`

### Commit anterior

O commit descrito em EVT-030 foi criado com o hash `f7b996a3895bbf9b216994e9871eeb237f28b77c`.

### Autorização do Product Owner (sanitizada)

O Prompt 8 solicitava `converge`. O Arquiteto **recusou executá-lo**: o passo 3
do próprio prompt condiciona `converge` a `implement` já executado, e
`implement` nunca havia sido executado — nenhum arquivo de código existia e
zero das 14 tarefas estavam concluídas. Rodar `converge` compararia artefatos
contra código inexistente, produzindo ruído em vez de informação.

Apresentadas três saídas, o Product Owner **autorizou a execução da sprint da
feature `001-criar-cartao`**, tarefas T001 a T014.

### Baseline antes de qualquer alteração

| Item | Estado |
|---|---|
| Node.js | v26.7.0, satisfaz o requisito de Node 22+ do plano |
| npm | 11.19.0 |
| Suítes de verificação existentes | **nenhuma** — registrado como ausência, não como falha |
| Código de aplicação | nenhum |

Não há baseline falhando. Nenhuma falha futura poderá ser atribuída a estado
prévio.

### Prompt do worker — T001 (sanitizado, íntegro)

Enviado ao subagente DeepSeek. Reproduzido na íntegra; nenhum valor sensível
existia a redigir.

```text
## Tarefa T001 — Esqueleto do projeto backend

Feature: 001-criar-cartao. Requisitos rastreados: nenhum diretamente; T001 é
fundação técnica que habilita T004 em diante.

Objetivo observável: o projeto backend executa e responde a um comando de
verificação. npm test roda a suíte (vazia, passando) e npm run dev sobe o
servidor.

Critérios de aceitação:
1. cd backend && npm install && npm test termina com sucesso, com zero testes.
2. npm run dev inicia um servidor Fastify que responde a GET /health com 200.
3. npm run lint e npm run build existem e passam.
4. TypeScript em modo estrito.

Contexto técnico fixado pelo plano aprovado (não reabrir): TypeScript 5.x sobre
Node.js 22+ (ambiente tem v26), ESM; Fastify para HTTP; Vitest para testes;
better-sqlite3 e Zod como dependências para tarefas seguintes, sem uso agora;
dois deployables separados, este é apenas o backend.

Termos de domínio envolvidos: nenhum nesta tarefa. Nas tarefas seguintes valerão
Cartao, Frente, Verso. É PROIBIDO usar card, flashcard, deck em nome de arquivo,
módulo, tipo, função, tabela, coluna ou rota.

Module / Interface / Seam: nenhum nesta tarefa. A estrutura de diretórios deve
ser por Module, NÃO por camada: criar src/acervo/ e src/http/. É PROIBIDO criar
src/models/, src/services/, src/controllers/ ou src/repositories/.

Arquivos permitidos: exclusivamente dentro de backend/. Criar package.json,
tsconfig.json, vitest.config.ts, eslint.config.js, src/http/servidor.ts,
src/index.ts e .gitignore se necessário.

Arquivos proibidos: qualquer coisa fora de backend/. Não tocar em frontend/,
e2e/, specs/, SESSION.md, CONTEXT.md, .specify/, .agents/, .gitignore da raiz.

Restrições de arquitetura e segurança: nenhuma lógica de domínio nesta tarefa,
GET /health é apenas prova de vida; sem autenticação, a aplicação é local; o
servidor deve escutar apenas em 127.0.0.1, nunca em 0.0.0.0; porta configurável
por variável de ambiente com padrão utilizável sem configurar nada; nenhum
segredo, token, chave ou credencial em qualquer arquivo; não adicionar ORM,
framework de injeção de dependência, Docker, CI ou dependência não listada.

Testes a criar: um teste em backend/tests/servidor.test.ts que sobe o servidor e
assevera que GET /health responde 200, e que passa.

Comandos de verificação: npm install, npm test, npm run lint, npm run build.

Formato de saída obrigatório: blocos ===FILE: caminho=== com o conteúdo integral,
seguidos de um bloco de relatório com arquivos criados, decisões técnicas dentro
do escopo, riscos e ambiguidades.

NÃO FAÇA COMMIT. Você não tem permissão de Git.

PARE E REPORTE, sem improvisar, se encontrar conflito com o glossário de
domínio, decisão arquitetural ausente, necessidade de segredo, ou qualquer
mudança fora do escopo.
```

### Restrições embutidas no prompt, e por quê

- **Estrutura por Module, não por camada**, com proibição explícita de
  `models/`, `services/`, `controllers/` e `repositories/`: decorre do Princípio
  IV e da decisão de estrutura do `plan.md`. Um worker deixado à própria
  convenção produziria camadas.
- **Proibição dos sinônimos `card`, `flashcard`, `deck`** já nesta tarefa, antes
  de existir domínio: impede que a convenção errada se instale no esqueleto que
  as cinco features seguintes herdam.
- **Escuta restrita a `127.0.0.1`**: a ausência de autenticação é condicional à
  execução local, conforme as Assumptions da spec. Escutar em `0.0.0.0` anularia
  essa condição sem que ninguém percebesse.
- **Lista fechada de dependências**: o Princípio VII proíbe abstração
  antecipada. Sem a proibição explícita, um worker acrescentaria ORM ou
  container por hábito.
- **Proibição de commit**: exigida pelo contrato de workers de EVT-001 e pelo
  Princípio VI.

- **Decisão/Resultado**: T001 delegada. Resultado, inspeção do diff, verificações
  e decisão de aceitação serão registrados no evento seguinte.
- **Verificações**: baseline estabelecida antes da delegação.
- **Commit**: nenhum. O worker não commita, e o Arquiteto só commita após
  inspeção e verificação.
- **Sanitização**: Confirmada. O prompt foi revisado antes do registro; nenhum
  valor sensível presente, nenhuma substituição por `[REDACTED]` necessária.

---

## EVT-032

> **SPEC KIT** — Comando: `implement` | Invocação: subagente DeepSeek pelo MCP
> `delegate` | Integração: `claude` | Artefatos: `backend/` (7 arquivos),
> `specs/001-criar-cartao/plan.md`

- **Data/hora**: 2026-09-21 00:45 -03
- **Ator**: WORKER → ARCHITECT
- **Fase**: `implement`
- **Feature / Task**: `001-criar-cartao` / **T001 — concluída**
- **Tipo**: Resultado do worker, correções do Arquiteto e verificação
- **Skills aplicadas**: `codebase-design`
- **Comandos**: `npm install`, `npm test`, `npm run build`,
  `npm run lint`, `node src/index.ts`, `curl`, `lsof`, varredura de
  segredos e de termos proibidos

### Commit anterior

O commit descrito em EVT-030 foi criado com o hash `f7b996a3895bbf9b216994e9871eeb237f28b77c`. O EVT-031 foi
registrado sem commit próprio.

### Falha do worker e diagnóstico

A primeira delegação, em `deepseek-v4-pro`, **falhou**: a tarefa excedeu a
janela de execução e foi abortada.

**Diagnóstico antes de reenviar**, conforme o processo. Uma sonda mínima ao
mesmo provedor respondeu em menos de um segundo, descartando indisponibilidade.
A causa observada foi a duração: prompt longo com geração de sete arquivos no
modelo de raciocínio.

**Prompt corretivo, limitado à causa**: mesma tarefa e mesmas restrições
normativas, em `deepseek-v4-flash` e com instruções compactadas. T001 é código
de infraestrutura mecânico e não requer o modelo de raciocínio. O prompt **não
foi repetido sem alteração**.

### Resultado do worker

Sete arquivos entregues no formato pedido, com relatório. O worker **reportou
três riscos por conta própria**, sem escondê-los, e declarou duas ambiguidades
em vez de improvisar — comportamento correto segundo o contrato de workers.

### Correções do Arquiteto sobre a entrega

Quatro, todas sobre pontos que o próprio worker sinalizou ou que a verificação
revelou:

1. **`rootDir` e emissão**: o worker alertou que `rootDir: "."` produziria
   `dist/src/` e arrastaria os testes para o build. Substituído por
   `noEmit: true`, e `npm run build` passa a ser **verificação de tipos**.
   O Node 26 executa TypeScript diretamente; nenhum artefato de build é
   necessário, e os testes passam a ser checados também.
2. **Tipo da porta**: `process.env.PORTA ?? 3001` resulta em
   `string | number`, incompatível com `FastifyListenOptions.port`. Envolvido
   em `Number()`.
3. **Extensão de import**: o worker alertou que `--experimental-strip-types`
   era o ponto mais frágil. A verificação confirmou falha real — o runtime
   **não** reescreve `.js` para `.ts` em import relativo, diferentemente do
   Vitest, e `node src/index.ts` quebrava com `ERR_MODULE_NOT_FOUND`.
   Corrigido com extensão `.ts` nos imports e
   `allowImportingTsExtensions`, **sem adicionar dependência**.
4. **Driver de banco**: ver abaixo.

### Decisão de plano — troca do driver SQLite

`better-sqlite3` **não compila** neste ambiente: sem prebuild para Node 26, o
`node-gyp` falha. Bloqueio real, não contornável por configuração.

`node:sqlite`, embutido no runtime, foi **verificado em execução** antes de
decidir: restrição `CHECK` aplicada corretamente, API síncrona, `PRAGMA`
aceito, leitura correta. Substitui o driver **eliminando uma dependência e o
build nativo**, o que reforça o Princípio VII.

A decisão do Product Owner permanece intacta — SQLite local, em arquivo, sem
Docker. O que mudou foi o driver, detalhe de `plan` e portanto do Arquiteto.
`plan.md` foi atualizado com a revisão e sua justificativa.

### Verificações executadas

| Verificação | Resultado |
|---|---|
| `npm test` | 1 arquivo, 1 teste, **passou** |
| `npm run build` (tsc --noEmit) | exit 0 |
| `npm run lint` (eslint) | exit 0 |
| `GET /health` | **200**, corpo `{"status":"ok"}` |
| Escuta | `127.0.0.1:3001` apenas |
| **Acesso pelo IP da rede local** | **recusado** — verificado por `curl` a partir de `192.168.0.102` |
| Segredos nos arquivos versionados | nenhum. `package-lock.json` foi sinalizado e inspecionado: as três ocorrências são o pacote `js-tokens`. Falso positivo |
| Termos `_Avoid_` no código | nenhum |
| Camadas proibidas | nenhuma. `src/` contém `acervo/` e `http/` |
| Escopo | nada fora de `backend/` |

A restrição de segurança mais importante desta tarefa — a ausência de
autenticação ser condicional à execução local — foi **comprovada por teste
externo**, não afirmada.

### Mudança de domínio

Nenhuma. T001 não introduz termo de domínio, e o glossário não foi tocado.

### Mensagem de commit proposta

```text
feat(backend): scaffold backend project with health endpoint
```

- **Decisão/Resultado**: **T001 concluída e aceita.** Sete arquivos, quatro
  correções do Arquiteto, todas as verificações verdes.
- **Verificações**: as onze acima.
- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Um sinal investigado e descartado como falso
  positivo; nenhuma substituição por `[REDACTED]` necessária.

---

## EVT-033

> **SPEC KIT** — Comando: `implement` (revisão e correção de T001) |
> Invocação: quatro delegações a subagentes DeepSeek pelo MCP `delegate` |
> Integração: `claude` | Artefatos: `backend/`,
> `specs/001-criar-cartao/plan.md`

- **Data/hora**: 2026-09-21 01:15 -03
- **Ator**: USER → ARCHITECT → WORKER
- **Fase**: `implement`
- **Feature / Task**: `001-criar-cartao` / T001 — revisão
- **Tipo**: Revisão do esqueleto, correção de quatro defeitos e imposição de
  invariante de segurança
- **Skills aplicadas**: `codebase-design`
- **Comandos**: `npm test`, `npm run build`, `npm run lint`,
  `npm run dev`, `node src/index.ts`, `curl`, `lsof`, e três rodadas de
  **teste de mutação**

### Commit anterior

O commit descrito em EVT-032 foi criado com o hash `c63508bf82320ad679de34a71b7fc423634d397f`.

### Determinação do Product Owner (sanitizada)

```text
Revise antes. Sempre corrija 100% de bugs antes de ir adiante
```

Registrada como **política permanente**: nenhuma tarefa avança com defeito
conhecido em aberto.

### Violação do Princípio XI declarada pelo Arquiteto

As quatro correções aplicadas em EVT-032 — `noEmit`, `Number()`, extensão
`.ts` e troca de driver — foram **escritas diretamente pelo Arquiteto**. O
Princípio XI determina que código assim *"não é aceito e é refeito pela via
delegada"*. A violação é declarada aqui, e o precedente foi corrigido: todas as
correções deste evento passaram por subagentes DeepSeek.

### Defeitos encontrados na revisão

| # | Defeito | Gravidade |
|---|---|---|
| D1 | `engines.node` declarava `">=22.5"`, mas executar TypeScript sem flag exige Node 23.6+. No Node 22 LTS — a versão que o plano nomeava — a aplicação não subiria | real |
| D2 | `@types/node@^22` contra runtime Node 26 | real |
| D3 | `tsconfig` incluía `eslint.config.js` sem `allowJs`, e o `tsc` o ignorava silenciosamente | menor |
| D4 | **Nenhum teste de regressão protegia a escuta em loopback** | grave |

Confirmados como não-problemas: `npm run dev` funciona, `node:sqlite` não
emite aviso experimental neste runtime, o lint cobre os testes.

### D4 — três rodadas até fechar de verdade

O worker fechou D4 com testes sobre a constante e, **por iniciativa própria,
reportou que aquilo não bastava**: um literal `"0.0.0.0"` escrito no ponto de
chamada manteria os testes verdes. O teste de mutação confirmou a previsão dele.

| Rodada | Medida | Resultado da mutação |
|---|---|---|
| C2 | Teste de bind efetivo, lendo `server.address()` | Mutar a constante falha 5 testes; literal no call-site **ainda passava** |
| C4 | `iniciarServidor` assume a escuta; `index.ts` fica sem objeto de opções | Fecha por construção, mas o worker declarou o furo residual |
| C5 | `assegurarEscutaLocal` confere o endereço efetivo e lança `EscutaInseguraError`, fechando o servidor | **Fechado em runtime** |

### Teste de mutação — evidência conclusiva

| Mutação | Resultado |
|---|---|
| `HOST_LOCAL` → `"0.0.0.0"` | **5 de 8 testes falham** |
| Literal `host: "0.0.0.0"` no call-site, **com** a guarda | Processo **morre**, `EscutaInseguraError`, porta fechada |
| Literal `host: "0.0.0.0"` no call-site, **sem** a guarda | `lsof` mostra `*:3001` e `curl` pelo IP da LAN devolve **HTTP 200** — exposição real comprovada |

A terceira linha é a que justifica o trabalho: o furo não era teórico. A guarda
é o que o fecha, e isso está demonstrado, não afirmado.

Registra-se também que a primeira tentativa de verificar a mutação 2 produziu
**resultado inconclusivo** — o comando `timeout` não existe no macOS — e foi
refeita em vez de aceita como sucesso.

### Verificações finais

`npm test` 8 de 8 em 2 arquivos; `tsc --noEmit` exit 0; `eslint` exit 0.

- **Decisão/Resultado**: Quatro defeitos corrigidos, nenhum conhecido em aberto.
  A restrição ao loopback deixou de ser convenção e virou invariante imposta em
  runtime. `plan.md` atualizado com a garantia e a evidência.
- **Verificações**: as acima, mais três rodadas de teste de mutação.
- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado.

---

## EVT-034

> **SPEC KIT** — Comando: `plan` (Phase 0 e Phase 1 faltantes) e `tasks`
> (formato) | Invocação: `check-prerequisites.sh --json` para verificação |
> Integração: `claude` | Artefatos: `specs/001-criar-cartao/research.md`,
> `data-model.md`, `contracts/api-cartoes.md`, `quickstart.md`,
> `tasks.md`

- **Data/hora**: 2026-09-21 01:40 -03
- **Ator**: USER → ARCHITECT
- **Fase**: correção de conformidade com o fluxo do Spec Kit
- **Feature / Task**: `001-criar-cartao`
- **Tipo**: Dois desvios estruturais do Arquiteto, encontrados e corrigidos
- **Skills aplicadas**: —
- **Comandos**: `check-prerequisites.sh --json`, inspeção do
  `tasks-template.md` e da skill `speckit-implement`

### Commit anterior

O commit descrito em EVT-033 foi criado com o hash `0aab074683a47ca95a86da73d250426826c905ae`.

### Pergunta do Product Owner (sanitizada)

```text
Sim, mas antes, revise se o fluxo esperado pelo Github Spec Kit está pronto para ele
```

### Resposta verificada: não estava

**Desvio 1 — `tasks.md` sem caixas de seleção.** As 14 tarefas foram escritas
como tabelas, com **zero** marcadores `- [ ]`. A skill `speckit-implement`
exige literalmente *"For completed tasks, make sure to mark the task off as
[X] in the tasks file"* e lista como critério de conclusão *"All tasks in
tasks.md completed and marked [X]"*. Consequência concreta: **T001 estava
concluída e não havia onde registrar isso**, e o critério de conclusão do
comando era inverificável. O Prompt 7 mandava não marcar tarefa como concluída
sem evidência — pressupondo que marcar fosse possível.

**Desvio 2 — artefatos de Phase 0 e Phase 1 ausentes.**
`check-prerequisites.sh --json` devolvia `AVAILABLE_DOCS: []`. A skill
`speckit-plan` manda gerar `research.md` na Phase 0 e `data-model.md`,
`contracts/` e `quickstart.md` na Phase 1; a skill `speckit-tasks` os
consome explicitamente. O Arquiteto consolidou todo o conteúdo dentro de
`plan.md`: a informação existia, nos arquivos errados. Com a lista vazia,
todo comando seguinte rodaria cego.

**Causa**: regressão introduzida na decomposição de EVT-027. A feature
guarda-chuva **possuía** os quatro artefatos; ao escopar o plano para a
`001`, o Arquiteto não os recriou.

### Correções aplicadas

| Correção | Verificação |
|---|---|
| `research.md` criado, com as decisões da feature, incluindo o piso de Node revisto e a troca de driver | — |
| `data-model.md` criado, com a tabela `cartao` e o gatilho de migração da feature `002` | — |
| `contracts/api-cartoes.md` criado, com duas rotas e quatro códigos de erro | — |
| `quickstart.md` criado, incluindo roteiro de verificação da garantia de loopback | — |
| `tasks.md` convertido para caixas de seleção, com os metadados preservados em blocos recolhidos | 13 pendentes + 1 concluída = 14 |
| **T001 marcada como `[X]`** | — |
| `.DS_Store` removido do diretório da feature | — |

`check-prerequisites.sh --json` passou a devolver
`["research.md","data-model.md","contracts/","quickstart.md"]`.

### Determinação do Product Owner sobre as demais features

```text
OK, agora revise o fluxo para todos os outros Specs. Você sugeriu não fazer
isso, mas sou contrário a essa ideia. Itere até termos 100% alinhado, e então os
Workers Deepseek podem atuar de modo livre
```

O Arquiteto havia recomendado, em EVT-030, adiar a correção das features
`002` a `006` para o `clarify` de cada uma. **O Product Owner decidiu em
contrário**: as seis devem estar alinhadas antes de os workers atuarem. A
decisão é registrada e acatada; a `001` passa a ser o gabarito estrutural.

- **Decisão/Resultado**: Fluxo do Spec Kit conforme para a feature `001`.
  Iniciado o alinhamento das features `002` a `006`.
- **Verificações**: `AVAILABLE_DOCS` populado; contagem de caixas de seleção
  conferida; blocos recolhidos balanceados.
- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado.

---

## EVT-035

> **SPEC KIT** — Comando: `clarify`, `plan`, `checklist`, `tasks`,
> `analyze` | Invocação: `check-prerequisites.sh --json` e análise por
> script | Integração: `claude` | Artefatos: sete em
> `specs/002-criar-baralho/`

- **Data/hora**: 2026-09-21 02:05 -03
- **Ator**: ARCHITECT
- **Fase**: fluxo completo da feature `002`
- **Feature / Task**: `002-criar-baralho` / T101–T112
- **Tipo**: Alinhamento da segunda feature ao gabarito da `001`
- **Skills aplicadas**: `domain-modeling`, `codebase-design`

### Commit anterior

O commit descrito em EVT-034 foi criado com o hash `40e80b9c56fe3ea168ca51a379b12060d9c172f8`.

### Débito de EVT-030 fechado nesta feature

A spec trazia apenas a linha *"as premissas de 001 valem integralmente"* e
nenhum requisito transversal. Fechado com **FR-042, FR-044, FR-045, FR-046**
reutilizados e **FR-057 a FR-061** específicos, todos com cenário de aceitação.

**Regra de numeração estabelecida e registrada na própria spec**: requisito
transversal de enunciado genérico é **reutilizado** com o mesmo identificador
nas features onde é observável; requisito cujo enunciado nomeia a entidade
recebe identificador próprio. Isso evita duplicar a mesma regra sob nomes
diferentes, e evita a duplicação acidental que o `analyze` procura.

### Decisão técnica nova — migração de esquema

O `research.md` da feature `001` havia declarado o gatilho: *"A feature 002
acrescentará a tabela baralho — esse é o momento em que migração versionada
passa a ser necessária, por haver base instalada."*

**O gatilho chegou.** Quem usou a `001` tem arquivo SQLite com Cartões reais.
Adotada a forma mínima: tabela `versao_do_esquema`, migrações ordenadas
aplicadas em transação, sem framework e sem dependência nova.

**T102 é a tarefa de maior risco da feature**, e o artefato diz isso
explicitamente: ela toca base instalada com dados reais, e seu teste exige
migrar uma base da `001` **com Cartões dentro** e provar que nenhum se perdeu.

### Decisão de contrato — antecipar forma sem antecipar comportamento

`GET /baralhos` já devolve `quantidadeDeCartoes` e `elegivel`, que nesta
feature são invariavelmente `0` e `false` por não existir Vínculo. A forma
antecipa a variação que a feature `003` trará, de modo que a `003` **não
precise alterar este contrato**. Não é abstração especulativa: é o formato
final de um campo cujo valor ainda não varia.

### `analyze` — um achado real, corrigido

| Passagem | Achado | Correção |
|---|---|---|
| 1ª | **FR-023, FR-024 e FR-040 apareciam na matriz de rastreabilidade mas não eram declarados na spec** | Declarados como transversais reutilizados, com o cenário 4 estendido para cobrir a validação autoritativa |
| 1ª | `deck` sinalizado em `spec.md` e `plan.md` | **Falsos positivos** verificados linha a linha: "Subdecks" nomeia funcionalidade adiada, e a linha do plano **declara** o termo proibido |
| 2ª | Nenhum achado | — |

Estado final: 18 requisitos, 5 critérios, 10 cenários, 12 tarefas rastreáveis,
checklist 21 de 21, `AVAILABLE_DOCS` com os quatro artefatos.

- **Decisão/Resultado**: Feature `002` alinhada ao gabarito. Portões abertos.
- **Verificações**: `analyze` em duas passagens; `check-prerequisites`
  populado; contagem de caixas de seleção conferida.
- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado.

---

## EVT-036

> **SPEC KIT** — Comando: `clarify`, `plan`, `checklist`, `tasks`,
> `analyze` | Invocação: `check-prerequisites.sh --json --require-tasks
> --include-tasks` e inspeção de rastreabilidade | Integração: `claude` |
> Artefatos: sete artefatos em cada uma das features `003` a `006`,
> `pendencias.md`

- **Data/hora**: 2026-09-20 21:01 -03
- **Ator**: USER → ARCHITECT
- **Fase**: correção integral do fluxo do Spec Kit
- **Feature / Task**: `003-vincular-cartao-baralho`, `004-sessao-de-estudo`,
  `005-editar-cartao-e-baralho`, `006-excluir-cartao-e-baralho` / —
- **Tipo**: conclusão dos artefatos e correção dos requisitos transversais
- **Skills aplicadas**: `domain-modeling`, `codebase-design`

### Resultado e verificações

- 003 corrigida: seção negativa única, três estados vazios, falha de vincular e
  desvincular, e contagens internas corretas.
- 004–006 receberam plano, pesquisa, modelo, contrato, quickstart, checklist e
  tarefas; o débito transversal EVT-030 foi fechado nas quatro features.
- Sessão permanece local e efêmera: nenhuma rota, tabela ou migração de Sessão.
- Os quatro diretórios possuem os sete artefatos; pré-requisitos de 003 listam
  `research.md`, `data-model.md`, `contracts/`, `quickstart.md` e
  `tasks.md`; `git diff --check` passou.
- Nenhum placeholder ou clarificação pendente foi encontrado.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-038

> **SPEC KIT** — Comando: implement | Invocação: revisão do Arquiteto após
> workers DeepSeek | Integração: claude | Artefatos: frontend/, esquema do Acervo
> e tasks da feature 001

- **Data/hora**: 2026-09-20 21:40 -03
- **Ator**: ARCHITECT
- **Fase**: implement
- **Feature / Task**: 001-criar-cartao / T002 e T004 — concluídas

T002 e T004 foram aceitas após a revisão do Arquiteto; a reprovação anterior
decorreu exclusivamente do worktree compartilhado, não de defeito material.

- T002: frontend TypeScript/React/Vite com página neutra, 2 testes, build e lint.
- T004: tabela cartao SQLite, CHECKs de conteúdo e limites, PRAGMA de chaves
  estrangeiras, 12 testes de esquema.
- Verificação integrada: backend 20 testes, build e lint; frontend 2 testes,
  build e lint. O bind em loopback passou fora do sandbox.

As caixas de T002 e T004 foram marcadas [X]. Próximas fundações: T003 e T005.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado.

---

## EVT-037

> **SPEC KIT** — Comando: implement | Invocação: dois workers DeepSeek |
> Integração: claude | Artefatos: frontend/, backend/src/acervo/ e
> backend/tests/acervo/

- **Data/hora**: 2026-09-20 21:38 -03
- **Ator**: USER → ARCHITECT → WORKER
- **Fase**: implement
- **Feature / Task**: 001-criar-cartao / T002 e T004
- **Tipo**: falha de isolamento de workers e alteração de processo

### Resultado verificável

T002 e T004 foram iniciadas em paralelo no mesmo diretório. Embora cada worker
tenha produzido apenas sua parte material, o verificador de escopo viu o diff
compartilhado e reprovou ambos por arquivos fora de suas permissões. Nenhum
resultado foi aceito ou marcado concluído nesse momento.

O Arquiteto revisou os arquivos: frontend em T002 e esquema/testes de SQLite em
T004. As verificações independentes passaram: backend 20 testes, build e lint;
frontend 2 testes, build e lint. O teste de loopback exigiu ambiente fora do
sandbox, onde passou.

### Determinação do Product Owner

Cada Worker precisa existir num próprio worktree.

### Decisão de processo

Toda delegação DeepSeek futura terá worktree exclusivo, baseline fixado e área
de escrita limitada. Workers não fazem commit. O Arquiteto revisa o diff no
worktree, executa verificações e integra no worktree principal somente após
aceite. A decisão corrige o defeito de processo observado acima.

- **Commit**: pendente de integração de T002/T004.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-040

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek em worktree
> isolado | Integração: claude | Artefatos: Acervo, testes e SESSION.md

- **Data/hora**: 2026-09-20 22:01 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 001-criar-cartao / T006 — concluída

### Correção de auditoria sem reescrita

EVT-039 foi materialmente inserido após EVT-003, e os eventos EVT-038 e EVT-037
ficaram em ordem visual inversa. A causa foi uso de contexto não exclusivo em
aplicações de patch. Em respeito ao histórico append-only, os eventos não foram
movidos ou reescritos. A ordem cronológica canônica é EVT-037, EVT-038, EVT-039
e este EVT-040. Eventos futuros serão anexados usando contexto terminal único.

### T006

O worker executou em worktree exclusivo. Seus checks iniciais falharam com
exit 127 porque o worktree não possuía node_modules. Após npm install, o
Arquiteto executou 30 testes, build e lint, todos verdes. O diff permaneceu
restrito ao Acervo e aos testes. T006 foi aceita e marcada [X].

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-053

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek T105 | Integração: não integrada

- **Data/hora**: 2026-09-21 00:46 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 002-criar-baralho / T105 — cancelada antes da revisão

O job `dsw_muan1ax2_y8xf5n` ficou preso no streaming do modelo, reportou
`unrecognized_model` e continuou emitindo alterações após o pedido de
cancelamento. O processo foi encerrado pelo PID exato e o worktree exclusivo
`/private/tmp/memorization-t105` foi removido. As alterações parciais (seis
arquivos, sem checks executados e com política de revisão pendente) não foram
integradas nem consideradas como implementação. T105 permanece pendente.

- **Commit**: nenhuma alteração de código integrada.
- **Sanitização**: Confirmada; worktree do job removido e alterações locais do
  Product Owner preservadas.

## EVT-041

> **SPEC KIT** — Comando: implement | Invocação: dois workers DeepSeek em
> worktrees exclusivos | Integração: claude | Artefatos: Adapter HTTP de Cartão

- **Data/hora**: 2026-09-20 22:15 -03
- **Ator**: USER → ARCHITECT → WORKER
- **Feature / Task**: 001-criar-cartao / T007 — concluída

O primeiro worker de T007 recebeu worktree sem dependências e seus checks
falharam com exit 127; a revisão posterior revelou TS18046 no error handler.
O Product Owner determinou eliminar a repetição desse erro.

Foi instituído portão obrigatório: criar worktree, instalar dependências,
validar baseline, delegar, repetir checks pelo worker e repetir pelo Arquiteto.
Um novo worktree e um novo worker aplicaram o reparo. Resultado final: 45
testes, build e lint verdes, escopo restrito às rotas HTTP, composição e testes
de contrato. T007 foi aceita e marcada [X].

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-042

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek em worktree
> preparado e exclusivo | Integração: claude | Artefatos: ClienteDoAcervo

- **Data/hora**: 2026-09-20 22:28 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 001-criar-cartao / T008 — concluída

O worktree exclusivo de T008 foi criado sobre o commit integrado mais recente,
teve as dependências instaladas e passou pelo portão de baseline antes da
delegação. O worker implementou a Seam assíncrona `ClienteDoAcervo`, seus
Adapters `ClienteHttp` e `ClienteEmMemoria`, os quatro erros de domínio e o
modo `indisponivel`, com bateria de contrato comum aos dois Adapters.

O worker encerrou com testes, build e lint verdes e sem alteração fora do
escopo permitido. O Arquiteto inspecionou o resultado e repetiu de modo
independente: 37 testes de frontend, build e lint, todos verdes. T008 foi
aceita e marcada [X].

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-043

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek em worktree
> preparado e exclusivo | Integração: claude | Artefatos: telas de Cartões

- **Data/hora**: 2026-09-20 22:38 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 001-criar-cartao / T009 — concluída

Após instalação e baseline verde no worktree exclusivo, o worker substituiu a
tela de infraestrutura pelo fluxo de criação e listagem de Cartões, conectado
somente à Interface `ClienteDoAcervo`. O estado vazio orienta a primeira ação,
a contagem e o limite são comunicados durante a digitação e uma criação válida
aparece imediatamente na lista. A composição de produção usa `ClienteHttp`.

O diff ficou restrito ao frontend autorizado. Worker e Arquiteto executaram de
forma independente a suíte com 40 testes, o build e o lint; todos passaram.
T009 foi aceita e marcada [X].

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-044

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek em worktree
> preparado e exclusivo | Integração: claude | Artefatos: falha de criação

- **Data/hora**: 2026-09-20 22:41 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 001-criar-cartao / T010 — concluída

O worker comprovou o fluxo de indisponibilidade pela Interface: uma criação
recusada exibe a mensagem recebida, não entra na lista e preserva integralmente
Frente e Verso. A nova tentativa reutiliza o conteúdo e só aparece concluída
depois de persistida. Se a listagem inicial falhou, uma criação posterior
reconcilia a lista novamente por `ClienteDoAcervo`.

O escopo permaneceu restrito à tela e aos seus testes. Worker e Arquiteto
executaram independentemente 44 testes, build e lint do frontend, todos verdes.
T010 foi aceita e marcada [X].

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-045

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek em worktree
> preparado e exclusivo | Integração: claude | Artefatos: E2E responsivo

- **Data/hora**: 2026-09-20 22:53 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 001-criar-cartao / T013 — concluída

T013 foi executada em paralelo seguro com T011, cada worker em seu próprio
worktree. O worker estendeu o harness para servir também o frontend React real
e criou teste Chromium em viewport de telefone. O transporte foi interceptado
para devolver 50 Cartões determinísticos; a prova verifica ausência de rolagem
horizontal no topo e no fim e localização visual de um Cartão conhecido.

O worker e o Arquiteto repetiram 44 testes de frontend, build, lint e os dois
cenários Playwright; tudo passou. O smoke original permaneceu verde, não houve
mudança de CSS porque a tela já satisfez a prova real. T013 foi aceita [X].

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-046

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek em worktree
> preparado e exclusivo | Integração: claude | Artefatos: teclado e foco

- **Data/hora**: 2026-09-20 22:56 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 001-criar-cartao / T011 — concluída

O worker implementou a direção de foco a partir dos códigos estáveis devolvidos
por `ClienteDoAcervo`, sem revalidar conteúdo na tela. As recusas de Frente e
Verso focam o campo correto; a indisponibilidade mantém o foco no acionador.
Controles nativos preservam a ordem visual de teclado e `:focus-visible` usa
contorno sólido com espessura e afastamento, não apenas cor.

A bateria cobre o percurso Frente → Verso → Criar Cartão, os quatro erros de
domínio e o indicador geométrico. Worker e Arquiteto repetiram 51 testes,
build e lint do frontend, todos verdes. T011 foi aceita e marcada [X].

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-047

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek em worktree
> preparado e exclusivo | Integração: claude | Artefatos: persistência E2E

- **Data/hora**: 2026-09-20 23:13 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 001-criar-cartao / T014 — concluída

O worker criou prova Playwright integral sem transporte simulado: API e
frontend reais usam portas livres e SQLite temporário. O navegador cria dois
Cartões pela UI; ambos os processos são encerrados e reiniciados sobre o mesmo
arquivo; a UI e a API confirmam Frentes, Versos e ids persistidos. O suporte
encerra processos em `finally` e remove os artefatos temporários.

O navegador exigiu CORS entre duas portas do loopback. Foi adicionado CORS
mínimo apenas em `/cartoes`, com cinco testes HTTP. Na revisão independente,
passaram 50 testes backend, 51 frontend, builds, lints e três E2E, incluindo o
reinício real. T014 foi aceita e marcada [X].

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-048

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek em worktree
> preparado e exclusivo | Integração: claude | Artefatos: semântica acessível

- **Data/hora**: 2026-09-20 23:14 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 001-criar-cartao / T012 — concluída

O estado vazio passou a ser uma região `status` polida e atômica. Falhas de
criação e listagem permanecem alertas assertivos, agora nomeados por contexto,
inclusive quando a mesma mensagem aparece simultaneamente nos dois fluxos. A
bateria consulta papel, nome e estado acessíveis e comprova reanúncio em nova
tentativa, preservando o foco implementado em T011.

O worker criou por engano um commit apenas dentro do worktree; o Arquiteto não
o propagou como commit, aplicou somente o patch revisado e manteve a integração
sob sua autoridade. As próximas delegações proíbem commit explicitamente.
Passaram independentemente 59 testes, build e lint. T012 foi aceita [X].

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-049

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek em worktree
> preparado e exclusivo | Integração: claude | Artefatos: migrações SQLite

- **Data/hora**: 2026-09-20 23:24 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 002-criar-baralho / T101 — concluída

Foi introduzido o aplicador versionado interno ao `Acervo`: sequência ordenada,
controle em `versao_do_esquema`, transação individual e elevação da versão na
mesma transação. A migração 1 adota bases legadas da feature 001 por
`CREATE TABLE IF NOT EXISTS`, preservando Cartões existentes e mantendo
`foreign_keys` ativo por conexão.

Os testes comprovam base nova, não reaplicação, adoção de base legada e rollback
sem estado parcial quando uma migração falha. Worker e Arquiteto repetiram 58
testes backend, build e lint, todos verdes. T101 foi aceita e marcada [X].

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-050

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek em worktree
> preparado e exclusivo | Integração: claude | Artefatos: migração de Baralho

- **Data/hora**: 2026-09-20 23:30 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 002-criar-baralho / T102 — concluída

A migração 2 cria somente `baralho`, com `id` e `nome`, CHECK de conteúdo e
limite inclusivo de 100 caracteres, sem unicidade, elegibilidade ou Vínculo.
Uma base legada da feature 001 com três Cartões reais foi migrada até a versão
2 e reaberta, preservando integralmente o conteúdo e sem reaplicar a migração.

A bateria cobre forma do esquema, três recusas, limite inclusivo e nomes
repetidos. Worker e Arquiteto repetiram 67 testes backend, build e lint, todos
verdes. T102 foi aceita e marcada [X].

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-051

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek em worktree
> preparado e exclusivo | Integração: claude | Artefatos: criação de Baralho

- **Data/hora**: 2026-09-20 23:36 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 002-criar-baralho / T103 — concluída

A Interface do `Acervo` agora cria Baralho com id opaco e nome, escondendo SQL
parametrizado e validação autoritativa. Nome vazio ou só de espaços produz
`nome_vazio`; 101 caracteres produz `nome_muito_longo` com limite e tamanho;
100 e nomes repetidos são aceitos. Propriedades extras não atravessam a
Interface.

Toda a bateria usa SQLite em memória pela Interface, sem consultar tabela.
Worker e Arquiteto repetiram 74 testes backend, build e lint, todos verdes.
T103 foi aceita e marcada [X].

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-052

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek em worktree
> preparado e exclusivo | Integração: claude | Artefatos: lista de Baralhos

- **Data/hora**: 2026-09-20 23:40 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 002-criar-baralho / T104 — concluída

`listarBaralhos` foi acrescentado à Interface do `Acervo`. Cada item contém
id, nome, `quantidadeDeCartoes` e `elegivel`; os dois últimos são derivados na
leitura e nunca persistidos. Como ainda não existe Vínculo, a contagem é zero
e a elegibilidade é falsa. Baralhos homônimos permanecem distintos.

Os testes atravessam exclusivamente a Interface e não dependem de ordenação.
Worker e Arquiteto repetiram 78 testes backend, build e lint, todos verdes.
T104 foi aceita e marcada [X].

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-054

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek (deepseek-v4-pro,
> loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: rotas de Baralho, ClienteDoAcervo de Baralho

- **Data/hora**: 2026-09-21 00:02 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 002-criar-baralho / T105 e T106 — concluídas
- **Commit anterior**: `d06ed99`

### Diretiva do Product Owner

"Finalize o produto. Use DeepSeek como implementadores; você será o arquiteto."

### Mecanismo de worker

Após o travamento do job de T105 (EVT-053), o Arquiteto passou a acionar os
workers por um loop agêntico próprio sobre a API DeepSeek (`deepseek-v4-pro`),
fora do repositório (scratchpad). Ferramentas do worker: listar, ler, escrever e
editar arquivos, e executar comandos no worktree. Escrita confinada a
`backend/`, `frontend/` e `e2e/`; `git commit` e comandos destrutivos
bloqueados. Cada worker recebe worktree exclusivo com dependências instaladas e
baseline verde. O Arquiteto revisa o diff, repete as verificações e integra.

### T105 e T106

`POST /baralhos` e `GET /baralhos` como Adapter fino sobre o `Acervo`, com
CORS equivalente ao de Cartões; nome repetido devolve 201. `ClienteDoAcervo`
ganhou `criarBaralho` e `listarBaralhos` nos dois Adapters, com a mesma
bateria de contrato. Arquiteto repetiu: backend 97 testes, frontend 90 testes,
build e lint verdes.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-055

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek (deepseek-v4-pro,
> loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: migração 3, vincular, desvincular, obterBaralho, leituras derivadas

- **Data/hora**: 2026-09-21 00:14 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 003-vincular-cartao-baralho / T201–T206 — concluídas
- **Commit anterior**: `ff56eab`

Migração 3 cria `vinculo` com chave composta e `ON DELETE CASCADE` nas duas
chaves estrangeiras; a cascata foi comprovada nos dois sentidos sem destruir a
outra entidade. A Interface do `Acervo` ganhou `vincular`, `desvincular` e
`obterBaralho`; duplicata é traduzida da violação de chave primária em
`vinculo_duplicado`, sem vazar erro do driver. `listarBaralhos` deriva
contagem e elegibilidade por contagem na leitura; `listarCartoes` traz os
Baralhos de cada Cartão (mudança aditiva de contrato).

Desvio declarado pelo worker e aceito pelo Arquiteto: asserções exatas de dois
testes HTTP de Cartão foram atualizadas para o campo aditivo `baralhos`.
Worker em paralelo com T105 (áreas disjuntas). Após integração, o Arquiteto
repetiu em `main`: backend 119 testes, build e lint verdes.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-056

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek (deepseek-v4-pro,
> loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: casca de navegação, tela de Baralhos, testes de acessibilidade, e2e

- **Data/hora**: 2026-09-21 00:20 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 002-criar-baralho / T107–T112 — concluídas (feature 002 completa)
- **Commit anterior**: `56a9005`

### Decisão de arquitetura (Arquiteto)

A aplicação passa a ter uma casca `Aplicacao` com `nav` principal e navegação
por hash (`#/cartoes`, `#/baralhos`), sem dependência de roteador. A
interpretação de rota fica concentrada numa única função, que as features
seguintes estendem com `#/baralhos/<id>` (Vínculos) e `#/baralhos/<id>/estudo`
(Sessão de estudo). Na troca de rota o foco vai ao título da tela.

### T107–T112

Tela de Baralhos com estado vazio, aviso de limite durante a digitação,
elegibilidade comunicada por texto, falha de gravação preservando o nome,
teclado, leitor de tela, telefone com 10 Baralhos e persistência após
reinício. `PaginaDeCartoes` trocou sua raiz `main` por `div` para que a casca
detenha o único `main`.

### Defeito encontrado na revisão

A E2E de persistência fixava a versão do esquema em 2 e falhou em `main`, que já
tem a migração 3. Um worker de reparo passou a derivar a versão mais recente da
lista de migrações do backend. Arquiteto repetiu em `main`: backend 119,
frontend 115, e2e 5, build e lint verdes.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-057

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek (deepseek-v4-pro,
> loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: rotas de Vínculo, edição e exclusão; Interface do Acervo; CORS

- **Data/hora**: 2026-09-21 00:23 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 003/T207, 005/T401–T402 (+ metade backend de T403), 006/T501–T502 (+ metade backend de T503)
- **Commit anterior**: `a4a1802`

Um único worker concluiu todo o backend restante, por ter área de escrita
disjunta dos workers de frontend que rodaram em paralelo. Interface do `Acervo`:
`editarCartao`, `renomearBaralho`, `excluirCartao`, `excluirBaralho`, com as
mesmas regras da criação e exclusão apoiada na cascata do esquema. Rotas
conforme `api-vinculos.md`, `api-edicao.md` e `api-exclusao.md`; CORS estendido
a PUT, DELETE e caminhos parametrizados.

T403 e T503 permanecem abertas até a metade cliente (`ClienteDoAcervo`) ser
integrada. Arquiteto verificou aderência de status aos três contratos e repetiu
em `main`: backend 164, frontend 115, e2e 5, build e lint verdes.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-058

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek (deepseek-v4-pro,
> loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: ClienteDoAcervo: Vínculo, edição, exclusão

- **Data/hora**: 2026-09-21 00:34 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 003/T208, 005/T403 (metade cliente), 006/T503 (metade cliente) — concluídas
- **Commit anterior**: `a7a985a`

A Seam `ClienteDoAcervo` ganhou `vincular`, `desvincular`, `obterBaralho`,
`editarCartao`, `renomearBaralho`, `excluirCartao` e `excluirBaralho` nos dois
Adapters; `ClienteEmMemoria` passou a derivar contagem e elegibilidade de seus
Vínculos. Baterias compartilhadas rodam contra os dois Adapters, com casos de
resposta fora do contrato para `ClienteHttp`. Com a metade backend já em `main`,
T403 e T503 ficam concluídas. Arquiteto conferiu os status tratados contra os
contratos e repetiu em `main`: backend 164, frontend 171, build e lint verdes.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-059

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek (deepseek-v4-pro,
> loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: Module SessaoDeEstudo e Seam Aleatoriedade

- **Data/hora**: 2026-09-21 00:42 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 004-sessao-de-estudo / T301–T303 — concluídas
- **Commit anterior**: `66bce1c`

Module `SessaoDeEstudo` no cliente, em processo e sem persistência: `iniciar`,
`revelar`, `registrarResultado` e `estadoAtual`, conforme `contracts/sessao-de-estudo.md`.
Seleção sem repetição (Fisher–Yates) sobre a Seam `Aleatoriedade` (Adapter real
e determinístico), limite ao disponível com aviso, Revelação obrigatória antes
do Resultado, Resultado imutável e Resumo coerente. Falha é valor discriminado
por `ok`, no idioma do código. T303: nenhuma rota, tabela ou armazenamento do
navegador; o Module importa apenas o tipo `Cartao`. Worker em paralelo com os
de backend e cliente (áreas disjuntas). Arquiteto repetiu em `main`: frontend
verde, build e lint.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-060

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek (deepseek-v4-pro,
> loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: tela do Baralho (Vínculos), extensões das listas, e2e

- **Data/hora**: 2026-09-21 00:51 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 003-vincular-cartao-baralho / T209–T214 — concluídas (feature 003 completa)
- **Commit anterior**: `7a587d7`

Rota `#/baralhos/<id>` com `PaginaDoBaralho`: Cartões vinculados com
Desvincular (sem confirmação, FR-066) e não vinculados com Vincular, três
estados vazios distintos, releitura após cada operação para nunca exibir Vínculo
não confirmado, foco preservado na lista oposta e anúncios de Vínculo e de
elegibilidade. Lista de Baralhos aponta para o detalhe; lista de Cartões mostra
os Baralhos de cada Cartão. E2E de telefone e de persistência, com a versão do
esquema derivada das migrações. Arquiteto repetiu em `main`: backend 164,
frontend 205, e2e 7, build e lint verdes.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-061

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek (deepseek-v4-pro,
> loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: tela de estudo, testes de acessibilidade, e2e

- **Data/hora**: 2026-09-21 01:08 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 004-sessao-de-estudo / T304–T308 — concluídas (feature 004 completa)
- **Commit anterior**: `a68da26`

Rota `#/baralhos/<id>/estudo` com `PaginaDeEstudo` sobre a Interface do Module
`SessaoDeEstudo`: início com quantidade e aviso de limite, Item com progresso,
Revelação, Resultado e Resumo; interromper descarta a Sessão ao sair da rota.
Nenhuma chamada de rede depois de carregar o Baralho. Foco movido a cada
transição e anúncios polidos. Rótulos visíveis "Acertei"/"Errei" com valores
canônicos acertou/errou — escolha do worker, aceita pelo Arquiteto. E2E de
Sessão completa até o Resumo, descarte ao recarregar e telefone.

Defeito de processo evitado: dois workers executariam E2E nas mesmas portas fixas
com `reuseExistingServer`, e um testaria o código do outro. O worker de
edição/exclusão foi reiniciado com portas próprias e `CI=1`. Arquiteto repetiu
em `main`: backend 164, frontend 222, e2e 9, build e lint verdes.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-062

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek (deepseek-v4-pro,
> loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: edição e exclusão na UI, diálogo de confirmação, e2e com API real

- **Data/hora**: 2026-09-21 01:23 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 005/T404–T407 e 006/T504–T508 — concluídas (features 005 e 006 completas)
- **Commit anterior**: `a46eb44`

Edição inline de Cartão com alcance declarado, renomear e excluir Baralho no
detalhe, confirmação de descarte, diálogo nativo `<dialog>` que declara as
consequências (Vínculos removidos, a outra entidade preservada), Escape cancela,
foco devolvido ao controle de origem. Falha preserva conteúdo ou entidade.

### Defeitos encontrados na revisão

1. As E2E de edição e exclusão usavam uma API falsa interceptada no navegador;
   rotas PUT/DELETE reais, cascata SQLite e preflight CORS nunca eram exercidos
   (Princípio VI). Rejeitado; um worker de reparo reescreveu os fluxos contra
   API e frontend reais, mantendo interceptação apenas para simular
   indisponibilidade.
2. A integração conflitou com a UI de Sessão em `servidores-locais.ts` (helpers
   homônimos) e `PaginaDoBaralho.tsx`. Um worker de merge unificou os helpers e
   preservou o link de estudo e as ações de edição/exclusão; trocou também o foco
   pós-Vínculo para `useLayoutEffect`, estabilizando um teste de foco.

Arquiteto repetiu em `main` três vezes: backend 164, frontend 236, e2e 13,
build e lint verdes, sem instabilidade.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-063

> **SPEC KIT** — Comando: implement | Invocação: worker DeepSeek (deepseek-v4-pro,
> loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: rastreabilidade requisito→teste, progresso da Sessão

- **Data/hora**: 2026-09-21 01:33 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: converge — todas as features
- **Commit anterior**: `24c6310`

> Comando Spec Kit: converge (primeira execução no projeto).

Todas as 57 tarefas restantes estavam marcadas; o converge comparou o código
com as specs pela rastreabilidade exigida no Princípio IX. Varredura: 3 FRs
(FR-023, FR-026, FR-067) e 6 SCs (SC-001, SC-002, SC-009, SC-013, SC-015,
SC-016) sem nenhum teste que os citasse. Um worker verificou cada enunciado:
etiquetou testes que já os comprovavam, escreveu os que faltavam (100 Sessões
com Aleatoriedade real para SC-002; edição só por teclado para FR-067; Verso
acima de 1000 na edição para SC-016) e encontrou **uma lacuna real de
produto**: SC-015 exigia saber a qualquer momento quantos Itens foram
respondidos e quantos faltam; a tela de estudo passou a exibir as duas contagens.

Resultado: 69 de 69 FRs e todos os SCs citados em testes que os verificam.
Arquiteto repetiu em `main`: backend 165, frontend 240, e2e 13, build e lint
verdes.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-064

> **SPEC KIT** — Comando: nenhum (encerramento) | Invocação: nenhuma | Integração: claude | Artefatos: SESSION.md, pendencias.md

- **Data/hora**: 2026-09-21 01:35 -03
- **Ator**: ARCHITECT
- **Feature / Task**: encerramento da implementação das seis features
- **Commit anterior**: `9e88a9d`

### Hashes pendentes

- EVT-063 (converge) foi commitado em `5789c90`.
- `pendencias.md` foi atualizado para "produto concluído" em `3746bf1`, e o
  total de tarefas foi corrigido de 83 para 63 em `9e88a9d`.

### Correção de auditoria sem reescrita

O banner do EVT-063 diz "Comando: implement". O comando executado foi
**converge**, como o corpo do evento declara. O evento não é reescrito.

### Verificações finais

Teste manual da API real (porta 3901, SQLite temporário, removido ao fim):
criar Cartão e Baralho, vincular (201), vínculo duplicado (409), elegibilidade
e contagem derivadas, `baralhos` em `GET /cartoes`, preflight de CORS para DELETE
(204, métodos GET, POST, PUT, DELETE, OPTIONS) e exclusão de Baralho (204) com
o Cartão preservado. O build do frontend passou.

### Limpeza

Os doze worktrees desta sessão foram removidos. Os worktrees de T003–T104,
anteriores a esta sessão, continuam registrados (`pendencias.md`, seção 5).
O grafo do graphify foi atualizado depois das mudanças de código.
`backend/src/hello-world.ts` foi preservado e deixado fora dos commits.

- **Commit**: o deste evento; o próximo evento registra o hash.
- **Sanitização**: Confirmada. A chave da API DeepSeek só foi usada por variável
  de ambiente e nunca foi escrita.

---

## EVT-065

> **SPEC KIT** — Comando: nenhum (encerramento) | Invocação: worker DeepSeek
> (deepseek-v4-pro) em worktree exclusivo para D-2 | Integração: claude | Artefatos: servidor.ts, escuta.test.ts, pendencias.md (removido)

- **Data/hora**: 2026-09-21 01:39 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: fechamento de `pendencias.md` e commit final da aplicação
- **Commit anterior**: `8f0e6b8` (registra o hash de EVT-064)

### Prompt sanitizado

"Limpe tudo que temos em pendencias.md, e tire o arquivo fora. Faça um commit
final da aplicação."

### Fechamento de cada pendência

- **D-1** (testes fora do typecheck): encerrado por verificação. `tests` está no
  `include` de `backend/tsconfig.json`, e `npm run build` verifica tipos de 171
  testes.
- **D-2** (`PORTA` sem validação): corrigido pelo worker. Sem `PORTA`, usa 3001.
  Caso contrário exige inteiro de 1 a 65535; valor inválido lança
  `PortaInvalidaError` com mensagem em português antes de qualquer `listen`. Seis
  casos inválidos são testados. O harness E2E nunca usa a porta 0.
- **D-3** (`@types/node@^24` com runtime 26): encerrado por decisão. Os tipos
  seguem a versão mínima suportada (`engines >=24`), o que impede usar APIs que
  só existem no Node 25 ou 26.
- **D-4** (compatibilidade de migrações): encerrado por verificação. A migração 3
  foi entregue sobre as versões 1 e 2, com testes de base legada preservada e
  sem reaplicação (`migracao-baralho`, `migracao-vinculo`, e as E2E de
  persistência).
- **Worktrees antigos** de T003–T104: os 16 foram verificados e removidos. Todos
  continham só diffs já integrados; o da T012 entrou em `main` como `4acfb7c`.
- **`pendencias.md`**: removido por decisão do Product Owner. Não há outra
  referência a ele fora deste log.

Continua preservado e fora dos commits: `backend/src/hello-world.ts` (não
rastreado, de origem externa).

### Verificação final

Backend 171 testes, frontend 240, e2e 13 em Chromium contra API e SQLite
reais; build e lint verdes nos dois projetos.

- **Commit**: commit final da aplicação.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-066

> **SPEC KIT** — Comando: specify | Invocação: skill `speckit-specify` e
> `create-new-feature.sh --short-name criar-usuario` | Integração: claude |
> Artefatos: specs/007-criar-usuario/spec.md, checklists/requirements.md, CONTEXT.md

- **Data/hora**: 2026-09-21 01:49 -03
- **Ator**: PRODUCT OWNER → ARCHITECT → WORKER (rascunho)
- **Feature / Task**: 007-criar-usuario / specify
- **Commit anterior**: `9d43e9b` (registra o hash de EVT-065)

### Prompt sanitizado

Criar spec de autenticação: login básico com usuário e senha; senha cadastrada
com salt e hash com segredo, de modo que um vazamento de dados não permita
capturá-la; tela inicial, primeira da aplicação, para entrar; nenhuma sessão,
cookie ou equivalente. Planejamento integralmente pelo Spec Kit.

### Decisões do Product Owner

- Credencial enviada em toda requisição, mantida só em memória no cliente.
- Cadastro por tela de interface.
- **Acervo por usuário**: substitui a decisão B1 ("não tem usuário, por ora").
- Plano inicial com uma única spec **rejeitado**: "Quebre em 2 specs. 1 para
  criação de usuário, e outro para login". Resultado: `007-criar-usuario` e
  `008-entrar`.
- **Delegação apenas ao modelo flash**: "Não use [pro]. A ideia é reduzir custo.
  Use sempre o flash. Você faz o papel de Pro." O rascunho desta spec ainda foi
  gerado com `deepseek-v4-pro`, antes da determinação. O roteamento do delegator
  e o loop de workers passaram a usar exclusivamente o flash.

### Specify da 007

- Numeração: FR-070 a FR-083 e SC-020 a SC-026. O plano previa SC-017, que já
  existia; a correção foi feita antes de escrever.
- FRs transversais reutilizados: FR-040, FR-042, FR-044, FR-045 e FR-046.
- Glossário: nova seção **Acesso** com Usuário, Nome de usuário, Senha e
  Cadastro. "Criar conta" é aceito apenas como rótulo da ação na interface.

### Revisão do rascunho do worker

Corrigidos:
- Clarifications que davam como decididos limites ainda não confirmados pelo
  PO; foram movidos para Assumptions, "a confirmar no clarify";
- lacuna na numeração de SC;
- linha Input que atribuía a origem à decomposição do MVP;
- termos em `_Avoid_` que colidiam com termos canônicos;
- entidade HTML no título.

Checklist: 21 de 21.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhuma senha, segredo ou cabeçalho real
  registrado.

---

## EVT-067

> **SPEC KIT** — Comando: clarify | Invocação: skill `speckit-clarify` e
> `check-prerequisites.sh --json --paths-only` | Integração: claude |
> Artefatos: specs/007-criar-usuario/spec.md, checklists/requirements.md

- **Data/hora**: 2026-09-21 01:51 -03
- **Ator**: PRODUCT OWNER ↔ ARCHITECT
- **Feature / Task**: 007-criar-usuario / clarify
- **Commit anterior**: `11cae6f` (registra o hash de EVT-066)

Quatro perguntas, uma por vez, todas respondidas com a recomendação do
Arquiteto:

1. Nome de usuário: 3 a 50 caracteres; letras, dígitos, `.`, `_` e `-`;
   espaços ao redor descartados; único sem distinção de maiúsculas.
2. Senha: 8 a 128 caracteres, qualquer caractere, sem regras de composição
   (origem do FR-085).
3. Nome de usuário repetido é recusado com mensagem clara. A `008` continua
   sem revelar nada no Entrar.
4. Acesso à tela por um link "Criar conta" na navegação principal (origem do
   FR-084 e do cenário 13).

As premissas "a confirmar" foram eliminadas. Checklist: 21 de 21 mantida; a
contagem passou a 21 FRs. Cobertura: escopo, domínio, UX, segurança e
terminologia Clear. Desempenho e limitação de tentativas não se aplicam ao
Cadastro local; o bloqueio por tentativas está entre as Funcionalidades
Adiadas.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-068

> **SPEC KIT** — Comando: plan | Invocação: skill `speckit-plan` e
> `setup-plan.sh --json` | Integração: claude | Artefatos: plan.md,
> research.md, data-model.md, contracts/api-usuarios.md, quickstart.md
> (specs/007-criar-usuario)

- **Data/hora**: 2026-09-21 01:54 -03
- **Ator**: ARCHITECT → WORKER (rascunho, `deepseek-v4-flash`)
- **Feature / Task**: 007-criar-usuario / plan
- **Commit anterior**: `febc228` (registra o hash de EVT-067)

### Decisões de arquitetura (Arquiteto)

- Novo Module `Identidade` (`backend/src/identidade/`), separado do `Acervo`
  por Locality. Interface: `criarIdentidade(banco, segredo).cadastrar`. Nenhuma
  Seam nova e nenhuma dependência nova.
- Senha: `HMAC-SHA256(segredo, senha)` seguido de scrypt (N=32768, r=8, p=1,
  64 bytes), com sal aleatório de 16 bytes por Usuário e parâmetros gravados em
  JSON.
- Segredo: `SEGREDO_DAS_SENHAS`, obrigatório, com no mínimo 32 caracteres.
  `SegredoAusenteError` impede o início e nunca exibe o valor. O segredo deve
  ser o mesmo para uma mesma base.
- Migração 4: tabela `usuario` com `UNIQUE COLLATE NOCASE` e `CHECK`s. A
  duplicata vem da tradução da violação de `UNIQUE`. Nenhuma coluna consegue
  guardar a Senha.
- `POST /usuarios`: 201, 400 ou 409. Sem `Set-Cookie`. A Confirmação não é
  enviada à API. O logger continua desabilitado.
- Frontend: `criarUsuario` nos dois Adapters, rota `#/criar-conta` e link na
  navegação.

### Refinamento da spec

FR-073: "letras" passa a significar **A–Z, sem acento**. O `NOCASE` do SQLite
só iguala maiúsculas e minúsculas em ASCII, e com acentos a unicidade do FR-074
falharia. Um caso-limite correspondente foi acrescentado. O PO pode reverter
isso, ao custo de normalização Unicode própria.

### Revisão do rascunho do worker

Corrigidos:
- a contagem de FRs (16 para 21);
- a localização da migração 4 (lista única em `acervo/migracoes.ts`, não em
  `identidade/`);
- no quickstart, a frase de que o `export` "imprimiria" o segredo;
- a atribuição prematura do bloqueio por tentativas à `008`;
- uma omissão espúria no research.

`check-prerequisites.sh --json` lista research, data-model, contracts e
quickstart.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. O quickstart mostra apenas o comando de geração
  do segredo, nunca um valor.

---

## EVT-069

> **SPEC KIT** — Comando: tasks | Invocação: skill `speckit-tasks` e
> `setup-tasks.sh --json`; redação por worker `deepseek-flash` em worktree
> exclusivo, com escrita limitada a `specs/007-criar-usuario/` | Integração:
> claude | Artefatos: specs/007-criar-usuario/tasks.md

- **Data/hora**: 2026-09-21 01:57 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 007-criar-usuario / tasks
- **Commit anterior**: `0757093` (registra o hash de EVT-068)

### Mudança de mecanismo

Para reduzir custo, o worker passou a gravar os documentos diretamente num
worktree, e o Arquiteto revisa o diff, em vez de retransmitir o texto gerado.
Modelo: `deepseek-flash`. A escrita de cada worker é limitada por
configuração.

### tasks.md

Quatorze tarefas (T601–T614) em quatro fases:
1. Fundação: migração 4 e segredo;
2. Cadastro no servidor: `Identidade`, verificação negativa, rota e harness E2E;
3. Cliente e tela;
4. Acessibilidade e validação.

Formato idêntico ao de 002 e 003: caixas de seleção, metadados em `<details>`
e matriz de rastreabilidade.

Revisão do Arquiteto: áreas conferidas contra o plan; T606 (harness E2E com
segredo aleatório) garante que a suíte existente continue verde; nenhum id
fantasma e nenhum id ausente (verificação do worker repetida na etapa
`analyze`).

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-070

> **SPEC KIT** — Comando: analyze | Invocação: skill `speckit-analyze` e
> `check-prerequisites.sh --json --require-spec --require-tasks --include-tasks` |
> Integração: claude | Artefatos: nenhum alterado (somente leitura)

- **Data/hora**: 2026-09-21 01:58 -03
- **Ator**: ARCHITECT
- **Feature / Task**: 007-criar-usuario / analyze
- **Commit anterior**: `68cecdb` (registra o hash de EVT-069)

- AVAILABLE_DOCS: research, data-model, contracts, quickstart e tasks, que com
  spec e plan formam os sete artefatos.
- 21 FRs e 8 SCs, todos na matriz; nenhum id fantasma em plan ou tasks; nenhum id
  após a matriz fora de uma linha dela; as 14 tarefas batem com os metadados, e
  todas citam requisito.
- Terminologia: "password", "login" e "account" aparecem no plan só na lista de
  termos proibidos e no atributo HTML `type="password"`. Aceito.
- Nenhum problema CRITICAL ou HIGH.
- **M1 (MEDIUM)**: T602 faz a API exigir o segredo. Integrada sozinha, quebraria
  toda a E2E existente até T606 entrar. Remediação proposta: T602 e T606 são
  integradas no mesmo commit.
- **L1 (LOW)**: `criarUsuario` fica na Seam chamada `ClienteDoAcervo`, embora
  Usuário não seja acervo. Aceito por decisão do plan (Seam única de
  transporte); um eventual novo nome fica para quando existir um segundo
  consumidor.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-071

> **SPEC KIT** — Comando: analyze (remediação) | Invocação: edição manual
> aprovada pelo PO | Integração: claude | Artefatos: specs/007-criar-usuario/tasks.md

- **Data/hora**: 2026-09-21 01:59 -03
- **Ator**: PRODUCT OWNER → ARCHITECT
- **Feature / Task**: 007-criar-usuario / remediação M1
- **Commit anterior**: `700ee0b` (registra o hash de EVT-070)

O PO aprovou ("Sim") a remediação do M1 e o avanço para a `008`. Nas Notas de
tasks.md: T602 e T606 são integradas no mesmo commit. O L1 continua aceito.
Análise reexecutada: 21/21 FRs, 8/8 SCs, nenhum fantasma.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-072

> **SPEC KIT** — Comando: specify | Invocação: skill `speckit-specify` e
> `create-new-feature.sh --short-name entrar`; redação por worker
> `deepseek-flash` em worktree exclusivo | Integração: claude | Artefatos:
> specs/008-entrar/spec.md, checklists/requirements.md, CONTEXT.md

- **Data/hora**: 2026-09-21 02:02 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 008-entrar / specify
- **Commit anterior**: `f1d20ef` (registra o hash de EVT-071)

Spec da segunda feature de acesso:
- FRs específicos FR-086 a FR-098;
- reutilizados FR-042, FR-044, FR-045, FR-046, FR-078 e FR-079, com o mesmo
  enunciado;
- SC-027 a SC-036. O SC-012 foi omitido porque a feature não grava nada.

Decisões do PO registradas como Clarifications:
- Credencial só na memória da página aberta, verificada a cada operação;
- acervo por usuário (substitui a premissa "usuário único");
- tela inicial "Entrar";
- mensagem única de recusa.

Glossário: Credencial, Entrar e Sair acrescentados à seção Acesso.

Revisão do Arquiteto: os enunciados reutilizados conferem com os originais,
sem lacunas de numeração e sem marcadores pendentes. Duas redações foram
corrigidas no SC-033 e em Assumptions. Ficam para o clarify: o destino do
acervo existente sem dono e o bloqueio por tentativas. Checklist: 21 de 21.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-073

> **SPEC KIT** — Comando: clarify | Invocação: skill `speckit-clarify` |
> Integração: claude | Artefatos: specs/008-entrar/spec.md, checklists/requirements.md

- **Data/hora**: 2026-09-21 02:03 -03
- **Ator**: PRODUCT OWNER ↔ ARCHITECT
- **Feature / Task**: 008-entrar / clarify
- **Commit anterior**: `063515b` (registra o hash de EVT-072)

Duas perguntas:

1. **Acervo existente sem dono**: o PO escolheu **descartar** (opção B),
   contra a recomendação do Arquiteto, que era a adoção pelo primeiro Usuário.
   Isso gerou FR-099, SC-037 e um caso-limite que declara a perda de dados como
   assumida.
2. **Bloqueio por tentativas**: não; fica adiado para implantação fora da
   máquina local (recomendação aceita).

As premissas "a confirmar" foram eliminadas. Contagem: 20 FRs e 11 SCs.
Checklist: 21 de 21.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-074

> **SPEC KIT** — Comando: plan | Invocação: skill `speckit-plan` e
> `setup-plan.sh --json`; redação por worker `deepseek-flash` em worktree
> exclusivo | Integração: claude | Artefatos: plan.md, research.md,
> data-model.md, contracts/api-entrar.md, contracts/alteracao-contratos-001-006.md,
> quickstart.md (specs/008-entrar)

- **Data/hora**: 2026-09-21 02:09 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 008-entrar / plan
- **Commit anterior**: `1e4b06a` (registra o hash de EVT-073)

### Decisões de arquitetura (Arquiteto)

- **`Identidade.autenticar`**: repete a derivação com os mesmos sal e
  parâmetros e compara com `timingSafeEqual`. Para Nome de usuário inexistente,
  executa a derivação contra um sal e um hash descartáveis, gerados uma vez, e
  devolve a mesma mensagem. Assim a recusa não revela a existência do nome
  (FR-088).
- **Credencial**: cabeçalho `Authorization: Basic` em toda requisição. Ficam
  isentos `POST /usuarios`, `GET /health` e `OPTIONS`. Um hook `onRequest`
  responde 401 uniforme antes da rota. O 401 **não** traz `WWW-Authenticate`,
  para evitar o diálogo nativo e o cache de credencial do navegador. Não há cache
  de credencial verificada, porque seria uma sessão de fato. Custo: um scrypt por
  requisição, aceito para uso local.
- **Entrar**: `POST /entrar` responde 200 com o Usuário ou 401.
- **Acervo por usuário**: `criarAcervo(banco, usuarioId)` por requisição.
  Entidade de outro dono responde `404 nao_encontrado`, e o Vínculo só é aceito
  dentro do mesmo dono.
- **Migração 5**: recria `cartao`, `baralho` e `vinculo` com
  `usuario_id NOT NULL` e `ON DELETE CASCADE`, descartando o acervo sem dono
  (FR-099). Recriar é necessário, porque o SQLite recusa acrescentar coluna
  `NOT NULL` sem padrão.
- **Frontend**: a Credencial fica só no estado de `Aplicacao`. Resposta 401
  vira `nao_autenticado`. Nova tela `PaginaDeEntrada` em `#/entrar`. A
  navegação principal e o botão Sair só aparecem depois de Entrar, e o link
  "Criar conta" vai para a tela Entrar.

### Revisão do rascunho do worker

- O SQL da migração 5 repetia de cabeça os `CHECK`s de conteúdo. Nota
  acrescentada: eles devem ser copiados literalmente das migrações 1 e 2.
- O volume ficou acima do sugerido (738 linhas), justificado pelo segundo
  contrato e pela migração.
- Nenhum id fantasma.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. O quickstart usa só marcadores nos comandos
  `curl`, nunca uma credencial.

---

## EVT-075

> **SPEC KIT** — Comando: tasks | Invocação: skill `speckit-tasks` e
> `setup-tasks.sh --json`; redação por worker `deepseek-flash` em worktree
> exclusivo | Integração: claude | Artefatos: specs/008-entrar/tasks.md

- **Data/hora**: 2026-09-21 02:11 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 008-entrar / tasks
- **Commit anterior**: `0f342c4` (registra o hash de EVT-074)

Dezesseis tarefas (T701–T716) em quatro fases, no formato de 007. As tarefas
de adaptação das suítes existentes são explícitas: T705 para o contrato do
backend, T711 para o frontend e T715 para a E2E de 001 a 007.

**Defeito corrigido na revisão**: a nota de integração do worker juntava apenas
T703 e T705. Faltava considerar que T701, ao tornar o dono obrigatório, impede
o `Acervo` atual de gravar até T706 entrar, e que T707 muda o construtor do
`ClienteHttp`. A nota foi refeita em dois blocos atômicos:
- servidor: T701, T703, T705 e T706;
- cliente: T707, T708, T711 e T715.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-076

> **SPEC KIT** — Comando: analyze | Invocação: skill `speckit-analyze` e
> `check-prerequisites.sh --json --require-spec --require-tasks --include-tasks` |
> Integração: claude | Artefatos: nenhum alterado (somente leitura)

- **Data/hora**: 2026-09-21 02:11 -03
- **Ator**: ARCHITECT
- **Feature / Task**: 008-entrar / analyze
- **Commit anterior**: `a11e12e` (registra o hash de EVT-075)

- Sete artefatos presentes.
- 20 FRs e 11 SCs, todos na matriz; nenhum id fantasma nos sete artefatos;
  nenhum id solto depois da matriz; 16 tarefas coerentes com os metadados.
- Nenhum problema CRITICAL, HIGH ou MEDIUM. O defeito de ordem de integração foi
  corrigido antes, no EVT-075.
- **L1 (LOW)**: o FR-084 da 007 (link "Criar conta" na navegação principal) é
  substituído pelo FR-098 da 008 (link na tela Entrar). É uma sequência prevista
  e declarada no clarify das duas specs. Aceito.
- **L2 (LOW)**: as specs 001 a 006 continuam com a premissa "usuário único". A
  revogação está declarada na 008 (Assumptions e
  `contracts/alteracao-contratos-001-006.md`); as specs antigas não são
  reescritas. Aceito.

**Fim do planejamento das specs 007 e 008.** A implementação depende de
autorização do PO.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-077

> **SPEC KIT** — Comando: specify | Invocação: skill `speckit-specify` e
> `create-new-feature.sh --short-name porta-de-persistencia`; redação por
> worker `deepseek-flash` em worktree exclusivo | Integração: claude |
> Artefatos: specs/009-porta-de-persistencia/spec.md, checklists/requirements.md

- **Data/hora**: 2026-09-21 02:16 -03
- **Ator**: PRODUCT OWNER → ARCHITECT → WORKER
- **Feature / Task**: 009-porta-de-persistencia / specify
- **Commit anterior**: `2a3cd4f` (registra o hash de EVT-076)

### Prompt sanitizado

Acrescentar a capacidade de banco PostgreSQL, usado exclusivamente em nuvem. O
banco é escolhido por parâmetro na hora de construir o backend. Usar Port and
Adapter, com Interfaces que abstraiam qualquer banco. Executar localmente com
SQLite e na nuvem com PostgreSQL apontado por URL. Scripts no `package.json`
separam as duas formas de subir. Tudo em duas specs do Spec Kit. O PO pediu
isso antes de implementar 007 e 008.

### Divisão (Arquiteto)

- `009-porta-de-persistencia`: Porta de persistência, Adapter SQLite, escolha
  do banco no build e script local.
- `010-postgresql-na-nuvem`: Adapter PostgreSQL por URL e scripts de nuvem.

Com dois Adapters reais, a Seam de persistência rejeitada na 001 (um Adapter
só, portanto hipotética) passa a ser justificada.

Insumo externo: a infra AWS feita em paralelo espera
`DB_URL` com TLS verificado para o Neon. Isso vai para a 010.

### Specify da 009

FR-100 a FR-109 específicos; FR-044 e FR-045 reutilizados; SC-038 a SC-043.
Três premissas "a confirmar no clarify":
- escolha do banco no build;
- 009 implementada antes de 007 e 008;
- servidor local continua só no loopback.

Checklist: 21 de 21.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-078

> **SPEC KIT** — Comando: specify | Invocação: skill `speckit-specify` e
> `create-new-feature.sh --short-name postgresql-na-nuvem`; redação por worker
> `deepseek-flash` em worktree exclusivo | Integração: claude | Artefatos:
> specs/010-postgresql-na-nuvem/spec.md, checklists/requirements.md

- **Data/hora**: 2026-09-21 02:18 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 010-postgresql-na-nuvem / specify
- **Commit anterior**: `15aac72` (registra o hash de EVT-077)

Requisitos: FR-110 a FR-119 específicos; FR-044 e FR-045 reutilizados; SC-044 a
SC-050.
- Adapter PostgreSQL da Porta, aprovado na bateria compartilhada.
- URL de conexão em `DB_URL`, nome imposto pela infra de nuvem existente.
  Tratada como segredo: nunca registrada nem exibida.
- Conexão cifrada, com certificado verificado.
- Migrações versionadas também no PostgreSQL.
- Reconexão depois de uma queda.
- Scripts de nuvem.

**Defeito corrigido na revisão**: o FR-114 e o SC-046 exigiam a URL também na
construção. O segredo passaria a ser necessário para construir, e seria
espalhado por qualquer ambiente de build. Agora só o início exige a URL.

Premissas "a confirmar no clarify":
- verificação sem Docker;
- migração automática no início ou por comando;
- "nuvem" como configuração, e não como localização física.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhuma URL ou credencial registrada.

---

## EVT-079

> **SPEC KIT** — Comando: clarify | Invocação: skill `speckit-clarify` |
> Integração: claude | Artefatos: specs/009-porta-de-persistencia/spec.md,
> checklists/requirements.md

- **Data/hora**: 2026-09-21 02:21 -03
- **Ator**: PRODUCT OWNER ↔ ARCHITECT
- **Feature / Task**: 009-porta-de-persistencia / clarify
- **Commit anterior**: `ba0edee` (registra o hash de EVT-078)

1. **Build**: um pacote por banco (`build:local` e `build:cloud`), cada um só
   com o seu Adapter. Recomendação aceita; deu origem ao FR-120 (numeração
   global, depois da faixa da 010) e a uma linha na tabela negativa.
2. **Ordem de implementação**: 009 → 010 → 007 → 008 (recomendação aceita).
3. **Rede**: o PO respondeu: "Já temos um trabalho de infraestrutura
   para isso. Você irá olhar ele DEPOIS de tudo feito". A hospedagem
   fica fora de 009 e 010, e o servidor continua só local.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-080

> **SPEC KIT** — Comando: clarify | Invocação: skill `speckit-clarify` |
> Integração: claude | Artefatos: specs/010-postgresql-na-nuvem/spec.md,
> checklists/requirements.md

- **Data/hora**: 2026-09-21 02:23 -03
- **Ator**: PRODUCT OWNER ↔ ARCHITECT
- **Feature / Task**: 010-postgresql-na-nuvem / clarify
- **Commit anterior**: `8d21271` (registra o hash de EVT-079)

1. **Verificação sem Docker**: o PO respondeu "Não se preocupe com isso". O
   Arquiteto decidiu por PostgreSQL real iniciado pelos próprios testes na
   máquina, a partir de um pacote de desenvolvimento, sem Docker e sem segredo
   versionado.
2. **Migração**: por comando separado de migração para a nuvem. O início da
   nuvem só confere a versão e recusa esquema desatualizado. Recomendação
   aceita; deu origem ao FR-121, e o FR-116 e o SC-048 foram reescritos.
3. **"Nuvem"**: é configuração, não lugar físico. Decorre da resposta 1.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-081

> **SPEC KIT** — Comando: plan | Invocação: skill `speckit-plan` e
> `setup-plan.sh --json`; redação por worker `deepseek-flash` em worktree
> exclusivo | Integração: claude | Artefatos: plan.md, research.md,
> data-model.md, contracts/porta-de-armazenamento.md,
> contracts/scripts-e-construcao.md, quickstart.md (specs/009-porta-de-persistencia)

- **Data/hora**: 2026-09-21 02:29 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 009-porta-de-persistencia / plan
- **Commit anterior**: `02c1614` (registra o hash de EVT-080)

### Decisões de arquitetura (Arquiteto)

- **Ports no nível do domínio**, assíncronas: `ArmazenamentoDoAcervo` e, na
  007, `ArmazenamentoDeUsuarios`. Nenhum SQL atravessa a Port. Violações de
  restrição chegam como resultados tipados. As regras continuam nos Modules.
- **Reversão explícita da decisão da 001**, que rejeitou a Port de repositório
  por ter um único Adapter. Com o SQLite agora e o PostgreSQL na 010, a Seam é
  real.
- **Interface do `Acervo` assíncrona**. O contrato HTTP não muda, e o frontend
  fica intocado.
- **Adapter SQLite** em `backend/src/armazenamento/sqlite/`, dono das migrações
  existentes, sem mudar conteúdo nem versões.
- **Bateria compartilhada da Port**, parametrizada pela fábrica do Adapter.
- **Composition roots por banco** (`src/entradas/local.ts`, e na 010
  `nuvem.ts`). Um teste confere que nenhum Module importa driver nem Adapter.
- **Build**: `scripts/construir.mjs --banco=...` com esbuild (devDependency
  nova) gera `dist/<banco>/servidor.mjs` contendo só a entrada escolhida.
  Scripts: `typecheck`, `build` (exige o parâmetro), `build:local`,
  `start:local` e `dev`. Os portões de qualidade passam a ser `typecheck` e
  `build:local`.
- **Seção "Impacto em 007 e 008"**: os planos delas são lidos sobre as Ports
  assíncronas.

### Interpretações do worker aceitas

- Na 009, `--banco=postgresql` é recusado como valor ainda não aceito; a 010 o
  acrescenta.
- O "único comando" a partir de uma cópia limpa é `npm run dev`.
- Os quickstarts de 001 a 008 citam `npm run build` como verificação de tipos
  e precisam ser ajustados. Isso fica registrado para a etapa de tasks.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-082

> **SPEC KIT** — Comando: plan | Invocação: skill `speckit-plan` e
> `setup-plan.sh --json`; redação por worker `deepseek-flash` em worktree
> exclusivo | Integração: claude | Artefatos: plan.md, research.md,
> data-model.md, contracts/adapter-postgresql.md, contracts/scripts-da-nuvem.md,
> quickstart.md (specs/010-postgresql-na-nuvem)

- **Data/hora**: 2026-09-21 02:34 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 010-postgresql-na-nuvem / plan
- **Commit anterior**: `b11dd6a` (registra o hash de EVT-081)

### Decisões de arquitetura (Arquiteto)

- **Driver `pg`**: JavaScript puro, com `pg-native` marcado como externo.
  Pool pequeno (máximo de 4) com tratador de erro, para reconectar depois de
  uma queda.
- **Adapter** em `armazenamento/postgresql/`, com as mesmas Ports e a mesma
  bateria. Violações chegam como SQLSTATE 23505 e 23503, traduzidos dentro do
  Adapter.
- **Migrações** no dialeto PostgreSQL, com as mesmas versões. Rodam só pelo
  comando `migrate:cloud`, em transação, com `pg_advisory_xact_lock`. O
  `start:cloud` recusa esquema desatualizado. Nome de usuário único via índice
  em `lower(...)`.
- **`DB_URL`**: lida só pelas entradas de nuvem. `UrlDeConexaoInvalidaError`
  nunca exibe o valor. TLS obrigatório com certificado verificado; URLs com
  `sslmode=disable`, `allow` ou `prefer` são recusadas. Erros do driver são
  higienizados. `DB_CA_CERT` é opcional, para uma CA privada nos testes.
- **Operação com o Neon**: a migração deve apontar para o endpoint direto.
- **Verificação**: PostgreSQL real embarcado nos testes, com CA e certificado
  gerados por `openssl` a cada execução, TLS de fato verificado, credencial
  gerada, sem Docker. Se não rodar, a suíte falha alto, nunca é pulada.
- **Build**: `--banco=postgresql` gera `servidor.mjs` e `migrar.mjs`. Scripts
  `build:cloud`, `migrate:cloud` e `start:cloud`. O build não precisa de
  `DB_URL`.

Revisão: nenhum id fantasma; nenhuma URL real nos artefatos (só o formato, com
marcadores).

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-083

> **SPEC KIT** — Comando: tasks | Invocação: skill `speckit-tasks` e
> `setup-tasks.sh --json` nas duas features; redação por dois workers
> `deepseek-flash` em worktrees exclusivos, em paralelo | Integração: claude |
> Artefatos: specs/009-porta-de-persistencia/tasks.md, specs/010-postgresql-na-nuvem/tasks.md

- **Data/hora**: 2026-09-21 02:38 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 009 e 010 / tasks
- **Commit anterior**: `63fb908` (registra o hash de EVT-082)

- **009**: T801–T814. Três blocos de integração atômicos:
  1. Port, Adapter e Modules;
  2. entrada e E2E;
  3. construção e scripts.

  A T814 é documental e fica com o Arquiteto: atualiza os quickstarts e os
  comandos dos plans de 001, 002, 003, 007 e 008 (`npm run build` passa a
  significar empacotamento) e marca que 007 e 008 são construídas sobre a Port
  assíncrona.
- **010**: T901–T913, em blocos de integração:
  1. verificação real;
  2. Adapter;
  3. configuração e nuvem;
  4. conteúdo dos pacotes.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-084

> **SPEC KIT** — Comando: analyze | Invocação: skill `speckit-analyze` e
> `check-prerequisites.sh --json --require-spec --require-tasks --include-tasks`
> nas duas features | Integração: claude | Artefatos: nenhum alterado (somente leitura)

- **Data/hora**: 2026-09-21 02:38 -03
- **Ator**: ARCHITECT
- **Feature / Task**: 009 e 010 / analyze
- **Commit anterior**: `d8e50c7` (registra o hash de EVT-083)

- Sete artefatos presentes nas duas features.
- **009**: 19 requisitos (13 FRs e 6 SCs), todos na matriz; nenhum fantasma;
  14 tarefas coerentes com os metadados.
- **010**: 20 requisitos (13 FRs e 7 SCs), todos na matriz; nenhum fantasma;
  13 tarefas coerentes.
- Nenhum problema CRITICAL, HIGH ou MEDIUM.
- **L1 (LOW)**: os plans e as tasks de 007 e 008 descrevem Interfaces síncronas
  e migrações em `acervo/migracoes.ts`. Resolvido pela T814 antes de
  implementar 007 e 008, na ordem 009 → 010 → 007 → 008 decidida no clarify.
- **L2 (LOW)**: o PostgreSQL embarcado nos testes baixa um binário por
  plataforma na instalação. Custo aceito em troca de verificação real sem
  Docker.

**Fim do planejamento das specs 009 e 010.** O backlog planejado agora cobre
007 a 010. A implementação depende de autorização do PO.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-085

> **SPEC KIT** — Comando: implement | Invocação: worker `deepseek-flash`
> (loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: Port ArmazenamentoDoAcervo, Adapter SQLite, bateria compartilhada, Acervo assíncrono

- **Data/hora**: 2026-09-21 02:56 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 009-porta-de-persistencia / Bloco 1: T801–T807 — concluídas
- **Commit anterior**: `7d84f2d` (registra o hash do evento anterior)

Port de domínio assíncrona com 15 operações e desfechos tipados. O Adapter SQLite
é dono do esquema e das migrações, movidos byte a byte, com as versões
inalteradas; um arquivo criado antes da mudança abre na mesma versão. Bateria
compartilhada com 22 cenários, rodada em memória e em arquivo. `criarAcervo`
recebe a Port e todos os verbos passaram a ser assíncronos. As rotas aguardam o
`Acervo` e respondem 503 sem detalhe do driver. Uma varredura de imports
comprova que nenhum Module depende de armazenamento concreto.

Revisão do Arquiteto:
- nenhum teste removido; os `expect` subiram de 370 para 378;
- desvio aceito: as listagens não têm desfecho tipado, então uma falha nelas
  vira exceção e resposta 500, nunca uma lista apresentada como sucesso;
- dois imports de E2E foram atualizados para o novo caminho das migrações.

Verificado em `main`: backend 240, frontend 240, e2e 13, build e lint verdes.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-086

> **SPEC KIT** — Comando: implement | Invocação: worker `deepseek-flash`
> (loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: entradas/local.ts, scripts/construir.mjs, scripts do backend, harness E2E, quickstarts e plans

- **Data/hora**: 2026-09-21 03:04 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 009-porta-de-persistencia / Blocos 2 e 3: T808–T813, e T814 (Arquiteto) — concluídas (feature 009 completa)
- **Commit anterior**: `e3e35e1` (registra o hash do evento anterior)

- **T808**: `entradas/local.ts` é a única raiz que importa o Adapter e imprime
  "Armazenamento: SQLite (arquivo local)". O `index.ts` foi removido.
- **T809 a T811**: `scripts/construir.mjs` valida `--banco`, recusa sem gravar
  nada e empacota com esbuild em `dist/sqlite/servidor.mjs`. Scripts
  `typecheck`, `build`, `build:local`, `start:local` e `dev`. Quinze casos
  executam o script de verdade.
- **T812**: o harness E2E sobe a API pela entrada local.
- **T813**: com o arquivo indisponível, o início falha e é reportado, sem expor
  o caminho nem texto do driver.
- **Desvio aceito**: um banner `createRequire` no pacote ESM. Sem ele, as
  dependências CJS do Fastify impedem o pacote de executar.
- **T814** (Arquiteto, documental): quickstarts de 001, 002, 003, 007 e 008 com
  os portões novos; plans com os comandos atualizados; 007 e 008 marcadas como
  construídas sobre a Port assíncrona.

Verificado em `main`: backend 257, frontend 240, e2e 13, `typecheck`,
`build:local` e lint verdes; `npm run build` sem parâmetro é recusado.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-087

> **SPEC KIT** — Comando: implement | Invocação: worker `deepseek-flash`
> (loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: Adapter PostgreSQL, migrações 1–3 em dialeto PostgreSQL, PostgreSQL real de teste com TLS

- **Data/hora**: 2026-09-21 03:30 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 010-postgresql-na-nuvem / T901–T905 — concluídas
- **Commit anterior**: `030f183` (registra o hash do evento anterior)

- **Adapter** `armazenamento/postgresql/` sobre `pg`, com pool de no máximo 4
  conexões e tratador de erro. SQLSTATE 23505 e 23503 traduzidos em desfechos
  tipados. Abrir não migra.
- **Migrações 1 a 3** com as mesmas versões e `CHECK`s equivalentes, uma
  transação por migração sob `pg_advisory_xact_lock`, e releitura da versão
  depois da trava.
- **TLS** sempre com `rejectUnauthorized`. A URL é decomposta em campos, para
  que um `sslmode` no texto não rebaixe a cifra.
- **Testes**: PostgreSQL real via `embedded-postgres`, sem Docker, com senha
  gerada e CA e certificado criados por `openssl` a cada execução. A bateria
  compartilhada da 009 passa sem edição (23 cenários). Cobertos também:
  conexão sem a CA recusada, dois aplicadores simultâneos, reconexão depois de
  `pg_terminate_backend` e servidor parado respondendo `indisponivel`.
- **Decisão do Arquiteto**: o `backend/package-lock.json` era ignorado pelo
  `.gitignore` global do PO. Passou a ser versionado com `git add -f`, como o
  do frontend, para builds de nuvem reproduzíveis.

Verificado em `main`: backend 308 (estável em 4 execuções do worker), frontend
240, e2e 13, `typecheck`, `build:local` e lint verdes.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-088

> **SPEC KIT** — Comando: implement | Invocação: worker `deepseek-flash`
> (loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: entradas de nuvem, conexao.ts, construir.mjs, scripts de nuvem

- **Data/hora**: 2026-09-21 03:42 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 010-postgresql-na-nuvem / T906–T913 — concluídas (feature 010 completa)
- **Commit anterior**: `c0466b5` (registra o hash do evento anterior)

- **`DB_URL`** é validada nas duas entradas de nuvem. `UrlDeConexaoInvalidaError`
  nunca exibe o valor. `sslmode` com `disable`, `allow` ou `prefer` é recusado;
  `require`, `verify-ca` e `verify-full` são aceitos, sempre com verificação
  completa. `DB_CA_CERT` é opcional.
- **`start:cloud`** imprime só a linha de armazenamento PostgreSQL, confere a
  versão do esquema e recusa esquema atrasado sem migrar.
- **`migrate:cloud`** migra sob trava consultiva; repetir não reaplica nada.
- Toda falha do driver sai como mensagem genérica mais o SQLSTATE, nunca com
  URL, host, usuário ou senha.
- **`construir.mjs`** aceita `postgresql` e gera `servidor.mjs` e `migrar.mjs`
  sem exigir `DB_URL`.
- Testes de conteúdo dos pacotes nos dois sentidos. O pacote local, mesmo com
  `DB_URL` no ambiente, abre zero conexões (conferido em `pg_stat_activity`).
- Desvios aceitos: a linha de início segue o contrato; há uma mensagem extra
  para `DB_CA_CERT` ilegível; só código com forma de SQLSTATE é impresso.

Verificado em `main`: backend 346, frontend 240, e2e 13, `typecheck`,
`build:local`, `build:cloud` e lint verdes. `start:cloud` sem `DB_URL` é
recusado.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-089

> **SPEC KIT** — Comando: implement | Invocação: worker `deepseek-flash`
> (loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: Port de Usuários, migração 4 nos dois dialetos, Module Identidade, POST /usuarios, segredo

- **Data/hora**: 2026-09-21 04:03 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 007-criar-usuario / T601–T606 — concluídas (bloco do servidor)
- **Commit anterior**: `122872d` (registra o hash do evento anterior)

- **Adaptação ao Port** (Arquiteto): a Port `ArmazenamentoDeUsuarios` é
  implementada nos dois Adapters. A migração 4 existe nos dois dialetos: no
  SQLite com `UNIQUE COLLATE NOCASE`, no PostgreSQL com índice único em
  `lower(...)`.
- **Module `Identidade`**: `criarIdentidade(armazenamento, segredo)`, com HMAC e
  scrypt e sal de 16 bytes. Importa só a Port.
- **T602**: `SegredoAusenteError` nas entradas local e de nuvem.
- **T604**: verificação negativa lendo as linhas armazenadas no SQLite e no
  PostgreSQL reais.
- **T605**: `POST /usuarios` com CORS; a Senha não aparece na saída do processo
  real.
- **T606**: o harness E2E gera o segredo uma vez e o reusa nos reinícios. T602 e
  T606 foram integradas no mesmo commit, como manda a remediação M1.
- **Desvio aceito, com débito**: testes que fixavam a versão de esquema 3 foram
  subidos para 4. Como já aconteceu na 002, isso quebrará de novo na migração 5.
  O worker da 008 recebe a instrução de derivar a versão da lista de migrações.

Verificado em `main`: backend 439, frontend 240, e2e 13, `typecheck`,
`build:local`, `build:cloud` e lint verdes; a entrada local sem segredo é
recusada.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-090

> **SPEC KIT** — Comando: implement | Invocação: worker `deepseek-flash`
> (loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: criarUsuario nos Adapters, PaginaDeCadastro, testes de acessibilidade, e2e

- **Data/hora**: 2026-09-21 04:21 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 007-criar-usuario / T607–T614 — concluídas (feature 007 completa)
- **Commit anterior**: `d20ddbb` (registra o hash do evento anterior)

- `criarUsuario` nos dois Adapters, com bateria compartilhada.
- `PaginaDeCadastro` em `#/criar-conta`, com o link "Criar conta" na navegação.
- Confirmação divergente nunca é enviada, e o foco vai para a Confirmação.
- Limites comunicados durante a digitação; Senhas apagadas do estado depois do
  sucesso; nada gravado no navegador.
- Testes de teclado, leitor de tela e telefone.
- E2E contra a API real: sem `Set-Cookie`, persistência e ausência de
  cookie e de armazenamento no navegador.
- Débito do EVT anterior quitado: os testes de backend passaram a derivar a
  versão do esquema da lista de migrações.
- Instabilidade encontrada e corrigida pelo worker: o cliente do Vite recarrega
  a página sozinho quando o servidor volta. O teste agora recarrega de forma
  explícita.

Verificado em `main`: backend 439, frontend 306, e2e 15 (duas vezes),
`typecheck`, `build:local` e lint verdes.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-091

> **SPEC KIT** — Comando: implement | Invocação: worker `deepseek-flash`
> (loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: migração 5, autenticar, hook de Credencial, escopo por dono, PaginaDeEntrada, Sair, e2e

- **Data/hora**: 2026-09-21 05:12 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 008-entrar / T701–T716 — concluídas (feature 008 completa)
- **Commit anterior**: `041384d` (registra o hash do evento anterior)

Dois workers no **mesmo worktree**, com integração num commit único, como mandam
os blocos atômicos do EVT-075.

- **Servidor (T701–T706)**:
  - migração 5 nos dois dialetos (acervo sem dono descartado, `usuario_id`
    obrigatório, `CHECK`s copiados literalmente);
  - escopo por dono dentro da Port, com cenários de isolamento na bateria
    compartilhada rodando contra SQLite e PostgreSQL;
  - `autenticar` com recusa uniforme e derivação descartável;
  - hook `onRequest` exigindo Basic, 401 sem `WWW-Authenticate` e
    `POST /entrar`;
  - suíte de contrato de 001 a 007 adaptada.

  Desvios aceitos:
  - `autenticar` tem também o desfecho `indisponivel` (503), para que uma base
    fora do ar não seja confundida com Senha errada;
  - o hook fica em `http/credencial.ts`;
  - rota desconhecida sem Credencial responde 401.
- **Cliente (T707–T716)**:
  - Credencial só no estado React;
  - `ClienteHttp` com o cabeçalho e `nao_autenticado`;
  - `PaginaDeEntrada` como primeira tela;
  - navegação principal e Sair só depois de Entrar;
  - `guarda-de-credencial.ts` como ponto único do FR-091;
  - harness E2E com Usuário de prova, e todas as E2E de 001 a 007 adaptadas.

  Novas E2E: isolamento entre dois Usuários, recarga, Sair com Voltar,
  ausência de Credencial no navegador e duas abas independentes.

  Decisões aceitas:
  - a Senha é apagada depois de recusa ou sucesso e preservada em
    indisponibilidade, pelo FR-045;
  - o foco da recusa vai para a Senha, porque a recusa não revela qual campo
    falhou.

Verificado em `main`: backend 514, frontend 337, e2e 18 (duas vezes),
`typecheck`, `build:local` e lint verdes.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-092

> **SPEC KIT** — Comando: implement | Invocação: worker `deepseek-flash`
> (loop agêntico com ferramentas confinadas) em worktree exclusivo | Integração: claude | Artefatos: specs/007-criar-usuario/spec.md, backend/tests (construcao, sqlite, meta-teste SC-038)

- **Data/hora**: 2026-09-21 05:22 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: converge — features 007 a 010
- **Commit anterior**: `f1c6b24` (registra o hash do evento anterior)

> Comando Spec Kit: converge (sobre 007, 008, 009 e 010).

Com todas as tarefas marcadas, o converge mediu a rastreabilidade: 171
requisitos, 166 com teste.
- **FR-084** (007, link "Criar conta" na navegação) foi **substituído** pelo
  FR-098 da 008, que moveu o link para a tela Entrar. A substituição foi
  registrada na spec da 007; não cabe teste para um comportamento que deixou de
  existir.
- **FR-101, FR-103, FR-109 e SC-038** (009): o worker etiquetou os testes que
  já os comprovavam e escreveu dois: `npm run start:local` sobe o pacote com um
  único comando, e um meta-teste do SC-038 roda as suítes de 001 a 006 do
  backend sobre o Adapter SQLite.
- **Defeito pego na revisão**: a primeira versão do meta-teste disparava a
  suíte do frontend a partir do backend. Isso acoplava os projetos e exigia o
  frontend instalado para testar o backend. Um worker de reparo restringiu o
  meta-teste ao backend; o frontend continua coberto pelo próprio portão e
  pelas E2E.

Resultado: 170 de 170 requisitos vigentes citados em testes que os verificam.
Verificado em `main`: backend 521, frontend 337, e2e 18, `typecheck`,
`build:local` e lint verdes.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum valor sensível identificado ou registrado.

---

## EVT-093

> **SPEC KIT** — Comando: specify | Invocação: skill `speckit-specify` e
> `create-new-feature.sh --short-name hospedagem-aws`; redação por worker
> `deepseek-flash` em worktree exclusivo | Integração: claude | Artefatos:
> specs/011-hospedagem-aws/spec.md, checklists/requirements.md

- **Data/hora**: 2026-09-21 05:27 -03
- **Ator**: PRODUCT OWNER → ARCHITECT → WORKER
- **Feature / Task**: 011-hospedagem-aws / specify
- **Commit anterior**: `85b4aef`

### Prompt sanitizado

"Completar E2E o projeto, de modo que ele fique completamente pronto de acordo
com as specs. Depois, olhar o trabalho de infraestrutura e mesclar tudo que foi
feito ali, de modo que esse projeto receba a capability de AWS, e preparar o
projeto para que ele suba em Cloud AWS com PostgreSQL."

### Mescla da infra

O trabalho de infraestrutura entrou em `main` como `85b4aef`, mantendo o
histórico linear do fluxo trunk-based. Ele traz
CloudFront, S3, Lambda com stub, SSM, a policy do robot e os scripts. Nenhum
segredo foi mesclado: state, `tfvars` e `.build` são ignorados, e o exemplo
contém só marcadores.

### Specify da 011

FR-122 a FR-134; reutilizados FR-044, FR-045, FR-078 e FR-079; SC-051 a
SC-061. Pontos cobertos:
- entrada da função da nuvem, que não escuta porta;
- três segredos lidos do SSM no início a frio;
- segredo de origem conferido em tempo constante (403);
- inicialização que falha não fica memorizada;
- migração feita pelo operador;
- CORS permissivo só no modo local;
- SPA apontando para `/api`;
- pacote da função;
- limite de desempenho da verificação de Senha;
- verificação sem publicar;
- manual de operação.

Os itens 1 e 10 de `aws_pendencias.md` (entrada pelo Google e cookie de
sessão) ficaram obsoletos: a 008 entregou a Credencial por requisição.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.

---

## EVT-094

> **SPEC KIT** — Comando: clarify | Invocação: skill `speckit-clarify` |
> Integração: claude | Artefatos: specs/011-hospedagem-aws/spec.md

- **Data/hora**: 2026-09-21 07:02 -03
- **Ator**: PRODUCT OWNER ↔ ARCHITECT
- **Feature / Task**: 011-hospedagem-aws / clarify
- **Commit anterior**: `db62b56` (registra o hash de EVT-093)

Uma pergunta: publicar de fato ou só preparar? O PO escolheu **preparar e
publicar** (opção B), contra a recomendação do Arquiteto, que era só preparar.
O Arquiteto executará a migração no Neon, `tofu apply` e o deploy do SPA, e
validará pelo endereço do CloudFront.

Pré-condições conferidas sem exibir valores:
- OpenTofu 1.12 e AWS CLI instalados;
- identidade AWS: usuário `robot`;
- `terraform.tfvars` com a connection string do Neon, fora do git;
- state anterior sem recursos, porque a infra foi destruída depois da
  validação anterior.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada. Nenhum ARN com conta, connection string ou
  credencial registrado.

---

## EVT-095

> **SPEC KIT** — Comando: plan | Invocação: skill `speckit-plan` e
> `setup-plan.sh --json`; redação por worker `deepseek-flash` | Integração:
> claude | Artefatos: plan.md, research.md, data-model.md,
> contracts/funcao-da-nuvem.md, contracts/pacotes-e-operacao.md, quickstart.md
> (specs/011-hospedagem-aws)

- **Data/hora**: 2026-09-21 07:08 -03
- **Ator**: ARCHITECT → WORKER
- **Feature / Task**: 011-hospedagem-aws / plan
- **Commit anterior**: `e689c5c` (registra o hash de EVT-094)

### Decisões do Arquiteto

- **Raiz de composição `entradas/lambda.ts`** com `@fastify/aws-lambda`. A
  aplicação é montada uma vez por contêiner; a promise de inicialização é
  descartada quando falha. Não há `listen`.
- **Seam `LeitorDeSegredos`** com dois Adapters: SSM (`GetParameters` com
  decriptação, três nomes) e memória.
- **Guarda do segredo de origem** como primeiro hook, com `timingSafeEqual` e
  resposta 403.
- **Reuso da 010**: validação de `DB_URL` e conferência do esquema sem migrar.
- **CORS** desligado na função e mantido no modo local.
- **Pacote**: `--banco=lambda` gera `dist/lambda/lambda.mjs` e
  `backend/dist-lambda.zip`.
- **Infra**: `SEGREDO_DAS_SENHAS` no SSM e memória de 1024 MB.
- **Checagens da infra**: `tofu fmt` e `tofu validate`.
- **Frontend**: script `build:aws`.
- **Manual de operação** no quickstart.
- **`aws_pendencias.md`** será removido ao final.

### Escolhas do worker aceitas

- `--banco=lambda` como valor único, preservando o contrato de construção da
  009.
- A guarda de origem é registrada por opção do `criarServidor`, para ser o
  primeiro hook.
- A Implementation fica em `src/funcao/`, e o dublê em memória em
  `tests/funcao/`.
- O corpo do 403 é o mesmo da stub já validada em campo.

- **Commit**: hash registrado no próximo evento auditável.
- **Sanitização**: Confirmada.
