# Implementation Plan: Baralho temporário para um estudo

**Branch**: `023-baralho-temporario` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: `spec.md` (com a sessão de esclarecimentos de 2026-10-05), protótipos em [`design/baralho-temporario/`](../../design/baralho-temporario/) e [`prototipos.md`](prototipos.md).

## Summary

O Usuário monta uma seleção de Cartões a partir de Baralhos inteiros e de Cartões avulsos, estuda todos embaralhados numa Sessão comum e, ao concluir, pode salvar a seleção como novo Baralho. No backend, o Registro de sessão ganha a origem `temporario` e há uma rota nova que cria Baralho e Vínculos num gesto único, idempotente pelo id gerado no cliente. No frontend, entram a página de montagem e uma variante da `PaginaDeEstudo` para a seleção, com Resumo próprio e o formulário Salvar como baralho, além do botão de entrada em Baralhos.

## Technical Context

**Language/Version**: TypeScript em Node 24 (backend) e React 19 + Vite (frontend).

**Primary Dependencies**: Fastify e Zod (backend); React (frontend). Nenhuma dependência nova.

**Storage**: SQLite (local) e PostgreSQL/Neon (nuvem). Migração 11: `origem` passa a aceitar `temporario`.

**Testing**: Vitest (backend, inclusive a suíte PostgreSQL; frontend); Playwright (e2e).

**Target Platform**: SPA no navegador; API em Lambda ou servidor Node.

**Project Type**: aplicação web (backend + frontend + e2e).

**Performance Goals**: montar e filtrar em memória sobre as listas já lidas (`listarBaralhos`, `listarCartoes`); salvar faz uma transação por gesto.

**Constraints**: 1 a 1.000 Cartões por seleção (limite do Registro); pt-BR; 360, 390, 768 e 1440 px e zoom de 200%; alvos de 44 × 44 px; padrões vigentes da interface (sem links de voltar, sem sobretítulos, confirmação de registro só anunciada).

**Scale/Scope**: uma rota nova de API, uma página nova, uma variante de Sessão e Resumo, uma migração.

## Constitution Check

| Princípio | Situação |
|---|---|
| I. Spec-Driven | Spec e esclarecimentos aprovados; protótipos como referência visual. A premissa «APIs serão definidas depois» é resolvida por este plano. |
| II. Auditabilidade | Decisões em `research.md` (append-only); ações e verificações em commits. |
| III. Domínio | Termos de Key Entities: Baralho temporário, Cartão avulso na seleção, Salvar como baralho. Valor de domínio `temporario` para a origem. |
| IV. Módulos profundos | Regras da seleção num Module puro `selecao-temporaria` (união sem duplicar, limites, disponibilidade); a criação atômica fica escondida na Porta, atrás de um método. Nenhuma Seam nova além dos dois Adapters de armazenamento existentes. |
| V. Interface como superfície | Testes pelas funções do Module, pelo `Acervo`, por `inject` no HTTP e pelo DOM acessível. |
| VI. Verificação | O Arquiteto revisa cada diff e roda `npm run verificar:ci`. |
| VII. Escopo mínimo | Sem retomada após recarga, sem salvar antes do estudo, sem Agenda, sem edição em lote. |
| VIII. Segredos | Nada sensível. |
| IX. Rastreabilidade | FR → tarefa → prova em `tasks.md`. |
| X. Portões | Checklist e analyze antes de implementar. |
| XI. Delegação | Todo código delegado a DeepSeek flash, em pedidos curtos com tipos no prompt; o Arquiteto aplica, revisa e verifica. |

**Resultado**: sem violações.

## Desenho

### Backend

1. **Origem `temporario`** (FR-369, FR-376): `interpretarRegistro` aceita `origem: "temporario"`; como na revisão, `baralhoId` vira `""` e `nomeDoBaralho` vira `"Baralho temporário"` (derivados, ignorando o cliente). Itens: 1 a 1.000. Agendamentos pelas regras do estudo livre, no mesmo `inserirRegistroEAgendamentos` (idempotente pelo id do Registro).
2. **Migração 11** (contrato em [contracts/migracao.md](contracts/migracao.md)):
   - PostgreSQL: troca a constraint de `origem` por uma que inclui `temporario`.
   - SQLite: reconstrói `registro_de_sessao` e `item_de_registro` (copiar para tabelas novas, remover as antigas na ordem filho → pai e renomear), preservando linhas, índices e chaves. Prova de que nenhuma linha se perde.
3. **Salvar seleção como Baralho** (FR-371–FR-374): `POST /baralhos/de-selecao` com `{ id, nome, cartaoIds }` (contrato em [contracts/http.md](contracts/http.md)). No `Acervo`: `salvarSelecaoComoBaralho`, que valida o nome com as regras de Baralho e `cartaoIds` (1 a 1.000, sem repetição e não vazios). Na Porta: `inserirBaralhoComVinculos(usuarioId, baralho, cartaoIds)` numa transação, nos dois Adapters:
   - id já usado pelo dono → devolve o Baralho existente (idempotência);
   - id de outro dono → `conflito`;
   - algum Cartão inexistente ou alheio → `cartoes_indisponiveis` com os ids indisponíveis, sem gravar nada.
