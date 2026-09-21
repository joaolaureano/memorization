import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import type {
  BaralhoComCartoes,
  CartaoListado,
  ClienteDoAcervo,
} from "../acervo-cliente/cliente";
import {
  LIMITE_DE_CARACTERES_DE_BARALHO,
  ehCodigoDeErroDeBaralho,
} from "../acervo-cliente/validacao";
import { DialogoDeConfirmacao } from "./DialogoDeConfirmacao";

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
 *
 * T404 (FR-015, FR-050; specs/005-editar-cartao-e-baralho/tasks.md): a
 * renomeação é feita inline, informa quantos Cartões o Baralho possui e
 * preserva Vínculos e elegibilidade. Sair da renomeação com alterações não
 * salvas exige confirmação explícita.
 *
 * T504, T505, T506 (FR-016, FR-017, FR-068, FR-069, FR-045;
 * specs/006-excluir-cartao-e-baralho/tasks.md): a exclusão do Baralho é
 * precedida de diálogo acessível que declara quantos Cartões continuarão
 * existindo e que nenhum Cartão será destruído. Confirmada, a tela navega
 * para `#/baralhos`; em falha de transporte, a entidade continua exibida.
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

/** Folga a partir da qual a aproximação do limite passa a ser comunicada. */
const FOLGA_PARA_AVISO_DE_LIMITE_DE_BARALHO = 10;

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
  const [anuncioDeRenomeacao, setAnuncioDeRenomeacao] = useState<string | null>(
    null,
  );
  const [sequenciaDeAnuncioDeRenomeacao, setSequenciaDeAnuncioDeRenomeacao] =
    useState(0);
  const [focoAposAtualizacao, setFocoAposAtualizacao] =
    useState<FocoAposAtualizacao | null>(null);

  const [renomeando, setRenomeando] = useState(false);
  const [nomeEmEdicao, setNomeEmEdicao] = useState("");
  const [salvandoRenomeacao, setSalvandoRenomeacao] = useState(false);
  const [falhaDeRenomeacao, setFalhaDeRenomeacao] = useState<string | null>(
    null,
  );
  const [descartePendente, setDescartePendente] = useState(false);
  const [focoAposRenomeacao, setFocoAposRenomeacao] = useState(false);

  const [baralhoParaExcluir, setBaralhoParaExcluir] =
    useState<BaralhoComCartoes | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [falhaDeExclusao, setFalhaDeExclusao] = useState<string | null>(null);
  const [focoAposExclusao, setFocoAposExclusao] = useState(false);

  const botoes = useRef(new Map<string, HTMLButtonElement>());
  const tituloDosVinculados = useRef<HTMLHeadingElement>(null);
  const tituloDosNaoVinculados = useRef<HTMLHeadingElement>(null);
  const campoDeNome = useRef<HTMLInputElement>(null);
  const botaoDeRenomear = useRef<HTMLButtonElement>(null);
  const botaoDeExcluir = useRef<HTMLButtonElement>(null);

  const renomeacaoEstaSuja =
    baralho !== null && renomeando && nomeEmEdicao !== baralho.nome;

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

  useLayoutEffect(() => {
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

  useEffect(() => {
    if (!renomeando) {
      return;
    }

    campoDeNome.current?.focus();
  }, [renomeando]);

  useEffect(() => {
    if (!focoAposRenomeacao) {
      return;
    }

    botaoDeRenomear.current?.focus();
    setFocoAposRenomeacao(false);
  }, [focoAposRenomeacao, baralho]);

  useEffect(() => {
    if (!focoAposExclusao) {
      return;
    }

    botaoDeExcluir.current?.focus();
    setFocoAposExclusao(false);
  }, [focoAposExclusao, baralho]);

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

  function comecarRenomeacao(): void {
    if (baralho === null) {
      return;
    }

    setRenomeando(true);
    setNomeEmEdicao(baralho.nome);
    setFalhaDeRenomeacao(null);
    setFalhaDeExclusao(null);
  }

  function fecharRenomeacao(): void {
    setRenomeando(false);
    setNomeEmEdicao("");
    setFalhaDeRenomeacao(null);
    setFocoAposRenomeacao(true);
  }

  function cancelarRenomeacao(): void {
    if (renomeacaoEstaSuja) {
      setDescartePendente(true);
      return;
    }

    fecharRenomeacao();
  }

  function confirmarDescarte(): void {
    setDescartePendente(false);
    fecharRenomeacao();
  }

  function recusarDescarte(): void {
    setDescartePendente(false);
    campoDeNome.current?.focus();
  }

  async function salvarRenomeacao(
    evento: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    evento.preventDefault();

    if (baralho === null) {
      return;
    }

    setSalvandoRenomeacao(true);
    setFalhaDeRenomeacao(null);

    const resultado = await cliente.renomearBaralho(id, nomeEmEdicao);

    if (resultado.ok) {
      // FR-044: o novo nome só aparece depois de o servidor confirmar a
      // renomeação. Vínculos e elegibilidade não são tocados; a releitura
      // abaixo apenas reconcilia o restante do Baralho com o acervo.
      setBaralho((atual) =>
        atual === null ? atual : { ...atual, nome: resultado.baralho.nome },
      );
      fecharRenomeacao();
      setAnuncioDeRenomeacao("Baralho renomeado.");
      setSequenciaDeAnuncioDeRenomeacao((atual) => atual + 1);

      const releitura = await cliente.obterBaralho(id);

      if (releitura.ok) {
        setBaralho(releitura.baralho);
      }
    } else {
      setFalhaDeRenomeacao(resultado.mensagem);

      if (ehCodigoDeErroDeBaralho(resultado.erro)) {
        campoDeNome.current?.focus();
      }
    }

    setSalvandoRenomeacao(false);
  }

  function abrirExclusao(): void {
    if (baralho === null) {
      return;
    }

    setBaralhoParaExcluir(baralho);
    setFalhaDeExclusao(null);
  }

  function cancelarExclusao(): void {
    setBaralhoParaExcluir(null);
    setFocoAposExclusao(true);
  }

  async function confirmarExclusao(): Promise<void> {
    if (baralhoParaExcluir === null) {
      return;
    }

    setExcluindo(true);
    setFalhaDeExclusao(null);

    const resultado = await cliente.excluirBaralho(baralhoParaExcluir.id);

    if (resultado.ok) {
      // FR-044: só depois de o servidor confirmar a exclusão a tela navega
      // para a lista de Baralhos — onde o Baralho não aparecerá mais.
      setBaralhoParaExcluir(null);
      window.location.hash = "#/baralhos";
    } else {
      setFalhaDeExclusao(resultado.mensagem);
      setBaralhoParaExcluir(null);
      setFocoAposExclusao(true);
    }

    setExcluindo(false);
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
              key={`anuncio-de-vinculo-${sequenciaDeAnuncio}`}
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

          <div className="acoes-do-baralho">
            <button
              ref={botaoDeRenomear}
              type="button"
              disabled={renomeando}
              onClick={comecarRenomeacao}
            >
              Renomear
            </button>
            <button
              ref={botaoDeExcluir}
              type="button"
              disabled={renomeando}
              onClick={abrirExclusao}
            >
              Excluir Baralho
            </button>
          </div>

          {renomeando && (
            <form
              className="formulario-de-renomeacao"
              onSubmit={(evento) => void salvarRenomeacao(evento)}
            >
              <p className="alcance-da-edicao">
                {descricaoDeAlcanceDeRenomeacao(baralho.cartoes.length)}
              </p>

              <div className="campo">
                <label htmlFor="campo-nome-do-baralho">Nome</label>
                <input
                  id="campo-nome-do-baralho"
                  ref={campoDeNome}
                  value={nomeEmEdicao}
                  onChange={(evento) => setNomeEmEdicao(evento.target.value)}
                  aria-describedby={
                    avisoDeLimiteDeBaralho(nomeEmEdicao.length) === null
                      ? "contador-do-nome-do-baralho"
                      : "contador-do-nome-do-baralho aviso-do-nome-do-baralho"
                  }
                />
                <p id="contador-do-nome-do-baralho" className="contador">
                  {nomeEmEdicao.length} / {LIMITE_DE_CARACTERES_DE_BARALHO}{" "}
                  caracteres
                </p>
                {avisoDeLimiteDeBaralho(nomeEmEdicao.length) !== null && (
                  <p id="aviso-do-nome-do-baralho" className="aviso-de-limite">
                    {avisoDeLimiteDeBaralho(nomeEmEdicao.length)}
                  </p>
                )}
              </div>

              {falhaDeRenomeacao !== null && (
                <p
                  className="erro"
                  role="alert"
                  aria-label="Falha na renomeação do Baralho"
                >
                  {falhaDeRenomeacao}
                </p>
              )}

              <div className="acoes-de-edicao">
                <button type="submit" disabled={salvandoRenomeacao}>
                  Salvar alterações
                </button>
                <button type="button" onClick={cancelarRenomeacao}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {falhaDeExclusao !== null && (
            <p
              className="erro"
              role="alert"
              aria-label="Falha na exclusão do Baralho"
            >
              {falhaDeExclusao}
            </p>
          )}

          {anuncioDeRenomeacao !== null && (
            <p
              key={`anuncio-de-renomeacao-${sequenciaDeAnuncioDeRenomeacao}`}
              className="anuncio-de-acao"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label="Mudança de Baralho"
            >
              {anuncioDeRenomeacao}
            </p>
          )}
        </>
      ) : null}

      {descartePendente && (
        <DialogoDeConfirmacao
          aberto
          titulo="Descartar alterações?"
          rotuloDeConfirmacao="Descartar alterações"
          rotuloDeCancelamento="Continuar editando"
          aoConfirmar={confirmarDescarte}
          aoCancelar={recusarDescarte}
        >
          <p>
            Você tem alterações não salvas neste Baralho. Deseja descartar
            essas alterações?
          </p>
        </DialogoDeConfirmacao>
      )}

      {baralhoParaExcluir !== null && (
        <DialogoDeConfirmacao
          aberto
          titulo="Excluir Baralho"
          rotuloDeConfirmacao="Excluir Baralho"
          confirmacaoDesabilitada={excluindo}
          aoConfirmar={() => void confirmarExclusao()}
          aoCancelar={cancelarExclusao}
        >
          <p>{descricaoDeExclusaoDeBaralho(baralhoParaExcluir)}</p>
        </DialogoDeConfirmacao>
      )}
    </div>
  );
}

/**
 * Comunicação da contagem e do limite durante a digitação do nome (FR-061).
 */
function avisoDeLimiteDeBaralho(comprimento: number): string | null {
  const restantes = LIMITE_DE_CARACTERES_DE_BARALHO - comprimento;

  if (restantes > FOLGA_PARA_AVISO_DE_LIMITE_DE_BARALHO) {
    return null;
  }

  if (restantes < 0) {
    return `Atenção: o nome excede o limite de ${LIMITE_DE_CARACTERES_DE_BARALHO} caracteres.`;
  }

  if (restantes === 0) {
    return `Atenção: o nome atingiu o limite de ${LIMITE_DE_CARACTERES_DE_BARALHO} caracteres.`;
  }

  return `Atenção: faltam ${restantes} caracteres para o limite de ${LIMITE_DE_CARACTERES_DE_BARALHO}.`;
}

/**
 * Informa o alcance da renomeação de um Baralho (FR-015): quantos Cartões
 * estão vinculados a ele.
 */
function descricaoDeAlcanceDeRenomeacao(quantidade: number): string {
  if (quantidade === 0) {
    return "Este Baralho não tem Cartões vinculados.";
  }

  if (quantidade === 1) {
    return "Este Baralho tem 1 Cartão vinculado.";
  }

  return `Este Baralho tem ${quantidade} Cartões vinculados.`;
}

/**
 * Declara a consequência real da exclusão de um Baralho (FR-016, FR-017):
 * quantos Cartões continuarão existindo e que nenhum Cartão será destruído.
 */
function descricaoDeExclusaoDeBaralho(baralho: BaralhoComCartoes): string {
  const quantidade = baralho.cartoes.length;

  if (quantidade === 0) {
    return "Este Baralho não tem Cartões vinculados. A exclusão removerá apenas o Baralho; nenhum Cartão será excluído.";
  }

  if (quantidade === 1) {
    return "Este Baralho tem 1 Cartão vinculado. Ao excluir, esse Cartão continuará existindo; apenas o Vínculo será removido. Nenhum Cartão será excluído.";
  }

  return `Este Baralho tem ${quantidade} Cartões vinculados. Ao excluir, os ${quantidade} Cartões continuarão existindo; apenas os Vínculos serão removidos. Nenhum Cartão será excluído.`;
}
