# Protótipos de UI — Início e Estudo

**Feature**: [019 — Início e Estudo](spec.md)

**Plano**: [plan.md](plan.md) | **Regras e navegação**: [contracts/ui.md](contracts/ui.md)

Wireframes de baixa fidelidade, conforme o formato escolhido pelo Usuário.
Dados e nomes são fictícios. Os desenhos mostram hierarquia, conteúdo e ações;
não são telas implementadas, imagens em escala ou um protótipo navegável.

## Direção visual

Preservar a identidade atual: fundo escuro, superfícies discretas, texto claro,
acento azul e cantos arredondados. A redução de informação vem da distribuição
entre telas, do espaço entre seções e da hierarquia de ações.

| Elemento | Direção |
|---|---|
| Boas-vindas | Nome em destaque, data e uma linha de Estatísticas em texto secundário |
| Revisão do dia | Ação principal do Início; botão azul Revisar |
| Agenda de hoje | Lista curta, sem calendário nem barra de manutenção |
| Estudo | Agenda primeiro, gráfico compacto depois, últimas Sessões ao final |
| Rotinas | Tela própria de manutenção; ações identificadas por texto |
| Navegação móvel | Cinco destinos visíveis em áreas iguais, sem menu adicional |
| Estados | Texto explícito; cor apenas reforça a mensagem |

Fluxo principal:

```text
Entrar → Início ── Revisar ───────────────→ Revisão do dia
            │
            ├── Estudar compromisso ────→ Sessão da Agenda
            │
            └── Estudo ── Agendar estudo → Formulário ── Salvar → Rotinas
                    │                                         │
                    ├── Gerenciar rotinas ─────────────────────┘
                    │         └── Editar → Formulário → Rotinas
                    │
                    └── Últimas sessões → Registro → Voltar para Estudo
```

Ao salvar/cancelar um formulário, o destino é Rotinas. As saídas de Sessões
ativas preservam os fluxos vigentes; o diagrama não representa retomada de
Sessão interrompida nem conclusão de Compromisso por estudo livre.

## UI-01 — Início / desktop

Referência de composição: 1440 px, conteúdo centralizado, duas colunas após o
cabeçalho. FR-307–311, FR-314. Validação: V01–V03 e V05.

```text
 memorization     Início   Estudo   Baralhos   Cartões   Preferências     Sair
                  ━━━━━━
 ──────────────────────────────────────────────────────────────────────────

 Olá, João
 Domingo, 4 de outubro
 Últimos 7 dias: 120 itens estudados · 84% de acerto

 ┌────────────────────────────────┐  ┌────────────────────────────────────┐
 │ REVISÃO DO DIA                 │  │ AGENDA DE HOJE                     │
 │                                │  │ 1 de 3 estudos concluídos          │
 │ 18 cartões para revisar        │  │                                    │
 │ + 5 cartões novos disponíveis  │  │ Inglês · 20 cartões                │
 │                                │  │ Pendente                 [Estudar] │
 │ [          Revisar          ]  │  │                                    │
 │                                │  │ História · Todos os cartões        │
 │                                │  │ Concluído             [Ver sessão] │
 │                                │  │                                    │
 │                                │  │ Biologia · 10 cartões              │
 │                                │  │ Pendente                 [Estudar] │
 │                                │  │                                    │
 │                                │  │ Ver agenda semanal →               │
 └────────────────────────────────┘  └────────────────────────────────────┘

                   Fim do conteúdo da tela inicial
```

- O resumo informa atividade, não tamanho do acervo. Nenhuma contagem total de
  Cartões ou Baralhos reaparece como indicador.
- Revisão e Agenda podem ter alturas naturais diferentes; não adicionar
  textos, indicadores ou ilustrações apenas para preencher espaço.
- Com quatro ou mais Compromissos não cancelados, mostrar somente três e
  trocar o link inferior por **Ver todos em Estudo**. A contagem permanece
  completa, por exemplo, “1 de 4 estudos concluídos”.
- Estudar é uma ação secundária por linha. Não há botão duplicado Continuar
  estudos, cadastro permanente ou atualização manual nesse bloco.

## UI-02 — Início / celular

Referência: 390 px, também validável em 360 px. FR-309–311, FR-324/325.
Validação: V02, V03 e V11. Escala tipográfica e largura reais serão verificadas
na implementação; a largura em caracteres abaixo não representa pixels.

