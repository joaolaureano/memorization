import { descreverDias, diaDaSemana, diasDaSemana, ehDataCivilValida, ehFusoValido, hojeNoFuso } from "../agenda/datas";
import type {
  Cartao,
  CodigoDeErroDeAgenda,
  CompromissoDeEstudo,
  DadosDeInicioDeCompromisso,
  DadosDeRotina,
  EstadoDaRotina,
  InicioDeCompromisso,
  RotinaDeEstudo,
  SemanaDaAgenda,
} from "./cliente";

/**
 * A regra da Agenda do stand-in em memória (016): o mesmo contrato observável
 * do servidor — projeção por versões, Compromissos persistidos só para
 * cancelamentos e conclusões, CAS por versão, idempotência por `operacaoId` —,
 * para a interface ser testável sem servidor. É uma reimplementação enxuta e
 * independente de `backend/src/agenda`: nenhum código do servidor entra no
 * navegador, e a paridade das regras é conferida pelos testes de contrato.
 */

/** Uma versão da configuração de uma Rotina, vigente a partir de `iniciaEm`. */
interface VersaoDaRotina {
  iniciaEm: string;
  baralhoId: string;
  nomeDoBaralho: string;
  dias: number[];
  quantidade: number | null;
  estado: EstadoDaRotina;
}

/** Rotina na base do stand-in, com o dono que escopa toda operação (FR-248). */
export interface RotinaDaBase {
  usuarioId: string;
  id: string;
  criadaEm: string;
  versao: number;
  estado: EstadoDaRotina;
  versoes: VersaoDaRotina[];
}

/** Compromisso persistido: só cancelamentos e conclusões (FR-250). */
export interface CompromissoDaBase {
  usuarioId: string;
  rotinaId: string;
  data: string;
  estado: "cancelado" | "concluido";
  registroId: string | null;
  baralhoId: string;
  nomeDoBaralho: string;
  quantidade: number | null;
}

/** Início autorizado com o snapshot dos Cartões (FR-254). */
export interface InicioDaBase {
  usuarioId: string;
  id: string;
  rotinaId: string;
  data: string;
  baralhoId: string;
  nomeDoBaralho: string;
  quantidade: number | null;
  cartoes: Cartao[];
}

/** O estado da Agenda do stand-in, compartilhado entre os clientes de prova. */
export interface AgendaBase {
  rotinas: RotinaDaBase[];
  compromissos: CompromissoDaBase[];
  inicios: InicioDaBase[];
  operacoes: Map<string, { intencao: string; rotina: RotinaDaBase }>;
  sequencia: number;
}

export function novaAgendaBase(): AgendaBase {
  return {
    rotinas: [],
    compromissos: [],
    inicios: [],
    operacoes: new Map(),
    sequencia: 0,
  };
}

/** O que a regra precisa do acervo do dono, no instante da chamada. */
export interface ContextoDaAgenda {
  usuarioId: string;
  agora: Date;
  /** Baralhos do dono por id, com os Cartões vinculados. */
  baralhos: Map<string, { nome: string; cartoes: Cartao[] }>;
}

type Falha = { ok: false; erro: CodigoDeErroDeAgenda; mensagem: string };

function falha(erro: CodigoDeErroDeAgenda, mensagem: string): Falha {
  return { ok: false, erro, mensagem };
}

const ATUAL = (rotina: RotinaDaBase): VersaoDaRotina =>
  rotina.versoes[rotina.versoes.length - 1];

function versaoVigente(
  rotina: RotinaDaBase,
  data: string,
): VersaoDaRotina | undefined {
  for (let indice = rotina.versoes.length - 1; indice >= 0; indice -= 1) {
    if (rotina.versoes[indice].iniciaEm <= data) {
      return rotina.versoes[indice];
    }
  }

  return undefined;
}

function versaoQueProgramaEm(
  rotina: RotinaDaBase,
  data: string,
): VersaoDaRotina | null {
  const versao = versaoVigente(rotina, data);

  return versao !== undefined &&
    versao.estado === "ativa" &&
    versao.dias.includes(diaDaSemana(data))
    ? versao
    : null;
}

