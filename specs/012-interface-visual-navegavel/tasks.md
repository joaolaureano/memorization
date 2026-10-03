# Tasks: Interface visual e navegável

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/rotas-da-interface.md`

**Depende de**: `001` a `008` já implementadas. Não há mudança em `backend/`.

**Executor**: pelo **Princípio XI**, todo código em `frontend/` e `e2e/`, incluindo
os testes, é escrito por worker DeepSeek (`deepseek-v4-flash`). O Arquiteto revisa
o diff integral e roda os portões ao fim de cada fase.

**Referência visual**: `design/prototipo-visual/` (tokens em `styles.css`, capturas
390/1440). A spec prevalece sobre o protótipo.

## Formato

`- [ ]` pendente, `- [X]` concluída. `[P]` = arquivos disjuntos, paralelizável.

**Regra de testes**: nenhum teste existente é removido sem justificativa no EVT. Um
teste que exercia comportamento substituído pela spec 012 é **reescrito** para o
comportamento novo. Exemplos: formulário embutido na lista, destino Cartões após
Entrar.

**Portões ao fim de cada fase**, rodados em `frontend/`: `npm test`, `npm run lint`
e `npm run build`. Nas fases 6 e 7 também `npm run test:e2e`, na raiz, e
`npm test` em `backend/`.

---

## Fase 1 — Fundação

- [X] T1101 [P] `estilos.css` reescrito com tokens, base, componentes e moldura, incluindo ≤600 px e `prefers-reduced-motion`
- [X] T1102 [P] `navegacao.ts` com o mapa de rotas do contrato: `ROTA_PADRAO = #/baralhos`, rotas novas e `novo` reservado
- [X] T1103 `protecao-de-saida.ts` (Provedor + `useProtecaoDeSaida` + `useRota` protegido) e seu teste
- [X] T1104 `Moldura.tsx`, `CampoDeSenha.tsx` e `EstadoDaCarga.tsx`, com testes
- [X] T1105 `Aplicacao.tsx` usando a Moldura, o despacho das rotas novas, Sair protegido e a recusa de Credencial ignorando a proteção

<details><summary>Metadados</summary>

| ID | Objetivo observável | Requisitos | Depende | Concluída quando |
|---|---|---|---|---|
| T1101 | Todas as telas usam os tokens de R1. Foco tem contorno de 3 px. Controles têm pelo menos 44 px. Texto base de 16 px | FR-135, FR-136, FR-137 | — | build verde e classes documentadas no topo do arquivo |
| T1102 | `interpretarRota` resolve cada linha do contrato. Com Credencial, hash desconhecido e `#/entrar` dão Baralhos | FR-138 | — | `navegacao.test.tsx` cobre todas as linhas do contrato |
| T1103 | Com proteção de descarte, link e Voltar do navegador abrem a confirmação. Cancelar mantém rota e hash; confirmar navega. A pendência bloqueia e anuncia o motivo | FR-148, FR-151, FR-154 | T1102 | `protecao-de-saida.test.tsx` verde |
| T1104 | A Moldura marca o destino com `aria-current` e forma. O CampoDeSenha alterna com `aria-pressed` e começa mascarado. EstadoDaCarga mostra carregando, falha com "Tentar novamente" e vazio com próximo passo | FR-139, FR-142, FR-153, FR-158 | T1101 | testes dos três verdes |
| T1105 | Depois de Entrar, a tela é Baralhos. Sair numa Sessão pede confirmação. A recusa de Credencial vai direto a Entrar | FR-138, FR-139, FR-157 | T1102–T1104 | `navegacao.test.tsx` e `recusa-por-credencial.test.tsx` verdes |

</details>

---

## Fase 2 — Acesso

- [X] T1106 [P] `PaginaDeEntrada.tsx` com o visual novo e CampoDeSenha. Os testes de Entrar foram reescritos para o destino Baralhos
- [X] T1107 [P] `PaginaDeCadastro.tsx` com o visual novo, CampoDeSenha para Senha e Confirmação, sucesso com acesso a Entrar e proteção de descarte

<details><summary>Metadados</summary>

