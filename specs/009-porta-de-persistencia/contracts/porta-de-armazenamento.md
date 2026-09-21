# Contract — Porta de Armazenamento

A Interface por onde **todo** Module do acervo e da identidade lê e grava dados
persistidos. É a única coisa que eles conhecem sobre armazenamento (FR-100). Em
pseudocódigo de forma, sem implementação: o que o Adapter faz por dentro é
Implementation, e cada Adapter faz do seu jeito.

Declarada em `backend/src/armazenamento/porta.ts`, ao lado de nenhum Adapter.

## Assinatura

```text
interface ArmazenamentoDoAcervo
  // Cartão
  inserirCartao(cartao: Cartao): Promise<Desfecho<Cartao>>
  listarCartoes(): Promise<Cartao[]>
  obterCartao(id: string): Promise<Desfecho<Cartao>>
  atualizarCartao(cartao: Cartao): Promise<Desfecho<Cartao>>
  excluirCartao(id: string): Promise<Desfecho<void>>

  // Baralho
  inserirBaralho(baralho: Baralho): Promise<Desfecho<Baralho>>
  listarBaralhos(): Promise<Baralho[]>
  obterBaralho(id: string): Promise<Desfecho<Baralho>>
  atualizarBaralho(baralho: Baralho): Promise<Desfecho<Baralho>>
  excluirBaralho(id: string): Promise<Desfecho<void>>

  // Vínculo
  vincular(cartaoId: string, baralhoId: string): Promise<Desfecho<void>>
  desvincular(cartaoId: string, baralhoId: string): Promise<Desfecho<void>>
  listarBaralhosDoCartao(cartaoId: string): Promise<Baralho[]>
  listarCartoesDoBaralho(baralhoId: string): Promise<Cartao[]>

  // Contagens — insumo da elegibilidade derivada, nunca armazenada
  contarCartoesPorBaralho(): Promise<ContagemPorBaralho[]>
```

`Cartao` é `{ id, frente, verso }` e `Baralho` é `{ id, nome }` — as entidades
duráveis como o armazenamento as guarda, e nada além. Elas são declaradas pela
**Porta**, e o Module as re-exporta na sua Interface, de modo que nenhum caller
mude ao trocar de Adapter. `ContagemPorBaralho` é
`{ baralhoId, quantidadeDeCartoes }`.

## Desfechos tipados

```text
Desfecho<T> =
    { ok: true;  valor: T }
  | { ok: false; erro: "nao_encontrado" }
  | { ok: false; erro: "vinculo_duplicado" }     // apenas em `vincular`
  | { ok: false; erro: "indisponivel" }
```

| Desfecho | Significado | Quem o produz | Quem o traduz para o usuário |
|---|---|---|---|
| `nao_encontrado` | Não há linha a ler, a alterar ou a excluir | O Adapter, ao ver zero linhas afetadas ou devolvidas | O Module, com o código estável e a mensagem em português que a Interface dele já usa |
| `vinculo_duplicado` | O par (Cartão, Baralho) já existe | O Adapter, ao reconhecer a unicidade do par no seu esquema | O Module, com a recusa que a Interface dele já usa |
| `indisponivel` | O armazenamento falhou: arquivo, conexão, transação ou consulta | O Adapter, ao encontrar qualquer falha de armazenamento | O Module, com mensagem própria em português; a operação não é apresentada como concluída (FR-044, FR-045, FR-107) |

Três regras sobre desfechos:

1. **Nada de erro do driver atravessa a Porta.** A violação de unicidade do
   Vínculo, a ausência de linha e a falha do armazenamento chegam todas como
   resultado tipado. Nenhuma delas é exceção, e nenhuma delas traz texto do
   driver, caminho de arquivo, cadeia de conexão ou endereço com credencial
   (FR-107, FR-108).
2. **A Porta não tem texto em português.** Os códigos são vocabulário de
   armazenamento. A frase que o usuário lê é do Module, que é o dono da regra de
   domínio (FR-100).
3. **`indisponivel` nunca significa "concluído".** Quem recebe esse desfecho não
   apresenta a operação como feita, e o conteúdo informado pelo usuário continua
   disponível para nova tentativa (FR-044, FR-045).

## Invariantes que a Interface garante ao caller

- **Toda operação devolve `Promise`.** Não há caminho síncrono, porque os drivers
  do armazenamento de nuvem não o oferecem. O Adapter do armazenamento local
  envolve a API síncrona do driver embutido.
