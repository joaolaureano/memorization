# Tasks: Entrar

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`

**Depende de**: `007-criar-usuario` **já implementada** (T601 a T614) — reusa o
Module `Identidade` com `cadastrar` e a derivação da Senha, o segredo do servidor
e a migração 4 — e de `001-criar-cartao` a `006-excluir-cartao-e-baralho`, cujo
acervo passa a ser **por usuário**. Sem a `007` implementada não há sobre o que
construir a verificação da Credencial, o hook do servidor nem a tela "Entrar".

**Executor**: pelo **Princípio XI**, todo código sob `backend/`, `frontend/` e
`e2e/` é criado por subagentes DeepSeek.

## Formato

O estado de cada tarefa é a **caixa de seleção**: `- [ ]` pendente, `- [X]`
concluída. É esse marcador que o comando `implement` lê e atualiza. Os metadados
exigidos pelo processo ficam na tabela recolhida de cada fase.

`[P]` = paralelizável: arquivos disjuntos, sem dependência mútua.

---

## Fase 1 — Fundação no servidor

- [X] T701 Migração 5 recria `cartao`, `baralho` e `vinculo` com dono e descarta o acervo sem dono
- [X] T702 [P] `Identidade.autenticar` confere a Credencial e recusa sempre com a mesma mensagem e a mesma duração

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T701 | Uma base na versão 4, com Usuários e acervo sem dono, migra para a versão 5: os Usuários permanecem intactos e não sobra Cartão, Baralho ou Vínculo sem dono | FR-099 · SC-037 | 007/T601 | `Acervo` (Seam interna) | `backend/src/acervo/`, `backend/tests` | `codebase-design` | Base preparada na versão 4, com ao menos um Usuário e com Cartões, Baralhos e Vínculos dentro: após migrar, esquema na versão 5, `usuario` intacta, zero linhas em `cartao`, `baralho` e `vinculo`, `usuario_id` obrigatório e indexado nos dois, e a chave primária composta de `vinculo` preservada; a migração não reaplica e a subida desde a versão 1 continua funcionando; nenhuma coluna capaz de guardar a Credencial é criada | Nenhum Cartão, Baralho ou Vínculo sem dono existe, os Usuários sobrevivem à recriação e nada além de `usuario_id` e dos índices foi acrescentado |
| T702 | `autenticar` aceita a Credencial correta — Nome de usuário sem espaços ao redor e sem distinção entre maiúsculas e minúsculas, Senha comparada exatamente — e recusa Nome de usuário inexistente e Senha errada com mensagem idêntica e duração indistinguível | FR-086, FR-087, FR-088, FR-078 · SC-029, SC-036 | 007/T603 | `Identidade` · `autenticar` | `backend/src/identidade/`, `backend/tests` | `domain-modeling` | Casos pela Interface, com SQLite em memória, segredo e Senhas gerados a cada execução: `  ana.silva  ` entra como `Ana.Silva`; Senha com espaços nas pontas é comparada exatamente; Usuário inexistente e Senha errada devolvem a mesma recusa e a mesma mensagem única; as duas recusas, repetidas várias vezes, exigem ordens de grandeza comparáveis, sem afirmar igualdade de relógio; nenhum retorno, em nenhum caso, contém a Senha | As duas recusas são indistinguíveis pela Interface, em mensagem e em duração, e nenhuma resposta devolve a Senha |

</details>

---

## Fase 2 — Credencial e escopo no servidor

- [X] T703 Hook `onRequest` exige a Credencial antes de toda rota e responde `401` sem `WWW-Authenticate`
- [X] T704 `POST /entrar` verifica a Credencial e o CORS passa a permitir `authorization`
- [X] T705 Suíte de contrato de `001` a `006` apresenta a Credencial e continua verde
- [X] T706 `criarAcervo(banco, usuarioId)` restringe toda operação ao dono, e o acervo de outro Usuário se comporta como inexistente

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T703 | Sem cabeçalho, com cabeçalho malformado ou com Credencial inválida, nenhuma rota de acervo executa e a resposta é `401` com uma única mensagem, sem `WWW-Authenticate` e sem `Set-Cookie`, enquanto Cadastro, prova de vida e pré-voo continuam isentos | FR-090, FR-088, FR-079, FR-046, FR-078 · SC-028 | T702, 007/T602 | Adapter HTTP · hook `onRequest` | `backend/src/http/`, `backend/tests` | `codebase-design` | Cada rota de Cartões, Baralhos, Vínculos, edição/exclusão e edição de Baralho responde `401` `credencial_invalida` com a mensagem única em português, sem `WWW-Authenticate`, sem `Set-Cookie` e sem valor reutilizável; em cada recusa o acervo permanece inalterado; `POST /usuarios`, `GET /health` e o pré-voo `OPTIONS` seguem alcançáveis sem Credencial; rota nova registrada fora da lista isenta já nasce exigindo Credencial | Todas as rotas recusam igualmente, nenhum handler executa sem Credencial válida e a lista isenta é curta e explícita |
| T704 | `POST /entrar`, com a Credencial no cabeçalho, responde `200` com exatamente o Usuário que entrou ou o mesmo `401`, e o pré-voo de CORS em `/entrar` aceita `authorization` | FR-086, FR-046, FR-079, FR-078 · SC-033 | T702, T703 | Adapter HTTP sobre `Identidade` | `backend/src/http/`, `backend/tests` | `codebase-design` | `200` com exatamente `id` e `nomeDeUsuario`; `401` com a mensagem única tanto para Usuário inexistente quanto para Senha errada; `POST /entrar` sem cabeçalho responde `401`; pré-voo de `/entrar` responde `204` com `authorization` em `access-control-allow-headers`; nenhuma resposta traz `Set-Cookie` nem valor reutilizável; a saída capturada do processo não contém a Senha nem o cabeçalho de autorização | Os dois desfechos do contrato estão comprovados e nenhuma resposta ou saída de log carrega a Senha |
| T705 | Toda a suíte de contrato de `001` a `006` apresenta a Credencial em cada requisição e continua verde, com os mesmos códigos e as mesmas mensagens de antes | FR-090 · SC-028 | T703 | Adapter HTTP | `backend/tests` | — | Cada arquivo de contrato passa a criar um Usuário e a enviar o cabeçalho em toda chamada de acervo; os desfechos de sucesso, os códigos de erro de domínio e as mensagens em português permanecem idênticos aos publicados; nenhum caso é marcado como isento | `npm test` do backend verde, com toda chamada de acervo carregando a Credencial |
| T706 | Toda operação do `Acervo` é restrita ao Usuário dono recebido na construção, por requisição: o conteúdo de outro Usuário responde como inexistente, o Vínculo entre donos diferentes é recusado e nada muda | FR-090, FR-092, FR-093, FR-044 · SC-028, SC-030 | T701, T703, 007/T603 | `Acervo` · `criarAcervo(banco, usuarioId)` | `backend/src/acervo/`, `backend/src/http/`, `backend/tests` | `codebase-design` | Dois Usuários com Cartões e Baralhos próprios: cada um lista, cria, edita, exclui e estuda somente os seus; exibir, editar e excluir o id do outro responde `404 nao_encontrado`, com a mesma mensagem de um id que nunca existiu, e jamais `403`; vincular Cartão de um Usuário a Baralho de outro responde `404` e nada muda; `quantidadeDeCartoes` e `elegivel` contam só os Vínculos do dono; sem Credencial e com Credencial inválida, nenhuma operação altera o acervo | O conteúdo do outro Usuário é indistinguível de inexistente, o Vínculo entre donos é impossível e cada recusa deixa o acervo inalterado |

</details>

---

## Fase 3 — Cliente e telas

- [X] T707 `entrar` e `nao_autenticado` existem nos dois Adapters, com a Credencial na construção
- [X] T708 A tela "Entrar" é a primeira e única tela alcançável sem Credencial
- [X] T709 Navegação principal e "Sair" só aparecem depois de Entrar, e Sair volta a "Entrar"
- [X] T710 Recusa por Credencial descarta a Credencial e volta a "Entrar", sem concluir a operação
- [X] T711 Suíte de frontend de `001` a `006` entra antes de operar o acervo e continua verde

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T707 | `entrar` existe nos dois Adapters, o `ClienteHttp` recebe a Credencial na construção e a envia em toda chamada, o `401` vira o modo `nao_autenticado` — distinto de indisponibilidade — e o Adapter de memória guarda Usuários e escopa os dados por Usuário | FR-086, FR-089, FR-090, FR-091, FR-045 · SC-035 | T704 | `ClienteDoAcervo` (Seam) · `entrar`, `nao_autenticado` | `frontend/src/acervo-cliente/`, `frontend/tests` | `codebase-design` | A mesma bateria roda contra `ClienteHttp` e `ClienteEmMemoria`, com resultados idênticos: `entrar` com Credencial válida devolve `{ id, nomeDeUsuario }`; Credencial que não confere devolve `nao_autenticado`; transporte parado devolve `indisponivel`; dois Usuários no Adapter de memória não enxergam o acervo um do outro; nenhum Adapter grava a Credencial em armazenamento do navegador | Os dois Adapters verdes no mesmo conjunto, com Credencial inválida jamais confundida com indisponibilidade |
| T708 | Sem Credencial, a rota `#/entrar` é a única tela alcançável, com os campos Nome de usuário e Senha e o acesso a "Criar conta"; o Cadastro oferece a volta a "Entrar" e, concluído, oferece Entrar em seguida | FR-097, FR-098, FR-095, FR-046, FR-079 · SC-027 | T707 | `Aplicacao` · `PaginaDeEntrada` | `frontend/src/ui/`, `frontend/tests` | — | Sem Credencial, `interpretarRota` resolve toda rota em Entrar, exceto `#/criar-conta`; com Credencial, `#/entrar` resolve em Cartões; a navegação principal não é oferecida sem Credencial; o link "Criar conta" aparece na tela Entrar e não na navegação principal; o Cadastro oferece a volta a Entrar e, no sucesso, a ação Entrar; numa recusa, o foco vai ao campo a corrigir, o Nome de usuário permanece e a Senha é apagada; rótulos em português com os termos canônicos e nenhum sinônimo de `_Avoid_` visível | A primeira e única tela alcançável sem Credencial é Entrar, com o acesso a Criar conta, e nenhuma rota de acervo é alcançável |
| T709 | Depois de Entrar, a navegação para Cartões e Baralhos e a ação "Sair" aparecem em toda tela alcançável, e Sair descarta a Credencial e volta a "Entrar", de modo que o voltar do navegador não traga conteúdo do acervo | FR-094, FR-098, FR-089 · SC-034, SC-031 | T708 | `Aplicacao` | `frontend/src/ui/`, `frontend/tests` | — | Com Credencial, a navegação principal e "Sair" estão presentes em cada tela alcançável, com `aria-current` na rota corrente; Sair volta a "Entrar"; depois de Sair, o voltar do navegador leva a "Entrar" sem exibir conteúdo do acervo; recarregar a página exige Entrar de novo; uma segunda aba mantém a própria Credencial e Sair numa não afeta a outra | Nenhuma tela alcançável fica sem Sair e nenhum caminho do navegador exibe o acervo depois de Sair |
| T710 | Ao receber `nao_autenticado`, a interface descarta a Credencial, volta a "Entrar" com mensagem que explica a recusa e não apresenta a operação como concluída; indisponibilidade é relatada com o digitado preservado | FR-091, FR-044, FR-045, FR-078 · SC-035 | T707, T708 | `ClienteDoAcervo`, `Aplicacao` | `frontend/src/ui/`, `frontend/tests` | — | Operação de acervo que devolve `nao_autenticado`: a Credencial é descartada, a tela Entrar aparece com mensagem explicativa e nenhuma confirmação é exibida; falha de transporte simulada: a falha é relatada, a operação não aparece como concluída e o conteúdo digitado permanece para nova tentativa; a Credencial nunca é oferecida em armazenamento do navegador, cookie ou endereço da página | Nenhuma recusa por Credencial aparece como operação concluída e o digitado sobrevive à falha de transporte |
| T711 | A suíte de frontend de `001` a `006` entra antes de operar o acervo e continua verde, com as mesmas asserções de comportamento | FR-090, FR-097 · SC-027 | T707, T708 | `ClienteDoAcervo` | `frontend/tests` | — | Cada arquivo de teste passa a obter a Credencial pelo fluxo da tela Entrar, ou a construir o Adapter já com ela, e as asserções de Cartões, Baralhos, Vínculos, edição, exclusão, estudo, teclado e leitor de tela permanecem as mesmas; nenhuma asserção é enfraquecida para acomodar a tela nova | `npm test` do frontend verde, com a tela Entrar como ponto de partida de toda prova |

