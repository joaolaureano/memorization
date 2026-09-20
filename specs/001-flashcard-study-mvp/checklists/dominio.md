# Domain Rules Checklist: MVP de Estudo por Flashcards

**Purpose**: Revisar a qualidade dos requisitos nas áreas onde esta feature tem
maior risco de falhar — linguagem de domínio, invariantes, verificabilidade e
fronteira de escopo.
**Created**: 2026-09-20
**Feature**: [spec.md](../spec.md)

**Note**: Checklist customizado, gerado pelo comando `checklist` a partir do
contexto da feature.
**Review Ownership**: Artefato de revisão de qualidade de requisitos, de
propriedade do revisor. Um item só é marcado `[x]` quando o revisor determina
que o critério está satisfeito.
**Marker Semantics**: `[x]` significa critério de qualidade de requisito
revisado e satisfeito. Não significa implementação concluída.

## Linguagem de Domínio

- [x] CHK001 Todo termo de domínio usado na spec está definido em `CONTEXT.md`
- [x] CHK002 Nenhum sinônimo listado como `_Avoid_` aparece na spec
- [x] CHK003 A spec não introduz termo de domínio ausente do glossário
- [x] CHK004 `Resultado do item` é descrito como declaração do usuário, nunca
      como avaliação feita pelo sistema
- [x] CHK005 Randomização e repetição espaçada são distinguidas explicitamente,
      e a segunda está declarada como adiada

## Invariantes e Rastreabilidade

- [x] CHK006 Cada uma das 16 invariantes tem ao menos um requisito funcional
      correspondente
- [x] CHK007 Nenhuma invariante depende de comportamento da interface gráfica
      para valer
- [x] CHK008 As invariantes de exclusão não-cascateante estão expressas nos dois
      sentidos, cartão→baralho e baralho→cartão
- [x] CHK009 A elegibilidade é definida como derivada, e não como estado
      armazenável
- [x] CHK010 Existe matriz explícita requisito ↔ teste

## Verificabilidade

- [x] CHK011 Todo requisito **comportamental** tem cenário de aceitação ou
      critério de sucesso que o verifica
- [x] CHK012 Os requisitos **negativos e estruturais** declaram como serão
      verificados
- [x] CHK013 Nenhum critério de sucesso depende de detalhe de implementação
- [x] CHK014 Os critérios de sucesso são quantificados, sem adjetivos vagos do
      tipo "rápido", "robusto" ou "intuitivo"
- [x] CHK015 Os casos-limite descrevem resultado observável, não causa interna

## Fronteira de Escopo

- [x] CHK016 A spec não contém linguagem, framework, banco, protocolo ou
      estrutura de pastas
- [x] CHK017 As funcionalidades adiadas estão em seção própria, separadas das
      premissas
- [x] CHK018 Cada premissa é marcada como tal e não se confunde com requisito
- [x] CHK019 A ausência de autenticação está declarada como **condicional** à
      execução local

## Acessibilidade e Recuperação

- [x] CHK020 As garantias de teclado, foco e semântica são requisitos, não notas
- [x] CHK021 O comportamento em falha de gravação está especificado como
      requisito verificável
- [x] CHK022 A prevenção de perda acidental cobre tanto exclusão quanto
      alteração não salva

## Notes

### Avaliação de 2026-09-20 — primeira passagem

Dois itens **reprovaram** na avaliação inicial e foram registrados como
reprovados em vez de ajustados para caber:

- **CHK010** — Não existe matriz requisito ↔ teste. O Princípio IX da
  constituição a exige, e o `plan.md` registrou a obrigação como pendente da
  etapa `tasks`. Permanece reprovado até `tasks.md` existir.
- **CHK012** — Os requisitos negativos e estruturais — FR-009 e FR-018
  (nenhuma propriedade além das declaradas), FR-022 (ausência de limite
  superior), FR-036 (o sistema não avalia a resposta) e FR-038 (a Sessão não é
  persistida) — não declaravam meio de verificação. São afirmações sobre o que o
  sistema **não** faz, e um cenário Given/When/Then não as alcança
  naturalmente.

### Segunda passagem — CHK012 corrigido

Acrescentada à spec a seção **Verificação dos Requisitos Negativos**, que
declara, para cada um dos seis requisitos negativos, o meio concreto de
verificação: teste de propriedade extra, teste de ausência de limite, teste de
domínio de valores, teste de ausência de vestígio após a Sessão, e inspeção do
contrato. CHK012 passa.

CHK010 permanece reprovado até `tasks.md` existir com a matriz.

### Terceira passagem — CHK010 corrigido

`tasks.md` foi criado com a **Matriz de Rastreabilidade Requisito ↔ Tarefa**,
exigida pelo Princípio IX. Verificação por script: os 53 requisitos funcionais e
os 16 critérios de sucesso aparecem na matriz, nenhum requisito fantasma, e
nenhuma das 26 tarefas existe sem requisito rastreado. CHK010 passa.

**Resultado final: 22 de 22 itens aprovados**, com dois reprovados e corrigidos
ao longo do caminho.
