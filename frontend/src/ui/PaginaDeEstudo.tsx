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
  ResultadoDoItem,
} from "../sessao-de-estudo/sessao-de-estudo";

/**
 * Tela da Sessão de estudo (T304–T307;
 * specs/004-sessao-de-estudo/tasks.md, FR-025, FR-027 a FR-029, FR-032 a
 * FR-037, FR-041, FR-042, FR-046 a FR-049).
 *
 * Consome somente a Interface `ClienteDoAcervo` para carregar o Baralho e a
 * Interface `SessaoDeEstudo` para iniciar, revelar, registrar Resultado e
 * derivar o Resumo. A Sessão vive apenas no estado deste componente: nenhuma
 * operação de rede acontece depois do carregamento do Baralho, e sair da tela
 * descarta a instância (FR-038, FR-039).
 *
 * A ordem dos Itens usa `AleatoriedadeReal` em produção; testes injetam o
 * Adapter determinístico pela propriedade opcional `aleatoriedade`.
 */

interface PropriedadesDaPaginaDeEstudo {
  cliente: ClienteDoAcervo;
  id: string;
  aleatoriedade?: Aleatoriedade;
}

type AlvoDeFoco = "frente" | "verso" | "resumo";

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

  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [sequenciaDeAnuncio, setSequenciaDeAnuncio] = useState(0);

  const alvoDeFoco = useRef<AlvoDeFoco | null>(null);
  const frenteRef = useRef<HTMLHeadingElement>(null);
  const versoRef = useRef<HTMLHeadingElement>(null);
  const resumoRef = useRef<HTMLHeadingElement>(null);
  const quantidadeRef = useRef<HTMLInputElement>(null);

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
    } else {
      resumoRef.current?.focus();
    }
  }, [estado]);

  function anunciar(mensagem: string): void {
    setAnuncio(mensagem);
    setSequenciaDeAnuncio((atual) => atual + 1);
  }

  function iniciarSessao(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();

    if (baralho === null) {
      return;
    }

    setFalhaDeInicio(null);

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
    anunciar(
      estadoInicial.avisoDeLimite !== null
        ? estadoInicial.avisoDeLimite
        : `Sessão iniciada com ${estadoInicial.total} ${
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

    setEstado(sessao.estadoAtual());

    if ("resumo" in resposta) {
      alvoDeFoco.current = "resumo";
      anunciar("Sessão concluída.");
      return;
    }

    alvoDeFoco.current = "frente";
    anunciar(`Resultado registrado: ${resultado}.`);
  }

  if (carregando) {
    return (
      <div className="pagina">
        <p className="voltar">
          <a href={`#/baralhos/${id}`}>Voltar para o Baralho</a>
        </p>
        <h1>Estudar Baralho</h1>
        <p className="carregando">Carregando Baralho…</p>
      </div>
    );
  }

  if (baralhoNaoEncontrado !== null) {
    return (
      <div className="pagina">
        <p className="voltar">
          <a href={`#/baralhos/${id}`}>Voltar para o Baralho</a>
        </p>
        <h1>Baralho não encontrado</h1>
        <p
          className="erro"
          role="alert"
          aria-label="Baralho não encontrado"
        >
          {baralhoNaoEncontrado}
        </p>
      </div>
    );
  }

  if (falhaDeCarregamento !== null) {
    return (
      <div className="pagina">
        <p className="voltar">
          <a href={`#/baralhos/${id}`}>Voltar para o Baralho</a>
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

  const emAndamento = sessao !== null && estado !== null && !estado.concluida;

  return (
    <div className="pagina">
      <p className="voltar">
        <a href={`#/baralhos/${id}`}>
          {emAndamento ? "Interromper" : "Voltar para o Baralho"}
        </a>
      </p>

      <h1>Estudar {baralho.nome}</h1>

      {!baralho.elegivel ? (
        <p className="elegibilidade-do-baralho">
          {MENSAGEM_DE_BARALHO_INELEGIVEL}
        </p>
      ) : sessao === null || estado === null ? (
        <section aria-label="Início da Sessão de estudo">
          <form
            className="formulario-de-estudo"
            onSubmit={iniciarSessao}
            noValidate
          >
            <div className="campo">
              <label htmlFor="campo-quantidade">Quantidade de Cartões</label>
              <input
                id="campo-quantidade"
                ref={quantidadeRef}
                type="number"
                inputMode="numeric"
                value={quantidade}
                onChange={(evento) => setQuantidade(evento.target.value)}
                aria-describedby="quantidade-disponivel"
              />
              <p id="quantidade-disponivel" className="contador">
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

            <button className="botao-de-sessao" type="submit">
              Iniciar Sessão
            </button>
          </form>
        </section>
      ) : estado.concluida ? (
        <section className="resumo-da-sessao" aria-label="Resumo da Sessão">
          {anuncio !== null && (
            <p
              key={sequenciaDeAnuncio}
              className="anuncio-de-sessao"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label="Mudança de estado da Sessão"
            >
              {anuncio}
            </p>
          )}

          <h2 ref={resumoRef} tabIndex={-1}>
            Resumo da Sessão
          </h2>
          <p>Itens estudados: {estado.resumo.estudados}</p>
          <p>Acertos: {estado.resumo.acertos}</p>
          <p>Erros: {estado.resumo.erros}</p>
        </section>
      ) : (
        <section className="sessao-de-estudo" aria-label="Sessão de estudo">
          {anuncio !== null && (
            <p
              key={sequenciaDeAnuncio}
              className="anuncio-de-sessao"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label="Mudança de estado da Sessão"
            >
              {anuncio}
            </p>
          )}

          <p className="progresso-da-sessao">
            Item {estado.posicao} de {estado.total}
          </p>

          <section
            className="item-de-estudo"
            aria-label={`Item ${estado.posicao} de ${estado.total}`}
          >
            <h2 ref={frenteRef} tabIndex={-1}>
              Frente
            </h2>
            <p className="frente-da-sessao">{estado.itemAtual.frente}</p>

            {!estado.itemAtual.revelado ? (
              <button
                className="botao-de-revelacao"
                type="button"
                onClick={revelar}
              >
                Revelar
              </button>
            ) : (
              <>
                <h2 ref={versoRef} tabIndex={-1}>
                  Verso
                </h2>
                <p className="verso-da-sessao">{estado.itemAtual.verso}</p>
                <div className="botoes-de-resultado">
                  <button
                    className="botao-de-resultado"
                    type="button"
                    onClick={() => registrarResultado("acertou")}
                  >
                    Acertei
                  </button>
                  <button
                    className="botao-de-resultado"
                    type="button"
                    onClick={() => registrarResultado("errou")}
                  >
                    Errei
                  </button>
                </div>
              </>
            )}
          </section>
        </section>
      )}
    </div>
  );
}
