# Implementation Plan: Usuário de Teste

**Branch**: `030-usuario-de-teste` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Especificação 030 com o clarify de 2026-10-15: só a conta é protegida (Baralhos e Cartões podem ser excluídos), e o Acervo de demonstração traz histórico e uma Rotina de exemplo.

## Summary

"Entrar como Teste" cria, numa única transação, um Usuário marcado como Conta de teste, já com o Acervo de demonstração: Inglês, Bandeiras e Cantos de pássaros, mais histórico de estudo e uma Rotina. O servidor emite o Acesso temporário (`018`).

- A mídia de demonstração fica uma vez só no armazém, sob `demonstracao/`, e é protegida da fila de remoção.
- Sair ou a expiração do Acesso excluem a conta pela exclusão da `017`. Uma regra agendada do EventBridge limpa as contas abandonadas a cada 15 minutos.
- A conta não pode mudar de Senha nem ser excluída pelo Perfil.
- A criação tem limite por origem e um limite global.

Decisões em [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript estrito. Node.js 24 (backend e Lambda `nodejs24.x` arm64). React 19 com Vite.

**Primary Dependencies**: as existentes. **Nenhuma nova**.

**Storage**:
- SQLite e PostgreSQL Neon, com a migração 22 (`usuario.conta_de_teste_em` e a tabela `criacao_de_conta_de_teste`).
- Arquivos: o bucket existente, prefixo `demonstracao/`, ou o disco local.

**Testing**: Vitest (backend e frontend), Testing Library, Playwright e2e e medição em produção.

**Target Platform**: navegador com API Node (local), ou Lambda atrás do CloudFront.

**Project Type**: aplicação web cliente-servidor.

**Performance Goals**: SC-192, até 5 s do clique ao Início, inclusive com a Lambda fria (R10, `premissa a validar`).

**Constraints**:
- Conta de teste sem Senha conhecida.
- Mídia de demonstração nunca removida.
- Isolamento total entre contas.
- Textos nos três catálogos.
- Mensagens técnicas em inglês ASCII.
- Nenhum segredo novo: o HMAC da origem usa `SEGREDO_DAS_SENHAS`.

**Scale/Scope**:
- 1 Module novo (`demonstracao`) com o conteúdo e 20 arquivos de mídia (10 bandeiras e 10 cantos).
- 1 migração.
- 5 operações novas na Porta.
- 2 rotas novas e 3 alteradas.
- 1 handler de evento agendado.
- Frontend: botão, aviso, créditos, Perfil e confirmação de Sair.
- Limite de 20 MB de mídia própria por Conta de teste (FR-495a, research R14).
- Infraestrutura: 1 regra agendada e 1 política IAM do deploy.

## Constitution Check

*GATE: antes da Phase 0 e reavaliado depois da Phase 1.*

| Princípio | Veredito |
|---|---|
| I — Spec-Driven | **PASS**. Tudo deriva da spec 030 e do clarify. Nenhum `NEEDS CLARIFICATION`. |
| II — Auditabilidade | **PASS**. As decisões e as alternativas rejeitadas estão em `research.md` (R0–R12). |
| III — Domínio | **PASS**. Conta de teste e Acervo de demonstração estão nas Key Entities. A Conta de teste é um Usuário, sem termo paralelo ("guest", "demo"). |
| IV — Módulos profundos | **PASS**. `demonstracao` esconde conteúdo, ids, datas relativas e a reprodução do histórico atrás de `montarContaDeTeste`. Nenhuma Seam nova: a Porta e o `ArmazemDeMidia` ganham operações nos dois Adapters reais (`gravarArquivoFixo`, R13). |
| V — Interface é a superfície de teste | **PASS**. Testes pela Interface de `demonstracao`, pela bateria da Porta, por Identidade/HTTP, pela Testing Library e pelo e2e. |
| VI — Verificação | **PASS condicionado** à revisão dos diffs e aos portões. |
| VII — Escopo mínimo | **PASS**. Reaproveita a exclusão da `017`, o Acesso da `018`, a fila de mídia e `aplicarAvaliacoes`. A regra agendada é o mínimo para FR-498 sem tráfego (R4). |
| VIII — Segredos | **PASS**. A Senha da Conta de teste nunca sai do servidor, o IP nunca é guardado em claro (HMAC) e não há segredo novo. |
| IX — Rastreabilidade | **PASS condicionado**: `tasks` deve mapear FR-487…FR-504 (com FR-495a) e SC-192…SC-198. |
| X — Portões | **PASS até aqui**. `requirements.md` 16/16 e `seguranca-ciclo-e-conteudo.md` 35/35 (research R14). `analyze` antes de `implement`. |

### Reavaliação depois da Phase 1

**PASS**. A migração 22 só acrescenta colunas e tabelas, e as contas reais não mudam. As Interfaces existentes ganham operações e um campo (`contaDeTeste` em `GET /conta`). A proteção de `demonstracao/` fica em dois pontos, na Porta e no processador da fila. Isso é defesa em profundidade com uma regra só (`ehMidiaDeDemonstracao`).

## Decisões de Codebase Design

### `demonstracao` (backend `src/demonstracao/`, novo)

- **Interface**:
  - `montarContaDeTeste({ agora, fuso, gerarId, credencialAleatoria }) → ContaDeTesteMontada`;
  - `ARQUIVOS_DE_DEMONSTRACAO` (chave → caminho no pacote);
  - `CREDITOS`;
  - `ehMidiaDeDemonstracao(chave)`.
- **Implementation**:
  - `acervo.ts`: textos do contrato;
  - `historico.ts`: as Sessões de exemplo e a reprodução por `aplicarAvaliacoes`;
  - `creditos.ts`, que lê `backend/demonstracao/creditos.json`.
- **Arquivos**: `backend/demonstracao/midia/{bandeiras,passaros}/…`, incluídos no pacote da Lambda por `scripts/construir.mjs`.

### Identidade e Acesso

- `criarContaDeTeste({ fuso, idioma, origem })` em `identidade/identidade.ts`. Aplica os limites (R5), chama `garantirMidiaDeDemonstracao` e `montarContaDeTeste` e grava pela Porta.
- `autenticar` recusa contas com `contaDeTesteEm`.
- `alterarSenha` e `excluirConta` recusam com `conta_de_teste`.
- `obterUsuario` devolve `contaDeTeste`.
- `encerrarContaDeTeste(usuarioId)` reaproveita a exclusão da `017`.
- `limparContasDeTesteEncerradas(agora)` cuida da limpeza.

### Mídia

- A Seam `ArmazemDeMidia` ganha `gravarArquivoFixo(chave, bytes, tipoDeConteudo)`, nos dois Adapters, aceita só para chaves de `ehMidiaDeDemonstracao` (research R13).
- `garantirMidiaDeDemonstracao(armazem)`: `medir` por chave e `gravarArquivoFixo` das ausentes. É memoizada por instância.
- `processarFilaDeMidia` ignora as chaves de `ehMidiaDeDemonstracao`.

### HTTP

- `POST /contas-de-teste` e `GET /demonstracao/creditos` (públicas, isentas da Credencial como `/usuarios`).
- `GET /conta` ganha o campo `contaDeTeste`; `PUT /conta/senha` e `DELETE /conta` respondem `403`; `POST /sair` exclui a Conta de teste.
- A origem vem de `CloudFront-Viewer-Address` ou de `X-Forwarded-For` e é guardada como HMAC.

### Função (nuvem)

`funcao/funcao.ts` reconhece `source: "aws.events"` e roda a limpeza, sem passar pelo Fastify.

### Frontend

- **`ClienteDoAcervo`/cliente de conta**: `entrarComoTeste({ fuso, idioma })`, `obterCreditos()` e o campo `contaDeTeste` na conta.
- **Telas**:
  - `PaginaDeEntrada`: botão e mensagens;
  - `Moldura`: etiqueta no cabeçalho;
  - `PaginaDeInicio` e `SecaoMinhaConta`: aviso e créditos;
  - `SecaoMinhaConta`: esconde as ações da conta;
  - Sair: confirmação;
  - fim da conta por expiração: aviso na tela de Entrar.
- **Textos**: seção `contaDeTeste` em `idioma/{tipos,pt,en,es}.ts` e as recusas novas em `idioma/recusas.ts`.

### Infraestrutura

- `backend/terraform/agendamento.tf` (novo): `aws_cloudwatch_event_rule` com `rate(15 minutes)`, o target da Lambda e `aws_lambda_permission`.
- `backend/terraform/iam/robot-agendamento.json` (novo): permissões do usuário de deploy (R4). O PO aplica com `aws iam put-user-policy` antes do `tofu apply`.
- O deploy da Lambda continua pelo workflow. A migração 22 roda no Neon pelo fluxo vigente.

## Estratégia de Testes

Detalhada em research R11.

## Project Structure

### Documentation (this feature)

```text
specs/030-usuario-de-teste/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/
    ├── http.md
    ├── ui.md
    └── acervo-de-demonstracao.md
```

### Source Code

```text
backend/demonstracao/                          # novo: conteúdo versionado
├── midia/bandeiras/*.png
├── midia/passaros/*.{mp3,ogg}
└── creditos.json
backend/src/demonstracao/{conta,acervo,historico,creditos,midia}.ts   # novo
backend/src/identidade/identidade.ts           # criarContaDeTeste, recusas, limpeza
backend/src/armazenamento/porta.ts             # 5 operações; excluirUsuario sem demonstracao/
backend/src/armazenamento/{sqlite,postgresql}/ # migração 22 + Adapters
backend/src/acervo/acervo.ts                   # processarFilaDeMidia ignora demonstracao/
backend/src/http/{rotas,servidor,credencial,recusas}.ts
backend/src/funcao/funcao.ts                   # evento agendado
backend/src/entradas/{local,nuvem}.ts          # intervalo local; composição
backend/scripts/construir.mjs                  # inclui backend/demonstracao no pacote
backend/terraform/agendamento.tf               # novo
backend/terraform/iam/robot-agendamento.json   # novo
backend/tests/{demonstracao,identidade,armazenamento,http,funcao}/
frontend/src/acervo-cliente/{cliente,cliente-http,cliente-em-memoria}.ts
frontend/src/ui/{PaginaDeEntrada,Moldura,PaginaDeInicio,SecaoMinhaConta,Aplicacao}.tsx + CreditosDaDemonstracao.tsx (novo)
frontend/src/idioma/{tipos,pt,en,es,recusas}.ts
frontend/tests/
e2e/conta-de-teste.spec.ts                     # novo
design/conta-de-teste/                         # protótipo
README.md, README.pt-BR.md
```

**Structure Decision**: um Module de backend novo para o conteúdo e a montagem. Os demais só ganham operações. Os arquivos de mídia são versionados no repositório, com os créditos.

## Complexity Tracking

| Acréscimo | Por quê | Alternativa mais simples rejeitada |
|---|---|---|
| Regra agendada (EventBridge) e política IAM | FR-498 exige limpeza mesmo sem tráfego | Limpeza só oportunista: contas abandonadas ficariam para sempre num app sem visitas |
| Operação atômica `criarContaDeTeste` | Nenhuma conta parcial; SC-192 com uma ida ao banco | Compor as operações existentes: ~10 transações e risco de conta parcial |
| Mídia compartilhada com prefixo protegido | Custo constante por conta (premissa da spec) | Copiar a mídia por conta: armazenamento e tempo multiplicados |
| Limite por origem com HMAC | FR-502 sem guardar IP em claro | Sem limite: criação em massa enche o banco |
