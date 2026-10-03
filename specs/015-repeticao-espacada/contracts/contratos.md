# Contratos da 015

Os contratos são **fixos**. Workers paralelos implementam cada ponta contra eles, sem reabrir assinaturas. As decisões de arquitetura estão em [research.md](../research.md) (D1–D8) e não são reabertas aqui. O modelo de dados e a migração 7 estão em [data-model.md](../data-model.md).

Tipos exatos, nada vago: as assinaturas abaixo são a fonte de verdade dos workers.

---

## 1. Module puro de repetição (`backend/src/repeticao/`)

### 1.1 `backend/src/repeticao/algoritmo.ts` — porta de algoritmo (D1)

```ts
export type Avaliacao = "errei" | "dificil" | "bom" | "facil";

export interface EstadoDoAgendamento {
  readonly algoritmo: string; // "sm2"
  readonly versao: number;    // 1
  readonly dados: unknown;    // opaco, JSON; só o algoritmo o interpreta
}

export interface AlgoritmoDeRepeticao {
  readonly id: string;        // "sm2"
  readonly versao: number;    // 1
  readonly rotulo: string;    // "SM-2"
  /** Pura: sem relógio, sem I/O. estado === null = Cartão novo. */
  avaliar(
    estado: EstadoDoAgendamento | null,
    avaliacao: Avaliacao,
    agora: Date,
  ): { estado: EstadoDoAgendamento; proximaRevisaoEm: Date };
}

/** Registro dos algoritmos disponíveis; hoje só o SM-2. */
export const ALGORITMOS: ReadonlyMap<string, AlgoritmoDeRepeticao>;

export const ALGORITMO_PADRAO: "sm2";

/** Desconhecido ou removido → SM-2 (FR edge "algoritmo removido"). */
export function algoritmoPorId(id: string): AlgoritmoDeRepeticao;

/** Chama avaliar 4× e devolve, por nível, a próxima revisão resultante (ISO). */
export function previa(
  alg: AlgoritmoDeRepeticao,
  estado: EstadoDoAgendamento | null,
  agora: Date,
): Record<Avaliacao, string>;
```

**Invariantes**

- `avaliar` é **pura**: sem relógio interno, sem I/O; recebe `agora` (FR-187, D1).
- `estado === null` significa **Cartão novo** (D1, D3).
- Incluir um segundo algoritmo é um novo arquivo + uma entrada em `ALGORITMOS`; nada mais muda (FR-191).
- Estado de algoritmo/versão diferente do escolhido **não é lido**: só ocorre após troca, e a troca reconstrói tudo (D1, D4).
- `previa` devolve exatamente 4 chaves, com o instante ISO que `avaliar` produziria para cada Avaliação (FR-221, SC-090).

### 1.2 `backend/src/repeticao/sm2.ts` — o algoritmo (D2)

`dados = { repeticoes: n, facilidade: EF, intervaloEmDias: I }`. Estado inicial `n = 0`, `EF = 2.5`, `I = 0`.

- `q`: `errei = 2`, `dificil = 3`, `bom = 4`, `facil = 5`.
- `EF' = max(1.3, arred2(EF + (0.1 − (5−q)·(0.08 + (5−q)·0.02))))` — sempre atualizado, inclusive em erro; `arred2` = 2 casas.
- Se `q < 3`: `n = 0`, `I = 1`. Senão: `I = 1` se `n = 0`; `I = 6` se `n = 1`; senão `I = Math.round(I · EF')`; depois `n = n + 1`.
- `proximaRevisaoEm = agora + I × 24 h`.

Exporta uma instância de `AlgoritmoDeRepeticao` com `id = "sm2"`, `versao = 1`, `rotulo = "SM-2"`, registrada em `ALGORITMOS`. A tabela de referência para SC-082 está no `data-model.md` (§4.2).

### 1.3 `backend/src/repeticao/revisao.ts` — Module puro de orquestração (D5)

Sem I/O. Recebe os dados já lidos pela Porta e devolve dados a gravar.

