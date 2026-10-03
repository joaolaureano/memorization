import { describe, expect, it } from "vitest";

import {
  INDISPONIVEL,
  NAO_AUTENTICADO,
} from "../src/acervo-cliente/cliente";
import type {
  ClienteDoAcervo,
  Credencial,
  ResultadoDeEntrar,
} from "../src/acervo-cliente/cliente";
import {
  decidirResultadoIncerto,
  proximaVerificacao,
} from "../src/conta/resultado-incerto";
import type {
  AcaoDeConta,
  DecisaoDoResultadoIncerto,
  Verificacao,
} from "../src/conta/resultado-incerto";
import { verificarResultadoIncerto } from "../src/conta/verificar-resultado";

/**
 * T1704 — a decisão pura do resultado incerto (017; FR-280..FR-283, SC-110):
 * uma tabela cobrindo cada ramo, e a orquestração que apresenta as Credenciais
 * ao Entrar na ordem pedida.
 */

type Linha = [
  AcaoDeConta,
  Verificacao | undefined,
  Verificacao | undefined,
  DecisaoDoResultadoIncerto | null,
];

describe("decidirResultadoIncerto", () => {
  const tabela: Linha[] = [
    // Renomear e trocar a Senha: a Credencial nova vale → aplicada.
    ["alterar-nome", "aceita", undefined, "aplicada"],
    ["trocar-senha", "aceita", "recusada", "aplicada"],
    // Falta verificar.
    ["alterar-nome", undefined, undefined, null],
    ["trocar-senha", "recusada", undefined, null],
    ["trocar-senha", "falhou", undefined, null],
    // A antiga vale → nada mudou.
    ["alterar-nome", "recusada", "aceita", "nao_aplicada"],
    ["trocar-senha", "falhou", "aceita", "nao_aplicada"],
    // Nenhuma vale, ou a verificação falhou → desconhecido.
    ["alterar-nome", "recusada", "recusada", "desconhecido"],
    ["alterar-nome", "falhou", "falhou", "desconhecido"],
    ["trocar-senha", "recusada", "falhou", "desconhecido"],
    // Excluir: só a antiga importa.
    ["excluir", undefined, undefined, null],
    ["excluir", undefined, "aceita", "nao_aplicada"],
    ["excluir", undefined, "recusada", "excluida"],
    ["excluir", undefined, "falhou", "desconhecido"],
  ];

  it.each(tabela)(
    "%s com nova=%s e antiga=%s decide %s",
    (acao, nova, antiga, esperado) => {
      expect(decidirResultadoIncerto(acao, { nova, antiga })).toBe(esperado);
    },
  );
});

describe("proximaVerificacao", () => {
  it("pede a Credencial nova primeiro, depois a antiga, e nada quando há decisão", () => {
    expect(proximaVerificacao("alterar-nome", {})).toBe("nova");
    expect(proximaVerificacao("alterar-nome", { nova: "recusada" })).toBe(
      "antiga",
    );
    expect(proximaVerificacao("alterar-nome", { nova: "aceita" })).toBeNull();
    expect(
      proximaVerificacao("trocar-senha", {
        nova: "recusada",
        antiga: "aceita",
      }),
    ).toBeNull();
  });

  it("consulta só a antiga na exclusão", () => {
    expect(proximaVerificacao("excluir", {})).toBe("antiga");
    expect(proximaVerificacao("excluir", { antiga: "recusada" })).toBeNull();
  });
});

describe("verificarResultadoIncerto", () => {
  const antiga: Credencial = { nomeDeUsuario: "ana", senha: "antiga-1234" };
  const nova: Credencial = { nomeDeUsuario: "ana", senha: "nova-12345" };

  /** Um cliente cujo Entrar aceita apenas as Credenciais informadas. */
  function clienteQueAceita(
    aceitas: readonly Credencial[],
    indisponivel = false,
  ): { cliente: ClienteDoAcervo; apresentadas: Credencial[] } {
    const apresentadas: Credencial[] = [];
    const cliente = {
      entrar: async (credencial: Credencial): Promise<ResultadoDeEntrar> => {
        apresentadas.push(credencial);

        if (indisponivel) {
          return { ok: false, erro: INDISPONIVEL, mensagem: "fora do ar" };
        }

        return aceitas.some(
          (aceita) =>
            aceita.nomeDeUsuario === credencial.nomeDeUsuario &&
            aceita.senha === credencial.senha,
        )
          ? { ok: true, usuario: { id: "u1", nomeDeUsuario: "ana" } }
          : { ok: false, erro: NAO_AUTENTICADO, mensagem: "recusada" };
      },
    } as unknown as ClienteDoAcervo;

    return { cliente, apresentadas };
  }

  it("conclui aplicada sem consultar a antiga quando a nova vale", async () => {
    const { cliente, apresentadas } = clienteQueAceita([nova]);

    expect(
      await verificarResultadoIncerto(cliente, "trocar-senha", {
        antiga,
        nova,
      }),
    ).toBe("aplicada");
    expect(apresentadas).toEqual([nova]);
  });

  it("conclui nao_aplicada quando só a antiga vale", async () => {
    const { cliente, apresentadas } = clienteQueAceita([antiga]);

    expect(
      await verificarResultadoIncerto(cliente, "alterar-nome", {
        antiga,
        nova,
      }),
    ).toBe("nao_aplicada");
    expect(apresentadas).toEqual([nova, antiga]);
  });

  it("conclui excluida quando a antiga é recusada na exclusão", async () => {
    const { cliente } = clienteQueAceita([]);

    expect(
      await verificarResultadoIncerto(cliente, "excluir", { antiga }),
    ).toBe("excluida");
  });

  it("conclui desconhecido quando a verificação falha", async () => {
    const { cliente } = clienteQueAceita([], true);

    expect(
      await verificarResultadoIncerto(cliente, "trocar-senha", {
        antiga,
        nova,
      }),
    ).toBe("desconhecido");
    expect(
      await verificarResultadoIncerto(cliente, "excluir", { antiga }),
    ).toBe("desconhecido");
  });

  it("não decide sem Credencial nova a apresentar", async () => {
    const { cliente } = clienteQueAceita([antiga]);

    expect(
      await verificarResultadoIncerto(cliente, "alterar-nome", { antiga }),
    ).toBe("nao_aplicada");
  });
});
