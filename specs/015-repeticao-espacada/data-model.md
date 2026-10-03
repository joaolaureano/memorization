# Modelo de dados da 015 — Repetição espaçada

**Feature**: `015-repeticao-espacada`

**Depende de**: `001` a `013`. Usa o Registro de sessão e o Histórico de estudo da `013`, a Sessão de estudo de `004`/`012` e a persistência por Usuário de `008` a `010`.

Este documento descreve as entidades duráveis e puras da repetição espaçada, as regras de validação de cada campo (com o FR dono) e o ciclo de vida do Agendamento. A persistência concreta vive na **Migração 7**, equivalente nos dois Adapters (§"Migração 7" ao fim). As decisões de arquitetura estão em [research.md](./research.md) (D1–D8) e os contratos em [contracts/contratos.md](./contracts/contratos.md); **não** são reabertos aqui.

Os termos usados — Cartão, Baralho, Vínculo, Sessão, Item, Usuário, Início, Preferências, Histórico — são os do glossário `CONTEXT.md`.

---

## 1. Agendamento do Cartão

Relação entre um **Usuário** e um **Cartão** que guarda quando aquele Cartão deve ser revisto. É por Cartão e por Usuário e **nunca** por Vínculo (FR-207).

### 1.1 Campos

| Campo (domínio TS) | Coluna | Tipo (SQLite / PostgreSQL) | Descrição |
| --- | --- | --- | --- |
| `cartaoId` | `cartao_id` | `TEXT` / `TEXT` | Identificador opaco do Cartão. Parte da chave primária `(usuario_id, cartao_id)` (FR-207). |
| — | `usuario_id` | `TEXT` / `TEXT` | Dono do Agendamento (FR-219). Chave estrangeira para `usuario(id)` com cascata; nunca aparece no domínio, que já é sempre lido/gravado por Usuário. |
| `algoritmo` | `algoritmo` | `TEXT` / `TEXT` | Identificador do Algoritmo de repetição espaçada que produziu o estado (`"sm2"`) (FR-188). |
| `versaoDoAlgoritmo` | `versao_do_algoritmo` | `INTEGER` / `INTEGER` | Versão do algoritmo (FR-188). Estado de algoritmo/versão diferente do escolhido não é lido: só ocorre após troca, e a troca reconstrói tudo (D1, D4). |
| `estado` | `estado` | `TEXT` (JSON) / `JSONB` | Estado **opaco** próprio do algoritmo; hoje `{ repeticoes, facilidade, intervaloEmDias }` do SM-2 (FR-188). Nenhum outro Module o interpreta (FR-189). |
| `proximaRevisaoEm` | `proxima_revisao_em` | `TEXT` ISO-8601 UTC / `TIMESTAMPTZ` | Próxima data de revisão (FR-187, FR-189). É o **único** campo que o restante do produto lê, além do Cartão e do Usuário donos. |
| `ultimaAvaliacao` | `ultima_avaliacao` | `TEXT` (`CHECK` 4 níveis) / idem | Última Avaliação declarada (FR-192). |
| `revisadoEm` | `revisado_em` | `TEXT` ISO-8601 UTC / `TIMESTAMPTZ` | Instante da última revisão. |
| `criadoEm` | `criado_em` | `TEXT` ISO-8601 UTC / `TIMESTAMPTZ` | Instante da **primeira** Avaliação que originou o Agendamento. É o que faz o Cartão contar no limite de Cartões novos do dia (D3, FR-199, FR-200). |

### 1.2 Regras de validação

- `ultima_avaliacao ∈ { "errei", "dificil", "bom", "facil" }` — o `CHECK` do esquema é a rede de segurança; a validação primária vive no `Acervo`/algoritmo (FR-192).
- `proxima_revisao_em` e `criado_em` são instantes ISO-8601 UTC; `criado_em` é preservado em toda atualização posterior (idempotência do "novo").
- `algoritmo` e `versao_do_algoritmo` são gravados pelo `Acervo` a partir das Preferências do Usuário (D4); não vêm do cliente.
- Vincular ou desvincular um Cartão **NÃO** altera o Agendamento (FR-207).
- Editar Frente ou Verso **NÃO** altera o Agendamento (FR-208).
- Ao excluir o Cartão, a cascata do esquema apaga o Agendamento dele, sem tocar em Registros de sessão (FR-209).

### 1.3 Relações

- Pertence a **um** Usuário e a **um** Cartão (`PK(usuario_id, cartao_id)`).
- **Não** tem relação com Vínculo, Baralho nem com o Histórico (FR-189, FR-207).
- `Cartão inexistente` (excluído entre a leitura e a gravação) é descartado em silêncio pela Porta (D5).