</details>

---

## Fase 4 — Acessibilidade, responsividade e e2e

- [X] T712 Entrar, Sair e a recusa de Entrar são concluídos só por teclado, com o foco sempre identificável
- [X] T713 A recusa de Entrar e a conclusão de Sair são anunciadas por leitor de tela
- [X] T714 [P] A tela "Entrar" é utilizável em largura de telefone
- [X] T715 Harness e2e passa a cadastrar e a entrar, e a suíte de `001` a `007` continua verde
- [X] T716 e2e comprova isolamento entre dois Usuários, recarga, Sair e ausência da Credencial no navegador

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T712 | Entrar, Sair e a recusa de Entrar vão do primeiro campo à conclusão apenas por teclado, o elemento focado é identificável sem depender de cor e, na recusa, o foco vai para o campo a corrigir | FR-095 · SC-032 | T708, T709, T710 | `Aplicacao` · `PaginaDeEntrada` | `frontend/src/ui/`, `frontend/tests` | — | Percurso `Tab`/`Shift+Tab` por Nome de usuário, Senha, Entrar e Sair, asseverando a posição do foco em cada passo; após cada recusa, asserção de que o foco está no campo a corrigir, com o Nome de usuário preservado e a Senha apagada; indicador de foco declarado por marcação, não apenas por cor | As asserções de teclado e de foco passam em cem por cento dos passos |
| T713 | A recusa de Entrar e a conclusão de Sair são anunciadas por região ativa, e os campos e as ações têm rótulo, papel e estado acessíveis | FR-096 | T712 | — | `frontend/src/ui/`, `frontend/tests` | — | Asserções de região ativa para a recusa de Entrar e para a conclusão de Sair; rótulos, papéis e estados acessíveis de Nome de usuário, Senha, Entrar, Criar conta e Sair; a Senha é anunciada como campo de Senha e nunca é exibida de volta | As asserções de semântica e de anúncio passam, e nenhum estado relevante é comunicado apenas por cor |
| T714 | A tela "Entrar" permanece utilizável em largura de telefone, em coluna única, sem rolagem horizontal, inclusive com a recusa exibida | FR-042 | T708 | — | `frontend/src/ui/`, `e2e/` | — | Sem rolagem horizontal em viewport estreita, com Nome de usuário, Senha, Entrar e Criar conta alcançáveis; a recusa exibida não introduz rolagem | Teste e2e passa em largura de telefone |
| T715 | O harness e2e sobe a API real com segredo gerado, cadastra e entra por auxiliares, e toda a suíte de `001` a `007` continua verde apresentando a Credencial | FR-090, FR-097 · SC-027, SC-028 | T704, T707, T708 | — | `e2e/` | — | Auxiliares de Cadastro e de Credencial no formato `Basic`, com Segredos e Senhas gerados a cada execução e sem valor literal no arquivo; cada prova existente cadastra, entra e segue com a sua bateria; as provas que reiniciam os processos continuam passando | `npm run test:e2e` verde, com toda prova de `001` a `007` entrando antes de operar o acervo |
| T716 | Em navegador real, dois Usuários não se enxergam, recarregar exige Entrar de novo, Sair seguido do voltar do navegador não exibe o acervo e a Credencial não aparece em armazenamento, cookie, endereço nem registro da aplicação | FR-079, FR-078, FR-089, FR-094, FR-092 · SC-030, SC-031, SC-033, SC-034 | T709, T715 | — | `e2e/` | — | Dois Usuários cadastrados: cada um vê só o seu acervo e o id do outro responde como inexistente; recarregar a página volta a "Entrar"; Sair e o voltar do navegador não exibem conteúdo do acervo; depois de Entrar, nenhum cookie, nada em `localStorage` ou `sessionStorage` e nem o Nome de usuário nem a Senha na URL ou na saída registrada pelos processos; uma segunda aba entra com o outro Usuário e Sair numa aba não descarta a Credencial da outra | As provas passam com API e frontend reais, sem valor reutilizável e sem Credencial no navegador |

