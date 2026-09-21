# Implementation Plan: Editar Cartão e Baralho

**Branch**: main | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

## Summary

Amplia o Module Acervo com atualização de Cartão e Baralho e o ClienteDoAcervo
com operações assíncronas equivalentes. A Interface esconde validação,
preservação de Vínculos e tradução de falha.

## Constitution Check

PASS: sem novo termo, Module, Seam, Adapter, tabela, migração, dependência ou
segredo. Os dois Adapters do ClienteDoAcervo mantêm a Seam real. ADRs e Design
It Twice são inaplicáveis.

## Interface

editarCartao(id, frente, verso) retorna Cartão ou erro.
renomearBaralho(id, nome) retorna Baralho ou erro.

A Interface reaplica as regras da criação e preserva Vínculos. Estado sujo e
diálogo de descarte pertencem à UI, não ao domínio.

## Estrutura

backend/src/acervo/, backend/src/http/, frontend/src/acervo-cliente/,
frontend/src/ui/ e e2e/.

## Complexity Tracking

Nenhuma violação a justificar.

