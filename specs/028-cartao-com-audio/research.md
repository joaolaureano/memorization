# Research: Cartão com Áudio

**Feature**: `028-cartao-com-audio` | **Data**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

Registro append-only das decisões de planejamento (Princípio II). O levantamento do código foi feito pelo Arquiteto diretamente: o fluxo do tipo Imagem (`026`), o registro `TiposDeCartao`, a Seam `ArmazemDeImagens`, as migrações 17 a 19 e os catálogos da `027`.

## R0 — Skills aplicadas

- **domain-modeling**: aplicada no `specify`, no `clarify` e aqui.
  - Termos fixados em Key Entities: **Áudio** é o arquivo; o Cartão é o "Cartão do tipo Áudio". A **Mensagem** é o texto opcional da Frente nesse tipo.
  - Proibidos: "card de áudio", "som" e "gravação" (não há gravação, FR-440).
  - Novo termo transversal: **Mídia**, o arquivo do Cartão, que é uma Imagem ou um Áudio. Ele aparece só onde as duas são tratadas igualmente: armazém, fila de remoção e envio.
  - No código, `frente` continua sendo o campo da Frente em todo tipo: Frente, Texto da frente (Imagem) ou Mensagem (Áudio).
  - Cenários-limite tratados: Áudio sem Mensagem, Cópia, Histórico, navegador que não toca o formato e troca de idioma com o Áudio tocando.
  - Não há CONTEXT.md nem ADR, pela constituição.
- **codebase-design**: aplicada em R2, R3, R7 e na estratégia de testes.
  - A Seam existente de arquivos é generalizada em vez de duplicada (R2).
  - O reconhecimento de Áudio é Module profundo sem Seam (R3).
  - O tocador é um componente único e coordenado (R7).
  - DESIGN-IT-TWICE é inaplicável pela constituição.

## R1 — Fatos do código que restringem o desenho

| Fato | Onde | Consequência |
|---|---|---|
| `ArmazemDeImagens` tem dois Adapters (S3, Disco). As regras de formato, limite e metadados vivem em `armazem.ts` e `metadados.ts` | `backend/src/imagens/` | O Áudio usa os mesmos Adapters. O que muda por tipo de arquivo são as regras. |
| O presigned POST impõe `content-length-range` de até 5 MB | `armazem-s3.ts:59` | O limite passa a vir do tipo de Mídia: 10 MB no Áudio. |
| `bodyLimit` 4 MiB, Lambda com payload de 6 MB | `servidor.ts`, `lambda.tf` | O Áudio também nunca passa pela API: envio direto ao armazém. |
| `confirmar` lê o objeto inteiro e grava a versão limpa (`026`, R13) | `armazem-s3.ts`, `armazem-em-disco.ts` | Para 10 MB, a memória da Lambda (1769 MB) sobra. |
| A leitura local (`lerParaEntrega`) só aceita o prefixo `imagens/` e serve o corpo inteiro | `armazem-em-disco.ts:233` | Ela precisa aceitar `audios/` e responder `Range` (206), que o Safari exige para tocar e todos os navegadores usam para buscar a posição. |
| `cartao.tipo` tem `CHECK (tipo IN ('frente-verso','imagem'))`. No SQLite, o `CHECK` é de coluna e `item_de_registro.tipo` também tem um | `sqlite/migracoes.ts:569`, `:598` | A migração 20 reconstrói `cartao` e `item_de_registro` no SQLite (FKs desligadas). No PostgreSQL, ela troca as constraints. |
| `pertencimento.frente_chave` já aceita `NULL` | migração 17 | Áudio sem Mensagem não precisa de mudança na unicidade. |
| Recusas do servidor: código estável e mensagem técnica em inglês. A UI traduz pelo catálogo, e o `tsc` exige os três idiomas | `http/recusas.ts`, `frontend/src/idioma/` | Códigos novos `audio_ausente` e `audio_invalido` (com `motivo`), mais as entradas nos três catálogos (FR-458, FR-459). |
| `textos.cartao.nomeDoTipo` é `Record<TipoDeCartao, string>` | `idioma/*.ts` | Ao acrescentar `audio` a `TipoDeCartao`, o `tsc` exige o nome nos três catálogos. |
| A prova T011 da `027` proíbe texto solto em `src/` | `frontend/tests/idioma-sem-texto-solto.test.ts` | Todo texto novo do tocador e do formulário vai para os catálogos. |
| Não há `ffmpeg` no ambiente nem no CI | máquina local, `ci.yml` | As amostras de Áudio dos testes são montadas em código, como as de Imagem (`tests/imagens/amostras.ts`). |

