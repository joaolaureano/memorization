# Research: Exportar Baralhos

**Feature**: `029-exportar-baralhos` | **Data**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

Registro append-only das decisões de planejamento (Princípio II). O levantamento do código foi feito pelo Arquiteto diretamente: a importação do Anki (`backend/src/importacao/anki.ts`), a Porta (`armazenamento/porta.ts`), a Seam `ArmazemDeMidia` (`src/midia/armazem.ts`), o algoritmo SM-2 (`src/repeticao/`), os limites da Lambda e do CloudFront (`backend/terraform/`) e as telas de Baralhos, do Baralho e de exclusão de conta.

## R0 — Skills aplicadas

- **domain-modeling**: aplicada no `specify`, no `clarify` e aqui.
  - Termos fixados em Key Entities: **Exportação** (o pedido, não guardado), **Formato de exportação**, **Pacote Anki** e **Progresso de estudo**.
  - "Progresso de estudo" é a projeção do Agendamento (`015`) para fora do produto. Não é um termo novo para o Agendamento, que continua sendo o nome interno.
  - Proibidos: "backup" como nome de entidade (é um uso da Exportação, não uma coisa à parte) e "download" como sinônimo de Exportação.
  - Cenários-limite exercitados: Cartão estudado só no Baralho temporário, revisão vencida, nome com `::`, Tag com espaço, mídia ilegível e reimportação nas duas direções.
  - Não há CONTEXT.md nem ADR, pela constituição.
- **codebase-design**: aplicada em R2 a R6. Decidiu onde fica a lógica (um Module `exportacao` profundo, no backend), que nenhuma Seam nova é criada (o registro de formatos não é Seam, R3) e que a Seam `ArmazemDeMidia` e a Porta ganham operações nos dois Adapters já existentes.

## R1 — Onde o arquivo é gerado: no servidor

**Decisão**: o backend gera o pacote, guarda-o no armazém de mídia sob `exportacoes/{usuarioId}/{id}` e devolve um endereço de leitura de 15 minutos com `Content-Disposition: attachment`. O navegador baixa direto do armazém.

**Por quê**:
- A resposta da Lambda tem limite de 6 MB, e um pacote com Áudios (até 10 MB cada) passa disso. Por isso o arquivo nunca trafega pela API, como já acontece com as Mídias (`026`, `028`).
- A importação do Anki já está no backend, com `sql.js` e `fflate`, que servem também para escrever. **Nenhuma dependência nova**.
- As regras de domínio (Progresso, isolamento, limites) ficam num só lugar, e o servidor é a fonte autoritativa (Critérios de Qualidade, Segurança).

**Alternativas rejeitadas**:
- **Gerar no navegador**: levaria `sql.js` (cerca de 1 MB) e `fflate` ao bundle do frontend, exigiria CORS de `GET` no bucket para ler as Mídias por `fetch` e duplicaria a correspondência de tipos no cliente. Livraria do limite de 30 s, mas o limite de R5 cabe nele.
- **Devolver o arquivo na própria resposta**: só funciona abaixo de 6 MB, e a resposta em streaming exigiria trocar o `@fastify/aws-lambda`.
- **Geração assíncrona com fila e aviso**: resolve acervos enormes, mas exige fila, estado da Exportação e consulta periódica. Desproporcional para o limite de R5 (Princípio VII).

## R2 — Module `exportacao` e o registro de formatos

**Decisão**: um Module novo `backend/src/exportacao/`. A Interface pública é a função `exportar(conteudo, formato, contexto)` e o registro `FORMATOS_DE_EXPORTACAO`, com uma única entrada, `apkg`. Cada formato tem `id`, `extensao`, `tipoDeConteudo` e `gerar`.

**Por quê**: FR-462 e SC-190 pedem que um formato novo entre sem mudar o fluxo nem as regras existentes. O registro segue o precedente de `ALGORITMOS` (`015`, FR-191): uma entrada por arquivo e um mapa. O resto do produto (Acervo, HTTP, UI) só conhece o identificador do formato.

**Alternativa rejeitada**: nenhum registro, com o `.apkg` chamado direto pelo Acervo. Isso cumpre o Princípio VII ao pé da letra, mas viola FR-461/FR-462: o formato é um passo da Exportação e precisa de identidade, extensão e tipo de conteúdo.

