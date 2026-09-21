# Quickstart — Validação da feature PostgreSQL na Nuvem

## Pré-requisitos

- Node 24+, os mesmos de [`001`](../001-criar-cartao/quickstart.md). **Sem
  Docker**, sem contêiner e sem servidor de banco instalado à mão: o PostgreSQL
  usado nos testes é baixado pela devDependency e iniciado pelos próprios testes.
- `openssl` disponível na máquina, porque o apoio de teste gera um CA e um
  certificado de servidor descartáveis em tempo de execução.
- Para executar na nuvem de verdade: uma base PostgreSQL e a URL de conexão
  entregue pelo provedor (Neon) na variável de ambiente `DB_URL`. **Nada disso é
  necessário para construir, para testar ou para rodar a aplicação local.**
- O armazenamento local de `009` continua valendo: `CAMINHO_DO_BANCO` (padrão
  `memorizacao.sqlite`) e `npm run dev`.

Nenhuma credencial é versionada, nem em arquivo de exemplo: a senha dos testes é
gerada a cada execução, e os documentos usam apenas a **forma** de espaço
reservado.

## Executar e verificar

```bash
cd backend && npm install && npm test && npm run typecheck && npm run lint
cd backend && npm run build:local && npm run build:cloud
```

`npm test` inclui, além das suítes de `001` a `009`, a **bateria compartilhada de
cenários da Porta rodando contra PostgreSQL** — um PostgreSQL real, com TLS ligado
e CA gerado na hora. Se o binário não rodar na plataforma ou o `openssl` faltar, a
suíte **falha alto**: ela nunca é pulada em silêncio (SC-044).

O frontend e o E2E não são tocados por esta feature: os comandos deles continuam
sendo os de antes.

## Construir para a nuvem

```bash
cd backend
npm run build:cloud
ls dist/postgresql          # servidor.mjs  migrar.mjs
```

A construção **não** precisa de `DB_URL`: ela lê código e empacota, e o segredo só
é necessário para **executar** (FR-114). Repare que o mesmo comando não lista
`sqlite/`, e que `dist/sqlite/` não lista `postgresql/`: cada armazenamento tem o
seu pacote, escolhido na construção (FR-117).

## Confirmar que o pacote local não contém `pg`, e o da nuvem não contém SQLite

```bash
cd backend
npm run build:local && npm run build:cloud

# o pacote local não tem o driver de PostgreSQL nem o Adapter da nuvem
grep -c '"pg"' dist/sqlite/servidor.mjs ; echo "esperado: 0"
grep -ri postgres dist/sqlite/ | wc -l ; echo "esperado: 0"

# o pacote da nuvem não tem o Adapter do armazenamento local
grep -ri "node:sqlite" dist/postgresql/ | wc -l ; echo "esperado: 0"
grep -ri "armazenamento/sqlite" dist/postgresql/ | wc -l ; echo "esperado: 0"

# e `pg` está presente nos pacotes da nuvem
grep -c "rejectUnauthorized" dist/postgresql/servidor.mjs
```

`pg-native` — a dependência opcional do `pg` que nunca é usada — não aparece como
dependência a resolver no pacote: ela é declarada externa pelo script de
construção. É a exclusividade por construção que SC-050 mede.

## Migrar a base, e subir a nuvem

Defina a variável **com a forma de espaço reservado**, nunca com um endereço real
num terminal compartilhado, num histórico ou num documento. O valor é segredo
(Princípio VIII):

```bash
cd backend
export DB_URL='postgresql://<usuario>:<senha>@<host>/<base>?sslmode=verify-full'

npm run migrate:cloud      # leva o esquema à versão corrente e não reaplica o já aplicado
npm run start:cloud        # sobe contra PostgreSQL e escuta apenas no loopback
```

A linha de início é completa e única:

```text
Armazenamento: PostgreSQL (nuvem)
```

Nem a URL, nem o host, nem o usuário, nem a senha aparecem nessa linha, na saída ou
no registro — em nenhum dos comandos (FR-118, SC-045).

**Regra operacional do provedor**: o mesmo nome de variável serve aos dois comandos,
e o **valor** é definido pelo operador **por comando** — o **endpoint agrupado**
(pooler) para `start:cloud`, que tem muitas conexões curtas, e o **endpoint
direto** para `migrate:cloud`, porque DDL com trava consultiva em transação
atravessa mal o agrupador.

## Confirmar a migração numa base nova e a não reaplicação (SC-048)

1. Aponte `DB_URL` para uma base **nova e vazia** e rode `npm run migrate:cloud`:
   a mensagem final informa a versão corrente do esquema.
2. Rode o comando **outra vez**: nada é aplicado, nada é reescrito, e a versão
   continua a mesma (FR-116).
3. Suba com `npm run start:cloud`: a aplicação sobe, e o esquema já está na versão
   corrente.
4. Para ver a recusa: aponte `DB_URL` para uma base **sem** migração e suba com
   `npm run start:cloud`. O início é **recusado** com mensagem em português que
   nomeia a versão encontrada e a corrente e manda executar o comando de migração;
   nada escuta (FR-121).

Na prática, o passo 1 é coberto a cada `npm test` por uma base nova criada pelo
apoio de teste, migrada pelo mesmo caminho do comando, e descartada no fim.

