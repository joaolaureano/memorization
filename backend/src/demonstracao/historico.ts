// Module demonstracao — historico (030, research R2/R3/R7/R8).

import { somarDias, hojeNoFuso } from "../agenda/datas.ts";
import type {
  Agendamento,
  Cartao,
  ItemRegistrado,
  RegistroDeSessao,
} from "../armazenamento/porta.ts";
import {
  ALGORITMO_PADRAO,
  algoritmoPorId,
  rotuloDaAvaliacao,
  type Avaliacao,
} from "../repeticao/algoritmo.ts";
import { aplicarAvaliacoes } from "../repeticao/revisao.ts";

/** Uma Sessão de exemplo: o dia relativo à criação, a hora local e os Cartões avaliados. */
export interface SessaoDeExemplo {
  /** Dias em relação ao dia civil da criação, no fuso do visitante (−6 a −1). */
  deslocamentoEmDias: number;
  /** Hora local da conclusão, `HH:MM`. */
  horaLocal: string;
  itens: readonly { ref: string; avaliacao: Avaliacao }[];
}

/**
 * O histórico de exemplo (FR-504, R7): cinco Sessões nos dias −6, −5, −3, −2 e
 * −1, com seis a dez Cartões dos três Baralhos e Avaliações misturadas. Os
 * `ref` são os nomes locais de `ACERVO_DE_DEMONSTRACAO`.
 */
export const HISTORICO_DE_EXEMPLO: readonly SessaoDeExemplo[] = [
  {
    deslocamentoEmDias: -6,
    horaLocal: "19:00",
    itens: [
      { ref: "apple", avaliacao: "errei" },
      { ref: "book", avaliacao: "bom" },
      { ref: "house", avaliacao: "facil" },
      { ref: "brasil", avaliacao: "dificil" },
      { ref: "japao", avaliacao: "bom" },
      { ref: "sabia-laranjeira", avaliacao: "errei" },
      { ref: "bem-te-vi", avaliacao: "facil" },
      { ref: "friend", avaliacao: "bom" },
    ],
  },
  {
    deslocamentoEmDias: -5,
    horaLocal: "19:00",
    itens: [
      { ref: "apple", avaliacao: "dificil" },
      { ref: "water", avaliacao: "bom" },
      { ref: "kitchen", avaliacao: "facil" },
      { ref: "window", avaliacao: "errei" },
      { ref: "italia", avaliacao: "bom" },
      { ref: "argentina", avaliacao: "facil" },
      { ref: "joao-de-barro", avaliacao: "bom" },
      { ref: "to-learn", avaliacao: "dificil" },
      { ref: "tomorrow", avaliacao: "bom" },
    ],
  },
  {
    deslocamentoEmDias: -3,
    horaLocal: "19:00",
    itens: [
      { ref: "apple", avaliacao: "bom" },
      { ref: "book", avaliacao: "facil" },
      { ref: "to-remember", avaliacao: "bom" },
      { ref: "beautiful", avaliacao: "dificil" },
      { ref: "canada", avaliacao: "bom" },
      { ref: "tico-tico", avaliacao: "errei" },
      { ref: "corruira", avaliacao: "facil" },
      { ref: "house", avaliacao: "bom" },
    ],
  },
  {
    deslocamentoEmDias: -2,
    horaLocal: "19:00",
    itens: [
      { ref: "friend", avaliacao: "facil" },
      { ref: "to-forget", avaliacao: "errei" },
      { ref: "water", avaliacao: "bom" },
      { ref: "alemanha", avaliacao: "dificil" },
      { ref: "india", avaliacao: "bom" },
      { ref: "seriema", avaliacao: "bom" },
      { ref: "pomba-asa-branca", avaliacao: "facil" },
      { ref: "to-learn", avaliacao: "bom" },
      { ref: "kitchen", avaliacao: "dificil" },
      { ref: "quenia", avaliacao: "bom" },
    ],
  },
  {
    deslocamentoEmDias: -1,
    horaLocal: "19:00",
    itens: [
      { ref: "apple", avaliacao: "facil" },
      { ref: "book", avaliacao: "bom" },
      { ref: "window", avaliacao: "dificil" },
      { ref: "mexico", avaliacao: "bom" },
      { ref: "suecia", avaliacao: "facil" },
      { ref: "cambacica", avaliacao: "errei" },
      { ref: "tiziu", avaliacao: "bom" },
      { ref: "anu-branco", avaliacao: "dificil" },
      { ref: "to-remember", avaliacao: "bom" },
    ],
  },
];