</details>

---

## Dependências e Ordem

```
007/T601 → T701 ─┐
                 ├→ T706
007/T603 → T702 → T703 ─┬→ T704 → T707 → T708 ─┬→ T709 ──┐
                        ├→ T705                ├→ T710 → T712 → T713
                        └→ (T706, já acima)    ├→ T711
                                               └→ T714 [P]

T704, T707, T708 → T715 → T716
```

Execução **serial por padrão**. O paralelismo declarado é T702 com T701, por
tocarem arquivos disjuntos (a migração 5 e a leitura da Credencial no Module), e
T714 com o par T712–T713, por exercerem asserções disjuntas.

**T703 e T705 são integradas no mesmo commit**: a exigência de Credencial
derrubaria toda a suíte de contrato existente até a suíte apresentá-la. **T708,
T711 e T715 também são integradas**: a troca da primeira tela derruba a suíte de
frontend e a suíte e2e até as duas serem adaptadas.

**T701 e T706 não são paralelas**: o escopo por dono precisa da coluna
`usuario_id`. **T702 e T703 não são paralelas**: o hook é uma casca fina sobre a
verificação no Module. **T703 e T706 não são paralelas**: o dono chega à rota
pelo `usuarioId` decorado pelo hook. **T708 e T709 não são paralelas**: Sair e a
navegação principal vivem na tela criada em T708. **T710 e T712 não são
paralelas**: a prova de teclado exige a recusa com o foco já movido, entregue em
T710. **T715 e T716 não são paralelas**: as provas novas usam os auxiliares de
Cadastro e de Credencial do harness.

