# Research: Cartão com Imagem

**Feature**: `026-cartao-com-imagem` | **Data**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

Registro append-only das decisões de planejamento (Princípio II). O levantamento do código existente (backend, frontend e infraestrutura) foi feito por três exploradores somente leitura com o modelo Haiku 4.5, a pedido do Product Owner ("Haiku 5.5" não existe; o Haiku vigente é o 4.5). As afirmações deles foram conferidas no código pelo Arquiteto antes de entrar aqui. Uma delas estava errada e foi corrigida: o adapter local usa `node:sqlite`, não `sql.js`, que só lê pacotes Anki.

## R0 — Skills aplicadas

- **domain-modeling**: aplicada no `clarify` e aqui. Os termos novos (Tipo de cartão, Imagem, Texto da frente, Descrição alternativa) foram fixados em Key Entities da spec. "Imagem" é o arquivo e não o Cartão: o Cartão é "Cartão do tipo Imagem". Usar "card de imagem" ou "foto" fica proibido. Os cenários-limite (Imagem sem Texto da frente, Cópia, Histórico) foram resolvidos no clarify. CONTEXT.md e ADR são inaplicáveis pela constituição 3.2.0.
- **codebase-design**: aplicada em R2, R3 e R9. Ela decidiu uma Seam nova com dois Adapters (`ArmazemDeImagens`) e uma estrutura interna sem Seam para as regras por tipo (`TiposDeCartao`). Também orientou a estratégia de testes pela Interface. DESIGN-IT-TWICE é inaplicável pela constituição.

## R1 — Fatos do código que restringem o desenho

| Fato | Onde | Consequência |
|---|---|---|
| Autenticação é `Authorization: Basic` a cada requisição, sem cookie | `backend/src/http/credencial.ts` | `<img src>` não envia o cabeçalho; a Imagem não pode ser servida por rota autenticada comum. |
| `bodyLimit` do Fastify é 4 MiB | `backend/src/http/servidor.ts:256` | Um envio de 5 MB pela API seria recusado. |
| A API roda em Lambda Function URL atrás do CloudFront; o payload máximo é 6 MB e binário vai em base64 (+33%) | `backend/terraform/lambda.tf`, `cloudfront.tf` | Servir ou receber 5 MB pela Lambda estoura o limite (5 MB × 1,33 ≈ 6,7 MB). |
| Esquema na versão 16, migrações numeradas em paridade SQLite/PostgreSQL | `backend/src/armazenamento/*/migracoes.ts` | A feature cria a migração 17 nos dois adapters. |
| `pertencimento.frente_chave TEXT NOT NULL` com `UNIQUE (baralho_id, frente_chave)` | `sqlite/migracoes.ts:510` | Para Cartão do tipo Imagem sem Texto da frente, a chave precisa aceitar `NULL`; `UNIQUE` já permite vários `NULL`. |
| `ItemRegistrado` guarda cópias de `frente` e `verso` | `backend/src/armazenamento/porta.ts:134` | Acrescenta-se `tipo` ao item (FR-419a), nunca a Imagem. |
| Exclusões em cascata via `ON DELETE CASCADE`; a exclusão de conta passa por `Identidade` → `excluirUsuario` | `porta.ts:555`, `identidade.ts:434` | As Imagens precisam ser removidas fora do banco, coordenadas com essas transações (R7). |
| Bucket S3 do site é privado, com OAC; não há CSP | `backend/terraform/s3.tf` | Um bucket novo e privado para Imagens; sem CSP, não há `img-src` a ajustar. |
| Não há SDK S3 no projeto; `@aws-sdk/client-ssm` é dependência de desenvolvimento e vai empacotada pelo esbuild | `backend/package.json` | Dependências novas: `@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post` e `@aws-sdk/s3-request-presigner`. |

## R2 — Regras por Tipo de cartão (FR-403a)

**Decisão**: um Module `TiposDeCartao` em cada lado. O tipo do Cartão é uma união discriminada por `tipo`, e cada tipo tem um registro de regras com a mesma forma: campos e validação, chave de unicidade da Frente no Baralho, texto pesquisável e texto do snapshot. No backend, o `Acervo` consulta o registro em vez de ramificar por tipo. No frontend, cada tipo fornece os seus campos de formulário, a apresentação na lista e a apresentação na Sessão. É o "Template Processing" pedido pelo Product Owner: o fluxo (criar, editar, listar, estudar) é fixo, e os passos variáveis vêm do tipo.

