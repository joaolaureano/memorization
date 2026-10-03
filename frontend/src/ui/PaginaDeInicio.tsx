import { useCallback, useEffect, useState } from "react";

import type {
  ClienteDoAcervo,
  Estatisticas,
  RegistroResumido,
  ResumoDaRevisao,
} from "../acervo-cliente/cliente";
import {
  inicioDaJanela,
  itensPorDia,
  taxaDeAcerto,
} from "../estatisticas/estatisticas";
import { limitesDoDia } from "../revisao/dia";
import { EstadoDaCarga } from "./EstadoDaCarga";

/**
 * A tela de Início (FR-164, FR-165, FR-168..FR-173).
 *
 * É o retrato do estudo: o tamanho atual do acervo, a taxa de acerto e os Itens
 * estudados nos últimos sete dias, mais as Sessões mais recentes. A tela não
 * deriva nada por conta própria — pede as Estatísticas ao `ClienteDoAcervo` com
 * o início da janela e desenha o que voltou (FR-164).
 *
 * O que ela acrescenta à resposta é a leitura: a `taxaDeAcerto` sobre os
 * Registros da janela (FR-170) e o `itensPorDia` que dá corpo ao gráfico
 * (FR-171). As duas contas vêm do módulo puro `estatisticas`, para que a tela
 * não invente aritmética própria nem dependa do relógio de quem a abre.
 *
 * O cabeçalho fica fora do estado da carga: mesmo quando a leitura falha, a
 * página continua sendo a de Início, com a navegação da Moldura à vista e o
 * caminho de tentar de novo (FR-173).
 *
 * O bloco "Revisão do dia" (FR-198, FR-199) fica no topo do conteúdo, antes
 * das Estatísticas, e tem estado próprio: uma falha nele não esconde os
 * números, e uma falha nos números não o esconde (FR-217).
 */

/** O estado da leitura das Estatísticas, do pedido à resposta (FR-164). */
type EstadoDoInicio =
  | { estado: "carregando" }
  | { estado: "falha"; mensagem: string }
  | { estado: "pronta"; estatisticas: Estatisticas; agora: Date };

/** O estado da leitura do resumo da Revisão do dia, do pedido à resposta (FR-198). */
type EstadoDaRevisao =
  | { estado: "carregando" }
  | { estado: "falha"; mensagem: string }
  | { estado: "pronta"; resumo: ResumoDaRevisao };

/** Quantas Sessões recentes a tela apresenta (FR-165). */
const SESSOES_RECENTES = 5;

export function PaginaDeInicio({
  cliente,
  nomeDeUsuario,
}: {
  cliente: ClienteDoAcervo;
  nomeDeUsuario: string;
}) {
  const [inicio, setInicio] = useState<EstadoDoInicio>({ estado: "carregando" });
  const [revisao, setRevisao] = useState<EstadoDaRevisao>({
    estado: "carregando",
  });

  const carregarEstatisticas = useCallback(async () => {
    setInicio({ estado: "carregando" });

    // Um só `agora` decide a janela pedida e o desenho do gráfico: fossem dois
    // instantes, a última coluna poderia ficar fora do que foi pedido.
    const agora = new Date();
    const resultado = await cliente.obterEstatisticas(
      inicioDaJanela(agora).toISOString(),
    );

    setInicio(
      resultado.ok
        ? { estado: "pronta", estatisticas: resultado.estatisticas, agora }
        : { estado: "falha", mensagem: resultado.mensagem },
    );
  }, [cliente]);

  const carregarRevisao = useCallback(async () => {
    setRevisao({ estado: "carregando" });

    // Os limites do dia vêm do fuso do navegador (FR-204), e é o mesmo `agora`
    // que decide o corte da meia-noite e o instante pedido ao servidor.
    const { inicioDoDia, fimDoDia } = limitesDoDia(new Date());
    const resultado = await cliente.obterResumoDaRevisao(inicioDoDia, fimDoDia);

    setRevisao(
      resultado.ok
        ? { estado: "pronta", resumo: resultado.resumo }
        : { estado: "falha", mensagem: resultado.mensagem },
    );
  }, [cliente]);

  // Duas cargas independentes: falhar numa não deixa a outra sem caminho, e o
  // "Tentar novamente" de cada bloco só refaz a sua leitura (FR-217).
  useEffect(() => {
    void carregarEstatisticas();
  }, [carregarEstatisticas]);

  useEffect(() => {
    void carregarRevisao();
  }, [carregarRevisao]);

  const tentarNovamenteEstatisticas = useCallback(() => {
    void carregarEstatisticas();
  }, [carregarEstatisticas]);

  const tentarNovamenteRevisao = useCallback(() => {
    void carregarRevisao();
  }, [carregarRevisao]);

  return (
    <div className="pagina">
      <div className="cabecalho-da-pagina">
        <div>
          <p className="sobretitulo">Seu estudo</p>
          <h1>Olá, {nomeDeUsuario}</h1>
        </div>
      </div>

      <BlocoDaRevisaoDoDia
        revisao={revisao}
        aoTentarNovamente={tentarNovamenteRevisao}
      />

      {inicio.estado === "carregando" ? (
        <EstadoDaCarga estado="carregando" mensagem="Carregando o seu estudo…" />
      ) : null}

      {inicio.estado === "falha" ? (
        <EstadoDaCarga
          estado="falha"
          mensagem={inicio.mensagem}
          aoTentarNovamente={tentarNovamenteEstatisticas}
        />
      ) : null}

      {inicio.estado === "pronta" ? (
        <PainelDoInicio
          estatisticas={inicio.estatisticas}
          agora={inicio.agora}
        />
      ) : null}
    </div>
  );
}

