# Tasks: Criar Usuário

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`

**Depende de**: nenhuma feature. Reusa a fundação de `001` a `006` — projeto,
`Acervo`, migração versionada, Seam `ClienteDoAcervo`, Adapter HTTP — e **não
altera** o comportamento delas.

**Executor**: pelo **Princípio XI**, todo código sob `backend/`, `frontend/` e
`e2e/` é criado por subagentes DeepSeek.

## Formato

O estado de cada tarefa é a **caixa de seleção**: `- [ ]` pendente, `- [X]`
concluída. É esse marcador que o comando `implement` lê e atualiza. Os metadados
exigidos pelo processo ficam na tabela recolhida de cada fase.

`[P]` = paralelizável: arquivos disjuntos, sem dependência mútua.

---

## Fase 1 — Fundação

- [ ] T601 Migração 4 cria a tabela `usuario`, preservando a base instalada
- [ ] T602 [P] Aplicação recusa iniciar sem o segredo do servidor

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T601 | Tabela `usuario` existe, com unicidade sem distinção entre maiúsculas e minúsculas e as restrições de Nome de usuário e de Sal, e a base instalada permanece intacta | FR-040, FR-073, FR-074, FR-076 · SC-026 | 002/T101 | `Acervo` (Seam interna) | `backend/src/acervo/` | `codebase-design` | Migrar base da feature `006` **com Cartões, Baralhos e Vínculos dentro** e asseverar que todos sobrevivem; migração não reaplica; `CHECK` recusa Nome de usuário com 2 e com 51 caracteres, com acento e com espaço; `UNIQUE COLLATE NOCASE` recusa `ana.silva` depois de `Ana.Silva`; `CHECK` recusa `sal` com 15 bytes | Nenhum dado perdido e todas as recusas comprovadas por teste |
| T602 | Sem `SEGREDO_DAS_SENHAS` no ambiente, ou com valor curto demais, a aplicação recusa iniciar nomeando a variável e a regra; com segredo válido, inicia normalmente | FR-077 · SC-024 | — | `Identidade` · `segredoConfigurado`, `SegredoAusenteError` | `backend/src/identidade/`, `backend/src/index.ts` | `codebase-design` | `segredoConfigurado({})` e `segredoConfigurado({ SEGREDO_DAS_SENHAS: "curto" })` lançam `SegredoAusenteError` nomeando a variável e a regra, sem o valor na mensagem; com 32 caracteres ou mais devolve o segredo; processo iniciado sem a variável encerra sem escutar | Nenhuma mensagem contém o valor do segredo e a partida válida continua funcionando |

</details>

---

## Fase 2 — Cadastro no servidor

- [ ] T603 `Identidade.cadastrar` valida as regras de Nome de usuário e de Senha
- [ ] T604 Ler os dados armazenados não revela a Senha nem revela Senhas iguais
- [ ] T605 Rota `POST /usuarios` responde conforme o contrato, sem credencial na resposta e sem Senha em log
- [ ] T606 Harness e2e sobe a API real com segredo aleatório e a suíte existente continua verde

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T603 | `Identidade.cadastrar` aceita Cadastro válido e recusa Nome de usuário fora de 3 a 50 caracteres ou com caractere não permitido, Senha fora de 8 a 128 caracteres, Senha sem regra de composição e Nome de usuário já existente; espaços ao redor do Nome de usuário descartados e espaços da Senha preservados | FR-070, FR-071, FR-073, FR-074, FR-075, FR-085 · SC-025, SC-026 | T601 | `Identidade` · `cadastrar` | `backend/src/identidade/` | `domain-modeling` | Casos pela Interface, com SQLite em memória e segredo aleatório por execução: `  ana  ` cadastrado vira `ana`; `ana.silva` recusado depois de `Ana.Silva`; `ab`, 51 caracteres, acento e `ana silva` recusados; Nome de usuário de 3 e de 50 caracteres aceitos; Senha de 7 e de 129 recusadas, Senha de 8, de 128, `"  senha  "` e só letras minúsculas aceitas; o retorno de sucesso traz apenas `id` e `nomeDeUsuario` | Nenhum teste inspeciona tabela e nenhuma resposta contém a Senha |
| T604 | Leitura direta da tabela `usuario` não encontra a Senha em nenhuma coluna e mostra que dois Usuários com a mesma Senha têm valores armazenados diferentes | FR-076, FR-078 · SC-021, SC-022 | T603 | `Identidade` (verificação negativa) | `backend/src/identidade/` | `domain-modeling` | Cadastrar dois Usuários com a mesma Senha e ler a tabela: nenhuma coluna contém a Senha, nem em forma reconhecível; as duas linhas têm `sal` diferente e `hash` diferente; `sal` tem exatamente 16 bytes; nenhuma coluna derivada da Senha, como comprimento ou força | Os valores conferidos diretamente na tabela, e não afirmados |
| T605 | `POST /usuarios` responde conforme o contrato, sem `Set-Cookie`, com pré-voo de CORS em `/usuarios` e sem a Senha em qualquer saída de log | FR-044, FR-046, FR-070, FR-071, FR-073, FR-074, FR-075, FR-078, FR-079 · SC-025, SC-026 | T603 | Adapter HTTP sobre `Identidade` | `backend/src/http/` | `codebase-design` | Teste de contrato: `201` com `id` e `nomeDeUsuario`; `400` `nome_de_usuario_invalido`, `senha_invalida` e `corpo_invalido`; `409` `nome_de_usuario_existente` para `ana.silva` depois de `Ana.Silva`; `mensagem` em português; nenhuma resposta com `Set-Cookie`, token ou credencial reutilizável; pré-voo de `/usuarios` responde `204`; corpo enviado direto à API, sem passar pela interface, é recusado; a saída capturada do processo não contém a Senha enviada | Todos os códigos do contrato, o pré-voo e a ausência de credencial comprovados |
| T606 | A suíte e2e existente continua verde: o harness sobe a API real com um `SEGREDO_DAS_SENHAS` aleatório válido por execução | FR-040, FR-077 | T602 | — | `e2e/` | — | O segredo é gerado com `randomBytes` no início da execução e reusado nos reinícios da API, sem valor literal no arquivo; as provas de persistência existentes, que reiniciam a API sobre o mesmo banco, continuam passando | `npm run test:e2e` verde, incluindo as provas que reiniciam a API |

</details>

---

## Fase 3 — Cliente e tela

- [ ] T607 `criarUsuario` existe nos dois Adapters, distinguindo recusa de indisponibilidade
- [ ] T608 Tela "Criar conta" em `#/criar-conta`, alcançável pela navegação principal, com confirmação explícita
- [ ] T609 Confirmação divergente não é enviada e os limites são comunicados durante a digitação
- [ ] T610 Falha de gravação é reportada, com o conteúdo digitado preservado

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T607 | `criarUsuario` funciona nos dois Adapters, com os modos de recusa do contrato distinguidos da indisponibilidade do transporte | FR-044, FR-045 | T605 | `ClienteDoAcervo` (Seam) | `frontend/src/acervo-cliente/` | `codebase-design` | A mesma bateria roda contra `ClienteHttp` e `ClienteEmMemoria`, com resultados idênticos; `nome_de_usuario_existente`, `nome_de_usuario_invalido`, `senha_invalida` e `indisponivel` distinguidos; propriedade extra no resultado não vaza | Dois Adapters verdes no mesmo conjunto |
| T608 | A rota `#/criar-conta` exibe os campos Nome de usuário, Senha e Confirmação da Senha, é alcançada pelo link "Criar conta" da navegação de qualquer tela e confirma o Cadastro explicitamente | FR-046, FR-071, FR-083, FR-084 | T607 | `ClienteDoAcervo` | `frontend/src/ui/` | — | `interpretarRota("#/criar-conta")` reconhecida; link "Criar conta" presente na navegação principal de todas as rotas, com `aria-current` na rota corrente; Cadastro válido exibe confirmação explícita e o Usuário aparece na tela; rótulos em português com os termos canônicos e nenhum sinônimo de `_Avoid_` visível | Os três campos, o link e a confirmação comprovados, sem regra de domínio replicada como autoridade |
| T609 | A tela recusa a Confirmação divergente sem enviar nada, movendo o foco para a Confirmação, e comunica os limites de Nome de usuário e de Senha durante a digitação | FR-072, FR-080, FR-081 | T608 | `ClienteDoAcervo` | `frontend/src/ui/` | — | Confirmação divergente: o cliente espionado **não é chamado**, a recusa aparece e o foco vai para a Confirmação; digitação **no** limite e **acima** do limite de cada campo mostra o aviso durante a digitação, antes de concluir | Nenhuma requisição parte na divergência e o aviso é comprovado sem concluir |
| T610 | Com a API indisponível, a falha é reportada, o Cadastro não aparece como concluído e os três campos mantêm o conteúdo digitado | FR-044, FR-045 · SC-012 | T609 | `ClienteDoAcervo` | `frontend/src/ui/` | — | Falha de transporte simulada no meio do Cadastro: mensagem de falha exibida, nenhuma confirmação exibida e os campos com o mesmo conteúdo para nova tentativa | Nenhuma perda de conteúdo e nenhuma aparência de conclusão |