**Por quê**: Locality. Acrescentar um tipo significa acrescentar uma entrada ao registro e as suas provas, sem tocar nas regras de Frente-Verso.

**Não é Seam**: há uma única Implementation por tipo e nada varia entre produção e teste. Pelo Princípio IV, é estrutura interna do `Acervo` e do formulário, testada pela Interface deles.

**Alternativas rejeitadas**: (a) `if (tipo === "imagem")` espalhado por rotas, `Acervo` e telas, rejeitado por perder Locality; (b) hierarquia de classes `CartaoBase`, rejeitada por ser mais pesada que registro + união discriminada, sem ganho de teste.

## R3 — Onde guardar os arquivos: Seam `ArmazemDeImagens`

**Decisão**: Seam nova `ArmazemDeImagens`, com Interface pequena:

- `prepararEnvio(usuarioId)` devolve `{ imagemId, envio: { url, campos }, expiraEm }`;
- `confirmar(usuarioId, imagemId)` devolve `{ ok, chave, formato, bytes }` ou uma recusa (`nao_encontrada | formato | tamanho`), conferindo o conteúdo real;
- `copiar(chave, usuarioId)` devolve uma nova chave;
- `enderecoDeLeitura(chave)` devolve `{ url, expiraEm }`;
- `remover(chaves)` devolve as chaves removidas.

Ela tem dois Adapters justificados: **S3**, em produção na nuvem, e **Disco**, no modo local (`entradas/local.ts`) e nos testes. O `Acervo` recebe o armazém por injeção, como já recebe a Porta.

**Por quê**: dependência "true external" (DEEPENING.md, categoria 4). As duas execuções reais (nuvem e local) exigem Implementations distintas, e por isso a Seam é real, não hipotética.

**Alternativas rejeitadas**: guardar bytes no PostgreSQL/SQLite (contraria a decisão do Product Owner pelo S3 e incha o Neon); um único Adapter S3 com emulador também no modo local (obrigaria todo desenvolvedor a rodar MinIO para abrir a aplicação).

## R4 — Envio: direto do navegador ao S3

**Decisão**: o envio usa **presigned POST**. O backend gera, para o Usuário autenticado, uma política com chave fixa `pendentes/{usuarioId}/{imagemId}`, `content-length-range` de 1 a 5.242.880 bytes e validade de 5 minutos. O navegador envia o arquivo direto ao bucket. O envio só acontece no momento de **salvar** o Cartão, não ao escolher o arquivo; a pré-visualização é local (`URL.createObjectURL`). Assim, um formulário abandonado não envia nada.

**Por quê**: R1 inviabiliza passar 5 MB pela Lambda. A política impõe o tamanho no próprio S3, e enviar no salvamento reduz pendências.

**Alternativas rejeitadas**: (a) presigned PUT, que não impõe limite de tamanho; (b) envio pela API em partes, que é complexo e continua sujeito a 6 MB por chamada.

## R5 — Validação autoritativa (FR-411)

**Decisão**: `confirmar` faz `HeadObject` para conferir o tamanho até 5 MB e um `GetObject` com `Range: bytes=0-15` para ler a assinatura. As assinaturas aceitas são: JPEG `FF D8 FF`; PNG `89 50 4E 47 0D 0A 1A 0A`; GIF `GIF87a`/`GIF89a`; WebP `RIFF????WEBP`. Se a assinatura for aceita, copia o objeto para `imagens/{usuarioId}/{imagemId}` com o `Content-Type` correspondente e `Content-Disposition: inline`, e apaga o pendente. Se for recusada, apaga o pendente e devolve o motivo. O `Content-Type` declarado pelo navegador é ignorado. SVG fica fora: é documento ativo (risco de script) e não foi aceito no clarify.

**Alternativas rejeitadas**: confiar na extensão ou no MIME do navegador (contraria FR-411); decodificar a imagem inteira (custo de CPU e de dependência sem requisito).

## R6 — Leitura: presigned GET de curta duração (FR-424)

