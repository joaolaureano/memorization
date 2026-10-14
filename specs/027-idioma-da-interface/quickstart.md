# Quickstart: Idioma da Interface

**Feature**: `027-idioma-da-interface` | Contratos: [http.md](./contracts/http.md), [ui.md](./contracts/ui.md) | Dados: [data-model.md](./data-model.md)

## Pré-requisitos

```bash
npm ci --prefix backend && npm ci --prefix frontend && npm ci --prefix e2e
npm run dev --prefix backend     # API local (SQLite + migração 19)
npm run dev --prefix frontend    # http://localhost:5173
```

## Verificação automatizada

```bash
npm run build --prefix frontend          # tsc: chave faltante em en/es falha aqui (FR-014)
npm test --prefix frontend               # catálogos, sem-texto-solto, seletor, recusas traduzidas
npm test --prefix backend                # recusas.test (inglês/ASCII), migração 19 nos dois adapters
npx playwright test idioma-da-interface --config e2e/playwright.config.ts
npm run verificar:ci                     # portão completo (Princípio X)
```

## Roteiro manual

| # | Passo | Resultado esperado | Requisitos |
|---|---|---|---|
| 1 | Abrir em um navegador limpo configurado em inglês | Tela Entrar em inglês, seletor mostra 🌐 EN, `<html lang="en-US">` | FR-012, FR-009 |
| 2 | Navegador limpo em francês | Abre em Português (🌐 PT) | FR-012 |
| 3 | Na tela Entrar, só teclado: Tab até o seletor, Enter, ↓ até Español, Enter | Tela em espanhol, foco no seletor, anúncio "Idioma cambiado a Español" | FR-002, FR-010, FR-009 |
| 4 | Credencial errada | Recusa em espanhol. No DevTools, a resposta tem `mensagem` em inglês | FR-018, FR-019 |
| 5 | Entrar, abrir um Baralho com Cartões e Tags em português, trocar para EN | Rótulos em inglês, conteúdo idêntico | FR-006, SC-003 |
| 6 | Começar a criar Cartão, digitar Frente, trocar para PT | Texto digitado preservado, rótulos em português | FR-004 |
| 7 | Criar Cartão com Frente repetida, ver a recusa, trocar para ES | A mesma recusa passa a aparecer em espanhol | FR-015 |
| 8 | Sessão de estudo no meio, trocar idioma | Mesma posição na Sessão, níveis de Avaliação traduzidos | FR-004 |
| 9 | Estudo › Histórico com Sessões de Revisão do dia e temporárias antigas, em EN | "Today's review" / "Temporary deck" | FR-020, FR-021 |
| 10 | Estatísticas e Agenda em EN e ES | Meses, dias e decimais no formato do idioma, plurais corretos | FR-008 |
| 11 | Sair, fechar e reabrir | Abre no último idioma escolhido | FR-011, SC-006 |
| 12 | Largura de 360 px, percorrer telas em EN e ES | Nenhum corte ou rolagem horizontal | FR-017, SC-007 |
| 13 | Importar `.apkg` inválido em EN | Recusa em inglês vinda do código `anki_*` | FR-019 |
