# Implementation Plan: Gerenciar conta do Usuário

**Branch**: `017-gerenciar-conta-usuario` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md) | **Contratos**: [contracts/contratos.md](./contracts/contratos.md)

## Summary

A feature 017 completa o CRUD da conta do Usuário sem criar administrador, sessão, cookie ou token. O Module `Identidade` (`backend/src/identidade/identidade.ts`) passa a ser o dono da gestão da conta, com `obterConta`, `alterarNomeDeUsuario`, `trocarSenha` e `excluirConta`, reutilizando a normalização e a validação de Cadastro (007) e a comparação de Senha em tempo constante de Entrar (008). A Porta `ArmazenamentoDeUsuarios` ganha `atualizarNomeDeUsuario`, `atualizarSenha`, `excluirUsuario` e `contarDadosDoUsuario`; a exclusão é hard-delete e se apoia nas cascatas já existentes, com a migração da 016 obrigada a declarar `ON DELETE CASCADE` para `usuario`. O HTTP expõe `GET /conta`, `PUT /conta/nome-de-usuario`, `PUT /conta/senha` e `DELETE /conta`, todas sob o hook de Credencial existente, com `401` reservado à Credencial recusada e `403` para `senha_atual_incorreta`. O frontend ganha a seção «Minha conta» dentro de Preferências, o Module puro `resultado-incerto.ts` e a substituição em memória da Credencial. Requisitos: FR-257..FR-288; critérios: SC-105..SC-113.

## Technical Context

**Language/Version**: backend Node 24 (Fastify); frontend React 19 + Vite (TypeScript).

**Primary Dependencies**: as existentes (Fastify, React, Vite, Vitest, Playwright). Nenhuma dependência nova.

**Storage**: Porta `ArmazenamentoDeUsuarios` (`backend/src/armazenamento/porta.ts`), implementada pelos Adapters SQLite (`backend/src/armazenamento/sqlite/armazenamento.ts`) e PostgreSQL (`backend/src/armazenamento/postgresql/armazenamento.ts`). Nenhuma migração nova é criada pela 017; a migração da 016 precisa declarar `ON DELETE CASCADE` para `usuario` nas tabelas da Agenda.

**Testing**:
- unit tests do Module `Identidade` e do Module puro `frontend/src/conta/resultado-incerto.ts`;
- bateria compartilhada da Porta (`backend/tests/armazenamento/bateria-da-porta.ts`) rodando nos dois Adapters, cobrindo cascade com dois Usuários;
- contrato HTTP (`backend/tests/http/`), paridade em `backend/tests/funcao/funcao.test.ts` e guarda de CORS em `backend/tests/http/cors.test.ts`;
- testes de tela (`frontend/tests/`) para `SecaoMinhaConta`, Preferências e `Aplicacao`;
- e2e `e2e/minha-conta.spec.ts`: renomear, trocar Senha com segunda janela recusada, excluir com dois Usuários provando isolamento e reuso de nome, percurso por teclado;
- SC-108 medido por teste de backend que semeia 2.000 Cartões + 500 Registros de sessão.

**Target Platform**: servidor Linux (Node 24, entradas local `backend/src/entradas/local.ts` e nuvem `backend/src/funcao/funcao.ts`); navegadores modernos, desktop e mobile, para o frontend.

**Project Type**: web application (backend + frontend), com uma única lista de rotas compartilhada por local e nuvem.

**Performance Goals**: exclusão de uma conta com 2.000 Cartões e 500 Registros de sessão confirmada em menos de 5 s no ambiente local de aceite, ou não aplicada em absoluto (SC-108).

**Constraints**: isolamento por Usuário (008, FR-090, FR-287); sem falso sucesso (FR-044, FR-280..FR-283); Senha nunca em resposta, log ou navegador (FR-078); sem sessão, cookie ou token (FR-079); acessibilidade e responsividade da 012 (FR-285, SC-109); sem administrador (FR-287).