## R2 — Seam generalizada: `ArmazemDeMidia`

**Decisão**: renomear a Seam `ArmazemDeImagens` para **`ArmazemDeMidia`** e o Module `backend/src/imagens/` para **`backend/src/midia/`**. A Interface continua com cinco operações, e só `prepararEnvio` e `confirmar` passam a receber o tipo de Mídia:

- `prepararEnvio(usuarioId, midia)`;
- `confirmar(usuarioId, envioId, midia)` devolve `{ ok, chave, formato, bytes, duracaoMs? }` ou `{ ok: false, motivo }`;
- `copiar(chave, usuarioId)`, `enderecoDeLeitura(chave)` e `remover(chaves)` ficam iguais.

As regras por Mídia (formatos, limite, reconhecimento, limpeza de metadados e prefixo da chave) ficam num registro interno `REGRAS_DA_MIDIA: Record<Midia, RegrasDaMidia>`, que os dois Adapters usam. Chaves ativas: `imagens/{usuarioId}/{id}` (inalterada) e `audios/{usuarioId}/{id}`. Pendentes: `pendentes/{usuarioId}/{id}`, inalterado. O tipo de Mídia vem do pedido de confirmação, nunca do arquivo.

**Por quê**: o S3 e o Disco já são as duas Implementations reais, e duplicar a Seam repetiria os dois Adapters inteiros, perdendo Locality. Chamar de "Imagens" um armazém que guarda Áudios violaria o Princípio III. A renomeação é mecânica: 13 arquivos, 27 referências.

**Fila de remoção**: a tabela `imagem_a_remover` vira **`midia_a_remover`** na migração 20 (`ALTER TABLE … RENAME`, barato nos dois bancos). Ela guarda qualquer chave ativa. `processarFilaDeImagens` vira `processarFilaDeMidia`.

**Bucket**: o mesmo bucket `memorization-imagens-{account}` guarda os Áudios. Renomear o bucket exigiria copiar objetos e trocar a infraestrutura sem ganho para o Usuário (Princípio VII). O nome do recurso Terraform e a variável `NOME_DO_BUCKET_DE_IMAGENS` ficam. O comentário do `.tf` passa a dizer "Mídia".

**Modo local**: as rotas do Adapter Disco passam de `/imagens-locais/*` para `/midia-local/*`, com a isenção de Credencial em `credencial.ts` e `servidor.ts` acompanhando. A pasta padrão `imagens-locais/` e a variável `CAMINHO_DAS_IMAGENS` ficam, para não perder os arquivos locais já gravados nem mexer no `.gitignore`.

**Alternativas rejeitadas**:
- (a) uma Seam `ArmazemDeAudios` paralela, que duplica os Adapters e as provas;
- (b) manter o nome `ArmazemDeImagens` guardando Áudio, que fere a linguagem de domínio;
- (c) um bucket novo, com mais infraestrutura, IAM e CORS sem necessidade.

## R3 — Reconhecimento autoritativo do Áudio (FR-436, FR-437)

**Decisão**: um Module interno `backend/src/midia/audio/` com uma função profunda:

```text
reconhecerAudio(bytes) → { ok: true, formato, duracaoMs, bytes: limpos } | { ok: false, motivo: "formato" | "tamanho" | "duracao" }
```

