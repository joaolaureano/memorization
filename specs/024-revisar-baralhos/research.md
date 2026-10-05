# Decisões — Revisar Baralhos

## 2026-10-05 — Pedido e esclarecimentos

O Usuário pediu subagentes baratos, renomear Estudar para Revisar com início direto, mover Situação da revisão de Cartões para Baralhos e inserir etiqueta à esquerda das ações. Confirmou que Pendente deriva da existência de Cartão novo/vencido e Revisado de todos em dia. Para pendentes, pediu uma pequena modal para escolher pendentes ou todos; para revisados, início direto com todos embaralhados. Confirmou escopo aplicação, specs e protótipos.

A primeira inspeção encontrou o repositório limpo e a spec 023 já implementada, diferente da última entrega desta conversa. O escopo foi esclarecido antes de editar a aplicação. Um subagente econômico realizou o mapeamento somente leitura; workers DeepSeek V4 Flash executarão código de aplicação, respeitando a constituição.

Baralho vazio é neutro Sem cartões. Hoje integra os pendentes conforme o calendário local vigente. O filtro não escolhe o conteúdo de uma revisão: a modal define pendentes/todos e a situação apenas filtra Baralhos. A seleção temporária já é uma escolha explícita de conteúdo, portanto Revisar inicia todos sem modal.

Aplicadas as skills domain-modeling para os termos e a relação entre Cartões/Baralhos/Agendamentos e codebase-design para manter classificação e seleção num Module puro, reutilizando Interfaces de cliente existentes. Não há necessidade de nova situação persistida, migração ou endpoint.

## Análise prévia

Conflitos conhecidos com 004/021/022/023 são explicitamente supersedidos na spec 024. Agenda preserva quantidades e sua seleção. O limite de 1.000 já existente no Registro precisa ser verificado antes de iniciar conjuntos completos, evitando uma Sessão irregistrável. Histórico e avaliações mantêm seus contratos. Não há bloqueio crítico documental após os esclarecimentos do Usuário.