function rotinaPublica(
  rotina: RotinaDaBase,
  contexto: ContextoDaAgenda,
): RotinaDeEstudo {
  const atual = ATUAL(rotina);
  const baralho = contexto.baralhos.get(atual.baralhoId);

  return {
    id: rotina.id,
    baralhoId: atual.baralhoId,
    nomeDoBaralho: baralho?.nome ?? atual.nomeDoBaralho,
    dias: [...atual.dias],
    quantidade: atual.quantidade,
    estado: rotina.estado,
    versao: rotina.versao,
    criadaEm: rotina.criadaEm,
    indisponivel: baralho === undefined || baralho.cartoes.length === 0,
  };
}

function rotinasDoDono(base: AgendaBase, usuarioId: string): RotinaDaBase[] {
  return base.rotinas
    .filter((rotina) => rotina.usuarioId === usuarioId)
    .sort((a, b) =>
      a.criadaEm === b.criadaEm
        ? a.id.localeCompare(b.id)
        : a.criadaEm.localeCompare(b.criadaEm),
    );
}

function compromissoDoDia(
  rotina: RotinaDaBase,
  data: string,
  hoje: string,
  contexto: ContextoDaAgenda,
  persistido: CompromissoDaBase | undefined,
): CompromissoDeEstudo | null {
  if (persistido !== undefined) {
    return {
      rotinaId: rotina.id,
      data,
      baralhoId: persistido.baralhoId,
      nomeDoBaralho: persistido.nomeDoBaralho,
      quantidade: persistido.quantidade,
      estado: persistido.estado,
      indisponivel:
        persistido.estado === "concluido" &&
        !contexto.baralhos.has(persistido.baralhoId),
      registroId: persistido.registroId,
    };
  }

  const versao = versaoQueProgramaEm(rotina, data);

  if (versao === null) {
    return null;
  }

  const baralho = contexto.baralhos.get(versao.baralhoId);
  const naoPassado = data >= hoje;

  return {
    rotinaId: rotina.id,
    data,
    baralhoId: versao.baralhoId,
    nomeDoBaralho:
      naoPassado && baralho !== undefined ? baralho.nome : versao.nomeDoBaralho,
    quantidade: versao.quantidade,
    estado:
      data < hoje ? "nao_realizado" : data === hoje ? "pendente" : "programado",
    indisponivel:
      baralho === undefined || (naoPassado && baralho.cartoes.length === 0),
    registroId: null,
  };
}

function compromissosDasDatas(
  base: AgendaBase,
  contexto: ContextoDaAgenda,
  datas: readonly string[],
  hoje: string,
): CompromissoDeEstudo[] {
  const resultado: CompromissoDeEstudo[] = [];

  for (const data of datas) {
    for (const rotina of rotinasDoDono(base, contexto.usuarioId)) {
      const compromisso = compromissoDoDia(
        rotina,
        data,
        hoje,
        contexto,
        base.compromissos.find(
          (item) =>
            item.usuarioId === contexto.usuarioId &&
            item.rotinaId === rotina.id &&
            item.data === data,
        ),
      );

      if (compromisso !== null) {
        resultado.push(compromisso);
      }
    }
  }

  return resultado;
}

export function obterAgendaEmMemoria(
  base: AgendaBase,
  contexto: ContextoDaAgenda,
  inicio: string,
  fuso: string,
): { ok: true; agenda: SemanaDaAgenda } | Falha {
  if (!ehDataCivilValida(inicio)) {
    return falha("dados_invalidos", "A data informada não é uma data válida.");
  }

  if (diaDaSemana(inicio) !== 1) {
    return falha(
      "dados_invalidos",
      "A data de início precisa ser uma segunda-feira.",
    );
  }

  if (!ehFusoValido(fuso)) {
    return falha(
      "dados_invalidos",
      "O fuso horário informado não é um fuso IANA válido.",
    );
  }

  const hoje = hojeNoFuso(fuso, contexto.agora);
  const dias = diasDaSemana(inicio);
  const compromissos = compromissosDasDatas(base, contexto, dias, hoje);

  return {
    ok: true,
    agenda: {
      inicio,
      hoje,
      fuso,
      compromissos,
      compromissosDeHoje: dias.includes(hoje)
        ? compromissos.filter((compromisso) => compromisso.data === hoje)
        : compromissosDasDatas(base, contexto, [hoje], hoje),
    },
  };
}

