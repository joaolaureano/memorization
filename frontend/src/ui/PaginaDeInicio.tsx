import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ClienteDoAcervo,
  InicioDeCompromisso,
  ResumoDaRevisao,
} from "../acervo-cliente/cliente";
import { MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO } from "../acervo-cliente/cliente";
import { limitesDoDia } from "../revisao/dia";
import { AgendaDeEstudo } from "./AgendaDeEstudo";
import { EstadoDaCarga } from "./EstadoDaCarga";

/**
 * A tela de Início da feature 020: o dia de hoje, e só ele (FR-330, FR-331).
 *
 * O Início deixou de ser o painel do estudo inteiro. Ele é, agora, o
 * cumprimento, a Revisão do dia e a Agenda de hoje, numa coluna única — o que
 * se faz hoje. O resumo dos últimos sete dias, o gráfico da semana, o
 * calendário e as últimas Sessões foram para a área Estudo (`#/estudo`), onde
 * cabem, e com eles saiu a leitura das Estatísticas: Início não lê Registros
 * nem Estatísticas (FR-330).
 *
 * A única leitura do cabeçalho é `listarCartoes`, e ela não alimenta número
 * nenhum: serve para saber se o acervo está vazio. Vazio — e só vazio —, o
 * cabeçalho convida a criar o primeiro Cartão. A falha dessa leitura não é um
 * acervo vazio: não convida e não anuncia nada, porque quem não conseguiu ler
 * o acervo não sabe se há Cartões (FR-330).
 *
 * A Revisão do dia (FR-331) conta pelo total elegível — os vencidos mais os
 * novos que ainda cabem no dia —, que é o número de Cartões que a Revisão
 * efetivamente abre. Sem nada elegível, o resumo diz «Nada para revisar.» e o
 * «Revisar» deixa de ser link: vira um botão desabilitado que se anuncia
 * indisponível pela explicação associada por `aria-describedby`, e não só pela
 * cor. O bloco não reparte o total entre vencidos e novos: quem quer esse
 * detalhe está em `#/revisao`.
 *
 * O resumo da Revisão é lido por conta própria, com estado independente da
 * Agenda. A falha de um não esconde o outro, e cada bloco oferece o seu
 * «Tentar novamente». A leitura se refaz quando a aba volta a ficar visível e
 * um segundo depois da meia-noite local, sem que a pessoa precise recarregar a
 * tela (FR-320).
 */

/** O estado da leitura do resumo da Revisão do dia (FR-331). */
interface EstadoDaRevisao {
  /** O último resumo lido com sucesso, ou `null` antes da primeira leitura. */
  dados: ResumoDaRevisao | null;
  /** `true` enquanto uma leitura está em curso. */
  carregando: boolean;
  /** A mensagem da última falha, ou `null` quando a última leitura deu certo. */
  falha: string | null;
}

