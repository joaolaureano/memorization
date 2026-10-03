# Research: Repetição espaçada

Decisões do Arquiteto para a 015 (D1–D8), acrescidas de R9–R12. Não há `NEEDS CLARIFICATION`; todas as decisões foram fixadas pelo Arquiteto antes da redação dos contratos ([contracts/contratos.md](./contracts/contratos.md)).

### D1 — Porta de algoritmo em `backend/src/repeticao/`

**Decisão**: criar um Module puro novo em `backend/src/repeticao/` com a Interface `AlgoritmoDeRepeticao` (`id`, `versao`, `rotulo` e `avaliar(estado, avaliacao, agora) → { estado, proximaRevisaoEm }`), o registro `ALGORITMOS: ReadonlyMap<string, AlgoritmoDeRepeticao>`, a constante `ALGORITMO_PADRAO = "sm2"`, a função `algoritmoPorId(id)` (desconhecido cai no SM-2, FR-191) e o auxiliar `previa(alg, estado, agora)`, que chama `avaliar` quatro vezes, uma por nível de Avaliação, devolvendo as datas ISO (FR-221). O estado do Agendamento é opaco (`dados: unknown`, JSON) e traz `algoritmo` e `versao`. Nesta entrega o registro tem só o SM-2.

**Justificativa**: atende FR-187–FR-191 — o Agendamento é calculado por um algoritmo identificado e versionado, e o restante do produto só lê a próxima data de revisão e a que Cartão e Usuário o Agendamento pertence. Incluir um segundo algoritmo é um novo arquivo (`fsrs.ts`) mais uma entrada em `ALGORITMOS`, sem alterar telas, Histórico nem Agendamentos de outros algoritmos. A Interface é pequena e pura (sem relógio próprio, sem I/O), o que concentra o comportamento e mantém a superfície de teste mínima (Princípio IV).

**Alternativas consideradas**: (a) calcular o Agendamento inline no Module `Acervo` — rejeitada por acoplar o Agendamento a um algoritmo único e contrariar FR-191; (b) chamada direta ao SM-2 sem registro — rejeitada por exigir editar os callers para cada algoritmo novo.

### D2 — SM-2 em `backend/src/repeticao/sm2.ts`

**Decisão**: implementar o SM-2 clássico, versão 1, com `dados = { repeticoes: n, facilidade: EF, intervaloEmDias: I }`. Qualidade da Avaliação: `errei=2`, `dificil=3`, `bom=4`, `facil=5`. Estado inicial `n=0`, `EF=2.5`, `I=0`. `EF' = max(1.3, arred2(EF + (0.1 − (5−q)·(0.08 + (5−q)·0.02))))`, sempre atualizado, inclusive em erro; `arred2` = 2 casas. Se `q<3`: `n=0`, `I=1`. Senão: `I = 1` se `n=0`; `6` se `n=1`; `round(I·EF')` caso contrário; depois `n=n+1`. `proximaRevisaoEm = agora + I×24h`. A tabela de referência está em R12.

**Justificativa**: é o algoritmo exigido (FR-190) e a tabela de referência fixa o comportamento esperado (SC-082). Manter o EF atualizado em erro é fiel ao SM-2 e mantém monotonicidade, com piso em 1.3.

**Alternativas consideradas**: adaptar o SM-2 para diferenciar os quatro botões de um Cartão novo — rejeitada por descaracterizar o algoritmo (ver R9); a diferenciação fica para o FSRS futuro (FR-191).

### D3 — O dia é do navegador, o servidor só compara instantes

**Decisão**: o cliente envia `inicioDoDia` e `fimDoDia` (ISO, 00:00 e 24:00 locais). Cartão vencido é aquele com `proximaRevisaoEm < fimDoDia`. Cartões novos introduzidos hoje são os Agendamentos com `criadoEm` em `[inicioDoDia, fimDoDia)`. Cartão novo é Cartão do Usuário sem Agendamento. Novos disponíveis hoje = `max(0, limite − introduzidosHoje)`, limitado pela quantidade de Cartões novos. O servidor não guarda fuso e apenas compara instantes.

**Justificativa**: atende FR-204 — "hoje" e "vencido" seguem o fuso do navegador —, e evita ao backend depender de fuso ou horário de verão. Coerente com a `013`, que já trata o dia como do navegador.

**Alternativas consideradas**: guardar o fuso do Usuário e calcular o dia no servidor — rejeitada por introduzir estado e complexidade sem requisito.

### D4 — Onde o cálculo acontece