export function listarRotinasEmMemoria(
  base: AgendaBase,
  contexto: ContextoDaAgenda,
): { ok: true; rotinas: RotinaDeEstudo[] } {
  return {
    ok: true,
    rotinas: rotinasDoDono(base, contexto.usuarioId)
      .filter((rotina) => rotina.estado !== "excluida")
      .map((rotina) => rotinaPublica(rotina, contexto)),
  };
}

interface Configuracao {
  baralhoId: string;
  dias: number[];
  quantidade: number | null;
}

function interpretarConfiguracao(dados: DadosDeRotina): Configuracao | Falha {
  const { baralhoId, dias, quantidade } = dados;

  if (typeof baralhoId !== "string" || baralhoId.trim().length === 0) {
    return falha("dados_invalidos", "Escolha um Baralho para a Rotina.");
  }

  if (
    !Array.isArray(dias) ||
    dias.length === 0 ||
    dias.some((dia) => !Number.isInteger(dia) || dia < 1 || dia > 7) ||
    new Set(dias).size !== dias.length
  ) {
    return falha(
      "dados_invalidos",
      "Escolha ao menos um dia da semana, sem repetir dias.",
    );
  }

  if (
    quantidade === undefined ||
    (quantidade !== null &&
      (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 999))
  ) {
    return falha(
      "dados_invalidos",
      "A quantidade precisa ser um número inteiro de 1 a 999, ou Todos os Cartões.",
    );
  }

  return { baralhoId, dias: [...dias].sort((a, b) => a - b), quantidade };
}

function proximoId(base: AgendaBase, prefixo: string): string {
  base.sequencia += 1;

  return `${prefixo}${base.sequencia}`;
}

