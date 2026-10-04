# Memorization Constitution

## Core Principles

### I. Spec-Driven Development (NÃO NEGOCIÁVEL)

Os artefatos ativos do Spec Kit e esta constituição são as únicas fontes
normativas de intenção. Nenhuma implementação começa antes de spec, clarify,
plan, critérios de aceitação, tasks e analyze estarem aprovados pelo Product
Owner. O código nunca é usado para inventar, justificar ou substituir um
requisito: onde código e spec divergem, a spec vence e o código é corrigido.

### II. Auditabilidade Append-Only

Toda sessão de planejamento ou implementação deixa registro auditável em modo
append-only: as decisões, com contexto e alternativas, no `research.md` da
feature e nas notas de revisão dos artefatos do Spec Kit; as ações e as
verificações, nas mensagens de commit. Histórico já publicado nunca é reescrito
para alterar a narrativa. O antigo SESSION.md é preservado intacto apenas na tag
`v1.0.0` e não é mantido na `main`. Registram-se prompts sanitizados, decisões declaradas, ações
verificáveis e resultados observáveis — nunca raciocínio privado ou deliberação
interna de modelos. A sanitização precede a escrita: nenhum segredo é escrito
para ser removido depois. Todo valor sensível vira [REDACTED].

### III. Domínio Antes de Tecnologia

A linguagem do domínio é definida na seção «Key Entities» de cada spec, que é
a autoridade sobre os termos que a feature usa; uma spec nova que reutiliza um
termo mantém o significado dado pela spec que o introduziu. Essa seção não
contém arquitetura, banco de dados, framework, protocolo ou tarefa. Termos
vagos, conflitantes ou sobrecarregados são desafiados e resolvidos antes de
entrarem em spec. A linguagem do código espelha a das specs.

### IV. Módulos Profundos

Todo Module apresenta uma Interface pequena escondendo Implementation relevante,
produzindo Leverage para callers e Locality para mantenedores. Uma Seam é criada
apenas quando existem ao menos dois Adapters justificados — tipicamente produção
e teste. Uma Implementation única indica Seam hipotética e é rejeitada como
indireção. Usa-se o vocabulário de codebase-design literalmente: Module,
Interface, Implementation, Depth, Seam, Adapter, Leverage, Locality.

### V. A Interface é a Superfície de Teste

Testes atravessam a mesma Seam que os callers e asseguram resultados
observáveis, nunca estado interno. Um teste que precisa mudar quando a
Implementation muda está testando além da Interface e é reescrito. Nenhuma
tarefa é concluída sem teste correspondente.

### VI. Verificação Sobre Afirmação

Nenhuma afirmação de worker é aceita sem inspeção do diff, dos testes e dos
artefatos. O Arquiteto revisa todo diff produzido, executa ou confere as
verificações, e é o único integrador e committer salvo autorização explícita do
Product Owner.

### VII. Escopo Mínimo Honesto

Implementa-se o que a spec pede e nada além. Não se antecipa abstração,
configuração, Seam, tratamento de erro impossível nem compatibilidade retroativa
sem requisito. Premissas não validadas são marcadas `premissa a validar` e nunca
assumidas silenciosamente.

### VIII. Segredos Fora do Repositório (NÃO NEGOCIÁVEL)

Nenhum segredo entra em arquivo versionado, em nenhuma circunstância e sob
nenhuma justificativa de conveniência: senha, token, chave de API ou privada,
cookie, credencial, string de conexão, cabeçalho de autorização e valor de
arquivo de ambiente estão igualmente proibidos. `.gitignore` é mantido
ativamente para tornar o acidente improvável, e arquivos que aparentem ser
credenciais não são commitados mesmo quando solicitados. A revisão que precede
todo commit inclui a verificação explícita de que nenhum valor sensível está
sendo introduzido. Esta regra vale para todo o repositório; a sanitização de
dos registros exigida pelo Princípio II é um caso particular dela, não seu limite.

### IX. Rastreabilidade Requisito–Teste

Todo requisito funcional é rastreável a pelo menos um teste que o exercita, e
todo teste é rastreável ao requisito que o justifica. Um requisito sem teste é
requisito não verificado e bloqueia a conclusão da tarefa que o contém; um teste
sem requisito é escopo não solicitado e é removido ou justificado contra o
Princípio VII. A rastreabilidade é declarada no artefato de tasks e conferida na
revisão do diff, não inferida da leitura do código.

### X. Portões de Qualidade

A existência de inconsistência classificada como CRITICAL em `analyze`, ou de
qualquer item reprovado em checklist, bloqueia `implement` até ser resolvida.
Não se prossegue "enquanto isso", não se abre exceção por urgência e não se
registra a pendência como dívida para depois. O portão é binário: enquanto a
análise estiver inconsistente ou o checklist reprovado, a implementação não
começa.

Antes de integrar ou enviar alterações, o Arquiteto executa `npm run
verificar:ci` na raiz. O comando exige Gitleaks, os portões de backend e
frontend e a suíte Playwright. Qualquer falha bloqueia commit de integração e
push até a correção e nova execução completa. O hook versionado
`.githooks/pre-push` executa a mesma verificação no clone configurado, sem
substituir a responsabilidade explícita do Arquiteto. A CI remota permanece a
verificação final em ambiente limpo.

### XI. Delegação Obrigatória de Código (NÃO NEGOCIÁVEL)

Todo código de aplicação é criado por subagentes DeepSeek. O Arquiteto não
escreve código de aplicação: ele especifica a tarefa, delega, revisa
integralmente o diff produzido e executa ou confere as verificações, conforme o
Princípio VI. Código que o Arquiteto tenha escrito diretamente não é aceito e é
refeito pela via delegada.

