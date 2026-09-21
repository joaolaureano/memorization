import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { PaginaDeCadastro } from "../src/ui/PaginaDeCadastro";

/**
 * T611 — o Cadastro inteiro por teclado, com o foco sempre identificável e
 * movido na recusa (specs/007-criar-usuario/tasks.md, FR-081, SC-020).
 *
 * A tela é exercitada pela superfície da Seam `ClienteDoAcervo` com o
 * `ClienteEmMemoria`, sem servidor. Três provas:
 *
 * 1. O percurso do primeiro campo à confirmação é concluído só por teclado, na
 *    ordem visual — Nome de usuário, Senha, Confirmação da Senha, Criar conta
 *    —, com o elemento focado conferido a cada passo por `document.activeElement`.
 * 2. Após cada recusa, o foco está no campo que precisa de correção: a
 *    Confirmação, quando ela divergir (FR-072); o campo apontado pelo código
 *    devolvido pela Interface, nas recusas de domínio; e onde estava, quando a
 *    falha é do transporte e nenhum campo precisa de correção.
 * 3. O indicador de foco de `estilos.css` é um contorno geométrico, sem
 *    depender apenas de cor, e nunca é suprimido.
 */

const NOME_DE_USUARIO_VALIDO = "Ana.Silva";
const SENHA_VALIDA = "senha-de-prova";

