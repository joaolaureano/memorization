import { useEffect, useRef, useState } from "react";

import type {
  BaralhoComCartoes,
  CartaoListado,
  ClienteDoAcervo,
} from "../acervo-cliente/cliente";

/**
 * Tela de Vínculos de um Baralho (T209; specs/003-vincular-cartao-baralho/tasks.md).
 *
 * A tela é a página de detalhe do Baralho, na rota `#/baralhos/<id>`. Consome
 * somente a Interface `ClienteDoAcervo`: `obterBaralho(id)` devolve o Baralho
 * com os Cartões já vinculados e a elegibilidade derivada; `listarCartoes()`
 * devolve todos os Cartões, para que a tela apresente também os que ainda
 * podem ser vinculados. A tela **não reproduz nenhuma regra de domínio** —
 * quem decide se um par pode ser vinculado, se um Vínculo existe ou se o
 * Baralho existe é o cliente, e a tela apenas exibe as mensagens em português
 * que ele devolve (FR-046).
 *
 * T212 (FR-044, FR-045, SC-012): vincular e desvincular nunca alteram a lista
 * por otimismo. A operação é submetida e, **somente após o sucesso**, a tela
 * relê `obterBaralho` e `listarCartoes` e passa a exibir o que o servidor
 * confirmou. Se a releitura falhar, as listas permanecem exatamente como
 * estavam — o estado confirmado anteriormente.
 */

interface PropriedadesDaPaginaDoBaralho {
  cliente: ClienteDoAcervo;
  id: string;
}

/**
 * Ação de foco a executar depois que uma releitura bem-sucedida re-renderiza
 * as duas listas. `tipo` é o botão equivalente **na outra lista** — após
 * vincular, o Cartão passa a ter botão "Desvincular"; após desvincular, passa
 * a ter botão "Vincular".
 */
interface FocoAposAtualizacao {
  tipo: "vincular" | "desvincular";
  cartaoId: string;
}