export function PaginaDeInicio({
  cliente,
  nomeDeUsuario,
  aoIniciarEstudo,
}: {
  cliente: ClienteDoAcervo;
  nomeDeUsuario: string;
  /** Abre a Sessão de um Compromisso da Agenda (016, FR-231). */
  aoIniciarEstudo?: (inicio: InicioDeCompromisso) => void;
}) {
  const [revisao, setRevisao] = useState<EstadoDaRevisao>({
    dados: null,
    carregando: true,
    falha: null,
  });

  // `true` só depois de uma leitura do acervo que deu certo e não achou Cartão
  // nenhum: nem a falha nem a leitura em curso convidam a criar o primeiro
  // Cartão (FR-330).
  const [acervoVazio, setAcervoVazio] = useState(false);

  // Cada leitura leva um número, e só a última pode mexer no estado: é o que
  // descarta a resposta de uma leitura antiga que chegue depois da mais nova.
  const leituraDaRevisao = useRef(0);
  const leituraDoAcervo = useRef(0);

  // Depois da desmontagem não há mais estado para atualizar.
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;

    return () => {
      montado.current = false;
    };
  }, []);

  const carregarAcervo = useCallback(async () => {
    leituraDoAcervo.current += 1;
    const numeroDestaLeitura = leituraDoAcervo.current;

    let resultado: Awaited<ReturnType<ClienteDoAcervo["listarCartoes"]>>;

    try {
      resultado = await cliente.listarCartoes();
    } catch {
      // O cliente pode lançar em vez de devolver uma falha; para quem lê, o
      // efeito é o mesmo — e nunca um convite enganoso.
      if (numeroDestaLeitura !== leituraDoAcervo.current || !montado.current) {
        return;
      }

      setAcervoVazio(false);

      return;
    }

    if (numeroDestaLeitura !== leituraDoAcervo.current || !montado.current) {
      return;
    }

    // A falha não é um acervo vazio: sem leitura de sucesso, o cabeçalho não
    // convida a nada (FR-330).
    setAcervoVazio(resultado.ok && resultado.cartoes.length === 0);
  }, [cliente]);

  // A leitura começa junto com a montagem.
  useEffect(() => {
    void carregarAcervo();
  }, [carregarAcervo]);

  const carregarRevisao = useCallback(async () => {
    leituraDaRevisao.current += 1;
    const numeroDestaLeitura = leituraDaRevisao.current;

    // Os dados anteriores continuam à vista enquanto a leitura corre: trocar o
    // painel por um "Carregando" apagaria um resumo que continua verdadeiro.
    setRevisao((anterior) => ({ ...anterior, carregando: true }));

    // Os limites do dia vêm do fuso do navegador (FR-204), e é o mesmo instante
    // que decide o corte da meia-noite e o período pedido ao servidor.
    const { inicioDoDia, fimDoDia } = limitesDoDia(new Date());

    let resultado: Awaited<
      ReturnType<ClienteDoAcervo["obterResumoDaRevisao"]>
    >;

    try {
      resultado = await cliente.obterResumoDaRevisao(inicioDoDia, fimDoDia);
    } catch {
      // O cliente pode lançar em vez de devolver uma falha; para quem lê, o
      // efeito é o mesmo — e nunca um zero silencioso.
      if (numeroDestaLeitura !== leituraDaRevisao.current || !montado.current) {
        return;
      }

      setRevisao((anterior) =>
        estadoDeFalhaDaRevisao(
          anterior,
          MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO,
        ),
      );

      return;
    }

    if (numeroDestaLeitura !== leituraDaRevisao.current || !montado.current) {
      return;
    }

    if (!resultado.ok) {
      // A falha aparece, mas o que já estava na tela fica onde está: o resumo
      // anterior continua valendo até que uma leitura nova o substitua.
      const mensagem = resultado.mensagem;

      setRevisao((anterior) => estadoDeFalhaDaRevisao(anterior, mensagem));

      return;
    }

    setRevisao({ dados: resultado.resumo, carregando: false, falha: null });
  }, [cliente]);

  // A leitura começa junto com a montagem.
  useEffect(() => {
    void carregarRevisao();
  }, [carregarRevisao]);

  // Volta da aba: o dia pode ter virado enquanto a tela dormia (FR-320).
  useEffect(() => {
    function aoVoltarAVisibilidade() {
      if (document.visibilityState === "visible") {
        void carregarRevisao();
      }
    }

    document.addEventListener("visibilitychange", aoVoltarAVisibilidade);

    return () => {
      document.removeEventListener("visibilitychange", aoVoltarAVisibilidade);
    };
  }, [carregarRevisao]);

  // Virada do dia: um segundo depois da meia-noite local, a leitura se refaz
  // para que a Revisão acompanhe o novo dia (FR-320). O temporizador se rearma
  // a cada leitura bem-sucedida, e o atraso vem do relógio local.
  useEffect(() => {
    const agora = new Date();
    const proximaMeiaNoite = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      agora.getDate() + 1,
    );
    const atraso = proximaMeiaNoite.getTime() - agora.getTime() + 1000;

    const temporizador = window.setTimeout(() => {
      void carregarRevisao();
    }, atraso);

    return () => {
      window.clearTimeout(temporizador);
    };
  }, [carregarRevisao, revisao.dados]);

  const tentarNovamenteRevisao = useCallback(() => {
    void carregarRevisao();
  }, [carregarRevisao]);

  return (
    <div className="pagina">
      {/* O cabeçalho é o cumprimento e, quando o acervo está vazio, o convite
          a criar o primeiro Cartão — nada além disso (FR-330). */}
      <div className="inicio__cabecalho">
        <h1>Olá, {nomeDeUsuario}</h1>

        {acervoVazio ? (
          <p>
            <a className="botao botao--primario" href="#/cartoes/novo">
              Criar o primeiro Cartão
            </a>
          </p>
        ) : null}
      </div>

      {/* A Revisão do dia vem antes da Agenda de hoje (FR-330, FR-331), numa
          coluna única, cada bloco com estado e contagens próprios. */}
      <div className="inicio__blocos">
        <BlocoDaRevisaoDoDia
          revisao={revisao}
          aoTentarNovamente={tentarNovamenteRevisao}
        />

        <AgendaDeEstudo
          cliente={cliente}
          modo="hoje"
          aoIniciarEstudo={aoIniciarEstudo}
        />
      </div>
    </div>
  );
}

