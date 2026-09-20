# Phase 1 — Data Model: MVP de Estudo por Flashcards

Modelo derivado das entidades da spec e do glossário canônico de `CONTEXT.md`.
Nomes de tabela e coluna usam os termos canônicos; sinônimos de `_Avoid_` são
proibidos.

## Entidades duráveis

Vivem no Acervo, no servidor, e persistem entre execuções (FR-040).

### Cartao

| Campo | Tipo | Restrição |
|---|---|---|
| `id` | texto | Chave primária, identificador opaco gerado pelo sistema |
| `frente` | texto | Obrigatório, não vazio após remoção de espaços (FR-002) |
| `verso` | texto | Obrigatório, não vazio após remoção de espaços (FR-002) |

Nenhuma outra propriedade, por FR-009. Não há título, descrição, data ou
qualquer campo de conveniência. A Frente **não** é identificador: dois Cartões
podem ter a mesma Frente, inclusive dentro do mesmo Baralho.

### Baralho

| Campo | Tipo | Restrição |
|---|---|---|
| `id` | texto | Chave primária, identificador opaco gerado pelo sistema |
| `nome` | texto | Obrigatório, não vazio, **sem unicidade** (FR-011, FR-012) |

Nenhuma outra propriedade, por FR-018. A elegibilidade **não** é um campo: é
derivada da existência de ao menos um Vínculo (FR-024). Persistir elegibilidade
criaria um segundo lugar para a verdade viver.

### Vinculo

| Campo | Tipo | Restrição |
|---|---|---|
| `cartao_id` | texto | Chave estrangeira para `Cartao.id`, remoção em cascata |
| `baralho_id` | texto | Chave estrangeira para `Baralho.id`, remoção em cascata |

Chave primária composta `(cartao_id, baralho_id)`, que implementa FR-020 e a
unicidade do par no próprio esquema, e não apenas em código.

A cascata aqui é o mecanismo exato que satisfaz FR-008 e FR-017: excluir um
Cartão ou um Baralho remove as linhas de `Vinculo` que o referenciam, e **nada
mais**. Nenhuma chave estrangeira aponta de `Cartao` para `Baralho` ou o
inverso, portanto não existe caminho pelo qual uma exclusão possa cascatear de
uma entidade para a outra. A semântica não-cascateante não depende de disciplina
do programador: ela é uma consequência da forma do esquema.

## Esquema SQLite

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cartao (
  id     TEXT PRIMARY KEY,
  frente TEXT NOT NULL CHECK (length(trim(frente)) > 0),
  verso  TEXT NOT NULL CHECK (length(trim(verso))  > 0)
);

CREATE TABLE IF NOT EXISTS baralho (
  id   TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0)
);

CREATE TABLE IF NOT EXISTS vinculo (
  cartao_id  TEXT NOT NULL REFERENCES cartao(id)  ON DELETE CASCADE,
  baralho_id TEXT NOT NULL REFERENCES baralho(id) ON DELETE CASCADE,
  PRIMARY KEY (cartao_id, baralho_id)
);
```

`PRAGMA foreign_keys = ON` é obrigatório: sem ele o SQLite ignora as cascatas e
as invariantes FR-008 e FR-017 silenciosamente deixam de valer. Ativá-lo é parte
da abertura da conexão, não uma configuração opcional.

As restrições `CHECK` duplicam FR-002 e FR-011 no esquema de propósito. A
validação primária vive no Acervo, com mensagem útil ao usuário; a restrição no
banco é a rede de segurança que impede estado inválido mesmo diante de um erro de
programação.

## Entidades efêmeras

Vivem no Module `SessaoDeEstudo`, no cliente. **Nunca são persistidas** (FR-038)
e não têm tabela, coluna, chave nem representação em rede. Qualquer interrupção
as descarta (FR-039).

### SessaoDeEstudo

Originada de um único Baralho elegível. Contém uma sequência ordenada e imutável
de Itens de estudo, definida na criação (FR-030). A quantidade de Itens é
`min(quantidade solicitada, Cartões vinculados)` e nunca menor que 1 (FR-028,
FR-029).

### ItemDeEstudo

A apresentação de um Cartão dentro de uma Sessão. Carrega uma **cópia** da Frente
e do Verso capturada na criação da Sessão, não uma referência ao Cartão. Essa
cópia é o que sustenta o caso-limite de edição ou exclusão durante Sessão ativa:
a Sessão permanece internamente consistente até o Resumo, mesmo que o Cartão
mude ou deixe de existir.

Estados: `oculto` → `revelado` → `respondido`. As transições são unidirecionais.
`oculto → respondido` é proibido por FR-034, e sair de `respondido` é proibido
por FR-035.

Nenhum Cartão origina mais de um Item na mesma Sessão (FR-031).

### ResultadoDoItem

Valor de domínio com exatamente dois estados possíveis: `acertou` ou `errou`. No
máximo um por Item, e imutável após registrado (FR-035). É declaração do usuário,
nunca avaliação do sistema (FR-036) — razão pela qual não existe campo de
resposta digitada, nem comparação, nem gabarito em lugar algum deste modelo.

### ResumoDaSessao

Derivado, não armazenado: `estudados`, `acertos`, `erros`. Só existe quando todos
os Itens estão `respondidos` (FR-037), e `acertos + erros = estudados` é
consequência aritmética da sua construção, não uma validação aplicada depois.

## Correspondência com as invariantes da spec

| Invariante | Onde é garantida |
|---|---|
| Frente e Verso não vazios | `CHECK` no esquema + validação no Acervo (FR-002) |
| Nome de Baralho não vazio, sem unicidade | `CHECK` no esquema, ausência de `UNIQUE` (FR-011, FR-012) |
| Par (Cartão, Baralho) único | Chave primária composta de `vinculo` (FR-020) |
| Exclusão não-cascateante entre entidades | Ausência de chave estrangeira entre `cartao` e `baralho` (FR-008, FR-017) |
| Elegibilidade do Baralho | Derivada por contagem de Vínculos, nunca persistida (FR-024) |
| Quantidade limitada ao disponível | `SessaoDeEstudo`, na criação (FR-029) |
| Sem repetição de Cartão na Sessão | `SessaoDeEstudo`, na criação (FR-031) |
| Ordem imutável durante a Sessão | Sequência congelada na criação (FR-030) |
| Revelação antes do Resultado | Máquina de estados do `ItemDeEstudo` (FR-034) |
| Resultado imutável | Máquina de estados do `ItemDeEstudo` (FR-035) |
| Resumo só com todos respondidos | `SessaoDeEstudo` (FR-037) |
| Sessão nunca persistida | Ausência de tabela, rota e serialização (FR-038, FR-039) |
