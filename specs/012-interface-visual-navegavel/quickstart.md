# Quickstart: Interface visual e navegável

## Rodar

```bash
npm run demo        # na raiz: API SQLite em :3001 + web em http://127.0.0.1:5173
```

## Portões

```bash
cd frontend && npm test && npm run lint && npm run build
cd backend  && npm test            # deve continuar verde, sem mudanças
npm run test:e2e                   # na raiz
```

## Percurso manual (SC-062)

Faça o percurso em 390 px e em 1440 px, só com teclado (Tab, Shift+Tab, Enter, Espaço, Escape):

1. Crie uma conta e veja a confirmação. Volte a Entrar e entre: o destino é Baralhos.
2. Abra **Criar baralho** (página própria), digite um nome e tente voltar. A confirmação de descarte aparece:
   - Cancelar mantém o texto;
   - depois, Salvar.
3. Em Cartões, abra **Criar cartão**, preencha Frente e Verso e salve.
4. No Baralho, use **Adicionar cartões existentes** e vincule o Cartão.
5. Em **Estudar**, escolha a quantidade, Revele o verso e responda Acertei ou Errei. No meio da Sessão:
   - tente ir para Cartões: aparece a confirmação de descarte;
   - Cancele e conclua a Sessão.
6. Confira o Resumo, com estudados, acertos, erros e percentual (2 de 3 = 67%).

Confira em todas as telas:
- sem rolagem horizontal em 360 px e com zoom de 200%;
- foco sempre visível;
- nenhum estado indicado só por cor;
- nenhuma galeria, seletor de cor ou dado de exemplo.

## Referência visual

Compare com `design/prototipo-visual/capturas/*-390.png` e `*-1440.png`. A
reprodução pixel a pixel não é exigida.
