# Phase 0 — Research: Criar Usuário

As decisões de stack, runtime, driver, build e testes estão em
[`../001-criar-cartao/research.md`](../001-criar-cartao/research.md) e **não são
reabertas aqui**. Este documento registra apenas o que é novo nesta feature.

## Decisão 1 — Transformação de Senha com o scrypt do `node:crypto`

**Decisão**:
- `entrada = HMAC-SHA256(segredo, senha em UTF-8)`;
- `hash = scrypt(entrada, sal, 64)`, com `N=32768`, `r=8`, `p=1` e `maxmem` de
  64 MiB;
- `sal` = 16 bytes aleatórios por Usuário.

Nenhuma dependência nova.

**Rationale**: o scrypt é *memory-hard* e já vem no Node. A exigência de memória
é o que encarece o ataque com hardware dedicado, exatamente o risco que FR-076
trata. As alternativas populares não compensam aqui: bcrypt e argon2 exigem
dependência nativa, e este projeto já precisou abandonar o `better-sqlite3` por
falha de compilação nativa no Node 26. O custo de 50 a 150 ms por Cadastro é
aceitável numa aplicação local, e o Cadastro não é caminho quente.

Os parâmetros são gravados **junto** do hash, em JSON, para poderem evoluir sem
migração de dados: um hash antigo continua verificável com os parâmetros com que
foi produzido.

**Alternativas rejeitadas**:
- bcrypt e argon2: exigem dependência nativa, e o projeto já teve problema com
  isso;
- PBKDF2: vem no Node, mas não exige memória, então é mais barato de atacar;
- SHA-256 puro: inaceitável para Senha.

## Decisão 2 — Segredo aplicado por HMAC, não por concatenação

**Decisão**: o segredo do servidor entra por `HMAC-SHA256(segredo, senha)`, e o
resultado alimenta o scrypt.

**Rationale**: o HMAC produz uma entrada de **comprimento fixo** e sem
ambiguidade, e separa por construção a chave (o segredo) da mensagem (a Senha).
Concatenar `segredo + senha` funcionaria na prática, mas dependeria de
disciplina sobre o formato da Senha.

**Alternativas rejeitadas**:
- concatenação direta;
- guardar o segredo no banco, o que contraria o Princípio VIII.

## Decisão 3 — Segredo lido do ambiente, no início, por função exportada

**Decisão**: a variável `SEGREDO_DAS_SENHAS` é obrigatória e precisa ter no
mínimo 32 caracteres. É lida em `backend/src/index.ts` por
`segredoConfigurado(env)`, que lança `SegredoAusenteError` nomeando a variável e
a regra, sem nunca incluir o valor.

**Rationale**:
- O Princípio VIII proíbe segredo em arquivo versionado, e o ambiente é o único
  lugar disponível sem inventar um cofre.
- Ler no início, e não a cada requisição, faz a aplicação **recusar iniciar**
  quando o segredo falta (FR-077, SC-024), em vez de falhar só no primeiro
  Cadastro.
- A função recebe `env` como parâmetro e nunca repete o valor na mensagem. É o
  mesmo padrão de `PortaInvalidaError` em `servidor.ts`.
- Nos testes, o segredo é gerado a cada execução com `randomBytes`. Nenhum
  valor literal é commitado.

**Regra operacional**: o segredo precisa ser o mesmo para uma mesma base. Se ele
mudar, os hashes gravados deixam de ser verificáveis. Essa regra está no
quickstart e na tabela de riscos do plano.

**Alternativas rejeitadas**:
- arquivo `.env` versionado, que viola o Princípio VIII;
- valor padrão silencioso, que produziria hashes inverificáveis sem aviso.

## Decisão 4 — Migração 4: tabela `usuario`

**Decisão**: acrescentar uma entrada à lista ordenada de
`backend/src/acervo/migracoes.ts`, no mesmo estilo das anteriores: versionada e
aplicada em transação. Nenhuma tabela existente é tocada.

**Rationale**:
- FR-040 exige persistência entre execuções, e já existem bases instaladas.
- `nome_de_usuario` recebe `UNIQUE COLLATE NOCASE`. Assim, a unicidade sem
  distinção de maiúsculas (FR-074) é garantida **pelo banco**, e não por uma
  consulta prévia sujeita a corrida.
