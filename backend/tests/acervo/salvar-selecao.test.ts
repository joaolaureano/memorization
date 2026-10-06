import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { criarAcervo, type Acervo } from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/**
 * T038, T2304a — `Acervo.salvarSelecaoComoBaralho`: cria Baralho com Cartões
 * cópia num gesto único e idempotente (FR-371–FR-374). T038: seleção com
 * Frentes repetidas gera cópias numeradas na ordem da seleção. Toda asserção
 * passa pela Interface, com o Adapter do armazenamento local em memória;
 * nenhum teste inspeciona tabela.
 */

const LIMITE_DE_ITENS = 1000;
const LIMITE_DO_NOME = 100;
const NOME_VALIDO = "Inglês para a próxima viagem";

let aberto: ArmazenamentoSqliteAberto;
let acervo: Acervo;
let baralhoDeOrigem: { ok: true; baralho: { id: string; nome: string } };

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  /** O acervo é de um **dono**: Cartões e Baralhos pertencem a um Usuário (FR-092). */
  const dono = await criarDonoDeTeste(aberto.usuarios);

  acervo = criarAcervo(aberto.armazenamento, dono);

  // Cria um Baralho de origem para os Cartões
  const resultadoBaralho = await acervo.criarBaralho({ nome: "Baralho de origem" });
  if (!resultadoBaralho.ok) {
    throw new Error(`criação de Baralho recusada: ${JSON.stringify(resultadoBaralho)}`);
  }
  baralhoDeOrigem = resultadoBaralho;
});

afterEach(async () => {
  await aberto.encerrar();
});

/** Cria um Cartão válido no Baralho de origem. */
async function criarCartao(
  alvo: Acervo = acervo,
  baralhoId = baralhoDeOrigem.baralho.id,
  frente = "How are you?",
  verso = "Como você está?",
): Promise<string> {
  const resultado = await alvo.criarCartao(baralhoId, {
    frente,
    verso,
  });

  if (!resultado.ok) {
    throw new Error(`criação de Cartão recusada: ${JSON.stringify(resultado)}`);
  }

  return resultado.cartao.id;
}

