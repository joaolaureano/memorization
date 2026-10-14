# Implementation Plan: Exportar Baralhos

**Branch**: `029-exportar-baralhos` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Especificação 029 com o esclarecimento de 2026-10-14: só Baralhos (um, vários ou todos), mídia dentro do pacote e progresso de estudo levado ao Anki.

## Summary

Exportar Baralhos como pacote Anki (`.apkg`), com um registro de formatos que admite outros depois.

- **Geração no servidor** (R1): o backend lê o acervo numa transação, monta o `.apkg` legado (esquema 11) com `sql.js` e `fflate`, já presentes, e guarda o arquivo no armazém de mídia. O navegador baixa por um endereço de 15 minutos. O arquivo nunca passa pela API (limite de 6 MB da Lambda).
- **Module `exportacao`** (R2): Interface `exportar(conteudo, formato, contexto)`. O registro `FORMATOS_DE_EXPORTACAO` tem uma entrada, `apkg`.
- **Progresso de estudo** (R8): o algoritmo descreve o próprio estado (`descreverProgresso`). O Anki recebe Cartões novos ou em revisão, com a mesma data.
- **Mídia** (R4): a Imagem vira `<img>`, o Áudio vira `[sound:]`, e os arquivos são lidos do armazém. Uma mídia ilegível vira aviso, não falha.
- **Frontend**: página `#/baralhos/exportar`, com entradas no detalhe do Baralho, na lista e na exclusão de conta. Textos nos três idiomas.