**Decisão**: a conclusão da Sessão continua em `POST /sessoes` (existente), que passa a receber por Item `cartaoId`, `avaliacao` e `origem` (`"baralho" | "revisao"`), deriva o Resultado (`errei` → errou; `dificil`, `bom`, `facil` → acertou) e, numa única transação, insere o Registro e, só se o Registro for NOVO (idempotência pelo id, `013`), aplica cada Avaliação ao Agendamento do Cartão, na ordem dos Itens, com o algoritmo das Preferências e `agora` = instante do servidor. Cartão inexistente é registrado mas não gera Agendamento. Reenvio devolve 200 sem reaplicar (FR-210). A troca de algoritmo (`PUT /preferencias`) apaga os Agendamentos do Usuário, numa transação, e reconstrói por replay. A prévia (FR-221) é calculada no servidor e entregue com os Cartões do lote e via `POST /previas`.

**Justificativa**: cumpre FR-210 (atômico e idempotente) e FR-213 (reconstrução determinística, SC-083). O frontend não duplica o algoritmo, mantendo o cálculo num só lugar — locality para o mantenedor e integridade fora do cliente (Critérios de Qualidade: segurança).

**Alternativas consideradas**: calcular o Agendamento no cliente e enviar pronto — rejeitada por duplicar o algoritmo, abrir a integridade ao cliente e contrariar FR-210.

### D5 — Persistência: migração 7 nos dois Adapters

**Decisão**: a migração 7, em SQLite (`backend/src/armazenamento/sqlite/migracoes.ts`) e PostgreSQL (`backend/src/armazenamento/postgresql/migracoes.ts`), cria `agendamento` (colunas `usuario_id`, `cartao_id`, `algoritmo`, `versao_do_algoritmo`, `estado`, `proxima_revisao_em`, `ultima_avaliacao`, `revisado_em`, `criado_em`, PK `(usuario_id, cartao_id)`, FK de Cartão e de Usuário `ON DELETE CASCADE`, índice `(usuario_id, proxima_revisao_em)`) e `preferencias` (PK `usuario_id`, `algoritmo` com padrão `'sm2'`, `limite_de_novos_por_dia` com padrão 20 e CHECK 0..999; ausência de linha = padrões), e adiciona `cartao_id` (sem FK) e `avaliacao` (CHECK nos quatro níveis) a `item_de_registro` e `origem` (CHECK `'baralho' | 'revisao'`) a `registro_de_sessao`. A Porta `ArmazenamentoDoAcervo` ganha `obterPreferencias`, `salvarPreferencias`, `listarAgendamentos`, `inserirRegistroEAgendamentos`, `substituirAgendamentos` e `listarItensAvaliados`. O Module puro `backend/src/repeticao/revisao.ts` reúne `resumoDaRevisao`, `loteDeRevisao`, `aplicarAvaliacoes` e `reconstruir`; o Module `Acervo` orquestra a leitura e a gravação pela Porta.

**Justificativa**: a profundidade fica no Module, não na Porta (Princípio IV). Só há ADD COLUMN e CREATE TABLE, o que preserva os dados existentes (FR-220, FR-167). Na Revisão, `baralho_id = ''` e `nome_do_baralho = 'Revisão do dia'` evitam reconstruir `registro_de_sessao` no SQLite por causa do NOT NULL. A reconstrução é determinística (SC-083).

**Alternativas consideradas**: (a) criar uma Porta nova só para Agendamentos e Preferências — rejeitada por não haver segunda variação real (Princípio IV) e por duplicar fiação sem ganho; (b) tornar `baralho_id` anulável para a Revisão do dia — exigiria recriar a tabela `registro_de_sessao` no SQLite (que não remove NOT NULL com ALTER), com custo e risco aos dados existentes; `origem` com DEFAULT entra por ADD COLUMN e torna o `baralho_id = ''` inequívoco.

### D6 — HTTP

**Decisão**: registrar `GET /revisao?inicioDoDia&fimDoDia`, `GET /revisao/lote?inicioDoDia&fimDoDia`, `POST /previas` (`{ cartaoIds }` com até 200), `GET /preferencias`, `PUT /preferencias` e estender `POST /sessoes`, todos em `registrarRotasDaAplicacao` (`backend/src/http/servidor.ts`) — a lista única usada por local e nuvem. `GET /preferencias` devolve `{ algoritmo, limiteDeNovosPorDia, algoritmos: [{ id, rotulo }] }`. Erros no formato existente; Credencial como hoje; dados de outro Usuário comportam-se como inexistentes (FR-219). O teste de paridade em `backend/tests/funcao/funcao.test.ts` chama cada rota nova pela função da nuvem.

**Justificativa**: manter a lista única impede que local e nuvem divirjam. O teste de paridade é a lição do bug `9251ae0` registrado na `013`.

**Alternativas consideradas**: registrar as rotas novas só em `local.ts` — rejeitada por deixar a lambda sem as rotas.

### D7 — Frontend

