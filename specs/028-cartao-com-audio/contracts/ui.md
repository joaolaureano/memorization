# Contrato de UI — Cartão com Áudio

**Feature**: `028-cartao-com-audio` | Research R7, R8

Reutiliza `PaginaDoFormularioDeCartao`, `PaginaDoBaralho`, `PaginaDeEstudo`, o Histórico, `estilos.css` e os padrões de foco, erro e anúncio da `026`. Os textos abaixo estão em PT; os três catálogos têm todos eles (FR-458).

## Formulário de criação

1. **Tipo de cartão**: `<select>` com Frente-Verso (selecionado a cada abertura), Imagem e Áudio, nesta ordem (FR-432). Ao trocar, a região `aria-live="polite"` anuncia "Campos do tipo Áudio". O foco fica no seletor.
2. Campos do tipo **Áudio**, nesta ordem:
   - **Áudio**: `<input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/webm,audio/wav,audio/x-wav,.mp3,.m4a,.ogg,.opus,.webm,.wav">`, com rótulo visível e o texto de ajuda "MP3, M4A, OGG, WebM ou WAV, até 10 MB e 5 minutos. MP3 e M4A tocam em todos os aparelhos."
   - **Pré-escuta**: depois de escolhido o arquivo, aparecem o tocador (abaixo), o nome do arquivo (Conteúdo do Usuário, sem tradução) e os botões **Trocar áudio** e **Remover áudio** (FR-438).
   - **Mensagem (opcional)**: até 1000 caracteres, com contador e o texto de ajuda "Contexto ou pergunta para o áudio, sem revelar a resposta." (FR-457).
   - **Verso**: obrigatório, até 1000 caracteres, com contador.
   - **Tags**: como hoje.
3. **Troca de tipo** (FR-433):
   - Verso e Tags são mantidos, e Frente, Texto da frente e Mensagem são o mesmo valor.
   - Se a troca descartar um Áudio ou uma Imagem escolhidos, o `DialogoDeConfirmacao` avisa antes: "O áudio escolhido será descartado." ou o aviso de Imagem vigente.
   - O foco inicial fica em Cancelar e volta ao seletor ao fechar. Cancelar mantém o tipo e o arquivo.
4. **Recusa no navegador** (formato, tamanho, ou duração lida do arquivo local): a mensagem aparece junto ao campo, com `aria-invalid` e foco no campo, e os demais valores ficam. A recusa do servidor (`audio_invalido`, `audio_ausente`) usa o mesmo lugar (FR-456).
5. **Salvar**: o estado "Enviando áudio…" é anunciado. Uma falha mantém tudo preenchido e anuncia o erro.

## Edição

- O tipo aparece como texto ("Tipo: Áudio"), sem seletor (FR-448).
- O tocador do Áudio atual vem com **Trocar áudio**.
- **Remover áudio** esvazia o campo. Salvar sem outro Áudio é recusado com "Escolha um áudio." (US3-3).

## Tocador (`AudioDoCartao`)

Um único componente para a lista, a Sessão, a edição e a pré-escuta.

| Parte | Comportamento |
|---|---|
| Botão | **Tocar** / **Pausar**. O nome acessível troca entre "Tocar áudio" e "Pausar áudio", sem `aria-pressed`: o estado é anunciado uma vez só. Alvo ≥ 44 × 44 px, ícone com rótulo (nunca só ícone). |
| Posição | `<input type="range">` com rótulo "Posição do áudio" e `aria-valuetext` como "5 segundos de 1 minuto e 4 segundos". Setas avançam ou voltam 5 s; Home e End vão ao início e ao fim. |
| Tempo | Texto visível `0:05 / 1:04`, com algarismos do Idioma da interface. |
| Estado | Região `aria-live="polite"` com "Tocando", "Pausado" ou "Fim do áudio". |
| Indisponível | Caixa "Áudio indisponível" no lugar do tocador, depois de uma renovação do endereço sem sucesso (FR-444). |

- O tocador nunca toca sozinho (FR-441).
- Começar um Áudio pausa o anterior (FR-443).
- Desmontar o componente pausa o Áudio.
- Com movimento reduzido não há animação de progresso, só a atualização do valor.

## Detalhe do Baralho

- Quando uma ação ou um anúncio precisa nomear um Cartão do tipo Áudio sem Mensagem, usa "Áudio do Cartão" (EN "Card audio", ES "Audio de la tarjeta").
- Cada item mostra o rótulo do tipo ("Áudio"), o tocador compacto, a duração ("1:04", com nome acessível "Duração: 1 minuto e 4 segundos"), a Mensagem (se houver) e o Verso (FR-441).
- O filtro por Tipo (FR-430) inclui **Áudio** (FR-445).
- A busca considera a Mensagem e o Verso.

## Sessão de estudo

- **Antes da revelação**: a Mensagem (se houver) e o tocador (FR-442).
- **Depois da revelação**: o Verso, com o tocador ainda disponível, sem interromper o que estiver tocando.
- **Próximo Cartão ou fim da Sessão**: o Áudio para, inclusive quando o próximo item é o mesmo Cartão repetido.
- **Áudio indisponível**: não bloqueia a Avaliação.

## Histórico

Itens do tipo Áudio mostram o rótulo "Cartão do tipo Áudio", a Mensagem (ou "sem mensagem") e o Verso. O Áudio nunca aparece (FR-447).

## Troca de idioma

Os rótulos, os anúncios, o tempo e a duração mudam de idioma sem recarregar a página. O Áudio que estiver tocando continua. Mensagem, Verso e nome do arquivo não mudam (FR-460).

## Viewports e acessibilidade

Larguras de 360, 390, 768 e 1440 px e zoom de 200%, sem rolagem horizontal (FR-446). Tudo funciona por teclado, com foco visível, e nenhum estado depende só de cor ou ícone.
