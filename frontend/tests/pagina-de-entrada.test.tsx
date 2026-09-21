import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  MENSAGEM_DE_CREDENCIAL_INVALIDA,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
} from "../src/acervo-cliente/cliente";
import type { Credencial } from "../src/acervo-cliente/cliente";
import { MENSAGEM_DE_SAIDA, PaginaDeEntrada } from "../src/ui/PaginaDeEntrada";
import {
  CREDENCIAL_DE_PROVA,
  SENHA_DE_PROVA,
  clienteDeProva,
  outraCredencialDeProva,
} from "./apoio-de-prova";

/**
 * Tela "Entrar" (T708, T710, T712 e T713; specs/008-entrar/tasks.md).
 *
 * A tela consome somente a Interface `ClienteDoAcervo`, com o
 * `ClienteEmMemoria`, e não reproduz nenhuma regra de domínio: a Credencial é
 * submetida ao cliente e a recusa é exibida com a mensagem que ele devolveu
 * (FR-046). As provas cobrem:
 *
 * 1. os campos e o acesso a "Criar conta", com a Senha protegida e anunciada
 *    como campo de Senha (FR-078, FR-097);
 * 2. a Credencial entregue a quem entrou, e a Senha que não permanece na tela
 *    (FR-078, FR-089);
 * 3. a recusa única, idêntica para Nome de usuário inexistente e Senha errada,
 *    com o Nome de usuário preservado, a Senha apagada e o foco no campo a
 *    corrigir (FR-088, FR-095, SC-029);
 * 4. o anúncio por região ativa — assertiva na recusa, polida na conclusão de
 *    Sair e no aviso de Credencial descartada (FR-091, FR-096);
 * 5. a falha de transporte, que é relatada e **preserva** o conteúdo informado
 *    (FR-044, FR-045);
 * 6. o percurso completo por teclado, do primeiro campo à conclusão, com o
 *    foco identificável sem depender de cor (FR-095, SC-032).
 *
 * O jsdom não executa os comportamentos padrão de Tab (avanço de foco) nem de
 * Enter sobre botão de submissão (ativação); os auxiliares abaixo reproduzem
 * esses comportamentos de navegador, sempre disparando antes o evento de
 * teclado real.
 */

/** Controles interativos da página, na ordem de tabulação (ordem do DOM). */
const SELETOR_DE_CONTROLES_INTERATIVOS = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function controlesInterativos(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(SELETOR_DE_CONTROLES_INTERATIVOS),
  );
}

/** Aperta Tab como um navegador: evento de teclado e avanço do foco. */
function apertarTab(): void {
  avançarFoco(1);
}

/** Aperta Shift+Tab como um navegador: evento de teclado e recuo do foco. */
function apertarShiftTab(): void {
  avançarFoco(-1);
}

function avançarFoco(passo: 1 | -1): void {
  const controles = controlesInterativos();
  const indice = controles.findIndex(
    (controle) => controle === document.activeElement,
  );
  const destino =
    controles[(indice + passo + controles.length) % controles.length];

  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: "Tab",
    shiftKey: passo === -1,
  });
  destino.focus();
}

/** Digita pelo teclado: um `keydown` por caractere e a atualização do valor. */
function digitarPeloTeclado(campo: HTMLElement, texto: string): void {
  for (const caractere of texto) {
    fireEvent.keyDown(campo, { key: caractere });
  }

  fireEvent.change(campo, { target: { value: texto } });
}

/**
 * Aperta Enter como um navegador: dispara o evento e executa o comportamento
 * padrão — a ativação do botão de submissão focado.
 */
function apertarEnter(elemento: HTMLElement): void {
  fireEvent.keyDown(elemento, { key: "Enter" });

  if (elemento instanceof HTMLButtonElement && elemento.type === "submit") {
    fireEvent.click(elemento);
  }
}

/** Renderiza a tela "Entrar" sobre o Adapter de memória. */
function renderizarEntrada(
  aoEntrar: (credencial: Credencial) => void = () => {},
): ReturnType<typeof clienteDeProva> {
  const cliente = clienteDeProva();

  render(<PaginaDeEntrada cliente={cliente} aoEntrar={aoEntrar} />);

  return cliente;
}

