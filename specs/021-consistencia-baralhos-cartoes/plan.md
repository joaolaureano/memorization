# Implementation Plan: Consistência entre Baralhos e Cartões

**Spec**: `spec.md` · **Created**: 2026-10-04

## Resumo técnico
Mudança restrita ao frontend (`PaginaDeBaralhos.tsx`, `PaginaDeCartoes.tsx`, `estilos.css`) e às provas que exercitam as duas listagens. Sem APIs, contratos, migrações ou entidades novas (Key Entities da spec).

## Decisões
- **Linha de lista comum**: o vocabulário `linha-de-baralho*` é substituído por `linha-da-lista`, `linha-da-lista__texto`, `__titulo`, `__detalhe` e `__acoes`, usados pelas duas páginas dentro de `lista lista--compacta` (FR-339). A alternativa de manter classes distintas por página foi rejeitada porque permitiria divergência visual.
- **Baralhos**: o nome é texto (`<p>` sem `tabIndex`), a contagem é texto visível logo abaixo e as ações são Estudar (link ou botão desabilitado com `aria-describedby` para o motivo) e Editar (link para `hashDaRota({ nome: "baralho", id })`), com nomes acessíveis "Estudar <nome>" e "Editar <nome>" (FR-340–343, FR-346).
- **Cartões**: o título é a Frente, sem Verso, rótulos ou vínculos; as ações são Excluir e Editar, nessa ordem. Diálogo, anúncio, falha e restauração de foco permanecem iguais (FR-344, FR-345). A descrição de consequências continua usando `cartao.baralhos`.
- **Responsividade**: a linha usa `flex-wrap`; o texto tem `flex: 1 1 12rem` e `overflow-wrap: anywhere`, e as ações ficam em `margin-left: auto` com alvos de 44px. Em larguras estreitas ou com zoom de 200%, as ações descem sem rolagem horizontal (FR-346).
- **Estados**: carregando, vazio, falha e "Tentar novamente" ficam intactos (FR-347).

## Constitution check
Testes pela Interface pública (DOM acessível); rastreabilidade FR → teste em `tasks.md`; delegação DeepSeek flash com revisão de diff e testes pelo Arquiteto.
