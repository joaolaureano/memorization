import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Baralho, ClienteDoAcervo } from "../acervo-cliente/cliente";
import { LIMITE_DE_CARACTERES_DE_BARALHO } from "../acervo-cliente/validacao";

type Props = {
  cliente: ClienteDoAcervo;
  cartaoIds: readonly string[];
  aoSalvar: (baralho: Baralho) => void;
  aoCancelar: () => void;
};

/**
 * Formulário "Salvar como baralho" sobre a seleção atual.
 *
 * FR-370: só é oferecido depois que a Sessão foi registrada no histórico.
 * FR-371: o nome obedece às regras de Baralho (vazio/longo bloqueiam).
 * FR-372: cria Vínculos com os Cartões existentes, preservando as origens.
 * FR-373: gesto único — novas tentativas reenviam o mesmo id de tentativa.
 * FR-374: Cartões indisponíveis bloqueiam o envio até a revisão explícita.
 */
export function SalvarSelecaoComoBaralho({
  cliente,
  cartaoIds,
  aoSalvar,
  aoCancelar,
}: Props) {
  const [nome, setNome] = useState("");
  const [restantes, setRestantes] = useState<string[]>([...cartaoIds]);
  const [salvando, setSalvando] = useState(false);
  const [erroDeNome, setErroDeNome] = useState<string | null>(null);
  const [falha, setFalha] = useState(false);
  const [indisponiveis, setIndisponiveis] = useState<string[]>([]);
  const idDaTentativa = useRef<string>(crypto.randomUUID());
  const campoDeNome = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campoDeNome.current?.focus();
  }, []);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (salvando || restantes.length === 0) {
      return;
    }
    setErroDeNome(null);
    setFalha(false);
    setSalvando(true);
    const resultado = await cliente.salvarSelecaoComoBaralho({
      id: idDaTentativa.current,
      nome,
      cartaoIds: restantes,
    });
    setSalvando(false);
    if (resultado.ok) {
      aoSalvar(resultado.baralho);
      return;
    }
    switch (resultado.erro) {
      case "nome_vazio":
      case "nome_muito_longo":
        setErroDeNome(resultado.mensagem);
        campoDeNome.current?.focus();
        return;
      case "cartoes_indisponiveis":
        setIndisponiveis(resultado.cartaoIds);
        return;
      case "conflito":
        idDaTentativa.current = crypto.randomUUID();
        setFalha(true);
        return;
      case "indisponivel":
      case "nao_autenticado":
        setFalha(true);
        return;
    }
  }

  function retirarIndisponiveis() {
    setRestantes(restantes.filter((id) => !indisponiveis.includes(id)));
    setIndisponiveis([]);
  }

  return (
    <div className="pilha">
      <header className="cabecalho-da-pagina">
        <div>
          <h1 tabIndex={-1}>Salvar como baralho</h1>
          <p className="texto-secundario">
            Guarde esta seleção para revisar novamente.
          </p>
        </div>
      </header>
      <form className="cartao formulario" noValidate onSubmit={aoEnviar}>
        <div className="campo">
          <label className="rotulo" htmlFor="nome-do-baralho-salvo">
            Nome do baralho
          </label>
          <input
            id="nome-do-baralho-salvo"
            ref={campoDeNome}
            autoComplete="off"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            aria-invalid={erroDeNome !== null}
            aria-describedby={
              "contador-do-baralho-salvo" +
              (erroDeNome !== null ? " erro-do-baralho-salvo" : "")
            }
          />
          <p id="contador-do-baralho-salvo" className="contador">
            {nome.length} / {LIMITE_DE_CARACTERES_DE_BARALHO} caracteres
          </p>
          {erroDeNome !== null && (
            <p id="erro-do-baralho-salvo" className="erro" role="alert">
              {erroDeNome}
            </p>
          )}
        </div>
        <p>{textoDaContagem(restantes.length)}</p>
        {indisponiveis.length > 0 && (
          <div className="aviso aviso--erro" role="alert">
            <p>{textoDeIndisponiveis(indisponiveis.length)}</p>
            <button
              type="button"
              className="botao botao--secundario"
              onClick={retirarIndisponiveis}
            >
              Retirar indisponíveis
            </button>
          </div>
        )}
        {falha && (
          <p className="erro" role="alert">
            Não foi possível salvar. Seu nome e a seleção foram preservados.
            Tente novamente.
          </p>
        )}
        <div className="acoes">
          <button
            type="submit"
            className="botao botao--primario"
            disabled={
              salvando || restantes.length === 0 || indisponiveis.length > 0
            }
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
          <button
            type="button"
            className="botao botao--secundario"
            onClick={aoCancelar}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

/** FR-372: descreve quantos Vínculos serão criados ao salvar a seleção. */
function textoDaContagem(quantidade: number): string {
  if (quantidade === 0) {
    return "Não há Cartões disponíveis para salvar.";
  }
  if (quantidade === 1) {
    return "1 Cartão será vinculado. Os baralhos de origem serão preservados.";
  }
  return (
    `${quantidade} Cartões serão vinculados. ` +
    "Os baralhos de origem serão preservados."
  );
}

/** FR-374: avisa sobre Cartões que saíram da seleção e exige revisão. */
function textoDeIndisponiveis(quantidade: number): string {
  if (quantidade === 1) {
    return (
      "1 Cartão não está mais disponível. " +
      "Retire-o e confira a nova contagem antes de salvar."
    );
  }
  return (
    `${quantidade} Cartões não estão mais disponíveis. ` +
    "Retire-os e confira a nova contagem antes de salvar."
  );
}