Ela esconde, por contêiner, o reconhecimento da estrutura, a extração da duração e a limpeza de metadados (R4). Sem dependência nova.

| Formato | Reconhecimento (bytes reais) | Codec aceito | Duração |
|---|---|---|---|
| MP3 (`audio/mpeg`) | ID3v2 opcional, depois pelo menos 3 quadros MPEG Layer III consecutivos com cabeçalho válido | MPEG-1/2/2.5 Layer III | Soma dos quadros percorrendo o arquivo inteiro: exata em CBR e VBR, sem depender do cabeçalho Xing |
| M4A (`audio/mp4`) | Caixa `ftyp` com marca `M4A `, `mp42`, `isom` ou `mp41`; `moov` com uma trilha `soun` cuja entrada de amostra é `mp4a`; nenhuma trilha `vide` | AAC | `mdhd` da trilha de som (`duration / timescale`). MP4 fragmentado sem duração é recusado (`formato`) |
| OGG (`audio/ogg`) | Páginas `OggS` com CRC válido; o primeiro pacote é `\x01vorbis` ou `OpusHead` | Vorbis ou Opus | Última `granule_position`: Vorbis ÷ taxa; Opus (− pre-skip) ÷ 48 000 |
| WebM (`audio/webm`) | EBML com `DocType` `webm`; uma trilha de áudio `A_OPUS`; nenhuma trilha de vídeo | Opus | `Info/Duration × TimecodeScale`. Sem `Duration`, vale o maior timecode dos `Cluster` mais o último bloco |
| WAV (`audio/wav`) | `RIFF….WAVE` com `fmt ` e `data` | PCM (1), IEEE float (3) ou `WAVE_FORMAT_EXTENSIBLE` com esses subformatos | `tamanho de data ÷ byteRate` |

- **Limites**:
  - O tamanho é conferido antes de qualquer leitura de estrutura, de 1 byte a 10 485 760.
  - A duração precisa ser maior que zero e no máximo 300 000 ms; acima disso, o motivo é `duracao`.
  - Estrutura truncada, codec fora da tabela ou trilha de vídeo resultam em `formato`.
- **Segurança**: os leitores percorrem os bytes com limites de laço e de profundidade. Nenhum tamanho declarado é confiado sem conferir que cabe no arquivo, e nenhum valor do arquivo vira caminho, chave ou texto de log (FR-455).
- **Por quê**: o requisito é autoritativo e pelo conteúdo real. O projeto já escolheu não depender de biblioteca de mídia na Imagem (`026`, R13). A duração entra no Cartão para a lista (FR-441) sem o navegador precisar baixar o arquivo.
- **Alternativas rejeitadas**:
  - `music-metadata` (npm): pura JS, mas é uma dependência grande, não limpa metadados e confia em `Duration` ausente no WebM.
  - `ffprobe`/`ffmpeg` numa Layer da Lambda: binário nativo arm64, mais cold start e mais superfície.
  - Confiar na duração medida pelo navegador: não é autoritativo.

## R4 — Remoção de metadados sem reencodar (FR-454)

**Decisão**: neutralizar os metadados **mantendo o tamanho** sempre que remover deslocaria referências internas, e remover só onde isso é seguro. O som nunca é tocado.

