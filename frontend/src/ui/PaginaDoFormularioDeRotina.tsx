import { TextoDoProduto } from "../idioma";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import type {
  BaralhoListado,
  ClienteDoAcervo,
  RotinaDeEstudo,
} from "../acervo-cliente/cliente";
import { descreverDias, fusoDoNavegador, nomeDoDia } from "../agenda/datas";
import { LOCALE, useIdioma } from "../idioma";
import { DialogoDeConfirmacao } from "./DialogoDeConfirmacao";
import { deixarAvisoDaAgenda } from "./aviso-da-agenda";
import { resumoDaRotina } from "./PaginaDaAgenda";
import {
  useNavegarSemProtecao,
  useProtecaoDeSaida,
} from "./protecao-de-saida";
import type { Protecao } from "./protecao-de-saida";

/**
 * O formulário «Agendar estudo» e «Editar rotina» (016, FR-222–FR-226,
 * FR-241, FR-242, FR-249, FR-251): Baralho, sete seletores de dia, modo de
 * quantidade, resumo legível, Salvar e Cancelar.
 *
 * O padrão é **Todos os Cartões** e **nenhum dia selecionado**, para não salvar
 * um dia escolhido em silêncio. A validação identifica e foca o campo que
 * precisa de correção e preserva os demais valores; a regra autoritativa é a do
 * servidor, e as recusas dele — Baralho vazio, versão antiga, sobreposição —
 * chegam como mensagem. A intenção usa um `operacaoId` que é **reaproveitado**
 * numa nova tentativa com os mesmos valores: o reenvio acidental nunca cria
 * duas Rotinas, e confirmar a sobreposição reenvia a mesma intenção.
 *
 * Sem Baralho elegível, a tela orienta a criar um Baralho ou adicionar Cartões
 * a um existente, em vez de oferecer uma Rotina inválida. Abandonar um
 * formulário alterado pede confirmação de descarte (FR-242), e a operação em
 * andamento bloqueia a saída.
 */

type ModoDeQuantidade = "todos" | "definir";

/** A configuração digitada, em forma comparável. */
interface Rascunho {
  baralhoId: string;
  dias: number[];
  modo: ModoDeQuantidade;
  quantidade: string;
}

const RASCUNHO_VAZIO: Rascunho = {
  baralhoId: "",
  dias: [],
  modo: "todos",
  quantidade: "",
};

/** Os sete dias, na numeração da Rotina, com o nome completo (FR-252). */
const DIAS = [1, 2, 3, 4, 5, 6, 7] as const;

function nomeCompletoDoDia(dia: number, locale: string): string {
  const nome = nomeDoDia(dia, locale);
  return locale.toLowerCase().startsWith("pt") && dia <= 5 ? `${nome}-feira` : nome;
}

function rascunhoDaRotina(rotina: RotinaDeEstudo): Rascunho {
  return {
    baralhoId: rotina.baralhoId,
    dias: [...rotina.dias].sort((a, b) => a - b),
    modo: rotina.quantidade === null ? "todos" : "definir",
    quantidade: rotina.quantidade === null ? "" : String(rotina.quantidade),
  };
}

function mesmoRascunho(a: Rascunho, b: Rascunho): boolean {
  return (
    a.baralhoId === b.baralhoId &&
    a.modo === b.modo &&
    (a.modo === "todos" || a.quantidade === b.quantidade) &&
    a.dias.length === b.dias.length &&
    a.dias.every((dia, indice) => dia === b.dias[indice])
  );
}

type Campo = "baralho" | "dias" | "quantidade";

