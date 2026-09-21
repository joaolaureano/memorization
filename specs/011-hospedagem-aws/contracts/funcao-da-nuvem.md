# Contract — Função da Nuvem

A execução da API na AWS como a **Função da nuvem**: a entrada, o `handler`
exportado, o formato do evento, a ordem das guardas, os desfechos, os segredos e
as garantias que a distinguem das execuções que escutam. A infraestrutura —
CloudFront, S3 privado, Function URL, parameter store — é o contrato de integração
já mesclado em `backend/terraform`, e **não** é reescrito aqui.

Vive em `backend/src/funcao/` (Implementation) e em
`backend/src/entradas/lambda.ts` (a raiz de composição). Nenhum Module conhece a
função, o cofre, o CloudFront ou o segredo de origem: o `Acervo`, o `Identidade` e
a Porta de Armazenamento continuam sendo as únicas coisas que o domínio vê.

## Arquivos e papéis

| Arquivo | Papel |
|---|---|
| `src/entradas/lambda.ts` | A raiz de composição: monta o `LeitorDeSegredos` de SSM a partir de `SSM_PREFIX` e exporta `handler` |
| `src/funcao/funcao.ts` | `criarFuncao(leitor, opcoes?)`: a inicialização memorizada e **descartável**, a composição do servidor e o `handler` no formato da Function URL |
| `src/funcao/segredos.ts` | A Seam `LeitorDeSegredos`, `SegredosDaFuncao` e `ParametroAusenteError` |
| `src/funcao/ssm.ts` | O Adapter de SSM: `GetParameters` com os três nomes e `WithDecryption: true` |
| `src/http/origem.ts` | A guarda do segredo de origem: `403` genérico, comparação em tempo constante |
| `src/http/servidor.ts` | `criarServidor` com a opção que liga a guarda e desliga a política de outra origem; o resto intocado |

## Fábrica e `handler`

```text
criarFuncao(leitor: LeitorDeSegredos, opcoes?: OpcoesDaFuncao)
  -> { handler: (evento, contexto) => Promise<Resposta> }
```

A entrada publica exatamente o que a infraestrutura espera — `lambda_handler =
"lambda.handler"`, com o arquivo `lambda.mjs` na raiz do zip:

```text
backend/src/entradas/lambda.ts
  export const handler = criarFuncao(leitorDeSegredosDoSsm(SSM_PREFIX)).handler;
```

`OpcoesDaFuncao` existe para os testes: prefixo, e nada de regra. O resto —
formato do evento, ordem das guardas, desfechos e segredos — é contrato fixo.

## O evento: Function URL, payload v2

A função é invocada pela **Function URL**, e é isso que define o formato. O
Adaptador do evento (`@fastify/aws-lambda`) traduz a carga em requisição do
Fastify e a resposta de volta em payload.

| Campo do evento v2 | Uso |
|---|---|
| `version` | `"2.0"` — o formato da Function URL |
| `rawPath` | O caminho **sem** o prefixo `/api`, que o CloudFront remove na borda |
| `rawQueryString` | A consulta, quando houver |
| `headers` | Os cabeçalhos, com as chaves em minúsculas — é de onde vêm `x-origin-secret` e `authorization` |
| `requestContext.http.method` | O método da requisição |
| `body` / `isBase64Encoded` | O corpo, quando houver |
| contexto da invocação | Não usado: nada de regra depende do número da invocação |

| Campo da resposta | Regra |
|---|---|
| `statusCode` | O status da rota, ou o das guardas (403, 401, 503) |
| `headers` | Os da rota; **nenhum** `access-control-*` em produção, nenhum `Set-Cookie` em nenhuma resposta |
| `body` | O corpo em JSON, como as rotas de `001` a `008` já devolvem |
| `isBase64Encoded` | Do Adaptador |

## Ordem das guardas — a origem **antes** da Credencial

| Ordem | Guarda | O que confere | Desfecho |
|---|---|---|---|
| 1 | **Segredo de origem** (`src/http/origem.ts`) | `x-origin-secret` contra o valor do cofre: tamanho e depois `timingSafeEqual` | `403` com o mesmo corpo genérico em todos os casos de recusa |
| 2 | **Credencial** (`src/http/credencial.ts`, de `008`) | `Authorization: Basic`, pelas rotas isentas de `008` (Cadastro e prova de vida) | `401` sem motivo; `503` quando o armazenamento está indisponível |
| 3 | **Forma** (`src/http/rotas.ts`, de `001` a `008`) | O corpo com Zod, na borda | `400` |

Regras que valem para a ordem inteira:

1. A guarda de origem é o **primeiro** `onRequest` da aplicação, e a requisição
   que não veio do CloudFront é recusada **antes** de qualquer trabalho de
   Credencial (FR-125, SC-053).