```ts
import type { Avaliacao, AlgoritmoDeRepeticao, EstadoDoAgendamento } from "./algoritmo";
import type { Agendamento, Cartao, Preferencias } from "../armazenamento/porta";

export interface ContagemDaRevisao {
  vencidos: number;  // Agendamentos com proximaRevisaoEm < fimDoDia
  novosHoje: number; // min(Cartões sem Agendamento, max(0, limite − introduzidosHoje))
}

/**
 * introduzidosHoje = Agendamentos com criadoEm ∈ [inicioDoDia, fimDoDia).
 * Cartão novo = Cartão do Usuário sem Agendamento (D3, FR-198, FR-199).
 */
export function resumoDaRevisao(
  cartoes: readonly Cartao[],
  agendamentos: readonly Agendamento[],
  preferencias: Preferencias,
  inicioDoDia: Date,
  fimDoDia: Date,
): ContagemDaRevisao;

/** Vencidos por proximaRevisaoEm asc, depois novos; empates e novos seguem a ordem do array `cartoes`, que é a ordem de criação (listarCartoes, §2.3). Até 20, cada Cartão no máximo uma vez (FR-201, FR-203). */
export function loteDeRevisao(
  cartoes: readonly Cartao[],
  agendamentos: readonly Agendamento[],
  preferencias: Preferencias,
  inicioDoDia: Date,
  fimDoDia: Date,
): Cartao[];

/** Aplica as Avaliações na ordem dos Itens; upsert por cartaoId; criadoEm preservado (FR-205, FR-210). */
export function aplicarAvaliacoes(
  agendamentos: readonly Agendamento[],
  itens: readonly { readonly cartaoId: string; readonly avaliacao: Avaliacao }[],
  alg: AlgoritmoDeRepeticao,
  agora: Date,
): Agendamento[];

/** Replay cronológico (concluidaEm, posicao) sobre os Cartões ainda existentes (FR-213, SC-083). */
export function reconstruir(
  itensAvaliados: readonly ItemAvaliado[],
  cartoesExistentes: readonly string[],
  alg: AlgoritmoDeRepeticao,
): Agendamento[];
```

`ItemAvaliado` vem de §2.2. **Invariantes**

- `loteDeRevisao` limita a 20 Itens e não repete Cartão (FR-201, FR-203).
- `aplicarAvaliacoes` é idempotente por natureza pura: quem controla a idempotência real é a Porta (§2), que só aplica quando o Registro é novo (FR-210).
- `reconstruir` ignora Itens sem `avaliacao`/`cartaoId` (pré-015) e Cartões inexistentes (FR-213).

---

## 2. Porta de armazenamento (`backend/src/armazenamento/porta.ts`)

Os tipos abaixo são acrescentados a `porta.ts`; `Avaliacao` é importado de `../repeticao/algoritmo` (é vocabulário compartilhado, e a Porta o re-exporta como já faz com outros tipos). Os dois Adapters (SQLite e PostgreSQL) implementam os mesmos métodos, e a bateria compartilhada da Porta roda nos dois (D5).

### 2.1 Tipos novos

```ts
import type { Avaliacao } from "../repeticao/algoritmo";

/** Agendamento do Cartão: por Usuário e por Cartão, nunca por Vínculo (FR-207). */
export interface Agendamento {
  readonly cartaoId: string;
  readonly algoritmo: string;             // id do algoritmo ("sm2")
  readonly versaoDoAlgoritmo: number;     // versão do algoritmo (1)
  readonly estado: unknown;               // opaco, JSON: os `dados` do algoritmo
  readonly proximaRevisaoEm: string;      // ISO-8601 UTC
  readonly ultimaAvaliacao: Avaliacao;
  readonly revisadoEm: string;            // ISO-8601 UTC
  readonly criadoEm: string;              // ISO-8601 UTC; instante da 1ª Avaliação
}

/** Preferências do Usuário; ausência de linha equivale aos padrões (D5). */
export interface Preferencias {
  readonly algoritmo: string;             // padrão "sm2"
  readonly limiteDeNovosPorDia: number;   // inteiro 0..999; padrão 20
}

/** Item do Histórico com Avaliação, para o replay (FR-213). */
export interface ItemAvaliado {
  readonly cartaoId: string;
  readonly avaliacao: Avaliacao;
  readonly concluidaEm: string;           // ISO-8601 UTC
  readonly posicao: number;               // 0..n-1
}
```

