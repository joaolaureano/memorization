import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ClienteDoAcervo,
  CompromissoDeEstudo,
  InicioDeCompromisso,
  SemanaDaAgenda,
} from "../acervo-cliente/cliente";
import {
  dataPorExtenso,
  descreverSemana,
  diaDaSemana,
  diasDaSemana,
  fusoDoNavegador,
  hojeNoFuso,
  milissegundosAteAMeiaNoite,
  nomeDoDia,
  segundaFeiraDe,
  somarDias,
} from "../agenda/datas";
import {
  descreverQuantidade,
  resumirDia,
  rotuloDoCompromisso,
  rotuloDoEstadoDoDia,
  textoDaContagem,
} from "../agenda/estado-do-dia";
import type { ResumoDoDia } from "../agenda/estado-do-dia";
import { EstadoDaCarga } from "./EstadoDaCarga";

/**
 * O bloco «Agenda de estudo» em duas apresentações (019):
 *
 * - `modo: "hoje"` — a Agenda compacta de Início (FR-311, FR-321, FR-322): o
 *   resumo de hoje e, no máximo, os três primeiros estudos de hoje, com um
 *   único link para a Agenda semanal (FR-332). Sem calendário e sem «Continuar
 *   estudos».
 * - `modo: "semana"` — a Agenda semanal da área Estudo (FR-313): o calendário
 *   da semana, a navegação entre semanas e os estudos do dia selecionado.
 *
 * Tem estado próprio — uma falha aqui não esconde o resto da tela, e o resto
 * não esconde a Agenda.
 *
 * A tela não decide o que vale: o servidor devolve o dia de hoje (no fuso do
 * navegador), os Compromissos e a elegibilidade; a tela só os apresenta, deriva
 * as contagens pela tabela de estados (`estado-do-dia.ts`) e navega entre
 * semanas. Ausência ou falha de dados nunca é apresentada como zero, conclusão
 * ou falta (FR-229, FR-240): os dados anteriores só ficam visíveis com a
 * indicação de atualização ou de falha.
 *
 * As ações da Agenda (Agendar estudo, Gerenciar rotinas) ficam no cabeçalho das
 * páginas, não neste bloco; repetir uma leitura só existe em «Tentar novamente»
 * nas falhas (FR-318). Ao voltar à tela e ao atravessar a meia-noite a data é
 * reavaliada: sem uma escolha ativa, a Agenda volta à semana e ao dia de hoje;
 * com um dia ou uma semana escolhidos, relê a semana pedida preservando a
 * seleção (FR-319, FR-320). O fuso do navegador segue nas leituras e nas
 * chamadas ao servidor, mas não aparece na tela (FR-334).
 */

/** O estado da leitura: dados anteriores permanecem enquanto atualiza ou falha. */
interface EstadoDaAgenda {
  /** A última semana carregada com sucesso, ou `null` antes da primeira. */
  dados: SemanaDaAgenda | null;
  carregando: boolean;
  /** A mensagem da última falha, ou `null` quando a leitura mais recente deu certo. */
  falha: string | null;
}

