# Contrato de UI — 022

Derivado de [`design/busca-e-filtros/`](../../../design/busca-e-filtros/). Textos exatos em pt-BR.

## Estrutura comum (Baralhos e Cartões)

Ordem no documento, logo após o cabeçalho existente da página:

1. `<section class="filtros" aria-label="Busca e filtros">` com os controles, cada um num `.campo`, com `<label class="rotulo">` visível associado por `for`/`id`.
2. `<div class="resultado-cabecalho">` com:
   - `<p role="status" aria-live="polite" aria-atomic="true">` com a contagem: `1 resultado` ou `N resultados` (inclusive `0 resultados`). Vazio durante carregamento e falha.
   - `<button class="botao botao--secundario">Limpar filtros</button>`: sempre visível. Apaga a busca, volta os seletores a Todos e devolve o foco ao campo de busca.
3. Resultados: um entre carregando, falha com «Tentar novamente», acervo vazio (estado existente), «Nenhum resultado encontrado» ou a lista compacta existente.

Estado «Nenhum resultado encontrado» (só quando há registros, mas nenhum satisfaz os critérios):

```html
<div class="estado-vazio">
  <h2>Nenhum resultado encontrado</h2>
  <p>Altere a busca ou limpe os filtros para ver o acervo.</p>
  <button class="botao botao--secundario">Limpar filtros</button>
</div>
```

Os resultados acompanham cada alteração dos controles, sem botão de envio, e sem mover o foco.

## Baralhos

| Controle | Rótulo | Elemento | Detalhe |
|---|---|---|---|
| Busca | Buscar baralhos | `input type="search"`, `autocomplete="off"` | placeholder «Digite o nome do baralho» |

O painel ocupa uma coluna.

## Cartões

| Controle | Rótulo | Elemento | Opções |
|---|---|---|---|
| Busca | Buscar cartões | `input type="search"`, `autocomplete="off"` | placeholder «Buscar na frente ou no verso» |
| Baralho | Baralho | `select` | Todos · Sem baralho · cada Baralho do Usuário, na ordem de `listarBaralhos` |
| Situação | Situação da revisão | `select` | Todos · Novos · Revisão pendente · Em dia |

Desktop: as três colunas na mesma linha (`1.6fr 1fr 1fr`). Até 760 px: empilhadas.

## CSS (`estilos.css`)

```css
.filtros { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr); gap: 16px; padding: 24px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.filtros--busca-unica { grid-template-columns: 1fr; }
.filtros .campo { min-width: 0; margin: 0; }
.filtros input, .filtros select { width: 100%; min-width: 0; }
.resultado-cabecalho { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 20px 0 8px; }
.resultado-cabecalho p { margin: 0; color: var(--muted); }
@media (max-width: 760px) { .filtros { grid-template-columns: 1fr; padding: 16px; } }
@media (max-width: 420px) { .resultado-cabecalho { align-items: flex-start; flex-wrap: wrap; } }
```

`.filtros--busca-unica` substitui o `:has(...)` do protótipo para o painel de Baralhos. As regras da galeria e da navegação móvel do protótipo não entram.
