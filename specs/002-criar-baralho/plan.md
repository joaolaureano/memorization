# Implementation Plan: Criar Baralho

**Branch**: `002-criar-baralho` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Depende de**: [`001-criar-cartao`](../001-criar-cartao/plan.md) — fundação de
projeto, Module `Acervo`, Seam `ClienteDoAcervo`, Adapter HTTP.

## Summary

Segunda feature. Acrescenta o Baralho ao acervo: criar, listar, e expor a
elegibilidade como valor derivado.

O escopo é estreito — **apenas Baralho**. Não há Vínculo, não há Cartão dentro
de Baralho, não há Sessão. Nesta feature todo Baralho é legitimamente **não
elegível**, porque não existe Vínculo algum; isso é estado correto, não
pendência.

O que esta feature traz de estruturalmente novo é a **migração de esquema**: a
`001` deixou base instalada, e acrescentar tabela deixa de ser operação livre.

## Technical Context

Stack, runtime, driver, build e testes herdados de `001` e **não reabertos**:
TypeScript estrito sobre Node 24+, Fastify, `node:sqlite`, Zod nas bordas,
Vitest, Testing Library, Playwright. Ver
[`../001-criar-cartao/research.md`](../001-criar-cartao/research.md).

**Novo nesta feature**: migração versionada de esquema. Ver
[research.md](./research.md).

**Scale/Scope**: 15 requisitos funcionais, 5 critérios de sucesso, 1 história.
Duas telas: lista de Baralhos e criação de Baralho.

## Constitution Check

*GATE: antes da Phase 0 e revisto após a Phase 1.*

| Princípio | Veredito |
|---|---|
| I — Spec-Driven | **PASS**. Deriva apenas de `spec.md` desta feature |
| II — Auditabilidade | **PASS**. Registrado em `SESSION.md` com banner SPEC KIT |
| III — Domínio antes de tecnologia | **PASS**. Identificadores usam `Baralho`, `nome`. `deck` é proibido em módulo, tipo, função, tabela, coluna e rota |
| IV — Módulos profundos | **PASS**. Nenhum Module novo: o `Acervo` cresce em duas operações. Nenhuma Seam nova |
| V — Interface é a superfície de teste | **PASS**. `Acervo` testado pela Interface com SQLite em memória |
| VI — Verificação sobre afirmação | **PASS**. Todo diff de worker é inspecionado |
| VII — Escopo mínimo | **PASS**. Complexity Tracking vazio. A migração é requisito, não antecipação |
| VIII — Segredos fora do repositório | **PASS por vacuidade verificada**. Sem credencial nesta feature |
| IX — Rastreabilidade | **PASS condicionado**. Matriz produzida em `tasks.md` |
| X — Portões de qualidade | **PASS até aqui**. `analyze` executado ao final desta etapa |
| XI — Delegação de código | **PASS**. Todo código sob `backend/` e `frontend/` será criado por subagentes DeepSeek |

**Processos removidos**: ADRs e Design It Twice são inaplicáveis pela
constituição 2.0.0. Nenhuma ADR criada.

### Re-avaliação após Phase 1

**PASS, sem alteração.** O design confirmou as decisões: a ausência de `UNIQUE`
sobre `nome` é o que torna FR-012 verdadeiro por construção, e a ausência de
coluna `elegivel` mantém a verdade em um lugar só.

## Decisões de Codebase Design

### Modules — nenhum novo

O `Acervo` cresce. Sua Interface passa de duas para quatro operações:

```
criarCartao(frente, verso)   -> Cartao        (feature 001)
listarCartoes()              -> Cartao[]      (feature 001)
criarBaralho(nome)           -> Baralho       (esta feature)
listarBaralhos()             -> Baralho[]     (esta feature)
```

`listarBaralhos` devolve cada Baralho com `quantidadeDeCartoes` e `elegivel`,
**ambos derivados**. Nesta feature são sempre `0` e `false`, e passarão a variar
quando a feature `003` introduzir o Vínculo. A forma do retorno já contempla
isso para que a `003` não precise mudar o contrato.

