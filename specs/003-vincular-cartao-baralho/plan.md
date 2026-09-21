# Implementation Plan: Vincular Cartão a Baralho

**Branch**: `003-vincular-cartao-baralho` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Depende de**: [`001-criar-cartao`](../001-criar-cartao/plan.md) e
[`002-criar-baralho`](../002-criar-baralho/plan.md).

## Summary

Terceira feature, e a que **fecha o ciclo**: criar Cartão e criar Baralho, em
isolado, não produzem nada estudável. É o Vínculo que torna um Baralho elegível.

Traz duas coisas estruturalmente importantes. A **unicidade do par** passa a ser
propriedade do esquema, não verificação em código. E a **semântica
não-cascateante** — excluir um lado nunca destrói o outro — fica garantida pela
forma do modelo, antes mesmo de a feature `006` implementar exclusão.

A partir daqui `elegivel` deixa de ser invariavelmente falso.

## Technical Context

Herdado e **não reaberto**: TypeScript estrito sobre Node 24+, Fastify,
`node:sqlite`, Zod nas bordas, Vitest, Testing Library, Playwright, e a
infraestrutura de migração da feature `002`.

**Novo**: migração 3, chave primária composta, cascata. Ver
[research.md](./research.md).

**Scale/Scope**: 20 requisitos funcionais, 5 critérios, 1 história, 15 cenários.
Uma tela de Vínculos, mais a extensão de duas telas existentes.

## Constitution Check

| Princípio | Veredito |
|---|---|
| I — Spec-Driven | **PASS**. Deriva apenas de `spec.md` desta feature |
| II — Auditabilidade | **PASS**. Registrado em `SESSION.md` |
| III — Domínio antes de tecnologia | **PASS**. `Vinculo`, `vincular`, `desvincular`. `link` é proibido em módulo, tipo, função, tabela, coluna e rota |
| IV — Módulos profundos | **PASS**. Nenhum Module novo; o `Acervo` cresce em duas operações. Nenhuma Seam nova |
| V — Interface é a superfície de teste | **PASS**. `Acervo` testado pela Interface com SQLite em memória |
| VI — Verificação sobre afirmação | **PASS** |
| VII — Escopo mínimo | **PASS**. Complexity Tracking vazio |
| VIII — Segredos fora do repositório | **PASS por vacuidade verificada** |
| IX — Rastreabilidade | **PASS condicionado**. Matriz em `tasks.md` |
| X — Portões de qualidade | **PASS até aqui**. `analyze` ao final desta etapa |
| XI — Delegação de código | **PASS**. Código por subagentes DeepSeek |

### Re-avaliação após Phase 1

**PASS, sem alteração.** O design confirmou o desenho: a chave composta torna
FR-020 verdadeiro por construção, e a ausência de chave estrangeira entre
`cartao` e `baralho` garante FR-008 e FR-017 **antes** de existir exclusão.

## Decisões de Codebase Design

### Modules — nenhum novo

O `Acervo` passa de quatro para sete operações:

```
criarCartao(frente, verso)            -> Cartao      (001)
listarCartoes()                       -> Cartao[]    (001, estendido aqui)
criarBaralho(nome)                    -> Baralho     (002)
listarBaralhos()                      -> Baralho[]   (002)
obterBaralho(id)                      -> Baralho com seus Cartoes   (esta feature)
vincular(cartaoId, baralhoId)         -> void        (esta feature)
desvincular(cartaoId, baralhoId)      -> void        (esta feature)
```

**`listarCartoes` é estendido**: cada Cartão passa a trazer os Baralhos a que
está vinculado. É mudança de contrato, documentada em
[contracts/api-vinculos.md](./contracts/api-vinculos.md).

**Invariantes garantidas pela Interface**: par único (FR-020); ambas as
entidades devem existir; desvincular preserva ambas (FR-021); sem limite
superior (FR-022); elegibilidade derivada (FR-024).

