# Validação — 020
Pré-requisitos: Node >=24, dependências locais, Gitleaks, navegador Playwright e PostgreSQL embutido funcional.
1. rtk npm test --prefix frontend; rtk npm run lint --prefix frontend; rtk npm run build --prefix frontend.
2. rtk npm test --prefix backend; rtk npm run typecheck --prefix backend; rtk npm run lint --prefix backend.
3. rtk npm run test:e2e; rtk npm run verificar:ci.
Inspecionar Entrar/Início/Estudo/Perfil em 360, 390, 768, 1440 px e zoom 200%; percorrer controles por Tab/Enter/Espaço.
Conferir medidas, botão de Senha estável, status de saída, Perfil somente leitura, ausência de fuso/datas/resumo no Início.
Cobrir total zero, só novos, só vencidos, mistura; dia vazio e agenda completa com agendamento.
Backend: obter acesso real e chamar rota removida (404); OPTIONS sem preflight; paridade local/Lambda e operações preservadas nos dois Adapters.
Resultados reais devem ser acrescentados a research.md; falhas não são aprovação.
