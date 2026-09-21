import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import type {
  BaralhoListado,
  ClienteDoAcervo,
} from "../acervo-cliente/cliente";
import {
  LIMITE_DE_CARACTERES_DE_BARALHO,
  ehCodigoDeErroDeBaralho,
  type CodigoDeErroDeBaralho,
} from "../acervo-cliente/validacao";

/**
 * Tela de Baralhos (T107; specs/002-criar-baralho/tasks.md).
 *
 * Reúne o fluxo de lista e de criação consumindo somente a Interface
 * `ClienteDoAcervo` — o Adapter (Http em produção, EmMemoria em teste) chega
 * por propriedade. A tela **não reproduz nenhuma regra de domínio**: todo
 * conteúdo é submetido ao cliente, e a recusa é exibida com a mensagem em
 * português exatamente como o cliente a devolve (FR-046). A única constante
 * de domínio usada aqui é o limite de caracteres, importada de `validacao.ts`,
 * e apenas para comunicar contagem e limite durante a digitação (FR-061) —
 * nunca para recusar conteúdo.
 *
 * T108 (FR-044, FR-045, SC-012): a recusa da criação é exibida com a mensagem
 * da Interface, nunca é inserida na lista como concluída e deixa o nome
 * intacto para nova tentativa. Como a listagem pode ter falhado antes, uma
 * criação bem-sucedida reconcilia a lista com o acervo pela Interface — sem
 * isso, o Baralho efetivamente persistido ficaria escondido atrás da falha de
 * listagem, e a tela não retrataria a operação concluída.
 */

/**
 * Folga a partir da qual a aproximação do limite passa a ser comunicada
 * explicitamente. Decisão de apresentação da tela, não regra de domínio: a
 * recusa de conteúdo acima do limite permanece exclusiva do `ClienteDoAcervo`.
 */
const FOLGA_PARA_AVISO_DE_LIMITE_DE_BARALHO = 10;

/**
 * Campo a corrigir para cada recusa de regra de Baralho (FR-059).
 *
 * A tela não reproduz nenhuma regra de domínio: qual campo precisa de correção
 * é decidido exclusivamente pelo código estável devolvido pela Interface
 * `ClienteDoAcervo`, e este mapa apenas o traduz em direção de foco.
 * `indisponivel` fica de fora de propósito — quando o transporte falha,
 * nenhum campo precisa de correção e o foco permanece onde estava.
 */
const CAMPO_PARA_CORRECAO: Readonly<
  Record<CodigoDeErroDeBaralho, "nome">
> = {
  nome_vazio: "nome",
  nome_muito_longo: "nome",
};

interface PropriedadesDaPaginaDeBaralhos {
  cliente: ClienteDoAcervo;
}

