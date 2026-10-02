# Implementation Plan: Estatísticas e Histórico de estudo

**Branch**: `012-interface-visual-navegavel` (mesma branch, por decisão do PO) | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md) | **Contratos**: [contracts/contratos.md](./contracts/contratos.md)

## Summary

A Sessão concluída é registrada no backend (idempotente pelo id gerado no cliente), com os totais e o Resultado de cada Item guardados como foto do momento. Início lê as Estatísticas, e o Resumo ganha as listas de Acertos e Erros, tanto na Sessão recém-concluída quanto em registros antigos.

## Technical Context

**Stack**: a existente. Backend Node 24 + Fastify + Porta com Adapters SQLite/PostgreSQL. Frontend React 19 + Vite. Vitest e Playwright. **Nenhuma dependência nova.**
**Storage**: migração 6 nos dois Adapters (tabelas `registro_de_sessao` e `item_de_registro`).
**Testing**:
- bateria compartilhada da Porta (SQLite e PostgreSQL), testes do Acervo e de contrato HTTP;
- testes de tela;
- e2e com API real.
**Constraints**: isolamento por Usuário (`008`), sem falso sucesso (FR-044), acessibilidade e responsividade da `012`.

## Decisões (research)

- **D1 — Histórico dentro do Acervo.** A Porta `ArmazenamentoDoAcervo` e o Module `Acervo` ganham as operações de registro. O motivo é que o Histórico é dado do Usuário, igual ao acervo, e a fiação (`acervoDe(usuarioId)`) já existe nas três entradas: local, nuvem e lambda. Uma Porta nova só traria fiação, sem segunda variação real (skill codebase-design: não criar seam hipotética).
- **D2 — Idempotência pelo id do cliente.** O cliente gera um UUID ao concluir. Reenviar devolve o registro existente (200), o que satisfaz o FR-163 sem bloqueio distribuído.
- **D3 — Instante pelo servidor.** `concluidaEm` é o instante da primeira inserção. Isso evita relógio adulterado, e numa nova tentativa a diferença é de segundos.
- **D4 — Foto do conteúdo.** Frente, Verso e nome do Baralho são copiados para o registro (FR-165). O `baralhoId` fica sem chave estrangeira, e a existência do Baralho é consultada na leitura (FR-178).
- **D5 — O dia é do navegador.** O servidor só filtra por instante (`desde`). O agrupamento por dia local e a Taxa de acerto vivem num Module puro do frontend (`estatisticas.ts`), testável sem rede nem fuso fixo.
- **D6 — Início é a tela padrão.** `ROTA_PADRAO = #/inicio`, e a Moldura ganha Início (FR-168).
- **D7 — Resumo como componente único**, `ResumoDaSessao`, usado pela Sessão recém-concluída e pelo registro aberto.
- **D8 — Execução em ondas paralelas, com arquivos disjuntos** (preferência registrada do PO). Os contratos acima são fixos, para que workers trabalhem em paralelo nas duas pontas.

## Constitution Check

Todos os princípios atendidos. A mudança no domínio está registrada em `CONTEXT.md`. Não há dependência nova. O código fica com os workers DeepSeek; o Arquiteto revisa e verifica. Sem violações.

## Estrutura

```text
backend/src/armazenamento/porta.ts            # tipos + 4 métodos (contrato §1)
backend/src/armazenamento/{sqlite,postgresql}/{migracoes,armazenamento}.ts   # migração 6 + métodos
backend/src/acervo/acervo.ts                  # registrarSessao, obterEstatisticas, obterRegistroDeSessao
backend/src/http/rotas.ts, servidor.ts        # POST /sessoes, GET /estatisticas, GET /sessoes/:id
frontend/src/acervo-cliente/*                 # cliente: 3 métodos (§4) + guarda
frontend/src/estatisticas/estatisticas.ts     # Module puro (§5)
frontend/src/ui/navegacao.ts, Moldura.tsx     # rotas inicio/registro (§6)
frontend/src/ui/ResumoDaSessao.tsx            # §7
frontend/src/ui/PaginaDeInicio.tsx, PaginaDoRegistro.tsx, PaginaDeEstudo.tsx, Aplicacao.tsx
```