```text
┌─────────────────────────────────────────────────────┐
│ memorization                                   Sair │
│                                                     │
│ Olá, João                                           │
│ Domingo, 4 de outubro                               │
│ Últimos 7 dias                                      │
│ 120 itens estudados · 84% de acerto                   │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ REVISÃO DO DIA                                  │ │
│ │ 18 cartões para revisar                         │ │
│ │ + 5 cartões novos disponíveis                   │ │
│ │ [                  Revisar                   ] │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ AGENDA DE HOJE                                      │
│ 1 de 3 estudos concluídos                           │
│                                                     │
│ Inglês · 20 cartões                                 │
│ Pendente                                 [Estudar] │
│                                                     │
│ História · Todos os cartões                         │
│ Concluído                             [Ver sessão] │
│                                                     │
│ Biologia · 10 cartões                               │
│ Pendente                                 [Estudar] │
│                                                     │
│ Ver agenda semanal →                               │
│                                                     │
│ [Espaço reservado para a barra e área segura]        │
├─────────┬─────────┬─────────┬─────────┬─────────────┤
│ Início  │ Estudo  │Baralhos │ Cartões │ Preferências│
└─────────┴─────────┴─────────┴─────────┴─────────────┘
```

Na implementação, as cinco células da navegação têm a mesma largura, mesmo
que o desenho use larguras aproximadas. Rótulos podem quebrar linha, sem
abreviação ou truncamento. O conteúdo pode rolar verticalmente; não há promessa
de acomodar todos os compromissos na primeira dobra de qualquer celular.

## UI-03 — Estudo / desktop

Referência: 1440 px. FR-312–315, FR-318/319. Validação: V04, V05 e V07.

```text
 memorization     Início   Estudo   Baralhos   Cartões   Preferências     Sair
                          ━━━━━━
 ──────────────────────────────────────────────────────────────────────────

 Estudo                         Gerenciar rotinas →    [Agendar estudo]
 Organize sua semana e acompanhe suas sessões.

 ┌───────────────────────────────────────────────────────────────────────┐
 │ AGENDA SEMANAL                                                       │
 │ 28 de setembro a 4 de outubro                                       │
 │                [Semana anterior] [Hoje] [Semana seguinte]            │
 │                                                                     │
 │   Seg 28   Ter 29   Qua 30   Qui 01   Sex 02   Sáb 03   [Dom 04]     │
│     2/2      1/1      0/2      1/1      1/1      0/0       1/3        │
 │                                                           Hoje      │
 │                                                                     │
 │ Domingo, 4 de outubro · Hoje · Parcial                               │
 │ 1 de 3 estudos concluídos                                           │
 │                                                                     │
 │ Inglês       20 cartões          Pendente                [Estudar]  │
 │ História     Todos os cartões    Concluído            [Ver sessão]  │
 │ Biologia     10 cartões          Pendente                [Estudar]  │
 │                                                                     │
 │ Fuso: America/Sao_Paulo                                             │
 └───────────────────────────────────────────────────────────────────────┘

 ┌───────────────────────────────────────────────────────────────────────┐
 │ SEU ESTUDO NOS ÚLTIMOS 7 DIAS                                       │
 │ 120 itens estudados · 8 sessões concluídas · 84% de acerto            │
 │                                                                     │
 │      20       10        0       30       20        0       40         │
 │       ▄        ▂                 ▆        ▄                 █         │
 │      Seg      Ter      Qua      Qui      Sex      Sáb      Hoje       │
 └───────────────────────────────────────────────────────────────────────┘

 ÚLTIMAS SESSÕES
 História           Hoje, 09:10          90% de acerto                 →
 Inglês             Hoje, 08:00          85% de acerto                 →
 Revisão do dia     02/10, 18:30          80% de acerto                 →
 Inglês             02/10, 08:00          90% de acerto                 →
 História           01/10, 19:00          80% de acerto                 →
```

Os números da Agenda ilustram estados diários, não derivam das oito Sessões
do gráfico. Uma Sessão livre pode aparecer nas Estatísticas sem concluir um
Compromisso. Os exemplos não sugerem ligação automática entre esses números.

