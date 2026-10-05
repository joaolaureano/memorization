import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BaralhoListado,
  Cartao,
  CartaoListado,
  ClienteDoAcervo,
} from "../acervo-cliente/cliente";
import {
  adicionarCartoes,
  indisponiveis,
  limparSelecao,
  removerCartao,
  retirarIndisponiveis,
  situacaoDaSelecao,
  type SelecaoTemporaria,
} from "../sessao-de-estudo/selecao-temporaria";
import { FontesDaSelecao } from "./FontesDaSelecao";
import { irParaRota } from "./navegacao";
import { useNavegarSemProtecao, useProtecaoDeSaida } from "./protecao-de-saida";

type Carga = "carregando" | "falha" | "pronta";
type Situacao = ReturnType<typeof situacaoDaSelecao>;

/** Proteção de saída exibida quando há cartões na seleção (FR-375). */
const DESCARTE = {
  tipo: "descarte",
  titulo: "Descartar este percurso?",
  descricao: "A seleção e os campos não salvos serão descartados.",
  rotuloDeConfirmacao: "Descartar",
} as const;

/**
 * Montagem do baralho temporário em `#/baralhos/temporario` (FR-363, FR-364,
 * FR-365, FR-367, FR-375).
 */
export function PaginaDaSelecaoTemporaria({
  cliente,
  aoEstudar,
}: {
  cliente: ClienteDoAcervo;
  aoEstudar: (cartoes: readonly Cartao[]) => void;
}) {
  const [carga, setCarga] = useState<Carga>("carregando");
  const [baralhos, setBaralhos] = useState<BaralhoListado[]>([]);
  const [cartoes, setCartoes] = useState<CartaoListado[]>([]);
  const [selecao, setSelecao] = useState<SelecaoTemporaria>(() =>
    limparSelecao(),
  );
  const [frentes, setFrentes] = useState<Record<string, string>>({});
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [sequenciaDoAnuncio, setSequenciaDoAnuncio] = useState(0);
  const [indisponiveisAoEstudar, setIndisponiveisAoEstudar] = useState<
    string[]
  >([]);
  const [falhaAoEstudar, setFalhaAoEstudar] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  const refDoTitulo = useRef<HTMLHeadingElement>(null);
  const refDaSelecao = useRef<HTMLHeadingElement>(null);
  const navegarSemProtecao = useNavegarSemProtecao();

  useProtecaoDeSaida(selecao.length > 0 ? DESCARTE : null);

  useEffect(() => {
    refDoTitulo.current?.focus();
  }, []);

  const carregar = useCallback(async () => {
    setCarga("carregando");
    const [resultadoDeBaralhos, resultadoDeCartoes] = await Promise.all([
      cliente.listarBaralhos(),
      cliente.listarCartoes(),
    ]);
    if (!resultadoDeBaralhos.ok || !resultadoDeCartoes.ok) {
      setCarga("falha");
      return;
    }
    setBaralhos(resultadoDeBaralhos.baralhos);
    setCartoes(resultadoDeCartoes.cartoes);
    setFrentes((atual) => mesclarFrentes(atual, resultadoDeCartoes.cartoes));
    setCarga("pronta");
  }, [cliente]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const aoAdicionar = useCallback(
    (ids: readonly string[]) => {
      const nova = adicionarCartoes(selecao, ids);
      setSelecao(nova);
      setIndisponiveisAoEstudar([]);
      setAnuncio(
        `${contagemDeCartoes(nova.length)} na seleção. ` +
          "Cartões repetidos entram uma só vez.",
      );
      setSequenciaDoAnuncio((sequencia) => sequencia + 1);
    },
    [selecao],
  );

  const aoRemover = useCallback((id: string) => {
    setSelecao((atual) => removerCartao(atual, id));
    setIndisponiveisAoEstudar([]);
    refDaSelecao.current?.focus();
  }, []);

  const aoLimpar = useCallback(() => {
    setSelecao(limparSelecao());
    setIndisponiveisAoEstudar([]);
    refDaSelecao.current?.focus();
  }, []);

  const aoRetirarIndisponiveis = useCallback(() => {
    const disponiveis = new Set(cartoes.map((cartao) => cartao.id));
    setSelecao(retirarIndisponiveis(selecao, disponiveis));
    setIndisponiveisAoEstudar([]);
    refDaSelecao.current?.focus();
  }, [cartoes, selecao]);

  const aoTentarEstudar = useCallback(async () => {
    setVerificando(true);
    setFalhaAoEstudar(null);

    const resultado = await cliente.listarCartoes();
    if (!resultado.ok) {
      setFalhaAoEstudar(resultado.mensagem);
      setVerificando(false);
      return;
    }

    setCartoes(resultado.cartoes);
    setFrentes((atual) => mesclarFrentes(atual, resultado.cartoes));

    const disponiveis = new Set(resultado.cartoes.map((cartao) => cartao.id));
    const faltam = indisponiveis(selecao, disponiveis);
    if (faltam.length > 0) {
      setIndisponiveisAoEstudar(faltam);
      setVerificando(false);
      return;
    }

    const porId = new Map(
      resultado.cartoes.map((cartao) => [cartao.id, cartao] as const),
    );
    const capturados: Cartao[] = [];
    for (const id of selecao) {
      const cartao = porId.get(id);
      if (cartao === undefined) {
        continue;
      }
      capturados.push({
        id: cartao.id,
        frente: cartao.frente,
        verso: cartao.verso,
      });
    }

    aoEstudar(capturados);
    navegarSemProtecao("#/baralhos/temporario/estudo");
  }, [aoEstudar, cliente, navegarSemProtecao, selecao]);

  const aoCancelar = useCallback(() => {
    irParaRota("#/baralhos");
  }, []);

  const situacao = situacaoDaSelecao(selecao);

  return (
    <div className="pagina">
      <header className="cabecalho-da-pagina">
        <div>
          <h1 tabIndex={-1} ref={refDoTitulo}>
            Criar baralho temporário
          </h1>
          <p className="texto-secundario">
            Escolha o conteúdo para esta Sessão. Você poderá salvar o baralho ao
            terminar.
          </p>
        </div>
      </header>

      {anuncio !== null && (
        <p
          key={sequenciaDoAnuncio}
          className="visualmente-oculto"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {anuncio}
        </p>
      )}

      <div className="montagem">
        <FontesDaSelecao
          carga={carga}
          baralhos={baralhos}
          cartoes={cartoes}
          selecao={selecao}
          aoAdicionar={aoAdicionar}
          aoTentarNovamente={() => void carregar()}
        />

        <section className="selecao" aria-labelledby="titulo-da-selecao">
          <div className="titulo-contagem">
            <h2 id="titulo-da-selecao" tabIndex={-1} ref={refDaSelecao}>
              Seleção do estudo
            </h2>
            <span>{contagemDeCartoes(selecao.length)}</span>
          </div>

          {selecao.length === 0 ? (
            <div className="estado-vazio">
              <h3>Seu estudo começa aqui</h3>
              <p>
                Adicione baralhos ou cartões individuais. Cartões repetidos
                entram uma só vez.
              </p>
            </div>
          ) : (
            <>
              <ul className="lista-da-selecao">
                {selecao.map((id) => {
                  const frente = frentes[id] ?? "";
                  return (
                    <li key={id}>
                      <p>{frente}</p>
                      <button
                        type="button"
                        className="botao botao--secundario"
                        aria-label={`Remover ${frente}`}
                        onClick={() => aoRemover(id)}
                      >
                        Remover
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="botao botao--secundario"
                onClick={aoLimpar}
              >
                Limpar seleção
              </button>
            </>
          )}

          {indisponiveisAoEstudar.length > 0 && (
            <div role="alert" className="aviso aviso--erro">
              <p>{textoDeIndisponiveis(indisponiveisAoEstudar.length)}</p>
              <button
                type="button"
                className="botao botao--secundario"
                onClick={aoRetirarIndisponiveis}
              >
                Retirar indisponíveis
              </button>
            </div>
          )}

          {falhaAoEstudar !== null && (
            <p role="alert" className="erro">
              {falhaAoEstudar}
            </p>
          )}

          <p className="nota-selecao" id="orientacao-da-selecao">
            {orientacao(situacao)}
          </p>

          <div className="acoes-selecao">
            <button
              type="button"
              className="botao botao--primario"
              disabled={
                situacao !== "ok" || carga !== "pronta" || verificando
              }
              aria-describedby="orientacao-da-selecao"
              onClick={() => void aoTentarEstudar()}
            >
              Estudar
            </button>
            <button
              type="button"
              className="botao botao--secundario"
              onClick={aoCancelar}
            >
              Cancelar
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Mescla as frentes novas sem apagar as já conhecidas. */
function mesclarFrentes(
  atual: Record<string, string>,
  cartoes: readonly { id: string; frente: string }[],
): Record<string, string> {
  const proximo = { ...atual };
  for (const cartao of cartoes) {
    proximo[cartao.id] = cartao.frente;
  }
  return proximo;
}

/** "1 Cartão" ou "N Cartões". */
function contagemDeCartoes(n: number): string {
  return n === 1 ? "1 Cartão" : `${n} Cartões`;
}

/** Aviso de cartões que saíram do acervo. */
function textoDeIndisponiveis(n: number): string {
  return n === 1
    ? "1 Cartão não está mais disponível."
    : `${n} Cartões não estão mais disponíveis.`;
}

/** Orientação da seleção exibida junto ao botão Estudar. */
function orientacao(situacao: Situacao): string {
  switch (situacao) {
    case "vazia":
      return "Adicione pelo menos um cartão para estudar.";
    case "acima-do-limite":
      return "Reduza a seleção para no máximo 1.000 cartões.";
    default:
      return "Todos os cartões selecionados serão estudados em ordem aleatória.";
  }
}
