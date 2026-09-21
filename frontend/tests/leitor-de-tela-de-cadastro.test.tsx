import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import {
  LIMITE_MAXIMO_DE_NOME_DE_USUARIO,
  LIMITE_MAXIMO_DE_SENHA,
  LIMITE_MINIMO_DE_NOME_DE_USUARIO,
  LIMITE_MINIMO_DE_SENHA,
} from "../src/acervo-cliente/validacao";
import {
  MENSAGEM_DE_CONFIRMACAO_DIVERGENTE,
  PaginaDeCadastro,
} from "../src/ui/PaginaDeCadastro";

/**
 * T612 — recusas e confirmação do Cadastro perceptíveis por leitor de tela
 * (specs/007-criar-usuario/tasks.md, FR-082).
 *
 * As asserções consultam a semântica acessível, não o texto puro: papel por
 * `getByRole`, nome por `toHaveAccessibleName`, descrição por
 * `toHaveAccessibleDescription` e estado de região ativa por
 * `aria-live`/`aria-atomic`. A confirmação é uma região ativa polida
 * (`role="status"`); a recusa é uma região assertiva (`role="alert"`), cada
 * uma única e nomeada no seu contexto e **sem** `aria-live` explícito — o
 * valor redundante sobre o alerta poderia duplicar o anúncio.
 */

const NOME_DE_USUARIO_VALIDO = "Ana.Silva";
const SENHA_VALIDA = "senha-de-prova";

function renderizarPaginaDeCadastro(
  cliente: ClienteEmMemoria = new ClienteEmMemoria(),
): void {
  render(<PaginaDeCadastro cliente={cliente} />);
}

/** Preenche os três campos pelos rótulos acessíveis. */
function preencher(
  nomeDeUsuario: string,
  senha: string,
  confirmacaoDaSenha: string = senha,
): void {
  fireEvent.change(screen.getByLabelText("Nome de usuário"), {
    target: { value: nomeDeUsuario },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: senha },
  });
  fireEvent.change(screen.getByLabelText("Confirmação da Senha"), {
    target: { value: confirmacaoDaSenha },
  });
}

/** Submete o Cadastro pelo botão acessível. */
function submeter(): void {
  fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
}

