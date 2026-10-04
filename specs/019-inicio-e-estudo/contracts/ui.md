# Contrato de UI e navegação

**Spec**: [spec.md](../spec.md) | **Protótipos**: [prototipos.md](../prototipos.md)

Contrato proposto para implementação futura; os endereços novos ainda não
existem no aplicativo. Nenhuma alteração de contrato HTTP é necessária.

## Destinos e retornos — FR-307/316/317/323

| Endereço | Tela/variante | Navegação ativa | Retorno explícito |
|---|---|---|---|
| `#/inicio` | Início / `inicio` | Início | Não se aplica |
| `#/estudo` | Estudo / `central-de-estudo` (nova) | Estudo | Não se aplica |
| `#/agenda` | Rotinas de estudo / `agenda` | Estudo | Estudo |
| `#/agenda/nova` | Agendar estudo / `nova-rotina` | Estudo | Rotinas de estudo |
| `#/agenda/<id>/editar` | Editar rotina / `editar-rotina` | Estudo | Rotinas de estudo |
| `#/agenda/estudo` | Sessão de Compromisso / `estudo-da-agenda` | Estudo | Preservar saída atual para Início |
| `#/sessoes/<id>` | Registro / `registro` | Estudo | Estudo, inclusive Registro inexistente |
| `#/revisao` | Revisão do dia / `revisao` | Início | Fluxo vigente de revisão/Início |
| `#/baralhos/<id>/estudo` | Sessão livre / `estudo` | Baralhos | Fluxo vigente de Baralhos |
| `#/baralhos` e demais subrotas | Baralhos | Baralhos | Fluxos vigentes |
| `#/cartoes` e demais subrotas | Cartões | Cartões | Fluxos vigentes |
| `#/preferencias` | Preferências | Preferências | Fluxo vigente |

O cabeçalho mantém marca e Sair. A marca leva a Início. A navegação principal
segue Início, Estudo, Baralhos, Cartões, Preferências. O destino ativo tem
`aria-current="page"`. Identificadores continuam codificados como no roteador
atual. Entrar/Criar conta não exibem navegação autenticada.

Hash desconhecido autenticado continua resolvendo em Início. Acesso direto
protegido continua preservando o destino solicitado após autenticação. Não
há alias ou remoção de rota. Recarregar uma Sessão da Agenda sem início
autorizado em memória continua abandonando-a e retornando a Início.

## Início — FR-308–311/314/321

Ordem semântica e visual:

1. `h1` Olá, Nome de usuário; data local; linha Últimos 7 dias com Itens e Taxa.
2. Revisão do dia: vencidos, novos disponíveis e Revisar.
3. Agenda de hoje: concluídos/previstos, amostra e acesso a Estudo.

Desktop >=1024 px: revisão à esquerda, Agenda à direita. Demais larguras:
coluna única na mesma ordem. Estatísticas permanecem texto do cabeçalho, não
uma faixa de cartões de indicadores. Falha estatística aparece nesse espaço.

Agenda mostra até três Compromissos não cancelados, na ordem da spec 016
(criação da Rotina e desempate estável). Não reordenar por situação. Cancelados
permanecem disponíveis no detalhe de Estudo. Totais são sempre do dia inteiro.

| Situação | Apresentação/ação |
|---|---|
| Pendente elegível de hoje | Nome, quantidade, Pendente, Estudar |
| Concluído | Nome, quantidade, Concluído, Ver sessão |
| Indisponível | Nome, motivo, Ajustar rotina para seu formulário |
| Sem Compromissos hoje | Nenhum estudo agendado para hoje; Ver agenda semanal |
| Sem Rotinas | Mensagem e Agendar estudo; permitir consultar semana |
| Todos concluídos, total >0 | Agenda de hoje concluída; Registros continuam acessíveis |
| Mais de três não cancelados | Amostra + Ver todos em Estudo |

O único acesso de rodapé leva a `#/estudo`, iniciando em Hoje: rótulo Ver
agenda semanal quando até três, Ver todos em Estudo quando há mais.
Não acrescentar também um botão duplicado Continuar estudos.

Acervo vazio recebe orientação Criar primeiro Cartão no contexto do vazio,
sem nova seção. Se a consulta necessária falhar, não inferir que o acervo
está vazio. Ausência de estudo no período usa mensagem textual; em Estudo,
Taxa aparece como “—” com explicação. Havendo apenas Cartões novos, manter
Revisar disponível se o total da revisão for positivo.

## Estudo — FR-312–315/319