export function salvarRotinaEmMemoria(
  base: AgendaBase,
  contexto: ContextoDaAgenda,
  dados: DadosDeRotina,
): { ok: true; rotina: RotinaDeEstudo } | Falha {
  if (!ehFusoValido(dados.fuso)) {
    return falha(
      "dados_invalidos",
      "O fuso horário informado não é um fuso IANA válido.",
    );
  }

  if (dados.operacaoId.trim().length === 0) {
    return falha(
      "dados_invalidos",
      "O identificador da operação não pode ser vazio.",
    );
  }

  const acao = dados.acao;

  if (!["criar", "editar", "pausar", "retomar", "excluir"].includes(acao)) {
    return falha("dados_invalidos", "A ação da Rotina não é válida.");
  }

  const configuracao =
    acao === "criar" || acao === "editar"
      ? interpretarConfiguracao(dados)
      : null;

  if (configuracao !== null && "ok" in configuracao) {
    return configuracao;
  }

  if (acao !== "criar") {
    if (typeof dados.id !== "string" || dados.id.trim().length === 0) {
      return falha("dados_invalidos", "Informe a Rotina da operação.");
    }

    if (
      typeof dados.versao !== "number" ||
      !Number.isInteger(dados.versao) ||
      dados.versao < 1
    ) {
      return falha(
        "dados_invalidos",
        "Informe a versão da Rotina que você viu.",
      );
    }
  }

  const intencao = JSON.stringify({
    acao,
    id: acao === "criar" ? null : dados.id,
    versao: acao === "criar" ? null : dados.versao,
    configuracao,
  });
  const chave = `${contexto.usuarioId}|${dados.operacaoId}`;
  const anterior = base.operacoes.get(chave);

  if (anterior !== undefined) {
    return anterior.intencao === intencao
      ? { ok: true, rotina: rotinaPublica(anterior.rotina, contexto) }
      : falha(
          "conflito",
          "Este identificador de operação já foi usado por outra operação.",
        );
  }

  const hoje = hojeNoFuso(dados.fuso, contexto.agora);
  const rotinas = rotinasDoDono(base, contexto.usuarioId);
  let existente: RotinaDaBase | null = null;

  if (acao !== "criar") {
    existente = rotinas.find((rotina) => rotina.id === dados.id) ?? null;

    if (existente === null || existente.estado === "excluida") {
      return falha("nao_encontrado", "Rotina não encontrada.");
    }

    if (existente.versao !== dados.versao) {
      return falha(
        "conflito",
        "A Rotina foi alterada em outro lugar. Revise os valores atuais antes de salvar.",
      );
    }
  }

  const atual = existente === null ? null : ATUAL(existente);

  if (acao === "pausar" && existente?.estado !== "ativa") {
    return falha("dados_invalidos", "A Rotina já está pausada.");
  }

  if (acao === "retomar" && existente?.estado !== "pausada") {
    return falha("dados_invalidos", "A Rotina não está pausada.");
  }

  if (
    configuracao !== null &&
    (atual === null || atual.baralhoId !== configuracao.baralhoId)
  ) {
    const baralho = contexto.baralhos.get(configuracao.baralhoId);

    if (baralho === undefined) {
      return falha("nao_encontrado", "Baralho não encontrado.");
    }

    if (baralho.cartoes.length === 0) {
      return falha(
        "dados_invalidos",
        "O Baralho escolhido não tem Cartões. Adicione Cartões a ele antes de agendar.",
      );
    }
  }

  const novoEstado: EstadoDaRotina =
    acao === "excluir"
      ? "excluida"
      : acao === "pausar"
        ? "pausada"
        : acao === "retomar"
          ? "ativa"
          : (existente?.estado ?? "ativa");
  const nova: Configuracao =
    configuracao ?? {
      baralhoId: (atual as VersaoDaRotina).baralhoId,
      dias: [...(atual as VersaoDaRotina).dias],
      quantidade: (atual as VersaoDaRotina).quantidade,
    };

  if (
    novoEstado === "ativa" &&
    (acao === "criar" || acao === "editar" || acao === "retomar") &&
    dados.confirmarSobreposicao !== true
  ) {
    const comuns = new Set<number>();

    for (const outra of rotinas) {
      if (outra.estado !== "ativa" || outra.id === existente?.id) {
        continue;
      }

      const versao = ATUAL(outra);

      if (versao.baralhoId === nova.baralhoId) {
        for (const dia of versao.dias.filter((d) => nova.dias.includes(d))) {
          comuns.add(dia);
        }
      }
    }

    if (comuns.size > 0) {
      return falha(
        "sobreposicao",
        `Já existe uma Rotina ativa deste Baralho em ${descreverDias([...comuns])}. Confirme para criar estudos independentes nesses dias.`,
      );
    }
  }

  const nomeDoBaralho =
    contexto.baralhos.get(nova.baralhoId)?.nome ?? atual?.nomeDoBaralho ?? "";
  const versaoNova: Omit<VersaoDaRotina, "iniciaEm"> = {
    baralhoId: nova.baralhoId,
    nomeDoBaralho,
    dias: nova.dias,
    quantidade: nova.quantidade,
    estado: novoEstado,
  };
  let gravada: RotinaDaBase;

  if (existente === null) {
    gravada = {
      usuarioId: contexto.usuarioId,
      id: proximoId(base, "r"),
      criadaEm: contexto.agora.toISOString(),
      versao: 1,
      estado: "ativa",
      versoes: [{ ...versaoNova, iniciaEm: hoje }],
    };
    base.rotinas.push(gravada);
  } else {
    const ultima = ATUAL(existente);
    const quando = hoje < ultima.iniciaEm ? ultima.iniciaEm : hoje;
    const antes = versaoQueProgramaEm(existente, quando);
    const versoes =
      ultima.iniciaEm === quando
        ? [...existente.versoes.slice(0, -1), { ...versaoNova, iniciaEm: quando }]
        : [...existente.versoes, { ...versaoNova, iniciaEm: quando }];

    gravada = existente;
    gravada.versao += 1;
    gravada.estado = novoEstado;
    gravada.versoes = versoes;

    const depois = versaoQueProgramaEm(gravada, quando);
    const indice = base.compromissos.findIndex(
      (item) =>
        item.usuarioId === contexto.usuarioId &&
        item.rotinaId === gravada.id &&
        item.data === quando,
    );

    if (antes !== null && depois === null && indice < 0) {
      base.compromissos.push({
        usuarioId: contexto.usuarioId,
        rotinaId: gravada.id,
        data: quando,
        estado: "cancelado",
        registroId: null,
        baralhoId: antes.baralhoId,
        nomeDoBaralho: antes.nomeDoBaralho,
        quantidade: antes.quantidade,
      });
    }

    if (
      depois !== null &&
      indice >= 0 &&
      base.compromissos[indice].estado === "cancelado"
    ) {
      base.compromissos.splice(indice, 1);
    }
  }

  base.operacoes.set(chave, {
    intencao,
    rotina: JSON.parse(JSON.stringify(gravada)) as RotinaDaBase,
  });

  return { ok: true, rotina: rotinaPublica(gravada, contexto) };
}