describe("PaginaDeCadastro para leitor de tela", () => {
  it("os três campos têm nome, papel e descrição acessíveis, com os limites anunciados (FR-071, FR-080)", () => {
    renderizarPaginaDeCadastro();

    const campoDoNome = screen.getByRole("textbox", {
      name: "Nome de usuário",
    });

    expect(campoDoNome).toHaveAccessibleName("Nome de usuário");
    expect(campoDoNome).toHaveAccessibleDescription(
      new RegExp(`De ${LIMITE_MINIMO_DE_NOME_DE_USUARIO} a`),
    );
    expect(campoDoNome).toHaveAccessibleDescription(
      new RegExp(`0 / ${LIMITE_MAXIMO_DE_NOME_DE_USUARIO} caracteres`),
    );

    // Campos de Senha não têm papel de `textbox`: o navegador os expõe sem
    // revelar o valor, e é pelo rótulo que o leitor de tela os alcança.
    const campoDaSenha = screen.getByLabelText("Senha");
    const campoDaConfirmacao = screen.getByLabelText("Confirmação da Senha");

    expect(campoDaSenha).toHaveAccessibleName("Senha");
    expect(campoDaSenha).toHaveAttribute("autocomplete", "new-password");
    expect(campoDaSenha).toHaveAccessibleDescription(
      new RegExp(`De ${LIMITE_MINIMO_DE_SENHA} a ${LIMITE_MAXIMO_DE_SENHA}`),
    );

    expect(campoDaConfirmacao).toHaveAccessibleName("Confirmação da Senha");
    expect(campoDaConfirmacao).toHaveAttribute("autocomplete", "new-password");

    // Os limites também são comunicados por texto, e não só na descrição.
    expect(
      screen.getByText(
        `De ${LIMITE_MINIMO_DE_SENHA} a ${LIMITE_MAXIMO_DE_SENHA} caracteres, qualquer caractere, inclusive espaços.`,
      ),
    ).toBeInTheDocument();
  });

  it("enquanto a Senha é curta, o aviso do mínimo está na descrição do campo (FR-080)", () => {
    renderizarPaginaDeCadastro();

    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "1234567" },
    });

    expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription(
      new RegExp(`deve ter pelo menos ${LIMITE_MINIMO_DE_SENHA} caracteres`),
    );
  });

  it("a confirmação do Cadastro é uma região ativa polida, com nome e estado acessíveis (FR-082, FR-083)", async () => {
    renderizarPaginaDeCadastro();

    preencher(NOME_DE_USUARIO_VALIDO, SENHA_VALIDA);
    submeter();

    const confirmacao = await screen.findByRole("status");

    expect(confirmacao).toHaveAccessibleName("Cadastro concluído");
    expect(confirmacao).toHaveAttribute("aria-live", "polite");
    expect(confirmacao).toHaveAttribute("aria-atomic", "true");
    expect(confirmacao).toHaveTextContent(
      `O Usuário ${NOME_DE_USUARIO_VALIDO} foi criado.`,
    );

    // A confirmação é a única região ativa: nenhum alerta convive com ela.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a recusa de Confirmação divergente é um alerta assertivo nomeado, único na página (FR-082)", () => {
    renderizarPaginaDeCadastro();

    preencher(NOME_DE_USUARIO_VALIDO, SENHA_VALIDA, `${SENHA_VALIDA}x`);
    submeter();

    const alerta = screen.getByRole("alert");

    expect(alerta).toHaveAccessibleName("Falha no Cadastro");
    expect(alerta).toHaveTextContent(MENSAGEM_DE_CONFIRMACAO_DIVERGENTE);

    // O papel `alert` já implica região assertiva e atômica; nenhum
    // `aria-live` explícito redundante, que poderia duplicar o anúncio.
    expect(alerta).not.toHaveAttribute("aria-live");

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("a recusa de domínio é um alerta nomeado, com a mensagem do cliente e sem duplicar anúncios (FR-082, FR-046)", async () => {
    const cliente = new ClienteEmMemoria();

    await cliente.criarUsuario({
      nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
      senha: SENHA_VALIDA,
    });

    renderizarPaginaDeCadastro(cliente);

    preencher("ana.silva", SENHA_VALIDA);
    submeter();

    const alerta = await screen.findByRole("alert");

    expect(alerta).toHaveAccessibleName("Falha no Cadastro");
    expect(alerta).toHaveTextContent(
      "Este nome de usuário já existe. Escolha outro.",
    );
    expect(alerta).not.toHaveAttribute("aria-live");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("a falha de transporte é um alerta nomeado, e o Cadastro não aparece como concluído (FR-044, FR-082)", async () => {
    const cliente = new ClienteEmMemoria();

    renderizarPaginaDeCadastro(cliente);
    cliente.simularIndisponibilidade();

    preencher(NOME_DE_USUARIO_VALIDO, SENHA_VALIDA);
    submeter();

    const alerta = await screen.findByRole("alert");

    expect(alerta).toHaveAccessibleName("Falha no Cadastro");
    expect(alerta).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("cada nova tentativa recusada insere um alerta novo, reanunciável (FR-082)", async () => {
    renderizarPaginaDeCadastro();

    preencher("ab", SENHA_VALIDA);
    submeter();

    const primeiro = await screen.findByRole("alert");

    // A mesma recusa de novo: o alerta anterior sai da árvore e um novo é
    // inserido — é a inserção na região ativa que dispara o anúncio.
    submeter();

    const segundo = await screen.findByRole("alert");

    expect(segundo).not.toBe(primeiro);
    expect(segundo).toHaveAccessibleName("Falha no Cadastro");
    expect(segundo).toHaveTextContent(/pelo menos 3 caracteres/i);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});
