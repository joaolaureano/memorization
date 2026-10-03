# Quickstart: Validação da Repetição espaçada (015)

**Spec**: [spec.md](./spec.md) | **Plano**: [plan.md](./plan.md) | **Contratos**: [contracts/contratos.md](./contracts/contratos.md) | **Modelo de dados**: [data-model.md](./data-model.md)

Este é um roteiro de **validação**, não de implementação. Ele descreve como provar, com testes automatizados e cenários manuais, que a 015 atende aos requisitos FR-187–FR-221 e aos critérios SC-080–SC-090. Os contratos observáveis (rotas HTTP e Interface da Porta) estão em [contracts/contratos.md](./contracts/contratos.md); as entidades, colunas e a migração 7 estão em [data-model.md](./data-model.md). Nenhuma dependência nova é necessária.

## Pré-requisitos

Ambiente igual ao do restante do projeto. Backend local com SQLite:

```bash
export SEGREDO_DAS_SENHAS="$(openssl rand -hex 32)"   # o mesmo para o mesmo banco
cd backend && npm install && npm run dev               # API em 127.0.0.1:3001 com SQLite
```

Frontend (noutro terminal):

```bash
cd frontend && npm install && npm run dev              # abrir o endereço impresso pelo Vite
```

Ou, num único comando, a partir da raiz:

```bash
npm run demo                                           # http://127.0.0.1:5173
```

Para exercitar o Adapter PostgreSQL (bateria da Porta e migração 7), use um banco de teste e os scripts de nuvem do README:

```bash
export DB_URL="postgres://<usuario>:<senha>@<host>/<banco-de-teste>"   # nunca um banco de produção
cd backend && npm run migrate:cloud && npm run start:cloud
```

## Comandos de teste

```bash
# Backend: testes, tipos, bundle, lint — inclui o Module puro de repetição, o Acervo e os contratos HTTP
cd backend  && npm test && npm run typecheck && npm run build:local && npm run lint

# Frontend: testes, build, lint — inclui o Module puro do dia e as telas novas
cd frontend && npm test && npm run build && npm run lint

# E2E em navegador real, contra a API real e o banco real
npm run test:e2e
```

A bateria compartilhada da Porta roda **nos dois Adapters** (SQLite e PostgreSQL): os mesmos testes de `ArmazenamentoDoAcervo` cobrem `obterPreferencias`/`salvarPreferencias`, `listarAgendamentos`, `inserirRegistroEAgendamentos`, `substituirAgendamentos` e `listarItensAvaliados`. O teste de paridade em `backend/tests/funcao/funcao.test.ts` chama **cada rota nova** (`GET /revisao`, `GET /revisao/lote`, `POST /previas`, `GET`/`PUT /preferencias` e `POST /sessoes` estendido) também pela função da nuvem, garantindo que local e Lambda usam a mesma lista de rotas.

Os testes do SM-2 (tabela de referência em [research.md](./research.md), R12; SC-082) são unitários, no Module puro `backend/src/repeticao/`. As prévias (FR-221) são calculadas no servidor e conferidas por teste de contrato e por E2E.

## Cenários de validação

Cada cenário indica os passos, o resultado esperado e os FR/SC que prova. Comece com um Usuário sem Agendamentos, salvo quando o cenário disser o contrário.

### 1. Início mostra quantos Cartões revisar hoje e quantos novos entram

**Passos**: com um acervo conhecido (alguns Cartões vencidos ontem, um vencido há vários dias, outros novos) e o limite padrão, abrir Início. Ajustar o conjunto para conferir o singular ("1 Cartão para revisar hoje").

**Resultado esperado**: Início mostra "N Cartões para revisar hoje", com N igual ao número de Cartões vencidos do Usuário em todos os Baralhos, incluindo os sem Vínculo; mostra quantos Cartões novos entram hoje, respeitado o limite; oferece o botão "Revisar". Sem vencidos e sem novos disponíveis, mostra "Nada para revisar hoje" e o botão fica indisponível com a explicação. O bloco tem carregamento, falha com nova tentativa e sucesso próprios, e uma falha nele não impede o resto de Início.

**Prova**: FR-198, FR-199, FR-202, FR-204, FR-217, SC-080.

### 2. Revisar conduz a Sessão em lotes de no máximo 20, com "Continuar revisão"

**Passos**: com mais de 20 Cartões elegíveis (vencidos e/ou novos), acionar "Revisar". Concluir o lote. No Resumo, acionar "Continuar revisão" enquanto ainda houver Cartões para hoje.

