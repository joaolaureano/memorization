# Phase 0 — Research: Entrar

As decisões de stack, runtime, driver, build e testes estão em
[`../001`](../001-criar-cartao/research.md), e as de Senha, segredo do servidor e
migração 4, em [`../007`](../007-criar-usuario/research.md). Nenhuma é reaberta.
Aqui fica apenas o que é novo nesta feature.

## Decisão 1 — Verificar a Senha reconstruindo a derivação

**Decisão**: `autenticar` busca o Usuário pelo Nome de usuário normalizado, lê
`sal` e `parametros`, refaz `scrypt(HMAC-SHA256(segredo, senha), sal)` com os
parâmetros **gravados** e compara com o `hash` por `timingSafeEqual`.

**Rationale**: os parâmetros ficam no registro, e não em constante de código,
para que hashes antigos continuem verificáveis depois de qualquer evolução;
`timingSafeEqual` compara em tempo constante, enquanto comparação de strings
pararia no primeiro byte diferente e vazaria o prefixo correto do hash; e nada é
gravado nesta operação, porque Entrar não escreve (FR-089).

**Alternativas rejeitadas**: comparar com `===`; regravar o hash a cada Entrar,
escrita sem requisito.

## Decisão 2 — Recusa uniforme, com derivação descartável

**Decisão**: quando o Nome de usuário não existe, o Module executa a **mesma**
derivação contra um `sal` e um `hash` descartáveis, gerados **uma única vez** na
criação do Module. A recusa é sempre `credencial_invalida`, com a mensagem "Nome
de usuário ou Senha incorretos.".

**Rationale**: sem isso, "Nome de usuário inexistente" retornaria em
microssegundos e "Senha errada" em dezenas de milissegundos — a diferença diria
qual parte da Credencial falhou, o que FR-088 e SC-029 proíbem. Gerar o `sal`
descartável uma vez, e não a cada requisição, mantém a recusa idêntica ao acerto
sem custo extra.

**Alternativas rejeitadas**: uniformizar só a mensagem, mantendo a diferença de
tempo; semente fixa em código, que produziria sempre o mesmo hash descartável e
ficaria reconhecível nos dados.

## Decisão 3 — Credencial por `Authorization: Basic`, com exceções nomeadas

**Decisão**: `Authorization: Basic base64(nomeDeUsuario:senha)` em toda
requisição, exceto `POST /usuarios` (Cadastro), `GET /health` e o pré-voo
`OPTIONS`. O 401 **não** publica `WWW-Authenticate`. Nada é guardado entre
requisições: cada requisição deriva a Senha de novo.

**Rationale**: Basic é o transporte padrão para apresentar Nome de usuário e
Senha em cada requisição, sem inventar formato nem cabeçalho.
`WWW-Authenticate` faz o navegador abrir o diálogo nativo e, na prática,
memorizar e reenviar a Credencial — isso viola FR-089 e FR-078, e omiti-lo é a
diferença entre um 401 que a interface trata e um que o navegador sequestra. O
Cadastro é isento porque quem cria o Usuário ainda não tem Credencial (FR-097);
`/health`, porque é a prova de vida usada para subir os servidores nos testes. O
CORS passa a permitir `authorization`, senão o pré-voo recusa os `fetch` do
frontend. E qualquer cache de Credencial verificada — em memória, com validade ou
por cookie — seria uma sessão de fato e reutilizável, o que FR-079 proíbe e
SC-033 verifica; o custo de 50 a 150 ms por requisição é aceitável na máquina
local e está na tabela de riscos do plano.

**Alternativas rejeitadas**: cookie de sessão e token portador (FR-079 proíbe);
cabeçalho próprio com nome do domínio; exigir Credencial em `/health`, que
quebraria a prontidão dos testes sem ganho; cache por poucos segundos, que
reintroduz o proibido.

## Decisão 4 — Um único ponto de verificação, com decoração da requisição

**Decisão**: um hook `onRequest` em `backend/src/http/servidor.ts` decodifica o
cabeçalho, chama `Identidade.autenticar` e, no sucesso, decora a requisição com o
`usuarioId`; na ausência, na má formação ou na recusa, responde 401 e **a rota
não executa**.

**Rationale**: FR-090 exige que **toda** operação sobre Cartões, Baralhos,
Vínculos e dados de Sessão de estudo exija Credencial válida. Verificando em cada
handler, bastaria esquecer uma rota nova; o hook transforma a obrigação em
propriedade estrutural e deixa a lista de rotas isentas curta e explícita.

