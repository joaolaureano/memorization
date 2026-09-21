import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
} from "../src/acervo-cliente/cliente";
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
 * T608 a T610 — a tela "Criar conta" (specs/007-criar-usuario/tasks.md).
 *
 * A tela é exercitada com o `ClienteEmMemoria`, o Adapter de teste da Seam
 * `ClienteDoAcervo`, sem servidor. As asserções cobrem os três campos com os
 * limites comunicados (FR-071, FR-080), a confirmação explícita do Cadastro
 * (FR-083), a recusa de Confirmação divergente **sem envio** com o foco movido
 * para a Confirmação (FR-072, FR-081), a recusa de domínio com a mensagem do
 * próprio cliente (FR-046) e a falha de gravação que reporta sem concluir e
 * preserva o conteúdo digitado (FR-044, FR-045, SC-012). As mensagens exibidas
 * são sempre as devolvidas pela Interface, nunca texto inventado pela tela.
 *
 * T708 (specs/008-entrar/tasks.md): a tela oferece a volta a "Entrar" — o
 * caminho de quem já tem Usuário — e, concluído o Cadastro, oferece Entrar em
 * seguida (FR-097). Depois de `008-entrar`, o Cadastro continua alcançável sem
 * Credencial nenhuma, e é por isso que estas provas seguem sem ela.
 */

const NOME_DE_USUARIO_VALIDO = "Ana.Silva";
const SENHA_VALIDA = "senha-de-prova";

/** Os três rótulos canônicos dos campos desta tela (CONTEXT.md, FR-046). */
const ROTULO_DO_NOME = "Nome de usuário";
const ROTULO_DA_SENHA = "Senha";
const ROTULO_DA_CONFIRMACAO = "Confirmação da Senha";

function renderizarPaginaDeCadastro(
  cliente: ClienteEmMemoria = new ClienteEmMemoria(),
): ClienteEmMemoria {
  render(<PaginaDeCadastro cliente={cliente} />);

  return cliente;
}

/** Preenche os três campos pelos rótulos acessíveis. */
function preencher(
  nomeDeUsuario: string,
  senha: string,
  confirmacaoDaSenha: string,
): void {
  fireEvent.change(screen.getByLabelText(ROTULO_DO_NOME), {
    target: { value: nomeDeUsuario },
  });
  fireEvent.change(screen.getByLabelText(ROTULO_DA_SENHA), {
    target: { value: senha },
  });
  fireEvent.change(screen.getByLabelText(ROTULO_DA_CONFIRMACAO), {
    target: { value: confirmacaoDaSenha },
  });
}

/** Submete o Cadastro pelo botão acessível. */
function submeter(): void {
  fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
}

