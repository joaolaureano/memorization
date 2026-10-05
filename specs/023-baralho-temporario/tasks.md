# Tasks: Baralho temporário para um estudo

**Input**: `spec.md` (com Clarifications de 2026-10-05), `plan.md`, `data-model.md`, `contracts/` e protótipos em `design/baralho-temporario/`.

**Testes**: obrigatórios (Princípios V e IX); cada tarefa traz suas provas.

**Execução**: cada tarefa é delegada a DeepSeek flash em pedidos curtos, com os tipos relevantes no prompt (Princípio XI); o Arquiteto aplica, revisa e verifica.

## Phase 1: Setup

Sem tarefas: nenhuma dependência nova.

## Phase 2: Foundational (bloqueia as histórias)

- [X] T2301 Migração 11 conforme contracts/migracao.md em backend/src/armazenamento/sqlite/migracoes.ts (reconstrução de `registro_de_sessao` e `item_de_registro` na ordem filho → pai, com índices) e backend/src/armazenamento/postgresql/migracoes.ts (troca de `registro_de_sessao_origem_check`); provas: base na versão 10 com Registros e Itens chega à 11 preservando contagens e valores; FK e cascata por Usuário intactas; `temporario` aceito e outro valor recusado (SQLite e PostgreSQL); ajustar as provas que fixam a última versão em 10. FR-369.
- [X] T2302 Origem `temporario` no Registro: tipo `origem` na Porta e no Acervo, `interpretarRegistro` com «`baralhoId` vira `""` e `nomeDoBaralho` vira `"Baralho temporário"`, derivados», validação HTTP de `POST /sessoes`; provas no Acervo (Registro, Agendamentos, idempotência) e no HTTP (201, origem devolvida em `GET /sessoes/:id` e nas Estatísticas). FR-369, FR-376.
- [X] T2303 Porta `inserirBaralhoComVinculos(usuarioId, baralho, cartaoIds)` em backend/src/armazenamento/porta.ts e nos Adapters SQLite e PostgreSQL, numa transação: id do mesmo dono → devolve o existente (`novo: false`); id de outro dono → `conflito`; algum Cartão inexistente ou alheio → `cartoes_indisponiveis` com os ids, sem gravar nada; prova na bateria da Porta (backend/tests/armazenamento/bateria-da-porta.ts). FR-372, FR-373.
- [X] T2304 `Acervo.salvarSelecaoComoBaralho({ id, nome, cartaoIds })` e rota `POST /baralhos/de-selecao` conforme contracts/http.md («`cartaoIds`: de 1 a 1.000 strings não vazias e sem repetição»; nome pelas regras de Baralho), com CORS; provas no Acervo e no HTTP: 201, 200 no reenvio, 400 por nome e por dados, 409 por indisponíveis e por conflito, isolamento entre Usuários. FR-371–FR-374, SC-146, SC-149.
- [ ] T2305 Cliente: `origem` aceita `"temporario"` (cliente.ts, leitura em cliente-http.ts, cliente-em-memoria.ts); novo `salvarSelecaoComoBaralho` nos dois Adapters e em guarda-de-credencial.ts, com resultados `ok` (`baralho`), `nome_vazio`/`nome_muito_longo`/`dados_invalidos` (mensagem), `cartoes_indisponiveis` (`cartaoIds`), `conflito` e `indisponivel`; provas em frontend/tests/acervo-cliente/. FR-369, FR-371–FR-374.
- [ ] T2306 [P] Module puro frontend/src/sessao-de-estudo/selecao-temporaria.ts (`adicionarCartoes`, `removerCartao`, `limparSelecao`, `podeIniciar` → `vazia` | `acima-do-limite` | `ok`, `indisponiveis`) com provas em frontend/tests/selecao-temporaria.test.ts: união A={C1,C2} e B={C2,C3} mais C4 dá 4 únicos; repetir a adição acrescenta só os ausentes; limite de 1.000; disponibilidade. FR-363–FR-365, SC-143.

## Phase 3: User Story 1 — Montar um estudo (P1)

**Goal**: montar e conferir a seleção. **Independent Test**: dois Baralhos que compartilham um Cartão mais um avulso dão seleção única.

