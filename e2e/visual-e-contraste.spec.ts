import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  aguardarApiPronta,
  aguardarProntidao,
  criarBaralhoPelaApi,
  criarCartaoPelaApi,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  iniciarApi,
  iniciarFrontend,
  obterBaralhoPelaApi,
  portaLivre,
  removerPastaTemporaria,
  vincularCartaoPelaApi,
} from "./servidores-locais";
import type {
  CredencialDeProva,
  ProcessoIniciado,
} from "./servidores-locais";

// Prova E2E real de responsividade, legibilidade e contraste (spec 012:
// FR-135, FR-136, FR-137, SC-063, SC-068, SC-070).
//
// Nenhuma rede é interceptada e nenhum dado é fabricado: a API real
// (node + SQLite em arquivo) e o frontend real (Vite dev) sobem como processos
// filhos do próprio teste, em portas livres e com um arquivo SQLite temporário
// exclusivo. O acervo (Usuário, dois Baralhos — um com três Cartões e um vazio —
// e quatro Cartões, sendo um com uma Frente de 300 caracteres sem espaços) é
// criado direto pela API; todas as Telas são percorridas no Chromium real.
//
// Cada cenário de viewport (360, 390, 768 e 1440, além de "zoom 200%"
// simulado por um contexto novo de 720x900 com `deviceScaleFactor: 2`) audita
// as Telas: nada transborda na horizontal, todo alvo de toque tem ao menos
// 44x44 CSS px, o `font-size` do `body` é de ao menos 16px e não sobra nenhum
// resquício de demonstração. O contraste WCAG e a posição da Navegação
// "Principal" são conferidos em uma prova própria, calculados no próprio teste
// a partir das custom properties do tema.
//
// Cada largura é uma prova independente, com o seu ambiente (API e frontend
// reais, em portas livres e com um arquivo SQLite temporário exclusivo) e o
// seu contexto: nenhuma prova espera as outras, e cada uma cabe no próprio
// limite — bem abaixo do teto de 300s que a travessia única não cumpria. A
// prova aguarda a prontidão de cada processo antes de usá-lo e encerra ambos
// no `finally`, inclusive quando ela falha no meio.

/** O limite de uma única travessia das Telas; a suíte inteira não o herda. */
const LIMITE_DA_PROVA = 120_000;

test.setTimeout(LIMITE_DA_PROVA);

/**
 * O teto explícito de cada visita a uma Tela: a espera pelo destino. Uma Tela
 * que não chega falha com o próprio nome, em vez de consumir o teto inteiro
 * da prova — que continua sendo o de `LIMITE_DA_PROVA`.
 */
const ESPERA_DA_TELA = 30_000;

/** Altura fixa dos cenários de viewport. */
const ALTURA_DA_JANELA = 900;

/** Alvo de toque mínimo do produto (FR-136, SC-063). */
const ALVO_MINIMO_DE_TOQUE = 44;

/** Tamanho mínimo de fonte do corpo (FR-137). */
const TAMANHO_MINIMO_DA_FONTE = 16;

/** Resquícios de demonstração que não podem existir (SC-070). */
const TEXTOS_PROIBIDOS = [
  "Galeria",
  "Reiniciar demonstração",
  "dados simulados",
];

/** Baralho com três Cartões — o cenário canônico das Telas de Baralho. */
const NOME_DO_BARALHO_COM_CARTOES = "Viagem";

/** Baralho sem Cartões — aparece na lista junto do outro. */
const NOME_DO_BARALHO_VAZIO = "Vazio";

/**
 * O Usuário de prova que nunca estuda: a tela de Início dele é o estado vazio,
 * com o gráfico zerado e a lista de Sessões recentes por preencher (FR-172,
 * SC-076).
 */
const NOME_DO_USUARIO_SEM_REGISTROS = "usuario.sem.registros";

/**
 * Uma Frente de 300 caracteres sem nenhum espaço: é o caso-limite de quebra de
 * palavra longa (`overflow-wrap`) que precisa continuar dentro da caixa.
 */
const FRENTE_LONGA = "Donau".repeat(60);

/** Um cenário visual: a viewport (e a densidade) em que as Telas são auditadas. */
interface Cenario {
  rotulo: string;
  largura: number;
  altura: number;
  escalaDeDispositivo: number;
}

const CENARIOS: Cenario[] = [
  {
    rotulo: "360x900",
    largura: 360,
    altura: ALTURA_DA_JANELA,
    escalaDeDispositivo: 1,
  },
  {
    rotulo: "390x900",
    largura: 390,
    altura: ALTURA_DA_JANELA,
    escalaDeDispositivo: 1,
  },
  {
    rotulo: "768x900",
    largura: 768,
    altura: ALTURA_DA_JANELA,
    escalaDeDispositivo: 1,
  },
  {
    rotulo: "1440x900",
    largura: 1440,
    altura: ALTURA_DA_JANELA,
    escalaDeDispositivo: 1,
  },
  {
    rotulo: "zoom 200% (720x900 @2x)",
    largura: 720,
    altura: ALTURA_DA_JANELA,
    escalaDeDispositivo: 2,
  },
];