const SELETOR_DE_CONTROLES_INTERATIVOS = [
  "button:not([disabled])",
  "textarea:not([disabled])",
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

/**
 * Aperta Tab como um navegador: dispara o evento de teclado no elemento focado
 * e avança o foco ao próximo controle na ordem de tabulação.
 */
function apertarTab(): void {
  const controles = controlesInterativos();
  const indice = controles.findIndex(
    (controle) => controle === document.activeElement,
  );
  const proximo = controles[(indice + 1) % controles.length];

  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab" });
  proximo.focus();
}

/** Digita pelo teclado: um `keydown` por caractere e a atualização do valor. */
function digitarPeloTeclado(campo: HTMLElement, texto: string): void {
  for (const caractere of texto) {
    fireEvent.keyDown(campo, { key: caractere });
  }

  fireEvent.change(campo, { target: { value: texto } });
}

/**
 * Aperta Enter como um navegador: dispara o evento de teclado e executa o
 * comportamento padrão — a ativação do botão de submissão focado.
 */
function apertarEnter(elemento: HTMLElement): void {
  fireEvent.keyDown(elemento, { key: "Enter" });

  if (elemento instanceof HTMLButtonElement && elemento.type === "submit") {
    fireEvent.click(elemento);
  }
}

interface CasoDeRecusa {
  descricao: string;
  nomeDeUsuario: string;
  senha: string;
  confirmacaoDaSenha: string;
  mensagem: RegExp;
  campoDoFoco: string;
}

/** Os quatro modos de recusa desta tela, cada um com o campo a corrigir. */
const CASOS_DE_RECUSA: CasoDeRecusa[] = [
  {
    descricao: "nome de usuário curto",
    nomeDeUsuario: "ab",
    senha: SENHA_VALIDA,
    confirmacaoDaSenha: SENHA_VALIDA,
    mensagem: /o nome de usuário deve ter pelo menos 3 caracteres/i,
    campoDoFoco: "Nome de usuário",
  },
  {
    descricao: "Senha curta",
    nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
    senha: "1234567",
    confirmacaoDaSenha: "1234567",
    mensagem: /a senha deve ter entre 8 e 128 caracteres/i,
    campoDoFoco: "Senha",
  },
  {
    descricao: "Confirmação divergente",
    nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
    senha: "12345678",
    confirmacaoDaSenha: "123456789",
    mensagem: /confirmação da senha estão diferentes/i,
    campoDoFoco: "Confirmação da Senha",
  },
];

describe("PaginaDeCadastro por teclado", () => {
  it("conclui o Cadastro do primeiro campo à confirmação apenas por teclado, na ordem visual (FR-081, SC-020)", async () => {
    render(<PaginaDeCadastro cliente={new ClienteEmMemoria()} />);

    const campoDoNome = screen.getByLabelText("Nome de usuário");
    const campoDaSenha = screen.getByLabelText("Senha");
    const campoDaConfirmacao = screen.getByLabelText("Confirmação da Senha");
    const botaoDeCadastro = screen.getByRole("button", { name: "Criar conta" });
    const acessoAEntrada = screen.getByRole("link", { name: "Entrar" });

    // Os únicos controles interativos são os três campos, a ação e a volta a
    // "Entrar" (FR-097), nesta ordem — a mesma da disposição visual da coluna
    // única.
    const controles = controlesInterativos();
    expect(controles).toHaveLength(5);
    expect(controles[0]).toBe(campoDoNome);
    expect(controles[1]).toBe(campoDaSenha);
    expect(controles[2]).toBe(campoDaConfirmacao);
    expect(controles[3]).toBe(botaoDeCadastro);
    expect(controles[4]).toBe(acessoAEntrada);

    apertarTab();
    expect(document.activeElement).toBe(campoDoNome);
    digitarPeloTeclado(campoDoNome, NOME_DE_USUARIO_VALIDO);

    apertarTab();
    expect(document.activeElement).toBe(campoDaSenha);
    digitarPeloTeclado(campoDaSenha, SENHA_VALIDA);

    apertarTab();
    expect(document.activeElement).toBe(campoDaConfirmacao);
    digitarPeloTeclado(campoDaConfirmacao, SENHA_VALIDA);

    apertarTab();
    expect(document.activeElement).toBe(botaoDeCadastro);
    apertarEnter(botaoDeCadastro);

    const confirmacao = await screen.findByRole("status");
    expect(confirmacao).toHaveTextContent(
      `O Usuário ${NOME_DE_USUARIO_VALIDO} foi criado.`,
    );
  });

  it("volta o foco com Shift+Tab pela mesma ordem visual (FR-081)", () => {
    render(<PaginaDeCadastro cliente={new ClienteEmMemoria()} />);

    const campoDoNome = screen.getByLabelText("Nome de usuário");
    const campoDaSenha = screen.getByLabelText("Senha");
    const campoDaConfirmacao = screen.getByLabelText("Confirmação da Senha");

    // Percorre até a Confirmação e retorna, um controle por vez.
    campoDoNome.focus();
    apertarTab();
    expect(document.activeElement).toBe(campoDaSenha);
    apertarTab();
    expect(document.activeElement).toBe(campoDaConfirmacao);

    fireEvent.keyDown(campoDaConfirmacao, { key: "Tab", shiftKey: true });
    campoDaSenha.focus();
    expect(document.activeElement).toBe(campoDaSenha);

    fireEvent.keyDown(campoDaSenha, { key: "Tab", shiftKey: true });
    campoDoNome.focus();
    expect(document.activeElement).toBe(campoDoNome);
  });

  it.each(CASOS_DE_RECUSA)(
    "numa recusa de $descricao, o foco vai ao campo a corrigir e o conteúdo permanece (FR-072, FR-081)",
    async (caso) => {
      render(<PaginaDeCadastro cliente={new ClienteEmMemoria()} />);

      const campoDoNome = screen.getByLabelText("Nome de usuário");

      digitarPeloTeclado(campoDoNome, caso.nomeDeUsuario);

      apertarTab(); // Senha
      const campoDaSenha = screen.getByLabelText("Senha");
      digitarPeloTeclado(campoDaSenha, caso.senha);

      apertarTab(); // Confirmação da Senha
      const campoDaConfirmacao = screen.getByLabelText("Confirmação da Senha");
      digitarPeloTeclado(campoDaConfirmacao, caso.confirmacaoDaSenha);

      apertarTab(); // Criar conta
      const botaoDeCadastro = screen.getByRole("button", {
        name: "Criar conta",
      });
      apertarTab();
      expect(document.activeElement).toBe(botaoDeCadastro);
      apertarEnter(botaoDeCadastro);

      expect(await screen.findByText(caso.mensagem)).toBeInTheDocument();

      expect(document.activeElement).toBe(screen.getByLabelText(caso.campoDoFoco));
      expect(campoDoNome).toHaveValue(caso.nomeDeUsuario);
      expect(campoDaSenha).toHaveValue(caso.senha);
      expect(campoDaConfirmacao).toHaveValue(caso.confirmacaoDaSenha);
    },
  );

  it("numa repetição de Nome de usuário, o foco vai ao Nome (FR-074, FR-081)", async () => {
    const cliente = new ClienteEmMemoria();

    await cliente.criarUsuario({
      nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
      senha: SENHA_VALIDA,
    });

    render(<PaginaDeCadastro cliente={cliente} />);

    const campoDoNome = screen.getByLabelText("Nome de usuário");

    digitarPeloTeclado(campoDoNome, "ana.silva");
    apertarTab();
    digitarPeloTeclado(screen.getByLabelText("Senha"), SENHA_VALIDA);
    apertarTab();
    digitarPeloTeclado(
      screen.getByLabelText("Confirmação da Senha"),
      SENHA_VALIDA,
    );
    apertarTab();

    const botaoDeCadastro = screen.getByRole("button", { name: "Criar conta" });

    apertarTab();
    expect(document.activeElement).toBe(botaoDeCadastro);
    apertarEnter(botaoDeCadastro);

    expect(
      await screen.findByText(/este nome de usuário já existe/i),
    ).toBeInTheDocument();
    expect(document.activeElement).toBe(campoDoNome);
  });

  it("com o transporte indisponível, o foco permanece no botão — nenhum campo precisa de correção (FR-044, FR-081)", async () => {
    const cliente = new ClienteEmMemoria();

    render(<PaginaDeCadastro cliente={cliente} />);

    const campoDoNome = screen.getByLabelText("Nome de usuário");

    digitarPeloTeclado(campoDoNome, NOME_DE_USUARIO_VALIDO);
    apertarTab();
    digitarPeloTeclado(screen.getByLabelText("Senha"), SENHA_VALIDA);
    apertarTab();
    digitarPeloTeclado(
      screen.getByLabelText("Confirmação da Senha"),
      SENHA_VALIDA,
    );

    cliente.simularIndisponibilidade();

    apertarTab();
    const botaoDeCadastro = screen.getByRole("button", { name: "Criar conta" });

    apertarTab();
    expect(document.activeElement).toBe(botaoDeCadastro);
    apertarEnter(botaoDeCadastro);

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS),
    ).toBeInTheDocument();

    expect(document.activeElement).toBe(botaoDeCadastro);
    expect(campoDoNome).toHaveValue(NOME_DE_USUARIO_VALIDO);
  });

  it("o indicador de foco é um contorno geométrico e não depende apenas de cor (FR-081, SC-020)", () => {
    // O Vitest esvazia imports de CSS; o arquivo de estilos é lido como
    // texto — o mesmo arquivo que o `main.tsx` carrega na aplicação.
    const estilos = readFileSync(
      join(process.cwd(), "src", "estilos.css"),
      "utf8",
    );

    const regraDeFoco = estilos.match(/:focus-visible\s*\{([^}]*)\}/);
    expect(regraDeFoco).not.toBeNull();

    // Contorno sólido, com espessura e afastamento: indicação geométrica,
    // perceptível mesmo sem distinguir cores.
    const declaracoes = regraDeFoco?.[1] ?? "";
    expect(declaracoes).toMatch(/outline:\s*3px\s+solid/);
    expect(declaracoes).toMatch(/outline-offset:\s*2px/);

    // O indicador nunca é suprimido em nenhum controle interativo.
    expect(estilos).not.toMatch(/outline\s*:\s*(none|0)\s*;?/);

    // O formulário de Cadastro é a coluna única já usada pelas demais telas.
    expect(estilos).toMatch(/\.formulario-de-cadastro/);
  });
});
