# Quickstart: revisar e validar Início e Estudo

**Status**: documentação e wireframes, sem implementação do produto.

## Revisar a entrega atual

1. Abrir [prototipos.md](prototipos.md) para avaliar as telas e estados.
2. Conferir [spec.md](spec.md) e [contracts/ui.md](contracts/ui.md) para regras,
   ações e retornos; [plan.md](plan.md) descreve a futura execução técnica.
3. Consultar [research.md](research.md) para decisões e evidências e o
   [checklist](checklists/requirements.md) para a revisão documental.

Os blocos de código em prototipos.md são desenhos, não programas. Não há build,
servidor ou instalação necessários para visualizar esses wireframes.

Na raiz do repositório, os comandos locais abaixo verificam a associação e os
artefatos de planejamento do Spec Kit:

```sh
rtk proxy bash .specify/scripts/bash/check-prerequisites.sh --json --paths-only
rtk proxy bash .specify/scripts/bash/check-prerequisites.sh --json --require-spec
```

Resultado esperado: FEATURE_DIR aponta para `specs/019-inicio-e-estudo` e a
lista de documentos inclui research.md, data-model.md, contracts/ e quickstart.md.
O ponteiro local é ignorado pelo Git; em outro checkout, selecionar esta
feature antes de executar os comandos.

## Matriz de cenários para implementação futura

Estes são critérios planejados, não testes executados nesta entrega. Tasks
futuras devem associar cada cenário aos testes correspondentes. A matriz
cobre todos os requisitos funcionais e os seis critérios de sucesso.

| Cenário | Requisitos | Preparação e verificação |
|---|---|---|
| V01 — Entrada e destinos | FR-307, FR-323; SC-126 | Login normal abre Início; destino protegido solicitado continua válido; verificar cinco destinos, seleção ativa, marca, Sair, links antigos, nova rota e ausência de colisão com Sessão livre. |
| V02 — Início compacto | FR-308, FR-309, FR-310; SC-125, SC-126 | Nome/data e resumo; exatamente revisão e Agenda após cabeçalho. Ausência de totais do acervo, gráfico, semana e Histórico. Revisar inicia uma revisão disponível, inclusive só com novos. |
| V03 — Amostra de hoje | FR-311; SC-126 | Quatro Compromissos não cancelados em ordem conhecida: três visíveis, total dos quatro e link Ver todos. Exercitar pendente, concluído, indisponível e cancelado; conferir ações e acesso a todos em Estudo. |
| V04 — Semana e seleção | FR-312, FR-313, FR-319; SC-127, SC-128 | Abrir Hoje, selecionar outra data, mudar semanas, retornar à aba e atravessar meia-noite. Preservar seleção explícita, avançar acompanhamento de Hoje; futuro/passado sem Estudar. |
| V05 — Estatísticas e recentes | FR-314, FR-315; SC-127 | Usar oito Registros na janela, soma 120 Itens/101 acertos: 84%, oito Sessões e sete valores somando 120. Testar conjunto separado com recentes anteriores à janela; lista final não deve desaparecer. |
| V06 — Rotinas e retornos | FR-316, FR-317, FR-323; SC-127 | Criar, editar, pausar, retomar e excluir; confirmar consequências, sobreposição e conflito. Salvar/cancelar retorna a Rotinas; voltar de Rotinas/Registro retorna a Estudo. Falha mantém rascunho e não anuncia sucesso. |
| V07 — Atualização e respostas antigas | FR-318, FR-319, FR-320; SC-128 | Confirmar ausência de Atualizar agenda. Mutação e sessão persistida aparecem ao retornar; retorno à aba e virada do dia revalidam. Resolver pedidos em ordem inversa; somente leitura vigente pode prevalecer. |
| V08 — Falhas independentes | FR-320; SC-128, SC-129 | Falhar Agenda, revisão e Estatísticas separadamente, com/sem dados anteriores. Blocos independentes permanecem utilizáveis; indicar desatualização e oferecer Tentar novamente, sem zeros artificiais. |
| V09 — Vazios | FR-310, FR-321; SC-129 | Sem acervo, sem Rotinas, sem Compromissos hoje e sem Registros: mensagens e próximo passo pertinentes; taxa indefinida. Com acervo, nenhum estudo no período não significa ausência de Cartões. |
| V10 — Independência e integridade | FR-322, FR-326; SC-130 | Revisão e estudo livre não concluem Agenda. Registro confirmado da Sessão do Compromisso conclui somente ele. Interrupção, erro de persistência e recarga não produzem conclusão parcial. |
| V11 — Acessibilidade e tamanhos | FR-324, FR-325; SC-129, SC-130 | Percorrer por teclado, revisar nomes/estados com leitor de tela, foco e diálogos; larguras 360/390/768/1440, zoom 200%, alvos 44 px, contraste, gráfico textual, nomes longos e barra sem encobrir conteúdo. |
| V12 — Identidade e tempo de acesso | FR-326; SC-130 | Dois Usuários não compartilham dados; resposta antiga após Sair não reaparece; expiração usa guarda atual. Atualização automática não renova inatividade como gesto humano. |

## Ambiente e comandos — somente quando houver implementação

Pré-requisitos existentes: Node >=24, dependências já instaladas, navegadores
Playwright e requisitos do verificador de CI, incluindo Gitleaks. Consultar
o README do projeto para o ambiente; não inserir credenciais nos documentos.

```sh
# Na raiz: aplicação de demonstração para inspeção futura.
rtk npm run demo

# Em frontend/: verificação do incremento de implementação.
rtk npm test
rtk npm run lint
rtk npm run build

# Na raiz: regressões direcionadas e portão final antes de integração/push.
rtk npm run test:e2e -- e2e/navegacao.spec.ts e2e/estatisticas-e-historico.spec.ts e2e/agendamento-de-estudo.spec.ts
rtk npm run verificar:ci
```

Resultados esperados após implementação: frontend compila, testes cobrem a
matriz e o portão completo passa. Suites de revisão, acesso, responsividade e
acessibilidade também integram a verificação completa. Não considerar o app
atual defeituoso por não atender ainda à proposta.

## Encerramento desta entrega

Concluir quando documentos, links, cobertura e wireframes estiverem revisados.
Registrar evidências em research.md. A aprovação do Product Owner e a execução
posterior de tasks/analyze/implement/converge são etapas distintas; nenhum
checkbox documental substitui esses portões.