**Ordenação**: `vincular` exige Cartão e Baralho existentes. `desvincular` de
Vínculo inexistente é recusado, para que a interface não confirme ao usuário
uma operação que não ocorreu.

**Modos de erro novos**: `vinculo_duplicado`, `vinculo_nao_encontrado`,
`nao_encontrado`.

### Seams — nenhuma nova

Continua havendo **uma** Seam no sistema: `ClienteDoAcervo`, com `ClienteHttp` e
`ClienteEmMemoria`. A persistência segue sendo Seam interna ao `Acervo`.

### Avaliação do Module `Acervo`

- **Interface menor que a complexidade que esconde?** Sim. Sete operações
  escondem três tabelas, migração versionada, cascatas, chave composta,
  transações e derivação de elegibilidade.
- **Leverage real?** Sim. As rotas continuam finas, e a interface gráfica não
  reimplementa nenhuma regra de cardinalidade.
- **Locality?** Sim. A unicidade vive no esquema; a tradução para erro de
  domínio vive num lugar só.
- **Teste de exclusão?** Apagá-lo espalharia a semântica de cascata e a
  derivação de elegibilidade por rotas e telas.
- **Testes na Interface?** Sim. A cascata é testada pela Interface: excluir e
  conferir o que sobrevive, sem inspecionar tabela.
- **Seam especulativa?** Nenhuma criada.

## Acessibilidade e Responsividade

FR-042, FR-062, FR-063, FR-064, FR-065 e SC-019.

O ponto específico desta feature é a **preservação do foco**: vincular e
desvincular alteram a lista sob o cursor. Se o foco voltar ao início a cada
operação, vincular dez Cartões vira trabalho manual penoso — e é exatamente o
tipo de defeito que passa despercebido por quem testa com o ponteiro. FR-064
exige posição previsível após cada operação.

O estado vazio distingue **três casos**, por FR-062: não há Cartão, não há
Baralho, ou todos já estão vinculados. Um único "nada aqui" seria inútil.

## Validação, Erros e Segurança

Duas camadas, como nas anteriores. A garantia de loopback imposta em runtime na
feature `001` continua valendo e não é reaberta.

**Atenção específica**: a violação de chave primária composta chega do driver
como erro de restrição. O `Acervo` **deve traduzi-la** em `vinculo_duplicado`,
nunca deixá-la vazar como erro genérico — do contrário o usuário recebe texto
de banco de dados.

## Estratégia de Testes

A Interface é a superfície. Testes obrigatórios de cascata: excluir um Cartão e
conferir que o Baralho sobrevive; excluir um Baralho e conferir que o Cartão
sobrevive; ambos pela Interface, sem inspecionar tabela. Teste de ausência de
limite com 20 Baralhos e 60 Cartões. `e2e/` para persistência e foco.

Comandos: `npm test`, `npm run build`, `npm run lint` em `backend/` e
`frontend/`; `npm run test:e2e` na raiz.

## Project Structure

Sem diretório novo:

```text
backend/src/acervo/     # + regras de Vínculo, + migração 3
backend/src/http/       # + rotas de Vínculo
frontend/src/ui/        # + tela de Vínculos
```

## Riscos, Alternativas e Custo de Reversão

| Decisão | Risco | Alternativa rejeitada | Custo de reversão |
|---|---|---|---|
| Unicidade como chave composta | Erro do driver precisa ser traduzido | Verificar antes de inserir | Baixo |
| Sem id próprio do Vínculo | Se algum dia for preciso referenciar um Vínculo | Coluna `id` mais `UNIQUE` | Médio, exige migração |
| Desvincular sem confirmação | Desvínculo acidental | Confirmar sempre | Baixo, e a decisão protege as confirmações da feature `006` |
| `listarCartoes` estendido | Mudança de contrato publicado na `001` | Rota separada para os Baralhos do Cartão | Baixo |

## Complexity Tracking

> Nenhuma violação da constituição a justificar.

Nenhum Module novo, nenhuma Seam nova, nenhuma dependência nova.
