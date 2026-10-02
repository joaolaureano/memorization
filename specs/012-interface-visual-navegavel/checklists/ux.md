# UX Requirements Checklist: Interface visual e navegável

**Purpose**: validar se os requisitos de experiência da spec 012 estão completos, claros e mensuráveis. É um teste dos requisitos, não da implementação.
**Created**: 2026-10-02
**Feature**: [spec.md](../spec.md)

## Completude visual

- [X] CHK001 Paleta e tema definidos com referência rastreável: FR-135 e research R1 com os tokens.
- [X] CHK002 Mínimos de tamanho de texto, alvo de toque e contraste quantificados (FR-136).
- [X] CHK003 Larguras de aceite e ampliação enumeradas: 360/390/768/1440 px e 200% (FR-137, SC-063).
- [X] CHK004 Disposição da navegação definida por faixa de largura, com corte de 600 px confirmado no clarify (FR-139).
- [X] CHK005 Variantes fora do produto explícitas: verde, galeria e Explorações (FR-160, SC-070).

## Clareza dos estados

- [X] CHK006 Os cinco estados de interface (carregando, vazio, erro, pendente, sucesso) são exigidos e distinguíveis (FR-153).
- [X] CHK007 Estados vazios exigem próximo passo, e criação nunca começa automaticamente (FR-144, US2-10).
- [X] CHK008 Pendência define o que fica bloqueado e o que é liberado (FR-154).
- [X] CHK009 Recurso ausente tem mensagem única, sem vazar informação (FR-156).

## Consistência de interação

- [X] CHK010 Toda confirmação tem título, consequência, foco inicial, Escape e retorno de foco especificados (FR-159).
- [X] CHK011 A abrangência do descarte foi decidida (Cadastro, acervo, configuração de estudo; Entrar não) no clarify (FR-148).
- [X] CHK012 A precedência entre recusa de Credencial, descarte e Sessão é explícita (FR-157).
- [X] CHK013 A ausência de confirmação em Remover deste baralho é justificada por FR-066 (FR-147).
- [X] CHK014 A fórmula e o arredondamento do percentual estão definidos, com casos-limite em SC-067 (FR-152).

## Acessibilidade

- [X] CHK015 Teclado, foco visível, nomes acessíveis e anúncios exigidos para todas as ações (FR-158).
- [X] CHK016 Nenhum estado transmitido só por cor; Resultados e destino ativo têm texto ou forma (FR-158, contrato da moldura).
- [X] CHK017 Mostrar/ocultar Senha limitado ao conteúdo digitado e sem recuperação de Senha armazenada (FR-142).

## Mensurabilidade

- [X] CHK018 Cada FR-135..160 tem pelo menos um teste previsto (research R9).
- [X] CHK019 Os critérios SC-062..070 são verificáveis por e2e ou inspeção objetiva, sem juízo estético subjetivo.

## Notes

- 19/19 atendidos. Lacuna conhecida e aceita: a fidelidade visual às capturas é por inspeção, sem pixel-diff, porque a spec dispensa reprodução pixel a pixel.
