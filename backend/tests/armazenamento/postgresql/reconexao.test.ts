import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { MAXIMO_DE_CONEXOES } from "../../../src/armazenamento/postgresql/conexao.ts";
import {
  abrirArmazenamentoDaBase,
  abrirBaseDeTeste,
  abrirPiscinaDaBase,
  criarArmazenamentoDeTeste,
  criarBaseMigrada,
  descartarBasesDeTeste,
} from "./base-de-teste.ts";
import {
  iniciarServidorDeTeste,
  servidorDeTeste,
  type ServidorAutonomo,
} from "./servidor-de-teste.ts";
import { criarDonoDeTeste } from "../usuarios-de-teste.ts";

/**
 * T905 — a queda de uma conexão ociosa custa uma conexão do conjunto e nada
 * mais, e a base indisponível nunca produz operação apresentada como concluída
 * (FR-119, FR-118, FR-044, FR-045, SC-049).
 *
 * O provedor de nuvem encerra conexões ociosas. A prova aqui é a do servidor
 * real: as conexões do Adapter são encerradas por `pg_terminate_backend` — é o
 * que o provedor faz —, e a **próxima** operação abre outra e conclui, com o
 * conteúdo correto. O ouvinte de `error` do conjunto descarta o evento em
 * silêncio, e é por isso que nem o processo cai, nem nada do driver aparece na
 * saída.
 *
 * A indisponibilidade é exercitada com um servidor **próprio**, parado de
 * verdade: cada operação da Porta devolve `indisponivel` — nenhuma passa por
 * concluída —, a falha é reportada e o conteúdo informado continua disponível
 * para nova tentativa, que é feita aqui sem redigitar nada.
 */

/** Cartão de cenário, com o identificador informado. */
function cartaoDe(id: string) {
  return { id, frente: "To walk", verso: "Caminhar" };
}

/**
 * Um nome de base que não existe no servidor — e nunca é criado: é a
 * indisponibilidade sem depender de parar nada.
 */
const BASE_INEXISTENTE = "base_de_teste_inexistente";

let avulso: ServidorAutonomo;

/** Subir os dois PostgreSQL reais leva segundos: o prazo do gancho é folgado. */
beforeAll(async () => {
  await servidorDeTeste();
  avulso = await iniciarServidorDeTeste();
}, 120_000);

afterAll(async () => {
  await avulso.encerrar();
  await descartarBasesDeTeste();
  await (await servidorDeTeste()).encerrar();
});

describe("conexão ociosa encerrada pelo provedor", () => {
  it("a próxima operação abre outra conexão e conclui, com o conteúdo correto", async () => {
    const base = await abrirBaseDeTeste("queda-de-conexao");

    try {
      const dono = await criarDonoDeTeste(base.usuarios);

      await base.armazenamento.inserirCartao(dono, cartaoDe("c1"));

      const espiões = [
        vi.spyOn(console, "log"),
        vi.spyOn(console, "info"),
        vi.spyOn(console, "warn"),
        vi.spyOn(console, "error"),
        vi.spyOn(console, "debug"),
      ];

      /** É assim que o provedor de nuvem encerra conexões ociosas. */
      const encerradas = await (
        await servidorDeTeste()
      ).encerrarConexoes(base.nomeDaBase);

      expect(encerradas).toBeGreaterThan(0);

      /** O evento de erro da conexão ociosa é entregue ao conjunto. */
      await new Promise((resolver) => setTimeout(resolver, 300));

      /** A próxima operação conclui: outra conexão foi aberta sozinha. */
      expect(await base.armazenamento.listarCartoes(dono)).toEqual([
        cartaoDe("c1"),
      ]);
      expect(
        await base.armazenamento.inserirCartao(dono, cartaoDe("c2")),
      ).toEqual({
        ok: true,
        valor: cartaoDe("c2"),
      });
      expect(await base.armazenamento.obterCartao(dono, "c2")).toEqual({
        ok: true,
        valor: cartaoDe("c2"),
      });

      /** Nada do evento de erro — nem do endereço da base — foi escrito. */
      for (const espiao of espiões) {
        expect(espiao).not.toHaveBeenCalled();
      }
    } finally {
      vi.restoreAllMocks();
      await base.encerrar();
    }
  });
});

