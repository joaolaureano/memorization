import { criarAcervo } from "../../src/acervo/acervo.ts";
import type { Acervo } from "../../src/acervo/acervo.ts";
import type { ArmazenamentoDoAcervo } from "../../src/armazenamento/porta.ts";
import { abrirArmazenamentoSqlite } from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/** O fuso dos cenários: o do navegador do Usuário de teste (FR-246). */
export const FUSO = "America/Sao_Paulo";

/** Uma segunda-feira ao meio-dia em São Paulo: 2026-10-05. */
export const SEGUNDA = "2026-10-05T15:00:00Z";

/** Mundo de teste: armazenamento real em memória, relógio controlável. */
export interface MundoDeAgenda {
  armazenamento: ArmazenamentoDoAcervo;
  /** Acervo do primeiro Usuário. */
  acervo: Acervo;
  dono: string;
  /** Cria outro Usuário e devolve o seu Acervo. */
  outroUsuario(id?: string, nome?: string): Promise<{ id: string; acervo: Acervo }>;
  /** Avança (ou recua) o relógio injetado nas Agendas. */
  definirAgora(instante: string): void;
  /** Cria Baralho com `quantidade` Cartões vinculados. */
  baralhoComCartoes(
    nome: string,
    quantidade: number,
    acervo?: Acervo,
  ): Promise<{ id: string; cartaoIds: string[] }>;
  encerrar(): Promise<void>;
}

let proximo = 0;

/** Contador de operações: cada chamada gera um `operacaoId` novo. */
export function operacao(): string {
  proximo += 1;
  return `operacao-${proximo}`;
}

export async function prepararMundo(
  instante = SEGUNDA,
  opcoesDoAcervo: Parameters<typeof criarAcervo>[2] = {},
): Promise<MundoDeAgenda> {
  const aberto = await abrirArmazenamentoSqlite(":memory:");
  let agora = new Date(instante);
  const relogio = () => agora;
  const dono = await criarDonoDeTeste(aberto.usuarios, "dono-um", "ana.silva");
  const acervoDe = (id: string): Acervo =>
    criarAcervo(aberto.armazenamento, id, { ...opcoesDoAcervo, agora: relogio });

  const mundo: MundoDeAgenda = {
    armazenamento: aberto.armazenamento,
    acervo: acervoDe(dono),
    dono,
    async outroUsuario(id = "dono-dois", nome = "bruno.lima") {
      await criarDonoDeTeste(aberto.usuarios, id, nome);
      return { id, acervo: acervoDe(id) };
    },
    definirAgora(novo) {
      agora = new Date(novo);
    },
    async baralhoComCartoes(nome, quantidade, acervo = mundo.acervo) {
      const baralho = await acervo.criarBaralho({ nome });

      if (!baralho.ok) {
        throw new Error("não criou o Baralho de teste");
      }

      const cartaoIds: string[] = [];

      for (let indice = 1; indice <= quantidade; indice += 1) {
        const cartao = await acervo.criarCartao({
          frente: `${nome} ${indice}`,
          verso: `Resposta ${indice}`,
        });

        if (!cartao.ok) {
          throw new Error("não criou o Cartão de teste");
        }

        await acervo.vincular(cartao.cartao.id, baralho.baralho.id);
        cartaoIds.push(cartao.cartao.id);
      }

      return { id: baralho.baralho.id, cartaoIds };
    },
    encerrar: () => aberto.encerrar(),
  };

  return mundo;
}

/** Cria uma Rotina e falha o teste se a Agenda recusar. */
export async function criarRotina(
  acervo: Acervo,
  dados: {
    baralhoId: string;
    dias: number[];
    quantidade?: number | null;
    confirmarSobreposicao?: boolean;
  },
) {
  const resultado = await acervo.salvarRotina({
    operacaoId: operacao(),
    acao: "criar",
    baralhoId: dados.baralhoId,
    dias: dados.dias,
    quantidade: dados.quantidade ?? null,
    confirmarSobreposicao: dados.confirmarSobreposicao,
    fuso: FUSO,
  });

  if (!resultado.ok) {
    throw new Error(`Rotina de teste recusada: ${resultado.mensagem}`);
  }

  return resultado.rotina;
}

/** Uma semana inteira (segunda a domingo) a partir de `inicio`. */
export async function semana(acervo: Acervo, inicio: string) {
  const resultado = await acervo.obterAgenda(inicio, FUSO);

  if (!resultado.ok) {
    throw new Error(`Agenda recusada: ${resultado.mensagem}`);
  }

  return resultado.agenda;
}