- `sal` é `BLOB` com `CHECK(length(sal) = 16)`, `hash` é `BLOB` e `parametros` é
  texto JSON.
- Nenhuma coluna consegue guardar a Senha: FR-076 vale por construção, não por
  disciplina.

**Alternativas rejeitadas**:
- verificar a unicidade em código, com `SELECT` antes do `INSERT`, o que abre
  espaço para corrida;
- guardar os parâmetros em colunas separadas, o que exigiria migração a cada
  mudança de parâmetro.

## Decisão 5 — Letras restritas a A–Z (refinamento de FR-073)

**Decisão**: "letras", no Nome de usuário, significa `A–Z` e `a–z`, e nada além.

**Rationale**: o `NOCASE` do SQLite só iguala maiúsculas e minúsculas em ASCII.
Com acentos, `É` e `é` seriam considerados distintos, e a unicidade prometida
por FR-074 e SC-025 falharia justamente nos nomes mais prováveis em português.
Restringir o alfabeto é a única forma de cumprir a promessa sem escrever
normalização Unicode própria.

**Encaminhamento**: o FR-073 da spec foi refinado para dizer "letras de A a Z,
sem acento". A restrição no esquema (`NOT GLOB '*[^A-Za-z0-9._-]*'`) traduz
fielmente essa decisão.

**Alternativas rejeitadas**:
- aceitar acentos com normalização própria, complexidade desproporcional para um
  Cadastro;
- aceitar acentos sem normalização, o que quebraria o FR-074.

## Decisão 6 — Duplicata detectada pela violação de `UNIQUE`

**Decisão**: o `INSERT` é tentado, e a violação de `UNIQUE` é traduzida para o
código de domínio `nome_de_usuario_existente`.

**Rationale**: é o mesmo padrão já usado no `Acervo` para a chave primária de
`vinculo`. A alternativa, consultar antes de inserir, deixa uma janela de
corrida entre a consulta e a inserção.

**Alternativas rejeitadas**:
- `SELECT` antes do `INSERT`;
- `INSERT OR IGNORE` seguido de contagem, que perde a distinção entre as causas
  da falha.

## Decisão 7 — Logger desabilitado e nenhuma credencial na resposta

**Decisão**:
- o logger do Fastify continua desabilitado;
- nenhuma resposta traz `Set-Cookie`, token ou valor reutilizável;
- o frontend não grava nada em `localStorage`, `sessionStorage` nem cookie.

**Rationale**: FR-078 proíbe registrar a Senha, e FR-079 proíbe sessão, cookie e
token. Com o logger desabilitado, não existe caminho pelo qual um corpo de
requisição chegue a um log. Ainda assim, um teste confirma que nenhuma saída de
log contém a Senha.

**Alternativa rejeitada**: habilitar o logger com ocultação de campos, que
depende de manter a lista de campos correta. Com o logger desabilitado, nada
depende disso.

## Decisão 8 — Espelho de validação no frontend, autoridade no servidor

**Decisão**: `frontend/src/acervo-cliente/validacao.ts` repete os limites apenas
para o aviso durante a digitação (FR-080). A autoridade é do `Identidade`.

**Rationale**: FR-070 exige validação autoritativa fora da apresentação, e
SC-026 exige que requisições que não vêm da interface também sejam recusadas. O
espelho existe para a experiência de digitação, não para a integridade.

**Alternativas rejeitadas**:
- validar só no servidor, o que falharia o FR-080;
- validar só no cliente, o que falharia o FR-070 e o SC-026.

## Omissões deliberadas

| Omitido | Motivo |
|---|---|
| Recuperação e troca de Senha | Adiadas explicitamente na spec |
| Bloqueio por tentativas | Adiado na spec. Só faz sentido quando existir Entrar; será avaliado no clarify da `008` |
| E-mail e verificação em duas etapas | Adiados explicitamente na spec |
| Porta de repositório para o `Identidade` | Com um único Adapter, a Seam seria hipotética (Princípio IV) |
| Índice adicional sobre `nome_de_usuario` | O `UNIQUE` já cria o índice necessário |

Nenhum marcador `NEEDS CLARIFICATION` permanece.
