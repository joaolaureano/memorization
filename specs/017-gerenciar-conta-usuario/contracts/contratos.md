# Contratos: Gerenciar conta do Usuário

Este documento descreve a Porta `ArmazenamentoDeUsuarios`, a Interface do Module `Identidade`, o contrato HTTP e o contrato do cliente no frontend para FR-257..FR-288 e SC-105..SC-113. Nada aqui é implementação; é o contrato que as ondas de execução devem respeitar.

## 1. Porta `ArmazenamentoDeUsuarios` (`backend/src/armazenamento/porta.ts`)

### 1.1 `atualizarNomeDeUsuario(id, nome)`

- Entrada: `id` do Usuário e `nome` já normalizado/validado pelo `Identidade`.
- Saída em sucesso: Usuário com o novo Nome de usuário.
- Erros tipados: `nome_em_uso` quando a unicidade `COLLATE NOCASE` é violada; `indisponivel` quando o armazenamento falha.
- A violação de unicidade é traduzida pelo `Identidade` para `nome_indisponivel`, o código existente de 007 (D1, D2, FR-260, FR-262, SC-112).

### 1.2 `atualizarSenha(id, { sal, hash, parametros })`

- Entrada: `id` e a nova derivacao da Senha — `sal`, `hash` e `parametros` versionados.
- Saída em sucesso: void/Usuário sem derivacao.
- A Senha em texto claro não entra na Porta; ela já foi derivada no `Identidade` (FR-078, FR-267).

### 1.3 `excluirUsuario(id)`

- Entrada: `id` do Usuário.
- Saída em sucesso: void.
- Comportamento: um único comando em transação. As FKs `ON DELETE CASCADE` removem todos os dados do Usuário (D2, R3, FR-274, FR-275).
- Erros: `indisponivel` em falha do armazenamento; a transação não deixa estado parcial (SC-108).

### 1.4 `contarDadosDoUsuario(id)`

- Saída: `{ cartoes, baralhos, registrosDeSessao, agenda: number | null }`.
- `agenda` é `null` enquanto as tabelas da 016 não existirem. Existindo, soma
  os registros persistidos do Usuário de Rotina de estudo, Compromisso de estudo
  e Início de Compromisso; versões guardadas dentro de uma Rotina não contam
  separadamente (D2, R4, FR-272, SC-113).
- Erros: `indisponivel`.

A bateria compartilhada da Porta (`backend/tests/armazenamento/bateria-da-porta.ts`) cobre as quatro operações nos dois Adapters e inclui cenário de cascade com dois Usuários (D2, D6, SC-105).

## 2. Module `Identidade` (`backend/src/identidade/identidade.ts`)

### 2.1 `obterConta(usuarioId)`

- Devolve o Nome de usuário atual e as contagens do Usuário.
- Não devolve Senha, `sal`, `hash`, `parametros` nem qualquer derivado (FR-258).
- Resultado possível: sucesso; `indisponivel` (FR-044, FR-045).

### 2.2 `alterarNomeDeUsuario(usuarioId, { senhaAtual, novoNomeDeUsuario })`

- Exige `senhaAtual` (FR-259).
- Normaliza o novo Nome de usuário como em 007: espaços ao redor descartados, 3 a 50 caracteres, letras A–Z sem acento, dígitos, `.`, `_` e `-` (FR-260).
- Recusa novo nome igual ao atual → `mesmo_nome` (FR-261).
- Recusa nome já existente para outro Usuário, mesmo diferindo só em maiúsculas/minúsculas → `nome_indisponivel` (FR-262, SC-112).
- Senha atual errada → `senha_atual_incorreta` (FR-279).
- Falha de armazenamento → `indisponivel` (FR-044, FR-045).
- Sucesso devolve `{ nomeDeUsuario }` e o frontend substitui a Credencial em memória (FR-263, SC-106).

### 2.3 `trocarSenha(usuarioId, { senhaAtual, novaSenha, confirmacaoDaSenha })`

