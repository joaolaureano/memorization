# Memorization Constitution

## Core Principles

### I. Spec-Driven Development (NÃO NEGOCIÁVEL)

Os artefatos ativos do Spec Kit e esta constituição são as únicas fontes
normativas de intenção. Nenhuma implementação começa antes de spec, clarify,
plan, critérios de aceitação, tasks e analyze estarem aprovados pelo Product
Owner. O código nunca é usado para inventar, justificar ou substituir um
requisito: onde código e spec divergem, a spec vence e o código é corrigido.

### II. Auditabilidade Append-Only

Toda sessão de planejamento ou implementação é registrada em SESSION.md, na
raiz, em modo append-only. Eventos anteriores nunca são reescritos para alterar
a narrativa. Registram-se prompts sanitizados, decisões declaradas, ações
verificáveis e resultados observáveis — nunca raciocínio privado ou deliberação
interna de modelos. A sanitização precede a escrita: nenhum segredo é escrito
para ser removido depois. Todo valor sensível vira [REDACTED].

### III. Domínio Antes de Tecnologia

CONTEXT.md é exclusivamente um glossário e é a autoridade sobre a linguagem do
domínio. Não contém arquitetura, banco de dados, framework, protocolo ou tarefa.
Termos vagos, conflitantes ou sobrecarregados são desafiados e resolvidos antes
de entrarem em spec. A linguagem do código espelha a do glossário.

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
SESSION.md exigida pelo Princípio II é um caso particular dela, não seu limite.

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

## Skills Obrigatórias

As skills locais em `.agents/skills/` integram a metodologia e não substituem os
artefatos do Spec Kit. Antes de uma atividade coberta por uma skill, o agente
responsável lê integralmente o SKILL.md e os documentos que ela referencia,
aplica sua terminologia e seus critérios, e registra em SESSION.md qual skill foi
aplicada, por que se aplicava e quais decisões ou artefatos ela influenciou.

- **domain-modeling**: descoberta, especificação, clarify, linguagem de domínio,
  invariantes, cenários-limite e mudanças funcionais.
- **codebase-design**: planejamento arquitetural, desenho de Interfaces,
  posicionamento de Seams, decomposição em Modules, definição de Adapters,
  estratégia de testes e revisão estrutural.

Uma ADR é proposta somente quando a decisão é simultaneamente difícil de
reverter, surpreendente sem seu contexto histórico e resultado de um trade-off
real. Faltando qualquer um dos três, não se cria ADR. CONTEXT-MAP.md só é
considerado se surgirem múltiplos bounded contexts reais.

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
correspondente de SESSION.md pertencem ao mesmo incremento lógico. Não se agrupa
funcionalidade independente, não se commita código quebrado, não se alteram
arquivos alheios à tarefa. Amend, rebase, squash e force push exigem autorização
explícita do Product Owner. Um commit não contém o próprio hash: o evento
anterior registra a mensagem proposta, e o próximo evento auditável registra o
hash do commit anterior.

Workers recebem uma única tarefa com critérios de aceitação identificados e os
arquivos que podem alterar. Não escolhem requisitos, não alteram arquitetura, não
expandem escopo e não fazem commits. Interrompem e reportam ambiguidade
arquitetural ou conflito de domínio.

## Governance

Esta constituição supersede qualquer outra prática. Emendas exigem aprovação
explícita do Product Owner, registro em SESSION.md e nota de versão abaixo.
Complexidade deve ser justificada contra o Princípio VII. Divergência entre um
artefato do Spec Kit e esta constituição é resolvida a favor da constituição.

**Version**: 1.1.0 | **Ratified**: 2026-09-20 | **Last Amended**: 2026-09-20