### 2.2 Mudanças em `ItemRegistrado` e `RegistroDeSessao`

```ts
export interface ItemRegistrado {
  readonly posicao: number;
  readonly frente: string;
  readonly verso: string;
  readonly resultado: ResultadoDoItemRegistrado;
  /** Cartão de origem; ausente/nulo em Itens anteriores à 015 (FR-196, FR-197). */
  readonly cartaoId?: string | null;
  /** Avaliação em 4 níveis; ausente/nula em Itens anteriores à 015 (FR-196, FR-197). */
  readonly avaliacao?: Avaliacao | null;
}

export interface RegistroDeSessao {
  // ... campos da 013 inalterados ...
  /** Origem da Sessão: estudo livre por Baralho ou Revisão do dia (FR-196). */
  readonly origem: "baralho" | "revisao";
}
```

`RegistroResumido = Omit<RegistroDeSessao, "itens">` permanece e passa a carregar `origem`. Na Revisão do dia, `baralhoId = ""` e `nomeDoBaralho = "Revisão do dia"` (D5).

### 2.3 Métodos novos em `ArmazenamentoDoAcervo`

**Mudança em método existente**: `listarCartoes(usuarioId)` passa a devolver os Cartões **em ordem de criação**: `ORDER BY criado_em` (NULL primeiro), desempate pela ordem de inserção (`rowid` no SQLite, `ordem_de_insercao` no PostgreSQL). `inserirCartao` grava `criado_em` com o instante corrente. É a ordem que `loteDeRevisao` usa para os Cartões novos (FR-201).

```ts
/** As Preferências do Usuário; se não houver linha, os padrões ("sm2", 20). */
obterPreferencias(usuarioId: string): Promise<Preferencias>;

/** Grava (insert ou update) as Preferências. Falha do armazenamento → "indisponivel". */
salvarPreferencias(
  usuarioId: string,
  preferencias: Preferencias,
): Promise<Desfecho<Preferencias>>;

/** Todos os Agendamentos do Usuário, sem ordem prometida. */
listarAgendamentos(usuarioId: string): Promise<Agendamento[]>;

/**
 * Numa ÚNICA transação: insere o Registro (com Itens) e grava os Agendamentos.
 * Se o `id` do Registro já existe PARA O MESMO Usuário, devolve o existente com
 * `novo: false` e NÃO grava Agendamento algum (idempotência, FR-210). `id` de
 * OUTRO Usuário → { ok:false, erro:"conflito" } (FR-166). Falha → "indisponivel".
 * Agendamento de Cartão inexistente é descartado em silêncio (Cartão excluído
 * entre a leitura e a gravação).
 */
inserirRegistroEAgendamentos(
  usuarioId: string,
  registro: RegistroDeSessao,
  agendamentos: readonly Agendamento[],
): Promise<Desfecho<{ registro: RegistroDeSessao; novo: boolean }>>;

/**
 * Numa ÚNICA transação: salva as Preferências, apaga TODOS os Agendamentos do
 * Usuário e grava os novos (troca de algoritmo, FR-213). Falha → "indisponivel".
 */
substituirAgendamentos(
  usuarioId: string,
  preferencias: Preferencias,
  agendamentos: readonly Agendamento[],
): Promise<Desfecho<void>>;

/**
 * Itens com avaliacao e cartaoId (ignora os nulos/pré-015), em ordem
 * (concluidaEm, posicao) — insumo do replay (FR-213).
 */
listarItensAvaliados(usuarioId: string): Promise<ItemAvaliado[]>;
```

Seguem o padrão existente: `Desfecho` e `CodigoDeFalhaDeArmazenamento` já contemplam `conflito`, `nao_encontrado` e `indisponivel`. Leitura de lista (`listarAgendamentos`, `listarItensAvaliados`) segue o padrão de `listarCartoes`/`listarRegistrosDesde`. Nenhum erro do driver atravessa a Porta (FR-107, FR-108).

---

## 3. Acervo (`backend/src/acervo/acervo.ts`)

### 3.1 Corpo de registro estendido

