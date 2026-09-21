# Tasks: Porta de Persistência

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`

**Depende de**: `001-criar-cartao` a `006-excluir-cartao-e-baralho` **já
implementadas** — cujo acervo passa a persistir pela Porta, sem mudança de
comportamento —, e é base de `007-criar-usuario`, `008-entrar` e
`010-postgresql-na-nuvem`, cujo Adapter de PostgreSQL é o segundo Adapter que
torna a Seam real.

**Executor**: pelo **Princípio XI**, todo código sob `backend/`, `frontend/` e
`e2e/` é criado por subagentes DeepSeek. **Uma única** tarefa é de documentação e
fica com o **Arquiteto**, por não ser código de aplicação: **T814**, que toca
apenas artefatos do Spec Kit sob `specs/`.

## Formato

O estado de cada tarefa é a **caixa de seleção**: `- [ ]` pendente, `- [X]`
concluída. É esse marcador que o comando `implement` lê e atualiza. Os metadados
exigidos pelo processo ficam na tabela recolhida de cada fase.

`[P]` = paralelizável: arquivos disjuntos, sem dependência mútua.

---

## Fase 1 — Porta e Adapter do armazenamento local

- [ ] T801 A Porta `ArmazenamentoDoAcervo` existe no domínio, assíncrona e com desfechos tipados
- [ ] T802 O Adapter local é dono do esquema e das migrações movidas, e um arquivo criado antes desta feature continua abrindo na mesma versão
- [ ] T803 A bateria compartilhada da Porta passa integralmente contra o Adapter local, inclusive entre duas aberturas do mesmo arquivo

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T801 | A Porta existe com as quinze operações, todas devolvendo `Promise`, e os quatro desfechos tipados, sem SQL, sem dialeto, sem conexão, sem caminho de arquivo e sem escolha de armazenamento | FR-044, FR-100, FR-107 | — | `ArmazenamentoDoAcervo` (Seam nova) | `backend/src/armazenamento/porta.ts` | `codebase-design` | `npm run typecheck` verde em modo estrito, com a Interface exercitada pela bateria de T803; nenhum import de `node:sqlite`, de driver de banco ou de diretório de Adapter no arquivo; `Cartao` (`id`, `frente`, `verso`), `Baralho` (`id`, `nome`) e `ContagemPorBaralho` declarados aqui e re-exportados em T804 | A Interface não recebe escolha de armazenamento, não tem texto em português e `indisponivel` é o único caminho pelo qual a falha do armazenamento chega ao chamador |
| T802 | Mover não foi reescrever: o esquema e as migrações passam para o Adapter com conteúdo e números de versão inalterados, e a fábrica do Adapter abre o arquivo, aplica as migrações pendentes e devolve a Porta e o encerramento | FR-103, FR-104 | T801 | `ArmazenamentoDoAcervo` · Adapter do armazenamento local | `backend/src/armazenamento/sqlite/`, `backend/tests/acervo/` | `codebase-design` | Um arquivo criado antes desta feature, com Cartões, Baralhos, Vínculos e a versão registrada, continua abrindo na mesma versão, com os mesmos dados e sem reaplicar migração; as suítes de migração existentes, adaptadas ao caminho novo do Adapter, continuam provando a ordem das versões, a não reaplicação, a falha sem estado parcial e a adoção do arquivo legado; um arquivo local inexistente é criado com o esquema aplicado | Nenhuma linha de conteúdo das migrações mudou, a versão registrada de uma base instalada é a mesma e um arquivo local existente continua servindo |
| T803 | A bateria registra os cenários da Porta parametrizados por uma fábrica de Adapter, e a suíte do Adapter local a chama exigindo cem por cento de aprovação | FR-104, FR-106, FR-107 · SC-039 | T802 | `ArmazenamentoDoAcervo` · bateria compartilhada | `backend/tests/armazenamento/` | `codebase-design` | Cenários de inserir, listar, obter, atualizar e excluir Cartão e de Baralho, vincular e desvincular — inclusive o par repetido (`vinculo_duplicado`) e o Vínculo entre extremidades inexistentes (`nao_encontrado`) —, as contagens da elegibilidade derivada e os desfechos tipados; nenhum cenário nomeia SQLite, arquivo, tabela ou dialeto; duas aberturas do mesmo arquivo devolvem o mesmo conteúdo | A bateria inteira passa contra o Adapter local, sem nenhum cenário específico de armazenamento, e a persistência entre duas aberturas do mesmo arquivo está comprovada |

</details>

---

## Fase 2 — Modules sobre a Porta

- [ ] T804 `criarAcervo(armazenamento)` monta o `Acervo` sobre a Porta, com os verbos assíncronos e nenhuma regra alterada
- [ ] T805 As rotas aguardam o `Acervo` e o contrato HTTP não muda, com a falha do armazenamento respondida sem detalhe do driver
- [ ] T806 Toda a suíte existente de `001` a `006` do backend passa com o mesmo significado, sem asserção enfraquecida
- [ ] T807 [P] Nenhum Module importa armazenamento concreto, comprovado pela leitura dos seus imports

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T804 | `criarAcervo` recebe a Porta e todo verbo devolve `Promise`, com as mesmas invariantes, os mesmos modos de erro estáveis e as mesmas mensagens em português; `Cartao` e `Baralho` são re-exportados, e as formas derivadas — Baralho com contagem e elegibilidade — continuam sendo do Module | FR-100, FR-105 | T801, T802 | `Acervo` · `criarAcervo(armazenamento)` | `backend/src/acervo/`, `backend/tests/acervo/` | `codebase-design` | As suítes do `Acervo` adaptadas mecanicamente — Adapter local em memória no lugar do banco aberto à mão e `await` em cada chamada —, com as asserções intactas: mesmas recusas com os mesmos códigos e as mesmas mensagens em português, a Frente que não é identificador, o nome de Baralho que é rótulo, o par (Cartão, Baralho) único e a elegibilidade derivada por contagem; o desfecho `indisponivel` da Porta chega como recusa reportada, e a operação não aparece como concluída; nenhum arquivo do Module importa driver, Adapter ou SQL | Nenhuma regra de domínio, recusa ou mensagem mudou, nenhuma operação do Module conhece armazenamento concreto e nenhuma operação recebe escolha de armazenamento |
| T805 | As rotas aguardam o resultado do `Acervo` e o contrato HTTP permanece exatamente o de antes — 201, 200, 204, 400, 404 e 409 —, com a falha do armazenamento respondida como indisponibilidade | FR-044, FR-045, FR-105, FR-107 | T804 | Adapter HTTP sobre `Acervo` | `backend/src/http/`, `backend/tests/http/` | `codebase-design` | As suítes de contrato, adaptadas com `await`, exigem os mesmos códigos, os mesmos corpos e as mesmas mensagens de `001` a `006`; com a Porta devolvendo `indisponivel`, a resposta não é de sucesso, traz o código estável e a mensagem em português e nenhum trecho do driver, caminho de arquivo, URL, senha ou cadeia de conexão; nenhuma rota nova é registrada e a mesma requisição pode ser repetida sem nada ser apresentado como concluído | Nenhum comportamento observável de `001` a `006` mudou e nenhuma falha de armazenamento aparece como operação concluída |
| T806 | A suíte existente de `001` a `006` do backend — domínio, migrações, contrato HTTP, servidor e escuta — passa integralmente, com o mesmo número de casos e o mesmo significado | FR-105 · SC-038 | T804, T805 | `Acervo`, Adapter HTTP | `backend/tests/` | — | `npm test` verde com toda a suíte adaptada (Adapter local em memória e `await` em cada chamada); nenhum caso removido, ignorado ou marcado como pendente, e nenhuma asserção enfraquecida ou reescrita para acomodar a mudança; as suítes que não dependem do banco aberto à mão continuam passando sem edição | Cem por cento da suíte passa, e a diferença para o repositório anterior é mecânica, nunca de significado |
| T807 | Um teste lê os fontes dos Modules e exige que nenhum importe `node:sqlite`, um driver de PostgreSQL ou um diretório de Adapter, sendo o arquivo da Porta o único import de armazenamento permitido | FR-100 · SC-043 | T804 | `ArmazenamentoDoAcervo` (verificação negativa) | `backend/tests/armazenamento/`, `backend/src/acervo/`, `backend/src/http/` | — | A varredura cobre `backend/src/acervo/` e `backend/src/http/` e, quando existir, `backend/src/identidade/`: nenhum import de `node:sqlite`, de driver de banco ou de `backend/src/armazenamento/<adapter>`, e o único import permitido de `backend/src/armazenamento/` é `porta.ts`; o teste é exercitado contra um Module com import de driver e falha, provando que não é vácuo | Nenhuma dependência de armazenamento concreto é encontrada em nenhum Module, e acrescentar um segundo Adapter não exigiria alterar nenhum deles |

</details>

---

## Fase 3 — Construção e scripts

- [ ] T808 A raiz de composição local é o único lugar que importa o Adapter e informa o armazenamento em uso numa linha
- [ ] T809 `scripts/construir.mjs` valida `--banco=<valor>` e empacota `dist/<banco>/servidor.mjs`, sem escrever nada na recusa
- [ ] T810 O backend oferece `typecheck`, `build`, `build:local`, `start:local` e `dev`
- [ ] T811 As recusas da construção, o conteúdo do pacote e a linha de início são comprovados por execução do script

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T808 | A raiz de composição local compõe o Adapter, o `Acervo` e o servidor, lê `CAMINHO_DO_BANCO` com o padrão de hoje, imprime uma única linha informando o armazenamento em uso antes de escutar, e o antigo ponto de entrada deixa de existir | FR-044, FR-100, FR-103, FR-108, FR-109 · SC-042 | T804, T805 | Raiz de composição (não é Module) | `backend/src/entradas/local.ts`, `backend/src/index.ts` | `codebase-design` | Só a entrada importa o Adapter; a linha de início traz o tipo de armazenamento e nada além dele; o caminho informado por `CAMINHO_DO_BANCO` é o arquivo usado, e sem a variável vale o caminho padrão `memorizacao.sqlite`; nenhuma variável de ambiente escolhe armazenamento; com o arquivo em diretório somente leitura o início falha reportado e o processo não escuta | Nenhum Module importa Adapter, a escolha do armazenamento acontece uma única vez no início do processo e a linha de início não traz caminho, URL nem segredo |
| T809 | O script de construção recebe exatamente `--banco=<valor>`, confere o valor na tabela de entradas de Adapter do próprio script e empacota a entrada escolhida num único arquivo; valor ausente, em forma diferente, desconhecido ou de um armazenamento ainda não entregue é recusado com a lista dos valores aceitos, sem repetir o valor informado e sem escrever nada em `dist/` | FR-101, FR-102, FR-120 · SC-040 | T802, T808 | Construção por armazenamento | `backend/scripts/construir.mjs`, `backend/package.json` | `codebase-design` | Tabela de entradas hoje com `sqlite` apontando para `src/entradas/local.ts`; a mensagem lista apenas `sqlite` e é a mesma frase nos quatro casos de recusa, com código de saída 1 e `dist/` inexistente, inclusive para um valor que nomeia o armazenamento de outra feature; `--banco=sqlite` produz um único arquivo ESM, plataforma `node`, alvo `node24` e módulos embutidos do Node externos; `esbuild` entra como devDependency do backend | Há um pacote por armazenamento, derivado da única entrada escolhida, e nenhuma recusa produz artefato algum |
| T810 | Os scripts do backend passam a ser `typecheck` (verificação de tipos), `build` (construção com parâmetro), `build:local`, `start:local` e `dev`, e um único comando sobe a aplicação local a partir de uma cópia limpa | FR-101, FR-109 · SC-041 | T808, T809 | Scripts do backend | `backend/package.json` | — | `npm run typecheck` verde; `npm run build` sem parâmetro recusa com código 1; `npm run build:local` produz `dist/sqlite/servidor.mjs` e `npm run start:local` inicia esse pacote; em cópia limpa do repositório, `npm install` e em seguida `npm run dev` sobem a aplicação com o arquivo no caminho padrão, sem nenhuma configuração prévia | Os cinco scripts existem, `build` não é mais verificação de tipos e o único comando de início local funciona sem configuração |
| T811 | A suíte da construção comprova, executando o script, as três recusas sem artefato, a ausência do Adapter do outro armazenamento no pacote e a linha de início sem caminho, URL ou segredo | FR-102, FR-108, FR-120 · SC-040, SC-042 | T809, T810 | Construção por armazenamento (verificação negativa) | `backend/tests/armazenamento/` | — | Construir sem parâmetro, com valor não aceito e com um valor de aparência de credencial: código de saída 1, mensagem em português que nomeia apenas os valores aceitos, o valor informado ausente da saída capturada e nenhum arquivo em `dist/`; a construção local produz o pacote sem o Adapter do outro armazenamento e sem o driver dele, e a única menção a SQLite é o módulo embutido do Node, externo ao pacote; a primeira linha do início nomeia o tipo de armazenamento sem caminho de arquivo, URL, senha ou cadeia de conexão | As três recusas, o conteúdo do pacote e a linha de início são comprovados por execução do script, e nenhum valor de aparência sensível aparece na saída |

</details>

---

## Fase 4 — Validação e documentação

- [ ] T812 O harness e2e sobe a API real pela raiz de composição local e toda a suíte e2e continua verde
- [ ] T813 [P] Com o arquivo local indisponível, o início falha reportado e nenhuma operação aparece como concluída
- [ ] T814 [P] Quickstarts de `001` a `008` e planos que citam a verificação de tipos declaram os portões novos, e `007` e `008` registram que são construídas sobre a Porta assíncrona da `009`

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T812 | O harness e2e inicia a API real pela raiz de composição local — pelo `dev` ou pelo pacote local — e toda a suíte e2e de `001` a `008` continua verde, com as mesmas asserções | FR-105, FR-109 · SC-038, SC-041 | T806, T808, T810 | Raiz de composição local | `e2e/` | — | O harness aponta para o caminho novo, mantém o arquivo local temporário exclusivo por prova e continua lendo a versão do esquema pelo arquivo; as provas que reiniciam a API sobre o mesmo arquivo continuam passando e comprovam que todo o conteúdo criado permanece e está correto; nenhuma prova é removida, ignorada ou enfraquecida, e nenhuma tela, campo ou ação nova aparece | `npm run test:e2e` verde, com a API real subida pelo caminho novo e a persistência entre reinícios comprovada |
| T813 | Com o arquivo local indisponível, o início falha com a falha reportada, a aplicação não segue como se o armazenamento existisse e nenhuma operação é apresentada como concluída | FR-044, FR-045, FR-108 · SC-042 | T808, T811 | Adapter do armazenamento local, `Acervo`, Adapter HTTP | `backend/tests/` | — | Início apontando o arquivo local para diretório somente leitura: a falha é reportada sem caminho, URL, senha ou cadeia de conexão na mensagem, e o processo não escuta; com o armazenamento indisponível, a operação do `Acervo` devolve falha, nada é apresentado como concluído e a mesma requisição pode ser repetida com o mesmo conteúdo informado; a resposta de falha não traz texto do driver | Nenhuma falha de armazenamento é confundida com sucesso, e nada de sensível aparece na saída nem na resposta |
| T814 | Os quickstarts e os planos de `001` a `008` que tratam a antiga verificação de tipos como `npm run build` passam a declarar os portões `npm run typecheck` e `npm run build:local`, e os planos de `007` e `008` registram que são **construídas sobre a Porta assíncrona da 009** | — | T810 | Artefatos do Spec Kit (**Executor: Arquiteto**, não subagente DeepSeek) | `specs/001-criar-cartao/quickstart.md`, `specs/001-criar-cartao/plan.md`, `specs/002-criar-baralho/quickstart.md`, `specs/002-criar-baralho/plan.md`, `specs/003-vincular-cartao-baralho/quickstart.md`, `specs/003-vincular-cartao-baralho/plan.md`, `specs/007-criar-usuario/quickstart.md`, `specs/007-criar-usuario/plan.md`, `specs/008-entrar/quickstart.md`, `specs/008-entrar/plan.md` | — | Nenhum comando de verificação de tipos é chamado `build` nos arquivos citados, e as linhas de comandos declaram `typecheck` e `build:local`; os planos de `007` e `008` ganham a nota da Porta, sem reabrir requisito, decisão ou desenho de nenhuma das duas; nenhum arquivo de outra feature é alterado | Os comandos dos portões de qualidade estão corretos em toda a documentação que os cita, e `007` e `008` declaram a dependência da Porta |

</details>

---

## Dependências e Ordem

```
T801 → T802 ─┬→ T803
             └→ T804 → T805 → T806