## R3 — O registro não é Seam

**Decisão**: o registro de formatos não é tratado como Seam. Ele é um mapa de valores, sem Adapter de teste. Os testes atravessam `exportar` com o formato `apkg` real.

**Por quê**: o Princípio IV rejeita Seam com um só Adapter. O registro existe por requisito (FR-462), não para trocar comportamento em teste.

## R4 — Pacote Anki: o formato legado (esquema 11)

**Decisão**: gerar o `.apkg` legado: um zip com `collection.anki2` (SQLite, esquema 11), o arquivo `media` (JSON `{"0": "nome.ext", …}`) e os arquivos de mídia numerados. A estrutura é a mesma que o `genanki` produz.

**Por quê**:
- O Anki para computador (2.1 até as versões correntes), o AnkiDroid e o AnkiMobile importam esse formato (FR-463).
- A importação desta aplicação já lê o formato legado (`anki.ts`, ramo `col.decks`/`col.models`), o que dá a prova de ida e volta no próprio repositório.
- O formato moderno (`collection.anki21b`, compactado com zstd e configuração em protobuf) não é aceito por versões antigas e exigiria escrever protobuf.

**Detalhes** (o contrato completo está em [contracts/apkg.md](./contracts/apkg.md)):
- Um tipo de nota fixo, "Memorization", com os campos `Front` e `Back` e um modelo de cartão. O nome é fixo (premissa da spec).
- **Texto**: o texto é escapado como HTML (`&`, `<`, `>`, `"`), e as quebras de linha viram `<br>` (FR-466).
- **Mídia**: a Imagem vira `<img src="…" alt="…">` na Frente, antes do texto. O Áudio vira `[sound:…]` na Frente, depois da Mensagem. O nome do arquivo de mídia é `memorization-{cartaoId}.{ext}`, que é estável. O formato é reconhecido pelos bytes com as funções existentes (`detectarFormato` e `reconhecerAudio`), porque o banco não guarda o formato.
- **Identificador estável** (FR-467): o `guid` da nota é o `id` do Cartão. Exportar de novo e importar no Anki atualiza a nota em vez de duplicar.
- **Tags**: espaços internos viram `_` (premissa da spec). O código confirma que as Tags são guardadas em minúsculas e que espaços internos são permitidos (`normalizarTags` só apara as pontas), então a troca é necessária.
- **Nomes de Baralho**: vão intactos. Um nome com `::` aparece no Anki como hierarquia, o que é o comportamento do Anki para esse nome (edge case da spec).

## R5 — Limites de geração

**Decisão**: até 10.000 Cartões e até 100 MiB de mídia somada por Exportação. Acima disso, a prévia e a geração recusam com `exportacao_grande_demais`, `motivo` (`cartoes` ou `midia`) e `limite`.

**Por quê**:
- A Lambda tem timeout de 30 s e o CloudFront espera 30 s pela origem (padrão).
- A memória da Lambda (1769 MB) comporta 100 MiB lidos e o zip montado em memória.
- A mídia entra no zip sem compressão (nível 0), porque JPEG, MP3 e similares já são comprimidos.
- As leituras do armazém são paralelas, com até 16 de cada vez.

**`premissa a validar`**: 10.000 Cartões com 100 MiB de mídia geram em menos de 25 s na Lambda. O quickstart mede isso (cenário 12). Se não couber, o limite de mídia cai, em vez de subir o timeout.

## R6 — Tamanho aproximado na prévia (FR-472)

**Decisão**: a Seam `ArmazemDeMidia` ganha `medir(chaves)`, que soma os tamanhos. No S3 isso é `HeadObject` em paralelo (até 32 de cada vez). No Disco é `stat`. Chave ausente conta 0. A prévia soma os bytes da mídia e estima o restante por Cartão.

**Alternativas rejeitadas**:
- **Guardar o tamanho no banco**: exige migração, e os Cartões existentes não têm o valor.
- **`ListObjectsV2` por prefixo do Usuário**: mais rápido, mas exige `s3:ListBucket` na role da Lambda, que hoje é negado de propósito (`s3-imagens.tf`).

## R7 — Leitura consistente do acervo (FR-473)

