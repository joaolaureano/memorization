import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act } from "react";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { Credencial } from "../src/acervo-cliente/cliente";
import { Aplicacao } from "../src/ui/Aplicacao";
import { ROTA_PADRAO, interpretarRota } from "../src/ui/navegacao";
import {
  CREDENCIAL_DE_PROVA,
  clienteDeProva,
  fabricaDeClienteDeProva,
} from "./apoio-de-prova";

/**
 * Casca de aplicação, guarda de Credencial e navegação por hash (T708 e T709;
 * specs/008-entrar/tasks.md).
 *
 * Sem Credencial, a única tela alcançável é "Entrar" (FR-097, SC-027): nenhuma
 * outra rota resolve em outra tela, e nem a navegação principal nem "Sair"
 * aparecem. Depois de Entrar, a navegação para Cartões e Baralhos e a ação
 * "Sair" aparecem em toda tela alcançável, com `aria-current="page"` no link
 * corrente (FR-094, FR-098); Sair descarta a Credencial e volta a "Entrar", e
 * nenhum caminho do navegador — nem o voltar — traz conteúdo do acervo de volta
 * (SC-034). Cada aba mantém a própria Credencial: Sair numa não afeta a outra
 * (FR-089).
 *
 * A casca não recebe Credencial pronta — por desenho, ela nasce sem nenhuma —,
 * então toda prova de tela autenticada passa pela tela "Entrar".
 */

beforeEach(() => {
  window.location.hash = "#/cartoes";
});

/** Muda o hash e entrega o `hashchange` que o navegador dispararia. */
function navegarPara(hash: string): void {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new Event("hashchange"));
  });
}

/**
 * Entra pela tela "Entrar" de uma aba. As consultas vão ao DOM da aba, e não ao
 * documento: duas abas no mesmo documento do jsdom repetiriam os ids dos
 * campos — no navegador cada aba é um documento à parte, e é o id que associa
 * rótulo e campo —, e a consulta por rótulo alcançaria o campo da outra aba.
 */
function entrarNaAba(aba: HTMLElement): void {
  const nomeDeUsuario = aba.querySelector<HTMLInputElement>(
    "input[type='text']",
  );
  const senha = aba.querySelector<HTMLInputElement>(
    "input[type='password']",
  );
  const botao = aba.querySelector<HTMLButtonElement>("button[type='submit']");

  if (nomeDeUsuario === null || senha === null || botao === null) {
    throw new Error("a tela Entrar da aba não está montada");
  }

  fireEvent.change(nomeDeUsuario, {
    target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
  });
  fireEvent.change(senha, { target: { value: CREDENCIAL_DE_PROVA.senha } });
  fireEvent.click(botao);
}

