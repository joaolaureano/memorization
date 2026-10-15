# Contrato HTTP — Usuário de Teste

**Feature**: `030-usuario-de-teste` | Research R1, R4, R5, R6, R8, R9

Forma da recusa: `{ erro, mensagem (inglês, ASCII), limite? }`, como na `027`.

## Entrar como Teste (nova)

`POST /contas-de-teste`, sem autenticação.

```json
{ "fuso": "America/Sao_Paulo", "idioma": "pt" | "en" | "es" }
```

- `201 Created`: `{ "nomeDeUsuario": "teste-…", "contaDeTeste": true }`, mais `Set-Cookie` com o Acesso temporário (`018`). Um Acesso anterior deste navegador é revogado antes.
- `400 corpo_invalido`: `fuso` não IANA ou `idioma` fora da lista.
- `429 contas_de_teste_esgotadas_na_origem`, com `limite: 10`: limite por origem na última hora (R5).
- `503 contas_de_teste_indisponiveis`: limite global de contas ativas (R5).
- `503 indisponivel`: falha ao criar. Nenhuma conta parcial (R2).

## Créditos (nova)

`GET /demonstracao/creditos`, público.

- `200`: `[{ "baralho": "Bandeiras", "cartao": "Brasil", "titulo": "…", "autor": "…", "licenca": "CC0 1.0", "fonte": "https://…" }]`.

## Conta (alterada)

- `GET /conta`: acrescenta `contaDeTeste: boolean`.
- `PUT /conta/senha` e `DELETE /conta` numa Conta de teste: `403 conta_de_teste` (`Test accounts cannot be changed.`).
- `POST /entrar` com o Nome de usuário de uma Conta de teste: a recusa uniforme vigente, `401` (FR-501).

## Envio de mídia numa Conta de teste (alterada)

- A criação e a edição de um Cartão de Imagem ou de Áudio cuja mídia leve a soma da mídia mantida nos Cartões da conta acima de 20 MB respondem `413 limite_de_midia_da_conta_de_teste` (`Test account media limit reached.`), com `limite: 20971520` (FR-495a).
- `POST /imagens/envios` e `POST /audios/envios` numa Conta de teste que já preparou 30 envios respondem `413 limite_de_midia_da_conta_de_teste`, com `limite: 30` (FR-495a, research R15).

## Sair (alterada)

`POST /sair` numa Conta de teste: exclui o Usuário e todo o seu conteúdo (`017`, mais a fila de mídia, sem as chaves `demonstracao/`) e limpa o cookie. Responde como hoje.

## Evento agendado (Lambda, sem HTTP)

O evento `{ "acao": "limpar-contas-de-teste" }` (entrada fixa da regra agendada, research R16) roda a limpeza: Contas de teste encerradas (sem Acesso válido e criadas há mais de 2 minutos), linhas de `criacao_de_conta_de_teste` com mais de 1 hora, e a fila de mídia.