/** As custom properties de cor do tema lidas do `:root`. */
const NOMES_DE_COR: string[] = [
  "--text",
  "--muted",
  "--accent",
  "--danger",
  "--success",
  "--on-accent",
  "--bg",
  "--surface",
  "--surface-2",
  "--border",
];

/**
 * O ambiente de uma prova: os dois processos reais, o acervo que eles
 * sustentam e as Credenciais para Entrar. Cada prova monta o seu — o acervo de
 * uma prova não vaza para a outra.
 */
interface Ambiente {
  api: ProcessoIniciado;
  frontend: ProcessoIniciado;
  pasta: string;
  enderecoDaApi: string;
  enderecoDoFrontend: string;
  idDoBaralhoComCartoes: string;
  idDoCartaoEditado: string;
  principal: CredencialDeProva;
  semRegistros: CredencialDeProva;
}

/**
 * Sobe a API e o frontend reais e semeia o acervo das Telas: o Usuário de
 * prova com o Baralho de três Cartões (e o quarto Cartão, de Frente longa,
 * sem Vínculo) e o Usuário que nunca estuda.
 */
async function prepararAmbiente(): Promise<Ambiente> {
  const pasta = await criarPastaTemporaria("visual-012-");
  const caminhoDoBanco = join(pasta, "visual.sqlite");

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

    // O Usuário de prova é cadastrado antes do acervo: tudo o que as Telas
    // mostram pertence a ele (FR-090, FR-092). A Credencial é guardada para
    // Entrar explicitamente: o Usuário sem registros criado adiante passa a ser
    // o padrão dos auxiliares.
    const credencialPrincipal = await criarUsuarioDeProva(enderecoDaApi);

    const baralhoComCartoes = await criarBaralhoPelaApi(enderecoDaApi, {
      nome: NOME_DO_BARALHO_COM_CARTOES,
    });
    const baralhoVazio = await criarBaralhoPelaApi(enderecoDaApi, {
      nome: NOME_DO_BARALHO_VAZIO,
    });

    // Três Cartões comuns, vinculados ao Baralho com Cartões: é o Baralho que
    // sustenta a Sessão e o Resumo auditados adiante.
    let idDoCartaoEditado = "";

    for (let indice = 1; indice <= 3; indice += 1) {
      const cartao = await criarCartaoPelaApi(enderecoDaApi, {
        frente: `Frente ${indice}`,
        verso: `Verso ${indice}`,
      });

      if (indice === 1) {
        idDoCartaoEditado = cartao.id;
      }

      await vincularCartaoPelaApi(
        enderecoDaApi,
        cartao.id,
        baralhoComCartoes.id,
      );
    }

    // O quarto Cartão fica sem Vínculo: aparece na lista de Cartões (onde a
    // Frente longa é auditada) e na Tela de adicionar Cartões existentes.
    await criarCartaoPelaApi(enderecoDaApi, {
      frente: FRENTE_LONGA,
      verso: "Verso da Frente longa",
    });

    // A semente é conferida pela própria API antes de o navegador entrar: um
    // Baralho com três Cartões e outro sem nenhum.
    const baralhoPreparado = await obterBaralhoPelaApi(
      enderecoDaApi,
      baralhoComCartoes.id,
    );
    expect(baralhoPreparado.cartoes).toHaveLength(3);

    const baralhoVazioPreparado = await obterBaralhoPelaApi(
      enderecoDaApi,
      baralhoVazio.id,
    );
    expect(baralhoVazioPreparado.cartoes).toHaveLength(0);

    // Um segundo Usuário, que nunca estuda: a tela de Início dele é o estado
    // vazio (FR-172, SC-076). Fica por último porque passa a ser a Credencial
    // padrão dos auxiliares.
    const credencialSemRegistros = await criarUsuarioDeProva(
      enderecoDaApi,
      NOME_DO_USUARIO_SEM_REGISTROS,
    );

    return {
      api,
      frontend,
      pasta,
      enderecoDaApi,
      enderecoDoFrontend,
      idDoBaralhoComCartoes: baralhoComCartoes.id,
      idDoCartaoEditado,
      principal: credencialPrincipal,
      semRegistros: credencialSemRegistros,
    };
  } catch (erro) {
    // A montagem falhou no meio: nada pode ficar de pé.
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);

    throw erro;
  }
}

/** Derruba o ambiente da prova: frontend, API e arquivo temporário. */
async function encerrarAmbiente(ambiente: Ambiente): Promise<void> {
  await encerrarProcesso(ambiente.frontend);
  await encerrarProcesso(ambiente.api);
  await removerPastaTemporaria(ambiente.pasta);
}

// A travessia das Telas é a mesma em toda largura, mas cada largura é uma
// prova independente: ambiente, contexto e limite próprios. Nenhuma prova
// espera as outras, e nenhuma herda o tempo das demais.
for (const cenario of CENARIOS) {
  test(`Telas reais em ${cenario.rotulo} não transbordam, mantêm alvos de 44px, tipografia legível e nenhum resquício de demonstração (FR-135, FR-136, FR-137, SC-063, SC-068, SC-070)`, async ({
    browser,
    browserName,
  }) => {
    // Navegador real: Chromium, sem DOM simulado.
    expect(browserName).toBe("chromium");

    const ambiente = await prepararAmbiente();

    try {
      const contexto = await browser.newContext({
        viewport: { width: cenario.largura, height: cenario.altura },
        deviceScaleFactor: cenario.escalaDeDispositivo,
      });

      try {
        const pagina = await contexto.newPage();

        await visitarAsTelas(pagina, cenario, ambiente);
      } finally {
        await contexto.close();
      }
    } finally {
      // Encerrar sempre, mesmo quando a prova falha no meio.
      await encerrarAmbiente(ambiente);
    }
  });
}

