import { join } from "node:path";

import { expect, test } from "@playwright/test";

import {
  aguardarProntidao,
  criarBaralhoPelaApi,
  criarCartaoNoBaralhoPelaApi,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  entrarSeNecessario,
  iniciarApi,
  iniciarFrontend,
  obterBaralhoPelaApi,
  portaLivre,
  removerPastaTemporaria,
} from "./servidores-locais";
import type { ProcessoIniciado } from "./servidores-locais";

// T308 — prova E2E real da Sessão de revisão
// (FR-029, FR-037, FR-039, SC-004, SC-008;
// specs/004-sessao-de-estudo/tasks.md; spec 024).
//
// Nenhuma rede é interceptada e nenhum dado é fabricado: a API real
// (node + SQLite em arquivo) e o frontend real (Vite dev) são iniciados como
// processos filhos do próprio teste, em portas livres e com um arquivo SQLite
// temporário exclusivo. Cartões, Baralho e Vínculos são criados direto pela
// API; a Sessão inteira — início, Revelação, Resultado e Resumo — é percorrida
// no Chromium pela tela real.
//
// Na spec 024 o formulário de início (Quantidade de Cartões + Iniciar Sessão)
// saiu: um Baralho Pendente (Cartões novos) abre o modal "Revisar baralho" com
// "Só pendentes"/"Todos os cartões"/"Cancelar" e a escolha começa a Sessão; um
// Baralho Revisado (todos os Cartões no futuro) começa direto, sem modal.
// Depois de uma Sessão concluída, os Cartões novos ficam agendados para o dia
// seguinte — o Baralho vira Revisado, o que prova o início direto.
//
// Por fim, uma nova Sessão iniciada é interrompida com `page.reload()`: a
// Credencial e o andamento somem e o novo início recomeça no Item 1, sem
// retomada nem Resumo persistido (FR-038, FR-039).
//
// O teste aguarda a prontidão de cada processo antes de usá-lo e encerra
// ambos no `finally`, inclusive quando a prova falha no meio.

const QUANTIDADE_DE_CARTOES = 3;
const NOME_DO_BARALHO = "Inglês";

test.setTimeout(120_000);