4. CORS: a rota nova entra na lista de caminhos.

### Frontend

1. **Module puro `frontend/src/sessao-de-estudo/selecao-temporaria.ts`**: `adicionarCartoes(selecao, ids)` (união na ordem de inclusão, sem repetir), `removerCartao`, `limparSelecao`, `podeIniciar(selecao)` → `vazia` | `acima-do-limite` | `ok`, e `indisponiveis(selecao, cartoesAtuais)`.
2. **Cliente**: `origem` aceita `"temporario"`; novo `salvarSelecaoComoBaralho({ id, nome, cartaoIds })` nos dois Adapters (Http e EmMemoria) e na guarda de Credencial.
3. **Rotas**: `#/baralhos/temporario` (montagem) e `#/baralhos/temporario/estudo` (Sessão), interpretadas antes de `#/baralhos/:id` e marcando Baralhos como destino ativo. A casca guarda em memória os Cartões capturados ao iniciar; recarregar o estudo volta para Baralhos, como na Agenda.
4. **Baralhos**: botão «Criar baralho temporário» (`botao--secundario`) logo depois de «Criar baralho», no mesmo grupo de ações do cabeçalho (FR-360).
5. **`PaginaDaSelecaoTemporaria`** (FR-361–FR-367, FR-375, FR-377), conforme [contracts/ui.md](contracts/ui.md):
   - alternância Adicionar baralhos / Adicionar cartões, com busca e filtros da 022 via `busca-no-acervo`;
   - painel «Seleção do estudo» com contagem, Remover e Limpar seleção;
   - Estudar relê os Cartões; se algum sumiu, recusa com a contagem de indisponíveis e «Retirar indisponíveis», preservando a seleção. Se nada sumiu, captura os textos e entrega à casca;
   - saída com seleção preenchida passa pela confirmação de descarte.
6. **`PaginaDeEstudo` com `selecaoTemporaria`** (FR-366, FR-368–FR-370):
   - começa direto com `SessaoDeEstudo.iniciar("", n, cartoes)` (todos, embaralhados);
   - durante a Sessão, h1 «Estudar baralho temporário»; registra com `origem: "temporario"`;
   - Resumo: h1 «Sessão concluída» com o texto secundário «Estudo com baralho temporário», ações Salvar como baralho e Voltar para Baralhos, sem Estudar novamente;
   - Salvar fica indisponível, com o motivo visível, enquanto o Registro não for confirmado; a confirmação do registro só é anunciada.
7. **`SalvarSelecaoComoBaralho`** (FR-371–FR-374): formulário do contrato de UI.
   - o id do novo Baralho é gerado uma vez por percurso e reenviado nas novas tentativas;
   - em `cartoes_indisponiveis`, informa a quantidade e oferece «Retirar indisponíveis»;
   - no sucesso, volta ao Resumo com «Baralho salvo.» e Abrir baralho no lugar de Salvar;
   - Cancelar volta ao Resumo.
8. **Histórico**: `PaginaDoRegistro` e `EstatisticasDoEstudo` nomeiam a origem `temporario` como «Estudo com baralho temporário», sem selo de Baralho excluído e sem link (FR-376).

### Testes

- **Backend**: `interpretarRegistro` com `temporario`; migração 11 nos dois bancos, com dados preservados; `inserirBaralhoComVinculos` na bateria da Porta (atomicidade, idempotência, Cartões alheios); HTTP de `POST /baralhos/de-selecao`; Estatísticas e Histórico com a nova origem.
- **Frontend**: Module da seleção; cliente (contrato aceito e recusado); montagem, Sessão, Resumo e Salvar pelo DOM; rotas.
- **E2E**: percurso completo com API real; responsividade e teclado.

## Project Structure

```text
specs/023-baralho-temporario/
├── spec.md · prototipos.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (http.md · ui.md · migracao.md)
├── checklists/
└── tasks.md

backend/src/acervo/acervo.ts
backend/src/armazenamento/porta.ts
backend/src/armazenamento/sqlite/{migracoes.ts,armazenamento.ts}
backend/src/armazenamento/postgresql/{migracoes.ts,armazenamento.ts}
backend/src/http/{rotas.ts,servidor.ts}
frontend/src/sessao-de-estudo/selecao-temporaria.ts          (novo)
frontend/src/acervo-cliente/{cliente.ts,cliente-http.ts,cliente-em-memoria.ts}
frontend/src/ui/{navegacao.ts,Aplicacao.tsx,guarda-de-credencial.ts}
frontend/src/ui/PaginaDeBaralhos.tsx
frontend/src/ui/PaginaDaSelecaoTemporaria.tsx                (novo)
frontend/src/ui/PaginaDeEstudo.tsx
frontend/src/ui/SalvarSelecaoComoBaralho.tsx                 (novo)
frontend/src/ui/{PaginaDoRegistro.tsx,EstatisticasDoEstudo.tsx}
frontend/src/estilos.css
```

## Complexity Tracking

Sem violações. A reconstrução de tabelas no SQLite é a única operação delicada e tem prova dedicada.