```ts
export interface DadosDeRegistro {
  id: unknown;            // UUID (FR-163)
  origem: unknown;        // "baralho" | "revisao"
  baralhoId: unknown;     // string não vazia (baralho) — ignorado/derivado na revisão
  nomeDoBaralho: unknown; // 1..100 caracteres (baralho) — ignorado/derivado na revisão
  itens: unknown;         // [{ frente, verso, cartaoId, avaliacao }]
}
```

### 3.2 Tipos de retorno novos

```ts
/** A `ContagemDaRevisao` do Module puro mais o total exibido em Início. */
export interface ResumoDaRevisao {
  vencidos: number;
  novosHoje: number;
  total: number; // vencidos + novosHoje
}

export interface ItemDoLoteDeRevisao {
  cartao: Cartao;
  previa: Record<Avaliacao, string>; // ISO por nível (FR-221)
}

export interface OpcaoDeAlgoritmo {
  id: string;      // "sm2"
  rotulo: string;  // "SM-2"
}

export interface PreferenciasDoUsuario {
  algoritmo: string;
  limiteDeNovosPorDia: number;
  algoritmos: OpcaoDeAlgoritmo[]; // lista para a tela de Preferências
}

export type ResultadoDoResumoDaRevisao =
  | { ok: true; resumo: ResumoDaRevisao }
  | { ok: false; erro: "dados_invalidos" | "indisponivel" };

export type ResultadoDoLoteDeRevisao =
  | { ok: true; itens: ItemDoLoteDeRevisao[] }
  | { ok: false; erro: "dados_invalidos" | "indisponivel" };

export type ResultadoDasPrevias =
  | { ok: true; previas: Record<string, Record<Avaliacao, string>> }
  | { ok: false; erro: "dados_invalidos" | "indisponivel" };

export type ResultadoDeObterPreferencias =
  | { ok: true; preferencias: PreferenciasDoUsuario }
  | { ok: false; erro: "indisponivel" };

export type ResultadoDeSalvarPreferencias =
  | { ok: true; preferencias: PreferenciasDoUsuario }
  | { ok: false; erro: "dados_invalidos" | "indisponivel" };
```

### 3.3 Métodos em `Acervo`

```ts
/** Resumo de Início: vencidos e novos disponíveis hoje (FR-198, FR-199). */
obterResumoDaRevisao(
  inicioDoDia: unknown, // ISO-8601
  fimDoDia: unknown,    // ISO-8601
): Promise<ResultadoDoResumoDaRevisao>;

/** Lote da Revisão do dia, até 20 Itens, com prévia por Cartão (FR-201, FR-203, FR-221). */
obterLoteDeRevisao(
  inicioDoDia: unknown,
  fimDoDia: unknown,
): Promise<ResultadoDoLoteDeRevisao>;

/** Prévia dos Cartões informados, para o estudo livre (FR-221). cartaoIds ≤ 200. */
obterPrevias(cartaoIds: unknown): Promise<ResultadoDasPrevias>;

/** Preferências do Usuário + lista de algoritmos (FR-212). */
obterPreferencias(): Promise<ResultadoDeObterPreferencias>;

/** Salva Preferências; algoritmo diferente dispara a reconstrução (FR-212, FR-213). */
salvarPreferencias(dados: unknown): Promise<ResultadoDeSalvarPreferencias>;

/** Estendido: aplica as Avaliações aos Agendamentos na MESMA transação do Registro (FR-210). */
registrarSessao(dados: DadosDeRegistro): Promise<ResultadoDeRegistroDeSessao>;
```

**Invariantes de `registrarSessao` (falha → `dados_invalidos`, FR-194, FR-196)**

- `id` é um UUID; `origem ∈ { "baralho", "revisao" }`.
- `itens` tem ao menos 1 elemento, com os mesmos limites da `013`; cada Item tem `frente`/`verso` nos limites de Cartão vigentes, `cartaoId` string não vazia e `avaliacao` ∈ 4 níveis.
- `resultado` é **derivado** (`errei` → `errou`; `dificil`/`bom`/`facil` → `acertou`); não vem do cliente.
- `origem = "revisao"`: `baralhoId` e `nomeDoBaralho` são **derivados** para `""` e `"Revisão do dia"`. `origem = "baralho"`: `baralhoId` string não vazia e `nomeDoBaralho` com 1 a 100 caracteres.
- O servidor deriva `estudados`, `acertos`, `erros` e `posicao`, define `concluidaEm` na **primeira** inserção (FR-163) e, **só se o Registro for novo**, aplica cada Avaliação na ordem dos Itens aos Agendamentos, com o algoritmo das Preferências e `agora` = instante do servidor (D4). Reenvio → sem reaplicar (FR-210, SC-085). Cartão inexistente → Item registrado, Agendamento não criado.

