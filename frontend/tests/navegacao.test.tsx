import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act } from "react";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { Credencial } from "../src/acervo-cliente/cliente";
import { Aplicacao } from "../src/ui/Aplicacao";
import {
  ROTA_PADRAO,
  destinoAtivo,
  hashDaRota,
  interpretarRota,
} from "../src/ui/navegacao";
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
 * aparecem. Depois de Entrar, a navegação para Início, Baralhos e Cartões e a
 * ação "Sair" aparecem em toda tela alcançável, com `aria-current="page"` no
 * link corrente (FR-094, FR-098, FR-168); Sair descarta a Credencial e volta a
 * "Entrar", e nenhum caminho do navegador — nem o voltar — traz conteúdo do
 * acervo de volta (SC-034). Cada aba mantém a própria Credencial: Sair numa não
 * afeta a outra (FR-089).
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
      "#/inicio",
      "#/sessoes/s1",
      "#/cartoes",
      "#/baralhos",
      "#/baralhos/b1",
      "#/baralhos/b1/estudo",
      "#/revisao",
      "#/preferencias",
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

  it("com Credencial, Entrar resolve em Início e as demais rotas seguem as publicadas (FR-098, FR-168)", () => {
    // `#/entrar` é o destino de quem acabou de Entrar: Início, a rota padrão
    // (FR-168) — a tela "Entrar" não tem o que oferecer a quem já entrou.
    expect(interpretarRota("#/entrar", true)).toEqual({ nome: "inicio" });
    expect(interpretarRota("", true)).toEqual({ nome: "inicio" });
    expect(interpretarRota("#/inexistente", true)).toEqual({ nome: "inicio" });
    expect(interpretarRota("#/inicio", true)).toEqual({ nome: "inicio" });
    expect(interpretarRota("#/inicio/", true)).toEqual({ nome: "inicio" });
    expect(interpretarRota("#/sessoes/s1", true)).toEqual({
      nome: "registro",
      id: "s1",
    });
    expect(interpretarRota("#/cartoes/", true)).toEqual({ nome: "cartoes" });
    expect(interpretarRota("#/revisao", true)).toEqual({ nome: "revisao" });
    expect(interpretarRota("#/revisao/", true)).toEqual({ nome: "revisao" });
    expect(interpretarRota("#/preferencias", true)).toEqual({
      nome: "preferencias",
    });
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
      nome: "inicio",
    });
    expect(interpretarRota("#/sessoes/s1/extra", true)).toEqual({
      nome: "inicio",
    });
    expect(interpretarRota("#/criar-conta", true)).toEqual({ nome: "cadastro" });
  });

  it("mantém o Início como rota padrão publicada (FR-168)", () => {
    expect(ROTA_PADRAO).toBe("#/inicio");
  });
});

describe("interpretarRota e hashDaRota para as rotas do contrato", () => {
  it("reconhece as rotas de criação e edição dos dois acervos", () => {
    expect(interpretarRota("#/baralhos/novo", true)).toEqual({
      nome: "novo-baralho",
    });
    expect(interpretarRota("#/baralhos/7/editar", true)).toEqual({
      nome: "editar-baralho",
      id: "7",
    });
    expect(interpretarRota("#/baralhos/7/adicionar", true)).toEqual({
      nome: "adicionar-cartoes",
      id: "7",
    });
    expect(interpretarRota("#/cartoes/novo", true)).toEqual({
      nome: "novo-cartao",
    });
    expect(interpretarRota("#/cartoes/7/editar", true)).toEqual({
      nome: "editar-cartao",
      id: "7",
    });
  });

  it("reconhece as rotas da Revisão do dia e das Preferências (FR-212)", () => {
    expect(interpretarRota("#/revisao", true)).toEqual({ nome: "revisao" });
    expect(interpretarRota("#/revisao/", true)).toEqual({ nome: "revisao" });
    expect(interpretarRota("#/preferencias", true)).toEqual({
      nome: "preferencias",
    });
    expect(interpretarRota("#/preferencias/", true)).toEqual({
      nome: "preferencias",
    });

    expect(hashDaRota({ nome: "revisao" })).toBe("#/revisao");
    expect(hashDaRota({ nome: "preferencias" })).toBe("#/preferencias");
  });

  it("`novo` é palavra reservada: nunca é tratado como o id de um Baralho", () => {
    const rota = interpretarRota("#/baralhos/novo", true);

    expect(rota).toEqual({ nome: "novo-baralho" });
    expect(rota.nome).not.toBe("baralho");
  });

  it("um caminho sem rota publicada resolve na rota padrão, Início (FR-168)", () => {
    // `#/cartoes/<id>` não é publicado: só a edição de um Cartão tem hash.
    expect(interpretarRota("#/cartoes/7", true)).toEqual({ nome: "inicio" });
    expect(interpretarRota("#/baralhos/b1/estudo/extra", true)).toEqual({
      nome: "inicio",
    });
  });

  it("um escape malformado resolve na rota padrão, sem derrubar a interpretação", () => {
    expect(interpretarRota("#/baralhos/%E0%A4%A", true)).toEqual({
      nome: "inicio",
    });
  });

  it("os ids voltam de hashDaRota como entraram, inclusive com espaço e barra", () => {
    for (const id of ["7", "a b", "a/b", "café"]) {
      expect(interpretarRota(hashDaRota({ nome: "baralho", id }), true)).toEqual(
        { nome: "baralho", id },
      );
      expect(
        interpretarRota(hashDaRota({ nome: "editar-baralho", id }), true),
      ).toEqual({ nome: "editar-baralho", id });
      expect(
        interpretarRota(hashDaRota({ nome: "adicionar-cartoes", id }), true),
      ).toEqual({ nome: "adicionar-cartoes", id });
      expect(interpretarRota(hashDaRota({ nome: "estudo", id }), true)).toEqual({
        nome: "estudo",
        id,
      });
      expect(
        interpretarRota(hashDaRota({ nome: "editar-cartao", id }), true),
      ).toEqual({ nome: "editar-cartao", id });
      expect(
        interpretarRota(hashDaRota({ nome: "registro", id }), true),
      ).toEqual({ nome: "registro", id });
    }
  });
});