## Matriz de Rastreabilidade Requisito ↔ Tarefa

| Requisito | Tarefa |
|---|---|
| FR-042 | T714 |
| FR-044 | T706, T710 |
| FR-045 | T707, T710 |
| FR-046 | T703, T704, T708 |
| FR-078 | T702, T703, T704, T710, T716 |
| FR-079 | T703, T704, T708, T716 |
| FR-086 | T702, T704, T707 |
| FR-087 | T702 |
| FR-088 | T702, T703 |
| FR-089 | T707, T709, T716 |
| FR-090 | T703, T705, T706, T707, T711, T715 |
| FR-091 | T707, T710 |
| FR-092 | T706, T716 |
| FR-093 | T706 |
| FR-094 | T709, T716 |
| FR-095 | T708, T712 |
| FR-096 | T713 |
| FR-097 | T708, T711, T715 |
| FR-098 | T708, T709 |
| FR-099 | T701 |

| Critério | Tarefa |
|---|---|
| SC-027 | T708, T711, T715 |
| SC-028 | T703, T705, T706, T715 |
| SC-029 | T702 |
| SC-030 | T706, T716 |
| SC-031 | T709, T716 |
| SC-032 | T712 |
| SC-033 | T704, T716 |
| SC-034 | T709, T716 |
| SC-035 | T707, T710 |
| SC-036 | T702 |
| SC-037 | T701 |