**Invariantes de `salvarPreferencias`**

- `algoritmo` precisa estar em `ALGORITMOS` (desconhecido cai para SM-2 em `algoritmoPorId`); `limiteDeNovosPorDia` inteiro de 0 a 999 (FR-200).
- Algoritmo **diferente** do atual → apaga os Agendamentos do Usuário e reconstrói por replay de `listarItensAvaliados` + `reconstruir`, em ordem `(concluidaEm, posicao)`, com `agora` = `concluidaEm` de cada registro e `criadoEm` = instante da primeira Avaliação (FR-213, SC-083). Nenhum registro do Histórico é perdido (FR-213).

---

## 4. HTTP (`backend/src/http/rotas.ts`)

Todas as rotas exigem Credencial (hook existente), são isoladas por Usuário (FR-219) e erros seguem o formato JSON existente. **Todas** são registradas em `registrarRotasDaAplicacao` de `backend/src/http/servidor.ts` (a lista única usada por local e nuvem), e o teste de paridade em `backend/tests/funcao/funcao.test.ts` chama **cada** rota nova pela função da nuvem (D6).

| Método e rota | Corpo / query | Respostas |
| --- | --- | --- |
| `GET /revisao?inicioDoDia=<ISO>&fimDoDia=<ISO>` | — | `200 { vencidos, novosHoje, total }`; `400 {erro:"dados_invalidos"}`; `503` |
| `GET /revisao/lote?inicioDoDia=<ISO>&fimDoDia=<ISO>` | — | `200 { itens: [{ cartao, previa }] }` (até 20); `400`; `503` |
| `POST /previas` | `{ cartaoIds: string[] }` (≤ 200) | `200 { previas: { [cartaoId]: Record<Avaliacao, ISO> } }`; `400`; `503` |
| `GET /preferencias` | — | `200 { algoritmo, limiteDeNovosPorDia, algoritmos: [{id, rotulo}] }`; `503` |
| `PUT /preferencias` | `{ algoritmo, limiteDeNovosPorDia }` | `200 { algoritmo, limiteDeNovosPorDia, algoritmos: [{id, rotulo}] }` (mesmo corpo do `GET`); `400 {erro:"dados_invalidos"}`; `503` |
| `POST /sessoes` (estendido, D4) | `{ id, origem, baralhoId, nomeDoBaralho, itens:[{frente,verso,cartaoId,avaliacao}] }` | `201` (criado) ou `200` (já existia, mesmo corpo) com `RegistroDeSessao`; `400 {erro:"dados_invalidos"}`; `409 {erro:"conflito"}`; `503` |

- `POST /sessoes` mantém o comportamento da `013` (idempotência pelo `id`, `200` no reenvio com o mesmo corpo), agora aplicando as Avaliações aos Agendamentos só quando o Registro é novo (FR-210).
- `PUT /preferencias` com algoritmo diferente dispara a reconstrução (FR-213); a resposta é `200` com as Preferências salvas.
- Outro Usuário é tratado como inexistente em todas as rotas (FR-219).

---

## 5. Cliente do frontend (`frontend/src/acervo-cliente/cliente.ts`)

Tipos novos e alterados; implementados em `cliente-http.ts` e `cliente-em-memoria.ts` e envolvidos em `guarda-de-credencial.ts`. O em memória é idempotente pelo `id` e usa uma **prévia fixa simples e documentada** (os testes de algoritmo ficam no backend, D7).

### 5.1 Tipos

