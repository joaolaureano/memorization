# Contrato HTTP e cliente: Agenda

Todas as rotas exigem a Credencial existente; usuarioId vem da autenticação,
nunca do corpo. JSON em português como os contratos existentes. Erros têm
`{ erro, mensagem }`: dados_invalidos (400), nao_encontrado (404), conflito
(409), sobreposicao (409), indisponivel (503) e credencial_recusada (401).
Dado de outro dono responde como inexistente. CORS inclui os caminhos novos.

## Tipos públicos

`RotinaDeEstudo`: id, baralhoId, nomeDoBaralho, dias:number[] (1=seg..7=dom),
quantidade:number|null, estado:'ativa'|'pausada'|'excluida', versao:number,
criadaEm:string. Sem usuarioId público e sem versões internas.

`CompromissoDeEstudo`: rotinaId, data, baralhoId, nomeDoBaralho,
quantidade:number|null, estado:'pendente'|'programado'|'nao_realizado'|'concluido'|'cancelado',
indisponivel:boolean, registroId:string|null.

`SemanaDaAgenda`: inicio:string, hoje:string, fuso:string,
compromissos:CompromissoDeEstudo[], compromissosDeHoje:CompromissoDeEstudo[].
Hoje é devolvido mesmo quando a semana consultada é outra; a UI deriva totais
pela tabela da spec. Configuração efetiva é devolvida, nunca JSON de versões.

`InicioDeCompromisso`: id:string, rotinaId:string, data:string,
baralhoId:string, nomeDoBaralho:string, cartoes:Cartao[],
quantidadeSolicitada:number|null. Os Cartões já foram selecionados no servidor.

## Operações

- GET /agenda?inicio=YYYY-MM-DD&fuso=America/Sao_Paulo → 200 SemanaDaAgenda;
  inicio deve ser segunda-feira, intervalo implícito de sete dias.
- GET /agenda/rotinas → 200 `{ rotinas: RotinaDeEstudo[] }`, ativas e pausadas
  na ordem criadaEm/id; excluídas omitidas, mas histórico permanece.
- POST /agenda/rotinas → 201 `{ rotina: RotinaDeEstudo }` ao criar; 200 nas demais ações e no reenvio idempotente.
  Corpo `{ operacaoId, id?, versao?, acao, baralhoId?, dias?, quantidade?,
  confirmarSobreposicao?, fuso }`.
  acao: criar|editar|pausar|retomar|excluir. Criar/editar exigem configuração
  completa. Outras ações exigem id e versao. Confirmar sobreposição reenvia a
  mesma intenção após confirmação; falhas não consomem operacaoId.
  Reenvio confirmado devolve o resultado anterior; reutilizar operacaoId com
  outra intenção gera conflito.
- POST /agenda/inicios → 201 `{ inicio: InicioDeCompromisso }`.
  Corpo `{ rotinaId, data, fuso }`; só hoje e pendente elegível. A autorização
  pode ser repetida após interrupção; cada início tem seu próprio id.
- POST /sessoes existente aceita `inicioAgendaId?:string`.
  Para Agenda, `id` deve ser igual ao início autorizado; validar origem baralho,
  Baralho capturado e conjunto/quantidade dos Cartões, deriva Frente/Verso/nome
  do snapshot servidor e usa somente Avaliações do cliente. Mesma resposta
  `{ registro }` e mesmo contrato de idempotência da 013/015.

## ClienteDoAcervo

- obterAgenda(inicio:string, fuso:string): Resultado `{ok:true,agenda:SemanaDaAgenda}`.
- listarRotinas(): Resultado `{ok:true,rotinas:RotinaDeEstudo[]}`.
- salvarRotina(dados:DadosDeRotina): Resultado `{ok:true,rotina:RotinaDeEstudo}`.
- iniciarCompromisso(dados:{rotinaId,data,fuso}): Resultado `{ok:true,inicio:InicioDeCompromisso}`.
- registrarSessao recebe inicioAgendaId opcional.

Falhas: `{ok:false,erro,mensagem}` conforme tipos acima e falha do transporte.
O Adapter HTTP valida todas as respostas; guarda-de-credencial envolve as novas
operações. Adapter em memória segue as mesmas regras observáveis para os testes.

## UI

Rotas propostas: #/agenda (gerenciar), #/agenda/nova, #/agenda/:id/editar.
Ver Sessão de um Compromisso concluído navega para `#/sessoes/:registroId` (PaginaDoRegistro existente).
A Sessão autorizada é iniciada após clicar Estudar no componente da Agenda,
com o snapshot mantido em memória do fluxo; recarregar abandona a Sessão e
retorna à Agenda, preservando o Compromisso pendente. Reutilizar PaginaDeEstudo
com propriedade opcional inicioDaAgenda e retorno #/inicio.
Não pôr snapshot, Credencial ou autorização no armazenamento do navegador.
