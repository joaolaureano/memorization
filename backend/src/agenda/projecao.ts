import type {
  RotinaArmazenada,
  VersaoDaRotina,
} from "../armazenamento/porta.ts";
import { diaDaSemana } from "./datas.ts";

/**
 * A projeção temporal da Rotina (FR-225, FR-238, FR-246): funções puras que
 * respondem, para uma data civil, qual configuração da Rotina vale e se ela
 * programa uma ocorrência. Nada aqui lê relógio nem armazenamento.
 *
 * As ocorrências **não** são materializadas: a Agenda as deduz das versões da
 * Rotina, de modo que alterar a Rotina nunca reescreve o passado (FR-238) e a
 * leitura da semana custa só a semana pedida (SC-102).
 */

/** Nomes dos dias da semana, na numeração da Rotina (1 = segunda). */
export const NOMES_DOS_DIAS = [
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
  "domingo",
] as const;

/** Lista legível de dias: "segunda e quinta", "segunda, quarta e sexta". */
export function descreverDias(dias: readonly number[]): string {
  const nomes = [...dias]
    .sort((a, b) => a - b)
    .map((dia) => NOMES_DOS_DIAS[dia - 1]);

  if (nomes.length <= 1) {
    return nomes.join("");
  }

  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/**
 * A versão da configuração vigente em `data` (FR-238): a última, na ordem de
 * alteração, cujo início é anterior ou igual à data. `undefined` antes da
 * criação da Rotina — nenhuma obrigação retroativa (FR-225).
 */
export function versaoVigenteEm(
  rotina: RotinaArmazenada,
  data: string,
): VersaoDaRotina | undefined {
  for (let indice = rotina.versoes.length - 1; indice >= 0; indice -= 1) {
    const versao = rotina.versoes[indice];

    if (versao.iniciaEm <= data) {
      return versao;
    }
  }

  return undefined;
}

/**
 * A versão que **programa** uma ocorrência em `data`, ou `null`: a Rotina
 * precisa estar ativa nessa data e incluir o dia da semana dela (FR-225,
 * FR-239). Pausa e exclusão têm efeito de data: a versão pausada ou excluída
 * não programa nada a partir do seu início.
 */
export function versaoQueProgramaEm(
  rotina: RotinaArmazenada,
  data: string,
): VersaoDaRotina | null {
  const versao = versaoVigenteEm(rotina, data);

  if (
    versao === undefined ||
    versao.estado !== "ativa" ||
    !versao.dias.includes(diaDaSemana(data))
  ) {
    return null;
  }

  return versao;
}

/** A configuração atual da Rotina: a última versão gravada. */
export function versaoAtual(rotina: RotinaArmazenada): VersaoDaRotina {
  return rotina.versoes[rotina.versoes.length - 1];
}

/**
 * Acrescenta uma versão a partir de `hoje` (FR-238). Alterações repetidas no
 * mesmo dia **substituem** a versão do dia em vez de empilhar outra, e um `hoje`
 * anterior ao início da última versão (troca de fuso) não retrocede a história.
 *
 * Devolve as versões novas e a data efetiva da alteração.
 */
export function acrescentarVersao(
  versoes: readonly VersaoDaRotina[],
  nova: Omit<VersaoDaRotina, "ordem" | "iniciaEm">,
  hoje: string,
): { versoes: VersaoDaRotina[]; quando: string } {
  const ultima = versoes[versoes.length - 1];
  const quando = hoje < ultima.iniciaEm ? ultima.iniciaEm : hoje;

  if (ultima.iniciaEm === quando) {
    return {
      versoes: [
        ...versoes.slice(0, -1),
        { ...nova, ordem: ultima.ordem, iniciaEm: quando },
      ],
      quando,
    };
  }

  return {
    versoes: [
      ...versoes,
      { ...nova, ordem: ultima.ordem + 1, iniciaEm: quando },
    ],
    quando,
  };
}
