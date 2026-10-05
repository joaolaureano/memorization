# Protótipos — Revisar Baralhos

Os protótipos existentes são atualizados para refletir a 024:

- [Busca e filtros do acervo](../../design/busca-e-filtros/index.html).
- [Baralho temporário e revisão](../../design/baralho-temporario/index.html).

## Baralhos

Busca pelo nome + Situação da revisão (Todos/Pendente/Revisado) → resultados. Cada linha apresenta nome e contagem; à direita, etiqueta textual → Revisar → Editar. Vazio usa Sem cartões e Revisar desabilitado. A etiqueta mantém texto e contraste além da cor e pode quebrar para uma linha antes dos botões no celular.

## Modal de revisão

Título Revisar baralho → nome do Baralho → Só pendentes / Todos os cartões, com contagens → Cancelar. Foco inicial em Cancelar; Escape fecha. A escolha inicia diretamente o conjunto, sem quantidade. Baralho Revisado não abre a modal: já apresenta a Frente do primeiro Cartão.

## Cartões e seleção temporária

Cartões oferece busca e Baralho, sem situação. Na montagem temporária, a fonte de Baralhos oferece busca e situação, sem etiquetas de situação nas linhas; a fonte de Cartões oferece busca e Baralho. A lista principal de Baralhos mantém as etiquetas. A seleção permanece independente dos filtros; Revisar inicia todos embaralhados.

## Limites

Os artefatos usam dados fictícios e não comprovam comportamento persistente. A classificação visual e o fluxo devem ser confrontados com os testes da aplicação descritos em tasks.md. Capturas são regeneradas após as alterações; resultados da verificação ficam em research.md.
