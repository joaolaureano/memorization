import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { CartaoListado, ClienteDoAcervo } from "../acervo-cliente/cliente";
import {
  LIMITE_DE_CARACTERES_DE_CARTAO,
  ehCodigoDeErroDeCartao,
  type CodigoDeErroDeCartao,
} from "../acervo-cliente/validacao";
import { DialogoDeConfirmacao } from "./DialogoDeConfirmacao";

/**
 * Tela de Cartões (T009; specs/001-criar-cartao/tasks.md).
 *
 * Reúne o fluxo de lista e de criação consumindo somente a Interface
 * `ClienteDoAcervo` — o Adapter (Http em produção, EmMemoria em teste) chega
 * por propriedade. A tela **não reproduz nenhuma regra de domínio**: todo
 * conteúdo é submetido ao cliente, e a recusa é exibida com a mensagem em
 * português exatamente como o cliente a devolve (FR-046). A única constante
 * de domínio usada aqui é o limite de caracteres, importada de `validacao.ts`,
 * e apenas para comunicar contagem e limite durante a digitação (FR-053) —
 * nunca para recusar conteúdo.
 *
 * T010 (FR-044, FR-045, SC-012): a recusa da criação é exibida com a mensagem
 * da Interface, nunca é inserida na lista como concluída e deixa Frente e Verso
 * intactos para nova tentativa. Como a listagem pode ter falhado antes, uma
 * criação bem-sucedida reconcilia a lista com o acervo pela Interface — sem
 * isso, o Cartão efetivamente persistido ficaria escondido atrás da falha de
 * listagem, e a tela não retrataria a operação concluída.
 *
 * T404 (FR-005, FR-006, FR-050; specs/005-editar-cartao-e-baralho/tasks.md):
 * cada Cartão pode ser editado em formulário inline com os mesmos campos e
 * avisos de limite da criação. Antes de salvar, a tela informa em quantos
 * Baralhos o Cartão está vinculado — o alcance da alteração. Sair de uma
 * edição com alterações não salvas exige confirmação explícita; recusada, a
 * edição permanece aberta com o conteúdo digitado intacto.
 *
 * T504, T505, T506 (FR-007, FR-008, FR-068, FR-069, FR-045;
 * specs/006-excluir-cartao-e-baralho/tasks.md): a exclusão de Cartão é
 * precedida de um diálogo de confirmação acessível que declara a consequência
 * real — Vínculos removidos, nenhum Baralho destruído. Cancelar não altera o
 * estado; confirmar relê a lista após o servidor confirmar a exclusão. Em
 * falha de transporte, a entidade continua exibida e a mensagem da Interface
 * é anunciada.
 */

/**
 * Folga a partir da qual a aproximação do limite passa a ser comunicada
 * explicitamente. Decisão de apresentação da tela, não regra de domínio: a
 * recusa de conteúdo acima do limite permanece exclusiva do `ClienteDoAcervo`.
 */
const FOLGA_PARA_AVISO_DE_LIMITE = 100;

/**
 * Campo a corrigir para cada recusa de regra de Cartão (FR-055).
 *
 * A tela não reproduz nenhuma regra de domínio: qual campo precisa de correção
 * é decidido exclusivamente pelo código estável devolvido pela Interface
 * `ClienteDoAcervo`, e este mapa apenas o traduz em direção de foco.
 * `indisponivel` fica de fora de propósito — quando o transporte falha,
 * nenhum campo precisa de correção e o foco permanece onde estava.
 */
const CAMPO_PARA_CORRECAO: Readonly<
  Record<CodigoDeErroDeCartao, "frente" | "verso">
> = {
  frente_vazia: "frente",
  frente_muito_longa: "frente",
  verso_vazio: "verso",
  verso_muito_longo: "verso",
};

interface PropriedadesDaPaginaDeCartoes {
  cliente: ClienteDoAcervo;
}

