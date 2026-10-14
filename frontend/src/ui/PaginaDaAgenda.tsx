import { TextoDoProduto } from "../idioma";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type {
  AcaoDeRotina,
  ClienteDoAcervo,
  RotinaDeEstudo,
} from "../acervo-cliente/cliente";
import { descreverDias, fusoDoNavegador } from "../agenda/datas";
import { LOCALE, useIdioma } from "../idioma";
import { DialogoDeConfirmacao } from "./DialogoDeConfirmacao";
import { EstadoDaCarga } from "./EstadoDaCarga";
import { receberAvisoDaAgenda } from "./aviso-da-agenda";
import { useProtecaoDeSaida } from "./protecao-de-saida";

/**
 * Rotinas de estudo (016, FR-237–FR-239, FR-242, FR-249, FR-251), alcançadas
 * a partir da área de Estudo (019, FR-316, FR-323): as Rotinas ativas e
 * pausadas, na ordem de criação, com Baralho, dias, quantidade, situação e as
 * ações Editar, Pausar/Retomar e Excluir.
 *
 * Pausar e Excluir pedem confirmação das consequências antes de qualquer
 * gravação (FR-239); o diálogo começa em Cancelar, aceita Escape e devolve o foco
 * ao acionador. Cada intenção usa um `operacaoId` próprio, **reaproveitado** nas
 * novas tentativas depois de uma falha — é isso que impede a Rotina duplicada ou
 * a ação aplicada duas vezes (FR-249). A operação em andamento desabilita o
 * envio, anuncia o salvamento e bloqueia a saída. Uma Rotina alterada em outro
 * lugar responde conflito: a lista é recarregada e a mudança alheia nunca é
 * sobrescrita em silêncio.
 */


/** Uma ação aguardando confirmação (FR-239). */
interface ConfirmacaoPendente {
  acao: "pausar" | "excluir";
  rotina: RotinaDeEstudo;
  /** O acionador, para devolver o foco ao cancelar (FR-252). */
  acionador: HTMLElement | null;
}

/** Uma retomada que depende de o Usuário confirmar estudos independentes (FR-226). */
interface SobreposicaoPendente {
  rotina: RotinaDeEstudo;
  mensagem: string;
}

/** O resumo legível de uma Rotina: «Inglês · segunda e quinta · 20 Cartões». */
export function resumoDaRotina(rotina: {
  nomeDoBaralho: string;
  dias: readonly number[];
  quantidade: number | null;
}, locale: string, textos: ReturnType<typeof useIdioma>["textos"]): string {
  return `${rotina.nomeDoBaralho} · ${descreverDias(rotina.dias, locale)} · ${textos.agenda.quantidadeCartoes(rotina.quantidade)}`;
}

