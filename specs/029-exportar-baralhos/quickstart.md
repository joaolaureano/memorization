# Quickstart: Exportar Baralhos

**Feature**: `029-exportar-baralhos` | Contratos: [http](./contracts/http.md), [apkg](./contracts/apkg.md), [ui](./contracts/ui.md)

## Pré-requisitos

- `npm run demo` na raiz (API com SQLite e frontend em <http://127.0.0.1:5173>).
- A versão estável do Anki para computador e, para o cenário 11, um aparelho Android com AnkiDroid e um iPhone com AnkiMobile (FR-463).
- Uma conta com três Baralhos:
  - "Inglês", com 5 Cartões Frente-Verso (um com quebra de linha e `<b>` no texto, um com a Tag `verbo irregular`);
  - "Mídia", com 1 Cartão de Imagem e 1 de Áudio;
  - "Vazio", sem Cartões.
- Estude "Inglês" uma vez e avalie dois Cartões.

## Portões automáticos

```bash
npm run verificar:ci   # gitleaks, backend + PostgreSQL, frontend + build, e2e
```

## Roteiro

1. **Um Baralho, 3 interações**: no detalhe de "Inglês", Exportar → Exportar arquivo. Baixa `Inglês.apkg` (SC-183).
2. **Resumo**: na lista, Exportar e marcar "Inglês" e "Mídia". O resumo mostra 2 Baralhos, 7 Cartões, "1 com Imagem, 1 com Áudio" e o tamanho aproximado.
3. **Todos**: "Todos os Baralhos" → Exportar arquivo. Baixa `memorization-AAAA-MM-DD.apkg`.
4. **Vazio**: marcar só "Vazio". O botão fica desabilitado e diz que não há Cartões.
5. **Teclado e leitor de tela**: repetir o cenário 2 só com teclado. "Gerando arquivo…" e o resultado são anunciados.
6. **Idiomas**: repetir o cenário 1 em English e Español. Os textos mudam, e o nome do arquivo e o conteúdo não mudam.
7. **Exclusão de conta**: no Perfil, abrir a exclusão. O link "Exportar meu acervo antes" abre a Exportação com todos marcados, e a exclusão continua possível sem exportar. Exporte, exclua a conta e confirme que o endereço da Exportação deixa de funcionar e que `exportacoes/{usuarioId}` some do armazém (FR-479).
8. **Anki, textos**: importar `Inglês.apkg` no Anki. Frente, Verso, quebra de linha, `<b>` literal e a Tag `verbo_irregular` estão corretos (SC-184).
9. **Anki, progresso**: importar marcando "Importar progresso de estudo". Os dois Cartões avaliados aparecem em revisão com a mesma data da Agenda do app, e os demais aparecem como novos (SC-189). Registrar se a opção vem marcada por padrão (research R8, `premissa a validar`).
10. **Anki, mídia**: importar o pacote de "Mídia". A Imagem aparece e o Áudio toca (SC-189).
11. **AnkiDroid e AnkiMobile**: importar o pacote do cenário 3 nos dois. Os três Baralhos aparecem, inclusive "Vazio", sem Cartões (FR-463, FR-465).
12. **Reimportar no Anki**: exportar "Inglês" de novo e importar. As notas são atualizadas, não duplicadas (FR-467).
13. **Reimportar no app**: importar `Inglês.apkg` em `#/baralhos/importar`. Frentes e Versos voltam equivalentes (espaços normalizados), e `verbo irregular` volta como `verbo_irregular` (SC-184, research R14).
14. **Isolamento**: com outro Usuário, chamar `POST /exportacoes/previa` com o id de um Baralho do primeiro. Resposta `404` (SC-187).
15. **Expiração**: guardar a `url` de uma Exportação e abri-la 16 minutos depois. Acesso negado (FR-481).
16. **Desempenho na nuvem** (depois do deploy):
    - acervo de 1.000 Cartões sem mídia: até 10 s do clique ao início do download (SC-186);
    - acervo de 10.000 Cartões com cerca de 100 MiB de mídia: concluir em até 25 s (SC-191).
17. **Armazém fora do ar** (local): parar o armazém de mídia e exportar um Baralho com Imagem. A exportação falha com "Tentar de novo", sem download (FR-477).