```ts
export type Avaliacao = "errei" | "dificil" | "bom" | "facil";

export interface ItemRegistrado {
  posicao: number;
  frente: string;
  verso: string;
  resultado: "acertou" | "errou";
  cartaoId?: string | null;
  avaliacao?: Avaliacao | null;
}

export interface RegistroResumido {
  id: string;
  baralhoId: string;
  nomeDoBaralho: string;
  concluidaEm: string;
  estudados: number;
  acertos: number;
  erros: number;
  origem: "baralho" | "revisao";
}

export interface RegistroDeSessao extends RegistroResumido { itens: ItemRegistrado[] }

export interface DadosDeRegistro {
  id: string;
  origem: "baralho" | "revisao";
  baralhoId: string;
  nomeDoBaralho: string;
  itens: { frente: string; verso: string; cartaoId: string; avaliacao: Avaliacao }[];
}

export type Previa = Record<Avaliacao, string>; // ISO por nível

export interface ResumoDaRevisao { vencidos: number; novosHoje: number; total: number }

export interface ItemDoLoteDeRevisao { cartao: Cartao; previa: Previa }

export interface OpcaoDeAlgoritmo { id: string; rotulo: string }

export interface Preferencias {
  algoritmo: string;
  limiteDeNovosPorDia: number;
  algoritmos: OpcaoDeAlgoritmo[];
}

export type ResultadoDoResumoDaRevisao =
  | { ok: true; resumo: ResumoDaRevisao }
  | { ok: false; erro: typeof INDISPONIVEL | typeof NAO_AUTENTICADO; mensagem: string };

export type ResultadoDoLoteDeRevisao =
  | { ok: true; itens: ItemDoLoteDeRevisao[] }
  | { ok: false; erro: typeof INDISPONIVEL | typeof NAO_AUTENTICADO; mensagem: string };

export type ResultadoDasPrevias =
  | { ok: true; previas: Record<string, Previa> }
  | { ok: false; erro: typeof INDISPONIVEL | typeof NAO_AUTENTICADO; mensagem: string };

export type ResultadoDePreferencias =
  | { ok: true; preferencias: Preferencias }
  | { ok: false; erro: typeof INDISPONIVEL | typeof NAO_AUTENTICADO; mensagem: string };

export type ResultadoDeSalvarPreferencias =
  | { ok: true; preferencias: Preferencias }
  | { ok: false; erro: "dados_invalidos" | typeof INDISPONIVEL | typeof NAO_AUTENTICADO; mensagem: string };
```

`ResultadoDeRegistroDeSessao` permanece o da `013`, com `registro: RegistroDeSessao` agora contendo `origem` e Itens com `cartaoId`/`avaliacao`.

### 5.2 Métodos novos em `ClienteDoAcervo`

```ts
obterResumoDaRevisao(inicioDoDia: string, fimDoDia: string): Promise<ResultadoDoResumoDaRevisao>;
obterLoteDeRevisao(inicioDoDia: string, fimDoDia: string): Promise<ResultadoDoLoteDeRevisao>;
obterPrevias(cartaoIds: string[]): Promise<ResultadoDasPrevias>;
obterPreferencias(): Promise<ResultadoDePreferencias>;
salvarPreferencias(preferencias: {
  algoritmo: string;
  limiteDeNovosPorDia: number;
}): Promise<ResultadoDeSalvarPreferencias>;
registrarSessao(dados: DadosDeRegistro): Promise<ResultadoDeRegistroDeSessao>;
```

As mensagens de falha seguem o padrão das existentes.

---

## 6. Module puro `frontend/src/revisao/dia.ts`

```ts
/** 00:00 e 24:00 locais do dia de `agora`, em ISO-8601 (FR-204, D3). */
export function limitesDoDia(agora: Date): { inicioDoDia: string; fimDoDia: string };

/** "hoje" | "amanhã" | "N dias", por dias locais (FR-221). */
export function rotuloDaPrevia(agora: Date, iso: string): string;
```

**Invariantes**

- Baseado no fuso do **navegador** (FR-204); a meia-noite local é o corte do limite de novos.
- `rotuloDaPrevia` é usado pelos 4 botões ("Bom · 3 dias", "Errei · amanhã", D7, FR-221) e **não** reimplementa o algoritmo (a prévia ISO vem do servidor).

---

## 7. Rotas da interface (`frontend/src/ui/navegacao.ts`)

