# Implementation Plan: Repetição espaçada

**Branch**: `main` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md) | **Contratos**: [contracts/contratos.md](./contracts/contratos.md)

## Summary

O Memorization passa a agendar cada Cartão por um Algoritmo de repetição espaçada escolhido pelo Usuário; nesta entrega há apenas o SM-2, atrás de uma Porta pura e plugável. A Avaliação ganha quatro níveis — Errei, Difícil, Bom e Fácil — em toda Sessão, sempre após a Revelação, e substitui os botões Acertei/Errei. Início mostra "N Cartões para revisar hoje", com limite diário de Cartões novos, e conduz a Revisão do dia (em lotes de até 20 Itens). Concluir um lote registra a Sessão e atualiza os Agendamentos de forma atômica e idempotente; a troca de algoritmo reconstrói o Agendamento por replay do Histórico. O acervo anterior à 015 entra como Cartões novos, sem alterar os Registros antigos.

## Technical Context

**Language/Version**: backend Node 24 (Fastify); frontend React 19 + Vite (TypeScript).

**Primary Dependencies**: as existentes (Fastify, React, Vite, Vitest, Playwright). **Nenhuma dependência nova.**

**Storage**: migração 7 nos dois Adapters da Porta `ArmazenamentoDoAcervo` — SQLite (`backend/src/armazenamento/sqlite/migracoes.ts`) e PostgreSQL (`backend/src/armazenamento/postgresql/migracoes.ts`). Cria `agendamento` e `preferencias` e adiciona colunas a `item_de_registro` e `registro_de_sessao` (D5).

**Testing**:
- bateria compartilhada da Porta (`backend/tests/armazenamento/bateria-da-porta.ts`) rodando nos dois Adapters;
- testes dos Modules puros (`backend/src/repeticao/` e `frontend/src/revisao/dia.ts`);
- contrato HTTP das rotas novas (`backend/tests/http/`) e teste de paridade em `backend/tests/funcao/funcao.test.ts`;
- testes de tela (`frontend/tests/`) e e2e com API real (`e2e/`); os e2e existentes que clicam Acertei/Errei são atualizados.

**Target Platform**: servidor Linux (Node 24, entradas local `backend/src/entradas/local.ts` e nuvem `backend/src/funcao/funcao.ts`); navegadores modernos, desktop e mobile, para o frontend.

**Project Type**: web application (backend + frontend), com uma única lista de rotas compartilhada por local e nuvem.

**Performance Goals**: Início com o bloco de revisão visível em até 1 s com 2.000 Cartões e 500 registros, no ambiente local de testes (SC-087).

**Constraints**: isolamento por Usuário (`008`, FR-219); sem falso sucesso (FR-044); atomicidade e idempotência na conclusão (FR-210); acessibilidade e responsividade da `012` (FR-218, SC-088).

**Scale/Scope**: 2.000 Cartões e 500 registros por Usuário; Revisão do dia em lotes de no máximo 20 Itens (FR-203); limite diário de Cartões novos de 0 a 999, padrão 20 (FR-200).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Spec-Driven Development**: a 015 tem spec, clarify, plan, contratos e critérios de aceitação antes de qualquer implementação; a spec vence o código onde houver divergência.
- **II. Auditabilidade Append-Only**: cada sessão, decisão (D1–D8, R9–R12) e resultado verificável entra em SESSION.md, em append-only, com prompts sanitizados.
- **III. Domínio Antes de Tecnologia**: os termos usados são do CONTEXT.md — Agendamento do Cartão, Avaliação, Algoritmo de repetição espaçada, Preferências, Revisão do dia; nada de banco, framework ou tarefa no glossário.
- **IV. Módulos Profundos**: o SM-2 e o cálculo da revisão ficam atrás de Interfaces puras e pequenas (`AlgoritmoDeRepeticao`, Module `revisao.ts`); Agendamentos e Preferências ficam atrás da Porta `ArmazenamentoDoAcervo` existente, sem criar Seam nova. A Seam de algoritmo tem um único Adapter hoje e é justificada por decisão explícita do PO (ver Complexity Tracking).
- **V. A Interface é a Superfície de Teste**: a bateria compartilhada da Porta atravessa a mesma Seam dos callers nos dois Adapters; os testes do SM-2 atravessam `avaliar`/`previa`; os testes de tela atravessam os componentes, não o estado interno.
- **VI. Verificação Sobre Afirmação**: o Arquiteto inspeciona todo diff, executa ou confere as verificações e commita; nenhuma afirmação de worker é aceita sem isso.
- **VII. Escopo Mínimo Honesto**: só o SM-2 entra; FSRS, Leitner, lembretes, metas e suspensão ficam fora do escopo. Nenhuma abstração, configuração ou compatibilidade não pedida.
- **VIII. Segredos Fora do Repositório**: nenhuma credencial, token ou string de conexão nova entra em arquivo versionado; a Credencial do Usuário já existe e não é versionada.
- **IX. Rastreabilidade Requisito–Teste**: cada FR-187–FR-221 e SC-080–SC-090 é mapeado a um teste no artefato de tasks e conferido na revisão do diff.
- **X. Portões de Qualidade**: `analyze` sem CRITICAL e checklist aprovado antes de `implement`; o portão é binário.
- **XI. Delegação Obrigatória de Código**: todo código sob `backend/`, `frontend/` e `e2e/` é criado por workers DeepSeek; o Arquiteto especifica, delega, revisa e verifica. Aplicam-se as skills **domain-modeling** (linguagem, invariantes e cenários-limite da Avaliação, Agendamento e Preferências) e **codebase-design** (desenho das Interfaces de algoritmo e revisão, posicionamento das Seams, profundidade atrás da Porta).

