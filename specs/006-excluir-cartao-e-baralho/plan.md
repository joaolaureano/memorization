# Implementation Plan: Excluir Cartão e Baralho

**Branch**: main | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

## Summary

Amplia o Module Acervo com duas exclusões e expõe rotas DELETE. A Interface
esconde cascata de Vínculos, preservação da outra entidade e atualização da
elegibilidade. A UI adiciona confirmação acessível e honesta.

## Constitution Check

PASS: não há Module, Seam, Adapter, tabela, migração, dependência ou segredo
novo. A propriedade não-cascateante já existe no esquema e será exercida pela
Interface. ADRs e Design It Twice são inaplicáveis.

## Interface

excluirCartao(id) e excluirBaralho(id) retornam sucesso ou nao_encontrado. Não
recebem opção de cascata. A UI consulta o Baralho antes para comunicar sua
consequência real e só então chama a Interface.

## Estrutura

backend/src/acervo/, backend/src/http/, frontend/src/acervo-cliente/,
frontend/src/ui/ e e2e/.

## Complexity Tracking

Nenhuma violação a justificar.

