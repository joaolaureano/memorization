# Research: Idioma da Interface

**Feature**: `027-idioma-da-interface` | **Data**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

Registro append-only das decisões de planejamento (Princípio II). O levantamento do código foi feito pelo Arquiteto, direto no repositório.

## R0 — Skills aplicadas

- **domain-modeling**: aplicada no `specify`, no `clarify` e aqui. Fixou os termos Idioma da interface, Seletor de idioma, Texto do produto e Conteúdo do Usuário em Key Entities. O Idioma da interface pertence ao navegador e não ao Usuário, por isso não é uma das Preferências (`015`). Os cenários-limite resolvidos foram "Baralho temporário" e "Revisão do dia" (rótulos derivados da origem, e não nomes) e uma Tag cujo texto coincide com um rótulo. CONTEXT.md e ADR são inaplicáveis pela constituição.
- **codebase-design**: aplicada em R2, R3 e R4. Decidiu um Module profundo `idioma` sem Seam nova: o armazenamento no navegador tem uma Implementation única, então uma Seam ali seria hipotética. A Seam `ClienteDoAcervo`, que já existe, passa a devolver códigos de recusa em vez de texto. A estratégia de testes atravessa as Interfaces existentes. DESIGN-IT-TWICE é inaplicável.

## R1 — Fatos do código que restringem o desenho

| Fato | Onde | Consequência |
|---|---|---|
| ~600 literais de texto em português espalhados em 36 arquivos de UI, sem camada de texto | `frontend/src/ui/*.tsx`, `acervo-cliente/validacao.ts` | A extração para um catálogo é o grosso do trabalho e se divide por tela. |
| `ClienteDoAcervo` devolve `mensagem: string` em português nas recusas, e a UI mostra esse texto | `frontend/src/acervo-cliente/cliente.ts` (`MENSAGEM_DE_*`), `cliente-http.ts` (19 usos de `corpo.mensagem`) | Um texto já resolvido não pode mudar de idioma depois (FR-015). O resultado passa a levar o código, e a UI traduz na hora de mostrar. |
| O backend responde `{ erro, mensagem, motivo? }`. Há cerca de 30 códigos estáveis em `erro` e cerca de 58 mensagens em português | `backend/src/http/rotas.ts:72`, `credencial.ts`, `acervo/invariantes.ts`, `identidade/invariantes.ts` | O código já identifica a recusa (FR-019). Só falta traduzir `mensagem` para o inglês (FR-018). |
| O importador Anki usa `throw new Error("…")` em português, e esse texto chega à pessoa | `backend/src/importacao/anki.ts` | Esses erros ganham códigos próprios e mensagem técnica em inglês. |
| O registro de Sessão grava `nomeDoBaralho` = `"Revisão do dia"` ou `"Baralho temporário"` conforme a origem, ignorando o nome que o cliente envia | `backend/src/acervo/acervo.ts:853`, `:978` | O nome digitado de uma Sessão temporária nunca foi gravado. Isso resolve a `premissa a validar` da spec: não há nome digitado a preservar, e a falta de nome se reconhece pela `origem`. |
| Formatação de datas e números fixa em `"pt-BR"` | `EstatisticasDoEstudo.tsx:428`, `PaginaDoRegistro.tsx:181`, `PaginaDeEstudo.tsx:1377` | Passa a usar o locale do Idioma da interface. O `en-CA` e o `en-US` de `agenda/datas.ts` calculam datas e não apresentam nada, então ficam como estão. |
| Não há `<input type="date">` | `frontend/src/ui` | O caso-limite "datas em campos de entrada" não tem campo nativo afetado. |
| `<html lang="pt-BR">` fixo e `<title>Memorization</title>` | `frontend/index.html` | O `lang` passa a ser dinâmico (FR-009). O título é o nome do produto, que não se traduz. |
| Cabeçalho em todas as telas: `Moldura` com Credencial e um cabeçalho só com a marca sem Credencial | `frontend/src/ui/Aplicacao.tsx:607` | O Seletor entra nos dois cabeçalhos, incluindo a Sessão de estudo (resolve o item Outstanding do clarify). |
| jsdom e Playwright usam `en-US` por padrão | `frontend/vitest.setup.ts`, `e2e/playwright.config.ts` | Com a detecção pelo navegador (FR-012), toda prova existente abriria em inglês. As duas configurações passam a fixar `pt-BR`. |
| Frontend sem dependência além de React | `frontend/package.json` | Ver R2. |

