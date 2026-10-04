# Modelo de dados: Início e área Estudo

**Spec**: [spec.md](spec.md) | **Contrato de UI**: [ui.md](contracts/ui.md)

## Modelo preservado

Nenhuma nova entidade, coluna, tabela, migração ou operação de persistência.
As descrições abaixo são projeções para apresentação, não novos modelos
autoritativos. As regras de integridade continuam nas specs 013, 015 e 016.

| Conceito existente | Dados relevantes | Uso proposto |
|---|---|---|
| Usuário | Nome de usuário | Saudação no Início; propriedade e isolamento continuam no servidor |
| Estatísticas | Registros da janela; cinco recentes; contagens do acervo | Resumo do Início, gráfico e Histórico em Estudo; contagens apenas orientam vazio |
| Resumo da Revisão | Vencidos, novosHoje, total | Revisão do dia no Início |
| Semana da Agenda | Início, hoje, dias e Compromissos | Hoje resumido em Início e semana completa em Estudo |
| Rotina de estudo | Identidade, Baralho, dias, quantidade, estado, versão | Gerenciamento existente em tela própria |
| Compromisso de estudo | Rotina/data, configuração, situação e vínculo de conclusão | Totais e ações do dia |
| Registro de sessão | Identidade, origem, Baralho/nome histórico, instante, estudados, acertos e erros | Estatísticas, últimas Sessões e detalhe |

## Derivações de leitura

- Janela: hoje e os seis dias anteriores, desde a meia-noite local do primeiro
  dia, usando um único instante de referência por leitura.
- Itens estudados: soma de `estudados` dos Registros da janela; não corresponde
  à quantidade de Cartões distintos do acervo.
- Sessões concluídas: quantidade de Registros da janela.
- Taxa de acerto: soma de `acertos` dividida pela soma de `estudados`, vezes
  cem, arredondada para inteiro. Denominador zero significa taxa indefinida.
- Gráfico: soma de Itens em cada um dos sete dias, incluindo dias sem estudo.
- Recentes: até cinco Registros da resposta existente, sem filtrar pela janela
  do gráfico; cada taxa da linha é calculada sobre seu próprio Registro.
- Totais da Agenda: Compromissos distintos não cancelados; indisponíveis
  continuam no denominador. Uma amostra de três no Início não limita o total.

## Estado transitório de apresentação

| Estado | Duração e regra |
|---|---|
| Modo da Agenda: hoje ou semana | Escolhido pela página; sem persistência |
| Semana e dia selecionados | Estado local da Agenda semanal; montagem inicia em Hoje |
| Acompanhando Hoje ou seleção explícita | Determina se a seleção avança na virada de data |
| Dados anteriores, carga e falha | Por bloco; dados antigos exigem indicação textual |
| Identificador da leitura vigente | Impede resposta obsoleta de substituir a mais recente |
| Início autorizado de Compromisso | Memória atual da aplicação; não guardar no navegador |

Não persistir estado de navegação, criar histórico de cliques ou usar a camada
visual como fonte de elegibilidade. O contrato de UI não altera autenticação.

## Transições e invariantes preservadas

- Criar/editar/pausar/retomar/excluir Rotinas mantém as regras de identidade,
  sobreposição, concorrência e efeito sobre hoje/futuro da spec 016.
- Compromisso só se conclui após Registro confirmado da Sessão iniciada por
  ele. Sessão interrompida não produz registro parcial nem conclusão local.
- Estudo livre e Revisão do dia continuam sem concluir Compromissos externos.
- Registros preservam identificação e conteúdo históricos quando o Baralho
  muda ou é excluído.
- Início e Estudo são leitores das mesmas fontes; não duplicam contagens ou
  produzem versões alternativas de Agenda.
