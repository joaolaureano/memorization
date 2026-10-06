# Implementation Plan: Criar Cartões dentro de Baralhos

**Branch**: `025-criar-cartoes-baralho` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Especificação 025, incluindo os esclarecimentos sobre Cartões compartilhados, Frentes repetidas, salvamento de seleção temporária e exclusões.

## Summary

Criar Cartões no contexto do Baralho, garantir um único Pertencimento por Cartão e retirar a página Cartões da navegação. A implementação aprofunda o Module `Acervo` existente; não cria uma Seam nova. A persistência passa a representar Pertencimento exclusivo e Frente única por Baralho nos adapters SQLite e PostgreSQL. Uma transição por Usuário preserva o acervo legado com escolhas explícitas para Cartões sem destino ou compartilhados. O salvamento de uma seleção temporária cria Cartões novos, em vez de Vínculos.

O protótipo navegável será um artefato separado em `design/criar-cartoes-no-baralho/`, reutilizando `frontend/src/estilos.css` e verificando os fluxos por Chromium. Seus dados serão demonstrativos, sem simular persistência do produto.

## Technical Context

**Language/Version**: TypeScript estrito; Node.js 24+ no backend e frontend React/Vite existente.

**Primary Dependencies**: Fastify, Zod, `node:sqlite`, `pg`, React, Vitest, Testing Library e Playwright, todos já existentes. Nenhuma dependência nova.

**Storage**: SQLite local e PostgreSQL hospedado, com migrações versionadas numeradas em paridade.

**Testing**: Vitest no backend e frontend; testes de integração dos dois adapters; Playwright para fluxos persistidos/responsivos; Playwright standalone para o protótipo.

**Target Platform**: aplicação web em navegador e API Node.js.

**Project Type**: aplicação web cliente-servidor.

**Performance Goals**: nenhum SLO novo. Criação, exclusão, salvamento de cópias e transição devem confirmar o resultado completo; nenhuma operação parcial pode ser exibida como sucesso.

**Constraints**: a versão de esquema vigente é 12. SQLite e PostgreSQL precisam manter o mesmo contrato e a mesma sequência. A transição é isolada por Usuário; usuários já concluídos continuam usando o acervo enquanto outros resolvem dados legados. A interface global de Cartões é removida, mas `GET /cartoes` permanece para fontes internas como estudo temporário. Frentes são únicas por Baralho usando normalização sem caixa, acento ou espaços externos.

**Scale/Scope**: quatro jornadas principais: criar/consultar, resolver dados legados, salvar seleção temporária como cópias e excluir Cartões/Baralhos. Uma tela principal de detalhe e uma tela de transição de uso único; sem novo serviço, pacote ou dependência.

## Constitution Check

*GATE: antes da Phase 0 e reavaliado após a Phase 1.*

| Princípio | Veredito |
|---|---|
| I — Spec-Driven | **PASS**. Comportamento deriva de `spec.md`; as decisões recentes foram incorporadas e não há marcadores pendentes. |
| II — Auditabilidade | **PASS**. Pesquisa e escolhas ficam anexadas a `research.md`, sem reescrever o histórico anterior. |
| III — Domínio antes de tecnologia | **PASS**. `Cartão`, `Baralho` e `Pertencimento` estão definidos em Key Entities. |
| IV — Módulos profundos | **PASS**. `Acervo` concentra invariantes e persiste por sua Interface; nenhuma Seam ou Module novo. |
| V — Interface é a superfície de teste | **PASS**. Regras exercitadas por `Acervo`/`ClienteDoAcervo`; testes de migração cobrem o contrato e estados observáveis. |
| VI — Verificação sobre afirmação | **PASS condicionado**. Revisão integral dos diffs e execução dos gates na implementação. |
| VII — Escopo mínimo honesto | **PASS**. Transição, contador e cópias são exigidos pela spec; sem abstrações ou dependências antecipadas. |
| VIII — Segredos fora do repositório | **PASS por vacuidade**. Sem credenciais ou dados reais nos artefatos/protótipo. |
| IX — Rastreabilidade | **PASS condicionado**. Tasks deve mapear FR-388–FR-402 para provas observáveis. |
| X — Portões de qualidade | **PASS até aqui**. Checklist 025 completo; `analyze` permanece gate anterior à implementação. |
| XI — Delegação de código | **PASS condicionado**. Código de aplicação sob `backend/`, `frontend/` e `e2e/` será delegado conforme a constituição; o protótipo em `design/` é artefato de design. |

