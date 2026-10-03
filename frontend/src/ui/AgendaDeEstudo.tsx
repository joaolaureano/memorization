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
  proximoCompromissoElegivel,
  resumirDia,
  rotuloDoCompromisso,
  rotuloDoEstadoDoDia,
  textoDaContagem,
} from "../agenda/estado-do-dia";
import type { ResumoDoDia } from "../agenda/estado-do-dia";
import { EstadoDaCarga } from "./EstadoDaCarga";

/**
 * O bloco «Agenda de estudo» de Início (016, FR-227–FR-230, FR-240, FR-246):
 * o resumo de hoje, o calendário compacto da semana e os estudos do dia
 * selecionado. Fica **antes** da Revisão do dia (A-06), com estado próprio — uma
 * falha aqui não esconde o resto de Início, e o resto não esconde a Agenda.
 *
 * A tela não decide o que vale: o servidor devolve o dia de hoje (no fuso do
 * navegador), os Compromissos e a elegibilidade; a tela só os apresenta, deriva
 * as contagens pela tabela de estados (`estado-do-dia.ts`) e navega entre
 * semanas. Ausência ou falha de dados nunca é apresentada como zero, conclusão
 * ou falta (FR-229, FR-240): os dados anteriores só ficam visíveis com a
 * indicação de atualização ou de falha.
 *
 * Início reavalia a data ao voltar à tela, em «Atualizar agenda» e ao atravessar
 * a meia-noite com a tela ativa (FR-246); o fuso usado aparece em texto.
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
  aoIniciarEstudo,
}: {
  cliente: ClienteDoAcervo;
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
  const [iniciando, setIniciando] = useState<string | null>(null);
  const [falhaDeInicio, setFalhaDeInicio] = useState<string | null>(null);
  const ultimaLeitura = useRef(0);

  /**
   * Lê a semana de `inicio` (ou a de hoje, quando `null`). Só a leitura mais
   * recente vale: uma resposta atrasada de um pedido antigo é descartada.
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

  // FR-246: ao atravessar a meia-noite com a tela ativa e ao voltar a ela, a
  // data é reavaliada — o servidor devolve o novo «hoje».
  useEffect(() => {
    const aoVoltar = (): void => {
      if (document.visibilityState === "visible") {
        void carregar(null);
      }
    };
    const temporizador = window.setTimeout(
      () => void carregar(null),
      milissegundosAteAMeiaNoite(fuso, new Date()) + 1000,
    );

    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      window.clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [carregar, fuso, estado.dados?.hoje]);

  const dados = estado.dados;

  function irParaSemana(deslocamento: number): void {
    if (dados === null) {
      return;
    }

    const base = semanaPedida ?? dados.inicio;
    const dia = selecionado ?? dados.hoje;
    const novoInicio = somarDias(base, deslocamento);

    // FR-228: a semana anterior ou seguinte seleciona o mesmo dia da semana.
    void carregar(novoInicio, somarDias(novoInicio, diaDaSemana(dia) - 1));
  }

  function irParaHoje(): void {
    void carregar(null, null);
  }

  function atualizar(): void {
    void carregar(semanaPedida, selecionado);
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
    <section className="cartao agenda" aria-labelledby="titulo-da-agenda">
      <div className="agenda__cabecalho">
        <p className="sobretitulo" id="titulo-da-agenda">
          Agenda de estudo
        </p>
        <div className="agenda__links">
          <a className="botao botao--secundario" href="#/agenda/nova">
            Agendar estudo
          </a>
          <a className="botao botao--secundario" href="#/agenda">
            Gerenciar agenda
          </a>
        </div>
      </div>

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

          <ResumoDeHoje
            dados={dados}
            iniciando={iniciando !== null}
            aoEstudar={(compromisso) => void estudar(compromisso)}
          />

          <Semana
            dados={dados}
            selecionado={selecionado}
            fuso={fuso}
            atualizando={estado.carregando}
            aoSelecionar={setSelecionado}
            aoIrParaSemana={irParaSemana}
            aoIrParaHoje={irParaHoje}
            aoAtualizar={atualizar}
          />

          <EstudosDoDia
            dados={dados}
            selecionado={selecionado ?? dados.hoje}
            iniciando={iniciando}
            falhaDeInicio={falhaDeInicio}
            aoEstudar={(compromisso) => void estudar(compromisso)}
          />
        </div>
      ) : null}
    </section>
  );
}

/**
 * O resumo de **hoje** (FR-227): a data, concluídos e previstos e a ação para o
 * primeiro Compromisso pendente elegível. Continua se referindo a hoje mesmo
 * quando outro dia está selecionado.
 */