- Exige `senhaAtual` (FR-266).
- A nova Senha segue 007: 8 a 128 caracteres, qualquer caractere, espaços preservados, sem regra de composição (FR-267).
- Nova Senha igual à atual → `mesma_senha` (FR-268).
- Nova Senha diferente da Confirmação → recusa de validação `dados_invalidos` (FR-269).
- Senha atual errada → `senha_atual_incorreta` (FR-279).
- Sucesso: 204 no HTTP e Credencial em memória substituída (FR-270, SC-106).

### 2.4 `excluirConta(usuarioId, { senhaAtual })`

- Exige `senhaAtual` (FR-273).
- Senha atual errada → `senha_atual_incorreta` (FR-279).
- Sucesso: Usuário e todos os dados removidos; a Credencial é descartada e a tela vai a Entrar com «Conta excluída» (FR-274, FR-276, SC-105, SC-111).
- A exclusão não afeta outro Usuário (FR-275, FR-287).

### 2.5 Códigos e mensagens

- `senha_atual_incorreta`: uma única mensagem para as três ações, sem expor a
  Senha, qualquer derivado ou informação sobre outro Usuário (FR-279, SC-107).
- `mesmo_nome`: explicação, sem mudança (FR-261).
- `mesma_senha`: explicação, sem mudança (FR-268).
- `nome_indisponivel`: código existente de 007, mensagem clara (FR-262, SC-112).
- `dados_invalidos`: validação de Nome de usuário ou Senha com a regra violada identificada (FR-260, FR-267).
- `indisponivel`: falha do armazenamento, sem falso sucesso (FR-044, FR-045).

## 3. HTTP

Todas as rotas exigem Credencial válida pelo hook `onRequest` existente (FR-090). `401` permanece reservado à Credencial recusada (FR-090/FR-091). `senha_atual_incorreta` responde `403`, e não `401`, para não disparar o logout de FR-091 (D3, R5). Senha nunca aparece em resposta ou log (FR-078). As rotas são registradas em `registrarRotasDaAplicacao` e na lista de pré-voo de `criarServidor` (D3).

### 3.1 `GET /conta`

- Requisição: sem corpo; Credencial no cabeçalho.
- `200`: `{ nomeDeUsuario, contagens: { cartoes, baralhos, registrosDeSessao, agenda: number | null } }`.
- `401`: Credencial ausente/inválida (FR-090, FR-091).
- `503`: armazenamento indisponível (FR-044, FR-045).
- Não devolve Senha nem derivados (FR-258, FR-078).

### 3.2 `PUT /conta/nome-de-usuario`

- Requisição: `{ senhaAtual, novoNomeDeUsuario }`.
- `200`: `{ nomeDeUsuario }`.
- `400`: `dados_invalidos` ou `mesmo_nome`.
- `403`: `senha_atual_incorreta`.
- `409`: `nome_indisponivel`.
- `401`: Credencial recusada.
- `503`: armazenamento indisponível.
- Sucesso leva o frontend a substituir a Credencial em memória (FR-263, SC-106); a Credencial antiga é recusada em outras páginas (FR-264).

### 3.3 `PUT /conta/senha`

- Requisição: `{ senhaAtual, novaSenha, confirmacaoDaSenha }`.
- `204`: troca concluída.
- `400`: `dados_invalidos` (nova Senha inválida, confirmação diferente) ou `mesma_senha`.
- `403`: `senha_atual_incorreta`.
- `401`: Credencial recusada.
- `503`: armazenamento indisponível.
- Sucesso substitui a Credencial em memória (FR-270, SC-106).

### 3.4 `DELETE /conta`

- Requisição: `{ senhaAtual }`.
- `204`: conta excluída.
- `403`: `senha_atual_incorreta`.
- `401`: Credencial recusada.
- `503`: armazenamento indisponível.
- Sucesso descarta a Credencial e leva a Entrar com «Conta excluída» (FR-276, SC-105, SC-111).

### 3.5 CORS, paridade e guarda

- Cada rota nova entra na lista de pré-voo de `criarServidor` com os métodos e cabeçalhos já usados (`content-type`, `authorization`) (D3).
- `backend/tests/funcao/funcao.test.ts` verifica que a função da nuvem chama cada rota nova (D3).
- `backend/tests/http/cors.test.ts` percorre as rotas registradas e falha se alguma estiver sem pré-voo (D3; lição do bug 9251ae0 da 013 e do bug de CORS da 015).
- `backend/tests/http/conta-sc108.test.ts` mede SC-108 com 2.000 Cartões + 500 Registros.

