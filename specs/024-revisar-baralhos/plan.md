# Plano — Revisar Baralhos

## Entrega

Alterar aplicação e os dois protótipos existentes, preservando persistência e contratos HTTP. Aplicar as regras FR-378–FR-387 e SC-150–SC-154.

## Desenho

- Estender o Module puro de consulta/revisão no frontend para derivar situação do Baralho e selecionar Cartões pendentes a partir de `listarCartoes`, que já fornece `proximaRevisaoEm`. Receber o instante explicitamente e usar calendário local. Não criar situação gravada por Baralho.
- Lista de Baralhos carrega Baralhos e Cartões com resultados de falha tratados e calcula a situação a partir dos Vínculos. Preservar critérios em recarregamento. Remover critério de situação na consulta de Cartões; filtro passa à consulta de Baralhos e sua fonte na montagem.
- Página de Sessão normal carrega Baralho e Cartões atuais; abre modal de escolha se houver pendentes ou inicia todos se revisado. Centralizar início e limite de 1.000. Remover configuração de quantidade desse percurso; manter Agenda e seleção temporária. A revisão novamente recarrega dados e usa a mesma regra.
- Modal com nome acessível, Cancelar inicialmente focado, Escape, foco contido e saída de cancelamento previsível. Reutilizar os padrões de diálogo existentes; não introduzir dependências.
- Adaptar ações em lista/detalhe/seleção e textos de sessão. Manter nomes de domínio, rotas, navegação Estudo, Agenda e Registros existentes.
- Protótipos simulam as mesmas escolhas e derivam etiquetas dos Cartões demonstrativos. Capturas atualizadas após verificação.

## Verificação

Testes das Interfaces do Module e do DOM: classificação, combinação de filtros, falha, modal, subconjunto pendente, todos e início direto. Atualizar testes anteriores que dependiam da quantidade manual. Adaptar E2E afetados sem remover seus objetivos originais; executar testes frontend, build/lint e E2E pertinentes, ampliando em caso de falhas. Nenhum commit ou publicação solicitado.

## Execução

Código da aplicação delegado a DeepSeek V4 Flash conforme constituição; protótipos também delegados a workers econômicos. Arquiteto registra docs, revisa diffs e executa checks. Não alterar backend sem necessidade concreta descoberta e revisão do plano.