describe("salvarSelecaoComoBaralho — salvamento pela Interface", () => {
  it("cria o Baralho com todos os Vínculos e devolve novo: true (FR-371)", async () => {
    const cartoes = [await criarCartao(), await criarCartao(), await criarCartao()];
    const id = randomUUID();

    expect(
      await acervo.salvarSelecaoComoBaralho({
        id,
        nome: NOME_VALIDO,
        cartaoIds: cartoes,
      }),
    ).toEqual({
      ok: true,
      baralho: { id, nome: NOME_VALIDO },
      novo: true,
    });

    expect(await acervo.listarBaralhos()).toContainEqual(
      expect.objectContaining({ id, nome: NOME_VALIDO, quantidadeDeCartoes: 3 }),
    );
  });

  it("reenvia o mesmo id com novo: false, sem duplicar o Baralho (FR-372)", async () => {
    const cartoes = [await criarCartao(), await criarCartao()];
    const entrada = { id: randomUUID(), nome: NOME_VALIDO, cartaoIds: cartoes };

    expect(await acervo.salvarSelecaoComoBaralho(entrada)).toEqual({
      ok: true,
      baralho: { id: entrada.id, nome: NOME_VALIDO },
      novo: true,
    });

    expect(await acervo.salvarSelecaoComoBaralho(entrada)).toEqual({
      ok: true,
      baralho: { id: entrada.id, nome: NOME_VALIDO },
      novo: false,
    });

    // Verifica que há apenas 2 Baralhos: o de origem e o salvo
    expect(await acervo.listarBaralhos()).toHaveLength(2);
  });

  it("recusa nome vazio com o código de nome vigente (FR-373)", async () => {
    const cartao = await criarCartao();

    expect(
      await acervo.salvarSelecaoComoBaralho({
        id: randomUUID(),
        nome: "",
        cartaoIds: [cartao],
      }),
    ).toEqual({
      ok: false,
      erro: "nome_vazio",
      mensagem: "O nome do baralho não pode ficar vazio.",
    });
  });

  it("recusa nome com 101 caracteres, informando limite e tamanho atual (FR-373)", async () => {
    const cartao = await criarCartao();

    expect(
      await acervo.salvarSelecaoComoBaralho({
        id: randomUUID(),
        nome: "a".repeat(LIMITE_DO_NOME + 1),
        cartaoIds: [cartao],
      }),
    ).toEqual({
      ok: false,
      erro: "nome_muito_longo",
      mensagem:
        "O nome do baralho deve ter no máximo 100 caracteres; o informado tem 101.",
    });
  });

  it("recusa id que não é UUID e nome que não é string com dados_invalidos (FR-373)", async () => {
    const cartao = await criarCartao();

    expect(
      await acervo.salvarSelecaoComoBaralho({
        id: "não-é-uuid",
        nome: NOME_VALIDO,
        cartaoIds: [cartao],
      }),
    ).toEqual({ ok: false, erro: "dados_invalidos" });

    expect(
      await acervo.salvarSelecaoComoBaralho({
        id: randomUUID(),
        nome: 42,
        cartaoIds: [cartao],
      }),
    ).toEqual({ ok: false, erro: "dados_invalidos" });
  });

  it("recusa cartaoIds fora da forma com dados_invalidos (FR-373)", async () => {
    const cartao = await criarCartao();

    const selecoesInvalidas: unknown[] = [
      [],
      [cartao, cartao],
      ["   "],
      [cartao, "   "],
      [cartao, 42],
      "não é lista",
      undefined,
      Array.from({ length: LIMITE_DE_ITENS + 1 }, (_, indice) => `c${indice}`),
    ];

    for (const cartaoIds of selecoesInvalidas) {
      expect(
        await acervo.salvarSelecaoComoBaralho({
          id: randomUUID(),
          nome: NOME_VALIDO,
          cartaoIds,
        }),
      ).toEqual({ ok: false, erro: "dados_invalidos" });
    }
  });

  it("recusa Cartão de outro Usuário, sem gravar Baralho (FR-374)", async () => {
    const meu = await criarCartao();

    const donoDois = await criarDonoDeTeste(
      aberto.usuarios,
      "dono-dois",
      "bruno.souza",
    );
    const acervoDois = criarAcervo(aberto.armazenamento, donoDois);

    // Cria um Baralho de origem para o outro usuário
    const resultadoBaralho = await acervoDois.criarBaralho({
      nome: "Baralho do outro usuário",
    });
    if (!resultadoBaralho.ok) {
      throw new Error(`criação de Baralho recusada: ${JSON.stringify(resultadoBaralho)}`);
    }

    const alheio = await criarCartao(
      acervoDois,
      resultadoBaralho.baralho.id,
    );

    expect(
      await acervo.salvarSelecaoComoBaralho({
        id: randomUUID(),
        nome: NOME_VALIDO,
        cartaoIds: [meu, alheio],
      }),
    ).toEqual({
      ok: false,
      erro: "cartoes_indisponiveis",
      cartaoIds: [alheio],
    });

    // Verifica que só o Baralho de origem foi criado (não o novo Baralho)
    expect(await acervo.listarBaralhos()).toHaveLength(1);
    expect((await acervo.listarBaralhos())[0].nome).toBe("Baralho de origem");
  });

  it("não altera os Baralhos de origem nem os seus Vínculos (FR-374)", async () => {
    const um = await criarCartao();
    const dois = await criarCartao();
    const tres = await criarCartao();

    const origem = await acervo.salvarSelecaoComoBaralho({
      id: randomUUID(),
      nome: "Primeira seleção",
      cartaoIds: [um, dois],
    });
    expect(origem.ok).toBe(true);

    const donoDois = await criarDonoDeTeste(
      aberto.usuarios,
      "dono-dois",
      "bruno.souza",
    );
    const acervoDois = criarAcervo(aberto.armazenamento, donoDois);

    // Cria um Baralho de origem para o outro usuário
    const resultadoBaralho = await acervoDois.criarBaralho({
      nome: "Baralho do outro usuário",
    });
    if (!resultadoBaralho.ok) {
      throw new Error(`criação de Baralho recusada: ${JSON.stringify(resultadoBaralho)}`);
    }

    const alheio = await criarCartao(
      acervoDois,
      resultadoBaralho.baralho.id,
    );

    const antes = await acervo.listarBaralhos();

    expect(
      await acervo.salvarSelecaoComoBaralho({
        id: randomUUID(),
        nome: "Seleção com Cartão alheio",
        cartaoIds: [um, tres, alheio],
      }),
    ).toEqual({
      ok: false,
      erro: "cartoes_indisponiveis",
      cartaoIds: [alheio],
    });

    expect(await acervo.listarBaralhos()).toEqual(antes);
  });

  it("seleção com Frentes repetidas gera cópias numeradas na ordem (T038)", async () => {
    const um = await criarCartao(
      acervo,
      baralhoDeOrigem.baralho.id,
      "To walk",
      "Caminhar",
    );
    const dois = await criarCartao(
      acervo,
      baralhoDeOrigem.baralho.id,
      "To walk",
      "Andar",
    );
    const tres = await criarCartao(
      acervo,
      baralhoDeOrigem.baralho.id,
      "To run",
      "Correr",
    );

    const id = randomUUID();
    const resultado = await acervo.salvarSelecaoComoBaralho({
      id,
      nome: "Seleção com Frentes repetidas",
      cartaoIds: [um, dois, tres],
    });

    expect(resultado).toEqual({
      ok: true,
      baralho: { id, nome: "Seleção com Frentes repetidas" },
      novo: true,
    });

    const baralho = await acervo.obterBaralho(id);
    expect(baralho.ok).toBe(true);
    if (!baralho.ok) throw new Error("baralho não encontrado");

    // Verifica que as Frentes foram numeradas na ordem da seleção
    expect(baralho.baralho.cartoes).toHaveLength(3);
    const frentes = baralho.baralho.cartoes.map((c) => c.frente).sort();
    expect(frentes).toContain("To walk");
    expect(frentes).toContain("To walk (2)");
    expect(frentes).toContain("To run");
  });

  it("cópias não têm Agendamento; origens e Agendamentos de origem ficam intactos (T038)", async () => {
    const um = await criarCartao(
      acervo,
      baralhoDeOrigem.baralho.id,
      "How are you?",
      "Como você está?",
    );

    // Verifica que o Cartão original não tem Agendamento inicialmente
    const cartoesAntes = await acervo.listarCartoes();
    expect(cartoesAntes).toHaveLength(1);
    expect(cartoesAntes[0].proximaRevisaoEm).toBeNull();

    // Salva como novo Baralho
    const id = randomUUID();
    await acervo.salvarSelecaoComoBaralho({
      id,
      nome: "Cópia",
      cartaoIds: [um],
    });

    // Verifica que há agora 2 Cartões: o original sem Agendamento e a cópia também sem
    const cartoesDepois = await acervo.listarCartoes();
    expect(cartoesDepois).toHaveLength(2);

    const original = cartoesDepois.find((c) => c.baralho.id === baralhoDeOrigem.baralho.id);
    const copia = cartoesDepois.find((c) => c.baralho.id === id);

    expect(original).toBeDefined();
    expect(original?.frente).toBe("How are you?");
    expect(original?.verso).toBe("Como você está?");
    expect(original?.proximaRevisaoEm).toBeNull();

    expect(copia).toBeDefined();
    expect(copia?.frente).toBe("How are you?");
    expect(copia?.verso).toBe("Como você está?");
    expect(copia?.proximaRevisaoEm).toBeNull();
  });

  it("reenviar mesmo id devolve novo: false sem novas cópias (T038)", async () => {
    const um = await criarCartao();
    const id = randomUUID();

    const primeira = await acervo.salvarSelecaoComoBaralho({
      id,
      nome: "Primeira vez",
      cartaoIds: [um],
    });

    expect(primeira.ok).toBe(true);
    if (!primeira.ok) throw new Error("primeira falhou");
    expect(primeira.novo).toBe(true);

    // Lista Cartões antes de reenviar
    const cartoesAntes = await acervo.listarCartoes();
    expect(cartoesAntes).toHaveLength(2); // original + cópia

    // Reenviar o mesmo id
    const segunda = await acervo.salvarSelecaoComoBaralho({
      id,
      nome: "Primeira vez", // nome pode ser diferente, é ignorado no reenvio
      cartaoIds: [um],
    });

    expect(segunda.ok).toBe(true);
    if (!segunda.ok) throw new Error("segunda falhou");
    expect(segunda.novo).toBe(false);
    expect(segunda.baralho.id).toBe(id);

    // Lista Cartões depois de reenviar — não deve ter mudado
    const cartoesDepois = await acervo.listarCartoes();
    expect(cartoesDepois).toHaveLength(2); // ainda original + cópia
  });
});
