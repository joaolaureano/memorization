# Memorization — protótipo navegável

Abra **index.html** diretamente em um navegador atual. Não precisa instalar dependências, iniciar servidor ou acessar a rede. A demonstração começa em Entrar, com `joao` / `minhasenha123` preenchidos. Todos os dados são fictícios e vivem apenas na memória da aba. Recarregar ou **Reiniciar demonstração** restaura os exemplos. Contas criadas durante a demonstração recebem acervo vazio e separado.

## Percurso de revisão

1. Entre e crie um baralho.
2. Abra Cartões, crie uma frente e um verso.
3. Volte ao baralho e use **Adicionar cartões existentes**.
4. Escolha **Estudar**, defina a quantidade, revele e avalie cada cartão.
5. Confira o resumo com respondidos, acertos, erros e percentual.

O cartão “How are you?” está nos baralhos Inglês cotidiano e Viagens. Edite-o para conferir a atualização em ambos. **Remover deste baralho** desfaz apenas o vínculo. **Excluir cartão** remove o cartão e todos os seus vínculos. **Excluir baralho** preserva os cartões.

## Galeria de revisão

O rodapé oferece a galeria, separada dos destinos do produto. Cada cenário repõe os exemplos para uma revisão reproduzível. Os cenários de falha consomem a falha na primeira operação: a próxima tentativa funciona, mantendo os campos. O cenário pendente estende a operação para 1,8 segundo. O carregamento permanece visível até **Concluir carregamento**, permitindo inspecionar e capturar o estado.

| Área | Telas e estados |
| --- | --- |
| Acesso | Entrada, senha visível/oculta, credenciais inválidas, indisponibilidade, envio pendente, cadastro, falha de cadastro, sucesso |
| Baralhos | Lista, vazio, criar, detalhe, renomear, adicionar cartões, remoção de vínculo e exclusão com confirmação |
| Cartões | Lista, vazio, criar, editar compartilhado, validação, falha/repetir, pendente, exclusão com consequências |
| Estudo | Configuração, quantidade excedente, baralho vazio, resposta oculta/revelada, avaliação, progresso, interrupção, resumo |
| Transversais | Carregamento, falha de carregamento/repetir, sucesso, recurso ausente, descarte, conteúdo longo e 40 cartões |
| Explorações futuras | Estatísticas, exemplo semanal, últimas sessões e resumo detalhado expansível por acertos/erros |

Validações são demonstradas enviando campos vazios ou inválidos. Confirmações de exclusão e descarte também têm entradas diretas na galeria. O resumo usa os resultados da sessão; dados semanais nas explorações são explicitamente ilustrativos.

## Decisões visuais

- Escuro com azul como padrão; verde selecionável na galeria. `referencia-original.html`, `azul.png` e `verde.png` preservam o estudo anterior.
- Tokens e componentes em `styles.css`; texto base 16 px, controles de pelo menos 44 px, contorno de foco de 3 px, fonte de sistema sem download.
- Navegação no cabeçalho em desktop; marca e Sair no cabeçalho, Cartões/Baralhos na barra inferior até 600 px.
- Criação e edição em páginas próprias, com voltar/cancelar. Diálogos nativos para descarte, interrupção e exclusões; foco inicial em Cancelar, Tab contido, Escape cancela e devolve o foco.
- Conteúdo textual escapado e quebra de palavras extensas; respostas preservam quebras de linha. Cores semânticas acompanhadas por texto.
- Contraste calculado: texto principal sobre superfície elevada 11,64:1; secundário 7,17:1; texto do botão azul 7,97:1; erro sobre superfície 7,61:1. Bordas de controles foram clareadas durante a revisão.

## Propostas em relação às especificações atuais

Este artefato não altera as specs nem implementa o aplicativo.

- **Destino após entrar:** Baralhos como página principal proposta. `specs/008-entrar` exige acesso à navegação Cartões/Baralhos, sem fixar a página inicial no cenário de aceite.
- **Linguagem:** títulos em caixa de frase, “Acertei”/“Errei” na autoavaliação, “Resposta” como orientação visual para o Verso; o domínio continua usando Cartão, Baralho, Frente, Verso e Sessão de estudo. A confirmação da senha é um apoio de interface.
- **Interrupção:** pede confirmação antes de descartar uma sessão. Confirmar mantém o descarte integral e a ausência de resumo definidos em `specs/004-sessao-de-estudo`; cancelar mantém o progresso.
- **Limites:** nome de baralho 100 caracteres, Frente/Verso 1.000; quantidade excedente usa todos os cartões disponíveis e avisa antes de começar.
- **Explorações futuras:** histórico e estatísticas persistentes continuam fora do escopo atual; resumo detalhado está separado do resumo básico.
- **Simulação:** cadastro/autenticação e operações são locais; não há API, token, persistência, avaliação automática ou efeito sobre o React/backend. Senhas demonstrativas são texto em memória; não representam implementação de segurança.

## Estrutura e implementação futura

`app.js` integra estado, rotas, proteção de saída, diálogos, feedback, operações simuladas e galeria. `access.js`, `collection.js` e `study.js` recebem o mesmo contexto, documentado em `CONTRATO.md`. `index.html` carrega scripts clássicos para funcionar também via `file://`.

Para implementar no produto, validar as propostas de destino, linguagem e confirmações; mapear operações para os contratos existentes; substituir atrasos/erros simulados por estados reais; manter isolamento de acervo e mensagens acessíveis. Histórico persistente requer uma feature própria. A demonstração não altera APIs, tipos ou contratos existentes.

## Verificação e capturas

Com as dependências de desenvolvimento já instaladas na raiz:

```sh
rtk proxy node design/prototipo-visual/verificar.mjs
rtk proxy node design/prototipo-visual/verificar-acervo.mjs
```

Os scripts usam Chromium do Playwright. `verificar.mjs` percorre a galeria em 360, 390, 768 e 1440 px, mede rolagem horizontal, exercita fluxos e teclado, verifica ampliação CSS de 200% e gera capturas de telas principais em `capturas/`. A ampliação CSS verifica refluxo de layout; não substitui uma revisão manual com zoom nativo e tecnologias assistivas. `verificar-acervo.mjs` verifica CRUD, compartilhamento, preservação nas exclusões e recuperação de falhas. Resultado da última execução em `VALIDACAO.txt`.