describe("destinoAtivo", () => {
  it("aponta o destino da moldura de cada rota publicada (FR-139, FR-168)", () => {
    expect(destinoAtivo({ nome: "inicio" })).toBe("inicio");
    expect(destinoAtivo({ nome: "registro", id: "s1" })).toBe("inicio");
    expect(destinoAtivo({ nome: "revisao" })).toBe("inicio");

    expect(destinoAtivo({ nome: "cartoes" })).toBe("cartoes");
    expect(destinoAtivo({ nome: "novo-cartao" })).toBe("cartoes");
    expect(destinoAtivo({ nome: "editar-cartao", id: "7" })).toBe("cartoes");

    expect(destinoAtivo({ nome: "baralhos" })).toBe("baralhos");
    expect(destinoAtivo({ nome: "novo-baralho" })).toBe("baralhos");
    expect(destinoAtivo({ nome: "baralho", id: "7" })).toBe("baralhos");
    expect(destinoAtivo({ nome: "editar-baralho", id: "7" })).toBe("baralhos");
    expect(destinoAtivo({ nome: "adicionar-cartoes", id: "7" })).toBe(
      "baralhos",
    );
    expect(destinoAtivo({ nome: "estudo", id: "7" })).toBe("baralhos");

    expect(destinoAtivo({ nome: "preferencias" })).toBe("preferencias");

    // Entrar e Criar conta não têm moldura de navegação (FR-098).
    expect(destinoAtivo({ nome: "entrar" })).toBeNull();
    expect(destinoAtivo({ nome: "cadastro" })).toBeNull();
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
  it("oferece Início, Baralhos, Cartões, Preferências e Sair em toda tela alcançável, sem Criar conta na navegação (FR-094, FR-098, FR-168, FR-212)", async () => {
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
    const linkDePreferencias = within(navegacao).getByRole("link", {
      name: "Preferências",
    });

    expect(linkDeCartoes).toHaveAttribute("href", "#/cartoes");
    expect(linkDeBaralhos).toHaveAttribute("href", "#/baralhos");
    expect(linkDePreferencias).toHaveAttribute("href", "#/preferencias");
    expect(linkDeCartoes).toHaveAttribute("aria-current", "page");
    expect(linkDeBaralhos).not.toHaveAttribute("aria-current");

    // FR-139, FR-168 e FR-212: a navegação lista Início, Baralhos, Cartões e
    // Preferências, nessa ordem.
    expect(
      within(navegacao)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Início", "Baralhos", "Cartões", "Preferências"]);

    // FR-139: "Sair" vive na moldura, fora da navegação "Principal".
    expect(screen.getByRole("button", { name: "Sair" })).toBeEnabled();

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
        screen.getByRole("navigation", { name: "Principal" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
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

  it("voltar a Entrar com a mesma Credencial devolve o acervo como estava (FR-094, FR-168)", async () => {
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

    // Com a Credencial de volta, `#/entrar` resolve na rota padrão, Início
    // (FR-168): é o destino de quem acabou de Entrar, e não mais Cartões.
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: `Olá, ${CREDENCIAL_DE_PROVA.nomeDeUsuario}`,
      }),
    ).toBeInTheDocument();

    // O acervo do Usuário continua o mesmo: o Cartão criado antes segue lá,
    // alcançável pelo destino "Cartões" da navegação principal (FR-094).
    const navegacao = screen.getByRole("navigation", { name: "Principal" });

    fireEvent.click(within(navegacao).getByRole("link", { name: "Cartões" }));

    expect(await screen.findByText("To walk")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cartões" })).toHaveAttribute(
      "aria-current",
      "page",
    );
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

    await screen.findByRole("navigation", { name: "Principal" });
    // FR-139: "Sair" está na moldura, fora da navegação "Principal".
    const botaoDeSaida = screen.getByRole("button", { name: "Sair" });

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

  it("depois de Entrar, o destino é Início, com a saudação ao Usuário (FR-168)", async () => {
    // Quem Entra logo depois de ter sido levado a Entrar chega no Início: é
    // `#/entrar` que resolve na rota padrão (FR-168), sem Cartões no caminho.
    window.location.hash = "#/entrar";

    render(<Aplicacao criarCliente={fabricaDeClienteDeProva()} />);

    entrarPelaTela();

    // O Início saúda o Usuário que Entrou: o título traz o seu Nome de usuário.
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: `Olá, ${CREDENCIAL_DE_PROVA.nomeDeUsuario}`,
      }),
    ).toBeInTheDocument();
  });

  it("marca o destino corrente da moldura nas telas de Baralhos e de Cartões (FR-139)", async () => {
    render(<Aplicacao criarCliente={fabricaDeClienteDeProva()} />);

    entrarPelaTela();
    await screen.findByRole("navigation", { name: "Principal" });

    // `#/baralhos/7` é uma tela de Baralhos: o destino corrente é "Baralhos".
    navegarPara("#/baralhos/7");

    expect(screen.getByRole("link", { name: "Baralhos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Cartões" })).not.toHaveAttribute(
      "aria-current",
    );

    // `#/cartoes/novo` é uma tela de Cartões: o destino corrente é "Cartões".
    navegarPara("#/cartoes/novo");

    expect(screen.getByRole("link", { name: "Cartões" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Baralhos" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("com Credencial, #/sessoes/<id> apresenta o Registro da Sessão (FR-166, FR-177)", async () => {
    const servidor = clienteDeProva();
    const baralho = await servidor.criarBaralho({ nome: "Inglês" });

    if (!baralho.ok) {
      throw new Error("a criação do cenário deveria ser aceita");
    }

    const registro = await servidor.registrarSessao({
      id: globalThis.crypto.randomUUID(),
      origem: "baralho",
      baralhoId: baralho.baralho.id,
      nomeDoBaralho: "Inglês",
      itens: [
        {
          frente: "To walk",
          verso: "Caminhar",
          cartaoId: "cartao-1",
          avaliacao: "bom",
        },
      ],
    });

    if (!registro.ok) {
      throw new Error("o registro do cenário deveria ser aceito");
    }

    render(
      <Aplicacao
        criarCliente={(credencial) => servidor.comoUsuario(credencial)}
      />,
    );

    entrarPelaTela();
    await screen.findByRole("navigation", { name: "Principal" });

    navegarPara(`#/sessoes/${registro.registro.id}`);

    // O Registro é alcançado pelo id da Sessão, e traz o nome do Baralho como
    // era no momento da conclusão (FR-166, FR-177).
    expect(
      await screen.findByRole("heading", { level: 1, name: "Sessão concluída" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Inglês")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver baralho" })).toHaveAttribute(
      "href",
      `#/baralhos/${baralho.baralho.id}`,
    );
  });
});

describe("Aplicacao nas telas de formulário da 012", () => {
  it("com Credencial, #/cartoes/novo apresenta a tela de criação de Cartão (FR-140)", async () => {
    render(<Aplicacao criarCliente={fabricaDeClienteDeProva()} />);

    entrarPelaTela();
    await screen.findByRole("navigation", { name: "Principal" });

    navegarPara("#/cartoes/novo");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Criar cartão" }),
    ).toBeInTheDocument();
  });

  it("com Credencial, #/baralhos/novo apresenta a tela de criação de Baralho (FR-140)", async () => {
    render(<Aplicacao criarCliente={fabricaDeClienteDeProva()} />);

    entrarPelaTela();
    await screen.findByRole("navigation", { name: "Principal" });

    navegarPara("#/baralhos/novo");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Criar baralho" }),
    ).toBeInTheDocument();
  });

  it("um Criar cartão sujo pede Descartar as alterações ao navegar, e Cancelar preserva o digitado (FR-148, FR-151)", async () => {
    render(<Aplicacao criarCliente={fabricaDeClienteDeProva()} />);

    entrarPelaTela();
    await screen.findByRole("navigation", { name: "Principal" });

    navegarPara("#/cartoes/novo");

    const frente = await screen.findByLabelText("Frente");

    fireEvent.change(frente, { target: { value: "To walk" } });

    // FR-148: com o formulário sujo, a navegação da moldura passa pela
    // confirmação de descarte antes de trocar de tela.
    fireEvent.click(screen.getByRole("link", { name: "Baralhos" }));

    expect(
      await screen.findByText("Descartar as alterações?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("O texto digitado será perdido."),
    ).toBeInTheDocument();

    // Cancelar mantém a tela de origem e o texto digitado (FR-151).
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(screen.queryByText("Descartar as alterações?")).toBeNull();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Baralhos" }),
    ).toBeNull();
    expect(screen.getByLabelText("Frente")).toHaveValue("To walk");
  });
});