**Alternativas rejeitadas**: `preHandler` por rota; verificar dentro do `Acervo`,
que passaria a conhecer Senha; middleware de terceiro, dependência nova.

## Decisão 5 — Acervo por usuário, com o dono no construtor

**Decisão**: `criarAcervo(banco, usuarioId)`; as operações da Interface não mudam
e cada consulta ganha `WHERE usuario_id = ?`. A rota constrói o `Acervo` por
requisição, a partir do `usuarioId` decorado.

**Rationale**: FR-092 exige que conteúdo de outro Usuário se comporte como
inexistente; com o escopo na consulta, o `SELECT` do outro dono **não devolve
linha** e a recusa cai no `nao_encontrado` já existente — a mesma mensagem de um
id que nunca existiu (SC-030). FR-093 fecha por construção: Cartão e Baralho só
coexistem no escopo se forem do mesmo Usuário, e `vincular` responde 404 nos
demais casos, nunca 403, que revelaria a existência. Manter as assinaturas
preserva a Interface e, com ela, toda a bateria das features anteriores.

**Alternativas rejeitadas**: comparar o dono depois de buscar a linha, o que exige
um 403 e revela existência; filtrar no cliente, que não é limite de integridade.

## Decisão 6 — Migração 5 recria `cartao`, `baralho` e `vinculo`

**Decisão**: no fim da lista ordenada de `backend/src/acervo/migracoes.ts`, e em
transação, **descartar** o conteúdo de `vinculo`, `baralho` e `cartao` e recriar
as três tabelas com as mesmas colunas e `CHECK`s, mais `usuario_id TEXT NOT NULL
REFERENCES usuario(id) ON DELETE CASCADE` em `cartao` e `baralho`, índices sobre
`usuario_id`, e `vinculo` com a chave primária composta e as cascatas de sempre.

**Rationale**: o SQLite recusa `ALTER TABLE ... ADD COLUMN ... NOT NULL` sem valor
padrão; e, com chave estrangeira, o padrão teria de ser `NULL`, contradizendo o
`NOT NULL`. Recriar é a única forma de acrescentar a coluna com a restrição
desejada — e é trivial aqui **porque o acervo sem dono é descartado de todo modo**
(FR-099, SC-037): não há dado a preservar nem dono a preencher. A tabela `usuario`
da `007` **não é tocada**, e é isso que permite a cada um voltar a Entrar depois
da migração. As `CHECK`s e a chave primária composta são repetidas para que a
garantia continue no esquema, não só no código.

**Prova**: teste que prepara uma base na versão 4, com Usuários e acervo legado,
migra e exige versão 5, Usuários intactos e zero Cartões, Baralhos e Vínculos.

**Alternativas rejeitadas**: `ADD COLUMN` com padrão nulo, impedido pelo SQLite;
adoção do acervo pelo primeiro Usuário, recusada no clarify; tabela de dono
separada, que não impede Vínculo entre donos diferentes.

## Decisão 7 — `nao_autenticado` como modo de erro da Seam

**Decisão**: `ClienteHttp` recebe a Credencial na construção, envia o cabeçalho em
toda chamada e traduz **401** no modo novo `nao_autenticado`, ao lado de
`indisponivel`. `ClienteEmMemoria` espelha o modo, guarda Usuários e responde
`entrar`, com os dados escopados por Usuário.

**Rationale**: FR-091 exige distinguir "a Credencial não vale mais" de "a API não
respondeu": o primeiro caso descarta a Credencial e volta a "Entrar" com mensagem
explicativa (SC-035), o segundo preserva o digitado e permite nova tentativa
(FR-045). Sem o espelho no Adapter de teste, a bateria compartilhada teria de ser
duplicada e o contrato deixaria de ser provado duas vezes.

**Alternativas rejeitadas**: tratar 401 como `indisponivel`, que faria a interface
mentir sobre a causa; Adapter de teste que ignora Credencial.

## Omissões deliberadas

| Omitido | Motivo |
|---|---|
| Recuperação e troca de Senha | Adiadas explicitamente na spec |
| Bloqueio por tentativas | Adiado: só faz sentido fora da máquina local |
| "Lembrar de mim" e compartilhar Baralho | Adiados; contrariam FR-089 e FR-093 |
| Exclusão de Usuário | Adiada |
| Emenda à constituição | O Princípio VIII já cobre Senha e Credencial |

Nenhum marcador `NEEDS CLARIFICATION` permanece.
