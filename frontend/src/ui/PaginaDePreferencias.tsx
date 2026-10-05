import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import type {
  ClienteDoAcervo,
  Credencial,
  Preferencias,
} from "../acervo-cliente/cliente";
import { SecaoMinhaConta } from "./SecaoMinhaConta";
import {
  useDescartarProtecao,
  useProtecaoDeSaida,
} from "./protecao-de-saida";
import type { Protecao } from "./protecao-de-saida";

/**
 * Tela de Perfil (T1520; specs/015-repeticao-espacada/tasks.md; FR-335).
 *
 * A rota continua sendo `#/preferencias`; o que a tela mostra é o Perfil: a
 * Configuração (o Algoritmo de repetição espaçada) e, logo abaixo, «Minha
 * conta». Os dois são cartões irmãos dentro de
 * `.perfil`, separados pela CSS.
 *
 * O Usuário escolhe o Algoritmo de repetição espaçada, com salvar explícito
 * (FR-212). A tela carrega as
 * Preferências pela Interface `ClienteDoAcervo` e não reproduz regra de
 * domínio alguma: a lista de algoritmos disponíveis (`algoritmos`) e as
 * mensagens em português vêm do cliente (FR-046, FR-212).
 *
 * A recusa de domínio do servidor (`dados_invalidos`) devolve o foco ao campo
 * do algoritmo (FR-059).
 *
 * A saída é protegida enquanto houver algo a perder (FR-148): com valores
 * divergentes dos carregados, a navegação passa pela confirmação de descarte
 * (FR-151); com o salvamento em andamento, a navegação é bloqueada e o motivo
 * é anunciado (FR-153, FR-154). No sucesso a proteção é limpa e a tela
 * confirma em uma região viva (FR-153). Uma falha preserva o preenchimento e
 * permite nova tentativa (FR-155); a falha de carregamento oferece nova
 * tentativa sem impedir o restante da interface (FR-153, FR-156).
 */

/** Confirmação de sucesso anunciada na região viva (FR-153, FR-212, FR-335). */
const MENSAGEM_DE_SUCESSO = "Configuração salva.";

interface PropriedadesDePreferencias {
  cliente: ClienteDoAcervo;
  /**
   * A seção «Minha conta» (017, FR-257) vive nesta tela e só aparece quando a
   * casca informa o que fazer com a Credencial: substituí-la depois de trocar a
   * Senha, descartá-la depois de excluir a conta e ir a Entrar quando um
   * resultado é desconhecido.
   */
  aoSubstituirCredencial?: (nova: Credencial) => void;
  aoExcluirConta?: () => void;
  aoIrParaEntrar?: () => void;
}

export function PaginaDePreferencias({
  cliente,
  aoSubstituirCredencial,
  aoExcluirConta,
  aoIrParaEntrar,
}: PropriedadesDePreferencias) {
  const [preferencias, setPreferencias] = useState<Preferencias | null>(null);
  const [algoritmo, setAlgoritmo] = useState("");
  const [algoritmoInicial, setAlgoritmoInicial] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [falhaDeCarregamento, setFalhaDeCarregamento] = useState<string | null>(
    null,
  );
  const [numeroDaTentativa, setNumeroDaTentativa] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const campoDeAlgoritmo = useRef<HTMLSelectElement>(null);

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
    algoritmo !== algoritmoInicial;

  // FR-153/FR-154 vencem FR-148: enquanto salva, a navegação é bloqueada (e o
  // motivo anunciado); só depois de estabilizar a operação a proteção volta a
  // ser a de descarte das alterações não salvas.
  const protecao: Protecao | null = salvando
    ? {
        tipo: "pendencia",
        motivo: "Aguarde: a Configuração está sendo salva.",
      }
    : sujo
      ? {
          tipo: "descarte",
          titulo: "Descartar as alterações?",
          descricao:
            "As alterações não salvas da Configuração serão perdidas.",
          rotuloDeConfirmacao: "Descartar",
        }
      : null;

  useProtecaoDeSaida(protecao);

  const descartarProtecao = useDescartarProtecao();

  async function salvar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setFalha(null);
    setSucesso(null);
    setSalvando(true);

    const resultado = await cliente.salvarPreferencias({ algoritmo });

    if (resultado.ok) {
      // FR-153: a navegação/limpeza não pode ser barrada pela proteção de
      // pendência que a própria operação criou.
      descartarProtecao();

      setPreferencias(resultado.preferencias);
      setAlgoritmo(resultado.preferencias.algoritmo);
      setAlgoritmoInicial(resultado.preferencias.algoritmo);
      setSucesso(MENSAGEM_DE_SUCESSO);
      setSalvando(false);
      return;
    }

    // FR-155: a falha preserva o preenchimento e permite nova tentativa.
    setFalha(resultado.mensagem);

    if (resultado.erro === "dados_invalidos") {
      campoDeAlgoritmo.current?.focus();
    }

    setSalvando(false);
  }

  return (
    <div className="pagina perfil">
      <h1>Perfil</h1>

      {carregando ? (
        <p className="carregando">Carregando Perfil…</p>
      ) : falhaDeCarregamento !== null ? (
        <section className="cartao">
          <p
            className="erro"
            role="alert"
            aria-label="Falha ao carregar a Configuração"
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
        <section className="cartao" aria-labelledby="titulo-configuracao">
          <h2 id="titulo-configuracao">Configuração</h2>
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
                ref={campoDeAlgoritmo}
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

            {falha !== null && (
              <p
                className="erro"
                role="alert"
                aria-label="Falha ao salvar a Configuração"
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

      {aoSubstituirCredencial !== undefined &&
        aoExcluirConta !== undefined &&
        aoIrParaEntrar !== undefined && (
          <SecaoMinhaConta
            cliente={cliente}
            aoSubstituirCredencial={aoSubstituirCredencial}
            aoExcluirConta={aoExcluirConta}
            aoIrParaEntrar={aoIrParaEntrar}
          />
        )}
    </div>
  );
}