## 4. Cliente no frontend

`ClienteDoAcervo` ganha:

- `obterConta(): Promise<ResultadoDeObterConta>`, em que `DadosDaConta = { nomeDeUsuario: string; contagens: ContagensDaConta }` ("conta" aqui é só o rótulo de interface; o termo de domínio é Usuário) e `ResultadoDeObterConta = { ok: true; dados: DadosDaConta } | { ok: false; erro: typeof INDISPONIVEL | typeof NAO_AUTENTICADO; mensagem: string }`
- `alterarNomeDeUsuario(dados): Promise<Resultado>`
- `trocarSenha(dados): Promise<Resultado>`
- `excluirConta(dados): Promise<Resultado>`

As implementações `cliente-http.ts` e `cliente-em-memoria.ts` mantêm a mesma Interface. `guarda-de-credencial.ts` passa a permitir substituir a Credencial em memória após renomear/trocar Senha e descartá-la após excluir (FR-263, FR-270, FR-276).

O Module puro `frontend/src/conta/resultado-incerto.ts` recebe o resultado de uma verificação por `POST /entrar` e decide:

- Credencial nova aceita → operação aplicada; substituir Credencial.
- Credencial antiga aceita → nada mudou.
- Credencial antiga recusada após exclusão → conta excluída.
- Verificação falhou → resultado desconhecido, com Tentar novamente e Ir para Entrar (FR-280..FR-283, SC-110).

## 5. Rastreabilidade

- Porta: FR-262, FR-267, FR-274, FR-275, FR-272; SC-105, SC-108, SC-112, SC-113.
- Identidade: FR-257..FR-279; SC-105..SC-107, SC-111, SC-112.
- HTTP: FR-078, FR-090, FR-091, FR-257..FR-288.
- Cliente/resultado incerto: FR-263, FR-264, FR-270, FR-276, FR-278, FR-280..FR-283; SC-106, SC-110.
- CORS/paridade: FR-090, D3; lição 013/015.

## 6. Componentes da seção "Minha conta" (`frontend/src/ui/`)

A seção é dividida em quatro componentes com props fixas, para que cada um seja
implementado e testado em paralelo, em arquivos disjuntos.

```tsx
// SecaoMinhaConta.tsx — renderizada por PaginaDePreferencias (FR-257)
export function SecaoMinhaConta(props: {
  cliente: ClienteDoAcervo;
  /** Substitui a Credencial em memória após renomear ou trocar a Senha (FR-263, FR-270). */
  aoSubstituirCredencial: (nova: Credencial) => void;
  /** Descarta a Credencial e vai a Entrar com "Conta excluída" (FR-276). */
  aoExcluirConta: () => void;
}): JSX.Element; // carrega obterConta; mostra Nome de usuário e as três ações

// FormularioDeNomeDeUsuario.tsx (FR-259..FR-265)
export function FormularioDeNomeDeUsuario(props: {
  cliente: ClienteDoAcervo;
  nomeAtual: string;
  aoConcluir: (novaCredencial: Credencial) => void;
  aoCancelar: () => void;
}): JSX.Element;

// FormularioDeTrocaDeSenha.tsx (FR-266..FR-271)
export function FormularioDeTrocaDeSenha(props: {
  cliente: ClienteDoAcervo;
  nomeDeUsuario: string;
  aoConcluir: (novaCredencial: Credencial) => void;
  aoCancelar: () => void;
}): JSX.Element;

// DialogoDeExclusaoDeConta.tsx (FR-272..FR-278)
export function DialogoDeExclusaoDeConta(props: {
  cliente: ClienteDoAcervo;
  contagens: ContagensDaConta;
  aoExcluir: () => void;
  aoCancelar: () => void;
}): JSX.Element;
```

Os três componentes de ação usam o Module `frontend/src/conta/resultado-incerto.ts`
quando a resposta se perde (FR-280..FR-283), reutilizam `CampoDeSenha`,
`DialogoDeConfirmacao` e a proteção de saída da `012` (FR-148, FR-159, FR-286) e
mostram a mensagem única de `senha_atual_incorreta` (FR-279).
