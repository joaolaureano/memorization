import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { Cartao, ClienteDoAcervo } from "../acervo-cliente/cliente";
import {
  LIMITE_DE_CARACTERES_DE_CARTAO,
  ehCodigoDeErroDeCartao,
  type CodigoDeErroDeCartao,
} from "../acervo-cliente/validacao";

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
 * T011 (FR-054, FR-055, SC-017): Frente, Verso e o botão de criação são
 * controles nativos, alcançáveis e acionáveis por teclado, na mesma ordem da
 * disposição visual; o indicador de foco fica a cargo de `estilos.css`. Numa
 * recusa de regra de Cartão, o foco vai ao campo que precisa de correção — a
 * direção vem **somente** do código de erro devolvido pela Interface
 * (`CAMPO_PARA_CORRECAO`), nunca de validação replicada na tela.
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
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falhaDeListagem, setFalhaDeListagem] = useState<string | null>(null);

  const [frente, setFrente] = useState("");
  const [verso, setVerso] = useState("");
  const [submetendo, setSubmetendo] = useState(false);
  const [falhaDeCriacao, setFalhaDeCriacao] = useState<string | null>(null);

  const campoDeFrente = useRef<HTMLTextAreaElement>(null);
  const campoDeVerso = useRef<HTMLTextAreaElement>(null);

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

  async function criarCartao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSubmetendo(true);
    setFalhaDeCriacao(null);

    const resultado = await cliente.criarCartao({ frente, verso });

    if (resultado.ok) {
      setCartoes((atuais) => [...atuais, resultado.cartao]);
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

  return (
    <main className="pagina">
      <h1>Cartões</h1>

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
            <p className="erro" role="alert">
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
        <h2>Lista de Cartões</h2>

        {carregando ? (
          <p className="carregando">Carregando Cartões…</p>
        ) : falhaDeListagem !== null ? (
          <p className="erro" role="alert">
            {falhaDeListagem}
          </p>
        ) : cartoes.length === 0 ? (
          <p className="estado-vazio">
            Ainda não há Cartões. Crie o primeiro Cartão para começar a
            memorizar.
          </p>
        ) : (
          <ul className="lista-de-cartoes">
            {cartoes.map((cartao) => (
              <li key={cartao.id} className="cartao">
                <p className="frente-do-cartao">
                  <span className="rotulo">Frente</span> {cartao.frente}
                </p>
                <p className="verso-do-cartao">
                  <span className="rotulo">Verso</span> {cartao.verso}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
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
