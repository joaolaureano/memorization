# Quickstart — Cartão com Imagem

Contratos em [contracts/http.md](./contracts/http.md) e [contracts/ui.md](./contracts/ui.md); esquema em [data-model.md](./data-model.md).

## Protótipo

Abra `design/cartao-com-imagem/index.html` no navegador (sem servidor). Verificador:

```sh
rtk proxy node design/cartao-com-imagem/verificar.mjs
```

Esperado: seletor inicia em Frente-Verso; troca para Imagem anunciada; pré-visualização, trocar/remover; recusa de formato/tamanho; Sessão com Imagem; 360, 390, 768 e 1440 px sem rolagem horizontal.

## Produto — gates focados

```sh
cd backend && rtk npm test && rtk npm run typecheck && rtk npm run lint
cd frontend && rtk npm test && rtk npm run build && rtk npm run lint
rtk npm run test:e2e
```

Bateria do Adapter S3 contra MinIO (opcional local, obrigatória no CI):

```sh
colima start
docker run -d --name minio-teste -p 9000:9000 minio/minio server /data
S3_DE_TESTE_ENDERECO=http://localhost:9000 rtk npm --prefix backend test -- armazem-de-imagens
```

Credenciais do MinIO de teste vêm de variáveis de ambiente locais, nunca de arquivo versionado. Antes de integrar: `npm run verificar:ci` na raiz.

## Cenários de aceitação

1. Abrir a criação de Cartão em um Baralho: o seletor mostra Frente-Verso; criar um Frente-Verso exige os mesmos passos de antes (SC-168).
2. Trocar para Imagem, escolher um PNG de 1 MB, preencher só o Verso, salvar: o Cartão aparece com rótulo "Imagem" e miniatura; recarregar mantém (US1-3, FR-415).
3. Escolher um `.txt` renomeado para `.png`: recusa após o envio com `imagem_invalida/formato`; campos preservados; nenhum objeto em `imagens/` (FR-411).
4. Escolher um arquivo de 6 MB: recusa antes do envio; forçar o envio pela API: o S3 recusa (SC-169).
5. Criar dois Cartões Imagem sem Texto da frente no mesmo Baralho: ambos aceitos; dois com Texto da frente igual: o segundo recebe ` (2)` (FR-414).
6. Estudar o Baralho: Imagem antes da revelação, Verso depois; Avaliação atualiza o Agendamento; Histórico mostra "Cartão do tipo Imagem" sem Imagem (FR-416, FR-419a).
7. Com outro Usuário, pedir `imagem.url` de um Cartão alheio: `404`; acessar a chave do objeto sem assinatura: negado; usar uma URL assinada após 15 min: negada (SC-170).
8. Trocar a Imagem na edição: a antiga sai de `imagens/` após a resposta; tentar mudar o tipo pela API: `409 tipo_imutavel` (FR-420, FR-421).
9. Salvar seleção como Baralho com um Cartão Imagem: a Cópia mostra a mesma Imagem com chave própria; excluir o original não afeta a Cópia (FR-422).
10. Excluir Baralho e depois a conta: nenhuma chave dos Cartões removidos permanece em `imagens/`; simular falha do armazém: chaves ficam em `imagem_a_remover` e são removidas na próxima tentativa (FR-421).
11. Teclado apenas: escolher tipo, arquivo, trocar/remover, salvar; leitor de tela anuncia a troca de campos e erros (FR-425).
12. Migração 17 sobre base na versão 16 com Cartões e Histórico: todos viram Frente-Verso sem alteração (SC-173).
