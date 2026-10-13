# Contract — Cartão com Imagem (UI)

Reutiliza `Moldura`, `PaginaDoBaralho`, `PaginaDoFormularioDeCartao`, `PaginaDeEstudo`, `estilos.css` e os padrões de foco, erro e anúncio vigentes.

## Formulário de criação (detalhe do Baralho)

1. Primeiro campo: `<select>` com rótulo visível **Tipo de cartão**, opções **Frente-Verso** (selecionada a cada abertura) e **Imagem** (FR-404, FR-405).
2. Ao trocar o tipo, os campos são recompostos a partir do registro `TiposDeCartao`; uma região `aria-live="polite"` anuncia "Campos do tipo Imagem" / "Campos do tipo Frente-Verso" (FR-425). O foco permanece no seletor.
3. Campos do tipo **Imagem**, nesta ordem:
   - **Imagem** — `<input type="file" accept="image/jpeg,image/png,image/webp,image/gif">` com rótulo visível; texto de ajuda "JPEG, PNG, WebP ou GIF, até 5 MB".
   - Pré-visualização com botões **Trocar imagem** e **Remover imagem** (FR-413), operáveis por teclado.
   - **Descrição da imagem (opcional)** — até 250 caracteres, com contador e o texto de ajuda "Descreva a imagem sem revelar a resposta."
   - **Texto da frente (opcional)** — até 1.000, com contador.
   - **Verso** — obrigatório, até 1.000, com contador.
   - Tags, como hoje.
4. Troca de tipo preserva Verso e Tags; Frente ↔ Texto da frente são o mesmo valor. Se houver Imagem escolhida e o destino for Frente-Verso, um diálogo de confirmação (`DialogoDeConfirmacao`) avisa que a Imagem será descartada (FR-406).
5. Arquivo recusado no navegador (formato ou tamanho): mensagem junto ao campo, `aria-invalid`, foco no campo; demais valores preservados. Recusa do servidor (`imagem_invalida`) usa o mesmo lugar.
6. Salvar: estado "Enviando imagem…" anunciado; falha mantém tudo preenchido e anuncia o erro (US1-7).

## Formulário de edição

O tipo aparece como texto ("Tipo: Imagem"), sem seletor (FR-420). A Imagem atual aparece pré-visualizada com **Trocar imagem**; **Remover imagem** deixa o campo vazio e salvar é recusado com "Escolha uma imagem" (US3-3).

## Detalhe do Baralho

Cada item mostra o rótulo textual do tipo ("Imagem" / "Frente-Verso"), e, para Imagem, miniatura com `alt` (FR-415, FR-426) ao lado do Texto da frente (se houver) e do Verso. Busca e filtros consideram Texto da frente e Verso.

## Sessão de estudo

Antes da revelação: Imagem (inteira, `object-fit: contain`, largura máxima 100%, altura máxima ~60vh) e Texto da frente se houver. Depois: Verso. Falha de carga: uma nova consulta dos dados; persistindo, caixa "Imagem indisponível" + Descrição alternativa (FR-418), sem bloquear a Avaliação.

## Histórico

Itens de tipo Imagem mostram o rótulo "Cartão do tipo Imagem", o Texto da frente (ou "sem texto") e o Verso; nunca a Imagem.

## Viewports e acessibilidade

360, 390, 768 e 1440 px e zoom 200% sem rolagem horizontal (FR-417). Toda ação por teclado com foco visível; nenhum estado só por cor ou ícone.
