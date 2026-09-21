# Implementation Plan: Criar Usuário

**Branch**: `007-criar-usuario` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Depende de**: nenhuma feature. É independente de `001` a `006` e **não altera**
o comportamento delas: nenhuma rota, tabela ou tela existente muda. Reusa a
fundação de projeto de [`001-criar-cartao`](../001-criar-cartao/plan.md)
(TypeScript estrito sobre Node 24+, Fastify, `node:sqlite`, Zod nas bordas,
Vitest, Testing Library, Playwright), a Seam `ClienteDoAcervo` e a migração
versionada introduzida em [`002-criar-baralho`](../002-criar-baralho/plan.md).
Nenhuma dessas decisões é reaberta.

## Summary

Sétima feature, e a primeira que trata de **identidade** e de **segredo**. Uma
pessoa cria seu Usuário numa tela "Criar conta", repetindo a Senha para
confirmação. O Usuário persiste entre execuções. A Senha nunca é recuperável a
partir dos dados armazenados e não sai em nenhuma leitura.

O escopo é estreito: **apenas Cadastro**. Não há Entrar, Sair, acervo por
usuário, sessão, cookie ou token. Nenhuma requisição carrega credencial, e o
restante da aplicação continua exatamente como está.

O que a feature traz de estruturalmente novo:
- um **Module separado do `Acervo`**, chamado `Identidade`;
- a primeira **dependência de segredo do servidor**, lida do ambiente no início,
  nunca do repositório (Princípio VIII).

## Technical Context

Stack, runtime, driver, build e testes vêm de `001` e **não são reabertos**. Ver
[`../001-criar-cartao/research.md`](../001-criar-cartao/research.md).

**Novo nesta feature**:
- transformação de Senha com `node:crypto` (HMAC e scrypt), sem dependência
  nova;
- segredo do servidor lido do ambiente;
- migração 4.

**Scale/Scope**: 21 requisitos funcionais (FR-040, FR-042, FR-044, FR-045 e
FR-046 reutilizados; FR-070 a FR-085 específicos), 8 critérios de sucesso
(SC-012 e SC-020 a SC-026), 1 história, 1 tela.

## Constitution Check

*GATE: antes da Phase 0 e revisto após a Phase 1.*

| Princípio | Veredito |
|---|---|
| I — Spec-Driven | **PASS**. Deriva apenas de `spec.md` desta feature |
| II — Auditabilidade | **PASS**. Registrado em `SESSION.md` com banner SPEC KIT. Nenhum valor de segredo é escrito, nem para ser removido depois: a sanitização vem antes da escrita |
| III — Domínio antes de tecnologia | **PASS**. Identificadores usam `Usuário`, `Nome de usuário`, `Senha` e `Cadastro` (FR-046). `user`, `login`, `account` e `password` são proibidos em módulo, tipo, função, tabela, coluna e rota |
| IV — Módulos profundos | **PASS**. Um Module novo, `Identidade`, com Interface pequena que esconde validação, transformação de Senha e persistência. A Locality justifica separá-lo do `Acervo`: identidade não é acervo. Nenhuma Seam nova |
| V — Interface é a superfície de teste | **PASS**. `Identidade` é testado pela Interface, com SQLite em memória. A única leitura direta de tabela é a de FR-076, SC-021 e SC-022, que **é** a verificação de um requisito negativo, e não inspeção de estado interno |
| VI — Verificação sobre afirmação | **PASS**. Todo diff de worker é inspecionado. A ausência da Senha em log é comprovada por teste, não afirmada |
| VII — Escopo mínimo | **PASS**. Complexity Tracking vazio. Nenhuma dependência nova, nenhuma recuperação de Senha, nenhum bloqueio por tentativas |
| VIII — Segredos fora do repositório | **PASS por construção**. O segredo existe apenas no ambiente do processo. Nenhum arquivo versionado, `SESSION.md`, log ou resposta o contém (FR-077) |
| IX — Rastreabilidade | **PASS condicionado**. A matriz requisito–teste é produzida em `tasks.md` |
| X — Portões de qualidade | **PASS até aqui**. `analyze` é executado ao final desta etapa |
| XI — Delegação de código | **PASS**. Todo código em `backend/`, `frontend/` e `e2e/` será escrito por workers DeepSeek |

**Processos removidos**: ADRs e Design It Twice não se aplicam, pela
constituição 2.1.0. Nenhuma emenda é necessária: o Princípio VIII é a regra que
governa esta feature, não uma exceção a ela.

### Re-avaliação após Phase 1

