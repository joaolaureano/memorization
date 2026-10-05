# Implementation Plan: Busca e filtros no acervo

**Branch**: `022-busca-e-filtros-no-acervo` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: `spec.md`, protótipos em [`design/busca-e-filtros/`](../../design/busca-e-filtros/) e [`prototipos.md`](prototipos.md).

## Summary

As listagens de Baralhos e Cartões ganham busca e, em Cartões, os filtros por Baralho e por situação da revisão, com contagem, Limpar filtros e o estado «Nenhum resultado encontrado», seguindo os protótipos. A consulta acontece no navegador, sobre as listas que as páginas já leem. A única mudança de contrato é um campo derivado em `GET /cartoes`: `proximaRevisaoEm`, a data do Agendamento do Cartão ou `null`, de onde o navegador classifica a situação no calendário local.

## Technical Context

**Language/Version**: TypeScript em Node 24 (backend) e React 19 + Vite (frontend).

**Primary Dependencies**: Fastify e Zod (backend); React (frontend). Nenhuma dependência nova.

**Storage**: SQLite (local) e PostgreSQL/Neon (nuvem). Sem migração: o Agendamento já existe e é só lido.

**Testing**: Vitest nos dois pacotes, inclusive a suíte PostgreSQL; Playwright no e2e.

**Target Platform**: navegador (SPA) e Lambda/servidor Node.

**Project Type**: aplicação web (backend + frontend + e2e).

**Performance Goals**: filtrar em memória a lista já carregada, sem nova requisição por tecla; `GET /cartoes` lê os Agendamentos do Usuário uma única vez, e não por Cartão.

**Constraints**: pt-BR; estilo vigente (`estilos.css`); 360, 390, 768 e 1440 px e zoom de 200% sem rolagem horizontal; alvos de 44 × 44 px (spec 021).

**Scale/Scope**: as duas listagens principais. Ficam de fora as listas internas do Baralho, a tela de adicionar Cartões e a configuração das Sessões.

## Constitution Check

| Princípio | Situação |
|---|---|
| I. Spec-Driven | Spec e protótipos aprovados; esta entrega implementa o que a spec define. A premissa «esta entrega não altera APIs» era da entrega documental e é revista no registro de 2026-10-05 em `research.md`. |
| II. Auditabilidade | Decisões registradas em `research.md` (append-only); ações e verificações nas mensagens de commit. |
| III. Domínio | «Situação da revisão» é derivada do Agendamento, como em Key Entities; o código usa `situacaoDaRevisao` e os rótulos Novos, Revisão pendente e Em dia. |
| IV. Módulos profundos | Um Module puro `busca-no-acervo` concentra normalização, critérios e classificação atrás de duas funções; nenhuma Seam nova. |
| V. Interface como superfície de teste | O Module é testado pelas suas funções exportadas; as páginas, pelo DOM acessível; o contrato HTTP, por `inject`. |
| VI. Verificação | O Arquiteto revisa cada diff e executa `npm run verificar:ci`. |
| VII. Escopo mínimo | Sem paginação, filtro no servidor, persistência dos critérios nem novos estados de domínio. |
| VIII. Segredos | Nada sensível envolvido. |
| IX. Rastreabilidade | Mapa FR → tarefa → teste em `tasks.md`. |
| X. Portões | `analyze` sem CRITICAL e checklist aprovado antes de `implement`. |
| XI. Delegação | Todo código sob `backend/`, `frontend/` e `e2e/` é escrito por subagentes DeepSeek (flash), via `delegate`. |

**Resultado**: sem violações. Reavaliado após o desenho: sem mudanças.

## Desenho

### Backend — `proximaRevisaoEm` em `GET /cartoes`

- `CartaoListado` (Acervo) passa a ter `proximaRevisaoEm: string | null`: o ISO-8601 da próxima revisão do Agendamento do Cartão, ou `null` quando não há Agendamento.
- `listarCartoes` lê `armazenamento.listarAgendamentos(usuarioId)` uma vez e associa por `cartaoId`. A Porta e os Adapters não mudam.
- Isolamento (FR-359): os Agendamentos lidos são só do dono, pela mesma Porta já usada nas prévias.
- Contrato: [contracts/http.md](contracts/http.md).

