# Phase 0 — Research: Sessão de Estudo

## Estado inteiramente efêmero

**Decisão**: `SessaoDeEstudo` vive apenas no frontend. O backend fornece o
acervo no início; não existe rota, tabela ou migração de Sessão.

**Rationale**: FR-038 e FR-039 exigem ausência de persistência e descarte a
qualquer interrupção. Levar a Sessão ao servidor acrescentaria estado sem
consumidor e criaria risco de violar a regra por acidente.

## Ordem determinada uma vez

A seleção sem repetição e a randomização ocorrem no início; a ordem resultante
é guardada até o Resumo. Isso satisfaz FR-030 e FR-031 sem re-randomizar ao
avançar.

## Aleatoriedade

A Seam existente `Aleatoriedade` mantém Adapter real e Adapter determinístico.
Não há Seam nova: o Adapter determinístico prova ordem imutável, ausência de
repetição e limites sem testes probabilísticos frágeis.

## Omissões deliberadas

| Omitido | Por quê |
|---|---|
| Tabela, rota ou log de Sessão | Violariam FR-038 |
| Histórico e métricas acumuladas | Fora da spec |
| Repetição espaçada | Exige memória entre Sessões |
| Correção automática | Resultado é autoavaliação |