export function iniciarCompromissoEmMemoria(
  base: AgendaBase,
  contexto: ContextoDaAgenda,
  dados: DadosDeInicioDeCompromisso,
): { ok: true; inicio: InicioDeCompromisso } | Falha {
  if (!ehDataCivilValida(dados.data)) {
    return falha("dados_invalidos", "A data informada não é uma data válida.");
  }

  if (!ehFusoValido(dados.fuso)) {
    return falha(
      "dados_invalidos",
      "O fuso horário informado não é um fuso IANA válido.",
    );
  }

  if (dados.data !== hojeNoFuso(dados.fuso, contexto.agora)) {
    return falha(
      "dados_invalidos",
      "Só é possível iniciar o estudo programado para hoje.",
    );
  }

  const rotina = base.rotinas.find(
    (item) => item.id === dados.rotinaId && item.usuarioId === contexto.usuarioId,
  );

  if (rotina === undefined) {
    return falha("nao_encontrado", "Rotina não encontrada.");
  }

  const persistido = base.compromissos.find(
    (item) =>
      item.usuarioId === contexto.usuarioId &&
      item.rotinaId === rotina.id &&
      item.data === dados.data,
  );

  if (persistido !== undefined) {
    return persistido.estado === "concluido"
      ? falha("conflito", "Este estudo já foi concluído.")
      : falha("nao_encontrado", "Este estudo foi cancelado.");
  }

  const versao = versaoQueProgramaEm(rotina, dados.data);

  if (versao === null) {
    return falha(
      "nao_encontrado",
      "Não há estudo programado para esta Rotina hoje.",
    );
  }

  const baralho = contexto.baralhos.get(versao.baralhoId);

  if (baralho === undefined) {
    return falha(
      "conflito",
      "O Baralho desta Rotina foi excluído. Ajuste a Rotina para voltar a estudar.",
    );
  }

  if (baralho.cartoes.length === 0) {
    return falha(
      "conflito",
      "O Baralho desta Rotina não tem Cartões. Adicione Cartões ou ajuste a Rotina.",
    );
  }

  const total = Math.min(
    versao.quantidade ?? baralho.cartoes.length,
    baralho.cartoes.length,
  );
  const cartoes = baralho.cartoes
    .slice(0, total)
    .map((cartao) => ({ ...cartao }));
  const inicio: InicioDaBase = {
    usuarioId: contexto.usuarioId,
    id: crypto.randomUUID(),
    rotinaId: rotina.id,
    data: dados.data,
    baralhoId: versao.baralhoId,
    nomeDoBaralho: baralho.nome,
    quantidade: versao.quantidade,
    cartoes,
  };

  base.inicios.push(inicio);

  return {
    ok: true,
    inicio: {
      id: inicio.id,
      rotinaId: inicio.rotinaId,
      data: inicio.data,
      baralhoId: inicio.baralhoId,
      nomeDoBaralho: inicio.nomeDoBaralho,
      cartoes: cartoes.map((cartao) => ({ ...cartao })),
      quantidadeSolicitada: inicio.quantidade,
    },
  };
}

