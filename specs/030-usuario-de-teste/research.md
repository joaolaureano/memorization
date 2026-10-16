# Research: Usuário de Teste

**Feature**: `030-usuario-de-teste` | **Data**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

Registro append-only das decisões de planejamento (Princípio II). O Arquiteto fez o levantamento do código diretamente:
- o esquema `usuario` e `acesso_temporario` (`backend/src/armazenamento/postgresql/migracoes.ts`);
- `POST /entrar` e o cookie do Acesso (`backend/src/http/rotas.ts`, `credencial.ts`);
- `criarIdentidade` e `aposExcluirConta` (`backend/src/identidade/identidade.ts`);
- a fila `midia_a_remover` e `processarFilaDeMidia` (`backend/src/acervo/acervo.ts`, `entradas/nuvem.ts`);
- o alfabeto de Nome de usuário (`identidade/invariantes.ts`);
- a política IAM do usuário de deploy (`backend/terraform/iam/`).

## R0 — Skills aplicadas

- **domain-modeling**:
  - Termos fixados em Key Entities: **Conta de teste** (um Usuário com marca de teste) e **Acervo de demonstração** (o conteúdo inicial).
  - "Visitante" é quem usa uma Conta de teste. Não é um termo de domínio novo: o visitante é um Usuário.
  - Proibidos: "usuário demo", "convidado" e "guest". A Conta de teste é sempre um Usuário completo.
  - Cenários-limite exercitados:
    - dois visitantes simultâneos;
    - aba fechada sem Sair;
    - Cópia de um Cartão do Acervo de demonstração para outro Baralho;
    - exclusão de um Cartão com mídia de demonstração;
    - Exportação;
    - expiração com formulário aberto;
    - limite por origem.
- **codebase-design**: aplicada em R2 a R9.
  - O Module novo `demonstracao` tem Interface pequena: `ACERVO_DE_DEMONSTRACAO`, `montarContaDeTeste(agora, fuso)` e `CREDITOS`.
  - A criação atômica fica numa operação nova da Porta, nos dois Adapters.
  - A Seam `ArmazemDeMidia` não ganha operação; só uma regra de prefixo protegido.
  - Nenhuma Seam nova.

## R1 — A Conta de teste é um Usuário com marca

**Decisão**: a Conta de teste é uma linha de `usuario` com a coluna nova `conta_de_teste_em` (TIMESTAMPTZ, nula nas contas reais), que guarda o instante da criação.
- O Nome de usuário é gerado como `teste-` seguido de 16 caracteres aleatórios do alfabeto vigente.
- A Senha é aleatória, de 32 bytes, e nunca sai do servidor.
- `autenticar` recusa uma Conta de teste por Nome de usuário e Senha com a mesma recusa uniforme de credencial inválida (FR-501). Por isso nem a tela de Entrar nem o Basic auth aceitam essas contas.

**Por quê**: toda regra de acervo, estudo, Agenda, Exportação e isolamento por Usuário passa a valer sem mudança (FR-489, FR-495). A unicidade de `nome_de_usuario` já impede colisão com contas reais. O alfabeto e o tamanho continuam válidos sem migração de restrição.

**Alternativas rejeitadas**:
- **Tabela separada de visitantes**: duplicaria todo o isolamento por Usuário.
- **Prefixo de Nome de usuário reservado no Cadastro**: muda a `007` e não protege contas já existentes. A marca na linha basta.

## R2 — Criação atômica: `criarContaDeTeste` na Porta

**Decisão**: a Porta ganha `criarContaDeTeste(conta)`. Numa única transação, a operação insere:
- o Usuário marcado;
- os três Baralhos e seus Cartões, com Pertencimento;
- os Registros de Sessão do histórico;
- os Agendamentos;
- a Rotina;
- as Preferências padrão.

Qualquer falha desfaz tudo ("Nenhuma conta parcial", Edge Case).

