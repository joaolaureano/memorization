# Implementation Plan: Cartão com Imagem

**Branch**: `026-cartao-com-imagem` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Especificação 026 com os cinco esclarecimentos de 2026-10-13 (Imagem só na Frente; JPEG/PNG/WebP/GIF até 5 MB; regras por tipo; Anki fora; Histórico sem Imagem).

## Summary

Introduzir o Tipo de cartão (`frente-verso`, padrão, e `imagem`) com regras próprias por tipo num registro `TiposDeCartao`, consultado pelo `Acervo` e pelo formulário — o fluxo é fixo e os passos variáveis vêm do tipo (FR-403a). Imagens ficam num bucket S3 privado atrás de uma Seam nova `ArmazemDeImagens` (Adapters S3 e Disco). O navegador envia direto ao S3 por presigned POST limitado a 5 MB; o backend confirma o formato pelos bytes, promove o objeto e grava o Cartão; a leitura usa presigned GET de 15 minutos emitido só ao dono. Remoções passam por uma fila transacional `imagem_a_remover`. Migração 17 em paridade SQLite/PostgreSQL. Decisões em [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript estrito; Node.js 24 (backend e Lambda `nodejs24.x` arm64); React 19 + Vite.

**Primary Dependencies**: existentes — Fastify 5, Zod, `node:sqlite`, `pg`, `@fastify/aws-lambda`, React, Vitest, Testing Library, Playwright. Novas (backend, produção, empacotadas pelo esbuild): `@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`, `@aws-sdk/s3-request-presigner`. Nenhuma no frontend.

**Storage**: SQLite local / PostgreSQL Neon (migração 17); arquivos em S3 `memorization-imagens-{account_id}` (us-east-1) ou disco local (`CAMINHO_DAS_IMAGENS`).

**Testing**: Vitest (Interface do `Acervo`, bateria da Porta nos dois adapters, bateria de `ArmazemDeImagens` contra Disco e MinIO), Testing Library no frontend, Playwright e2e, verificador Chromium do protótipo.

**Target Platform**: navegador + API Node (local) / Lambda Function URL atrás de CloudFront.

**Project Type**: aplicação web cliente-servidor.

**Performance Goals**: Imagem visível na Sessão em ≤ 2 s em 95% das apresentações (SC-172) — leitura direta do S3 na mesma região; criação de Cartão Imagem em < 90 s (SC-167).

**Constraints**: payload Lambda 6 MB e `bodyLimit` 4 MiB (Imagem nunca trafega pela API); Basic auth por requisição (`<img>` não autentica → URL assinada); esquema 16 → 17; nenhum segredo novo (assinatura com credenciais temporárias da role); pendentes expiram por ciclo de vida de 1 dia, removidos em até 48 h (R7, R12).

**Scale/Scope**: 1 tipo novo, 1 Seam nova, 1 migração, 3 telas alteradas (formulário, detalhe do Baralho, Sessão) + Histórico, 1 recurso Terraform novo, 1 protótipo.

## Constitution Check

*GATE: antes da Phase 0 e reavaliado após a Phase 1.* Constituição vigente no working tree (3.2.0, sem o Princípio XI — remoção local ainda não commitada pelo Product Owner).

| Princípio | Veredito |
|---|---|
| I — Spec-Driven | **PASS**. Tudo deriva da spec 026 e do clarify; nenhum `NEEDS CLARIFICATION`. |
| II — Auditabilidade | **PASS**. Decisões e alternativas em `research.md`; uso do Haiku 4.5 registrado. |
| III — Domínio antes de tecnologia | **PASS**. Termos novos definidos em Key Entities; código usará `TipoDeCartao`, `Imagem`, `frente` (Texto da frente no tipo Imagem), `textoAlternativo`. |
| IV — Módulos profundos | **PASS**. `ArmazemDeImagens` tem 2 Adapters reais (S3, Disco) e Interface de 5 operações; `TiposDeCartao` é estrutura interna sem Seam. Nenhuma Seam hipotética. |
| V — Interface é a superfície de teste | **PASS**. Regras provadas pelo `Acervo`/`ClienteDoAcervo`; armazém por bateria de contrato comum aos Adapters. |
| VI — Verificação | **PASS condicionado** à revisão de diffs e execução dos gates na implementação. |
| VII — Escopo mínimo | **PASS**. Sem redimensionamento, sem contagem de referências, sem cookies assinados; `tipo` obrigatório na API, sem compatibilidade retroativa. |
| VIII — Segredos | **PASS**. Nenhuma chave nova; nome do bucket via env; credenciais MinIO só em ambiente local/CI. `imagens-locais/` no `.gitignore`. |
| IX — Rastreabilidade | **PASS condicionado**: `tasks` deve mapear FR-403…FR-426 (incl. 403a, 419a). |
| X — Portões | **PASS até aqui**. Checklist 026 16/16; `analyze` antes de `implement`. As premissas de R6 e R7 foram resolvidas pelo Product Owner (research R12): pendentes em até 48 h; Imagem exibida direto no Cartão, com endereço assinado interno. |

### Reavaliação após Phase 1

**PASS**. Premissas de R6/R7 resolvidas (R12). O desenho preserva a Interface pública do `Acervo` (operações existentes ganham a união discriminada), mantém `ClienteDoAcervo` como Seam UI↔servidor com seus dois Adapters e acrescenta exatamente uma Seam com dois Adapters.

## Decisões de Codebase Design

### `TiposDeCartao` (backend `src/acervo/tipos-de-cartao.ts`, frontend `src/acervo-cliente/tipos-de-cartao.ts` + `src/ui/tipos-de-cartao/`)

Registro `Record<TipoDeCartao, RegrasDoTipo>`. No backend: `validar(dados)`, `chaveDaFrente(dados)`, `numerar(dados, n)`, `paraSnapshot(cartao)`. No frontend: `Campos` (componente do formulário), `validar`, `Resumo` (item da lista), `FaceDePergunta` (Sessão), `textoPesquisavel`. `Acervo`, `PaginaDoFormularioDeCartao`, `PaginaDoBaralho`, `PaginaDeEstudo` e `busca-no-acervo` consultam o registro; não ramificam por tipo.

### `ArmazemDeImagens` (backend `src/imagens/`)

Interface: `prepararEnvio`, `confirmar`, `copiar`, `enderecoDeLeitura`, `remover` (ver research R3). Adapters: `armazem-s3.ts` (produção) e `armazem-em-disco.ts` (local e testes; serve envio/leitura por rotas `/imagens-locais/*` com token HMAC de curta duração registradas só em `entradas/local.ts`). Injetado em `Acervo` e `Identidade` pelos entrypoints (`local.ts`, `nuvem.ts`, `funcao.ts`).

### `Acervo` — aprofundado

- `criarCartao`/`editarCartao`: validam texto pelo tipo → `confirmar` (se há `imagemId` novo) → gravam; em falha após confirmar, a chave vai para a fila. Leitura anexa `enderecoDeLeitura` por Cartão Imagem.
- `excluirCartao`/`excluirBaralho`, `Identidade.excluirConta`: Porta grava a fila na transação; depois, `processarFilaDeRemocao()` (interno, também chamado na inicialização).
- `salvarSelecaoComoBaralho`: `copiar` antes da transação; falha da transação enfileira as cópias.
- `registrarSessao`: snapshot com `tipo` pelo registro.

### Frontend

`ClienteDoAcervo` ganha `enviarImagem(arquivo): Promise<{ ok: true; imagemId } | { ok: false; erro }>`; `criarCartao`/`editarCartao` recebem a união discriminada (a assinatura posicional de `editarCartao` passa a receber `DadosDeCartao`). Componentes por tipo em `src/ui/tipos-de-cartao/`. Contrato visual em [contracts/ui.md](./contracts/ui.md).

### Infraestrutura

`backend/terraform/s3-imagens.tf` (bucket, bloqueio público, SSE-S3, ciclo de vida `pendentes/` 1 dia, CORS `POST` da origem CloudFront, política inline na role da Lambda com Put/Get/Delete em `/*`), variável `NOME_DO_BUCKET_DE_IMAGENS` na Lambda, output do nome. CI: serviço MinIO no job de backend. Deploy: `tofu apply` (OpenTofu) antes do deploy da Lambda; migrações 17 e 18 no Neon antes da troca de código (fluxo vigente).

## Estratégia de Testes

- **Acervo** (SQLite + Disco): criar/editar por tipo; Imagem obrigatória; tipo imutável; unicidade só com Texto da frente; numeração; snapshot com `tipo` e sem Imagem; Cópia com chave nova; exclusões enfileiram e removem; falha do armazém após commit deixa fila e é reprocessada; falha da gravação após confirmar não deixa órfã; isolamento entre Usuários.
- **Bateria da Porta** (SQLite e PostgreSQL): migração 17 sobre dados da v16; CHECKs; `frente_chave` nula múltipla; fila na mesma transação de exclusões e troca.
- **Bateria `ArmazemDeImagens`** (Disco sempre; S3 via MinIO quando configurado): envio dentro e fora do limite; confirmação por assinatura (JPEG, PNG, GIF87a/89a, WebP; texto renomeado recusado); pendente não legível; leitura assinada expira; cópia independente; remoção idempotente.
- **HTTP**: `POST /imagens/envios` exige Entrar; união discriminada; `422 imagem_invalida`; `409 tipo_imutavel`; leitura de outro Usuário `404`; entrypoints exigem v17.
- **Frontend**: seletor inicia em Frente-Verso a cada abertura; troca anuncia e preserva textos; confirmação ao descartar Imagem; pré-visualização/trocar/remover; recusas no campo com foco; edição sem seletor; lista com rótulo e miniatura; Sessão com Imagem e fallback; Histórico; teclado e foco.
- **E2E**: fluxo completo local (Adapter Disco) em 360/390/768/1440 px e zoom 200%; recarregar persiste; exclusão remove arquivo.
- **Protótipo**: verificador Chromium em `design/cartao-com-imagem/`.

## Project Structure

### Documentation (this feature)

```text
specs/026-cartao-com-imagem/
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
backend/src/acervo/tipos-de-cartao.ts            # regras por Tipo de cartão (novo)
backend/src/acervo/acervo.ts                     # união discriminada, armazém, fila
backend/src/acervo/invariantes.ts                # limites (descrição 250) e chave nula
backend/src/imagens/armazem.ts                   # Interface ArmazemDeImagens + assinaturas de formato (novo)
backend/src/imagens/armazem-s3.ts                # Adapter S3 (novo)
backend/src/imagens/armazem-em-disco.ts          # Adapter Disco (novo)
backend/src/armazenamento/porta.ts               # tipos e operações da fila
backend/src/armazenamento/sqlite/                # migração 17 + Adapter
backend/src/armazenamento/postgresql/            # migração 17 + Adapter
backend/src/identidade/identidade.ts             # remoção pós-exclusão de conta
backend/src/http/rotas.ts                        # /imagens/envios, união, códigos novos
backend/src/entradas/{local,nuvem}.ts            # composição do armazém
backend/src/funcao/funcao.ts                     # composição na Lambda
backend/tests/acervo/ backend/tests/armazenamento/ backend/tests/imagens/ backend/tests/http/
backend/terraform/s3-imagens.tf                  # bucket, CORS, ciclo de vida, IAM (novo)
frontend/src/acervo-cliente/{cliente,cliente-http,cliente-em-memoria,validacao,tipos-de-cartao}.ts
frontend/src/ui/tipos-de-cartao/                 # Campos/Resumo/FaceDePergunta por tipo (novo)
frontend/src/ui/{PaginaDoFormularioDeCartao,PaginaDoBaralho,PaginaDeEstudo}.tsx
frontend/src/estilos.css
frontend/tests/
e2e/
design/cartao-com-imagem/                        # protótipo + verificar.mjs (novo)
.github/workflows/ci.yml                         # serviço MinIO
.gitignore                                       # imagens-locais/
```

**Structure Decision**: manter os Modules existentes e acrescentar só `src/imagens/` (Seam com dois Adapters) e os registros `tipos-de-cartao`. Nenhum serviço ou pacote novo além das dependências AWS do backend.

## Complexity Tracking

| Acréscimo | Por quê | Alternativa mais simples rejeitada |
|---|---|---|
| Seam `ArmazemDeImagens` com 2 Adapters | S3 obrigatório na nuvem; modo local e testes não podem depender de AWS | Só S3 + emulador em todo ambiente: obriga MinIO para abrir o app local |
| Fila `imagem_a_remover` | Banco e S3 não compartilham transação; FR-421/SC-171 exigem remoção confiável | Apagar antes/depois sem fila: órfãos ou Cartão sem Imagem em falha parcial |
| Envio direto por presigned POST | Limites de 4 MiB/6 MB da API (R1) | Envio pela Lambda: estoura o limite |
