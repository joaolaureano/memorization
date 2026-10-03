# Implementation Plan: Acesso temporário

**Branch**: `018-acesso-temporario` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md) | **Contratos**: [contracts/contratos.md](./contracts/contratos.md)

## Summary

A feature 018 introduz o Acesso temporário: um valor opaco aleatório de pelo menos 256 bits, gerado no servidor ao Entrar, cujo único dado guardado é o digest SHA-256 em uma nova tabela `acesso_temporario(digest PK, usuario_id REFERENCES usuario(id) ON DELETE CASCADE, criado_em, expira_em, ultima_acao_em)`, com índice `(usuario_id)`. O navegador guarda o valor em cookie `HttpOnly`, `Secure` na nuvem, `SameSite=Strict`, `Path=/`, com `Max-Age` longo; a validade é decidida exclusivamente pelo servidor por `expira_em`, com TTL de 5 minutos renovado a cada ação (FR-291, FR-297). Uma nova Porta `ArmazenamentoDeAcessos` isola a persistência, com Adapters SQLite e PostgreSQL. O hook de Credencial passa a aceitar Acesso temporário válido OU Credencial Basic (FR-090 revisado). O frontend ganha `atividade.ts`, Module puro que decide quando renovar; a Aplicação envia `POST /acesso/renovar` no máximo uma vez a cada 60 s enquanto houver interação, e a opção «Continuar conectado neste navegador» em Entrar, marcada por padrão (FR-292). Sair encerra apenas o Acesso do navegador (FR-293, FR-295); alterações da 017 encerram todos os Acessos e emitem um novo Acesso para o navegador da alteração quando aplicável (FR-296). Requisitos: FR-289..FR-306, com FR-079/FR-089/FR-090/FR-091 revisados; critérios: SC-114..SC-124.

## Technical Context

**Language/Version**: backend Node 24 (Fastify); frontend React 19 + Vite (TypeScript).

**Primary Dependencies**: as existentes (Fastify, React, Vite, Vitest, Playwright). Nenhuma dependência nova.

**Storage**: nova tabela `acesso_temporario`, em migração nova nos dois Adapters. Número da migração: **9** se a migração 8 da 016 já estiver aplicada; caso contrário, **8** — a decisão é registrada explicitamente em [research.md](./research.md) (D1). Porta `ArmazenamentoDeAcessos` em `backend/src/armazenamento/porta.ts`, com Adapters SQLite (`backend/src/armazenamento/sqlite/armazenamento.ts`) e PostgreSQL (`backend/src/armazenamento/postgresql/armazenamento.ts`).

**Testing**: bateria compartilhada da Porta nos dois Adapters; contrato HTTP; teste do hook de Credencial com Acesso e com Basic; teste puro de `frontend/src/acesso/atividade.ts`; testes de tela de Entrar, Aplicação e Sair; e2e em navegador real com `ACESSO_VALIDADE_SEGUNDOS` pequeno; inspeção de armazenamento para SC-116 (D8).

**Target Platform**: servidor Linux (Node 24, entradas local `backend/src/entradas/local.ts` e nuvem `backend/src/funcao/funcao.ts`); navegadores modernos, desktop e mobile, para o frontend.

**Project Type**: web application (backend + frontend), com uma única lista de rotas compartilhada por local e nuvem.

**Performance Goals**: SC-118: reabertura dentro da validade volta ao Início em até 2 s no ambiente local; validação e renovação determinísticas, sem job em background.

**Constraints**: TTL de 5 minutos deslizante, configurável apenas por ambiente para testes (`ACESSO_VALIDADE_SEGUNDOS`, padrão 300), nunca pela pessoa; cookie com `HttpOnly`, `Secure` na nuvem, `SameSite=Strict`, `Path=/`; produção same-origin (CloudFront serve SPA e `/api`), sem CORS necessária; no local cross-port, CORS com origem configurada do frontend e `Access-Control-Allow-Credentials: true`, nunca `*` com credenciais; Acesso nunca em URL, corpo de resposta ou log (FR-297, FR-305); Senha nunca no navegador (FR-078); FR-079/FR-089/FR-090/FR-091 revisados; FR-289..FR-306; SC-114..SC-124.