**Decisão**: a Porta ganha `lerAcervoParaExportacao(usuarioId, baralhoIds | "todos")`, que lê Baralhos, Cartões e Agendamentos numa única transação de leitura. É `REPEATABLE READ` no PostgreSQL. No SQLite, a transação da conexão única basta. A mídia é lida depois, fora da transação, e uma mídia que sumiu nesse intervalo entra em `cartoesSemMidia` (FR-477).

**Alternativa rejeitada**: compor `listarBaralhos`, `listarCartoes` e `listarAgendamentos`. Uma exclusão concorrente poderia deixar Cartão sem Baralho no pacote.

## R8 — Progresso de estudo (FR-469) sem quebrar a opacidade do Agendamento

**Decisão**: a Interface `AlgoritmoDeRepeticao` ganha `descreverProgresso(estado)`, que devolve `{ repeticoes, intervaloEmDias, facilidade }`. O SM-2 a implementa sobre os próprios dados. O Module `exportacao` nunca lê `estado.dados` (FR-191: o estado é opaco).

**Correspondência no Anki** (tabela `cards`):

| Situação no app | `type`/`queue` | `due` | `ivl` | `factor` | `reps` |
|---|---|---|---|---|---|
| Sem Agendamento (nunca estudado, ou só no Baralho temporário) | 0 / 0 (novo) | posição na ordem de criação | 0 | 0 | 0 |
| Com Agendamento | 2 / 2 (revisão) | dias entre `crt` e a data da próxima revisão no fuso do Usuário | `max(1, intervaloEmDias)` | `round(facilidade × 1000)` | `repeticoes` |

- `crt` da coleção é o início do dia da data mais antiga entre hoje e a primeira próxima revisão, no fuso do Usuário. Assim `due` nunca é negativo, e uma revisão vencida chega vencida (edge case).
- O importador do Anki reajusta `due` pela diferença entre o `crt` do pacote e o da coleção de destino.
- O fuso vem do cliente, como na Agenda (`obterAgenda(inicio, fuso)`), e é validado com `ehFusoValido`.

**`premissa a validar`**: no Anki 23.10 e posteriores, a importação de `.apkg` tem a opção "Importar progresso de estudo" (*Import any learning progress*). Não se sabe se ela vem marcada por padrão. A tela de Exportação mostra a dica de marcá-la (contrato de UI), e o quickstart confirma o comportamento (cenário 9).

## R9 — Texto do produto dentro do arquivo (FR-485)

**Decisão**: o pedido de Exportação leva o Idioma da interface (`pt`, `en` ou `es`). O Module `exportacao` tem um catálogo mínimo, com as indicações "[Imagem]" e "[Áudio]" nos três idiomas, usado só quando a mídia não pôde ser lida e a Frente ficaria vazia.

**Por quê**: é o único texto do produto que vai para o arquivo. O catálogo do frontend não chega ao servidor, e trazer o catálogo inteiro para o backend seria desproporcional.

## R10 — Endereço e vida do arquivo gerado (FR-481)

**Decisão**:
- A Seam `ArmazemDeMidia` ganha `guardarExportacao(usuarioId, bytes, nomeDoArquivo, tipoDeConteudo)`, que devolve um `EnderecoDeLeitura` de 15 minutos.
- No S3, o objeto vai para `exportacoes/{usuarioId}/{uuid}`. O endereço assinado usa `ResponseContentDisposition` (`attachment; filename*=UTF-8''…`).
- Uma regra nova de ciclo de vida do bucket expira o prefixo `exportacoes/` em 1 dia, como `pendentes/`.
- No Disco, a rota `/midia-local/` passa a responder `Content-Disposition: attachment` para o prefixo `exportacoes/`.

**Por quê**: o endereço expira em 15 minutos (FR-481), e o objeto some sozinho, sem rotina agendada. Reaproveitar o bucket e a Seam evita um Adapter novo.

**Consequência (Princípio III)**: a Seam `ArmazemDeMidia` passa a guardar também arquivos de Exportação, que não são Mídia de Cartão. O nome continua aceitável, porque o arquivo é efêmero e do mesmo Usuário. Fica registrado para a revisão estrutural. O bucket já se chama `imagens` por custo de infraestrutura (`028`, R2).

## R11 — Nome do arquivo (FR-474)