**Scale/Scope**: 2.000 Cartões e 500 Registros de sessão por Usuário no teste de exclusão; contagens do diálogo de exclusão; nenhum destino novo na navegação principal (FR-257).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Spec-Driven Development**: a 017 tem spec, clarify, plan, contratos e critérios de aceitação antes de qualquer implementação; FR-257..FR-288 e SC-105..SC-113 vencem o código onde houver divergência.
- **II. Auditabilidade Append-Only** (constituição 3.0.0): as decisões D1–D7 e R1–R5 e as skills aplicadas ficam em `research.md`; as ações e as verificações, nas mensagens de commit. O SESSION.md não é usado: existe apenas na tag `v1.0.0`.
- **III. Domínio Antes de Tecnologia**: os termos usados são de CONTEXT.md — Usuário, Credencial, Nome de usuário, Senha, Preferências, Minha conta e Excluir conta; nada de banco, framework ou tarefa no glossário.
- **IV. Módulos Profundos**: o `Identidade` ganha quatro verbos e esconde validação, normalização, derivação e tradução de erros; a Porta `ArmazenamentoDeUsuarios` já tem dois Adapters (SQLite e PostgreSQL) e ganha as operações novas; o Module puro `resultado-incerto.ts` decide o significado de uma verificação sem rede; a Interface do `ClienteDoAcervo` no frontend esconde HTTP e memória. Nenhuma Seam nova com Adapter único.
- **V. A Interface é a Superfície de Teste**: a bateria da Porta atravessa a mesma Seam dos callers nos dois Adapters; os testes de `Identidade` atravessam os quatro verbos; os testes HTTP atravessam rotas e hook de Credencial; os testes de tela atravessam `SecaoMinhaConta` e `PaginaDePreferencias`; `resultado-incerto` é testado pela função pura.
- **VI. Verificação Sobre Afirmação**: o Arquiteto inspeciona todo diff, executa ou confere as verificações e commita; nenhuma afirmação de worker é aceita sem isso.
- **VII. Escopo Mínimo Honesto**: recuperação de Senha, exportação, carência, restauração, administrador, limite de tentativas, e-mail, verificação em duas etapas e auditoria ficam fora (Funcionalidades Adiadas da spec). Nada de token, cookie ou sessão (FR-079).
- **VIII. Segredos Fora do Repositório**: nenhum segredo, credencial, token ou string de conexão nova entra em arquivo versionado; a Senha e a Credencial continuam apenas em memória e nunca em log (FR-078, FR-089).
- **IX. Rastreabilidade Requisito–Teste**: FR-257..FR-288 e SC-105..SC-113 são mapeados a testes no artefato de tasks e conferidos na revisão do diff.
- **X. Portões de Qualidade**: checklist aprovado e análise registrada em
  `research.md`, sem CRITICAL remanescente, antes de `implement`; o portão é
  binário.
- **XI. Delegação Obrigatória de Código**: todo código sob `backend/`, `frontend/` e `e2e/` é criado por workers DeepSeek; o Arquiteto especifica, delega, revisa e verifica. Aplicam-se as skills domain-modeling (Usuário, Credencial, exclusão, cenários-limite) e codebase-design (Interface do `Identidade`, Porta, Module puro de resultado incerto, Seam do cliente).

## Project Structure

### Documentation (this feature)

```text
specs/017-gerenciar-conta-usuario/
├── plan.md              # Este arquivo (/speckit-plan)
├── spec.md              # Especificação da feature
├── research.md          # Decisões D1–D7 e R1–R5 (research)
├── data-model.md        # Entidades, Porta, cascatas e transações (data model)
├── quickstart.md        # Percurso manual de verificação (quickstart)
├── contracts/           # Contratos da Porta, do Module e HTTP (contracts)
│   └── contratos.md
├── tasks.md             # Tarefas (/speckit-tasks — não criado aqui)
└── checklists/          # Checklist da feature
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── identidade/
│   │   └── identidade.ts          # Ganha obterConta, alterarNomeDeUsuario, trocarSenha e excluirConta (D1)
│   ├── armazenamento/
│   │   ├── porta.ts               # Porta ArmazenamentoDeUsuarios ganha atualizarNomeDeUsuario, atualizarSenha, excluirUsuario e contarDadosDoUsuario (D2)
│   │   ├── sqlite/
│   │   │   └── armazenamento.ts   # Adapter SQLite das operações novas (D2)
│   │   └── postgresql/
│   │       └── armazenamento.ts   # Adapter PostgreSQL das operações novas (D2)
│   └── http/
│       ├── rotas.ts               # Handlers de GET /conta, PUT /conta/nome-de-usuario, PUT /conta/senha e DELETE /conta (D3)
│       └── servidor.ts            # registrarRotasDaAplicacao e pré-voo de CORS incluem as rotas novas (D3)
└── tests/
    ├── identidade/
    │   └── conta.test.ts          # obterConta, alterarNomeDeUsuario, trocarSenha e excluirConta (D1, FR-257..FR-279)
    ├── armazenamento/
    │   ├── bateria-da-porta.ts    # Bateria compartilhada cobre atualizarNomeDeUsuario, atualizarSenha, excluirUsuario e contarDadosDoUsuario (D2)
    │   ├── sqlite.test.ts         # Roda a bateria no SQLite
    │   └── postgresql/
    │       └── bateria.test.ts    # Roda a bateria no PostgreSQL
    ├── http/
    │   ├── conta.test.ts          # Contrato HTTP das quatro rotas (D3)
    │   ├── cors.test.ts           # Guarda de CORS: cada rota registrada tem pré-voo (D3)
    │   └── conta-sc108.test.ts    # Exclusão com 2.000 Cartões + 500 Registros (SC-108)
    └── funcao/
        └── funcao.test.ts         # Paridade: cada rota nova chamada pela função da nuvem (D3)

frontend/
├── src/
│   ├── acervo-cliente/
│   │   ├── cliente.ts             # Interface do cliente ganha obterConta, alterarNomeDeUsuario, trocarSenha e excluirConta (D5)
│   │   ├── cliente-http.ts        # Implementação HTTP dos métodos novos (D5)
│   │   ├── cliente-em-memoria.ts  # Implementação em memória dos métodos novos (D5)
│   ├── conta/
│   │   └── resultado-incerto.ts   # Module puro com a decisão de D4 (D5)
│   └── ui/
│       ├── guarda-de-credencial.ts # Envolve os métodos novos; substituição em memória da Credencial (D5)
│       ├── SecaoMinhaConta.tsx    # Seção «Minha conta» com três formulários/diálogos (D5, FR-257)
│       ├── FormularioDeNomeDeUsuario.tsx # Alterar Nome de usuário (FR-259..FR-265)
│       ├── FormularioDeTrocaDeSenha.tsx  # Trocar Senha (FR-266..FR-271)
│       ├── DialogoDeExclusaoDeConta.tsx  # Excluir conta (FR-272..FR-278)
│       ├── PaginaDePreferencias.tsx # Renderiza SecaoMinhaConta (D5, FR-257)
│       └── Aplicacao.tsx          # Callback de substituição/descarte de Credencial e ida a Entrar (D5, FR-263, FR-270, FR-276)
└── tests/                         # pasta plana, como as existentes
    ├── resultado-incerto.test.ts  # Decisão pura de D4 (FR-280..FR-283)
    ├── secao-minha-conta.test.tsx # Formulários, mensagens e teclado (FR-257..FR-271, FR-285)
    ├── pagina-de-preferencias.test.tsx # Seção Minha conta dentro de Preferências (FR-257)
    └── aplicacao.test.tsx         # Substituição e descarte de Credencial (FR-263, FR-270, FR-276)

e2e/
└── minha-conta.spec.ts            # Renomear, trocar Senha, excluir com dois Usuários e teclado (SC-105..SC-113)
```