- **MP3**: remove ID3v2 (início), ID3v1 (`TAG`, 128 bytes do fim), APEv2 e Lyrics3. Os quadros MP3 se sincronizam sozinhos. O quadro Xing/LAME é mantido (dado técnico do codificador).
- **M4A**: as caixas `udta`, `meta` (em `moov` e nas trilhas) e `uuid` de nível superior viram `free` com o conteúdo zerado. O tamanho igual evita reescrever `stco`/`co64`.
- **OGG**: no pacote de comentários (`\x03vorbis` ou `OpusTags`), cada comentário é sobrescrito por `X=` seguido de espaços, com o mesmo comprimento. Isso inclui `METADATA_BLOCK_PICTURE`, a capa. O texto do codificador (vendor) fica. O CRC das páginas alteradas é recalculado.
- **WebM**: os elementos `Tags` e `Attachments`, e `Title` em `Info`, viram `Void` (`0xEC`) do mesmo tamanho total, com o conteúdo zerado.
- **WAV**: os blocos `LIST`, `id3 `, `ID3 `, `bext`, `iXML` e `_PMX` viram `JUNK` com o conteúdo zerado.

A limpeza roda dentro de `reconhecerAudio`. A chave ativa recebe só os bytes limpos.

**Prova**: para cada formato, uma amostra montada com metadados conhecidos (título, artista, GPS, capa) não contém nenhum desses textos depois de `confirmar`, e a duração e o reconhecimento continuam iguais.

**Alternativas rejeitadas**:
- Reconstruir o contêiner sem as caixas: deslocamentos e números de sequência a reescrever, sem ganho.
- Reencodar: perda de qualidade e binário nativo.
- Manter os metadados: contraria FR-454.

## R5 — Envio e leitura

- **Envio** (FR-436): `POST /audios/envios` prepara um presigned POST com `content-length-range` 1…10 485 760, validade de 5 minutos e chave pendente (mesmo fluxo da `026`, R4).
  - O envio acontece ao **salvar**, e a pré-escuta é local (`URL.createObjectURL`).
  - A rota local de envio do Adapter Disco passa a aceitar até o maior limite das Mídias. O limite de cada uma é conferido pelo token, que carrega o tipo de Mídia.
- **Leitura** (FR-453): presigned GET de 15 minutos, emitido só ao dono, em `audio.url`.
  - O S3 responde `Range` em URL assinada sem configuração extra. `<audio src>` sem atributo `crossorigin` não precisa de CORS, e o CORS do bucket fica só com `POST`.
  - O Adapter Disco passa a servir `audios/`, responder `Accept-Ranges: bytes` e `206 Partial Content`, e entregar `Content-Type` pelo formato reconhecido.
- **Renovação**: se o `<audio>` falhar (`error`), o tocador pede o endereço de novo uma vez (como `renovar` da Imagem). Se falhar outra vez, mostra Áudio indisponível (FR-444).
- **Sem reprodução automática**: o `<audio>` usa `preload="metadata"` e nunca `autoplay` (FR-441).

## R6 — Modelo de dados e migrações 20 e 21

**Decisão**: migração 20 (e a 21, abaixo) em paridade SQLite/PostgreSQL. Detalhes em [data-model.md](./data-model.md).

- `cartao.tipo` aceita `audio`.
- Colunas novas `audio_chave` e `audio_duracao_ms`, com as restrições: `audio_chave` está preenchida se e somente se o tipo é `audio`; a duração está presente com o Áudio, de 1 a 300 000.
- O `CHECK` de Frente não vazia passa a isentar `imagem` e `audio`.
- `item_de_registro.tipo` aceita `audio`.
- A tabela `imagem_a_remover` vira `midia_a_remover`.
- No SQLite, `cartao` e `item_de_registro` são reconstruídas com as chaves estrangeiras desligadas (`semChavesEstrangeiras`, como a 17). Sem isso, o `DROP` apagaria Pertencimentos e Agendamentos.
- **Fato do aplicador**: a versão do esquema é um número só. Uma migração com precondição falsa é pulada, e uma migração posterior sem precondição eleva a versão além dela. A pulada nunca mais roda (`sqlite/esquema.ts:85`, `postgresql/esquema.ts:185`).
- **Decisão**: a 20 não tem precondição, e uma **migração 21** repete a 18 e a 19 com a precondição `PODE_REMOVER_VINCULO`: `DROP TABLE IF EXISTS vinculo` e o mesmo `UPDATE` idempotente da 19. É o padrão já usado no projeto (a 16 repetiu a 14, e a 18 repetiu a 16 depois da 17).
  - Numa base com a transição de Pertencimento pendente, o tipo Áudio funciona logo: a 20 é aplicada, e a 21 espera a transição terminar. `versaoAceitaNoInicio` aceita a versão 20, porque a única pendente (21) tem precondição.
  - Numa base sem pendência, que é o caso da nuvem, 20 e 21 rodam em sequência.
  - O `CASE versao >= 19` do INSERT do registro no PostgreSQL (`027`) continua correto: numa base em 20 com a 19 pulada, ele grava `""`, e a leitura já normaliza o rótulo legado (`normalizarRegistro`).
  - Prova: uma base v17 com Cartão sem Pertencimento. Ao abrir, ela chega à v20 com o tipo Áudio utilizável. Quando o Pertencimento é criado e a base reaberta, chega à v21 com `vinculo` removido e os rótulos padrão do registro vazios.
