import { randomInt, randomUUID } from "node:crypto";

import type {
  ArmazenamentoDoAcervo,
  CompromissoPersistido,
  InicioAutorizado,
  RotinaArmazenada,
  VersaoDaRotina,
} from "../armazenamento/porta.ts";
import {
  diasDaSemana,
  ehDataCivilValida,
  ehFusoValido,
  ehSegundaFeira,
  hojeNoFuso,
} from "./datas.ts";
import {
  acrescentarVersao,
  descreverDias,
  versaoAtual,
  versaoQueProgramaEm,
} from "./projecao.ts";
import type {
  AcaoDeRotina,
  CompromissoDeEstudo,
  DadosDeInicio,
  DadosDeRotina,
  FalhaDeAgenda,
  InicioDeCompromisso,
  ResultadoDeIniciarCompromisso,
  ResultadoDeListarRotinas,
  ResultadoDeObterAgenda,
  ResultadoDeSalvarRotina,
  RotinaDeEstudo,
} from "./tipos.ts";

/**
 * O Module `Agenda` (FR-248, FR-250) e os tipos públicos que ele devolve,
 * reexportados de `tipos.ts` para que quem consome `Acervo` não precise
 * importar o Module diretamente.
 */
export type {
  AcaoDeRotina,
  CodigoDeErroDeAgenda,
  CompromissoDeEstudo,
  DadosDeInicio,
  DadosDeRotina,
  EstadoDaRotinaPublico,
  EstadoDoCompromisso,
  FalhaDeAgenda,
  InicioDeCompromisso,
  ResultadoDeIniciarCompromisso,
  ResultadoDeListarRotinas,
  ResultadoDeObterAgenda,
  ResultadoDeSalvarRotina,
  RotinaDeEstudo,
  SemanaDaAgenda,
} from "./tipos.ts";

/**
 * Interface profunda do Module `Agenda` (FR-248, FR-250): as operações que a
 * rota expõe. A projeção temporal, a concorrência e a comprovação de início
 * ficam escondidas aqui.
 *
 * **Todas as operações devolvem `Promise`**, porque dependem da Porta de
 * armazenamento e a Interface de domínio não mistura caminhos síncronos e
 * assíncronos. O dono entra pela construção do Module, não por cada operação.
 */
export interface Agenda {
  obterAgenda(inicio: string, fuso: string): Promise<ResultadoDeObterAgenda>;

  listarRotinas(): Promise<ResultadoDeListarRotinas>;

  salvarRotina(dados: DadosDeRotina): Promise<ResultadoDeSalvarRotina>;

  iniciarCompromisso(
    dados: DadosDeInicio,
  ): Promise<ResultadoDeIniciarCompromisso>;
}

const MENSAGEM_DE_DATA_INVALIDA = "A data informada não é uma data válida.";
const MENSAGEM_DE_INICIO_NAO_SEGUNDA =
  "A data de início precisa ser uma segunda-feira.";
const MENSAGEM_DE_FUSO_INVALIDO =
  "O fuso horário informado não é um fuso IANA válido.";
const MENSAGEM_DE_OPERACAO_VAZIA =
  "O identificador da operação não pode ser vazio.";
const MENSAGEM_DE_ARMAZENAMENTO_INDISPONIVEL =
  "O armazenamento não está disponível. Tente novamente.";

const ARMAZENAMENTO_INDISPONIVEL: FalhaDeAgenda = {
  ok: false,
  erro: "indisponivel",
  mensagem: MENSAGEM_DE_ARMAZENAMENTO_INDISPONIVEL,
};

/** Maior quantidade definida de Cartões por ocorrência (FR-224). */
const QUANTIDADE_MAXIMA = 999;

const ACOES: readonly AcaoDeRotina[] = [
  "criar",
  "editar",
  "pausar",
  "retomar",
  "excluir",
];

/** Recusa por entrada inválida, com a mensagem em português (FR-250). */
function recusar(
  erro: FalhaDeAgenda["erro"],
  mensagem: string,
): FalhaDeAgenda {
  return { ok: false, erro, mensagem };
}

