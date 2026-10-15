import { useEffect, useRef, useState } from "react";

import type { BaralhoListado, ClienteDoAcervo, PreviaDaExportacao } from "../acervo-cliente/cliente";
import { useIdioma } from "../idioma";
import { EstadoDaCarga } from "./EstadoDaCarga";

interface PropriedadesDaPaginaDeExportacao {
  cliente: ClienteDoAcervo;
  baralhoId?: string;
  todos?: boolean;
  navegar?: (url: string) => void;
}

export function PaginaDeExportacao({
  cliente,
  baralhoId,
  todos = false,
  navegar = (url: string) => window.location.assign(url),
}: PropriedadesDaPaginaDeExportacao) {
  const { textos, idioma, formatarNumero } = useIdioma();
  const [baralhos, setBaralhos] = useState<BaralhoListado[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>(baralhoId ? [baralhoId] : []);
  const [previa, setPrevia] = useState<PreviaDaExportacao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [concluida, setConcluida] = useState<{ url: string; nome: string; semMidia: number } | null>(null);
  const ultimaPrevia = useRef(0);
  const [tentativaDeListagem, setTentativaDeListagem] = useState(0);
  const focoDaFalha = useRef<HTMLParagraphElement>(null);
  const geracaoEmCurso = useRef(false);

  useEffect(() => {
    let ativa = true;
    void cliente.listarBaralhos().then((resultado) => {
      if (!ativa) return;
      if (!resultado.ok) { setFalha(resultado.mensagem); setCarregando(false); return; }
      const lista = baralhoId ? resultado.baralhos.filter((b) => b.id === baralhoId) : resultado.baralhos;
      setBaralhos(lista);
      setSelecionados(baralhoId ? lista.map((b) => b.id) : todos ? lista.map((b) => b.id) : []);
      setCarregando(false);
    }).catch(() => {
      if (!ativa) return;
      setFalha(textos.exportacao.falha);
      setCarregando(false);
    });
    return () => { ativa = false; };
  }, [cliente, baralhoId, todos, tentativaDeListagem]);

  useEffect(() => {
    if (falha) focoDaFalha.current?.focus();
  }, [falha]);

  useEffect(() => {
    if (carregando || selecionados.length === 0) { setPrevia(null); return; }
    const atual = ++ultimaPrevia.current;
    const atraso = window.setTimeout(() => {
      void cliente.previaDaExportacao({ formato: "apkg", baralhos: selecionados }).then((resultado) => {
        if (atual !== ultimaPrevia.current) return;
        if (resultado.ok) { setPrevia(resultado.previa); setFalha(null); }
        else { setPrevia(null); setFalha(resultado.mensagem); }
      }).catch(() => {
        if (atual === ultimaPrevia.current) { setPrevia(null); setFalha(textos.exportacao.falha); }
      });
    }, 120);
    return () => window.clearTimeout(atraso);
  }, [cliente, carregando, selecionados]);

  const quantidade = baralhos.filter((b) => selecionados.includes(b.id)).reduce((soma, b) => soma + b.quantidadeDeCartoes, 0);
  const tudoMarcado = baralhos.length > 0 && selecionados.length === baralhos.length;

  async function exportar() {
    if (falha && baralhos.length === 0 && !baralhoId) {
      setFalha(null);
      setCarregando(true);
      setTentativaDeListagem((atual) => atual + 1);
      return;
    }
    if (geracaoEmCurso.current || gerando || selecionados.length === 0 || quantidade === 0) return;
    geracaoEmCurso.current = true;
    setGerando(true); setFalha(null); setConcluida(null);
    const resultado = await cliente.exportar({
      formato: "apkg", baralhos: selecionados,
      fuso: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", idioma,
    }).catch(() => null);
    geracaoEmCurso.current = false;
    setGerando(false);
    if (resultado === null) { setFalha(textos.exportacao.falha); return; }
    if (!resultado.ok) { setFalha(resultado.mensagem); return; }
    setConcluida({ url: resultado.url, nome: resultado.nomeDoArquivo, semMidia: resultado.cartoesSemMidia });
    navegar(resultado.url);
  }

  return <main className="pagina pagina--exportacao">
    <header className="cabecalho-da-pagina"><h1>{textos.exportacao.titulo}</h1></header>
    {carregando ? <EstadoDaCarga estado="carregando" mensagem={textos.exportacao.carregando} /> : null}
    {!carregando && baralhoId && baralhos.length === 0 ? <p role="alert">{textos.recusa({ erro: "nao_encontrado" }, "exportacao")}</p> : null}
    {!carregando && !baralhoId ? <fieldset className="lista-exportacao">
      <legend>{textos.exportacao.todos}</legend>
      <label className="linha-de-selecao"><input type="checkbox" checked={tudoMarcado} onChange={() => setSelecionados(tudoMarcado ? [] : baralhos.map((b) => b.id))} />{textos.exportacao.todos}</label>
      {baralhos.map((baralho) => <label className="linha-de-selecao" key={baralho.id}>
        <input type="checkbox" checked={selecionados.includes(baralho.id)} onChange={(evento) => setSelecionados((atual) => evento.target.checked ? [...atual, baralho.id] : atual.filter((id) => id !== baralho.id))} />
        <span>{baralho.nome}</span><span className="texto-secundario">{baralho.quantidadeDeCartoes}</span>
      </label>)}
    </fieldset> : null}
    {!carregando && baralhoId && baralhos.length === 1 ? <p>{baralhos[0]!.nome} · {baralhos[0]!.quantidadeDeCartoes}</p> : null}
    <fieldset className="formato-exportacao"><legend>{textos.exportacao.formato}</legend>
      <label><input type="radio" name="formato-exportacao" checked readOnly /> {textos.exportacao.opcaoFormato}</label>
      <p className="texto-secundario">{textos.exportacao.ajuda}</p>
    </fieldset>
    <section aria-live="polite" className="resumo-exportacao">
      {previa ? <><p>{textos.exportacao.resumoBaralhos(previa.baralhos)} · {textos.exportacao.resumoCartoes(previa.cartoes)}</p>
        <p>{textos.exportacao.resumoMidias(previa.cartoesComImagem, previa.cartoesComAudio)}</p>
        {previa.cartoesComImagem + previa.cartoesComAudio > 0 ? <p>{textos.exportacao.tamanho(formatarNumero(previa.bytesEstimados, { style: "unit", unit: "byte", maximumFractionDigits: 1 }))}</p> : null}</> : null}
      {selecionados.length === 0 ? <p>{textos.exportacao.marcarUm}</p> : null}
      {selecionados.length > 0 && quantidade === 0 ? <p>{textos.exportacao.semCartoes}</p> : null}
      {gerando ? <p role="status">{textos.exportacao.gerando}</p> : null}
      {falha ? <p ref={focoDaFalha} role="alert" tabIndex={-1}>{falha}</p> : null}
      {concluida ? <div role="status"><p>{textos.exportacao.pronto(concluida.nome)}</p><a className="botao botao--secundario" href={concluida.url}>{textos.exportacao.baixarDeNovo}</a>{concluida.semMidia > 0 ? <p>{textos.exportacao.semMidia(concluida.semMidia)}</p> : null}</div> : null}
    </section>
    <button className="botao botao--primario" type="button" disabled={gerando || (!falha && (selecionados.length === 0 || quantidade === 0))} onClick={() => void exportar()}>
      {gerando ? textos.exportacao.gerando : falha ? textos.comum.tentarNovamente : textos.exportacao.exportar}
    </button>
  </main>;
}
