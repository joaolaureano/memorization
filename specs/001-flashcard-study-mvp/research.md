# Phase 0 — Research: MVP de Estudo por Flashcards

Decisões técnicas tomadas para viabilizar o plano. Cada entrada registra o que
foi escolhido, por quê, e o que foi rejeitado.

## Escolhas

### Runtime e linguagem — Node.js 22 LTS com TypeScript 5.x

**Decisão**: TypeScript estrito nas duas metades, sobre Node.js 22 LTS.

**Rationale**: decisão do Product Owner por uma única linguagem em toda a stack.
Tipos compartilhados entre a API e o cliente eliminam a tradução manual do
vocabulário de domínio na fronteira — `Cartao`, `Baralho` e `Vinculo` existem uma
vez só. Node 22 é LTS e não exige transpilação exótica.

**Alternativas consideradas**: Deno e Bun dispensariam parte da configuração,
mas o ecossistema de SQLite síncrono e de ferramentas de teste é mais maduro em
Node, e nada neste MVP paga o risco.

### Servidor HTTP — Fastify

**Decisão**: Fastify para o Adapter HTTP.

**Rationale**: tipagem de rota de primeira classe, sobrecarga mínima, e o
encerramento explícito do servidor facilita o teste de integração. O Adapter
HTTP é fino por construção — ele traduz requisição em chamada ao Acervo e
resposta do Acervo em código de status.

**Alternativas consideradas**: Express, mais difundido porém com tipagem
acoplada a `@types` de terceiros; `node:http` puro, que economizaria uma
dependência ao custo de reescrever roteamento e parsing.

### Driver SQLite — better-sqlite3

**Decisão**: `better-sqlite3`, com API síncrona.

**Rationale**: a API síncrona simplifica drasticamente as transações, que são
exatamente onde as invariantes não-cascateantes de FR-008 e FR-017 precisam ser
atômicas. Num app local de usuário único não há concorrência que justifique
assincronismo, e o bloqueio do event loop é irrelevante nessa escala. O mesmo
driver atende produção, em arquivo, e teste, em `:memory:` — o que é a razão de a
Seam de persistência ser interna e não uma porta.

**Alternativas consideradas**: `node:sqlite`, embutido no runtime, dispensaria a
dependência mas ainda é marcado experimental; `sql.js`, compilado em WASM, não
persiste em arquivo naturalmente.

### Validação de entrada — Zod nas bordas

**Decisão**: Zod valida o corpo das requisições no Adapter HTTP e o formato das
respostas no `ClienteHttp`.

**Rationale**: os tipos do TypeScript desaparecem em tempo de execução, e dado
que a API é o limite autoritativo exigido por FR-023, a borda precisa recusar
entrada malformada antes de alcançar o Acervo. Validação de **forma** fica na
borda; validação de **regra de domínio** fica dentro do Acervo. A distinção é
importante: frente vazia é regra de domínio, FR-002, e é do Acervo; corpo que
não é JSON é forma, e é da borda.

**Alternativas consideradas**: validação manual, verbosa e fácil de esquecer;
schemas nativos do Fastify, que não geram tipos aproveitáveis pelo cliente.

### Interface — React 19 com Vite

**Decisão**: React com Vite, sem framework de aplicação e sem gerenciador de
estado global.

**Rationale**: a aplicação tem cinco telas e nenhuma necessidade de renderização
no servidor. O estado é pequeno e local: a lista corrente e a Sessão em
andamento. A Sessão, aliás, não é estado da interface — ela é o Module
`SessaoDeEstudo`, e a interface apenas exibe o que ele responde.

**Alternativas consideradas**: Next.js, que traria renderização no servidor e
roteamento de arquivo sem requisito que os peça, contrariando o Princípio VII;
Svelte ou Vue, igualmente viáveis, sem vantagem decisiva.

### Testes — Vitest, Testing Library e Playwright

**Decisão**: Vitest para unidade e integração nas duas metades; Testing Library
para interação de tela; Playwright para os poucos cenários que exigem navegador
real.

**Rationale**: dois critérios de sucesso não são verificáveis sem navegador.
SC-007 exige percorrer uma Sessão inteira só pelo teclado, e SC-003 exige fechar
e reabrir a aplicação confirmando que o acervo persiste. Ambos são comportamento
observável de ponta a ponta. O restante — incluindo todas as invariantes do
Acervo e da Sessão — é testado através das Interfaces dos Modules, sem
navegador.

**Alternativas consideradas**: Jest, mais lento e com configuração extra para
ESM; dispensar o Playwright e aceitar SC-003 e SC-007 como não verificados, o
que contraria o Princípio VI.

## Omissões deliberadas

Cada uma é uma decisão de não construir, justificada pelo Princípio VII.

| Omitido | Por quê |
|---|---|
| ORM | O modelo tem três tabelas e nenhuma consulta dinâmica. SQL direto é mais curto que a configuração do ORM e mantém as invariantes visíveis. |
| Camada de repositório | Seam hipotética: uma Implementation só. Registrada e rejeitada no plano. |
| Gerenciador de estado global | O estado é local a cada tela. A Sessão é um Module, não estado compartilhado. |
| Paginação, busca, filtro | Excluídos da spec e desnecessários em ~50 Cartões (SC-011). |
| Índices além das chaves | A chave primária e a unicidade de `(cartao_id, baralho_id)` já criam os índices que importam nessa escala. |
| Migrações versionadas | Não há base instalada nem esquema anterior. O esquema é criado na primeira execução. Migração passa a valer quando houver segunda versão do esquema, não antes. |
| Autenticação | Decisão B1, condicional à execução local, conforme Assumptions da spec. |
| Observabilidade estruturada | Um app local de usuário único; log de erro no console basta. |
| Containerização | O Product Owner pediu SQLite local explicitamente sem Docker. |

## Questão técnica em aberto

**A Interface do Module `SessaoDeEstudo`.** Não é uma incógnita de pesquisa: é
uma decisão de design deliberadamente adiada, por ser candidata a `Design It
Twice` e depender de aprovação humana. O que já está fixado: dependência
*in-process* pela classificação de `DEEPENING.md`, nenhuma Seam de persistência,
e a Aleatoriedade injetada como única dependência externa. O que falta: a forma
da Interface.

Nenhum marcador `NEEDS CLARIFICATION` permanece.