**Decisão**:
- Exportação de um Baralho: `{nome do Baralho}.apkg`. Os caracteres `/\:*?"<>|` e os de controle viram `-`, e o nome é cortado em 100 caracteres.
- Vários Baralhos ou todos: `memorization-AAAA-MM-DD.apkg`, com a data no fuso do Usuário.

O nome não depende do idioma.

## R12 — Tensões com a spec, a levar ao `analyze`

1. **Ida e volta pela importação desta aplicação** (US1 cenário 4, SC-184): a importação vigente, que a spec mantém inalterada, colapsa espaços em branco (`\s+` → um espaço), o que apaga as quebras de linha. Também transforma as Tags com `_` de volta em Tags diferentes das originais (`"a b"` → `"a_b"`). Além disso, ela recusa pacotes acima de 4 MB e conta `<br>` como "conteúdo ignorado".
   **Proposta ao Product Owner**: reescrever SC-184 e o cenário 4 da US1 como "Frente, Verso e Tags equivalentes segundo as regras da importação vigente (espaços normalizados)". Até a decisão, os testes provam a igualdade só para textos de uma linha e Tags sem espaço.
2. **FR-469 e Cartões estudados que erraram por último**: o SM-2 do app zera `repeticoes` e põe o intervalo em 1 dia. No Anki o Cartão chega em revisão com `ivl = 1`, não em reaprendizagem. Isso é equivalente para a data, que é o que SC-189 mede.

## R13 — Estratégia de testes

- **`exportar` (Vitest, backend)**, atravessando a Interface e lendo o pacote gerado:
  - ida e volta pela `lerPacoteAnki` existente;
  - inspeção do `collection.anki2` com `sql.js` (cartões, `guid`, `type`/`due`/`ivl`/`factor`, tags e Baralhos);
  - `media` e bytes dos arquivos;
  - escape de marcação e `<br>`;
  - mídia ilegível com indicação no idioma pedido;
  - `crt` com revisão vencida;
  - Cartão de Baralho temporário chegando como novo.
- **`descreverProgresso`** pela Interface do algoritmo, com a tabela de referência do SM-2 (`015`, R12).
- **Seam `ArmazemDeMidia`**: a bateria de contrato (Disco sempre; S3 via MinIO/SeaweedFS quando configurado) ganha `ler`, `medir` e `guardarExportacao` (expiração do endereço, `Content-Disposition` e isolamento).
- **Porta**: `lerAcervoParaExportacao` nos dois bancos, com isolamento por Usuário e "todos".
- **`Acervo`**: prévia, limites (`cartoes` e `midia`), Baralho de outro Usuário, seleção vazia e Baralho sem Cartões.
- **HTTP**: códigos e mensagens em inglês ASCII, `401` sem Entrar e corpo inválido.
- **Frontend (Testing Library)**: página de Exportação a partir do Baralho e da lista, marcação de "Todos", resumo, estado "Gerando arquivo…", segunda confirmação bloqueada, falha com nova tentativa, resultado com Cartões sem mídia, link na exclusão de conta e três idiomas.
- **e2e (Playwright)**: exportar um Baralho e conferir o download (nome e assinatura zip); exportar todos; teclado; 360/390/768/1440 px e zoom de 200%.
- **Manual**: abrir o pacote no Anki para computador e no AnkiDroid (quickstart, cenários 8 a 11).

## R14 — Decisões do `analyze` (2026-10-14)

Registro append-only das respostas do Product Owner aos achados do `/speckit-analyze`. A spec foi atualizada (Clarifications, FR-465, FR-466, FR-478, FR-479, FR-481, SC-184, US1 cenário 4, Edge Cases e Assumptions).