/**
 * O bloco "Revisão do dia" de Início (FR-198, FR-199, FR-202, FR-217).
 *
 * Tem estado próprio, independente das Estatísticas: a falha de um não impede
 * o outro de aparecer, e cada um oferece o seu "Tentar novamente" (FR-217). O
 * resumo lido diz quantos Cartões vencem hoje e quantos novos ainda cabem no
 * limite do dia (FR-198, FR-199).
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
      <p className="sobretitulo" id="rotulo-da-revisao">
        Revisão do dia
      </p>

      {revisao.estado === "carregando" ? (
        <EstadoDaCarga
          estado="carregando"
          mensagem="Carregando a revisão do dia…"
        />
      ) : null}

      {revisao.estado === "falha" ? (
        <EstadoDaCarga
          estado="falha"
          mensagem={revisao.mensagem}
          aoTentarNovamente={aoTentarNovamente}
        />
      ) : null}

      {revisao.estado === "pronta" ? (
        <ResumoDoDia resumo={revisao.resumo} />
      ) : null}
    </section>
  );
}

/**
 * O resumo já carregado: quantos vencem hoje, quantos novos entram e o caminho
 * para revisar (FR-198, FR-199, FR-202).
 *
 * Quando não há nada para revisar, o botão deixa de ser um link e passa a
 * anunciar-se indisponível, com a explicação associada por `aria-describedby`
 * — a indisponibilidade não fica só na cor (FR-202).
 */
