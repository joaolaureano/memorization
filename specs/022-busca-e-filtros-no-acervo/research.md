# Decisões — Busca e filtros no acervo

## 2026-10-05 — Escopo documental aprovado

### Contexto e autorização

O Usuário priorizou busca e filtros no acervo. Explicou que deseja escolher o conteúdo e estudar quantas vezes quiser, evitando a mistura automática de Baralhos em uma revisão global. Também sugeriu montar um Baralho temporário com vários Baralhos e Cartões individuais, com opção de salvar ao concluir.

Nas escolhas de escopo, confirmou busca e filtros primeiro, nas listagens principais do acervo; o Baralho temporário fica para uma entrega futura. Escolheu revisão pendente como filtro opcional e as situações Novos, Revisão pendente e Em dia, com Todos como padrão.

O Usuário delimitou expressamente a entrega a specs. Após receber o plano documental, solicitou sua execução. Essa autorização abrange `spec.md`, checklist de qualidade e este registro; não abrange código, testes executáveis, plano técnico ou tarefas de implementação.

### Decisões

1. Buscar Baralhos pelo nome e Cartões pela Frente ou pelo Verso. A linha do Cartão continua compacta, conforme a spec 021.
2. Combinar texto, um Baralho e situação por interseção. Oferecer Todos e Sem baralho no seletor de Baralho.
3. Usar trecho contínuo, ignorando capitalização e acentuação e aparando espaços nas extremidades. Não incluir busca aproximada ou operadores.
4. Derivar a situação do Agendamento existente. Sem Agendamento significa Novo; revisão hoje ou antes significa Revisão pendente; revisão futura significa Em dia. O calendário é o local do navegador.
5. Preservar os critérios durante operações na página e reiniciá-los em uma nova entrada, conforme o plano aprovado.
6. Manter estudo livre e ações atuais. Esta feature não cria revisão global, não muda seleção de Cartões das Sessões e não introduz filtros nas listas internas de Baralhos.
7. Adiar contratos técnicos e formato de transporte para planejamento posterior. Nenhuma API, tipo ou persistência foi alterada nesta entrega.

### Alternativas e limites

- Busca junto ao estudo temporário foi considerada; o Usuário escolheu busca e filtros primeiro.
- Prioridade automática de revisão e datas apenas informativas foram consideradas; o Usuário escolheu filtro opcional.
- Filtro somente de pendentes e filtro adicional por dificuldade foram considerados; o Usuário escolheu Novos, Revisão pendente e Em dia.
- Estender os controles à configuração do estudo ou a todas as listas internas foi considerado; o Usuário escolheu somente as listagens principais.

### Skills aplicadas

- `domain-modeling`: aplicada para manter os significados de Cartão, Baralho, Vínculo e Agendamento e definir situação da revisão, principalmente a separação entre Novos e Revisão pendente. Conforme a constituição, a linguagem fica em Key Entities da spec; não se cria CONTEXT.md nem ADR.
- `codebase-design`: aplicada na análise prévia para distinguir a capacidade desejada dos contratos técnicos atuais. A decisão registrada foi manter esta entrega em requisitos observáveis, sem antecipar nova Interface, Seam ou Adapter.

### Verificação documental

A spec foi confrontada com as decisões aprovadas e com a apresentação compacta da spec 021. O checklist registra somente qualidade documental. Não foram implementados comportamentos, criados testes executáveis ou executados testes da aplicação para esta entrega.

## 2026-10-05 — Protótipos solicitados após a especificação

O Usuário solicitou explicitamente criar protótipos das telas Baralhos e Cartões. O escopo foi ampliado para incluir um artefato navegável isolado em `design/busca-e-filtros/`, capturas e `prototipos.md`, preservando a entrega anterior e sem modificar fontes da aplicação.

O artefato reutiliza os estilos existentes por referência e acrescenta estilos locais para filtros e galeria. Mantém a apresentação compacta da spec 021. No celular, busca e seletores ficam empilhados; no desktop, os filtros de Cartões ficam na mesma linha. Rótulos da navegação móvel recebem espaçamento local menor para evitar quebra de palavras.

Foi executada uma verificação específica do protótipo em Chromium, com as duas telas em quatro larguras, buscas, filtros, falha e recuperação, exclusão demonstrativa, estados vazios e foco. Foram geradas dez capturas. O ensaio de zoom usa CSS a 200%, não zoom nativo. Os resultados não constituem testes da aplicação nem prova de implementação da spec. As situações de revisão são dados demonstrativos fixos.

## 2026-10-05 — Implementação integral autorizada

### Contexto e autorização

O Usuário solicitou criar um worktree e atuar na spec 022 integralmente, seguindo a especificação e os protótipos de `design/busca-e-filtros/`. Isso amplia a entrega documental anterior para plan, tasks, analyze, implementação e convergência. O trabalho ocorre no branch `022-busca-e-filtros-no-acervo`, no worktree `.claude/worktrees/022-busca-e-filtros`.