test("O contraste WCAG do tema e a posição da Navegação Principal conferem em 390 e em 1440 (FR-135, SC-068, SC-076)", async ({
  browser,
  browserName,
}) => {
  // Navegador real: Chromium, sem DOM simulado.
  expect(browserName).toBe("chromium");

  const ambiente = await prepararAmbiente();

  try {
    for (const cenario of CENARIOS) {
      // Só as duas larguras com posição de Navegação "Principal" definida: no
      // celular ela é fixa no rodapé da janela; no desktop, fica no cabeçalho.
      if (cenario.largura !== 390 && cenario.largura !== 1440) {
        continue;
      }

      const contexto = await browser.newContext({
        viewport: { width: cenario.largura, height: cenario.altura },
        deviceScaleFactor: cenario.escalaDeDispositivo,
      });

      try {
        const pagina = await contexto.newPage();

        await abrirBaralhos(pagina, ambiente);
        await conferirNavegacaoPrincipal(pagina, cenario);

        // O contraste é conferido uma única vez, no cenário de 1440 (FR-135).
        if (cenario.largura === 1440) {
          await conferirContraste(pagina);
        }
      } finally {
        await contexto.close();
      }
    }
  } finally {
    await encerrarAmbiente(ambiente);
  }
});

/**
 * Muda de Tela pelo fragmento, sem recarregar o documento.
 *
 * Depois de Entrar, a Credencial vive apenas na memória da página (FR-089,
 * SC-031): navegar por `page.goto` arrisca recarregar o documento e perder a
 * Credencial no meio da travessia. Aqui a rota muda sem sair da página.
 */
async function irParaRota(pagina: Page, rota: string): Promise<void> {
  await pagina.evaluate((destino: string) => {
    window.location.hash = destino;
  }, rota);
}

/**
 * Visita uma Tela: muda o fragmento e espera o `h1` de destino, pelo papel e
 * pelo nome, com teto explícito.
 *
 * A espera é pelo conteúdo visível, e não pela igualdade do hash: quem decide
 * a Tela é a guarda de Credencial, e o hash sozinho não prova que ela chegou.
 * O teto explícito faz uma Tela que não vem falhar com o próprio nome, em vez
 * de consumir o teto inteiro da prova.
 */
async function irParaTela(
  pagina: Page,
  rota: string,
  titulo: string | RegExp,
): Promise<void> {
  await irParaRota(pagina, rota);

  await expect(
    pagina.getByRole("heading", { level: 1, name: titulo }),
  ).toBeVisible({ timeout: ESPERA_DA_TELA });
}

/**
 * Entra com a Credencial informada quando a tela "Entrar" está apresentada.
 *
 * A espera é pelo destino — a Moldura, com a Navegação "Principal" —, e não
 * pela resposta do `POST /entrar`: a resposta é do transporte, e uma que já
 * aconteceu não volta. Quem já tem a Credencial na memória da página segue
 * adiante sem reentrar (FR-089, FR-090).
 */
async function entrarSeNecessario(
  pagina: Page,
  credencial: CredencialDeProva,
): Promise<void> {
  const moldura = pagina.getByRole("navigation", { name: "Principal" });
  const telaDeEntrada = pagina.getByRole("heading", {
    level: 1,
    name: "Entrar",
  });

  // A guarda de Credencial decide a Tela: uma das duas chega. Esperar pelas
  // duas evita decidir por uma antes de a outra aparecer.
  await expect(moldura.or(telaDeEntrada).first()).toBeVisible({
    timeout: ESPERA_DA_TELA,
  });

  if ((await telaDeEntrada.count()) === 0) {
    return;
  }

  await pagina
    .getByLabel("Nome de usuário", { exact: true })
    .fill(credencial.nomeDeUsuario);
  await pagina.getByLabel("Senha", { exact: true }).fill(credencial.senha);
  await pagina.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(moldura).toBeVisible({ timeout: ESPERA_DA_TELA });
}

/** Entra com a Credencial principal e para na lista de Baralhos (FR-090). */
async function abrirBaralhos(
  pagina: Page,
  ambiente: Ambiente,
): Promise<void> {
  await pagina.goto(`${ambiente.enderecoDoFrontend}/#/baralhos`);
  await entrarSeNecessario(pagina, ambiente.principal);
  await irParaTela(pagina, "#/baralhos", "Baralhos");
}

