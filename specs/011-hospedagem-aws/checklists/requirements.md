# Specification Quality Checklist: Hospedagem na AWS

**Purpose**: Validar completude e qualidade dos requisitos
**Created**: 2026-09-21
**Feature**: [spec.md](../spec.md)

**Review Ownership**: Artefato de revisão de qualidade de requisitos. Um item só
é marcado `[x]` quando o revisor determina que o critério está satisfeito.

## Content Quality

- [x] Sem detalhes de implementação (linguagem, framework, API)
- [x] Focado em valor ao usuário
- [x] Escrito para quem não é técnico
- [x] Seções obrigatórias completas

## Requirement Completeness

- [x] Nenhum marcador [NEEDS CLARIFICATION] remanescente
- [x] Requisitos testáveis e inequívocos
- [x] Critérios de sucesso mensuráveis
- [x] Critérios de sucesso independentes de tecnologia
- [x] Todos os cenários de aceitação definidos
- [x] Casos-limite identificados
- [x] Escopo claramente delimitado
- [x] Dependências e premissas identificadas

## Feature Readiness

- [x] Todo requisito funcional tem critério de aceitação claro
- [x] Os cenários cobrem o fluxo principal
- [x] A feature atende aos critérios de sucesso definidos
- [x] Nenhum detalhe de implementação vazou para a spec

## Escopo da Decomposição

- [x] A feature não contém requisito pertencente a outra feature
- [x] As dependências de outras features estão declaradas
- [x] Os termos usados estão definidos em `CONTEXT.md`
- [x] Nenhum sinônimo de `_Avoid_` é usado
- [x] Os requisitos transversais estão presentes, e não apenas assumidos

## Notes

### Avaliação de 2026-09-21

- **Requisitos funcionais**: 17. São 4 transversais reutilizados (FR-044,
  FR-045, FR-078 e FR-079) e 13 específicos (FR-122 a FR-134). A faixa começa em
  FR-122, continuando a numeração de `010-postgresql-na-nuvem`, que terminou em
  FR-121, e não há lacuna.
- **FR-044 e FR-045 reutilizados com o mesmo enunciado de `010`**: a função da
  nuvem também depende do armazenamento, e uma inicialização falha ou um banco
  inalcançável é indisponibilidade do armazenamento. Os dois transversais não são
  forçados a caber: o FR-126 remete explicitamente a eles, exigindo que a falha
  seja reportada e que nada passe por concluído.
- **FR-078 reutilizado com o mesmo enunciado de `008`**: a Senha e a Credencial
  atravessam o CloudFront até a função, e a regra de não devolvê-las, não
  registrá-las em log e não gravá-las no navegador vale igualmente na nuvem. O
  FR-123 cuida do segredo do servidor e dos demais segredos, e o FR-078 cuida da
  Senha do Usuário — nenhum dos dois é forçado a cobrir o outro.
- **FR-079 reutilizado com o mesmo enunciado de `008`**: o FR-131 exige que a
  Credencial atravesse o CloudFront apresentada em cada requisição e remete ao
  FR-079, preservando o invariante de que não existe sessão, cookie ou token.
- **FR-077 não é reutilizado**: o enunciado da `007` trata da recusa de iniciar
  sem o segredo do servidor na execução local. Na nuvem, o segredo do servidor é
  um dos três lidos do cofre e a recusa é a do FR-126; o FR-123 o nomeia
  explicitamente como origem, e o transversal não é forçado a caber.
- **FR-042 e FR-046 não são reutilizados**: esta feature não acrescenta tela nem
  texto de interface. A informação de saúde da API é a de `/health`, já existente,
  e as mensagens operacionais estão declaradas em português pelos próprios FRs
  desta feature.
- **FR-120 referenciado**: o FR-130 exige do pacote da função o mesmo que o
  FR-120 da `009` exige dos pacotes por armazenamento — o pacote de um
  armazenamento não contém o Adapter do outro. A exigência é citada, e não
  reescrita, porque o enunciado é da `009`.
- **Critérios de sucesso**: 11, todos novos, SC-051 a SC-061, sem lacuna na
  numeração. A faixa começa em SC-051, continuando a numeração de `010`, que
  terminou em SC-050. Nenhum critério antigo é reutilizado: os de `001` a `008`
  medem comportamento de Cartões, Baralhos, Vínculos, Sessão de estudo, Cadastro
  e Entrar, que esta feature não altera, e o critério novo para isso é o SC-051,
  que exige a aplicação publicada funcionando de ponta a ponta na mesma origem.