/** Entra pela tela "Entrar" da aplicação já renderizada. */
function entrarPelaTela(credencial: Credencial = CREDENCIAL_DE_PROVA): void {
  fireEvent.change(screen.getByLabelText("Nome de usuário"), {
    target: { value: credencial.nomeDeUsuario },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: credencial.senha },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("interpretarRota sob a guarda de Credencial", () => {
  it("sem Credencial, toda rota resolve em Entrar, exceto Criar conta (FR-097, SC-027)", () => {
    for (const hash of [
      "",
      "#/",
      "#/entrar",
      "#/cartoes",
      "#/baralhos",
      "#/baralhos/b1",
      "#/baralhos/b1/estudo",
      "#/inexistente",
    ]) {
      expect(interpretarRota(hash, false)).toEqual({ nome: "entrar" });
    }

    // O Cadastro é o caminho de quem ainda não tem Credencial alguma: é a
    // única outra tela alcançável sem ela.
    expect(interpretarRota("#/criar-conta", false)).toEqual({ nome: "cadastro" });
    expect(interpretarRota("#/criar-conta/", false)).toEqual({
      nome: "cadastro",
    });
  });

  it("com Credencial, Entrar resolve em Cartões e as demais rotas seguem as publicadas (FR-098)", () => {
    expect(interpretarRota("#/entrar", true)).toEqual({ nome: "cartoes" });
    expect(interpretarRota("", true)).toEqual({ nome: "cartoes" });
    expect(interpretarRota("#/inexistente", true)).toEqual({ nome: "cartoes" });
    expect(interpretarRota("#/cartoes/", true)).toEqual({ nome: "cartoes" });
    expect(interpretarRota("#/baralhos", true)).toEqual({ nome: "baralhos" });
    expect(interpretarRota("#/baralhos/", true)).toEqual({ nome: "baralhos" });
    expect(interpretarRota("#/baralhos/b1", true)).toEqual({
      nome: "baralho",
      id: "b1",
    });
    expect(interpretarRota("#/baralhos/b1/", true)).toEqual({
      nome: "baralho",
      id: "b1",
    });
    expect(interpretarRota("#/baralhos/b1/estudo", true)).toEqual({
      nome: "estudo",
      id: "b1",
    });
    expect(interpretarRota("#/baralhos/b1/estudo/", true)).toEqual({
      nome: "estudo",
      id: "b1",
    });
    expect(interpretarRota("#/baralhos/b1/estudo/extra", true)).toEqual({
      nome: "cartoes",
    });
    expect(interpretarRota("#/criar-conta", true)).toEqual({ nome: "cadastro" });
  });

  it("mantém Cartões como rota padrão publicada", () => {
    expect(ROTA_PADRAO).toBe("#/cartoes");
  });
});

describe("Aplicacao sem Credencial", () => {
  it("apresenta Entrar como primeira e única tela, com o acesso a Criar conta (FR-097, SC-027)", async () => {
    render(<Aplicacao criarCliente={fabricaDeClienteDeProva()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome de usuário")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute(
      "href",
      "#/criar-conta",
    );

    // Nem a navegação principal, nem "Sair", nem qualquer conteúdo do acervo
    // são oferecidos sem Credencial (FR-098).
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Cartões" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Baralhos" })).toBeNull();
    expect(screen.queryByText(/ainda não há Cartões/i)).toBeNull();
  });

  it("nenhuma outra rota é alcançável: todas continuam em Entrar (FR-097)", () => {
    render(<Aplicacao criarCliente={fabricaDeClienteDeProva()} />);

    for (const hash of [
      "#/cartoes",
      "#/baralhos",
      "#/baralhos/b1",
      "#/baralhos/b1/estudo",
    ]) {
      navegarPara(hash);

      expect(
        screen.getByRole("heading", { level: 1, name: "Entrar" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("navigation")).toBeNull();
    }
  });

  it("o Cadastro continua alcançável e oferece a volta a Entrar (FR-097)", () => {
    render(<Aplicacao criarCliente={fabricaDeClienteDeProva()} />);

    navegarPara("#/criar-conta");

    expect(
      screen.getByRole("heading", { level: 1, name: "Criar conta" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "#/entrar",
    );
  });
});

describe("Aplicacao depois de Entrar", () => {
  it("oferece Cartões, Baralhos e Sair em toda tela alcançável, sem Criar conta na navegação (FR-094, FR-098)", async () => {
    const servidor = clienteDeProva();

    await servidor.criarCartao({ frente: "To walk", verso: "Caminhar" });
    await servidor.criarBaralho({ nome: "Inglês" });

    render(
      <Aplicacao
        criarCliente={(credencial) => servidor.comoUsuario(credencial)}
      />,
    );

    entrarPelaTela();

    const navegacao = await screen.findByRole("navigation", {
      name: "Principal",
    });
    const linkDeCartoes = within(navegacao).getByRole("link", {
      name: "Cartões",
    });
    const linkDeBaralhos = within(navegacao).getByRole("link", {
      name: "Baralhos",
    });

    expect(linkDeCartoes).toHaveAttribute("href", "#/cartoes");
    expect(linkDeBaralhos).toHaveAttribute("href", "#/baralhos");
    expect(linkDeCartoes).toHaveAttribute("aria-current", "page");
    expect(linkDeBaralhos).not.toHaveAttribute("aria-current");
    expect(within(navegacao).getByRole("button", { name: "Sair" })).toBeEnabled();

    // FR-098: o link "Criar conta" deixou a navegação principal e passou a ser
    // oferecido pela tela "Entrar".
    expect(
      within(navegacao).queryByRole("link", { name: "Criar conta" }),
    ).toBeNull();

    // O acervo do Usuário que Entrou aparece.
    expect(await screen.findByText("To walk")).toBeInTheDocument();

    // E a navegação e "Sair" seguem presentes nas demais telas alcançáveis.
    for (const hash of ["#/baralhos", "#/baralhos/b1", "#/baralhos/b1/estudo"]) {
      navegarPara(hash);

      expect(
        within(screen.getByRole("navigation", { name: "Principal" })).getByRole(
          "button",
          { name: "Sair" },
        ),
      ).toBeInTheDocument();
    }
  });

  it("marca o link corrente da rota e move o foco para o título da tela de destino", async () => {
    render(<Aplicacao criarCliente={fabricaDeClienteDeProva()} />);

    entrarPelaTela();

    await screen.findByRole("navigation", { name: "Principal" });
    navegarPara("#/baralhos");

    const titulo = await screen.findByRole("heading", {
      level: 1,
      name: "Baralhos",
    });

    expect(titulo).toBeInTheDocument();
    expect(document.activeElement).toBe(titulo);
    expect(titulo).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("link", { name: "Baralhos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Cartões" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("Sair descarta a Credencial, volta a Entrar e anuncia a conclusão (FR-094, FR-096, SC-034)", async () => {
    const servidor = clienteDeProva();

    await servidor.criarCartao({ frente: "To walk", verso: "Caminhar" });

    render(
      <Aplicacao
        criarCliente={(credencial) => servidor.comoUsuario(credencial)}
      />,
    );

    entrarPelaTela();
    await screen.findByText("To walk");

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    // A Credencial foi descartada: a tela "Entrar" volta, com a conclusão
    // anunciada por região ativa, e nada do acervo é exibido.
    expect(
      screen.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();

    const conclusao = screen.getByRole("status", { name: "Saída concluída" });

    expect(conclusao).toHaveAttribute("aria-live", "polite");
    expect(conclusao).toHaveAttribute("aria-atomic", "true");
    expect(conclusao).toHaveTextContent(/você saiu/i);
    expect(conclusao).toHaveTextContent(/credencial/i);

    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
    expect(screen.queryByText("To walk")).toBeNull();
    expect(window.location.hash).toBe("#/entrar");

    // O voltar do navegador reencontra o hash anterior — e nem por ele o acervo
    // reaparece, porque a Credencial não sobreviveu em lugar nenhum (SC-034).
    navegarPara("#/cartoes");

    expect(
      screen.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("To walk")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("voltar a Entrar com a mesma Credencial devolve o acervo como estava (FR-094)", async () => {
    const servidor = clienteDeProva();

    await servidor.criarCartao({ frente: "To walk", verso: "Caminhar" });

    render(
      <Aplicacao
        criarCliente={(credencial) => servidor.comoUsuario(credencial)}
      />,
    );

    entrarPelaTela();
    await screen.findByText("To walk");

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    entrarPelaTela();

    expect(await screen.findByText("To walk")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Principal" }),
    ).toBeInTheDocument();
  });

  it("recarregar a página exige Entrar de novo (FR-089, SC-031)", async () => {
    const criarCliente = fabricaDeClienteDeProva();
    const primeira = render(<Aplicacao criarCliente={criarCliente} />);

    entrarPelaTela();
    await screen.findByRole("navigation", { name: "Principal" });

    // Recarregar descarta a página anterior — e, com ela, a Credencial que só
    // existia na memória dela (FR-089).
    primeira.unmount();

    render(<Aplicacao criarCliente={criarCliente} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("duas abas mantêm Credenciais independentes: Sair numa não afeta a outra (FR-089)", async () => {
    const criarCliente = fabricaDeClienteDeProva();
    const outra = render(<Aplicacao criarCliente={criarCliente} />);
    const primeira = render(<Aplicacao criarCliente={criarCliente} />);

    // Cada aba Entra separadamente, na sua própria tela "Entrar".
    for (const aba of [primeira, outra]) {
      entrarNaAba(aba.container);

      expect(
        await within(aba.container).findByRole("navigation", {
          name: "Principal",
        }),
      ).toBeInTheDocument();
    }

    fireEvent.click(
      within(primeira.container).getByRole("button", { name: "Sair" }),
    );

    expect(
      within(primeira.container).getByRole("heading", {
        level: 1,
        name: "Entrar",
      }),
    ).toBeInTheDocument();

    // A outra aba continua com a sua Credencial e com a sua navegação.
    expect(
      within(outra.container).getByRole("navigation", { name: "Principal" }),
    ).toBeInTheDocument();
    expect(
      within(outra.container).queryByRole("heading", {
        level: 1,
        name: "Entrar",
      }),
    ).toBeNull();
  });

  it("Sair é alcançado e concluído apenas por teclado, com o foco visível (FR-094, FR-095, SC-032)", async () => {
    const criarCliente = fabricaDeClienteDeProva();

    render(<Aplicacao criarCliente={criarCliente} />);

    // Percurso de teclado na tela "Entrar": Nome de usuário → Senha → Entrar.
    const campoDoNome = screen.getByLabelText("Nome de usuário");
    const campoDaSenha = screen.getByLabelText("Senha");
    const botaoDeEntrada = screen.getByRole("button", { name: "Entrar" });

    campoDoNome.focus();
    fireEvent.change(campoDoNome, {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });

    campoDaSenha.focus();
    fireEvent.change(campoDaSenha, {
      target: { value: CREDENCIAL_DE_PROVA.senha },
    });

    botaoDeEntrada.focus();
    expect(document.activeElement).toBe(botaoDeEntrada);
    fireEvent.click(botaoDeEntrada);

    const navegacao = await screen.findByRole("navigation", {
      name: "Principal",
    });
    const botaoDeSaida = within(navegacao).getByRole("button", {
      name: "Sair",
    });

    // O destino "Sair" é alcançável sem mouse, e o foco é identificável sem
    // depender de cor: o indicador é um contorno geométrico declarado no CSS.
    botaoDeSaida.focus();
    expect(document.activeElement).toBe(botaoDeSaida);

    fireEvent.click(botaoDeSaida);

    expect(
      screen.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Saída concluída" }),
    ).toBeInTheDocument();

    // O indicador de foco alcança também "Sair": é um contorno geométrico —
    // espessura, estilo e afastamento —, e não apenas uma cor (FR-095).
    const estilos = readFileSync(
      join(process.cwd(), "src", "estilos.css"),
      "utf8",
    );
    const regraDeFoco = estilos.match(/:focus-visible\s*\{([^}]*)\}/);

    expect(regraDeFoco).not.toBeNull();
    expect(regraDeFoco?.[1]).toMatch(/outline:\s*3px\s+solid/);
    expect(regraDeFoco?.[1]).toMatch(/outline-offset:\s*2px/);
  });
});
