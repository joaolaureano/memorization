# Research: Interface visual e navegável

Decisões da Phase 0. Nenhum `NEEDS CLARIFICATION` restou: as três premissas da spec
foram confirmadas no clarify de 2026-10-02.

## R1. Tokens e CSS

- **Decisão**: um único `frontend/src/estilos.css` com tokens em `:root`,
  copiados do protótipo (`design/prototipo-visual/styles.css`).

  | Token | Valor |
  | --- | --- |
  | `--bg` | `#12161f` |
  | `--surface` | `#1a2030` |
  | `--surface-2` | `#232b3d` |
  | `--border` | `#697895` |
  | `--text` | `#e6e9f0` |
  | `--muted` | `#b0b9cb` |
  | `--success` | `#57dfa2` |
  | `--danger` | `#ff9393` |
  | `--accent` | `#8aa4ff` |
  | `--on-accent` | `#0b1020` |
  | `--radius` | `16px` |
  | `--space` | `16px` |

  Também:
  - `color-scheme: dark`;
  - fonte de sistema;
  - foco com contorno de 3 px em `--accent`;
  - `@media (prefers-reduced-motion: reduce)` desliga transições.
- **Por quê**: o protótipo já mediu os contrastes.

  | Par | Contraste |
  | --- | --- |
  | texto principal sobre `--surface-2` | 11,64:1 |
  | texto secundário | 7,17:1 |
  | texto do botão azul | 7,97:1 |
  | erro sobre superfície | 7,61:1 |

  Um arquivo só, com classes semânticas, segue o padrão atual (CSS puro, sem
  build de estilos).
- **Alternativas rejeitadas**:
  - CSS Modules ou Tailwind: dependência e mudança de padrão sem ganho para 11 telas.
  - Variante verde: fora do escopo (FR-160).

## R2. Moldura responsiva

- **Decisão**: um Module `Moldura.tsx` com a marca "memorization", os destinos
  Cartões e Baralhos (`aria-current="page"`) e o botão Sair.
  - **Desktop**: tudo no cabeçalho.
  - **Até 600 px** (`@media (max-width: 600px)`): marca e Sair no cabeçalho, e um
    segundo `<nav aria-label="Principal">` fixo embaixo.
  - O `main` ganha `padding-bottom` para a barra inferior não cobrir conteúdo.
- **Por quê**: foi confirmado no clarify (FR-139). Com um único `nav` no DOM,
  reposicionado só por CSS, o leitor de tela encontra uma navegação só.
- **Detalhe**: o destino Baralhos fica ativo em todas as rotas `baralho*` e
  `estudo`. Cartões fica ativo em `cartoes*`.

## R3. Mapa de rotas

- **Decisão**: estender `interpretarRota` em `navegacao.ts`.
  - `ROTA_PADRAO` passa a `#/baralhos`.
  - Com Credencial, hash desconhecido e `#/entrar` resolvem em Baralhos (FR-138).
  - Contrato completo em [contracts/rotas-da-interface.md](contracts/rotas-da-interface.md).
- **Por quê**: o módulo já foi desenhado para isso. O comentário dele diz que
  novas rotas entram só em `interpretarRota`.
- **Sessão numa rota só**: configuração, Sessão e Resumo continuam na mesma rota
  `#/baralhos/:id/estudo`, como fases internas da página. A Sessão é transitória;
  rotas próprias por fase permitiriam recarregar ou voltar para o meio de uma
  Sessão que não existe mais.

## R4. Proteção de saída: descarte, pendência e Sessão

- **Decisão**: um novo Module `protecao-de-saida.ts`.
  - **Interface**:

    ```ts
    useProtecaoDeSaida(protecao: Protecao | null)
    type Protecao =
      | { tipo: "descarte"; titulo: string; descricao: string }  // FR-148, FR-151
      | { tipo: "pendencia"; motivo: string }                    // FR-154
    ```

  - **Montagem**: `ProvedorDeProtecaoDeSaida` fica em `Aplicacao`. Ele substitui
    `useRota` por uma versão que consulta a proteção vigente.
  - **Links e Voltar**: navegar por link ou pelo Voltar do navegador muda o hash
    primeiro. Com proteção ativa, a rota exibida **não** muda. O hash anterior é
    restaurado com `history.replaceState`, sem novo `hashchange`.
  - **Proteção de descarte**: abre o `DialogoDeConfirmacao`.
    - Cancelar mantém tudo.
    - Confirmar aplica a navegação pedida.
  - **Proteção de pendência**: não abre diálogo. Anuncia `motivo` numa região
    viva (`role="status"`) e mantém a tela.
  - **Sair**: passa pela mesma proteção. A Sessão em andamento registra descarte
    com o texto do FR-151.
  - **Recusa de Credencial** (FR-157): `recusarCredencial` **ignora** a proteção,
    limpa o registro e vai para Entrar.
