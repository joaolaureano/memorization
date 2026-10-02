import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  ClienteDoAcervo,
  DadosDeBaralho,
} from "../src/acervo-cliente/cliente";
import { MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { LIMITE_DE_CARACTERES_DE_BARALHO } from "../src/acervo-cliente/validacao";
import { ROTA_PADRAO, hashDaRota } from "../src/ui/navegacao";
import { PaginaDoFormularioDeBaralho } from "../src/ui/PaginaDoFormularioDeBaralho";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";

/**
 * T1108, T1109 — tela do formulário de Baralho
 * (specs/012-interface-visual-navegavel/tasks.md; FR-140, FR-141, FR-144,
 * FR-148, FR-153–FR-156).
 *
 * A tela é exercitada com o `ClienteEmMemoria`, sem servidor, e envolvida em
 * `comProtecaoDeSaida` — as duas rotas de formulário vivem sob a proteção de
 * saída da `012`. As asserções de criação foram portadas de
 * `pagina-de-baralhos.test.tsx`, e as de renomeação, de
 * `renomear-e-excluir-baralho.original.test.tsx`, ambas preservando regras,
 * limites e mensagens das features 002/005.
 */

interface AcervoDeTeste {
  cliente: ClienteEmMemoria;
  idDoBaralho: string;
}

/** Renderiza a rota de criação (`#/baralhos/novo`) sob a proteção de saída. */
function renderizarCriacao(cliente: ClienteDoAcervo): void {
  window.location.hash = "#/baralhos/novo";
  render(
    comProtecaoDeSaida(
      <PaginaDoFormularioDeBaralho cliente={cliente} />,
      true,
    ),
  );
}

/** Renderiza a rota de renomeação (`#/baralhos/<id>/editar`). */
function renderizarRenomeacao(cliente: ClienteDoAcervo, id: string): void {
  window.location.hash = hashDaRota({ nome: "editar-baralho", id });
  render(
    comProtecaoDeSaida(
      <PaginaDoFormularioDeBaralho cliente={cliente} id={id} />,
      true,
    ),
  );
}

/** Preenche o campo do formulário pelo rótulo acessível. */
function digitar(valor: string): void {
  fireEvent.change(screen.getByLabelText("Nome"), {
    target: { value: valor },
  });
}

/** Submete o formulário pelo botão acessível. */
function submeter(): void {
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
}

/** Um acervo de teste com um Baralho nomeado e dois Cartões vinculados. */
async function criarBaralhoComDoisCartoes(): Promise<AcervoDeTeste> {
  const cliente = clienteDeProva();
  const baralho = await cliente.criarBaralho({ nome: "Inglês" });

  if (!baralho.ok) {
    throw new Error("a criação do Baralho deveria ser aceita");
  }

  for (const [frente, verso] of [
    ["To walk", "Caminhar"],
    ["To run", "Correr"],
  ]) {
    const cartao = await cliente.criarCartao({ frente, verso });

    if (!cartao.ok) {
      throw new Error("a criação do Cartão deveria ser aceita");
    }

    await cliente.vincular(cartao.cartao.id, baralho.baralho.id);
  }

  return { cliente, idDoBaralho: baralho.baralho.id };
}

/**
 * Adapter cuja `criarBaralho` fica suspensa até `liberar` ser chamado — é o que
 * permite observar o estado pendente (FR-153, FR-154) de forma determinística.
 */
function comCriacaoSuspensa(base: ClienteDoAcervo): {
  cliente: ClienteDoAcervo;
  liberar: () => void;
} {
  let liberarPortao: () => void = () => {};

  const portao = new Promise<void>((resolve) => {
    liberarPortao = () => resolve();
  });

  const cliente = new Proxy(base, {
    get(alvo, propriedade) {
      if (propriedade === "criarBaralho") {
        return async (dados: DadosDeBaralho) => {
          await portao;
          return alvo.criarBaralho(dados);
        };
      }

      const valor = Reflect.get(alvo, propriedade, alvo);

      return typeof valor === "function" ? valor.bind(alvo) : valor;
    },
  });

  return { cliente, liberar: () => liberarPortao() };
}

describe("formulário de Baralho — criação", () => {
  it("apresenta o título da criação e o caminho de volta à lista (FR-140)", () => {
    renderizarCriacao(clienteDeProva());

    expect(
      screen.getByRole("heading", { level: 1, name: "Criar baralho" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Voltar para Baralhos/i }),
    ).toHaveAttribute("href", ROTA_PADRAO);
  });

  it("comunica a contagem e o limite durante a digitação (FR-061)", () => {
    renderizarCriacao(clienteDeProva());

    expect(
      screen.queryByText(/faltam \d+ caracteres para o limite/i),
    ).not.toBeInTheDocument();

    digitar("x".repeat(90));

    expect(
      screen.getByText(`90 / ${LIMITE_DE_CARACTERES_DE_BARALHO} caracteres`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Atenção: faltam 10 caracteres para o limite de ${LIMITE_DE_CARACTERES_DE_BARALHO}.`,
      ),
    ).toBeInTheDocument();
  });

  it("criação válida navega para o detalhe do Baralho recém-criado (FR-144)", async () => {
    const cliente = clienteDeProva();
    renderizarCriacao(cliente);

    digitar("Inglês");
    submeter();

    const lista = await cliente.listarBaralhos();

    if (!lista.ok) {
      throw new Error("a listagem deveria ser aceita");
    }

    expect(lista.baralhos).toHaveLength(1);

    const id = lista.baralhos[0].id;

    await waitFor(() => {
      expect(window.location.hash).toBe(hashDaRota({ nome: "baralho", id }));
    });
  });

  it("recusa de domínio exibe a mensagem do cliente e preserva o nome (FR-046, FR-155)", async () => {
    renderizarCriacao(clienteDeProva());

    digitar("   ");
    submeter();

    expect(
      await screen.findByRole("alert", { name: "Falha ao salvar o Baralho" }),
    ).toHaveTextContent(/o nome do baralho não pode ficar vazio/i);
    expect(screen.getByLabelText("Nome")).toHaveValue("   ");
  });

  it("submete conteúdo acima do limite e exibe a recusa do cliente, sem validar na tela (FR-046)", async () => {
    renderizarCriacao(clienteDeProva());

    const textoLongo = "x".repeat(101);
    digitar(textoLongo);

    expect(
      screen.getByText(
        `Atenção: o nome excede o limite de ${LIMITE_DE_CARACTERES_DE_BARALHO} caracteres.`,
      ),
    ).toBeInTheDocument();

    submeter();

    expect(
      await screen.findByRole("alert", { name: "Falha ao salvar o Baralho" }),
    ).toHaveTextContent(
      `O nome do baralho deve ter no máximo ${LIMITE_DE_CARACTERES_DE_BARALHO} caracteres; o informado tem 101.`,
    );
    expect(screen.getByLabelText("Nome")).toHaveValue(textoLongo);
  });

  it("aceita dois Baralhos de mesmo nome (FR-012)", async () => {
    const cliente = clienteDeProva();

    await cliente.criarBaralho({ nome: "Inglês" });

    renderizarCriacao(cliente);
    digitar("Inglês");
    submeter();

    await waitFor(async () => {
      const lista = await cliente.listarBaralhos();

      if (lista.ok) {
        expect(lista.baralhos).toHaveLength(2);
      }
    });
  });

  it("criação com o cliente indisponível reporta a mensagem, não conclui e preserva o nome (FR-044, FR-045, SC-012)", async () => {
    const cliente = clienteDeProva();
    renderizarCriacao(cliente);

    digitar("Inglês");
    cliente.simularIndisponibilidade();
    submeter();

    expect(
      await screen.findByRole("alert", { name: "Falha ao salvar o Baralho" }),
    ).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS);

    cliente.restaurarDisponibilidade();
    const lista = await cliente.listarBaralhos();

    if (lista.ok) {
      expect(lista.baralhos).toHaveLength(0);
    }

    expect(screen.getByLabelText("Nome")).toHaveValue("Inglês");
  });

  it("a nova tentativa reaproveita o conteúdo preservado e só então conclui a criação (FR-045, SC-012)", async () => {
    const cliente = clienteDeProva();
    renderizarCriacao(cliente);

    digitar("Inglês");
    cliente.simularIndisponibilidade();
    submeter();
    await screen.findByRole("alert", { name: "Falha ao salvar o Baralho" });

    cliente.restaurarDisponibilidade();
    submeter();

    const lista = await cliente.listarBaralhos();

    if (!lista.ok) {
      throw new Error("a listagem deveria ser aceita");
    }

    expect(lista.baralhos).toHaveLength(1);
    const id = lista.baralhos[0].id;

    await waitFor(() => {
      expect(window.location.hash).toBe(hashDaRota({ nome: "baralho", id }));
    });
  });
});

describe("formulário de Baralho — renomeação", () => {
  it("carrega o Baralho, pré-preenche o nome e informa o alcance (FR-141, FR-015)", async () => {
    const { cliente, idDoBaralho } = await criarBaralhoComDoisCartoes();
    renderizarRenomeacao(cliente, idDoBaralho);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Renomear Baralho",
      }),
    ).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Inglês")).toBeInTheDocument();
    expect(
      screen.getByText("Este Baralho tem 2 Cartões vinculados."),
    ).toBeInTheDocument();
  });

  it("renomeia o Baralho e volta ao detalhe, preservando Vínculos e elegibilidade (FR-015, FR-144)", async () => {
    const { cliente, idDoBaralho } = await criarBaralhoComDoisCartoes();
    renderizarRenomeacao(cliente, idDoBaralho);

    await screen.findByDisplayValue("Inglês");
    digitar("Idiomas");
    submeter();

    await waitFor(() => {
      expect(window.location.hash).toBe(
        hashDaRota({ nome: "baralho", id: idDoBaralho }),
      );
    });

    const detalhe = await cliente.obterBaralho(idDoBaralho);

    expect(detalhe.ok).toBe(true);

    if (detalhe.ok) {
      expect(detalhe.baralho.nome).toBe("Idiomas");
      expect(detalhe.baralho.elegivel).toBe(true);
      expect(detalhe.baralho.cartoes).toHaveLength(2);
    }
  });

  it("com o cliente indisponível, renomear falha e o conteúdo digitado permanece (FR-044, FR-045, FR-155)", async () => {
    const { cliente, idDoBaralho } = await criarBaralhoComDoisCartoes();
    renderizarRenomeacao(cliente, idDoBaralho);

    await screen.findByDisplayValue("Inglês");
    digitar("Idiomas");

    cliente.simularIndisponibilidade();
    submeter();

    expect(
      await screen.findByRole("alert", { name: "Falha ao salvar o Baralho" }),
    ).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS);
    expect(screen.getByLabelText("Nome")).toHaveValue("Idiomas");
  });

  it("id inexistente exibe o recurso ausente com o caminho de volta à lista (FR-156)", async () => {
    renderizarRenomeacao(clienteDeProva(), "baralho-inexistente");

    expect(
      await screen.findByRole("alert", { name: "Baralho não encontrado" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Voltar para Baralhos/i }),
    ).toHaveAttribute("href", ROTA_PADRAO);
  });

  it("cancelar com alterações não salvas pede confirmação e, confirmada, volta ao detalhe (FR-148, FR-151)", async () => {
    const { cliente, idDoBaralho } = await criarBaralhoComDoisCartoes();
    renderizarRenomeacao(cliente, idDoBaralho);

    await screen.findByDisplayValue("Inglês");
    digitar("Idiomas");

    fireEvent.click(screen.getByRole("link", { name: "Cancelar" }));

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("O nome digitado será perdido.");

    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Descartar" }),
    );

    await waitFor(() => {
      expect(window.location.hash).toBe(
        hashDaRota({ nome: "baralho", id: idDoBaralho }),
      );
    });
  });
});

describe("formulário de Baralho — proteção de saída", () => {
  it("formulário sujo pede confirmação antes de trocar de rota (FR-148, FR-151)", async () => {
    renderizarCriacao(clienteDeProva());

    digitar("Inglês");

    window.location.hash = ROTA_PADRAO;

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveAccessibleName("Descartar as alterações?");
    expect(dialogo).toHaveTextContent("O nome digitado será perdido.");

    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Descartar" }),
    );

    await waitFor(() => {
      expect(window.location.hash).toBe(ROTA_PADRAO);
    });
  });

  it("bloqueia a navegação enquanto o Baralho está sendo salvo (FR-153, FR-154)", async () => {
    const { cliente, liberar } = comCriacaoSuspensa(clienteDeProva());
    renderizarCriacao(cliente);

    digitar("Inglês");
    submeter();

    expect(
      await screen.findByRole("button", { name: "Salvando…" }),
    ).toBeDisabled();

    window.location.hash = ROTA_PADRAO;

    expect(
      await screen.findByText("Aguarde: o Baralho está sendo salvo."),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.hash).toBe("#/baralhos/novo");
    });

    liberar();
  });
});
