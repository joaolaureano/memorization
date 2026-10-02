# Implementation Plan: Interface visual e navegável

**Branch**: `012-interface-visual-navegavel` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-interface-visual-navegavel/spec.md`

**Depende de**: `001` a `008`, cujas regras de validação, Vínculos, edição,
exclusão, Sessão de estudo, Cadastro e Entrar continuam valendo sem reabertura.
Reusa a fundação do frontend (React 19, Vite, TypeScript estrito, Vitest,
Testing Library, Playwright), a Seam `ClienteDoAcervo`, a guarda de Credencial
(`guarda-de-credencial.ts`), a navegação por hash (`navegacao.ts`), o
`DialogoDeConfirmacao` e o Module `sessao-de-estudo.ts`. **Nenhuma mudança em
`backend/`**, nos contratos HTTP ou no armazenamento.

## Summary

Adotar no aplicativo real o tema escuro com destaque azul e os percursos do
[protótipo](../../design/prototipo-visual/README.md). A entrega cobre:
- tokens visuais e componentes base num único `estilos.css`;
- moldura responsiva: cabeçalho no desktop; até 600 px, marca e Sair no cabeçalho
  e Cartões/Baralhos numa barra inferior;
- formulários de criar e editar em páginas próprias, com rotas próprias;
- Baralhos como destino após Entrar;
- mostrar/ocultar Senha;
- proteção contra descarte e contra abandono de operação pendente;
- confirmação de interrupção da Sessão;
- percentual de acertos no Resumo.

A abordagem é concentrar três comportamentos transversais em Modules profundos,
para que as páginas fiquem rasas:
1. o **mapa de rotas**, em `navegacao.ts`;
2. a **proteção de saída**, num novo `protecao-de-saida.ts`: descarte, pendência
   e Sessão;
3. os **estados de operação**: carregando, vazio, erro, pendente e sucesso.

Cada página só declara o próprio estado.

## Technical Context

**Language/Version**: TypeScript 5 estrito, React 19 (frontend apenas)
**Primary Dependencies**: as existentes. **Nenhuma dependência nova**, nem fonte
baixada: o protótipo usa fonte de sistema.
**Storage**: N/A (sem mudança; acervo persistente via API existente)
**Testing**: Vitest + Testing Library (unidade/integração de telas, `frontend/tests/`); Playwright (`e2e/`, nas larguras 360/390/768/1440)
**Target Platform**: navegadores atuais, desktop e celular
**Project Type**: aplicação web (frontend React + API Fastify já existente)
**Performance Goals**: sem metas novas; nenhuma tela deve ficar mais lenta que a atual
**Constraints**:
- contraste AA: 4,5:1 para texto comum, 3:1 para texto grande e componentes;
- alvos de pelo menos 44 × 44 px;
- texto base de 16 px;
- sem rolagem horizontal em 360 px e com zoom de 200%;
- tudo operável por teclado;
- nenhum estado transmitido só por cor.
**Scale/Scope**: 7 telas existentes reorganizadas em cerca de 11 rotas; cerca de
3,5 mil linhas de UI e 5,6 mil de testes de tela afetadas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Situação |
| --- | --- |
| I. SDD | ✅ Spec `012` clarificada (Session 2026-10-02). Plano antes de código. |
| II. Auditabilidade | ✅ Cada etapa vira EVT append-only em `SESSION.md`. |
| III. Domínio antes de tecnologia | ✅ Termos de `CONTEXT.md` (Cartão, Baralho, Vínculo, Frente, Verso, Sessão, Resultado, Resumo). Nenhum termo novo. O percentual é derivado do Resumo, não é conceito novo. |
| IV. Módulos profundos | ✅ A proteção de saída e o mapa de rotas ficam atrás de Interfaces pequenas. As páginas não reimplementam guarda nem roteamento. |
| V. Interface é superfície de teste | ✅ As telas são testadas pelo que a pessoa vê e aciona (papéis e nomes acessíveis). Os Modules novos, pela própria Interface. |
| VI. Verificação sobre afirmação | ✅ Os portões rodam a cada bloco. O converge inclui capturas e medição de contraste. |
| VII. Escopo mínimo honesto | ✅ Estatísticas, listas do Resumo, seletor verde e galeria ficam fora (FR-160). Sem dependências novas. |
| VIII. Segredos | ✅ Sem segredo novo. O mostrar/ocultar Senha só exibe o que foi digitado no campo atual (FR-142). |
| IX. Rastreabilidade | ✅ `tasks.md` liga cada FR-135..160 a teste. A tabela FR → teste fica em research.md §R9. |
| X. Portões | ✅ `npm test`, `npm run lint` e `npm run build` (inclui `tsc`) em `frontend/`; `npm run test:e2e` na raiz; backend inalterado e verde. |
| XI. Delegação | ✅ Todo arquivo em `frontend/` e `e2e/` é escrito por worker DeepSeek. O Arquiteto revisa o diff integral e roda os portões. |

Skill `codebase-design` aplicada:
- seams escolhidas onde algo de fato varia: a página corrente e a política de saída;
- nenhuma seam hipotética, com um Adapter só;
- teste de deleção nos Modules novos: removê-los espalharia guarda e roteamento
  por 11 páginas.

Nenhuma violação a justificar: **Complexity Tracking vazio**.

## Project Structure

### Documentation (this feature)

```text
specs/012-interface-visual-navegavel/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # decisões R1–R9
├── data-model.md        # estado de UI (sem mudança de domínio)
├── quickstart.md        # como rodar e verificar
├── contracts/
│   └── rotas-da-interface.md   # contrato de rotas por hash e moldura
├── checklists/
│   ├── requirements.md
│   └── ux.md            # /speckit-checklist
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
frontend/src/
├── estilos.css                    # REESCRITO: tokens (:root), base, componentes, moldura, ≤600px
├── main.tsx                       # inalterado
├── sessao-de-estudo/
│   └── sessao-de-estudo.ts        # + percentualDeAcertos(resumo) — derivação pura
└── ui/
    ├── navegacao.ts               # + rotas novas; ROTA_PADRAO = #/baralhos
    ├── protecao-de-saida.ts       # NOVO: useProtecaoDeSaida / ProvedorDeProtecaoDeSaida
    ├── Aplicacao.tsx              # moldura (cabeçalho + barra inferior), despacho por rota, Sair protegido
    ├── Moldura.tsx                # NOVO: marca, destinos com aria-current, Sair
    ├── CampoDeSenha.tsx           # NOVO: campo mascarado com Mostrar/Ocultar Senha
    ├── EstadoDaCarga.tsx          # NOVO: carregando / falha com nova tentativa / vazio com próximo passo
    ├── DialogoDeConfirmacao.tsx   # reaproveitado (foco em Cancelar, Escape, retorno de foco)
    ├── PaginaDeEntrada.tsx        # visual + CampoDeSenha; sucesso leva a Baralhos
    ├── PaginaDeCadastro.tsx       # visual + CampoDeSenha (×2) + proteção de descarte
    ├── PaginaDeBaralhos.tsx       # só lista: nome, quantidade de Cartões, Estudar, Criar baralho
    ├── PaginaDoFormularioDeBaralho.tsx  # NOVO: criar e renomear
    ├── PaginaDoBaralho.tsx        # detalhe: Estudar no topo, Cartões, remover Vínculo, renomear, excluir
    ├── PaginaDeAdicionarCartoes.tsx     # NOVO: vincular Cartões existentes não vinculados
    ├── PaginaDeCartoes.tsx        # só lista: Frente, Verso, Baralhos; Criar cartão
    ├── PaginaDoFormularioDeCartao.tsx   # NOVO: criar e editar (aviso de Baralhos afetados)
    └── PaginaDeEstudo.tsx         # configuração → Sessão → Resumo (+ percentual), interrupção confirmada

