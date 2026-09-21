import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type { Cartao, ClienteDoAcervo } from "../acervo-cliente/cliente";
import { LIMITE_DE_CARACTERES_DE_CARTAO } from "../acervo-cliente/validacao";

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
 */

/**
 * Folga a partir da qual a aproximação do limite passa a ser comunicada
 * explicitamente. Decisão de apresentação da tela, não regra de domínio: a
 * recusa de conteúdo acima do limite permanece exclusiva do `ClienteDoAcervo`.
 */
const FOLGA_PARA_AVISO_DE_LIMITE = 100;

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
    } else {
      setFalhaDeCriacao(resultado.mensagem);
    }

    setSubmetendo(false);
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