## R2 — Mecanismo de textos: catálogo próprio tipado, sem biblioteca

**Decisão**: Module `frontend/src/idioma/` com três catálogos (`pt.ts`, `en.ts`, `es.ts`). `pt.ts` é a forma de referência, e `en` e `es` são tipados como `Catalogo = typeof pt` (com as funções). Entradas que dependem de valor (plural, limite, nome) são funções que usam `Intl.PluralRules` e `Intl.NumberFormat` do idioma. Datas e números passam por `Intl.DateTimeFormat` e `Intl.NumberFormat` com o locale do idioma (`pt-BR`, `en-US`, `es-419`).

**Por quê**: o `tsc` do `build` falha se faltar uma chave em qualquer idioma, o que dá FR-014 de graça. Uma prova Vitest complementa, recusando string vazia. Com três idiomas e plural simples, `Intl` cobre tudo. Não há dependência nova nem formato ICU para aprender (Princípio VII).

**FR-013 (lacuna → Português)**: pelo tipo, não pode existir chave ausente. A única lacuna possível é a string vazia, que a prova de catálogo recusa. O fallback de execução fica restrito a isto: se o texto resolvido for vazio, usa-se o `pt`. É uma linha de código, coberta por prova.

**Alternativas rejeitadas**: `react-i18next`/`i18next`, porque traz dependência e chaves em string sem verificação de tipo, e faltas só aparecem em execução. `FormatJS`/`react-intl`, porque ICU é desproporcional para três idiomas. JSON por idioma, porque perde a verificação de completude pelo compilador.

## R3 — Interface do Module `idioma`

**Decisão**:

- `type Idioma = "pt" | "en" | "es"`.
- `<ProvedorDeIdioma>` envolve a `Aplicacao` e é dono do estado. Lê a escolha inicial (R5), atualiza `document.documentElement.lang` e grava a escolha.
- `useIdioma(): { idioma, textos: Catalogo, escolher(idioma), formatarData(d, estilo), formatarNumero(n) }`.
- `<SeletorDeIdioma>`: um botão com o globo e a sigla que abre uma lista de três opções. Usa o padrão *menu button* (WAI-ARIA), tem teclado completo e devolve o foco ao botão (FR-010). A troca é anunciada por uma região `aria-live` com o texto do novo idioma (FR-009).

**Por quê**: o componente chama um hook e lê um objeto tipado. O resto fica escondido: detecção, persistência, `lang`, `Intl` e fallback. Como a troca é estado React, a tela re-renderiza sem recarregar, e campos, Sessão e filtros, que vivem em outro estado, ficam intactos (FR-004).

**Sem Seam nova**: o `localStorage` tem uma Implementation única. As provas usam o `localStorage` do jsdom e um `navigator.languages` controlado no setup, então não há Adapter de teste a justificar (Princípio IV).

## R4 — Recusas: códigos na Seam, texto na UI

**Decisão**:

1. **Backend**: toda `mensagem` de resposta, `Error` lançado e registro de operação passa a ser em inglês. As mensagens de resposta se concentram em `backend/src/http/recusas.ts` (`MENSAGENS_TECNICAS: Record<CodigoDeRecusa, string>`), e os módulos de domínio passam a devolver só `erro` e `motivo`. O importador Anki ganha os códigos `anki_grande_demais`, `anki_ilegivel`, `anki_corrompido` e `anki_incompativel`. O contrato HTTP mantém `erro` e `motivo` (com `limite` quando a mensagem para a pessoa precisa do número) e muda apenas o idioma de `mensagem`. Ver [contracts/http.md](./contracts/http.md).
2. **Frontend, Seam `ClienteDoAcervo`**: os resultados de recusa trocam `mensagem: string` por `recusa: Recusa` (`{ codigo: CodigoDeRecusa; motivo?: string; limite?: number }`). As constantes `MENSAGEM_DE_*` saem do cliente. Os dois Adapters (`ClienteHttp` e `ClienteEmMemoria`) devolvem a mesma `Recusa`, e um código desconhecido vindo do servidor vira `indisponivel`.
3. **UI**: o estado da tela guarda a `Recusa`, nunca o texto. A renderização usa `textos.recusas[codigo](recusa)`. Com isso, um aviso visível muda de idioma junto com a tela (FR-015), e uma resposta que chega depois da troca aparece no idioma vigente (FR-016). A mensagem técnica nunca é mostrada (FR-019).
4. As validações locais (`acervo-cliente/validacao.ts`) passam a devolver o mesmo `Recusa`/código, e não texto.

**Por quê**: um texto resolvido fora da renderização congela o idioma. Os códigos já existem no backend (R1). Com o texto saindo da Seam, a Interface do cliente fica mais estreita, e a Implementation de tradução fica num só lugar (Locality).

**Alternativas rejeitadas**: o servidor traduzir pelo `Accept-Language`, porque contraria o clarify ("mensagem técnica é em inglês") e congelaria o idioma no momento da resposta. O cliente traduzir dentro dos Adapters, porque o texto continuaria congelado no estado da tela.

## R5 — Idioma inicial e persistência

**Decisão**: a chave `memorization.idioma` em `localStorage`, com valores `pt`, `en` ou `es`. Leitura e escrita ficam em `try/catch`, e um valor inválido conta como ausente. Sem escolha válida, vale o primeiro item de `navigator.languages` (ou `navigator.language`) cujo prefixo antes de `-` seja `pt`, `en` ou `es`. Se nenhum servir, `pt` (FR-012). Abas diferentes não se sincronizam: a escolha vale para a aba e para a próxima abertura (caso-limite da spec), então não há listener de `storage`.

**Por quê**: segue o clarify (só no navegador). Funciona antes de Entrar e não toca na conta nem no backend (FR-011).

## R6 — Rótulos derivados da origem da Sessão (FR-020, FR-021)

**Decisão**:

- **Backend**: `interpretarRegistro` passa a gravar `nomeDoBaralho = ""` para as origens `revisao` e `temporario` (hoje grava os rótulos em português). A migração 19, em paridade SQLite/PostgreSQL, faz `UPDATE … SET nome_do_baralho = '' WHERE origem IN ('revisao','temporario')`.
- **Frontend**: um único ponto, `rotuloDoBaralhoDoRegistro(registro, textos)`, devolve `textos.sessao.revisaoDoDia` ou `textos.sessao.baralhoTemporario` pela `origem` e devolve `nomeDoBaralho` nos demais casos. Histórico, Resumo, Registro e Sessão usam esse ponto. Na Sessão temporária, `PaginaDeEstudo.tsx:311` deixa de fixar `"baralho temporário"`.
- **Salvar seleção como Baralho**: o formulário vem preenchido com o rótulo no idioma vigente. O que estiver no campo ao salvar é Conteúdo do Usuário.

**Por quê**: a `origem` já distingue esses registros (R1), e nenhum nome digitado se perde. A migração remove texto do produto guardado como dado, como pede o FR-020.

**Alternativa rejeitada**: só a UI ignorar `nomeDoBaralho` nessas origens, sem migrar. Deixaria texto do produto gravado, contra o FR-020, e um terceiro cliente veria o rótulo em português.