**Invariantes garantidas pela Interface**: nome não vazio após descartar espaços
e com no máximo 100 caracteres (FR-011, FR-061); nome **sem unicidade**
(FR-012); nenhuma propriedade além de nome (FR-018); elegibilidade derivada
(FR-024).

**Modos de erro novos**: `nome_vazio`, `nome_muito_longo`.

**Ordenação**: nenhuma pré-condição entre as operações.

### Seams — nenhuma nova

A única Seam do sistema continua sendo `ClienteDoAcervo`, com `ClienteHttp` e
`ClienteEmMemoria`, justificada em `001`. A persistência permanece **Seam
interna** ao `Acervo`: `node:sqlite` é dependência *local-substitutable*, e
produção e teste usam o mesmo driver com destinos diferentes.

A migração **não** introduz Seam: é código do `Acervo`, não ponto de variação.

### Avaliação do Module `Acervo`

- **Interface menor que a complexidade que esconde?** Sim, e a margem cresceu:
  quatro operações agora escondem duas tabelas, migração versionada,
  transações, validação e derivação de elegibilidade.
- **Leverage real?** Sim. As rotas continuam finas.
- **Locality?** Sim. As regras de Baralho vivem junto das de Cartão, num lugar
  só, e a migração é interna.
- **Teste de exclusão?** Apagá-lo espalharia validação e migração pelas rotas.
- **Testes na Interface?** Sim, com SQLite em memória. A migração é testada
  aplicando a versão 1 e depois a 2, asseverando o resultado observável.
- **Seam especulativa?** Nenhuma criada.

## Acessibilidade e Responsividade

FR-042, FR-058, FR-059, FR-060 e SC-018. Critérios de aceitação pela seção
*Critérios de Qualidade* da constituição.

Campo e ação de criar alcançáveis por teclado; indicador de foco que não depende
de cor; numa recusa o foco vai ao campo a corrigir; mensagens de erro e estado
vazio anunciados por região ativa; coluna única sem rolagem horizontal em
largura de telefone.

## Validação, Erros e Segurança

Duas camadas, como em `001`: forma na borda com Zod, regra de domínio dentro do
`Acervo`. FR-023 continua satisfeito por construção.

A garantia de loopback imposta em runtime por `assegurarEscutaLocal`, criada em
`001`, **continua valendo e não é reaberta**. Consultas parametrizadas, nunca
concatenação de SQL.

## Estratégia de Testes

A Interface é a superfície. `Acervo` testado com SQLite em memória, incluindo o
caminho de migração de base na versão 1. `ClienteDoAcervo` testado contra os
dois Adapters. Tela testada com Testing Library, com as asserções de teclado,
foco e semântica. `e2e/` apenas para persistência entre execuções e
responsividade.

Comandos: `npm test`, `npm run typecheck`, `npm run build:local` e `npm run lint` em `backend/` (portões da `009`); `npm test`, `npm run build` e `npm run lint` em
`frontend/`; `npm run test:e2e` na raiz.

## Project Structure

Sem diretório novo. A feature acrescenta arquivos aos Modules existentes:

```text
backend/src/acervo/     # + regras de Baralho, + migração
backend/src/http/       # + rotas de Baralho
frontend/src/ui/        # + telas de Baralho
```

## Riscos, Alternativas e Custo de Reversão

| Decisão | Risco | Alternativa rejeitada | Custo de reversão |
|---|---|---|---|
| Migração versionada agora | Poucas linhas de infraestrutura antes de haver muitas migrações | Seguir só com `CREATE TABLE IF NOT EXISTS` | Baixo |
| Elegibilidade derivada | Custo de contagem a cada leitura | Coluna materializada | Baixo, e a escala torna o custo irrelevante |
| `listarBaralhos` já devolve `quantidadeDeCartoes` | Campo sempre 0 nesta feature | Introduzir o campo só na `003` | Baixo, e evita mudar contrato na feature seguinte |

## Complexity Tracking

> Nenhuma violação da constituição a justificar.

Nenhum Module novo, nenhuma Seam nova, nenhuma dependência nova. A migração é
exigida pela existência de base instalada, não antecipada.
