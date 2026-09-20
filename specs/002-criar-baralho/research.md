# Phase 0 — Research: Criar Baralho

As decisões de stack, runtime, driver, build e testes estão em
[`../001-criar-cartao/research.md`](../001-criar-cartao/research.md) e **não são
reabertas aqui**. Esta feature registra apenas o que é novo.

## Decisão nova — migração de esquema passa a ser necessária

**Decisão**: esta feature introduz a primeira migração versionada do projeto.

**Rationale**: a feature `001` criou a tabela `cartao` com
`CREATE TABLE IF NOT EXISTS` na primeira execução, e o seu `research.md`
registrou explicitamente o gatilho: *"A feature 002 acrescentará a tabela
`baralho` — esse é o momento em que migração versionada passa a ser
necessária, por haver base instalada."*

O gatilho chegou. Quem já usou a feature `001` tem um arquivo SQLite com dados
reais. Acrescentar `baralho` com um segundo `CREATE TABLE IF NOT EXISTS` solto
funcionaria por acaso hoje e falharia na primeira alteração que não seja
adicionar tabela — renomear coluna, mudar restrição, popular dado.

**Forma adotada, deliberadamente mínima**: uma tabela `versao_do_esquema` com um
único inteiro, e uma sequência ordenada de migrações aplicadas em transação,
cada uma elevando a versão em um. Sem framework, sem dependência nova, sem
geração automática.

**Alternativas rejeitadas**: manter apenas `CREATE TABLE IF NOT EXISTS`, que
adia o problema para onde ele custa caro; adotar uma ferramenta de migração,
que traria dependência e configuração desproporcionais a duas tabelas.

**Custo de reversão**: baixo. São poucas linhas, e a tabela de versão é
inofensiva se a estratégia mudar.

## Decisão nova — elegibilidade continua derivada

**Decisão**: `elegivel` **não** é coluna.

**Rationale**: a elegibilidade depende da existência de Vínculo, que só existe a
partir da feature `003`. Nesta feature todo Baralho é não elegível, por
construção — não há Cartão vinculado a nenhum. Persistir o campo criaria um
segundo lugar para a verdade viver e exigiria mantê-lo sincronizado a cada
vínculo e desvínculo. É calculado na leitura.

## Omissões deliberadas

| Omitido | Por quê |
|---|---|
| Unicidade de nome | FR-012 exige o contrário: nome é rótulo |
| Índice sobre `nome` | Não há busca por nome nesta feature, e a escala é de ~10 Baralhos |
| Contagem de Cartões materializada | Depende de Vínculo, que é da feature `003` |
| Ordenação configurável da lista | Fora da spec |

Nenhum marcador `NEEDS CLARIFICATION` permanece.
