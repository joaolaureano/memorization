# Cartão com Imagem — protótipo da spec 026

Abra `index.html` diretamente no navegador. O protótipo reutiliza
`../../frontend/src/estilos.css`; mantenha essa estrutura de diretórios. Os
dados são fictícios e existem apenas na memória da aba. O envio de arquivos,
a validação do servidor e a persistência são demonstrados localmente, sem API.

## Percurso

1. Confirme que a criação começa em **Frente-Verso**; selecione **Imagem** para
   ouvir o anúncio dos campos e ver o seletor de arquivo.
2. Escolha JPEG, PNG, WebP ou GIF de até 5 MB para ver a prévia; experimente
   trocar ou remover a Imagem antes de salvar.
3. Envie um arquivo de formato não aceito ou maior que 5 MB para conferir a
   recusa sem perder os demais campos.
4. Salve um Cartão com Imagem para ver o rótulo e a miniatura na lista; use
   **Estudar exemplo** para conferir a Frente e revelar o Verso.

## Verificação

Com Playwright e Chromium instalados no repositório:

```sh
rtk proxy node design/cartao-com-imagem/verificar.mjs
```

O verificador percorre 360, 390, 768 e 1440 px, aplica zoom CSS de 200% e
confere o tipo inicial, o anúncio acessível, a prévia, recusas de arquivo, a
miniatura, o estudo e a revelação. Este é um protótipo visual, não uma prova da
API ou do armazenamento da aplicação.
