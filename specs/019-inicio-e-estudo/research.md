# Research: Início e área Estudo

**Data**: 2026-10-04 | **Feature**: [spec.md](spec.md)

Registro append-only de decisões e evidências observáveis. Não contém
raciocínio privado, credenciais ou aprovação presumida do Product Owner.

## 2026-10-04 — Diagnóstico e decisões

### D1 — Separar intenção diária de planejamento

**Decisão**: Início fica com saudação, resumo discreto, Revisão do dia e Agenda
de hoje. Estudo recebe semana, gráfico e últimas Sessões ao final.

**Motivo**: o Usuário considera a tela inicial carregada e rejeita totais de
Cartões/Baralhos como informação de boas-vindas. Confirmou resumo discreto e
visão geral de Estudo com gerenciamento separado.

**Alternativas consideradas**: manter gráfico no Início; retirar todas as
Estatísticas do Início; dividir Estudo em abas. As três foram apresentadas e
não selecionadas pelo Usuário.

**Evidência local**: `frontend/src/ui/PaginaDeInicio.tsx` monta Agenda,
revisão, painel de Estatísticas, gráfico e recentes. `AgendaDeEstudo.tsx`
inclui resumo de hoje, calendário semanal e detalhes do dia. A densidade é
explicada pela composição atual; não foi realizado teste de usabilidade.

### D2 — Reutilizar Rotinas e modelo de domínio

**Decisão**: a nova organização usa criação, edição, pausa, retomada e exclusão
existentes; não cria outro tipo de agenda.

**Motivo**: o Usuário escolheu manter as Rotinas semanais atuais. Agenda de
estudo organiza Compromissos por data; Agendamento do cartão continua sendo
a próxima revisão calculada pelo algoritmo.

**Alternativas consideradas**: estudos avulsos e horários foram apresentados
e não selecionados. Uma entidade persistida chamada Estudo seria desnecessária:
trata-se apenas de um destino de navegação.

**Evidência local**: `PaginaDaAgenda.tsx`, `PaginaDoFormularioDeRotina.tsx`,
`CONTEXT.md` e spec 016 já definem as operações, confirmações e invariantes.
Não se infere novo requisito a partir desses arquivos: eles mostram o que pode
ser preservado para atender às escolhas do Usuário.

### D3 — Atualizar por eventos de navegação e resultado

**Decisão**: remover Atualizar agenda das telas e completar os gatilhos
automáticos; Tentar novamente fica disponível em falhas.

**Motivo**: o Usuário considera o botão inútil. Retirá-lo exige preservar a
leitura atual após uma mutação e a passagem de data, sem tratar falha como zero.

**Alternativas consideradas**: manter o botão foi rejeitado pelo pedido;
polling e sincronização instantânea entre aparelhos acrescentariam escopo.

**Evidência local**: AgendaDeEstudo já consulta em montagem, visibilitychange
e meia-noite e usa contador para recusar respostas antigas. Formulários e
Rotinas já distinguem salvamento, conflito, falha e sucesso persistido.

**Consequência**: o contrato especifica preservação da seleção explícita em
Estudo e atualização de Hoje quando a seleção o acompanha. Atualizações
passivas não podem renovar Acesso temporário como atividade humana.

### D4 — Preservar contratos e endereços

**Decisão**: acrescentar `#/estudo` como `central-de-estudo`, manter rotas da
Agenda e da Sessão por Baralho, reutilizar ClienteDoAcervo e os dois Adapters.

**Motivo**: `Rota` já usa `estudo` para a Sessão de um Baralho. A distinção
evita colisão e preserva links diretos, sem introduzir roteador.

**Alternativas consideradas**: renomear todas as rotas de Agenda ou mudar
transporte não é necessário para reorganizar as telas.

**Evidência local**: `navegacao.ts`, `Aplicacao.tsx` e
`acervo-cliente/cliente.ts`. Estatisticas contém Registros da janela e cinco
recentes; as contagens do acervo podem continuar no transporte para orientar
o estado inicial, sem virar indicadores de destaque.

### D5 — Protótipo documental e limite de execução

**Decisão**: entregar wireframes Markdown de desktop, celular, formulários e
estados, vinculados ao plano e à spec. Não criar HTML/CSS executável nem alterar
o aplicativo nesta entrega.

**Motivo**: o Usuário escolheu wireframes e restringiu expressamente a entrega
a protótipo e plano usando GitHub Spec Kit. “Implement the plan” refere-se a
essa produção de artefatos, não à implementação futura descrita neles.

**Alternativas consideradas**: protótipo navegável antes do app foi oferecido,
mas não selecionado. Wireframes não comprovam responsividade ou contraste em
runtime; esses critérios ficam no roteiro futuro.

### D6 — Skills aplicadas

- **domain-modeling**: lida junto de CONTEXT-FORMAT.md; orientou D2 e o modelo
  de dados. Separou Rotina, Compromisso, Agenda e Revisão; identificou que a
  definição atual de Estatísticas restringe a apresentação ao Início. O plano
  descreve o ajuste para uma implementação futura; não altera o glossário
  global nesta entrega de proposta.
- **codebase-design**: lida junto de DEEPENING.md; orientou D4 e as Interfaces
  no plano. A dependência remota própria já possui Seam e Adapters HTTP/em
  memória. Compartilhar a Implementation de Agenda aumenta Leverage e
  Locality sem criar uma Seam hipotética. Testes passam pelas Interfaces
  usadas pelo aplicativo.
