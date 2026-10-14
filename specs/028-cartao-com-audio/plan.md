# Implementation Plan: Cartão com Áudio

**Branch**: `028-cartao-com-audio` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Especificação 028 com o esclarecimento de 2026-10-14: só envio de arquivo, sem gravação no app.

## Summary

Acrescentar o tipo `audio` ao registro `TiposDeCartao` dos dois lados, sem mudar as regras de Frente-Verso e Imagem (FR-403a).

- **Armazém**: a Seam `ArmazemDeImagens` vira `ArmazemDeMidia`, com regras por Mídia (`imagem`, `audio`) e os mesmos dois Adapters (S3, Disco). O mesmo bucket guarda os Áudios em `audios/`.
- **Reconhecimento**: um Module interno `midia/audio/` reconhece MP3, M4A, OGG, WebM e WAV pelos bytes. Ele mede a duração (até 5 min, 10 MB) e neutraliza metadados sem reencodar.
- **Migrações**: a 20 acrescenta `audio_chave` e `audio_duracao_ms` e renomeia a fila para `midia_a_remover`. A 21 repete a finalização da 18 e da 19.
- **Frontend**: um tocador próprio (`AudioDoCartao`), com textos nos três idiomas, um Áudio de cada vez e sem reprodução automática.

Decisões em [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript estrito. Node.js 24 (backend e Lambda `nodejs24.x` arm64). React 19 com Vite.

**Primary Dependencies**: as existentes (Fastify 5, Zod, `node:sqlite`, `pg`, AWS SDK S3 da `026`, React, Vitest, Testing Library, Playwright). **Nenhuma nova** (R3).

**Storage**:
- Bancos: SQLite local e PostgreSQL Neon (migrações 20 e 21).
- Arquivos: bucket S3 existente `memorization-imagens-{account}`, prefixo `audios/`, ou o disco local (`CAMINHO_DAS_IMAGENS`).

**Testing**:
- Vitest no backend: reconhecimento de Áudio com amostras montadas em código; bateria do armazém parametrizada por Mídia (Disco e MinIO); Acervo; Porta nos dois bancos; HTTP.
- Testing Library no frontend.
- Playwright e2e com WAV montado no teste.
- Verificador Chromium do protótipo.

**Target Platform**: navegador com API Node (local), ou Lambda Function URL atrás do CloudFront.

**Project Type**: aplicação web cliente-servidor.

**Performance Goals**:
- SC-180: Áudio de até 1 MB tocando em até 2 s, em 95% dos casos. Leitura direta do S3 com `preload="metadata"` e `Range`.
- SC-175: criação em até 6 interações.

**Constraints**:
- O Áudio nunca trafega pela API (limite de 6 MB da Lambda).
- `<audio>` não envia Basic auth, por isso o Áudio usa URL assinada.
- O esquema passa de 19 para 20 e 21, com a 21 sob precondição (R6).
- Nenhum segredo novo.
- Textos novos nos três catálogos tipados (`027`).
- Mensagens técnicas em inglês e só ASCII.

**Scale/Scope**:
- 1 tipo novo e 1 Seam renomeada e generalizada.
- 1 Module de reconhecimento (5 contêineres).
- 2 migrações e 1 rota nova.
- 1 componente de tocador.
- 4 telas alteradas: formulário, detalhe do Baralho, Sessão e Histórico.
- 1 protótipo.
- Infraestrutura: só comentários.

## Constitution Check

*GATE: antes da Phase 0 e reavaliado depois da Phase 1.* Constituição vigente no working tree, com o Princípio XI citado no Fluxo de Trabalho.

| Princípio | Veredito |
|---|---|
| I — Spec-Driven | **PASS**. Tudo deriva da spec 028 e do clarify (FR-440). Nenhum `NEEDS CLARIFICATION`. Os limites (10 MB, 5 min, formatos) são premissas da spec, e o `clarify` ainda pode revisá-los. |
| II — Auditabilidade | **PASS**. As decisões e as alternativas rejeitadas estão em `research.md` (R0–R12). |
| III — Domínio antes de tecnologia | **PASS**. Termos novos: Áudio, Mensagem e Mídia (R0). O nome `ArmazemDeImagens` deixa de mentir sobre o conteúdo (R2). O bucket e a variável de ambiente mantêm o nome por custo de infraestrutura, o que fica registrado. |
| IV — Módulos profundos | **PASS**. Nenhuma Seam nova: a existente ganha um parâmetro em duas operações e continua com dois Adapters reais. `reconhecerAudio` é uma função profunda (uma entrada e um resultado escondendo 5 contêineres). O tocador é um componente único. |
| V — Interface é a superfície de teste | **PASS**. Reconhecimento pela própria função; armazém pela bateria de contrato; regras pelo `Acervo` e pelo `ClienteDoAcervo`; UI pela Testing Library e pelo e2e. |
| VI — Verificação | **PASS condicionado** à revisão dos diffs e à execução dos portões. |
| VII — Escopo mínimo | **PASS**. Sem biblioteca de mídia, sem conversão, sem velocidade de reprodução, sem forma de onda, sem gravação e sem bucket novo. A renomeação da Seam e da fila tem justificativa no Princípio III. |
| VIII — Segredos | **PASS**. Nenhuma chave nova. As credenciais do MinIO ficam só no ambiente local e no CI. gitleaks no `verificar:ci`. |
| IX — Rastreabilidade | **PASS condicionado**: `tasks` deve mapear FR-431…FR-460 e SC-175…SC-182. |
| X — Portões | **PASS até aqui**. Checklist 16/16. `analyze` antes de `implement`. |

### Reavaliação depois da Phase 1

**PASS**. O desenho preserva a Interface pública do `Acervo`, porque as operações existentes só ganham uma variante na união discriminada. A Seam `ClienteDoAcervo` troca `enviarImagem` por `enviarMidia(midia, arquivo)` nos dois Adapters ao mesmo tempo. A migração 20 não deixa a 18 e a 19 órfãs, graças à 21 (R6). O contrato HTTP da Imagem não muda, exceto o prefixo das rotas locais do Adapter Disco.

## Decisões de Codebase Design

### `ArmazemDeMidia` (backend `src/midia/`, antes `src/imagens/`)

- **Interface**:
  - `prepararEnvio(usuarioId, midia)`;
  - `confirmar(usuarioId, envioId, midia)`, que devolve `duracaoMs` no Áudio;
  - `copiar`, `enderecoDeLeitura` e `remover`, inalterados.
- **Regras por Mídia** em `midia/regras.ts`: a Imagem com as regras de hoje (`detectarFormato`, `removerMetadados`), e o Áudio com `reconhecerAudio`.
- **Adapters**: `armazem-s3.ts` e `armazem-em-disco.ts`. O Disco serve `Range`/206 e o prefixo `audios/`.
- **Rotas locais**: `/midia-local/*`.

### `reconhecerAudio` (backend `src/midia/audio/`)

- `reconhecer.ts` é a função pública.
- Internos por contêiner: `mp3.ts`, `mp4.ts`, `ogg.ts`, `webm.ts`, `wav.ts`. Cada um devolve `{ formato, duracaoMs, limpar(): Uint8Array }` ou `null`.
- Os internos não são Interface: as provas atravessam `reconhecerAudio` (R11).

### `TiposDeCartao`

- **Backend**:
  - entrada `audio` com `validar` (Verso, limite da Mensagem e `temAudio`) e `chaveDaFrente` (vazia vira `null`);
  - `ehTipoDeCartao` passa a aceitar `audio`.
- **Frontend**:
  - entrada `audio` (validação, textos pesquisáveis e `conferirArquivoDeAudio`);
  - `ORDEM_DOS_TIPOS` com três tipos;
  - `camposDoTipo` com `audioId`.

### `Acervo`

- `criarCartao` e `editarCartao` confirmam o Áudio com `midia: "audio"` e gravam a chave e a duração. Uma falha depois de confirmar põe a chave na fila.
- A leitura anexa `audio` (endereço de 15 minutos) e `duracaoMs`.
- A Cópia usa `copiar`. As exclusões e a troca passam pela fila `midia_a_remover`.
- O snapshot leva `tipo: "audio"`.

### HTTP

- `POST /audios/envios`.
- O Zod de criação e edição aceita `tipo: "audio"` e `audioId`.
- Códigos novos `audio_ausente` e `audio_invalido` em `http/recusas.ts`.

### Frontend

- **Seam**: `ClienteDoAcervo.enviarMidia(midia, arquivo)` nos Adapters HTTP e em memória.
- **Componentes**:
  - `ui/tipos-de-cartao/AudioDoCartao.tsx` (o tocador), com o coordenador de reprodução em `ui/tipos-de-cartao/tocador-ativo.ts`;
  - `ResumoDoCartao`, `FaceDaPergunta`, `PaginaDoFormularioDeCartao`, o Histórico e o filtro por Tipo consultam o tipo.
- **Textos**: catálogos `pt`, `en` e `es` (seção `cartao` e `recusas`), mais `idioma/recusas.ts` e a memória de tradução.
- **Duração**: `idioma/duracao.ts`, com `formatarDuracao` e `duracaoFalada` via `Intl`.

### Infraestrutura

Sem recurso novo. Atualizar os comentários de `backend/terraform/s3-imagens.tf` (Mídia: Imagens e Áudios, limite por tipo). Deploy: migrar o Neon para a v21 antes da Lambda, pelo fluxo vigente.

## Estratégia de Testes

Detalhada em research R11. Em resumo:
- reconhecimento por formato (aceite, limites, truncado, disfarce, metadados e robustez);
- bateria do armazém por Mídia, com `Range` no Disco;
- regras do `Acervo` e isolamento;
- migrações 20 e 21 nos dois bancos, incluindo a base com transição pendente;
- HTTP com códigos e mensagens em inglês ASCII;
- UI: seletor, troca, tocador, um de cada vez, Sessão, Histórico, filtro, três idiomas e T011;
- e2e em 4 larguras, zoom de 200% e teclado;
- validação manual com arquivos reais.

## Project Structure

### Documentation (this feature)

```text
specs/028-cartao-com-audio/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/
    ├── http.md
    └── ui.md
```

### Source Code

```text
backend/src/midia/                               # antes src/imagens/ (renomeado)
├── armazem.ts                                   # Interface ArmazemDeMidia, Midia, chaves
├── regras.ts                                    # REGRAS_DA_MIDIA (novo)
├── imagem/{formato,metadados}.ts                # regras da Imagem (movidas)
├── audio/{reconhecer,mp3,mp4,ogg,webm,wav}.ts   # reconhecimento do Áudio (novo)
├── armazem-s3.ts
├── armazem-em-disco.ts                          # + audios/, Range/206
└── configuracao.ts
backend/src/acervo/{acervo,tipos-de-cartao}.ts
backend/src/armazenamento/porta.ts
backend/src/armazenamento/{sqlite,postgresql}/   # migrações 20 e 21 + Adapters
backend/src/identidade/identidade.ts             # fila renomeada
backend/src/http/{rotas,recusas,credencial,servidor,midia-local}.ts
backend/src/entradas/{local,nuvem}.ts  backend/src/funcao/funcao.ts
backend/tests/midia/                             # antes tests/imagens/ + audio.test.ts, amostras-de-audio.ts
backend/tests/{acervo,armazenamento,http,mensagens}/
backend/terraform/s3-imagens.tf                  # só comentários
frontend/src/acervo-cliente/{cliente,cliente-http,cliente-em-memoria,tipos-de-cartao,busca-no-acervo}.ts
frontend/src/ui/tipos-de-cartao/{AudioDoCartao.tsx,tocador-ativo.ts,ResumoDoCartao.tsx,FaceDaPergunta.tsx}
frontend/src/ui/{PaginaDoFormularioDeCartao,PaginaDoBaralho,PaginaDeEstudo}.tsx + Histórico
frontend/src/idioma/{pt,en,es,tipos,recusas,mensagens,duracao}.ts
frontend/src/estilos.css
frontend/tests/
e2e/cartao-com-audio.spec.ts
design/cartao-com-audio/                         # protótipo + verificar.mjs (novo)
```

**Structure Decision**: os Modules existentes ficam. O `src/imagens/` é renomeado para `src/midia/`, com o reconhecimento de Áudio como Module interno. Nenhum pacote, serviço ou recurso de nuvem novo.

## Complexity Tracking

| Acréscimo | Por quê | Alternativa mais simples rejeitada |
|---|---|---|
| Leitores de 5 contêineres próprios | FR-437 (autoritativo pelo conteúdo), duração no servidor e FR-454 (metadados) sem dependência nem binário | `music-metadata`: não limpa metadados e é uma dependência grande. `ffprobe`: binário nativo na Lambda |
| Renomear Seam, Module e fila | Princípio III: "Imagens" guardando Áudio | Manter os nomes: linguagem enganosa em todo o código novo |
| Migração 21 | O aplicador de versão única pularia a 18 e a 19 para sempre (R6) | Precondição na 20: Áudio indisponível em bases com transição pendente |
| Tocador próprio | Os controles nativos falam o idioma do navegador (FR-458) | `<audio controls>`: viola FR-458 e SC-181 |