- [ ] T2307 [US1] Rotas `#/baralhos/temporario` e `#/baralhos/temporario/estudo` em frontend/src/ui/navegacao.ts (antes de `#/baralhos/:id`, destino Baralhos) e na casca frontend/src/ui/Aplicacao.tsx (guarda os Cartões capturados; estudo sem seleção volta para Baralhos); botão «Criar baralho temporário» em PaginaDeBaralhos.tsx conforme contracts/ui.md; provas de rota, destino ativo e botão (ordem Criar baralho → Criar baralho temporário). FR-360, FR-375.
- [ ] T2308 [US1] PaginaDaSelecaoTemporaria.tsx conforme contracts/ui.md (fontes com busca e filtros da 022, seleção, Estudar com releitura e indisponíveis, Cancelar, proteção de descarte) e o CSS de contracts/ui.md em estilos.css; provas pelo DOM: seleção vazia; união sem duplicar; avulso vinculado e sem vínculo; filtros não alteram a seleção; Remover e Limpar; limite; indisponível antes do início; Baralho de origem excluído depois da adição não invalida a seleção se os Cartões existem; Baralho vazio mostra «Sem cartões» e não acrescenta nada; Estudar entrega os Cartões com textos atuais; descarte. FR-360–FR-367, FR-375, FR-377, SC-143, SC-144.

## Phase 4: User Story 2 — Estudar e registrar (P1)

**Goal**: Sessão com todos embaralhados e Registro temporário. **Independent Test**: 3 Cartões estudados geram um Registro e Agendamentos.

- [ ] T2309 [US2] Variante `selecaoTemporaria` em PaginaDeEstudo.tsx: início imediato com todos embaralhados; h1 «Estudar baralho temporário»; registro com `origem: "temporario"`; Resumo com o texto secundário «Estudo com baralho temporário», «Salvar como baralho» (desabilitado com motivo até registrar) e «Voltar para Baralhos»; provas: todos uma vez, ordem fixa, Registro com origem temporária, falha e nova tentativa sem duplicar, interrupção sem Registro. FR-366, FR-368–FR-370, FR-375, SC-145.
- [ ] T2310 [US2] Histórico: PaginaDoRegistro.tsx e EstatisticasDoEstudo.tsx nomeiam a origem `temporario` como «Estudo com baralho temporário», sem selo nem link de Baralho; provas. FR-376.

## Phase 5: User Story 3 — Salvar depois de estudar (P1)

**Goal**: salvar a seleção como Baralho. **Independent Test**: salvar com nome válido cria um único Baralho com os mesmos Cartões.

- [ ] T2311 [US3] SalvarSelecaoComoBaralho.tsx, integrado ao Resumo temporário, conforme contracts/ui.md: nome com contador; contagem a vincular; id estável por percurso; erros de nome; falha com nova tentativa; indisponíveis com «Retirar indisponíveis»; Cancelar; sucesso com «Baralho salvo.» e «Abrir baralho»; focos. Provas pelo DOM. FR-370–FR-374, SC-146, SC-147.

## Phase 6: Polish & Cross-Cutting

- [ ] T2312 E2E com API real em e2e/baralho-temporario.spec.ts: percurso completo de SC-143 (A, B, C4), Registro no Histórico, salvar com um único Baralho e fontes intactas, sair sem salvar sem Baralho novo, indisponível antes de salvar, isolamento. SC-143–SC-147, SC-149.
- [ ] T2313 Responsividade e teclado em e2e/baralho-temporario-responsividade.spec.ts: montagem, Sessão, Resumo e Salvar em 360, 390, 768 e 1440 px e zoom de 200%, sem rolagem horizontal, alvos de 44 px, percurso por teclado. SC-148, FR-377.
- [ ] T2314 Ajustar provas e2e existentes afetadas, atualizar os READMEs, rodar `npm run verificar:ci` e registrar em research.md.

## Dependencies

- T2301 → T2302 → T2304; T2303 → T2304; T2304 → T2305.
- T2306 independente. T2307 depende de T2306; T2308 de T2306 e T2307.
- T2309 depende de T2305 e T2307; T2310 de T2305; T2311 de T2309.
- T2312–T2314 por último.

## Implementation Strategy

Backend primeiro (T2301–T2304), depois o cliente (T2305) e o Module (T2306), e então as três histórias em ordem. Cada tarefa é um commit coeso após revisão e verificação.

## Rastreabilidade

| Requisito | Tarefas |
|---|---|
| FR-360 | T2307, T2308 |
| FR-361–FR-364 | T2306, T2308 |
| FR-365 | T2306, T2308 |
| FR-366 | T2309 |
| FR-367 | T2306, T2308 |
| FR-368 | T2309 |
| FR-369 | T2301, T2302, T2305, T2309 |
| FR-370 | T2309, T2311 |
| FR-371–FR-374 | T2303, T2304, T2305, T2311 |
| FR-375 | T2307, T2308, T2309 |
| FR-376 | T2302, T2310 |
| FR-377 | T2308, T2313 |
| SC-143–SC-149 | T2306, T2308, T2309, T2311, T2312, T2313 |