/**
 * O bloco "Revisão do dia" de Início (FR-320, FR-331).
 *
 * Tem estado próprio, independente da Agenda: a falha de um não impede o outro
 * de aparecer, e cada um oferece o seu "Tentar novamente" (FR-320). O resumo
 * lido diz quantos Cartões a Revisão abre hoje — os vencidos e os novos que
 * ainda caibam no limite do dia.
 */
function BlocoDaRevisaoDoDia({
  revisao,
  aoTentarNovamente,
}: {
  revisao: EstadoDaRevisao;
  aoTentarNovamente: () => void;
}) {
  return (
    <section className="cartao" aria-labelledby="rotulo-da-revisao">
      <h2 id="rotulo-da-revisao">Revisão do dia</h2>

      {revisao.dados === null && revisao.carregando ? (
        <EstadoDaCarga
          estado="carregando"
          mensagem="Carregando a revisão do dia…"
        />
      ) : null}

      {revisao.dados === null &&
      !revisao.carregando &&
      revisao.falha !== null ? (
        <EstadoDaCarga
          estado="falha"
          mensagem={revisao.falha}
          aoTentarNovamente={aoTentarNovamente}
        />
      ) : null}

      {revisao.dados !== null ? (
        <>
          {revisao.falha !== null ? (
            <p className="aviso aviso--erro" role="alert">
              Não foi possível atualizar a revisão do dia. {revisao.falha}
            </p>
          ) : null}
          <ResumoDoDia resumo={revisao.dados} />
        </>
      ) : null}
    </section>
  );
}

/**
 * O resumo já carregado: quantos Cartões a Revisão abre hoje e o caminho para
 * revisar (FR-331).
 *
 * O número é o **total elegível**, e não os vencidos: é o que a Revisão
 * efetivamente apresenta. Quando esse total é zero, o botão deixa de ser um
 * link e passa a anunciar-se indisponível, com a explicação associada por
 * `aria-describedby` — a indisponibilidade não fica só na cor (FR-324).
 */
function ResumoDoDia({ resumo }: { resumo: ResumoDaRevisao }) {
  const nadaParaRevisar = resumo.total === 0;

  return (
    <div className="pilha">
      <div>
        {/* Sem nada para revisar, é o próprio título que explica a
            indisponibilidade do botão logo abaixo (FR-331). */}
        <h3
          className="titulo-do-item"
          id={nadaParaRevisar ? "explicacao-da-revisao" : undefined}
        >
          {tituloDaRevisao(resumo)}
        </h3>
      </div>

      {nadaParaRevisar ? (
        <button
          type="button"
          className="botao botao--secundario"
          disabled
          aria-describedby="explicacao-da-revisao"
        >
          Revisar
        </button>
      ) : (
        <a className="botao botao--primario" href="#/revisao">
          Revisar
        </a>
      )}
    </div>
  );
}

/** O título do bloco, derivado do total elegível (FR-331). */
function tituloDaRevisao(resumo: ResumoDaRevisao): string {
  if (resumo.total === 0) {
    return "Nada para revisar.";
  }

  if (resumo.total === 1) {
    return "1 Cartão para revisar";
  }

  return `${resumo.total} Cartões para revisar`;
}

/** O estado depois de uma leitura que falhou: a falha aparece, os dados ficam. */
function estadoDeFalhaDaRevisao(
  anterior: EstadoDaRevisao,
  mensagem: string,
): EstadoDaRevisao {
  return { ...anterior, carregando: false, falha: mensagem };
}