export function PaginaDeCartoes({
  cliente,
}: PropriedadesDaPaginaDeCartoes) {
  const [cartoes, setCartoes] = useState<CartaoListado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falhaDeListagem, setFalhaDeListagem] = useState<string | null>(null);

  const [frente, setFrente] = useState("");
  const [verso, setVerso] = useState("");
  const [submetendo, setSubmetendo] = useState(false);
  const [falhaDeCriacao, setFalhaDeCriacao] = useState<string | null>(null);

  const [cartaoEmEdicao, setCartaoEmEdicao] = useState<CartaoListado | null>(
    null,
  );
  const [frenteEmEdicao, setFrenteEmEdicao] = useState("");
  const [versoEmEdicao, setVersoEmEdicao] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [falhaDeEdicao, setFalhaDeEdicao] = useState<string | null>(null);
  const [descartePendente, setDescartePendente] = useState(false);

  const [cartaoParaExcluir, setCartaoParaExcluir] =
    useState<CartaoListado | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [falhaDeExclusao, setFalhaDeExclusao] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [sequenciaDeAnuncio, setSequenciaDeAnuncio] = useState(0);
  const [focoAposEdicao, setFocoAposEdicao] = useState<{
    cartaoId: string;
  } | null>(null);
  const [focoAposExclusao, setFocoAposExclusao] = useState<{
    cartaoId: string;
  } | null>(null);

  const campoDeFrente = useRef<HTMLTextAreaElement>(null);
  const campoDeVerso = useRef<HTMLTextAreaElement>(null);
  const campoDeFrenteEmEdicao = useRef<HTMLTextAreaElement>(null);
  const campoDeVersoEmEdicao = useRef<HTMLTextAreaElement>(null);
  const tituloDaLista = useRef<HTMLHeadingElement>(null);
  const botoesDeEdicao = useRef(new Map<string, HTMLButtonElement>());
  const botoesDeExclusao = useRef(new Map<string, HTMLButtonElement>());

  const edicaoEstaSuja =
    cartaoEmEdicao !== null &&
    (frenteEmEdicao !== cartaoEmEdicao.frente ||
      versoEmEdicao !== cartaoEmEdicao.verso);

  useEffect(() => {
    let ativo = true;

    void cliente.listarCartoes().then((resultado) => {
      if (!ativo) {
        return;
      }

      if (resultado.ok) {
        setCartoes(resultado.cartoes);
      } else {
        setFalhaDeListagem(resultado.mensagem);
      }

      setCarregando(false);
    });

    return () => {
      ativo = false;
    };
  }, [cliente]);

  useEffect(() => {
    if (cartaoEmEdicao === null) {
      return;
    }

    campoDeFrenteEmEdicao.current?.focus();
  }, [cartaoEmEdicao]);

  useEffect(() => {
    if (focoAposEdicao === null) {
      return;
    }

    botoesDeEdicao.current.get(focoAposEdicao.cartaoId)?.focus();
    setFocoAposEdicao(null);
  }, [focoAposEdicao, cartoes]);

  useEffect(() => {
    if (focoAposExclusao === null) {
      return;
    }

    tituloDaLista.current?.focus();
    setFocoAposExclusao(null);
  }, [focoAposExclusao, cartoes]);

  async function criarCartao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSubmetendo(true);
    setFalhaDeCriacao(null);

    const resultado = await cliente.criarCartao({ frente, verso });

    if (resultado.ok) {
      // Um Cartão recém-criado ainda não está vinculado a Baralho algum; a
      // lista exige a forma estendida de `listarCartoes`, e a reconciliação
      // abaixo relê os valores autoritativos quando a listagem tinha falhado.
      setCartoes((atuais) => [
        ...atuais,
        { ...resultado.cartao, baralhos: [] },
      ]);
      setFrente("");
      setVerso("");

      if (falhaDeListagem !== null) {
        await reconciliarListagem();
      }
    } else {
      setFalhaDeCriacao(resultado.mensagem);

      // FR-055: numa recusa, o foco vai ao campo que precisa de correção. A
      // direção vem só do código devolvido pela Interface — a tela não decide
      // qual conteúdo é inválido, apenas para onde mover o foco.
      if (ehCodigoDeErroDeCartao(resultado.erro)) {
        const campo = CAMPO_PARA_CORRECAO[resultado.erro];
        const alvo = campo === "frente" ? campoDeFrente : campoDeVerso;

        alvo.current?.focus();
      }
    }

    setSubmetendo(false);
  }

  /**
   * Relê a lista pela Interface quando ela já havia falhado (FR-044).
   *
   * O Cartão recém-criado foi persistido, e a tela deve retratá-lo: sem esta
   * releitura, a falha de listagem anterior continuaria escondendo a lista
   * inteira — inclusive a criação que acabou de ser concluída. Uma falha aqui
   * apenas mantém a recusa de listagem vigente; nenhuma mensagem é inventada.
   */
  async function reconciliarListagem() {
    const resultado = await cliente.listarCartoes();

    if (resultado.ok) {
      setCartoes(resultado.cartoes);
      setFalhaDeListagem(null);
    }
  }

  function comecarEdicao(cartao: CartaoListado): void {
    setCartaoEmEdicao(cartao);
    setFrenteEmEdicao(cartao.frente);
    setVersoEmEdicao(cartao.verso);
    setFalhaDeEdicao(null);
    setFalhaDeExclusao(null);
  }

  function fecharEdicao(cartaoId: string): void {
    setCartaoEmEdicao(null);
    setFrenteEmEdicao("");
    setVersoEmEdicao("");
    setFalhaDeEdicao(null);
    setFocoAposEdicao({ cartaoId });
  }

  function cancelarEdicao(): void {
    if (cartaoEmEdicao === null) {
      return;
    }

    if (edicaoEstaSuja) {
      setDescartePendente(true);
      return;
    }

    fecharEdicao(cartaoEmEdicao.id);
  }

  function confirmarDescarte(): void {
    if (cartaoEmEdicao === null) {
      return;
    }

    const cartaoId = cartaoEmEdicao.id;

    setDescartePendente(false);
    fecharEdicao(cartaoId);
  }

  function recusarDescarte(): void {
    setDescartePendente(false);
    campoDeFrenteEmEdicao.current?.focus();
  }

  async function salvarEdicao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (cartaoEmEdicao === null) {
      return;
    }

    setSalvandoEdicao(true);
    setFalhaDeEdicao(null);

    const cartao = cartaoEmEdicao;
    const resultado = await cliente.editarCartao(
      cartao.id,
      frenteEmEdicao,
      versoEmEdicao,
    );

    if (resultado.ok) {
      // A alteração foi persistida e vale no próprio Cartão — e, portanto,
      // em todos os Baralhos a que ele está vinculado. A lista é relida para
      // continuar retratando o que o servidor confirmou.
      setCartoes((atuais) =>
        atuais.map((item) =>
          item.id === cartao.id
            ? {
                ...item,
                frente: resultado.cartao.frente,
                verso: resultado.cartao.verso,
              }
            : item,
        ),
      );
      fecharEdicao(cartao.id);
      setAnuncio("Cartão editado.");
      setSequenciaDeAnuncio((atual) => atual + 1);

      await reconciliarListagem();
    } else {
      setFalhaDeEdicao(resultado.mensagem);

      if (ehCodigoDeErroDeCartao(resultado.erro)) {
        const campo = CAMPO_PARA_CORRECAO[resultado.erro];
        const alvo = campo === "frente" ? campoDeFrenteEmEdicao : campoDeVersoEmEdicao;

        alvo.current?.focus();
      }
    }

    setSalvandoEdicao(false);
  }

  function abrirExclusao(cartao: CartaoListado): void {
    setCartaoParaExcluir(cartao);
    setFalhaDeExclusao(null);
  }

  function cancelarExclusao(): void {
    if (cartaoParaExcluir === null) {
      return;
    }

    const cartaoId = cartaoParaExcluir.id;

    setCartaoParaExcluir(null);
    botoesDeExclusao.current.get(cartaoId)?.focus();
  }

  async function confirmarExclusao(): Promise<void> {
    if (cartaoParaExcluir === null) {
      return;
    }

    const cartao = cartaoParaExcluir;

    setExcluindo(true);
    setFalhaDeExclusao(null);

    const resultado = await cliente.excluirCartao(cartao.id);

    if (resultado.ok) {
      // FR-044: a remoção só sai da lista depois que o servidor confirmou a
      // exclusão. A lista é relida para refletir o acervo autoritativo.
      setCartoes((atuais) => atuais.filter((item) => item.id !== cartao.id));
      setCartaoParaExcluir(null);
      setAnuncio("Cartão excluído. Nenhum Baralho foi excluído.");
      setSequenciaDeAnuncio((atual) => atual + 1);
      setFocoAposExclusao({ cartaoId: cartao.id });

      await reconciliarListagem();
    } else {
      setFalhaDeExclusao(resultado.mensagem);
      setCartaoParaExcluir(null);
      botoesDeExclusao.current.get(cartao.id)?.focus();
    }

    setExcluindo(false);
  }

  function registrarBotaoDeEdicao(cartaoId: string) {
    return (elemento: HTMLButtonElement | null): void => {
      if (elemento === null) {
        botoesDeEdicao.current.delete(cartaoId);
      } else {
        botoesDeEdicao.current.set(cartaoId, elemento);
      }
    };
  }

  function registrarBotaoDeExclusao(cartaoId: string) {
    return (elemento: HTMLButtonElement | null): void => {
      if (elemento === null) {
        botoesDeExclusao.current.delete(cartaoId);
      } else {
        botoesDeExclusao.current.set(cartaoId, elemento);
      }
    };
  }

  return (
    <div className="pagina">
      <h1>Cartões</h1>

      {anuncio !== null && (
        <p
          key={sequenciaDeAnuncio}
          className="anuncio-de-acao"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label="Mudança de Cartão"
        >
          {anuncio}
        </p>
      )}

      <section>
        <h2>Novo Cartão</h2>

        <form className="formulario-de-cartao" onSubmit={criarCartao}>
          <div className="campo">
            <label htmlFor="campo-frente">Frente</label>
            <textarea
              id="campo-frente"
              ref={campoDeFrente}
              value={frente}
              onChange={(evento) => setFrente(evento.target.value)}
              aria-describedby={
                avisoDeLimite(frente.length) === null
                  ? "contador-da-frente"
                  : "contador-da-frente aviso-da-frente"
              }
            />
            <p id="contador-da-frente" className="contador">
              {frente.length} / {LIMITE_DE_CARACTERES_DE_CARTAO} caracteres
            </p>
            {avisoDeLimite(frente.length) !== null && (
              <p id="aviso-da-frente" className="aviso-de-limite">
                {avisoDeLimite(frente.length)}
              </p>
            )}
          </div>

          <div className="campo">
            <label htmlFor="campo-verso">Verso</label>
            <textarea
              id="campo-verso"
              ref={campoDeVerso}
              value={verso}
              onChange={(evento) => setVerso(evento.target.value)}
              aria-describedby={
                avisoDeLimite(verso.length) === null
                  ? "contador-do-verso"
                  : "contador-do-verso aviso-do-verso"
              }
            />
            <p id="contador-do-verso" className="contador">
              {verso.length} / {LIMITE_DE_CARACTERES_DE_CARTAO} caracteres
            </p>
            {avisoDeLimite(verso.length) !== null && (
              <p id="aviso-do-verso" className="aviso-de-limite">
                {avisoDeLimite(verso.length)}
              </p>
            )}
          </div>

          {falhaDeCriacao !== null && (
            <p
              className="erro"
              role="alert"
              aria-label="Falha na criação do Cartão"
            >
              {falhaDeCriacao}
            </p>
          )}

          <button
            className="botao-de-criacao"
            type="submit"
            disabled={submetendo}
          >
            Criar Cartão
          </button>
        </form>
      </section>

      <section>
        <h2 ref={tituloDaLista} tabIndex={-1}>
          Lista de Cartões
        </h2>

        {falhaDeExclusao !== null && (
          <p
            className="erro"
            role="alert"
            aria-label="Falha na exclusão do Cartão"
          >
            {falhaDeExclusao}
          </p>
        )}

        {carregando ? (
          <p className="carregando">Carregando Cartões…</p>
        ) : falhaDeListagem !== null ? (
          <p
            className="erro"
            role="alert"
            aria-label="Falha na listagem de Cartões"
          >
            {falhaDeListagem}
          </p>
        ) : cartoes.length === 0 ? (
          // FR-056: o estado vazio é anunciado por região ativa polida — não
          // apenas texto visual. O papel já implica `aria-live="polite"` e
          // `aria-atomic="true"`; os atributos vêm explícitos com os mesmos
          // valores para que a semântica seja asseverável por teste, sem
          // mudar o que o leitor de tela anuncia. O `aria-label` nomeia a
          // região; o conteúdo continua sendo a mensagem anunciada.
          <p
            className="estado-vazio"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label="Estado vazio da lista de Cartões"
          >
            Ainda não há Cartões. Crie o primeiro Cartão para começar a
            memorizar.
          </p>
        ) : (
          <ul className="lista-de-cartoes">
            {cartoes.map((cartao) => (
              <li key={cartao.id} className="cartao">
                {cartaoEmEdicao?.id === cartao.id ? (
                  <form
                    className="formulario-de-edicao-de-cartao"
                    onSubmit={salvarEdicao}
                  >
                    <p className="alcance-da-edicao">
                      {descricaoDeAlcanceDeEdicao(cartao.baralhos.length)}
                    </p>

                    <div className="campo">
                      <label htmlFor={`campo-frente-em-edicao-${cartao.id}`}>
                        Frente do Cartão
                      </label>
                      <textarea
                        id={`campo-frente-em-edicao-${cartao.id}`}
                        ref={campoDeFrenteEmEdicao}
                        value={frenteEmEdicao}
                        onChange={(evento) =>
                          setFrenteEmEdicao(evento.target.value)
                        }
                        aria-describedby={
                          avisoDeLimite(frenteEmEdicao.length) === null
                            ? `contador-da-frente-em-edicao-${cartao.id}`
                            : `contador-da-frente-em-edicao-${cartao.id} aviso-da-frente-em-edicao-${cartao.id}`
                        }
                      />
                      <p
                        id={`contador-da-frente-em-edicao-${cartao.id}`}
                        className="contador"
                      >
                        {frenteEmEdicao.length} /{" "}
                        {LIMITE_DE_CARACTERES_DE_CARTAO} caracteres
                      </p>
                      {avisoDeLimite(frenteEmEdicao.length) !== null && (
                        <p
                          id={`aviso-da-frente-em-edicao-${cartao.id}`}
                          className="aviso-de-limite"
                        >
                          {avisoDeLimite(frenteEmEdicao.length)}
                        </p>
                      )}
                    </div>

                    <div className="campo">
                      <label htmlFor={`campo-verso-em-edicao-${cartao.id}`}>
                        Verso do Cartão
                      </label>
                      <textarea
                        id={`campo-verso-em-edicao-${cartao.id}`}
                        ref={campoDeVersoEmEdicao}
                        value={versoEmEdicao}
                        onChange={(evento) =>
                          setVersoEmEdicao(evento.target.value)
                        }
                        aria-describedby={
                          avisoDeLimite(versoEmEdicao.length) === null
                            ? `contador-do-verso-em-edicao-${cartao.id}`
                            : `contador-do-verso-em-edicao-${cartao.id} aviso-do-verso-em-edicao-${cartao.id}`
                        }
                      />
                      <p
                        id={`contador-do-verso-em-edicao-${cartao.id}`}
                        className="contador"
                      >
                        {versoEmEdicao.length} /{" "}
                        {LIMITE_DE_CARACTERES_DE_CARTAO} caracteres
                      </p>
                      {avisoDeLimite(versoEmEdicao.length) !== null && (
                        <p
                          id={`aviso-do-verso-em-edicao-${cartao.id}`}
                          className="aviso-de-limite"
                        >
                          {avisoDeLimite(versoEmEdicao.length)}
                        </p>
                      )}
                    </div>

                    {falhaDeEdicao !== null && (
                      <p
                        className="erro"
                        role="alert"
                        aria-label="Falha na edição do Cartão"
                      >
                        {falhaDeEdicao}
                      </p>
                    )}

                    <div className="acoes-de-edicao">
                      <button type="submit" disabled={salvandoEdicao}>
                        Salvar alterações
                      </button>
                      <button type="button" onClick={cancelarEdicao}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="frente-do-cartao">
                      <span className="rotulo">Frente</span> {cartao.frente}
                    </p>
                    <p className="verso-do-cartao">
                      <span className="rotulo">Verso</span> {cartao.verso}
                    </p>
                    <p className="baralhos-do-cartao">
                      <span className="rotulo">Baralhos</span>{" "}
                      {cartao.baralhos.length === 0
                        ? "Nenhum Baralho vinculado."
                        : cartao.baralhos
                            .map((baralho) => baralho.nome)
                            .join(", ")}
                    </p>
                    <div className="acoes-do-cartao">
                      <button
                        ref={registrarBotaoDeEdicao(cartao.id)}
                        type="button"
                        disabled={cartaoEmEdicao !== null}
                        onClick={() => comecarEdicao(cartao)}
                      >
                        Editar
                      </button>
                      <button
                        ref={registrarBotaoDeExclusao(cartao.id)}
                        type="button"
                        disabled={cartaoEmEdicao !== null}
                        onClick={() => abrirExclusao(cartao)}
                      >
                        Excluir
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

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
            Você tem alterações não salvas neste Cartão. Deseja descartar essas
            alterações?
          </p>
        </DialogoDeConfirmacao>
      )}

      {cartaoParaExcluir !== null && (
        <DialogoDeConfirmacao
          aberto
          titulo="Excluir Cartão"
          rotuloDeConfirmacao="Excluir Cartão"
          confirmacaoDesabilitada={excluindo}
          aoConfirmar={() => void confirmarExclusao()}
          aoCancelar={cancelarExclusao}
        >
          <p>{descricaoDeExclusaoDeCartao(cartaoParaExcluir)}</p>
        </DialogoDeConfirmacao>
      )}
    </div>
  );
}

/**
 * Comunicação da contagem e do limite durante a digitação (FR-053).
 *
 * Devolve `null` longe do limite e, perto dele, um aviso explícito sobre o
 * texto como digitado — sem recusar nada: a recusa é sempre do
 * `ClienteDoAcervo`, e esta função não a antecipa nem a reproduz.
 */
function avisoDeLimite(comprimento: number): string | null {
  const restantes = LIMITE_DE_CARACTERES_DE_CARTAO - comprimento;

  if (restantes > FOLGA_PARA_AVISO_DE_LIMITE) {
    return null;
  }

  if (restantes < 0) {
    return `Atenção: o texto excede o limite de ${LIMITE_DE_CARACTERES_DE_CARTAO} caracteres.`;
  }

  if (restantes === 0) {
    return `Atenção: o texto atingiu o limite de ${LIMITE_DE_CARACTERES_DE_CARTAO} caracteres.`;
  }

  return `Atenção: faltam ${restantes} caracteres para o limite de ${LIMITE_DE_CARACTERES_DE_CARTAO}.`;
}

/**
 * Informa o alcance da edição de um Cartão (FR-006): em quantos Baralhos ele
 * está vinculado. O texto varia entre singular, plural e nenhum vínculo.
 */
function descricaoDeAlcanceDeEdicao(quantidade: number): string {
  if (quantidade === 0) {
    return "Este Cartão não está vinculado a nenhum Baralho.";
  }

  if (quantidade === 1) {
    return "Este Cartão está vinculado a 1 Baralho.";
  }

  return `Este Cartão está vinculado a ${quantidade} Baralhos.`;
}

/**
 * Declara a consequência real da exclusão de um Cartão (FR-007, FR-008):
 * apenas os Vínculos deixam de existir, e nenhum Baralho é destruído.
 */
function descricaoDeExclusaoDeCartao(cartao: CartaoListado): string {
  const quantidade = cartao.baralhos.length;

  if (quantidade === 0) {
    return "Este Cartão não está vinculado a nenhum Baralho. A exclusão removerá o Cartão e não afetará Baralhos.";
  }

  if (quantidade === 1) {
    return "Este Cartão está vinculado a 1 Baralho. A exclusão removerá o Cartão e o Vínculo; nenhum Baralho será excluído.";
  }

  return `Este Cartão está vinculado a ${quantidade} Baralhos. A exclusão removerá o Cartão e os ${quantidade} Vínculos; nenhum Baralho será excluído.`;
}
