# Implementation Plan: Início e área Estudo

**Branch**: checkout Git `main`, sem criação de branch nesta entrega | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: `specs/019-inicio-e-estudo/spec.md`

**Status**: implementado em 2026-10-04; tasks.md registra execução e verificação.

**Note**: estrutura originada do template resolvido pelo GitHub Spec Kit e
inicializada com `setup-plan.sh --json`. O campo `BRANCH` devolvido pelo script
é `019-inicio-e-estudo`, identificador da feature quando não há branch de
feature; não representa uma branch Git criada.

## Summary

Reduzir o Início a boas-vindas, resumo discreto de sete dias, Revisão do dia e
Agenda de hoje. Criar a área Estudo para calendário semanal, gráfico compacto
e últimas Sessões, deixando o gerenciamento de Rotinas em tela própria.

**O uso do GitHub Spec Kit é obrigatório e irrevogável.** A presente entrega
executa `specify → clarify → plan` e sua revisão documental. Não executa
`implement`, não cria código do aplicativo e não publica uma versão.

Entregáveis de leitura:

- [Protótipos de UI](prototipos.md): telas desktop/celular e estados.
- [Contrato de UI e navegação](contracts/ui.md): hierarquia, ações e retornos.
- [Decisões e auditoria](research.md): diagnóstico e escolhas.
- [Modelo de dados](data-model.md): reutilização sem migração.
- [Roteiro de validação](quickstart.md): cenários e rastreabilidade.

## Technical Context

**Language/Version**: TypeScript ~5.9, React ~19.3, CSS; execução existente em Node >=24, conforme manifests locais.

**Primary Dependencies**: Vite ~8.3; nenhuma nova biblioteca proposta. Navegação por hash já implementada.

**Storage**: contratos e persistência existentes; nenhuma alteração de schema ou migração.

**Testing**: Vitest, Testing Library e Playwright existentes. Nesta entrega: inspeção documental, referências e resolução do Spec Kit; testes do produto somente em implementação futura.

**Target Platform**: navegadores desktop e móveis; 360, 390, 768 e 1440 px e zoom de 200%.

**Project Type**: aplicação web com frontend separado e backend próprio.

**Performance Goals**: Início não renderiza o calendário, gráfico ou Histórico; cada leitura tem estado independente e pedidos obsoletos não substituem dados atuais. Sem polling periódico nem nova meta de latência sem medição.

**Constraints**: preservar autenticação, regras de revisão/Agenda, rascunhos, proteções de saída, contratos de transporte e isolamento de Usuários. Atualização passiva não renova acesso por atividade humana.

**Scale/Scope**: uma nova tela principal; reorganização de quatro famílias de tela existentes; três Compromissos resumidos no Início, sete dias no gráfico e cinco Sessões recentes.

## Constitution Check

Revisão anterior ao desenho e reavaliação após os contratos; conformidade de
planejamento não equivale a aprovação do produto.

| Princípio/portão | Antes do desenho | Após o desenho |
|---|---|---|
| I — Spec-Driven Development | Somente documentação autorizada | Spec, clarificações, plano e protótipos produzidos; implementação aguarda fluxo restante e aprovações |
| II — Auditabilidade | Alteração prévia `SESSION.md` preservada | Decisões e evidências em research.md; nenhum commit ou reescrita histórica |
| III — Domínio | Glossário lido; conceitos atuais suficientes | Ajuste futuro da definição de Estatísticas identificado, sem nova entidade |
| IV/V — Modules e Interface | Seam existente suficiente | Module de Agenda compartilha comportamento; testes previstos pela UI e ClienteDoAcervo |
| VI/IX — Verificação e rastreabilidade | Não declarar teste de produto executado | FRs associados a cenários em quickstart.md; tasks futuras devem carregar a rastreabilidade |
| VII/VIII — Escopo e segredos | Plano e wireframes com dados fictícios | Sem código de aplicação, credenciais ou novas dependências |
| X — Portões de qualidade | Não executar implementação | Checklist documental separado de analyze e aprovação; portão de implementação permanece fechado |
| XI — Autoria de código | Documentação cabe ao Arquiteto | Qualquer implementação futura exige workers DeepSeek disponíveis; não substituir silenciosamente |
| Skills obrigatórias | domain-modeling e codebase-design lidas | Aplicação e consequências registradas em research.md |

