# Pendências

Estado verificado em **2026-09-21**, commit `5789c90`. **Produto concluído**: as 63
tarefas das seis features estão entregues e verificadas.

Este arquivo lista o que falta. É um inventário de trabalho, não um registro de
decisões — o histórico decisório vive em `SESSION.md`, que a constituição 2.0.0
define como fonte única.

---

## 1. Features sem fluxo do Spec Kit

Cada feature precisa de **sete artefatos**, no padrão estabelecido pela
`001-criar-cartao`. O fluxo do Spec Kit está completo nas seis features;
as pendências abaixo são de implementação.

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

Concluída.

| Feature | Tarefas | Concluídas |
|---|---|---|
| `001-criar-cartao` | 14 | **14** |
| `002-criar-baralho` | 12 | **12** |
| `003-vincular-cartao-baralho` | 14 | **14** |
| `004-sessao-de-estudo` | 8 | **8** |
| `005-editar-cartao-e-baralho` | 7 | **7** |
| `006-excluir-cartao-e-baralho` | 8 | **8** |

Verificação em `main`: backend 165 testes, frontend 240 testes, e2e 13
cenários em Chromium real contra API e SQLite reais; build e lint verdes nos
dois projetos. `converge` executado: 69 de 69 FRs e todos os SCs citados em
testes que os verificam (EVT-063).

**Como executar localmente**

```bash
cd backend && npm install && npm run dev     # API em 127.0.0.1:3001, SQLite em memorizacao.sqlite
cd frontend && npm install && npm run dev    # abrir o endereço que o Vite imprimir
```

---

## 4. Débitos técnicos conhecidos

| # | Débito | Onde | Gravidade |
|---|---|---|---|
| D-1 | Testes do backend não são verificados por tipo no `build` quando ficam fora do `include` — hoje estão dentro, mas a decisão é frágil e depende de manter `tests` no `tsconfig` | `backend/tsconfig.json` | baixa |
| D-2 | `portaConfigurada` não valida entrada: `PORTA=""` vira `0` e `PORTA="abc"` vira `NaN`, que o Fastify rejeita com erro obscuro | `backend/src/http/servidor.ts` | baixa |
| D-3 | `@types/node@^24` contra runtime Node 26: APIs introduzidas no 25 e 26 não aparecem no typecheck | `backend/package.json` | baixa |
| D-4 | As próximas migrações ainda precisarão manter a compatibilidade com o esquema versionado já entregue em `002` | `backend/src` | média |

Os débitos D-2 e D-3 foram reportados pelo próprio worker DeepSeek durante a
implementação de T001 e estão registrados em `SESSION.md`, EVT-032 e EVT-033.

---

## 5. Itens estruturais em aberto

- **Worktrees antigos** de T003–T104 (`/private/tmp/memorization-t0*`,
  `-t10*`) continuam registrados no git. São descartáveis; não foram removidos
  por terem sido criados antes desta sessão. `git worktree remove` em cada um
  os elimina.
- **`backend/src/hello-world.ts`** não rastreado, de origem externa ao fluxo;
  preservado e fora dos commits.
- **Nenhuma ADR existe e nenhuma será criada** (constituição 2.0.0).

---

## 6. O que já está garantido

Para não confundir o que falta com o que existe:

- Constituição **2.1.0** ratificada, com onze princípios.
- `CONTEXT.md` com onze termos canônicos.
- `SESSION.md` com 63 eventos auditáveis, append-only.
- Seis features decompostas, com cobertura verificada por script: **53 de 53
  requisitos e 16 de 16 critérios** preservados na decomposição.
- Fluxo do Spec Kit conforme nas features `001` e `002`, com
  `check-prerequisites` populado e tarefas rastreáveis por caixa de seleção.
- Backend com a garantia de loopback **imposta em runtime** e comprovada por
  teste de mutação.
- Feature `001-criar-cartao` entregue integralmente e feature
  `002-criar-baralho` implementada até T104, com validações automatizadas
  registradas em `SESSION.md` (EVT-042 a EVT-052).

## 7. Encerramento

Implementação feita integralmente por workers DeepSeek (`deepseek-v4-pro`) em
worktrees exclusivos, com revisão, reverificação e integração pelo Arquiteto
(EVT-054 a EVT-063). Defeitos pegos na revisão e corrigidos antes do commit:
versão de esquema fixada em E2E, E2E de edição/exclusão contra API falsa,
conflito de integração entre workers paralelos, colisão de portas de E2E e uma
lacuna real de produto (SC-015).
