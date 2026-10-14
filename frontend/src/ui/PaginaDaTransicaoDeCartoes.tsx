import { TextoDoProduto } from "../idioma";
import { useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type {
  Baralho,
  CartaoDaTransicao,
  ClienteDoAcervo,
  EscolhaDeTransicao,
} from "../acervo-cliente/cliente";
import { useIdioma } from "../idioma";

interface Propriedades {
  cliente: ClienteDoAcervo;
  cartoes: CartaoDaTransicao[];
  baralhos: Baralho[];
  aoConcluir: () => void;
}

/** Resolve todos os Cartões legados do Usuário em uma única operação. */
export function PaginaDaTransicaoDeCartoes({
  cliente,
  cartoes,
  baralhos,
  aoConcluir,
}: Propriedades) {
  const { textos } = useIdioma();
  const [destinos, setDestinos] = useState<Record<string, string>>({});
  const [falha, setFalha] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [baralhosDisponiveis, setBaralhosDisponiveis] = useState(baralhos);
  const [nomeNovoBaralho, setNomeNovoBaralho] = useState("");
  const botao = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (falha !== null && !salvando) botao.current?.focus();
  }, [falha, salvando]);

  async function criarBaralho() {
    const resultado = await cliente.criarBaralho({ nome: nomeNovoBaralho });
    if (resultado.ok) {
      setBaralhosDisponiveis((atuais) => [...atuais, resultado.baralho]);
      setNomeNovoBaralho("");
      setFalha(null);
    } else {
      setFalha(resultado.mensagem);
    }
  }

  async function concluir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (salvando) return;

    const escolhas: EscolhaDeTransicao[] = cartoes.map((cartao) => ({
      cartaoId: cartao.id,
      baralhoId: destinos[cartao.id] ?? "",
    }));
    if (escolhas.some((escolha) => escolha.baralhoId === "")) {
      setFalha(textos.selecao.escolhaUmBaralho);
      botao.current?.focus();
      return;
    }

    setSalvando(true);
    setFalha(null);
    const resultado = await cliente.concluirTransicao(escolhas);
    if (resultado.ok) {
      aoConcluir();
      return;
    }
    setFalha(resultado.mensagem);
    setSalvando(false);
  }

  return (
    <section className="pagina">
      <h1 tabIndex={-1}>{textos.selecao.organizarTitulo}</h1>
      <p>{textos.selecao.organizarDescricao}</p>
      {baralhosDisponiveis.length === 0 ? (
        <div>
          <p role="status">{textos.selecao.precisaDeUmBaralho}</p>
          <label htmlFor="nome-do-novo-baralho">{textos.selecao.nomeDoNovoBaralho}</label>
          <input id="nome-do-novo-baralho" value={nomeNovoBaralho}
            onChange={(evento) => setNomeNovoBaralho(evento.target.value)} />
          <button type="button" onClick={() => void criarBaralho()}>{textos.selecao.criarBaralho}</button>
          {falha !== null && <p role="alert"><TextoDoProduto texto={falha} /></p>}
        </div>
      ) : (
        <form onSubmit={(evento) => void concluir(evento)}>
          {cartoes.map((cartao) => {
            const compartilhado = cartao.baralhos.length > 1;
            const opcoes = compartilhado ? cartao.baralhos : baralhosDisponiveis;
            return (
              <div className="campo" key={cartao.id}>
                <label className="rotulo" htmlFor={`destino-${cartao.id}`}>
                  {cartao.frente}
                </label>
                <p>{cartao.verso}</p>
                <p>
                  {compartilhado
                    ? textos.selecao.escolhaOndeManterOriginal
                    : textos.selecao.escolhaBaralhoCartao}
                </p>
                <select
                  id={`destino-${cartao.id}`}
                  value={destinos[cartao.id] ?? ""}
                  onChange={(evento) =>
                    setDestinos((atuais) => ({
                      ...atuais,
                      [cartao.id]: evento.target.value,
                    }))
                  }
                  required
                >
                  <option value="">{textos.selecao.selecioneUmBaralho}</option>
                  {opcoes.map((baralho) => (
                    <option key={baralho.id} value={baralho.id}>
                      {baralho.nome}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
          {falha !== null && <p role="alert" className="aviso aviso--erro"><TextoDoProduto texto={falha} /></p>}
          <button ref={botao} className="botao botao--primario" disabled={salvando}>
            {salvando ? textos.selecao.salvando : textos.selecao.concluirOrganizacao}
          </button>
        </form>
      )}
    </section>
  );
}
