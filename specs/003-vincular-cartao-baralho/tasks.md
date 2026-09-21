# Tasks: Vincular Cartão a Baralho

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`

**Depende de**: features `001` e `002` concluídas.

**Executor**: pelo **Princípio XI**, todo código sob `backend/`, `frontend/` e
`e2e/` é criado por subagentes DeepSeek.

## Formato

O estado de cada tarefa é a **caixa de seleção**: `- [ ]` pendente, `- [X]`
concluída. É esse marcador que o comando `implement` lê e atualiza. Os metadados
exigidos pelo processo ficam na tabela recolhida de cada fase.

`[P]` = paralelizável: arquivos disjuntos, sem dependência mútua.

---

## Fase 1 — Esquema e cascata

- [X] T201 Migração 3 cria `vinculo` com chave composta e cascata
- [X] T202 Cascata comprovada nos dois sentidos, sem destruir a outra entidade

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T201 | Tabela `vinculo` existe, com chave primária composta e `ON DELETE CASCADE` nas duas chaves estrangeiras, preservando Cartões e Baralhos existentes | FR-020, FR-022 | 002/T101 | `Acervo` (Seam interna) | `backend/src/acervo/` | `codebase-design` | Migrar base da feature 002 **com dados reais** e asseverar que nada se perdeu; migração não reaplica; inserção duplicada é recusada pelo esquema | Nenhum dado perdido e duplicata impossível |
| T202 | Excluir Cartão remove só os Vínculos; excluir Baralho idem. Nenhuma entidade destrói a outra | pré-verifica FR-008 e FR-017 da feature `006` | T201 | `Acervo` | `backend/tests/acervo/` | `domain-modeling` | Excluir Cartão vinculado a dois Baralhos e asseverar que ambos sobrevivem; inverso; e **asseverar que `PRAGMA foreign_keys` está ligado** | Os três testes passam |

</details>

---

## Fase 2 — Vincular e desvincular

- [X] T203 `Acervo` vincula, recusando duplicata e entidade inexistente
- [X] T204 `Acervo` desvincula, preservando Cartão e Baralho
- [X] T205 Elegibilidade passa a variar, derivada por contagem
- [X] T206 `listarCartoes` estendido com os Baralhos de cada Cartão
- [X] T207 Rotas de Vínculo e `GET /baralhos/{id}` conforme o contrato
- [X] T208 `ClienteDoAcervo` cobre as rotas de Vínculo nos dois Adapters

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T203 | Vínculo criado torna o Baralho elegível; par duplicado recusado; Cartão ou Baralho inexistente recusado; 20 Baralhos e 60 Cartões aceitos | FR-019, FR-020, FR-022, FR-023 | T202 | `Acervo` · `vincular` | `backend/src/acervo/` | `domain-modeling` | Quatro casos pela Interface. A recusa de duplicata deve vir do esquema, e o erro do driver **traduzido** em `vinculo_duplicado` | Nenhum erro de driver vaza |
| T204 | Desvincular preserva ambos; Vínculo inexistente é recusado; Baralho perde elegibilidade ao perder o último Cartão | FR-021, FR-024, FR-066 | T203 | `Acervo` · `desvincular` | `backend/src/acervo/` | `domain-modeling` | Três casos pela Interface | Ambas as entidades sobrevivem |
| T205 | `listarBaralhos` e `obterBaralho` devolvem contagem e elegibilidade reais | FR-013, FR-014, FR-024, FR-026 | T204 | `Acervo` · `listarBaralhos`, `obterBaralho` | `backend/src/acervo/` | `domain-modeling` | Baralho com 0, 1 e 3 Cartões; elegibilidade acompanha | Elegibilidade nunca lida de coluna |
| T206 | Cada Cartão traz os Baralhos a que está vinculado; Cartão sem Baralho traz lista vazia | FR-003, FR-004 | T205 | `Acervo` · `listarCartoes` | `backend/src/acervo/` | `domain-modeling` | Cartão em 3 Baralhos aparece uma vez; Cartão órfão presente com `baralhos: []` | SC-006 garantido |
| T207 | Rotas respondem conforme o contrato, incluindo `409` na duplicata | FR-023, FR-046 | T206 | Adapter HTTP | `backend/src/http/` | `codebase-design` | Teste de contrato por rota, com 201, 204, 404 e 409, mensagem em português | Todos os códigos cobertos |
| T208 | A mesma bateria passa nos dois Adapters | FR-044 | T207 | `ClienteDoAcervo` (Seam) | `frontend/src/acervo-cliente/` | `codebase-design` | Resultados idênticos | Dois Adapters verdes |

</details>

---

## Fase 3 — Tela, acessibilidade e validação

- [X] T209 Tela de Vínculos, com os três estados vazios distinguidos
- [X] T210 Vincular e desvincular por teclado, com foco preservado
- [X] T211 Mudanças de Vínculo e de elegibilidade anunciadas
- [X] T212 Falha de gravação reportada, sem exibir Vínculo inexistente
- [X] T213 [P] Tela utilizável em largura de telefone
- [X] T214 Vínculos sobrevivem a fechar e reabrir

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T209 | Tela permite vincular e desvincular; estado vazio distingue **não há Cartão**, **não há Baralho** e **todos já vinculados** | FR-019, FR-021, FR-046, FR-062, FR-066 | T208 | `ClienteDoAcervo` | `frontend/src/ui/` | — | Os três estados vazios; vincular e desvincular; **ausência de diálogo ao desvincular** | Os três casos distinguidos, não um genérico |
| T210 | Percurso só por teclado; **o foco permanece em posição previsível após cada operação**, sem voltar ao início da lista | FR-063, FR-064 · SC-019 | T209 | — | `frontend/src/ui/` | — | Vincular dois Cartões em sequência só por teclado, asseverando a posição do foco após cada um | Foco não se perde |
| T211 | Criar e remover Vínculo, e a mudança de elegibilidade, anunciados | FR-065 | T210 | — | `frontend/src/ui/` | — | Asserções de região ativa | Asserções passam |
| T212 | Com a API indisponível, a operação não aparece concluída e nenhum Vínculo inexistente é exibido | FR-044, FR-045 | T209 | `ClienteDoAcervo` | `frontend/src/` | — | Falha simulada ao vincular e ao desvincular | Estado da tela consistente com o servidor |
| T213 | Sem rolagem horizontal em viewport estreita | FR-042 | T209 | — | `frontend/src/ui/` | — | Navegador real | Teste e2e passa |
| T214 | Vínculos persistem entre execuções e a migração roda uma vez só | FR-040 · SC-003 | T212 | — | `e2e/` | — | Criar Vínculos, reiniciar, conferir persistência e versão do esquema | Teste e2e passa |

</details>

---

## Dependências e Ordem

```
002 concluída → T201 → T202 → T203 → T204 → T205 → T206 → T207 → T208 → T209 → T212 → T214
                                                                          ├─ T210 → T211
                                                                          └─ T213 [P]
