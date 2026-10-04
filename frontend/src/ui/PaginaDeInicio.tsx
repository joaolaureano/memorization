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
import {
  ResumoDeSeteDias,
  useEstatisticasDoEstudo,
} from "./EstatisticasDoEstudo";

/**
 * A tela de Início, agora compacta (FR-308..FR-311, FR-318, FR-320, FR-321).
 *
 * O Início deixou de ser o painel do estudo inteiro e passou a ser o seu
 * resumo: o cumprimento com a data de hoje, a linha dos últimos sete dias, a
 * Revisão do dia e a Agenda de hoje. O gráfico da semana, o calendário e as
 * últimas Sessões foram para a área Estudo (`#/estudo`), onde cabem (FR-309,
 * FR-313).
 *
 * A linha dos sete dias vem do módulo `EstatisticasDoEstudo` — o mesmo que
 * serve a área Estudo —, para que as duas telas contem a mesma história a partir
 * da mesma leitura. Não há aqui nenhuma janela nem nenhum `agora`: o hook cuida
 * do ciclo de vida da leitura e devolve o resumo pronto (FR-308, FR-321).
 *
 * O que a tela acrescenta é a Revisão do dia (FR-310, FR-318): um resumo lido
 * por conta própria, com estado independente das Estatísticas. A falha de um não
 * esconde o outro, e cada bloco oferece o seu «Tentar novamente». A leitura se
 * refaz quando a aba volta a ficar visível e um segundo depois da meia-noite
 * local, sem que a pessoa precise recarregar a tela (FR-320).
 *
 * O acervo vazio não ganha números: no lugar dos totais aparece o convite a
 * criar o primeiro Cartão (FR-321). A Agenda de hoje (016) fica logo depois da
 * Revisão, na ordem em que o estudo do dia acontece (FR-310, FR-311).
 */

/** O estado da leitura do resumo da Revisão do dia (FR-310). */
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
  const { estado, tentarNovamente } = useEstatisticasDoEstudo(cliente);
  const [revisao, setRevisao] = useState<EstadoDaRevisao>({
    dados: null,
    carregando: true,
    falha: null,
  });

  // Cada leitura leva um número, e só a última pode mexer no estado: é o que
  // descarta a resposta de uma leitura antiga que chegue depois da mais nova.
  const leituraDaRevisao = useRef(0);

  // Depois da desmontagem não há mais estado para atualizar.
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;

    return () => {
      montado.current = false;
    };
  }, []);

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

  const estatisticas = estado.dados?.estatisticas ?? null;

  return (
    <div className="pagina">
      <div className="cabecalho-da-pagina">
        <p className="sobretitulo">Seu estudo</p>
        <h1>Olá, {nomeDeUsuario}</h1>
        <p className="texto-secundario">{dataDeHoje()}</p>

        {estado.dados === null && estado.carregando ? (
          <p className="carregando" role="status">
            Carregando o seu estudo…
          </p>
        ) : null}

        {estado.dados === null &&
        !estado.carregando &&
        estado.falha !== null ? (
          <EstadoDaCarga
            estado="falha"
            mensagem={estado.falha}
            aoTentarNovamente={tentarNovamente}
          />
        ) : null}

        {estatisticas !== null ? (
          <>
            <ResumoDeSeteDias estatisticas={estatisticas} />

            {estado.falha !== null ? (
              <>
                <p className="aviso aviso--erro" role="alert">
                  Não foi possível atualizar o resumo. {estado.falha}
                </p>
                <button
                  type="button"
                  className="botao botao--secundario"
                  onClick={tentarNovamente}
                >
                  Tentar novamente
                </button>
              </>
            ) : null}

            {estatisticas.cartoes === 0 ? (
              <p>
                <a className="botao botao--primario" href="#/cartoes/novo">
                  Criar o primeiro Cartão
                </a>
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {/* A Revisão do dia vem antes da Agenda de hoje (FR-310, FR-311), cada
          bloco com estado e contagens próprios. */}
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
 * O bloco "Revisão do dia" de Início (FR-310, FR-320).
 *
 * Tem estado próprio, independente das Estatísticas: a falha de um não impede o
 * outro de aparecer, e cada um oferece o seu "Tentar novamente" (FR-320). O
 * resumo lido diz quantos Cartões vencem hoje e quantos novos ainda cabem no
 * limite do dia.
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
 * O resumo já carregado: quantos vencem hoje, quantos novos entram e o caminho
 * para revisar (FR-310).
 *
 * Quando não há nada para revisar, o botão deixa de ser um link e passa a
 * anunciar-se indisponível, com a explicação associada por `aria-describedby`
 * — a indisponibilidade não fica só na cor (FR-310, FR-324).
 */
function ResumoDoDia({ resumo }: { resumo: ResumoDaRevisao }) {
  const nadaParaRevisar = resumo.total === 0;

  return (
    <div className="pilha">
      <div>
        <h3 className="titulo-do-item">{tituloDaRevisao(resumo)}</h3>
        {nadaParaRevisar ? (
          <p className="texto-secundario" id="explicacao-da-revisao">
            Não há Cartões vencidos nem Cartões novos disponíveis hoje.
          </p>
        ) : (
          <p className="texto-secundario">{textoDeNovos(resumo.novosHoje)}</p>
        )}
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

/** O título do bloco, derivado dos vencidos (FR-310). */
function tituloDaRevisao(resumo: ResumoDaRevisao): string {
  if (resumo.total === 0) {
    return "Nada para revisar hoje";
  }

  if (resumo.vencidos === 0) {
    return "Nenhum Cartão vencido hoje";
  }

  if (resumo.vencidos === 1) {
    return "1 Cartão para revisar hoje";
  }

  return `${resumo.vencidos} Cartões para revisar hoje`;
}

/** O texto dos Cartões novos de hoje, no singular e no plural (FR-310). */
function textoDeNovos(novos: number): string {
  if (novos === 0) {
    return "Nenhum Cartão novo entra hoje";
  }

  if (novos === 1) {
    return "1 Cartão novo entra hoje";
  }

  return `${novos} Cartões novos entram hoje`;
}

/** O estado depois de uma leitura que falhou: a falha aparece, os dados ficam. */
function estadoDeFalhaDaRevisao(
  anterior: EstadoDaRevisao,
  mensagem: string,
): EstadoDaRevisao {
  return { ...anterior, carregando: false, falha: mensagem };
}

/** A data local de hoje por extenso, no formato de pt-BR (FR-308). */
function dataDeHoje(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