**Resultado esperado**: a Revisão do dia reúne, primeiro, os vencidos, do vencido há mais tempo para o mais recente, depois os novos até o limite restante, dos mais antigos para os mais novos; cada Cartão aparece uma única vez no lote; o lote tem no máximo 20 Itens. Ao concluir, o Registro e os Agendamentos são gravados e Início volta a mostrar o N restante. O Resumo usa "Revisão do dia" e oferece "Continuar revisão" (próximo lote quando ainda houver Cartões para hoje) e "Voltar a Início". Cartões de vários Baralhos e Cartões sem Vínculo entram normalmente.

**Prova**: FR-201, FR-203, FR-215, SC-089.

### 3. Quatro botões de Avaliação com prévia e atalhos 1–4 após a Revelação

**Passos**: numa Sessão, antes de Revelar o Verso, conferir os botões. Revelar o Verso e conferir os quatro botões. Acionar pelo teclado com os atalhos 1–4 e, separadamente, com Tab + Enter.

**Resultado esperado**: nenhum botão de Avaliação aparece antes da Revelação; depois dela, aparecem Errei, Difícil, Bom e Fácil; cada botão mostra, junto do nível, a próxima revisão que resultaria dele (por exemplo, "Bom · 3 dias", "Errei · amanhã"), com essa prévia no nome acessível e sem depender de cor; os botões são acessíveis por teclado, com alvos de 44 px; os atalhos 1–4 só funcionam após a Revelação. A prévia mostrada coincide com a próxima revisão gravada ao concluir com aquela Avaliação, sem mudança concorrente.

**Prova**: FR-192, FR-193, FR-194, FR-218, FR-221, SC-090.

### 4. Estudo livre por Baralho também alimenta o Agendamento

**Passos**: estudar livremente um Baralho, incluindo um Cartão novo e um Cartão não vencido. Concluir a Sessão.

**Resultado esperado**: cada Avaliação atualiza o Agendamento do Cartão, mesmo que ele não estivesse vencido; o Cartão novo deixa de ser novo e conta no limite de novos do dia; um Cartão vinculado a vários Baralhos, estudado por um deles, tem um único Agendamento, atualizado uma só vez.

**Prova**: FR-205, FR-206, FR-207.

### 5. Limite diário de novos: 0, 1 e 20

**Passos**: em Preferências, salvar o limite em 20, estudar até introduzir os novos do dia e conferir Início. Repetir com limite 1 e com limite 0. Reduzir o limite para abaixo do já estudado hoje.

**Resultado esperado**: nunca entram mais Cartões novos do que o limite; com 0, nenhum Cartão novo é introduzido e Início informa isso; reduzir o limite abaixo do já estudado hoje não introduz nenhum novo até o próximo dia; o limite é inteiro de 0 a 999, padrão 20.

**Prova**: FR-199, FR-200, SC-081.

### 6. Preferências: salvar, descartar e falha ao salvar

**Passos**: abrir Preferências, trocar o limite de novos e salvar. Fazer uma alteração e sair sem salvar. Simular falha de gravação.

**Resultado esperado**: o salvamento é explícito e, ao sair com alteração não salva, a confirmação de descarte é pedida; em caso de falha, ela é explicada e há nova tentativa, sem perder o que estava escolhido. A lista de algoritmos mostra os disponíveis (hoje, apenas o SM-2, já selecionado por padrão).

**Prova**: FR-212, FR-148, FR-155, FR-190.

### 7. Troca de algoritmo preserva o Histórico e reconstrói os Agendamentos

**Aviso**: nesta entrega só existe o SM-2 (FR-190). Sem um segundo algoritmo registrado, **a troca não é executável de ponta a ponta**; a prova completa de SC-083 vem por teste de Module — `reconstruir(itensAvaliados, cartoesExistentes, alg)` — e pelo teste do Acervo que dispara `substituirAgendamentos`, conferindo determinismo e preservação do Histórico. Quando o segundo algoritmo for registrado (FR-191), o cenário abaixo passa a valer também de ponta a ponta.

**Passos (quando houver dois algoritmos)**: com Histórico contendo Avaliações, escolher um algoritmo e salvar; voltar ao anterior e salvar. No teste de Module: reconstruir duas vezes com a mesma entrada e comparar.

**Resultado esperado**: nenhum registro do Histórico é perdido; o novo algoritmo reconstrói o Agendamento de cada Cartão a partir das Avaliações, em ordem cronológica, com o instante de cada registro; Itens de Registros sem Avaliação (anteriores à 015) são ignorados; trocar e voltar resulta em Agendamentos idênticos aos anteriores; IDs de algoritmo desconhecidos caem para o SM-2.