/** Configuração completa de uma Rotina, já validada (FR-224). */
interface ConfiguracaoDeRotina {
  baralhoId: string;
  dias: number[];
  quantidade: number | null;
}

/**
 * Interpreta e valida a configuração de `criar`/`editar` (FR-224, FR-254): o
 * Baralho identificado, ao menos um dia entre 1 e 7 sem repetição e a
 * quantidade `null` (Todos) ou inteira de 1 a 999.
 */
function interpretarConfiguracao(
  dados: DadosDeRotina,
): ConfiguracaoDeRotina | FalhaDeAgenda {
  const { baralhoId, dias, quantidade } = dados as {
    baralhoId?: unknown;
    dias?: unknown;
    quantidade?: unknown;
  };

  if (typeof baralhoId !== "string" || baralhoId.trim().length === 0) {
    return recusar("dados_invalidos", "Escolha um Baralho para a Rotina.");
  }

  if (
    !Array.isArray(dias) ||
    dias.length === 0 ||
    dias.some(
      (dia) => typeof dia !== "number" || !Number.isInteger(dia) || dia < 1 || dia > 7,
    ) ||
    new Set(dias).size !== dias.length
  ) {
    return recusar(
      "dados_invalidos",
      "Escolha ao menos um dia da semana, sem repetir dias.",
    );
  }

  if (
    quantidade !== null &&
    (typeof quantidade !== "number" ||
      !Number.isInteger(quantidade) ||
      quantidade < 1 ||
      quantidade > QUANTIDADE_MAXIMA)
  ) {
    return recusar(
      "dados_invalidos",
      "A quantidade precisa ser um número inteiro de 1 a 999, ou Todos os Cartões.",
    );
  }

  return {
    baralhoId,
    dias: [...(dias as number[])].sort((a, b) => a - b),
    quantidade: quantidade as number | null,
  };
}

function ehFalha<T extends object>(valor: T | FalhaDeAgenda): valor is FalhaDeAgenda {
  return "ok" in valor && (valor as FalhaDeAgenda).ok === false;
}

/** Sorteia `quantidade` Cartões distintos, sem viés (Fisher–Yates). */
function embaralhar<T>(itens: readonly T[]): T[] {
  const copia = [...itens];

  for (let indice = copia.length - 1; indice > 0; indice -= 1) {
    const sorteio = randomInt(indice + 1);
    [copia[indice], copia[sorteio]] = [copia[sorteio], copia[indice]];
  }

  return copia;
}

/** O que a Agenda sabe do acervo na hora de projetar ou validar. */
interface BaralhoDoContexto {
  nome: string;
  cartoes: number;
}

/**
 * Cria o `Agenda` do Usuário `usuarioId` sobre a Porta de armazenamento
 * informada (FR-248, FR-250).
 *
 * O `agora` é injetável para que a passagem do tempo seja testável: a produção
 * não informa nada, e o padrão é `() => new Date()`. O dia de hoje é sempre
 * derivado **no servidor**, no fuso informado pelo navegador (FR-246).
 */
