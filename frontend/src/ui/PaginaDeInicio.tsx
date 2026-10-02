import { useCallback, useEffect, useState } from "react";

import type {
  ClienteDoAcervo,
  Estatisticas,
  RegistroResumido,
} from "../acervo-cliente/cliente";
import {
  inicioDaJanela,
  itensPorDia,
  taxaDeAcerto,
} from "../estatisticas/estatisticas";
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
 */

/** O estado da leitura das Estatísticas, do pedido à resposta (FR-164). */
type EstadoDoInicio =
  | { estado: "carregando" }
  | { estado: "falha"; mensagem: string }
  | { estado: "pronta"; estatisticas: Estatisticas; agora: Date };

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

  const carregar = useCallback(async () => {
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

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const tentarNovamente = useCallback(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="pagina">
      <div className="cabecalho-da-pagina">
        <div>
          <p className="sobretitulo">Seu estudo</p>
          <h1>Olá, {nomeDeUsuario}</h1>
        </div>
      </div>

      {inicio.estado === "carregando" ? (
        <EstadoDaCarga estado="carregando" mensagem="Carregando o seu estudo…" />
      ) : null}

      {inicio.estado === "falha" ? (
        <EstadoDaCarga
          estado="falha"
          mensagem={inicio.mensagem}
          aoTentarNovamente={tentarNovamente}
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