### 1.4 Ciclo de vida e transições

Estado do par (Usuário, Cartão) ao longo do tempo:

- **Cartão novo** — existe em `cartao` e **não** existe linha em `agendamento` para o par. É a definição de "Cartão nunca estudado" e também o estado inicial de qualquer Cartão pré-015 (FR-214, D3).
- **Agendado** — a primeira Avaliação (no estudo livre ou na Revisão do dia) insere a linha; `criado_em` = agora, e o Cartão deixa de ser novo e passa a contar no limite de novos do dia (FR-205, FR-206).
- **Vencido** — o Agendamento existe e `proxima_revisao_em < fimDoDia` (o `fimDoDia` é o 24:00 local do navegador, D3, FR-204). É o que conta em "N Cartões para revisar hoje" (FR-198).
- **Reagendado** — uma nova Avaliação recalcula `estado`, `proxima_revisao_em`, `ultima_avaliacao` e `revisado_em`; `criado_em` **não** muda (FR-210).
- **Excluído** — a exclusão do Cartão remove o Agendamento pela cascata (FR-209).
- **Reconstruído** — trocar de Algoritmo em Preferências apaga todos os Agendamentos do Usuário e os recria por replay do Histórico, em ordem `(concluidaEm, posicao)`, com `agora` = `concluidaEm` de cada registro e `criado_em` = instante da primeira Avaliação (FR-213, D4, SC-083).

---

## 2. Preferências do Usuário

Configuração de repetição espaçada de um Usuário. **Não** é do acervo: vive na mesma migração, mas é lida/gravada pela Porta com as mesmas garantias de isolamento (FR-219).

### 2.1 Campos (domínio TS)

```ts
export interface Preferencias {
  readonly algoritmo: string;        // id do Algoritmo de repetição espaçada; hoje "sm2"
  readonly limiteDeNovosPorDia: number; // inteiro 0..999
}
```

| Campo | Coluna | Tipo (SQLite / PostgreSQL) | Descrição |
| --- | --- | --- | --- |
| `algoritmo` | `algoritmo` | `TEXT NOT NULL DEFAULT 'sm2'` | Algoritmo escolhido (FR-190, FR-212). |
| `limiteDeNovosPorDia` | `limite_de_novos_por_dia` | `INTEGER NOT NULL DEFAULT 20 CHECK (… BETWEEN 0 AND 999)` | Limite diário de Cartões novos (FR-200). |
| — | `usuario_id` | `TEXT PRIMARY KEY` | Dono das Preferências (FR-219). |

### 2.2 Regras de validação

- `limiteDeNovosPorDia` é inteiro de **0 a 999**, padrão **20**; **0** significa não introduzir Cartões novos (FR-200).
- `algoritmo` precisa estar registrado em `ALGORITMOS`; desconhecido ou removido cai para o SM-2 (D1, FR edge "Algoritmo removido ou desconhecido").
- **Ausência de linha** equivale aos padrões (`algoritmo = "sm2"`, `limiteDeNovosPorDia = 20`): a Porta sintetiza os padrões na leitura, nunca grava linha a priori (D5).
- Salvar com algoritmo **diferente** do atual dispara a reconstrução dos Agendamentos (FR-213).

---

## 3. Avaliação

Declaração do Usuário sobre um Item, **somente após a Revelação** do Verso (FR-193). É a entrada do Algoritmo de repetição espaçada.

### 3.1 Campos (tipo puro)

```ts
export type Avaliacao = "errei" | "dificil" | "bom" | "facil";
```

Quatro níveis (FR-192). Para o Histórico e as Estatísticas da `013`: **Errei conta como erro**; **Difícil, Bom e Fácil contam como acerto** (FR-195, SC-084). O mapeamento de `resultado` é derivado pelo servidor (D4):

- `errei` → `errou` (do `ItemRegistrado` da `013`);
- `dificil` | `bom` | `facil` → `acertou`.

### 3.2 Regras de validação

- `avaliacao ∈ { "errei", "dificil", "bom", "facil" }` — validado pelo `Acervo` e pelo `CHECK` do esquema (FR-192).
- Substitui os botões Acertei/Errei em **toda** Sessão, inclusive no estudo livre por Baralho e na Revisão do dia (FR-194).
- É a entrada de `AlgoritmoDeRepeticao.avaliar` (FR-187) e do cálculo da prévia de cada botão (FR-221).

---

## 4. Algoritmo de repetição espaçada

