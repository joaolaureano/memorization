# Memorization

Aplicação web de estudo por flashcards. A pessoa registra **Cartões** (Frente e
Verso), agrupa-os em **Baralhos** por assunto e os exercita em **Sessões de
estudo**, com recordação ativa e autoavaliação. Cada **Usuário** tem o seu
próprio acervo.

Publicada na AWS: <https://d2mp2j3zeufjr0.cloudfront.net>

## Como o projeto foi construído

Desenvolvimento dirigido por especificação (Spec-Driven Development), com o
[GitHub Spec Kit](https://github.com/github/spec-kit). Cada funcionalidade passou
por *specify → clarify → plan → tasks → analyze → implement → converge*:

| Feature | O que entrega |
|---|---|
| [`001-criar-cartao`](specs/001-criar-cartao/spec.md) | Criar e listar Cartões |
| [`002-criar-baralho`](specs/002-criar-baralho/spec.md) | Criar e listar Baralhos |
| [`003-vincular-cartao-baralho`](specs/003-vincular-cartao-baralho/spec.md) | Vincular Cartões a Baralhos; elegibilidade derivada |
| [`004-sessao-de-estudo`](specs/004-sessao-de-estudo/spec.md) | Sessão de estudo: Revelação, Resultado e Resumo |
| [`005-editar-cartao-e-baralho`](specs/005-editar-cartao-e-baralho/spec.md) | Editar Cartão e renomear Baralho |
| [`006-excluir-cartao-e-baralho`](specs/006-excluir-cartao-e-baralho/spec.md) | Excluir, com confirmação e Vínculos em cascata |
| [`007-criar-usuario`](specs/007-criar-usuario/spec.md) | Cadastro; Senha com sal, HMAC e scrypt |
| [`008-entrar`](specs/008-entrar/spec.md) | Entrar e Sair; Credencial em toda requisição; acervo por Usuário |
| [`009-porta-de-persistencia`](specs/009-porta-de-persistencia/spec.md) | Port de armazenamento; Adapter SQLite; build por banco |
| [`010-postgresql-na-nuvem`](specs/010-postgresql-na-nuvem/spec.md) | Adapter PostgreSQL com TLS verificado; migração da nuvem |
| [`011-hospedagem-aws`](specs/011-hospedagem-aws/spec.md) | Lambda, CloudFront, S3, SSM e Neon |

Referências normativas:
- [`.specify/memory/constitution.md`](.specify/memory/constitution.md): a
  constituição do projeto;
- [`CONTEXT.md`](CONTEXT.md): o glossário do domínio;
- [`SESSION.md`](SESSION.md): o registro auditável, append-only, de todas as
  decisões.

Todo o código foi escrito por workers DeepSeek, cada um em worktree exclusivo.
O papel de arquiteto e revisor coube ao Claude, que revisou cada diff e repetiu
as verificações antes de integrar.

## Stack

TypeScript de ponta a ponta sobre Node 24+.
- **Backend**: Fastify, com Zod nas bordas. O armazenamento fica atrás de uma
  Port: `node:sqlite` na execução local e `pg` na nuvem.
- **Frontend**: React com Vite.
- **Testes**: Vitest e Testing Library; E2E com Playwright contra servidores
  reais.
- **Infraestrutura**: OpenTofu.

```text
backend/    API, Modules de domínio (Acervo, Identidade), Adapters de armazenamento, entradas
frontend/   SPA (navegação por hash) e a Seam ClienteDoAcervo
e2e/        provas em navegador real
specs/      artefatos do Spec Kit, um diretório por feature
backend/terraform/   infraestrutura AWS
```

## Executar localmente (SQLite)

```bash
export SEGREDO_DAS_SENHAS="$(openssl rand -hex 32)"   # mantenha o mesmo para a mesma base
cd backend && npm install && npm run dev               # API em 127.0.0.1:3001
cd frontend && npm install && npm run dev              # abrir o endereço impresso pelo Vite
```

Em modo empacotado: `npm run build:local && npm run start:local`, dentro de
`backend/`. A API escuta apenas no loopback.

## Executar com PostgreSQL (configuração de nuvem)

```bash
cd backend
npm run build:cloud
DB_URL='<url-postgresql>' npm run migrate:cloud   # aplica as migrações (endpoint direto no Neon)
DB_URL='<url-postgresql>' npm run start:cloud     # confere a versão do esquema e nunca migra
```

A `DB_URL` é um segredo: nunca é versionada nem aparece em logs. A conexão
exige TLS com certificado verificado.

## Publicar na AWS

O manual de operação completo está em
[`specs/011-hospedagem-aws/quickstart.md`](specs/011-hospedagem-aws/quickstart.md),
e o resumo em [`backend/terraform/README.md`](backend/terraform/README.md). A
ordem é:
1. migrar o Neon;
2. `npm run build:lambda`;
3. `tofu apply` com o pacote;
4. `deploy-frontend.sh`;
5. validar pelo endereço do CloudFront.

## Verificação

```bash
cd backend  && npm test && npm run typecheck && npm run build:local && npm run lint
cd frontend && npm test && npm run build && npm run lint
npm run test:e2e                                   # na raiz
tofu -chdir=backend/terraform validate
```

Todo requisito vigente das specs é citado por pelo menos um teste que o
verifica (Princípio IX da constituição).