export function PaginaDoFormularioDeRotina({
  cliente,
  id,
}: {
  cliente: ClienteDoAcervo;
  /** Ausente em «Agendar estudo»; presente em «Editar rotina». */
  id?: string;
}) {
  const { textos, idioma } = useIdioma();
  const locale = LOCALE[idioma];
  const editando = id !== undefined;
  const [fuso] = useState(fusoDoNavegador);
  const [baralhos, setBaralhos] = useState<BaralhoListado[] | null>(null);
  const [rotina, setRotina] = useState<RotinaDeEstudo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falhaDeCarga, setFalhaDeCarga] = useState<string | null>(null);
  const [naoEncontrada, setNaoEncontrada] = useState<string | null>(null);
  const [tentativaDeCarga, setTentativaDeCarga] = useState(0);

  const [rascunho, setRascunho] = useState<Rascunho>(RASCUNHO_VAZIO);
  const [inicial, setInicial] = useState<Rascunho>(RASCUNHO_VAZIO);
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [falha, setFalha] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sobreposicao, setSobreposicao] = useState<string | null>(null);
  const [conflito, setConflito] = useState<{
    mensagem: string;
    atual: RotinaDeEstudo | null;
  } | null>(null);
  const [confirmacaoDeEdicao, setConfirmacaoDeEdicao] = useState(false);

  const campoDeBaralho = useRef<HTMLSelectElement>(null);
  const primeiroDia = useRef<HTMLInputElement>(null);
  const campoDeQuantidade = useRef<HTMLInputElement>(null);
  const operacao = useRef<{ chave: string; operacaoId: string } | null>(null);
  const navegarSemProtecao = useNavegarSemProtecao();

  useEffect(() => {
    let ativo = true;

    setCarregando(true);
    setFalhaDeCarga(null);
    setNaoEncontrada(null);

    void (async () => {
      const [listaDeBaralhos, listaDeRotinas] = await Promise.all([
        cliente.listarBaralhos(),
        editando ? cliente.listarRotinas() : Promise.resolve(null),
      ]);

      if (!ativo) {
        return;
      }

      if (!listaDeBaralhos.ok) {
        setFalhaDeCarga(listaDeBaralhos.mensagem);
        setCarregando(false);
        return;
      }

      setBaralhos(listaDeBaralhos.baralhos);

      if (listaDeRotinas !== null) {
        if (!listaDeRotinas.ok) {
          setFalhaDeCarga(listaDeRotinas.mensagem);
          setCarregando(false);
          return;
        }

        const encontrada = listaDeRotinas.rotinas.find(
          (item) => item.id === id,
        );

        if (encontrada === undefined) {
          setNaoEncontrada(textos.agenda.naoEncontrada);
          setCarregando(false);
          return;
        }

        setRotina(encontrada);
        setRascunho(rascunhoDaRotina(encontrada));
        setInicial(rascunhoDaRotina(encontrada));
      }

      setCarregando(false);
    })();

    return () => {
      ativo = false;
    };
  }, [cliente, id, editando, tentativaDeCarga]);

  const sujo =
    !carregando &&
    naoEncontrada === null &&
    falhaDeCarga === null &&
    !mesmoRascunho(rascunho, inicial);
  const protecao: Protecao | null = salvando
    ? { tipo: "pendencia", motivo: textos.rotina.salvando }
    : sujo
      ? {
          tipo: "descarte",
          titulo: textos.agenda.descartarAlteracoes,
          descricao: textos.agenda.descartarAlteracaoProgramacao,
          rotuloDeConfirmacao: textos.agenda.descartarConfirm,
        }
      : null;

  useProtecaoDeSaida(protecao);

  function alterar(mudanca: Partial<Rascunho>): void {
    setRascunho((atual) => ({ ...atual, ...mudanca }));
    setErros({});
    setFalha(null);
  }

  function alternarDia(dia: number): void {
    alterar({
      dias: rascunho.dias.includes(dia)
        ? rascunho.dias.filter((item) => item !== dia)
        : [...rascunho.dias, dia].sort((a, b) => a - b),
    });
  }

  /** Determina quais efeitos se aplicam à mudança na edição. */
  function determinarEfetosDeEdicao(): {
    diasRemovidos: boolean;
    diasAdicionados: boolean;
    baralhoOuQuantidadeMudaram: boolean;
  } {
    if (!editando || rotina === null) {
      return {
        diasRemovidos: false,
        diasAdicionados: false,
        baralhoOuQuantidadeMudaram: false,
      };
    }

    const diasRemovidos = rotina.dias.some(
      (dia) => !rascunho.dias.includes(dia),
    );
    const diasAdicionados = rascunho.dias.some(
      (dia) => !rotina.dias.includes(dia),
    );
    const baralhoOuQuantidadeMudaram =
      rascunho.baralhoId !== rotina.baralhoId ||
      rascunho.modo !== (rotina.quantidade === null ? "todos" : "definir") ||
      (rascunho.modo === "definir" &&
        Number(rascunho.quantidade) !== rotina.quantidade);

    return {
      diasRemovidos,
      diasAdicionados,
      baralhoOuQuantidadeMudaram,
    };
  }

  /** Valida o que o Usuário digitou, focando o primeiro campo com problema. */
  function validar(): { quantidade: number | null } | null {
    const novos: Partial<Record<Campo, string>> = {};
    let quantidade: number | null = null;

    if (rascunho.baralhoId === "") {
      novos.baralho = textos.agenda.escolhaBaralho;
    }

    if (rascunho.dias.length === 0) {
      novos.dias = textos.agenda.escolhaDia;
    }

    if (rascunho.modo === "definir") {
      const valor = Number(rascunho.quantidade);

      if (
        rascunho.quantidade.trim() === "" ||
        !Number.isInteger(valor) ||
        valor < 1 ||
        valor > 999
      ) {
        novos.quantidade = textos.agenda.informeQuantidade;
      } else {
        quantidade = valor;
      }
    }

    setErros(novos);

    if (novos.baralho !== undefined) {
      campoDeBaralho.current?.focus();
    } else if (novos.dias !== undefined) {
      primeiroDia.current?.focus();
    } else if (novos.quantidade !== undefined) {
      campoDeQuantidade.current?.focus();
    }

    return Object.keys(novos).length === 0 ? { quantidade } : null;
  }

  async function enviar(confirmarSobreposicao: boolean): Promise<void> {
    const valido = validar();

    if (valido === null) {
      return;
    }

    const corpo = {
      acao: editando ? ("editar" as const) : ("criar" as const),
      ...(editando && rotina !== null
        ? { id: rotina.id, versao: rotina.versao }
        : {}),
      baralhoId: rascunho.baralhoId,
      dias: rascunho.dias,
      quantidade: valido.quantidade,
    };
    const chave = JSON.stringify(corpo);

    // A mesma intenção reenviada reaproveita o `operacaoId` (FR-249).
    if (operacao.current === null || operacao.current.chave !== chave) {
      operacao.current = { chave, operacaoId: crypto.randomUUID() };
    }

    setSalvando(true);
    setFalha(null);
    setConflito(null);

    const resultado = await cliente.salvarRotina({
      operacaoId: operacao.current.operacaoId,
      ...corpo,
      ...(confirmarSobreposicao ? { confirmarSobreposicao: true } : {}),
      fuso,
    });

    if (resultado.ok) {
      operacao.current = null;
      deixarAvisoDaAgenda(() => `Rotina de ${resultado.rotina.nomeDoBaralho} ${editando ? "alterada" : "criada"}: ${resumoDaRotina(resultado.rotina, locale, textos)}.`);
      // A navegação de sucesso não pode ser barrada pela proteção que a própria
      // operação criou (FR-251).
      navegarSemProtecao("#/agenda");
      return;
    }

    setSalvando(false);

    if (resultado.erro === "sobreposicao") {
      setSobreposicao(resultado.mensagem);
      return;
    }

    if (resultado.erro === "conflito" && editando) {
      // Alterada em outro lugar (FR-249): o que foi digitado fica, e os valores
      // atuais ficam à vista para revisão — nada é sobrescrito em silêncio.
      const atuais = await cliente.listarRotinas();

      setConflito({
        mensagem: resultado.mensagem,
        atual: atuais.ok
          ? (atuais.rotinas.find((item) => item.id === id) ?? null)
          : null,
      });
      operacao.current = null;
      return;
    }

    // Falha: o formulário permanece preenchido e a mesma tentativa pode ser
    // repetida sem criar duas Rotinas (FR-249, FR-251).
    setFalha(resultado.mensagem);

    if (resultado.erro === "dados_invalidos") {
      campoDeBaralho.current?.focus();
    }
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();

    // Em edição, pede confirmação com os efeitos específicos
    if (editando && !confirmacaoDeEdicao) {
      setConfirmacaoDeEdicao(true);
      return;
    }

    setConfirmacaoDeEdicao(false);
    void enviar(false);
  }

  const elegiveis = (baralhos ?? []).filter((baralho) => baralho.elegivel);
  const semBaralhoElegivel =
    !editando && baralhos !== null && elegiveis.length === 0;
  const baralhoEscolhido =
    baralhos?.find((baralho) => baralho.id === rascunho.baralhoId) ?? null;
  const nomeDoEscolhido =
    baralhoEscolhido?.nome ?? rotina?.nomeDoBaralho ?? "";
  const resumo =
    rascunho.baralhoId !== "" && rascunho.dias.length > 0
      ? `${nomeDoEscolhido} · ${descreverDias(rascunho.dias, locale)} · ${textos.agenda.quantidadeCartoes(
          rascunho.modo === "todos"
            ? null
            : Number.isInteger(Number(rascunho.quantidade)) &&
                rascunho.quantidade !== ""
              ? Number(rascunho.quantidade)
              : null,
        )}${
          rascunho.modo === "definir" && rascunho.quantidade === ""
            ? ` ${textos.agenda.quantidadePendente}`
            : ""
        }`
      : "Escolha o Baralho e ao menos um dia para ver o resumo.";
  const voltar = "#/agenda";

  return (
    <div className="pagina">
      <p className="voltar">
        <a href={voltar}>
          <span aria-hidden="true">←</span>{" "}
          {textos.agenda.voltarParaRotinas.replace("← ", "")}
        </a>
      </p>

      <h1>{editando ? textos.agenda.editarRotina : textos.agenda.agendar}</h1>

      {carregando ? <p className="carregando">{textos.agenda.carregando}</p> : null}

      {!carregando && falhaDeCarga !== null ? (
        <div role="alert" className="aviso aviso--erro">
          <p><TextoDoProduto texto={falhaDeCarga} /></p>
          <button
            type="button"
            className="botao botao--secundario"
            onClick={() => setTentativaDeCarga((n) => n + 1)}
          >
            {textos.comum.tentarNovamente}
          </button>
        </div>
      ) : null}

      {!carregando && naoEncontrada !== null ? (
        <p className="erro" role="alert">
          {naoEncontrada}
        </p>
      ) : null}

      {!carregando &&
      falhaDeCarga === null &&
      naoEncontrada === null &&
      semBaralhoElegivel ? (
        <section className="estado-vazio">
          <p>
            {textos.agenda.baralhoSemCartoes}
          </p>
          <div className="acoes">
            <a className="botao botao--primario" href="#/baralhos/novo">
              {textos.agenda.criarBaralhoLinkText}
            </a>
            <a className="botao botao--secundario" href="#/baralhos">
              {textos.agenda.irParaBaralhosLinkText}
            </a>
          </div>
        </section>
      ) : null}

      {!carregando &&
      falhaDeCarga === null &&
      naoEncontrada === null &&
      !semBaralhoElegivel &&
      baralhos !== null ? (
        <section className="cartao">
          <form className="formulario" onSubmit={aoEnviar} noValidate>
            <div className="campo">
              <label className="rotulo" htmlFor="campo-do-baralho">
                {textos.selecao.baralho}
              </label>
              <select
                id="campo-do-baralho"
                ref={campoDeBaralho}
                className={editando ? "agenda__select-baralho-editando" : ""}
                value={rascunho.baralhoId}
                onChange={(evento) => alterar({ baralhoId: evento.target.value })}
                aria-invalid={erros.baralho !== undefined}
                aria-describedby={
                  erros.baralho !== undefined ? "erro-do-baralho" : undefined
                }
              >
                <option value="">{textos.rotina.escolhaUmBaralho}</option>
                {baralhos.map((baralho) => (
                  <option
                    key={baralho.id}
                    value={baralho.id}
                    disabled={
                      !baralho.elegivel && baralho.id !== inicial.baralhoId
                    }
                  >
                    {baralho.nome} (
                    {textos.rotina.cartoesDoBaralho(baralho.quantidadeDeCartoes)}
                    )
                  </option>
                ))}
                {rotina !== null &&
                !baralhos.some((baralho) => baralho.id === rotina.baralhoId) ? (
                  <option value={rotina.baralhoId}>
                    {rotina.nomeDoBaralho} (Baralho indisponível)
                  </option>
                ) : null}
              </select>
              {erros.baralho !== undefined ? (
                <p id="erro-do-baralho" className="erro" role="alert">
                  {erros.baralho}
                </p>
              ) : null}
            </div>

            <fieldset
              className="campo campo--grupo"
              aria-describedby={
                erros.dias !== undefined
                  ? "ajuda-dos-dias erro-dos-dias"
                  : "ajuda-dos-dias"
              }
            >
              <legend className="rotulo">{textos.rotina.diasDaSemana}</legend>
              <p id="ajuda-dos-dias" className="ajuda">
                {textos.rotina.ajudaDosDias}
              </p>
              <div className="agenda__escolha-de-dias">
                {DIAS.map((dia, indice) => (
                  <label key={dia} className="campo--opcao">
                    <input
                      ref={indice === 0 ? primeiroDia : undefined}
                      type="checkbox"
                      checked={rascunho.dias.includes(dia)}
                      onChange={() => alternarDia(dia)}
                    />
                    <span>{nomeCompletoDoDia(dia, locale)}</span>
                  </label>
                ))}
              </div>
              {erros.dias !== undefined ? (
                <p id="erro-dos-dias" className="erro" role="alert">
                  {erros.dias}
                </p>
              ) : null}
            </fieldset>

            <fieldset className="campo campo--grupo">
              <legend className="rotulo">{textos.rotina.quantidadeDeCartoes}</legend>
              <label className="campo--opcao">
                <input
                  type="radio"
                  name="modo-de-quantidade"
                  checked={rascunho.modo === "todos"}
                  onChange={() => alterar({ modo: "todos" })}
                />
                <span>{textos.rotina.todosOsCartoes}</span>
              </label>
              <label className="campo--opcao">
                <input
                  type="radio"
                  name="modo-de-quantidade"
                  checked={rascunho.modo === "definir"}
                  onChange={() => alterar({ modo: "definir" })}
                />
                <span>{textos.rotina.definirQuantidade}</span>
              </label>
              {rascunho.modo === "definir" ? (
                <div className="campo">
                  <label className="rotulo" htmlFor="campo-da-quantidade">
                    {textos.rotina.quantosCartoes}
                  </label>
                  <input
                    id="campo-da-quantidade"
                    ref={campoDeQuantidade}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={999}
                    value={rascunho.quantidade}
                    onChange={(evento) =>
                      alterar({ quantidade: evento.target.value })
                    }
                    aria-invalid={erros.quantidade !== undefined}
                    aria-describedby={
                      erros.quantidade !== undefined
                        ? "ajuda-da-quantidade erro-da-quantidade"
                        : "ajuda-da-quantidade"
                    }
                  />
                  <p id="ajuda-da-quantidade" className="ajuda">
                    {textos.rotina.ajudaDaQuantidade}
                  </p>
                  {erros.quantidade !== undefined ? (
                    <p id="erro-da-quantidade" className="erro" role="alert">
                      {erros.quantidade}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="ajuda">
                  {textos.rotina.ajudaDeTodos}
                </p>
              )}
            </fieldset>

            <div className="agenda__resumo-da-rotina">
              <p className="rotulo">{textos.rotina.resumo}</p>
              <p aria-live="polite" data-resumo>
                {resumo}
              </p>
            </div>

            {conflito !== null ? (
              <div role="alert" className="aviso aviso--erro">
                <p><TextoDoProduto texto={conflito.mensagem} /></p>
                {conflito.atual !== null ? (
                  <>
                    <p>{textos.agenda.valoresAtuais}: {resumoDaRotina(conflito.atual, locale, textos)}.</p>
                    <div className="acoes">
                      <button
                        type="button"
                        className="botao botao--secundario"
                        onClick={() => {
                          const atual = conflito.atual;

                          if (atual !== null) {
                            setRotina(atual);
                            setRascunho(rascunhoDaRotina(atual));
                            setInicial(rascunhoDaRotina(atual));
                          }

                          setConflito(null);
                        }}
                      >
                        {textos.rotina.usarValoresAtuais}
                      </button>
                      <button
                        type="button"
                        className="botao botao--secundario"
                        onClick={() => {
                          // Mantém o digitado, mas parte da versão que existe
                          // agora: a decisão de sobrescrever é explícita.
                          if (conflito.atual !== null) {
                            setRotina(conflito.atual);
                          }

                          setConflito(null);
                        }}
                      >
                        {textos.rotina.manterODigitado}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {falha !== null ? (
              <p className="erro" role="alert" aria-label={textos.rotina.falhaAoSalvar}>
                <TextoDoProduto texto={falha} />
              </p>
            ) : null}

            <div aria-live="polite" role="status">
              {salvando ? <p className="carregando">{textos.rotina.salvandoStatus}</p> : null}
            </div>

            <div className="acoes">
              <button
                className="botao botao--primario"
                type="submit"
                disabled={salvando}
              >
                {salvando
                  ? textos.agenda.rotuloEnviando
                  : editando
                    ? textos.agenda.salvarAlteracoes
                    : textos.agenda.salvarAgendamento}
              </button>
              <a className="botao" href={voltar}>
                {textos.comum.cancelar}
              </a>
            </div>
          </form>
        </section>
      ) : null}

      {editando && rotina !== null ? (() => {
        const efeitos = determinarEfetosDeEdicao();

        return (
          <DialogoDeConfirmacao
            aberto={confirmacaoDeEdicao}
            titulo={textos.rotina.confirmarAlteracoes}
            rotuloDeConfirmacao={textos.rotina.confirmar}
            rotuloDeCancelamento={textos.rotina.voltar}
            aoConfirmar={() => {
              setConfirmacaoDeEdicao(false);
              void enviar(false);
            }}
            aoCancelar={() => setConfirmacaoDeEdicao(false)}
          >
            <div className="agenda__confirmacao-de-edicao">
              {efeitos.diasRemovidos ? (
                <p>
                  <strong>{textos.rotina.diasRemovidos}</strong>{" "}
                  {textos.rotina.efeitoDiasRemovidos}
                </p>
              ) : null}
              {efeitos.diasAdicionados ? (
                <p>
                  <strong>{textos.rotina.diasAdicionados}</strong>{" "}
                  {textos.rotina.efeitoDiasAdicionados}
                </p>
              ) : null}
              {efeitos.baralhoOuQuantidadeMudaram ? (
                <p>
                  <strong>{textos.rotina.baralhoOuQuantidadeMudaram}</strong>{" "}
                  {textos.rotina.efeitoBaralhoOuQuantidade}
                </p>
              ) : null}
              <p className="texto-secundario">
                {textos.rotina.preservados}
              </p>
            </div>
          </DialogoDeConfirmacao>
        );
      })() : null}

      <DialogoDeConfirmacao
        aberto={sobreposicao !== null}
        titulo={textos.rotina.confirmarIndependentes}
        rotuloDeConfirmacao={textos.rotina.confirmarESalvar}
        aoConfirmar={() => {
          setSobreposicao(null);
          void enviar(true);
        }}
        aoCancelar={() => setSobreposicao(null)}
      >
        <p><TextoDoProduto texto={sobreposicao} /></p>
        <p>
          {textos.rotina.cadaRotinaContaSeparado}
        </p>
      </DialogoDeConfirmacao>
    </div>
  );
}
