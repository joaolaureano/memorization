# Tasks: Estatísticas e Histórico de estudo

**Executor**: workers DeepSeek via Aider, em cópias isoladas (`paralelo.sh`). Dentro de cada onda, os arquivos são disjuntos. Portões ao fim de cada onda: frontend e backend (test, lint, typecheck/build) e, na onda 3, e2e.

## Onda 1 — fundações (paralelo)

- [X] T1201 [P] Porta (§1) + Acervo (§2) com invariantes e testes do Acervo (`backend/src/armazenamento/porta.ts`, `backend/src/acervo/acervo.ts`, `backend/tests/acervo/historico.test.ts`)
- [X] T1202 [P] Adapter SQLite: migração 6 + métodos (`backend/src/armazenamento/sqlite/*`)
- [X] T1203 [P] Adapter PostgreSQL: migração 6 + métodos (`backend/src/armazenamento/postgresql/*`)
- [X] T1204 [P] Cliente do frontend (§4) + guarda + testes (`frontend/src/acervo-cliente/*`, `frontend/src/ui/guarda-de-credencial.ts`, `frontend/tests/acervo-cliente/historico.test.ts`)
- [X] T1205 [P] Module `estatisticas.ts` (§5) + rotas e Moldura (§6) + testes

## Onda 2 — bordas e telas (paralelo)

- [X] T1206 [P] HTTP: rotas e registro no servidor + testes de contrato (`backend/src/http/*`, `backend/tests/http/sessoes.test.ts`)
- [X] T1207 [P] Bateria da Porta com cenários do Histórico (SQLite e PostgreSQL) + teste da migração 6
- [X] T1208 [P] `ResumoDaSessao` (§7) + registro na conclusão em `PaginaDeEstudo` (nova tentativa, proteção de descarte) + testes
- [X] T1209 [P] `PaginaDeInicio` + `PaginaDoRegistro` + testes

## Onda 3 — integração e e2e

- [X] T1210 `Aplicacao`: rotas `inicio`/`registro`; testes que esperavam Baralhos depois de Entrar passam a esperar Início
- [X] T1211 [P] e2e: specs que esperavam Baralhos depois de Entrar; nova `e2e/estatisticas-e-historico.spec.ts` (SC-071..075); `visual-e-contraste` e `percurso-por-teclado` cobrindo Início e Registro
- [X] T1212 Converge: capturas, revisão e relatório ao PO
