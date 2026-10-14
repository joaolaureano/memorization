# Data Model: Idioma da Interface

**Feature**: `027-idioma-da-interface` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

## Idioma da interface (navegador)

| Campo | Valores | Regra |
|---|---|---|
| `idioma` | `pt` \| `en` \| `es` | Guardado só no navegador, na chave `memorization.idioma` (R5). Nunca vai ao backend nem à conta (FR-011). |
| locale derivado | `pt-BR`, `en-US`, `es-419` | Usado em `<html lang>` e em `Intl` (FR-008, FR-009). |

**Resolução ao abrir** (FR-012, research R10), nesta ordem: valor guardado válido → o **primeiro** item de `navigator.languages` (ou `navigator.language`), se o prefixo dele for `pt`, `en` ou `es` → `pt`. Os itens seguintes da lista são ignorados: `["fr-FR", "es-AR"]` → `pt`. Se o valor guardado for ilegível ou inválido, conta como ausente.

**Transição**: `escolher(novo)` atualiza o estado, o `lang` e o armazenamento (falha ao gravar é ignorada) e anuncia a troca. Não há outro estado.

## Catálogo (Texto do produto)

- `Catalogo = typeof pt`, uma árvore por área (`moldura`, `entrar`, `cadastro`, `baralhos`, `cartao`, `sessao`, `agenda`, `estatisticas`, `historico`, `preferencias`, `conta`, `importacao`, `recusas`, `seletor` …).
- As folhas são `string` ou funções puras `(valores) => string` (plural, limite, nome de Conteúdo do Usuário interpolado sem alteração).
- `recusas: Record<CodigoDeRecusa, (r: Recusa) => string>` cobre todo código (R4).
- **Invariantes**: as chaves são idênticas nos três idiomas (pelo tipo) e nenhum valor é vazio (prova). Conteúdo do Usuário entra só como argumento e é interpolado sem transformação (FR-006).

## Recusa (Seam `ClienteDoAcervo`)

```text
Recusa = { codigo: CodigoDeRecusa; motivo?: string; limite?: number }
```

- `CodigoDeRecusa` é a união dos códigos de `erro` do backend ([contracts/http.md](./contracts/http.md)), mais `indisponivel` e `nao_autenticado` do transporte e os códigos das validações locais.
- **Códigos locais** (só no frontend, nunca enviados pelo servidor; research R10):
  - `validacao.ts`: `frente_vazia`, `verso_vazio`, `nome_vazio`, `nome_de_usuario_invalido`, `nome_de_usuario_existente` (mesmos nomes dos códigos do backend: uma entrada de catálogo por significado);
  - `tipos-de-cartao.ts`: `imagem_grande`, `imagem_formato`;
  - `sessao-de-estudo.ts`: `baralho_inelegivel`, `quantidade_invalida`, `revisao_vazia`, `avaliacao_invalida`, `revelacao_ausente`, `sessao_concluida` (exatamente o `CODIGOS_DE_ERRO_DE_SESSAO` atual);
  - `agenda-em-memoria.ts`: reutiliza os códigos do backend que espelha (`dados_invalidos` etc.), com `motivo` ∈ `data`, `inicio_nao_segunda`, `fuso`, `quantidade`.
- Substitui `mensagem: string` em todo resultado de recusa da Seam. O estado das telas guarda `Recusa`, nunca texto (FR-015, FR-016).

## Registro de Sessão (persistido, backend) — alteração

| Campo | Antes | Depois |
|---|---|---|
| `nome_do_baralho` com `origem = 'revisao'` | `"Revisão do dia"` | `""` |
| `nome_do_baralho` com `origem = 'temporario'` | `"Baralho temporário"` | `""` |
| `nome_do_baralho` com `origem = 'baralho'` | nome copiado | sem mudança |

- **Migração 19** (SQLite e PostgreSQL): `UPDATE registro_de_sessao SET nome_do_baralho = '' WHERE origem IN ('revisao','temporario')`. Ela é idempotente e não muda o esquema.
- **Apresentação**: `rotuloDoBaralhoDoRegistro` escolhe o rótulo pelo `origem` no Idioma da interface (FR-020, FR-021).

Nenhuma outra entidade persistida muda. Baralhos, Cartões, Tags, Preferências e Usuário ficam intactos (FR-006, FR-007).

## Atualização do implement (2026-10-13, research R14)

- A Seam `ClienteDoAcervo` mantém `mensagem: string`. A "Recusa" acima existe como `RecusaDoServidor` (`idioma/recusas.ts`: `erro`, `motivo?`, `limite?`, `dias?`, `campo?`), usada para gerar o texto. O estado das telas guarda o texto, e a tela o reapresenta no idioma vigente pela memória de tradução.
- `registro_de_sessao.nome_do_baralho` na origem `temporario`: guarda o nome digitado. Só o rótulo padrão "Baralho temporário" vira `""` (research R12).