describe("PaginaDeCadastro", () => {
  it("oferece a volta a Entrar e, concluído o Cadastro, oferece Entrar em seguida (FR-097)", async () => {
    renderizarPaginaDeCadastro();

    // A volta a "Entrar" é o caminho de quem já tem Usuário.
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "#/entrar",
    );

    preencher(NOME_DE_USUARIO_VALIDO, SENHA_VALIDA, SENHA_VALIDA);
    submeter();

    expect(await screen.findByRole("status")).toHaveTextContent(
      `O Usuário ${NOME_DE_USUARIO_VALIDO} foi criado.`,
    );

    // E o próximo passo de quem acabou de criar o Usuário é Entrar: a oferta
    // continua ali, uma só, agora como sequência da conclusão.
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "#/entrar",
    );
    expect(screen.getAllByRole("link", { name: "Entrar" })).toHaveLength(1);
  });

  it("usa os termos canônicos em português e nenhum sinônimo proibido (FR-046)", () => {
    renderizarPaginaDeCadastro();

    const texto = document.body.textContent ?? "";

    // Os termos canônicos de CONTEXT.md, e a ação rotulada "Criar conta".
    expect(texto).toContain("Nome de usuário");
    expect(texto).toContain("Senha");
    expect(texto).toContain("Confirmação da Senha");
    expect(texto).toContain("Criar conta");

    // Nenhum sinônimo listado como `_Avoid_` para as entidades desta tela:
    // `user`, `account`, `cliente`, `perfil`, `login`, `username`, `nick`,
    // `apelido`, `identificação`, `password`.
    const emMinusculas = texto.toLowerCase();

    for (const sinonimo of [
      "user",
      "account",
      "cliente",
      "perfil",
      "login",
      "username",
      "nick",
      "apelido",
      "identificação",
      "password",
    ]) {
      expect(emMinusculas).not.toContain(sinonimo);
    }
  });

  it("exibe os três campos e comunica os limites de cada um (FR-071, FR-080)", () => {
    renderizarPaginaDeCadastro();

    expect(
      screen.getByRole("heading", { level: 1, name: "Criar conta" }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText(ROTULO_DO_NOME)).toBeInTheDocument();
    expect(screen.getByLabelText(ROTULO_DA_SENHA)).toBeInTheDocument();
    expect(screen.getByLabelText(ROTULO_DA_CONFIRMACAO)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar conta" }),
    ).toBeInTheDocument();

    // Os dois campos de Senha são de Senha: nada do que é digitado neles
    // aparece na tela (FR-078).
    expect(screen.getByLabelText(ROTULO_DA_SENHA)).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText(ROTULO_DA_CONFIRMACAO)).toHaveAttribute(
      "type",
      "password",
    );

    // Os limites são comunicados: o intervalo de cada campo e a contagem
    // corrente, desde o primeiro instante (FR-080).
    expect(
      screen.getByText(
        `De ${LIMITE_MINIMO_DE_NOME_DE_USUARIO} a ${LIMITE_MAXIMO_DE_NOME_DE_USUARIO} caracteres: letras de A a Z sem acento, dígitos, ponto, sublinhado e hífen.`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`0 / ${LIMITE_MAXIMO_DE_NOME_DE_USUARIO} caracteres`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `De ${LIMITE_MINIMO_DE_SENHA} a ${LIMITE_MAXIMO_DE_SENHA} caracteres, qualquer caractere, inclusive espaços.`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`0 / ${LIMITE_MAXIMO_DE_SENHA} caracteres`),
    ).toBeInTheDocument();
  });

  it("com 8 caracteres, a Senha e a Confirmação ainda não divergem (FR-072)", () => {
    renderizarPaginaDeCadastro();

    preencher(NOME_DE_USUARIO_VALIDO, "12345678", "12345678");

    expect(
      screen.queryByText(MENSAGEM_DE_CONFIRMACAO_DIVERGENTE),
    ).not.toBeInTheDocument();
  });

  it("confirma o Cadastro de forma explícita e mostra o Usuário criado (FR-083)", async () => {
    renderizarPaginaDeCadastro();

    preencher(NOME_DE_USUARIO_VALIDO, SENHA_VALIDA, SENHA_VALIDA);
    submeter();

    const confirmacao = await screen.findByRole("status");

    expect(confirmacao).toHaveAccessibleName("Cadastro concluído");
    expect(confirmacao).toHaveTextContent(
      `O Usuário ${NOME_DE_USUARIO_VALIDO} foi criado.`,
    );

    // FR-078: depois do sucesso, os valores de Senha saem do estado do
    // componente; o Nome de usuário permanece, porque a confirmação o nomeia.
    expect(screen.getByLabelText(ROTULO_DA_SENHA)).toHaveValue("");
    expect(screen.getByLabelText(ROTULO_DA_CONFIRMACAO)).toHaveValue("");
    expect(screen.getByLabelText(ROTULO_DO_NOME)).toHaveValue(
      NOME_DE_USUARIO_VALIDO,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("não grava nada no navegador depois do Cadastro (FR-078, FR-079)", async () => {
    renderizarPaginaDeCadastro();

    preencher(NOME_DE_USUARIO_VALIDO, SENHA_VALIDA, SENHA_VALIDA);
    submeter();

    await screen.findByRole("status");

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("recusa a Confirmação divergente sem enviar nada e move o foco para a Confirmação (FR-072, FR-081)", () => {
    const cliente = renderizarPaginaDeCadastro();
    const criacaoDeUsuario = vi.spyOn(cliente, "criarUsuario");

    preencher(NOME_DE_USUARIO_VALIDO, "12345678", "123456789");
    submeter();

    // Nada partiu para o cliente: FR-072 é verificado antes do envio.
    expect(criacaoDeUsuario).not.toHaveBeenCalled();

    const campoDaConfirmacao = screen.getByLabelText(ROTULO_DA_CONFIRMACAO);

    expect(screen.getByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_CONFIRMACAO_DIVERGENTE,
    );
    expect(document.activeElement).toBe(campoDaConfirmacao);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    // O conteúdo digitado permanece, pronto para a correção.
    expect(screen.getByLabelText(ROTULO_DO_NOME)).toHaveValue(
      NOME_DE_USUARIO_VALIDO,
    );
    expect(screen.getByLabelText(ROTULO_DA_SENHA)).toHaveValue("12345678");
    expect(campoDaConfirmacao).toHaveValue("123456789");
  });

  it("comunica os limites do Nome de usuário durante a digitação (FR-080)", () => {
    renderizarPaginaDeCadastro();

    const campoDoNome = screen.getByLabelText(ROTULO_DO_NOME);

    fireEvent.change(campoDoNome, { target: { value: "an" } });
    expect(
      screen.getByText(
        `Atenção: o nome de usuário deve ter pelo menos ${LIMITE_MINIMO_DE_NOME_DE_USUARIO} caracteres; o informado tem 2.`,
      ),
    ).toBeInTheDocument();

    // Perto do limite máximo, antes de concluir qualquer coisa.
    fireEvent.change(campoDoNome, { target: { value: "a".repeat(45) } });
    expect(
      screen.getByText(
        `Atenção: faltam 5 caracteres para o limite de ${LIMITE_MAXIMO_DE_NOME_DE_USUARIO}.`,
      ),
    ).toBeInTheDocument();

    fireEvent.change(campoDoNome, {
      target: { value: "a".repeat(LIMITE_MAXIMO_DE_NOME_DE_USUARIO) },
    });
    expect(
      screen.getByText(
        `Atenção: o nome de usuário atingiu o limite de ${LIMITE_MAXIMO_DE_NOME_DE_USUARIO} caracteres.`,
      ),
    ).toBeInTheDocument();

    fireEvent.change(campoDoNome, {
      target: { value: "a".repeat(LIMITE_MAXIMO_DE_NOME_DE_USUARIO + 1) },
    });
    expect(
      screen.getByText(
        `Atenção: o nome de usuário excede o limite de ${LIMITE_MAXIMO_DE_NOME_DE_USUARIO} caracteres.`,
      ),
    ).toBeInTheDocument();

    // A contagem acompanha cada caractere digitado.
    expect(
      screen.getByText(
        `${LIMITE_MAXIMO_DE_NOME_DE_USUARIO + 1} / ${LIMITE_MAXIMO_DE_NOME_DE_USUARIO} caracteres`,
      ),
    ).toBeInTheDocument();
  });

  it("comunica os limites da Senha durante a digitação (FR-080, FR-075)", () => {
    renderizarPaginaDeCadastro();

    const campoDaSenha = screen.getByLabelText(ROTULO_DA_SENHA);

    fireEvent.change(campoDaSenha, { target: { value: "1234567" } });
    expect(
      screen.getByText(
        `Atenção: a Senha deve ter pelo menos ${LIMITE_MINIMO_DE_SENHA} caracteres; a informada tem 7.`,
      ),
    ).toBeInTheDocument();

    fireEvent.change(campoDaSenha, { target: { value: "s".repeat(120) } });
    expect(
      screen.getByText(
        `Atenção: faltam 8 caracteres para o limite da Senha de ${LIMITE_MAXIMO_DE_SENHA}.`,
      ),
    ).toBeInTheDocument();

    fireEvent.change(campoDaSenha, {
      target: { value: "s".repeat(LIMITE_MAXIMO_DE_SENHA) },
    });
    expect(
      screen.getByText(
        `Atenção: a Senha atingiu o limite de ${LIMITE_MAXIMO_DE_SENHA} caracteres.`,
      ),
    ).toBeInTheDocument();

    fireEvent.change(campoDaSenha, {
      target: { value: "s".repeat(LIMITE_MAXIMO_DE_SENHA + 1) },
    });
    expect(
      screen.getByText(
        `Atenção: a Senha excede o limite de ${LIMITE_MAXIMO_DE_SENHA} caracteres.`,
      ),
    ).toBeInTheDocument();
  });

  it("exibe a recusa de domínio do cliente e move o foco ao campo a corrigir (FR-046, FR-081)", async () => {
    renderizarPaginaDeCadastro();

    preencher("ab", SENHA_VALIDA, SENHA_VALIDA);
    submeter();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      `O nome de usuário deve ter pelo menos ${LIMITE_MINIMO_DE_NOME_DE_USUARIO} caracteres; o informado tem 2.`,
    );
    expect(document.activeElement).toBe(
      screen.getByLabelText(ROTULO_DO_NOME),
    );
  });

  it("exibe a recusa de Senha do cliente e move o foco para a Senha (FR-046, FR-075, FR-081)", async () => {
    renderizarPaginaDeCadastro();

    preencher(NOME_DE_USUARIO_VALIDO, "1234567", "1234567");
    submeter();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      `A senha deve ter entre ${LIMITE_MINIMO_DE_SENHA} e ${LIMITE_MAXIMO_DE_SENHA} caracteres; a informada tem 7.`,
    );
    expect(document.activeElement).toBe(
      screen.getByLabelText(ROTULO_DA_SENHA),
    );
  });

  it("recusa Nome de usuário já cadastrado com a mensagem do cliente e foca o Nome (FR-074, SC-025)", async () => {
    const cliente = new ClienteEmMemoria();

    await cliente.criarUsuario({
      nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
      senha: SENHA_VALIDA,
    });

    renderizarPaginaDeCadastro(cliente);

    preencher("ana.silva", SENHA_VALIDA, SENHA_VALIDA);
    submeter();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este nome de usuário já existe. Escolha outro.",
    );
    expect(document.activeElement).toBe(
      screen.getByLabelText(ROTULO_DO_NOME),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("com o transporte indisponível, reporta a falha, não conclui e preserva os três campos (FR-044, FR-045, SC-012)", async () => {
    const cliente = renderizarPaginaDeCadastro();

    cliente.simularIndisponibilidade();

    preencher(NOME_DE_USUARIO_VALIDO, SENHA_VALIDA, SENHA_VALIDA);
    submeter();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
    );

    // Nenhuma operação aparece como concluída...
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    // ...e nenhum conteúdo informado foi perdido.
    expect(screen.getByLabelText(ROTULO_DO_NOME)).toHaveValue(
      NOME_DE_USUARIO_VALIDO,
    );
    expect(screen.getByLabelText(ROTULO_DA_SENHA)).toHaveValue(SENHA_VALIDA);
    expect(screen.getByLabelText(ROTULO_DA_CONFIRMACAO)).toHaveValue(
      SENHA_VALIDA,
    );
    expect(
      screen.getByRole("button", { name: "Criar conta" }),
    ).toBeEnabled();
  });

  it("a nova tentativa reaproveita o conteúdo preservado e só então conclui o Cadastro (FR-045, SC-012)", async () => {
    const cliente = renderizarPaginaDeCadastro();

    cliente.simularIndisponibilidade();

    preencher(NOME_DE_USUARIO_VALIDO, SENHA_VALIDA, SENHA_VALIDA);
    submeter();
    await screen.findByRole("alert");

    cliente.restaurarDisponibilidade();
    submeter();

    const confirmacao = await screen.findByRole("status");

    expect(confirmacao).toHaveTextContent(
      `O Usuário ${NOME_DE_USUARIO_VALIDO} foi criado.`,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText(ROTULO_DA_SENHA)).toHaveValue("");
  });
});