Entidade **pura** (sem I/O, sem relógio interno): recebe o estado atual do Agendamento, a Avaliação e o instante, e devolve o novo estado, incluindo a próxima data de revisão (FR-187). Identidade e versão identificam o estado (FR-188).

### 4.1 Tipo (D1)

```ts
export interface EstadoDoAgendamento {
  readonly algoritmo: string; // "sm2"
  readonly versao: number;    // 1
  readonly dados: unknown;    // opaco; só o algoritmo o interpreta
}

export interface AlgoritmoDeRepeticao {
  readonly id: string;        // "sm2"
  readonly versao: number;    // 1
  readonly rotulo: string;    // "SM-2"
  avaliar(
    estado: EstadoDoAgendamento | null,
    avaliacao: Avaliacao,
    agora: Date,
  ): { estado: EstadoDoAgendamento; proximaRevisaoEm: Date };
}
```

- `estado === null` significa **Cartão novo**.
- O restante do produto **só** lê `proximaRevisaoEm`, o Cartão e o Usuário (FR-189); o `dados` é opaco fora do algoritmo (FR-188).
- Incluir FSRS/Leitner depois = novo arquivo + uma entrada em `ALGORITMOS`; nada mais muda (FR-191).

### 4.2 Estado do SM-2 (algoritmo da primeira entrega, FR-190)

`dados = { repeticoes: n, facilidade: EF, intervaloEmDias: I }`. Estado inicial: `n = 0`, `EF = 2.5`, `I = 0` (D2).

| Símbolo | Campo | Tipo | Descrição |
| --- | --- | --- | --- |
| `n` | `repeticoes` | inteiro ≥ 0 | Repetições bem-sucedidas consecutivas. |
| `EF` | `facilidade` | número (2 casas) | Fator de facilidade; piso 1.3. |
| `I` | `intervaloEmDias` | inteiro ≥ 1 (após o 1º passo) | Intervalo em dias até a próxima revisão. |

Mapeamento da Avaliação para `q`: `errei = 2`, `dificil = 3`, `bom = 4`, `facil = 5` (D2).

Transição (D2, pura):

- `EF' = max(1.3, arred2(EF + (0.1 − (5−q)·(0.08 + (5−q)·0.02))))` — **sempre** atualizado, inclusive em erro; `arred2` = duas casas.
- Se `q < 3` (`errei`): `n = 0`, `I = 1`.
- Senão: `I = 1` se `n = 0`; `I = 6` se `n = 1`; senão `I = Math.round(I · EF')`; depois `n = n + 1`.
- `proximaRevisaoEm = agora + I × 24 h`.
- Nota fiel ao SM-2 clássico: os 4 botões de um Cartão novo dão "amanhã" (registrado em research; FSRS futuro diferencia).

Tabela de referência (SC-082), cada passo com `agora` = próxima revisão anterior:

- `bom, bom, bom, bom` → `I` 1, 6, 15, 38; `EF` 2.5;
- `facil, facil, facil` → `I` 1, 6, 17; `EF` 2.6, 2.7, 2.8;
- `bom, bom, errei, bom, bom` → `I` 1, 6, 1, 1, 6; `EF` 2.5, 2.5, 2.18, 2.18, 2.18;
- `dificil × 4` → `I` 1, 6, 12, 23; `EF` 2.36, 2.22, 2.08, 1.94;
- `errei × 5` → `I` 1 sempre; `EF` 2.18, 1.86, 1.54, 1.3, 1.3 (piso).

---

## 5. Registro de sessão ampliado

O Registro de sessão da `013` continua imutável (FR-165) e ganha **origem** (FR-196) e, em cada Item, o `cartaoId` e a `avaliacao` (FR-196). Registros antigos, com apenas `acertou`/`errou`, permanecem válidos e são exibidos como antes (FR-197, FR-214).

### 5.1 `RegistroDeSessao` (campos novos)

| Campo (domínio TS) | Coluna | Tipo (SQLite / PostgreSQL) | Descrição |
| --- | --- | --- | --- |
| `origem` | `origem` | `TEXT NOT NULL DEFAULT 'baralho' CHECK (origem IN ('baralho','revisao'))` | Origem da Sessão: estudo livre por Baralho ou Revisão do dia (FR-196, FR-215). |
| — | `baralho_id` | `TEXT NOT NULL` (já existente) | Na Revisão do dia vale `''` (D5). |
| — | `nome_do_baralho` | `TEXT NOT NULL` (já existente) | Na Revisão do dia vale `'Revisão do dia'` (D5). |

### 5.2 `ItemRegistrado` (campos novos)

