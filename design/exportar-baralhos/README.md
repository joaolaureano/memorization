# Exportar Baralhos — protótipo da spec 029

Abra `index.html` diretamente no navegador. O protótipo reutiliza
`../../frontend/src/estilos.css`; os dados de Inglês, Mídia e Vazio são fictícios
e existem apenas na memória da aba.

## Percurso

1. A entrada **Um Baralho** mostra Inglês e o formato **Pacote Anki (.apkg)**.
2. Escolha **Vários Baralhos**, marque Baralhos individuais ou use **Todos os
   Baralhos**. O resumo acompanha as escolhas e os Baralhos sem Cartões podem
   entrar junto dos que têm Cartões.
3. Use **Exportar arquivo** para ver os estados Gerando e Concluída. O link de
   download contém só um pacote vazio de demonstração, sem dados reais.
4. Abra **Demonstração de falha e recusa** para conferir as mensagens desses
   estados.
5. Troque entre PT, EN e ES. As caixas, o formato e os botões funcionam por
   teclado.

## Verificação

Com Playwright e Chromium instalados no repositório:

```sh
rtk proxy node design/exportar-baralhos/verificar.mjs
```

O verificador cobre alternância de um/vários Baralhos, a opção Todos, o resumo,
os estados e idiomas, teclado, ausência de rolagem horizontal em 360, 390, 768
e 1440 px e zoom equivalente a 200%. O protótipo não chama a API nem gera um
pacote Anki válido.