A seleção do calendário tem estado acessível e cada dia informa nome completo,
data, situação e concluídos/previstos ao leitor de tela. O gráfico oferece seus
valores também em texto. Não há Atualizar agenda nem acesso a um histórico
completo ainda não especificado.

## UI-04 — Estudo / celular

Referência: 390 px. FR-312–315, FR-324/325. Validação: V04, V05 e V11.

```text
┌─────────────────────────────────────────────────────┐
│ memorization                                   Sair │
│                                                     │
│ Estudo                                              │
│ Organize sua semana e acompanhe suas sessões.        │
│ [               Agendar estudo                  ] │
│ Gerenciar rotinas →                                 │
│                                                     │
│ AGENDA SEMANAL                                      │
│ 28 de setembro a 4 de outubro                       │
│ [Semana anterior] [Hoje] [Semana seguinte]           │
│                                                     │
│  Seg    Ter    Qua    Qui    Sex    Sáb    Dom       │
│   28     29     30     01     02     03    [04]      │
│  2/2    1/1    0/2    1/1    1/1    0/0    1/3      │
│                                                     │
│ Domingo, 4 de outubro · Hoje                        │
│ Parcial · 1 de 3 estudos concluídos                 │
│                                                     │
│ Inglês · 20 cartões                                 │
│ Pendente                                 [Estudar] │
│ História · Todos os cartões                         │
│ Concluído                             [Ver sessão] │
│ Biologia · 10 cartões                               │
│ Pendente                                 [Estudar] │
│ Fuso: America/Sao_Paulo                              │
│                                                     │
│ SEU ESTUDO NOS ÚLTIMOS 7 DIAS                        │
│ 120 itens estudados · 8 sessões concluídas           │
│ 84% de acerto                                       │
│                                                     │
│  20     10      0     30     20      0     40         │
│   ▄      ▂             ▆      ▄             █         │
│ Seg    Ter    Qua    Qui    Sex    Sáb    Hoje        │
│                                                     │
│ ÚLTIMAS SESSÕES                                     │
│ História                                         → │
│ Hoje, 09:10 · 90% de acerto                          │
│ Inglês                                           → │
│ Hoje, 08:00 · 85% de acerto                          │
│ Revisão do dia                                   → │
│ 02/10, 18:30 · 80% de acerto                         │
│ Inglês                                           → │
│ 02/10, 08:00 · 90% de acerto                         │
│ História                                         → │
│ 01/10, 19:00 · 80% de acerto                         │
│                                                     │
│ [Espaço reservado para a barra e área segura]        │
├─────────┬─────────┬─────────┬─────────┬─────────────┤
│ Início  │ Estudo  │Baralhos │ Cartões │ Preferências│
└─────────┴─────────┴─────────┴─────────┴─────────────┘
```

As seções mantêm ordem única, sem abas. Em 768 px, usar a mesma ordem com
mais espaço. Em 360 px, o calendário usa a largura necessária para sete alvos
de pelo menos 44 px. Sob zoom de 200%, permitir reflow em vez de reduzir alvos.

## UI-05 — Rotinas de estudo / desktop e celular

FR-316/323. Validação: V06 e V11. Cabeçalho global e barra inferior seguem os
exemplos anteriores, com Estudo ativo.

```text
 ← Voltar para Estudo

 Rotinas de estudo                                  [Agendar estudo]

 ┌──────────────────────────────────────────────────────────────────┐
 │ Inglês                                                 Ativa     │
 │ Segunda, quarta e sexta · 20 cartões por estudo                   │
 │ [Editar]  [Pausar]  [Excluir]                                     │
 ├──────────────────────────────────────────────────────────────────┤
 │ História                                               Pausada   │
 │ Terça e quinta · Todos os cartões                                 │
 │ [Editar]  [Retomar]  [Excluir]                                    │
 └──────────────────────────────────────────────────────────────────┘
```

```text
┌──────────────────────────────────────────┐
│ ← Voltar para Estudo                     │
│                                          │
│ Rotinas de estudo                        │
│ [          Agendar estudo             ] │
│                                          │
│ Inglês · Ativa                           │
│ Segunda, quarta e sexta                  │
│ 20 cartões por estudo                    │
│ [Editar] [Pausar] [Excluir]               │
│                                          │
│ História · Pausada                       │
│ Terça e quinta                           │
│ Todos os cartões                         │
│ [Editar] [Retomar] [Excluir]              │
└──────────────────────────────────────────┘
```