### Frontend — Module `frontend/src/acervo-cliente/busca-no-acervo.ts`

Module puro, sem DOM nem relógio implícito:

- `filtrarBaralhos(baralhos, consulta)` → os Baralhos cujo nome contém a consulta normalizada, na ordem recebida.
- `filtrarCartoes(cartoes, criterios, agora)` → os Cartões que satisfazem simultaneamente consulta (Frente ou Verso), Baralho (`todos`, `sem-baralho` ou um id) e situação (`todos`, `novos`, `revisao-pendente`, `em-dia`), na ordem recebida e sem duplicar.
- `situacaoDaRevisao(proximaRevisaoEm, agora)` → `novos` quando `null`; `revisao-pendente` quando o dia local da revisão é hoje ou anterior; `em-dia` quando é futuro. As datas são comparadas pelos componentes locais de `Date`, como em `revisao/dia.ts`.
- Normalização: NFD, sem marcas diacríticas, minúsculas, consulta aparada. Consulta vazia não restringe.

Detalhes em [data-model.md](data-model.md).

### Frontend — páginas

Contrato de UI em [contracts/ui.md](contracts/ui.md), derivado do protótipo:

- **Baralhos** (`PaginaDeBaralhos.tsx`): painel `.filtros` com «Buscar baralhos»; abaixo, `.resultado-cabecalho` com a contagem e Limpar filtros; depois a lista existente.
- **Cartões** (`PaginaDeCartoes.tsx`): painel com «Buscar cartões», «Baralho» e «Situação da revisão»; mesma faixa de contagem. As opções de Baralho vêm de `listarBaralhos`, para incluir Baralhos sem Cartões, e são lidas junto com a lista. A falha de qualquer das duas leituras é falha da página, com nova tentativa que preserva os critérios.
- Estados: carregando e falha (sem contagem), acervo vazio (estado existente), «Nenhum resultado encontrado» com Limpar filtros e lista. Limpar filtros devolve o foco à busca.
- A contagem fica numa região `role="status"` com `aria-live="polite"`; o foco nunca sai da busca ao digitar.
- Exclusão de Cartão: mantém diálogo e anúncio. Os critérios permanecem, a contagem é atualizada e o foco vai ao título da página, como já fazia antes desta feature.
- CSS: `.filtros` e `.resultado-cabecalho` entram em `estilos.css`, com as mesmas regras do protótipo. As regras próprias da galeria do protótipo não entram.

### Testes

- Backend: `GET /cartoes` com e sem Agendamento e isolamento entre Usuários (SQLite e PostgreSQL pela bateria existente).
- Frontend: testes do Module (normalização, Verso, combinação, sem duplicação, Sem baralho, ontem/hoje/amanhã); testes das páginas (contagem, sem resultados, limpar, falha e nova tentativa preservando critérios, exclusão com filtros, foco).
- E2E: busca e filtros com API real; responsividade e teclado nas quatro larguras e com zoom de 200%.

## Project Structure

### Documentation (this feature)

```text
specs/022-busca-e-filtros-no-acervo/
├── spec.md
├── prototipos.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http.md
│   └── ui.md
├── checklists/
└── tasks.md
```

### Source Code

```text
backend/src/acervo/acervo.ts                         # CartaoListado + listarCartoes
backend/tests/                                       # contrato de /cartoes e listarCartoes
frontend/src/acervo-cliente/cliente.ts               # CartaoListado
frontend/src/acervo-cliente/cliente-http.ts          # leitura de proximaRevisaoEm
frontend/src/acervo-cliente/cliente-em-memoria.ts    # proximaRevisaoEm a partir dos Agendamentos
frontend/src/acervo-cliente/busca-no-acervo.ts       # novo Module puro
frontend/src/ui/PaginaDeBaralhos.tsx
frontend/src/ui/PaginaDeCartoes.tsx
frontend/src/estilos.css
frontend/tests/
e2e/
```

## Complexity Tracking

Sem violações a justificar.
