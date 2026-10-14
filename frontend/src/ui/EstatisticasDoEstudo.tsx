import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ClienteDoAcervo,
  Estatisticas,
  RegistroResumido,
} from "../acervo-cliente/cliente";
import { MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO } from "../acervo-cliente/cliente";
import {
  inicioDaJanela,
  itensPorDia,
  taxaDeAcerto,
} from "../estatisticas/estatisticas";
import { useIdioma } from "../idioma";
import { rotuloDoBaralhoDoRegistro } from "../idioma/rotulo-do-baralho";
import { EstadoDaCarga } from "./EstadoDaCarga";

/**
 * O módulo de apresentação das Estatísticas do estudo (FR-308, FR-314, FR-321,
 * FR-326).
 *
 * A área Estudo precisa dos mesmos números que o Início já mostrava — os Itens
 * estudados nos últimos sete dias, as Sessões concluídas e a taxa de acerto —,
 * porém em tamanho maior, com o gráfico dia a dia e a lista das últimas
 * Sessões. Este módulo reúne essa leitura e esse desenho: o hook
 * `useEstatisticasDoEstudo` cuida do ciclo de vida da leitura, e os componentes
 * `ResumoDeSeteDias`, `PainelDaSemana` e `UltimasSessoes` desenham o que ele
 * guardou.
 *
 * O Início usa o resumo de uma linha; a área Estudo usa o painel com o gráfico
 * e a lista de Sessões recentes. Nenhum dos dois pede as Estatísticas por conta
 * própria: a janela de sete dias e o `agora` que a desenha vêm daqui, o que
 * mantém as duas telas contando a mesma história.
 *
 * As contas puras — a janela, os Itens por dia, a taxa de acerto — ficam no
 * módulo `estatisticas`; aqui só há o ciclo de vida da leitura e a marcação.
 */

/** O resultado de uma leitura das Estatísticas no `ClienteDoAcervo`. */
type ResultadoDasEstatisticas = Awaited<
  ReturnType<ClienteDoAcervo["obterEstatisticas"]>
>;

/** O estado da leitura das Estatísticas, do pedido à resposta (FR-308). */
export interface EstadoDasEstatisticas {
  /** O que a última leitura bem-sucedida trouxe, com o `agora` que a pediu. */
  dados: { estatisticas: Estatisticas; agora: Date } | null;
  /** `true` enquanto uma leitura está em curso. */
  carregando: boolean;
  /** A mensagem da última falha; `null` quando a última leitura deu certo. */
  falha: string | null;
}

/** Quantas Sessões recentes uma lista apresenta (FR-315). */
const SESSOES_RECENTES = 5;

/**
 * Lê as Estatísticas dos últimos sete dias e as mantém à mão (FR-308, FR-326).
 *
 * Um único `agora` decide a janela pedida e segue guardado junto da resposta: é
 * ele que diz ao gráfico qual coluna é Hoje e quando o dia vira. Fossem dois
 * instantes, a última coluna poderia ficar fora do que foi pedido.
 *
 * A leitura se refaz quando a aba volta a ficar visível e um segundo depois da
 * meia-noite local, sem que a pessoa precise recarregar a tela (FR-326). A
 * releitura é do ciclo de vida da aba, não da interação: nenhum teclado ou
 * clique a dispara.
 *
 * Cada leitura leva um número, e só a resposta da mais recente pode mexer no
 * estado: a resposta atrasada de uma leitura antiga é descartada, e depois da
 * desmontagem nada é atualizado. Os dados anteriores continuam à vista durante
 * a nova leitura e mesmo quando ela falha — o que já estava certo não deixa de
 * estar por causa de uma falha de rede.
 */
