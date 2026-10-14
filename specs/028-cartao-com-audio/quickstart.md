# Quickstart — Cartão com Áudio

Contratos em [contracts/http.md](./contracts/http.md) e [contracts/ui.md](./contracts/ui.md). Esquema em [data-model.md](./data-model.md). Decisões em [research.md](./research.md).

## Protótipo

Abra `design/cartao-com-audio/index.html` no navegador, sem servidor. Para verificar:

```sh
rtk proxy node design/cartao-com-audio/verificar.mjs
```

O esperado:
- o seletor tem três tipos;
- a troca para Áudio é anunciada;
- a pré-escuta funciona, com trocar e remover;
- o tocador funciona por teclado;
- a duração aparece;
- os textos estão nos três idiomas;
- não há rolagem horizontal em 360, 390, 768 e 1440 px nem com zoom de 200%.

## Produto — portões

```sh
cd backend && rtk npm test && rtk npm run typecheck && rtk npm run lint
cd frontend && rtk npm test && rtk npm run build && rtk npm run lint
rtk npx playwright test --config e2e/playwright.config.ts
```

Para a bateria do armazém no MinIO, use o mesmo comando da `026`. O nome do filtro passa a ser `armazem-de-midia`. Antes de integrar, rode `npm run verificar:ci` na raiz (gitleaks incluso). Para validar o layout no Linux, use o colima com a imagem do Playwright e `fonts-dejavu-core`.

## Cenários de aceitação

1. **Seletor e passos** (FR-432, SC-176): abra a criação de Cartão. O seletor mostra Frente-Verso, Imagem e Áudio, com Frente-Verso selecionado. Criar Frente-Verso e Imagem exige os mesmos passos de antes.
2. **Criar e persistir** (US1-3, US1-4): troque para Áudio, escolha um MP3 de 1 MB e ouça a pré-escuta. Preencha só o Verso e salve. O Cartão aparece com o rótulo "Áudio", o tocador e a duração. Recarregar mantém o Cartão.
3. **Arquivo disfarçado** (FR-437): escolha um `.txt` renomeado para `.mp3`. A recusa vem depois do envio, com `audio_invalido/formato`, os campos ficam e nenhum objeto entra em `audios/`.
4. **Limites** (SC-177):
   - Um arquivo de 11 MB é recusado antes do envio.
   - Um WAV de 5 min 1 s é recusado com `audio_invalido/duracao`.
   - Enviar pela API um arquivo acima de 10 MB é recusado pelo S3.
5. **Unicidade pela Mensagem** (FR-439): dois Cartões do tipo Áudio sem Mensagem no mesmo Baralho são aceitos. Com Mensagem igual, o segundo recebe ` (2)`.
6. **Sessão** (FR-442, FR-443, FR-447):
   - A Mensagem e o tocador aparecem antes da revelação.
   - Toque o Áudio e revele: ele continua tocando. Avalie e passe ao próximo: ele para.
   - O Histórico mostra "Cartão do tipo Áudio", sem o Áudio.
7. **Um de cada vez** (FR-443): no detalhe do Baralho, toque um Áudio e depois outro. O primeiro pausa.
8. **Isolamento** (SC-178):
   - Com outro Usuário, pedir o Áudio de um Cartão alheio devolve `404`.
   - A chave sem assinatura é negada.
   - Uma URL assinada é negada depois de 15 min.
9. **Troca, tipo e exclusões** (FR-448 a FR-450):
   - Trocar o Áudio tira o antigo de `audios/`.
   - Mudar o tipo pela API devolve `409 tipo_imutavel`.
   - A Cópia toca o mesmo som com chave própria.
   - Excluir o Baralho e depois a conta não deixa chaves.
   - Com falha do armazém simulada, as chaves ficam em `midia_a_remover` e saem na próxima tentativa.
10. **Metadados** (FR-454): envie um MP3 com ID3 (título, artista, capa), um M4A com `udta`, um OGG com comentários e um WAV com `LIST/INFO`. Baixe o objeto ativo: nenhum desses textos está nele, e ele toca igual.
11. **Idiomas** (FR-458 a FR-460, SC-181): troque para EN e ES.
    - Tipo, rótulos, ajuda, tocador, anúncios, duração e recusas mudam de idioma.
    - Mensagem, Verso e nome do arquivo não mudam.
    - Um Áudio tocando continua.
12. **Teclado e leitor de tela** (FR-456): escolha o tipo, o arquivo, toque, pause, mova a posição com as setas e salve. O leitor de tela anuncia a troca de campos, o estado do tocador e os erros.
13. **Migrações** (SC-182, research R6):
    - Uma base v19 com Cartões dos dois tipos chega à v21 sem alteração.
    - Uma base v17 com Cartão sem Pertencimento abre na v20 com Áudio utilizável. Depois que o Pertencimento existe, chega à v21.
14. **Arquivos reais** (validação manual, R11): use um M4A gravado no iPhone, um OGG/Opus do Android e um MP3 com capa. Os três são aceitos, a duração confere com a do aparelho e os metadados são removidos.
15. **Tempo até tocar em produção** (SC-180): depois do deploy, numa conexão de 50 Mbps e 20 ms, toque 20 vezes um Áudio de 1 MB na Sessão. Pelo menos 19 começam a tocar em até 2 s (DevTools: do clique ao evento `playing`).
