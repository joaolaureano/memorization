import { useState } from "react";
import type { ClienteDoAcervo, PreviaDeImportacao } from "../acervo-cliente/cliente";
import { irParaRota } from "./navegacao";
import { CampoDeTags } from "./CampoDeTags";

type Grupo = PreviaDeImportacao["baralhos"][number];

function tagsIguais(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((tag, i) => tag === b[i]);
}

export function PaginaDeImportacaoAnki({ cliente }: { cliente: ClienteDoAcervo }) {
  const [previa, setPrevia] = useState<PreviaDeImportacao | null>(null);
  const [original, setOriginal] = useState<PreviaDeImportacao | null>(null);
  const [falha, setFalha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [arquivoNome, setArquivoNome] = useState("");
  const [tituloEditando, setTituloEditando] = useState<number | null>(null);
  const [cartaoEditando, setCartaoEditando] = useState<string | null>(null);

  async function selecionar(arquivo?: File) {
    if (!arquivo) return;
    if (!arquivo.name.toLowerCase().endsWith(".apkg")) {
      setFalha("Selecione um arquivo .apkg do Anki.");
      return;
    }
    setArquivoNome(arquivo.name);
    setFalha("");
    setCarregando(true);
    const resultado = await cliente.preverImportacaoAnki(arquivo);
    setCarregando(false);
    if (resultado.ok) {
      setPrevia(resultado.previa);
      setOriginal(resultado.previa);
    } else setFalha(resultado.mensagem);
  }

  function atualizarGrupo(indice: number, atualizar: (grupo: Grupo) => Grupo) {
    setPrevia((atual) => atual && ({
      ...atual,
      baralhos: atual.baralhos.map((grupo, i) => i === indice ? atualizar(grupo) : grupo),
    }));
  }

  function atualizarCartao(bi: number, ci: number, atualizar: (grupo: Grupo["cartoes"][number]) => Grupo["cartoes"][number]) {
    atualizarGrupo(bi, (grupo) => ({
      ...grupo,
      cartoes: grupo.cartoes.map((cartao, i) => {
        if (i !== ci) return cartao;
        const alterado = atualizar(cartao);
        const base = original?.baralhos[bi]?.cartoes[ci];
        const igualAoOriginal = base !== undefined
          && alterado.frente === base.frente
          && alterado.verso === base.verso
          && tagsIguais(alterado.tags, base.tags);
        return { ...alterado, estado: base && igualAoOriginal ? base.estado : "modificado" };
      }),
    }));
  }

  async function confirmar() {
    if (!previa) return;
    setSalvando(true);
    setFalha("");
    const resultado = await cliente.confirmarImportacaoAnki(previa.baralhos.map(({ nome, cartoes }) => ({
      nome,
      cartoes: cartoes.map(({ frente, verso, tags }) => ({ frente, verso, tags })),
    })));
    setSalvando(false);
    if (resultado.ok) irParaRota("#/baralhos");
    else setFalha(resultado.mensagem ?? "Não foi possível concluir a importação.");
  }

  return (
    <section className="pagina pagina--importacao-anki">
      <header className="cabecalho-da-pagina">
        <div><h1>Importar baralho</h1><p>Importe arquivos Anki no formato .apkg.</p></div>
        <button className="botao botao--secundario" onClick={() => irParaRota("#/baralhos")}>Cancelar</button>
      </header>
      {!previa && <label className="campo"><span>Arquivo .apkg</span><input type="file" accept=".apkg,application/octet-stream" onChange={(evento) => void selecionar(evento.currentTarget.files?.[0])} />{arquivoNome && <small>{arquivoNome}</small>}</label>}
      {carregando && <p role="status">Lendo arquivo Anki…</p>}
      {falha && <p className="mensagem mensagem--erro" role="alert">{falha}</p>}
      {previa && <>
        {(previa.avisos.notasIgnoradas > 0 || previa.avisos.conteudoIgnorado > 0) && <p className="aviso" role="status">Conteúdo ignorado: {previa.avisos.notasIgnoradas} notas não básicas ou incompletas e {previa.avisos.conteudoIgnorado} cartões com HTML ou mídia. HTML é convertido em texto e mídias não são importadas.</p>}
        {previa.baralhos.map((baralho, bi) => <section className="grupo-importacao" key={bi}>
          <div className="editor-do-titulo"><h2>{baralho.nome}</h2><button className="botao botao--secundario" onClick={() => setTituloEditando(tituloEditando === bi ? null : bi)}>{tituloEditando === bi ? "Concluir edição" : "Editar título"}</button></div>
          {tituloEditando === bi && <label className="campo"><span>Nome do baralho</span><input value={baralho.nome} maxLength={100} onChange={(e) => atualizarGrupo(bi, (grupo) => ({ ...grupo, nome: e.target.value }))} /></label>}
          <ul className="lista lista--compacta">{baralho.cartoes.map((cartao, ci) => {
            const chave = `${bi}:${ci}`;
            const editando = cartaoEditando === chave;
            return <li className={`linha-da-lista linha-importacao linha-importacao--${cartao.estado}${editando ? " linha-importacao--editando" : ""}`} key={chave}>
              <span className={`etiqueta etiqueta--${cartao.estado}`}>{cartao.estado === "adicionado" ? "Adicionado" : "Modificado"}</span>
              {editando ? <>
                <label className="campo"><span>Frente</span><textarea value={cartao.frente} onChange={(e) => atualizarCartao(bi, ci, (c) => ({ ...c, frente: e.target.value }))} /></label>
                <label className="campo"><span>Verso</span><textarea value={cartao.verso} onChange={(e) => atualizarCartao(bi, ci, (c) => ({ ...c, verso: e.target.value }))} /></label>
                <CampoDeTags tags={cartao.tags} aoAlterar={(tags) => atualizarCartao(bi, ci, (c) => ({ ...c, tags }))} />
              </> : <div className="importacao-cartao__texto"><strong>{cartao.frente}</strong><p>{cartao.verso}</p></div>}
              <button className="botao botao--secundario" onClick={() => setCartaoEditando(editando ? null : chave)}>{editando ? "Concluir" : "Editar"}</button>
            </li>;
          })}</ul>
        </section>)}
        <footer className="acoes-da-pagina"><button className="botao botao--secundario" onClick={() => { setPrevia(null); setOriginal(null); setArquivoNome(""); }}>Escolher outro arquivo</button><button className="botao botao--primario" disabled={salvando || previa.baralhos.length === 0} onClick={() => void confirmar()}>{salvando ? "Importando…" : "Confirmar importação"}</button></footer>
      </>}
    </section>
  );
}
