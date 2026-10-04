import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { CartaoListado, ClienteDoAcervo } from "../acervo-cliente/cliente";
import {
  LIMITE_DE_CARACTERES_DE_CARTAO,
  ehCodigoDeErroDeCartao,
  type CodigoDeErroDeCartao,
} from "../acervo-cliente/validacao";
import { EstadoDaCarga } from "./EstadoDaCarga";
import {
  useNavegarSemProtecao,
  useProtecaoDeSaida,
} from "./protecao-de-saida";

/**
 * Página do formulário de Cartão — criação e edição (T1113;
 * specs/012-interface-visual-navegavel/tasks.md; FR-140, FR-141, FR-144,
 * FR-146, FR-147, FR-148, FR-153, FR-154, FR-155, FR-156).
 *
 * Sem `id`, é a criação (`#/cartoes/novo`); com `id`, é a edição do Cartão
 * correspondente. Concentra as mesmas regras, limites e mensagens das features
 * 001 e 005 — o limite de caracteres é comunicado durante a digitação
 * (FR-053), mas quem recusa conteúdo continua sendo o `ClienteDoAcervo`, e a
 * mensagem exibida é exatamente a devolvida pela Interface (FR-046).
 *
 * Na edição, um `aviso` declara o alcance da alteração: em quantos Baralhos o
 * Cartão está e que a mudança vale em todos eles (FR-006, FR-146). Cartão
 * inexistente ou de outro Usuário não é encontrado — a página apresenta a
 * mensagem de não encontrado com um caminho de volta para Cartões (FR-156).
 *
 * A proteção de saída (FR-148, FR-154) vem de `protecao-de-saida`: com o
 * formulário sujo, sair exige confirmação; com um salvamento em andamento, a
 * navegação é bloqueada e o motivo é anunciado. Concluído o salvamento, a
 * proteção é descartada e a interface volta para a lista.
 */

/**
 * Folga a partir da qual a aproximação do limite passa a ser comunicada
 * explicitamente. Decisão de apresentação, não regra de domínio: a recusa de
 * conteúdo acima do limite permanece exclusiva do `ClienteDoAcervo`.
 */
const FOLGA_PARA_AVISO_DE_LIMITE = 100;

/**
 * Campo a corrigir para cada recusa de regra de Cartão (FR-055, FR-155).
 *
 * A página não reproduz nenhuma regra de domínio: qual campo precisa de
 * correção é decidido exclusivamente pelo código estável devolvido pela
 * Interface, e este mapa apenas o traduz em direção de foco. `indisponivel`
 * fica de fora de propósito — na falha de transporte, nenhum campo precisa de
 * correção e o foco permanece onde estava.
 */
const CAMPO_PARA_CORRECAO: Readonly<
  Record<CodigoDeErroDeCartao, "frente" | "verso">
> = {
  frente_vazia: "frente",
  frente_muito_longa: "frente",
  verso_vazio: "verso",
  verso_muito_longo: "verso",
};

export const MOTIVO_DE_PENDENCIA = "Aguarde: o Cartão está sendo salvo.";

const PROTECAO_DE_DESCARTE = {
  tipo: "descarte",
  titulo: "Descartar as alterações?",
  descricao: "O texto digitado será perdido.",
  rotuloDeConfirmacao: "Descartar",
} as const;

interface PropriedadesDoFormularioDeCartao {
  cliente: ClienteDoAcervo;
  id?: string;
}