**Scale/Scope**: um Acesso por Entrar por navegador; vários navegadores independentes por Usuário; remoção preguiçosa de expirados; sem «Sair de todos os navegadores», sem lista de navegadores, sem aviso prévio, sem TTL escolhido pela pessoa.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Spec-Driven Development**: a 018 tem spec, clarify, plan, contratos e critérios antes de qualquer implementação; FR-289..FR-306 e SC-114..SC-124 vencem o código onde houver divergência.
- **II. Auditabilidade Append-Only** (constituição 3.0.0): as decisões D1–D9, as alternativas rejeitadas e as skills aplicadas ficam em `research.md`; as ações e as verificações, nas mensagens de commit. O `SESSION.md` não é usado: existe apenas na tag `v1.0.0`.
- **III. Domínio Antes de Tecnologia**: o termo canônico é **Acesso temporário**; **Credencial**, **Entrar**, **Sair** e **Usuário** vêm de `CONTEXT.md`; **Navegador** é termo descritivo da spec 018 (Key Entities), sem uso como conceito de domínio. «token», «sessão», «cookie» e «login» são `_Avoid_` como termos de domínio; «cookie» aparece apenas como mecanismo técnico de transporte, sem virar entidade.
- **IV. Módulos Profundos**: a nova Porta `ArmazenamentoDeAcessos` esconde a persistência e tem dois Adapters reais (SQLite e PostgreSQL), com ciclo de vida diferente de `ArmazenamentoDeUsuarios`; o hook de Credencial esconde a verificação de Acesso ou Basic; `frontend/src/acesso/atividade.ts` é Module puro, sem I/O, que recebe a interação e decide se deve renovar, enquanto `ClienteDoAcervo` continua escondendo HTTP e memória.
- **V. A Interface é a Superfície de Teste**: a bateria da Porta atravessa a mesma Seam dos callers nos dois Adapters; o hook e as rotas são testados por HTTP; `atividade.ts` é testado pela função pura; as telas são testadas por `Aplicacao` e `PaginaDeEntrada`.
- **VI. Verificação Sobre Afirmação**: o Arquiteto inspeciona todo diff, executa ou confere as verificações e commita; nenhuma afirmação de worker é aceita sem isso.
- **VII. Escopo Mínimo Honesto**: «Sair de todos os navegadores», lista de navegadores, aviso antes de expirar, duração configurável pela pessoa, limite absoluto, dois fatores e lembrar Nome de usuário ficam fora (Funcionalidades Adiadas). Expirados são removidos preguiçosamente (D7), sem job em background.
- **VIII. Segredos Fora do Repositório**: o valor do Acesso é opaco, aleatório e nunca versionado; o banco guarda apenas o digest SHA-256; o cookie não é logado; a Senha continua apenas em memória durante o Entrar (FR-078, FR-089).
- **IX. Rastreabilidade Requisito–Teste**: FR-289..FR-306 e SC-114..SC-124 são mapeados a testes no artefato de tasks e conferidos na revisão do diff.
- **X. Portões de Qualidade**: `analyze` sem CRITICAL e checklist aprovado antes de `implement`; o portão é binário.
- **XI. Delegação Obrigatória de Código**: todo código sob `backend/`, `frontend/` e `e2e/` é criado por workers DeepSeek; o Arquiteto especifica, delega, revisa e verifica. Aplicam-se as skills domain-modeling (Acesso temporário, Credencial, expiração, cenários-limite) e codebase-design (nova Porta, hook, Module puro, cookie e Seam do cliente).

## Project Structure

### Documentation (this feature)

```text
specs/018-acesso-temporario/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── contratos.md
├── tasks.md
└── checklists/
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── armazenamento/
│   │   ├── porta.ts               # Nova Porta ArmazenamentoDeAcessos (D1)
│   │   ├── sqlite/
│   │   │   ├── armazenamento.ts   # Adapter SQLite da nova Porta (D1)
│   │   │   └── migracoes.ts       # Nova migração (8 ou 9, conforme D1)
│   │   └── postgresql/
│   │       ├── armazenamento.ts   # Adapter PostgreSQL da nova Porta (D1)
│   │       └── migracoes.ts       # Nova migração (8 ou 9, conforme D1)
│   ├── identidade/
│   │   └── identidade.ts          # Integração 017: encerrarTodosDoUsuario e novo Acesso (D5)
│   └── http/
│       ├── credencial.ts          # Hook aceita Acesso temporário OU Basic (D2, D4)
│       ├── rotas.ts               # POST /entrar estendido, GET /acesso, POST /acesso/renovar, POST /sair (D4)
│       └── servidor.ts            # registrarRotasDaAplicacao e pré-voo de CORS (D4)
└── tests/
    ├── armazenamento/
    │   ├── bateria-da-porta.ts    # Bateria da nova Porta (D8)
    │   ├── sqlite.test.ts         # Roda a bateria no SQLite
    │   └── postgresql/
    │       └── bateria.test.ts    # Roda a bateria no PostgreSQL
    ├── http/
    │   ├── acesso.test.ts         # Contrato das rotas e do cookie (D4, D8)
    │   ├── credencial.test.ts     # Hook com Acesso e Basic (D2, D8)
    │   └── cors.test.ts           # Guarda de CORS e credenciais (D2, D4)
    └── funcao/
        └── funcao.test.ts         # Paridade das rotas novas (D4)

frontend/
├── src/
│   ├── acesso/
│   │   └── atividade.ts           # Module puro: decisão de throttle (D3)
│   ├── acervo-cliente/
│   │   └── cliente-http.ts        # fetch com credentials: include (D2)
│   └── ui/
│       ├── Aplicacao.tsx          # Carga com GET /acesso, expiração e Sair (D6)
│       └── PaginaDeEntrada.tsx    # Checkbox Continuar conectado neste navegador (D6)
└── tests/
    ├── atividade.test.ts          # Throttle puro (D3, D8)
    ├── pagina-de-entrada.test.tsx # Checkbox, teclado e responsividade (D6, D8)
    └── aplicacao.test.tsx         # Carga, expiração, Sair e cookie (D6, D8)

e2e/
└── acesso-temporario.spec.ts      # Percurso real com TTL pequeno (D8)
```