- **Nenhuma operação recebe escolha de armazenamento.** A escolha é da
  construção, e a Porta não a vê. Também não recebe SQL, dialeto, transação,
  conexão, caminho de arquivo ou endereço.
- **O par (Cartão, Baralho) é único**, e o Vínculo repetido é recusado como
  resultado, não como falha.
- **As contagens são derivadas na leitura.** A Porta não guarda total, contador
  nem marca de elegibilidade; a regra de elegibilidade é do Module.
- **Desvincular preserva Cartão e Baralho**; excluir um Cartão ou um Baralho
  preserva a entidade do outro lado.
- **A ordem das listagens é da Interface do Module**, e não da Porta: o Module
  ordena o que precisa ordenar, e a Porta só devolve linhas.

## Segunda Porta — `ArmazenamentoDeUsuarios`

Declarada no mesmo arquivo quando a `007-criar-usuario` for implementada, e
implementada pelos **mesmos** Adapters:

```text
interface ArmazenamentoDeUsuarios
  inserirUsuario(usuario: Usuario): Promise<Desfecho<Usuario>>
  obterUsuarioPorNomeDeUsuario(nomeDeUsuario: string): Promise<Desfecho<Usuario>>
```

`Usuario` é o Usuário **como o armazenamento o guarda**:
`{ id, nomeDeUsuario, sal, hash, parametros }` — o Nome de usuário e a
transformação irreversível da Senha, nunca a Senha. Esse é o formato de
armazenamento; o `Identidade` devolve apenas `{ id, nomeDeUsuario }`, que é forma
de Interface, não de banco. O Nome de usuário
já existente chega como desfecho tipado — `{ ok: false, erro:
"nome_de_usuario_existente" }` —, e **não** como erro de unicidade do driver: é a
mesma regra dos outros desfechos. A derivação, a validação e as mensagens
continuam inteiramente no Module `Identidade`.

Nada além dessas duas operações é decidido aqui: as colunas, a migração 4 e as
regras de Cadastro são assunto do plano da `007`.

## O que a Porta não tem — e por quê

| Não existe na Porta | Motivo |
|---|---|
| SQL, dialeto, construtor de consulta | Faria o dialeto atravessar o domínio, contra FR-100 |
| Conexão, transação ou piscina de conexões exposta | É Implementation de cada Adapter |
| Caminho de arquivo, URL, senha ou qualquer configuração de conexão | A Porta não é lugar de segredo; a configuração vive na raiz de composição |
| Escolha de armazenamento como parâmetro | A escolha é da construção; nenhuma operação escolhe armazenamento |
| Operação de criar esquema, aplicar migrações ou abrir/fechar o armazenamento | Ciclo de vida é do Adapter, exposto pela sua fábrica, e não pela Porta |
| Código de erro do driver, mensagem do driver ou exceção prevista | Substituídos pelos desfechos tipados |
| Texto em português | As mensagens são dos Modules |

## Adapters

| Adapter | Onde | Estado |
|---|---|---|
| Armazenamento local, SQLite em arquivo | `backend/src/armazenamento/sqlite/` | Entregue por esta feature; é o Adapter da execução local (FR-103) |
| PostgreSQL, apontado por URL de conexão | `backend/src/armazenamento/postgresql/` | Entregue por `010-postgresql-na-nuvem`; mencionado aqui apenas como o segundo Adapter que torna a Seam real |

Cada Adapter é dono do DDL do seu dialeto e das suas migrações; a numeração das
migrações é compartilhada, de modo que uma base migrada por um Adapter está na
mesma versão para o outro.

## Como a Porta é verificada

Uma única bateria compartilhada de cenários, aplicável a qualquer Adapter:
`backend/tests/armazenamento/bateria-da-porta.ts`. Ela recebe uma **fábrica** de
Adapter — algo que devolve a Porta e o encerramento — e registra os cenários de
inserir, listar, obter, atualizar, excluir, vincular, desvincular, contagens e
desfechos, sem nomear armazenamento algum (FR-106).

- `backend/tests/armazenamento/sqlite.test.ts` roda a bateria contra o Adapter
  local, exigindo cem por cento de aprovação (SC-039);
- a `010` acrescenta `backend/tests/armazenamento/postgresql.test.ts`, chamando a
  **mesma** função, sem editar a bateria e sem editar nenhum Module (SC-039);
- nenhum Module é alterado por acrescentar um Adapter (SC-043), e nenhum Module
  importa `node:sqlite`, driver de PostgreSQL ou diretório de Adapter — o único
  import permitido é `backend/src/armazenamento/porta.ts` (FR-100, SC-043).