/** Deslocamento do fuso em milissegundos naquele instante (positivo a leste de UTC). */
function deslocamentoDoFuso(fuso: string, instante: Date): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instante);
  const valor = (tipo: string) =>
    Number(partes.find((parte) => parte.type === tipo)?.value);
  const relogioDoFuso = Date.UTC(
    valor("year"),
    valor("month") - 1,
    valor("day"),
    valor("hour"),
    valor("minute"),
    valor("second"),
  );
  return relogioDoFuso - Math.floor(instante.getTime() / 1000) * 1000;
}

/** O instante em que o relógio do `fuso` marca `data` (YYYY-MM-DD) às `hora` (HH:MM). */
function instanteNoFuso(data: string, hora: string, fuso: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  const [horas, minutos] = hora.split(":").map(Number);
  const relogio = Date.UTC(ano!, mes! - 1, dia!, horas!, minutos!);
  const primeiro = relogio - deslocamentoDoFuso(fuso, new Date(relogio));
  return new Date(relogio - deslocamentoDoFuso(fuso, new Date(primeiro)));
}

export interface EntradaDoHistorico {
  /** Cartão de cada `ref` do histórico, já com id. */
  cartoesPorRef: ReadonlyMap<string, Cartao>;
  agora: Date;
  fuso: string;
  gerarId: () => string;
}

export interface HistoricoMontado {
  registros: RegistroDeSessao[];
  agendamentos: Agendamento[];
}

/**
 * Monta os Registros de Sessão do histórico de exemplo e reproduz as
 * Avaliações em ordem cronológica por `aplicarAvaliacoes`, com o algoritmo
 * padrão (FR-504, R7). Cada Sessão é aplicada com o instante da sua conclusão,
 * e o resultado final de cada Cartão é o Agendamento que sai do último lote.
 */
export function montarHistorico({
  cartoesPorRef,
  agora,
  fuso,
  gerarId,
}: EntradaDoHistorico): HistoricoMontado {
  const alg = algoritmoPorId(ALGORITMO_PADRAO);
  const hoje = hojeNoFuso(fuso, agora);
  const registros: RegistroDeSessao[] = [];
  const agendamentos = new Map<string, Agendamento>();

  const cronologico = [...HISTORICO_DE_EXEMPLO].sort(
    (a, b) => a.deslocamentoEmDias - b.deslocamentoEmDias,
  );

  for (const sessao of cronologico) {
    const concluidaEm = instanteNoFuso(
      somarDias(hoje, sessao.deslocamentoEmDias),
      sessao.horaLocal,
      fuso,
    ).toISOString();

    const itens: ItemRegistrado[] = sessao.itens.map((entrada, posicao) => {
      const cartao = cartoesPorRef.get(entrada.ref);
      if (cartao === undefined) {
        throw new Error(`Cartão de exemplo ausente: ${entrada.ref}`);
      }
      const opcao = alg.opcoesDeAvaliacao.find((o) => o.chave === entrada.avaliacao);
      return {
        posicao,
        ...(cartao.tipo !== undefined && cartao.tipo !== "frente-verso"
          ? { tipo: cartao.tipo }
          : {}),
        frente: cartao.frente,
        verso: cartao.verso,
        resultado: opcao?.resultado ?? "errou",
        cartaoId: cartao.id,
        avaliacao: entrada.avaliacao,
        avaliacaoRotulo: rotuloDaAvaliacao(entrada.avaliacao),
      };
    });

    const estudados = itens.length;
    const acertos = itens.filter((item) => item.resultado === "acertou").length;
    registros.push({
      id: gerarId(),
      baralhoId: "",
      nomeDoBaralho: "Revisão do dia",
      origem: "revisao",
      concluidaEm,
      estudados,
      acertos,
      erros: estudados - acertos,
      itens,
    });

    const lote = aplicarAvaliacoes(
      [...agendamentos.values()],
      sessao.itens.map((entrada) => ({
        cartaoId: cartoesPorRef.get(entrada.ref)!.id,
        avaliacao: entrada.avaliacao,
      })),
      alg,
      new Date(concluidaEm),
    );
    for (const agendamento of lote) {
      agendamentos.set(agendamento.cartaoId, agendamento);
    }
  }

  return { registros, agendamentos: [...agendamentos.values()] };
}
