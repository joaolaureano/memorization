import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  ArmazenamentoDeUsuarios,
  Usuario,
} from "../../src/armazenamento/porta.ts";

/**
 * Bateria compartilhada da Porta `ArmazenamentoDeUsuarios` — a segunda Porta,
 * por onde o Module `Identidade` lê e grava Usuários.
 *
 * É a mesma postura da bateria de `ArmazenamentoDoAcervo`: os cenários são da
 * Interface, e não de um armazenamento. Nenhum deles nomeia dialeto, arquivo,
 * tabela ou driver — se nomeassem, a bateria deixaria de ser da Porta e passaria
 * a ser da Implementation. Todo Adapter pronto a exercita chamando
 * `bateriaDaPortaDeUsuarios` com a sua fábrica; acrescentar um Adapter é
 * acrescentar uma chamada, sem editar um cenário e sem editar Module algum.
 *
 * O que os cenários exigem da Porta, e nada além disso: a gravação devolve o
 * Usuário guardado; a leitura é **sem distinção entre maiúsculas e minúsculas**
 * (FR-074); o Nome de usuário repetido chega como desfecho tipado
 * (`nome_de_usuario_existente`), e não como erro do driver; e a falha do
 * armazenamento chega como `indisponivel`, sem nada passar por concluído
 * (FR-044, FR-107).
 */

/**
 * O armazenamento aberto que a bateria recebe. O ciclo de vida é da fábrica do
 * Adapter, e não da Porta: a Interface que os Modules conhecem não abre nem
 * fecha armazenamento.
 */
export interface ArmazenamentoDeUsuariosAberto {
  usuarios: ArmazenamentoDeUsuarios;
  encerrar(): Promise<void>;
}

/**
 * A fábrica de Adapter. Cada chamada devolve um armazenamento **limpo**, de
 * modo que um cenário nunca enxerga o que o outro gravou — e sem que o cenário
 * saiba onde o armazenamento guarda os dados.
 */
export type FabricaDeArmazenamentoDeUsuarios =
  () => Promise<ArmazenamentoDeUsuariosAberto>;

/**
 * Usuário com identificador e transformação fixos, para que o cenário possa
 * citá-los. O `sal` tem os 16 bytes que o esquema exige; os valores são
 * sintéticos, e nunca correspondem a Senha alguma.
 */
function usuarioDe(
  id: string,
  nomeDeUsuario = "ana.silva",
  sal: Uint8Array = Uint8Array.from({ length: 16 }, (_, indice) => indice),
  hash: Uint8Array = Uint8Array.from({ length: 64 }, (_, indice) => indice),
): Usuario {
  return {
    id,
    nomeDeUsuario,
    sal,
    hash,
    parametros: '{"algoritmo":"scrypt"}',
  };
}

/** Registra os cenários da Porta de Usuários contra a fábrica recebida. */
export function bateriaDaPortaDeUsuarios(
  criarArmazenamento: FabricaDeArmazenamentoDeUsuarios,
  rotulo: string,
): void {
  describe(`ArmazenamentoDeUsuarios — ${rotulo}`, () => {
    let aberto: ArmazenamentoDeUsuariosAberto;
    let encerrado: boolean;

    beforeEach(async () => {
      aberto = await criarArmazenamento();
      encerrado = false;
    });

    afterEach(async () => {
      if (!encerrado) {
        await aberto.encerrar();
      }
    });

    function usuarios(): ArmazenamentoDeUsuarios {
      return aberto.usuarios;
    }

    it("guarda um Usuário e o devolve no desfecho de sucesso", async () => {
      const usuario = usuarioDe("u1");

      expect(await usuarios().inserirUsuario(usuario)).toEqual({
        ok: true,
        valor: usuario,
      });
    });

    it("começa vazio e recusa o Nome de usuário ausente como nao_encontrado", async () => {
      expect(await usuarios().obterUsuarioPorNomeDeUsuario("ana.silva")).toEqual(
        { ok: false, erro: "nao_encontrado" },
      );
    });

    it("devolve o Usuário guardado pelo Nome de usuário, com sal, hash e parâmetros intactos", async () => {
      const usuario = usuarioDe("u1");

      await usuarios().inserirUsuario(usuario);

      const lido = await usuarios().obterUsuarioPorNomeDeUsuario("ana.silva");

      expect(lido.ok).toBe(true);

      if (!lido.ok) {
        return;
      }

      expect(lido.valor.id).toBe("u1");
      expect(lido.valor.nomeDeUsuario).toBe("ana.silva");
      expect(Array.from(lido.valor.sal)).toEqual(Array.from(usuario.sal));
      expect(Array.from(lido.valor.hash)).toEqual(Array.from(usuario.hash));
      expect(lido.valor.parametros).toBe(usuario.parametros);
    });

    it("encontra o Usuário sem distinguir maiúsculas de minúsculas", async () => {
      await usuarios().inserirUsuario(usuarioDe("u1", "Ana.Silva"));

      for (const nome of ["ana.silva", "ANA.SILVA", "Ana.Silva"]) {
        const lido = await usuarios().obterUsuarioPorNomeDeUsuario(nome);

        expect(lido.ok, nome).toBe(true);
        expect(lido.ok && lido.valor.id).toBe("u1");
      }
    });

    it("recusa o Nome de usuário repetido, sem distinguir maiúsculas de minúsculas", async () => {
      await usuarios().inserirUsuario(usuarioDe("u1", "Ana.Silva"));

      expect(await usuarios().inserirUsuario(usuarioDe("u2", "ana.silva"))).toEqual(
        { ok: false, erro: "nome_de_usuario_existente" },
      );
      expect(await usuarios().inserirUsuario(usuarioDe("u3", "ANA.SILVA"))).toEqual(
        { ok: false, erro: "nome_de_usuario_existente" },
      );

      /** A recusa não gravou nada: o Nome de usuário continua sendo o de u1. */
      const lido = await usuarios().obterUsuarioPorNomeDeUsuario("ana.silva");

      expect(lido.ok && lido.valor.id).toBe("u1");
    });

    it("carrega apenas o código estável na recusa, sem detalhe algum do driver", async () => {
      await usuarios().inserirUsuario(usuarioDe("u1", "Ana.Silva"));

      const recusa = await usuarios().inserirUsuario(
        usuarioDe("u2", "ana.silva"),
      );

      expect(recusa).toEqual({
        ok: false,
        erro: "nome_de_usuario_existente",
      });
      expect(Object.keys(recusa).sort()).toEqual(["erro", "ok"]);
    });

    it("reporta indisponivel depois de o armazenamento ser encerrado, sem nada passar por concluído", async () => {
      await usuarios().inserirUsuario(usuarioDe("u1"));

      await aberto.encerrar();
      encerrado = true;

      expect(await usuarios().inserirUsuario(usuarioDe("u2", "bruno.souza"))).toEqual(
        { ok: false, erro: "indisponivel" },
      );
      expect(await usuarios().obterUsuarioPorNomeDeUsuario("ana.silva")).toEqual({
        ok: false,
        erro: "indisponivel",
      });
    });
  });
}
