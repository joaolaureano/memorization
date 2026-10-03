import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import type {
  ClienteDoAcervo,
  Preferencias,
} from "../acervo-cliente/cliente";
import {
  useDescartarProtecao,
  useProtecaoDeSaida,
} from "./protecao-de-saida";
import type { Protecao } from "./protecao-de-saida";

/**
 * Tela de Preferências (T1520; specs/015-repeticao-espacada/tasks.md).
 *
 * O Usuário escolhe o Algoritmo de repetição espaçada e o limite diário de
 * Cartões novos, com salvar explícito (FR-212, FR-200). A tela carrega as
 * Preferências pela Interface `ClienteDoAcervo` e não reproduz regra de
 * domínio alguma: a lista de algoritmos disponíveis (`algoritmos`) e as
 * mensagens em português vêm do cliente (FR-046, FR-212).
 *
 * O limite é a única regra local: a tela recusa valor não inteiro ou fora de
 * 0 a 999 antes de chamar o cliente, com mensagem e foco no campo (FR-200). A
 * recusa de domínio do servidor (`dados_invalidos`) também devolve o foco ao
 * campo do limite (FR-059).
 *
 * A saída é protegida enquanto houver algo a perder (FR-148): com valores
 * divergentes dos carregados, a navegação passa pela confirmação de descarte
 * (FR-151); com o salvamento em andamento, a navegação é bloqueada e o motivo
 * é anunciado (FR-153, FR-154). No sucesso a proteção é limpa e a tela
 * confirma em uma região viva (FR-153). Uma falha preserva o preenchimento e
 * permite nova tentativa (FR-155); a falha de carregamento oferece nova
 * tentativa sem impedir o restante da interface (FR-153, FR-156).
 */

/**
 * Extremos do limite diário de Cartões novos (FR-200): inteiro de 0 a 999, com
 * 0 significando não introduzir Cartões novos.
 */
const LIMITE_MINIMO_DE_NOVOS_POR_DIA = 0;
const LIMITE_MAXIMO_DE_NOVOS_POR_DIA = 999;

/**
 * Mensagem da recusa local do limite (FR-200). É a única regra que a tela
 * aplica antes de chamar o cliente; a recusa de domínio continua sendo
 * exclusiva do `ClienteDoAcervo`.
 */
const MENSAGEM_DE_LIMITE_INVALIDO =
  "Informe um número inteiro entre 0 e 999.";

/** Confirmação de sucesso anunciada na região viva (FR-153, FR-212). */
const MENSAGEM_DE_SUCESSO = "Preferências salvas.";

interface PropriedadesDePreferencias {
  cliente: ClienteDoAcervo;
}

