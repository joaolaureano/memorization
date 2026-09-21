# Phase 1 — Data Model: Porta de Persistência

Modelo derivado da spec e do glossário canônico de `CONTEXT.md`.

## Escopo desta feature

Esta feature **não acrescenta entidade durável**: nenhuma tabela, nenhuma coluna e
nenhum índice. O que ela acrescenta é o **modelo da Porta** — as formas que
atravessam a fronteira entre os Modules e o armazenamento — e um novo lugar para o
DDL que já existe: as migrações 1 a 3 passam de `backend/src/acervo/` para
`backend/src/armazenamento/sqlite/`, com conteúdo e números de versão inalterados,
para que um arquivo local já existente continue abrindo na mesma versão
(FR-103, FR-104).

## Entidades duráveis — as que já existem, e nada além

| Entidade | Colunas | Estado nesta feature |
|---|---|---|
| **Cartão** | `id` (texto, chave primária), `frente`, `verso` | Inalterada: mesmas colunas, mesmas `CHECK` de conteúdo, `id` opaco, Frente não é identificador |
| **Baralho** | `id` (texto, chave primária), `nome` | Inalterada: nome é rótulo, não identificador; sem `UNIQUE` sobre `nome` |
| **Vínculo** | `cartao_id`, `baralho_id` | Inalterada: chave primária composta (o par é único no esquema) e as duas cascatas |
| **versao_do_esquema** | `versao` (inteiro) | Inalterada: uma linha por base, criada sob demanda; **compartilhada por todos os Adapters**, que é o que faz a versão da base ser a mesma para os dois |

As restrições `CHECK`, a chave primária composta e as cascatas são **as que já
existem** nas migrações 1 a 3: esta feature move o arquivo de migrações, e não o
conteúdo. Em caso de divergência entre este documento e o código movido, vale o
código movido — que é, literalmente, o de antes.

## Modelo da Porta — o que atravessa a fronteira

### Operações

`ArmazenamentoDoAcervo` é a Interface que o `Acervo` conhece. Ela é assíncrona:
**toda** operação devolve `Promise`. Nenhuma operação recebe SQL, dialeto,
conexão, transação ou escolha de armazenamento (FR-100).

| Operação | Recebe | Devolve |
|---|---|---|
| `inserirCartao` | `Cartao` (`id`, `frente`, `verso`) | `Desfecho<Cartao>` |
| `listarCartoes` | — | `Promise<Cartao[]>` |
| `obterCartao` | `id` | `Desfecho<Cartao>` |
| `atualizarCartao` | `Cartao` | `Desfecho<Cartao>` |
| `excluirCartao` | `id` | `Desfecho<void>` |
| `inserirBaralho` | `Baralho` (`id`, `nome`) | `Desfecho<Baralho>` |
| `listarBaralhos` | — | `Promise<Baralho[]>` |
| `obterBaralho` | `id` | `Desfecho<Baralho>` |
| `atualizarBaralho` | `Baralho` | `Desfecho<Baralho>` |
| `excluirBaralho` | `id` | `Desfecho<void>` |
| `vincular` | `cartaoId`, `baralhoId` | `Desfecho<void>` — recusa `vinculo_duplicado` e `nao_encontrado` |
| `desvincular` | `cartaoId`, `baralhoId` | `Desfecho<void>` — recusa `nao_encontrado` |
| `listarBaralhosDoCartao` | `cartaoId` | `Promise<Baralho[]>` |
| `listarCartoesDoBaralho` | `baralhoId` | `Promise<Cartao[]>` |
| `contarCartoesPorBaralho` | — | `Promise<ContagemPorBaralho[]>` — `{ baralhoId, quantidadeDeCartoes }` |

As formas `Cartao` e `Baralho` são as entidades duráveis como o armazenamento as
guarda, e é a **Porta** quem as declara; o Module as re-exporta na sua Interface,
de modo que nenhum caller perceba a mudança. As formas **derivadas na leitura** — o
Cartão com os seus Baralhos, o Baralho com contagem e elegibilidade — continuam
sendo do Module: a contagem vem da Porta, e a regra de elegibilidade (quantidade
maior que zero) não sai do domínio.

`contarCartoesPorBaralho` existe para que a elegibilidade continue **derivada,
nunca armazenada**: a contagem é lida dos Vínculos a cada listagem, como hoje, e a
Porta não ganha nenhuma coluna ou tabela de total.

### Desfechos

```
Desfecho<T> =
    { ok: true;  valor: T }
  | { ok: false; erro: "nao_encontrado" }        // nada foi encontrado para alterar ou ler
  | { ok: false; erro: "vinculo_duplicado" }     // o par (Cartão, Baralho) já existe
  | { ok: false; erro: "indisponivel" }          // o armazenamento falhou; nada foi persistido
```

