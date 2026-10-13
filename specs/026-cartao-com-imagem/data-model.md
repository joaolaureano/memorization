# Data Model: Cartão com Imagem

**Feature**: `026-cartao-com-imagem` | **Spec**: [spec.md](./spec.md) | **Decisões**: [research.md](./research.md) R2, R7, R8

## Entidades de domínio

### Tipo de cartão

Valor fechado: `frente-verso` (padrão) ou `imagem`. É escolhido na criação e não muda depois (FR-403, FR-420). Cada valor tem, no registro `TiposDeCartao`, as regras abaixo:

| Regra | `frente-verso` | `imagem` |
|---|---|---|
| Campos | Frente (texto, obrigatória), Verso (texto, obrigatório), Tags | Imagem (obrigatória), Texto da frente (opcional), Verso (texto, obrigatório), Descrição alternativa (opcional), Tags |
| Validação de texto | Frente e Verso: não vazios após `trim`, até 1.000 caracteres | Texto da frente: vazio permitido; se informado, até 1.000. Verso igual ao Frente-Verso. Descrição alternativa: até 250 |
| Validação de Imagem | — | Formato JPEG/PNG/WebP/GIF pela assinatura dos bytes; 1 B a 5 MB (5.242.880 B) |
| Chave de unicidade no Baralho | `normalizarFrente(frente)` | `normalizarFrente(frente)` (Texto da frente) se não vazio; senão `null`, fora da regra (FR-414) |
| Numeração em colisão | sufixo ` (n)` na Frente (`025`) | sufixo ` (n)` no Texto da frente |
| Texto pesquisável | Frente + Verso + Tags | Texto da frente + Verso + Tags (FR-419) |
| Snapshot no Histórico | `{ tipo, frente, verso }` | `{ tipo, frente /* Texto da frente */, verso }`, nunca a Imagem (FR-419a) |
| Apresentação antes da revelação | Frente | Imagem + Texto da frente, se houver (FR-416) |

### Cartão (alterado)

```text
Cartao =
  | { tipo: "frente-verso"; id; frente; verso; tags? }
  | { tipo: "imagem"; id; frente /* Texto da frente, pode ser "" */; verso; tags?;
      imagem: { url; expiraEm } /* só em leitura */; textoAlternativo?: string }
```

No tipo Imagem, o campo `frente` contém o **Texto da frente**. O nome do campo é o mesmo nos dois tipos para que a regra de unicidade, a busca e o snapshot o tratem igual.

Invariantes: o Cartão pertence a exatamente um Baralho (`025`); `tipo = imagem` ⇔ tem Imagem; o tipo não muda na edição (recusa `tipo_imutavel`).

### Imagem

Arquivo do Usuário guardado no `ArmazemDeImagens` sob a chave `imagens/{usuarioId}/{imagemId}`. Pertence a um único Cartão: a Cópia duplica o objeto (R7). Estados:

```text
(escolhida no navegador) ──salvar──▶ pendente ──confirmar ok──▶ ativa ──troca/exclusão──▶ a remover ──remover ok──▶ (inexistente)
                                         │                                                   ▲
                                         ├──confirmar recusada─────────────────────────────────┘ (apagada na hora)
                                         └──ciclo de vida 1 dia──▶ (inexistente)
```

- **pendente**: `pendentes/{usuarioId}/{imagemId}`; nunca legível.
- **ativa**: referenciada por exatamente um `cartao.imagem_chave`; legível só por endereço assinado de 15 min emitido ao dono.
- **a remover**: chave na tabela `imagem_a_remover`, sem Cartão que a referencie.

## Esquema — migração 17 (SQLite e PostgreSQL em paridade)

```text
cartao
  + tipo               TEXT NOT NULL DEFAULT 'frente-verso'
                       CHECK (tipo IN ('frente-verso','imagem'))
  + imagem_chave       TEXT NULL
  + texto_alternativo  TEXT NULL  CHECK (length ≤ 250)
  CHECK ((tipo = 'imagem') = (imagem_chave IS NOT NULL))
  CHECK (tipo = 'imagem' OR texto_alternativo IS NULL)

pertencimento
  ~ frente_chave       TEXT NULL        -- era NOT NULL; UNIQUE (baralho_id, frente_chave) mantido
                                        -- SQLite: reconstrução da tabela preservando cascatas

item_de_registro
  + tipo               TEXT NOT NULL DEFAULT 'frente-verso'
                       CHECK (tipo IN ('frente-verso','imagem'))

imagem_a_remover                        -- nova; sem FK, sobrevive à exclusão do Usuário
  chave         TEXT PRIMARY KEY
  registrada_em TEXT/TIMESTAMPTZ NOT NULL
```

Dados existentes: todo `cartao` vira `frente-verso` pelo padrão; nenhum `frente_chave` muda; `item_de_registro` antigo vira `frente-verso` (FR-407, SC-173).

## Porta de armazenamento (alterações de Interface)

- `inserirCartaoNoBaralho`, `atualizarCartao`, `obterCartao` e `listarCartoes` passam a carregar `tipo`, `imagemChave` e `textoAlternativo`. `atualizarCartao` que troca `imagemChave` grava a chave anterior em `imagem_a_remover` na mesma transação.
- `excluirCartao`, `excluirBaralho` e `excluirUsuario` gravam em `imagem_a_remover` as chaves dos Cartões removidos na mesma transação.
- Novas: `listarImagensARemover(limite)` e `esquecerImagensRemovidas(chaves)`.
- `inserirBaralhoComCopias` recebe as cópias já com a nova `imagemChave` e o `tipo` do original.
- `inserirRegistroEAgendamentos` grava `tipo` em cada item.

## Validações e onde vivem

| Regra | Autoridade | Eco no cliente |
|---|---|---|
| Textos, limites, unicidade | `TiposDeCartao` no `Acervo` (backend) | `TiposDeCartao` do frontend (`validacao.ts`) |
| Formato e tamanho reais | `ArmazemDeImagens.confirmar` + política do presigned POST | checagem de `File.type`/`File.size` antes de enviar |
| Tipo imutável | `Acervo.editarCartao` | seletor ausente na edição |
| Dono da Imagem | chave com prefixo `{usuarioId}` + `Acervo` só emite URL para Cartões do Usuário | — |
