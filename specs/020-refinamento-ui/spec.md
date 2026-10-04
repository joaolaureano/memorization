# Feature Specification: Wrap-up 020 — refinamento da UI

**Created**: 2026-10-04
**Status**: Autorizada pelo pedido de implementação do plano fornecido.
**Input**: Simplificar Início, Estudo e Perfil, ajustar login e remover integralmente alteração de Nome de usuário.

## User Scenarios & Testing

### User Story 1 — Entrar e sair com controles estáveis (Priority: P1)

Como Usuário, quero controles legíveis, previsíveis e acessíveis.
**Independent Test**: entrar, alternar visibilidade da Senha e sair por teclado.
**Acceptance Scenarios**:
1. Ao abrir Entrar, leio “Bem-vindo”, e a opção de acesso mantém seu padrão sem ajuda condicional.
2. Alternar Mostrar/Ocultar não desloca o campo; sair com êxito anuncia “Você saiu com sucesso.” como status.

### User Story 2 — Consultar Início e Estudo simplificados (Priority: P1)

Como Usuário, quero ver a revisão elegível e os Compromissos sem textos repetidos.
**Independent Test**: consultar acervo vazio, revisão zero, só novos, só vencidos e mistura; selecionar dia vazio em Estudo.
**Acceptance Scenarios**:
1. Início apresenta cabeçalho, Revisão do dia e Agenda de hoje em uma coluna, sem “Seu estudo”, datas ou resumo de sete dias.
2. Revisão zero mostra “Nada para revisar.”; revisão disponível informa a contagem total elegível e permite Revisar.
3. Agenda compacta não mostra data nem Agendar estudo; agenda completa mantém agendamento.
4. Dia sem Compromissos mostra uma única mensagem: “Nenhum estudo agendado para este dia.”, sem situação/contagem redundante.

### User Story 3 — Consultar Perfil e manter a conta (Priority: P1)

Como Usuário, quero consultar meu nome, configurar estudo, trocar Senha e excluir minha conta.
**Independent Test**: acessar Perfil pelo endereço preservado, salvar Configuração, trocar Senha e excluir conta; tentar a operação removida.
**Acceptance Scenarios**:
1. Navegação e título dizem “Perfil”; Configuração e Minha conta ficam separados por 32 px; salvar anuncia “Configuração salva.”.
2. Nome de usuário é somente leitura; nenhuma ação ou formulário permite alterá-lo.
3. Usuário existente consegue Entrar com nome original; cadastro rejeita duplicidade; troca de Senha e exclusão mantêm invalidação dos Acessos.

### Edge Cases

- Falha na leitura do acervo não equivale a acervo vazio e não exibe convite enganoso; não há mensagens exclusivas do resumo eliminado.
- Agenda e revisão mantêm carga/falha/recuperação independentes; revisão não usa apenas vencidos para decidir vazio.
- Dia com Compromissos conserva situação e contagem; fuso continua orientando dias e operações internamente.
- Resultado incerto continua sendo tratado para troca de Senha e exclusão, sem ramos para alteração de nome.
- Nomes longos, teclado e zoom não ocultam ações nem causam rolagem horizontal da página.

## Requirements

### Functional Requirements