describe("PaginaDeEntrada — campos, acesso e Credencial", () => {
  it("apresenta Nome de usuário e Senha, com a Senha protegida e anunciada como campo de Senha (FR-078, FR-097)", () => {
    renderizarEntrada();

    const campoDoNome = screen.getByLabelText("Nome de usuário");
    const campoDaSenha = screen.getByLabelText("Senha");

    expect(campoDoNome).toHaveAttribute("autocomplete", "username");
    // O campo de Senha é um campo de Senha para o navegador e para o leitor de
    // tela, e nunca é preenchido automaticamente com a Senha do Cadastro.
    expect(campoDaSenha).toHaveAttribute("type", "password");
    expect(campoDaSenha).toHaveAttribute("autocomplete", "current-password");

    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute(
      "href",
      "#/criar-conta",
    );
  });

  it("entrega a Credencial a quem passou a mantê-la e não a deixa na tela (FR-078, FR-089)", async () => {
    const aoEntrar = vi.fn();
    renderizarEntrada(aoEntrar);

    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: CREDENCIAL_DE_PROVA.senha },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    // A Credencial que entrou é entregue a quem passa a mantê-la (FR-089).
    await waitFor(() =>
      expect(aoEntrar).toHaveBeenCalledWith(CREDENCIAL_DE_PROVA),
    );

    // E a Senha sai da tela assim que deixa de ser necessária (FR-078).
    expect(screen.getByLabelText("Nome de usuário")).toHaveValue(
      CREDENCIAL_DE_PROVA.nomeDeUsuario,
    );
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });
});

describe("PaginaDeEntrada — recusa de Entrar", () => {
  it("recusa com a mesma mensagem para Nome de usuário inexistente e Senha errada (FR-088, SC-029)", async () => {
    renderizarEntrada();

    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: "ninguem.aqui" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: SENHA_DE_PROVA },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const recusaSemUsuario = await screen.findByRole("alert", {
      name: "Falha ao Entrar",
    });

    expect(recusaSemUsuario).toHaveTextContent(MENSAGEM_DE_CREDENCIAL_INVALIDA);

    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: outraCredencialDeProva().senha },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const recusaComSenhaErrada = await screen.findByRole("alert", {
      name: "Falha ao Entrar",
    });

    // A resposta é uma só: nada revela qual parte da Credencial falhou.
    expect(recusaComSenhaErrada).toHaveTextContent(
      recusaSemUsuario.textContent ?? "",
    );
    expect(recusaComSenhaErrada).toHaveTextContent(
      MENSAGEM_DE_CREDENCIAL_INVALIDA,
    );
  });

  it("mantém o Nome de usuário, apaga a Senha e move o foco para o campo a corrigir (FR-095)", async () => {
    renderizarEntrada();

    const campoDoNome = screen.getByLabelText("Nome de usuário");
    const campoDaSenha = screen.getByLabelText("Senha");

    digitarPeloTeclado(campoDoNome, CREDENCIAL_DE_PROVA.nomeDeUsuario);
    digitarPeloTeclado(campoDaSenha, outraCredencialDeProva().senha);

    campoDoNome.focus();
    apertarTab();
    expect(document.activeElement).toBe(campoDaSenha);

    apertarTab();
    const botaoDeEntrada = screen.getByRole("button", { name: "Entrar" });
    expect(document.activeElement).toBe(botaoDeEntrada);
    apertarEnter(botaoDeEntrada);

    await screen.findByRole("alert", { name: "Falha ao Entrar" });

    // O Nome de usuário permanece; a Senha, que a tentativa descartou, é o
    // campo que precisa de correção — e é para lá que o foco vai.
    expect(campoDoNome).toHaveValue(CREDENCIAL_DE_PROVA.nomeDeUsuario);
    expect(campoDaSenha).toHaveValue("");
    expect(document.activeElement).toBe(campoDaSenha);
    expect(campoDaSenha).toHaveFocus();
  });

  it("anuncia a recusa por região assertiva nomeada, e cada tentativa insere um anúncio novo (FR-096)", async () => {
    renderizarEntrada();

    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: "ninguem.aqui" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: SENHA_DE_PROVA },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const primeira = await screen.findByRole("alert", {
      name: "Falha ao Entrar",
    });

    expect(primeira).toHaveTextContent(MENSAGEM_DE_CREDENCIAL_INVALIDA);
    // O papel `alert` já implica região assertiva e atômica; nenhum
    // `aria-live` redundante, que poderia duplicar o anúncio.
    expect(primeira).not.toHaveAttribute("aria-live");
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const segunda = await screen.findByRole("alert", { name: "Falha ao Entrar" });

    // O alerta anterior sai da árvore e um novo é inserido: é a inserção na
    // região ativa que dispara o anúncio de novo.
    expect(segunda).not.toBe(primeira);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("relata a falha de transporte e preserva o conteúdo informado (FR-044, FR-045)", async () => {
    const aoEntrar = vi.fn();
    const cliente = renderizarEntrada(aoEntrar);

    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: CREDENCIAL_DE_PROVA.senha },
    });

    cliente.simularIndisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByRole("alert", { name: "Falha ao Entrar" }),
    ).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS);

    // Nada aparece como concluído, ninguém entrou, e os dois campos mantêm o
    // que foi digitado, prontos para nova tentativa sem redigitação.
    expect(aoEntrar).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nome de usuário")).toHaveValue(
      CREDENCIAL_DE_PROVA.nomeDeUsuario,
    );
    expect(screen.getByLabelText("Senha")).toHaveValue(
      CREDENCIAL_DE_PROVA.senha,
    );
  });
});

