import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClienteHttp } from "../src/acervo-cliente/cliente-http";
import { ProvedorDeIdioma, en, es, pt } from "../src/idioma";
import { contextoDaRota } from "../src/idioma/recusas";

/**
 * 027 — recusas do servidor no Idioma da interface (FR-016, FR-018, FR-019).
 * O servidor manda o código e uma mensagem técnica em inglês; a pessoa vê o
 * texto do catálogo do idioma vigente na chegada da resposta.
 */

const API = "http://127.0.0.1:3001";

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const MENSAGEM_TECNICA = "Username already exists.";

function servidorQueRecusaONome(): void {
  vi.stubGlobal("fetch", async () =>
    resposta(409, {
      erro: "nome_de_usuario_existente",
      mensagem: MENSAGEM_TECNICA,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("recusa do servidor apresentada no idioma vigente", () => {
  it.each([
    ["pt", "Este nome de usuário já existe. Escolha outro."],
    ["en", "This username already exists. Choose another one."],
    ["es", "Este nombre de usuario ya existe. Elige otro."],
  ] as const)("em %s, mostra o texto do catálogo e nunca a mensagem técnica", async (idioma, esperado) => {
    servidorQueRecusaONome();
    render(
      <ProvedorDeIdioma idiomaInicial={idioma}>
        <span>montado</span>
      </ProvedorDeIdioma>,
    );
    await screen.findByText("montado");

    const resultado = await new ClienteHttp(API, null).criarUsuario({
      nomeDeUsuario: "ana.silva",
      senha: "senha-de-prova-123",
    });

    expect(resultado).toEqual({
      ok: false,
      erro: "nome_de_usuario_existente",
      mensagem: esperado,
    });
  });

  it("deduz o contexto pela rota, inclusive atrás do prefixo /api", () => {
    expect(contextoDaRota("/sessoes/abc")).toBe("sessoes");
    expect(contextoDaRota("/estatisticas")).toBe("sessoes");
    expect(contextoDaRota("/baralhos/de-selecao")).toBe("selecao");
    expect(contextoDaRota("/baralhos/importacoes/previa")).toBe("importacao");
    expect(contextoDaRota("/baralhos/b1")).toBe("baralhos");
    expect(contextoDaRota("/cartoes/c1")).toBe("cartoes");
    expect(contextoDaRota("/imagens/envios")).toBe("imagens");
    expect(contextoDaRota("/conta/senha")).toBe("conta");
  });

  it("dá texto a todo código do contrato nos três idiomas, sem vazar inglês no pt", () => {
    const codigos = [
      "indisponivel", "nao_encontrado", "dados_invalidos", "conflito",
      "escolhas_invalidas", "frente_duplicada", "sem_acesso",
      "nome_de_usuario_invalido", "nome_de_usuario_existente",
      "frente_muito_longa", "cartoes_indisponiveis", "imagem_invalida",
      "expirado", "corpo_invalido", "conflito_de_versao", "verso_vazio",
      "verso_muito_longo", "tipo_imutavel", "senha_invalida",
      "senha_atual_incorreta", "nome_vazio", "nome_muito_longo",
      "mesma_senha", "imagem_ausente", "frente_vazia", "envio_invalido",
      "descricao_muito_longa", "credencial_invalida", "acesso_expirado",
      "anki_grande_demais", "anki_ilegivel", "anki_corrompido",
      "anki_incompativel",
    ];

    for (const erro of codigos) {
      for (const textos of [pt, en, es]) {
        expect(textos.recusa({ erro, limite: 100 }, "baralhos").trim()).not.toBe("");
      }
      expect(pt.recusa({ erro }, "baralhos")).not.toBe(en.recusa({ erro }, "baralhos"));
    }
  });
});
