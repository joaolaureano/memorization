// montarContaDeTeste (030, T009).

import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { hojeNoFuso, somarDias } from "../../src/agenda/datas.ts";
import { abrirArmazenamentoSqlite } from "../../src/armazenamento/sqlite/armazenamento.ts";
import { montarContaDeTeste } from "../../src/demonstracao/conta.ts";
import { PREFIXO_DE_DEMONSTRACAO } from "../../src/midia/armazem.ts";
import { ALGORITMO_PADRAO } from "../../src/repeticao/algoritmo.ts";
import { derivarDaSenha } from "../../src/identidade/senha.ts";

/** Dia civil da criação nos testes; a hora local decide o instante. */
const HOJE = "2026-10-15";

/**
 * Deslocamento fixo dos fusos usados nas provas. Nenhum deles tem horário de
 * verão em 2026, então a conversão local → instante é exata.
 */
const DESLOCAMENTO_EM_HORAS: Readonly<Record<string, number>> = {
  "Pacific/Kiritimati": 14,
  "America/Sao_Paulo": -3,
  "Pacific/Pago_Pago": -11,
};

const FUSOS = Object.keys(DESLOCAMENTO_EM_HORAS);
const HORARIOS = ["00:05", "23:55"];
const CASOS = FUSOS.flatMap((fuso) => HORARIOS.map((hora) => ({ fuso, hora })));

/** Instante em que o relógio local do fuso marca `data` às `hora`. */
function instanteLocal(data: string, hora: string, fuso: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  const [horas, minutos] = hora.split(":").map(Number);
  const deslocamento = DESLOCAMENTO_EM_HORAS[fuso];
  if (deslocamento === undefined) throw new Error(`Fuso sem deslocamento: ${fuso}`);
  return new Date(
    Date.UTC(ano!, mes! - 1, dia!, horas!, minutos!) - deslocamento * 3_600_000,
  );
}

/** Contador compartilhado: duas montagens nunca recebem os mesmos ids. */
let proximoId = 0;
const gerarId = () => `id-${++proximoId}`;

/** Monta uma Conta de teste com Senha aleatória derivada de verdade. */
async function montar(agora: Date, fuso: string) {
  const segredo = randomBytes(48).toString("base64url");
  return montarContaDeTeste({
    agora,
    fuso,
    gerarId,
    credencialAleatoria: () =>
      derivarDaSenha(segredo, randomBytes(32).toString("base64url")),
  });
}

/**
 * A forma da Conta sem o que deve variar: ids viram `<id>`, instantes viram
 * `<instante>`, dias civis `<dia>`, o Nome de usuário `<usuario>` e os bytes de
 * sal e hash `<bytes>`. O restante — textos, tipos, avaliações, intervalos e
 * contagens — tem de ser igual entre duas montagens.
 */
function forma(conta: unknown): string {
  return JSON.stringify(conta, (chave, valor: unknown) => {
    if (valor instanceof Uint8Array) return "<bytes>";
    if (typeof valor === "string") {
      if (/^id-\d+$/.test(valor)) return "<id>";
      if (/^\d{4}-\d{2}-\d{2}T/.test(valor)) return "<instante>";
      if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "<dia>";
      if (chave === "nomeDeUsuario") return "<usuario>";
    }
    return valor;
  });
}

describe("montarContaDeTeste: identidade e forma (FR-491, SC-193)", () => {
  it("duas montagens diferem só em ids, Senha e datas", async () => {
    const agora = instanteLocal(HOJE, "12:00", "America/Sao_Paulo");
    const outraData = new Date(agora.getTime() + 3 * 86_400_000);

    const a = await montar(agora, "America/Sao_Paulo");
    const b = await montar(outraData, "America/Sao_Paulo");

    expect(a.usuario.id).not.toBe(b.usuario.id);
    expect(a.usuario.contaDeTesteEm).not.toBe(b.usuario.contaDeTesteEm);
    expect(a.usuario.hash).not.toEqual(b.usuario.hash);
    expect(a.usuario.sal).not.toEqual(b.usuario.sal);
    expect(forma(a)).toBe(forma(b));
  });

  it("o Nome de usuário é teste- seguido de 16 caracteres de [a-z0-9]", async () => {
    const conta = await montar(instanteLocal(HOJE, "12:00", "America/Sao_Paulo"), "America/Sao_Paulo");
    expect(conta.usuario.nomeDeUsuario).toMatch(/^teste-[a-z0-9]{16}$/);
  });

  it("toda chave de mídia começa com demonstracao/, são 20 (10 Bandeiras e 10 Cantos)", async () => {
    const conta = await montar(instanteLocal(HOJE, "12:00", "America/Sao_Paulo"), "America/Sao_Paulo");
    const chaves = conta.baralhos
      .flatMap((baralho) => baralho.cartoes)
      .flatMap((cartao) => [cartao.imagemChave, cartao.audioChave])
      .filter((chave): chave is string => chave !== undefined);
    expect(chaves).toHaveLength(20);
    for (const chave of chaves) {
      expect(chave.startsWith(PREFIXO_DE_DEMONSTRACAO), chave).toBe(true);
    }
  });
});