describe("PaginaDeEntrada — aviso inicial e anúncios", () => {
  it("a Credencial recusada por uma operação é anunciada como alerta nomeado, não só exibida (FR-091, FR-096)", () => {
    render(
      <PaginaDeEntrada
        cliente={clienteDeProva()}
        aoEntrar={() => {}}
        aviso={{
          tipo: "falha",
          texto: "A Credencial não é mais válida. Entre novamente.",
        }}
      />,
    );

    const alerta = screen.getByRole("alert", { name: "Credencial recusada" });

    expect(alerta).toHaveTextContent(/a credencial não é mais válida/i);
    expect(alerta).not.toHaveAttribute("aria-live");
  });

  it("a conclusão de Sair é anunciada por região ativa polida, com nome (FR-096)", () => {
    render(
      <PaginaDeEntrada
        cliente={clienteDeProva()}
        aoEntrar={() => {}}
        aviso={{ tipo: "saida", texto: MENSAGEM_DE_SAIDA }}
      />,
    );

    const conclusao = screen.getByRole("status", { name: "Saída concluída" });

    expect(conclusao).toHaveAttribute("aria-live", "polite");
    expect(conclusao).toHaveAttribute("aria-atomic", "true");
    expect(conclusao).toHaveTextContent(/você saiu/i);
  });
});

describe("PaginaDeEntrada por teclado", () => {
  it("percorre Nome de usuário, Senha, Entrar e Criar conta na ordem visual, com o foco em cada passo (FR-095, SC-032)", async () => {
    const aoEntrar = vi.fn();
    renderizarEntrada(aoEntrar);

    const campoDoNome = screen.getByLabelText("Nome de usuário");
    const campoDaSenha = screen.getByLabelText("Senha");
    const botaoDeEntrada = screen.getByRole("button", { name: "Entrar" });
    const acessoAoCadastro = screen.getByRole("link", { name: "Criar conta" });

    // A ordem de tabulação é a ordem visual da coluna única.
    const controles = controlesInterativos();

    expect(controles).toEqual([
      campoDoNome,
      campoDaSenha,
      botaoDeEntrada,
      acessoAoCadastro,
    ]);

    apertarTab();
    expect(document.activeElement).toBe(campoDoNome);
    digitarPeloTeclado(campoDoNome, CREDENCIAL_DE_PROVA.nomeDeUsuario);

    apertarTab();
    expect(document.activeElement).toBe(campoDaSenha);
    digitarPeloTeclado(campoDaSenha, CREDENCIAL_DE_PROVA.senha);

    apertarTab();
    expect(document.activeElement).toBe(botaoDeEntrada);

    // Shift+Tab volta um passo da ordem, como no navegador.
    apertarShiftTab();
    expect(document.activeElement).toBe(campoDaSenha);

    apertarTab();
    expect(document.activeElement).toBe(botaoDeEntrada);
    apertarEnter(botaoDeEntrada);

    await waitFor(() =>
      expect(aoEntrar).toHaveBeenCalledWith(CREDENCIAL_DE_PROVA),
    );
  });
});