| Campo (domínio TS) | Coluna | Tipo (SQLite / PostgreSQL) | Descrição |
| --- | --- | --- | --- |
| `cartaoId?` | `cartao_id` | `TEXT NULL` | Cartão de origem do Item, **sem chave estrangeira** (o Cartão pode sumir depois, como `baralho_id`). Ausente/nulo em Itens anteriores à 015. |
| `avaliacao?` | `avaliacao` | `TEXT NULL CHECK (avaliacao IS NULL OR avaliacao IN ('errei','dificil','bom','facil'))` | Avaliação em 4 níveis. Ausente/nula em Itens anteriores à 015; é o que permite o replay (FR-213). |

### 5.3 Regras de validação

- `origem ∈ { "baralho", "revisao" }`; na Revisão do dia, `baralhoId = ''` e `nomeDoBaralho = 'Revisão do dia'` (derivados pelo `Acervo` de `origem`, D5).
- Item novo: `cartaoId` é string não vazia e `avaliacao` é um dos quatro níveis; `resultado` é **derivado** (`errei` → `errou`; demais → `acertou`), nunca informado pelo cliente (FR-195, D4).
- Item antigo (pré-015): `cartaoId`/`avaliacao` nulos, `resultado` como estava; ignorado no replay (FR-213) e exibido como antes (FR-197, FR-214).

---

## 6. Relações entre as entidades

- **Usuário** 1 — N **Agendamento** (por Cartão), **Usuário** 1 — N **Registro de sessão**, **Usuário** 1 — 0..1 **Preferências**.
- **Cartão** 1 — 0..1 **Agendamento** (por Usuário). Excluir o Cartão apaga o Agendamento (FR-209); editar conteúdo não o altera (FR-208).
- **Registro de sessão** 1 — N **Item** (`item_de_registro`), e cada Item referencia o `cartao_id` **sem chave estrangeira**.
- **Agendamento** é independente de **Vínculo** (FR-207): o mesmo Agendamento do Cartão vale em todos os Baralhos a que ele esteja vinculado.

---

## 7. Migração 7

Única migração da `015`, **equivalente nos dois Adapters** (mesmas tabelas e colunas; tipos de cada banco) (SQLite `backend/src/armazenamento/sqlite/migracoes.ts` e PostgreSQL `backend/src/armazenamento/postgresql/migracoes.ts`, D5). Ela **apenas** cria tabelas e acrescenta colunas:

- **Nenhum dado existente é alterado**: Cartões, Baralhos, Vínculos, Usuários e Histórico de uma base instalada sobrevivem intactos (FR-220).
- **Nenhum Agendamento é criado** na migração: o acervo pré-015 vira Cartões novos (FR-214). Os Agendamentos nascem na primeira Avaliação.
- As novas colunas de `item_de_registro` e `registro_de_sessao` são preenchidas com `NULL` / `'baralho'` nas linhas antigas, preservando Registros anteriores (FR-197).

### 7.1 SQL esperado — SQLite

```sql
CREATE TABLE agendamento (
  usuario_id          TEXT    NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  cartao_id           TEXT    NOT NULL REFERENCES cartao(id)  ON DELETE CASCADE,
  algoritmo           TEXT    NOT NULL,
  versao_do_algoritmo INTEGER NOT NULL,
  estado              TEXT    NOT NULL,
  proxima_revisao_em  TEXT    NOT NULL,
  ultima_avaliacao    TEXT    NOT NULL CHECK (ultima_avaliacao IN ('errei','dificil','bom','facil')),
  revisado_em         TEXT    NOT NULL,
  criado_em           TEXT    NOT NULL,
  PRIMARY KEY (usuario_id, cartao_id)
);

CREATE INDEX indice_agendamento_por_usuario_vencimento
  ON agendamento (usuario_id, proxima_revisao_em);

CREATE TABLE preferencias (
  usuario_id              TEXT    PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  algoritmo               TEXT    NOT NULL DEFAULT 'sm2',
  limite_de_novos_por_dia INTEGER NOT NULL DEFAULT 20
                          CHECK (limite_de_novos_por_dia BETWEEN 0 AND 999)
);

ALTER TABLE item_de_registro ADD COLUMN cartao_id TEXT NULL;
ALTER TABLE item_de_registro ADD COLUMN avaliacao TEXT NULL
  CHECK (avaliacao IS NULL OR avaliacao IN ('errei','dificil','bom','facil'));

ALTER TABLE registro_de_sessao ADD COLUMN origem TEXT NOT NULL DEFAULT 'baralho'
  CHECK (origem IN ('baralho','revisao'));

ALTER TABLE cartao ADD COLUMN criado_em TEXT NULL;
```

