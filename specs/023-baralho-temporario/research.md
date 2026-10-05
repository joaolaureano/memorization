# Decisões — Baralho temporário

## 2026-10-05 — Primeira especificação

### Pedido e limites

Após a spec 022 e seus protótipos, o Usuário pediu continuar com a outra spec. O contexto identifica a proposta de reunir vários Baralhos e Cartões individuais para um estudo, com opção de salvar ao final. A autorização permanece documental; não inclui implementação da aplicação.

### Evidências e compatibilidade

- A 004 estabelece unicidade de Cartão na Sessão, conteúdo capturado no início, estudo por Baralho e descarte ao interromper.
- A 013 registra Sessões concluídas e exige idempotência, preservação do Histórico e recuperação de falhas. Seu contrato admite até 1.000 Itens por Registro.
- A 015 mantém Agendamento por Cartão/Usuário, não por Vínculo, e aplica Avaliações do estudo livre mesmo quando o Cartão não está vencido.
- A 002 admite nomes repetidos e exige nome não vazio de até 100 caracteres.
- A 003 permite reutilizar os mesmos Cartões em vários Baralhos. Salvar a seleção deve criar Vínculos, não cópias de Cartões.
- A 022 definiu busca textual e filtros, mantendo estudo livre. A seleção temporária amplia o uso dessas regras sem modificar a 022.

### Escolhas confirmadas e perguntas

Confirmados: combinação explícita de fontes, liberdade para estudar novamente, salvamento opcional após o estudo e filtro opcional de revisão pendente.

Foram enviadas duas perguntas ao Usuário: estudar todos os selecionados ou escolher quantidade; agrupar por Baralho, embaralhar tudo ou oferecer escolha. Enquanto não respondidas, o rascunho identifica Q1/Q2 como pendências, sem atribuir aprovação ao Usuário.

### Propostas deste rascunho

Estudar todos os selecionados reduz a diferença entre conferir a seleção, estudar e salvar. Manter grupos por origem responde à preocupação relatada com mistura desordenada, mas a preferência ainda precisa ser confirmada. O primeiro grupo que inclui um Cartão determina sua posição de origem; Cartões individuais ficam ao final.

Montar estudo parte da página Baralhos. A seleção usa referências aos Cartões existentes e é independente de alterações futuras de Vínculos nas fontes. Cada adição é explícita; filtros não alteram conteúdo já selecionado. A opção de salvar cria um Baralho comum, sem sub-Baralhos nem ordem persistente.

Registrar a Sessão e salvar o Baralho são resultados separados: o primeiro integra Histórico e Agendamentos; o segundo organiza o acervo opcionalmente. O Registro confirmado não é reescrito ao salvar. Falhas de salvamento não devem produzir Baralho parcial nem duplicação após resposta perdida.

### Skills

Aplicada `domain-modeling` para definir Baralho temporário, Cartão avulso e Grupo de origem e identificar a ampliação da definição de Sessão. Conforme a constituição, os termos ficam em Key Entities e decisões neste arquivo; não se cria CONTEXT.md ou ADR. Não foi desenhada arquitetura nem criado contrato técnico.

### Verificação documental

Os cenários cobrem sobreposição, estudo só com avulsos, filtros sem alteração da seleção, interrupção, histórico sem Baralho, falha/reenvio e Cartões excluídos. Q1/Q2 impedem considerar a spec fechada para implementação. Nenhum teste executável ou código de aplicação foi criado.

## 2026-10-05 — Esclarecimentos de quantidade, ordem e entrada

O Usuário respondeu Q1 com “Estudar todos os selecionados” e Q2 com “Todos embaralhados juntos”. Também solicitou o botão “Criar baralho temporário” na tela Baralhos, ao lado de “Criar Baralho”, em cor escura conforme o padrão existente.

Foram atualizados FR-360, FR-365 e FR-366, os cenários, as definições e a representação textual. A proposta inicial de agrupamento foi descartada; Grupo de origem deixa de ser conceito desta feature. A mistura aleatória é desejada depois da seleção explícita feita pelo Usuário, distinguindo-se da seleção automática global que motivou a discussão.

O botão novo usa o estilo secundário escuro e Criar Baralho preserva o destaque primário. A ordem proposta de apresentação é Criar Baralho → Criar baralho temporário, com quebra de linha em telas estreitas. Não há seletor de quantidade ou ordem no novo percurso.

O checklist foi revisto à luz das respostas. As notas anteriores permanecem como histórico do rascunho, não como pendências atuais. Nenhum código da aplicação foi alterado.

## 2026-10-05 — Protótipo navegável solicitado

Após esclarecer que havia somente representação textual, o Usuário solicitou criar o protótipo. Foi adicionado `design/baralho-temporario/`, com HTML/CSS/JavaScript demonstrativos, instruções, script próprio de verificação e 20 capturas. `prototipos.md` passou a apontar para o artefato e as imagens.

O botão Criar baralho temporário usa o estilo secundário escuro ao lado de Criar Baralho, que mantém o destaque primário. A montagem usa duas áreas no desktop e uma coluna no celular. Baralhos e Cartões individuais alimentam uma seleção única; todos são embaralhados juntos para a Sessão. O Resumo permite salvar como novo Baralho e abri-lo na demonstração.

