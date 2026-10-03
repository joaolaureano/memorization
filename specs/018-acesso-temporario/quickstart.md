# Quickstart: Acesso temporário

## Pré-requisitos

- Node 24, dependências instaladas.
- Backend e frontend parados.
- Migração nova aplicada nos dois Adapters; número 8 ou 9 conforme D1.
- Para e2e e testes manuais de expiração, definir `ACESSO_VALIDADE_SEGUNDOS` pequeno, por exemplo `5`; padrão é `300`.

## Percurso manual

1. Suba backend e frontend no local. Confirme que a origem do frontend está configurada no CORS local e que o pré-voo responde com `Access-Control-Allow-Credentials: true` (D2).
2. Abra a aplicação. Como não há Acesso, veja Entrar.
3. Confirme a caixa «Continuar conectado neste navegador», marcada por padrão; entre com Nome de usuário e Senha válidos. Você deve voltar ao Início e o cookie do Acesso deve existir com `HttpOnly`, `SameSite=Strict` e `Path=/` (FR-289, FR-292, FR-297).
4. Recarregue a página: deve voltar ao Início sem Entrar (FR-290; SC-114, SC-118).
5. Feche e reabra a aba ou o navegador dentro do TTL: deve voltar ao Início sem Entrar (FR-290; SC-114).
6. Deixe passar mais que o TTL sem nenhuma ação e tente operar ou recarregar: deve ver Entrar com «Seu acesso expirou. Entre novamente.» e nada em andamento pode aparecer como concluído (FR-294; SC-115, SC-123).
7. Entre de novo, acione Sair e reabra o navegador: deve exigir Entrar, e o Acesso antigo deve ser recusado se reapresentado (FR-293, FR-295; SC-119).
8. Entre em dois Navegadores. Saia em um: o outro continua no acervo. Troque a Senha em um: o outro é recusado e o navegador da troca continua com novo Acesso (FR-296, FR-299; SC-120).
9. Com TTL pequeno, estude por mais tempo que o TTL interagindo (Revelar, Avaliar, digitar) a intervalos menores que o TTL: o Acesso deve permanecer válido (FR-291; SC-124).

## Verificações de segurança

- Inspecione o armazenamento do navegador, a URL e os registros da aplicação: a Senha e o Nome de usuário não podem aparecer; o Acesso temporário não pode aparecer em URL, corpo de resposta ou log (FR-078, FR-297, FR-305; SC-116).
- Tente forjar ou adivinhar o Acesso: deve ser recusado (FR-297).
- Com o armazenamento indisponível, a validação deve responder indisponível, não expiração, e o cookie não deve ser descartado; ao voltar o armazenamento, a operação deve funcionar (FR-301; SC-122).
- Com a opção desmarcada, nenhum Acesso é emitido; se havia um Acesso anterior, ele é revogado e o cookie é limpo. Recarregar ou fechar exige Entrar de novo (FR-292; SC-114).

## Verificações de acessibilidade e responsividade

- Marque/desmarque a caixa, entre, saia e volte a entrar inteiramente por teclado, com foco visível sem depender de cor (FR-302, FR-303; SC-121).
- Verifique as mensagens de expiração, encerramento e indisponibilidade em leitor de tela (FR-304).
- Teste em 360, 390, 768 e 1440 px e zoom de 200 % (SC-121).

## e2e

`e2e/acesso-temporario.spec.ts` deve rodar com `ACESSO_VALIDADE_SEGUNDOS=5` e cobrir: recarregar dentro do TTL, ociosidade além do TTL, Sair e reabrir, dois contextos e troca de Senha da 017, inspeção de armazenamento sem Senha, e Sessão de estudo maior que o TTL com interações (D8; SC-114..SC-124).