export function PaginaDoBaralho({
  cliente,
  id,
}: PropriedadesDaPaginaDoBaralho) {
  const [baralho, setBaralho] = useState<BaralhoComCartoes | null>(null);
  const [cartoes, setCartoes] = useState<CartaoListado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falhaDeListagem, setFalhaDeListagem] = useState<string | null>(null);
  const [baralhoNaoEncontrado, setBaralhoNaoEncontrado] = useState<
    string | null
  >(null);
  const [falhaDeAcao, setFalhaDeAcao] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [sequenciaDeAnuncio, setSequenciaDeAnuncio] = useState(0);
  const [focoAposAtualizacao, setFocoAposAtualizacao] =
    useState<FocoAposAtualizacao | null>(null);

  const botoes = useRef(new Map<string, HTMLButtonElement>());
  const tituloDosVinculados = useRef<HTMLHeadingElement>(null);
  const tituloDosNaoVinculados = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let ativo = true;

    setCarregando(true);
    setFalhaDeListagem(null);
    setBaralhoNaoEncontrado(null);
    setBaralho(null);
    setCartoes([]);

    void Promise.all([cliente.obterBaralho(id), cliente.listarCartoes()]).then(
      ([resultadoDoBaralho, resultadoDosCartoes]) => {
        if (!ativo) {
          return;
        }

        if (!resultadoDoBaralho.ok) {
          if (resultadoDoBaralho.erro === "nao_encontrado") {
            setBaralhoNaoEncontrado(resultadoDoBaralho.mensagem);
          } else {
            setFalhaDeListagem(resultadoDoBaralho.mensagem);
          }
        } else if (!resultadoDosCartoes.ok) {
          setFalhaDeListagem(resultadoDosCartoes.mensagem);
        } else {
          setBaralho(resultadoDoBaralho.baralho);
          setCartoes(resultadoDosCartoes.cartoes);
        }

        setCarregando(false);
      },
    );

    return () => {
      ativo = false;
    };
  }, [cliente, id]);

  useEffect(() => {
    if (focoAposAtualizacao === null) {
      return;
    }

    const chave = `${focoAposAtualizacao.tipo}:${focoAposAtualizacao.cartaoId}`;
    const botao = botoes.current.get(chave);

    if (botao !== undefined) {
      botao.focus();
    } else {
      const titulo =
        focoAposAtualizacao.tipo === "desvincular"
          ? tituloDosVinculados
          : tituloDosNaoVinculados;

      titulo.current?.focus();
    }

    setFocoAposAtualizacao(null);
  }, [focoAposAtualizacao, baralho, cartoes]);

  async function vincular(cartao: { id: string }): Promise<void> {
    setFalhaDeAcao(null);
    setAnuncio(null);

    const resultado = await cliente.vincular(cartao.id, id);

    if (!resultado.ok) {
      setFalhaDeAcao(resultado.mensagem);
      return;
    }

    await relerAposOperacao(cartao, "desvincular");
  }

  async function desvincular(cartao: { id: string }): Promise<void> {
    setFalhaDeAcao(null);
    setAnuncio(null);

    const resultado = await cliente.desvincular(cartao.id, id);

    if (!resultado.ok) {
      setFalhaDeAcao(resultado.mensagem);
      return;
    }

    await relerAposOperacao(cartao, "vincular");
  }

  /**
   * Relê o Baralho e os Cartões após uma operação bem-sucedida (FR-044).
   *
   * O Vínculo só aparece ou desaparece depois que o servidor o confirmou na
   * releitura. Se qualquer releitura falhar, as listas não são tocadas: a
   * tela continua retratando o último estado confirmado, e a falha é exibida
   * para nova tentativa.
   */
  async function relerAposOperacao(
    cartao: { id: string },
    tipoDeFoco: FocoAposAtualizacao["tipo"],
  ): Promise<void> {
    const eraElegivel = baralho?.elegivel ?? false;
    const [resultadoDoBaralho, resultadoDosCartoes] = await Promise.all([
      cliente.obterBaralho(id),
      cliente.listarCartoes(),
    ]);

    if (!resultadoDoBaralho.ok) {
      setFalhaDeAcao(resultadoDoBaralho.mensagem);
      return;
    }

    if (!resultadoDosCartoes.ok) {
      setFalhaDeAcao(resultadoDosCartoes.mensagem);
      return;
    }

    const mensagens =
      tipoDeFoco === "desvincular"
        ? ["Cartão vinculado ao Baralho."]
        : ["Cartão desvinculado do Baralho."];

    if (!eraElegivel && resultadoDoBaralho.baralho.elegivel) {
      mensagens.push("O Baralho tornou-se elegível para estudo.");
    } else if (eraElegivel && !resultadoDoBaralho.baralho.elegivel) {
      mensagens.push("O Baralho deixou de ser elegível para estudo.");
    }

    setBaralho(resultadoDoBaralho.baralho);
    setCartoes(resultadoDosCartoes.cartoes);
    setAnuncio(mensagens.join(" "));
    setSequenciaDeAnuncio((atual) => atual + 1);
    setFocoAposAtualizacao({ tipo: tipoDeFoco, cartaoId: cartao.id });
  }

  function registrarBotao(chave: string) {
    return (elemento: HTMLButtonElement | null): void => {
      if (elemento === null) {
        botoes.current.delete(chave);
      } else {
        botoes.current.set(chave, elemento);
      }
    };
  }

  const idsVinculados = new Set((baralho?.cartoes ?? []).map((cartao) => cartao.id));
  const cartoesNaoVinculados = cartoes.filter(
    (cartao) => !idsVinculados.has(cartao.id),
  );

  return (
    <div className="pagina">
      <p className="voltar">
        <a href="#/baralhos">Voltar para Baralhos</a>
      </p>

      <h1>
        {baralhoNaoEncontrado !== null
          ? "Baralho não encontrado"
          : (baralho?.nome ?? "Baralho")}
      </h1>

      {carregando ? (
        <p className="carregando">Carregando Baralho…</p>
      ) : baralhoNaoEncontrado !== null ? (
        <p
          className="erro"
          role="alert"
          aria-label="Baralho não encontrado"
        >
          {baralhoNaoEncontrado}
        </p>
      ) : falhaDeListagem !== null ? (
        <p
          className="erro"
          role="alert"
          aria-label="Falha ao carregar o Baralho"
        >
          {falhaDeListagem}
        </p>
      ) : baralho !== null ? (
        <>
          <p className="elegibilidade-do-baralho">
            {baralho.elegivel
              ? "Elegível para estudo."
              : "Não elegível para estudo: nenhum Cartão vinculado."}
          </p>

          {falhaDeAcao !== null && (
            <p
              className="erro"
              role="alert"
              aria-label="Falha na operação de Vínculo"
            >
              {falhaDeAcao}
            </p>
          )}

          {anuncio !== null && (
            <p
              key={sequenciaDeAnuncio}
              className="anuncio-de-vinculo"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label="Mudança de Vínculo"
            >
              {anuncio}
            </p>
          )}

          {cartoes.length === 0 ? (
            // FR-062: o caso "não há Cartão" é distinto dos demais. Sem
            // Cartão algum, as duas listas seriam vazias por motivos
            // diferentes; uma única mensagem explica a ação que destrava a
            // tela.
            <p
              className="estado-vazio"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label="Estado vazio da tela de Vínculos"
            >
              Ainda não há Cartões. Crie um Cartão antes de vincular.
            </p>
          ) : (
            <>
              <section>
                <h2 ref={tituloDosVinculados} tabIndex={-1}>
                  Cartões do Baralho
                </h2>

                {baralho.cartoes.length === 0 ? (
                  <p className="estado-vazio">
                    Este Baralho ainda não tem Cartões vinculados.
                  </p>
                ) : (
                  <ul className="lista-de-cartoes">
                    {baralho.cartoes.map((cartao) => (
                      <li key={cartao.id} className="cartao">
                        <p className="frente-do-cartao">
                          <span className="rotulo">Frente</span> {cartao.frente}
                        </p>
                        <p className="verso-do-cartao">
                          <span className="rotulo">Verso</span> {cartao.verso}
                        </p>
                        <button
                          ref={registrarBotao(`desvincular:${cartao.id}`)}
                          className="botao-de-vinculo"
                          type="button"
                          aria-label={`Desvincular ${cartao.frente}`}
                          onClick={() => void desvincular(cartao)}
                        >
                          Desvincular
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h2 ref={tituloDosNaoVinculados} tabIndex={-1}>
                  Cartões não vinculados
                </h2>

                {cartoesNaoVinculados.length === 0 ? (
                  <p className="estado-vazio">
                    Todos os Cartões já estão vinculados a este Baralho.
                  </p>
                ) : (
                  <ul className="lista-de-cartoes">
                    {cartoesNaoVinculados.map((cartao) => (
                      <li key={cartao.id} className="cartao">
                        <p className="frente-do-cartao">
                          <span className="rotulo">Frente</span> {cartao.frente}
                        </p>
                        <p className="verso-do-cartao">
                          <span className="rotulo">Verso</span> {cartao.verso}
                        </p>
                        <button
                          ref={registrarBotao(`vincular:${cartao.id}`)}
                          className="botao-de-vinculo"
                          type="button"
                          aria-label={`Vincular ${cartao.frente}`}
                          onClick={() => void vincular(cartao)}
                        >
                          Vincular
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          <p className="estudar-baralho">
            <a href={`#/baralhos/${id}/estudo`}>Estudar este Baralho</a>
          </p>
        </>
      ) : null}
    </div>
  );
}
