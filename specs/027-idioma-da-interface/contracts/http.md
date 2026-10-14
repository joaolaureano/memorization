# Contrato HTTP — recusas em inglês técnico

**Feature**: `027-idioma-da-interface` | FR-018, FR-019 | Research R4

## Forma da recusa (inalterada)

```json
{ "erro": "<codigo>", "mensagem": "<English technical message>", "motivo": "<opcional>", "limite": 123 }
```

- `erro`: código estável, `snake_case`. É **a** identificação da recusa. Clientes não leem `mensagem` para decidir nada.
- `mensagem`: inglês técnico, só ASCII, destinado a quem depura e nunca exibido à pessoa. Toda mensagem em português ou espanhol é defeito.
- `motivo`: como hoje, detalha `imagem_invalida` (`formato` | `tamanho` | `conteudo`) e as recusas do Anki.
- `limite` (novo, opcional): número usado pela UI na frase para a pessoa (`nome_muito_longo`, `frente_muito_longa`, `verso_muito_longo`, `descricao_muito_longa`, `anki_grande_demais`).
- Status HTTP e códigos existentes não mudam.

## Códigos

Existentes, só com `mensagem` traduzida: `indisponivel`, `nao_encontrado`, `dados_invalidos`, `conflito`, `escolhas_invalidas`, `frente_duplicada`, `sem_acesso`, `nome_de_usuario_invalido`, `nome_de_usuario_existente`, `frente_muito_longa`, `cartoes_indisponiveis`, `imagem_invalida`, `expirado`, `corpo_invalido`, `conflito_de_versao`, `verso_vazio`, `verso_muito_longo`, `tipo_imutavel`, `senha_invalida`, `senha_atual_incorreta`, `nome_vazio`, `nome_muito_longo`, `mesma_senha`, `imagem_ausente`, `frente_vazia`, `envio_invalido`, `descricao_muito_longa`, `credencial_invalida`, `acesso_expirado`.

Novos, para a importação Anki, que hoje lança `Error` com texto em português:

| Código | Status | `mensagem` (exemplo) |
|---|---|---|
| `anki_grande_demais` | 422 | `Anki file exceeds the size limit.` |
| `anki_ilegivel` | 422 | `Anki file could not be read.` |
| `anki_corrompido` | 422 | `Anki file is corrupted or exceeds the expansion limit.` |
| `anki_incompativel` | 422 | `File does not contain a compatible Anki collection.` |

A tabela completa `codigo → mensagem` vive em `backend/src/http/recusas.ts` e é coberta por prova (todo código presente, só ASCII).

## Registro de Sessão

`GET` de registros e Histórico: `nomeDoBaralho` passa a ser `""` na `revisao` e no `temporario` sem nome (data-model, migração 19). O nome digitado de um `temporario` é preservado (ver "Atualização do implement").

## Sem mudança

Nenhum cabeçalho de idioma é enviado ou lido. O servidor não conhece o Idioma da interface.

## Atualização do implement (2026-10-13)

- **Agenda** (`/agenda/*`): as recusas trazem `motivo`, que distingue recusas do mesmo código: `baralho_ausente`, `dias_invalidos`, `quantidade_invalida`, `data_invalida`, `inicio_nao_segunda`, `fuso_invalido`, `operacao_vazia`, `acao_invalida`, `rotina_ausente`, `versao_ausente`, `operacao_reutilizada`, `rotina_nao_encontrada`, `versao_desatualizada`, `rotina_ja_pausada`, `rotina_nao_pausada`, `baralho_nao_encontrado`, `baralho_sem_cartoes`, `rotina_do_estudo_ausente`, `estudo_fora_de_hoje`, `estudo_concluido`, `estudo_cancelado`, `sem_estudo_hoje`, `baralho_da_rotina_excluido`, `baralho_da_rotina_sem_cartoes`, `sobreposicao`. Na `sobreposicao` (409) vai também `dias: number[]` (1 = segunda), os dias em comum. O texto deixou de citar os dias.
- **Conta** (`/conta/senha`): `dados_invalidos` continua com `campo` (`novaSenha` ou `confirmacaoDaSenha`). A interface escolhe o texto por ele.
- **Importação Anki**: a indisponibilidade (503) passa a ter `erro: "indisponivel"`.
- **Registro de Sessão**: na origem `temporario`, o nome digitado e válido é gravado e devolvido (FR-369 da `023`). Sem nome, volta `""`. Na `revisao`, sempre `""` (research R12).
