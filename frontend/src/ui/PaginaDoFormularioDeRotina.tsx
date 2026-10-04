import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import type {
  BaralhoListado,
  ClienteDoAcervo,
  RotinaDeEstudo,
} from "../acervo-cliente/cliente";
import { descreverDias, fusoDoNavegador, nomeDoDia } from "../agenda/datas";
import { descreverQuantidade } from "../agenda/estado-do-dia";
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

function nomeCompletoDoDia(dia: number): string {
  return dia <= 5 ? `${nomeDoDia(dia)}-feira` : nomeDoDia(dia);
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
          setNaoEncontrada("Rotina não encontrada.");
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
    ? { tipo: "pendencia", motivo: "Aguarde: a Rotina está sendo salva." }
    : sujo
      ? {
          tipo: "descarte",
          titulo: "Descartar as alterações?",
          descricao: "A programação digitada será perdida.",
          rotuloDeConfirmacao: "Descartar",
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

  /** Valida o que o Usuário digitou, focando o primeiro campo com problema. */
  function validar(): { quantidade: number | null } | null {
    const novos: Partial<Record<Campo, string>> = {};
    let quantidade: number | null = null;

    if (rascunho.baralhoId === "") {
      novos.baralho = "Escolha um Baralho para a Rotina.";
    }

    if (rascunho.dias.length === 0) {
      novos.dias = "Escolha ao menos um dia da semana.";
    }

    if (rascunho.modo === "definir") {
      const valor = Number(rascunho.quantidade);

      if (
        rascunho.quantidade.trim() === "" ||
        !Number.isInteger(valor) ||
        valor < 1 ||
        valor > 999
      ) {
        novos.quantidade =
          "Informe um número inteiro de 1 a 999 Cartões, ou escolha Todos os Cartões.";
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
      deixarAvisoDaAgenda(
        `Rotina de ${resultado.rotina.nomeDoBaralho} ${editando ? "alterada" : "criada"}: ${resumoDaRotina(resultado.rotina)}.`,
      );
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
      ? `${nomeDoEscolhido} · ${descreverDias(rascunho.dias)} · ${descreverQuantidade(
          rascunho.modo === "todos"
            ? null
            : Number.isInteger(Number(rascunho.quantidade)) &&
                rascunho.quantidade !== ""
              ? Number(rascunho.quantidade)
              : null,
        )}${
          rascunho.modo === "definir" && rascunho.quantidade === ""
            ? " (informe a quantidade)"
            : ""
        }`
      : "Escolha o Baralho e ao menos um dia para ver o resumo.";
  const voltar = "#/agenda";

  return (
    <div className="pagina">
      <p className="voltar">
        <a href={voltar}>
          <span aria-hidden="true">←</span>{" "}
          Voltar para Rotinas de estudo
        </a>
      </p>

      <h1>{editando ? "Editar rotina" : "Agendar estudo"}</h1>

      {carregando ? <p className="carregando">Carregando…</p> : null}

      {!carregando && falhaDeCarga !== null ? (
        <div role="alert" className="aviso aviso--erro">
          <p>{falhaDeCarga}</p>
          <button
            type="button"
            className="botao botao--secundario"
            onClick={() => setTentativaDeCarga((n) => n + 1)}
          >
            Tentar novamente
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
            Você ainda não tem um Baralho com Cartões para agendar. Crie um
            Baralho, ou adicione Cartões a um Baralho existente.
          </p>
          <div className="acoes">
            <a className="botao botao--primario" href="#/baralhos/novo">
              Criar Baralho
            </a>
            <a className="botao botao--secundario" href="#/baralhos">
              Ir para Baralhos
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
                Baralho
              </label>
              <select
                id="campo-do-baralho"
                ref={campoDeBaralho}
                value={rascunho.baralhoId}
                onChange={(evento) => alterar({ baralhoId: evento.target.value })}
                aria-invalid={erros.baralho !== undefined}
                aria-describedby={
                  erros.baralho !== undefined ? "erro-do-baralho" : undefined
                }
              >
                <option value="">Escolha um Baralho</option>
                {baralhos.map((baralho) => (
                  <option
                    key={baralho.id}
                    value={baralho.id}
                    disabled={
                      !baralho.elegivel && baralho.id !== inicial.baralhoId
                    }
                  >
                    {baralho.nome} (
                    {baralho.quantidadeDeCartoes === 0
                      ? "sem Cartões"
                      : baralho.quantidadeDeCartoes === 1
                        ? "1 Cartão"
                        : `${baralho.quantidadeDeCartoes} Cartões`}
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
              <legend className="rotulo">Dias da semana</legend>
              <p id="ajuda-dos-dias" className="ajuda">
                Escolha um ou mais dias. A rotina se repete toda semana.
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
                    <span>{nomeCompletoDoDia(dia)}</span>
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
              <legend className="rotulo">Quantidade de Cartões</legend>
              <label className="campo--opcao">
                <input
                  type="radio"
                  name="modo-de-quantidade"
                  checked={rascunho.modo === "todos"}
                  onChange={() => alterar({ modo: "todos" })}
                />
                <span>Todos os Cartões</span>
              </label>
              <label className="campo--opcao">
                <input
                  type="radio"
                  name="modo-de-quantidade"
                  checked={rascunho.modo === "definir"}
                  onChange={() => alterar({ modo: "definir" })}
                />
                <span>Definir quantidade</span>
              </label>
              {rascunho.modo === "definir" ? (
                <div className="campo">
                  <label className="rotulo" htmlFor="campo-da-quantidade">
                    Quantos Cartões por estudo
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
                    De 1 a 999. Se o Baralho tiver menos Cartões, o estudo usa
                    todos os disponíveis.
                  </p>
                  {erros.quantidade !== undefined ? (
                    <p id="erro-da-quantidade" className="erro" role="alert">
                      {erros.quantidade}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="ajuda">
                  O estudo usa todos os Cartões do Baralho no momento em que
                  começa.
                </p>
              )}
            </fieldset>

            <div className="agenda__resumo-da-rotina">
              <p className="rotulo">Resumo</p>
              <p aria-live="polite" data-resumo>
                {resumo}
              </p>
            </div>

            {editando ? (
              <p className="alcance-da-edicao">
                A mudança vale para o estudo de hoje, se ainda não foi
                concluído, e para os próximos. Dias removidos cancelam o estudo
                de hoje. Estudos passados e concluídos são preservados.
                Sessões já iniciadas ainda poderão concluir o estudo de hoje.
              </p>
            ) : null}

            {conflito !== null ? (
              <div role="alert" className="aviso aviso--erro">
                <p>{conflito.mensagem}</p>
                {conflito.atual !== null ? (
                  <>
                    <p>Valores atuais: {resumoDaRotina(conflito.atual)}.</p>
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
                        Usar os valores atuais
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
                        Manter o que digitei
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {falha !== null ? (
              <p className="erro" role="alert" aria-label="Falha ao salvar a Rotina">
                {falha}
              </p>
            ) : null}

            <div aria-live="polite" role="status">
              {salvando ? <p className="carregando">Salvando…</p> : null}
            </div>

            <div className="acoes">
              <button
                className="botao botao--primario"
                type="submit"
                disabled={salvando}
              >
                {salvando
                  ? "Salvando…"
                  : editando
                    ? "Salvar alterações"
                    : "Salvar agendamento"}
              </button>
              <a className="botao" href={voltar}>
                Cancelar
              </a>
            </div>
          </form>
        </section>
      ) : null}

      <DialogoDeConfirmacao
        aberto={sobreposicao !== null}
        titulo="Confirmar estudos independentes?"
        rotuloDeConfirmacao="Confirmar e salvar"
        aoConfirmar={() => {
          setSobreposicao(null);
          void enviar(true);
        }}
        aoCancelar={() => setSobreposicao(null)}
      >
        <p>{sobreposicao}</p>
        <p>
          Cada Rotina gera o seu próprio estudo, e os dois contam separadamente.
        </p>
      </DialogoDeConfirmacao>
    </div>
  );
}