export function useEstatisticasDoEstudo(cliente: ClienteDoAcervo): {
  estado: EstadoDasEstatisticas;
  tentarNovamente: () => void;
} {
  const [estado, setEstado] = useState<EstadoDasEstatisticas>({
    dados: null,
    carregando: true,
    falha: null,
  });

  // Cada leitura leva um número, e só a última pode mexer no estado: é o que
  // descarta a resposta de uma leitura antiga que chegue depois da mais nova.
  const leitura = useRef(0);

  // Depois da desmontagem não há mais estado para atualizar.
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;

    return () => {
      montado.current = false;
    };
  }, []);

  const carregar = useCallback(async () => {
    leitura.current += 1;
    const numeroDestaLeitura = leitura.current;

    // Os dados anteriores continuam à vista enquanto a leitura corre: trocar o
    // painel por um "Carregando" apagaria números que continuam verdadeiros.
    setEstado((anterior) => ({ ...anterior, carregando: true }));

    // Um só `agora` decide a janela pedida e fica guardado com a resposta.
    const agora = new Date();

    let resultado: ResultadoDasEstatisticas;

    try {
      resultado = await cliente.obterEstatisticas(
        inicioDaJanela(agora).toISOString(),
      );
    } catch {
      // O cliente pode lançar em vez de devolver uma falha; para quem lê, o
      // efeito é o mesmo — e nunca um zero silencioso.
      if (numeroDestaLeitura !== leitura.current || !montado.current) {
        return;
      }

      setEstado((anterior) =>
        estadoDeFalha(anterior, MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO),
      );

      return;
    }

    if (numeroDestaLeitura !== leitura.current || !montado.current) {
      return;
    }

    if (!resultado.ok) {
      // A falha aparece, mas o que já estava na tela fica onde está: o painel
      // anterior continua valendo até que uma leitura nova o substitua.
      const mensagem = resultado.mensagem;

      setEstado((anterior) => estadoDeFalha(anterior, mensagem));

      return;
    }

    setEstado({
      dados: { estatisticas: resultado.estatisticas, agora },
      carregando: false,
      falha: null,
    });
  }, [cliente]);

  // A leitura começa junto com a montagem.
  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Volta da aba: o dia pode ter virado enquanto a tela dormia (FR-326).
  useEffect(() => {
    function aoVoltarAVisibilidade() {
      if (document.visibilityState === "visible") {
        void carregar();
      }
    }

    document.addEventListener("visibilitychange", aoVoltarAVisibilidade);

    return () => {
      document.removeEventListener("visibilitychange", aoVoltarAVisibilidade);
    };
  }, [carregar]);

  const agora = estado.dados?.agora ?? null;

  // Virada do dia: um segundo depois da meia-noite local, a leitura se refaz
  // para que a janela de sete dias e o "Hoje" do gráfico acompanhem o
  // calendário (FR-326). O instante guardado com os dados decide o atraso, e o
  // temporizador se rearma a cada leitura bem-sucedida.
  useEffect(() => {
    if (agora === null) {
      return;
    }

    const proximaMeiaNoite = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      agora.getDate() + 1,
    );
    const atraso = proximaMeiaNoite.getTime() - agora.getTime() + 1000;

    const temporizador = window.setTimeout(() => {
      void carregar();
    }, atraso);

    return () => {
      window.clearTimeout(temporizador);
    };
  }, [agora, carregar]);

  const tentarNovamente = useCallback(() => {
    void carregar();
  }, [carregar]);

  return { estado, tentarNovamente };
}

/**
 * O resumo de uma linha dos últimos sete dias (FR-308, FR-314, FR-321).
 *
 * É o texto compacto que o Início mostra: quantos Itens foram estudados e qual
 * foi a taxa de acerto do período. Sem nenhum Item estudado não há taxa — dizer
 * "0%" seria afirmar um acerto que ninguém teve (FR-321).
 */
export function ResumoDeSeteDias({
  estatisticas,
}: {
  estatisticas: Estatisticas;
}) {
  const { textos, formatarNumero } = useIdioma();
  const registros = estatisticas.registrosDaJanela;
  const taxa = taxaDeAcerto(registros);

  if (taxa === null) {
    return (
      <p className="resumo-de-sete-dias">
        {textos.estatisticas.ultimosSeteDialosNenhumItem}
      </p>
    );
  }

  const itens = totalDeItens(registros);
  const contagem = textos.estatisticas.itemEstudado(itens);

  return (
    <p className="resumo-de-sete-dias">
      {textos.estatisticas.resumoSeteDias(
        contagem,
        formatarNumero(taxa / 100, { style: "percent", maximumFractionDigits: 0 }),
      )}
    </p>
  );
}

/**
 * O painel dos últimos sete dias: os três números e o gráfico dia a dia
 * (FR-314).
 *
 * O `agora` vem do chamador — o mesmo que decidiu a janela pedida —, e não do
 * relógio deste componente: é ele que diz qual coluna é Hoje e mantém o
 * gráfico coerente com os Registros que chegaram.
 *
 * O título do bloco é do chamador: a área Estudo põe o seu `h2` acima, e um
 * título aqui dentro seria o segundo na mesma seção. A seção do gráfico leva o
 * rótulo em `aria-label` para não ficar sem nome acessível.
 */