- **FR-327**: Entrar MUST dizer “Bem-vindo”; saída bem-sucedida MUST anunciar “Você saiu com sucesso.” como status acessível.
- **FR-328**: Checkbox de acesso MUST manter opção e padrão, sem ajuda condicional nem associação descritiva dessa ajuda. Checkboxes comuns MUST medir 19 px e grandes 37 px; rótulos clicáveis MUST preservar alvos mínimos de 44 × 44 px; botões de opção MUST manter 44 px.
- **FR-329**: Mostrar/Ocultar MUST ter largura fixa de 7 rem em todos os campos de Senha, sem variação ao alternar.
- **FR-330**: Início MUST organizar cabeçalho e blocos em uma coluna em todas as larguras, sem “Seu estudo”, datas, resumo de sete dias e mensagens exclusivas de carga/falha desse resumo. MUST manter somente leitura necessária para identificar acervo vazio e convidar a criar primeiro Cartão.
- **FR-331**: Revisão do Início MUST usar o total elegível para vazio e contagem, dizer “Nada para revisar.” quando zero e retirar textos redundantes de novos/vencidos; regras de elegibilidade permanecem.
- **FR-332**: Agenda compacta MUST omitir data e Agendar estudo; agenda completa MUST preservar o agendamento.
- **FR-333**: Detalhe do dia sem Compromissos MUST apresentar somente “Nenhum estudo agendado para este dia.” como mensagem de vazio, sem linha de situação/contagem redundante.
- **FR-334**: Telas e protótipos ativos desta feature MUST omitir apresentação do fuso, preservando uso interno nos cálculos e chamadas da Agenda.
- **FR-335**: Navegação e título MUST dizer Perfil, preservando `#/preferencias`; Configuração e Minha conta MUST ter 32 px de separação; confirmação MUST dizer “Configuração salva.”.
- **FR-336**: Nome de usuário MUST ser somente leitura; alteração de nome MUST ser removida de ponta a ponta, inclusive formulário, estados, foco, clientes, guarda, resultados incertos, domínio, armazenamento e rota exclusiva. Chamada autenticada à rota removida MUST retornar 404 e não haverá preflight exclusivo.
- **FR-337**: Cadastro, validação, unicidade, autenticação de nomes existentes, troca de Senha, exclusão e invalidação dos Acessos MUST permanecer, com paridade dos Adapters pertinentes e registro de rotas local/Lambda. MUST NOT alterar nomes existentes nem criar migração.
- **FR-338**: Todas as telas afetadas MUST funcionar em 360, 390, 768 e 1440 px, zoom 200% e teclado, com foco visível, rótulos e anúncios acessíveis, sem conteúdo encoberto ou rolagem horizontal da página.

### Key Entities

Usuário, Nome de usuário, Senha, Acesso temporário, Cartão, Compromisso e Agenda mantêm os significados definidos nas specs que os introduziram (constituição 3.2.0, Princípio III). Perfil é rótulo de navegação; não cria entidade. Não há novos dados persistidos.

## Success Criteria

- **SC-131**: Os três percursos de aceite passam sem textos, ações ou apresentação de fuso removidos.
- **SC-132**: Em quatro larguras, 100% dos controles afetados preservam medidas e acesso por teclado; zoom 200% mantém conteúdo acessível.
- **SC-133**: Todos os cenários de conta preservados passam e a tentativa autenticada de renomeação resulta em recurso inexistente, sem alteração de dados.

## Assumptions

- Manter pt-BR, estilo visual, algoritmos, limites, recorrência e regras de acesso vigentes.
- Reutilizar leituras existentes para detectar acervo vazio, sem novo contrato ou abstração.
- Protótipos históricos publicados e specs anteriores permanecem intactos; representações atuais são atualizadas ou acrescentadas em 020.

## Revisão append-only de requisitos anteriores

020 substitui FR-259–FR-265 da 017 e as partes de US1/US4 relativas a renomear e ao resultado incerto dessa operação. Demais requisitos de senha/exclusão continuam vigentes. Substitui os trechos de 019 FR-307–FR-310, FR-313/314 e FR-321 referentes ao rótulo Perfil, resumo/datas/layout do Início, apresentação de revisão, fuso visível e Agendar estudo no resumo compacto. Nenhum documento histórico é reescrito.

## Clarifications — 2026-10-04

Varredura do clarify: escopo, domínio/dados, interação, acessibilidade, integração, falhas, restrições, terminologia e critérios de conclusão claros no plano fornecido. Zero perguntas necessárias. A remoção do fuso é apenas visual; o dia local e as chamadas permanecem. Preservação histórica prevalece sobre atualizar protótipos arquivados em specs anteriores.