export function AgendaDeEstudo({
  cliente,
  modo,
  aoIniciarEstudo,
}: {
  cliente: ClienteDoAcervo;
  /** "hoje" é a Agenda compacta de Início; "semana" é a Agenda semanal de Estudo (FR-311, FR-313). */
  modo: "hoje" | "semana";
  /** Entrega o início autorizado à casca, que abre a Sessão (FR-231). */
  aoIniciarEstudo?: (inicio: InicioDeCompromisso) => void;
}) {
  const [fuso] = useState(fusoDoNavegador);
  const [estado, setEstado] = useState<EstadoDaAgenda>({
    dados: null,
    carregando: true,
    falha: null,
  });
  // A semana pedida e o dia que o Usuário escolheu; `null` segue o servidor.
  const [semanaPedida, setSemanaPedida] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  // FR-319: enquanto verdadeiro, a Agenda segue o «hoje» do servidor — uma
  // releitura automática volta à semana e ao dia de hoje. Escolher um dia ou
  // trocar de semana passa a acompanhar a escolha da pessoa.
  const [acompanhaHoje, setAcompanhaHoje] = useState(true);
  const [iniciando, setIniciando] = useState<string | null>(null);
  const [falhaDeInicio, setFalhaDeInicio] = useState<string | null>(null);
  const ultimaLeitura = useRef(0);
  // Os listeners de visibilidade e de meia-noite reagem fora do render e
  // precisam do estado mais recente; as refs espelham esse estado para que os
  // efeitos não sejam recriados a cada escolha de dia (FR-319).
  const acompanhaHojeRef = useRef(acompanhaHoje);
  const semanaPedidaRef = useRef(semanaPedida);
  const selecionadoRef = useRef(selecionado);

  useEffect(() => {
    acompanhaHojeRef.current = acompanhaHoje;
    semanaPedidaRef.current = semanaPedida;
    selecionadoRef.current = selecionado;
  }, [acompanhaHoje, semanaPedida, selecionado]);

  /**
   * Lê a semana de `inicio` (ou a de hoje, quando `null`). Só a leitura mais
   * recente vale: uma resposta atrasada de um pedido antigo é descartada. O
   * `diaAoChegar` é o dia que fica selecionado quando a resposta chega — `null`
   * volta a seguir o servidor.
   */
  const carregar = useCallback(
    async (inicio: string | null, diaAoChegar: string | null = null) => {
      const numero = ultimaLeitura.current + 1;

      ultimaLeitura.current = numero;
      setEstado((anterior) => ({ ...anterior, carregando: true }));

      const semana =
        inicio ?? segundaFeiraDe(hojeNoFuso(fuso, new Date()));
      // Uma exceção do transporte é falha, nunca zero nem conclusão (FR-229).
      let resultado: Awaited<ReturnType<ClienteDoAcervo["obterAgenda"]>>;

      try {
        resultado = await cliente.obterAgenda(semana, fuso);
      } catch {
        resultado = {
          ok: false,
          erro: "indisponivel",
          mensagem: "A Agenda não está disponível agora. Tente novamente.",
        };
      }

      if (ultimaLeitura.current !== numero) {
        return;
      }

      if (resultado.ok) {
        setEstado({ dados: resultado.agenda, carregando: false, falha: null });
        setSemanaPedida(resultado.agenda.inicio);
        setSelecionado(diaAoChegar ?? null);
      } else {
        setEstado((anterior) => ({
          dados: anterior.dados,
          carregando: false,
          falha: resultado.mensagem,
        }));
      }
    },
    [cliente, fuso],
  );

  useEffect(() => {
    void carregar(null);
  }, [carregar]);

  /**
   * Relê a Agenda — a ação de «Tentar novamente» nas falhas (FR-318) e a
   * releitura da meia-noite e da volta à tela (FR-319): sem escolha ativa,
   * volta à semana e ao dia de hoje; com escolha, relê a semana pedida
   * preservando o dia selecionado.
   */
  const atualizar = useCallback((): void => {
    if (acompanhaHojeRef.current) {
      void carregar(null);

      return;
    }

    void carregar(semanaPedidaRef.current, selecionadoRef.current);
  }, [carregar]);

  // FR-319: a data é reavaliada com a tela ativa ao atravessar a meia-noite e ao
  // voltar a ela; o temporizador é rearmado quando o «hoje» do servidor muda.
  useEffect(() => {
    const aoVoltar = (): void => {
      if (document.visibilityState === "visible") {
        atualizar();
      }
    };
    const temporizador = window.setTimeout(
      atualizar,
      milissegundosAteAMeiaNoite(fuso, new Date()) + 1000,
    );

    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      window.clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [atualizar, fuso, estado.dados?.hoje]);

  const dados = estado.dados;

  function irParaSemana(deslocamento: number): void {
    if (dados === null) {
      return;
    }

    const base = semanaPedida ?? dados.inicio;
    const dia = selecionado ?? dados.hoje;
    const novoInicio = somarDias(base, deslocamento);

    // FR-228: a semana anterior ou seguinte seleciona o mesmo dia da semana.
    // FR-319: trocar de semana interrompe o acompanhamento de hoje.
    setAcompanhaHoje(false);
    void carregar(novoInicio, somarDias(novoInicio, diaDaSemana(dia) - 1));
  }

  function irParaHoje(): void {
    // FR-319: voltar a hoje devolve a Agenda ao acompanhamento do servidor.
    setAcompanhaHoje(true);
    void carregar(null);
  }

  function selecionarDia(data: string): void {
    // FR-319: uma escolha explícita interrompe o acompanhamento de hoje.
    setAcompanhaHoje(false);
    setSelecionado(data);
  }

  async function estudar(compromisso: CompromissoDeEstudo): Promise<void> {
    if (dados === null || iniciando !== null) {
      return;
    }

    setIniciando(compromisso.rotinaId);
    setFalhaDeInicio(null);

    const resultado = await cliente.iniciarCompromisso({
      rotinaId: compromisso.rotinaId,
      data: compromisso.data,
      fuso,
    });

    if (resultado.ok) {
      aoIniciarEstudo?.(resultado.inicio);
      return;
    }

    // O Compromisso segue pendente: a falha é explicada e a pessoa pode tentar
    // de novo ou ajustar a Rotina (FR-243, FR-251).
    setFalhaDeInicio(resultado.mensagem);
    setIniciando(null);
    void carregar(semanaPedida, selecionado);
  }

  return (
    <section
      className={
        modo === "hoje" ? "cartao agenda agenda--hoje" : "cartao agenda"
      }
      aria-labelledby="titulo-da-agenda"
    >
      <h2 id="titulo-da-agenda">
        {modo === "hoje" ? "Agenda de hoje" : "Agenda semanal"}
      </h2>

      {dados === null && estado.carregando ? (
        <EstadoDaCarga estado="carregando" mensagem="Carregando a agenda…" />
      ) : null}

      {dados === null && !estado.carregando && estado.falha !== null ? (
        <EstadoDaCarga
          estado="falha"
          mensagem={estado.falha}
          aoTentarNovamente={atualizar}
        />
      ) : null}

      {dados !== null ? (
        <div className="pilha">
          {estado.falha !== null ? (
            <div role="alert" className="aviso aviso--erro">
              <p>
                Não foi possível atualizar a agenda. Os dados abaixo podem estar
                desatualizados. {estado.falha}
              </p>
              <button
                type="button"
                className="botao botao--secundario"
                onClick={atualizar}
              >
                Tentar novamente
              </button>
            </div>
          ) : null}

          {estado.carregando ? (
            <p role="status" className="carregando">
              Atualizando a agenda…
            </p>
          ) : null}

          {modo === "hoje" ? (
            <AgendaDeHoje
              dados={dados}
              iniciando={iniciando}
              falhaDeInicio={falhaDeInicio}
              aoEstudar={(compromisso) => void estudar(compromisso)}
            />
          ) : (
            <>
              <Semana
                dados={dados}
                selecionado={selecionado}
                atualizando={estado.carregando}
                aoSelecionar={selecionarDia}
                aoIrParaSemana={irParaSemana}
                aoIrParaHoje={irParaHoje}
              />

              <EstudosDoDia
                dados={dados}
                selecionado={selecionado ?? dados.hoje}
                iniciando={iniciando}
                falhaDeInicio={falhaDeInicio}
                aoEstudar={(compromisso) => void estudar(compromisso)}
              />
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

/**
 * A Agenda compacta de Início (FR-311, FR-321, FR-322): o resumo de hoje e, no
 * máximo, os três primeiros estudos de hoje. Não traz a data nem «Agendar
 * estudo» (FR-332), nem o fuso em texto (FR-334) — essas ações ficam na Agenda
 * completa, em Estudo, pelo rodapé. Sem calendário e sem «Continuar estudos».
 */
function AgendaDeHoje({
  dados,
  iniciando,
  falhaDeInicio,
  aoEstudar,
}: {
  dados: SemanaDaAgenda;
  iniciando: string | null;
  falhaDeInicio: string | null;
  aoEstudar: (compromisso: CompromissoDeEstudo) => void;
}) {
  const resumo = resumirDia(dados.hoje, dados.hoje, dados.compromissosDeHoje);
  // Os Compromissos de hoje na ordem recebida, sem os cancelados; só os três
  // primeiros aparecem aqui (FR-311).
  const deHoje = dados.compromissosDeHoje.filter(
    (compromisso) => compromisso.estado !== "cancelado",
  );
  const visiveis = deHoje.slice(0, 3);

  return (
    <>
      {resumo.total === 0 ? (
        <p>Nenhum estudo agendado para hoje</p>
      ) : resumo.concluidos === resumo.total ? (
        <>
          <p>Agenda de hoje concluída</p>
          <p className="texto-secundario">{textoDaContagem(resumo)}</p>
        </>
      ) : (
        <p>{textoDaContagem(resumo)}</p>
      )}

      {falhaDeInicio !== null ? (
        <p className="erro" role="alert">
          {falhaDeInicio}
        </p>
      ) : null}

      {visiveis.length > 0 ? (
        <ul className="lista agenda__estudos">
          {visiveis.map((compromisso) => (
            <li
              key={`${compromisso.rotinaId}-${compromisso.data}`}
              className="agenda__estudo"
            >
              <div className="agenda__estudo-texto">
                <p className="titulo-do-item">{compromisso.nomeDoBaralho}</p>
                <p className="texto-secundario">
                  {descreverQuantidade(compromisso.quantidade)} ·{" "}
                  {rotuloDoCompromisso(compromisso.estado)}
                  {compromisso.indisponivel ? (
                    <>
                      {" · "}
                      <strong>Baralho indisponível</strong>
                    </>
                  ) : null}
                </p>
              </div>
              <AcaoDoCompromisso
                compromisso={compromisso}
                hoje={dados.hoje}
                iniciando={iniciando}
                aoEstudar={aoEstudar}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <a className="botao botao--secundario" href="#/estudo">
        {deHoje.length > 3 ? "Ver todos em Estudo" : "Ver agenda semanal"}
      </a>
    </>
  );
}

/** A semana: controles, intervalo e os sete dias na mesma linha (FR-228, FR-253). */
function Semana({
  dados,
  selecionado,
  atualizando,
  aoSelecionar,
  aoIrParaSemana,
  aoIrParaHoje,
}: {
  dados: SemanaDaAgenda;
  selecionado: string | null;
  atualizando: boolean;
  aoSelecionar: (data: string) => void;
  aoIrParaSemana: (deslocamento: number) => void;
  aoIrParaHoje: () => void;
}) {
  const dias = diasDaSemana(dados.inicio);
  const dataSelecionada =
    selecionado !== null && dias.includes(selecionado)
      ? selecionado
      : dias.includes(dados.hoje)
        ? dados.hoje
        : dias[0];

  return (
    <div
      className="agenda__semana"
      role="group"
      aria-labelledby="titulo-da-agenda"
    >
      <p className="agenda__intervalo" aria-live="polite">
        {descreverSemana(dados.inicio)}
      </p>

      <div className="agenda__controles">
        <button
          type="button"
          className="botao botao--secundario"
          onClick={() => aoIrParaSemana(-7)}
          disabled={atualizando}
        >
          Semana anterior
        </button>
        <button
          type="button"
          className="botao botao--secundario"
          onClick={aoIrParaHoje}
          disabled={atualizando}
        >
          Hoje
        </button>
        <button
          type="button"
          className="botao botao--secundario"
          onClick={() => aoIrParaSemana(7)}
          disabled={atualizando}
        >
          Semana seguinte
        </button>
      </div>

      <ul className="agenda__dias">
        {dias.map((data) => {
          const resumo = resumirDia(
            data,
            dados.hoje,
            dados.compromissos,
          );
          const ehHoje = data === dados.hoje;
          const ehSelecionado = data === dataSelecionada;

          return (
            <li key={data}>
              <button
                type="button"
                className={[
                  "agenda__dia",
                  `agenda__dia--${resumo.estado}`,
                  ehHoje ? "agenda__dia--hoje" : "",
                  ehSelecionado ? "agenda__dia--selecionado" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={ehSelecionado}
                aria-label={nomeAcessivelDoDia(resumo, ehHoje)}
                data-data={data}
                onClick={() => aoSelecionar(data)}
              >
                <span className="agenda__dia-semana" aria-hidden="true">
                  {abreviacaoDoDia(diaDaSemana(data))}
                </span>
                <span className="agenda__dia-numero" aria-hidden="true">
                  {Number(data.slice(8, 10))}
                </span>
                <span className="agenda__dia-contagem" aria-hidden="true">
                  {resumo.total === 0
                    ? "–"
                    : `${resumo.concluidos}/${resumo.total}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** O nome acessível de um dia: data, hoje, estado e contagem (FR-252). */
function nomeAcessivelDoDia(resumo: ResumoDoDia, ehHoje: boolean): string {
  return [
    dataPorExtenso(resumo.data),
    ehHoje ? "hoje" : null,
    rotuloDoEstadoDoDia(resumo.estado),
    textoDaContagem(resumo),
  ]
    .filter((parte) => parte !== null)
    .join(", ");
}

/** "Seg", "Ter"… — a abreviação visual do dia (o nome completo vai no rótulo). */
function abreviacaoDoDia(dia: number): string {
  return nomeDoDia(dia).slice(0, 3).replace(/^./, (letra) => letra.toUpperCase());
}

/**
 * Os estudos do dia selecionado (FR-230, FR-231): só os Compromissos daquele
 * dia, na ordem de criação das Rotinas, cada um com Baralho, quantidade,
 * situação e a ação que se aplica. Um dia sem Compromissos mostra apenas
 * «Nenhum estudo agendado para este dia.», sem a linha de situação e contagem
 * (FR-333).
 */
function EstudosDoDia({
  dados,
  selecionado,
  iniciando,
  falhaDeInicio,
  aoEstudar,
}: {
  dados: SemanaDaAgenda;
  selecionado: string;
  iniciando: string | null;
  falhaDeInicio: string | null;
  aoEstudar: (compromisso: CompromissoDeEstudo) => void;
}) {
  const dia = dados.compromissos.some((c) => c.data === selecionado)
    ? resumirDia(selecionado, dados.hoje, dados.compromissos)
    : resumirDia(
        selecionado,
        dados.hoje,
        dados.compromissos.filter((c) => c.data === selecionado),
      );

  return (
    <section aria-labelledby="titulo-dos-estudos-do-dia" className="agenda__dia-detalhe">
      <h3 id="titulo-dos-estudos-do-dia">
        {dataPorExtenso(selecionado)}
        {selecionado === dados.hoje ? " (hoje)" : ""}
      </h3>
      {falhaDeInicio !== null ? (
        <p className="erro" role="alert">
          {falhaDeInicio}
        </p>
      ) : null}

      {dia.compromissos.length === 0 ? (
        <p className="texto-secundario">
          Nenhum estudo agendado para este dia.
        </p>
      ) : (
        <>
          <p className="texto-secundario" aria-live="polite">
            {rotuloDoEstadoDoDia(dia.estado)} · {textoDaContagem(dia)}
          </p>
          <ul className="lista agenda__estudos">
          {dia.compromissos.map((compromisso) => (
            <li
              key={`${compromisso.rotinaId}-${compromisso.data}`}
              className="agenda__estudo"
            >
              <div className="agenda__estudo-texto">
                <p className="titulo-do-item">{compromisso.nomeDoBaralho}</p>
                <p className="texto-secundario">
                  {descreverQuantidade(compromisso.quantidade)} ·{" "}
                  {rotuloDoCompromisso(compromisso.estado)}
                  {compromisso.indisponivel &&
                  compromisso.estado !== "cancelado" ? (
                    <>
                      {" · "}
                      <strong>Baralho indisponível</strong>
                    </>
                  ) : null}
                </p>
              </div>
              <AcaoDoCompromisso
                compromisso={compromisso}
                hoje={dados.hoje}
                iniciando={iniciando}
                aoEstudar={aoEstudar}
              />
            </li>
          ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** A ação que cabe ao Compromisso: Estudar, Ver Sessão, Ajustar ou nenhuma (FR-231). */
function AcaoDoCompromisso({
  compromisso,
  hoje,
  iniciando,
  aoEstudar,
}: {
  compromisso: CompromissoDeEstudo;
  hoje: string;
  iniciando: string | null;
  aoEstudar: (compromisso: CompromissoDeEstudo) => void;
}) {
  if (compromisso.estado === "concluido" && compromisso.registroId !== null) {
    return (
      <a
        className="botao botao--secundario"
        href={`#/sessoes/${encodeURIComponent(compromisso.registroId)}`}
        aria-label={`Ver Sessão de ${compromisso.nomeDoBaralho}`}
      >
        Ver Sessão
      </a>
    );
  }

  if (compromisso.estado === "cancelado" || compromisso.estado === "concluido") {
    return null;
  }

  if (compromisso.indisponivel) {
    return (
      <a
        className="botao botao--secundario"
        href={`#/agenda/${encodeURIComponent(compromisso.rotinaId)}/editar`}
        aria-label={`Ajustar rotina de ${compromisso.nomeDoBaralho}`}
      >
        Ajustar rotina
      </a>
    );
  }

  if (compromisso.estado === "pendente" && compromisso.data === hoje) {
    return (
      <button
        type="button"
        className="botao botao--primario"
        disabled={iniciando !== null}
        aria-label={`Estudar ${compromisso.nomeDoBaralho}`}
        onClick={() => aoEstudar(compromisso)}
      >
        {iniciando === compromisso.rotinaId ? "Iniciando…" : "Estudar"}
      </button>
    );
  }

  return null;
}