O Module `demonstracao` monta o valor `conta` a partir de `ACERVO_DE_DEMONSTRACAO`, com ids novos, `agora` e `fuso`. Os Agendamentos vêm de **reprodução** das Avaliações do histórico pela função existente `aplicarAvaliacoes` (`repeticao/revisao.ts`), nas datas relativas ao dia de criação. Assim Estatísticas, Agendamentos e Histórico ficam coerentes por construção (FR-504).

**Alternativa rejeitada**: compor as operações existentes (`importarBaralhos`, `inserirRegistroEAgendamentos`, `gravarRotina`). Elas são transações separadas, e uma falha no meio deixaria uma conta parcial. Seriam também cerca de 10 idas ao Neon, o que pressiona SC-192 (até 5 s).

## R3 — Mídia do Acervo de demonstração: compartilhada e protegida

**Decisão**:
- As Imagens e Áudios do Acervo de demonstração ficam uma vez só no armazém, sob o prefixo `demonstracao/` (por exemplo, `demonstracao/bandeiras/brasil.png`). Os Cartões de todas as Contas de teste apontam para essas chaves.
- **Proteção (FR-500)**:
  - os dois Adapters da Porta nunca enfileiram chaves `demonstracao/` em `midia_a_remover`;
  - `processarFilaDeMidia` ignora essas chaves, como segunda defesa.
  - Excluir um Cartão de demonstração numa Conta de teste remove o Cartão, não o arquivo.
- **Cópia (`025`)**: `copiar` de uma chave `demonstracao/` cria uma chave própria do Usuário, como hoje. Essa cópia é removida normalmente.
- **Publicação**: os arquivos fazem parte do pacote da API (`backend/demonstracao/midia/`).
  - Na criação de uma Conta de teste, `garantirMidiaDeDemonstracao` confere com `medir` se cada chave existe e grava as ausentes.
  - A gravação passa pelas mesmas regras de conteúdo da `026`/`028`: formato pelo conteúdo real e remoção de metadados.
  - É idempotente e roda uma vez por instância da Lambda (memoizada).
  - A role da Lambda já tem `PutObject` em `/*`. Nenhuma infraestrutura nova.
- **Leitura**: endereço assinado de 15 minutos, como qualquer Mídia (FR-424/FR-453), sempre emitido a partir de um Cartão do Usuário que pede.

**Alternativas rejeitadas**:
- **Copiar a mídia para cada conta**: multiplica o armazenamento e o tempo de criação, contra a premissa de custo da spec.
- **Subir pelo workflow de deploy**: a role `ci_deploy` não tem acesso ao bucket de mídia, e o modo local precisaria de outro caminho.

## R4 — Ciclo de vida: Sair, expiração e limpeza

**Decisão**:
- **Sair (FR-497)**: `POST /sair`, quando o Usuário do Acesso é de teste, exclui o Usuário. É a mesma exclusão da `017`: `excluirUsuario` com fila de mídia, inclusive `exportacoes/{id}` (`029`, R14). Depois processa a fila e limpa o cookie. A interface pede confirmação antes.
- **Expiração (FR-498)**: uma Conta de teste está encerrada quando não tem Acesso válido (`expira_em > agora`) e foi criada há mais de 2 minutos. A folga evita corrida com a criação.
- A operação nova da Porta `listarContasDeTesteEncerradas(agora, limite)` devolve os ids, e a limpeza exclui cada um com `excluirUsuario`. Depois processa a fila de mídia.
- **Quando a limpeza roda**:
  - **Nuvem**: uma regra agendada do EventBridge a cada 15 minutos invoca a Lambda. `funcao.ts` reconhece o evento agendado (`source = "aws.events"`) e roda a limpeza em vez do Fastify. Isso dá menos de 1 hora no pior caso.
  - **Também** em toda criação de Conta de teste, com limite de 20 contas por vez.
  - **Local**: um intervalo de 5 minutos em `entradas/local.ts`.
- **Mensagem ao visitante**: o cliente sabe que é Conta de teste pela marca em `GET /conta`. Um `401` numa Conta de teste leva à tela de Entrar com o aviso "Sua Conta de teste terminou" (US3/AC2).

