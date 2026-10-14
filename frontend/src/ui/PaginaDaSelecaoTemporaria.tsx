import { TextoDoProduto } from "../idioma";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BaralhoListado,
  Cartao,
  CartaoListado,
  ClienteDoAcervo,
} from "../acervo-cliente/cliente";
import { useIdioma } from "../idioma";
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

/**
 * Montagem do baralho temporário em `#/baralhos/temporario` (FR-363, FR-364,
 * FR-365, FR-367, FR-375).
 */
export function PaginaDaSelecaoTemporaria({
  cliente,
  aoEstudar,
}: {
  cliente: ClienteDoAcervo;
  aoEstudar: (cartoes: readonly Cartao[], nomeDoBaralho: string) => void;
}) {
  const { textos } = useIdioma();

  /** Proteção de saída exibida quando há cartões na seleção (FR-375). */
  const DESCARTE = {
    tipo: "descarte",
    titulo: textos.selecao.descartarSelecionado,
    descricao: textos.selecao.selecaoDescartada,
    rotuloDeConfirmacao: textos.selecao.descartar,
  } as const;
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
  const [nomeDoBaralho, setNomeDoBaralho] = useState("");

  const refDoTitulo = useRef<HTMLHeadingElement>(null);
  const refDaSelecao = useRef<HTMLHeadingElement>(null);
  const navegarSemProtecao = useNavegarSemProtecao();

  useProtecaoDeSaida(
    selecao.length > 0 || nomeDoBaralho.trim().length > 0 ? DESCARTE : null,
  );

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
        textos.selecao.naSelecao(contagemDeCartoes(nova.length, textos)) +
          textos.selecao.cartoesRepetidosUmaVez,
      );
      setSequenciaDoAnuncio((sequencia) => sequencia + 1);
    },
    [selecao, textos],
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

    aoEstudar(capturados, nomeDoBaralho);
    navegarSemProtecao("#/baralhos/temporario/estudo");
  }, [aoEstudar, cliente, navegarSemProtecao, selecao, nomeDoBaralho]);

  const aoCancelar = useCallback(() => {
    irParaRota("#/baralhos");
  }, []);

  const situacao = situacaoDaSelecao(selecao);

  return (
    <div className="pagina">
      <header className="cabecalho-da-pagina">
        <div>
          <h1 tabIndex={-1} ref={refDoTitulo}>
            {textos.selecao.criarTemporario}
          </h1>
          <p className="texto-secundario">
            {textos.selecao.escolhaOConteudo}
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
              {textos.selecao.selecaoDoEstudo}
            </h2>
            <span>{contagemDeCartoes(selecao.length, textos)}</span>
          </div>

          <div className="campo-de-texto">
            <label htmlFor="nome-do-baralho-temporario">
              Nome do baralho temporário (opcional)
            </label>
            <input
              id="nome-do-baralho-temporario"
              type="text"
              maxLength={100}
              value={nomeDoBaralho}
              onChange={(e) => setNomeDoBaralho(e.currentTarget.value)}
              placeholder={textos.sessao.baralhoTemporario}
            />
            <p className="contador-caracteres">
              {nomeDoBaralho.length}/100
            </p>
          </div>

          {selecao.length === 0 ? (
            <div className="estado-vazio">
              <h3>{textos.selecao.seuEstudoComeca}</h3>
              <p>
                {textos.selecao.adicioneConteudo}
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
                {textos.selecao.limparSelecao}
              </button>
            </>
          )}

          {indisponiveisAoEstudar.length > 0 && (
            <div role="alert" className="aviso aviso--erro">
              <p>{textoDeIndisponiveis(indisponiveisAoEstudar.length, textos)}</p>
              <button
                type="button"
                className="botao botao--secundario"
                onClick={aoRetirarIndisponiveis}
              >
                {textos.selecao.retirarIndisponiveis}
              </button>
            </div>
          )}

          {falhaAoEstudar !== null && (
            <p role="alert" className="erro">
              <TextoDoProduto texto={falhaAoEstudar} />
            </p>
          )}

          <p className="nota-selecao" id="orientacao-da-selecao">
            {orientacao(situacao, textos)}
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
              Revisar
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
function contagemDeCartoes(n: number, textos: ReturnType<typeof useIdioma>["textos"]): string {
  return textos.selecao.cartao(n);
}

/** Aviso de cartões que saíram do acervo. */
function textoDeIndisponiveis(n: number, textos: ReturnType<typeof useIdioma>["textos"]): string {
  return textos.selecao.cartaoIndisponivel(n);
}

/** Orientação da seleção exibida junto ao botão Revisar. */
function orientacao(situacao: Situacao, textos: ReturnType<typeof useIdioma>["textos"]): string {
  switch (situacao) {
    case "vazia":
      return textos.selecao.adicioneUmCartao;
    case "acima-do-limite":
      return textos.selecao.reduza;
    default:
      return textos.selecao.todosEmOrdenAleatoria;
  }
}