### Clarify

Nenhuma ambiguidade crítica. Spec e protótipo definem textos, estados, ordem dos controles, contagem no singular e no plural, Limpar filtros sempre visível e a busca do tipo `search`. Resta uma questão técnica: de onde vem a situação da revisão de cada Cartão. Ela foi resolvida no plano, abaixo.

### Decisões do plano

1. **Situação a partir de `GET /cartoes`**: cada Cartão listado ganha `proximaRevisaoEm: string | null`, lido dos Agendamentos do dono numa única chamada à Porta. Alternativas rejeitadas: rota nova só de Agendamentos, porque cria uma segunda leitura com falha parcial a tratar e uma rota a mais no CORS; reaproveitar `POST /previas`, porque prévia não é a próxima revisão; classificar no servidor, porque «hoje» é o calendário do navegador (Key Entities). Isso revê a premissa da entrega documental («esta entrega não altera APIs»), que valia para aquela entrega.
2. **Filtragem no navegador**: as páginas já leem as listas completas; filtrar em memória atende FR-354 sem requisição por tecla. Paginação e filtro no servidor ficam fora (Princípio VII).
3. **Module puro `busca-no-acervo`**: normalização, critérios e classificação ficam num Module com Interface pequena (`filtrarBaralhos`, `filtrarCartoes`, `situacaoDaRevisao`), testado diretamente. Nenhuma Seam nova, porque nada varia além de uma Implementation.
4. **Opções de Baralho por `listarBaralhos`**: inclui Baralhos sem Cartões, como no protótipo; falha dessa leitura é falha da página, com nova tentativa que preserva os critérios.
5. **CSS do protótipo levado ao produto** somente para `.filtros` e `.resultado-cabecalho`. `:has()` é trocado pela classe `filtros--busca-unica`. A galeria e o ajuste da navegação móvel são do protótipo e não entram.
6. **Baralho selecionado que deixa de existir** numa recarga faz o seletor voltar a Todos (premissa a validar).

### Skills aplicadas

- `codebase-design`: aplicada ao desenho do Module `busca-no-acervo` (Depth, Interface pequena, teste pela Interface) e à decisão de não criar Seam para a leitura de Agendamentos, que reutiliza a Porta existente.
- `domain-modeling`: aplicada para manter «situação da revisão» como classificação derivada do Agendamento, sem novo estado persistido, e para nomear os valores no código como na spec.

### Checklist

Criado `checklists/ux.md` com 16 itens de qualidade dos requisitos (UX, estados, acessibilidade, responsividade e contrato de `proximaRevisaoEm`). O Arquiteto avaliou os itens contra spec, plano e contratos, a pedido do Usuário de conduzir a feature integralmente. Os 16 foram aprovados. CHK012 apoia-se numa premissa marcada como a validar. O item «Entrega limitada a documentação» de `checklists/requirements.md` descrevia a entrega documental anterior e foi superado pela autorização de 2026-10-05; não é reprovação dos requisitos.

### Analyze

Sem CRITICAL. Foram dois achados de cobertura, corrigidos em `tasks.md`. O primeiro: registros com a mesma Frente continuam distintos, e agora há prova em T2203. O segundo: Estudar mantém o destino durante a busca, com prova em T2204. O item documental superado do checklist de requisitos já estava registrado acima. Portão liberado para `implement`.

### Implementação — foco após excluir (T2206)

O plano previa levar o foco ao próximo botão Excluir visível. Durante a implementação, constatou-se que a página já levava o foco ao título da página após a exclusão (spec 021). FR-357 pede preservar o tratamento acessível de foco existente, e não alterá-lo. Por isso a regra existente foi mantida e o plano e as tarefas foram corrigidos. A delegação da página inteira passou de 120 s e voltou fragmentada. Ela foi refeita em dois pedidos menores, com pares OLD/NEW.

### Verificação final (T2210)

`npm run verificar:ci` na raiz do worktree terminou com exit 0. Gitleaks: no leaks found. Backend: 879 testes (SQLite) e 232 (PostgreSQL). Frontend: 815 testes, com lint, typecheck e build. Playwright: 81 cenários, incluindo os 8 novos de T2207 e T2208. As provas sensíveis a datas também passaram em UTC, Pacific/Kiritimati, Pacific/Pago_Pago e America/Los_Angeles. READMEs (inglês e pt-BR) ganharam a linha «Busca e filtros». Todo o código de aplicação foi escrito por workers DeepSeek flash e revisado pelo Arquiteto. Duas saídas foram rejeitadas e refeitas na revisão: uma página inteira devolvida fragmentada e provas com formato de dados inventado.