O protótipo simula falhas de leitura, registro e salvamento. A seleção destinada ao salvamento é separada dos Itens concluídos: retirar um Cartão indisponível não reescreve o Resumo. Datas e situações de revisão são ilustrativas, sem algoritmo ou persistência real.

A verificação em Chromium passou para cinco telas em quatro larguras, fluxo completo, filtros, unicidade, foco/Escape, avaliação por teclado, validação de nome, recuperação e preservação do Resumo. Foi conferido refluxo com zoom CSS de 200%. Capturas de Baralhos, montagem e salvamento também foram inspecionadas visualmente. Nenhum fonte sob backend, frontend ou e2e foi alterado.

## 2026-10-05 — Implementação integral autorizada

### Contexto e autorização

Depois da 022, o Usuário pediu um novo worktree para as specs restantes do Codex e escolheu «Implementar integralmente, já temos protótipos». Os protótipos de `design/baralho-temporario/` foram copiados do checkout principal para o branch `023-baralho-temporario`.

### Clarify (sessão de 2026-10-05)

O protótipo conflitava com três ajustes de interface já pedidos pelo Usuário na mesma data. Ele decidiu:

- sem o link «← Voltar para Baralhos» na montagem;
- «Estudo com baralho temporário» como texto secundário abaixo de «Sessão concluída», e não como sobretítulo;
- «Sessão registrada no histórico.» só anunciado, como no Resumo vigente.

Estão em `spec.md`, seção Clarifications.

### Decisões do plano

1. **Origem `temporario` no Registro**, com `baralhoId` e nome derivados pelo servidor (`""`, «Baralho temporário»), como já acontecia com a revisão. Alternativas rejeitadas: reutilizar `baralho` com `baralhoId` vazio, que confundiria com Baralho excluído no Histórico (FR-376); e reutilizar `revisao`, que nomearia mal Registros novos.
2. **Migração 11 com reconstrução das tabelas no SQLite.** O `CHECK` de coluna não se altera no SQLite. Com `foreign_keys = ON` dentro da transação, um `DROP` do pai apagaria em cascata os Itens; por isso as duas tabelas são copiadas e as antigas removidas na ordem filho → pai. Alternativa rejeitada: `writable_schema`, um procedimento frágil e sensível ao modo defensivo do driver. No PostgreSQL basta trocar a constraint.
3. **Salvar como gesto único e idempotente**: `POST /baralhos/de-selecao`, com o id gerado no cliente, Baralho e Vínculos numa transação na Porta (`inserirBaralhoComVinculos`). Alternativa rejeitada: compor `POST /baralhos` com N Vínculos, que deixaria Baralho parcial e duplicado após resposta perdida (FR-373).
4. **Validação antes do início pela releitura de `listarCartoes`.** A lista do servidor contém exclusivamente Cartões do dono e é a fonte autoritativa de existência e propriedade (FR-367). O Registro continua tolerante a Cartão sumido durante a Sessão, como já é.
5. **Sessão reaproveitando `PaginaDeEstudo` e `SessaoDeEstudo.iniciar`**, com a quantidade igual ao total, o que dá todos os Cartões embaralhados uma vez. Mesmo padrão da Agenda: a casca guarda a seleção em memória.
6. **Seleção como Module puro** no navegador, sem persistência (FR-375).

### Skills aplicadas

- `codebase-design`: Interface pequena do Module de seleção; a criação atômica escondida na Porta, que já tem dois Adapters reais (SQLite e PostgreSQL), sem Seam nova.
- `domain-modeling`: termos de Key Entities mantidos; a origem `temporario` é um valor de domínio do Registro, e não um Baralho.

### Checklist

Criado `checklists/ux-e-contrato.md` com 16 itens. Na avaliação do Arquiteto, dois não passaram de primeira: CHK002, sem o texto do estado de carregamento da montagem, e CHK004, sem o foco ao voltar do Salvar ao Resumo. `contracts/ui.md` foi corrigido: «Carregando o acervo…»; foco em «Abrir baralho» após o sucesso e em «Salvar como baralho» após Cancelar. Depois disso, 16/16 aprovados. O checklist de requisitos da spec (do Codex) foi mantido como estava.

### Analyze

Sem CRITICAL. Todos os FRs (FR-360 a FR-377) e SCs (SC-143 a SC-149) têm tarefa e prova. Dois edge cases da spec estavam só implícitos nas provas de T2308 e foram explicitados: Baralho de origem excluído depois da adição e Baralho vazio com «Sem cartões». Portão liberado para `implement`.

## Registro de implementação (2026-10-05)

- T2301–T2314 implementadas por workers DeepSeek flash (Princípio XI), revisadas e verificadas pelo Arquiteto; correções de revisão sempre devolvidas ao worker.
- Telefone: o cabeçalho de Baralhos mantém as duas ações numa linha quando cabem (`.cabecalho-da-pagina .acoes .botao { flex: 1 1 auto }` até 480 px); em 390 px «Criar baralho temporário» quebra linha, como o FR-360 permite, e a prova do SC-079 (`e2e/lista-de-baralhos.spec.ts`) passa a exigir cinco linhas inteiras na primeira tela, em vez de seis.
- `npm run verificar:ci` verde: backend 915 (SQLite) + 239 (PostgreSQL), frontend 883, e2e 91.