## Notas

- Nenhuma tarefa exige decisão de produto ou de arquitetura do worker.
  Ambiguidade encontrada é reportada, não resolvida.
- Nenhuma tarefa cria Module ou Seam novo: a verificação da Credencial entra no
  `Identidade` da `007`, a Seam `ClienteDoAcervo` ganha um verbo e um modo de erro
  nos dois Adapters já existentes, e o hook do servidor é Implementation, não
  Seam.
- **Integração obrigatória, para `main` nunca ficar com a suíte vermelha**,
  em dois blocos:
  - **Bloco do servidor: T701, T703, T705 e T706 no mesmo commit.** T701 torna o
    dono obrigatório, e o `Acervo` atual deixa de conseguir gravar até T706. T703
    faz a API exigir a Credencial, e a suíte de contrato de `001` a `006` cai até
    T705 apresentá-la. T702 e T704 podem entrar antes ou junto.
  - **Bloco do cliente: T707, T708, T711 e T715 no mesmo commit.** T707 muda a
    construção do `ClienteHttp`; T708 torna "Entrar" a primeira tela; as suítes
    de frontend e e2e caem até T711 e T715 as adaptarem.
- **T701 é a tarefa de maior risco**: toca base instalada, e o descarte do acervo
  sem dono é decisão assumida pelo Product Owner. A prova é o teste de migração a
  partir de uma base na versão 4, com Usuários dentro.
- **T702 é a tarefa mais fácil de declarar concluída sem evidência real**: exige
  medir as duas recusas repetidas vezes e exigir ordens de grandeza comparáveis,
  sem afirmar igualdade de relógio.
- **T706 é a verificação negativa da feature**: a prova é a recusa idêntica à de
  um id que nunca existiu, e não inspeção de estado interno. Nunca 403.
- Nenhuma tarefa introduz dependência nova, nem qualquer estado reutilizável
  entre requisições no servidor ou no navegador.
- Nenhum valor de segredo, de Senha ou de derivação aparece em arquivo
  versionado, em teste ou nesta lista de tarefas: todo Segredo e toda Senha são
  gerados a cada execução.