**PASS, sem alteração.** O design confirmou as decisões:
- nenhuma coluna é capaz de guardar a Senha;
- a unicidade é garantida pelo banco, com `NOCASE`, e não por uma verificação
  em código sujeita a corrida;
- a autoridade das regras é do servidor (FR-070); o espelho no frontend serve
  apenas ao aviso durante a digitação (FR-080).

## Decisões de Codebase Design

### Module novo — `Identidade`

Fica em `backend/src/identidade/`, **separado do `Acervo`**. Identidade e acervo
são conceitos distintos, com ciclos de vida distintos e regras que não se tocam.
Juntá-los produziria um Module sem Locality, em que uma mudança na política de
Senha mexeria no mesmo arquivo que lista Baralhos.

Interface:

```
criarIdentidade(banco, segredo) -> Identidade

Identidade.cadastrar({ nomeDeUsuario, senha })
  -> { ok: true,  usuario: { id, nomeDeUsuario } }
  |  { ok: false, erro, mensagem }
```

Modos de erro, estáveis e nomeados: `nome_de_usuario_invalido`,
`senha_invalida` e `nome_de_usuario_existente`. A `mensagem` é em português e
destinada ao usuário (FR-046).

**Invariantes garantidas pela Interface**:
- espaços ao redor do Nome de usuário são descartados antes da validação;
- o Nome de usuário tem de 3 a 50 caracteres, com letras de A a Z, dígitos,
  `.`, `_` e `-` (FR-073);
- a Senha tem de 8 a 128 caracteres, aceita qualquer caractere, preserva
  espaços e não tem regra de composição (FR-075, FR-085);
- a unicidade não distingue maiúsculas de minúsculas (FR-074, SC-025);
- **a Senha nunca aparece em nenhum retorno** (FR-076, SC-021).

O `segredo` entra pela Interface como dependência explícita; o Module não lê
`process.env`. Isso permite testá-lo com um segredo descartável a cada execução
e mantém a leitura do ambiente num único lugar.

### Seams — nenhuma nova

A persistência continua uma **Seam interna**, com a mesma postura do `Acervo`:
- `node:sqlite` é uma dependência *local-substitutable*;
- produção e teste usam o mesmo driver, com destinos diferentes;
- **não** há porta de repositório. Com um único Adapter, a Seam seria
  hipotética, e por isso é rejeitada como indireção (Princípio IV).

A Seam `ClienteDoAcervo` **não é duplicada**. Ela ganha `criarUsuario` nos dois
Adapters existentes, `ClienteHttp` e `ClienteEmMemoria`, com `indisponivel` para
falha de transporte, como nas demais operações (FR-044, FR-045).

As migrações continuam numa lista única e ordenada, em
`backend/src/acervo/migracoes.ts`. O esquema da base é um só, mesmo com dois
Modules.

### Avaliação do Module `Identidade`

- **A Interface é menor que a complexidade que esconde?** Sim. Um verbo,
  `cadastrar`, esconde a validação de duas regras, a derivação de chave com
  parâmetros versionados, a geração de sal e a tradução da violação de
  unicidade.
- **Há Leverage real?** Sim. A rota `POST /usuarios` fica fina: interpreta o
  corpo, chama o Module e converte o código de erro em status.
- **Há Locality?** Sim. Toda a política de Senha e de Nome de usuário fica num
  só lugar. A `008-entrar` vai reusar o mesmo Module para verificar a Senha.
- **Teste de exclusão**: sem o Module, a transformação de Senha, a validação e a
  tradução de erro se espalhariam pela camada HTTP.
- **Os testes usam a Interface?** Sim, com SQLite em memória e segredo aleatório
  a cada execução.
- **Há Seam especulativa?** Nenhuma foi criada.

## Acessibilidade e Responsividade

Atende FR-042, FR-080 a FR-084 e SC-020. Os critérios de aceitação seguem a
seção *Critérios de Qualidade* da constituição.

- Os três campos e a ação de concluir são alcançáveis por teclado, com indicador
  de foco que não depende de cor.
- Numa recusa, o foco vai para o campo a corrigir (FR-081). Se a Senha e a
  Confirmação divergem, o foco vai para a Confirmação e nada é enviado (FR-072).
- Os limites são comunicados **durante** a digitação (FR-080), e não apenas ao
  concluir.
- A confirmação e as recusas são anunciadas por região ativa, e não apenas
  visualmente (FR-082, FR-083).
- O layout é de coluna única, sem rolagem horizontal em largura de telefone.

Os dois campos de Senha usam `type="password"` e `autocomplete="new-password"`.
Depois do sucesso, os valores de Senha são apagados do estado do componente.

## Validação, Erros e Segurança