- **Requisitos negativos**: FR-123, FR-125, FR-128, FR-130 e FR-079 têm
  verificação declarada na tabela única "Verificação dos Requisitos Negativos".
  FR-123 cobre o segredo fora de arquivo versionado, saída, registro e resposta;
  FR-125 cobre a requisição sem o segredo de origem correto, que nunca chega à
  aplicação; FR-128 cobre a ausência do cabeçalho permissivo em produção; FR-130
  cobre a exclusividade dos pacotes por armazenamento; e FR-079 cobre a ausência
  de sessão, cookie ou token na aplicação publicada.
- **Rastreabilidade dos cenários-limite**: cada caso-limite tem cenário de
  aceitação correspondente — segredo do servidor ausente, banco inalcançável e
  esquema desatualizado no FR-126 (US2, cenário 6) e no FR-127 (US3, cenário 7);
  requisição direta à URL pública da função no FR-125 (US2, cenários 1 e 2);
  segredo de origem errado no FR-125 (US2, cenário 2); requisição pelo CloudFront
  no FR-122 (US1, cenários 3 e 4) e no FR-125 (US2, cenário 3); SPA e API na mesma
  origem no FR-128 (US1, cenário 1); execução local no FR-122 (US1, cenário 6) e
  no FR-128 (US2/US3, verificação do FR-128); pacote com o armazenamento errado no
  FR-130 (US3, cenário 2); memória abaixo do necessário no FR-132 (US3, cenário
  6); e segredo de conexão versionado no FR-123 (US2, cenário 7).
- **"Sem detalhes de implementação"**: a spec nomeia AWS, a função, o CloudFront,
  o S3, o parameter store, o Neon, o PostgreSQL e o OpenTofu porque foi o Product
  Owner quem pediu a "capability de AWS" e porque a infraestrutura já mesclada
  nomeia esses serviços; a capacidade é operacional. Nenhum nome de código
  aparece — não há biblioteca, classe ou função citada —, e `/api` e `/health` são
  os caminhos do contrato de integração da infraestrutura já mesclada, declarados
  como contrato e não como escolha de implementação. Ferramenta de empacotamento,
  formato do evento, nome dos scripts e forma do manual ficam para o `plan`.
- **Escopo da decomposição**: a execução da API como função da nuvem, a proteção
  por segredo de origem, a leitura dos segredos do cofre, o empacotamento, a
  publicação do SPA e o manual de operação pertencem a esta feature; a Porta, o
  Adapter de PostgreSQL, a URL de conexão e o comando de migração da nuvem
  pertencem a `009` e a `010`, e a Credencial pertence a `008-entrar` — a divisão
  está declarada na linha Input, na introdução dos requisitos específicos e em
  "Funcionalidades Adiadas".
- **Escopo claramente delimitado**: as "Funcionalidades Adiadas" retiram
  explicitamente o domínio próprio e o certificado, a firewall de aplicação e a
  limitação de taxa, o bloqueio por tentativas, o encadeamento automático de
  construção e implantação, os múltiplos ambientes, a automação do projeto no
  Neon e o roteamento por caminho.
- **Termos de `CONTEXT.md`**: esta feature não introduz termo de domínio novo e
  não renomeia nenhum termo canônico. Função da nuvem, segredo de origem, cofre de
  segredos, SPA publicado e pacote da função nomeiam a capacidade operacional
  pedida pelo Product Owner, e Credencial é o termo canônico de `008-entrar`.
  Nenhum sinônimo de `_Avoid_` é usado.
- **Item 1 e item 10 de `aws_pendencias.md` são obsoletos**: previam entrada pelo
  provedor Google e cookie de sessão. A autenticação foi entregue pela `008-entrar` com a
  Credencial apresentada em cada requisição, e o segredo do servidor das Senhas
  deixou de ser um segredo de sessão para ser um dos três segredos lidos do cofre.
  A spec não os reutiliza e registra a obsolescência nas Assumptions.

Nenhum item reprovado. **21 de 21.**

### Clarify de 2026-09-21

Cinco pontos resolvidos:
- a entrada pelo provedor Google e o cookie de sessão são obsoletas, e a
  Credencial de `008-entrar` é a única forma de acesso;
- a função não migra: quem migra é o operador, com o comando de migração da nuvem;
- a política permissiva de outra origem permanece apenas na execução local;
- a verificação sem publicar na AWS exercita o handler localmente contra o
  PostgreSQL de teste real e confere formato e validação do código de
  infraestrutura, e o `apply` é ação do operador;
- o percentil 95 das operações simples na função fica abaixo de 1 segundo, o que
  pode exigir elevar a memória da função para 1024 MB.

Continua 21 de 21.
