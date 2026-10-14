import { TextoDoProduto } from "../idioma";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Baralho, ClienteDoAcervo } from "../acervo-cliente/cliente";
import { LIMITE_DE_CARACTERES_DE_BARALHO } from "../acervo-cliente/validacao";
import { CampoDeTags } from "./CampoDeTags";
import { useIdioma } from "../idioma";

type Props = {
  cliente: ClienteDoAcervo;
  cartaoIds: readonly string[];
  aoSalvar: (baralho: Baralho) => void;
  aoCancelar: () => void;
  /**
   * Nome inicial para o baralho (T2318, T2319): prefill do campo de nome
   * com o nome do baralho temporário, editável.
   */
  nomeInicial?: string;
};

/**
 * Formulário "Salvar como baralho" sobre a seleção atual.
 *
 * FR-370: só é oferecido depois que a Sessão foi registrada no histórico.
 * FR-371: o nome obedece às regras de Baralho (vazio/longo bloqueiam).
 * FR-372: cria cópias dos Cartões existentes, preservando as origens.
 * FR-373: gesto único — novas tentativas reenviam o mesmo id de tentativa.
 * FR-374: Cartões indisponíveis bloqueiam o envio até a revisão explícita.
 */
export function SalvarSelecaoComoBaralho({
  cliente,
  cartaoIds,
  aoSalvar,
  aoCancelar,
  nomeInicial,
}: Props) {
  const { textos } = useIdioma();
  const [nome, setNome] = useState(nomeInicial ?? textos.selecao.baralhoTemporario);
  const [tags, setTags] = useState<string[]>([]);
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
      tags,
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
          <h1 tabIndex={-1}>{textos.selecao.salvarComoBaralhoTitulo}</h1>
          <p className="texto-secundario">
            {textos.selecao.guardeSelecao}
          </p>
        </div>
      </header>
      <form className="cartao formulario" noValidate onSubmit={aoEnviar}>
        <div className="campo">
          <label className="rotulo" htmlFor="nome-do-baralho-salvo">
            {textos.selecao.nomeDoBaralho}
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
            {textos.selecao.contadorDeCaracteres(nome.length, LIMITE_DE_CARACTERES_DE_BARALHO)}
          </p>
          {erroDeNome !== null && (
            <p id="erro-do-baralho-salvo" className="erro" role="alert">
              <TextoDoProduto texto={erroDeNome} />
            </p>
          )}
        </div>
        <CampoDeTags tags={tags} aoAlterar={setTags} />
        <p>{textoDaContagem(restantes.length, textos)}</p>
        {indisponiveis.length > 0 && (
          <div className="aviso aviso--erro" role="alert">
            <p>{textoDeIndisponiveis(indisponiveis.length, textos)}</p>
            <button
              type="button"
              className="botao botao--secundario"
              onClick={retirarIndisponiveis}
            >
              {textos.selecao.retirarIndisponiveis}
            </button>
          </div>
        )}
        {falha && (
          <p className="erro" role="alert">
            {textos.selecao.naoFoiPossivelSalvar}
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
            {salvando ? textos.selecao.salvando : textos.comum.salvar}
          </button>
          <button
            type="button"
            className="botao botao--secundario"
            onClick={aoCancelar}
          >
            {textos.comum.cancelar}
          </button>
        </div>
      </form>
    </div>
  );
}

/** FR-372: descreve quantas cópias serão criadas ao salvar a seleção. */
function textoDaContagem(quantidade: number, textos: ReturnType<typeof useIdioma>["textos"]): string {
  if (quantidade === 0) {
    return textos.selecao.naoHaCartoesParaSalvar;
  }
  return textos.selecao.seraCopiado(quantidade);
}

/** FR-374: avisa sobre Cartões que saíram da seleção e exige revisão. */
function textoDeIndisponiveis(quantidade: number, textos: ReturnType<typeof useIdioma>["textos"]): string {
  if (quantidade === 1) {
    return (
      textos.selecao.cartaoIndisponivel(1) +
      " Retire-o e confira a nova contagem antes de salvar."
    );
  }
  return (
    textos.selecao.cartaoIndisponivel(quantidade) +
    " Retire-os e confira a nova contagem antes de salvar."
  );
}
