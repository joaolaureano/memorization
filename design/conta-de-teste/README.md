# Protótipo — Conta de teste (030)

Abra `index.html` diretamente no navegador. O protótipo reutiliza
`../../frontend/src/estilos.css`; mantenha essa estrutura de diretórios. Os
dados são fictícios e existem apenas na memória da aba. Nada é salvo nem
chamado na API: a Conta de teste aqui é só a simulação da tela.

## Estados

Use a faixa **Estados do protótipo** no topo para ver cada tela:

- **Entrar**: formulário, "ou", **Entrar como Teste** e a frase de apoio.
- **Preparando**: "Preparando sua Conta de teste…" anunciado como status, com o
  botão desabilitado. **Entrar como Teste** também passa por aqui e abre o
  Início após cerca de 1 segundo.
- **Limite**: alerta de recusa com foco nele.
- **Expirada**: aviso "Sua Conta de teste terminou…" no topo da entrada.
- **Início** e **Perfil**: etiqueta "Conta de teste" no cabeçalho, aviso fixo e
  o link **Créditos do acervo de demonstração**, que abre o diálogo com três
  créditos de exemplo. Esc fecha e devolve o foco ao link.
- **Confirmar saída**: diálogo "Sair apaga a Conta de teste e tudo o que você
  fez nela." com **Sair e apagar** e **Cancelar**.

No Perfil, "Alterar senha" e "Excluir conta" não aparecem; no lugar, o texto
"A Conta de teste não pode ser alterada nem excluída.".

Troque o idioma com PT, EN e ES para ver os textos mudarem sem recarregar.

## Verificação

Com Playwright e Chromium instalados no repositório, a partir da raiz:

```sh
rtk proxy node design/conta-de-teste/verificar.mjs
```

O verificador confere a entrada e o botão Entrar como Teste, os estados de
preparo, limite e expiração, a etiqueta, os créditos com Esc, o Perfil sem ações
de conta, a confirmação de saída, o idioma EN e a ausência de rolagem horizontal
em 360, 390, 768 e 1440 px e com zoom equivalente a 200%, em todos os estados.
Este é um protótipo visual, não uma prova da API nem do armazenamento da
aplicação.