## R7 — Provas existentes continuam em Português

**Decisão**: `frontend/vitest.setup.ts` fixa `navigator.languages = ["pt-BR"]` e limpa `memorization.idioma` em `beforeEach`. `e2e/playwright.config.ts` ganha `locale: 'pt-BR'` em `use`. As provas da feature sobrescrevem isso localmente (`test.use({ locale: 'en-US' })`, por exemplo).

**Por quê**: sem isso, a detecção do FR-012 mudaria o idioma de mais de 40 suítes, que verificam textos em português. Fixar o locale de teste é determinístico e não afrouxa nenhuma prova.

## R8 — Verificação de completude e de layout

- **Catálogos**: o `tsc` (`npm run build` e `verificar:ci`) recusa chave faltante. A prova `idioma/catalogos.test.ts` percorre os três catálogos e recusa valor vazio e chaves extras (SC-002, FR-014).
- **Texto do produto fora do catálogo**: a prova `idioma/sem-texto-solto.test.ts` lê os `.tsx` de `src/ui` e recusa nós de texto JSX e atributos `aria-label`/`placeholder`/`title`/`alt` literais com letras. Há uma lista de exceções explícita para a marca "memorization". É heurística, mas impede que um texto novo em português escape do catálogo (SC-001).
- **Mensagens técnicas**: a prova backend `http/recusas.test.ts` exige ASCII e ausência de palavras em português nos valores de `MENSAGENS_TECNICAS` e cobre cada código. O `grep` de revisão em `throw new Error(`/`console.` faz parte do checklist de diff (SC-008).
- **Layout**: o e2e `idioma-da-interface.spec.ts` percorre as telas principais em `en` e `es` a 360 px e 1280 px. Ele verifica `scrollWidth <= clientWidth` no documento e nos controles da Moldura, seguindo o padrão dos specs `*-responsividade` (SC-007).

## R9 — Variantes e traduções

