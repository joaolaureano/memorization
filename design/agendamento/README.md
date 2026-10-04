# Agenda — proposta de UI

Status: protótipo ilustrativo, sem implementação no produto.

A especificação normativa está em [016 — Agendamento de estudo](../../specs/016-agendamento-de-estudo/spec.md). Em caso de diferença, a spec prevalece; o protótipo cobre apenas parte dos fluxos.

Abra `index.html` no navegador. Os dados são ilustrativos e voltam ao estado
inicial ao recarregar. É possível selecionar dias, criar um estudo recorrente
e simular a conclusão de uma Sessão.

## Início

1. **Hoje**: data, estudos concluídos/previstos e ação para o próximo estudo.
2. **Sua semana**: segunda a domingo, cada dia com data e contagem. Hoje tem
   contorno; o dia selecionado tem fundo destacado. Estado também aparece em
   texto: Concluído, Pendente, Parcial, Não realizado, Programado ou Sem estudos.
3. **Estudos do dia selecionado**: Baralho, quantidade, recorrência, situação e
   ação Estudar. O link Gerenciar agenda abre as rotinas cadastradas.
4. O bloco existente de Revisão do dia permanece independente, seguido das
   Estatísticas e do Histórico. “Agenda de hoje concluída” se refere apenas
   aos compromissos da Agenda; não promete que as revisões estão em dia.

Em telas pequenas, os sete dias continuam na mesma linha, com abreviações e
alvos de pelo menos 44 px. Detalhes e rótulos completos aparecem abaixo ao
selecionar. Listas e formulário usam uma coluna; nenhuma informação depende
apenas da cor. O calendário é um grupo de botões de seleção, utilizável por Tab.

## Agendar estudo

- Baralho: seleção entre os Baralhos do Usuário.
- Repetir: botões independentes Seg, Ter, Qua, Qui, Sex, Sáb, Dom.
- Quantidade: todos os Cartões ou quantidade definida.
- Resumo antes de salvar: “Inglês · toda segunda e quinta · 20 Cartões”.
- Ações: Salvar agendamento e Cancelar.

Gerenciar agenda deve oferecer editar, pausar/retomar e excluir. A proposta
visual desta primeira rodada concentra-se no calendário e na criação.

## Regras da primeira exploração (histórico)

- A recorrência é semanal e não exige horário. Lembretes ficam para outra etapa.
- Um compromisso é concluído quando a Sessão iniciada por ele é concluída e
  seu Registro é confirmado. Interromper ou falhar ao salvar mantém pendente;
  tentar novamente não duplica a conclusão.
- Uma Sessão iniciada fora da Agenda continua no Histórico, sem marcar
  automaticamente compromissos. Essa associação explícita evita concluir duas
  rotinas do mesmo Baralho com um único estudo.
- Dia passado incompleto mostra “Não realizado” e a contagem. Não acumula
  automaticamente no próximo dia. Dias futuros mostram “Programado”.
- Dia vazio mostra “Sem estudos”, sem tratá-lo como concluído ou perdido.
- Editar ou pausar uma rotina afeta ocorrências futuras; conclusões passadas
  são preservadas. Criar hoje inclui hoje quando o dia da semana foi escolhido.
- Baralho vazio ou excluído mostra “Baralho indisponível”, ação para ajustar
  a rotina e nenhuma conclusão automática.
- O dia segue o fuso do navegador, como o Início atual. Viagens e mudança de
  fuso precisam de decisão antes da especificação final.
- Carregamento, falha com Tentar novamente e ausência de rotinas têm estados
  próprios. Falha ao salvar preserva o formulário e não anuncia sucesso.

## Vocabulário

“Agenda” é o rótulo visual de Agenda de estudo. Agendar estudo cria uma
Rotina de estudo semanal por Baralho, que origina Compromissos de estudo por
data. “Agendamento do cartão” mantém o significado da spec 015: a próxima
revisão calculada pela repetição espaçada.

## Continuação pelo Spec Kit

A [spec 016](../../specs/016-agendamento-de-estudo/spec.md) registra os fluxos
completos, inclusive gerenciamento, datas e concorrência não demonstrados neste
HTML. Seu [checklist](../../specs/016-agendamento-de-estudo/checklists/requirements.md)
registra a revisão documental. As premissas A-01 a A-07 são os pontos propostos
para a etapa `speckit-clarify`, antes do planejamento técnico.
