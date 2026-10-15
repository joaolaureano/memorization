# Contrato de UI — Usuário de Teste

**Feature**: `030-usuario-de-teste` | US1–US4, FR-487, FR-490, FR-494, FR-496, FR-497, FR-503

## Tela de Entrar

- Abaixo do formulário, separado por "ou": o botão secundário **"Entrar como Teste"** e a frase "Experimente com Baralhos de exemplo. Tudo é apagado ao sair."
- Durante a criação: "Preparando sua Conta de teste…", anunciado com `role="status"` e o botão desabilitado.
- Recusa `429`/`503`: mensagem no Idioma da interface, com o foco nela.
- Depois que uma Conta de teste termina por expiração: o aviso "Sua Conta de teste terminou. Entre como Teste para começar de novo." no topo da tela.

## Aviso da Conta de teste

- No cabeçalho, uma etiqueta "Conta de teste", visível em 360 px.
- No Início e no Perfil, um aviso fixo: "Esta é uma Conta de teste. Tudo será apagado ao sair." com o link "Créditos do acervo de demonstração".

## Créditos

Diálogo com a lista de `GET /demonstracao/creditos`: título, autor, licença e link da fonte de cada mídia. Fecha por Esc e devolve o foco ao link.

## Perfil

Na Conta de teste, "Alterar senha" e "Excluir conta" não aparecem. No lugar, o texto "A Conta de teste não pode ser alterada nem excluída." Preferências e Idioma continuam disponíveis.

## Sair

Na Conta de teste, Sair abre uma confirmação: "Sair apaga a Conta de teste e tudo o que você fez nela." com "Sair e apagar" e "Cancelar".

## Acessibilidade e textos

- Tudo por teclado, com foco visível e alvos de 44 × 44 px.
- Cabe de 360 a 1440 px e com zoom de 200%.
- Textos na seção nova `contaDeTeste` dos catálogos `pt`, `en` e `es`.
