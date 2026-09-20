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