- `Rota` ganha `{ nome: "revisao" }` (`#/revisao`) e `{ nome: "preferencias" }` (`#/preferencias`).
- `destinoAtivo` passa a devolver `"inicio" | "cartoes" | "baralhos" | "preferencias" | null`, com `revisao` → `"inicio"` (a Revisão do dia é lançada de Início) e `preferencias` → `"preferencias"`.
- **Moldura**: links Início, Baralhos, Cartões, **Preferências**, Sair.
- Novas páginas: `PaginaDaRevisao.tsx` (`#/revisao`, D7) e `PaginaDePreferencias.tsx` (`#/preferencias`, D7).
- `PaginaDeInicio.tsx`: bloco "N Cartões para revisar hoje" + novos + botão "Revisar", com carregamento/falha/sucesso próprios (FR-198, FR-199, FR-202, FR-217).

---

## 8. Sessão de estudo e Resumo

### 8.1 `frontend/src/sessao-de-estudo/sessao-de-estudo.ts` (D7)

- `Resultado` (Acertei/Errei) é substituído por **`Avaliacao`** (4 níveis); o `resultado` (`"acertou" | "errou"`) passa a ser **derivado**: `errei` → `errou`; `dificil`/`bom`/`facil` → `acertou` (FR-194, FR-195).
- O Item em estudo guarda o `cartaoId` para compor o `DadosDeRegistro`.
- Duas formas de criar a Sessão: a do estudo livre (Baralho, quantidade e seleção aleatória, como hoje) e a da Revisão do dia, a partir da lista **já ordenada** do lote, **sem embaralhar** (FR-201).
- No estudo livre, `PaginaDeEstudo.tsx` obtém as prévias com `obterPrevias(cartaoIds)` ao iniciar a Sessão, em blocos de até 200 `cartaoIds`; na Revisão do dia, elas vêm no lote. Uma falha ao obter as prévias não impede o estudo: os botões aparecem sem a prévia, e a falha é anunciada.
- `PaginaDeEstudo.tsx`: quatro botões (Errei, Difícil, Bom, Fácil) com a prévia de cada um ("Bom · 3 dias"), habilitados **somente após a Revelação** (FR-193, FR-221); atalhos 1–4 após a Revelação (FR-218); envia `origem: "baralho"`.
- Acessibilidade: teclado, nomes acessíveis (a prévia está no nome do botão), alvos de 44 px, sem depender de cor (FR-218).

### 8.2 Resumo (`frontend/src/ui/ResumoDaSessao.tsx`)

```tsx
import type { Avaliacao } from "../acervo-cliente/cliente";

export interface ItemDoResumo {
  frente: string;
  verso: string;
  resultado: "acertou" | "errou";
  avaliacao?: Avaliacao | null; // ausente/nula em Registros anteriores à 015
}

export function ResumoDaSessao(props: {
  itens: readonly ItemDoResumo[];      // na ordem apresentada; totais derivados daqui
  origem?: "baralho" | "revisao";      // "revisao" mostra "Revisão do dia"
  children?: ReactNode;                // ações ("Continuar revisão", "Voltar a Início")
}): JSX.Element;
```

Renderiza adicionalmente:

- a **contagem por nível de Avaliação** (Errei, Difícil, Bom, Fácil), além do percentual (FR-152) e do total (FR-216);
- para `origem === "revisao"`, "Revisão do dia" no lugar do nome do Baralho, e as ações "Continuar revisão" (próximo lote, quando ainda houver Cartões para hoje) e "Voltar a Início" (FR-215);
- Registros antigos, sem Avaliação, aparecem **exatamente como antes** (FR-197, FR-214).

O componente continua sem `h1`: o título é da página que o usa.

### 8.3 Rever registro (`frontend/src/ui/PaginaDoRegistro.tsx`)

- `GET /sessoes/:id` continua com `{ registro, baralhoExiste }`. Para `registro.origem === "revisao"`, o Acervo não procura Baralho e devolve `baralhoExiste: false`.
- A página decide pela `origem`: na Revisão do dia mostra "Revisão do dia", sem o selo "Baralho excluído" e sem link para Baralho (FR-215). Para `origem === "baralho"`, tudo continua como na `013` (FR-178).