/**
 * Confere a conclusão contra o Início autorizado (FR-254): `id` igual ao do
 * início, conjunto de Cartões exatamente o autorizado, sem repetição. Devolve o
 * Início, ou `null` quando a Sessão enviada não é a que foi iniciada.
 */
export function inicioDaConclusao(
  base: AgendaBase,
  usuarioId: string,
  dados: {
    id: string;
    inicioAgendaId: string;
    origem: string;
    baralhoId: string;
    itens: readonly { cartaoId: string }[];
  },
): InicioDaBase | null {
  const inicio = base.inicios.find(
    (item) => item.id === dados.inicioAgendaId && item.usuarioId === usuarioId,
  );

  if (
    inicio === undefined ||
    dados.id !== inicio.id ||
    dados.origem !== "baralho" ||
    dados.baralhoId !== inicio.baralhoId ||
    dados.itens.length !== inicio.cartoes.length
  ) {
    return null;
  }

  const enviados = new Set(dados.itens.map((item) => item.cartaoId));

  return enviados.size === inicio.cartoes.length &&
    inicio.cartoes.every((cartao) => enviados.has(cartao.id))
    ? inicio
    : null;
}

/** Conclui o Compromisso do Início: o primeiro Registro permanece (FR-235). */
export function concluirCompromissoEmMemoria(
  base: AgendaBase,
  inicio: InicioDaBase,
): void {
  const indice = base.compromissos.findIndex(
    (item) =>
      item.usuarioId === inicio.usuarioId &&
      item.rotinaId === inicio.rotinaId &&
      item.data === inicio.data,
  );
  const concluido: CompromissoDaBase = {
    usuarioId: inicio.usuarioId,
    rotinaId: inicio.rotinaId,
    data: inicio.data,
    estado: "concluido",
    registroId: inicio.id,
    baralhoId: inicio.baralhoId,
    nomeDoBaralho: inicio.nomeDoBaralho,
    quantidade: inicio.quantidade,
  };

  if (indice < 0) {
    base.compromissos.push(concluido);
  } else if (base.compromissos[indice].estado !== "concluido") {
    base.compromissos[indice] = concluido;
  }
}

/** Quantos registros da Agenda o dono tem (SC-113): Rotinas, Compromissos e Inícios. */
export function contarAgendaEmMemoria(
  base: AgendaBase,
  usuarioId: string,
): number {
  return (
    base.rotinas.filter((item) => item.usuarioId === usuarioId).length +
    base.compromissos.filter((item) => item.usuarioId === usuarioId).length +
    base.inicios.filter((item) => item.usuarioId === usuarioId).length
  );
}

/** Remove toda a Agenda do dono, como a cascata do esquema (FR-274). */
export function excluirAgendaEmMemoria(
  base: AgendaBase,
  usuarioId: string,
): void {
  base.rotinas = base.rotinas.filter((item) => item.usuarioId !== usuarioId);
  base.compromissos = base.compromissos.filter(
    (item) => item.usuarioId !== usuarioId,
  );
  base.inicios = base.inicios.filter((item) => item.usuarioId !== usuarioId);

  for (const chave of [...base.operacoes.keys()]) {
    if (chave.startsWith(`${usuarioId}|`)) {
      base.operacoes.delete(chave);
    }
  }
}