**Structure Decision**: mantém-se a estrutura de projeto único com backend e frontend separados, já usada da 001 à 016. A gestão da conta vive no Module `Identidade`, que já é o dono da política de Nome de usuário e de Senha (D1); as operações de persistência entram na Porta `ArmazenamentoDeUsuarios` existente, com dois Adapters (D2); o HTTP usa a lista única de `registrarRotasDaAplicacao` e a lista de pré-voo de `criarServidor` (D3); o frontend adiciona um Module puro para resultado incerto e a seção dentro de Preferências, sem destino novo (D5).

## Complexity Tracking

Não há violações constitucionais. A 017 não cria Seam com Adapter único: `Identidade` e `ArmazenamentoDeUsuarios` já existem; `resultado-incerto.ts` é um Module puro, sem I/O, e a Interface do `ClienteDoAcervo` já tem Adapters HTTP e em memória. Não há migração própria nem abstração antecipada.

## Ondas de execução (prévia)

A divisão final em tarefas, portões e rastreabilidade estará em [tasks.md](./tasks.md), que prevalece sobre esta prévia. As ondas mantêm arquivos disjuntos e são delegadas a workers DeepSeek, com revisão do Arquiteto (Princípio XI).

1. **Onda 1 — Porta e Adapters**: `backend/src/armazenamento/porta.ts`, `backend/src/armazenamento/sqlite/armazenamento.ts`, `backend/src/armazenamento/postgresql/armazenamento.ts`, `backend/tests/armazenamento/bateria-da-porta.ts`, testes de bateria dos dois Adapters. Cobre D2, FR-274, FR-275, SC-105 e SC-108.
2. **Onda 2 — Identidade, HTTP, CORS e paridade**: `backend/src/identidade/identidade.ts`, `backend/src/http/rotas.ts`, `backend/src/http/servidor.ts`, `backend/tests/identidade/conta.test.ts`, `backend/tests/http/conta.test.ts`, `backend/tests/http/cors.test.ts`, `backend/tests/http/conta-sc108.test.ts`, `backend/tests/funcao/funcao.test.ts`. Cobre D1, D3, D6, FR-257..FR-288 e SC-107, SC-108.
3. **Onda 3 — Cliente frontend e resultado incerto**: `frontend/src/acervo-cliente/cliente.ts`, `cliente-http.ts`, `cliente-em-memoria.ts`, `frontend/src/ui/guarda-de-credencial.ts`, `frontend/src/conta/resultado-incerto.ts`, `frontend/tests/resultado-incerto.test.ts`. Cobre D4, D5 e FR-280..FR-283.
4. **Onda 4 — Seção Minha conta, Preferências e Aplicação**: `frontend/src/ui/SecaoMinhaConta.tsx`, `PaginaDePreferencias.tsx`, `Aplicacao.tsx`, testes de tela. Cobre D5, FR-257..FR-276, FR-285, FR-286 e SC-109, SC-113.
5. **Onda 5 — e2e e desempenho**: `e2e/minha-conta.spec.ts` e o teste de SC-108. Cobre SC-105..SC-113 e o percurso por teclado.