As três ações podem quebrar em mais de uma linha para manter alvos e nomes
legíveis. Exclusão continua com confirmação, não é uma ação imediata.

## UI-06 — Cadastro e edição / desktop e celular

FR-317. Validação: V06 e V11. Formulário de largura contida no desktop e uma
coluna no celular. Sem horários ou data avulsa.

```text
 ← Voltar para Rotinas de estudo

 Agendar estudo

 Baralho
 [ Inglês                                                   ▾ ]

 Dias da semana
 [Seg ✓] [Ter] [Qua ✓] [Qui] [Sex ✓] [Sáb] [Dom]
 A rotina se repete toda semana.

 Quantidade por estudo
 ( ) Todos os cartões
 (●) Definir quantidade     [20]
 De 1 a 999. Se houver menos cartões, serão usados os disponíveis.

 ┌──────────────────────────────────────────────────────────────┐
 │ RESUMO                                                       │
 │ Inglês · segunda, quarta e sexta · 20 cartões por estudo      │
 └──────────────────────────────────────────────────────────────┘

 [Salvar agendamento]    Cancelar
```

```text
┌──────────────────────────────────────────┐
│ ← Voltar para Rotinas de estudo          │
│                                          │
│ Editar rotina                            │
│                                          │
│ Baralho                                  │
│ [ Inglês                             ▾ ]│
│                                          │
│ Dias da semana                           │
│ [✓] Segunda   [ ] Terça   [✓] Quarta      │
│ [ ] Quinta    [✓] Sexta   [ ] Sábado      │
│ [ ] Domingo                              │
│ A rotina se repete toda semana.          │
│                                          │
│ Quantidade por estudo                    │
│ ( ) Todos os cartões                     │
│ (●) Definir quantidade                   │
│ Quantos cartões por estudo               │
│ [20                                    ]│
│                                          │
│ RESUMO                                   │
│ Inglês · segunda, quarta e sexta         │
│ 20 cartões por estudo                    │
│                                          │
│ A mudança vale para estudos pendentes   │
│ de hoje e os próximos. Passados e        │
│ concluídos são preservados. Dias        │
│ removidos cancelam pendentes de hoje.    │
│ Sessões já iniciadas ainda podem        │
│ concluir o compromisso de hoje.          │
│                                          │
│ [          Salvar alterações          ] │
│ Cancelar                                 │
└──────────────────────────────────────────┘
```

Seleção dos dias da Rotina é independente do calendário de sete dias da
Agenda: aqui os controles podem quebrar em linhas. No cadastro, omitir o aviso
de efeitos de edição e usar Salvar agendamento. A validação identifica e foca
o campo inválido; ao salvar, a mensagem aparece em Rotinas.

## UI-07 — Estados vazios e ausência de estudo

FR-310/321. Validação: V09. Estados substituem somente seu conteúdo local.

```text
 INÍCIO SEM ESTUDO NO PERÍODO
 Olá, João
 Domingo, 4 de outubro
 Nenhum item estudado nos últimos 7 dias.

 ┌───────────────────────────┐  ┌────────────────────────────────┐
 │ REVISÃO DO DIA            │  │ AGENDA DE HOJE                 │
 │ Nada para revisar hoje    │  │ Nenhum estudo agendado         │
 │ Sem cartões vencidos ou   │  │ para hoje.                     │
 │ novos disponíveis hoje.   │  │                                │
 │ [Revisar — indisponível]  │  │ Ver agenda semanal →           │
 └───────────────────────────┘  └────────────────────────────────┘

 SEM ROTINAS (variante do bloco Agenda ou da tela Rotinas)
 Você ainda não tem rotinas de estudo.
 [Agendar estudo]

 ACERVO VAZIO (orientação dentro do estado vazio do Início)
 Crie seu primeiro cartão para começar.
 [Criar primeiro Cartão]

 ESTUDO SEM HISTÓRICO
 Seu estudo nos últimos 7 dias
 0 itens estudados · 0 sessões concluídas · Taxa de acerto: —
 Sem itens estudados no período para calcular a taxa.
 Seg 0 · Ter 0 · Qua 0 · Qui 0 · Sex 0 · Sáb 0 · Hoje 0

 Últimas sessões
 Você ainda não concluiu nenhuma sessão.
 [Ir para Baralhos]
```

