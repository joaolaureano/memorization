import type {
  CodigoDeErroDeBaralho,
  CodigoDeErroDeCadastro,
  CodigoDeErroDeCartao,
  CodigoDeErroDeNaoEncontrado,
  CodigoDeErroDeVinculo,
} from "./validacao";

/**
 * Seam `ClienteDoAcervo` (T008; specs/001-criar-cartao/plan.md; T106;
 * specs/003-vincular-cartao-baralho/plan.md; specs/005-editar-cartao-e-baralho/plan.md;
 * specs/006-excluir-cartao-e-baralho/plan.md;
 * specs/007-criar-usuario/plan.md).
 *
 * Espelha as operações da Interface do Module `Acervo` e acrescenta o que a
 * rede introduz. As operações são **assíncronas e sujeitas a
 * indisponibilidade** — a diferença essencial em relação ao `Acervo`, e a
 * razão de esta Seam existir. Dois Adapters justificados: `ClienteHttp` em
 * produção e `ClienteEmMemoria` em teste.
 *
 * Invariantes garantidas pela Interface, que o caller nunca reproduz:
 * nenhuma resposta que não seja de sucesso é apresentada como operação
 * concluída (FR-044). Modos de erro: os do `Acervo` e os do `Identidade`, mais
 * `indisponivel` para falha de transporte e `nao_autenticado` para a recusa
 * por Credencial — dois modos distintos, porque a interface reage de forma
 * distinta a cada um (FR-091).
 */

/**
 * A única entidade desta feature: Frente e Verso, e nada além (FR-009).
 *
 * O `id` é um identificador opaco gerado pelo sistema. A Frente **não** é
 * identificador: dois Cartões podem ter a mesma Frente.
 */
export interface Cartao {
  id: string;
  frente: string;
  verso: string;
}

/**
 * Cartão como devolvido por `listarCartoes`: o Cartão mais os Baralhos a que
 * está vinculado (FR-003) e a próxima revisão do seu Agendamento (FR-352). O
 * Cartão sem nenhum Baralho devolve `baralhos: []` — estado legítimo, e não
 * ausência de campo. `criarCartao` e `editarCartao` continuam devolvendo
 * apenas `Cartao`, sem carregar campos que a escrita não exige.
 */
export interface CartaoListado extends Cartao {
  baralhos: Baralho[];
  /**
   * ISO-8601 da próxima revisão do Agendamento do Cartão, ou `null` quando o
   * Cartão não tem Agendamento (FR-352).
   */
  proximaRevisaoEm: string | null;
}

/**
 * O que `criarCartao` recebe: exatamente Frente e Verso (FR-001).
 *
 * O objeto pode carregar propriedades além dessas duas: elas são ignoradas,
 * porque a Interface lê apenas os campos canônicos — é assim que a Interface
 * garante FR-009 sem que o caller reproduza a regra.
 */
export interface DadosDeCartao {
  frente: string;
  verso: string;
}

/**
 * Código estável de indisponibilidade do transporte até a API.
 *
 * Não é erro de regra de Cartão: surge quando a API não responde, responde
 * um status fora do contrato ou entrega um corpo que não é o contrato. Em
 * qualquer desses casos a operação **não foi concluída** (FR-044).
 */
export const INDISPONIVEL = "indisponivel" as const;

/**
 * Mensagem em português destinada ao usuário quando o transporte falha
 * (FR-046). A interface exibe `mensagem` e nunca inventa texto próprio para
 * uma falha.
 */
export const MENSAGEM_DE_INDISPONIBILIDADE =
  "Não foi possível acessar os Cartões. Tente novamente.";

/**
 * Mensagem em português destinada ao usuário quando o transporte até as rotas
 * de Baralho falha (FR-046). Mantida separada da mensagem de Cartão para que
 * cada operação anuncie a entidade que falhou.
 */
export const MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS =
  "Não foi possível acessar os Baralhos. Tente novamente.";

/**
 * Mensagem em português destinada ao usuário quando o transporte até as rotas
 * de Vínculo falha (FR-046). Mantida separada das mensagens de Cartão e de
 * Baralho para que cada operação anuncie a entidade que falhou.
 */
export const MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS =
  "Não foi possível acessar os Vínculos. Tente novamente.";

/**
 * Mensagem em português destinada ao usuário quando o transporte até as rotas
 * de Usuário falha (FR-046). Mantida separada das demais para que cada
 * operação anuncie a entidade que falhou.
 */
export const MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS =
  "Não foi possível acessar os Usuários. Tente novamente.";

/**
 * A Credencial desta feature (FR-089): Nome de usuário e Senha, e nada além.
 *
 * Ela existe apenas na memória da página aberta e acompanha cada operação. Não
 * é token, sessão nem cookie, e por isso não há campo, cabeçalho de resposta ou
 * armazenamento capaz de guardá-la entre operações: o `ClienteHttp` a recebe na
 * construção e a apresenta de novo em cada chamada.
 */
export interface Credencial {
  nomeDeUsuario: string;
  senha: string;
}

/**
 * Modo de erro da recusa por Credencial (FR-090, FR-091).
 *
 * É distinto de `indisponivel` de propósito: a Credencial recusada é
 * descartada e devolve a pessoa a "Entrar" com mensagem explicativa (SC-035),
 * enquanto a falha de transporte preserva o digitado e permite nova tentativa
 * (FR-045). Confundir os dois faria a interface mentir sobre a causa.
 */
export const NAO_AUTENTICADO = "nao_autenticado" as const;

/**
 * A **única** mensagem da recusa de Entrar (FR-088): a mesma exista ou não o
 * Nome de usuário informado, sem revelar qual parte da Credencial falhou.
 * Idêntica à do contrato da API (contracts/api-entrar.md), e por isso os dois
 * Adapters da Seam devolvem o mesmo texto.
 */