### Reavaliação após Phase 1

**PASS**. O modelo preserva a Interface do `Acervo` e os dois adapters HTTP/em memória. O armazenamento adiciona uma tabela de Pertencimento com `cartao_id` único e chave de Frente única por Baralho. A transição retém a tabela legada até todos os acervos concluírem; nenhum usuário precisa perder Cartões para que outro conclua a migração.

## Decisões de Codebase Design

### Module `Acervo` — aprofundar, sem criar outro

A Interface existente acrescenta criação contextual, transição de acervo e cópia atômica para Baralho. As rotas HTTP permanecem adaptadores finos; `ClienteDoAcervo` segue como a Seam entre UI e servidor, com `ClienteHttp` e `ClienteEmMemoria`.

- `criarCartao(baralhoId, dados)` valida conteúdo, aplica contador de Frente no Baralho e grava Cartão + Pertencimento atomicamente.
- `editarCartao` valida a Frente pela Interface do `Acervo`, preserva a Frente/Verso persistidos em caso de colisão e devolve erro estável; os adapters atualizam a chave normalizada e traduzem a restrição de unicidade. A mesma Frente continua válida em Baralhos diferentes.
- `obterBaralho(id)` continua devolvendo Cartões pertencentes ao Baralho; a tela passa a apresentar Frente e Verso.
- `salvarSelecaoComoBaralho` mantém seu identificador idempotente, mas cria cópias únicas em uma transação. Os originais e seus Agendamentos não mudam; as cópias não herdam Agendamento nem Histórico.
- `excluirCartao` remove Cartão, Pertencimento e Agendamento; o Histórico mantém snapshots.
- `excluirBaralho` remove Baralho, seus Cartões, Pertencimentos e Agendamentos em uma transação; snapshots históricos sobrevivem.
- Nenhuma operação pública cria ou remove um Pertencimento deixando Cartão avulso.

`Pertencimento` é uma relação de domínio, não um novo Module. Uma chave primária em `cartao_id` impede múltiplos donos. Uma chave derivada e normalizada de Frente, com unicidade por Baralho, impede colisões concorrentes. O `Acervo` determina a próxima Frente numerada; o adapter traduz colisão concorrente para o resultado estável de domínio para nova tentativa.

### Transição por Usuário

1. A migração 13 cria a estrutura de Pertencimento em ambas as bases e preserva todos os dados de `vinculo`. Ao preparar a transição de cada Usuário, uma operação atômica atribui automaticamente Cartões com exatamente um destino; Frentes repetidas são normalizadas e numeradas nessa mesma operação.
2. Se faltarem escolhas, a aplicação autenticada abre a transição antes da navegação comum. Cartão avulso exige destino; Cartão compartilhado exige escolher qual Baralho conserva o original. Cópias para os outros Baralhos mantêm o conteúdo, recebem Frente única e começam sem Agendamento/Histórico.
3. Cada Usuário resolve seu conjunto em uma operação atômica e idempotente. Usuários concluídos usam imediatamente as operações novas; os demais continuam isolados no estado legado e veem apenas a tela de transição. Os entrypoints cloud e Lambda aceitam a versão 13 como estado transitório, mas continuam recusando a versão 12 ou anterior.
4. Depois que nenhum Cartão legado estiver sem Pertencimento, a migração 14 remove `vinculo`. O aplicador só executa essa última migração quando a condição global estiver satisfeita. No PostgreSQL, o operador reaplica o comando de migração após a transição; no SQLite, a reabertura aplica a migração pendente.

### Acessibilidade e consistência visual

