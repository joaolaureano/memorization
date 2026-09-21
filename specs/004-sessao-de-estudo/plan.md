# Implementation Plan: Sessão de Estudo

**Branch**: `main` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

## Summary

Entrega o Module profundo `SessaoDeEstudo`: recebe Cartões de um Baralho
elegível, seleciona ordem sem repetição, controla Revelação e Resultado e deriva
o Resumo, tudo sem persistir estado.

## Technical Context

TypeScript estrito, React 19/Vite, Testing Library e Playwright, herdados. O
frontend usa o `ClienteDoAcervo` existente; SQLite e Fastify não são alterados.

## Constitution Check

Todos os princípios passam: linguagem canônica; Interface como superfície de
teste; Seam existente de `Aleatoriedade` com Adapters real e determinístico;
sem nova dependência, armazenamento, rota ou segredo. ADRs e Design It Twice
são inaplicáveis pela constituição 2.1.0.

## Modules e Interfaces

`SessaoDeEstudo` é o único Module alterado. A Interface definida no contrato
esconde seleção, cópia de conteúdo, máquina de estados e derivação do Resumo.
Isso dá Leverage às telas e Locality às invariantes; removê-lo faria regras
reaparecerem em cada ação de UI.

`Aleatoriedade` é a única Seam usada. Não há Adapter de persistência ou HTTP
para a Sessão: seria uma Seam hipotética e contrariaria FR-038.

## Acessibilidade e responsividade

Revelar e registrar Resultado são ações de teclado. O foco avança para o novo
conteúdo, não depende só de cor, e mudanças são anunciadas. Telas em português
se mantêm utilizáveis em telefone.

## Project Structure

```text
frontend/src/sessao-de-estudo/  # Module e testes
frontend/src/ui/                # telas de início, Item e Resumo
e2e/                            # fluxo real e viewport estreito
```

## Complexity Tracking

Nenhuma violação a justificar.