Entende-se por código de aplicação todo fonte sob `backend/`, `frontend/` e
`e2e/`, inclusive testes e arquivos de configuração desses pacotes. Permanecem
com o Arquiteto os artefatos do Spec Kit, a documentação, o registro de auditoria
e a configuração do repositório na raiz — que não são código de aplicação e cuja
autoria delegada não traria verificação melhor.

## Skills Obrigatórias

As skills locais em `.agents/skills/` integram a metodologia e não substituem os
artefatos do Spec Kit. Antes de uma atividade coberta por uma skill, o agente
responsável lê integralmente o SKILL.md e os documentos que ela referencia,
aplica sua terminologia e seus critérios, e registra no `research.md` da
feature qual skill foi aplicada, por que se aplicava e quais decisões ou
artefatos ela influenciou.

- **domain-modeling**: descoberta, especificação, clarify, linguagem de domínio,
  invariantes, cenários-limite e mudanças funcionais.
- **codebase-design**: planejamento arquitetural, desenho de Interfaces,
  posicionamento de Seams, decomposição em Modules, definição de Adapters,
  estratégia de testes e revisão estrutural.

Este projeto **não utiliza ADRs**. Decisões arquiteturais e de domínio, com seu
contexto, suas alternativas rejeitadas e suas consequências, são registradas no
`research.md` de cada feature, que é a fonte do histórico decisório. Não se cria `docs/adr/`,
e o documento ADR-FORMAT.md da skill domain-modeling é inaplicável a este
projeto.

Este projeto **não utiliza o processo Design It Twice**. Interfaces centrais são
desenhadas pelo Arquiteto no fluxo normal de `plan` e `tasks`, sob os Princípios
IV e V, e o documento DESIGN-IT-TWICE.md da skill codebase-design é inaplicável.
A exigência de ler os documentos referenciados por uma skill não alcança
documentos declarados inaplicáveis aqui.

CONTEXT-MAP.md só é considerado se surgirem múltiplos bounded contexts reais.

## Critérios de Qualidade

Acessibilidade, segurança, manutenibilidade e documentação são critérios de
aceitação de qualquer entrega, não refinamentos opcionais a realizar depois. Uma
tarefa que os ignore está incompleta, ainda que sua funcionalidade demonstre
funcionar.

- **Acessibilidade**: toda ação que o produto ofereça é executável por teclado,
  e nenhum estado relevante é comunicado apenas por cor, posição ou ícone.
- **Segurança**: entrada externa é validada de forma autoritativa fora da camada
  de apresentação; nenhuma decisão de integridade repousa sobre o cliente.
- **Manutenibilidade**: a entrega respeita os Princípios IV e V — Interface
  pequena, comportamento escondido na Implementation, teste atravessando a mesma
  Seam que o caller.
- **Documentação**: a documentação que descreve o comportamento alterado é
  atualizada no mesmo incremento lógico, nunca em commit posterior.

## Fluxo de Trabalho e Git

Fluxo por feature: constitution (uma vez), specify, clarify, plan, checklist,
tasks, analyze até não haver inconsistência crítica, implement incremental, e
converge alternado com implement até o resultado ser Converged.

O histórico Git representa a evolução real do produto. Commits são pequenos,
coesos e funcionalmente significativos, em Conventional Commits, relacionados a
requisitos e task IDs. Código, testes, documentação e a atualização
correspondente dos artefatos do Spec Kit pertencem ao mesmo incremento lógico. Não se agrupa
funcionalidade independente, não se commita código quebrado, não se alteram
arquivos alheios à tarefa. Amend, rebase, squash e force push exigem autorização
explícita do Product Owner. Um commit não contém o próprio hash: o evento
anterior registra a mensagem proposta, e o próximo evento auditável registra o
hash do commit anterior.

O papel de worker é exercido por subagentes DeepSeek, conforme o Princípio XI.
Workers recebem uma única tarefa com critérios de aceitação identificados e os
arquivos que podem alterar. Não escolhem requisitos, não alteram arquitetura, não
expandem escopo e não fazem commits. Interrompem e reportam ambiguidade
arquitetural ou conflito de domínio. Nenhuma afirmação de worker é aceita sem
inspeção do diff, dos testes e dos artefatos correspondentes.

## Governance

Esta constituição supersede qualquer outra prática. Emendas exigem aprovação
explícita do Product Owner, registro no commit da emenda e nota de versão abaixo.
Complexidade deve ser justificada contra o Princípio VII. Divergência entre um
artefato do Spec Kit e esta constituição é resolvida a favor da constituição.

**Version**: 3.2.0 | **Ratified**: 2026-09-20 | **Last Amended**: 2026-10-04

**Nota da versão 3.0.0 (2026-10-03)**: emenda aprovada pelo Product Owner. O
Princípio II mantém a auditabilidade append-only, mas o registro deixa de ser o
SESSION.md, preservado apenas na tag `v1.0.0`, e passa a ser o `research.md` de
cada feature, as notas de revisão dos artefatos do Spec Kit e as mensagens de
commit. As regras que citavam o SESSION.md (skills obrigatórias, ADRs, fluxo de
commits e governança) foram ajustadas da mesma forma.

**Nota da versão 3.1.0 (2026-10-03)**: emenda aprovada pelo Product Owner. O
fluxo de integração de IA passa a exigir `npm run verificar:ci` antes de todo
push, com hook versionado como defesa adicional.

**Nota da versão 3.2.0 (2026-10-04)**: emenda aprovada pelo Product Owner. O
glossário `CONTEXT.md` foi removido do repositório; o Princípio III passa a
atribuir a autoridade sobre a linguagem do domínio à seção «Key Entities» de
cada spec. As specs anteriores que citam o `CONTEXT.md` permanecem como
histórico, sem reescrita.
