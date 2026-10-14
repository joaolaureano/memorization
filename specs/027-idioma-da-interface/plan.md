# Implementation Plan: Idioma da Interface

**Branch**: `027-idioma-da-interface` (trabalho na `main`, como nas features anteriores) | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Especificação 027 com os três esclarecimentos de 2026-10-13: idioma só no navegador; mensagens técnicas sempre em inglês, com o texto para a pessoa vindo da interface; rótulo "Baralho temporário" no idioma da interface.

## Summary

Um Module `frontend/src/idioma/` com três catálogos tipados (`pt` de referência, `en` e `es` com o mesmo tipo) e `Intl` para plural, datas e números, sem dependência nova. Um `ProvedorDeIdioma` resolve o idioma inicial (guardado → navegador → `pt`), grava em `localStorage`, ajusta `<html lang>` e expõe `useIdioma()`. O `SeletorDeIdioma` (🌐 + sigla) entra nos dois cabeçalhos. A Seam `ClienteDoAcervo` deixa de devolver texto: as recusas viram `Recusa { codigo, motivo?, limite? }`, e a UI as traduz na renderização. Com isso, os avisos mudam de idioma junto com a tela. O backend passa todas as mensagens técnicas para o inglês, centralizadas em `http/recusas.ts`, e dá códigos aos erros do importador Anki. A migração 19 apaga os rótulos "Revisão do dia" e "Baralho temporário" gravados como nome, e a UI os mostra pela `origem`. Decisões em [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript estrito; Node.js 24; React 19 + Vite.

**Primary Dependencies**: as existentes. Nenhuma dependência nova: catálogo próprio e `Intl` nativo (R2).

**Storage**: `localStorage` do navegador (`memorization.idioma`) para o Idioma da interface. SQLite e PostgreSQL: migração 19, só de dados (`registro_de_sessao.nome_do_baralho`).

**Testing**: Vitest + Testing Library (frontend; setup fixa `pt-BR`), Vitest backend (SQLite e PostgreSQL), Playwright (config fixa `locale: 'pt-BR'`; o spec novo usa `en-US`/`es`).

**Target Platform**: navegador + API Node local / Lambda atrás do CloudFront. Nenhuma mudança de infraestrutura.

**Project Type**: aplicação web cliente-servidor.

**Performance Goals**: troca de idioma visível em < 1 s (SC-004). Re-render React síncrono, sem rede.

**Constraints**: nenhum texto do produto fora do catálogo; nenhuma mensagem técnica fora do inglês; Conteúdo do Usuário nunca transformado; provas existentes intactas.

**Scale/Scope**: ~600 literais em 36 arquivos de UI; ~30 códigos de recusa + 4 novos; ~58 mensagens backend; 1 migração de dados; 1 componente novo; 1 Module novo.

## Constitution Check

*GATE: antes da Phase 0 e reavaliado após a Phase 1.*

| Princípio | Veredito |
|---|---|
| I — Spec-Driven | **PASS**. Deriva da spec 027 e do clarify. Nenhum `NEEDS CLARIFICATION`. A `premissa a validar` da spec foi resolvida no código (R1, R6). |
| II — Auditabilidade | **PASS**. Decisões e alternativas em `research.md`. |
| III — Domínio antes de tecnologia | **PASS**. Código usa `Idioma`, `Catalogo`, `Recusa`, `SeletorDeIdioma`, `rotuloDoBaralhoDoRegistro`. Termos traduzidos têm glossário fixo (R9). |
| IV — Módulos profundos | **PASS**. `idioma` é profundo (hook + componente escondem detecção, persistência, `lang`, `Intl`, fallback). Nenhuma Seam nova (Implementation única de armazenamento). A Seam `ClienteDoAcervo` fica mais estreita. |
| V — Interface é a superfície de teste | **PASS**. Provas pela UI (Testing Library), pela Seam do cliente nos dois Adapters, pelo `Acervo` e pelas rotas HTTP. |
| VI — Verificação | **PASS condicionado** à revisão dos diffs e à execução dos portões. |
| VII — Escopo mínimo | **PASS**. Sem biblioteca, sem `Accept-Language`, sem sincronização entre abas, sem preferência na conta. |
| VIII — Segredos | **PASS**. Nada sensível envolvido. |
| IX — Rastreabilidade | **PASS condicionado**: `tasks` mapeia FR-001…FR-021 e SC-001…SC-008. |
| X — Portões | **PASS até aqui**. Checklist 16/16. `analyze` antes de `implement`. |

### Reavaliação após Phase 1

**PASS**. O desenho não cria Seam nova. Muda o tipo de recusa da Seam existente nos dois Adapters ao mesmo tempo, mantém o contrato HTTP (só o idioma de `mensagem` e o campo opcional `limite`) e faz uma migração só de dados, idempotente.

## Decisões de Codebase Design

### Module `idioma` (`frontend/src/idioma/`)

`tipos.ts` (`Idioma`, locales), `pt.ts`/`en.ts`/`es.ts` (catálogos), `resolver.ts` (idioma inicial a partir de valor guardado e `navigator.languages`, função pura), `ProvedorDeIdioma.tsx` + `useIdioma`, `SeletorDeIdioma.tsx`. Interface pública: `ProvedorDeIdioma`, `useIdioma`, `SeletorDeIdioma`, `type Idioma`, `type Catalogo`.

### Seam `ClienteDoAcervo` — recusas por código

`Recusa` substitui `mensagem: string` em todo resultado de recusa. As constantes `MENSAGEM_DE_*` saem do cliente. `ClienteHttp` lê `erro`, `motivo` e `limite`, e mapeia código desconhecido para `indisponivel`. `ClienteEmMemoria` devolve as mesmas `Recusa`. `validacao.ts` devolve códigos.

### Backend

`http/recusas.ts` com `MENSAGENS_TECNICAS` em inglês. `acervo/invariantes.ts` e `identidade/invariantes.ts` devolvem código e `limite`. `importacao/anki.ts` lança erros com código. Logs e `throw` em inglês. `acervo.ts` grava `""` para as origens `revisao`/`temporario`. Migração 19 nos dois adapters.

### Ordem de entrega sugerida (para `tasks`)

1. Module `idioma` + Seletor nos cabeçalhos + setup de provas `pt-BR` (US1, US3).
2. Backend: mensagens técnicas em inglês, códigos Anki, `limite` (US4).
3. Seam `Recusa` nos dois Adapters + `recusas` nos catálogos (US4).
4. Extração dos textos por tela, uma tela por tarefa (US1, US2), com `en`/`es` na mesma tarefa.
5. Datas, números e plurais (US4); rótulos derivados + migração 19 (FR-020/021).
6. Provas transversais (`catalogos`, `sem-texto-solto`, e2e de idioma e layout).

## Estratégia de Testes

- **Module `idioma`**: `resolver` (guardado válido/inválido, `pt-PT`/`en-GB`/`es-MX`, `fr` → `pt`, armazenamento que lança); provedor (troca re-renderiza, grava, `lang`, anúncio); seletor (teclado completo, foco devolvido, `aria-checked`).
- **Catálogos**: chaves idênticas (tipo) + nenhum vazio + fallback `pt` para vazio + prova `sem-texto-solto`.
- **Conteúdo intacto**: suíte UI que renderiza Baralho/Cartões/Tags/Nome de usuário com textos que coincidem com rótulos e verifica igualdade exata nos três idiomas (FR-006, SC-003).
- **Troca preserva estado**: formulário preenchido, Sessão no meio, filtro aplicado, recusa visível que muda de idioma (FR-004, FR-015) e resposta que chega depois da troca (FR-016).
- **Seam do cliente**: mesmas `Recusa` em `ClienteHttp` (contra servidor de teste) e `ClienteEmMemoria`; código desconhecido → `indisponivel`.
- **Backend**: `recusas.test` (todo código, ASCII, sem português); rotas devolvem `erro`/`motivo`/`limite`; Anki com códigos; `Acervo` grava `""` nas origens derivadas; migração 19 sobre dados v18 nos dois adapters.
- **E2E** `idioma-da-interface.spec.ts`: detecção EN/ES/fallback, troca por teclado antes e depois de Entrar, persistência após recarregar, recusa do servidor traduzida, Histórico com rótulos derivados, layout 360/1280 px em EN e ES.

## Project Structure

### Documentation (this feature)

```text
specs/027-idioma-da-interface/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http.md
│   └── ui.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks
```

### Source Code (repository root)

```text
frontend/
├── index.html                         # lang inicial; atualizado em execução
├── vitest.setup.ts                    # navigator.languages = ["pt-BR"]
├── src/
│   ├── idioma/                        # NOVO: tipos, pt/en/es, resolver, ProvedorDeIdioma, SeletorDeIdioma
│   ├── main.tsx                       # envolve Aplicacao no ProvedorDeIdioma
│   ├── acervo-cliente/                # cliente.ts, cliente-http.ts, cliente-em-memoria.ts, validacao.ts → Recusa
│   └── ui/                            # 36 arquivos: textos para o catálogo; Moldura e cabeçalho sem Credencial ganham o Seletor
└── tests/                             # novas provas idioma-*, recusas, conteúdo intacto; provas existentes inalteradas
backend/src/
├── http/recusas.ts                    # NOVO: MENSAGENS_TECNICAS (inglês)
├── http/rotas.ts, http/credencial.ts  # usam recusas.ts; campo limite
├── acervo/invariantes.ts, identidade/invariantes.ts, acervo/acervo.ts
├── importacao/anki.ts                 # erros com código
└── armazenamento/{sqlite,postgresql}/migracoes.ts   # migração 19
e2e/
├── playwright.config.ts               # locale: 'pt-BR'
└── idioma-da-interface.spec.ts        # NOVO
```

**Structure Decision**: aplicação web existente (`frontend/`, `backend/`, `e2e/`). Um Module novo no frontend e um arquivo novo no backend. Nenhuma mudança de infraestrutura.

## Complexity Tracking

Nenhuma violação a justificar.