Há duas camadas, como nas features anteriores:
- a **forma** é validada na borda, com Zod: o corpo precisa ter `nomeDeUsuario`
  e `senha` como texto, e propriedades extras são ignoradas;
- as **regras de domínio** são validadas dentro do `Identidade`.

FR-070 é satisfeito por construção: nenhuma requisição, venha ou não da
interface, escapa das regras (SC-026).

O segredo é lido no início, em `backend/src/index.ts`, pela função exportada
`segredoConfigurado(env)`. Ela lança `SegredoAusenteError` quando o segredo
falta ou é curto demais. A mensagem nomeia a variável e a regra, **nunca o
valor**, no mesmo padrão de `PortaInvalidaError` em `servidor.ts`. Assim, a
aplicação recusa iniciar (FR-077, SC-024).

Garantias adicionais:
- o logger do Fastify continua desabilitado, então nenhum corpo de requisição é
  registrado (FR-078);
- nenhuma resposta traz `Set-Cookie`, token ou credencial reutilizável (FR-079);
- o cliente não grava nada em `localStorage`, `sessionStorage` ou cookie
  (FR-078);
- a garantia de loopback de `assegurarEscutaLocal` continua valendo e não é
  reaberta.

## Estratégia de Testes

A Interface é a superfície de teste.

- **`Identidade`**: testado com SQLite em memória e segredo aleatório a cada
  execução. Cobre os três modos de erro, o descarte de espaços no Nome de
  usuário, a preservação de espaços na Senha e a recusa de duplicata sem
  distinguir maiúsculas.
- **Verificação negativa de FR-076, SC-021 e SC-022**: lê a tabela `usuario`
  diretamente, porque é essa leitura que constitui a verificação. Exige que a
  Senha não apareça em nenhuma coluna e que dois Usuários com a mesma Senha
  tenham sal e hash diferentes.
- **Contrato HTTP**: cobre os quatro status e o formato uniforme de erro, além de
  confirmar que nenhuma saída de log contém a Senha.
- **Frontend**: testes de componente, de teclado e de leitor de tela.
- **E2E**: rodam contra servidores **reais**. `e2e/servidores-locais.ts` passa
  um `SEGREDO_DAS_SENHAS` aleatório ao processo da API. Cobrem o Cadastro pelo
  navegador, a persistência após reinício e a inspeção do navegador para
  confirmar que não há cookie nem dado gravado.

Comandos: `npm test`, `npm run build` e `npm run lint` em `backend/` e
`frontend/`; `npm run test:e2e` na raiz.

## Project Structure

Um diretório novo no backend; o resto cresce dentro dos Modules existentes:

```text
backend/src/identidade/       # Module novo: Interface, transformação de Senha, segredo
backend/src/acervo/           # + migração 4 na lista ordenada (nenhuma tabela existente muda)
backend/src/http/             # + rota POST /usuarios, + CORS
backend/src/index.ts          # + leitura do segredo no início
frontend/src/acervo-cliente/  # + criarUsuario nos dois Adapters, + limites durante a digitação
frontend/src/ui/              # + PaginaDeCadastro, + rota #/criar-conta, + link na navegação
e2e/                          # + segredo aleatório ao subir a API
```

## Riscos, Alternativas e Custo de Reversão

| Decisão | Risco | Alternativa rejeitada | Custo de reversão |
|---|---|---|---|
| scrypt do `node:crypto` | 50 a 150 ms por Cadastro | bcrypt ou argon2, que exigem dependência nativa | Baixo: os parâmetros ficam gravados com o hash e podem evoluir |
| Segredo estável para uma mesma base | Trocá-lo torna os hashes inverificáveis na `008` | Derivar o segredo da própria base | Baixo antes da `008`; a regra operacional está no quickstart |
| Unicidade delegada ao `COLLATE NOCASE` | Restringe as letras a A–Z e a–z | Normalizar maiúsculas e minúsculas em código antes de gravar | Médio: aceitar acentos exigiria normalização própria |
| Module `Identidade` separado do `Acervo` | Dois Modules com o mesmo padrão de fábrica | Juntar as operações ao `Acervo` | Baixo: poucos arquivos e uma rota |
| Tradução da violação de `UNIQUE` em erro de domínio | Acopla o Module ao código de erro do driver | Consultar a existência antes de inserir | Baixo; a alternativa tem corrida entre a consulta e a inserção |

## Complexity Tracking

> Nenhuma violação da constituição a justificar.

Um Module novo, **nenhuma** Seam nova e **nenhuma** dependência nova. O Module é
exigido pela Locality da identidade, e a migração 4 pela existência de bases já
instaladas. Nenhum dos dois é antecipação.