frontend/tests/                    # testes de tela atualizados + novos por Module/página
e2e/                               # specs atualizadas + percurso SC-062 por teclado + varredura 360/390/768/1440
```

**Structure Decision**: aplicação web existente; só `frontend/` e `e2e/` mudam.
As páginas novas seguem o padrão `PaginaDe…`/`PaginaDo…`. O que hoje está
embutido nas listas (formulários de criação e edição) sai para páginas próprias,
como exige o FR-140, e as listas encolhem.

## Fases de implementação (para `tasks.md`)

| Bloco | Conteúdo | FRs principais |
| --- | --- | --- |
| B1 Fundação | tokens e componentes em `estilos.css`, `Moldura`, mapa de rotas novo, `protecao-de-saida.ts`, `EstadoDaCarga` | 135–139, 158 |
| B2 Acesso | Entrar e Cadastro com `CampoDeSenha`, destino Baralhos, sucesso e falha do Cadastro, descarte do Cadastro | 138, 141–143, 148, 157 |
| B3 Baralhos | lista, formulário (criar/renomear), detalhe, adicionar existentes, remover Vínculo, excluir | 140, 144–145, 147 |
| B4 Cartões | lista, formulário (criar/editar) com Baralhos afetados, excluir | 140, 144, 146–147 |
| B5 Estudo | configuração com validação e excedente, Sessão, interrupção confirmada, Resumo com percentual | 149–152 |
| B6 Transversais | pendência bloqueando reenvio e navegação, falhas preservando preenchimento, recurso não encontrado, Credencial recusada prevalecendo | 153–157, 160 |
| B7 E2E e converge | e2e atualizados, percurso SC-062 por teclado, varredura de larguras e zoom, capturas, medição de contraste | SC-062..070 |

Os blocos são sequenciais: B1 destrava os demais e B7 fecha. Cada bloco termina
com os portões verdes antes do seguinte.

## Complexity Tracking

Vazio: nenhuma violação constitucional.