**Infraestrutura**:
- `aws_cloudwatch_event_rule` com `rate(15 minutes)`, mais o target e a `aws_lambda_permission`.
- O usuário de deploy precisa de `events:PutRule`/`PutTargets`/`DescribeRule`/`DeleteRule`/`RemoveTargets`/`ListTagsForResource`/`TagResource` na regra, e `lambda:AddPermission`/`RemovePermission`/`GetPolicy` na função.
- Isso vai num JSON novo, `backend/terraform/iam/robot-agendamento.json`, aplicado pelo PO como política inline. O `robot` não tem `iam:AttachRolePolicy`.
- **`premissa a validar`**: o PO aplica a política antes do `tofu apply`.

**Alternativa rejeitada**: só limpeza oportunista nas requisições. Sem tráfego, uma conta abandonada ficaria guardada por tempo indefinido, contra FR-498.

## R5 — Limite de criação por origem (FR-502)

**Decisão**:
- **Origem**: o IP do visitante, lido de `CloudFront-Viewer-Address` quando presente, senão do último elemento de `X-Forwarded-For` acrescentado pelo CloudFront. Guarda-se só `HMAC-SHA256(subchave, ip)`, com `subchave = HMAC-SHA256(SEGREDO_DAS_SENHAS, "origem-de-conta-de-teste")`. Não há segredo novo, e a chave das Senhas não é reaproveitada diretamente para outro fim. O IP nunca é guardado em claro (privacidade).
- **Limites**:
  - **por origem**: até 10 Contas de teste por hora; acima disso, `429 contas_de_teste_esgotadas_na_origem`;
  - **global**: até 300 Contas de teste ativas; acima disso, `503 contas_de_teste_indisponiveis`.
- **Tabela**: `criacao_de_conta_de_teste (origem_hmac, criado_em)`, limpa pela mesma rotina de R4 (linhas com mais de 1 hora).

**`premissa a validar`**: a política de origem `all_viewer_except_host` encaminha `CloudFront-Viewer-Address` à Lambda. Se não encaminhar, vale o `X-Forwarded-For`, que o CloudFront sempre completa com o IP do visitante.

## R6 — Conta protegida (FR-496)

**Decisão**:
- `PUT /conta/senha`, a alteração de Nome de usuário e `DELETE /conta` recusam a Conta de teste com `403 conta_de_teste`, mensagem em inglês ASCII.
- `GET /conta` passa a devolver `contaDeTeste: true|false`.
- O Perfil esconde as três ações e mostra a explicação.
- Preferências, Agenda e Idioma continuam permitidos (US4/AC3).

## R7 — Histórico de exemplo (FR-504)

**Decisão**: `ACERVO_DE_DEMONSTRACAO.historico` declara as Sessões de exemplo, sempre com as mesmas Avaliações:
- 5 Sessões nos dias −6, −5, −3, −2 e −1, relativos ao dia de criação no fuso do visitante;
- cada uma com 6 a 10 Cartões dos três Baralhos e Avaliações misturadas (Errei, Difícil, Bom e Fácil).

A reprodução por `aplicarAvaliacoes` dá Agendamentos com revisão hoje para alguns Cartões e futura para outros. Um teste confere que, em qualquer fuso e horário de criação, há ao menos 3 Cartões com revisão hoje ou antes (SC-198).

A Rotina de exemplo é "Inglês, todos os dias, Todos os Cartões". O Compromisso de hoje fica não concluído, porque nenhuma Sessão do histórico é de hoje.

## R8 — Conteúdo e licenças (FR-492 a FR-494)

**Decisão**: o conteúdo fica em `backend/demonstracao/acervo.ts` (textos) e `backend/demonstracao/midia/` (arquivos), com `backend/demonstracao/creditos.json` (fonte, autor, licença e URL de cada mídia). O contrato do conteúdo está em [contracts/acervo-de-demonstracao.md](./contracts/acervo-de-demonstracao.md).