/** Percorre todas as Telas das specs 012, 013 e 015 auditando cada uma no cenário dado. */
async function visitarAsTelas(
  pagina: Page,
  cenario: Cenario,
  ambiente: Ambiente,
): Promise<void> {
  // Sem Credencial, a entrada é a única Tela apresentada (FR-097).
  await pagina.goto(`${ambiente.enderecoDoFrontend}/#/baralhos`);
  await expect(
    pagina.getByRole("heading", { level: 1, name: "Entrar" }),
  ).toBeVisible({ timeout: ESPERA_DA_TELA });
  await conferirTela(pagina, cenario, "Entrar");

  // Criar conta é alcançada pelo link da Tela de entrada.
  await pagina.getByRole("link", { name: "Criar conta" }).click();
  await expect(
    pagina.getByRole("heading", { level: 1, name: "Entrar" }),
  ).toHaveCount(0, { timeout: ESPERA_DA_TELA });
  await expect(pagina.locator("main h1").first()).toBeVisible({
    timeout: ESPERA_DA_TELA,
  });
  await conferirTela(pagina, cenario, "Criar conta");

  // Entrar de novo: a Credencial vive só na memória desta página (FR-089).
  // Daqui em diante a travessia muda de Tela pelo fragmento, sem recarregar o
  // documento.
  await abrirBaralhos(pagina, ambiente);
  await conferirTela(pagina, cenario, "Baralhos");
  await conferirNavegacaoPrincipal(pagina, cenario);

  // Criar baralho: a criação saiu do formulário em linha da lista.
  await irParaTela(pagina, "#/baralhos/novo", "Criar baralho");
  await conferirTela(pagina, cenario, "Criar baralho");

  // Detalhe do Baralho com Cartões.
  await irParaTela(
    pagina,
    `#/baralhos/${ambiente.idDoBaralhoComCartoes}`,
    NOME_DO_BARALHO_COM_CARTOES,
  );
  await conferirTela(pagina, cenario, "Detalhe do Baralho");

  // Adicionar cartões existentes: os Cartões ainda sem Vínculo — entre eles a
  // Frente longa — são oferecidos por botões "Vincular <Frente>".
  await irParaRota(
    pagina,
    `#/baralhos/${ambiente.idDoBaralhoComCartoes}/adicionar`,
  );
  // O nome do `h1` desta Tela não consta dos fatos da spec 013; o botão
  // "Vincular <Frente>" é o marcador de que ela chegou, com teto explícito.
  await expect(
    pagina.getByRole("button", { name: /^Vincular / }).first(),
  ).toBeVisible({ timeout: ESPERA_DA_TELA });
  await conferirTela(pagina, cenario, "Adicionar cartões");

  // Cartões: a lista completa, com a Frente longa entre os quatro.
  await irParaTela(pagina, "#/cartoes", "Cartões");

  // Criar cartão.
  await irParaTela(pagina, "#/cartoes/novo", "Criar cartão");

  // Editar Cartão.
  await irParaTela(
    pagina,
    `#/cartoes/${ambiente.idDoCartaoEditado}/editar`,
    "Editar Cartão",
  );

  // Preferências (FR-200, FR-212): algoritmo e limite de novos por dia.
  await irParaTela(pagina, "#/preferencias", "Preferências");
  await conferirTela(pagina, cenario, "Preferências");

  // Revisão do dia (FR-198, FR-202): a tela lançada de Início.
  await irParaTela(pagina, "#/revisao", "Revisão do dia");
  await conferirTela(pagina, cenario, "Revisão do dia");

  // Estudo — configuração.
  await irParaTela(
    pagina,
    `#/baralhos/${ambiente.idDoBaralhoComCartoes}/estudo`,
    `Estudar ${NOME_DO_BARALHO_COM_CARTOES}`,
  );
  await conferirTela(pagina, cenario, "Estudo (configuração)");

  // Sessão com o Verso revelado: um único Item basta para chegar ao Resumo.
  await pagina.getByLabel("Quantidade de Cartões").fill("1");
  await pagina.getByRole("button", { name: "Iniciar Sessão" }).click();
  await expect(
    pagina.getByRole("article", { name: "Item 1 de 1" }),
  ).toBeVisible({
    timeout: ESPERA_DA_TELA,
  });
  await pagina.getByRole("button", { name: "Revelar verso" }).click();
  await expect(pagina.getByRole("heading", { name: "Verso" })).toBeVisible({
    timeout: ESPERA_DA_TELA,
  });
  await conferirTela(pagina, cenario, "Sessão (Verso revelado)");

  // Resumo: "Bom" encerra a Sessão e apresenta o balanço (FR-193, SC-088).
  await pagina.getByRole("button", { name: /^Bom/ }).click();
  await expect(
    pagina.getByRole("heading", { name: "Sessão concluída" }),
  ).toBeVisible({ timeout: ESPERA_DA_TELA });
  await conferirTela(pagina, cenario, "Resumo da Sessão");

  // A conclusão registra a Sessão no histórico: esperar a confirmação antes de
  // sair garante que o Início já conta com ela (FR-168) e que deixar o Resumo
  // não dispara "Sair sem registrar a Sessão?" (SC-076).
  await expect(
    pagina.getByRole("status", { name: "Situação do registro da Sessão" }),
  ).toContainText(/Registrada no seu histórico/, { timeout: ESPERA_DA_TELA });

  // Segunda Sessão, agora com um acerto e um erro: é ela que sustenta o
  // Registro com os dois grupos de Itens preenchidos (FR-176, FR-178).
  //
  // A rota de estudo ainda é a atual (o Resumo da primeira Sessão): reatribuir
  // o mesmo fragmento não dispara `hashchange`, e a Tela continuaria no Resumo.
  // Passar por outra rota antes garante a chegada à configuração.
  await irParaTela(pagina, "#/baralhos", "Baralhos");
  await irParaTela(
    pagina,
    `#/baralhos/${ambiente.idDoBaralhoComCartoes}/estudo`,
    `Estudar ${NOME_DO_BARALHO_COM_CARTOES}`,
  );
  await pagina.getByLabel("Quantidade de Cartões").fill("2");
  await pagina.getByRole("button", { name: "Iniciar Sessão" }).click();
  await expect(
    pagina.getByRole("article", { name: "Item 1 de 2" }),
  ).toBeVisible({
    timeout: ESPERA_DA_TELA,
  });
  await pagina.getByRole("button", { name: "Revelar verso" }).click();
  await pagina.getByRole("button", { name: /^Bom/ }).click();
  await expect(
    pagina.getByRole("article", { name: "Item 2 de 2" }),
  ).toBeVisible({
    timeout: ESPERA_DA_TELA,
  });
  await pagina.getByRole("button", { name: "Revelar verso" }).click();
  await pagina.getByRole("button", { name: /^Errei/ }).click();
  await expect(
    pagina.getByRole("heading", { name: "Sessão concluída" }),
  ).toBeVisible({ timeout: ESPERA_DA_TELA });
  await conferirTela(pagina, cenario, "Resumo da Sessão (acerto e erro)");

  await expect(
    pagina.getByRole("status", { name: "Situação do registro da Sessão" }),
  ).toContainText(/Registrada no seu histórico/, { timeout: ESPERA_DA_TELA });

  // Início com registros: o gráfico de sete dias e as Sessões recentes saem do
  // histórico recém-alimentado (FR-164, FR-165, FR-171).
  await irParaTela(
    pagina,
    "#/inicio",
    `Olá, ${ambiente.principal.nomeDeUsuario}`,
  );
  await expect(
    pagina.getByRole("heading", {
      name: "Itens estudados nos últimos 7 dias",
    }),
  ).toBeVisible({ timeout: ESPERA_DA_TELA });
  await expect(
    pagina.getByRole("heading", { name: "Últimas Sessões" }),
  ).toBeVisible({ timeout: ESPERA_DA_TELA });
  await conferirTela(pagina, cenario, "Início (com registros)");

  // O Registro da Sessão, alcançado pela lista de recentes, com os dois grupos
  // de Itens expandidos (FR-177, FR-178, SC-076).
  const linkDoRegistro = pagina.locator('a[href^="#/sessoes/"]').first();

  await expect(linkDoRegistro).toBeVisible({ timeout: ESPERA_DA_TELA });

  const hrefDoRegistro = await linkDoRegistro.getAttribute("href");

  expect(
    hrefDoRegistro,
    `${cenario.rotulo}: a lista "Últimas Sessões" não trouxe um link para o Registro`,
  ).not.toBeNull();

  // O Registro é alcançado pelo id do registro, e o `h1` da Tela é "Sessão
  // concluída", com o nome do Baralho como ele era na conclusão no parágrafo
  // acima (FR-177). Um id ausente — de outro Usuário, por exemplo — mostraria
  // "Sessão não encontrada.", e não o `h1`.
  await irParaTela(pagina, hrefDoRegistro ?? "#/inicio", "Sessão concluída");
  await expect(
    pagina.getByText(NOME_DO_BARALHO_COM_CARTOES),
  ).toBeVisible({ timeout: ESPERA_DA_TELA });

  const botaoDeAcertos = pagina.getByRole("button", { name: /^Acertos \(/ });
  const botaoDeErros = pagina.getByRole("button", { name: /^Erros \(/ });

  // A Sessão mais recente tem um acerto e um erro: os dois grupos existem e
  // podem ser abertos (um grupo vazio ficaria desabilitado).
  await expect(botaoDeAcertos).toBeEnabled({ timeout: ESPERA_DA_TELA });
  await expect(botaoDeErros).toBeEnabled({ timeout: ESPERA_DA_TELA });

  await botaoDeAcertos.click();
  await botaoDeErros.click();
  await conferirTela(pagina, cenario, "Registro da Sessão (listas abertas)");

  // Início vazio: o de um Usuário que ainda não concluiu nenhuma Sessão
  // (FR-172). Sair e Entrar com a outra Credencial troca quem está logado.
  await pagina.getByRole("button", { name: "Sair", exact: true }).click();
  await entrarSeNecessario(pagina, ambiente.semRegistros);
  await irParaTela(
    pagina,
    "#/inicio",
    `Olá, ${ambiente.semRegistros.nomeDeUsuario}`,
  );
  await expect(
    pagina.getByText("Você ainda não concluiu nenhuma Sessão."),
  ).toBeVisible({ timeout: ESPERA_DA_TELA });
  await conferirTela(pagina, cenario, "Início (sem registros)");
}

/**
 * Audita uma Tela: nenhum transbordo horizontal, todo alvo de toque com ao
 * menos 44x44 CSS px, `font-size` do `body` de ao menos 16px e nenhum resquício
 * de demonstração (FR-135, FR-136, FR-137, SC-063, SC-068, SC-070).
 */
async function conferirTela(
  pagina: Page,
  cenario: Cenario,
  tela: string,
): Promise<void> {
  const prefixo = `${cenario.rotulo} — ${tela}`;

  const auditoria = await pagina.evaluate(
    (argumentos: { alvoMinimo: number; textosProibidos: string[] }) => {
      /** Uma aproximação determinística do nome acessível do elemento. */
      const nomeAcessivel = (elemento: Element): string => {
        const rotulo = elemento.getAttribute("aria-label");
        if (rotulo !== null && rotulo.trim() !== "") {
          return rotulo.trim();
        }

        const ids = elemento.getAttribute("aria-labelledby");
        if (ids !== null && ids.trim() !== "") {
          const partes = ids
            .split(/\s+/)
            .map((id) => {
              const alvo = document.getElementById(id);
              return alvo === null ? "" : (alvo.textContent ?? "").trim();
            })
            .filter((parte) => parte !== "");

          if (partes.length > 0) {
            return partes.join(" ");
          }
        }

        const identificador = elemento.getAttribute("id");
        if (identificador !== null && identificador !== "") {
          const etiqueta = document.querySelector(
            `label[for="${CSS.escape(identificador)}"]`,
          );
          if (etiqueta !== null && (etiqueta.textContent ?? "").trim() !== "") {
            return (etiqueta.textContent ?? "").trim();
          }
        }

        const etiquetaEnvolvente = elemento.closest("label");
        if (
          etiquetaEnvolvente !== null &&
          (etiquetaEnvolvente.textContent ?? "").trim() !== ""
        ) {
          return (etiquetaEnvolvente.textContent ?? "").trim();
        }

        const tag = elemento.tagName;

        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
          const alternativa =
            elemento.getAttribute("placeholder") ??
            elemento.getAttribute("name") ??
            elemento.getAttribute("value") ??
            elemento.getAttribute("alt");

          if (alternativa !== null && alternativa.trim() !== "") {
            return alternativa.trim();
          }
        }

        const texto = (elemento.textContent ?? "").trim().replace(/\s+/g, " ");
        if (texto !== "") {
          return texto;
        }

        return "(sem nome acessível)";
      };

      const estaVisivel = (elemento: Element, caixa: DOMRect): boolean => {
        if (caixa.width <= 0 || caixa.height <= 0) {
          return false;
        }

        const estilo = getComputedStyle(elemento);

        if (estilo.visibility === "hidden" || estilo.display === "none") {
          return false;
        }

        if (Number(estilo.opacity) === 0) {
          return false;
        }

        return true;
      };

      const pequenos: { nome: string; tag: string; caixa: string }[] = [];

      for (const elemento of Array.from(
        document.querySelectorAll("button, a, input, textarea, select"),
      )) {
        // Links de texto no meio de um parágrafo são dispensados (SC-063).
        if (elemento.tagName === "A" && elemento.closest("p") !== null) {
          continue;
        }

        const caixa = elemento.getBoundingClientRect();

        if (!estaVisivel(elemento, caixa)) {
          continue;
        }

        if (
          caixa.width >= argumentos.alvoMinimo &&
          caixa.height >= argumentos.alvoMinimo
        ) {
          continue;
        }

        pequenos.push({
          nome: nomeAcessivel(elemento),
          tag: elemento.tagName.toLowerCase(),
          caixa: `${caixa.width.toFixed(1)}x${caixa.height.toFixed(1)}`,
        });
      }

      const raiz = document.documentElement;
      const corpo = document.body;
      const textoDoCorpo = (corpo.innerText ?? "").toLowerCase();

      const proibidos = argumentos.textosProibidos.filter((proibido) =>
        textoDoCorpo.includes(proibido.toLowerCase()),
      );

      return {
        transbordo: {
          scrollWidth: raiz.scrollWidth,
          clientWidth: raiz.clientWidth,
        },
        pequenos,
        tamanhoDaFonteDoCorpo: Number.parseFloat(
          getComputedStyle(corpo).fontSize,
        ),
        proibidos,
        temSeletorDeCor:
          document.querySelector('input[type="color"]') !== null,
      };
    },
    { alvoMinimo: ALVO_MINIMO_DE_TOQUE, textosProibidos: TEXTOS_PROIBIDOS },
  );

  expect(
    auditoria.transbordo.scrollWidth,
    `${prefixo}: transbordo horizontal — scrollWidth ${auditoria.transbordo.scrollWidth}px > clientWidth ${auditoria.transbordo.clientWidth}px`,
  ).toBeLessThanOrEqual(auditoria.transbordo.clientWidth);

  expect(
    auditoria.tamanhoDaFonteDoCorpo,
    `${prefixo}: o font-size do body é ${auditoria.tamanhoDaFonteDoCorpo}px, abaixo de ${TAMANHO_MINIMO_DA_FONTE}px`,
  ).toBeGreaterThanOrEqual(TAMANHO_MINIMO_DA_FONTE);

  expect(
    auditoria.proibidos,
    `${prefixo}: resquícios de demonstração visíveis (SC-070): ${auditoria.proibidos.join(", ")}`,
  ).toEqual([]);

  expect(
    auditoria.temSeletorDeCor,
    `${prefixo}: há um seletor de cor visível (input[type=color]); o produto não expõe escolha de tema (SC-070)`,
  ).toBe(false);

  const infratores = auditoria.pequenos
    .map((item) => `  - "${item.nome}" <${item.tag}> ${item.caixa} CSS px`)
    .join("\n");

  expect(
    auditoria.pequenos.length,
    `${prefixo}: alvos de toque abaixo de ${ALVO_MINIMO_DE_TOQUE}x${ALVO_MINIMO_DE_TOQUE} CSS px (SC-063):\n${infratores}`,
  ).toBe(0);
}

/**
 * Confere a Navegação "Principal": no celular (390) ela está fixa no rodapé da
 * janela; no desktop (1440) ela fica dentro do cabeçalho.
 */
async function conferirNavegacaoPrincipal(
  pagina: Page,
  cenario: Cenario,
): Promise<void> {
  const navegacao = pagina.getByRole("navigation", { name: "Principal" });

  await expect(navegacao).toBeVisible();

  if (cenario.largura === 390) {
    // A Navegação "Principal" passou a ter quatro destinos — Início, Baralhos,
    // Cartões e Preferências, nessa ordem — e os quatro precisam caber no
    // rodapé sem transbordo (FR-212, SC-076, SC-088).
    const destinos = navegacao.getByRole("link");

    await expect(destinos).toHaveCount(4);
    await expect(destinos.nth(0)).toHaveText("Início");
    await expect(destinos.nth(1)).toHaveText("Baralhos");
    await expect(destinos.nth(2)).toHaveText("Cartões");
    await expect(destinos.nth(3)).toHaveText("Preferências");

    const medidasDaNavegacao = await navegacao.evaluate((elemento) => {
      const links = Array.from(elemento.querySelectorAll("a")).map((link) => ({
        nome: (link.textContent ?? "").trim().replace(/\s+/g, " "),
        scrollWidth: link.scrollWidth,
        clientWidth: link.clientWidth,
      }));

      return {
        scrollWidth: elemento.scrollWidth,
        clientWidth: elemento.clientWidth,
        links,
      };
    });

    expect(
      medidasDaNavegacao.scrollWidth,
      `${cenario.rotulo}: a navegação "Principal" transborda no rodapé — scrollWidth ${medidasDaNavegacao.scrollWidth}px > clientWidth ${medidasDaNavegacao.clientWidth}px`,
    ).toBeLessThanOrEqual(medidasDaNavegacao.clientWidth);

    const linksApertados = medidasDaNavegacao.links
      .filter((link) => link.scrollWidth > link.clientWidth + 1)
      .map(
        (link) =>
          `  - "${link.nome}" (${link.scrollWidth}px > ${link.clientWidth}px)`,
      );

    expect(
      linksApertados,
      `${cenario.rotulo}: links da navegação "Principal" sem caber na própria caixa (SC-076):\n${linksApertados.join("\n")}`,
    ).toEqual([]);

    const caixa = await navegacao.boundingBox();

    expect(
      caixa,
      `${cenario.rotulo}: a navegação "Principal" não tem caixa visível`,
    ).not.toBeNull();

    if (caixa === null) {
      return;
    }

    const alturaDaJanela = await pagina.evaluate(() => window.innerHeight);
    const base = caixa.y + caixa.height;

    expect(
      Math.abs(base - alturaDaJanela),
      `${cenario.rotulo}: a navegação "Principal" deveria estar fixa no rodapé da janela (base ${base.toFixed(1)}px, janela ${alturaDaJanela}px)`,
    ).toBeLessThanOrEqual(2);
  }

  if (cenario.largura === 1440) {
    await expect(
      pagina.locator("header").getByRole("navigation", { name: "Principal" }),
      `${cenario.rotulo}: a navegação "Principal" deveria estar dentro do cabeçalho`,
    ).toHaveCount(1);
  }
}

/**
 * Confere os pares de contraste do tema contra a WCAG (FR-135, SC-068): lê as
 * custom properties do `:root`, resolve cada cor para `rgb()` e calcula a razão
 * de contraste no próprio teste. Relata todos os pares e razões quando falha.
 */
async function conferirContraste(pagina: Page): Promise<void> {
  const cores = await pagina.evaluate((nomes: string[]) => {
    const raiz = getComputedStyle(document.documentElement);

    // A sonda normaliza qualquer notação de cor (`oklch`, `color-mix`…) para o
    // `rgb()` que o navegador serializa em `color`.
    const sonda = document.createElement("span");

    sonda.setAttribute("aria-hidden", "true");
    sonda.style.position = "absolute";
    sonda.style.left = "-9999px";
    sonda.style.top = "0";
    sonda.style.pointerEvents = "none";
    document.body.appendChild(sonda);

    const amostras: Record<string, { bruto: string; resolvido: string }> = {};

    for (const nome of nomes) {
      const bruto = raiz.getPropertyValue(nome).trim();

      sonda.style.color = "";
      sonda.style.color = `var(${nome})`;
      const resolvido = getComputedStyle(sonda).color;

      amostras[nome] = { bruto, resolvido };
    }

    sonda.remove();

    return amostras;
  }, NOMES_DE_COR);

  const ausentes = NOMES_DE_COR.filter(
    (nome) => (cores[nome]?.bruto ?? "") === "",
  );

  expect(
    ausentes,
    `as variáveis de cor do tema precisam existir no :root; faltam: ${ausentes.join(", ")}`,
  ).toEqual([]);

  const pares: { frente: string; fundo: string; minimo: number; uso: string }[] =
    [];

  for (const frente of [
    "--text",
    "--muted",
    "--accent",
    "--danger",
    "--success",
  ]) {
    for (const fundo of ["--bg", "--surface", "--surface-2"]) {
      pares.push({ frente, fundo, minimo: 4.5, uso: "texto (WCAG AA)" });
    }
  }

  pares.push({
    frente: "--on-accent",
    fundo: "--accent",
    minimo: 4.5,
    uso: "texto sobre o realce (WCAG AA)",
  });
  pares.push({
    frente: "--border",
    fundo: "--bg",
    minimo: 3,
    uso: "componente de interface (WCAG 1.4.11)",
  });
  pares.push({
    frente: "--border",
    fundo: "--surface",
    minimo: 3,
    uso: "componente de interface (WCAG 1.4.11)",
  });

  const linhas: string[] = [];
  const falhas: string[] = [];

  for (const par of pares) {
    const amostraDaFrente = cores[par.frente];
    const amostraDoFundo = cores[par.fundo];

    if (amostraDaFrente === undefined || amostraDoFundo === undefined) {
      falhas.push(
        `${par.frente} sobre ${par.fundo}: cor ausente, não foi possível calcular`,
      );
      continue;
    }

    const razao = razaoDeContraste(
      amostraDaFrente.resolvido,
      amostraDoFundo.resolvido,
    );
    const arredondada = Number(razao.toFixed(2));
    const linha = `${par.frente} sobre ${par.fundo}: ${arredondada.toFixed(2)}:1 (mínimo ${par.minimo}:1, ${par.uso})`;

    linhas.push(linha);

    if (arredondada < par.minimo) {
      falhas.push(linha);
    }
  }

  expect(
    falhas,
    `contraste WCAG insuficiente nos pares abaixo (todos os pares avaliados em seguida):\n${linhas.join("\n")}`,
  ).toEqual([]);
}

/** A razão de contraste WCAG entre duas cores CSS. */
function razaoDeContraste(frente: string, fundo: string): number {
  const luminanciaDaFrente = luminanciaRelativa(canaisDaCor(frente));
  const luminanciaDoFundo = luminanciaRelativa(canaisDaCor(fundo));

  const maisClara = Math.max(luminanciaDaFrente, luminanciaDoFundo);
  const maisEscura = Math.min(luminanciaDaFrente, luminanciaDoFundo);

  return (maisClara + 0.05) / (maisEscura + 0.05);
}

/** A luminância relativa da WCAG para uma cor em sRGB (0–255 por canal). */
function luminanciaRelativa(canais: [number, number, number]): number {
  const linearizar = (canal: number): number => {
    const normalizado = canal / 255;

    return normalizado <= 0.03928
      ? normalizado / 12.92
      : Math.pow((normalizado + 0.055) / 1.055, 2.4);
  };

  const [vermelho, verde, azul] = canais;

  return (
    0.2126 * linearizar(vermelho) +
    0.7152 * linearizar(verde) +
    0.0722 * linearizar(azul)
  );
}

/** Lê os canais 0–255 de uma cor serializada como `rgb()`, `rgba()` ou hex. */
function canaisDaCor(valor: string): [number, number, number] {
  const texto = valor.trim();

  const rgb = /^rgba?\(([^)]+)\)$/i.exec(texto);

  if (rgb !== null) {
    const dentro = rgb[1] ?? "";
    const partes = dentro
      .split(/[\s,/]+/)
      .filter((parte) => parte !== "")
      .map((parte) => Number.parseFloat(parte));

    const [vermelho, verde, azul] = partes;

    if (
      vermelho === undefined ||
      verde === undefined ||
      azul === undefined ||
      Number.isNaN(vermelho) ||
      Number.isNaN(verde) ||
      Number.isNaN(azul)
    ) {
      throw new Error(`cor rgb não reconhecida para o contraste: "${valor}"`);
    }

    return [vermelho, verde, azul];
  }

  const hexadecimal = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(texto);

  if (hexadecimal !== null) {
    const digitos = hexadecimal[1] ?? "";

    if (digitos.length === 3) {
      const expandir = (digito: string): number =>
        Number.parseInt(digito.repeat(2), 16);

      return [
        expandir(digitos.charAt(0)),
        expandir(digitos.charAt(1)),
        expandir(digitos.charAt(2)),
      ];
    }

    return [
      Number.parseInt(digitos.slice(0, 2), 16),
      Number.parseInt(digitos.slice(2, 4), 16),
      Number.parseInt(digitos.slice(4, 6), 16),
    ];
  }

  throw new Error(
    `cor não reconhecida para o cálculo de contraste: "${valor}" (esperado rgb() ou #rrggbb)`,
  );
}