**Prova**: FR-213, FR-191, FR-214, SC-083.

### 8. Cartão excluído entre a abertura de Início e o fim do lote

**Passos**: abrir a Revisão do dia com um Cartão no lote; noutra aba, excluir esse Cartão; concluir o lote.

**Resultado esperado**: o Item segue na Sessão com o conteúdo capturado no início e entra no Registro de sessão, mas nenhum Agendamento é criado nem recriado para o Cartão excluído; ao excluir o Cartão, o Agendamento dele é removido sem alterar Registros de sessão. Editar a Frente ou o Verso durante a Sessão não altera o Agendamento.

**Prova**: FR-209, FR-208, FR-150.

### 9. Reenvio idempotente da conclusão

**Passos**: concluir uma Sessão, forçar a reentrega do mesmo `POST /sessoes` com o mesmo id e conferir o Histórico e os Agendamentos.

**Resultado esperado**: o reenvio responde 200 sem reaplicar; não duplica Registros nem aplica a Avaliação duas vezes; o Registro e os Agendamentos ficam iguais aos da primeira conclusão. Sessão interrompida não deixa rastro e não altera Agendamentos.

**Prova**: FR-210, FR-211, SC-085.

### 10. Dois Usuários em navegadores distintos

**Passos**: entrar com dois Usuários (por exemplo, numa janela anônima separada), cada um com acervo, Avaliações, Agendamentos e Preferências próprios. Em cada sessão, tentar acessar dados do outro.

**Resultado esperado**: cada Usuário vê apenas o seu acervo, os seus Agendamentos, as suas Preferências e o seu Histórico; um Usuário nunca vê nem altera Agendamentos ou Preferências do outro; dados de outro Usuário se comportam como inexistentes.

**Prova**: FR-219, SC-086.

### 11. Virada da meia-noite durante a Sessão

**Passos**: com o relógio controlado no teste (o cliente envia `inicioDoDia` e `fimDoDia`), iniciar um lote antes da meia-noite e concluí-lo depois; reabrir Início.

**Resultado esperado**: o limite de novos zera à meia-noite local; o lote em andamento segue até o fim; a próxima abertura de Início reflete o novo dia, com base em `proximaRevisaoEm < fimDoDia` para "vencido" e no intervalo `[inicioDoDia, fimDoDia)` de `criadoEm` para "novos introduzidos hoje". "Hoje" e "vencido" seguem o fuso do navegador.

**Prova**: FR-204, FR-203.

### 12. Migração 7 sobre uma base da 013 preserva os dados

**Passos**: partir de uma base da 013 com Usuários, Cartões, Baralhos, Vínculos e Registros de sessão. Aplicar a migração 7 nos **dois Adapters** (SQLite e PostgreSQL), seguindo [data-model.md](./data-model.md). Abrir Início, o Histórico e as Estatísticas.

**Resultado esperado**: nenhum dado existente é perdido nem alterado; nenhum Agendamento é criado pela migração; todos os Cartões do Usuário, inclusive os já estudados antes da 015, aparecem como Cartões novos e entram pelo limite diário; os Registros anteriores, sem Avaliação, aparecem exatamente como antes no Histórico, nas Estatísticas e nos Resumos antigos, e são ignorados em qualquer reconstrução por troca de algoritmo. A migração só adiciona colunas e cria tabelas.

**Prova**: FR-214, FR-220, FR-197, FR-167.

### 13. Desempenho e acessibilidade das telas novas

**Passos**: com 2.000 Cartões e 500 Registros de sessão no ambiente local, abrir Início. Em seguida, percorrer Início, a Revisão do dia e Preferências só pelo teclado, nas larguras de 360 a 1440 px e com zoom de 200%.

**Resultado esperado**: o bloco de revisão fica visível em até 1 s. As telas novas atendem ao percurso por teclado, aos alvos de 44 px e ao contraste da `012`.

**Prova**: SC-087, SC-088 (e2e `percurso-por-teclado.spec.ts` e `visual-e-contraste.spec.ts` ampliados).

## Referências

- Contratos HTTP e Interface da Porta: [contracts/contratos.md](./contracts/contratos.md).
- Entidades, colunas e migração 7: [data-model.md](./data-model.md).
- Decisões de algoritmo (SM-2, tabela de referência, dia do navegador, onde o cálculo acontece): [plan.md](./plan.md).
- Requisitos e critérios: [spec.md](./spec.md).