- **Inglês**: 12 Cartões Frente-Verso (palavra em inglês → tradução), com Tags.
- **Bandeiras**: 10 Cartões de Imagem, PNG de até 640 px de largura, de bandeiras em domínio público no Wikimedia Commons. A descrição alternativa é "Bandeira de {país}".
- **Cantos de pássaros**: 10 aves comuns no Brasil, MP3 ou OGG de até 20 segundos, de gravações em **CC0, CC BY ou CC BY-SA** (Wikimedia Commons ou xeno-canto). **NC e ND ficam excluídas**, porque o recorte do áudio é uma adaptação.
- **Créditos (FR-494)**: a aplicação mostra a lista em "Créditos do acervo de demonstração", com link no aviso da Conta de teste. A lista vem de `GET /demonstracao/creditos` (público, sem Entrar).
- **Preparação dos arquivos**: o Arquiteto baixa, recorta e normaliza os arquivos uma vez, registra a origem e a licença de cada um em `creditos.json` e os versiona. Não é código de produto.

## R9 — Entrar como Teste: rota e fluxo

**Decisão**:
- `POST /contas-de-teste` com `{ fuso, idioma }`, sem autenticação. O servidor:
  1. aplica R5;
  2. garante a mídia (R3);
  3. monta e cria a conta (R2);
  4. emite o Acesso com o cookie (`018`, `acessos.emitir`);
  5. responde `201 { nomeDeUsuario, contaDeTeste: true }`.
- O cliente usa o Acesso (`usaAcesso`) como depois de Entrar com "Continuar conectado".
- O botão "Entrar como Teste" fica na tela de Entrar, abaixo do formulário.

## R10 — Desempenho (SC-192)

**Meta**: até 5 s do clique ao Início pronto. A criação é uma transação de cerca de 150 linhas no Neon. A mídia só é conferida na primeira criação de cada instância da Lambda.

**`premissa a validar`**: mesmo com a Lambda fria (SSM e TLS com o Neon), a criação fica abaixo de 5 s. O quickstart mede em produção.

## R11 — Estratégia de testes

- **`demonstracao`**:
  - `montarContaDeTeste` é determinística a menos de ids e datas;
  - o conteúdo bate com o contrato (contagens 8–15, tipos, créditos completos para cada mídia, licenças permitidas);
  - o histórico dá revisão hoje em fusos extremos (SC-198).
- **Porta** (bateria, SQLite e PostgreSQL):
  - `criarContaDeTeste` é atômica (falha no meio não deixa nada);
  - `listarContasDeTesteEncerradas` respeita Acesso válido e a folga;
  - `excluirUsuario` não enfileira chaves `demonstracao/`;
  - migração 22 sobre a v21.
- **Identidade/HTTP**:
  - `autenticar` recusa a Conta de teste;
  - `403 conta_de_teste` nas três ações;
  - `POST /contas-de-teste` cria, emite cookie e respeita os limites 429/503;
  - `POST /sair` exclui a Conta de teste e a fila remove a mídia própria, mas não a de demonstração;
  - o handler do evento agendado roda a limpeza.
- **Frontend**: botão em Entrar; aviso e créditos; Perfil sem as ações; confirmação ao Sair; mensagem de conta encerrada; três idiomas.
- **e2e**:
  - entrar como Teste, estudar uma Bandeira e um Canto, Sair e entrar de novo com o estado inicial;
  - duas páginas simultâneas isoladas;
  - 360/390/768/1440 px e zoom de 200%.

## R12 — Alteração de Nome de usuário

O produto não expõe rota de alteração de Nome de usuário (só `GET /conta`, `PUT /conta/senha` e `DELETE /conta`). Para a Conta de teste, a parte de FR-496 que trata disso é satisfeita pela ausência da rota. A prova de UI confere que nenhuma ação de Nome de usuário aparece.

## R13 — Gravação da mídia de demonstração no armazém

**Decisão**: a Seam `ArmazemDeMidia` ganha `gravarArquivoFixo(chave, bytes, tipoDeConteudo)` nos dois Adapters (S3: `PutObject`; Disco: escrita do arquivo). A operação recusa qualquer chave fora de `demonstracao/`.

