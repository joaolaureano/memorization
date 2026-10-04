import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registrarRotasDaAplicacao } from "../../src/http/servidor.ts";
import {
  cabecalhoDeCredencial,
  senhaGerada,
  type CredencialDeTeste,
} from "../armazenamento/usuarios-de-teste.ts";
import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";

/**
 * T1709 — o contrato HTTP das rotas de conta (017, §3): `GET /conta`,
 * `PUT /conta/senha` e `DELETE /conta`, com os status literais do contrato e o
 * isolamento entre dois Usuários (FR-287).
 *
 * 020 (FR-336, FR-337): `PUT /conta/nome-de-usuario` saiu do contrato — a rota
 * **não é registrada**, uma requisição autenticada recebe `404` de rota, e o
 * pré-voo `OPTIONS` dela também não é registrado.
 */

let contrato: ServidorDeContrato;
let bruno: CredencialDeTeste;

beforeEach(async () => {
  contrato = await montarServidorDeContrato(
    ({ servidor, acervoDe, identidade, acessos }) => {
      registrarRotasDaAplicacao(servidor, identidade, acervoDe, acessos);
    },
  );
  bruno = await contrato.cadastrar("bruno.souza");
});

afterEach(async () => {
  await contrato.encerrar();
});

function como(
  credencial: CredencialDeTeste,
  requisicao: Parameters<typeof pedirComCredencial>[2],
) {
  return pedirComCredencial(contrato.servidor, credencial, requisicao);
}