1. `h1` Estudo, texto breve, Agendar estudo (`#/agenda/nova`) e Gerenciar
   rotinas (`#/agenda`). Essas são as ações do cabeçalho, sem repeti-las em
   todos os blocos.
2. Agenda semanal: intervalo, Semana anterior, Hoje, Semana seguinte; sete
   dias com data e concluídos/previstos; detalhe do selecionado e fuso.
3. Seu estudo nos últimos 7 dias: Itens, Sessões, Taxa e gráfico compacto.
4. Últimas sessões: até cinco linhas acionáveis, sem botão Ver todas ou
   promessa de paginação não existente.

Abertura inicia em Hoje. Semana anterior/seguinte mantém o dia da semana.
Voltar à aba revalida a semana selecionada sem deslocar a escolha. Meia-noite
move a seleção apenas quando ela acompanhava Hoje. Apertar Hoje reinicia esse
acompanhamento. Detalhes mostram a data completa e a situação por texto.

Somente Compromissos pendentes elegíveis de hoje oferecem Estudar. Dias
passados/futuros são consultáveis; cancelados aparecem identificados. Ver
sessão abre o Registro vinculado. A área do calendário não muda de tamanho
ao selecionar um dia; a lista abaixo pode crescer.

## Rotinas e formulários — FR-316/317

Rotinas de estudo tem Voltar para Estudo e Agendar estudo. Cada Rotina mostra
Baralho, dias, quantidade, Ativa/Pausada, indisponibilidade e ações Editar,
Pausar/Retomar, Excluir. Preservar confirmações de consequências e foco de
retorno. Retomar segue confirmação de sobreposição quando aplicável.

Formulário contém Baralho, dias da semana, Todos os cartões/Definir quantidade,
quantidade inteira 1–999 quando aplicável, resumo e Salvar/Cancelar. Cadastro
usa Salvar agendamento; edição usa Salvar alterações. Não acrescentar campos
de horário, data avulsa ou nome da Rotina.

Salvar confirmado leva a Rotinas com mensagem de sucesso. Cancelar e o link
de retorno levam a Rotinas, respeitando descarte. Falha mantém o rascunho;
conflito e sobreposição conservam o tratamento existente. Edição explica o
efeito nos pendentes de hoje e futuros e a preservação do passado; pausas e
exclusões avisam que Sessões já iniciadas podem concluir o compromisso.

## Atualização, erro e segurança — FR-318–320/322/326

| Evento | Leitura/comportamento |
|---|---|
| Entrar na tela | Carregar as fontes pertinentes, com estados independentes |
| Retornar à aba | Revalidar leituras visíveis, mantendo seleção explícita |
| Virar o dia | Recalcular dia/fuso e janelas; rearmar o próximo limite diário |
| Navegar semana | Consultar a semana solicitada; resposta antiga não prevalece |
| Salvar/pausar/retomar/excluir Rotina | Atualizar lista confirmada; Agenda é reconsultada ao retornar |
| Concluir Sessão | Só após persistência; reconsultar dados ao voltar à tela de leitura |
| Falha de consulta | Mensagem no bloco + Tentar novamente; não bloquear blocos independentes |
| Atualização com dados anteriores | Indicar Atualizando…; após falha, avisar possível desatualização |
| Expiração/saída/troca de Usuário | Guardas existentes; descartar resultados da identidade anterior |

Revalidações não criam, alteram ou concluem Compromissos por inferência da UI.
Não prolongam Acesso temporário com atividade sintética. Mensagens de Agenda
concluída nunca afirmam que a Revisão do dia acabou.

## Acessibilidade e apresentação — FR-324/325

- Uma hierarquia de títulos por página, grupos de campos com legenda e erros
  associados ao campo. Calendário com nome completo do dia e estado de seleção.
- Anúncios de carga e sucesso sem roubar foco; erro e confirmação acessíveis;
  preservação do rascunho e foco no primeiro campo inválido.
- Gráfico com valores por dia também disponíveis em texto; situação não
  depende de cor. A taxa não é uma avaliação automática: deriva da declaração
  do próprio Usuário nos Itens estudados.
- Barra inferior até 600 px, cinco áreas iguais com rótulos visíveis. Reservar
  sua altura real e área segura; não ocultar Preferências em um menu novo.
- Contraste mantém os critérios vigentes; alvos >=44 px, nomes com quebra de
  linha. Sete dias cabem em uma linha nas larguras nominais; zoom pode exigir
  reflow. Não reduzir alvos para forçar encaixe.

O contrato não comprova acessibilidade em runtime; a execução futura segue
o [roteiro de validação](../quickstart.md).
