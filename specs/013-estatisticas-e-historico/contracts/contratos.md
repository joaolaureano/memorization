# Contratos da 013

Os contratos são **fixos**. Workers paralelos implementam cada ponta contra eles, sem reabrir assinaturas.

## 1. Porta de armazenamento (`backend/src/armazenamento/porta.ts`)

Os tipos novos e os métodos abaixo são acrescentados a `ArmazenamentoDoAcervo`. Os dois Adapters (SQLite e PostgreSQL) implementam os mesmos métodos.

```ts
export type ResultadoDoItemRegistrado = "acertou" | "errou";

export interface ItemRegistrado {
  readonly posicao: number;          // 0..n-1, ordem apresentada
  readonly frente: string;
  readonly verso: string;
  readonly resultado: ResultadoDoItemRegistrado;
}

export interface RegistroDeSessao {
  readonly id: string;               // UUID gerado pelo cliente (idempotência, FR-163)
  readonly baralhoId: string;        // sem chave estrangeira: o Baralho pode ser excluído depois
  readonly nomeDoBaralho: string;    // nome no momento da conclusão
  readonly concluidaEm: string;      // ISO-8601 UTC, definido pelo servidor na 1ª inserção
  readonly estudados: number;
  readonly acertos: number;
  readonly erros: number;
  readonly itens: readonly ItemRegistrado[];
}

/** Linha de listagem: sem os itens. */
export type RegistroResumido = Omit<RegistroDeSessao, "itens">;

// em ArmazenamentoDoAcervo:
/** Insere; se já existe registro com o mesmo id DESTE usuário, devolve o existente sem alterar (ok).
 *  Mesmo id de OUTRO usuário: { ok:false, erro:"conflito" }. Indisponível: { ok:false, erro:"indisponivel" }. */
inserirRegistroDeSessao(usuarioId: string, registro: RegistroDeSessao): Promise<Desfecho<RegistroDeSessao>>;
/** Registros com concluidaEm >= desde (ISO), do mais recente ao mais antigo. */
listarRegistrosDesde(usuarioId: string, desde: string): Promise<RegistroResumido[]>;
/** Os `limite` registros mais recentes. */
listarRegistrosRecentes(usuarioId: string, limite: number): Promise<RegistroResumido[]>;
/** Registro completo com itens na ordem; de outro usuário ou inexistente: { ok:false, erro:"nao_encontrado" }. */
obterRegistroDeSessao(usuarioId: string, id: string): Promise<Desfecho<RegistroDeSessao>>;
```

`Desfecho` e os códigos seguem o padrão existente em `porta.ts`. Se faltar algum código (`conflito`), ele é acrescentado a `CodigoDeFalhaDeArmazenamento`.

**Migração 6**, igual nos dois Adapters:

```sql
CREATE TABLE registro_de_sessao (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  baralho_id TEXT NOT NULL,
  nome_do_baralho TEXT NOT NULL,
  concluida_em TEXT NOT NULL,                 -- PostgreSQL: TIMESTAMPTZ
  estudados INTEGER NOT NULL CHECK (estudados >= 1),
  acertos INTEGER NOT NULL CHECK (acertos >= 0),
  erros INTEGER NOT NULL CHECK (erros >= 0),
  CHECK (acertos + erros = estudados)
);
CREATE INDEX registro_de_sessao_usuario_concluida ON registro_de_sessao (usuario_id, concluida_em DESC);
CREATE TABLE item_de_registro (
  registro_id TEXT NOT NULL REFERENCES registro_de_sessao(id) ON DELETE CASCADE,
  posicao INTEGER NOT NULL,
  frente TEXT NOT NULL,
  verso TEXT NOT NULL,
  resultado TEXT NOT NULL CHECK (resultado IN ('acertou','errou')),
  PRIMARY KEY (registro_id, posicao)
);
```

Os tipos seguem as convenções de cada Adapter, conforme as tabelas existentes (ids, chave estrangeira para usuário e timestamps). A inserção de registro e itens acontece numa transação.

## 2. Acervo (`backend/src/acervo/acervo.ts`)

```ts
export interface DadosDeRegistro {               // corpo vindo do cliente
  id: unknown; baralhoId: unknown; nomeDoBaralho: unknown;
  itens: unknown;                                // [{ frente, verso, resultado }]
}
export type ResultadoDeRegistroDeSessao =
  | { ok: true; registro: RegistroDeSessao }
  | { ok: false; erro: "dados_invalidos" | "conflito" | "indisponivel" };
export interface Estatisticas {
  cartoes: number;                               // total atual do acervo
  baralhos: number;
  registrosDaJanela: RegistroResumido[];         // concluidaEm >= desde
  recentes: RegistroResumido[];                  // 5 mais recentes
}
export type ResultadoDeEstatisticas = { ok: true; estatisticas: Estatisticas } | { ok: false; erro: "dados_invalidos" | "indisponivel" };
export type ResultadoDeObterRegistro =
  | { ok: true; registro: RegistroDeSessao; baralhoExiste: boolean }
  | { ok: false; erro: "nao_encontrado" | "indisponivel" };

// em Acervo:
registrarSessao(dados: DadosDeRegistro): Promise<ResultadoDeRegistroDeSessao>;
obterEstatisticas(desde: string): Promise<ResultadoDeEstatisticas>;
obterRegistroDeSessao(id: string): Promise<ResultadoDeObterRegistro>;
```

Invariantes de `registrarSessao` (falha → `dados_invalidos`):
- `id` é um UUID;
- `baralhoId` é uma string não vazia;
- `nomeDoBaralho` tem de 1 a 100 caracteres;
- `itens` tem de 1 a 1000 elementos;
- `frente` e `verso` respeitam os limites de Cartão vigentes;
- `resultado` ∈ {acertou, errou}.

