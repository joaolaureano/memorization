# Contract — Scripts e Construção

Os scripts do backend, o parâmetro que escolhe o armazenamento na construção, os
códigos de saída e as mensagens, o que o pacote contém e a linha de início.

Base: `backend/package.json` e `backend/scripts/construir.mjs`. O frontend não é
tocado por este contrato.

## Scripts

| Script | Comando | O que é |
|---|---|---|
| `typecheck` | `tsc --noEmit` | Verificação de tipos. Assume o papel que o antigo `build` tinha |
| `test` | `vitest run` | Suítes existentes, bateria da Porta e verificações estruturais |
| `lint` | `eslint .` | Inalterado |
| `build` | `node scripts/construir.mjs` | Construção por armazenamento. **Exige** `--banco=<valor>`; sem ele, recusa |
| `build:local` | `node scripts/construir.mjs --banco=sqlite` | Pacote da execução local |
| `start:local` | `node dist/sqlite/servidor.mjs` | Início da execução local, a partir do pacote construído |
| `dev` | `node --watch src/entradas/local.ts` | Início local sem construir, para desenvolvimento |

A `010-postgresql-na-nuvem` acrescenta os scripts da nuvem — construção, início e
comando de migração —, sem alterar os desta tabela. Nesta feature eles são apenas
mencionados; **nada dos internos da nuvem é desenhado aqui**.

**Portões de qualidade**: passam a ser `npm run typecheck` e `npm run build:local`
no backend — o antigo `npm run build`, que era verificação de tipos, virou
`typecheck`, e `build` passou a significar empacotamento.

## O parâmetro de construção

| Aspecto | Regra |
|---|---|
| Forma aceita | Exatamente `--banco=<valor>` |
| Valores aceitos | As chaves da tabela de entradas de Adapter do script. Nesta feature: **`sqlite`** |
| Valor de um armazenamento que esta feature não entrega | Recusado como não aceito, com a mesma mensagem. É o caso de `postgresql` até a `010` acrescentar a sua entrada |
| Parâmetro ausente | Recusa, com a mesma mensagem |
| Forma diferente (`--banco` sozinho, `--banco sqlite`, valor vazio) | Recusa, com a mesma mensagem |
| Valor com aparência de credencial (endereço de conexão com senha, por exemplo) | Recusado como não aceito; a mensagem **não repete o valor informado**, e nada dele aparece na saída nem em registro |

A lista de aceitos é **derivada** da tabela: acrescentar um Adapter é acrescentar
uma entrada, e a mensagem passa a listá-lo sem que o texto mude. Por isso, nesta
feature, a mensagem lista apenas `sqlite` (FR-102, SC-040).

## Códigos de saída e mensagens

| Código | Quando | Saída (em português) | Artefato |
|---|---|---|---|
| `0` | Construção concluída para o armazenamento escolhido | Mensagem de conclusão nomeando o armazenamento | `dist/<banco>/servidor.mjs` |
| `1` | Parâmetro ausente, em forma diferente, não aceito, ou ainda não entregue | Mensagem que nomeia os valores aceitos, sem repetir o valor informado | **Nenhum**: a validação vem antes de escrever qualquer coisa |
| `1` | Falha ao empacotar | Mensagem genérica em português, sem caminho, URL ou detalhe de segredo | Nenhum artefato parcial: o que tiver sido escrito é removido |

Forma das mensagens de recusa, nesta feature:

```text
Construção recusada. Informe --banco=<valor>, com um dos valores aceitos: sqlite.
```

A mesma frase serve aos quatro casos de recusa — ausente, forma diferente, não
aceito e ainda não entregue —, e é por isso que o número de casos cresce sem
crescer o texto. Nenhuma mensagem, nem a de falha de empacotamento, contém o valor
informado, caminho de arquivo, URL, senha ou cadeia de conexão (FR-102, FR-108).

## O que a construção produz

- Um único arquivo: `dist/<banco>/servidor.mjs`, empacotado da entrada
  correspondente (`sqlite` → `src/entradas/local.ts`), no formato ESM, com
  plataforma `node`, alvo `node24` e os módulos embutidos do Node externos.
- **Um pacote por banco**: como só a entrada escolhida entra no grafo do
  empacotamento, o Adapter do outro armazenamento e a sua dependência **não
  existem no pacote** (FR-120). A prova é um teste que constrói e inspeciona o
  resultado.
- `dist/` continua ignorado pelo Git: é artefato de construção, não do
  repositório.
- A recusa não produz nada. Um pacote só existe para um armazenamento que foi
  aceito na construção — o que também é a razão de não haver "início sem
  parâmetro": o pacote de um armazenamento não entregue simplesmente não existe.

## Início

| Aspecto | Regra |
|---|---|
| Linha de início | **Uma** linha, antes de escutar: `Armazenamento: SQLite (arquivo local)` |
| Na `010` | A mesma linha dirá `Armazenamento: PostgreSQL (nuvem)` |
| Nunca na linha, na saída ou em registro | Caminho do arquivo, URL de conexão, senha, cadeia de conexão, endereço com credencial (FR-108, SC-042) |
| Arquivo local indisponível (diretório somente leitura, por exemplo) | O início falha com a falha reportada e a aplicação **não** segue como se o armazenamento existisse (FR-044, FR-045) |
| Cópia limpa do repositório | Depois de `npm install`, **um único comando** sobe a aplicação com o armazenamento local: `npm run dev`. O caminho empacotado é `npm run build:local` seguido de `npm run start:local` (FR-109, SC-041) |

O parâmetro de construção **não é lido em execução**: o armazenamento é escolha da
construção, e cada pacote carrega um Adapter só. Iniciar o pacote que não foi
construído falha porque o arquivo não existe; iniciar com o armazenamento
indisponível falha com a falha reportada.

## Variáveis de ambiente em execução

| Variável | Padrão | Estado |
|---|---|---|
| `CAMINHO_DO_BANCO` | `memorizacao.sqlite` | De `001`, inalterada: configurável, com o padrão de hoje preservado (FR-103) |
| `PORTA` | `3001` | De `001`, inalterada |
| `SEGREDO_DAS_SENHAS` | — | Exigida pelo plano da `007-criar-usuario`, ainda não implementada |
| `DB_URL` | — | Da `010-postgresql-na-nuvem`, ainda não implementada; nunca exibida nem registrada |

Nenhuma variável desta feature carrega escolha de armazenamento: quem escolhe é a
construção.

## Rastreabilidade

| Requisito | Onde é atendido |
|---|---|
| FR-101 | Parâmetro `--banco=<valor>` e o Adapter local como escolha da execução local |
| FR-102 | Validação antes de empacotar, código de saída 1, mensagem em português que nomeia os valores aceitos e nenhum artefato produzido |
| FR-103 | `CAMINHO_DO_BANCO` com o padrão de hoje; o Adapter local é o da execução local |
| FR-108 | Mensagem de recusa sem repetir o valor informado; linha de início só com o tipo de armazenamento |
| FR-109 | `dev` (um comando a partir de uma cópia limpa) e `start:local` (a partir do pacote); os scripts da nuvem são apenas declarados |
| FR-120 | Pacote por banco: o empacotamento só inclui a entrada escolhida |
| SC-040 | Teste que constrói sem parâmetro, com valor não aceito e com valor com aparência de credencial |
| SC-041 | Um único comando sobe a aplicação local a partir de uma cópia limpa, com o caminho padrão |
| SC-042 | Teste que lê a primeira linha do início e exige o tipo de armazenamento, sem caminho, URL ou credencial |