Se o acervo estiver vazio, o próximo passo das últimas Sessões passa a ser
Criar primeiro Cartão. Se somente a janela estiver vazia, Registros recentes
mais antigos continuam aparecendo. Não confundir ausência de sessão com acervo
vazio ou consulta falha. No formulário sem Baralho elegível, manter os caminhos
atuais Criar Baralho e Ir para Baralhos.

## UI-08 — Carga, falha e recuperação

FR-318–320. Validação: V07/V08.

```text
 AGENDA DE HOJE — primeira carga
 Carregando a agenda…
 [Nenhuma contagem provisória]

 AGENDA DE HOJE — falha sem dados anteriores
 Não foi possível carregar a agenda.
 [Tentar novamente]

 AGENDA DE HOJE — revalidação em andamento
 Atualizando a agenda…
 1 de 3 estudos concluídos  (última leitura)
 [Lista anterior permanece no espaço reservado]

 AGENDA DE HOJE — revalidação falhou
 Não foi possível atualizar. Os dados abaixo podem estar desatualizados.
 [Tentar novamente]
 1 de 3 estudos concluídos  (última leitura)

 REVISÃO DO DIA — falha independente
 Não foi possível carregar a revisão do dia.
 [Tentar novamente]

 RESUMO ESTATÍSTICO — falha independente
 Não foi possível carregar suas estatísticas. [Tentar novamente]

 FORMULÁRIO — operação falhou
 Baralho: Inglês   Dias: Seg, Qua, Sex   Quantidade: 20
 Não foi possível salvar. Os dados preenchidos foram preservados.
 [Salvar agendamento]  Cancelar
```

O restante da página e sua navegação continuam disponíveis. “Tentar novamente”
é recuperação de uma falha, não um botão permanente de atualização. Mensagens
de carga/sucesso usam anúncio acessível; falhas não são anunciadas como vazio.

## UI-09 — Conclusão, indisponibilidade e confirmação

FR-316/317/322. Validação: V06/V10.

```text
 AGENDA DE HOJE
 Agenda de hoje concluída
 3 de 3 estudos concluídos
 História · Concluído                              [Ver sessão]
 Ver agenda semanal →

 REVISÃO DO DIA (permanece independente)
 18 cartões para revisar · + 5 novos disponíveis
 [Revisar]

 COMPROMISSO INDISPONÍVEL
 Biologia · 10 cartões
 Baralho indisponível: não há cartões para estudar.
 [Ajustar rotina]

 ROTINA SALVA
 Rotina de Inglês criada: segunda, quarta e sexta · 20 cartões.
 [Lista atualizada em Rotinas de estudo]
```

Se a indisponibilidade vier de Baralho excluído, a mensagem informa essa causa.
O Compromisso indisponível permanece no total; não se torna concluído.

```text
 ┌─────────────────────────────────────────────────────────────┐
 │ Excluir a rotina de Inglês?                                 │
 │                                                             │
 │ Estudos pendentes de hoje serão cancelados e novos estudos  │
 │ deixarão de ser programados. Passados, concluídos, cartões, │
 │ baralhos e histórico serão preservados.                     │
 │ Sessões já iniciadas ainda poderão concluir o compromisso  │
 │ de hoje. Excluir uma rotina não pode ser desfeito.           │
 │                                                             │
 │ [Cancelar]                                  [Excluir rotina]│
 └─────────────────────────────────────────────────────────────┘
```

Pausar tem a mesma proteção, com texto sobre suspensão até retomar. Sobreposição
e conflito mantêm seus diálogos existentes. O foco fica contido na confirmação
e retorna ao acionador quando ela é cancelada.

## Critérios para revisão dos desenhos

- Início responde “o que posso fazer hoje?” com dois blocos, sem trazer a
  manutenção da Agenda de volta para essa tela.
- Estudo começa pelo planejamento e termina nas últimas Sessões.
- Cadastro e edição usam os campos atuais e explicam as consequências reais.
- Mesmas regras, ações e retornos no desktop e no celular.
- Estados de erro, vazio, carga e conclusão não se confundem.

A validação de contraste, foco, alvos e reflow em navegador pertence à futura
implementação. Este documento permite revisar a proposta antes dessa etapa.