function ResumoDeHoje({
  dados,
  iniciando,
  aoEstudar,
}: {
  dados: SemanaDaAgenda;
  iniciando: boolean;
  aoEstudar: (compromisso: CompromissoDeEstudo) => void;
}) {
  const resumo = resumirDia(dados.hoje, dados.hoje, dados.compromissosDeHoje);
  const proximo = proximoCompromissoElegivel(dados.compromissosDeHoje);
  const soIndisponiveis =
    resumo.total > resumo.concluidos &&
    proximo === null &&
    dados.compromissosDeHoje.every(
      (compromisso) =>
        compromisso.estado !== "pendente" || compromisso.indisponivel,
    );

  let titulo: string;
  let detalhe: string | null = null;

  if (resumo.total === 0) {
    titulo = "Nenhum estudo agendado para hoje";
  } else if (resumo.concluidos === resumo.total) {
    titulo = "Agenda de hoje concluída";
    detalhe = textoDaContagem(resumo);
  } else {
    titulo = textoDaContagem(resumo);
    detalhe = soIndisponiveis
      ? "Os estudos que restam estão com o Baralho indisponível. Ajuste a agenda para voltar a estudar."
      : null;
  }

  return (
    <div className="agenda__hoje" aria-labelledby="titulo-de-hoje" role="group">
      <p className="sobretitulo">Hoje · {dataPorExtenso(dados.hoje)}</p>
      <h2 id="titulo-de-hoje">{titulo}</h2>
      {detalhe !== null ? <p className="texto-secundario">{detalhe}</p> : null}
      <p className="texto-secundario">Fuso horário: {dados.fuso}</p>

      {proximo !== null ? (
        <button
          type="button"
          className="botao botao--primario"
          disabled={iniciando}
          onClick={() => aoEstudar(proximo)}
        >
          {iniciando ? "Iniciando…" : "Continuar estudos"}
        </button>
      ) : null}

      {soIndisponiveis ? (
        <a className="botao botao--secundario" href="#/agenda">
          Ajustar agenda
        </a>
      ) : null}
    </div>
  );
}

/** A semana: controles, intervalo e os sete dias na mesma linha (FR-228, FR-253). */
function Semana({
  dados,
  selecionado,
  fuso,
  atualizando,
  aoSelecionar,
  aoIrParaSemana,
  aoIrParaHoje,
  aoAtualizar,
}: {
  dados: SemanaDaAgenda;
  selecionado: string | null;
  fuso: string;
  atualizando: boolean;
  aoSelecionar: (data: string) => void;
  aoIrParaSemana: (deslocamento: number) => void;
  aoIrParaHoje: () => void;
  aoAtualizar: () => void;
}) {
  const dias = diasDaSemana(dados.inicio);
  const dataSelecionada =
    selecionado !== null && dias.includes(selecionado)
      ? selecionado
      : dias.includes(dados.hoje)
        ? dados.hoje
        : dias[0];

  return (
    <div className="agenda__semana" role="group" aria-labelledby="titulo-da-semana">
      <h2 id="titulo-da-semana" className="agenda__titulo-da-semana">
        Sua semana
      </h2>
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
        <button
          type="button"
          className="botao botao--secundario"
          onClick={aoAtualizar}
          disabled={atualizando}
        >
          Atualizar agenda
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
      <p className="texto-secundario agenda__fuso">Fuso horário: {fuso}</p>
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
 * situação e a ação que se aplica.
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
      <p className="texto-secundario" aria-live="polite">
        {rotuloDoEstadoDoDia(dia.estado)} · {textoDaContagem(dia)}
      </p>

      {falhaDeInicio !== null ? (
        <p className="erro" role="alert">
          {falhaDeInicio}
        </p>
      ) : null}

      {dia.compromissos.length === 0 ? (
        <p className="texto-secundario">Sem estudos neste dia.</p>
      ) : (
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