export const MENSAGEM_DE_CREDENCIAL_INVALIDA =
  "Nome de usuário ou Senha incorretos.";

/**
 * Mensagem em português destinada ao usuário quando uma operação do acervo é
 * recusada por Credencial (FR-046, FR-091). É a explicação que a tela "Entrar"
 * apresenta depois de descartar a Credencial.
 */
export const MENSAGEM_DE_NAO_AUTENTICADO =
  "A Credencial não é mais válida. Informe o Nome de usuário e a Senha para Entrar novamente.";

/**
 * Mensagem em português destinada ao usuário quando o transporte até as rotas
 * de histórico falha (FR-161, FR-046). Mantida separada das mensagens de
 * Cartão, Baralho, Vínculo e Usuário para que cada operação anuncie a entidade
 * que falhou.
 */
export const MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO =
  "Não foi possível acessar o seu histórico agora. Tente novamente.";

/**
 * Mensagem da recusa `dados_invalidos` ao registrar uma Sessão (FR-161): o
 * corpo enviado não respeita as invariantes do contrato.
 */
export const MENSAGEM_DE_DADOS_INVALIDOS =
  "Os dados da Sessão não são válidos.";

/**
 * Mensagem da recusa `conflito` ao registrar uma Sessão (FR-163): o `id`
 * enviado já pertence ao histórico de **outro** Usuário. Nunca se sobrescreve
 * o Registro alheio.
 */
export const MENSAGEM_DE_CONFLITO_DE_SESSAO =
  "O identificador da Sessão já está em uso.";

/**
 * Mensagem da recusa `nao_encontrado` ao abrir um Registro (FR-166): ele não
 * existe no histórico deste Usuário.
 */
export const MENSAGEM_DE_SESSAO_NAO_ENCONTRADA = "Sessão não encontrada.";

/**
 * Mensagem em português destinada ao usuário quando o transporte até as rotas
 * de repetição espaçada falha (FR-046, FR-221). Mantida separada das demais
 * para que cada operação anuncie a entidade que falhou.
 */
export const MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO =
  "Não foi possível acessar a revisão agora. Tente novamente.";

/**
 * Mensagem em português destinada ao usuário quando o transporte até as rotas
 * de Preferências falha (FR-046). Mantida separada das demais para que cada
 * operação anuncie a entidade que falhou.
 */
export const MENSAGEM_DE_INDISPONIBILIDADE_DE_PREFERENCIAS =
  "Não foi possível acessar as Preferências. Tente novamente.";

/**
 * Mensagem da recusa `dados_invalidos` ao salvar as Preferências (FR-212): o
 * algoritmo informado não respeita o contrato.
 */
export const MENSAGEM_DE_DADOS_INVALIDOS_DE_PREFERENCIAS =
  "As Preferências informadas não são válidas.";

/**
 * Resultado de `entrar`. Sucesso traz exatamente o Usuário que Entrou — `id` e
 * `nomeDeUsuario`, nunca a Senha nem qualquer derivação dela (FR-078, FR-086).
 * A recusa é `nao_autenticado`, com a mensagem única; a falha de transporte
 * continua sendo `indisponivel`.
 */
export type ResultadoDeEntrar =
  | { ok: true; usuario: Usuario }
  | {
      ok: false;
      erro: typeof NAO_AUTENTICADO | typeof INDISPONIVEL;
      mensagem: string;
    };

/**
 * Resultado de `criarCartao`. Falha é resultado previsto, e não exceção: o
 * caller distingue `ok` e, na recusa, recebe o código estável e a mensagem
 * em português — os códigos de regra de Cartão, `indisponivel` para a falha
 * de transporte ou `nao_autenticado` para a recusa por Credencial.
 */