- **speckit-specify**, **speckit-clarify**, **speckit-plan**: instruções
  instaladas em `.claude/skills/` lidas; usados os templates e scripts locais.
  ADR-FORMAT e DESIGN-IT-TWICE são inaplicáveis pela constituição do projeto.

## 2026-10-04 — Cobertura de clarify

As quatro perguntas de UX já respondidas e a correção de escopo foram
incorporadas em spec.md. Nenhuma pergunta adicional era necessária; nenhuma
resposta já dada foi solicitada novamente.

| Categoria | Resultado |
|---|---|
| Escopo e comportamento | Claro: dois destinos principais e manutenção separada; entrega documental |
| Domínio e dados | Claro: reutilização sem nova entidade ou migração |
| Interação e UX | Claro: hierarquia, retornos, estados e limites de listas definidos |
| Qualidades não funcionais | Claro para a proposta: acessibilidade, larguras, zoom, segurança e recuperação; sem nova meta arbitrária de latência |
| Integrações e dependências | Claro: contratos e Adapters existentes; sem serviço externo novo |
| Casos-limite e falhas | Claro: ausências, indisponibilidade, concorrência, datas e acesso preservados |
| Restrições e alternativas | Resolvido pelas escolhas confirmadas e pelo escopo final |
| Terminologia | Claro: Estudo é área de navegação, não nova entidade |
| Sinais de conclusão | Claro: documentos e protótipos revisados; app não implementado |
| Pendências textuais | Nenhuma ambiguidade crítica identificada para produzir o plano |

## 2026-10-04 — Execução do fluxo documental

- Estado inicial: branch Git `main`, alteração pré-existente não rastreada
  `SESSION.md`; preservada, sem leitura ou edição para esta tarefa.
- Numeração sequencial configurada em `.specify/init-options.json`; última
  pasta encontrada era 018. Criada a feature `019-inicio-e-estudo`.
- `.specify/extensions.yml` não existe: sem hooks pré/pós das três etapas.
- Templates `spec-template`, `plan-template` e `checklist-template` resolvidos
  com o script `resolve-template.sh`; spec preenchida na estrutura normativa.
- Ponteiro local `.specify/feature.json` atualizado para a feature 019; esse
  arquivo é ignorado pelo Git por configuração existente.
- `check-prerequisites.sh --json --paths-only` resolveu a feature corretamente
  para clarify. `setup-plan.sh --json` criou plan.md a partir do template.
- O script retornou `BRANCH=019-inicio-e-estudo` como identificador derivado;
  a branch Git continua `main`. Não foi criada ou publicada branch.
- Não houve necessidade de pesquisa externa ou escolha tecnológica nova;
  não foram delegadas pesquisas sem uma questão em aberto.
- Tasks, analyze, implement, converge, commits e publicação não foram
  executados; não fazem parte da entrega autorizada.

Resultados da verificação documental final serão acrescentados abaixo.

## 2026-10-04 — Revisão e verificação documental final

- Gerados oito documentos Markdown: spec, plan, research, data-model,
  prototipos, quickstart, contracts/ui e checklists/requirements.
- Inspeção automatizada somente de leitura confirmou 27 links relativos
  existentes, blocos de código fechados e ausência de placeholders do template
  ou espaços em final de linha.
- Os 20 requisitos FR-307–FR-326 e seis critérios SC-125–SC-130 têm referência
  na matriz V01–V12. A inspeção de conteúdo conferiu ações, retornos, estados e
  a correspondência dos nove grupos de wireframes com o contrato.
- Checklist de qualidade documental passou de 0/16 a 16/16 após revisão, sem
  regressões ou itens documentais pendentes. Isso não registra aprovação do
  Product Owner nem execução dos testes de produto.
- `check-prerequisites.sh --json --require-spec` terminou com sucesso e
  reconheceu research.md, data-model.md, contracts/ e quickstart.md na feature.
- `git diff --check` não encontrou erros nos arquivos rastreados; a checagem
  própria de whitespace também abrangeu os documentos novos não rastreados.
- `git diff --name-only` permaneceu vazio e `git status --short` mostrou
  apenas o `SESSION.md` pré-existente e a nova pasta da feature. O ponteiro
  local do Spec Kit foi a única alteração fora dela e é ignorado pelo Git.
- Não foram executados testes, build ou inspeção em navegador do aplicativo:
  não houve implementação. Responsividade, contraste e comportamento real
  permanecem critérios de aceitação futura, não evidências desta entrega.
- Fluxo encerrado após Phase 1 de plan, sem tasks/analyze/implement/converge,
  commit, push ou deploy. `.specify/extensions.yml` continuou ausente na
  revisão final dos hooks.

## 2026-10-04 — Implementação autorizada

O Product Owner pediu «Implemente o spec novo. Use subagentes deepseek». O
pedido foi tratado como aprovação para tasks → análise → implement → converge.
Skills aplicadas: speckit-tasks (tasks.md) e codebase-design (Interface de
`AgendaDeEstudo` com `modo`, Module `EstatisticasDoEstudo`, Seam
`ClienteDoAcervo` mantida). Nenhum contrato HTTP, migração ou dependência nova.
Detalhes, desvios e evidências estão na seção «Execução» de tasks.md;
CONTEXT.md recebeu o ajuste previsto em Estatísticas.