## Confirmar a recusa da URL de conexão (SC-046)

```bash
cd backend
npm run build:cloud                       # sem DB_URL: a construção passa, ela não exige o segredo

unset DB_URL && npm run start:cloud; echo "código de saída: $?"
export DB_URL='isto-nao-e-uma-url' && npm run start:cloud; echo "código de saída: $?"
export DB_URL='mysql://<usuario>:<senha>@<host>/<base>' && npm run start:cloud; echo "código de saída: $?"
export DB_URL='postgresql://<usuario>:<senha>@/<base>' && npm run start:cloud; echo "código de saída: $?"
```

Nos quatro casos o início é recusado com mensagem em português que **nomeia
`DB_URL`** e **não repete o valor informado**:

```text
Nuvem recusada: a variável de ambiente DB_URL não foi informada.
Nuvem recusada: a variável de ambiente DB_URL não é uma URL de conexão válida.
```

Nem a saída nem o registro da aplicação contêm o valor informado, o usuário, a
senha ou o host. O comando de migração recusa pelos mesmos motivos, com o prefixo
`Migração recusada:` (FR-113, FR-114).

Confira, também, que o valor **não está versionado**:

```bash
git grep -n "postgresql://" | grep -v 'specs/010-postgresql-na-nuvem' || echo "nenhum valor versionado"
```

Os documentos desta feature usam apenas a **forma** de espaço reservado, e os
testes geram a senha por execução (FR-113, SC-045).

## Confirmar a cifra e a recusa da conexão não verificável (SC-047)

```bash
cd backend
export DB_URL='postgresql://<usuario>:<senha>@<host>/<base>?sslmode=disable'
npm run start:cloud; echo "código de saída: $?"   # recusa, antes de qualquer conexão
```

A recusa vale para `sslmode=disable`, `allow` e `prefer`: a cifra é obrigatória e o
certificado é **sempre** verificado, e nenhuma URL consegue rebaixar isso. Já
`sslmode=verify-full` (e `require`, e `verify-ca`) é aceito — e, de todo modo,
verificado por inteiro.

A prova de que a verificação **acontece** e não é desligada está em `npm test`: o
apoio de teste sobe um PostgreSQL com `ssl=on` e um CA privado gerado na hora, e
aponta `DB_CA_CERT` para esse CA; um dos cenários conecta contra um certificado que
não se confirma e exige a recusa, sem nenhuma operação apresentada como concluída
(FR-115).

`DB_CA_CERT` é opcional e existe para isso: nos testes, aponta para o CA privado;
na nuvem, fica ausente e a cadeia pública do provedor é usada.

## Confirmar a reconexão depois da queda (SC-049)

Com a aplicação em uso, encerre as conexões do backend pelo lado do servidor e
tente de novo:

```sql
-- no servidor de PostgreSQL, como administrador
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
 WHERE datname = current_database() AND pid <> pg_backend_pid();
```

A próxima operação da aplicação **abre outra conexão e conclui**: o conteúdo
continua correto e nada é perdido. Esse é exatamente o cenário que o teste de
reconexão automatiza, porque o provedor de nuvem encerra conexões ociosas sem
avisar (FR-119).

Enquanto a base estiver **indisponível** (servidor parado, credencial recusada,
certificado não verificável), cada operação é **reportada como falha** e nenhuma
aparece como concluída; o conteúdo já informado permanece para nova tentativa
(FR-044, FR-045).

## Confirmar que a bateria compartilhada passa nos dois Adapters (SC-044)

```bash
cd backend && npx vitest run tests/armazenamento
```

- `bateria-da-porta.ts`: os cenários da Porta, de `009`, **sem edição**;
- `sqlite.test.ts`: a bateria contra o Adapter do armazenamento local, de `009`;
- `postgresql/bateria.test.ts`: a **mesma** bateria contra o Adapter de PostgreSQL,
  cem por cento aprovada;
- `postgresql/migracoes.test.ts`, `postgresql/tls.test.ts` e
  `postgresql/reconexao.test.ts`: as verificações que só o banco da nuvem tem;
- `construcao.test.ts`: a recusa da construção e o conteúdo de cada pacote;
- `tests/entradas/nuvem.test.ts`: `DB_URL`, a saída sem segredo e a recusa por
  esquema atrasado.

Nenhum Module foi alterado para o banco novo: é a mesma bateria, contra um segundo
Adapter, e nenhuma suíte de `001` a `009` mudou de significado (SC-044, SC-050).

## Confirmar que a execução local continua igual (SC-050)

```bash
cd backend
unset DB_URL
npm run dev                # sobe com o armazenamento local, sem tocar em PostgreSQL
npm run build:local && npm run start:local
```

A linha de início é `Armazenamento: SQLite (arquivo local)`, **nenhuma conexão a
PostgreSQL é tentada** — o pacote local nem contém `pg` —, e o conteúdo criado
continua presente depois de encerrar e subir de novo (FR-117).

## Referências

- [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/adapter-postgresql.md](./contracts/adapter-postgresql.md)
- [contracts/scripts-da-nuvem.md](./contracts/scripts-da-nuvem.md)
- [Porta de armazenamento de `009`](../009-porta-de-persistencia/contracts/porta-de-armazenamento.md)