O servidor deriva `estudados`, `acertos`, `erros` e `posicao` dos itens e define `concluidaEm` como o instante atual na primeira inserção.

`desde` precisa ser um instante ISO-8601 válido, até 31 dias no passado; fora disso, `dados_invalidos`.

## 3. HTTP (`backend/src/http/rotas.ts`)

Todas as rotas exigem Credencial (hook existente) e são isoladas por Usuário.

| Método e rota | Corpo / query | Respostas |
| --- | --- | --- |
| `POST /sessoes` | `{ id, baralhoId, nomeDoBaralho, itens:[{frente,verso,resultado}] }` | `201` (criado) ou `200` (já existia, mesmo corpo de resposta) com `RegistroDeSessao`; `400 {erro:"dados_invalidos"}`; `409 {erro:"conflito"}`; `503` |
| `GET /estatisticas?desde=<ISO>` | — | `200 Estatisticas`; `400`; `503` |
| `GET /sessoes/:id` | — | `200 { registro, baralhoExiste }`; `404 {erro:"nao_encontrado"}`; `503` |

Os erros seguem o formato JSON das rotas existentes.

## 4. Cliente do frontend (`frontend/src/acervo-cliente/cliente.ts`)

```ts
export interface ItemRegistrado { posicao: number; frente: string; verso: string; resultado: "acertou" | "errou" }
export interface RegistroResumido { id: string; baralhoId: string; nomeDoBaralho: string; concluidaEm: string; estudados: number; acertos: number; erros: number }
export interface RegistroDeSessao extends RegistroResumido { itens: ItemRegistrado[] }
export interface DadosDeRegistro { id: string; baralhoId: string; nomeDoBaralho: string; itens: { frente: string; verso: string; resultado: "acertou" | "errou" }[] }
export interface Estatisticas { cartoes: number; baralhos: number; registrosDaJanela: RegistroResumido[]; recentes: RegistroResumido[] }

export type ResultadoDeRegistroDeSessao = { ok: true; registro: RegistroDeSessao } | { ok: false; erro: "dados_invalidos" | "conflito" | typeof INDISPONIVEL | typeof NAO_AUTENTICADO; mensagem: string };
export type ResultadoDeEstatisticas = { ok: true; estatisticas: Estatisticas } | { ok: false; erro: typeof INDISPONIVEL | typeof NAO_AUTENTICADO; mensagem: string };
export type ResultadoDeObterRegistro = { ok: true; registro: RegistroDeSessao; baralhoExiste: boolean } | { ok: false; erro: "nao_encontrado" | typeof INDISPONIVEL | typeof NAO_AUTENTICADO; mensagem: string };

// em ClienteDoAcervo:
registrarSessao(dados: DadosDeRegistro): Promise<ResultadoDeRegistroDeSessao>;
obterEstatisticas(desde: string): Promise<ResultadoDeEstatisticas>;
obterRegistroDeSessao(id: string): Promise<ResultadoDeObterRegistro>;
```

Os três métodos são implementados em `cliente-http.ts` e `cliente-em-memoria.ts` (o em memória é idempotente pelo id e usa `new Date().toISOString()`) e envolvidos em `guarda-de-credencial.ts`. As mensagens de falha seguem o padrão das existentes.

## 5. Módulo puro de Estatísticas (`frontend/src/estatisticas/estatisticas.ts`)

```ts
export interface DiaDeEstudo { data: string /* AAAA-MM-DD local */; rotulo: string /* "seg", "ter"... ; "Hoje" para hoje */; itens: number }
export function inicioDaJanela(agora: Date): Date;                       // 00:00 local de 6 dias atrás
export function itensPorDia(registros: RegistroResumido[], agora: Date): DiaDeEstudo[]; // 7 entradas, a mais antiga primeiro, fuso local
export function taxaDeAcerto(registros: RegistroResumido[]): number | null; // round(Σacertos/Σestudados*100); null sem itens
```

## 6. Rotas da interface (`frontend/src/ui/navegacao.ts`)

- `Rota` ganha `{ nome: "inicio" }` (`#/inicio`) e `{ nome: "registro"; id: string }` (`#/sessoes/:id`).
- `ROTA_PADRAO = "#/inicio"`. Com Credencial, hash vazio, desconhecido e `#/entrar` resolvem em `inicio`.
- `destinoAtivo` passa a devolver `"inicio" | "cartoes" | "baralhos" | null`, com `registro` → `"inicio"`.
- Moldura: links Início, Baralhos e Cartões, nessa ordem.

## 7. Componente de Resumo (`frontend/src/ui/ResumoDaSessao.tsx`)

```tsx
export interface ItemDoResumo { frente: string; verso: string; resultado: "acertou" | "errou" }
export function ResumoDaSessao(props: {
  itens: readonly ItemDoResumo[];   // na ordem apresentada; os totais são derivados daqui
  children?: ReactNode;             // ações (ex.: Voltar para o Baralho), renderizadas ao fim
}): JSX.Element;
```

Renderiza:
- o percentual (`percentual`) com o texto "de acertos" e "n de N Itens";
- dois botões, "Acertos (n)" e "Erros (n)" (`botao botao--secundario`, `aria-expanded`, `aria-controls`), que expandem e recolhem as listas (`ul.lista` com `cartao`, `lado-do-cartao` Frente/Verso);
- um grupo vazio deixa o botão `disabled`, com `aria-describedby` apontando para o texto "Nenhum acerto nesta Sessão" / "Nenhum erro nesta Sessão".

O componente não tem h1: o título é da página que o usa.