test("Sessão de revisão real encerra no Resumo e a interrupção descarta o andamento (FR-029, FR-037, FR-039, SC-004, SC-008; spec 024)", async ({ page, browserName }) => {
  // Navegador real: Chromium, sem DOM simulado.
  expect(browserName).toBe("chromium");

  const pasta = await criarPastaTemporaria("sessao-t308-");
  const caminhoDoBanco = join(pasta, "sessao.sqlite");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    // Primeira execução: API com arquivo SQLite temporário exclusivo e
    // frontend real, cada um em porta livre e aguardando prontidão.
    const portaDaApi = await portaLivre();

    api = iniciarApi(caminhoDoBanco, portaDaApi);

    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;

    await aguardarApiPronta(api, enderecoDaApi);

    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;

    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);

    await aguardarProntidao(
      frontend,
      enderecoDoFrontend,
      (resposta) => resposta.ok,
    );

    // O Usuário de prova é cadastrado antes de o acervo ser preparado: o
    // Baralho e os Cartões da Sessão são dele (FR-090, FR-092).
    await criarUsuarioDeProva(enderecoDaApi);

    // Prepara o acervo direto pela API: um Baralho com três Cartões novos
    // vinculados — Pendente, portanto com o modal de início (spec 024).
    const baralho = await criarBaralhoPelaApi(enderecoDaApi, {
      nome: NOME_DO_BARALHO,
    });

    for (let indice = 1; indice <= QUANTIDADE_DE_CARTOES; indice += 1) {
      await criarCartaoNoBaralhoPelaApi(enderecoDaApi, baralho.id, {
        frente: `Frente ${indice}`,
        verso: `Verso ${indice}`,
      });
    }

    const baralhoPreparado = await obterBaralhoPelaApi(
      enderecoDaApi,
      baralho.id,
    );
    expect(baralhoPreparado.elegivel).toBe(true);
    expect(baralhoPreparado.cartoes).toHaveLength(QUANTIDADE_DE_CARTOES);

    // A tela real de revisão, depois de Entrar (FR-097). O formulário antigo
    // de início não existe mais (spec 024).
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralho.id}/estudo`);
    await entrarSeNecessario(page);

    await expect(page.getByLabel("Quantidade de Cartões")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Iniciar Sessão" }),
    ).toHaveCount(0);

    // Baralho Pendente: o modal decide o conjunto antes de começar.
    const modalDeRevisao = page.getByRole("dialog");

    await expect(modalDeRevisao).toBeVisible();
    await expect(modalDeRevisao.getByText("Revisar baralho")).toBeVisible();
    await expect(
      modalDeRevisao.getByRole("button", { name: "Só pendentes", exact: true }),
    ).toBeVisible();
    await expect(
      modalDeRevisao.getByRole("button", {
        name: "Todos os cartões",
        exact: true,
      }),
    ).toBeVisible();

    await modalDeRevisao
      .getByRole("button", { name: "Todos os cartões", exact: true })
      .click();

    await expect(
      page.getByRole("article", { name: "Item 1 de 3" }),
    ).toBeVisible();

    // Interromper pede confirmação (spec 012): "Cancelar" mantém a Sessão no
    // Item atual e "Interromper" a descarta, devolvendo ao Baralho sem Resumo.
    await page.getByRole("button", { name: "Interromper" }).click();

    const dialogoDeInterrupcao = page
      .getByRole("dialog")
      .filter({ hasText: "Interromper a Sessão?" });

    await expect(
      dialogoDeInterrupcao.getByText("Interromper a Sessão?"),
    ).toBeVisible();

    await dialogoDeInterrupcao
      .getByRole("button", { name: "Cancelar" })
      .click();
    await expect(
      page.getByRole("article", { name: "Item 1 de 3" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Interromper" }).click();
    await dialogoDeInterrupcao
      .getByRole("button", { name: "Interromper" })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: NOME_DO_BARALHO }),
    ).toBeVisible();

    // Agora, a Sessão que percorre três Itens até o Resumo — desta vez
    // escolhendo "Só pendentes" no modal (os Cartões continuam novos).
    await page.getByRole("link", { name: "Revisar este Baralho" }).click();

    await expect(modalDeRevisao).toBeVisible();
    await modalDeRevisao
      .getByRole("button", { name: "Só pendentes", exact: true })
      .click();

    await expect(
      page.getByRole("article", { name: "Item 1 de 3" }),
    ).toBeVisible();

    // Dois acertos e um erro, para que o Resumo tenha soma coerente (SC-004).
    for (let item = 1; item <= 3; item += 1) {
      await expect(page.getByRole("heading", { name: "Frente" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Verso" })).toHaveCount(0);

      await page.getByRole("button", { name: "Revelar verso" }).click();

      await expect(page.getByRole("heading", { name: "Verso" })).toBeVisible();
      // Os quatro níveis substituíram Acertei/Errei (FR-193, SC-088): "Bom" é
      // o equivalente do antigo Acerto e "Errei" continua Errei.
      await expect(
        page.getByRole("button", { name: /^Bom/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^Errei/ }),
      ).toBeVisible();

      if (item === 3) {
        await page.getByRole("button", { name: /^Errei/ }).click();
      } else {
        await page.getByRole("button", { name: /^Bom/ }).click();
      }
    }

    await expect(
      page.getByRole("heading", { name: "Sessão concluída" }),
    ).toBeVisible();
    await expect(page.getByText(/6[67]%/)).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Placar da Sessão" }),
    ).toContainText("de acertos");
    // SC-004: o Resumo deriva tudo dos mesmos três Itens apresentados — dois
    // acertos e um erro —, e a tela os apresenta na contagem e nos botões dos
    // grupos (FR-174, FR-176). Os botões agora exibem a opção de Avaliação
    // escolhida na Sessão (T2316): "Bom" foi escolhido para os dois acertos
    // e "Errei" para o erro.
    await expect(page.getByText("2 de 3 Cartões")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Bom (2)" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Errei (1)" }),
    ).toBeVisible();

    // FR-161, FR-163: a Sessão concluída é registrada no histórico assim que
    // o Resumo aparece; a confirmação é só anunciada, sem aviso à vista.
    await expect(
      page.getByRole("status", { name: "Situação do registro da Sessão" }),
    ).toContainText(/Sessão registrada no histórico/);
    await expect(
      page.getByRole("link", { name: "Ver em Início" }),
    ).toHaveCount(0);

    // Interrupção: inicia outra Sessão e recarrega a página. A Sessão é
    // descartada e a tela volta ao início, sem retomada nem Resumo.
    await page.getByRole("link", { name: "Voltar para o Baralho" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: NOME_DO_BARALHO }),
    ).toBeVisible();

    // A Sessão concluída agendou os Cartões novos para o dia seguinte: o
    // Baralho virou Revisado e começa todos direto, sem modal (spec 024).
    await page.getByRole("link", { name: "Revisar este Baralho" }).click();

    await expect(
      page.getByRole("article", { name: "Item 1 de 3" }),
    ).toBeVisible();
    await expect(modalDeRevisao).toHaveCount(0);

    await page.reload();

    // Recarregar descarta a Credencial, e o andamento da Sessão com ela; com
    // a Credencial nova o início recomeça no Item 1, sem retomada (FR-089,
    // SC-031; spec 024).
    await entrarSeNecessario(page);

    await expect(
      page.getByRole("article", { name: "Item 1 de 3" }),
    ).toBeVisible();
    await expect(modalDeRevisao).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Sessão concluída" }),
    ).toHaveCount(0);
  } finally {
    // Encerrar sempre, mesmo quando a prova falha no meio, e remover o
    // arquivo e a pasta temporários.
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});

/** Aguarda a API responder `{ status: "ok" }` no `/health`. */
async function aguardarApiPronta(
  api: ProcessoIniciado,
  enderecoDaApi: string,
): Promise<void> {
  await aguardarProntidao(
    api,
    `${enderecoDaApi}/health`,
    async (resposta) => {
      if (!resposta.ok) {
        return false;
      }

      const corpo = (await resposta.json()) as { status?: unknown };

      return corpo.status === "ok";
    },
  );
}