- **Por quê**:
  - Uma única política para três requisitos (148, 151, 154).
  - As páginas declaram estado e não tratam navegação.
  - O teste de deleção mostra o valor do Module: sem ele, cada uma das cerca de
    8 páginas com formulário repetiria a lógica de `hashchange`.
- **Alternativas rejeitadas**:
  - `beforeunload`: só protege o fechamento da aba e não cobre navegação interna.
    Fica fora do escopo; recarregar descarta, como hoje.
  - Bloquear os links via `onClick`: não cobre o Voltar do navegador.

## R5. Campo de Senha

- **Decisão**: um `CampoDeSenha.tsx` com o rótulo, o `input` com
  `type="password"` ou `"text"` e um botão `type="button"` com texto
  "Mostrar Senha" ou "Ocultar Senha".
  - O botão tem `aria-pressed` e `aria-controls`.
  - O campo começa mascarado e volta a mascarado ao desmontar.
  - Sem `autocomplete` de leitura; mantém `autocomplete="current-password"` ou
    `"new-password"`, como hoje.
- **Por quê**: FR-142. Só exibe o que foi digitado no campo atual.

## R6. Estados de carga e operação

- **Decisão**: um componente `EstadoDaCarga` para os três estados de lista: um
  `role="status"` "Carregando…", falha com o botão "Tentar novamente" e vazio com
  o próximo passo.
  - **Operações**: o botão de envio fica `disabled` com texto de andamento
    ("Salvando…") e registra a proteção de pendência.
  - **Sucesso**: anúncio em `role="status"`.
  - **Falha**: `role="alert"`, preservando os campos.
- **Por quê**: FR-153..155. Junta padrões hoje repetidos nas páginas, sem mudar o
  cliente.

## R7. Percentual de acertos

- **Decisão**: uma função pura `percentualDeAcertos(resumo: ResumoDaSessao): number`
  em `sessao-de-estudo.ts`. Calcula `Math.round(acertos / estudados × 100)`.
  - O Resumo mostra estudados, acertos, erros e o percentual, sempre com texto
    junto (FR-152).
- **Por quê**: é derivação do Resumo, sem estado novo, e fica testável pela
  Interface do Module. Os casos do SC-067 são 1 Item (100%/0%) e 3 Itens (2/3 = 67%).

## R8. Cartões de tamanho grande e conteúdo extenso

- **Decisão**: o cartão de estudo é grande, com Frente e Verso rotulados
  ("Frente" / "Verso").
  - O texto usa `white-space: pre-wrap` e `overflow-wrap: anywhere`.
  - Acertei e Errei têm a cor semântica **com** texto e ícone, e altura mínima de 56 px.
- **Por quê**: FR-150 e FR-158. Nenhum estado depende só de cor.

## R9. Rastreabilidade FR → teste

| FR | Teste |
| --- | --- |
| 135, 136 | e2e `visual-e-contraste.spec.ts`: lê os tokens computados, calcula o contraste e mede os alvos de 44 px |
| 137, 139 | e2e de responsividade nas larguras 360/390/768/1440 e em zoom de 200% (viewport 640 com escala 2), conferindo `scrollWidth <= clientWidth` |
| 138, 157 | `navegacao.test.tsx` e `recusa-por-credencial.test.tsx` |
| 140, 144–147 | testes de tela das páginas de Baralho e Cartão e e2e de Vínculos, edição e exclusão |
| 141–143 | testes de Entrar e Cadastro com `CampoDeSenha` |
| 148, 151, 154 | `protecao-de-saida.test.tsx` cobre descarte cancelado/confirmado, pendência, Voltar do navegador e Sair |
| 149–152 | `sessao-de-estudo.test.ts` (percentual) e teste de tela de Estudo |
| 153, 155, 156 | testes de tela com o cliente de prova falhando ou pendente |
| 158, 159 | e2e SC-062 por teclado e testes do diálogo |
| 160 | e2e: nenhum texto de galeria ou seletor no app |
