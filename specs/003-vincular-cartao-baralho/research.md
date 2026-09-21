# Phase 0 — Research: Vincular Cartão a Baralho

Stack, runtime, driver, build e testes estão em
[`../001-criar-cartao/research.md`](../001-criar-cartao/research.md); a
infraestrutura de migração está em
[`../002-criar-baralho/research.md`](../002-criar-baralho/research.md). Nenhuma
das duas é reaberta. Esta feature registra o que é novo.

## Decisão nova — a unicidade do Vínculo vive no esquema

**Decisão**: chave primária composta `(cartao_id, baralho_id)`.

**Rationale**: FR-020 exige recusar Vínculo duplicado. Verificar a existência
antes de inserir cria janela de corrida e coloca a regra em código que pode ser
esquecido no próximo call-site. A chave composta torna a duplicata
**impossível**, e a recusa passa a ser consequência do esquema, não de
disciplina. O `Acervo` traduz a violação de restrição no erro de domínio
`vinculo_duplicado`.

**Alternativa rejeitada**: coluna `id` própria mais índice `UNIQUE`. Acrescenta
uma chave que ninguém usa — nenhum requisito referencia um Vínculo por
identificador próprio.

## Decisão nova — a semântica não-cascateante vem da forma do esquema

**Decisão**: `ON DELETE CASCADE` nas duas chaves estrangeiras de `vinculo`, e
**nenhuma** chave estrangeira entre `cartao` e `baralho`.

**Rationale**: FR-008 e FR-017 exigem que excluir um lado nunca destrua o outro.
Como nenhuma chave estrangeira liga `cartao` a `baralho`, **não existe caminho**
pelo qual uma exclusão possa cascatear de uma entidade para a outra. A cascata
alcança apenas as linhas de `vinculo`. A garantia deixa de depender do
programador e passa a ser propriedade da forma do esquema.

**Pré-requisito verificado**: `PRAGMA foreign_keys = ON` foi ativado já na
feature `001`, justamente para que esta feature não dependesse de alguém
lembrar. Sem ele o SQLite ignora cascatas **em silêncio**.

## Decisão nova — a elegibilidade passa a variar

Até aqui `elegivel` era invariavelmente `false`, por não existir Vínculo. A
partir desta feature ele varia. **O contrato não muda**: a feature `002` já
publicou `quantidadeDeCartoes` e `elegivel` com o formato final, exatamente para
que esta feature não precisasse alterá-lo.

Permanece derivado por contagem, nunca armazenado (FR-024).

## Decisão de produto registrada — desvincular não pede confirmação

**Decisão**: desvincular é imediato, sem diálogo (FR-066).

**Rationale**: desvincular é reversível e não destrói nada. Exigir confirmação
em ato reversível treina o usuário a despachar diálogos sem ler, o que
**enfraquece as confirmações da exclusão**, essa sim irreversível e tratada na
feature `006`. A assimetria é deliberada.

## Omissões deliberadas

| Omitido | Por quê |
|---|---|
| Identificador próprio do Vínculo | Nenhum requisito referencia um Vínculo por id |
| Vincular em lote | Fora da spec |
| Índice adicional sobre `baralho_id` | A chave composta já atende às consultas desta escala |
| Desfazer o desvínculo | Desvincular já é reversível pela própria ação de vincular |
| Data de criação do Vínculo | Nenhum requisito a usa; seria propriedade sem consumidor |

Nenhum marcador `NEEDS CLARIFICATION` permanece.