</details>

---

## Fase 4 — Acessibilidade, responsividade e validação

- [ ] T611 Cadastro concluído só por teclado, com foco sempre identificável e movido na recusa
- [ ] T612 Recusas e confirmação do Cadastro perceptíveis por leitor de tela
- [ ] T613 [P] Tela utilizável em largura de telefone
- [ ] T614 e2e cobre Cadastro em navegador real, persistência e ausência de cookie e de dado do navegador

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T611 | O Cadastro vai do primeiro campo à confirmação só por teclado, o elemento focado é identificável sem depender de cor e, numa recusa, o foco vai para o campo a corrigir | FR-081 · SC-020 | T609 | — | `frontend/src/ui/` | — | Percurso `Tab`/`Shift+Tab` pelos três campos e pela ação de concluir, asseverando a posição do foco em cada passo; após cada recusa, asserção de que o foco está no campo a corrigir; indicador de foco declarado por marcação, não apenas por cor | As asserções de teclado e de foco passam em cem por cento dos passos |
| T612 | Recusas e confirmação do Cadastro são anunciadas, e não apenas exibidas visualmente | FR-082 | T611 | — | `frontend/src/ui/` | — | Asserções de região ativa para a recusa e para a confirmação; rótulos, papéis e estados acessíveis dos três campos asseverados | As asserções de semântica e de anúncio passam |
| T613 | A tela "Criar conta" permanece utilizável em largura de telefone, em coluna única | FR-042 | T609 | — | `frontend/src/ui/` | — | Sem rolagem horizontal em viewport estreita, com os três campos e a recusa exibida | Teste e2e passa |
| T614 | Em navegador real contra a API real, o Cadastro é concluído, os Usuários persistem após reiniciar os dois processos e não existe cookie, `localStorage` nem `sessionStorage` depois do Cadastro | FR-040, FR-078, FR-079 · SC-023 | T610 | — | `e2e/` | — | Cadastrar dois Usuários pelo navegador, reiniciar API e frontend e conferir que ambos continuam existindo; após o Cadastro, nenhum cookie e nenhum valor gravado em `localStorage` ou `sessionStorage`; nenhuma resposta de Cadastro traz credencial reutilizável | Teste e2e passa com a API real, sem cookie e sem dado do navegador criado |

