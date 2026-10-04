# Implementation Plan: 020 — refinamento da UI
**Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

## Summary
Executar o plano autorizado nas Interfaces existentes. Reduzir apresentação e remover a operação de renomeação, sem novo Module, Seam ou migração.

## Technical Context
TypeScript, React 19/Vite no frontend; Fastify e Zod no backend Node >=24.
Armazenamento SQLite/PostgreSQL existentes. Vitest para Interfaces, Playwright para navegador e fluxo real.
Plataformas: navegador responsivo, servidor local e Lambda. Escala e metas de desempenho vigentes; nenhuma ampliação. Remover leitura de Registros do Início.
Escopo: login, Início, Agenda/Rotinas, Perfil, clientes e conta.

## Constitution Check
Pré-design: intenção explícita do PO; spec/clarify completos; histórico preservado; domínio inalterado.
Pós-design: Interfaces reduzidas, Adapters mantidos, testes na mesma Seam dos callers, nenhum novo armazenamento.
Checklist sem reprovação e analyze sem CRITICAL são obrigatórios antes dos workers.
Código sob backend/frontend/e2e pertence exclusivamente a DeepSeek; Arquiteto revisa diff e executa verificar:ci.
Nenhum commit/push será feito com falha. Registro append-only em research.md.

## Project Structure
- frontend/src/ui/{PaginaDeEntrada,CampoDeSenha,PaginaDeInicio,AgendaDeEstudo,PaginaDePreferencias,SecaoMinhaConta,Aplicacao,Moldura}.tsx
- frontend/src/acervo-cliente/{cliente,cliente-http,cliente-em-memoria}.ts e ui/guarda-de-credencial.ts
- frontend/src/estilos.css e testes existentes de UI/clientes
- backend/src/identidade/identidade.ts
- backend/src/armazenamento/{porta,sqlite/armazenamento,postgresql/armazenamento}.ts
- backend/src/http/{rotas,servidor}.ts, entradas e registros Lambda pertinentes
- backend/tests/{identidade,armazenamento,http,funcao}, e2e/
- specs/020-refinamento-ui/: spec, plan, research, data-model, contracts, quickstart, checklists, tasks, prototipos

## Design
A Interface ClienteDoAcervo perde somente alterarNomeDeUsuario e tipos/erros exclusivos. Guarda e Adapters HTTP/em memória acompanham.
Module Identidade e Interface Armazenamento perdem renomeação; validação/unicidade de cadastro permanecem.
Registro compartilhado de rotas perde PUT /conta/nome-de-usuario e preflight explícito; não criar handler 404 especial.
Início usa leitura existente de Cartões para distinguir vazio; não consultar Registros nem mostrar carga/falha do resumo removido. Não inventar vazio em falha.
CSS usa classe própria do Início para coluna e tamanho específico para checkbox; não reduzir radio.
Não modificar docs históricos: protótipos atuais ficam em 020; design ativo pode refletir novo comportamento.

## Delivery and verification
Workers em escopos disjuntos: backend; frontend; depois E2E/protótipo.
Cada worker recebe FRs, arquivos autorizados e testes; nenhuma decisão de produto é delegada.
Arquiteto revisa diff completo e resultados, cobre paridade local/Lambda, SQLite/PostgreSQL e clientes.
Concluir com inspeção visual 360/390/768/1440, zoom 200%, teclado, e rtk npm run verificar:ci.