export function PaginaDoFormularioDeCartao({
  cliente,
  id,
}: PropriedadesDoFormularioDeCartao) {
  const emEdicao = id !== undefined;

  const [carregando, setCarregando] = useState(emEdicao);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [falhaDeCarga, setFalhaDeCarga] = useState<string | null>(null);
  const [cartao, setCartao] = useState<CartaoListado | null>(null);

  const [frente, setFrente] = useState("");
  const [verso, setVerso] = useState("");
  const [referencia, setReferencia] = useState({ frente: "", verso: "" });
  const [salvando, setSalvando] = useState(false);
  const [falhaDeSalvamento, setFalhaDeSalvamento] = useState<string | null>(
    null,
  );

  const campoDeFrente = useRef<HTMLTextAreaElement>(null);
  const campoDeVerso = useRef<HTMLTextAreaElement>(null);

  const estaSujo =
    frente !== referencia.frente || verso !== referencia.verso;

  const navegarSemProtecao = useNavegarSemProtecao();

  // Há uma única proteção vigente e a pendência tem precedência: enquanto o
  // salvamento corre, sair é bloqueado e o motivo é anunciado (FR-154); fora
  // dele, sair com conteúdo diferente do inicial pede confirmação (FR-148).
  // Duas chamadas de `useProtecaoDeSaida` não servem aqui: a última gravaria
  // por cima da primeira e o descarte venceria a pendência, liberando a
  // navegação exatamente quando ela precisa ficar parada.
  useProtecaoDeSaida(
    salvando
      ? { tipo: "pendencia", motivo: MOTIVO_DE_PENDENCIA }
      : estaSujo
        ? PROTECAO_DE_DESCARTE
        : null,
  );

  useEffect(() => {
    if (!emEdicao) {
      return;
    }

    let ativo = true;

    void (async () => {
      const listagem = await cliente.listarCartoes();

      if (!ativo) {
        return;
      }

      if (!listagem.ok) {
        setFalhaDeCarga(listagem.mensagem);
        setCarregando(false);
        return;
      }

      const encontrado = listagem.cartoes.find((item) => item.id === id);

      if (encontrado === undefined) {
        setNaoEncontrado(true);
        setCarregando(false);
        return;
      }

      setCartao(encontrado);
      setFrente(encontrado.frente);
      setVerso(encontrado.verso);
      setReferencia({
        frente: encontrado.frente,
        verso: encontrado.verso,
      });
      setCarregando(false);
    })();

    return () => {
      ativo = false;
    };
  }, [cliente, id, emEdicao]);

  // `useLayoutEffect`, e não `useEffect`: o foco precisa ser movido na mesma
  // tarefa da mutação do DOM. Um `useEffect` só corre depois da pintura, e o
  // intervalo entre a montagem do formulário e a pintura seguinte deixa o
  // foco no `<body>` — quem observa o DOM logo após o commit (leitor de tela,
  // teste) vê o foco perdido antes de ele chegar ao campo (ordem de foco da
  // WCAG; nenhum foco transitório no `<body>`). `PaginaDoBaralho.tsx` usa o
  // mesmo recurso para o foco após remoção.
  useLayoutEffect(() => {
    if (emEdicao && !carregando && !naoEncontrado) {
      campoDeFrente.current?.focus();
    }
  }, [emEdicao, carregando, naoEncontrado]);

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setFalhaDeSalvamento(null);

    const resultado = emEdicao
      ? await cliente.editarCartao(id, frente, verso)
      : await cliente.criarCartao({ frente, verso });

    if (resultado.ok) {
      setReferencia({ frente, verso });
      navegarSemProtecao("#/cartoes");
      return;
    }

    setFalhaDeSalvamento(resultado.mensagem);

    // FR-055, FR-155: numa recusa, o foco vai ao campo que precisa de
    // correção. A direção vem só do código devolvido pela Interface — a
    // página não decide qual conteúdo é inválido, apenas para onde mover o
    // foco. Na falha de transporte, nenhum campo é apontado.
    if (ehCodigoDeErroDeCartao(resultado.erro)) {
      const campo = CAMPO_PARA_CORRECAO[resultado.erro];
      const alvo = campo === "frente" ? campoDeFrente : campoDeVerso;

      alvo.current?.focus();
    }

    setSalvando(false);
  }

  if (carregando) {
    return (
      <div className="pagina">
        <h1>{emEdicao ? "Editar Cartão" : "Criar cartão"}</h1>
        <EstadoDaCarga estado="carregando" mensagem="Carregando Cartões…" />
      </div>
    );
  }

  if (naoEncontrado) {
    return (
      <div className="pagina">
        <h1>Cartão não encontrado</h1>
        <p className="aviso aviso--erro" role="alert">
          O Cartão não existe ou não pertence a você.
        </p>
        <p className="voltar">
          <a href="#/cartoes">← Voltar para Cartões</a>
        </p>
      </div>
    );
  }

  if (falhaDeCarga !== null) {
    return (
      <div className="pagina">
        <h1>{emEdicao ? "Editar Cartão" : "Criar cartão"}</h1>
        <EstadoDaCarga
          estado="falha"
          mensagem={falhaDeCarga}
          aoTentarNovamente={() => window.location.reload()}
        />
        <p className="voltar">
          <a href="#/cartoes">← Voltar para Cartões</a>
        </p>
      </div>
    );
  }

  return (
    <div className="pagina">
      <p className="voltar">
        <a href="#/cartoes">← Voltar para Cartões</a>
      </p>

      <h1>{emEdicao ? "Editar Cartão" : "Criar cartão"}</h1>

      {emEdicao && cartao !== null && (
        <aside className="aviso">
          {descricaoDeAlcanceDeEdicao(cartao.baralhos)}
        </aside>
      )}

      <div className="cartao">
        <form className="formulario" onSubmit={salvar}>
          <div className="campo">
            <label htmlFor="campo-frente" className="rotulo">
              Frente
            </label>
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
            <label htmlFor="campo-verso" className="rotulo">
              Verso
            </label>
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

          {falhaDeSalvamento !== null && (
            <p
              className="erro"
              role="alert"
              aria-label={
                emEdicao
                  ? "Falha na edição do Cartão"
                  : "Falha na criação do Cartão"
              }
            >
              {falhaDeSalvamento}
            </p>
          )}

          <div className="acoes">
            <button
              className="botao botao--primario"
              type="submit"
              disabled={salvando}
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
            <a className="botao botao--secundario" href="#/cartoes">
              Cancelar
            </a>
          </div>
        </form>
      </div>
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
 * Informa o alcance da edição (FR-006, FR-146): em quantos Baralhos o Cartão
 * está e que a alteração vale em todos eles. O texto varia entre singular,
 * plural e nenhum vínculo, e a mudança de nome de qualquer Baralho não
 * interfere neste aviso.
 */
function descricaoDeAlcanceDeEdicao(baralhos: CartaoListado["baralhos"]): string {
  const quantidade = baralhos.length;

  if (quantidade === 0) {
    return "Este Cartão não está vinculado a nenhum Baralho.";
  }

  const nomes = baralhos.map((baralho) => baralho.nome).join(", ");

  if (quantidade === 1) {
    return `Este Cartão está vinculado a 1 Baralho: ${nomes}. A alteração vale nesse Baralho.`;
  }

  return `Este Cartão está vinculado a ${quantidade} Baralhos: ${nomes}. A alteração vale em todos eles.`;
}
