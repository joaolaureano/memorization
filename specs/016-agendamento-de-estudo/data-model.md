# Data model: Agenda

## RotinaDeEstudo

- id opaco, usuarioId, criadaEm, versao positiva de concorrência.
- baralhoId, nomeDoBaralho, dias (inteiros únicos 1=segunda ... 7=domingo,
  ao menos um), quantidade (null=Todos ou inteiro 1..999).
- estado ativa/pausada/excluida; excluída é tombstone para preservar passado.
- versões da configuração com data civil de início e ordem de alteração.
  Repetidas alterações no mesmo dia substituem a projeção pendente, preservando
  conclusões e snapshots de início. Versões anteriores explicam dias passados.
- id da operação de gravação e resultado para reenvio idempotente.

## CompromissoDeEstudo

- identidade estável derivada de rotinaId + data YYYY-MM-DD dentro do dono.
- configuração capturada, estado pendente/programado/nao_realizado/concluido/cancelado;
  indisponibilidade do Baralho é atributo independente.
- registroId opcional: primeiro Registro confirmado, imutável.
- projeção por semana a partir das versões; persistir exceções/conclusões.
- cancelado não conta nos totais; concluído conta mesmo se a Rotina foi excluída.

## InicioDeCompromisso

- id aleatório gerado no servidor, usuarioId, rotinaId, data, iniciadoEm, fuso.
- baralhoId, nomeDoBaralho e quantidade efetiva capturados.
- Cartões selecionados no servidor, sem repetição, com Frente/Verso capturados.
- não guarda Avaliações intermediárias. Só a conclusão guarda resultados.
- o id é usado como id do Registro e como inicioAgendaId na conclusão;
  proprietário e conjunto exato de Cartões são verificados no servidor.

## Persistência

Migração 8 acrescenta tabelas de Rotinas/versionamento, Compromissos concluídos
ou cancelados e Inícios autorizados, com chaves por dono e índices para a semana.
O Adapter pode representar a lista de versões em JSON dentro da Rotina;
restrições de domínio permanecem no Module e unicidades também no banco.

Rotinas conservam versões e nomes passados quando renomear/excluir Baralho.
FK de Baralho não deve apagar a programação: indisponibilidade é exibida.
Atualização exige versao esperada; conflito retorna desfecho tipado.

## Transações

- Salvar Rotina: validar dono/elegibilidade e overlap, detectar reenvio por
  operacaoId, comparar versão e gravar nova versão de forma atômica.
- Iniciar: conferir hoje pelo fuso/relógio servidor, dono, elegibilidade e
  compromisso não concluído; selecionar e guardar snapshot antes de responder.
- Concluir: validar snapshot e avaliações, gravar Registro, Agendamentos dos
  Cartões e primeira conclusão do Compromisso numa transação. Reenvio retorna
  Registro existente sem reaplicar. Duas autorizações distintas podem gerar
  dois Registros, mantendo uma conclusão do Compromisso.
- Falha em qualquer gravação reverte toda a transação.

## Implementação: efeito de hoje e leituras serializadas

- Cancelamentos e reativações de hoje (FR-238, FR-239) são gravados **na mesma
  transação** da nova versão da Rotina (`GravacaoDeRotina.cancelamentos` e
  `reativacoes`). O cancelamento só cria a linha `cancelado` quando ainda não há
  linha para a Rotina/data — uma conclusão nunca é sobrescrita; a reativação só
  remove `cancelado`.
- `obterOperacaoDeRotina` permite reconhecer o reenvio **antes** de qualquer
  checagem que dependa do estado atual (versão, estado, sobreposição).
- `inserirRegistroDaAgenda` lê Agendamentos e Preferências dentro da transação
  serializada por Usuário (SQLite `BEGIN IMMEDIATE`; PostgreSQL `FOR UPDATE` na
  linha de `usuario`) e chama a função de domínio que calcula os Agendamentos.

## Datas e limites

Rejeitar datas inexistentes (incluindo 31/02), fuso inválido e janelas que não
sejam sete dias. Hoje é derivado no servidor com o fuso IANA enviado pelo
navegador. Data capturada do Compromisso não muda na conclusão após meia-noite.

## Restrição vinda da 017 (exclusão definitiva do Usuário)

A feature `017-gerenciar-conta-usuario` exclui o Usuário com um único comando,
confiando nas cascatas do esquema (017, data-model e FR-274). Toda tabela da
Agenda de estudo que guarde dados de um Usuário (Rotina de estudo, Compromisso
de estudo e o registro de início de um Compromisso) MUST referenciar o Usuário
com `REFERENCES usuario(id) ON DELETE CASCADE`, direto ou pela cadeia de chaves
estrangeiras, nos dois Adapters. A bateria da Porta da 016 MUST provar que
excluir um Usuário remove a Agenda dele e preserva a de outro Usuário.