export type ResultadoDeCriacaoDeCartao =
  | { ok: true; cartao: Cartao }
  | {
      ok: false;
      erro:
        | CodigoDeErroDeCartao
        | typeof INDISPONIVEL
        | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * Resultado de `listarCartoes`. A listagem não tem recusa de domínio: as
 * falhas são `indisponivel` e `nao_autenticado`, e nenhuma lista é entregue
 * sem sucesso.
 */
export type ResultadoDeListagemDeCartoes =
  | { ok: true; cartoes: CartaoListado[] }
  | {
      ok: false;
      erro: typeof INDISPONIVEL | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * A única entidade desta feature: id opaco e nome, e nada além (FR-018).
 *
 * O `id` é um identificador opaco gerado pelo sistema. O nome **não** é
 * identificador: dois Baralhos podem ter o mesmo nome (FR-012).
 */
export interface Baralho {
  id: string;
  nome: string;
}

/**
 * O que `criarBaralho` recebe: exatamente o nome.
 *
 * O objeto pode carregar propriedades além dessa: elas são ignoradas, porque
 * a Interface lê apenas os campos canônicos — é assim que a Interface garante
 * FR-018 sem que o caller reproduza a regra.
 */
export interface DadosDeBaralho {
  nome: string;
}

/**
 * Baralho como devolvido por `listarBaralhos`: o Baralho mais a contagem de
 * Cartões e a elegibilidade, ambas derivadas na leitura a partir dos Vínculos
 * — nunca armazenadas (FR-024).
 */
export interface BaralhoListado extends Baralho {
  quantidadeDeCartoes: number;
  elegivel: boolean;
}

/**
 * Baralho como devolvido por `obterBaralho`: o Baralho com a elegibilidade
 * derivada e os Cartões vinculados, conforme o contrato de
 * `GET /baralhos/{id}` (FR-014).
 */
export interface BaralhoComCartoes extends Baralho {
  elegivel: boolean;
  cartoes: Cartao[];
}

/**
 * Resultado de `criarBaralho`. Falha é resultado previsto, e não exceção: o
 * caller distingue `ok` e, na recusa, recebe o código estável e a mensagem
 * em português — os códigos de regra de Baralho, `indisponivel` para a falha
 * de transporte ou `nao_autenticado` para a recusa por Credencial.
 */
export type ResultadoDeCriacaoDeBaralho =
  | { ok: true; baralho: Baralho }
  | {
      ok: false;
      erro:
        | CodigoDeErroDeBaralho
        | typeof INDISPONIVEL
        | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * O que a tela manda ao salvar uma seleção como Baralho num gesto único
 * (FR-371): o `id` do Baralho, o nome e os Cartões escolhidos, na ordem em que
 * foram apresentados. O `id` vem do cliente para que o mesmo envio não duplique
 * nada (FR-372).
 */
export interface DadosDeSelecaoParaBaralho {
  id: string;
  nome: string;
  cartaoIds: readonly string[];
}

/**
 * O desfecho de `salvarSelecaoComoBaralho`: o Baralho criado com os Vínculos,
 * ou a recusa — `cartoes_indisponiveis` devolve os ids que não são mais do dono
 * (FR-373), `conflito` avisa que o `id` já pertence a outro dono e pede um id
 * novo (FR-374), e os demais códigos seguem o contrato dos Baralhos (FR-371).
 */
export type ResultadoDeSalvarSelecao =
  | { ok: true; baralho: Baralho }
  | { ok: false; erro: CodigoDeErroDeBaralho; mensagem: string }
  | {
      ok: false;
      erro: "cartoes_indisponiveis";
      mensagem: string;
      cartaoIds: string[];
    }
  | { ok: false; erro: "conflito"; mensagem: string }
  | {
      ok: false;
      erro: typeof INDISPONIVEL | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * Resultado de `listarBaralhos`. A listagem não tem recusa de domínio: as
 * falhas são `indisponivel` e `nao_autenticado`, e nenhuma lista é entregue
 * sem sucesso.
 */
export type ResultadoDeListagemDeBaralhos =
  | { ok: true; baralhos: BaralhoListado[] }
  | {
      ok: false;
      erro: typeof INDISPONIVEL | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * Resultado de `vincular`. Sucesso não tem carga; as recusas de domínio são
 * `vinculo_duplicado` (par já existente) e `nao_encontrado` (Cartão ou Baralho
 * inexistente).
 */
export type ResultadoDeVinculacao =
  | { ok: true }
  | {
      ok: false;
      erro:
        | "vinculo_duplicado"
        | CodigoDeErroDeNaoEncontrado
        | typeof INDISPONIVEL
        | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * Resultado de `desvincular`. Sucesso não tem carga; a única recusa de domínio
 * é `vinculo_nao_encontrado` (Vínculo inexistente).
 */
export type ResultadoDeDesvinculacao =
  | { ok: true }
  | {
      ok: false;
      erro:
        | CodigoDeErroDeVinculo
        | typeof INDISPONIVEL
        | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * Resultado de `obterBaralho`. Sucesso devolve o Baralho com seus Cartões;
 * Baralho inexistente é recusado como `nao_encontrado`.
 */
export type ResultadoDeObterBaralho =
  | { ok: true; baralho: BaralhoComCartoes }
  | {
      ok: false;
      erro:
        | CodigoDeErroDeNaoEncontrado
        | typeof INDISPONIVEL
        | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * Resultado de `editarCartao`. As regras de conteúdo são as mesmas da criação;
 * Cartão inexistente é recusado como `nao_encontrado`.
 */
export type ResultadoDeEdicaoDeCartao =
  | { ok: true; cartao: Cartao }
  | {
      ok: false;
      erro:
        | CodigoDeErroDeCartao
        | CodigoDeErroDeNaoEncontrado
        | typeof INDISPONIVEL
        | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * Resultado de `renomearBaralho`. As regras de nome são as mesmas da criação;
 * Baralho inexistente é recusado como `nao_encontrado`.
 */
export type ResultadoDeRenomeacaoDeBaralho =
  | { ok: true; baralho: Baralho }
  | {
      ok: false;
      erro:
        | CodigoDeErroDeBaralho
        | CodigoDeErroDeNaoEncontrado
        | typeof INDISPONIVEL
        | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * Resultado de `excluirCartao`. Sucesso não tem carga; Cartão inexistente é
 * recusado como `nao_encontrado`.
 */
export type ResultadoDeExclusaoDeCartao =
  | { ok: true }
  | {
      ok: false;
      erro:
        | CodigoDeErroDeNaoEncontrado
        | typeof INDISPONIVEL
        | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * Resultado de `excluirBaralho`. Sucesso não tem carga; Baralho inexistente é
 * recusado como `nao_encontrado`.
 */
export type ResultadoDeExclusaoDeBaralho =
  | { ok: true }
  | {
      ok: false;
      erro:
        | CodigoDeErroDeNaoEncontrado
        | typeof INDISPONIVEL
        | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * O Usuário desta feature: id opaco e Nome de usuário, e nada além (FR-071).
 *
 * É a forma de **Interface**, e não de banco: `sal`, `hash`, `parametros` e a
 * Senha não existem aqui. Nenhuma leitura os devolve, em nenhum retorno
 * (FR-076, FR-078).
 */
export interface Usuario {
  id: string;
  nomeDeUsuario: string;
}

/**
 * O que `criarUsuario` recebe: Nome de usuário e Senha (FR-071).
 *
 * A Confirmação da Senha **não** faz parte deste contrato: FR-072 é verificado
 * na tela, antes do envio, e a API não recebe esse campo.
 *
 * O objeto pode carregar propriedades além dessas duas: elas são ignoradas,
 * porque a Interface lê apenas os campos canônicos.
 */
export interface DadosDeUsuario {
  nomeDeUsuario: string;
  senha: string;
}

/**
 * Resultado de `criarUsuario`. Falha é resultado previsto, e não exceção: o
 * caller distingue `ok` e, na recusa, recebe o código estável e a mensagem em
 * português — os códigos de Cadastro, ou `indisponivel`.
 */
export type ResultadoDeCriacaoDeUsuario =
  | { ok: true; usuario: Usuario }
  | {
      ok: false;
      erro: CodigoDeErroDeCadastro | typeof INDISPONIVEL;
      mensagem: string;
    };

/**
 * A Avaliação de um Cartão em 4 níveis (FR-193): substitui o antigo
 * `Resultado` de dois níveis como entrada da Sessão. O `resultado`
 * (`"acertou" | "errou"`) passa a ser **derivado** dela — `errei` vira
 * `errou`; `dificil`, `bom` e `facil` viram `acertou` (FR-194, FR-195).
 */
export type Avaliacao = "errei" | "dificil" | "bom" | "facil";

/**
 * O desfecho de um Item apresentado numa Sessão: acertou ou errou (FR-162).
 *
 * Continua sendo vocabulário de **leitura**: é o servidor quem o deriva da
 * Avaliação, e o cliente nunca o envia (FR-194).
 */
export type ResultadoDoItemRegistrado = "acertou" | "errou";

/**
 * Um Item já registrado, na ordem em que foi apresentado (FR-162, FR-164).
 *
 * `posicao` é 0..n-1 e é derivada pelo servidor no momento do registro; o
 * cliente nunca a envia. `cartaoId` e `avaliacao` são opcionais: os Registros
 * anteriores à 015 não os têm, e a interface os exibe como sempre os exibiu
 * (FR-196, FR-197, FR-214).
 */
export interface ItemRegistrado {
  posicao: number;
  frente: string;
  verso: string;
  resultado: ResultadoDoItemRegistrado;
  /** Cartão de origem; ausente/nulo em Itens anteriores à 015 (FR-196). */
  cartaoId?: string | null;
  /** Avaliação em 4 níveis; ausente/nula em Itens anteriores à 015 (FR-196). */
  avaliacao?: Avaliacao | null;
}

/**
 * Linha de listagem do histórico: o Registro sem os itens (FR-164, FR-165).
 *
 * É o que as estatísticas e as listagens transportam — os itens só existem no
 * Registro completo, obtido por `obterRegistroDeSessao`.
 */
export interface RegistroResumido {
  id: string;
  origem: "baralho" | "revisao" | "temporario";
  baralhoId: string;
  nomeDoBaralho: string;
  concluidaEm: string;
  estudados: number;
  acertos: number;
  erros: number;
}

/**
 * O Registro de uma Sessão concluída, com os itens na ordem apresentada
 * (FR-161, FR-162).
 *
 * `baralhoId` é guardado sem chave estrangeira: o Baralho pode ser excluído
 * depois, e `nomeDoBaralho` é o nome no momento da conclusão — por isso o
 * Registro sobrevive à exclusão do Baralho (FR-166).
 */
export interface RegistroDeSessao extends RegistroResumido {
  itens: ItemRegistrado[];
}

/**
 * O que `registrarSessao` envia: os dados da Sessão concluída (FR-161, FR-163).
 *
 * O `id` é gerado pelo cliente (UUID) e é o que torna o registro idempotente:
 * o mesmo `id` reenviado devolve o mesmo Registro, sem duplicar. Os totais —
 * `estudados`, `acertos`, `erros` — e a `concluidaEm` são derivados pelo
 * servidor e nunca vêm do cliente.
 */
export interface DadosDeRegistro {
  id: string;
  /** Origem da Sessão: estudo livre por Baralho ou Revisão do dia (FR-196). */
  origem: "baralho" | "revisao" | "temporario";
  baralhoId: string;
  nomeDoBaralho: string;
  /**
   * Id do início autorizado da Agenda (FR-254); ausente no estudo livre.
   */
  inicioAgendaId?: string;
  /**
   * Cada Item carrega o Cartão de origem e a Avaliação (FR-196); o
   * `resultado` **não** vem do cliente — é o servidor que o deriva
   * (`errei` → `errou`; os demais → `acertou`) (FR-194).
   */
  itens: {
    frente: string;
    verso: string;
    cartaoId: string;
    avaliacao: Avaliacao;
  }[];
}

/**
 * Os números do Início (FR-164, FR-165): o tamanho atual do acervo e o
 * histórico da janela pedida.
 *
 * `registrosDaJanela` são os Registros com `concluidaEm >= desde`, do mais
 * recente ao mais antigo; `recentes`, os 5 mais recentes, independentemente da
 * janela.
 */
export interface Estatisticas {
  cartoes: number;
  baralhos: number;
  registrosDaJanela: RegistroResumido[];
  recentes: RegistroResumido[];
}

/**
 * Resultado de `registrarSessao`. Sucesso devolve o Registro criado — ou o já
 * existente, quando o `id` se repete (FR-163). As recusas de domínio são
 * `dados_invalidos` (corpo fora das invariantes) e `conflito` (`id` já usado
 * por outro Usuário).
 */
export type ResultadoDeRegistroDeSessao =
  | { ok: true; registro: RegistroDeSessao }
  | {
      ok: false;
      erro:
        | "dados_invalidos"
        | "conflito"
        | typeof INDISPONIVEL
        | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * Resultado de `obterEstatisticas`. A leitura não tem recusa de domínio no
 * contrato do cliente: as falhas são `indisponivel` e `nao_autenticado`, e
 * nenhum número é entregue sem sucesso.
 */
export type ResultadoDeEstatisticas =
  | { ok: true; estatisticas: Estatisticas }
  | {
      ok: false;
      erro: typeof INDISPONIVEL | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * Resultado de `obterRegistroDeSessao`. `baralhoExiste` conta se o Baralho da
 * Sessão ainda existe no acervo (FR-166), já que o Registro sobrevive à
 * exclusão dele. Registro inexistente ou de outro Usuário é recusado como
 * `nao_encontrado` (FR-092).
 */
export type ResultadoDeObterRegistro =
  | { ok: true; registro: RegistroDeSessao; baralhoExiste: boolean }
  | {
      ok: false;
      erro:
        | "nao_encontrado"
        | typeof INDISPONIVEL
        | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * A prévia de agendamento de um Cartão: o instante ISO que o servidor
 * devolveria para cada uma das 4 Avaliações (FR-221). A interface apenas a
 * exibe — nunca reimplementa o algoritmo (D7).
 */
export type Previa = Record<Avaliacao, string>;

/** Uma opção de algoritmo oferecida pela tela de Preferências (FR-212). */
export interface OpcaoDeAlgoritmo {
  id: string;
  rotulo: string;
}

/**
 * As Preferências do Usuário (FR-212): o algoritmo escolhido e a lista de
 * algoritmos disponíveis.
 */
export interface Preferencias {
  algoritmo: string;
  algoritmos: OpcaoDeAlgoritmo[];
}

/**
 * Resultado de `obterPrevias`. Sem recusa de domínio: as falhas são
 * `indisponivel` e `nao_autenticado`.
 */
export type ResultadoDasPrevias =
  | { ok: true; previas: Record<string, Previa> }
  | {
      ok: false;
      erro: typeof INDISPONIVEL | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * Resultado de `obterPreferencias`. Sem recusa de domínio: as falhas são
 * `indisponivel` e `nao_autenticado`.
 */
export type ResultadoDePreferencias =
  | { ok: true; preferencias: Preferencias }
  | {
      ok: false;
      erro: typeof INDISPONIVEL | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * Resultado de `salvarPreferencias`. A recusa de domínio é `dados_invalidos`
 * (algoritmo fora do contrato, FR-212); as falhas de transporte são
 * `indisponivel` e `nao_autenticado`.
 */
export type ResultadoDeSalvarPreferencias =
  | { ok: true; preferencias: Preferencias }
  | {
      ok: false;
      erro: "dados_invalidos" | typeof INDISPONIVEL | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/**
 * Estado de uma Rotina de estudo (FR-248): ativa, pausada ou excluída.
 */
export type EstadoDaRotina = "ativa" | "pausada" | "excluida";

/**
 * Uma Rotina de estudo agendada (FR-248, FR-250): os dias da semana
 * (1=segunda a 7=domingo) e a quantidade de Cartões por dia.
 */
export interface RotinaDeEstudo {
  id: string;
  baralhoId: string;
  nomeDoBaralho: string;
  dias: number[];
  quantidade: number | null;
  estado: EstadoDaRotina;
  versao: number;
  criadaEm: string;
  /** `true` com o Baralho excluído ou vazio: a Rotina precisa de ajuste (FR-243). */
  indisponivel: boolean;
}

/**
 * Estado de um Compromisso de estudo (FR-248, FR-250).
 */
export type EstadoDoCompromisso =
  | "pendente"
  | "programado"
  | "nao_realizado"
  | "concluido"
  | "cancelado";

/**
 * Um Compromisso de estudo do dia (FR-248, FR-250): a Rotina que o gerou, a
 * data, o Baralho e o Registro quando concluído.
 */
export interface CompromissoDeEstudo {
  rotinaId: string;
  data: string;
  baralhoId: string;
  nomeDoBaralho: string;
  quantidade: number | null;
  estado: EstadoDoCompromisso;
  indisponivel: boolean;
  registroId: string | null;
}

/**
 * A semana da Agenda (FR-248, FR-250): o início, hoje e o fuso consultados,
 * com os Compromissos da semana e os de hoje.
 */
export interface SemanaDaAgenda {
  inicio: string;
  hoje: string;
  fuso: string;
  compromissos: CompromissoDeEstudo[];
  compromissosDeHoje: CompromissoDeEstudo[];
}

/**
 * O início autorizado de um Compromisso (FR-248, FR-250): o snapshot dos
 * Cartões selecionados pelo servidor para a Sessão.
 */
export interface InicioDeCompromisso {
  id: string;
  rotinaId: string;
  data: string;
  baralhoId: string;
  nomeDoBaralho: string;
  cartoes: Cartao[];
  quantidadeSolicitada: number | null;
}

/**
 * A ação de uma Rotina de estudo (FR-248, FR-250).
 */
export type AcaoDeRotina =
  | "criar"
  | "editar"
  | "pausar"
  | "retomar"
  | "excluir";

/**
 * O que `salvarRotina` envia (FR-248, FR-250): a intenção idempotente pelo
 * `operacaoId`, com os campos exigidos por cada ação.
 */
export interface DadosDeRotina {
  operacaoId: string;
  id?: string;
  versao?: number;
  acao: AcaoDeRotina;
  baralhoId?: string;
  dias?: number[];
  quantidade?: number | null;
  confirmarSobreposicao?: boolean;
  fuso: string;
}

/**
 * O que `iniciarCompromisso` envia (FR-248, FR-250): a Rotina, a data e o
 * fuso.
 */
export interface DadosDeInicioDeCompromisso {
  rotinaId: string;
  data: string;
  fuso: string;
}

/**
 * Os códigos de erro estáveis das operações da Agenda (FR-248, FR-250).
 */
export type CodigoDeErroDeAgenda =
  | "dados_invalidos"
  | "nao_encontrado"
  | "conflito"
  | "sobreposicao"
  | typeof INDISPONIVEL
  | typeof NAO_AUTENTICADO;

/** Resultado de `obterAgenda` (FR-248, FR-250). */
export type ResultadoDeObterAgenda =
  | { ok: true; agenda: SemanaDaAgenda }
  | { ok: false; erro: CodigoDeErroDeAgenda; mensagem: string };

/** Resultado de `listarRotinas` (FR-248, FR-250). */
export type ResultadoDeListarRotinas =
  | { ok: true; rotinas: RotinaDeEstudo[] }
  | { ok: false; erro: CodigoDeErroDeAgenda; mensagem: string };

/** Resultado de `salvarRotina` (FR-248, FR-250). */
export type ResultadoDeSalvarRotina =
  | { ok: true; rotina: RotinaDeEstudo }
  | { ok: false; erro: CodigoDeErroDeAgenda; mensagem: string };

/** Resultado de `iniciarCompromisso` (FR-248, FR-250). */
export type ResultadoDeIniciarCompromisso =
  | { ok: true; inicio: InicioDeCompromisso }
  | { ok: false; erro: CodigoDeErroDeAgenda; mensagem: string };

/**
 * Mensagem em português para quando as rotas da Agenda não estão disponíveis
 * (FR-248, FR-250).
 */
export const MENSAGEM_DE_AGENDA_INDISPONIVEL =
  "A Agenda não está disponível agora. Tente novamente.";

/**
 * Contagens do que pertence ao Usuário, como `GET /conta` as informa (FR-272,
 * SC-113): o que a exclusão da conta removerá. `agenda` é a soma dos registros
 * persistidos da Agenda (Rotinas, Compromissos e Inícios), e `null` quando o
 * servidor não conhece a Agenda.
 */
export interface ContagensDaConta {
  cartoes: number;
  baralhos: number;
  registrosDeSessao: number;
  agenda: number | null;
}

/**
 * Os dados da seção «Minha conta» (FR-257, FR-258): o Nome de usuário atual e
 * as contagens. Nunca a Senha nem qualquer derivado dela. «Conta» é só o
 * rótulo da interface; o termo de domínio é Usuário.
 */
export interface DadosDaConta {
  nomeDeUsuario: string;
  contagens: ContagensDaConta;
}

/** Resultado de `obterConta`: as falhas são `indisponivel` e `nao_autenticado`. */
export type ResultadoDeObterConta =
  | { ok: true; dados: DadosDaConta }
  | {
      ok: false;
      erro: typeof INDISPONIVEL | typeof NAO_AUTENTICADO;
      mensagem: string;
    };

/** O que `trocarSenha` envia (FR-266): a Senha atual, a nova e a Confirmação. */
export interface DadosDeTrocaDeSenha {
  senhaAtual: string;
  novaSenha: string;
  confirmacaoDaSenha: string;
}

/** O que `excluirConta` envia (FR-273): a Senha atual. */
export interface DadosDeExclusaoDeConta {
  senhaAtual: string;
}

/**
 * Códigos de recusa de domínio da gestão da conta (017, §2.5). A Senha atual
 * incorreta é `403 senha_atual_incorreta`, e não `nao_autenticado`: a Credencial
 * que autentica a requisição continua válida (FR-279).
 */
export type CodigoDeErroDeConta =
  | "dados_invalidos"
  | "mesma_senha"
  | "senha_atual_incorreta";

/** Campo do formulário a que uma recusa de validação se refere. */
export type CampoDeConta =
  | "nomeDeUsuario"
  | "senhaAtual"
  | "novaSenha"
  | "confirmacaoDaSenha";

/** A recusa de uma ação da conta: código estável, mensagem e campo a corrigir. */
export interface RecusaDeConta {
  ok: false;
  erro: CodigoDeErroDeConta | typeof INDISPONIVEL | typeof NAO_AUTENTICADO;
  mensagem: string;
  campo?: CampoDeConta;
}

/** Resultado de `trocarSenha` e de `excluirConta`. */
export type ResultadoDeAcaoDeConta = { ok: true } | RecusaDeConta;

/** Mensagem quando o transporte até as rotas de conta falha (FR-046). */
export const MENSAGEM_DE_INDISPONIBILIDADE_DA_CONTA =
  "Não foi possível acessar a sua conta agora. Tente novamente.";

/** A mensagem única da Senha atual incorreta (FR-279), igual à da API. */
export const MENSAGEM_DE_SENHA_ATUAL_INCORRETA =
  "A Senha atual está incorreta.";

/**
 * O que `entrar` recebe (018): a Credencial e a escolha de **continuar
 * conectado neste navegador** (FR-292). Verdadeira, o servidor emite um Acesso
 * temporário em cookie `HttpOnly`; falsa, nenhum Acesso é emitido, e a
 * Credencial só vale na memória da página aberta. Ausente, vale o modo em que o
 * cliente já opera: com Acesso, verdadeira; com Credencial em memória, falsa —
 * é o que impede uma verificação (resultado incerto da 017) de criar um Acesso
 * que a pessoa não pediu.
 */
export interface DadosDeEntrada extends Credencial {
  continuarConectado?: boolean;
}

/**
 * A mensagem de Acesso expirado (FR-294): exibida tal qual na tela «Entrar»,
 * igual à que a API devolve em `401 acesso_expirado`.
 */
export const MENSAGEM_DE_ACESSO_EXPIRADO = "Seu acesso expirou. Entre novamente.";

/** Mensagem quando o transporte até as rotas do Acesso falha (FR-046, FR-301). */
export const MENSAGEM_DE_INDISPONIBILIDADE_DO_ACESSO =
  "Não foi possível verificar o seu acesso agora. Tente novamente.";

/**
 * Resultado de `obterAcesso` (018, FR-290): o Nome de usuário de quem tem
 * Acesso válido neste navegador, ou por que não há. `sem_acesso` e
 * `acesso_expirado` levam a Entrar; `indisponivel` **não** é expiração — o
 * Acesso pode ainda valer (FR-301).
 */
export type ResultadoDeObterAcesso =
  | { ok: true; nomeDeUsuario: string }
  | {
      ok: false;
      erro: "sem_acesso" | "acesso_expirado" | typeof INDISPONIVEL;
      mensagem: string;
    };

/**
 * Resultado de `renovarAcesso`: a recusa por Acesso ausente ou expirado chega
 * como `nao_autenticado`, com a mensagem de expiração quando é o caso, e é a
 * guarda de Credencial que a leva a Entrar (FR-091 revisado, FR-294).
 */
export type ResultadoDeRenovarAcesso =
  | { ok: true }
  | {
      ok: false;
      erro: typeof NAO_AUTENTICADO | typeof INDISPONIVEL;
      mensagem: string;
    };

/**
 * Resultado de `sair` (FR-293, FR-295): encerrar o Acesso deste navegador. A
 * falha do armazenamento é `indisponivel` e **não** conclui o Sair — o Acesso
 * pode continuar valendo (FR-044).
 */
export type ResultadoDeSair =
  | { ok: true }
  | { ok: false; erro: typeof INDISPONIVEL; mensagem: string };

/**
 * Interface do Module `ClienteDoAcervo` (Princípio IV).
 *
 * As operações assíncronas escondem o transporte até a API e a forma dos
 * dados na rede. Os dois Adapters — `ClienteHttp` e `ClienteEmMemoria` —
 * satisfazem esta mesma Interface e passam pela mesma bateria de contrato
 * com resultados idênticos.
 */
export interface ClienteDoAcervo {
  /**
   * Apresenta a Credencial e devolve o Usuário que Entrou (FR-086). Espaços ao
   * redor do Nome de usuário são descartados e a comparação não distingue
   * maiúsculas de minúsculas, com as mesmas regras do Cadastro; a Senha é
   * comparada exatamente, preservando espaços (FR-087).
   *
   * A recusa é **uma só** — Nome de usuário inexistente e Senha errada
   * devolvem `nao_autenticado` com a mesma mensagem, sem revelar qual parte
   * falhou (FR-088) —, e a Senha nunca aparece em nenhum retorno (FR-078).
   */
  entrar(dados: DadosDeEntrada): Promise<ResultadoDeEntrar>;

  criarCartao(dados: DadosDeCartao): Promise<ResultadoDeCriacaoDeCartao>;

  /**
   * Lista todos os Cartões existentes, cada um com sua Frente, seu Verso e
   * os Baralhos a que está vinculado (FR-003, FR-004). A Frente não é
   * identificador: dois Cartões de Frente idêntica são ambos devolvidos, sem
   * deduplicação.
   */
  listarCartoes(): Promise<ResultadoDeListagemDeCartoes>;

  /**
   * Cria um Baralho com o nome informado. Nome vazio ou composto só de
   * espaços é recusado como `nome_vazio` (FR-011); mais de 100 caracteres,
   * como `nome_muito_longo` (FR-061). O nome é rótulo, não identificador:
   * dois Baralhos de mesmo nome são ambos aceitos (FR-012).
   */
  criarBaralho(dados: DadosDeBaralho): Promise<ResultadoDeCriacaoDeBaralho>;

  /**
   * Salva uma seleção de Cartões como Baralho num gesto único (FR-371): cria o
   * Baralho e os Vínculos com os Cartões escolhidos, sem passar por
   * `criarBaralho` seguido de `vincular`. O mesmo `id` reenviado não duplica —
   * devolve o Baralho já existente (FR-372); `cartoes_indisponiveis` traz, na
   * ordem recebida, os ids que não são mais do dono (FR-373); `conflito` avisa
   * que o `id` pertence a outro dono e pede um id novo (FR-374).
   */
  salvarSelecaoComoBaralho(
    dados: DadosDeSelecaoParaBaralho,
  ): Promise<ResultadoDeSalvarSelecao>;

  /**
   * Lista todos os Baralhos existentes, cada um com id, nome, contagem de
   * Cartões e elegibilidade derivadas na leitura, a partir dos Vínculos. O
   * nome é rótulo, não identificador: dois Baralhos de nome idêntico são
   * ambos devolvidos, sem deduplicação.
   */
  listarBaralhos(): Promise<ResultadoDeListagemDeBaralhos>;

  /**
   * Devolve um Baralho com a elegibilidade derivada e os Cartões vinculados
   * (FR-014). Baralho inexistente é recusado como `nao_encontrado`.
   */
  obterBaralho(id: string): Promise<ResultadoDeObterBaralho>;

  /**
   * Vincula um Cartão existente a um Baralho existente (FR-019). O par
   * repetido é recusado como `vinculo_duplicado`; Cartão ou Baralho
   * inexistente, como `nao_encontrado`.
   */
  vincular(cartaoId: string, baralhoId: string): Promise<ResultadoDeVinculacao>;

  /**
   * Desfaz o Vínculo, preservando Cartão e Baralho (FR-021). Vínculo
   * inexistente é recusado como `vinculo_nao_encontrado`.
   */
  desvincular(
    cartaoId: string,
    baralhoId: string,
  ): Promise<ResultadoDeDesvinculacao>;

  /**
   * Edita a Frente e o Verso de um Cartão existente (FR-005), reaplicando as
   * mesmas regras de conteúdo da criação. A alteração vale em todos os
   * Baralhos a que o Cartão está vinculado, sem alterar Vínculos.
   */
  editarCartao(
    id: string,
    frente: string,
    verso: string,
  ): Promise<ResultadoDeEdicaoDeCartao>;

  /**
   * Renomeia um Baralho existente (FR-015), reaplicando as mesmas regras de
   * nome da criação. Vínculos e elegibilidade são preservados.
   */
  renomearBaralho(
    id: string,
    nome: string,
  ): Promise<ResultadoDeRenomeacaoDeBaralho>;

  /**
   * Exclui um Cartão existente (FR-007), removendo também os seus Vínculos e
   * preservando todos os Baralhos (FR-008).
   */
  excluirCartao(id: string): Promise<ResultadoDeExclusaoDeCartao>;

  /**
   * Exclui um Baralho existente (FR-016), removendo também os seus Vínculos e
   * preservando todos os Cartões (FR-017).
   */
  excluirBaralho(id: string): Promise<ResultadoDeExclusaoDeBaralho>;

  /**
   * Cadastra um Usuário com Nome de usuário e Senha (FR-071). Espaços ao redor
   * do Nome de usuário são descartados antes da validação, e os da Senha são
   * preservados (FR-073, FR-075). Um Nome de usuário já cadastrado é recusado
   * como `nome_de_usuario_existente`, sem distinguir maiúsculas de minúsculas
   * (FR-074). O sucesso traz apenas `id` e `nomeDeUsuario`: a Senha nunca
   * aparece em nenhum retorno (FR-076, FR-078).
   */
  criarUsuario(dados: DadosDeUsuario): Promise<ResultadoDeCriacaoDeUsuario>;

  /**
   * Registra uma Sessão concluída no histórico (FR-161, FR-163). O `id` vem do
   * cliente: reenviar o mesmo `id` devolve o Registro já existente, sem
   * duplicar — é o que torna a operação idempotente e segura a uma nova
   * tentativa depois de uma falha de transporte.
   *
   * O corpo fora das invariantes é recusado como `dados_invalidos`; um `id`
   * já usado por outro Usuário, como `conflito` — nunca se sobrescreve o
   * Registro alheio.
   */
  registrarSessao(
    dados: DadosDeRegistro,
  ): Promise<ResultadoDeRegistroDeSessao>;

  /**
   * Devolve os números do Início (FR-164, FR-165): o tamanho atual do acervo,
   * os Registros com `concluidaEm >= desde` e os 5 mais recentes. `desde` é um
   * instante ISO-8601.
   */
  obterEstatisticas(desde: string): Promise<ResultadoDeEstatisticas>;

  /**
   * Abre um Registro do histórico com os itens na ordem apresentada e informa
   * se o Baralho da Sessão ainda existe (FR-166). Registro inexistente ou de
   * outro Usuário é `nao_encontrado`.
   */
  obterRegistroDeSessao(id: string): Promise<ResultadoDeObterRegistro>;

  /**
   * A prévia dos Cartões informados, para o estudo livre exibir o que cada
   * Avaliação fará (FR-221). Até 200 `cartaoIds` por chamada.
   */
  obterPrevias(cartaoIds: string[]): Promise<ResultadoDasPrevias>;

  /**
   * As Preferências do Usuário mais a lista de algoritmos disponíveis
   * (FR-200, FR-212).
   */
  obterPreferencias(): Promise<ResultadoDePreferencias>;

  /**
   * Salva as Preferências (FR-212). Algoritmo diferente do atual
   * dispara a reconstrução dos Agendamentos no servidor (FR-213); a resposta
   * traz as Preferências já salvas.
   */
  salvarPreferencias(preferencias: {
    algoritmo: string;
  }): Promise<ResultadoDeSalvarPreferencias>;

  /**
   * A semana da Agenda (FR-248, FR-250): os Compromissos entre `inicio` e os
   * sete dias seguintes, e os de hoje, no fuso informado.
   */
  obterAgenda(inicio: string, fuso: string): Promise<ResultadoDeObterAgenda>;

  /**
   * Lista as Rotinas de estudo ativas e pausadas (FR-248, FR-250), na ordem
   * de criação.
   */
  listarRotinas(): Promise<ResultadoDeListarRotinas>;

  /**
   * Salva uma Rotina de estudo (FR-248, FR-250): criar, editar, pausar,
   * retomar ou excluir, de forma idempotente pelo `operacaoId`.
   */
  salvarRotina(dados: DadosDeRotina): Promise<ResultadoDeSalvarRotina>;

  /**
   * Inicia uma Sessão autorizada a partir de um Compromisso elegível
   * (FR-248, FR-250). Só hoje e pendente; cada início tem seu próprio id.
   */
  iniciarCompromisso(
    dados: DadosDeInicioDeCompromisso,
  ): Promise<ResultadoDeIniciarCompromisso>;

  /**
   * Devolve o Nome de usuário atual e as contagens do Usuário (FR-257,
   * FR-258): o que a seção «Minha conta» exibe e o que o diálogo de exclusão
   * anuncia (FR-272).
   */
  obterConta(): Promise<ResultadoDeObterConta>;

  /**
   * Troca a Senha (FR-266..FR-271). Exige a Senha atual; a nova segue o
   * Cadastro, difere da atual (`mesma_senha`) e confere com a Confirmação.
   */
  trocarSenha(dados: DadosDeTrocaDeSenha): Promise<ResultadoDeAcaoDeConta>;

  /**
   * Exclui o Usuário e tudo o que lhe pertence (FR-272..FR-278). Exige a
   * Senha atual.
   */
  excluirConta(dados: DadosDeExclusaoDeConta): Promise<ResultadoDeAcaoDeConta>;

  /**
   * Pergunta ao servidor se este navegador tem Acesso temporário válido
   * (018, FR-290): é o que a carga da aplicação usa para voltar ao Início sem
   * Entrar. Valendo, o servidor também renova a validade.
   */
  obterAcesso(): Promise<ResultadoDeObterAcesso>;

  /**
   * Renova o Acesso por uma interação sem requisição (018, FR-291) — chamada
   * pela casca, no máximo uma vez a cada 60 s, conforme `atividade.ts`.
   */
  renovarAcesso(): Promise<ResultadoDeRenovarAcesso>;

  /**
   * Sair: encerra o Acesso deste navegador e limpa o cookie (018, FR-293,
   * FR-295). Outros navegadores do mesmo Usuário não são afetados (FR-299).
   */
  sair(): Promise<ResultadoDeSair>;
}