A limpeza de metadados não acontece em tempo de execução. Os arquivos são preparados limpos e versionados (R8). Um teste do Module `demonstracao` passa cada arquivo pelas funções existentes de reconhecimento (`detectarFormato` e a remoção de metadados da `026`; `reconhecerAudio` da `028`) e exige que o resultado seja idêntico ao arquivo. Assim a regra fica provada sem duplicar o fluxo de confirmação.

**Alternativa rejeitada**: reaproveitar `prepararEnvio`/`confirmar`. Esse fluxo é feito para envio do navegador para `pendentes/` de um Usuário e exige um envio pré-assinado. Usá-lo no servidor seria um desvio sem ganho.

## R14 — Revisão do checklist (2026-10-15)

O PO pediu a revisão de `checklists/seguranca-ciclo-e-conteudo.md`. Dos 35 itens, 16 passaram e 19 reprovaram; as correções foram aplicadas à spec (US3/AC2, Edge Cases, FR-492, FR-494, FR-495a novo, FR-497, FR-500, FR-501, FR-502, FR-504, SC-192, SC-195, Assumptions).

- **CHK004, mídia por Conta de teste**: o PO escolheu um limite de 20 MB de Imagens e Áudios enviados por Conta de teste (FR-495a). A mídia do Acervo de demonstração não conta.
  - **Implementação**: na confirmação do envio, o `Acervo` soma os bytes da mídia própria dos Cartões da conta, que já são conhecidos pela confirmação (`bytes`). Acima de 20 MB, a recusa é `413 limite_de_midia_da_conta_de_teste`.
  - A Importação do Anki não traz mídia (`028`, FR-452), então não precisa de limite próprio.
- **CHK034**: a exceção à regra "cada Cartão tem a própria mídia" agora é requisito (FR-500), não só premissa de custo.
- **CHK011**: a expiração encerra a conta na hora (sem Acesso válido, nada a usa), e a exclusão física ocorre em até 1 hora.

## R15 — Decisões do `analyze` (2026-10-15)

- **S1, envios preparados**: o limite de 20 MB conta só a mídia confirmada. Para impedir que uma Conta de teste encha `pendentes/` sem salvar Cartões, cada Conta de teste prepara no máximo 30 envios (`usuario.envios_de_teste`, incremento atômico condicionado). Acima disso: `413 limite_de_midia_da_conta_de_teste`. Pior caso: 300 MB por conta em `pendentes/`, que expiram em até 48 h.
- **I1**: os 20 MB valem para a mídia **mantida** nos Cartões; excluir um Cartão libera espaço. O limite de envios segura o ciclo de enviar e excluir.
- **A1**: uma conta ativa é uma conta não encerrada, com Acesso válido, o mesmo critério da limpeza (R4).
- **S2**: a origem é guardada com uma subchave derivada do segredo existente (R5 atualizado).
- **C1, concorrência no limite por origem**: aceita-se que pedidos simultâneos do mesmo endereço ultrapassem levemente o limite de 10 por hora. O limite existe para impedir criação em massa, não para contar com exatidão.

## R16 — Como a Lambda reconhece a limpeza agendada (2026-10-15, T003)

A regra do EventBridge envia uma entrada fixa, `{"acao":"limpar-contas-de-teste"}`, que **substitui** o envelope do evento: a Lambda não recebe `source = "aws.events"`. `funcao.ts` reconhece então o evento agendado por `acao === "limpar-contas-de-teste"`, e não pelo `source` (corrige R4). Uma entrada explícita também deixa claro, na própria regra, qual ação ela dispara.

## R17 — Mídia preparada (2026-10-15, T001)

- **Bandeiras**: 10 PNG de 640 px de largura, renderizados pelo Wikimedia Commons a partir dos SVG "Flag of …", todos em domínio público (`LicenseShortName = Public domain`). Cada arquivo foi passado pela remoção de metadados da `026` até estabilizar.
- **Cantos**: 10 trechos de até 15 s, mono, MP3 de 64 kbps, sem metadados (ffmpeg num contêiner), depois passados por `reconhecerAudio` até estabilizar.
  - **Licenças**: CC BY-SA 3.0/4.0, e CC0 no anu-branco.
  - **Autores**: Niels Krabbe, Gabriele Magurno, maria belotti, Zyoute e Tiago Lubiana.