Comentários seguem o estilo da migração 6 do SQLite:

- `agendamento` tem `PK(usuario_id, cartao_id)` — um Agendamento por Cartão por Usuário (FR-207). As duas chaves estrangeiras usam `ON DELETE CASCADE`: excluir o Usuário ou o Cartão apaga o Agendamento (FR-209). O índice por `(usuario_id, proxima_revisao_em)` serve à contagem de vencidos e à ordem dos vencidos (D3/D5).
- `preferencias` tem uma linha por Usuário; a ausência de linha significa os padrões (`'sm2'`, 20), então a Porta sintetiza os padrões na leitura, sem gravar linha a priori (D5). O `CHECK` 0..999 duplica FR-200 como rede de segurança.
- `ADD COLUMN` em `item_de_registro` e `registro_de_sessao` preserva as linhas existentes: `cartao_id` e `avaliacao` ficam `NULL`; `origem` recebe o default `'baralho'`. É o que mantém os Registros anteriores válidos e exibíveis (FR-197, FR-214).

### 7.2 SQL esperado — PostgreSQL

Mesma forma, com `estado JSONB` e instantes `TIMESTAMPTZ`, como os Adapters existentes (D5).

```sql
CREATE TABLE agendamento (
  usuario_id          TEXT        NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  cartao_id           TEXT        NOT NULL REFERENCES cartao(id)  ON DELETE CASCADE,
  algoritmo           TEXT        NOT NULL,
  versao_do_algoritmo INTEGER     NOT NULL,
  estado              JSONB       NOT NULL,
  proxima_revisao_em  TIMESTAMPTZ NOT NULL,
  ultima_avaliacao    TEXT        NOT NULL CHECK (ultima_avaliacao IN ('errei','dificil','bom','facil')),
  revisado_em         TIMESTAMPTZ NOT NULL,
  criado_em           TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (usuario_id, cartao_id)
);

CREATE INDEX indice_agendamento_por_usuario_vencimento
  ON agendamento (usuario_id, proxima_revisao_em);

CREATE TABLE preferencias (
  usuario_id              TEXT    PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  algoritmo               TEXT    NOT NULL DEFAULT 'sm2',
  limite_de_novos_por_dia INTEGER NOT NULL DEFAULT 20
                          CHECK (limite_de_novos_por_dia BETWEEN 0 AND 999)
);

ALTER TABLE item_de_registro ADD COLUMN cartao_id TEXT NULL;
ALTER TABLE item_de_registro ADD COLUMN avaliacao TEXT NULL
  CHECK (avaliacao IS NULL OR avaliacao IN ('errei','dificil','bom','facil'));

ALTER TABLE registro_de_sessao ADD COLUMN origem TEXT NOT NULL DEFAULT 'baralho'
  CHECK (origem IN ('baralho','revisao'));

ALTER TABLE cartao ADD COLUMN criado_em TIMESTAMPTZ NULL;
ALTER TABLE cartao ADD COLUMN ordem_de_insercao BIGINT GENERATED BY DEFAULT AS IDENTITY;
```

- `cartao.criado_em` (nos dois Adapters) é a ordem de criação exigida pelo FR-201 para os Cartões novos. Fica `NULL` nas linhas anteriores à 015, que vêm primeiro na ordem. Empates (mesmo instante) são desfeitos pela ordem de inserção: `rowid` no SQLite e `ordem_de_insercao` (identidade) no PostgreSQL. Desempatar por `id` não serve, porque o `id` é um UUID aleatório. O Adapter preenche o instante corrente em `inserirCartao`, sem mudar o tipo `Cartao`.
- O Adapter PostgreSQL traduz `TIMESTAMPTZ` para o instante ISO-8601 UTC na leitura, como fazem as tabelas da `013`; `estado` trafega como objeto JSON (o `dados` do algoritmo).
- A bateria compartilhada da Porta roda nos dois Adapters (D5).

---

## 8. Invariantes gerais

- Agendamentos e Preferências são **isolados por Usuário** (FR-219): dados de outro Usuário se comportam como inexistentes, com as mesmas garantias de `008` e da `013`.
- Agendamentos e Preferências **persistem em todos os armazenamentos suportados** (SQLite local e PostgreSQL), com migração que preserva os dados existentes (FR-220).
- Ao concluir a Sessão, o Registro e a aplicação das Avaliações aos Agendamentos ocorrem de forma **atômica e idempotente** (FR-210): reenviar não aplica a Avaliação duas vezes.
- "Hoje" e "vencido" usam o **fuso do navegador**; o limite de novos zera à meia-noite local (FR-204).