describe.each(CASOS)("montarContaDeTeste no fuso $fuso às $hora", ({ fuso, hora }) => {
  const agora = instanteLocal(HOJE, hora, fuso);
  const conta = montar(agora, fuso);

  it("a criação cai no dia civil de hoje no fuso", () => {
    expect(hojeNoFuso(fuso, agora)).toBe(HOJE);
  });

  it("tem 5 Sessões nos dias −6, −5, −3, −2 e −1 no fuso, com Avaliações misturadas (FR-504)", async () => {
    const { registros } = await conta;
    expect(registros).toHaveLength(5);

    const diasEsperados = [-6, -5, -3, -2, -1].map((d) => somarDias(HOJE, d));
    const dias = registros.map((registro) => hojeNoFuso(fuso, new Date(registro.concluidaEm)));
    expect(dias).toEqual(diasEsperados);

    const todasAsAvaliacoes = new Set<string>();
    for (const registro of registros) {
      expect(registro.itens.length).toBeGreaterThanOrEqual(6);
      expect(registro.itens.length).toBeLessThanOrEqual(10);
      const avaliacoes = new Set(registro.itens.map((item) => item.avaliacao));
      expect(avaliacoes.size).toBeGreaterThanOrEqual(2);
      for (const item of registro.itens) {
        if (item.avaliacao) todasAsAvaliacoes.add(item.avaliacao);
      }
    }
    expect([...todasAsAvaliacoes].sort()).toEqual(["bom", "dificil", "errei", "facil"]);
  });

  it("tem ao menos 3 Agendamentos com revisão até hoje e ao menos 3 com revisão no futuro (FR-504)", async () => {
    const { agendamentos } = await conta;
    const datas = agendamentos.map((agendamento) =>
      hojeNoFuso(fuso, new Date(agendamento.proximaRevisaoEm)),
    );
    expect(datas.filter((data) => data <= HOJE).length).toBeGreaterThanOrEqual(3);
    expect(datas.filter((data) => data > HOJE).length).toBeGreaterThanOrEqual(3);
  });

  it("a Rotina é Inglês em todos os dias, com Todos os Cartões, e as Preferências são o padrão", async () => {
    const { rotina, preferencias, baralhos } = await conta;
    const ingles = baralhos.find((baralho) => baralho.baralho.nome === "Inglês");
    expect(ingles).toBeDefined();
    expect(rotina.baralhoId).toBe(ingles!.baralho.id);
    const versao = rotina.versoes[0];
    expect(versao?.baralhoId).toBe(ingles!.baralho.id);
    expect(versao?.dias).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(versao?.quantidade).toBeNull();
    expect(rotina.estado).toBe("ativa");
    expect(preferencias).toEqual({ algoritmo: ALGORITMO_PADRAO });
  });

  it("a Porta real aceita a Conta e devolve os três Baralhos", async () => {
    const contaMontada = await conta;
    const aberto = await abrirArmazenamentoSqlite(":memory:");
    try {
      const gravada = await aberto.armazenamento.criarContaDeTeste(contaMontada);
      expect(gravada.ok).toBe(true);
      const lidos = await aberto.armazenamento.listarBaralhos(contaMontada.usuario.id);
      expect(lidos.map((baralho) => baralho.nome).sort()).toEqual(
        ["Bandeiras", "Cantos de pássaros", "Inglês"],
      );
    } finally {
      await aberto.encerrar();
    }
  });
});
