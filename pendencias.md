# Pendências

Estado verificado em **2026-09-21**, commit `3abda83`.

Este arquivo lista o que falta. É um inventário de trabalho, não um registro de
decisões — o histórico decisório vive em `SESSION.md`, que a constituição 2.0.0
define como fonte única.

---

## 1. Features sem fluxo do Spec Kit

Cada feature precisa de **sete artefatos**, no padrão estabelecido pela
`001-criar-cartao`. Duas estão completas; quatro têm apenas a spec.

| Feature | spec | plan | research | data-model | contracts | quickstart | tasks | checklists |
|---|---|---|---|---|---|---|---|---|
| `001-criar-cartao` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `002-criar-baralho` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `003-vincular-cartao-baralho` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `004-sessao-de-estudo` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `005-editar-cartao-e-baralho` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `006-excluir-cartao-e-baralho` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Todas as features agora possuem os artefatos que tornam os comandos seguintes
do Spec Kit verificáveis.

---

## 2. Lacunas transversais nas specs 003 a 006

Registrado originalmente em `SESSION.md`, EVT-030. **Causa**: na decomposição,
os requisitos transversais foram alocados apenas à feature onde apareceram
primeiro, e as demais receberam só a linha *"as premissas de 001 valem
integralmente"*. **Premissa não é requisito**: não gera teste, não entra em
matriz de rastreabilidade e não bloqueia conclusão de tarefa.

Fechado nas seis features.

| Feature | Falta acrescentar |
|---|---|
| `003-vincular-cartao-baralho` | fechado: FR-062 a FR-066, cenários e tarefas |
| `004-sessao-de-estudo` | fechado: FR-042 e FR-046 reutilizados; falha de gravação e estado vazio não se aplicam por FR-038 |
| `005-editar-cartao-e-baralho` | fechado: FR-042, FR-044 a FR-046 reutilizados e FR-067 |
| `006-excluir-cartao-e-baralho` | fechado: FR-042, FR-044 a FR-046 reutilizados e FR-068 a FR-069 |

**Regra de numeração** estabelecida na feature `002`: requisito transversal de
enunciado genérico é **reutilizado** com o mesmo identificador (FR-042, FR-044,
FR-045, FR-046, FR-023, FR-024, FR-040); requisito cujo enunciado nomeia a
entidade recebe identificador próprio.

---

## 3. Implementação

Nenhuma feature está implementada além da fundação do backend.

| Feature | Tarefas | Concluídas |
|---|---|---|
| `001-criar-cartao` | 14 | **1** — T001, esqueleto do backend |
| `002-criar-baralho` | 12 | 0 |
| `003-vincular-cartao-baralho` | 14 | 0 |
| `004-sessao-de-estudo` | 8 | 0 |
| `005-editar-cartao-e-baralho` | 7 | 0 |
| `006-excluir-cartao-e-baralho` | 8 | 0 |

**Existe**: `backend/` com projeto, `GET /health`, guarda de loopback imposta em
runtime, 8 testes verdes.

**Não existe**: `frontend/`, `e2e/`, nenhuma tabela, nenhuma rota de domínio,
nenhuma tela.

Próximas tarefas elegíveis da `001`, em ordem: T002 (esqueleto do frontend),
T003 (harness e2e), T004 (tabela `cartao`).

---

## 4. Débitos técnicos conhecidos

| # | Débito | Onde | Gravidade |
|---|---|---|---|
| D-1 | Testes do backend não são verificados por tipo no `build` quando ficam fora do `include` — hoje estão dentro, mas a decisão é frágil e depende de manter `tests` no `tsconfig` | `backend/tsconfig.json` | baixa |
| D-2 | `portaConfigurada` não valida entrada: `PORTA=""` vira `0` e `PORTA="abc"` vira `NaN`, que o Fastify rejeita com erro obscuro | `backend/src/http/servidor.ts` | baixa |
| D-3 | `@types/node@^24` contra runtime Node 26: APIs introduzidas no 25 e 26 não aparecem no typecheck | `backend/package.json` | baixa |
| D-4 | A migração de esquema da feature `002` ainda não existe. Até ela existir, acrescentar tabela depende de `CREATE TABLE IF NOT EXISTS`, que falha na primeira alteração que não seja adicionar tabela | `002/research.md` | **média** |

Os débitos D-2 e D-3 foram reportados pelo próprio worker DeepSeek durante a
implementação de T001 e estão registrados em `SESSION.md`, EVT-032 e EVT-033.

---

## 5. Itens estruturais em aberto

- **`converge` nunca foi executado.** Depende de haver implementação a avaliar.
- **A feature `004-sessao-de-estudo` terá a Interface de maior Depth do
  sistema**, e ela será desenhada pelo Arquiteto **sem propostas alternativas
  comparadas**, porque o processo `Design It Twice` foi removido do projeto por
  decisão do Product Owner (EVT-021). O risco está registrado e aceito.
- **Nenhuma ADR existe e nenhuma será criada.** A constituição 2.0.0 as declara
  inaplicáveis; o histórico decisório vive em `SESSION.md`.

---

## 6. O que já está garantido

Para não confundir o que falta com o que existe:

- Constituição **2.1.0** ratificada, com onze princípios.
- `CONTEXT.md` com onze termos canônicos.
- `SESSION.md` com 35 eventos auditáveis, append-only.
- Seis features decompostas, com cobertura verificada por script: **53 de 53
  requisitos e 16 de 16 critérios** preservados na decomposição.
- Fluxo do Spec Kit conforme nas features `001` e `002`, com
  `check-prerequisites` populado e tarefas rastreáveis por caixa de seleção.
- Backend com a garantia de loopback **imposta em runtime** e comprovada por
  teste de mutação.