</details>

---

## Dependências e Ordem

```
002/T101 → T601 → T603 ─┬─ T604
                        └─ T605 → T607 → T608 → T609 ─┬─ T610 → T614
T602 [P] → T606                                       ├─ T611 → T612
                                                      └─ T613 [P]
```

Execução **serial por padrão**. O paralelismo declarado é T602 com T601, por
tocarem arquivos disjuntos (a migração 4 e a leitura do segredo no início), e
T613 com o par T611–T612, por exercerem asserções disjuntas.

**T601 e T603 não são paralelas**: a validação autoritativa precisa da tabela.
**T603 e T604 não são paralelas**: a verificação negativa precisa de Usuários
gravados. **T603 e T605 não são paralelas**: a rota é uma casca fina sobre a
Interface. **T608 e T609 não são paralelas**: a recusa de Confirmação divergente
vive na tela criada em T608. **T609 e T611 não são paralelas**: a prova de
teclado exige a recusa com o foco já movido, implementada em T609.

## Matriz de Rastreabilidade Requisito ↔ Tarefa

| Requisito | Tarefa |
|---|---|
| FR-040 | T601, T606, T614 |
| FR-042 | T613 |
| FR-044 | T605, T607, T610 |
| FR-045 | T607, T610 |
| FR-046 | T605, T608 |
| FR-070 | T603, T605 |
| FR-071 | T603, T605, T608 |
| FR-072 | T609 |
| FR-073 | T601, T603, T605 |
| FR-074 | T601, T603, T605 |
| FR-075 | T603, T605 |
| FR-076 | T601, T604 |
| FR-077 | T602, T606 |
| FR-078 | T604, T605, T614 |
| FR-079 | T605, T614 |
| FR-080 | T609 |
| FR-081 | T609, T611 |
| FR-082 | T612 |
| FR-083 | T608 |
| FR-084 | T608 |
| FR-085 | T603 |

| Critério | Tarefa |
|---|---|
| SC-012 | T610 |
| SC-020 | T611 |
| SC-021 | T604 |
| SC-022 | T604 |
| SC-023 | T614 |
| SC-024 | T602 |
| SC-025 | T603, T605 |
| SC-026 | T601, T603, T605 |

## Notas

- Nenhuma tarefa exige decisão de produto ou arquitetura do worker. Ambiguidade
  encontrada é reportada, não resolvida.
- Nenhuma tarefa introduz Seam ou Adapter novo: `ClienteDoAcervo` já existe e
  apenas ganha uma operação nos dois Adapters.
- Nenhuma tarefa cria tabela de outra feature, e nenhuma toca tabela existente.
- **T601 é a tarefa de maior risco**: toca base instalada e exige provar que
  Cartões, Baralhos e Vínculos sobrevivem à migração 4.
- **T604 é a verificação negativa da spec.** A leitura direta da tabela é o que
  constitui a verificação, e não inspeção de estado interno.
- **T611 é a tarefa mais fácil de declarar concluída sem evidência real.**
  Exige asserção sobre a posição do foco em cada passo, não inspeção visual.
- Nenhum valor de segredo, de Senha ou de hash aparece em arquivo versionado, em
  teste ou nesta lista de tarefas.