2. `/health` **também** exige o segredo de origem, e continua isenta de
   Credencial: a prova de vida responde o estado da API, e só pelo CloudFront
   (FR-122).
3. A guarda de origem **não** substitui a Credencial, e não é Credencial: ela
   responde "de onde veio", e não "quem é". Sem Credencial, a rota de acervo
   responde `401` mesmo com o segredo correto (FR-131, SC-058).
4. A recusa por origem é **indistinguível** entre cabeçalho ausente, curto, longo
   ou errado: mesmo status, mesmo corpo, sem `WWW-Authenticate`, sem `Set-Cookie`
   e com comparação em tempo constante.
5. O corpo da recusa é o que a stub da infraestrutura já devolvia —
   `{"sucesso":false,"mensagem":"Proibido"}` —, de modo que o comportamento
   validado em campo não muda.

## Desfechos

| Situação | Status | Corpo |
|---|---|---|
| `/health` com o segredo de origem | `200` | O estado da API, como hoje |
| Requisição sem o segredo de origem, ou com segredo errado | `403` | Genérico, sem motivo |
| Requisição pelo CloudFront, rota de acervo, sem Credencial | `401` | A recusa única do `Identidade` de `008` |
| Cadastro (`POST /usuarios`) pelo CloudFront | `201` ou a recusa de domínio | Como em `008`; **sem** Credencial, com segredo de origem |
| Operação de acervo autenticada | `200`/`201`/`204`/`400`/`404`/`409` | Como de `001` a `008` |
| Armazenamento indisponível em uma operação | `503` | `{ erro, mensagem }`, como em `008` e `010` |
| Inicialização falhou (segredo ausente, banco inalcançável, esquema atrasado) | `503` | Corpo genérico em português: o motivo não é revelado; a mensagem que nomeia o parâmetro fica no **registro** |
| Rota inexistente, com o segredo de origem | `404` | Do Fastify; o 404 da API continua intacto, porque não há reescrita na borda |

## A inicialização: memorizada e descartável

| Aspecto | Regra |
|---|---|
| Quando | Na primeira invocação do contêiner; nunca no carregamento do módulo |
| Onde vive a promise | **Fora** do handler, no módulo da fábrica |
| Contêiner morno | A aplicação já montada é reaproveitada: nenhum SSM, nenhum TLS e nenhum servidor de novo |
| Invocações concorrentes | Compartilham a **mesma** promise: nada é inicializado duas vezes |
| Falha | A requisição responde `503` genérico e a promise é **descartada**; a requisição seguinte inicializa **de novo** (FR-126, SC-054) |
| Falha persistente | Falha em todas as requisições enquanto durar a causa, e a aplicação **nunca** passa por pronta |
| Ordem | Segredos → segredo das Senhas validado (`007`) → URL validada (`010`) → versão do esquema conferida → Adapter aberto → servidor montado e pronto |
| Migração | **Nunca**: quem migra é o operador, com o comando de `010`; esquema atrasado é recusa (FR-127, SC-055) |

## Os segredos

| Nome | Tipo | Leitura | Ausência |
|---|---|---|---|
| `${SSM_PREFIX}/DB_URL` | `SecureString` | `GetParameters` com `WithDecryption: true`, os três numa chamada | Falha de inicialização com mensagem que nomeia o **parâmetro**, e nada do valor |
| `${SSM_PREFIX}/ORIGIN_SECRET` | `SecureString` | idem | idem |
| `${SSM_PREFIX}/SEGREDO_DAS_SENHAS` | `SecureString` | idem | idem |

| Regra | Onde vale |
|---|---|
| Nenhum valor de segredo na saída, no registro ou em resposta — **inclusive** quando a leitura falhar | Toda Implementation (FR-123, FR-078, SC-052) |
| Nenhum segredo em variável de ambiente da função | O ambiente tem apenas `SSM_PREFIX` e `NODE_ENV` |
| A mensagem do SDK **nunca** é propagada | O Adapter de SSM monta a própria mensagem, em português, nomeando o parâmetro |
| O nome do parâmetro pode ser registrado; o valor, nunca | O nome não é segredo, e é o que torna a falha diagnosticável |

## Garantias da Função da nuvem