export function PaginaDeBaralhos({
  cliente,
}: PropriedadesDaPaginaDeBaralhos) {
  const [baralhos, setBaralhos] = useState<BaralhoListado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falhaDeListagem, setFalhaDeListagem] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [submetendo, setSubmetendo] = useState(false);
  const [falhaDeCriacao, setFalhaDeCriacao] = useState<string | null>(null);

  const campoDeNome = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let ativo = true;

    void cliente.listarBaralhos().then((resultado) => {
      if (!ativo) {
        return;
      }

      if (resultado.ok) {
        setBaralhos(resultado.baralhos);
      } else {
        setFalhaDeListagem(resultado.mensagem);
      }

      setCarregando(false);
    });

    return () => {
      ativo = false;
    };
  }, [cliente]);

  async function criarBaralho(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSubmetendo(true);
    setFalhaDeCriacao(null);

    const resultado = await cliente.criarBaralho({ nome });

    if (resultado.ok) {
      // O contrato de criação devolve `Baralho` (id e nome); a lista exige
      // também a forma `BaralhoListado`. Um Baralho recém-criado ainda não
      // tem Vínculo — nesta feature não há Vínculo algum — então os campos
      // derivados são 0 e falso. A reconciliação abaixo relê os valores
      // autoritativos quando a listagem tinha falhado.
      setBaralhos((atuais) => [
        ...atuais,
        {
          ...resultado.baralho,
          quantidadeDeCartoes: 0,
          elegivel: false,
        },
      ]);
      setNome("");

      if (falhaDeListagem !== null) {
        await reconciliarListagem();
      }
    } else {
      setFalhaDeCriacao(resultado.mensagem);

      // FR-059: numa recusa, o foco vai ao campo que precisa de correção. A
      // direção vem só do código devolvido pela Interface — a tela não decide
      // qual conteúdo é inválido, apenas para onde mover o foco.
      if (ehCodigoDeErroDeBaralho(resultado.erro)) {
        const campo = CAMPO_PARA_CORRECAO[resultado.erro];

        if (campo === "nome") {
          campoDeNome.current?.focus();
        }
      }
    }

    setSubmetendo(false);
  }

  /**
   * Relê a lista pela Interface quando ela já havia falhado (FR-044).
   *
   * O Baralho recém-criado foi persistido, e a tela deve retratá-lo: sem esta
   * releitura, a falha de listagem anterior continuaria escondendo a lista
   * inteira — inclusive a criação que acabou de ser concluída. Uma falha aqui
   * apenas mantém a recusa de listagem vigente; nenhuma mensagem é inventada.
   */
  async function reconciliarListagem() {
    const resultado = await cliente.listarBaralhos();

    if (resultado.ok) {
      setBaralhos(resultado.baralhos);
      setFalhaDeListagem(null);
    }
  }

  return (
    <div className="pagina">
      <h1>Baralhos</h1>

      <section>
        <h2>Novo Baralho</h2>

        <form className="formulario-de-baralho" onSubmit={criarBaralho}>
          <div className="campo">
            <label htmlFor="campo-nome">Nome</label>
            <input
              id="campo-nome"
              ref={campoDeNome}
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              aria-describedby={
                avisoDeLimite(nome.length) === null
                  ? "contador-do-nome"
                  : "contador-do-nome aviso-do-nome"
              }
            />
            <p id="contador-do-nome" className="contador">
              {nome.length} / {LIMITE_DE_CARACTERES_DE_BARALHO} caracteres
            </p>
            {avisoDeLimite(nome.length) !== null && (
              <p id="aviso-do-nome" className="aviso-de-limite">
                {avisoDeLimite(nome.length)}
              </p>
            )}
          </div>

          {falhaDeCriacao !== null && (
            <p
              className="erro"
              role="alert"
              aria-label="Falha na criação do Baralho"
            >
              {falhaDeCriacao}
            </p>
          )}

          <button
            className="botao-de-criacao"
            type="submit"
            disabled={submetendo}
          >
            Criar Baralho
          </button>
        </form>
      </section>

      <section>
        <h2>Lista de Baralhos</h2>

        {carregando ? (
          <p className="carregando">Carregando Baralhos…</p>
        ) : falhaDeListagem !== null ? (
          <p
            className="erro"
            role="alert"
            aria-label="Falha na listagem de Baralhos"
          >
            {falhaDeListagem}
          </p>
        ) : baralhos.length === 0 ? (
          // FR-060: o estado vazio é anunciado por região ativa polida — não
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
            aria-label="Estado vazio da lista de Baralhos"
          >
            Ainda não há Baralhos. Crie o primeiro Baralho para começar a
            organizar seus Cartões.
          </p>
        ) : (
          <ul className="lista-de-baralhos">
            {baralhos.map((baralho) => (
              <li key={baralho.id} className="baralho">
                <p className="nome-do-baralho">{baralho.nome}</p>
                <p className="quantidade-de-cartoes">
                  <span className="rotulo">Cartões</span>{" "}
                  {baralho.quantidadeDeCartoes}
                </p>
                <p className="elegibilidade-do-baralho">
                  {baralho.elegivel
                    ? "Elegível para estudo."
                    : "Não elegível para estudo: nenhum Cartão vinculado."}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Comunicação da contagem e do limite durante a digitação (FR-061).
 *
 * Devolve `null` longe do limite e, perto dele, um aviso explícito sobre o
 * texto como digitado — sem recusar nada: a recusa é sempre do
 * `ClienteDoAcervo`, e esta função não a antecipa nem a reproduz.
 */
function avisoDeLimite(comprimento: number): string | null {
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