`pt-BR`, `en-US` e `es-419` (espanhol latino-americano neutro). As traduções são escritas na implementação e revisadas pelo Arquiteto. A terminologia de domínio traduzida (Cartão → Card/Tarjeta, Baralho → Deck/Mazo, Sessão → Session/Sesión, Revisão do dia → Today's review/Repaso del día, Errei/Difícil/Bom/Fácil → Again/Hard/Good/Easy e Otra vez/Difícil/Bien/Fácil) fica em um glossário no topo de `en.ts` e `es.ts`, e cada termo é traduzido sempre do mesmo jeito. SM-2 não se traduz.

## R10 — Correções após o `analyze` (2026-10-13)

Registro append-only. Corrige afirmações das seções anteriores, que ficam como estavam.

- **R1, `agenda/datas.ts`**: a afirmação de que `frontend/src/agenda/datas.ts` "calcula e não apresenta" estava errada. O arquivo tem listas fixas em português (`NOMES_DOS_DIAS`, `NOMES_DOS_MESES`, `ABREVIACOES_DOS_MESES`) e monta textos para a tela: `nomeDoDia`, `descreverDias` ("segunda e quinta"), `dataCurta` ("3 out") e `dataPorExtenso` ("segunda, 5 de outubro de 2026"). **Decisão**: a aritmética de datas e o fuso ficam como estão. As quatro funções de formatação recebem `locale` e usam `Intl.DateTimeFormat` e `Intl.ListFormat`. Em `pt`, a saída continua byte a byte a de hoje.
- **R1, texto fora de `ui/`**: há Texto do produto também em `sessao-de-estudo/sessao-de-estudo.ts` (`MENSAGEM_DE_*`), `agenda/estado-do-dia.ts` (`textoDaContagem`, `rotuloDoEstadoDoDia`), `estatisticas/estatisticas.ts` (`ROTULOS_DA_SEMANA`, `ROTULO_DE_HOJE`), `acervo-cliente/busca-no-acervo.ts` (`rotuloDaSituacaoDoBaralho`), `acervo-cliente/tipos-de-cartao.ts` (`MENSAGEM_DE_*_IMAGEM`, texto alternativo "Imagem do Cartão") e `acervo-cliente/agenda-em-memoria.ts`. **Decisão**: esses módulos passam a devolver códigos ou dados, e a UI traduz pelo catálogo, como em R4. `sessao-de-estudo/aleatoriedade.ts` lança um erro técnico, que passa ao inglês (FR-018). A varredura de R8 (`sem-texto-solto`) passa a cobrir `frontend/src/**/*.{ts,tsx}`, exceto `src/idioma/`.
- **R5, idioma inicial**: a regra "primeiro item de `navigator.languages` com prefixo suportado" contrariava a spec (FR-012: idioma **preferido**). Decisão do Product Owner no analyze: vale só o primeiro item de `navigator.languages` (ou `navigator.language`). Se o prefixo dele for `pt`, `en` ou `es`, usa-se esse idioma; caso contrário, `pt`. Exemplo: `["fr-FR", "es-AR"]` → `pt`.
- **R1, título da aba**: o título é só o nome do produto e não muda com o idioma. A spec foi alinhada (FR-005, US4-AS6).
- **Divergência anterior, fora do escopo**: a `023` diz que o nome digitado do Baralho temporário identifica a Sessão e o Histórico, mas o servidor o descarta desde a `023` (FR-369). A 027 não muda esse comportamento. Fica registrado como pendência da `023`, a decidir pelo Product Owner (Princípio I).

## R11 — Migração 19 e a transição de Pertencimento (implement, 2026-10-13)

Registro append-only.

- **Fato**: as migrações 14, 16 e 18 têm a mesma precondição (`PODE_REMOVER_VINCULO`). O runner pula de propósito a que está bloqueada, porque a 18 (`FINALIZAR_TRANSICAO`) refaz a limpeza depois. A inicialização na nuvem só aceitava a versão anterior quando a **última** migração tinha precondição. Com a 19 sem precondição no fim da lista, o SQLite pularia a 18 para sempre e a nuvem recusaria iniciar numa base parada na 17.
- **Decisão do Product Owner**: "a 19 espera a 18". **Implementação**: a 19 tem a mesma precondição da 18, e os runners não mudam. `versaoAceitaNoInicio` passa a aceitar uma versão menor quando todas as migrações posteriores a ela têm precondição.
- **Compatibilidade**: enquanto a 19 estiver pendente, o CHECK antigo do PostgreSQL recusa `nome_do_baralho` vazio. O INSERT do Adapter grava então o rótulo legado para as origens derivadas, e o `Acervo` normaliza a leitura para `""`, mantendo o contrato. Esse trecho pode ser removido quando todas as bases estiverem na 19.
- **CHECK da 19 (PostgreSQL)**: só as origens `revisao` e `temporario` aceitam nome vazio.
- **Alternativa rejeitada**: fazer o runner parar na primeira precondição não atendida. Isso mudaria o comportamento das migrações 14 e 16, que já foram publicadas.
- **Workers**: o DeepSeek ficou sem saldo, e o Product Owner escolheu workers Haiku. A gravação compatível e as provas da R11 foram escritas pelo Arquiteto, depois de o worker adiar a tarefa duas vezes.

## R12 — Correção: o nome digitado do Baralho temporário é gravado (implement, 2026-10-13)

Registro append-only. Corrige R1 e R6, além da premissa marcada como "validada" na spec.

- **Erro**: R1 e R6 afirmaram que o servidor descartava o nome digitado das Sessões temporárias. A afirmação se apoiava num comentário desatualizado (`acervo.ts`, "ignorando o que o cliente mandar"), e a lógica não foi lida. No HEAD (`interpretarRegistro`), o servidor **grava** o nome digitado e válido (FR-369/FR-363 da 023) e usa "Baralho temporário" só quando a Sessão não tem nome.
- **Consequência do erro, já corrigida**: a primeira implementação descartava o nome digitado, a migração 19 apagava esses nomes de todos os registros temporários (perda de Conteúdo do Usuário) e um worker reescreveu provas de FR-369 e o e2e `baralho-temporario` para refletir isso.
- **Correção**:
  - O servidor volta a gravar o nome digitado e válido; sem nome, grava `""`.
  - A migração 19 limpa só `origem = 'revisao'` e `origem = 'temporario' AND nome_do_baralho = 'Baralho temporário'`.
  - A gravação compatível do PostgreSQL usa o rótulo legado só quando o nome vem vazio.
  - A leitura normaliza para `""` apenas o rótulo legado.
  - `rotuloDoBaralhoDoRegistro` mostra o nome digitado e, na falta dele, o rótulo do catálogo.
  - As provas de FR-369 e o e2e voltaram a ser como no HEAD, e entraram provas de preservação do nome digitado (migração nos dois Adapters e rótulo nos três idiomas).
- **Limite aceito**: quem digitou literalmente "Baralho temporário" como nome perde a distinção, porque o registro é indistinguível do padrão.
- **Pendência da 023**: a divergência apontada no analyze (F1) não existe. O nome digitado sempre foi preservado.

## R13 — Recusas do servidor: etapa A (implement, 2026-10-13)

Registro append-only. Implementa parte de R4.

- **Motivo**: com o backend já em inglês (T042), a interface mostrava a mensagem técnica do servidor ("This username already exists…") a quem usa em Português, e dois e2e tinham sido ajustados a essa regressão.
- **Decisão (etapa A)**: um ponto único no `ClienteHttp.pedir()` (`comRecusaNoIdiomaVigente`). Numa resposta de erro com `{ erro, mensagem }`, ele troca `mensagem` pelo texto do catálogo (`textos.recusa(recusa, contexto)` em `idioma/recusas.ts`), escolhido pelo código, por `motivo`/`limite` e pelo contexto deduzido da rota. O idioma usado é o vigente na chegada da resposta (`textosDoIdiomaVigente()`, publicado pelo `ProvedorDeIdioma`). Em Português o texto é o que o servidor mandava antes, exceto nas recusas por tamanho, que deixam de citar o tamanho informado, porque o servidor não manda mais esse valor.
- **Cobre**: FR-016 e FR-019, além de FR-018 do lado da pessoa. O e2e de cadastro e o de troca de senha voltaram a verificar o texto em Português. A asserção sobre o corpo bruto da API continua em inglês, que é o contrato.
- **Não cobre ainda (etapa B, T044 e T046)**: um aviso já visível não muda de idioma na troca (FR-015), porque o estado das telas ainda guarda texto, e não `Recusa`. A Interface de `ClienteDoAcervo` continua com `mensagem: string`.
- **Alternativa adiada**: trocar `mensagem` por `Recusa` em toda a Seam de uma vez, com cerca de 350 usos e o `cliente.test.ts` inteiro. Fica para a etapa B.
- **Também corrigido**: o título da Sessão temporária voltou a ser "Revisar baralho temporário" (chave `sessao.baralhoTemporarioNoTitulo`), como no HEAD. Duas provas de unidade que um worker tinha alterado para "Revisar Baralho temporário" voltaram ao HEAD.

## R14 — Recusas e avisos: etapa B pela memória de tradução (implement, 2026-10-13)

Registro append-only. Substitui o item 2 e o item 3 da R4.

- **Problema**: a R4 previa trocar `mensagem: string` por `Recusa` em toda a Seam `ClienteDoAcervo` e guardar `Recusa` no estado das telas. Isso tocava cerca de 350 pontos de código e cerca de 290 asserções de prova sobre os textos em Português das constantes `MENSAGEM_DE_*`.
- **Decisão**: a Seam continua devolvendo `mensagem: string`, e o FR-015 se cumpre na apresentação.
  - `idioma/mensagens.ts` reúne as mensagens locais. `MENSAGENS_PT` é a fonte das constantes `MENSAGEM_DE_*` (o mesmo texto de antes), com `en` e `es` tipados pelas mesmas chaves. `MENSAGENS_COM_VALOR` cobre as mensagens com números (limites e tamanhos).
  - `idioma/recusas.ts` gera o texto de toda recusa do servidor pelo código, `motivo`, `limite`, `dias`, `campo` e contexto da rota.
  - `idioma/memoria-de-traducao.ts` reconhece qualquer um desses textos, em qualquer dos três idiomas. Os textos fixos são reconhecidos por índice exato. Os textos com números são reconhecidos por padrões montados com números-sentinela.
  - O componente `TextoDoProduto` (ou o `traduzir` do `useIdioma`) reapresenta esses textos no Idioma da interface vigente. Texto desconhecido, como Conteúdo do Usuário, passa intacto.
  - Todos os pontos que mostram aviso ou recusa usam `TextoDoProduto`, num total de 45.
- **Cobre**: FR-015, porque o aviso visível muda junto com a tela. Cobre também o FR-016, porque a resposta já chega no idioma vigente e, de todo modo, é reapresentada.
- **Limites aceitos**: mensagens dinâmicas com texto livre não entram na memória e ficam no idioma em que foram produzidas. O caso singular "1 Item" do aviso de quantidade não é reconhecido pelo padrão no plural. Nenhum dos dois existe hoje nas recusas mostradas.
- **Níveis de Avaliação e Tipos de cartão**: os rótulos padrão do SM-2 (Errei, Difícil, Bom, Fácil) e os nomes dos tipos vêm do catálogo pela chave (`rotuloDoNivel`, `textos.cartao.nomeDoTipo`). Um rótulo próprio de outro algoritmo aparece como veio (015).
- **Alternativa adiada**: a troca completa da Seam para `Recusa` (R4). Não fica pendência funcional.
- **Workers**: as Haiku entregaram vários relatórios de "concluído" com o trabalho incompleto (texto solto em 25 arquivos, `useContext` dentro de IIFE em `Aplicacao.tsx`, provas reescritas para o comportamento errado). O restante da extração, a prova T011 (varredura de texto solto) e as provas transversais foram feitos pelo Arquiteto.

## R15 — Cabeçalho no telefone com o Seletor de idioma (CI, 2026-10-14)

Registro append-only.

- **Falha na CI** (`ubuntu-latest`): `lista-de-baralhos.spec.ts` a 390 px viu 1 linha inteira na primeira tela, em vez de 2 (SC-079). Com a fonte DejaVu Sans, que é a `system-ui` do runner, a soma marca (186) + Seletor (77) + Sair (78) + espaçamentos passava de 390 px. O Sair descia para uma segunda linha e o cabeçalho crescia de 77 para 133 px. A falha foi reproduzida localmente no container do Playwright com `fonts-dejavu-core`. A imagem padrão não tem DejaVu, por isso a passada anterior no container não a mostrou.
- **Correção no produto, e não na prova**: até 600 px o Seletor fica compacto (`gap 4px`, `padding 10px 8px`, mantendo o alvo de 44 px). Até 420 px a marca usa 18 px. Uma tentativa de reduzir as margens do cabeçalho para 16 px foi desfeita, porque quebrava a `refinamento-ui`.
- **Prova nova**: o e2e de idioma verifica que o cabeçalho cabe numa linha a 390 px em espanhol. O Português é coberto pela lista de Baralhos. Em inglês, "Sign out" (117 px em DejaVu) não cabe sem encolher alvos, e o cabeçalho pode quebrar a linha, o que o FR-017 permite.
- **Verificação**: no container com DejaVu, o commit publicado falha só na lista de Baralhos. A correção passa nas 17 provas de lista, idioma, refinamento e visual.