```

Execução **serial por padrão**. O único paralelismo declarado é T213 com o par
T210–T211.

**T201 e T202 não são paralelas**: a cascata só pode ser exercida depois de a
tabela existir. **T203 e T204 não são paralelas**: desvincular precisa de
Vínculo criado.

## Matriz de Rastreabilidade Requisito ↔ Tarefa

| Requisito | Tarefa |
|---|---|
| FR-003 | T206 |
| FR-004 | T206 |
| FR-013 | T205 |
| FR-014 | T205 |
| FR-019 | T203, T209 |
| FR-020 | T201, T203 |
| FR-021 | T204, T209 |
| FR-022 | T201, T203 |
| FR-023 | T203, T207 |
| FR-024 | T204, T205 |
| FR-026 | T205 |
| FR-040 | T214 |
| FR-042 | T213 |
| FR-044 | T208, T212 |
| FR-045 | T212 |
| FR-046 | T207, T209 |
| FR-062 | T209 |
| FR-063 | T210 |
| FR-064 | T210 |
| FR-065 | T211 |
| FR-066 | T204, T209 |

| Critério | Tarefa |
|---|---|
| SC-003 | T214 |
| SC-006 | T206 |
| SC-009 | T203, T207 |
| SC-012 | T212 |
| SC-019 | T210 |

## Notas

- Nenhuma tarefa exige decisão de produto ou arquitetura do worker.
- Nenhuma tarefa introduz Seam ou Adapter novo.
- **T202 pré-verifica FR-008 e FR-017, que pertencem à feature `006`.** Eles
  **não constam da matriz desta feature**, por não serem declarados nesta spec:
  a matriz rastreia apenas o que a feature exige. A pré-verificação é
  deliberada — a garantia é propriedade do esquema criado aqui, e exercê-la
  agora impede que a `006` descubra tarde que a forma estava errada. A `006`
  os declarará e os rastreará.
- **T210 é a tarefa mais fácil de declarar concluída sem evidência real.**
  Exige asserção sobre a posição do foco após cada operação, não inspeção
  visual.