Não há exceção à constituição solicitada. A inexistência de tasks/analyze nesta
entrega é o limite autorizado do trabalho, não dispensa futura desses portões.

## Project Structure

### Documentation (this feature)

```text
specs/019-inicio-e-estudo/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── prototipos.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/ui.md
```

`tasks.md` é saída de uma etapa posterior e não é produzido pelo fluxo
`speckit-plan`. O ponteiro local ignorado pelo Git
`.specify/feature.json` identifica esta feature para os próximos comandos.

### Source Code (repository root)

Fontes inspecionadas, sem alteração nesta entrega:

```text
frontend/
├── src/
│   ├── ui/                 # páginas, Agenda, moldura e navegação
│   ├── acervo-cliente/     # Interface e Adapters existentes
│   ├── agenda/             # datas e estados
│   ├── estatisticas/       # cálculos existentes
│   └── estilos.css
└── tests/
e2e/
backend/                    # contratos mantidos; sem trabalho previsto
```

**Structure Decision**: manter o projeto web existente e aproveitar seus
Modules. Os wireframes ficam junto da feature como documentos, sem adicionar
um site, servidor ou protótipo executável separado.

## Phase 0 — Research e clarify

As quatro escolhas de UX e a restrição final de escopo já foram respondidas.
A varredura de `clarify` não encontrou ambiguidade crítica adicional.
[research.md](research.md) registra cobertura, alternativas e evidências.

Não há tecnologia nova nem investigação externa necessária. A pesquisa desta
entrega usa fontes locais: specs ativas, constituição, templates, estilos,
rotas, operações disponíveis e testes existentes.

## Phase 1 — Design para implementação futura

### Navegação e composição

- Adicionar `#/estudo` com a variante de Rota `central-de-estudo` e a página
  `PaginaDaCentralDeEstudo`. Preservar a variante `estudo` atual da Sessão por
  Baralho e todos os endereços da Agenda.
- Atualizar Moldura e o mapa central de destino ativo; seguir exatamente a
  tabela do [contrato de UI](contracts/ui.md). Não instalar roteador.
- Início compõe resumo estatístico textual, bloco de revisão existente e
  Agenda compacta. Estudo compõe Agenda semanal, Estatísticas e recentes.
- Rotinas mantém sua página e operações, com novo título e retornos.
  Criação/edição retorna a Rotinas; Registro retorna a Estudo, inclusive quando
  ausente. Sessões ativas preservam seus fluxos de saída vigentes.

### Modules e Interfaces

- O Module de Agenda permanece responsável por consultar, atualizar,
  selecionar dias, apresentar estados e iniciar Compromissos. Acrescentar à
  Interface de apresentação um modo `hoje | semana`, mantendo
  `cliente` e `aoIniciarEstudo`; a Implementation compartilha leitura,
  proteção contra respostas antigas e regras de ação. A escolha semanal
  permanece interna. Isso fornece Leverage às duas páginas e Locality para
  correções de datas e elegibilidade.
- Separar o painel estatístico atualmente privado de Início em um Module de
  apresentação reutilizável. A Interface recebe dados carregados e um único
  instante de referência; a Implementation reutiliza `inicioDaJanela`,
  `itensPorDia` e `taxaDeAcerto`. O Início usa somente seu resumo; Estudo usa
  gráfico, totais do período e recentes.
- A Seam externa continua sendo `ClienteDoAcervo`, com os Adapters HTTP e em
  memória existentes. Não criar nova Interface de transporte, store global,
  cache persistente ou mecanismo de sincronização entre aparelhos.