describe("credenciais de teste geradas a cada execução", () => {
  it("não repete a senha nem o CA entre servidores", async () => {
    const daSuite = (await servidorDeTeste()).configuracao;

    /** Duas execuções do apoio: nenhuma credencial se repete. */
    expect(avulso.configuracao.senha).not.toBe(daSuite.senha);
    expect(avulso.configuracao.certificadoDaAutoridade).not.toBe(
      daSuite.certificadoDaAutoridade,
    );
  });
});

describe("o conjunto de conexões", () => {
  it("é pequeno, fixo, e sempre com ouvinte de error", async () => {
    const piscina = await abrirPiscinaDaBase(await criarBaseMigrada("conjunto"));

    try {
      expect(MAXIMO_DE_CONEXOES).toBe(4);
      expect(piscina.options.max).toBe(MAXIMO_DE_CONEXOES);

      /** Sem ouvinte, o erro de uma conexão ociosa derrubaria o processo. */
      expect(piscina.listenerCount("error")).toBeGreaterThan(0);
    } finally {
      await piscina.end();
    }
  });
});

describe("armazenamento indisponível", () => {
  it("reporta a falha em toda operação, sem apresentar nenhuma como concluída", async () => {
    const nomeDaBase = await criarBaseMigrada("indisponivel", avulso);
    const aberto = await abrirArmazenamentoDaBase(nomeDaBase, avulso);
    const dono = await criarDonoDeTeste(aberto.usuarios);

    await aberto.armazenamento.inserirCartao(dono, cartaoDe("c1"));

    /** O servidor para de verdade: a base fica inalcançável. */
    await avulso.encerrar();

    try {
      expect(
        await aberto.armazenamento.inserirCartao(dono, cartaoDe("c2")),
      ).toEqual({
        ok: false,
        erro: "indisponivel",
      });
      expect(await aberto.armazenamento.obterCartao(dono, "c1")).toEqual({
        ok: false,
        erro: "indisponivel",
      });
      expect(
        await aberto.armazenamento.atualizarCartao(dono, cartaoDe("c1")),
      ).toEqual({ ok: false, erro: "indisponivel" });
      expect(await aberto.armazenamento.excluirCartao(dono, "c1")).toEqual({
        ok: false,
        erro: "indisponivel",
      });
      expect(
        await aberto.armazenamento.inserirBaralho(dono, {
          id: "b1",
          nome: "Inglês",
        }),
      ).toEqual({ ok: false, erro: "indisponivel" });
      expect(await aberto.armazenamento.obterBaralho(dono, "b1")).toEqual({
        ok: false,
        erro: "indisponivel",
      });
      expect(
        await aberto.armazenamento.atualizarBaralho(dono, {
          id: "b1",
          nome: "Inglês",
        }),
      ).toEqual({ ok: false, erro: "indisponivel" });
      expect(await aberto.armazenamento.excluirBaralho(dono, "b1")).toEqual({
        ok: false,
        erro: "indisponivel",
      });
      expect(await aberto.armazenamento.vincular(dono, "c1", "b1")).toEqual({
        ok: false,
        erro: "indisponivel",
      });
      expect(await aberto.armazenamento.desvincular(dono, "c1", "b1")).toEqual({
        ok: false,
        erro: "indisponivel",
      });
    } finally {
      await aberto.encerrar();
    }
  });

  it("preserva o conteúdo informado para nova tentativa, sem redigitação", async () => {
    const cartao = cartaoDe("c1");
    const servidor = await servidorDeTeste();

    /** Uma base que não existe é armazenamento indisponível. */
    const indisponivel = await abrirArmazenamentoDaBase(
      BASE_INEXISTENTE,
      servidor,
    );

    try {
      expect(
        await indisponivel.armazenamento.inserirCartao("dono-um", cartao),
      ).toEqual({
        ok: false,
        erro: "indisponivel",
      });
    } finally {
      await indisponivel.encerrar();
    }

    /** A mesma informação, sem redigitar nada, é aceita quando há onde gravar. */
    const disponivel = await criarArmazenamentoDeTeste();
    const dono = await criarDonoDeTeste(disponivel.usuarios);

    try {
      expect(await disponivel.armazenamento.inserirCartao(dono, cartao)).toEqual({
        ok: true,
        valor: cartao,
      });
      expect(await disponivel.armazenamento.obterCartao(dono, cartao.id)).toEqual({
        ok: true,
        valor: cartao,
      });
    } finally {
      await disponivel.encerrar();
    }
  });
});
