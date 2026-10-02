import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { BaralhoComCartoes, ClienteDoAcervo } from "../acervo-cliente/cliente";
import { AleatoriedadeReal } from "../sessao-de-estudo/aleatoriedade";
import type { Aleatoriedade } from "../sessao-de-estudo/aleatoriedade";
import {
  MENSAGEM_DE_BARALHO_INELEGIVEL,
  SessaoDeEstudo,
} from "../sessao-de-estudo/sessao-de-estudo";
import type {
  EstadoDaSessao,
  EstadoDaSessaoConcluida,
  ResultadoDoItem,
} from "../sessao-de-estudo/sessao-de-estudo";
import { ResumoDaSessao } from "./ResumoDaSessao";
import type { ItemDoResumo } from "./ResumoDaSessao";
import { irParaRota } from "./navegacao";
import { useAcaoProtegida, useProtecaoDeSaida } from "./protecao-de-saida";
import type { Protecao } from "./protecao-de-saida";

/**
 * Tela da Sessão de estudo (T304–T307; specs/004-sessao-de-estudo/tasks.md;
 * T1114, T1115; specs/012-interface-visual-navegavel/tasks.md, FR-149 a
 * FR-152, SC-067; FR-025, FR-027 a FR-029, FR-032 a FR-037, FR-041, FR-042,
 * FR-046 a FR-049).
 *
 * Consome somente a Interface `ClienteDoAcervo` para carregar o Baralho e a
 * Interface `SessaoDeEstudo` para iniciar, revelar, registrar Resultado e
 * derivar o Resumo. A Sessão vive apenas no estado deste componente: nenhuma
 * operação de rede acontece depois do carregamento do Baralho, e sair da tela
 * descarta a instância (FR-038, FR-039).
 *
 * A ordem dos Itens usa `AleatoriedadeReal` em produção; testes injetam o
 * Adapter determinístico pela propriedade opcional `aleatoriedade`.
 *
 * A tela reúne as três fases — Configuração, Sessão e Resumo — na mesma rota
 * `#/baralhos/:id/estudo` (FR-149). Sair antes de concluir perde trabalho, e
 * por isso a página registra `useProtecaoDeSaida` (FR-150, FR-151): tanto a
 * quantidade já alterada quanto a Sessão em andamento pedem confirmação antes
 * de qualquer navegação, e o botão "Interromper" passa pela mesma confirmação,
 * via `useAcaoProtegida`. O Resumo apresenta o percentual e as contagens
 * derivadas dos Itens (FR-152, FR-174, SC-067, SC-073).
 *
 * Concluída a Sessão, a página a registra no histórico (FR-161, FR-163) com um
 * `id` gerado uma única vez por Sessão concluída: uma nova tentativa reenvia o
 * mesmo `id` e não duplica o Registro. Sessão interrompida nunca é registrada
 * (FR-162) e, enquanto o Registro não estiver confirmado, sair do Resumo pede
 * confirmação (FR-164).
 */

interface PropriedadesDaPaginaDeEstudo {
  cliente: ClienteDoAcervo;
  id: string;
  aleatoriedade?: Aleatoriedade;
}

type AlvoDeFoco = "frente" | "verso" | "resumo" | "quantidade";

/**
 * A situação do Registro da Sessão no histórico (FR-161, FR-163 a FR-165): o
 * envio é automático ao concluir e, depois de uma falha, pode ser tentado de
 * novo com o **mesmo** `id` — é o que torna a operação idempotente e segura a
 * um reenvio.
 */
type SituacaoDoRegistro =
  | { estado: "ocioso" }
  | { estado: "registrando" }
  | { estado: "registrada" }
  | { estado: "falhou"; mensagem: string };