Reutilizar `PaginaDoBaralho`, `PaginaDoFormularioDeCartao`, `Moldura`, `navegacao` e estilos globais. Remover Cartões da navegação principal e criar dentro do detalhe do Baralho. Preservar marca, paleta escura/azul, listas compactas, tipografia, espaçamento, contorno de foco e barra móvel existentes. O formulário mantém contadores e validação de Frente/Verso; foco, erros, cópia numerada, estado vazio e exclusões são anunciados. Confirmar exclusão antes de apagar Cartão/Baralho e declarar explicitamente Cartões/Agendamentos afetados.

O protótipo reutiliza `../../frontend/src/estilos.css`, não cria novo sistema visual e oferece o fluxo normal e a transição legada em estados demonstráveis. Ver [prototipos.md](./prototipos.md).

## Estratégia de Testes

- **Acervo**: criação contextual, contador (2)/(3), comparação normalizada, limite de 1.000 caracteres após sufixo, edição conflitante recusada pela Interface preservando os dados, mesma Frente permitida em Baralhos distintos, cópia idempotente, escopo por Usuário e falhas sem escrita parcial.
- **Adapters SQLite/PostgreSQL**: migração 13/14, associação única, Frente única por Baralho, transição por Usuário com Cartões avulsos/compartilhados, preservação do Agendamento/Histórico original, cópias sem registros, exclusões atômicas e rollback.
- **HTTP/Cliente**: POST contextual, 409 de colisão na edição, leitura de Cartão com dono, transição autenticada, entrypoints cloud/Lambda compatíveis com v13 transitória e recusa de v12, cópias na rota temporária e exclusões no dono correto.
- **Frontend**: detalhe com Frente/Verso, estado vazio, criar/editar/excluir, navegação sem destino Cartões, transição antes da aplicação, foco preservado e mensagens acessíveis.
- **E2E**: criar em um Baralho e não em outro; fechar/reabrir; duplicar por criação e cópia; concluir transição; excluir Cartão/Baralho e confirmar Agendamento removido e Histórico preservado; validar 360, 390, 768 e 1440 px, zoom CSS de 200%, ausência de rolagem horizontal e operação por teclado.
- **Protótipo**: `rtk proxy node design/criar-cartoes-no-baralho/verificar.mjs`, Chromium em 360, 390, 768 e 1440 px, sem rolagem horizontal, além dos fluxos de criação, contador, migração, cópia e exclusão.

## Project Structure

### Documentation (this feature)

```text
specs/025-criar-cartoes-baralho/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── prototipos.md
└── contracts/
    ├── http.md
    └── ui.md
```

### Source Code

```text
backend/src/acervo/                         # invariantes, cópias, exclusões, transição
backend/src/armazenamento/porta.ts           # operações do Module Acervo
backend/src/armazenamento/sqlite/            # migrações 13/14 e Adapter
backend/src/armazenamento/postgresql/        # mesmas migrações e semântica
backend/src/http/rotas.ts                    # contratos HTTP novos/alterados
backend/tests/acervo/                        # invariantes e migração por Adapter
backend/tests/http/                          # rotas e isolamento por Usuário
frontend/src/acervo-cliente/cliente.ts       # Interface `ClienteDoAcervo`
frontend/src/acervo-cliente/cliente-http.ts  # Adapter HTTP
frontend/src/acervo-cliente/cliente-em-memoria.ts # Adapter de teste
frontend/src/ui/PaginaDoBaralho.tsx          # listagem contextual e ações
frontend/src/ui/PaginaDoFormularioDeCartao.tsx # criação contextual/edição
frontend/src/ui/Aplicacao.tsx                 # transição por Usuário
frontend/src/ui/Moldura.tsx                   # remover destino Cartões
frontend/src/ui/navegacao.ts                  # rotas e guarda de transição
frontend/tests/                               # Interface, estado, teclado e acessibilidade
e2e/                                          # persistência, transição e responsividade
design/criar-cartoes-no-baralho/              # protótipo autônomo + verificador Chromium
```

**Structure Decision**: manter módulos e pastas existentes no produto; acrescentar apenas contratos, provas e o diretório de protótipo desta feature. `pertencimento` permanece dentro do armazenamento do `Acervo`; não criar serviço ou Seam adicional.

## Complexity Tracking

Nenhuma violação da constituição. A tela de transição e o esquema aditivo são necessários para cumprir FR-397 sem perder escolhas ou bloquear os demais Usuários.