| Desfecho | De onde vem | O que o Module faz |
|---|---|---|
| `nao_encontrado` | Nenhuma linha afetada ou devolvida | Traduz para o código estável que a Interface dele já usa, com a mensagem em português que já existe |
| `vinculo_duplicado` | Vínculo do par repetido, detectado pela unicidade do esquema | Traduz para a recusa que já existe, com a mensagem em português que já existe |
| `indisponivel` | Falha de arquivo, de conexão, de transação ou de consulta | Reporta a falha com mensagem própria em português; a operação **não** é apresentada como concluída (FR-044, FR-045, FR-107) |

Nenhum desfecho carrega texto do driver, caminho de arquivo, cadeia de conexão ou
endereço com credencial — o que é a garantia de que uma mensagem de driver nunca
chega à saída, ao registro ou à resposta (FR-108).

**A Porta não tem texto em português.** Os códigos acima são vocabulário de
armazenamento; a frase que o usuário lê é produzida pelo Module `Acervo` (e, na
`007`, pelo `Identidade`), que é o dono das regras de domínio.

## Migrações e esquema

Cada Adapter é dono do DDL do seu dialeto; a **ordem e os números de versão são
os mesmos** para todos os Adapters:

| Versão | O que faz | Onde vive |
|---|---|---|
| 1 | `cartao`, com as `CHECK` de Frente e Verso e a adoção de arquivo legado | `backend/src/armazenamento/sqlite/migracoes.ts` (movida de `src/acervo/`) |
| 2 | `baralho`, com a `CHECK` do nome | idem |
| 3 | `vinculo`, com chave primária composta e as duas cascatas | idem |
| 4 | `usuario` | Planejada por `007-criar-usuario`; será escrita por Adapter, com a mesma versão nos dois dialetos |
| 5 | Dono no acervo | Planejada por `008-entrar`; idem |

O aplicador continua o de hoje: chaves estrangeiras ligadas por conexão, tabela de
versão garantida sob demanda e cada migração numa transação com a elevação de
versão dentro dela — o que faz uma falha no meio não deixar estado parcial. A
`010` implementa a migração para PostgreSQL numa versão equivalente, com um
comando próprio, conforme o clarify daquela feature.

## Correspondência com as invariantes da spec

| Invariante da spec | Onde é garantida |
|---|---|
| Todo acesso a dados persistidos atravessa a Porta; nenhum Module conhece o armazenamento concreto | Porta em `backend/src/armazenamento/porta.ts` e Adapter importado apenas pela raiz de composição; verificado por teste que lê os imports dos Modules (FR-100, SC-043) |
| A Porta é a mesma para todos os Modules e para todos os Adapters, e nenhuma operação escolhe armazenamento | Assinatura única; nenhuma operação recebe escolha nem dialeto |
| O armazenamento é escolhido por parâmetro na construção; ausência ou valor não aceito impede construir e iniciar | Tabela de entradas de `scripts/construir.mjs`: só o que existe é aceito; nada é escrito em `dist/` na recusa (FR-102, SC-040) |
| Com o Adapter local, a persistência entre execuções e as migrações versionadas são as de `001` a `006` | Migrações movidas sem alterar conteúdo nem versão; arquivo local existente continua abrindo (FR-103, FR-104) |
| Nenhum segredo de conexão é exibido, registrado ou versionado, nem em mensagem de recusa | Linha de início só com o tipo de armazenamento; recusa da construção não repete o valor informado; nenhum desfecho carrega texto do driver (FR-108, SC-042) |
| Esta feature não acrescenta tela, campo ou ação | Contrato HTTP inalterado; frontend intocado (FR-105, SC-038) |

## O que este modelo deliberadamente não tem

- Tabela, coluna, arquivo ou cache que registre **qual armazenamento** está em uso:
  a escolha existe na construção, e não é dado persistido.
- Coluna, arquivo, mensagem ou registro com URL de conexão, senha, cadeia de
  conexão ou endereço com credencial (Princípio VIII).
- Executor genérico de consulta, tabela de chave e valor ou forma livre de dados:
  a Porta é feita de operações de domínio.
- Versão de esquema por Adapter: a tabela de versão continua sendo uma só por
  base, e a numeração é compartilhada pelos dois dialetos.
- Status de migração em tabela nova: as migrações aplicadas continuam sendo
  identificadas pela versão registrada, como hoje.
- Migração de dados entre o armazenamento local e a base em nuvem: adiada na
  spec; os dois armazenamentos não se falam nesta feature nem na `010`.
- Tabela de usuários (migração 4) e coluna de dono (migração 5): planejadas por
  `007` e `008`, com lugar reservado aqui e nenhum desenho antecipado.
