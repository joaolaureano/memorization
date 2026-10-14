# Contrato de UI — Exportar Baralhos

**Feature**: `029-exportar-baralhos` | Spec US1–US3, FR-461, FR-472, FR-474 a FR-479, FR-483 a FR-485

## Rota

`#/baralhos/exportar`, com o parâmetro opcional `?baralho={id}` (um Baralho já marcado) ou `?todos=1` (todos marcados). É uma página, não um diálogo, porque a lista de Baralhos precisa de rolagem em 360 px.

## Entradas

| Origem | Ação | Abre |
|---|---|---|
| Detalhe do Baralho | botão "Exportar" | `?baralho={id}`: só esse Baralho, sem a lista (SC-183: Exportar → Confirmar) |
| Lista de Baralhos | botão "Exportar" ao lado de "Importar do Anki" | lista com caixas de marcação, nenhuma marcada |
| Diálogo de exclusão de conta | link "Exportar meu acervo antes" | `?todos=1`. Não bloqueia a exclusão (FR-479) |

## Página

1. **Título**: "Exportar".
2. **Conteúdo**: caixa "Todos os Baralhos", que marca e desmarca todos, e uma caixa por Baralho, com o nome e o número de Cartões. Na entrada `?baralho=`, a página mostra só o nome do Baralho.
3. **Formato**: grupo de opções com uma opção, "Pacote Anki (.apkg)", já selecionada, e a ajuda "Abre no Anki, no AnkiDroid e no AnkiMobile. Ao importar no Anki, marque «Importar progresso de estudo»." (research R8).
4. **Resumo** (`aria-live="polite"`): número de Baralhos e de Cartões, "N com Imagem, M com Áudio" e o tamanho aproximado (`Intl.NumberFormat`, unidade de bytes) quando houver mídia. É atualizado a cada marcação.
5. **Ação**: botão "Exportar arquivo". Fica desabilitado, com o motivo visível, quando não há Baralho marcado ou não há Cartões.

## Estados

| Estado | Apresentação |
|---|---|
| Gerando | o botão vira "Gerando arquivo…", desabilitado, anunciado por `role="status"`. Uma segunda confirmação é impossível (FR-475) |
| Concluída | o download começa por navegação para a `url`. A mensagem "Arquivo pronto: {nomeDoArquivo}" aparece com um link "Baixar de novo" válido por 15 minutos. Se `cartoesSemMidia > 0`, aparece também "{n} cartões foram exportados sem a mídia" |
| Recusa | o texto da `Recusa` no Idioma da interface, junto ao resumo, com o foco nele. `exportacao_grande_demais` mostra o limite e sugere exportar em partes |
| Falha | "Não foi possível gerar o arquivo." com o botão "Tentar de novo". Nenhum download (FR-476) |
| Credencial expirada | o fluxo vigente de Entrar (`018`) |

## Acessibilidade e layout

- Tudo por teclado, foco visível, alvo de 44 × 44 px e nomes acessíveis. As caixas são `<input type="checkbox">` com `<label>`, e o formato é `<fieldset>` com `<legend>` (FR-483).
- Cabe de 360 a 1440 px e com zoom de 200%, sem rolagem horizontal (FR-484).

## Textos

Todos os textos acima ficam nos catálogos `pt`, `en` e `es`, numa seção nova `exportacao`. As recusas novas vão em `recusas` (FR-485, FR-486). Nomes de Baralhos e o nome do arquivo aparecem como são.