export function PainelDaSemana({
  estatisticas,
  agora,
}: {
  estatisticas: Estatisticas;
  agora: Date;
}) {
  const { textos, formatarNumero, formatarData } = useIdioma();
  const registros = estatisticas.registrosDaJanela;
  const taxa = taxaDeAcerto(registros);
  const dias = itensPorDia(registros, agora);
  // A coluna mais alta ocupa a altura toda; o piso de 1 evita dividir por zero
  // na semana inteira sem estudo.
  const maiorDoDia = Math.max(1, ...dias.map((dia) => dia.itens));

  return (
    <div className="pilha">
      <div className="resumo resumo--tres">
        <div className="estatistica">
          <span className="estatistica__valor">{totalDeItens(registros)}</span>
          <span className="estatistica__rotulo">{textos.estatisticas.itensEstudados}</span>
        </div>
        <div className="estatistica">
          <span className="estatistica__valor">{registros.length}</span>
          <span className="estatistica__rotulo">{textos.estatisticas.rotuloSessoesConcluidas}</span>
        </div>
        <div className="estatistica">
          {/* Sem Itens não há taxa: o travessão ocupa o lugar do número, e a
              explicação fica disponível a quem não a vê (FR-314). */}
          <span className="estatistica__valor">
            {taxa === null ? "—" : formatarNumero(taxa / 100, { style: "percent", maximumFractionDigits: 0 })}
          </span>
          <span className="estatistica__rotulo">{textos.estatisticas.taxaDeAcerto}</span>
          {taxa === null ? (
            <span className="visualmente-oculto">
              {textos.estatisticas.semItensEstudadosNos7Dias}
            </span>
          ) : null}
        </div>
      </div>

      <section
        className="cartao"
        aria-label={textos.estatisticas.itensEstudadosNos7Dias}
      >
        {/* A barra é decoração: os mesmos números vêm na lista seguinte, que é
            o que um leitor de tela anuncia (FR-324). */}
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
                  {rotuloDoDia(dia, textos, formatarData)}
                </span>
              </li>
            );
          })}
        </ul>
        <ul className="lista visualmente-oculto">
          {dias.map((dia) => (
            <li key={dia.data}>{`${rotuloDoDia(dia, textos, formatarData)}: ${textos.estatisticas.itemEstudado(dia.itens)}`}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * As últimas Sessões concluídas, na ordem em que chegaram (FR-315).
 *
 * A lista não filtra pela janela de sete dias: uma Sessão antiga continua sendo
 * a última coisa que a pessoa fez, e é isso que a torna útil como ponto de
 * retorno. O título do bloco é do chamador.
 */
export function UltimasSessoes({
  recentes,
}: {
  recentes: RegistroResumido[];
}) {
  const { textos, formatarData, formatarNumero } = useIdioma();
  const sessoes = recentes.slice(0, SESSOES_RECENTES);

  if (sessoes.length === 0) {
    return (
      <EstadoDaCarga
        estado="vazio"
        mensagem={textos.estatisticas.nenhumaSessao}
      />
    );
  }

  return (
    <ul className="lista">
      {sessoes.map((registro) => {
        const titulo = rotuloDoBaralhoDoRegistro(registro, textos);
        const quando = instanteLocal(registro.concluidaEm, formatarData);
        const percentual = percentualDe(registro, formatarNumero);

        return (
          <li key={registro.id}>
            {/* A linha inteira é o alvo do toque, com pelo menos 44px de
                altura (FR-136, SC-063). O `aria-label` mantém o nome acessível
                com o Baralho, a data e o percentual, que o conteúdo visível
                repete. */}
            <a
              className="item-da-lista"
              href={"#/sessoes/" + encodeURIComponent(registro.id)}
              aria-label={`${titulo}, ${quando}, ${percentual} de acerto`}
            >
              <h3 className="titulo-do-item item-da-lista__nome">{titulo}</h3>
              <p className="texto-secundario">{quando}</p>
              <p className="item-da-lista__percentual">{percentual}</p>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** O estado depois de uma leitura que falhou: a falha aparece, os dados ficam. */
function estadoDeFalha(
  anterior: EstadoDasEstatisticas,
  mensagem: string,
): EstadoDasEstatisticas {
  return { ...anterior, carregando: false, falha: mensagem };
}

/** A soma dos Itens estudados nos Registros informados (FR-314). */
function totalDeItens(registros: RegistroResumido[]): number {
  return registros.reduce((total, registro) => total + registro.estudados, 0);
}

/** A data e a hora locais de um instante, no formato curto de pt-BR (FR-315). */
function instanteLocal(
  instante: string,
  formatarData: (data: Date, opcoes: Intl.DateTimeFormatOptions) => string,
): string {
  const quando = new Date(instante);

  // Um instante ilegível não pode derrubar a lista: mostramos o que veio.
  if (Number.isNaN(quando.getTime())) {
    return instante;
  }

  return formatarData(quando, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** O percentual de acertos de uma Sessão, ou travessão quando não há Itens. */
function percentualDe(
  registro: RegistroResumido,
  formatarNumero: (numero: number, opcoes?: Intl.NumberFormatOptions) => string,
): string {
  if (registro.estudados === 0) {
    return "—";
  }

  return formatarNumero(registro.acertos / registro.estudados, {
    style: "percent",
    maximumFractionDigits: 0,
  });
}

function rotuloDoDia(
  dia: { data: string; ehHoje: boolean },
  textos: ReturnType<typeof useIdioma>["textos"],
  formatarData: (data: Date, opcoes: Intl.DateTimeFormatOptions) => string,
): string {
  if (dia.ehHoje) return textos.estatisticas.hoje;
  const [ano, mes, data] = dia.data.split("-").map(Number);
  return formatarData(new Date(ano, mes - 1, data, 12), { weekday: "short" });
}
