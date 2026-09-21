# Tasks: Criar Baralho

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`

**Depende de**: feature `001-criar-cartao` concluída — projeto, `Acervo`,
`ClienteDoAcervo`, Adapter HTTP.

**Executor**: pelo **Princípio XI**, todo código sob `backend/`, `frontend/` e
`e2e/` é criado por subagentes DeepSeek.

## Formato

O estado de cada tarefa é a **caixa de seleção**: `- [ ]` pendente, `- [X]`
concluída. É esse marcador que o comando `implement` lê e atualiza. Os metadados
exigidos pelo processo ficam na tabela recolhida de cada fase.

`[P]` = paralelizável: arquivos disjuntos, sem dependência mútua.

---

## Fase 1 — Migração de esquema

- [X] T101 Infraestrutura de migração versionada, aplicada em transação
- [X] T102 Migração 2 cria a tabela `baralho` preservando os Cartões existentes

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T101 | Base rastreia sua versão de esquema e aplica migrações pendentes em ordem, cada uma em transação | — | 001/T004 | `Acervo` (Seam interna) | `backend/src/acervo/` | `codebase-design` | Base nova recebe todas as migrações; base já migrada não reaplica; falha no meio de uma migração não deixa estado parcial | Os três testes passam |
| T102 | Tabela `baralho` existe, com as restrições de nome, e os Cartões preexistentes permanecem intactos | FR-011, FR-012, FR-018, FR-061 | T101 | `Acervo` | `backend/src/acervo/` | `domain-modeling` | Migrar base da feature 001 **com Cartões dentro** e asseverar que todos sobrevivem; `CHECK` recusa nome vazio, só de espaços e com 101 caracteres; ausência de `UNIQUE` permite nome repetido | Nenhum Cartão perdido e as quatro recusas comprovadas |

</details>

---

## Fase 2 — Criar e listar Baralho

- [ ] T103 `Acervo` cria Baralho, recusando nome inválido
- [ ] T104 `Acervo` lista Baralhos com elegibilidade derivada
- [ ] T105 Rotas `POST /baralhos` e `GET /baralhos` conforme o contrato
- [ ] T106 `ClienteDoAcervo` cobre as rotas de Baralho nos dois Adapters
- [ ] T107 Telas de lista e criação de Baralho, com estado vazio e aviso de limite
- [ ] T108 Falha de gravação reportada, com o conteúdo digitado preservado

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T103 | Criação válida aceita; nome vazio, só de espaços e acima de 100 caracteres recusados; nome repetido aceito | FR-010, FR-011, FR-012, FR-018, FR-061 | T102 | `Acervo` · `criarBaralho` | `backend/src/acervo/` | `domain-modeling` | Cinco casos pela Interface, com SQLite em memória, incluindo propriedade extra ignorada | Nenhum teste inspeciona tabela |
| T104 | Lista devolve nome, `quantidadeDeCartoes` e `elegivel`, ambos derivados | FR-013, FR-014, FR-024 | T103 | `Acervo` · `listarBaralhos` | `backend/src/acervo/` | `domain-modeling` | Lista vazia; dois Baralhos homônimos presentes; todos com `elegivel: false` e contagem 0 | Elegibilidade nunca lida de coluna |
| T105 | As duas rotas respondem conforme o contrato | FR-023, FR-046 | T104 | Adapter HTTP sobre `Acervo` | `backend/src/http/` | `codebase-design` | Teste de contrato por rota, com `nome_vazio` e `nome_muito_longo` e mensagem em português; nome repetido devolve 201, **não** 409 | Ambos os códigos de erro cobertos |
| T106 | A mesma bateria passa contra `ClienteHttp` e `ClienteEmMemoria` | FR-044 | T105 | `ClienteDoAcervo` (Seam) | `frontend/src/acervo-cliente/` | `codebase-design` | Resultados idênticos nos dois Adapters | Dois Adapters verdes no mesmo conjunto |
| T107 | Lista vazia orienta a ação; criação aparece na lista; aviso de limite durante a digitação | FR-013, FR-046, FR-057, FR-061 | T106 | `ClienteDoAcervo` | `frontend/src/ui/` | — | Estado vazio; criação bem-sucedida; aviso de limite antes de salvar | Nenhuma regra de domínio replicada na tela |
| T108 | Com a API indisponível, a criação não aparece concluída e o texto permanece | FR-044, FR-045 | T107 | `ClienteDoAcervo` | `frontend/src/` | — | Falha simulada de gravação | Nenhuma perda de conteúdo |

</details>

---

## Fase 3 — Acessibilidade, responsividade e validação

- [ ] T109 Criar Baralho e navegar a lista apenas por teclado, com foco visível
- [ ] T110 Erros e estado vazio perceptíveis por leitor de tela
- [ ] T111 [P] Telas utilizáveis em largura de telefone, com 10 Baralhos
- [ ] T112 Baralhos sobrevivem a fechar e reabrir, e a migração não reaplica

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T109 | Percurso do campo ao salvamento só por teclado; numa recusa o foco vai ao campo a corrigir; indicador não depende de cor | FR-058, FR-059 · SC-018 | T107 | — | `frontend/src/ui/` | — | Asserções de teclado e foco | Asserções passam |
| T110 | Nome, papel e estado acessíveis asseverados; mensagem de erro e estado vazio anunciados | FR-060 | T109 | — | `frontend/src/ui/` | — | Asserções de semântica | Asserções passam |
| T111 | Sem rolagem horizontal em viewport estreita, com 10 Baralhos | FR-042 · SC-011 | T107 | — | `frontend/src/ui/` | — | Verificado em navegador real | Teste e2e passa |
| T112 | Baralhos persistem entre execuções e a migração roda uma vez só | FR-040 · SC-003 | T108 | — | `e2e/` | — | Criar Baralhos, reiniciar, conferir persistência e que a versão do esquema não avançou de novo | Teste e2e passa |

</details>

---

## Dependências e Ordem

```
001 concluída → T101 → T102 → T103 → T104 → T105 → T106 → T107 → T108 → T112
                                                        ├─ T109 → T110
                                                        └─ T111 [P]
