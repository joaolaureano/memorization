# Checklist de requisitos — UX e conta 020

**Purpose**: portão de qualidade antes de implementar.
**Created**: 2026-10-04
**Feature**: [spec.md](../spec.md)
**Review Ownership**: revisor; [x] significa qualidade dos requisitos aprovada, não código pronto. Geração deixa itens abertos; avaliação é etapa separada. Implement não altera marcas.

## Clareza e acessibilidade
- [x] CHK001 Textos literais e anúncio de saída estão definidos? [Clarity, FR-327]
- [x] CHK002 Medidas distinguem checkbox, alvo clicável e radio, e estabilidade de Senha? [Measurability, FR-328/329]
- [x] CHK003 Layout, conteúdo removido e leitura de vazio do Início estão delimitados? [Completeness, FR-330]
- [x] CHK004 Contagem total, zero, novos e vencidos têm critérios coerentes? [Coverage, FR-331, Edge Cases]
- [x] CHK005 Agenda compacta/completa e vazio do detalhe são distintos? [Consistency, FR-332/333]
- [x] CHK006 Remoção visual de fuso preserva semântica interna explicitamente? [Consistency, FR-334]
- [x] CHK007 Rota Perfil, espaçamento e confirmação estão definidos? [Clarity, FR-335]

## Integridade e regressão
- [x] CHK008 Remoção ponta a ponta e resposta da rota removida estão especificadas? [Completeness, FR-336]
- [x] CHK009 Cadastro/unicidade/login/senha/exclusão/invalidação e ausência de migração estão preservados? [Coverage, FR-337]
- [x] CHK010 Matriz visual, zoom e teclado são mensuráveis? [Measurability, FR-338]
- [x] CHK011 Substituição histórica, protótipos atuais e limites do escopo estão explícitos? [Consistency, Revisão append-only, Assumptions]

## Notes
Checklist formal do escopo fornecido pelo PO; nenhuma expansão funcional.

Revisão separada — 2026-10-04: 11/11 critérios satisfeitos contra os FRs citados. Avaliação pelo Arquiteto como parte da execução autorizada do plano, sem alegar revisão individual pelo PO. Nenhum item reprovado.
