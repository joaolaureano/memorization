# Quickstart: Usuário de Teste

**Feature**: `030-usuario-de-teste` | Contratos: [http](./contracts/http.md), [ui](./contracts/ui.md), [acervo](./contracts/acervo-de-demonstracao.md)

## Pré-requisitos

- `npm run demo` (local) ou o app publicado.
- Dois navegadores, ou um normal e um anônimo.

## Portões automáticos

```bash
npm run verificar:ci
```

## Roteiro

1. **Um clique**: em Entrar, "Entrar como Teste". O Início aparece em até 5 s, com a etiqueta "Conta de teste", Cartões para revisar hoje e o Compromisso de "Inglês" (SC-192, SC-198).
2. **Acervo**: em Baralhos, Inglês (12), Bandeiras (10) e Cantos de pássaros (10) (SC-193).
3. **Estudo**: estudar Bandeiras (a bandeira aparece) e Cantos de pássaros (o canto toca; o Verso mostra o nome).
4. **Estatísticas**: estudo em ao menos 4 dos últimos 7 dias (SC-198).
5. **Uso normal**: criar um Baralho, editar e excluir um Cartão de Bandeiras, exportar Inglês (FR-495).
6. **Isolamento**: no segundo navegador, "Entrar como Teste". O acervo está intacto, sem as mudanças do passo 5 (SC-194).
7. **Conta protegida**: no Perfil, "Alterar senha" e "Excluir conta" não aparecem. `PUT /conta/senha` com o cookie responde `403 conta_de_teste` (SC-196).
8. **Créditos**: o link abre a lista com autor e licença de cada mídia (SC-197).
9. **Sair**: confirmar "Sair e apagar". Entrar como Teste de novo traz o acervo no estado inicial, sem o Baralho do passo 5 (SC-195).
10. **Mídia protegida**: depois do passo 9, a bandeira excluída no passo 5 continua aparecendo numa conta nova (FR-500).
11. **Expiração**: entrar como Teste e ficar 6 minutos sem interagir. A próxima ação leva a Entrar com "Sua Conta de teste terminou".
12. **Limpeza**: abandonar uma Conta de teste (fechar a aba). Em até 24 horas (nuvem) ou 10 minutos (local), o Usuário não existe mais (SC-195).
13. **Limite**: criar 11 Contas de teste seguidas do mesmo endereço. A 11ª é recusada com a mensagem de limite (FR-502).
14. **Desempenho na nuvem**: medir o passo 1 com a Lambda fria (primeira chamada depois de 15 minutos parada). Fica em até 5 s (R10, `premissa a validar`).