| ID | Objetivo observável | Requisitos | Depende | Concluída quando |
|---|---|---|---|---|
| T1106 | Senha mascarada e alternável. Falha preserva os campos e foca o pertinente. Pendência desabilita o envio | FR-141, FR-142, FR-153–155 | T1105 | `pagina-de-entrada`, `teclado-e-foco` e `leitor-de-tela` verdes |
| T1107 | Cadastro sujo pede confirmação ao sair. Sucesso não entra automaticamente. Falha preserva os campos | FR-141–143, FR-148 | T1105 | testes de Cadastro (página, teclado, leitor) verdes |

</details>

---

## Fase 3 — Baralhos

- [X] T1108 [P] `PaginaDeBaralhos.tsx` só com a lista (nome, quantidade de Cartões, Estudar, Criar baralho) e estados vazio, carregando e falha
- [X] T1109 [P] `PaginaDoFormularioDeBaralho.tsx` para criar e renomear em página própria, com limite, validação, descarte e pendência
- [X] T1110 `PaginaDoBaralho.tsx` com o detalhe: Estudar no topo, Cartões presentes, Remover deste baralho sem confirmação, Renomear e Excluir com confirmação
- [X] T1111 `PaginaDeAdicionarCartoes.tsx`, que lista só os não vinculados, explica quando não há opções e vincula

<details><summary>Metadados</summary>

| ID | Objetivo observável | Requisitos | Depende | Concluída quando |
|---|---|---|---|---|
| T1108 | Estudar fica indisponível, com nome acessível explicativo, quando o Baralho não tem Cartões. O vazio orienta criar o primeiro Baralho | FR-144, FR-153 | Fase 1 | `pagina-de-baralhos`, `teclado-e-foco-de-baralhos` e `leitor-de-tela-de-baralhos` verdes |
| T1109 | Salvar com sucesso volta à origem. Validação recusada foca o campo. Sair sujo pede confirmação | FR-140, FR-141, FR-148, FR-154, FR-155 | Fase 1 | teste novo do formulário + `renomear-e-excluir-baralho` verdes |
| T1110 | Remover desfaz só o Vínculo. Excluir mostra o alvo e preserva os Cartões. Id inválido mostra "não encontrado" | FR-145, FR-147, FR-156 | T1108 | `pagina-do-baralho` e testes de Vínculos verdes |
| T1111 | Os já vinculados não aparecem. Sem opções, explica e oferece criar Cartão | FR-145 | T1110 | teste novo verde |

</details>

---

## Fase 4 — Cartões

- [X] T1112 [P] `PaginaDeCartoes.tsx` só com a lista (Frente, Verso, Baralhos em que está, Criar cartão, Editar, Excluir com confirmação)
- [X] T1113 [P] `PaginaDoFormularioDeCartao.tsx` para criar e editar em página própria, com o aviso dos Baralhos afetados, descarte e pendência

<details><summary>Metadados</summary>

| ID | Objetivo observável | Requisitos | Depende | Concluída quando |
|---|---|---|---|---|
| T1112 | Exclusão mostra consequências e quantos Baralhos perdem o Cartão. Conteúdo extenso quebra sem rolagem horizontal | FR-144, FR-147 | Fase 1 | `pagina-de-cartoes` e `excluir-cartao` verdes |
| T1113 | Edição informa quais e quantos Baralhos usam o Cartão. Salvar reflete em todos. Sair sujo pede confirmação | FR-140, FR-141, FR-146, FR-148 | Fase 1 | `editar-cartao` e `teclado-e-foco-de-edicao` verdes |

</details>

---

## Fase 5 — Estudo

- [X] T1114 [P] `percentualDeAcertos(resumo)` em `sessao-de-estudo.ts`, com os casos do SC-067
- [X] T1115 `PaginaDeEstudo.tsx`: configuração, Sessão (Item n de N, barra de progresso com texto, Revelar verso, Acertei/Errei), interrupção confirmada e Resumo com o percentual

<details><summary>Metadados</summary>

