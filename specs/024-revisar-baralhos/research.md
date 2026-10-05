# Decisões — Revisar Baralhos

## 2026-10-05 — Pedido e esclarecimentos

O Usuário pediu subagentes baratos, renomear Estudar para Revisar com início direto, mover Situação da revisão de Cartões para Baralhos e inserir etiqueta à esquerda das ações. Confirmou que Pendente deriva da existência de Cartão novo/vencido e Revisado de todos em dia. Para pendentes, pediu uma pequena modal para escolher pendentes ou todos; para revisados, início direto com todos embaralhados. Confirmou escopo aplicação, specs e protótipos.

A primeira inspeção encontrou o repositório limpo e a spec 023 já implementada, diferente da última entrega desta conversa. O escopo foi esclarecido antes de editar a aplicação. Um subagente econômico realizou o mapeamento somente leitura; workers DeepSeek V4 Flash executarão código de aplicação, respeitando a constituição.

Baralho vazio é neutro Sem cartões. Hoje integra os pendentes conforme o calendário local vigente. O filtro não escolhe o conteúdo de uma revisão: a modal define pendentes/todos e a situação apenas filtra Baralhos. A seleção temporária já é uma escolha explícita de conteúdo, portanto Revisar inicia todos sem modal.

Aplicadas as skills domain-modeling para os termos e a relação entre Cartões/Baralhos/Agendamentos e codebase-design para manter classificação e seleção num Module puro, reutilizando Interfaces de cliente existentes. Não há necessidade de nova situação persistida, migração ou endpoint.

## Análise prévia

Conflitos conhecidos com 004/021/022/023 são explicitamente supersedidos na spec 024. Agenda preserva quantidades e sua seleção. O limite de 1.000 já existente no Registro precisa ser verificado antes de iniciar conjuntos completos, evitando uma Sessão irregistrável. Histórico e avaliações mantêm seus contratos. Não há bloqueio crítico documental após os esclarecimentos do Usuário.

## 2026-10-05 — Verificação e revisão da branch

Comandos e resultados (Node 22 no ambiente de revisão; o CI usa 24):

| Comando | Resultado |
|---|---|
| `frontend`: `npm run lint` | sem avisos |
| `frontend`: `npm test` | 64 arquivos, 907 testes passando |
| `frontend`: `npm run build` (`tsc --noEmit` + `vite build`) | ok |
| `backend`: `npm run typecheck`, `npm run lint` | ok (backend não foi alterado pela branch) |
| `backend`: `npm test` | 78 arquivos, 915 testes passando; o Vitest registra 1 erro não tratado de RPC do worker (`Timeout calling "onTaskUpdate"`) por carga do ambiente, sem teste falhando |
| `npx playwright test --config=e2e/playwright.config.ts` | 94/94 passando (Chromium) |
| `node design/busca-e-filtros/verificar.mjs` | passou, 12 capturas |
| `node design/baralho-temporario/verificar.mjs` | passou, 20 capturas |

A primeira execução do E2E reprovou 5 testes; as causas e correções:

- `agendamento-de-estudo.spec.ts` (2 testes): a prova havia sido trocada para «Revisar …», mas a Agenda mantém «Estudar …» (FR-378 não renomeia a Agenda; os testes de unidade da Agenda confirmam). Arquivo restaurado ao original.
- `lista-de-baralhos.spec.ts` (360 e 390 px): com a etiqueta, Revisar e Editar na mesma fileira, a coluna do nome ficava com poucos caracteres e a linha «Alemão» gerava rolagem horizontal (defeito real de layout). Em até 600 px as linhas de Baralho (`linha-da-lista--com-etiqueta`, em Baralhos e na montagem temporária) passam o texto para a primeira fileira e a etiqueta com as ações para a segunda, como o FR-381 admite. Em consequência a prova passa a aceitar até 112 px por linha no telefone (72 px acima de 600 px) e ao menos 2 linhas inteiras na primeira tela de 390 px (eram 6): a segunda fileira e o filtro de Situação acrescentado ao painel ocupam essa altura. Esta é a única relaxação do SC-079 da spec 012, decorrente do FR-381.
- `revisar-baralhos.spec.ts`: o teste navegava antes de o Registro da Sessão ser confirmado, o que dispara a confirmação de saída (FR-164) e falhava sob carga; agora aguarda «Sessão registrada no histórico.».

As capturas `modal-revisao-390.png` e `modal-revisao-1440.png`, citadas pelo README do protótipo, não estavam versionadas e foram acrescentadas. As demais capturas não foram regeneradas.

Não executados aqui: `gitleaks` (não instalado no ambiente) e revisão manual com leitor de tela/zoom nativo.

