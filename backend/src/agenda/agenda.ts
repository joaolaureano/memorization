import type { ArmazenamentoDoAcervo } from "../armazenamento/porta.ts";
import {
  ehDataCivilValida,
  ehFusoValido,
  ehSegundaFeira,
  hojeNoFuso,
} from "./datas.ts";
import type {
  DadosDeInicio,
  DadosDeRotina,
  FalhaDeAgenda,
  ResultadoDeIniciarCompromisso,
  ResultadoDeListarRotinas,
  ResultadoDeObterAgenda,
  ResultadoDeSalvarRotina,
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
 * rota expõe, com as datas e os fusos validados aqui e a regra completa
 * chegando na Onda B.
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

/** Mensagem de recusa quando a data não é uma data civil válida (FR-250). */
const MENSAGEM_DE_DATA_INVALIDA = "A data informada não é uma data válida.";

/** Mensagem de recusa quando `inicio` não cai numa segunda-feira (FR-248). */
const MENSAGEM_DE_INICIO_NAO_SEGUNDA =
  "A data de início precisa ser uma segunda-feira.";

/** Mensagem de recusa quando o fuso não é um nome IANA utilizável (FR-250). */
const MENSAGEM_DE_FUSO_INVALIDO =
  "O fuso horário informado não é um fuso IANA válido.";

/** Mensagem de recusa quando `operacaoId` chega vazio (FR-248). */
const MENSAGEM_DE_OPERACAO_VAZIA =
  "O identificador da operação não pode ser vazio.";

/**
 * Mensagem das operações cuja regra completa ainda não existe neste esqueleto:
 * a criação, a projeção e a conclusão dos Compromissos chegam na Onda B
 * (T1604+), e até lá toda operação validada responde `indisponivel` — nunca um
 * resultado falso.
 */
const MENSAGEM_DE_AGENDA_PENDENTE =
  "A Agenda ainda não está disponível nesta versão.";

/** Recusa da regra ainda pendente da Onda B (T1604+). */
const AGENDA_PENDENTE: FalhaDeAgenda = {
  ok: false,
  erro: "indisponivel",
  mensagem: MENSAGEM_DE_AGENDA_PENDENTE,
};

/** Recusa por entrada inválida, com a mensagem em português (FR-250). */
function recusarDadosInvalidos(mensagem: string): FalhaDeAgenda {
  return { ok: false, erro: "dados_invalidos", mensagem };
}

/**
 * Cria o `Agenda` do Usuário `usuarioId` sobre a Porta de armazenamento
 * informada (FR-248, FR-250).
 *
 * É o **esqueleto** da feature: a regra de negócio — criação, projeção e
 * conclusão dos Compromissos — é da Onda B. Aqui cada operação valida apenas as
 * entradas de data e fuso deste Module e, depois da validação, devolve
 * `indisponivel`, porque a projeção completa ainda não existe (T1604+).
 *
 * O `agora` é injetável para que a composição do relógio seja testável: a
 * produção não informa nada, e o padrão é `() => new Date()`. O
 * `armazenamento` e o `usuarioId` ficam guardados no closure para a Onda B.
 */
export function criarAgenda(
  armazenamento: ArmazenamentoDoAcervo,
  usuarioId: string,
  opcoes: { agora?: () => Date } = {},
): Agenda {
  const agora = opcoes.agora ?? (() => new Date());

  // `armazenamento` e `usuarioId` guardam a Porta e o dono para a Onda B; estas
  // referências só os mantêm no closure enquanto a regra completa não chega
  // (T1604+).
  void armazenamento;
  void usuarioId;

  return {
    async obterAgenda(inicio, fuso) {
      if (!ehDataCivilValida(inicio)) {
        return recusarDadosInvalidos(MENSAGEM_DE_DATA_INVALIDA);
      }

      if (!ehSegundaFeira(inicio)) {
        return recusarDadosInvalidos(MENSAGEM_DE_INICIO_NAO_SEGUNDA);
      }

      if (!ehFusoValido(fuso)) {
        return recusarDadosInvalidos(MENSAGEM_DE_FUSO_INVALIDO);
      }

      // O relógio injetável entra aqui: a projeção da semana que consome `hoje`
      // chega na Onda B (T1604+), e por ora o valor só prova a composição.
      const hoje = hojeNoFuso(fuso, agora());
      void hoje;

      return AGENDA_PENDENTE;
    },

    async listarRotinas() {
      return AGENDA_PENDENTE;
    },

    async salvarRotina(dados) {
      if (!ehFusoValido(dados.fuso)) {
        return recusarDadosInvalidos(MENSAGEM_DE_FUSO_INVALIDO);
      }

      if (dados.operacaoId.trim().length === 0) {
        return recusarDadosInvalidos(MENSAGEM_DE_OPERACAO_VAZIA);
      }

      return AGENDA_PENDENTE;
    },

    async iniciarCompromisso(dados) {
      if (!ehDataCivilValida(dados.data)) {
        return recusarDadosInvalidos(MENSAGEM_DE_DATA_INVALIDA);
      }

      if (!ehFusoValido(dados.fuso)) {
        return recusarDadosInvalidos(MENSAGEM_DE_FUSO_INVALIDO);
      }

      return AGENDA_PENDENTE;
    },
  };
}