- **Alternativa rejeitada**: dar à 20 a precondição da 18. O tipo Áudio ficaria indisponível enquanto houvesse Cartão sem Pertencimento, e o `Acervo` precisaria recusar `audio` por versão de esquema.
- Os entrypoints de nuvem e Lambda passam a conhecer a v21 como corrente.
- Na Sessão, o tocador é desmontado a cada item novo. A chave é a posição do item, não só o `cartaoId`, porque o mesmo Cartão pode vir duas vezes seguidas e o Áudio precisa parar (FR-442). Revelar não desmonta (`PaginaDeEstudo.tsx:1182`). O operador migra o Neon antes do deploy (fluxo vigente).
- **Alternativa rejeitada**: colunas genéricas `midia_chave`/`midia_formato` substituindo `imagem_chave`. Exigiria migrar os dados da Imagem e mudar o código dela, contra FR-403a ("sem alterar as regras dos tipos existentes").

## R7 — Frontend

- **Registro de tipos**: `TIPOS_DE_CARTAO` ganha `audio`.
  - `validar` cobre Verso obrigatório, limite da Mensagem e Áudio presente.
  - `textosPesquisaveis` é `[frente, verso]` (FR-445).
  - `ORDEM_DOS_TIPOS` passa a ser `["frente-verso", "imagem", "audio"]` (FR-432).
  - `camposDoTipo` envia `tipo: "audio"` e `audioId`.
- **Componentes por tipo**: `ui/tipos-de-cartao/` ganha `AudioDoCartao.tsx`, o tocador único, usado na lista, na Sessão, na edição e na pré-escuta. `ResumoDoCartao` e `FaceDaPergunta` passam a consultar o tipo, como já fazem com a Imagem.
- **Tocador próprio, não `controls` nativo**: os rótulos dos controles nativos seguem o idioma do navegador, não o Idioma da interface (FR-458, SC-181). O tocador tem:
  - um botão Tocar/Pausar com nome acessível no idioma e `aria-pressed`;
  - um `<input type="range">` de posição com `aria-valuetext` falado ("1 minuto e 5 segundos de 2 minutos");
  - o tempo visível `m:ss / m:ss`;
  - uma região de estado educada (tocando, pausado, terminado) (FR-456);
  - alvos de 44 × 44 px;
  - teclado: espaço e Enter no botão; setas, Home e End no controle deslizante.
