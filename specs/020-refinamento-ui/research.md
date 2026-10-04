# Research e auditoria — 020

## 2026-10-04 — intenção e autorização
Fonte: pedido do Usuário para implementar integralmente o plano Wrap-up 020 em contexto novo.
O pedido é autorização para o escopo, decisões e verificações do plano fornecido, incluindo delegação DeepSeek. Não atribuímos uma revisão individual de artefatos recém-gerados ao PO.
Árvore Git inicialmente limpa. Histórico 017/019 preservado.

## 2026-10-04 — specify e clarify
Fluxo GitHub Spec Kit local lido em .claude/skills/speckit-*/SKILL.md. Template resolvido pelo script oficial; feature.json aponta para 020.
Spec traduz FR-327–FR-338; clarify não encontrou ambiguidade funcional pendente.
Sem extensions.yml, portanto nenhum hook de extensão a executar.
Skills domain-modeling e codebase-design lidas com CONTEXT-FORMAT e DEEPENING. ADR e Design It Twice são inaplicáveis conforme constituição.
domain-modeling orientou distinção de Perfil (rótulo) e Usuário (entidade) e preservação de Nome de usuário no cadastro.
codebase-design orientou reduzir Interfaces existentes, manter Seams HTTP/memória e SQLite/PostgreSQL e testar pelas Interfaces.

## 2026-10-04 — plan
Decisão: remover operação em todas as camadas; alternativa de esconder apenas formulário rejeitada por FR-336.
Decisão: nenhuma migração; nomes persistidos e unicidade permanecem (FR-337).
Decisão: remover apenas apresentação do fuso; recalcular dias sem fuso quebraria Agenda (FR-334).
Decisão: leitura existente de Cartões para vazio no Início; resumo de Estatísticas/Registros desnecessário (FR-330).
Decisão: protótipos novos da 020 e alterações apenas em design ativo; reescrita de protótipos/specs históricos rejeitada por auditoria append-only.

## 2026-10-04 — checklist, tasks e analyze
Checklist de especificação 10/10; checklist UX/conta gerado com itens abertos e avaliado separadamente pelo Arquiteto na execução autorizada: 11/11. Não representam testes de código.
setup-tasks e check-prerequisites oficiais executados. 12 tarefas; US1 tem 1, US2 tem 2, US3 tem 4, demais 5 são setup/portões/verificação. Frontend e backend podem trabalhar em escopos disjuntos.
Analyze realizado como leitura de spec/plan/tasks/constituição: 12 FRs e 3 SCs, cobertura 100% conforme tabela de tasks, zero tarefas sem vínculo, zero ambiguidades ou duplicações bloqueantes, zero CRITICAL. Portão aprovado antes de implementação. Nenhum arquivo de aplicação alterado até esse ponto.

## Estado em 2026-10-04 (T2006–T2012 concluídas)

- T2006/T2007: os 15 testes vermelhos foram adaptados. Os de renomeação viraram verificações de Nome de usuário somente leitura ou usam a troca de Senha; «Preferências» virou «Perfil»; a mensagem de saída passou a «Você saiu com sucesso.»; o duplo de `pagina-de-inicio.test.tsx` ganhou `as unknown as ClienteDoAcervo`. As falhas de `endereco-da-api-de-producao` eram só o `tsc` do build acusando esses testes.
- T2010: os specs E2E foram ajustados a Perfil, à mensagem de saída, ao 404 da rota de renomear, ao caminho Início → «Ver agenda semanal» → «Agendar estudo», ao total elegível do Início («Nada para revisar.», «N Cartões para revisar») e à ausência do resumo de sete dias no Início. O alvo de 44 px das caixas de marcar passou a ser medido pelo rótulo clicável (FR-328). Novo `e2e/refinamento-da-entrada.spec.ts`: Entrar em 360/390/768/1440 e zoom 200%, com sobretítulo, caixa grande de 37 px, rótulo ≥ 44 px, Mostrar/Ocultar com 7 rem fixos, sem rolagem horizontal e ordem de Tab.
- T2011: `prototipos.md` já traz os protótipos novos; os históricos permanecem intactos. READMEs e `design/agendamento/README.md` já estavam atualizados; nada mais a alterar.
- T2012, evidências: backend `typecheck` e `lint` limpos, 903 testes gerais verdes e suíte PostgreSQL verde; frontend `tsc`, lint e 802 testes verdes, build ok; E2E completo 79/79. O diff foi relido; as capturas manuais não foram feitas, e a matriz automatizada cobre as quatro larguras e o zoom de 200% apenas na tela Entrar.
- Ressalvas do ambiente (não do código): sem `gitleaks`, então a etapa «Segredos» não rodou; Node 22 (o projeto pede ≥ 24), por isso um teste de FR-103 em `construcao.test.ts` vê o aviso do `node:sqlite` na saída; a suíte PostgreSQL só roda fora de root.
- Observação: `ResumoDeSeteDias` em `EstatisticasDoEstudo.tsx` ficou sem uso na interface depois do FR-330; só os testes o referenciam.