**Decisão**: o bucket é totalmente privado. As respostas autenticadas que trazem Cartões do tipo Imagem do próprio Usuário incluem `imagem.url`, um presigned GET válido por **15 minutos**, e `imagem.expiraEm`. A chave do objeto contém um UUID aleatório e, sozinha, não dá acesso a nada. Se a carga da `<img>` falhar, o cliente pede os dados do Baralho de novo uma vez para renovar os endereços; se falhar outra vez, mostra o aviso de Imagem indisponível (FR-418).

**Interpretação de FR-424**: "o conhecimento do endereço da Imagem MUST NOT bastar". O endereço permanente (bucket + chave) não basta. O endereço assinado é uma credencial temporária emitida só ao dono autenticado e expira em até 15 minutos. Fica `premissa a validar` com o Product Owner que essa janela é aceitável.

**Alternativas rejeitadas**: (a) proxy pela Lambda, inviável pelo limite de 6 MB em base64 (R1); (b) CloudFront com cookies assinados, que exige um par de chaves como novo segredo, rotação e cookie entre origens, desproporcional (Princípio VII); (c) `fetch` autenticado com blob local, que continua precisando de um proxy.

## R7 — Remoção e ciclo de vida (FR-421, FR-422, FR-423)

**Decisão**:

1. **Cópia** (`salvarSelecaoComoBaralho`, Cópia da `025`): copia o objeto (`copiar`) para uma chave nova antes de gravar a transação. Cada Cartão é dono exclusivo da sua Imagem, e FR-422 vale sem contagem de referências.
2. **Fila de remoção**: tabela `imagem_a_remover (chave PK, registrada_em)`, sem chave estrangeira. Ela é preenchida **na mesma transação** que exclui Cartão, Baralho ou Usuário, ou que troca a Imagem. Depois do commit, o `Acervo` (ou a `Identidade`, na exclusão de conta) chama `remover` e apaga da fila as chaves removidas. O que falhar fica na fila e é tentado de novo na próxima remoção e na inicialização da aplicação. Como nenhum endereço de leitura é emitido para uma chave sem Cartão, a Imagem fica inacessível assim que a transação confirma; os endereços já emitidos expiram em até 15 minutos.
3. **Falha entre confirmação e gravação**: se a gravação do Cartão falhar depois de `confirmar`, a chave final vai para a fila de remoção na mesma resposta. Nenhuma Imagem fica órfã (US1-7).
4. **Pendentes**: uma regra de ciclo de vida do bucket expira o prefixo `pendentes/` em 1 dia.

**Risco (premissa a validar)**: a expiração por ciclo de vida do S3 arredonda para a meia-noite UTC seguinte e a remoção efetiva é assíncrona. Um pendente pode ficar guardado até cerca de 48 horas, o que tensiona FR-423 e SC-171 ("24 horas"). Pendentes nunca são legíveis: não se emite GET para `pendentes/`. Proposta ao Product Owner: ajustar FR-423/SC-171 para "até 48 horas" ou aceitar uma rotina agendada adicional. Até a decisão, o `tasks` não deve tratar o limite de 24 horas como provado pelo S3.

**Alternativas rejeitadas**: contagem de referências por Imagem compartilhada (mais estado e mais casos de concorrência, sem ganho para o Usuário); apagar o objeto antes do commit (uma falha posterior deixaria o Cartão sem Imagem).

## R8 — Modelo de dados e migração 17

**Decisão**: migração 17 em paridade SQLite/PostgreSQL. Detalhes em [data-model.md](./data-model.md).

- `cartao.tipo` com `CHECK` entre `frente-verso` e `imagem`, padrão `frente-verso`: os Cartões existentes viram Frente-Verso (FR-407).
- `cartao.imagem_chave` e `cartao.texto_alternativo`, com a restrição de que `imagem_chave` está preenchida se e somente se o tipo é `imagem`.
- `pertencimento.frente_chave` passa a aceitar `NULL`. No SQLite isso exige reconstruir a tabela, com o mesmo padrão já usado nas migrações 5–8.
- `item_de_registro.tipo` com padrão `frente-verso`.
- Tabela `imagem_a_remover`.

Os entrypoints de nuvem e Lambda exigem a versão 17. O operador migra o Neon antes do deploy, no fluxo existente.

## R9 — Frontend

**Decisão**:

- O seletor de tipo é um `<select>` nativo com rótulo "Tipo de cartão". Ele é acessível por teclado sem código extra e sempre inicia em Frente-Verso (FR-405).
- A troca de campos é anunciada numa região `aria-live="polite"` (FR-425).
- `PaginaDoFormularioDeCartao` passa a compor os campos fornecidos pelo registro `TiposDeCartao` do frontend.
- A verificação de formato e tamanho no navegador existe só para dar retorno rápido; a decisão é do servidor.
- A edição mostra o tipo como texto, sem seletor (FR-420).
- `PaginaDoBaralho` e `PaginaDeEstudo` pedem ao registro a apresentação de cada Cartão.
- A Imagem usa `object-fit: contain`, `max-width: 100%` e altura máxima relativa à viewport (FR-417).
- `alt` vem da Descrição alternativa, depois do Texto da frente e, por fim, de "Imagem do Cartão" (FR-426).
- A Interface `ClienteDoAcervo` ganha `enviarImagem(arquivo)`, que encapsula `prepararEnvio` + POST ao S3 e devolve `imagemId`. `ClienteEmMemoria` simula o envio e a recusa por formato e tamanho.

**Protótipo**: `design/cartao-com-imagem/`, seguindo a convenção das features 025 e Anki, com verificação Chromium em 360, 390, 768 e 1440 px.

## R10 — Infraestrutura

**Decisão**: novo arquivo `backend/terraform/s3-imagens.tf` com:

- o bucket `memorization-imagens-{account_id}`, com bloqueio público total, `BucketOwnerEnforced` e SSE-S3;
- ciclo de vida de 1 dia em `pendentes/`;
- CORS que permite `POST` só da origem do CloudFront;
- uma política inline na role da Lambda com `s3:PutObject`, `s3:GetObject` e `s3:DeleteObject` em `arn:…:memorization-imagens-*/*`, sem `ListBucket`.

O nome do bucket entra na Lambda pela variável de ambiente `NOME_DO_BUCKET_DE_IMAGENS`. Não é segredo, mas não fica em arquivo de ambiente versionado (Princípio VIII). As assinaturas usam as credenciais temporárias da role, então não há chave nova. O modo local lê `CAMINHO_DAS_IMAGENS`, com padrão `./imagens-locais`, ignorado pelo git.

**Provas do Adapter S3**: a bateria de contrato de `ArmazemDeImagens` roda sempre contra o Adapter Disco e, quando `S3_DE_TESTE_ENDERECO` estiver definido, contra MinIO. No CI isso é um serviço do job; localmente, um container no colima. Fica `premissa a validar` que o MinIO cobre presigned POST com `content-length-range`; se não cobrir, essa prova específica passa para o e2e contra a nuvem.

## R11 — Fora do escopo confirmado

Importar Imagens do Anki, Imagem no Verso, várias Imagens por Cartão, edição da Imagem, redimensionamento ou miniatura gerada no servidor (a miniatura é a mesma Imagem reduzida por CSS) e mudar o tipo de um Cartão já criado.

## R12 — Decisões do Product Owner após o plan (2026-10-13)

- **R7, prazo dos pendentes**: aceito "até 48 horas". FR-423 e SC-171 foram atualizados na spec. A expiração por ciclo de vida do S3 (1 dia, arredondada para a meia-noite UTC) basta, sem rotina agendada.
- **R6, exibição**: o Product Owner não quer link visível: "Só exibir no cartão é o suficiente e necessário". FR-415 passou a exigir a Imagem diretamente no Cartão, sem link, botão ou passo extra. O endereço assinado de 15 minutos continua como mecanismo interno de carga da `<img>`, nunca mostrado ao Usuário e renovado automaticamente (R6). A premissa da janela de 15 minutos está resolvida: o Product Owner não pediu proteção diferente para o endereço técnico, e a exigência dele é sobre o que aparece na tela.
- **R6, janela do endereço técnico** (após `analyze`, 2026-10-13): o Product Owner aceitou explicitamente que o endereço técnico de exibição valha por até 15 minutos. FR-424, SC-170, SC-171 e o caso-limite "Acesso por terceiros" foram reescritos para refletir isso. Na mesma rodada: `tipo` passou a ser obrigatório na API, porque a compatibilidade retroativa sem requisito violava o Princípio VII (C1).