function ResumoDoDia({ resumo }: { resumo: ResumoDaRevisao }) {
  const nadaParaRevisar = resumo.total === 0;

  return (
    <div className="pilha">
      <div>
        <h2>{tituloDaRevisao(resumo)}</h2>
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

/** O título do bloco, derivado dos vencidos (FR-198, FR-202). */
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

/** O texto dos Cartões novos de hoje, no singular e no plural (FR-199). */
function textoDeNovos(novos: number): string {
  if (novos === 0) {
    return "Nenhum Cartão novo entra hoje";
  }

  if (novos === 1) {
    return "1 Cartão novo entra hoje";
  }

  return `${novos} Cartões novos entram hoje`;
}

/** O painel já carregado: os números, o gráfico e as Sessões recentes. */
function PainelDoInicio({
  estatisticas,
  agora,
}: {
  estatisticas: Estatisticas;
  agora: Date;
}) {
  const taxa = taxaDeAcerto(estatisticas.registrosDaJanela);
  const dias = itensPorDia(estatisticas.registrosDaJanela, agora);
  const recentes = estatisticas.recentes.slice(0, SESSOES_RECENTES);
  // A coluna mais alta ocupa a altura toda; o piso de 1 evita dividir por zero
  // na semana inteira sem estudo.
  const maiorDoDia = Math.max(1, ...dias.map((dia) => dia.itens));

  // Sem nenhuma Sessão, o passo seguinte é o que ainda falta ao acervo: sem
  // Cartões, criar o primeiro; com eles, montar um Baralho (FR-172).
  const proximoPasso =
    estatisticas.cartoes === 0
      ? { rotulo: "Criar o primeiro Cartão", href: "#/cartoes/novo" }
      : { rotulo: "Ir para Baralhos", href: "#/baralhos" };

  return (
    <div className="pilha">
      <div className="resumo resumo--quatro">
        <div className="estatistica">
          <span className="estatistica__valor">{estatisticas.cartoes}</span>
          <span className="estatistica__rotulo">Cartões</span>
        </div>
        <div className="estatistica">
          <span className="estatistica__valor">{estatisticas.baralhos}</span>
          <span className="estatistica__rotulo">Baralhos</span>
        </div>
        <div className="estatistica">
          <span className="estatistica__valor">
            {estatisticas.registrosDaJanela.length}
          </span>
          <span className="estatistica__rotulo">
            Sessões nos últimos 7 dias
          </span>
        </div>
        <div className="estatistica">
          {/* Sem Itens não há taxa: a travessão ocupa o lugar do número, e a
              explicação fica disponível a quem não a vê (FR-170). */}
          <span className="estatistica__valor">
            {taxa === null ? "—" : `${taxa}%`}
          </span>
          <span className="estatistica__rotulo">Taxa de acerto (7 dias)</span>
          {taxa === null ? (
            <span className="visualmente-oculto">
              Sem Itens estudados nos últimos 7 dias
            </span>
          ) : null}
        </div>
      </div>

      <section className="cartao" aria-labelledby="titulo-do-grafico">
        <h2 id="titulo-do-grafico">Itens estudados nos últimos 7 dias</h2>
        {/* A barra é decoração: os mesmos números vêm na lista seguinte, que é
            o que um leitor de tela anuncia (FR-171). */}
        <ul className="grafico-semanal" aria-hidden="true">
          {dias.map((dia, indice) => {
            const percentual = Math.round((dia.itens / maiorDoDia) * 100);
            // A última coluna é Hoje: o módulo devolve os dias da mais antiga
            // para a mais recente, que é a mesma ordem dos rótulos.
            const ehHoje = indice === dias.length - 1;

            return (
              <li key={dia.data} className="grafico-semanal__dia">
                <span className="grafico-semanal__valor">{dia.itens}</span>
                <span className="grafico-semanal__trilho">
                  <span
                    className="grafico-semanal__barra"
                    style={{
                      height: `${percentual}%`,
                      // Um dia com Itens sempre deixa um traço visível: 0% não
                      // apareceria. Sem Itens, a coluna fica vazia de propósito.
                      minHeight: dia.itens > 0 ? "4px" : undefined,
                    }}
                  />
                </span>
                <span
                  className={
                    ehHoje
                      ? "grafico-semanal__rotulo grafico-semanal__rotulo--hoje"
                      : "grafico-semanal__rotulo"
                  }
                >
                  {dia.rotulo}
                </span>
              </li>
            );
          })}
        </ul>
        <ul className="lista visualmente-oculto">
          {dias.map((dia) => (
            <li key={dia.data}>{`${dia.rotulo}: ${dia.itens} Itens`}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-das-ultimas">
        <h2 id="titulo-das-ultimas">Últimas Sessões</h2>
        {recentes.length === 0 ? (
          <EstadoDaCarga
            estado="vazio"
            mensagem="Você ainda não concluiu nenhuma Sessão."
            acao={
              <a className="botao botao--secundario" href={proximoPasso.href}>
                {proximoPasso.rotulo}
              </a>
            }
          />
        ) : (
          <ul className="lista">
            {recentes.map((registro) => (
              <li key={registro.id}>
                {/* A linha inteira é o alvo do toque, com pelo menos 44px de
                    altura (FR-136, SC-063). O `aria-label` mantém o nome
                    acessível só com o Baralho, já que o conteúdo visível
                    acrescenta a data e o percentual. */}
                <a
                  className="item-da-lista"
                  href={`#/sessoes/${registro.id}`}
                  aria-label={registro.nomeDoBaralho}
                >
                  <h3 className="titulo-do-item item-da-lista__nome">
                    {registro.nomeDoBaralho}
                  </h3>
                  <p className="texto-secundario">
                    {instanteLocal(registro.concluidaEm)}
                  </p>
                  <p className="item-da-lista__percentual">
                    {percentualDe(registro)}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** A data e a hora locais de um instante, no formato curto de pt-BR (FR-165). */
function instanteLocal(instante: string): string {
  const quando = new Date(instante);

  // Um instante ilegível não pode derrubar a lista: mostramos o que veio.
  if (Number.isNaN(quando.getTime())) {
    return instante;
  }

  return quando.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** O percentual de acertos de uma Sessão, ou travessão quando não há Itens. */
function percentualDe(registro: RegistroResumido): string {
  if (registro.estudados === 0) {
    return "—";
  }

  return `${Math.round((registro.acertos / registro.estudados) * 100)}%`;
}
