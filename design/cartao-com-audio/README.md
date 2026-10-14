# Cartão com áudio — protótipo da spec 028

Abra `index.html` diretamente no navegador. O protótipo reutiliza
`../../frontend/src/estilos.css`; mantenha essa estrutura de diretórios. Os
dados são fictícios e existem apenas na memória da aba. O áudio de exemplo é um
WAV de silêncio gerado no navegador, então tudo funciona offline, sem API.

## Percurso

1. Confirme que a criação começa em **Frente-Verso**; selecione **Áudio** para
   ouvir o anúncio "Campos do tipo Áudio" e ver o seletor de arquivo.
2. Escolha MP3, M4A, OGG, WebM ou WAV para ouvir a pré-escuta; experimente
   **Trocar áudio** e **Remover áudio**.
3. Use o tocador (botão, barra de posição com setas, Home e End) na seção
   **Tocador** e na lista de cartões.
4. Em **Estudo**, avance até o Cartão de áudio: a Mensagem e o tocador aparecem
   antes de **Revelar**; **Próximo** remove o tocador e pausa o áudio.
5. Troque o idioma com PT, EN e ES para ver os textos mudarem sem recarregar.

## Verificação

Com Playwright e Chromium instalados no repositório:

```sh
rtk proxy node design/cartao-com-audio/verificar.mjs
```

O verificador confere o seletor de tipo e o anúncio, o botão do tocador por
clique e teclado, a posição com setas e End, a permanência do tocador após
Revelar, a troca para EN, a ausência de rolagem horizontal em 360, 390, 768 e
1440 px e com zoom equivalente a 200%. Este é um protótipo visual, não uma prova
da API ou do armazenamento da aplicação.