- Conservar a resposta de Estatísticas com contagens do acervo: são úteis ao
  estado inicial e não precisam ser removidas do contrato por deixarem de ser
  indicadores visuais.

### Leituras, atualização e falhas

- Ler Estatísticas, revisão e Agenda independentemente em Início. Em Estudo,
  ler Agenda e Estatísticas; usar `recentes` da mesma resposta estatística.
- Compartilhar um instante por leitura estatística entre consulta e desenho.
  Hoje e limites de revisão seguem o fuso do navegador.
- Remover os controles permanentes Atualizar agenda. Revalidar ao montar a
  tela, retornar à aba visível e atravessar a meia-noite. Navegação semanal
  consulta a semana escolhida. Após mutação de Rotina, atualizar sua lista; ao
  voltar a Início/Estudo, a montagem consulta Agenda e Estatísticas novamente.
- Após sessão persistida, a próxima tela de leitura consulta resultados;
  não marcar Compromisso como concluído antes da confirmação do servidor.
  Revalidar também revisão após voltar do estudo, pois avaliações a afetam.
- Em Estudo, distinguir seguir Hoje de uma seleção explícita. Revalidação
  preserva esta última; virar o dia atualiza a primeira. Recalcular fuso ao
  retomar e manter datas civis dos Compromissos.
- Descartar respostas obsoletas e resultados após desmontagem/troca de
  Usuário. Em atualização, manter dados anteriores com indicação textual;
  em falha, oferecer repetição por bloco. Não sobrescrever formulários nem
  simular sucesso local.
- Não adicionar heartbeat de atividade humana aos gatilhos automáticos.
  Continuar tratando expiração e recusa de acesso pelas guardas atuais.

### Layout e estados

- Manter os tokens de cor, tipografia, borda e foco atuais. Desktop a partir
  de 1024 px: revisão e Agenda de hoje em duas colunas iguais. Abaixo disso:
  coluna única, revisão antes da Agenda.
- Preservar breakpoint atual de navegação móvel em até 600 px, com cinco
  áreas de mesma largura; rótulos visíveis podem quebrar linha. Reservar no
  conteúdo a altura real da barra e a área segura inferior.
- Calendário usa toda a largura necessária para sete alvos de 44 px, sem
  somar paddings que o inviabilizem em 360 px. Sob zoom, permitir reflow.
- Estudo mantém uma coluna de seções; o gráfico é secundário à Agenda, com
  altura compacta e valores textuais. Estados estão desenhados em
  [prototipos.md](prototipos.md).
- Registrar no incremento futuro de implementação a atualização de
  `CONTEXT.md`: Estatísticas são números derivados do acervo e do Histórico
  do Usuário, sem atrelar o conceito a uma única tela.

## Validação e sequência futura

A matriz em [quickstart.md](quickstart.md) é o contrato de validação; cada FR
deve ser levado a tasks e testes quando a implementação for autorizada.

1. Revisar estes artefatos e obter as aprovações exigidas pela constituição.
2. Completar checklist, gerar tasks pelo Spec Kit e executar analyze até não
   haver inconsistência crítica. Nenhum código começa antes desse portão.
3. Delegar incrementos de aplicação a workers DeepSeek, com revisão pelo
   Arquiteto: navegação/Estudo; Início; rotinas/atualização; estados e
   responsividade. Cada incremento inclui testes, documentação e tasks.
4. Reutilizar/adaptar testes de navegação, estatísticas, Agenda, revisão,
   acesso e acessibilidade. Não apagar invariantes só por mudarem de tela.
5. Executar os checks locais adequados e `rtk npm run verificar:ci` antes de
   integração/push; alternar implement/converge até Converged.

A entrega atual encerra-se antes do item 1 de aprovação dos novos artefatos.
Não há migração, deploy, feature flag ou rollout realizado.