| ID | Objetivo observável | Requisitos | Depende | Concluída quando |
|---|---|---|---|---|
| T1114 | 1/1 = 100%, 0/1 = 0%, 2/3 = 67%, 3/3 = 100%, 0/3 = 0% | FR-152, SC-067 | — | `sessao-de-estudo.test.ts` verde |
| T1115 | Quantidade inválida é recusada. Quantidade excedente avisa antes do primeiro Item. Configuração alterada protege o descarte. A Sessão em andamento protege a saída. Cancelar mantém o Item exato | FR-149–152 | T1103, T1114 | `pagina-de-estudo`, `navegacao-de-estudo`, `teclado-e-foco-de-estudo` e `leitor-de-tela-de-estudo` verdes |

</details>

---

## Fase 6 — Transversais

- [X] T1116 Revisão cruzada das páginas: reenvio bloqueado durante pendência, falha que preserva campos, mesma mensagem de "não encontrado" e nenhum resto de demonstração

<details><summary>Metadados</summary>

| ID | Objetivo observável | Requisitos | Depende | Concluída quando |
|---|---|---|---|---|
| T1116 | Com o cliente de prova falhando ou pendente, nenhuma página mostra falso sucesso nem permite segundo envio | FR-153–156, FR-160, SC-065 | Fases 2–5 | testes de tela com falha e pendência verdes em todas as páginas |

</details>

---

## Fase 7 — E2E e converge

- [X] T1117 Specs Playwright existentes atualizadas para as rotas e páginas novas
- [X] T1118 [P] `e2e/percurso-por-teclado.spec.ts` com o percurso SC-062 só por teclado, em 390 e 1440
- [X] T1119 [P] `e2e/visual-e-contraste.spec.ts` com as larguras 360/390/768/1440, zoom de 200%, contraste dos tokens computados e alvos de 44 px
- [X] T1120 Converge (Arquiteto): capturas de todas as telas comparadas a `design/prototipo-visual/capturas/`, EVT final e diff para aprovação

<details><summary>Metadados</summary>

| ID | Objetivo observável | Requisitos | Depende | Concluída quando |
|---|---|---|---|---|
| T1117 | As 17 specs passam com o fluxo novo | SC-066, SC-069 | Fase 6 | `npm run test:e2e` verde |
| T1118 | O percurso completo é concluído sem mouse | SC-062, FR-158, FR-159 | T1117 | spec verde |
| T1119 | `scrollWidth <= clientWidth` em todas as telas. Contraste ≥ 4,5:1 (texto) e ≥ 3:1 (texto grande e bordas de controle). Alvos ≥ 44 px | FR-135–137, SC-063, SC-068 | T1117 | spec verde |
| T1120 | O Product Owner aprova o diff. Nenhum commit sem pedido | SC-070 | T1117–T1119 | aprovação registrada |

</details>

---

## Revisão de 2026-10-02 — ações do Baralho no topo

- [X] T1121 `PaginaDoBaralho.tsx`: Estudar este Baralho, Adicionar cartões existentes, Renomear e Excluir Baralho reunidos no topo, antes da lista de Cartões; testes de tela (ordem de Tab) e e2e de visibilidade sem rolagem com 40 Cartões em 360 px

<details><summary>Metadados</summary>

| ID | Objetivo observável | Requisitos | Depende | Concluída quando |
|---|---|---|---|---|
| T1121 | As quatro ações do Baralho ficam no primeiro viewport e antes dos Cartões no Tab, com 0, 1 e 40 Cartões, de 360 a 1440 px; Remover deste baralho continua em cada Cartão | FR-145 (revisado), SC-078 | — | testes de tela e e2e verdes; CI e deploy verdes |

</details>

## Revisão de 2026-10-02 — lista de Baralhos compacta

- [X] T1122 `PaginaDeBaralhos.tsx` + `estilos.css`: uma linha por Baralho (nome = link do detalhe, quantidade, Estudar à direita; sem rótulo, status ou "Ver baralho"); testes de tela; e2e de densidade (linha ≤ 72 px; ≥ 6 Baralhos em 390 × 844) e specs que usavam "Ver baralho"

<details><summary>Metadados</summary>

| ID | Objetivo observável | Requisitos | Depende | Concluída quando |
|---|---|---|---|---|
| T1122 | Lista compacta com Estudar acessível (desativado com motivo associado quando vazio), alvos de 44 px e sem rolagem horizontal | FR-144 (revisado), SC-079 | — | testes de tela e e2e verdes; CI e deploy verdes |

</details>