export function PaginaDaAgenda({ cliente }: { cliente: ClienteDoAcervo }) {
  const { textos, idioma } = useIdioma();
  const locale = LOCALE[idioma];
  const [fuso] = useState(fusoDoNavegador);
  const [rotinas, setRotinas] = useState<RotinaDeEstudo[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falha, setFalha] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [falhaDeOperacao, setFalhaDeOperacao] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoPendente | null>(null);
  const [sobreposicao, setSobreposicao] = useState<SobreposicaoPendente | null>(
    null,
  );
  const [operando, setOperando] = useState<string | null>(null);

  // O `operacaoId` de cada intenção, reaproveitado nas novas tentativas.
  const operacoes = useRef(new Map<string, string>());
  const ultimaLeitura = useRef(0);
  const titulo = useRef<HTMLHeadingElement>(null);
  const foco = useRef<{ tipo: "rotina"; id: string } | { tipo: "lista" } | null>(
    null,
  );
  const itens = useRef(new Map<string, HTMLLIElement>());

  const carregar = useCallback(async () => {
    const numero = ultimaLeitura.current + 1;

    ultimaLeitura.current = numero;
    setCarregando(true);

    const resultado = await cliente.listarRotinas();

    if (ultimaLeitura.current !== numero) {
      return;
    }

    if (resultado.ok) {
      setRotinas(resultado.rotinas);
      setFalha(null);
    } else {
      // Os dados anteriores só permanecem com a falha indicada (FR-240).
      setFalha(resultado.mensagem);
    }

    setCarregando(false);
  }, [cliente]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Ao voltar para esta aba, a lista é relida para mostrar o que mudou em outro
  // lugar (FR-318). Nem a operação em curso nem a confirmação aberta são
  // interrompidas: nesses casos a leitura fica para depois.
  useEffect(() => {
    function aoMudarVisibilidade(): void {
      if (
        document.visibilityState === "visible" &&
        operando === null &&
        confirmacao === null
      ) {
        void carregar();
      }
    }

    document.addEventListener("visibilitychange", aoMudarVisibilidade);

    return () =>
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
  }, [carregar, operando, confirmacao]);

  // O aviso deixado pelo formulário é lido uma única vez. Só sobrescreve quando
  // há aviso: o efeito pode rodar duas vezes em desenvolvimento.
  useEffect(() => {
    const recebido = receberAvisoDaAgenda(textos.agenda);

    if (recebido !== null) {
      setAviso(recebido);
    }
  }, [textos]);

  // O foco volta à Rotina alterada, ou a um destino estável quando ela saiu da
  // lista (FR-252). É um efeito de layout, como nas demais telas: sem foco
  // transitório no <body>.
  useLayoutEffect(() => {
    const alvo = foco.current;

    if (alvo === null || carregando) {
      return;
    }

    foco.current = null;

    if (alvo.tipo === "rotina") {
      const item = itens.current.get(alvo.id);

      if (item !== undefined) {
        item.focus();
        return;
      }
    }

    titulo.current?.focus();
  }, [rotinas, carregando]);

  useProtecaoDeSaida(
    operando !== null
      ? { tipo: "pendencia", motivo: textos.agenda.rotinaSendoSalva }
      : null,
  );

  async function executar(
    acao: AcaoDeRotina,
    rotina: RotinaDeEstudo,
    confirmarSobreposicao = false,
  ): Promise<void> {
    const chave = `${acao}:${rotina.id}:${rotina.versao}`;
    const operacaoId = operacoes.current.get(chave) ?? crypto.randomUUID();

    operacoes.current.set(chave, operacaoId);
    setOperando(rotina.id);
    setFalhaDeOperacao(null);
    setAviso(null);

    const resultado = await cliente.salvarRotina({
      operacaoId,
      acao,
      id: rotina.id,
      versao: rotina.versao,
      ...(confirmarSobreposicao ? { confirmarSobreposicao: true } : {}),
      fuso,
    });

    setOperando(null);

    if (resultado.ok) {
      operacoes.current.delete(chave);
      foco.current =
        acao === "excluir"
          ? { tipo: "lista" }
          : { tipo: "rotina", id: rotina.id };
      // O anúncio só vem depois da releitura: até lá os botões ainda carregam a
      // versão antiga da Rotina, e quem agisse ao ver «retomada» tocaria numa
      // Rotina já alterada e receberia um conflito.
      await carregar();
      setAviso(textos.agenda.rotinaAlterada(rotina.nomeDoBaralho, acao));
      return;
    }

    if (resultado.erro === "sobreposicao") {
      // Falha não consome o `operacaoId`: confirmar reenvia a mesma intenção.
      setSobreposicao({ rotina, mensagem: resultado.mensagem });
      return;
    }

    if (resultado.erro === "conflito" || resultado.erro === "nao_encontrado") {
      // Alterada em outro lugar: a intenção antiga morre e a lista atual vale.
      operacoes.current.delete(chave);
      setFalhaDeOperacao(resultado.mensagem);
      await carregar();
      return;
    }

    setFalhaDeOperacao(resultado.mensagem);
  }

  function confirmar(): void {
    if (confirmacao === null) {
      return;
    }

    const { acao, rotina } = confirmacao;

    setConfirmacao(null);
    void executar(acao, rotina);
  }

  function cancelarConfirmacao(): void {
    const acionador = confirmacao?.acionador ?? null;

    setConfirmacao(null);
    // A confirmação inicia em Cancelar e devolve o foco ao acionador (FR-252).
    window.setTimeout(() => acionador?.focus(), 0);
  }

  return (
    <div className="pagina">
      <p className="voltar">
        <a href="#/estudo">
          <span aria-hidden="true">←</span> {textos.agenda.voltarParaEstudo}
        </a>
      </p>

      <div className="cabecalho-da-pagina">
        <div>
          <h1>{textos.agenda.rotinasDeEstudo}</h1>
        </div>
        <div className="acoes">
          <a className="botao botao--primario" href="#/agenda/nova">
            {textos.agenda.agendar}
          </a>
        </div>
      </div>

      <div aria-live="polite" role="status" className="agenda__anuncio">
        {aviso !== null ? <p className="aviso aviso--sucesso"><TextoDoProduto texto={aviso} /></p> : null}
        {operando !== null ? <p className="carregando">{textos.comum.salvar}</p> : null}
      </div>

      {falhaDeOperacao !== null ? (
        <p className="erro" role="alert">
          <TextoDoProduto texto={falhaDeOperacao} />
        </p>
      ) : null}

      {rotinas === null && carregando ? (
        <EstadoDaCarga estado="carregando" mensagem={textos.agenda.carregandoRotinas} />
      ) : null}

      {rotinas === null && !carregando && falha !== null ? (
        <EstadoDaCarga
          estado="falha"
          mensagem={falha}
          aoTentarNovamente={() => void carregar()}
        />
      ) : null}

      {rotinas !== null ? (
        <section aria-labelledby="titulo-das-rotinas" className="pilha">
          <h2 id="titulo-das-rotinas" ref={titulo} tabIndex={-1}>
            {textos.agenda.suasRotinas}
          </h2>

          {falha !== null ? (
            <div role="alert" className="aviso aviso--erro">
              <p>
                {textos.agenda.naoFoiPossivelAtualizarAgenda} <TextoDoProduto texto={falha} />
              </p>
              <button
                type="button"
                className="botao botao--secundario"
                onClick={() => void carregar()}
              >
                {textos.comum.tentarNovamente}
              </button>
            </div>
          ) : null}

          {rotinas.length === 0 ? (
            <EstadoDaCarga
              estado="vazio"
              mensagem={textos.agenda.naoTemRotinas}
              acao={
                <a className="botao botao--primario" href="#/agenda/nova">
                  {textos.agenda.agendar}
                </a>
              }
            />
          ) : (
            <ul className="lista agenda__rotinas">
              {rotinas.map((rotina) => (
                <li
                  key={rotina.id}
                  ref={(elemento) => {
                    if (elemento === null) {
                      itens.current.delete(rotina.id);
                    } else {
                      itens.current.set(rotina.id, elemento);
                    }
                  }}
                  tabIndex={-1}
                  className={`agenda__rotina ${
                    rotina.estado === "pausada" ? "agenda__rotina--pausada" : ""
                  }`}
                >
                  <div className="agenda__rotina-texto">
                    <h3 className="titulo-do-item">{rotina.nomeDoBaralho}</h3>
                    <p>{resumoDaRotina(rotina, locale, textos)}</p>
                    <p className="texto-secundario">
                      {textos.agenda.situacao}{" "}
                      <span className="agenda__rotina-status">
                        {rotina.estado === "pausada" ? textos.agenda.pausada : textos.agenda.ativa}
                      </span>
                      {rotina.indisponivel ? (
                        <>
                          {" · "}
                          <strong>{textos.agenda.baralhoIndisponivel}</strong>
                        </>
                      ) : null}
                    </p>
                  </div>

                  <div className="acoes">
                    <a
                      className="botao botao--secundario"
                      href={`#/agenda/${encodeURIComponent(rotina.id)}/editar`}
                      aria-label={textos.agenda.rotuloEditar(rotina.nomeDoBaralho)}
                    >
                      {textos.agenda.editar}
                    </a>
                    {rotina.estado === "pausada" ? (
                      <button
                        type="button"
                        className="botao botao--secundario"
                        disabled={operando !== null}
                        aria-label={textos.agenda.rotuloRetomar(rotina.nomeDoBaralho)}
                        onClick={() => void executar("retomar", rotina)}
                      >
                        {textos.agenda.retomar}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="botao botao--secundario"
                        disabled={operando !== null}
                        aria-label={textos.agenda.rotuloPausar(rotina.nomeDoBaralho)}
                        onClick={(evento) =>
                          setConfirmacao({
                            acao: "pausar",
                            rotina,
                            acionador: evento.currentTarget,
                          })
                        }
                      >
                        {textos.agenda.pausar}
                      </button>
                    )}
                    <button
                      type="button"
                      className="botao botao--secundario"
                      disabled={operando !== null}
                      aria-label={textos.agenda.rotuloExcluir(rotina.nomeDoBaralho)}
                      onClick={(evento) =>
                        setConfirmacao({
                          acao: "excluir",
                          rotina,
                          acionador: evento.currentTarget,
                        })
                      }
                    >
                      {textos.agenda.excluir}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <DialogoDeConfirmacao
        aberto={confirmacao !== null}
        titulo={
          confirmacao === null
            ? ""
            : confirmacao.acao === "pausar"
              ? textos.agenda.pausarRotina(confirmacao.rotina.nomeDoBaralho)
              : textos.agenda.excluirRotina(confirmacao.rotina.nomeDoBaralho)
        }
        rotuloDeConfirmacao={
          confirmacao?.acao === "excluir" ? textos.agenda.excluirConfirm : textos.agenda.pausarConfirm
        }
        aoConfirmar={confirmar}
        aoCancelar={cancelarConfirmacao}
      >
        <p>
          {textos.agenda.efeitoDaPausaOuExclusao(confirmacao?.acao === "pausar")}
        </p>
        <p>
          {textos.agenda.sessoesIniciadasConcluem(confirmacao?.acao === "excluir")}
        </p>
      </DialogoDeConfirmacao>

      <DialogoDeConfirmacao
        aberto={sobreposicao !== null}
        titulo={textos.agenda.confirmarIndependentes}
        rotuloDeConfirmacao={textos.agenda.confirmarRotulo}
        aoConfirmar={() => {
          const pendente = sobreposicao;

          setSobreposicao(null);

          if (pendente !== null) {
            void executar("retomar", pendente.rotina, true);
          }
        }}
        aoCancelar={() => setSobreposicao(null)}
      >
        <p><TextoDoProduto texto={sobreposicao?.mensagem} /></p>
      </DialogoDeConfirmacao>
    </div>
  );
}