```

Execução **serial por padrão**. O único paralelismo declarado é T111 com o par
T109–T110, por tocarem asserções disjuntas.

**T101 e T102 não são paralelas**: a migração 2 depende da infraestrutura que
rastreia versão.

## Matriz de Rastreabilidade Requisito ↔ Tarefa

| Requisito | Tarefa |
|---|---|
| FR-010 | T103 |
| FR-011 | T102, T103 |
| FR-012 | T102, T103, T105 |
| FR-013 | T104, T107 |
| FR-014 | T104 |
| FR-018 | T102, T103 |
| FR-023 | T105 |
| FR-024 | T104 |
| FR-040 | T112 |
| FR-042 | T111 |
| FR-044 | T106, T108 |
| FR-045 | T108 |
| FR-046 | T105, T107 |
| FR-057 | T107 |
| FR-058 | T109 |
| FR-059 | T109 |
| FR-060 | T110 |
| FR-061 | T102, T103, T107 |

| Critério | Tarefa |
|---|---|
| SC-003 | T112 |
| SC-011 | T111 |
| SC-012 | T108 |
| SC-016 | T102, T103 |
| SC-018 | T109 |

## Notas

- Nenhuma tarefa exige decisão de produto ou arquitetura do worker.
- Nenhuma tarefa introduz Seam ou Adapter novo.
- Nenhuma tarefa cria a tabela `vinculo`: ela pertence à feature `003`.
- **T102 é a tarefa de maior risco da feature**: ela toca base instalada com
  dados reais. Seu teste exige migrar uma base da feature `001` com Cartões
  dentro e provar que nenhum se perdeu.