**Structure Decision**: mantém-se a estrutura de projeto único com backend e frontend separados, já usada da 001 à 017. O Acesso temporário vive em uma nova Porta com dois Adapters; o hook de Credencial e as rotas ficam no HTTP existente; o frontend ganha um Module puro de atividade e alterações em `Aplicacao` e `PaginaDeEntrada`.

## Dependência de ordem

A 018 é implementada depois da 017: as duas alteram `Aplicacao.tsx` e o fluxo de Credencial, e a integração D5 usa as operações de conta da 017. A migração é numerada no momento da implementação (D1).

## Complexity Tracking

Não há violações constitucionais. A nova Porta `ArmazenamentoDeAcessos` é justificada por ter dois Adapters reais (SQLite e PostgreSQL) e ciclo de vida próprio; a alternativa de estender `ArmazenamentoDeUsuarios` foi registrada em `research.md` e rejeitada. `atividade.ts` é Module puro, sem I/O. Nenhuma Seam com Adapter único. A migração nova é obrigatória pela tabela nova; o número 8 ou 9 é decidido no momento da implementação, conforme D1.

## Ondas de execução (prévia)

A divisão final em tarefas, portões e rastreabilidade estará em [tasks.md](./tasks.md), que prevalece sobre esta prévia. As ondas mantêm arquivos disjuntos e são delegadas a workers DeepSeek, com revisão do Arquiteto (Princípio XI).

1. **Onda 1 — Porta, migração e Adapters**: `backend/src/armazenamento/porta.ts`, `backend/src/armazenamento/sqlite/armazenamento.ts`, `backend/src/armazenamento/postgresql/armazenamento.ts`, migrações novas e `backend/tests/armazenamento/bateria-da-porta.ts`. Cobre D1, D7 e FR-289/FR-297/FR-301; SC-115, SC-122.
2. **Onda 2 — Hook, rotas, CORS e 017**: `backend/src/http/credencial.ts`, `backend/src/http/rotas.ts`, `backend/src/http/servidor.ts`, `backend/tests/http/acesso.test.ts`, `backend/tests/http/credencial.test.ts`, `backend/tests/http/cors.test.ts`, `backend/tests/funcao/funcao.test.ts` e integração em `backend/src/identidade/identidade.ts`. Cobre D2, D4, D5; FR-079/FR-090/FR-091/FR-293/FR-295/FR-296/FR-297/FR-301/FR-306; SC-115, SC-119, SC-120, SC-122.
3. **Onda 3 — Cliente frontend e atividade**: `frontend/src/acesso/atividade.ts`, `frontend/src/acervo-cliente/cliente-http.ts`, `frontend/tests/atividade.test.ts`. Cobre D2, D3; FR-291, FR-297, FR-305; SC-116, SC-124.
4. **Onda 4 — Entrar, Aplicação e Sair**: `frontend/src/ui/PaginaDeEntrada.tsx`, `frontend/src/ui/Aplicacao.tsx`, `frontend/tests/pagina-de-entrada.test.tsx`, `frontend/tests/aplicacao.test.tsx`. Cobre D6; FR-289/FR-290/FR-292/FR-293/FR-294/FR-295/FR-302/FR-303/FR-304; SC-114, SC-118, SC-121, SC-123.
5. **Onda 5 — e2e**: `e2e/acesso-temporario.spec.ts` com `ACESSO_VALIDADE_SEGUNDOS` pequeno. Cobre D8; SC-114..SC-124.
6. **Onda 6 — Convergência**: revisão de diff, testes, `analyze`, checklist e ajustes finais; nenhuma nova capacidade.