## R13 — Decisões da triagem do checklist de segurança e UX (2026-10-13)

- **Metadados (FR-427)**: o Product Owner escolheu remover. A decisão é remover no próprio `confirmar`, editando os bytes por formato (`src/imagens/metadados.ts`), sem biblioteca de imagem. O Orientation da EXIF é preservado num APP1 mínimo, para que fotos de celular não fiquem deitadas. Por isso `confirmar` passa a ler o objeto inteiro (≤ 5 MB) e gravar a chave final com `PutObject`, em vez de `CopyObject` (revisa R5). Alternativa rejeitada: `sharp` na Lambda, que reencoda com perda e traz um binário nativo de arm64. Também rejeitado: limpar no navegador, porque não é autoritativo.
- **Sair e endereços emitidos**: não há revogação; eles expiram em até 15 minutos (FR-424).
- **GIF e movimento reduzido (FR-429)**: com `prefers-reduced-motion: reduce`, o primeiro quadro é desenhado em `<canvas>`, num único componente `ImagemDoCartao` reutilizado em lista, Sessão e pré-visualização.
- **Tipo depois de salvar**: com o formulário aberto para o próximo Cartão, mantém o tipo usado. Cada nova abertura começa em Frente-Verso (FR-405).
- **Exclusões de escopo**: cota por Usuário e limite de dimensões em pixels.
- **Logs (FR-428)**: endereços, Descrição alternativa e Texto da frente não aparecem em log nem em erro.

## R14 — Implementação: desvios do plano (2026-10-13)

- **`tipo` opcional na API** (revisa a correção C1 do analyze): ausente vale `frente-verso`, porque a entrada original do Product Owner diz "O padrão sempre será Frente-Verso". Exigir o campo obrigaria a mudar cerca de 70 chamadores existentes sem ganho de comportamento. Na leitura, o tipo também segue a forma legada: só os Cartões do tipo Imagem trazem `tipo`. Fica para validação do Product Owner.
- **Migração 18**: repete a finalização da transição da `025` (como a 16 repetiu a 14). Numa base com Cartões ainda pendentes, a 17 é aplicada antes de a 16 poder rodar, e é a 18 que remove `vinculo` quando a transição global terminar. A 17 no SQLite reconstrói `cartao` e `pertencimento` com as chaves estrangeiras desligadas (flag `semChavesEstrangeiras` no aplicador).
- **S3 de teste**: as imagens do MinIO e do LocalStack S3 não estão mais disponíveis para download. A bateria do Adapter S3 roda contra SeaweedFS 4.48, que impõe `content-length-range` e passou nos 13 casos.
- **Rotas locais do Adapter Disco**: o token vai na consulta (`?t=`), porque o Fastify limita parâmetros de caminho a 100 caracteres.
- **Código de erro**: `descricao_muito_longa`, em vez de `descricao_excedida`, para seguir o padrão `*_muito_longa` existente.
- **Lambda**: `client-s3`, `s3-presigned-post` e `s3-request-presigner` ficam fora do pacote. Foram conferidos em `/var/runtime/node_modules/@aws-sdk` da imagem oficial `nodejs:24`.
- **`editarCartao` no cliente**: ganhou um quinto parâmetro opcional (`complemento`) em vez de passar a receber `DadosDeCartao`, para não mudar os chamadores existentes.
- **FR-405, segunda parte**: o formulário volta ao Baralho depois de salvar e nunca fica aberto para o próximo Cartão; a regra de manter o tipo usado não chega a valer hoje.

## R15 — Continuação da implementação e verificação final (2026-10-13)

- O E2E da transição de Cartões foi atualizado para simular a versão 17 antes da migração 18. A fixture antes voltava à versão 15 mesmo com as colunas da migração 17 já presentes, causando `duplicate column name: tipo` ao reabrir o banco.
- O protótipo standalone foi verificado em Chromium nas larguras 360, 390, 768 e 1440 px, com zoom de 200%.
- `npm run verificar:ci` passou: Gitleaks não encontrou segredos, os portões de backend e frontend passaram e os 95 testes E2E passaram.
- **Infraestrutura**: o projeto usa OpenTofu. `tofu fmt` e `tofu validate` passaram com `s3-imagens.tf`.