T804 → T807 [P com T805]
T804, T805 → T808 → T809 → T810 → T811 → T813 [P com T812]
T806, T808, T810 → T812
T810 → T814 [P]
```

Execução **serial por padrão**. O paralelismo declarado é T807 com T805, por
exercerem asserções disjuntas (a leitura dos imports dos Modules e as respostas
das rotas), T813 com T812, por tocarem arquivos disjuntos (`backend/tests/` e
`e2e/`), e T814 com qualquer tarefa, por não tocar código de aplicação.

**T801 e T802 não são paralelas**: o Adapter implementa a Interface declarada em
T801. **T802 e T803 não são paralelas**: a bateria precisa da fábrica de Adapter.
**T802 e T804 não são paralelas**: tirar o esquema de dentro de `src/acervo/`
derruba o `Acervo` até ele receber a Porta. **T804 e T805 não são paralelas**: o
contrato HTTP é provado sobre o `Acervo` já montado sobre a Porta. **T804 e T807
não são paralelas**: a varredura só fica verde depois de o Module deixar de
importar o esquema movido. **T808 e T812 não são paralelas**: T808 remove o
arquivo que o harness e2e inicia. **T809 e T810 não são paralelas**: T810 aponta
`build` para o script de T809. **T810 e T811 não são paralelas**: T811 executa os
scripts criados em T810. **T811 e T813 não são paralelas**: a prova de
indisponibilidade usa a construção e o início já estáveis.

## Matriz de Rastreabilidade Requisito ↔ Tarefa

| Requisito | Tarefa |
|---|---|
| FR-044 | T801, T805, T808, T813 |
| FR-045 | T805, T813 |
| FR-100 | T801, T804, T807, T808 |
| FR-101 | T809, T810 |
| FR-102 | T809, T811 |
| FR-103 | T802, T808 |
| FR-104 | T802, T803 |
| FR-105 | T804, T805, T806, T812 |
| FR-106 | T803 |
| FR-107 | T801, T803, T805 |
| FR-108 | T808, T811, T813 |
| FR-109 | T808, T810, T812 |
| FR-120 | T809, T811 |

| Critério | Tarefa |
|---|---|
| SC-038 | T806, T812 |
| SC-039 | T803 |
| SC-040 | T809, T811 |
| SC-041 | T810, T812 |
| SC-042 | T808, T811, T813 |
| SC-043 | T807 |

## Notas

- Nenhuma tarefa exige decisão de produto ou de arquitetura do worker.
  Ambiguidade encontrada é reportada, não resolvida.
- Nenhuma tarefa cria tela, campo, ação, rota, tabela, coluna ou índice; o
  frontend não é tocado por nenhuma delas, o que é a medida de que a mudança é
  interna.
- Nenhuma tarefa cria dependência além de `esbuild`, devDependency exigida pela
  construção por armazenamento e pela exclusão do Adapter alheio do pacote.
- Nenhuma tarefa introduz escolha de armazenamento em tempo de execução, ORM,
  construtor de consultas, conjunto de conexões ou migração de dados entre
  armazenamentos.
- **Integração obrigatória, para `main` nunca ficar com a suíte vermelha**, em
  três blocos:
  - **Bloco 1 — T801, T802, T804, T805 e T806 no mesmo commit.** T802 tira o
    esquema e as migrações de dentro de `src/acervo/` e T804 muda a construção do
    `Acervo` para receber a Porta e devolver `Promise`; sozinhos, os dois derrubam
    toda a suíte do backend — e o antigo ponto de entrada — até T806 adaptá-la.
    T803 e T807 podem entrar antes ou junto do bloco.
  - **Bloco 2 — T808 e T812 no mesmo commit.** T808 faz o antigo ponto de entrada
    deixar de existir, e é exatamente esse arquivo que o harness e2e inicia:
    sozinho, T808 derruba toda a suíte e2e.
  - **Bloco 3 — T809, T810 e T811 no mesmo commit.** T810 aponta `build` para o
    script criado em T809 e muda o significado do portão antigo de verificação de
    tipos; T811 é a prova dos três. Nenhum código deixa de compilar por eles,
    mas o portão de qualidade só volta a valer com os três juntos.
  - **T813 não integra bloco**: só acrescenta prova de falha do armazenamento, e
    não deixa nada vermelho por si.
- **T802 é a tarefa de maior risco**: mexe em base instalada, e a prova é um
  arquivo local criado antes desta feature continuando a abrir na mesma versão,
  com os mesmos dados e sem reaplicar migração.
- **T807 é a verificação negativa da feature**: a prova é a ausência de
  dependência de armazenamento concreto nos Modules, obtida por leitura dos
  imports, e não por afirmação na documentação.
- **T811 é a tarefa mais fácil de declarar concluída sem evidência real**: exige
  executar o script e ler código de saída, saída capturada e conteúdo de `dist/`,
  e não inspecionar o script.
- **T813 é a segunda verificação negativa**: a prova é a operação não aparecer
  como concluída, e não a mensagem isolada.
- T814 é a única tarefa do Arquiteto e a única que toca `specs/`: ela mantém os
  portões de qualidade declarados onde são citados — quickstarts e linhas de
  comandos dos planos de `001` a `008` — e registra em `007` e `008` que as duas
  são construídas sobre a Porta assíncrona, sem alterar requisito, decisão ou
  desenho de nenhuma delas.
- Nenhum endereço de conexão real, com ou sem senha, aparece em teste, em
  arquivo versionado ou nesta lista de tarefas: valores de aparência de
  credencial são fictícios, e a recusa comprovada é a que não repete o valor
  informado.
