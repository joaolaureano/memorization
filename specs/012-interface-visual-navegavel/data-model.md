# Data Model: Interface visual e navegável

**Sem mudança de domínio nem de persistência.** Cartão, Baralho, Vínculo, Usuário,
Credencial e Sessão de estudo seguem definidos em `CONTEXT.md` e nas features
001–008. Abaixo está só o estado de interface que esta feature introduz.

| Estado | Onde vive | Regras |
| --- | --- | --- |
| `Rota` (união discriminada) | `navegacao.ts` | Ganha as rotas `novo-baralho`, `editar-baralho`, `adicionar-cartoes`, `novo-cartao` e `editar-cartao`. É derivada do hash e da presença de Credencial. |
| `Protecao` | `protecao-de-saida.ts` | Há no máximo uma vigente, registrada pela página montada. Pode ser `descarte` (pede confirmação) ou `pendencia` (bloqueia e explica). Some quando a página desmonta ou quando o estado volta a limpo. A recusa de Credencial a ignora. |
| Formulário sujo | cada página de formulário | Fica "sujo" quando o valor atual difere do inicial. Um formulário sujo registra a `Protecao` de descarte. Salvar com sucesso a limpa antes de navegar. |
| Senha visível | `CampoDeSenha` | É booleana, local e começa falsa. Não sobrevive à desmontagem e nunca é persistida. |
| `percentualDeAcertos` | `sessao-de-estudo.ts` | É derivado: `round(acertos / estudados × 100)`. Só existe com a Sessão concluída. |
