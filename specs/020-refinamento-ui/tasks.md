# Tasks — 020 refinamento da UI

## Setup e portões
- [x] T2001 Registrar spec/clarify/plan e contratos em specs/020-refinamento-ui/; cobre FR-327–338 e SC-131–133.
- [x] T2002 Revisar checklists e analyze em specs/020-refinamento-ui/ antes de qualquer implementação; cobre todos os FRs.

## US1 — login e controles
Teste independente: textos, status de saída, rótulos, geometria e teclado.
- [x] T2003 [US1] Ajustar frontend/src/ui/PaginaDeEntrada.tsx, CampoDeSenha.tsx, Aplicacao.tsx e frontend/src/estilos.css; adaptar testes em frontend/tests/ para FR-327–329.

## US2 — Início e Estudo
Teste independente: revisão total zero/novos/vencidos/mistura, vazio de acervo e Agenda, falhas independentes.
- [x] T2004 [US2] Simplificar frontend/src/ui/PaginaDeInicio.tsx e layout em frontend/src/estilos.css, testar em frontend/tests/; FR-330/331.
- [x] T2005 [US2] Ajustar frontend/src/ui/AgendaDeEstudo.tsx, PaginaDaAgenda.tsx e PaginaDoFormularioDeRotina.tsx, testar em frontend/tests/; FR-332–334.

## US3 — Perfil e remoção de renomeação
Teste independente: nome somente leitura, cadastro/login existentes, senha/exclusão/revogação e 404/preflight.
- [x] T2006 [US3] Ajustar Perfil em frontend/src/ui/PaginaDePreferencias.tsx, SecaoMinhaConta.tsx e Moldura.tsx; excluir FormularioDeNomeDeUsuario.tsx e estados/foco exclusivos; testes frontend/tests/; FR-335/336.
- [x] T2007 [US3] Remover renomeação de frontend/src/acervo-cliente/{cliente,cliente-http,cliente-em-memoria}.ts e frontend/src/ui/guarda-de-credencial.ts; testar clientes e resultado incerto de senha/exclusão em frontend/tests/; FR-336/337.
- [x] T2008 [P] [US3] Remover operação/tipos/erros exclusivos de backend/src/identidade/identidade.ts e backend/src/armazenamento/{porta,sqlite/armazenamento,postgresql/armazenamento}.ts; adaptar backend/tests/identidade/ e backend/tests/armazenamento/ preservando cadastro/unicidade/senha/exclusão sem migração; FR-336/337.
- [x] T2009 [US3] Remover handler/schema/registro/preflight de backend/src/http/{rotas,servidor}.ts e registros pertinentes; testar 404 autenticado/OPTIONS e paridade local/Lambda em backend/tests/http/ e backend/tests/funcao/; FR-336/337.

## Verificação transversal
- [x] T2010 Atualizar regressões e acrescentar matriz visual/teclado em e2e/ para FR-327–338, SC-131–133; após todos os workers de aplicação.
- [x] T2011 Atualizar protótipos ativos em design/ quando pertinentes e preservar históricos; revisar specs/020-refinamento-ui/prototipos.md e documentação atual; FR-327–338.
- [x] T2012 Inspecionar diff completo, capturas 360/390/768/1440, zoom 200%, teclado e resultados; executar npm run verificar:ci e registrar evidências em specs/020-refinamento-ui/research.md; todos os FRs/SCs.

## Dependencies e estratégia
T2001 → T2002 → implementação. Um worker frontend executa T2003–2007 sequencialmente (arquivos compartilhados); backend T2008–2009 em paralelo por escopo disjunto. Depois T2010 e T2011; T2012 encerra. MVP independente US1, mas entrega solicitada inclui todas as histórias. Workers não fazem commits nem alteram requisitos.

## Rastreabilidade requisito–teste
| Requisito | Tarefas/testes pela Interface |
|---|---|
| FR-327–329 | T2003/T2010: Entrar, status de Sair, CampoDeSenha e geometria E2E |
| FR-330/331 | T2004/T2010: Início, total elegível, acervo vazio/falha e layout |
| FR-332–334 | T2005/T2010/T2011: Agenda, dia vazio, ausência visual de fuso e pedidos preservados |
| FR-335 | T2006/T2010: Perfil, rota, confirmação e espaçamento |
| FR-336 | T2006–2009/T2010: ausência de formulário/operação, 404 autenticado e OPTIONS |
| FR-337 | T2007–2009/T2010: clientes/Identidade/armazenamento/HTTP/Lambda e regressões de conta |
| FR-338 | T2010/T2012: quatro larguras, zoom 200%, foco, teclado e alvos |
| SC-131–133 | T2010–2012: integração, protótipos e gate completo |