describe("GET /conta (§3.1)", () => {
  it("devolve o Nome de usuário e as contagens, sem Senha nem derivado", async () => {
    await como(contrato.credencial, {
      method: "POST",
      url: "/cartoes",
      payload: { frente: "To walk", verso: "Caminhar" },
    });

    const resposta = await como(contrato.credencial, {
      method: "GET",
      url: "/conta",
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({
      nomeDeUsuario: "ana.silva",
      contagens: { cartoes: 1, baralhos: 0, registrosDeSessao: 0, agenda: 0 },
    });
    expect(resposta.body).not.toContain(contrato.credencial.senha);
    expect(resposta.body).not.toMatch(/sal|hash|parametros/);
    expect(resposta.headers["set-cookie"]).toBeUndefined();
  });

  it("recusa sem Credencial com 401", async () => {
    const resposta = await contrato.servidor.inject({
      method: "GET",
      url: "/conta",
    });

    expect(resposta.statusCode).toBe(401);
  });
});

describe("PUT /conta/nome-de-usuario removido (020; FR-336, FR-337)", () => {
  it("responde 404 a uma requisição autenticada, sem aplicar mudança alguma", async () => {
    const resposta = await como(contrato.credencial, {
      method: "PUT",
      url: "/conta/nome-de-usuario",
      payload: {
        senhaAtual: contrato.credencial.senha,
        novoNomeDeUsuario: "ana.nova",
      },
    });

    expect(resposta.statusCode).toBe(404);

    /** Nada mudou: a Credencial original continua valendo, com o mesmo Nome. */
    const conta = await como(contrato.credencial, {
      method: "GET",
      url: "/conta",
    });

    expect(conta.statusCode).toBe(200);
    expect(conta.json()).toMatchObject({ nomeDeUsuario: "ana.silva" });

    const autenticacao = await contrato.servidor.inject({
      method: "GET",
      url: "/conta",
      headers: cabecalhoDeCredencial("ana.nova", contrato.credencial.senha),
    });

    expect(autenticacao.statusCode).toBe(401);
  });

  it("não registra o pré-voo OPTIONS da rota antiga", async () => {
    const resposta = await contrato.servidor.inject({
      method: "OPTIONS",
      url: "/conta/nome-de-usuario",
      headers: {
        origin: "http://127.0.0.1:5173",
        "access-control-request-method": "PUT",
        "access-control-request-headers": "content-type, authorization",
      },
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.headers["access-control-allow-origin"]).toBeUndefined();

    /** O pré-voo das rotas de conta que ficaram continua registrado. */
    const daSenha = await contrato.servidor.inject({
      method: "OPTIONS",
      url: "/conta/senha",
      headers: { origin: "http://127.0.0.1:5173" },
    });

    expect(daSenha.statusCode).toBe(204);
  });
});

describe("PUT /conta/senha (§3.3)", () => {
  it("responde 204 e troca a Senha da Credencial", async () => {
    const nova = senhaGerada();
    const resposta = await como(contrato.credencial, {
      method: "PUT",
      url: "/conta/senha",
      payload: {
        senhaAtual: contrato.credencial.senha,
        novaSenha: nova,
        confirmacaoDaSenha: nova,
      },
    });

    expect(resposta.statusCode).toBe(204);
    expect(resposta.body).toBe("");

    const antiga = await como(contrato.credencial, {
      method: "GET",
      url: "/conta",
    });
    const atual = await contrato.servidor.inject({
      method: "GET",
      url: "/conta",
      headers: cabecalhoDeCredencial("ana.silva", nova),
    });

    expect(antiga.statusCode).toBe(401);
    expect(atual.statusCode).toBe(200);
  });

  it("responde 400 para Confirmação diferente, Senha curta e mesma_senha", async () => {
    const nova = senhaGerada();
    const diferente = await como(contrato.credencial, {
      method: "PUT",
      url: "/conta/senha",
      payload: {
        senhaAtual: contrato.credencial.senha,
        novaSenha: nova,
        confirmacaoDaSenha: senhaGerada(),
      },
    });
    const curta = await como(contrato.credencial, {
      method: "PUT",
      url: "/conta/senha",
      payload: {
        senhaAtual: contrato.credencial.senha,
        novaSenha: "1234567",
        confirmacaoDaSenha: "1234567",
      },
    });
    const igual = await como(contrato.credencial, {
      method: "PUT",
      url: "/conta/senha",
      payload: {
        senhaAtual: contrato.credencial.senha,
        novaSenha: contrato.credencial.senha,
        confirmacaoDaSenha: contrato.credencial.senha,
      },
    });

    expect(diferente.statusCode).toBe(400);
    expect(diferente.json()).toMatchObject({
      erro: "dados_invalidos",
      campo: "confirmacaoDaSenha",
    });
    expect(curta.statusCode).toBe(400);
    expect(curta.json()).toMatchObject({ erro: "dados_invalidos" });
    expect(igual.statusCode).toBe(400);
    expect(igual.json()).toMatchObject({ erro: "mesma_senha" });
  });

  it("responde 403 para a Senha atual incorreta", async () => {
    const nova = senhaGerada();
    const resposta = await como(contrato.credencial, {
      method: "PUT",
      url: "/conta/senha",
      payload: {
        senhaAtual: senhaGerada(),
        novaSenha: nova,
        confirmacaoDaSenha: nova,
      },
    });

    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toMatchObject({ erro: "senha_atual_incorreta" });
  });
});

describe("DELETE /conta (§3.4)", () => {
  it("responde 204, remove tudo do Usuário e preserva o outro (FR-274, FR-275)", async () => {
    await como(contrato.credencial, {
      method: "POST",
      url: "/cartoes",
      payload: { frente: "To walk", verso: "Caminhar" },
    });
    await como(bruno, {
      method: "POST",
      url: "/cartoes",
      payload: { frente: "To run", verso: "Correr" },
    });

    const resposta = await como(contrato.credencial, {
      method: "DELETE",
      url: "/conta",
      payload: { senhaAtual: contrato.credencial.senha },
    });

    expect(resposta.statusCode).toBe(204);

    const depois = await como(contrato.credencial, {
      method: "GET",
      url: "/conta",
    });
    const intacto = await como(bruno, { method: "GET", url: "/conta" });

    expect(depois.statusCode).toBe(401);
    expect(intacto.json()).toEqual({
      nomeDeUsuario: "bruno.souza",
      contagens: { cartoes: 1, baralhos: 0, registrosDeSessao: 0, agenda: 0 },
    });
  });

  it("responde 403 para a Senha atual incorreta e não exclui", async () => {
    const resposta = await como(contrato.credencial, {
      method: "DELETE",
      url: "/conta",
      payload: { senhaAtual: senhaGerada() },
    });

    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toMatchObject({ erro: "senha_atual_incorreta" });

    const ainda = await como(contrato.credencial, {
      method: "GET",
      url: "/conta",
    });

    expect(ainda.statusCode).toBe(200);
  });

  it("responde 400 sem a Senha atual no corpo", async () => {
    const resposta = await como(contrato.credencial, {
      method: "DELETE",
      url: "/conta",
      payload: {},
    });

    expect(resposta.statusCode).toBe(400);
  });
});

describe("isolamento (FR-287)", () => {
  it("opera só sobre o Usuário da Credencial apresentada", async () => {
    const novaSenha = senhaGerada();

    await como(bruno, {
      method: "PUT",
      url: "/conta/senha",
      payload: {
        senhaAtual: bruno.senha,
        novaSenha: novaSenha,
        confirmacaoDaSenha: novaSenha,
      },
    });

    /** A conta de ana segue intacta, e a Credencial de bruno antiga caiu. */
    const ana = await como(contrato.credencial, {
      method: "GET",
      url: "/conta",
    });
    const brunoAntigo = await como(bruno, {
      method: "GET",
      url: "/conta",
    });

    expect(ana.json()).toMatchObject({ nomeDeUsuario: "ana.silva" });
    expect(brunoAntigo.statusCode).toBe(401);
  });

  it("não aceita a Senha atual de outro Usuário", async () => {
    const resposta = await como(contrato.credencial, {
      method: "DELETE",
      url: "/conta",
      payload: { senhaAtual: bruno.senha },
    });

    expect(resposta.statusCode).toBe(403);
  });
});

describe("armazenamento indisponível (§3)", () => {
  it("responde 503 em GET /conta quando a leitura das contagens falha", async () => {
    contrato.aberto.usuarios.contarDadosDoUsuario = async () => ({
      ok: false,
      erro: "indisponivel",
    });

    const resposta = await como(contrato.credencial, {
      method: "GET",
      url: "/conta",
    });

    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toMatchObject({ erro: "indisponivel" });
  });

  it("responde 503 em DELETE /conta quando a exclusão falha, sem apresentar como feita", async () => {
    contrato.aberto.usuarios.excluirUsuario = async () => ({
      ok: false,
      erro: "indisponivel",
    });

    const resposta = await como(contrato.credencial, {
      method: "DELETE",
      url: "/conta",
      payload: { senhaAtual: contrato.credencial.senha },
    });

    expect(resposta.statusCode).toBe(503);

    const ainda = await como(contrato.credencial, {
      method: "GET",
      url: "/conta",
    });

    expect(ainda.statusCode).toBe(200);
  });
});
