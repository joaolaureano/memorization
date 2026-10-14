# Contrato de UI — Seletor de idioma

**Feature**: `027-idioma-da-interface` | FR-002, FR-003, FR-009, FR-010 | Research R3

## Posição

- No cabeçalho, em **todas** as telas: na `Moldura` (com Credencial), entre a navegação e "Sair", e no cabeçalho só com a marca (sem Credencial: Entrar, Criar conta, transições). A Sessão de estudo também o mostra.
- Em larguras de até 600 px, continua no cabeçalho superior junto à marca e a "Sair". Não desce para a barra inferior de navegação.

## Botão

- Conteúdo visual: o ícone de globo (SVG inline, `aria-hidden="true"`) seguido da sigla `PT`, `EN` ou `ES`.
- Nome acessível: `textos.seletor.rotulo(idioma)`, por exemplo "Idioma: Português" / "Language: English" / "Idioma: Español".
- `aria-haspopup="menu"`, `aria-expanded`. O alvo de toque tem pelo menos 44 × 44 px.

## Lista

- `role="menu"` com três `menuitemradio`, nesta ordem: `PT Português`, `EN English`, `ES Español`. Cada nome está escrito no próprio idioma e não muda com o Idioma da interface.
- O atual tem `aria-checked="true"` e uma marca visível de texto ou ícone com rótulo (não só cor).
- Teclado: Enter/Espaço/↓ abrem e focam o atual. ↑/↓/Home/End movem o foco. Enter/Espaço escolhem. Esc fecha sem mudar. Em todos os casos o foco volta ao botão. Clicar fora fecha.

## Efeitos da escolha

1. Todo Texto do produto re-renderiza no novo idioma, sem recarregar a página (FR-004).
2. `<html lang>` passa a `pt-BR` / `en-US` / `es-419`.
3. A região `aria-live="polite"` anuncia `textos.seletor.anuncio`, no novo idioma ("Idioma alterado para Português" / "Language changed to English" / "Idioma cambiado a Español").
4. Campos preenchidos, Sessão de estudo, filtros, rota e foco nos demais elementos não mudam.

## Telas com rótulos derivados

- Histórico, Registro, Resumo e Sessão: a origem `revisao` mostra `textos.sessao.revisaoDoDia`, e a origem `temporario` mostra `textos.sessao.baralhoTemporario`.
- Salvar seleção como Baralho: o campo vem preenchido com `textos.sessao.baralhoTemporario` no idioma vigente na abertura do formulário. Depois de aberto, o campo é da pessoa e não muda com a troca.

## Atualização (2026-10-14, pedido do Product Owner)

- **Posição**: o Seletor fica sempre **à esquerda da marca** `memorization`, em todos os cabeçalhos (com e sem Credencial) e em todas as larguras. Isso substitui "entre a navegação e Sair".
- **Menu**: abre alinhado à esquerda do botão, com a largura do conteúdo. Cada opção (`PT Português`, `EN English`, `ES Español`) fica numa só linha e o menu cabe na tela de 360 px.
- **Telefone**: até 600 px o botão é compacto (globo e sigla, alvo de 44 px). Até 420 px a marca usa 18 px (research R15).