- **Um de cada vez** (FR-443): um coordenador de Module (`tocadorAtivo`) pausa o Áudio anterior quando outro começa. Desmontar o componente pausa e libera o Áudio. Assim, passar ao próximo Cartão ou sair da Sessão interrompe a reprodução (FR-442). A revelação não desmonta a face da pergunta, então o Áudio continua.
- **Duração** (FR-441, FR-458): o texto visível usa `m:ss` com algarismos de `Intl.NumberFormat` do locale. O nome acessível usa `Intl.NumberFormat` com `style: "unit"` (`minute`/`second`, `unitDisplay: "long"`) e `Intl.ListFormat`. `Intl.DurationFormat` foi rejeitado por suporte incompleto nos navegadores-alvo.
- **Retorno rápido no navegador**: formato pelo `type` ou pela extensão, tamanho pelo `File.size` e duração pelo `loadedmetadata` de um `<audio>` local. A decisão é do servidor.
- **Seam do cliente**: `ClienteDoAcervo.enviarImagem(arquivo)` vira `enviarMidia(midia, arquivo)`, nos dois Adapters (HTTP e memória). `ClienteEmMemoria` simula recusas por formato, tamanho e duração (pela duração declarada no teste).
- **Formulário** (FR-433): ao trocar de tipo, `frente` é o campo comum entre Frente, Texto da frente e Mensagem. A confirmação de descarte cobre Imagem e Áudio já escolhidos.
- **Ajuda da Mensagem** (FR-457): `textos.cartao.mensagemHint` nos três idiomas.

**Protótipo**: `design/cartao-com-audio/` (convenção da `026`), com o tocador em 360, 390, 768 e 1440 px, zoom de 200% e os três idiomas, verificado no Chromium.

## R8 — Traduções (FR-458, FR-459, FR-460)

- Glossário fixo (complementa a `027`, R9):

  | PT | EN | ES |
  |---|---|---|
  | Áudio | Audio | Audio |
  | Mensagem | Message | Mensaje |
  | Tocar / Pausar | Play / Pause | Reproducir / Pausar |
  | Áudio indisponível | Audio unavailable | Audio no disponible |
  | Enviando áudio… | Uploading audio… | Subiendo audio… |
  | Duração | Duration | Duración |
  | Áudio do Cartão | Card audio | Audio de la tarjeta |

- Recusas novas no servidor (`http/recusas.ts`, mensagem técnica em inglês e só ASCII):
  - `audio_ausente` ("Choose an audio file.");
  - `audio_invalido` ("Audio is invalid."), com `motivo` ∈ `nao_encontrado`, `formato`, `tamanho`, `duracao` e `limite` em bytes ou segundos.
- O armazém usa `nao_encontrada` (herdado da Imagem, concordando com "Mídia"). A recusa HTTP do Áudio usa `nao_encontrado` (concordando com "Áudio"). A conversão fica só em `http/recusas.ts` (T025), e a Imagem continua com `nao_encontrada`.
- No cliente, os textos para a pessoa ficam em `idioma/recusas.ts` e nos catálogos, com o mesmo `textoDaRecusaPt` e a memória de tradução da `027` (FR-015), para que a recusa já mostrada mude com a troca de idioma.
- Conteúdo do Usuário (Mensagem, Verso, Tags e nome do arquivo) entra só como argumento interpolado (FR-460).

## R9 — Compatibilidade de reprodução (risco aceito)

Chromium, Firefox e Safari recentes tocam MP3, M4A/AAC e WAV. OGG Vorbis/Opus e WebM Opus tocam no Chromium e no Firefox, e no Safari dependem da versão. Um Áudio aceito que o navegador não toca cai no aviso de Áudio indisponível (spec, Edge Cases; FR-444). Não há conversão no servidor (R3, alternativas rejeitadas).

**Ajuda do campo**: o texto de ajuda do campo Áudio lista os formatos e recomenda MP3 ou M4A para tocar em todos os aparelhos.

## R10 — Infraestrutura

- Nenhum recurso novo.
- Bucket, ciclo de vida de `pendentes/`, IAM (`/*`) e criptografia valem para `audios/`.
- CORS continua só `POST`.
- O `.tf` muda só nos comentários.
- A Lambda não muda de memória: um Áudio de 10 MB, lido inteiro, mais a cópia limpa, ocupa cerca de 20 MB.

## R11 — Estratégia de testes