**Decisão**: `frontend/src/sessao-de-estudo/sessao-de-estudo.ts` mapeia Resultado → Avaliação (4 níveis) e guarda `cartaoId` no Item. `PaginaDeEstudo.tsx` mostra os quatro botões com prévia ("Bom · 3 dias") e atalhos 1–4 após a Revelação. `PaginaDaRevisao.tsx` (rota `#/revisao`) conduz a Revisão do dia, com "Continuar revisão" e "Voltar a Início". `PaginaDePreferencias.tsx` (rota `#/preferencias`) escolhe o algoritmo e o limite. `PaginaDeInicio.tsx` ganha o bloco "N Cartões para revisar hoje". `Moldura.tsx` ganha Preferências. `ResumoDaSessao.tsx` mostra a contagem por nível; registros antigos sem avaliação continuam como antes e a origem revisão mostra "Revisão do dia". O Module puro `frontend/src/revisao/dia.ts` traz `limitesDoDia(agora)` e `rotuloDaPrevia(agora, iso)`. O cliente ganha os métodos novos em `cliente.ts`, `cliente-http.ts` e `cliente-em-memoria.ts`.

**Justificativa**: atende FR-215–FR-218 e FR-221. O Module puro é testável sem rede nem fuso fixo. O cliente em memória usa uma prévia fixa simples e documentada; os testes de algoritmo ficam no backend, evitando duplicá-lo.

**Alternativas consideradas**: calcular a prévia no componente — rejeitada por dificultar o teste e duplicar o cálculo que o servidor já faz.

### D8 — Execução em ondas paralelas com arquivos disjuntos

**Decisão**: executar em ondas de arquivos disjuntos com contratos fixos entre as duas pontas (as Ondas 1–6 do `plan.md`); workers DeepSeek implementam por tarefa, o Arquiteto revisa.

**Justificativa**: é a preferência registrada do PO, como na `013`. Contratos fixos permitem paralelismo nas duas pontas sem conflito de merge.

**Alternativas consideradas**: execução sequencial — rejeitada por desperdiçar paralelismo com o backlog e por não trazer verificação melhor.

### R9 — SM-2 clássico e os quatro botões de um Cartão novo

**Decisão**: manter o SM-2 clássico. Num Cartão novo (`n=0`), os quatro botões produzem "amanhã" (intervalo 1), porque `q<3` também cai em `I=1`. A prévia mostrada nos quatro botões reflete isso.

**Justificativa**: fidelidade ao algoritmo. A tabela de referência (R12) documenta os resultados esperados, incluindo esse caso, o que torna SC-082 e SC-090 verificáveis.

**Alternativas consideradas**: diferenciar os quatro botões de um Cartão novo — adiada para o FSRS, que modela dificuldade e estabilidade (FR-191).

### R10 — Fuso do navegador e virada da meia-noite

**Decisão**: os limites do dia vêm do navegador (`inicioDoDia`/`fimDoDia`); "vencido" é próxima revisão hoje ou anterior; o limite de Cartões novos zera à meia-noite local. Uma Sessão que atravessa a meia-noite segue, e a próxima abertura de Início reflete o novo dia.

**Justificativa**: atende FR-204 e mantém o servidor independente de fuso, sem estado de fuso guardado.

**Alternativas consideradas**: fuso do servidor — rejeitada por contrariar FR-204 e a decisão da `013` de que o dia é do navegador.

### R11 — Acervo pré-015 vira Cartões novos; replay só das Avaliações

**Decisão**: na ativação da 015, todos os Cartões existentes são Cartões novos, inclusive os estudados antes (FR-214), entrando pelo limite diário. A troca de algoritmo reconstrói os Agendamentos por replay dos Itens que têm Avaliação e `cartaoId` de Cartões ainda existentes, em ordem `(concluidaEm, posicao)`; Itens sem Avaliação são ignorados (FR-213).

**Justificativa**: é a decisão do PO no clarify (sem cálculo retroativo e sem avalanche no primeiro dia). O replay é determinístico (SC-083) e não inventa Avaliação para Itens antigos. Registros anteriores permanecem intactos no Histórico e nas Estatísticas (FR-214).

**Alternativas consideradas**: importar o Histórico antigo como Avaliação — rejeitada por não haver Avaliação registrada e por contrariar a decisão do PO.

### R12 — Tabela de referência do SM-2 (SC-082)

Cada passo usa `agora` igual à revisão anterior, começando de um Cartão novo (`n=0`, `EF=2.5`, `I=0`).

| Sequência de Avaliações | Intervalos (I) | Facilidade (EF) |
| --- | --- | --- |
| bom, bom, bom, bom | 1, 6, 15, 38 | 2.5 |
| facil, facil, facil | 1, 6, 17 | 2.6, 2.7, 2.8 |
| bom, bom, errei, bom, bom | 1, 6, 1, 1, 6 | 2.5, 2.5, 2.18, 2.18, 2.18 |
| dificil, dificil, dificil, dificil | 1, 6, 12, 23 | 2.36, 2.22, 2.08, 1.94 |
| errei, errei, errei, errei, errei | 1 sempre | 2.18, 1.86, 1.54, 1.3, 1.3 (piso) |
