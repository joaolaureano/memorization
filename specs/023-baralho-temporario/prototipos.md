# Protótipo navegável — Baralho temporário

[Abrir protótipo](../../design/baralho-temporario/index.html) · [Instruções e limites](../../design/baralho-temporario/README.md).

Quantidade, ordem e entrada incorporam os esclarecimentos do Usuário. O percurso completo permite selecionar, estudar e salvar usando dados fictícios na memória da aba, sem modificar a aplicação.

## Capturas

| Tela | Desktop | Celular |
|---|---|---|
| Baralhos com o botão secundário | [1440 px](../../design/baralho-temporario/capturas/baralhos-1440.png) | [390 px](../../design/baralho-temporario/capturas/baralhos-390.png) |
| Seleção preenchida | [1440 px](../../design/baralho-temporario/capturas/selecao-1440.png) | [390 px](../../design/baralho-temporario/capturas/selecao-390.png) |
| Sessão | [1440 px](../../design/baralho-temporario/capturas/sessao-1440.png) | [390 px](../../design/baralho-temporario/capturas/sessao-390.png) |
| Resumo | [1440 px](../../design/baralho-temporario/capturas/resumo-1440.png) | [390 px](../../design/baralho-temporario/capturas/resumo-390.png) |
| Salvar como baralho | [1440 px](../../design/baralho-temporario/capturas/salvar-1440.png) | [390 px](../../design/baralho-temporario/capturas/salvar-390.png) |

Também há capturas em 360 e 768 px na mesma pasta. A galeria ao final do protótipo abre diretamente os estados principais e as falhas simuladas.

## 1. Baralhos

Cabeçalho Baralhos → Criar Baralho (primário) / Criar baralho temporário (secundário escuro) → busca pelo nome e Situação da revisão → lista com etiqueta antes de Revisar / Editar.

Os botões ficam lado a lado no desktop, na ordem indicada. No celular podem quebrar linha sem truncar os textos. Criar baralho temporário abre uma seleção vazia; não exige nome e não adiciona item à lista de Baralhos.

Revisar um Baralho pendente abre uma modal pequena com Só pendentes, Todos os cartões e Cancelar. Revisado inicia todos embaralhados diretamente. Revisar uma seleção temporária também inicia todos diretamente; não há campo de quantidade. Regras da spec 024.

## 2. Criar baralho temporário

Criar baralho temporário → “Escolha o conteúdo para esta Sessão. Você poderá salvar o baralho ao terminar.”

- Adicionar baralhos: busca por nome / Situação da revisão → nome, contagem e etiqueta → Adicionar cartões.
- Adicionar cartões: busca na Frente/Verso → Baralho → Frente → Adicionar.
- Seleção do estudo: N Cartões únicos → Frente de cada Cartão / Remover → Limpar seleção.
- “Todos os cartões selecionados serão estudados em ordem aleatória.” → Revisar / Cancelar. Não há campo de quantidade ou ordem. Seleção vazia ou acima de 1.000 Cartões comunica por que não pode iniciar.

No celular, seletores e seleção ficam em uma coluna. No desktop, as áreas de fontes e seleção podem ficar lado a lado. Os critérios não escondem Cartões já selecionados.

## 3. Sessão

Baralho temporário → Frente → Revelar verso → Errei / Difícil / Bom / Fácil, com as prévias existentes.

Interromper usa a confirmação de descarte vigente. Todos os selecionados são embaralhados juntos e a ordem fica fixa após iniciar. Nenhum Cartão aparece duas vezes.

## 4. Resumo

Sessão concluída → Estudo com baralho temporário (texto secundário abaixo do título) → placar e grupos de resultados existentes → Salvar como baralho / Voltar para Baralhos.

Confirmação de registro apenas anunciada ao leitor de tela. Registro pendente: mensagem de salvamento do Histórico; Salvar como baralho indisponível com motivo. Falha: Tentar registrar novamente, preservando o Resumo.

## 5. Salvar como baralho

Nome do baralho → limite de 100 caracteres → “N Cartões serão vinculados. Os baralhos de origem serão preservados.” → Salvar / Cancelar.

- Sucesso: “Baralho salvo.” → Abrir baralho / Voltar para Baralhos.
- Falha: nome preservado e nova tentativa, sem criar duplicatas.
- Cartões indisponíveis: indicar quantidade → Retirar indisponíveis → conferir nova contagem antes de confirmar. Sem restantes, não permite salvar.
- Cancelar volta ao Resumo; não desfaz a Sessão registrada.

## Verificação do artefato

O script `design/baralho-temporario/verificar.mjs` percorreu as cinco telas nas quatro larguras e o fluxo completo com Cartões compartilhados e avulsos. Também verificou foco, Escape, teclado, filtros, nome inválido, falhas/recuperação e preservação do Resumo ao retirar um Cartão indisponível do salvamento. O zoom foi simulado por CSS a 200%.

Datas e situações são ilustrativas; registro e salvamento são locais. A demonstração não substitui a futura verificação da aplicação nem comprova garantias de persistência, concorrência ou privacidade.