export function criarAgenda(
  armazenamento: ArmazenamentoDoAcervo,
  usuarioId: string,
  opcoes: { agora?: () => Date } = {},
): Agenda {
  const agora = opcoes.agora ?? (() => new Date());

  /** Os Baralhos do Usuário por identificador, com a contagem de Cartões. */
  async function carregarBaralhos(): Promise<Map<string, BaralhoDoContexto>> {
    const [baralhos, contagens] = await Promise.all([
      armazenamento.listarBaralhos(usuarioId),
      armazenamento.contarCartoesPorBaralho(usuarioId),
    ]);
    const quantidades = new Map(
      contagens.map((contagem) => [
        contagem.baralhoId,
        contagem.quantidadeDeCartoes,
      ]),
    );

    return new Map(
      baralhos.map((baralho) => [
        baralho.id,
        { nome: baralho.nome, cartoes: quantidades.get(baralho.id) ?? 0 },
      ]),
    );
  }

  /** As Rotinas na ordem de criação, com desempate estável por `id` (FR-230). */
  async function carregarRotinas(): Promise<RotinaArmazenada[]> {
    const rotinas = await armazenamento.listarRotinas(usuarioId);

    return [...rotinas].sort((a, b) =>
      a.criadaEm === b.criadaEm
        ? a.id.localeCompare(b.id)
        : a.criadaEm.localeCompare(b.criadaEm),
    );
  }

  function rotinaPublica(
    rotina: RotinaArmazenada,
    baralhos: Map<string, BaralhoDoContexto>,
  ): RotinaDeEstudo {
    const atual = versaoAtual(rotina);
    const baralho = baralhos.get(atual.baralhoId);

    return {
      id: rotina.id,
      baralhoId: atual.baralhoId,
      nomeDoBaralho: baralho?.nome ?? atual.nomeDoBaralho,
      dias: [...atual.dias],
      quantidade: atual.quantidade,
      estado: rotina.estado,
      versao: rotina.versao,
      criadaEm: rotina.criadaEm,
      indisponivel: baralho === undefined || baralho.cartoes === 0,
    };
  }

  /**
   * O Compromisso de `rotina` em `data`, ou `null` quando a Rotina não programa
   * nada nessa data e não há exceção nem conclusão persistida (FR-229, FR-244,
   * FR-245).
   *
   * Conclusão e cancelamento persistidos prevalecem sobre a projeção; as
   * ocorrências comuns vêm da versão vigente. Pendente, programado e não
   * realizado dependem só da data em relação a `hoje`, que é sempre civil.
   */
  function compromissoDoDia(
    rotina: RotinaArmazenada,
    data: string,
    hoje: string,
    baralhos: Map<string, BaralhoDoContexto>,
    persistido: CompromissoPersistido | undefined,
  ): CompromissoDeEstudo | null {
    if (persistido !== undefined) {
      return {
        rotinaId: rotina.id,
        data,
        baralhoId: persistido.baralhoId,
        nomeDoBaralho: persistido.nomeDoBaralho,
        quantidade: persistido.quantidade,
        estado: persistido.estado === "concluido" ? "concluido" : "cancelado",
        indisponivel:
          persistido.estado === "concluido" &&
          !baralhos.has(persistido.baralhoId),
        registroId: persistido.registroId,
      };
    }

    const versao = versaoQueProgramaEm(rotina, data);

    if (versao === null) {
      return null;
    }

    const baralho = baralhos.get(versao.baralhoId);
    const naoPassado = data >= hoje;

    return {
      rotinaId: rotina.id,
      data,
      baralhoId: versao.baralhoId,
      // Pendentes e futuros refletem o nome atual; o passado guarda o da época
      // (FR-244).
      nomeDoBaralho:
        naoPassado && baralho !== undefined
          ? baralho.nome
          : versao.nomeDoBaralho,
      quantidade: versao.quantidade,
      estado:
        data < hoje ? "nao_realizado" : data === hoje ? "pendente" : "programado",
      indisponivel:
        baralho === undefined || (naoPassado && baralho.cartoes === 0),
      registroId: null,
    };
  }

  /** Compromissos persistidos por `rotinaId|data`. */
  function indexarPersistidos(
    persistidos: readonly CompromissoPersistido[],
  ): Map<string, CompromissoPersistido> {
    return new Map(
      persistidos.map((p) => [`${p.rotinaId}|${p.data}`, p] as const),
    );
  }

  function compromissosDasDatas(
    datas: readonly string[],
    rotinas: readonly RotinaArmazenada[],
    hoje: string,
    baralhos: Map<string, BaralhoDoContexto>,
    persistidos: Map<string, CompromissoPersistido>,
  ): CompromissoDeEstudo[] {
    const resultado: CompromissoDeEstudo[] = [];

    for (const data of datas) {
      for (const rotina of rotinas) {
        const compromisso = compromissoDoDia(
          rotina,
          data,
          hoje,
          baralhos,
          persistidos.get(`${rotina.id}|${data}`),
        );

        if (compromisso !== null) {
          resultado.push(compromisso);
        }
      }
    }

    return resultado;
  }

  /** Dias em comum entre duas listas de dias da semana. */
  function diasEmComum(a: readonly number[], b: readonly number[]): number[] {
    return a.filter((dia) => b.includes(dia));
  }

  /** Mensagem de sobreposição, ou `null` quando não há (FR-226). */
  function detectarSobreposicao(
    rotinas: readonly RotinaArmazenada[],
    idDaPropria: string | null,
    baralhoId: string,
    dias: readonly number[],
  ): FalhaDeAgenda | null {
    const comuns = new Set<number>();

    for (const outra of rotinas) {
      if (outra.estado !== "ativa" || outra.id === idDaPropria) {
        continue;
      }

      const atual = versaoAtual(outra);

      if (atual.baralhoId !== baralhoId) {
        continue;
      }

      for (const dia of diasEmComum(atual.dias, dias)) {
        comuns.add(dia);
      }
    }

    if (comuns.size === 0) {
      return null;
    }

    return recusar(
      "sobreposicao",
      `Já existe uma Rotina ativa deste Baralho em ${descreverDias([...comuns])}. Confirme para criar estudos independentes nesses dias.`,
    );
  }

  return {
    async obterAgenda(inicio, fuso) {
      if (typeof inicio !== "string" || !ehDataCivilValida(inicio)) {
        return recusar("dados_invalidos", MENSAGEM_DE_DATA_INVALIDA);
      }

      if (!ehSegundaFeira(inicio)) {
        return recusar("dados_invalidos", MENSAGEM_DE_INICIO_NAO_SEGUNDA);
      }

      if (typeof fuso !== "string" || !ehFusoValido(fuso)) {
        return recusar("dados_invalidos", MENSAGEM_DE_FUSO_INVALIDO);
      }

      const hoje = hojeNoFuso(fuso, agora());
      const dias = diasDaSemana(inicio);

      try {
        const hojeNaSemana = dias.includes(hoje);
        const [rotinas, baralhos, daSemana, deHoje] = await Promise.all([
          carregarRotinas(),
          carregarBaralhos(),
          armazenamento.listarCompromissos(usuarioId, dias[0], dias[6]),
          hojeNaSemana
            ? Promise.resolve([] as CompromissoPersistido[])
            : armazenamento.listarCompromissos(usuarioId, hoje, hoje),
        ]);

        const persistidos = indexarPersistidos([...daSemana, ...deHoje]);
        const compromissos = compromissosDasDatas(
          dias,
          rotinas,
          hoje,
          baralhos,
          persistidos,
        );

        return {
          ok: true,
          agenda: {
            inicio,
            hoje,
            fuso,
            compromissos,
            compromissosDeHoje: hojeNaSemana
              ? compromissos.filter((c) => c.data === hoje)
              : compromissosDasDatas([hoje], rotinas, hoje, baralhos, persistidos),
          },
        };
      } catch {
        return ARMAZENAMENTO_INDISPONIVEL;
      }
    },

    async listarRotinas() {
      try {
        const [rotinas, baralhos] = await Promise.all([
          carregarRotinas(),
          carregarBaralhos(),
        ]);

        return {
          ok: true,
          rotinas: rotinas
            .filter((rotina) => rotina.estado !== "excluida")
            .map((rotina) => rotinaPublica(rotina, baralhos)),
        };
      } catch {
        return ARMAZENAMENTO_INDISPONIVEL;
      }
    },

    async salvarRotina(dados) {
      if (typeof dados.fuso !== "string" || !ehFusoValido(dados.fuso)) {
        return recusar("dados_invalidos", MENSAGEM_DE_FUSO_INVALIDO);
      }

      if (
        typeof dados.operacaoId !== "string" ||
        dados.operacaoId.trim().length === 0
      ) {
        return recusar("dados_invalidos", MENSAGEM_DE_OPERACAO_VAZIA);
      }

      const acao = dados.acao;

      if (!ACOES.includes(acao)) {
        return recusar("dados_invalidos", "A ação da Rotina não é válida.");
      }

      const exigeConfiguracao = acao === "criar" || acao === "editar";
      const configuracao = exigeConfiguracao
        ? interpretarConfiguracao(dados)
        : null;

      if (configuracao !== null && ehFalha(configuracao)) {
        return configuracao;
      }

      if (acao !== "criar") {
        if (typeof dados.id !== "string" || dados.id.trim().length === 0) {
          return recusar("dados_invalidos", "Informe a Rotina da operação.");
        }

        if (
          typeof dados.versao !== "number" ||
          !Number.isInteger(dados.versao) ||
          dados.versao < 1
        ) {
          return recusar(
            "dados_invalidos",
            "Informe a versão da Rotina que você viu.",
          );
        }
      }

      /**
       * O texto canônico da intenção decide entre reenvio e reuso indevido do
       * `operacaoId` (FR-249). `confirmarSobreposicao` e `fuso` ficam de fora de
       * propósito: confirmar depois de uma recusa é a **mesma** intenção.
       */
      const intencao = JSON.stringify({
        acao,
        id: acao === "criar" ? null : dados.id,
        versao: acao === "criar" ? null : dados.versao,
        configuracao: configuracao as ConfiguracaoDeRotina | null,
      });

      try {
        // O reenvio é reconhecido antes de qualquer checagem que dependa do
        // estado atual: a nova tentativa recupera o resultado anterior
        // (FR-249, SC-097).
        const anterior = await armazenamento.obterOperacaoDeRotina(
          usuarioId,
          dados.operacaoId,
        );

        if (anterior.ok) {
          if (anterior.valor.intencao !== intencao) {
            return recusar(
              "conflito",
              "Este identificador de operação já foi usado por outra operação.",
            );
          }

          return {
            ok: true,
            rotina: rotinaPublica(anterior.valor.rotina, await carregarBaralhos()),
            criada: false,
          };
        }

        if (anterior.erro === "indisponivel") {
          return ARMAZENAMENTO_INDISPONIVEL;
        }

        const hoje = hojeNoFuso(dados.fuso, agora());
        const [rotinas, baralhos] = await Promise.all([
          carregarRotinas(),
          carregarBaralhos(),
        ]);

        let existente: RotinaArmazenada | null = null;

        if (acao !== "criar") {
          existente = rotinas.find((rotina) => rotina.id === dados.id) ?? null;

          if (existente === null || existente.estado === "excluida") {
            return recusar("nao_encontrado", "Rotina não encontrada.");
          }

          if (existente.versao !== dados.versao) {
            return recusar(
              "conflito",
              "A Rotina foi alterada em outro lugar. Revise os valores atuais antes de salvar.",
            );
          }
        }

        const atual = existente === null ? null : versaoAtual(existente);

        if (acao === "pausar" && existente?.estado !== "ativa") {
          return recusar("dados_invalidos", "A Rotina já está pausada.");
        }

        if (acao === "retomar" && existente?.estado !== "pausada") {
          return recusar("dados_invalidos", "A Rotina não está pausada.");
        }

        // Baralho próprio e elegível na criação e na troca (FR-223).
        if (
          configuracao !== null &&
          (atual === null || atual.baralhoId !== configuracao.baralhoId)
        ) {
          const baralho = baralhos.get(configuracao.baralhoId);

          if (baralho === undefined) {
            return recusar("nao_encontrado", "Baralho não encontrado.");
          }

          if (baralho.cartoes === 0) {
            return recusar(
              "dados_invalidos",
              "O Baralho escolhido não tem Cartões. Adicione Cartões a ele antes de agendar.",
            );
          }
        }

        // Estado e configuração resultantes.
        const novoEstado =
          acao === "excluir"
            ? "excluida"
            : acao === "pausar"
              ? "pausada"
              : acao === "retomar"
                ? "ativa"
                : (existente?.estado ?? "ativa");
        const nova: ConfiguracaoDeRotina =
          configuracao !== null
            ? configuracao
            : {
                baralhoId: (atual as VersaoDaRotina).baralhoId,
                dias: [...(atual as VersaoDaRotina).dias],
                quantidade: (atual as VersaoDaRotina).quantidade,
              };

        // Sobreposição de Rotinas ativas do mesmo Baralho (FR-226).
        if (
          novoEstado === "ativa" &&
          (acao === "criar" || acao === "editar" || acao === "retomar") &&
          dados.confirmarSobreposicao !== true
        ) {
          const sobreposicao = detectarSobreposicao(
            rotinas,
            existente?.id ?? null,
            nova.baralhoId,
            nova.dias,
          );

          if (sobreposicao !== null) {
            return sobreposicao;
          }
        }

        const nomeDoBaralho =
          baralhos.get(nova.baralhoId)?.nome ??
          atual?.nomeDoBaralho ??
          "";
        const versaoNova = {
          baralhoId: nova.baralhoId,
          nomeDoBaralho,
          dias: nova.dias,
          quantidade: nova.quantidade,
          estado: novoEstado,
        } as const;

        let gravada: RotinaArmazenada;
        let cancelamentos: CompromissoPersistido[] = [];
        let reativacoes: string[] = [];

        if (existente === null) {
          gravada = {
            id: randomUUID(),
            criadaEm: agora().toISOString(),
            versao: 1,
            estado: "ativa",
            baralhoId: nova.baralhoId,
            versoes: [{ ...versaoNova, ordem: 1, iniciaEm: hoje }],
          };
        } else {
          const { versoes, quando } = acrescentarVersao(
            existente.versoes,
            versaoNova,
            hoje,
          );

          gravada = {
            id: existente.id,
            criadaEm: existente.criadaEm,
            versao: existente.versao + 1,
            estado: novoEstado,
            baralhoId:
              acao === "editar" ? nova.baralhoId : existente.baralhoId,
            versoes,
          };

          // Efeito sobre o Compromisso de hoje (FR-238, FR-239): dias
          // removidos, pausa e exclusão o cancelam; retomar ou readicionar o
          // dia reutiliza o mesmo Compromisso da Rotina e data.
          const antes = versaoQueProgramaEm(existente, quando);
          const depois = versaoQueProgramaEm(gravada, quando);
          const persistido = await armazenamento.obterCompromisso(
            usuarioId,
            existente.id,
            quando,
          );

          if (persistido.ok === false && persistido.erro === "indisponivel") {
            return ARMAZENAMENTO_INDISPONIVEL;
          }

          if (antes !== null && depois === null && !persistido.ok) {
            cancelamentos = [
              {
                rotinaId: existente.id,
                data: quando,
                estado: "cancelado",
                registroId: null,
                baralhoId: antes.baralhoId,
                nomeDoBaralho: antes.nomeDoBaralho,
                quantidade: antes.quantidade,
              },
            ];
          }

          if (
            depois !== null &&
            persistido.ok &&
            persistido.valor.estado === "cancelado"
          ) {
            reativacoes = [quando];
          }
        }

        const resultado = await armazenamento.gravarRotina(usuarioId, {
          operacaoId: dados.operacaoId,
          intencao,
          versaoEsperada: existente === null ? null : existente.versao,
          rotina: gravada,
          cancelamentos,
          reativacoes,
        });

        if (!resultado.ok) {
          switch (resultado.erro) {
            case "nao_encontrado":
              return recusar("nao_encontrado", "Rotina não encontrada.");
            case "conflito_de_versao":
              return recusar(
                "conflito",
                "A Rotina foi alterada em outro lugar. Revise os valores atuais antes de salvar.",
              );
            case "conflito":
              return recusar(
                "conflito",
                "Este identificador de operação já foi usado por outra operação.",
              );
            default:
              return ARMAZENAMENTO_INDISPONIVEL;
          }
        }

        return {
          ok: true,
          rotina: rotinaPublica(resultado.valor.rotina, await carregarBaralhos()),
          criada: acao === "criar" && !resultado.valor.repetida,
        };
      } catch {
        return ARMAZENAMENTO_INDISPONIVEL;
      }
    },

    async iniciarCompromisso(dados) {
      if (typeof dados.data !== "string" || !ehDataCivilValida(dados.data)) {
        return recusar("dados_invalidos", MENSAGEM_DE_DATA_INVALIDA);
      }

      if (typeof dados.fuso !== "string" || !ehFusoValido(dados.fuso)) {
        return recusar("dados_invalidos", MENSAGEM_DE_FUSO_INVALIDO);
      }

      if (
        typeof dados.rotinaId !== "string" ||
        dados.rotinaId.trim().length === 0
      ) {
        return recusar("dados_invalidos", "Informe a Rotina do estudo.");
      }

      const hoje = hojeNoFuso(dados.fuso, agora());

      // Só o Compromisso de hoje pode ser iniciado: nada de recuperar o passado
      // nem antecipar o futuro pela Agenda (FR-231, FR-247).
      if (dados.data !== hoje) {
        return recusar(
          "dados_invalidos",
          "Só é possível iniciar o estudo programado para hoje.",
        );
      }

      try {
        const rotina = await armazenamento.obterRotina(
          usuarioId,
          dados.rotinaId,
        );

        if (!rotina.ok) {
          return rotina.erro === "nao_encontrado"
            ? recusar("nao_encontrado", "Rotina não encontrada.")
            : ARMAZENAMENTO_INDISPONIVEL;
        }

        const persistido = await armazenamento.obterCompromisso(
          usuarioId,
          dados.rotinaId,
          dados.data,
        );

        if (persistido.ok) {
          return persistido.valor.estado === "concluido"
            ? recusar("conflito", "Este estudo já foi concluído.")
            : recusar("nao_encontrado", "Este estudo foi cancelado.");
        }

        if (persistido.erro === "indisponivel") {
          return ARMAZENAMENTO_INDISPONIVEL;
        }

        const versao = versaoQueProgramaEm(rotina.valor, dados.data);

        if (versao === null) {
          return recusar(
            "nao_encontrado",
            "Não há estudo programado para esta Rotina hoje.",
          );
        }

        const baralho = await armazenamento.obterBaralho(
          usuarioId,
          versao.baralhoId,
        );

        if (!baralho.ok) {
          return baralho.erro === "nao_encontrado"
            ? recusar(
                "conflito",
                "O Baralho desta Rotina foi excluído. Ajuste a Rotina para voltar a estudar.",
              )
            : ARMAZENAMENTO_INDISPONIVEL;
        }

        const disponiveis = await armazenamento.listarCartoesDoBaralho(
          usuarioId,
          versao.baralhoId,
        );

        if (disponiveis.length === 0) {
          return recusar(
            "conflito",
            "O Baralho desta Rotina não tem Cartões. Adicione Cartões ou ajuste a Rotina.",
          );
        }

        // A quantidade efetiva é o menor entre o pedido e o disponível; Todos
        // usa tudo o que existe agora (FR-232).
        const total = Math.min(
          versao.quantidade ?? disponiveis.length,
          disponiveis.length,
        );
        const cartoes = embaralhar(disponiveis).slice(0, total);

        const autorizado: InicioAutorizado = {
          id: randomUUID(),
          rotinaId: dados.rotinaId,
          data: dados.data,
          iniciadoEm: agora().toISOString(),
          fuso: dados.fuso,
          baralhoId: versao.baralhoId,
          nomeDoBaralho: baralho.valor.nome,
          quantidade: versao.quantidade,
          cartoes,
        };
        const gravado = await armazenamento.gravarInicio(usuarioId, autorizado);

        if (!gravado.ok) {
          return gravado.erro === "nao_encontrado"
            ? recusar("nao_encontrado", "Rotina não encontrada.")
            : ARMAZENAMENTO_INDISPONIVEL;
        }

        const inicio: InicioDeCompromisso = {
          id: gravado.valor.id,
          rotinaId: gravado.valor.rotinaId,
          data: gravado.valor.data,
          baralhoId: gravado.valor.baralhoId,
          nomeDoBaralho: gravado.valor.nomeDoBaralho,
          cartoes: [...gravado.valor.cartoes],
          quantidadeSolicitada: gravado.valor.quantidade,
        };

        return { ok: true, inicio };
      } catch {
        return ARMAZENAMENTO_INDISPONIVEL;
      }
    },
  };
}
