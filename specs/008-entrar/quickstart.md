# Quickstart — Validação da feature Entrar

## Pré-requisitos

Os mesmos de [`001`](../001-criar-cartao/quickstart.md): Node 24+, sem Docker e
sem servidor de banco. E o segredo do servidor exigido pela `007`, definido no
terminal, **nunca documentado, gravado ou commitado** (Princípio VIII):

```bash
export SEGREDO_DAS_SENHAS="$(openssl rand -hex 32)"
```

**Regra operacional**: o mesmo segredo para a mesma base. Trocá-lo torna os
hashes gravados inverificáveis e faz **todo** Entrar ser recusado — sem distinção
entre esse caso e uma Senha errada (FR-088).

## Executar e verificar

```bash
cd backend && npm install && npm test && npm run build && npm run lint
cd frontend && npm install && npm test && npm run build && npm run lint
npm run test:e2e
```

## Roteiro de validação manual

1. Cadastre dois Usuários, com Senhas geradas no momento.
2. Sem ter entrado, abra a aplicação: a única tela é "Entrar", com o acesso a
   "Criar conta", e **não** há navegação para Cartões e Baralhos. → FR-097, SC-027
3. Informe o Nome de usuário com espaços ao redor e outras maiúsculas, com a
   Senha correta. Entrar é aceito. → FR-087, SC-036
4. **Só com o teclado**, percorra Nome de usuário, Senha, Entrar e Sair, com o
   foco sempre visível sem depender de cor. → FR-095, SC-032
5. Com leitor de tela, provoque uma recusa e conclua Sair: as duas mensagens são
   anunciadas, e não apenas exibidas. → FR-096
6. Informe um Nome de usuário inexistente e depois um existente com Senha errada:
   as duas recusas exibem **exatamente** "Nome de usuário ou Senha incorretos.", o
   foco vai ao campo a corrigir, o Nome de usuário permanece e a Senha é apagada.
   → FR-088, FR-095, SC-029
7. Entre e cadastre um Cartão e um Baralho. Saia, entre com o segundo Usuário e
   confirme acervo vazio, sem nada do primeiro. → FR-092, SC-030
8. Entre com o primeiro e tente abrir o Baralho do segundo pela barra de endereço:
   a resposta é a mesma de um Baralho inexistente. → FR-092, SC-030
9. Recarregue a página com o atalho do navegador: a aplicação exige Entrar de
   novo. → FR-089, SC-031
10. Entre, acione "Sair" e depois o voltar do navegador: nenhum conteúdo do
    acervo aparece. → FR-094, SC-034
11. Com o primeiro Usuário entrado, confira nas ferramentas do navegador que **não
    há cookie**, nada em `localStorage` ou `sessionStorage`, e que nem o Nome de
    usuário nem a Senha aparecem na URL ou no registro da aplicação. → FR-078,
    FR-079, SC-033
12. Numa segunda aba, entre com o outro Usuário: as abas convivem, e Sair numa não
    descarta a Credencial da outra. → FR-089
13. Pare a API e tente operar o acervo: a falha é informada, nada aparece como
    concluído e o digitado permanece. → FR-044, FR-045
14. Em largura de telefone, confira a coluna única sem rolagem horizontal na tela
    "Entrar". → FR-042

## Conferir a exigência de Credencial com `curl`

Mostre o **formato** do comando, com marcadores; nenhuma Credencial real vai para
documento, terminal compartilhado ou histórico:

```bash
# sem cabeçalho: a operação é recusada e nada muda
curl -i http://127.0.0.1:3001/cartoes

# com cabeçalho, no formato base64(NOME_DE_USUARIO:SENHA)
curl -i -u "${NOME_DE_USUARIO}:${SENHA}" http://127.0.0.1:3001/cartoes

# Entrar: verifica a Credencial antes de mostrar o acervo
curl -i -u "${NOME_DE_USUARIO}:${SENHA}" -X POST http://127.0.0.1:3001/entrar
```

O primeiro comando devolve `401` com a mensagem única e **sem** cabeçalho
`WWW-Authenticate`; o segundo, a lista do dono da Credencial; o terceiro,
`{ "id", "nomeDeUsuario" }`. Repita o primeiro, sem cabeçalho, em cada rota de
Cartões, Baralhos, Vínculos e edição: todas respondem `401`. → FR-090, SC-028

## Conferir que o acervo sem dono foi descartado

1. Tenha uma base, de antes desta feature, com Cartões, Baralhos, Vínculos e ao
   menos um Usuário.
2. Suba a API sobre essa base e entre com o Usuário existente: ele **entra** e vê
   acervo **vazio** — os Usuários sobreviveram à migração 5, o acervo antigo foi
   descartado. → FR-099, SC-037
3. Abra o arquivo com `sqlite3` e confira a versão do esquema igual a `5`, as
   colunas `usuario_id` e os índices por `usuario_id` em `cartao` e `baralho`, e
   **zero** linhas em `cartao`, `baralho` e `vinculo`.
4. Confirme que não existe tabela nem coluna de sessão, token, cookie ou
   Credencial verificada. → FR-079

## Referências

- [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md)
- [data-model.md](./data-model.md) · [contracts/api-entrar.md](./contracts/api-entrar.md)
- [contracts/alteracao-contratos-001-006.md](./contracts/alteracao-contratos-001-006.md)