- **Reconhecimento** (`tests/midia/audio.test.ts`):
  - **Amostras em código** (`tests/midia/amostras-de-audio.ts`): MP3 com quadros de silêncio, M4A com caixas mínimas, OGG com páginas e CRC, WebM com e sem `Duration` e WAV PCM.
  - **Casos cobertos**: cada formato aceito, duração exata, 5 min aceito e 5 min + 1 s recusado, 10 MB + 1 recusado, truncado, codec fora da tabela, trilha de vídeo, texto renomeado para `.mp3` e metadados removidos.
  - **Robustez**: tamanhos declarados maiores que o arquivo e laços sem fim.
- **Tempo até tocar (SC-180)**: o e2e mede, contra o Adapter Disco, o tempo do Tocar ao primeiro `playing` com um Áudio de 1 MB (≤ 2 s). A medida de produção (S3 e CloudFront) é o cenário 15 do quickstart, depois do deploy.
- **Bateria de contrato do armazém**: a atual, parametrizada por Mídia, contra Disco sempre e MinIO quando configurado. Inclui `Range` e 206 no Adapter Disco.
- **Acervo** (SQLite + Disco):
  - criar e editar o tipo Áudio;
  - Áudio e Verso obrigatórios;
  - tipo imutável;
  - unicidade só com Mensagem;
  - Cópia com chave nova;
  - exclusões passando pela fila;
  - snapshot com `tipo: "audio"` e sem Áudio;
  - isolamento entre Usuários.
- **Porta** (SQLite e PostgreSQL):
  - migração 20 sobre dados da v19;
  - uma v17 com transição pendente chega à v20, e depois à v21 quando a precondição vale;
  - os `CHECK`s;
  - a fila renomeada.
- **HTTP**:
  - `POST /audios/envios` exige Entrar;
  - `422 audio_invalido` com cada `motivo`;
  - `400 audio_ausente`;
  - Áudio de outro Usuário não é emitido;
  - mensagens técnicas em inglês e só ASCII, cobertas pela prova da `027`.
- **Frontend** (Testing Library):
  - seletor com três tipos;
  - troca preservando `frente`, Verso e Tags;
  - aviso de descarte do Áudio;
  - pré-escuta, trocar e remover;
  - recusas no campo com foco;
  - edição sem seletor;
  - lista com rótulo e duração;
  - Sessão: Mensagem e tocador antes da revelação, Verso depois, o Áudio continua na revelação e para no próximo item;
  - um Áudio de cada vez;
  - Áudio indisponível;
  - filtro por Tipo com Áudio;
  - textos nos três idiomas;
  - prova T011 sem texto solto.
- **E2E** (Playwright, Adapter Disco):
  - fluxo completo com um WAV montado no teste, nas larguras de 360, 390, 768 e 1440 px e com zoom de 200%;
  - tocar e pausar por teclado;
  - recarregar persiste;
  - excluir remove o arquivo;
  - troca de idioma com o Áudio carregado.
- **Validação manual** (quickstart): arquivos reais de celular (M4A do iPhone, OGG/Opus do Android, MP3 com capa) para conferir reconhecimento, duração e limpeza de metadados fora das amostras sintéticas.

## R12 — Fora do escopo confirmado

Gravar pelo microfone (clarify), Áudio no Verso, vários Áudios por Cartão, velocidade de reprodução, forma de onda, transcrição, conversão de formato, normalização de volume, importação de Áudio do Anki (FR-452) e mudar o tipo de um Cartão.

## R13 — Implementação: desvios do plano (2026-10-14)

- **`enviarAudio` em vez de `enviarMidia(midia, arquivo)`** (revisa R7): o Seam `ClienteDoAcervo` ganha `enviarAudio` ao lado de `enviarImagem`, sem trocar a assinatura existente. Trocar exigiria mudar cinco chamadores e provas da Imagem sem ganho de comportamento (Princípio VII). As duas implementações compartilham o fluxo por um auxiliar interno.
