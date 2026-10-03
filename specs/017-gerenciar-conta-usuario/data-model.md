# Data model: Gerenciar conta do Usuário

## Visão

A 017 não cria entidade de domínio nova. Ela opera sobre o **Usuário** existente e sobre os dados que lhe pertencem, e acrescenta operações à Porta `ArmazenamentoDeUsuarios`. O modelo abaixo descreve o que a feature lê, altera e remove, e as garantias de persistência necessárias para FR-257..FR-288 e SC-105..SC-113.

## Entidades e conceitos

### Usuário
- `id` opaco, `nomeDeUsuario` único sem distinção entre maiúsculas e minúsculas, Senha guardada apenas como transformação irreversível (`sal`, `hash`, `parametros`).
- É dono de Cartões, Baralhos, Vínculos, Registros de sessão e Histórico de estudo, Preferências, Agendamentos do cartão e, quando a 016 existir, Rotinas de estudo, Compromissos de estudo e Inícios de Compromisso.
- A Interface do `Identidade` nunca devolve `sal`, `hash`, `parametros` ou Senha (FR-078).

### Credencial
- Par Nome de usuário + Senha mantido apenas na memória da página aberta (FR-089). Não há sessão, cookie ou token (FR-079).
- É substituída em memória quando Nome de usuário ou Senha mudam (FR-263, FR-270), descartada na exclusão (FR-276) e recusada em outras páginas assim que a alteração ou exclusão torna a antiga inválida (FR-264, FR-278).

### Conta (rótulo de interface)
- «Minha conta» é rótulo da seção em Preferências; «Excluir conta» é o rótulo da ação perigosa. O termo de domínio continua sendo Usuário (CONTEXT.md, FR-257, FR-272).

### ContagensDaConta
- Valor de leitura retornado por `GET /conta` e usado no diálogo de exclusão: `{ cartoes, baralhos, registrosDeSessao, agenda: number | null }`.
- `agenda` é `null` enquanto a feature 016 não existir; existindo, é a contagem dos dados da Agenda do Usuário (FR-272, SC-113).
- As contagens vêm do servidor (R4) e devem corresponder exatamente ao que `excluirUsuario` remove.

## Porta `ArmazenamentoDeUsuarios`

Operações preservadas de 007/008: `inserirUsuario`, `obterUsuarioPorNomeDeUsuario` e as demais já existentes no contrato. Operações novas:

- `atualizarNomeDeUsuario(id: string, nome: string): Promise<Desfecho<Usuario>>`
  - Sucesso devolve o Usuário com o novo Nome de usuário.
  - Violação de unicidade `COLLATE NOCASE` é traduzida para erro tipado `nome_em_uso` (D2, FR-262, SC-112).
- `atualizarSenha(id: string, derivacao: { sal: string; hash: Uint8Array; parametros: ParametrosDaSenha }): Promise<Desfecho<Usuario>>`
  - Substitui `sal`, `hash` e `parametros`; não devolve derivacao.
- `excluirUsuario(id: string): Promise<Desfecho<void>>`
  - Um único comando em transação. As FKs `ON DELETE CASCADE` removem todos os dados do Usuário (D2, R3, FR-274, FR-275).
- `contarDadosDoUsuario(id: string): Promise<Desfecho<ContagensDaConta>>`
  - Devolve `{ cartoes, baralhos, registrosDeSessao, agenda: number | null }` (D2, FR-272, SC-113).

A Porta continua sendo a única Interface pela qual o `Identidade` alcança persistência; nenhum SQL ou nome de tabela aparece no Module `Identidade` (Princípio IV).

## Persistência e cascatas

Tabelas existentes do dono, todas com `REFERENCES usuario(id) ON DELETE CASCADE`:

- `cartao`
- `baralho`
- `registro_de_sessao`
- `agendamento`
- `preferencias`

Tabelas dependentes que caem por cascata através das anteriores:

- `vinculo` (por `cartao` e `baralho`)
- `item_de_registro` (por `registro_de_sessao`)

Restrição entre features: a migração da 016 MUST declarar `ON DELETE CASCADE` para `usuario` nas tabelas da Agenda de estudo (`RotinaDeEstudo`, `CompromissoDeEstudo`, `InicioDeCompromisso`, conforme o data-model da 016). Sem isso, `excluirUsuario` falharia ou deixaria dados órfãos quando a 016 existir, violando FR-274, FR-275 e SC-105. **A 017 não cria migração própria**: ela depende das cascatas já existentes e da regra registrada para a 016.

## Transações e integridade

- **Alterar Nome de usuário**: validar no `Identidade`; persistir com `atualizarNomeDeUsuario`. A unicidade é garantida pelo banco com `COLLATE NOCASE`; a violação vira `nome_em_uso`, e o `Identidade` traduz para `nome_indisponivel` (FR-260, FR-262, SC-112).
- **Trocar Senha**: validar a nova Senha e a Confirmação no `Identidade` (FR-266, FR-267, FR-269); derivar a nova chave; persistir com `atualizarSenha`. Senha igual à atual é recusada antes da persistência (FR-268).
- **Excluir conta**: `excluirUsuario` é uma única instrução em transação. A exclusão é tudo ou nada: ou o Usuário e todos os dados dele desaparecem, ou nada é aplicado (FR-274, FR-275, SC-108, invariante 3).
- **Contagens**: `contarDadosDoUsuario` é leitura; `agenda` é `null` sem 016 e numérica com 016. O diálogo de exclusão usa o valor retornado pelo servidor (FR-272, SC-113).

## Invariantes de dados

1. O Nome de usuário é único sem distinção entre maiúsculas e minúsculas e segue as regras de 007; alterá-lo nunca cria dois Usuários com o mesmo nome (FR-260, FR-262, SC-112).
2. A Senha nunca é legível no armazenamento, em leitura, na tela ou em log; a Interface do `Identidade` não devolve derivacao (FR-078, FR-258).
3. Uma conta excluída não deixa rastro: nenhum dado do Usuário removido permanece acessível, e nenhum outro Usuário é afetado (FR-274, FR-275, SC-105).
4. Toda operação da feature é executada apenas sobre a própria conta; não há administrador nem acesso à conta de outro Usuário (FR-287).
5. A Credencial é substituída em memória quando Nome de usuário ou Senha mudam, e descartada na exclusão; nenhuma outra página continua a valer (FR-263, FR-264, FR-270, FR-276, FR-278, SC-106).
6. Nenhum sucesso persistente é anunciado antes da confirmação; resultado incerto é verificado antes de ser informado e nova tentativa não aplica a mudança duas vezes (FR-280..FR-283, SC-110).
7. As contagens exibidas conferem com o que é removido, com 016 ausente ou presente (SC-113).