- **C1, endereço de download**: o PO aceita que o endereço funcione para quem o tiver durante os 15 minutos, como nas Mídias. Depois de baixado, o arquivo é do Usuário. R10 vale como está.
- **C2 e I1, ida e volta e Tags**: SC-184 e o cenário 4 da US1 passam a exigir equivalência segundo as regras da importação vigente (espaços normalizados, Tags com `_`, limite de 4 MB). FR-466 ganha a exceção do `_`. A tensão 1 de R12 fica resolvida, e os testes provam a equivalência completa, sem forma limitada.
- **I2, Baralhos vazios**: todo Baralho escolhido entra no pacote, mesmo vazio. `exportacao_vazia` só ocorre quando nenhum dos Baralhos escolhidos tem Cartões.
- **B1, limites**: os dois limites de R5 (10.000 Cartões e 100 MiB de mídia) passam para a spec (FR-478).
- **G1, exclusão de conta**: "se exclui a conta, 100% dos conteúdos são excluídos; nada fica salvo".
  - **Decisão**: a chave do arquivo deixa de ser `exportacoes/{usuarioId}/{uuid}` e passa a ser fixa por Usuário: `exportacoes/{usuarioId}`. Cada Exportação sobrescreve a anterior.
  - `excluirUsuario`, nos dois Adapters da Porta, põe essa chave na fila `midia_a_remover` na mesma transação que já enfileira as Mídias dos Cartões. `aposExcluirConta` processa a fila, e uma falha fica guardada para a próxima vez (`026`, FR-421).
  - **Por quê**: a chave conhecida dispensa `s3:ListBucket`, que a role da Lambda nega de propósito (R6). A fila dá a mesma garantia de remoção que as Mídias já têm.
  - **Consequência aceita**: duas Exportações simultâneas do mesmo Usuário compartilham o objeto, e vale a última gravação. O endereço emitido antes pode baixar o arquivo mais novo, que é do mesmo Usuário. O nome do arquivo vem de cada endereço.
  - **Alternativas rejeitadas**: listar o prefixo e apagar (exige `s3:ListBucket` e não tem nova tentativa); só a expiração de 48 h (contraria a decisão do PO).
- **I3, Frente sem mídia no MVP**: a regra da Frente de Cartões de Imagem e Áudio sem mídia (o texto, ou `[Imagem]`/`[Áudio]` no idioma pedido) entra na US1. Assim nenhum Cartão fica fora do pacote antes da US3 (SC-185).

## R15 — Revisão do checklist (2026-10-14)

O PO pediu a revisão de `checklists/anki-seguranca-e-limites.md`. Dos 37 itens, 21 passaram e 16 reprovaram. O PO aprovou as correções recomendadas, e a spec foi atualizada: FR-463, FR-469, FR-472, FR-477, FR-480, SC-189, SC-191 (novo), Edge Cases e Assumptions.

- **CHK021, identificadores no arquivo**: o arquivo não leva o Nome de usuário nem o id do Usuário. O id de cada Cartão entra como `guid` porque o FR-467 depende dele, e isso é aceito.
- **CHK022, nome no endereço**: aceito, junto com o risco do endereço (R14).
- **CHK029, tamanho aproximado**: erro de no máximo ±20% do arquivo gerado a partir do mesmo acervo. A prévia soma os bytes da mídia (R6) mais uma estimativa por Cartão, calibrada no teste.
- **CHK030, armazém fora do ar**: muda R13 e a regra de FR-477.
  - `ArmazemDeMidia.ler` passa a distinguir **ausente** (`null`) de **indisponível** (lança erro).
  - Ausente vira `cartoesSemMidia`. Indisponível falha a exportação inteira com `exportacao_indisponivel`.
  - Uma cópia de segurança sem mídia nunca sai como sucesso.
- **CHK028, tempo com mídia**: o SC-191 promove a premissa de R5 a critério de sucesso. A medição continua na T040.
- **CHK011, tipo de nota**: o `id` do modelo "Memorization" é uma constante fixa do produto (`contracts/apkg.md`).
- **Demais itens** (CHK001, 005, 007, 009, 010, 016, 024, 032, 033 e 037): só redação na spec, sem mudança de desenho.

## Implementação — andamento (2026-10-14)

- Criada a regra de lifecycle `exportacoes/` por 1 dia em `backend/terraform/s3-imagens.tf`, o protótipo navegável em `design/exportar-baralhos/`, a leitura tipada de progresso SM-2 e os três códigos técnicos de recusa.
- `ArmazemDeMidia` agora declara `ler`, `medir` e `guardarExportacao`; os adapters S3 e Disco implementam essas operações, e a rota local serve a exportação como anexo.
- Gates locais ainda pendentes: `tofu validate` falhou ao iniciar o provider AWS instalado; Playwright não conseguiu iniciar Chromium devido à restrição de bootstrap do sandbox. A verificação do protótipo e o CI completo devem ser retomados em ambiente autorizado.
- Verificações executadas: `backend` typecheck e testes selecionados de SM-2, recusas e adapter Disco passaram.
