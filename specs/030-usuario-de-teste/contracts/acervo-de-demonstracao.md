# Contrato do conteúdo — Acervo de demonstração

**Feature**: `030-usuario-de-teste` | FR-492 a FR-494, FR-504 | Research R7, R8

O conteúdo é Conteúdo do Usuário, em português, igual para todas as Contas de teste.

## Baralho "Inglês" (Frente-Verso, 12 Cartões)

| Frente | Verso | Tags |
|---|---|---|
| apple | maçã | substantivo |
| book | livro | substantivo |
| house | casa | substantivo |
| water | água | substantivo |
| friend | amigo | substantivo |
| kitchen | cozinha | substantivo |
| window | janela | substantivo |
| to learn | aprender | verbo |
| to remember | lembrar | verbo |
| to forget | esquecer | verbo |
| beautiful | bonito | adjetivo |
| tomorrow | amanhã | advérbio |

## Baralho "Bandeiras" (Imagem, 10 Cartões)

Frente: a bandeira, sem texto, com a descrição alternativa "Bandeira do Brasil", "do Japão", "do Canadá", "da Alemanha", "da Itália", "da Argentina", "da Índia", "do Quênia", "da Suécia", "do México". Verso: o nome do país.

Brasil, Japão, Canadá, Alemanha, Itália, Argentina, Índia, Quênia, Suécia e México.

- **Arquivos**: PNG de até 640 px de largura, de páginas "Flag of …" do Wikimedia Commons em domínio público.
- **Chaves**: `demonstracao/bandeiras/{pais}.png`.

## Baralho "Cantos de pássaros" (Áudio, 10 Cartões)

Mensagem: vazia (só o canto na Frente; a regra de Frente única da `025`/`028` não vale para Cartões de Áudio sem Mensagem). Verso: "Nome popular (Nome científico)".

| Nome popular | Nome científico |
|---|---|
| Sabiá-laranjeira | *Turdus rufiventris* |
| Bem-te-vi | *Pitangus sulphuratus* |
| João-de-barro | *Furnarius rufus* |
| Cambacica | *Coereba flaveola* |
| Tico-tico | *Zonotrichia capensis* |
| Tiziu | *Volatinia jacarina* |
| Anu-branco | *Guira guira* |
| Corruíra | *Troglodytes musculus* |
| Pomba-asa-branca | *Patagioenas picazuro* |
| Seriema | *Cariama cristata* |

- **Arquivos**: MP3 de até 20 s (trechos de cerca de 15 s), mono, 64 kbps, de gravações CC0, CC BY ou CC BY-SA. NC e ND ficam excluídas.
- **Chaves**: `demonstracao/passaros/{nome}.{ext}`.
- Se uma espécie não tiver gravação com licença permitida, é trocada por outra ave comum no Brasil. A troca é registrada no research.

## Créditos

`backend/demonstracao/creditos.json` tem uma entrada por arquivo, com título, autor, licença (identificador SPDX) e URL da fonte. Uma mídia sem crédito completo reprova o teste do conteúdo (SC-197).

## Histórico de exemplo (FR-504, R7)

- 5 Sessões nos dias −6, −5, −3, −2 e −1 em relação à criação, no fuso do visitante, com 6 a 10 Cartões cada e Avaliações misturadas.
- Agendamentos obtidos pela reprodução das Avaliações (`aplicarAvaliacoes`), com ao menos 3 Cartões de revisão hoje ou antes.
- Rotina: "Inglês", todos os dias, Todos os Cartões. O Compromisso de hoje fica não concluído.
- Preferências padrão (algoritmo SM-2).
