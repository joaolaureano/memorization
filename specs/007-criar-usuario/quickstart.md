# Quickstart — Validação da feature Criar Usuário

## Pré-requisitos

Os mesmos de [`001`](../001-criar-cartao/quickstart.md): Node 24+, sem Docker e
sem servidor de banco.

**Novo**: a API só inicia com o segredo do servidor no ambiente. Gere um segredo
local no próprio terminal. O comando apenas define a variável na sessão do
shell; **nenhum valor é documentado, gravado ou commitado** (Princípio VIII):

```bash
export SEGREDO_DAS_SENHAS="$(openssl rand -hex 32)"
```

A variável precisa ter no mínimo 32 caracteres. Sem ela, a API recusa iniciar e
informa o que falta, sem nunca exibir o valor.

**Regra operacional**: use sempre o mesmo segredo para a mesma base. Se o
segredo mudar, os hashes já gravados deixam de ser verificáveis, e a feature
`008-entrar` passará a recusar todos os Usuários existentes.

## Executar e verificar

```bash
cd backend && npm install && npm test && npm run build && npm run lint
cd frontend && npm install && npm test && npm run build && npm run lint
npm run test:e2e
```

## Roteiro de validação manual

1. Sem `SEGREDO_DAS_SENHAS` no ambiente, suba a API. Ela **recusa iniciar** e
   informa qual variável falta e qual é a regra. → FR-077, SC-024
2. Com o segredo definido, abra "Criar conta" pela navegação principal. Os
   campos Nome de usuário, Senha e Confirmação da Senha aparecem, com os
   limites comunicados. → FR-071, FR-080, FR-084
3. Cadastre `Ana.Silva` com uma Senha válida. A conclusão é **confirmada
   explicitamente**. → FR-083
4. Tente cadastrar `ana.silva`. O Cadastro é recusado, com mensagem clara de que
   o Nome de usuário já existe. → FR-074, SC-025
5. Tente `ab` e depois `ana silva`. Os dois são recusados, com a indicação da
   regra violada. → FR-073
6. Tente uma Senha de 7 caracteres e outra de 129. As duas são recusadas, com o
   intervalo informado. → FR-075
7. Digite Senha e Confirmação diferentes e tente concluir. **Nada é enviado**, a
   recusa aparece e o foco vai para a Confirmação. → FR-072, FR-081
8. Informe `  ana.silva  ` num novo Cadastro. Os espaços são descartados e o
   Cadastro é recusado como duplicata. → FR-073
9. Digite até perto dos limites. O aviso aparece **durante** a digitação, e não
   só ao concluir. → FR-080
10. Faça o Cadastro do primeiro campo até a confirmação **usando só o teclado**,
    com o foco sempre identificável sem depender de cor. → FR-081, SC-020
11. Provoque uma recusa e confira que a mensagem é anunciada pelo leitor de
    tela. → FR-082
12. Pare a API e tente concluir. A falha é informada, o Cadastro **não** aparece
    como concluído e o texto digitado permanece. → FR-044, FR-045, SC-012
13. Feche os dois processos, abra de novo e confira que os Usuários continuam
    lá. → FR-040, SC-023
14. Nas ferramentas do navegador, confira que **não há nenhum cookie** e que
    nada foi gravado em `localStorage` ou `sessionStorage`. → FR-078, FR-079
15. Em largura de telefone, confira que o layout fica em coluna única, sem
    rolagem horizontal. → FR-042
16. Envie diretamente à API um corpo com Nome de usuário inválido, sem passar
    pela interface. A API recusa. → FR-070, SC-026

## Inspeção do arquivo SQLite

Este roteiro comprova FR-076, SC-021 e SC-022 fora dos testes automatizados.

1. Cadastre dois Usuários com **a mesma Senha**.
2. Abra o arquivo do banco, por exemplo com `sqlite3`, e leia a tabela
   `usuario`.
3. Confira que **nenhuma coluna contém a Senha**, nem em texto nem em outra
   forma reconhecível.
4. Confira que os dois Usuários têm `sal` **diferente** e `hash` **diferente**,
   apesar da Senha igual. → SC-021, SC-022
5. Confira que não existe tabela nem coluna de sessão, token ou cookie. → FR-079

## Referências

- [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md)
- [data-model.md](./data-model.md) · [contracts/api-usuarios.md](./contracts/api-usuarios.md)
