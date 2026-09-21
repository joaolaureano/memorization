# Quickstart — Validação da feature Porta de Persistência

## Pré-requisitos

Os mesmos de [`001`](../001-criar-cartao/quickstart.md): Node 24+, sem Docker e
sem servidor de banco. Nenhuma configuração prévia é necessária: o armazenamento
local usa um arquivo no caminho padrão, criado na primeira execução. O arquivo
(`*.sqlite`) e o pacote construído (`dist/`) não são versionados.

## Executar e verificar

```bash
cd backend && npm install && npm test && npm run typecheck && npm run build:local && npm run lint
cd frontend && npm install && npm test && npm run build && npm run lint
npm run test:e2e
```

O frontend não é tocado por esta feature: os comandos dele continuam sendo os de
antes. No backend, `npm run build` **passou a significar empacotamento** e exige o
parâmetro que escolhe o armazenamento; a verificação de tipos, que era o antigo
`build`, agora é `npm run typecheck`.

## Cópia limpa: um comando sobe a aplicação local

```bash
git clone <repositório> memoria && cd memoria/backend
npm install
npm run dev        # um único comando: sobe com o armazenamento local
```

A aplicação sobe sem nenhuma configuração prévia, usando o arquivo local no
caminho padrão `memorizacao.sqlite`, e imprime uma única linha informando o
armazenamento em uso. Crie um Cartão e um Baralho pela interface, encerre o
processo e suba de novo: **todo o conteúdo continua presente** (FR-104, FR-109,
SC-041).

## Pacote por armazenamento

```bash
cd backend
npm run build:local        # empacota dist/sqlite/servidor.mjs
npm run start:local        # inicia o pacote da execução local
```

A linha de início é completa e única:

```text
Armazenamento: SQLite (arquivo local)
```

Nenhum caminho de arquivo, nenhuma URL e nenhum segredo aparece nessa linha, na
saída ou no registro; a `010-postgresql-na-nuvem` dirá `Armazenamento: PostgreSQL
(nuvem)` na mesma linha (FR-108, SC-042).

O caminho do arquivo continua configurável, com o padrão preservado:

```bash
CAMINHO_DO_BANCO=/tmp/outro.sqlite npm run dev   # usa o arquivo informado
```

## Confirmar que o pacote não contém o outro Adapter

```bash
cd backend
npm run build:local
ls dist                          # apenas: sqlite/
grep -ri postgres dist/          # nada — o Adapter de PostgreSQL não existe no pacote
grep -c "node:sqlite" dist/sqlite/servidor.mjs   # a única menção a SQLite: o módulo embutido do Node, externo ao pacote
```

O pacote de um armazenamento é construído a partir de **uma** entrada, e é isso
que faz o Adapter do outro armazenamento e a sua dependência ficarem fora do
resultado. Não há import do driver alheio, nem código morto do Adapter alheio
(FR-120). Quando a `010` existir, a verificação se inverte: o pacote da nuvem não
pode conter o Adapter do armazenamento local.

## Confirmar a recusa de um `--banco` inválido

```bash
cd backend

# valor não aceito: recusa nomeando os valores aceitos, saída 1
npm run build -- --banco=mysql; echo "código de saída: $?"

# parâmetro ausente: a mesma mensagem, o mesmo código
npm run build; echo "código de saída: $?"

# valor com aparência de credencial: a mensagem não repete o valor informado
npm run build -- "--banco=postgres://usuario:senha@exemplo.invalid/base"; echo "código de saída: $?"

# e nada foi produzido
ls dist 2>/dev/null || echo "dist/ não existe: nenhum artefato foi produzido"
```

Nos três casos a construção é recusada com a mensagem em português que nomeia os
valores aceitos — nesta feature, `sqlite`:

```text
Construção recusada. Informe --banco=<valor>, com um dos valores aceitos: sqlite.
```

O processo termina com código de saída `1` e **nenhum artefato executável** é
produzido. No terceiro caso, em particular, a mensagem **não repete** o valor
informado, e nada dele aparece na saída nem no registro da aplicação (FR-102,
FR-108, SC-040). O valor acima é fictício: **nenhum endereço de conexão real**,
com ou sem senha, vai para o terminal compartilhado, para o histórico ou para
documento (Princípio VIII).

Um valor que nomeia um armazenamento que esta feature ainda não entrega —
`postgresql` — é recusado exatamente como os anteriores, com a mesma mensagem:
a lista de valores aceitos é a dos Adapters que existem. A `010` acrescenta a
entrada, e a mensagem passa a listar os dois.

## Confirmar a falha do armazenamento, e que nada passa por concluído

```bash
cd backend
mkdir -p /tmp/somente-leitura && chmod 500 /tmp/somente-leitura
CAMINHO_DO_BANCO=/tmp/somente-leitura/memorizacao.sqlite npm run dev
```

O início falha, com a falha reportada, e a aplicação **não** segue como se o
armazenamento existisse (FR-044, FR-045). Com a aplicação em uso e a API parada,
a interface informa a indisponibilidade, nada aparece como concluído e o que foi
digitado permanece para nova tentativa (FR-044, FR-045).

## Confirmar que a base antiga continua servindo

1. Tenha um arquivo local criado por uma execução anterior a esta feature, com
   Cartões, Baralhos e Vínculos.
2. Suba a aplicação sobre esse arquivo:
   `CAMINHO_DO_BANCO=caminho/do/arquivo.sqlite npm run dev`.
3. Confirme que o conteúdo continua presente e correto, e que nenhuma migração
   já aplicada foi reaplicada. As migrações versionadas e as regras de descarte e
   manutenção de dados são as mesmas de antes: elas **mudaram de lugar** no
   código, não de conteúdo nem de número de versão (FR-103, FR-104, SC-038).
4. Abra o arquivo com `sqlite3` e confira que a versão do esquema é a mesma de
   antes.

## Confirmar a bateria compartilhada da Porta

```bash
cd backend && npx vitest run tests/armazenamento
```

- `bateria-da-porta.ts`: os cenários da Porta, parametrizados por uma fábrica de
  Adapter, sem nomear armazenamento algum;
- `sqlite.test.ts`: a bateria inteira contra o Adapter do armazenamento local,
  cem por cento aprovada, mais a persistência entre duas aberturas do mesmo
  arquivo (FR-106, SC-039);
- `dependencias.test.ts`: nenhum Module do acervo, da identidade ou do HTTP
  importa armazenamento concreto — o único import permitido é a Porta (FR-100,
  SC-043);
- `construcao.test.ts`: as recusas da construção e o conteúdo do pacote
  (FR-102, FR-120, SC-040).

A `010-postgresql-na-nuvem` acrescenta um arquivo que chama a **mesma** função de
bateria com a fábrica de PostgreSQL, sem editar a bateria e sem editar nenhum
Module: é assim que SC-039 e SC-043 continuam valendo com o segundo Adapter.

## Conferir que nenhuma tela mudou

Abra a aplicação e percorra as telas de Cartões, Baralhos, Vínculos e Sessão de
estudo: nenhuma tela, campo ou ação nova aparece, e nenhum comportamento de `001`
a `006` mudou (FR-105, SC-038). O contrato HTTP também é o mesmo — o único
acréscimo é a resposta de falha de armazenamento, que a interface já trata como
indisponibilidade.

## Referências

- [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/porta-de-armazenamento.md](./contracts/porta-de-armazenamento.md)
- [contracts/scripts-e-construcao.md](./contracts/scripts-e-construcao.md)