Decisões em [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript estrito. Node.js 24 (backend e Lambda `nodejs24.x` arm64). React 19 com Vite.

**Primary Dependencies**: as existentes (Fastify 5, Zod, `node:sqlite`, `pg`, AWS SDK S3, `sql.js`, `fflate`, React, Vitest, Testing Library, Playwright). **Nenhuma nova**.

**Storage**:
- Bancos: SQLite e PostgreSQL Neon, **sem migração** (o esquema fica na v21).
- Arquivos: bucket existente `memorization-imagens-{account}`, chave `exportacoes/{usuarioId}` (uma por Usuário, research R14) com expiração de 1 dia, ou o disco local.

**Testing**: Vitest (backend e frontend), Testing Library, Playwright e2e e validação manual no Anki e no AnkiDroid.

**Target Platform**: navegador com API Node (local), ou Lambda Function URL atrás do CloudFront.

**Project Type**: aplicação web cliente-servidor.

**Performance Goals**:
- SC-186: 1.000 Cartões sem mídia em até 10 s.
- Limite de geração: 10.000 Cartões e 100 MiB de mídia em menos de 25 s (R5, `premissa a validar`).

**Constraints**:
- Timeout de 30 s da Lambda e do CloudFront.
- Resposta da Lambda de no máximo 6 MB.
- Estado do Agendamento opaco (FR-191).
- Mensagens técnicas em inglês ASCII.
- Textos novos nos três catálogos tipados (`027`).
- Nenhum segredo novo.

**Scale/Scope**:
- 1 Module novo (`exportacao`, com o formato `apkg`).
- 1 operação nova na Interface do algoritmo, 1 na Porta e 3 na Seam `ArmazemDeMidia`.
- 2 rotas novas e 3 códigos de recusa.
- 1 página nova e 3 entradas.
- Infraestrutura: 1 regra de ciclo de vida.

## Constitution Check

*GATE: antes da Phase 0 e reavaliado depois da Phase 1.*

| Princípio | Veredito |
|---|---|
| I — Spec-Driven | **PASS**. Tudo deriva da spec 029 e das três respostas do clarify. Nenhum `NEEDS CLARIFICATION`. As tensões de R12 foram decididas pelo PO no `analyze` e a spec foi atualizada (R14). |
| II — Auditabilidade | **PASS**. As decisões e as alternativas rejeitadas estão em `research.md` (R0–R13). |
| III — Domínio antes de tecnologia | **PASS**. Termos: Exportação, Formato de exportação, Pacote Anki e Progresso de estudo (R0). O armazém de *Mídia* guardando Exportações fica registrado como consequência aceita (R10). |
| IV — Módulos profundos | **PASS**. `exportar` é uma função profunda: uma entrada e um arquivo de saída, escondendo SQLite, zip, escape, mídia e agendamento. Nenhuma Seam nova: Porta e `ArmazemDeMidia` ganham operações nos dois Adapters reais. O registro de formatos não é Seam (R3). |
| V — Interface é a superfície de teste | **PASS**. O pacote é testado pela saída, relido com a `lerPacoteAnki` existente e com `sql.js`. Armazém pela bateria de contrato, Porta nos dois bancos, `Acervo` e `ClienteDoAcervo` pelas Interfaces, e a UI pela Testing Library e pelo e2e. |
| VI — Verificação | **PASS condicionado** à revisão dos diffs e à execução dos portões. |
| VII — Escopo mínimo | **PASS com justificativa**. O registro com uma só entrada existe por FR-461, FR-462 e SC-190, que o PO pediu ("abertura para novos formatos"). Sem fila, sem histórico de Exportações, sem formato moderno do Anki e sem dependência nova. |
| VIII — Segredos | **PASS**. Nenhuma chave nova. Endereços assinados não vão para logs (FR-482). gitleaks no `verificar:ci`. |
| IX — Rastreabilidade | **PASS condicionado**: `tasks` deve mapear FR-461…FR-486 e SC-183…SC-190. |
| X — Portões | **PASS**. `requirements.md` 16/16 e `anki-seguranca-e-limites.md` 37/37 (research R15). O segundo `analyze` não teve CRITICAL; um `analyze` final confirma depois das correções de R15. |

### Reavaliação depois da Phase 1

**PASS**. Nenhuma Interface existente muda de forma, só ganha operações. Os dois Adapters de cada Seam recebem as operações ao mesmo tempo. O contrato do `.apkg` é público e verificado pela saída. As tensões de R12 não bloqueiam o plano, mas precisam de decisão do PO no `analyze`.

## Decisões de Codebase Design

### `exportacao` (backend `src/exportacao/`, novo)

- **Interface**:
  - `exportar(conteudo: ConteudoExportado, formato: IdDoFormato, contexto: { agora, fuso, idioma, lerMidia }): Promise<{ bytes, nomeDoArquivo, tipoDeConteudo, cartoesSemMidia }>`;
  - `FORMATOS_DE_EXPORTACAO` e `ehFormatoDeExportacao`.
- **Implementation**:
  - `formatos.ts` (registro);
  - `nome-do-arquivo.ts` (R11);
  - `apkg/pacote.ts`, `apkg/colecao.ts` (esquema 11 em `sql.js`), `apkg/campos.ts` (escape, `<img>`, `[sound:]`) e `apkg/agendamento.ts` (R8).
  - `lerMidia` é injetado (`chave → bytes | null`). O formato da mídia é reconhecido com `detectarFormato` e `reconhecerAudio`.

### `AlgoritmoDeRepeticao`

- `descreverProgresso(estado)` no SM-2, com a mesma leitura tolerante de `lerDados`.

### `Porta`

- `lerAcervoParaExportacao(usuarioId, baralhoIds | "todos")` em transação de leitura, nos Adapters SQLite e PostgreSQL. Devolve Baralhos, Cartões com a chave de mídia e Agendamentos. Id de Baralho alheio resulta em `nao_encontrado`.

### `ArmazemDeMidia`

- `ler(chave)`: `GetObject` ou leitura do arquivo; `null` se ausente; lança erro se o armazém estiver indisponível (research R15).
- `medir(chaves)`: `HeadObject` com concorrência de 32, ou `stat`; ausente conta 0.
- `guardarExportacao(usuarioId, bytes, nomeDoArquivo, tipoDeConteudo)`: grava em `exportacoes/{usuarioId}`, sobrescrevendo, e devolve endereço de 15 minutos com `Content-Disposition: attachment`. A rota `/midia-local/` passa a servir `exportacoes/` como anexo.

### Exclusão de conta

- `excluirUsuario`, nos dois Adapters da Porta, enfileira também `exportacoes/{usuarioId}` em `midia_a_remover`, na mesma transação. A remoção usa o `remover` existente da Seam (FR-479, research R14).

### `Acervo`

- `previaDaExportacao(pedido)`: lê, conta, aplica os limites (`cartoes`) e mede a mídia (limite `midia`).
- `exportar(pedido)`: a mesma checagem; lê a mídia com concorrência de 16; chama `exportar`; guarda; devolve o resultado. Uma falha no armazém, inclusive na leitura da mídia, vira `exportacao_indisponivel`, sem arquivo (FR-477).

### HTTP

- `POST /exportacoes/previa` e `POST /exportacoes`, com Zod (`formato`, `baralhos`, `fuso` e `idioma`).
- Códigos novos em `http/recusas.ts`. Logs sem nomes, conteúdo nem `url`.

### Frontend

- **Seam**: `ClienteDoAcervo.previaDaExportacao` e `exportar` nos Adapters HTTP e em memória. O Adapter em memória gera um `Blob` vazio com o nome certo, porque o conteúdo do arquivo é responsabilidade do backend.
- **Página**: `ui/PaginaDeExportacao.tsx`, com a rota `exportar-baralhos` em `navegacao.ts` e os parâmetros `baralho` e `todos`.
- **Entradas**: `PaginaDoBaralho`, `PaginaDeBaralhos` e `DialogoDeExclusaoDeConta`.
- **Textos**: seção `exportacao` em `idioma/{pt,en,es,tipos}.ts`, as recusas em `idioma/recusas.ts`, e o tamanho com `Intl.NumberFormat` (unidade `byte`/`megabyte`).
- O download é feito por navegação para a `url` (anexo), sem `fetch`.

### Infraestrutura

- `backend/terraform/s3-imagens.tf`: regra de ciclo de vida que expira `exportacoes/` em 1 dia, e comentário atualizado.
- A role da Lambda já tem `GetObject` e `PutObject` em `/*`; nenhuma permissão nova.
- O deploy é `tofu apply` (com `-var lambda_package` e `-var lambda_handler`, como diz o README) antes ou junto do deploy da Lambda.

## Estratégia de Testes

Detalhada em research R13. Em resumo:
- pacote relido pela importação existente e por `sql.js` (textos, escape, Tags, Baralhos, `guid`, agendamento, `crt`, mídia e indicação no idioma);
- `descreverProgresso` contra a tabela de referência do SM-2;
- bateria do armazém com `ler`, `medir` e `guardarExportacao`;
- Porta nos dois bancos;
- limites e isolamento no `Acervo`;
- HTTP com códigos em inglês ASCII;
- UI nos três idiomas e estados;
- e2e com download, teclado, 4 larguras e zoom de 200%;
- validação manual no Anki e no AnkiDroid.

## Project Structure

### Documentation (this feature)

```text
specs/029-exportar-baralhos/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/
    ├── http.md
    ├── apkg.md
    └── ui.md
```

### Source Code

```text
backend/src/exportacao/                          # novo
├── exportar.ts                                  # Interface: exportar, tipos
├── formatos.ts                                  # FORMATOS_DE_EXPORTACAO
├── nome-do-arquivo.ts
├── textos.ts                                    # [Imagem]/[Áudio] em pt/en/es (R9)
└── apkg/{pacote,colecao,campos,agendamento}.ts
backend/src/repeticao/{algoritmo,sm2}.ts         # descreverProgresso
backend/src/armazenamento/porta.ts               # lerAcervoParaExportacao; excluirUsuario enfileira a Exportação
backend/src/armazenamento/{sqlite,postgresql}/   # Adapters
backend/src/midia/{armazem,armazem-s3,armazem-em-disco}.ts   # ler, medir, guardarExportacao
backend/src/http/{rotas,recusas,midia-local}.ts
backend/src/acervo/acervo.ts                     # previaDaExportacao, exportar
backend/tests/exportacao/                        # novo
backend/tests/{midia,armazenamento,acervo,http,repeticao}/
backend/terraform/s3-imagens.tf                  # ciclo de vida exportacoes/
frontend/src/acervo-cliente/{cliente,cliente-http,cliente-em-memoria}.ts
frontend/src/ui/{PaginaDeExportacao.tsx,navegacao.ts,Aplicacao.tsx,PaginaDoBaralho.tsx,PaginaDeBaralhos.tsx,DialogoDeExclusaoDeConta.tsx}
frontend/src/idioma/{pt,en,es,tipos,recusas}.ts
frontend/src/estilos.css
frontend/tests/
e2e/exportar-baralhos.spec.ts
README.md, README.pt-BR.md                       # linha "Exportar" na tabela de funcionalidades
```

**Structure Decision**: um Module novo no backend ao lado de `importacao/`. Os demais Modules só ganham operações. Nenhum pacote, serviço, fila ou recurso de nuvem novo.

## Complexity Tracking

| Acréscimo | Por quê | Alternativa mais simples rejeitada |
|---|---|---|
| Registro de formatos com uma entrada | FR-461, FR-462 e SC-190, pedidos pelo PO | Chamar o `.apkg` direto: viola FR-462 |
| Arquivo guardado no armazém em vez de devolvido na resposta | Limite de 6 MB da Lambda com mídia de até 10 MB por Áudio | Resposta direta: falha com qualquer Áudio grande |
| `descreverProgresso` na Interface do algoritmo | FR-469 sem quebrar a opacidade do estado (FR-191) | Ler `estado.dados` no exportador: acopla ao SM-2 |
| `lerAcervoParaExportacao` na Porta | Consistência do arquivo (FR-473) | Compor três leituras: Cartão órfão sob exclusão concorrente |
