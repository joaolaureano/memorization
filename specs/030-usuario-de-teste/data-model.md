# Data Model: Usuário de Teste

**Feature**: `030-usuario-de-teste` | Research R1, R2, R3, R4, R5

## Migração 22 (SQLite e PostgreSQL)

| Mudança | Detalhe |
|---|---|
| `usuario.conta_de_teste_em` | `TIMESTAMPTZ NULL` (SQLite: `TEXT NULL`, ISO-8601). Nula = conta real; preenchida = Conta de teste criada nesse instante |
| Índice | `usuario (conta_de_teste_em) WHERE conta_de_teste_em IS NOT NULL` |
| `usuario.envios_de_teste` | `INTEGER NOT NULL DEFAULT 0`: envios de mídia preparados pela Conta de teste (FR-495a); sempre 0 em contas reais |
| Tabela nova `criacao_de_conta_de_teste` | `origem_hmac TEXT NOT NULL`, `criado_em TIMESTAMPTZ NOT NULL`; índice `(origem_hmac, criado_em)` |

As contas existentes ficam com `conta_de_teste_em = NULL`, sem mudança de comportamento.

## Conta de teste

- `nome_de_usuario`: `teste-` mais 16 caracteres de `[a-z0-9]`. Unicidade pela restrição vigente; em caso de colisão, gera outro.
- `sal`/`hash`/`parametros`: de uma Senha aleatória de 32 bytes que é descartada. A recusa vem de `conta_de_teste_em`, não da Senha (R1).
- **Encerrada** quando `conta_de_teste_em < agora − 2 min` e não há `acesso_temporario` com `expira_em > agora`.

## Valor de criação (Module `demonstracao`)

```text
ContaDeTesteMontada
├── usuario: { id, nomeDeUsuario, sal, hash, parametros, contaDeTesteEm }
├── baralhos[]: { id, nome, cartoes[]: { id, tipo, frente, verso, tags[], descricaoAlternativa?, midiaChave?, duracaoMs? } }
├── registros[]: Sessões de exemplo (data, origem, itens com Cartão, Snapshot, Avaliação)
├── agendamentos[]: resultado de aplicarAvaliacoes sobre os registros
├── rotina: { baralho: "Inglês", dias: 1..7, quantidade: null }
└── preferencias: padrão
```

`midiaChave` aponta sempre para `demonstracao/…` (R3).

## Operações novas na Porta

| Operação | Comportamento |
|---|---|
| `criarContaDeTeste(conta)` | Insere tudo numa transação; qualquer falha desfaz tudo |
| `listarContasDeTesteEncerradas(agora, limite)` | Ids das Contas de teste encerradas, as mais antigas primeiro |
| `registrarCriacaoDeContaDeTeste(origemHmac, agora)` e `contarCriacoes(origemHmac, desde)` | Limite por origem (R5) |
| `contarContasDeTesteAtivas(agora)` | Limite global (R5): contas de teste não encerradas, com Acesso válido |
| `registrarEnvioDeTeste(usuarioId, limite)` | Incrementa `envios_de_teste` só se ficar ≤ `limite`; devolve se foi aceito |
| `esquecerCriacoesAntigas(antesDe)` | Limpeza (R4) |

`excluirUsuario` (vigente) deixa de enfileirar chaves com prefixo `demonstracao/`.

## Operação nova no `ArmazemDeMidia`

`gravarArquivoFixo(chave, bytes, tipoDeConteudo)`, nos Adapters S3 e Disco. Recusa chaves fora de `demonstracao/` (research R13).

## Constantes

| Nome | Valor |
|---|---|
| `PREFIXO_DE_DEMONSTRACAO` | `"demonstracao/"` |
| `LIMITE_DE_CONTAS_DE_TESTE_POR_ORIGEM_POR_HORA` | 10 |
| `LIMITE_DE_CONTAS_DE_TESTE_ATIVAS` | 300 |
| `FOLGA_DA_CRIACAO` | 2 min |
| `LIMITE_DE_MIDIA_DA_CONTA_DE_TESTE` | 20.971.520 bytes (20 MB) mantidos nos Cartões |
| `LIMITE_DE_ENVIOS_DA_CONTA_DE_TESTE` | 30 envios preparados |
| Intervalo da limpeza | 15 min na nuvem, 5 min no modo local |
