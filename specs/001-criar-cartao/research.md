# Phase 0 — Research: Criar Cartão

Decisões técnicas desta feature. Cada entrada registra o que foi escolhido, por
quê, e o que foi rejeitado.

## Escolhas

### Runtime e linguagem — Node.js 24+ com TypeScript 5.x

**Decisão**: TypeScript estrito, ESM, sobre Node.js 24 ou superior.

**Rationale**: decisão do Product Owner por uma única linguagem em toda a stack
(SESSION.md, EVT-017). Tipos compartilhados entre API e cliente eliminam a
tradução manual do vocabulário de domínio na fronteira.

**Piso de versão revisto em T001**: o plano inicial dizia Node 22 LTS. A
aplicação executa TypeScript nativamente, sem etapa de empacotamento, e isso só
funciona sem flag a partir do Node 23.6. Declarar `>=22.5` era um defeito real —
no Node 22 a aplicação não subiria. Fixado em `>=24`, que também é onde
`node:sqlite` amadurece.

### Driver SQLite — `node:sqlite`, embutido no runtime

**Decisão**: o módulo SQLite do próprio Node.

**Rationale**: o plano previa `better-sqlite3`. Ele **não compila** no Node 26
deste ambiente — não há prebuild e o `node-gyp` falha. `node:sqlite` foi
verificado em execução antes da decisão: restrições `CHECK` aplicadas, API
síncrona, `PRAGMA` aceito. Substitui o driver **eliminando uma dependência e o
build nativo**, o que reforça o Princípio VII.

A decisão do Product Owner permanece intacta: SQLite local, em arquivo, sem
Docker. O que mudou foi o driver, detalhe de `plan`.

**Alternativas consideradas**: `better-sqlite3`, inviável aqui; `sql.js` em
WASM, que não persiste em arquivo naturalmente.

### Servidor HTTP — Fastify

**Decisão**: Fastify para o Adapter HTTP.

**Rationale**: tipagem de rota de primeira classe, sobrecarga mínima, e
`inject()` permite testar rotas sem abrir socket. O Adapter é fino por
construção: traduz requisição em chamada ao `Acervo` e resposta em código de
status.

**Alternativas**: Express, com tipagem de terceiros; `node:http` puro, que
exigiria reescrever roteamento e parsing.

### Validação de forma — Zod nas bordas

**Decisão**: Zod valida o corpo das requisições no Adapter HTTP.

**Rationale**: os tipos do TypeScript somem em runtime, e a API é o limite
autoritativo exigido por FR-023. Validação de **forma** fica na borda;
validação de **regra de domínio** fica dentro do `Acervo`. Frente vazia é regra
de domínio (FR-002); corpo que não é JSON é forma.

### Build — verificação de tipos, não empacotamento

**Decisão**: `npm run build` é `tsc --noEmit`.

**Rationale**: o runtime executa TypeScript diretamente, então não existe
artefato a construir. Tratar o "build" como typecheck cobre também os testes,
que de outro modo não seriam verificados por tipo.

**Consequência**: os imports relativos usam extensão `.ts`, com
`allowImportingTsExtensions`. O runtime, diferentemente do Vitest, **não**
reescreve `.js` para `.ts`, e isso quebrou a execução em T001 antes de ser
corrigido.

### Testes — Vitest, Testing Library e Playwright

**Decisão**: Vitest para unidade e integração; Testing Library para interação de
tela; Playwright apenas onde navegador real é indispensável.

**Rationale**: SC-003 exige fechar e reabrir a aplicação, e SC-011 exige
navegabilidade da lista. O restante é testado pelas Interfaces dos Modules.

### Guarda de loopback imposta em runtime

**Decisão**: após o `listen`, `assegurarEscutaLocal` confere o endereço
efetivamente vinculado e aborta a inicialização se não for `127.0.0.1`.

**Rationale**: a ausência de autenticação é **condicional** à execução local.
Deixar isso como convenção era insuficiente: o teste de mutação demonstrou que
um literal `"0.0.0.0"` no ponto de chamada expunha a API ao IP da rede local com
resposta 200, sem quebrar nenhum teste. A guarda converte a condição em
invariante.

## Omissões deliberadas

Cada uma é decisão de não construir, justificada pelo Princípio VII.

| Omitido | Por quê |
|---|---|
| ORM | Uma tabela nesta feature e nenhuma consulta dinâmica |
| Camada de repositório | Seam hipotética: uma Implementation só |
| Gerenciador de estado global | O estado é local a cada tela |
| Paginação, busca, filtro | Fora da spec; desnecessários em ~50 Cartões |
| Índices além da chave primária | Nessa escala não pagam seu custo |
| Migrações versionadas | Não há base instalada. A feature `002` acrescentará `baralho` — **esse é o gatilho** |
| Autenticação | Condicional à execução local, conforme Assumptions |
| Observabilidade estruturada | App local de usuário único; log de erro basta |
| Containerização | O Product Owner pediu SQLite local sem Docker |

Nenhum marcador `NEEDS CLARIFICATION` permanece.