## Project Structure

### Documentation (this feature)

```text
specs/015-repeticao-espacada/
├── plan.md              # Este arquivo (/speckit-plan)
├── spec.md              # Especificação da feature
├── research.md          # Decisões D1–D8 e R9–R12 (research)
├── data-model.md        # Entidades e migração 7 (data model)
├── quickstart.md        # Percurso manual de verificação (quickstart)
├── contracts/           # Contratos da Porta e HTTP (contracts)
│   └── contratos.md
├── tasks.md             # Tarefas (/speckit-tasks — não criado aqui)
└── checklists/          # Checklist da feature
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── repeticao/
│   │   ├── algoritmo.ts            # Interface AlgoritmoDeRepeticao, ALGORITMOS, ALGORITMO_PADRAO, algoritmoPorId e previa (D1)
│   │   ├── sm2.ts                  # Implementação SM-2, versão 1, estado { repeticoes, facilidade, intervaloEmDias } (D2)
│   │   └── revisao.ts              # Module puro: resumoDaRevisao, loteDeRevisao, aplicarAvaliacoes, reconstruir (D5)
│   ├── armazenamento/
│   │   ├── porta.ts               # Porta ganha Preferências, Agendamentos e inserirRegistroEAgendamentos / substituirAgendamentos (D5)
│   │   ├── sqlite/
│   │   │   ├── migracoes.ts       # Migração 7: agendamento, preferencias, colunas em item_de_registro e registro_de_sessao (D5)
│   │   │   └── armazenamento.ts   # Adapter SQLite das novas operações da Porta (D5)
│   │   └── postgresql/
│   │       ├── migracoes.ts       # Migração 7 em PostgreSQL, equivalente à do SQLite (D5)
│   │       └── armazenamento.ts   # Adapter PostgreSQL das novas operações da Porta (D5)
│   ├── acervo/
│   │   └── acervo.ts              # Orquestra resumo, lote, prévias, preferências e reconstrução; registrarSessao estendido (D4, D5)
│   └── http/
│       ├── rotas.ts               # Handlers de /revisao, /revisao/lote, /previas, /preferencias e /sessoes estendido (D6)
│       └── servidor.ts            # registrarRotasDaAplicacao: lista única usada por local e nuvem (D6)
└── tests/
    ├── repeticao/
    │   ├── sm2.test.ts            # Tabela de referência SC-082 (D2, R12)
    │   ├── previa.test.ts         # previa dos 4 botões; SC-090 (D1)
    │   └── revisao.test.ts        # resumo, lote, aplicação e reconstrução determinística (D5, SC-083)
    ├── armazenamento/
    │   ├── bateria-da-porta.ts    # Bateria compartilhada ganha Preferências, Agendamentos e transações (D5)
    │   ├── sqlite.test.ts         # Roda a bateria no SQLite
    │   └── postgresql/
    │       ├── bateria.test.ts    # Roda a bateria no PostgreSQL
    │       └── migracoes.test.ts  # Migração 7 sobre base da 013 preserva dados
    ├── acervo/
    │   ├── migracoes.test.ts      # Migração 7 no SQLite preserva dados (FR-220)
    │   ├── repeticao.test.ts      # Conclusão atômica e idempotente; Cartão excluído; troca de algoritmo (FR-210, FR-213) — novo
    │   └── preferencias.test.ts   # Validação e padrões das Preferências (FR-200, FR-212) — novo
    ├── http/
    │   ├── revisao.test.ts        # GET /revisao, GET /revisao/lote, POST /previas (D6) — novo
    │   ├── preferencias.test.ts   # GET/PUT /preferencias (D6) — novo
    │   └── sessoes.test.ts        # POST /sessoes estendido (D4, FR-210)
    └── funcao/
        └── funcao.test.ts         # Paridade: cada rota nova chamada pela função da nuvem (D6)

frontend/
├── src/
│   ├── sessao-de-estudo/
│   │   └── sessao-de-estudo.ts    # Resultado → Avaliação (4 níveis); Item guarda cartaoId (D7)
│   ├── revisao/
│   │   └── dia.ts                 # Module puro: limitesDoDia e rotuloDaPrevia (D7)
│   ├── acervo-cliente/
│   │   ├── cliente.ts             # Interface do cliente: métodos de revisão, prévias e preferências (D7)
│   │   ├── cliente-http.ts        # Implementação HTTP dos métodos novos (D7)
│   │   ├── cliente-em-memoria.ts  # Implementação em memória, com prévia fixa simples e documentada (D7)
│   │   └── guarda-de-credencial.ts# Credencial por Usuário (D7)
│   └── ui/
│       ├── navegacao.ts           # Rotas #/revisao e #/preferencias e ROTA_PADRAO de Início (D6, D7)
│       ├── Moldura.tsx            # Navegação ganha Preferências (Início, Baralhos, Cartões, Preferências, Sair) (D7)
│       ├── PaginaDeInicio.tsx     # Bloco de revisão com carregamento, falha e sucesso próprios (FR-217)
│       ├── PaginaDaRevisao.tsx    # Sessão da Revisão do dia; "Continuar revisão" e "Voltar a Início" (D7)
│       ├── PaginaDeEstudo.tsx     # 4 botões com prévia; atalhos 1–4 após a Revelação (FR-218, FR-221)
│       ├── PaginaDePreferencias.tsx # Algoritmo e limite diário de Cartões novos, com salvar explícito (FR-212)
│       ├── ResumoDaSessao.tsx     # Contagem por nível; "Revisão do dia" no lugar do nome do Baralho (FR-215, FR-216)
│       ├── PaginaDoRegistro.tsx   # Registro da Revisão do dia sem o selo "Baralho excluído" (FR-215)
│       └── Aplicacao.tsx          # Rotas das páginas novas (D7)
└── tests/                         # pasta plana, como as existentes
    ├── revisao-dia.test.ts        # limitesDoDia e rotuloDaPrevia (D7) — novo
    ├── sessao-de-estudo/sessao-de-estudo.test.ts # Avaliação em 4 níveis; Sessão da Revisão sem embaralhar
    ├── acervo-cliente/cliente.test.ts            # métodos novos do cliente HTTP e em memória
    ├── pagina-de-inicio.test.tsx  # Bloco de revisão: carregamento, falha e sucesso (FR-217)
    ├── pagina-da-revisao.test.tsx # Lote, "Continuar revisão" e "Voltar a Início" (FR-203, FR-215) — novo
    ├── pagina-de-preferencias.test.tsx # Salvar, descarte e falha (FR-212) — novo
    ├── pagina-de-estudo.test.tsx  # 4 botões, prévia, atalhos 1–4 (FR-218, FR-221)
    ├── resumo-da-sessao.test.tsx  # Contagem por nível de Avaliação (FR-216)
    ├── pagina-do-registro.test.tsx # Registro da Revisão do dia (FR-215)
    └── moldura.test.tsx, navegacao.test.tsx # Preferências na navegação

e2e/
├── repeticao-espacada.spec.ts     # Percurso com API real: Início → Revisão → Avaliação → Agendamento — novo
├── preferencias.spec.ts           # Preferências e limite de novos — novo
└── sessao-de-estudo.spec.ts, estatisticas-e-historico.spec.ts, percurso-por-teclado.spec.ts # Acertei/Errei → 4 níveis
```

**Structure Decision**: mantém-se a estrutura de projeto único com backend e frontend separados, já usada da `001` à `013`. O Agendamento e as Preferências entram na Porta `ArmazenamentoDoAcervo` existente (D5); o algoritmo e o cálculo da revisão vivem em `backend/src/repeticao/` como Modules puros (D1, D2, D5); as telas novas ficam em `frontend/src/ui/` e o cálculo de dia no frontend fica em `frontend/src/revisao/dia.ts` (D7).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Seam de algoritmo com um único Adapter (SM-2) | O PO exige o algoritmo plugável: FSRS e Leitner entram depois sem tocar telas, Histórico nem Agendamentos de outros algoritmos (FR-187–FR-191). A Seam é função pura, sem relógio nem I/O, e barata de manter. | Não introduzir a Seam obrigaria a reescrever o Agendamento a cada novo algoritmo e acoplaria o `Acervo` a um algoritmo único, contrariando FR-191. A indireção não passa de uma Interface pequena sobre uma função pura, sem custo de fiação. |

## Ondas de execução

A divisão final em 8 ondas, com as tarefas T1501–T1527, os portões e a rastreabilidade, está em [tasks.md](./tasks.md), que prevalece sobre qualquer prévia.