- **Trocas de espécie**: o Commons não tinha gravação com licença permitida (sem NC/ND) de quero-quero, canário-da-terra e sanhaço-cinzento. Foram trocados por cambacica (*Coereba flaveola*), tiziu (*Volatinia jacarina*) e anu-branco (*Guira guira*).
- **Corruíra**: passou a *Troglodytes musculus*, a classificação atual da corruíra sul-americana. A gravação é de São Paulo.
- **Créditos**: `backend/demonstracao/creditos.json` (20 entradas, licença em SPDX ou `LicenseRef-Public-Domain`). Tamanho total da pasta: 1,3 MB.

## R18 — Precondição da migração 22 (2026-10-15, T011)

A migração 22 leva a precondição `PODE_REMOVER_VINCULO`, como a 18, a 19 e a 21 (`028`, R6). Sem ela, o aplicador de versão única pularia para sempre as migrações adiadas de uma base com a transição de Pertencimento pendente. Uma base nesse estado fica na v20 até concluir a transição, e só então recebe a 22. O Neon de produção já está na v21 (transição concluída), então a 22 se aplica no próximo deploy.

## R19 — Ajustes de conteúdo (2026-10-15, T014)

- **Mensagem dos Cantos de pássaros**: vazia. Com "Que pássaro é este?" em todos, a regra de Frente única dentro do Baralho (`025`, FR-439 da `028`) recusaria 9 dos 10 Cartões. Cartões de Áudio sem Mensagem ficam fora dessa regra, como as Bandeiras sem Texto da frente.
- **Descrição alternativa**: "Bandeira do/da {país}", com a preposição correta para cada país.
- **Duração**: os trechos têm cerca de 15 s (até 15,07 s). O contrato passa a dizer "até 20 s", coerente com R8.
- **Preferências**: só o algoritmo SM-2. O tipo `Preferencias` não tem o limite de novos por dia.

## R20 — Migração 22 bloqueada em produção (2026-10-15)

R18 supôs o Neon na v21. Na verdade ele estava na v20, porque 3 Cartões sem Pertencimento mantinham a transição da `025` pendente. Com isso, a 22 não rodou e "Entrar como Teste" falhou com tabela inexistente. A transição foi concluída com autorização do PO (tasks.md, Notes), e o Neon chegou à v22.

**Lição**: uma migração com precondição de transição depende dos dados de produção. Antes de publicar uma feature que exige uma migração nova, o deploy deve confirmar a versão do esquema que de fato foi alcançada. Hoje o passo "Migrar o esquema do Neon" apenas informa a versão e não falha quando ela fica abaixo da esperada.

## R21 — A migração 22 não pode depender da transição da 025 (2026-10-15)

**Problema**: R18 condicionou a 22 a `PODE_REMOVER_VINCULO`. Toda base com a transição da `025` pendente fica então na v20 sem as tabelas da Conta de teste, e "Entrar como Teste" falha com tabela inexistente. Aconteceu em produção (R20) e no banco local (31 Cartões pendentes). É defeito de desenho: uma feature nova não pode depender de os Usuários concluírem uma transição antiga.

**Decisão**: o padrão da `028` (R6).
- A **22 perde a precondição**: o aplicador pula a 21 adiada e aplica a 22.
- Uma **23 nova repete a finalização da 21** (e, por consequência, da 18 e da 19), com a precondição `PODE_REMOVER_VINCULO`. Ela fica adiada até a transição terminar, de modo que nenhuma finalização se perde.
- **Bases já na v22** (Neon depois de R20): a 23 roda e não muda nada, porque a transição está concluída e a finalização é idempotente.
- **Bases na v20 com transição pendente**: passam a v22 (Conta de teste funciona) e recebem a 23 quando a transição terminar.