export function PaginaDeEstudo({
  cliente,
  id,
  aleatoriedade,
}: PropriedadesDaPaginaDeEstudo) {
  const [aleatoriedadePadrao] = useState(() => new AleatoriedadeReal());
  const aleatoriedadeDaSessao = aleatoriedade ?? aleatoriedadePadrao;

  const [baralho, setBaralho] = useState<BaralhoComCartoes | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falhaDeCarregamento, setFalhaDeCarregamento] = useState<string | null>(
    null,
  );
  const [baralhoNaoEncontrado, setBaralhoNaoEncontrado] = useState<string | null>(
    null,
  );

  const [quantidade, setQuantidade] = useState("");
  const [falhaDeInicio, setFalhaDeInicio] = useState<string | null>(null);
  const [sessao, setSessao] = useState<SessaoDeEstudo | null>(null);
  const [estado, setEstado] = useState<EstadoDaSessao | null>(null);
  const [situacaoDoRegistro, setSituacaoDoRegistro] =
    useState<SituacaoDoRegistro>({ estado: "ocioso" });

  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [sequenciaDeAnuncio, setSequenciaDeAnuncio] = useState(0);

  const alvoDeFoco = useRef<AlvoDeFoco | null>(null);
  const frenteRef = useRef<HTMLHeadingElement>(null);
  const versoRef = useRef<HTMLHeadingElement>(null);
  const resumoRef = useRef<HTMLHeadingElement>(null);
  const quantidadeRef = useRef<HTMLInputElement>(null);
  const idDoRegistroDeSessao = useRef<string | null>(null);

  useEffect(() => {
    let ativo = true;

    setCarregando(true);
    setFalhaDeCarregamento(null);
    setBaralhoNaoEncontrado(null);
    setBaralho(null);
    setQuantidade("");
    setFalhaDeInicio(null);
    setSessao(null);
    setEstado(null);
    setAnuncio(null);
    setSequenciaDeAnuncio(0);
    setSituacaoDoRegistro({ estado: "ocioso" });
    idDoRegistroDeSessao.current = null;
    alvoDeFoco.current = null;

    void cliente.obterBaralho(id).then((resultado) => {
      if (!ativo) {
        return;
      }

      if (!resultado.ok) {
        if (resultado.erro === "nao_encontrado") {
          setBaralhoNaoEncontrado(resultado.mensagem);
        } else {
          setFalhaDeCarregamento(resultado.mensagem);
        }
      } else {
        setBaralho(resultado.baralho);
      }

      setCarregando(false);
    });

    return () => {
      ativo = false;
    };
  }, [cliente, id]);

  useEffect(() => {
    if (alvoDeFoco.current === null) {
      return;
    }

    const alvo = alvoDeFoco.current;
    alvoDeFoco.current = null;

    if (alvo === "frente") {
      frenteRef.current?.focus();
    } else if (alvo === "verso") {
      versoRef.current?.focus();
    } else if (alvo === "resumo") {
      resumoRef.current?.focus();
    } else {
      quantidadeRef.current?.focus();
    }
  }, [estado]);

  const emAndamento = sessao !== null && estado !== null && !estado.concluida;
  // Sessão concluída e ainda não registrada: sair perde o Registro, e por isso
  // a navegação pede confirmação até o histórico confirmar (FR-164).
  const aguardandoRegistro =
    estado !== null &&
    estado.concluida &&
    situacaoDoRegistro.estado !== "registrada";
  const emConfiguracaoComMudanca =
    sessao === null &&
    estado === null &&
    baralho !== null &&
    quantidade !== "";
  const protecaoDeSaida: Protecao | null = emAndamento
    ? {
        tipo: "descarte",
        titulo: "Interromper a Sessão?",
        descricao:
          "O progresso desta Sessão será descartado e não haverá Resumo.",
        rotuloDeConfirmacao: "Interromper",
      }
    : aguardandoRegistro
      ? {
          tipo: "descarte",
          titulo: "Sair sem registrar a Sessão?",
          descricao: "Esta Sessão não ficará no seu histórico.",
          rotuloDeConfirmacao: "Sair sem registrar",
        }
      : emConfiguracaoComMudanca
        ? {
            tipo: "descarte",
            titulo: "Descartar a configuração?",
            descricao: "A quantidade escolhida será perdida.",
            rotuloDeConfirmacao: "Descartar",
          }
        : null;

  useProtecaoDeSaida(protecaoDeSaida);
  const protegerAcao = useAcaoProtegida();

  function anunciar(mensagem: string): void {
    setAnuncio(mensagem);
    setSequenciaDeAnuncio((atual) => atual + 1);
  }

  function interromper(): void {
    setSessao(null);
    setEstado(null);
    setQuantidade("");
    setAnuncio(null);
    setSituacaoDoRegistro({ estado: "ocioso" });
    idDoRegistroDeSessao.current = null;
    alvoDeFoco.current = null;
    irParaRota(`#/baralhos/${id}`);
  }

  function estudarNovamente(): void {
    alvoDeFoco.current = "quantidade";
    setSessao(null);
    setEstado(null);
    setQuantidade("");
    setFalhaDeInicio(null);
    setAnuncio(null);
    setSituacaoDoRegistro({ estado: "ocioso" });
    idDoRegistroDeSessao.current = null;
  }

  function iniciarSessao(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();

    if (baralho === null) {
      return;
    }

    setFalhaDeInicio(null);
    setSituacaoDoRegistro({ estado: "ocioso" });
    idDoRegistroDeSessao.current = null;

    const resultado = SessaoDeEstudo.iniciar(
      id,
      Number(quantidade),
      baralho.cartoes,
      aleatoriedadeDaSessao,
    );

    if (!resultado.ok) {
      setFalhaDeInicio(resultado.mensagem);
      quantidadeRef.current?.focus();
      return;
    }

    const novaSessao = resultado.sessao;
    const estadoInicial = novaSessao.estadoAtual();

    setSessao(novaSessao);
    setEstado(estadoInicial);
    alvoDeFoco.current = "frente";
    // O aviso de limite é exibido na própria tela (FR-149); o anúncio é
    // distinto para não duplicar o mesmo texto na página.
    anunciar(
      `Sessão iniciada com ${estadoInicial.total} ${
        estadoInicial.total === 1 ? "Item" : "Itens"
      }.`,
    );
  }

  function revelar(): void {
    if (sessao === null) {
      return;
    }

    const resultado = sessao.revelar();

    if (!resultado.ok) {
      return;
    }

    alvoDeFoco.current = "verso";
    setEstado(sessao.estadoAtual());
    anunciar("Verso revelado.");
  }

  function registrarResultado(resultado: ResultadoDoItem): void {
    if (sessao === null) {
      return;
    }

    const resposta = sessao.registrarResultado(resultado);

    if (!resposta.ok) {
      return;
    }

    const estadoAtualizado = sessao.estadoAtual();
    setEstado(estadoAtualizado);

    if (estadoAtualizado.concluida) {
      alvoDeFoco.current = "resumo";
      anunciar("Sessão concluída.");
      // Os Itens do Resumo saem do estado da Sessão concluída, na ordem em que
      // foram apresentados (FR-176): é essa a ordem que a tela exibe e que o
      // Registro transporta.
      registrarNoHistorico(itensDoResumo(estadoAtualizado));
      return;
    }

    alvoDeFoco.current = "frente";
    anunciar(`Resultado registrado: ${resultado}.`);
  }

  /**
   * Registra a Sessão concluída no histórico (FR-161, FR-163). O `id` é gerado
   * na primeira tentativa e guardado: "Tentar registrar novamente" reenvia o
   * **mesmo** `id`, e é isso que impede o Registro duplicado. Só é chamada
   * quando a Sessão termina — Sessão interrompida nunca registra (FR-162).
   */
  function registrarNoHistorico(itens: readonly ItemDoResumo[]): void {
    if (baralho === null) {
      return;
    }

    const idDoRegistro = idDoRegistroDeSessao.current ?? crypto.randomUUID();
    idDoRegistroDeSessao.current = idDoRegistro;

    setSituacaoDoRegistro({ estado: "registrando" });

    void cliente
      .registrarSessao({
        id: idDoRegistro,
        baralhoId: id,
        nomeDoBaralho: baralho.nome,
        itens: [...itens],
      })
      .then((resultado) => {
        setSituacaoDoRegistro(
          resultado.ok
            ? { estado: "registrada" }
            : { estado: "falhou", mensagem: resultado.mensagem },
        );
      });
  }

  function registrarNovamente(): void {
    if (estado === null || !estado.concluida) {
      return;
    }

    registrarNoHistorico(itensDoResumo(estado));
  }

  if (carregando) {
    return (
      <div className="pilha">
        <p className="voltar">
          <a href={`#/baralhos/${id}`}>
            <span aria-hidden="true">←</span> Voltar para o Baralho
          </a>
        </p>
        <h1>Estudar Baralho</h1>
        <p className="carregando">Carregando Baralho…</p>
      </div>
    );
  }

  if (baralhoNaoEncontrado !== null) {
    return (
      <div className="pilha">
        <p className="voltar">
          <a href={`#/baralhos/${id}`}>
            <span aria-hidden="true">←</span> Voltar para o Baralho
          </a>
        </p>
        <h1>Baralho não encontrado</h1>
        <p className="erro" role="alert" aria-label="Baralho não encontrado">
          {baralhoNaoEncontrado}
        </p>
      </div>
    );
  }

  if (falhaDeCarregamento !== null) {
    return (
      <div className="pilha">
        <p className="voltar">
          <a href={`#/baralhos/${id}`}>
            <span aria-hidden="true">←</span> Voltar para o Baralho
          </a>
        </p>
        <h1>Estudar Baralho</h1>
        <p
          className="erro"
          role="alert"
          aria-label="Falha ao carregar o Baralho"
        >
          {falhaDeCarregamento}
        </p>
      </div>
    );
  }

  if (baralho === null) {
    return null;
  }

  const linkDeVoltar = (
    <p className="voltar">
      <a href={`#/baralhos/${id}`}>
        <span aria-hidden="true">←</span> Voltar para o Baralho
      </a>
    </p>
  );

  if (!baralho.elegivel) {
    return (
      <div className="pilha">
        {linkDeVoltar}
        <header className="cabecalho-da-pagina">
          <div>
            <p className="sobretitulo">Sessão de estudo</p>
            <h1>Estudar {baralho.nome}</h1>
          </div>
        </header>
        <section className="estado-vazio">
          <p>{MENSAGEM_DE_BARALHO_INELEGIVEL}</p>
        </section>
      </div>
    );
  }

  if (sessao === null || estado === null) {
    return (
      <div className="pilha">
        {linkDeVoltar}
        <header className="cabecalho-da-pagina">
          <div>
            <p className="sobretitulo">Sessão de estudo</p>
            <h1>Estudar {baralho.nome}</h1>
          </div>
        </header>

        <form className="cartao pilha" onSubmit={iniciarSessao} noValidate>
          <div className="campo">
            <label className="rotulo" htmlFor="campo-quantidade">
              Quantidade de Cartões
            </label>
            <input
              id="campo-quantidade"
              ref={quantidadeRef}
              type="number"
              inputMode="numeric"
              value={quantidade}
              onChange={(evento) => setQuantidade(evento.target.value)}
              aria-describedby="quantidade-disponivel"
            />
            <p id="quantidade-disponivel" className="ajuda">
              Este Baralho tem {baralho.cartoes.length}{" "}
              {baralho.cartoes.length === 1
                ? "Cartão vinculado."
                : "Cartões vinculados."}
            </p>
          </div>

          {falhaDeInicio !== null && (
            <p
              className="erro"
              role="alert"
              aria-label="Falha ao iniciar a Sessão"
            >
              {falhaDeInicio}
            </p>
          )}

          <div className="acoes">
            <button className="botao botao--primario" type="submit">
              Iniciar Sessão
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (estado.concluida) {
    return (
      <div className="pilha">
        <header className="cabecalho-da-pagina">
          <div>
            <p className="sobretitulo">Sessão concluída</p>
            <h1 ref={resumoRef} tabIndex={-1}>
              Resumo da Sessão
            </h1>
          </div>
        </header>

        {anuncio !== null && (
          <p
            key={sequenciaDeAnuncio}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label="Mudança de estado da Sessão"
          >
            {anuncio}
          </p>
        )}

        <ResumoDaSessao itens={itensDoResumo(estado)}>
          {situacaoDoRegistro.estado === "registrando" && (
            <p
              role="status"
              aria-live="polite"
              aria-label="Situação do registro da Sessão"
              className="texto-secundario"
            >
              Registrando a Sessão…
            </p>
          )}

          {situacaoDoRegistro.estado === "registrada" && (
            <p
              role="status"
              aria-live="polite"
              aria-label="Situação do registro da Sessão"
              className="aviso aviso--sucesso"
            >
              Sessão registrada no seu histórico.{" "}
              <a href="#/inicio">Ver em Início</a>
            </p>
          )}

          {situacaoDoRegistro.estado === "falhou" && (
            <div
              className="aviso aviso--erro"
              role="alert"
              aria-label="Falha ao registrar a Sessão"
            >
              <p>{situacaoDoRegistro.mensagem}</p>
              <button
                className="botao botao--secundario"
                type="button"
                onClick={registrarNovamente}
              >
                Tentar registrar novamente
              </button>
            </div>
          )}

          <div className="acoes">
            <a
              className="botao botao--primario"
              href={`#/baralhos/${id}`}
              onClick={(evento) => {
                // Sair do Resumo é uma ação da própria página: sem proteção
                // ativa, navega normalmente; com o Registro pendente ou
                // falhado, passa pela confirmação (FR-164).
                evento.preventDefault();
                protegerAcao(() => irParaRota(`#/baralhos/${id}`));
              }}
            >
              Voltar para o Baralho
            </a>
            <button
              className="botao botao--secundario"
              type="button"
              onClick={estudarNovamente}
            >
              Estudar novamente
            </button>
          </div>
        </ResumoDaSessao>
      </div>
    );
  }

  return (
    <div className="pilha">
      <div className="acoes">
        <button
          className="botao botao--secundario"
          type="button"
          onClick={() => protegerAcao(interromper)}
        >
          Interromper
        </button>
      </div>

      <header className="cabecalho-da-pagina">
        <div>
          <p className="sobretitulo">
            Item {estado.posicao} de {estado.total}
          </p>
          <h1>Estudar {baralho.nome}</h1>
        </div>
      </header>

      {estado.avisoDeLimite !== null && (
        <p className="aviso">{estado.avisoDeLimite}</p>
      )}

      <div>
        <p className="texto-secundario">
          {descricaoDeAndamento(estado.posicao, estado.total)}
        </p>
        <div className="progresso">
          <progress
            className="progresso__barra"
            value={estado.posicao - 1}
            max={estado.total}
            aria-label="Progresso da Sessão"
          />
        </div>
      </div>

      {anuncio !== null && (
        <p
          key={sequenciaDeAnuncio}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label="Mudança de estado da Sessão"
        >
          {anuncio}
        </p>
      )}

      <article
        className="cartao-de-estudo"
        aria-label={`Item ${estado.posicao} de ${estado.total}`}
      >
        <h2 ref={frenteRef} tabIndex={-1} className="lado-do-cartao">
          Frente
        </h2>
        <p className="conteudo-do-cartao">{estado.itemAtual.frente}</p>

        {!estado.itemAtual.revelado ? (
          <>
            <p className="texto-secundario">
              O Verso está oculto. Tente lembrar antes de revelar.
            </p>
            <div className="acoes">
              <button
                className="botao botao--primario"
                type="button"
                onClick={revelar}
              >
                Revelar verso
              </button>
            </div>
          </>
        ) : (
          <>
            <hr />
            <h2 ref={versoRef} tabIndex={-1} className="lado-do-cartao">
              Verso
            </h2>
            <p className="conteudo-do-cartao">{estado.itemAtual.verso}</p>
            <div className="botoes-de-resultado">
              <button
                className="botao botao--sucesso"
                type="button"
                onClick={() => registrarResultado("acertou")}
              >
                <span aria-hidden="true">✓</span> Acertei
              </button>
              <button
                className="botao botao--erro"
                type="button"
                onClick={() => registrarResultado("errou")}
              >
                <span aria-hidden="true">✕</span> Errei
              </button>
            </div>
          </>
        )}
      </article>
    </div>
  );
}

function descricaoDeAndamento(posicao: number, total: number): string {
  const respondidos = posicao - 1;
  const faltam = total - respondidos;

  return (
    `${respondidos} ${respondidos === 1 ? "Item respondido" : "Itens respondidos"}; ` +
    `${faltam} ${faltam === 1 ? "Item faltando" : "Itens faltando"}.`
  );
}

/**
 * Os Itens do Resumo, na ordem em que foram apresentados (FR-176).
 *
 * Ao concluir, todo Item já foi revelado e respondido — é o que a Sessão exige
 * para chegar ao fim —, então o estreitamento pelo discriminante `revelado`
 * garante Verso e Resultado não nulos, sem asserções sobre valores que possam
 * ser nulos. A ordem é a do próprio estado da Sessão, que é a ordem exibida.
 */
function itensDoResumo(estado: EstadoDaSessaoConcluida): ItemDoResumo[] {
  const itens: ItemDoResumo[] = [];

  for (const item of estado.itens) {
    if (item.revelado && item.resultado !== null) {
      itens.push({
        frente: item.frente,
        verso: item.verso,
        resultado: item.resultado,
      });
    }
  }

  return itens;
}