| Garantia | Como |
|---|---|
| **Não escuta porto algum** | A fábrica monta o servidor com `criarServidor` mais as rotas e chama `ready()`; `listen` não aparece em nenhum caminho da função (FR-122) |
| **A garantia de loopback da execução local permanece** | `assegurarEscutaLocal` continua valendo nas entradas que escutam, sem alteração (FR-122) |
| **Nenhum cabeçalho permissivo de outra origem em produção** | O servidor da função é montado com a política de outra origem desligada: nenhum pré-voo de CORS e nenhum `access-control-allow-origin` (FR-128, SC-056) |
| **Sem sessão, cookie ou token** | Nenhum `Set-Cookie`, nenhum valor reutilizável entre requisições, e a Credencial é verificada de novo em cada requisição (FR-079, FR-131, SC-058) |
| **A Senha nunca aparece** | A verificação acontece na Interface do `Identidade`; nenhuma resposta, registro ou saída a reproduz (FR-078) |
| **A Porta e o Adapter não mudam** | Os desfechos e as operações continuam sendo os de `009` e `010`, sem acréscimo |

## Reuso — o que esta função **não** reimplementa

| Peça | De onde vem | Por que é reusada |
|---|---|---|
| Validação da URL de conexão, recusa de cifra rebaixada, CA opcional | `010` (`armazenamento/postgresql/conexao.ts`) | Uma **única** regra para o mesmo segredo |
| Adapter de PostgreSQL, com certificado sempre verificado | `010` | A mesma conexão, agora aberta por outro processo |
| Conferência da versão do esquema | `010` (`esquema.ts`) | Uma única definição de versão corrente; e nenhuma migração |
| Validação do segredo do servidor das Senhas | `007` (`identidade/segredo.ts`) | A regra de comprimento e a mensagem são do Module, não da nuvem |
| Guarda da Credencial, rotas, tratamento de erro, forma na borda | `008`, `001` a `008` | A função publica **a mesma** API: nenhuma rota é reescrita |
| Adaptador do evento | `@fastify/aws-lambda` | A tradução da carga é da biblioteca, não nossa |

## O que esta função não tem

| Não existe | Motivo |
|---|---|
| `listen`, porta, soquete de escuta | FR-122: a função não expõe rede, e o evento chega pela Function URL |
| Migração de esquema no início | FR-127: quem migra é o operador; a função confere e recusa |
| Sessão, cookie, token ou cache de Credencial verificada | FR-079 e FR-131 |
| Cabeçalho permissivo de outra origem | FR-128: em produção, SPA e API dividem a origem |
| Segredo em variável de ambiente da função | FR-123: os três vêm do cofre |
| Caminho que desligue a verificação do certificado do banco | Herdado de `010`, e reusado |
| Encerramento (`encerrar()`) no ciclo de vida do handler | O contêiner é do runtime; não há rota de ciclo de vida e nenhuma conexão é deixada aberta de propósito |
| Rota, tela, tabela ou regra de domínio nova | Nenhum requisito desta feature pede |
| Domínio próprio, certificado próprio, firewall de aplicação, limitação de taxa ou bloqueio por tentativas | Adiados na spec |

## Como é verificado

| Verificação | O que prova |
|---|---|
| Eventos sintéticos de Function URL (payload v2) **sem** `x-origin-secret` e com segredo **errado** | `403` com o mesmo corpo nas duas recusas (FR-125, SC-053) |
| `GET /health` com o segredo de origem e **sem** Credencial | `200`: a prova de vida responde a API, e só pelo CloudFront (FR-122, SC-051) |
| `GET /cartoes` com o segredo e **sem** Credencial | `401`: a guarda de origem não substitui a Credencial (FR-131, SC-058) |
| Cadastro, entrada e ida e volta de Cartão, Baralho e Vínculo com a Credencial, contra o PostgreSQL real com TLS do apoio de teste de `010` | A aplicação publicada funciona de ponta a ponta atrás da guarda, gravando na base (SC-051) |
| Respostas de todos os cenários, em modo de produção e no modo local | Nenhum `access-control-*` em produção; a execução local continua permissiva (FR-128, SC-056) |
| Leitor que falha na primeira chamada e responde na segunda | A primeira requisição responde `503` e a seguinte é atendida: a falha **não** fica memorizada (FR-126, SC-054) |
| Leitor sem um dos parâmetros; base atrasada | Inicialização recusada, mensagem que nomeia o parâmetro (nunca o valor), `503` na requisição, e **nenhuma** migração aplicada (FR-123, FR-127, SC-055) |
| Varredura da saída, do registro e das respostas, com valores **gerados** pelo cenário | Nenhum valor de segredo aparece (FR-123, FR-078, SC-052) |
| Cliente de SSM de mentira no Adapter de SSM | Uma chamada `GetParameters` com os três nomes sob o prefixo e `WithDecryption: true` (FR-123) |

O PostgreSQL usado nesses testes é o **real**, com TLS ligado e CA descartável
gerado em tempo de execução, do apoio de teste de `010`. A publicação na AWS
**não** é exigida da verificação: o `apply` é ação do operador (FR-133).