export function PaginaDePreferencias({ cliente }: PropriedadesDePreferencias) {
  const [preferencias, setPreferencias] = useState<Preferencias | null>(null);
  const [algoritmo, setAlgoritmo] = useState("");
  const [algoritmoInicial, setAlgoritmoInicial] = useState("");
  const [limite, setLimite] = useState("");
  const [limiteInicial, setLimiteInicial] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [falhaDeCarregamento, setFalhaDeCarregamento] = useState<string | null>(
    null,
  );
  const [numeroDaTentativa, setNumeroDaTentativa] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const campoDeLimite = useRef<HTMLInputElement>(null);

  // FR-153/FR-156: a carga distingue carregando, falha com nova tentativa e
  // sucesso. `numeroDaTentativa` reexecuta a leitura sem recarregar a página.
  useEffect(() => {
    let ativo = true;

    setCarregando(true);
    setFalhaDeCarregamento(null);

    void cliente.obterPreferencias().then((resultado) => {
      if (!ativo) {
        return;
      }

      if (resultado.ok) {
        setPreferencias(resultado.preferencias);
        setAlgoritmo(resultado.preferencias.algoritmo);
        setAlgoritmoInicial(resultado.preferencias.algoritmo);
        setLimite(String(resultado.preferencias.limiteDeNovosPorDia));
        setLimiteInicial(String(resultado.preferencias.limiteDeNovosPorDia));
      } else {
        setFalhaDeCarregamento(resultado.mensagem);
      }

      setCarregando(false);
    });

    return () => {
      ativo = false;
    };
  }, [cliente, numeroDaTentativa]);

  const sujo =
    !carregando &&
    falhaDeCarregamento === null &&
    (algoritmo !== algoritmoInicial || limite !== limiteInicial);

  // FR-153/FR-154 vencem FR-148: enquanto salva, a navegação é bloqueada (e o
  // motivo anunciado); só depois de estabilizar a operação a proteção volta a
  // ser a de descarte das alterações não salvas.
  const protecao: Protecao | null = salvando
    ? { tipo: "pendencia", motivo: "Aguarde: as Preferências estão sendo salvas." }
    : sujo
      ? {
          tipo: "descarte",
          titulo: "Descartar as alterações?",
          descricao: "As Preferências não salvas serão perdidas.",
          rotuloDeConfirmacao: "Descartar",
        }
      : null;

  useProtecaoDeSaida(protecao);

  const descartarProtecao = useDescartarProtecao();

  async function salvar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setFalha(null);
    setSucesso(null);

    // FR-200: a recusa local do limite ocorre antes de qualquer chamada ao
    // cliente, com mensagem e foco no campo (FR-059).
    if (limiteInvalido(limite)) {
      setFalha(MENSAGEM_DE_LIMITE_INVALIDO);
      campoDeLimite.current?.focus();
      return;
    }

    setSalvando(true);

    const resultado = await cliente.salvarPreferencias({
      algoritmo,
      limiteDeNovosPorDia: Number(limite),
    });

    if (resultado.ok) {
      // FR-153: a navegação/limpeza não pode ser barrada pela proteção de
      // pendência que a própria operação criou.
      descartarProtecao();

      setPreferencias(resultado.preferencias);
      setAlgoritmo(resultado.preferencias.algoritmo);
      setAlgoritmoInicial(resultado.preferencias.algoritmo);
      setLimite(String(resultado.preferencias.limiteDeNovosPorDia));
      setLimiteInicial(String(resultado.preferencias.limiteDeNovosPorDia));
      setSucesso(MENSAGEM_DE_SUCESSO);
      setSalvando(false);
      return;
    }

    // FR-155: a falha preserva o preenchimento e permite nova tentativa.
    setFalha(resultado.mensagem);

    if (resultado.erro === "dados_invalidos") {
      campoDeLimite.current?.focus();
    }

    setSalvando(false);
  }

  return (
    <div className="pagina">
      <h1>Preferências</h1>

      {carregando ? (
        <p className="carregando">Carregando Preferências…</p>
      ) : falhaDeCarregamento !== null ? (
        <section className="cartao">
          <p
            className="erro"
            role="alert"
            aria-label="Falha ao carregar as Preferências"
          >
            {falhaDeCarregamento}
          </p>
          <div className="acoes">
            <button
              className="botao botao--primario"
              type="button"
              onClick={() => setNumeroDaTentativa((atual) => atual + 1)}
            >
              Tentar novamente
            </button>
          </div>
        </section>
      ) : preferencias !== null ? (
        <section className="cartao">
          <form
            className="formulario"
            noValidate
            onSubmit={(evento) => void salvar(evento)}
          >
            <div className="campo">
              <label className="rotulo" htmlFor="campo-algoritmo">
                Algoritmo de repetição espaçada
              </label>
              <select
                id="campo-algoritmo"
                value={algoritmo}
                onChange={(evento) => {
                  setAlgoritmo(evento.target.value);
                  setSucesso(null);
                }}
              >
                {preferencias.algoritmos.map((opcao) => (
                  <option key={opcao.id} value={opcao.id}>
                    {opcao.rotulo}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label className="rotulo" htmlFor="campo-limite">
                Cartões novos por dia
              </label>
              <input
                id="campo-limite"
                ref={campoDeLimite}
                type="number"
                inputMode="numeric"
                min={LIMITE_MINIMO_DE_NOVOS_POR_DIA}
                max={LIMITE_MAXIMO_DE_NOVOS_POR_DIA}
                step={1}
                value={limite}
                onChange={(evento) => {
                  setLimite(evento.target.value);
                  setSucesso(null);
                }}
                aria-describedby="orientacao-do-limite"
              />
              <p id="orientacao-do-limite" className="contador">
                0 significa não introduzir Cartões novos.
              </p>
            </div>

            {falha !== null && (
              <p
                className="erro"
                role="alert"
                aria-label="Falha ao salvar as Preferências"
              >
                {falha}
              </p>
            )}

            {sucesso !== null && (
              <p role="status" className="contador">
                {sucesso}
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
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Recusa local do limite diário de Cartões novos (FR-200): aceita apenas
 * inteiro de 0 a 999. Campo vazio é recusado, porque a Interface exige um
 * número e não um valor em branco. Esta função não reproduz nenhuma regra do
 * `ClienteDoAcervo`: as demais recusas continuam vindo dele.
 */
function limiteInvalido(valor: string): boolean {
  if (valor.trim() === "") {
    return true;
  }

  const numero = Number(valor);

  return (
    !Number.isInteger(numero) ||
    numero < LIMITE_MINIMO_DE_NOVOS_POR_DIA ||
    numero > LIMITE_MAXIMO_DE_NOVOS_POR_DIA
  );
}
